import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const resolveUserCompanyId = (user: any): string | null => (
  user?.company_id
  || user?.data?.company_id
  || user?.company?.id
  || user?.data?.company?.id
  || null
);

const resolveUserFailurePref = (user: any): boolean | null => {
  const direct = user?.failure_triggers_enabled_user;
  if (typeof direct === 'boolean') return direct;
  const nested = user?.data?.failure_triggers_enabled_user;
  if (typeof nested === 'boolean') return nested;
  // Legacy fallback
  const legacyDirect = user?.failure_triggers_enabled;
  if (typeof legacyDirect === 'boolean') return legacyDirect;
  const legacyNested = user?.data?.failure_triggers_enabled;
  if (typeof legacyNested === 'boolean') return legacyNested;
  return null;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const enabled = body?.enabled;
    const requestedCompanyId = body?.companyId ? String(body.companyId) : null;
    const requestedEnabled = typeof enabled === 'boolean' ? !!enabled : null;
    const userEmail = String(user?.email || '').trim().toLowerCase();

    const userCompanyId = resolveUserCompanyId(user);
    const ownedCompanies = user?.email
      ? await base44.asServiceRole.entities.Company.filter({ created_by: user.email }).catch(() => [])
      : [];
    const ownedCompanyIds = (Array.isArray(ownedCompanies) ? ownedCompanies : [])
      .map((row: any) => row?.id)
      .filter(Boolean);
    const companyIdSet = new Set<string>();
    if (requestedCompanyId) companyIdSet.add(requestedCompanyId);
    if (userCompanyId) companyIdSet.add(String(userCompanyId));
    for (const cid of ownedCompanyIds) {
      companyIdSet.add(String(cid));
    }
    const targetCompanyIds = Array.from(companyIdSet);
    const targetCompanyId = requestedCompanyId
      || userCompanyId
      || (targetCompanyIds[0] ? String(targetCompanyIds[0]) : null);
    let persistedEnabled = resolveUserFailurePref(user);

    if (typeof requestedEnabled === 'boolean') {
      persistedEnabled = requestedEnabled;
      await base44.auth.updateMe({
        failure_triggers_enabled_user: requestedEnabled,
        ...(targetCompanyId && (!userCompanyId || String(userCompanyId) !== String(targetCompanyId))
          ? { company_id: targetCompanyId }
          : {}),
      }).catch(() => null);

      const isWorkerRestartCommand = (cmd: any) => {
        const commandType = String(cmd?.type || '').toLowerCase().trim();
        return commandType === 'worker_restart'
          || commandType === 'restart_worker'
          || commandType === 'bridge_worker_restart';
      };
      let activeFlights: any[] = [];
      if (targetCompanyId) {
        const byCompany = await base44.asServiceRole.entities.Flight
          .filter({ company_id: targetCompanyId, status: 'in_flight' })
          .catch(() => []);
        const all = Array.isArray(byCompany) ? byCompany : [];
        const ownFlights = userEmail
          ? all.filter((fl: any) => String(fl?.created_by || '').trim().toLowerCase() === userEmail)
          : all;
        activeFlights = ownFlights.length > 0 ? ownFlights : all.slice(0, 1);
      }
      await Promise.all(
        (Array.isArray(activeFlights) ? activeFlights : [])
          .filter((fl: any) => fl?.id)
          .map(async (fl: any) => {
            const rawQueue = Array.isArray(fl?.bridge_command_queue)
              ? fl.bridge_command_queue
              : (Array.isArray(fl?.xplane_data?.bridge_command_queue)
                  ? fl.xplane_data.bridge_command_queue
                  : []);
            let nextQueue = requestedEnabled
              ? rawQueue
              : rawQueue.filter((cmd: any) => isWorkerRestartCommand(cmd));
            if (!requestedEnabled) {
              const hasRestart = nextQueue.some((cmd: any) => isWorkerRestartCommand(cmd));
              if (!hasRestart) {
                nextQueue = [
                  ...nextQueue,
                  {
                    id: `cmd-worker-restart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    type: 'bridge_worker_restart',
                    simulator: 'msfs',
                    created_at: new Date().toISOString(),
                    source: 'failure_toggle_off',
                    persist_until_landed: false,
                  },
                ];
              }
            }
            const nextXplaneData = {
              ...(fl?.xplane_data || {}),
              failure_triggers_enabled: requestedEnabled,
              bridge_command_queue: nextQueue,
              maintenance_failure_category: requestedEnabled ? (fl?.xplane_data?.maintenance_failure_category ?? null) : null,
              maintenance_failure_severity: requestedEnabled ? (fl?.xplane_data?.maintenance_failure_severity ?? null) : null,
              maintenance_failure_timestamp: requestedEnabled ? (fl?.xplane_data?.maintenance_failure_timestamp ?? null) : null,
            };
            const updatePayload: any = {
              bridge_command_queue: nextQueue,
              xplane_data: nextXplaneData,
            };
            if (!requestedEnabled) {
              updatePayload.active_failures = [];
            }
            await base44.asServiceRole.entities.Flight.update(fl.id, updatePayload).catch(() => null);
          })
      );
    } else if (persistedEnabled === null && targetCompanyId) {
      const byCompany = await base44.asServiceRole.entities.Flight
        .filter({ company_id: targetCompanyId, status: 'in_flight' })
        .catch(() => []);
      const all = Array.isArray(byCompany) ? byCompany : [];
      const ownFlights = userEmail
        ? all.filter((fl: any) => String(fl?.created_by || '').trim().toLowerCase() === userEmail)
        : all;
      const probeFlight = ownFlights[0] || all[0] || null;
      const probeFlag = probeFlight?.xplane_data?.failure_triggers_enabled;
      if (typeof probeFlag === 'boolean') {
        persistedEnabled = probeFlag;
      }
    }

    return Response.json({
      success: true,
      enabled: persistedEnabled !== false,
      company_id: targetCompanyId,
      company_ids: targetCompanyId ? [targetCompanyId] : [],
      settings_id: null,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'toggle failed' }, { status: 500 });
  }
});
