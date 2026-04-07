import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const resolveUserCompanyId = (user: any): string | null => (
  user?.company_id
  || user?.data?.company_id
  || user?.company?.id
  || user?.data?.company?.id
  || null
);

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
    const companyId = targetCompanyIds[0] || null;

    const settingsRows = await base44.asServiceRole.entities.GameSettings.list();
    let settings = settingsRows[0] || null;
    if (typeof enabled === 'boolean') {
      if (!settingsRows.length) {
        settings = await base44.asServiceRole.entities.GameSettings.create({
          failure_triggers_enabled: !!enabled,
        });
      } else {
        await Promise.all(
          settingsRows
            .filter((row) => row?.id)
            .map((row) => base44.asServiceRole.entities.GameSettings.update(row.id, {
              failure_triggers_enabled: !!enabled,
            }))
        );
        settings = settingsRows[0] || null;
      }
      // Keep company field in sync if available (best effort only).
      if (targetCompanyIds.length > 0) {
        await Promise.allSettled(
          targetCompanyIds.map((cid) => (
            base44.asServiceRole.entities.Company.update(cid, {
              failure_triggers_enabled: !!enabled,
            })
          ))
        );
      }
      if (companyId && (!userCompanyId || String(userCompanyId) !== companyId)) {
        try {
          await base44.auth.updateMe({ company_id: companyId });
        } catch (_) {
          // no-op
        }
      }
    }

    const refreshedSettingsRows = await base44.asServiceRole.entities.GameSettings.list();
    const refreshedSettings = refreshedSettingsRows[0] || settings;
    const requestedEnabled = typeof enabled === 'boolean' ? !!enabled : null;
    let persistedEnabled = typeof requestedEnabled === 'boolean'
      ? requestedEnabled
      : (refreshedSettingsRows.length
          ? refreshedSettingsRows.every((row) => row?.failure_triggers_enabled !== false)
          : true);

    const companyRowsForState = targetCompanyIds.length > 0
      ? (await Promise.all(
          targetCompanyIds.map((cid) => (
            base44.asServiceRole.entities.Company.filter({ id: cid }).catch(() => [])
          ))
        )).flat()
      : [];
    const companyRowsWithFlag = companyRowsForState.filter(
      (row: any) => typeof row?.failure_triggers_enabled === 'boolean'
    );
    const preferredCompanyRow = companyRowsForState.find(
      (row: any) =>
        row?.id &&
        (
          (requestedCompanyId && String(row.id) === String(requestedCompanyId)) ||
          (userCompanyId && String(row.id) === String(userCompanyId))
        )
    );
    if (typeof requestedEnabled !== 'boolean' && preferredCompanyRow && typeof preferredCompanyRow?.failure_triggers_enabled === 'boolean') {
      persistedEnabled = preferredCompanyRow.failure_triggers_enabled !== false;
    } else if (typeof requestedEnabled !== 'boolean' && companyRowsWithFlag.length > 0) {
      const allCompanyFlagsEnabled = companyRowsWithFlag.every((row: any) => row?.failure_triggers_enabled !== false);
      persistedEnabled = persistedEnabled && allCompanyFlagsEnabled;
    }

    if (typeof requestedEnabled === 'boolean' && targetCompanyIds.length > 0) {
      // Enforce requested value for each resolved company ID.
      // This avoids reverting to stale reads when GameSettings replication lags.
      await Promise.allSettled(
        targetCompanyIds.map((cid) => (
          base44.asServiceRole.entities.Company.update(cid, {
            failure_triggers_enabled: requestedEnabled,
          })
        ))
      );
      persistedEnabled = requestedEnabled;
    }

    if (typeof requestedEnabled === 'boolean') {
      const isWorkerRestartCommand = (cmd: any) => {
        const commandType = String(cmd?.type || '').toLowerCase().trim();
        return commandType === 'worker_restart'
          || commandType === 'restart_worker'
          || commandType === 'bridge_worker_restart';
      };
      let activeFlights: any[] = [];
      if (targetCompanyIds.length > 0) {
        const byCompany = await Promise.all(
          targetCompanyIds.map((cid) => (
            base44.asServiceRole.entities.Flight.filter({ company_id: cid, status: 'in_flight' }).catch(() => [])
          ))
        );
        const dedupe = new Map<string, any>();
        for (const row of byCompany.flat()) {
          if (row?.id) dedupe.set(String(row.id), row);
        }
        activeFlights = Array.from(dedupe.values());
      } else {
        activeFlights = await base44.asServiceRole.entities.Flight.filter({ status: 'in_flight' });
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
    }

    return Response.json({
      success: true,
      enabled: persistedEnabled,
      company_id: companyId,
      company_ids: targetCompanyIds,
      settings_id: refreshedSettings?.id || null,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'toggle failed' }, { status: 500 });
  }
});
