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
    let companyId = requestedCompanyId || userCompanyId || null;
    if (!companyId && user?.email) {
      const rows = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
      companyId = rows?.[0]?.id || null;
    }

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
      if (companyId) {
        await base44.asServiceRole.entities.Company.update(companyId, {
          failure_triggers_enabled: !!enabled,
        }).catch(() => null);
      }
      if (companyId && (!userCompanyId || userCompanyId !== companyId)) {
        try {
          await base44.auth.updateMe({ company_id: companyId });
        } catch (_) {
          // no-op
        }
      }
    }

    const refreshedSettingsRows = await base44.asServiceRole.entities.GameSettings.list();
    const refreshedSettings = refreshedSettingsRows[0] || settings;
    let persistedEnabled = refreshedSettingsRows.length
      ? refreshedSettingsRows.every((row) => row?.failure_triggers_enabled !== false)
      : (typeof enabled === 'boolean' ? !!enabled : true);

    if (!refreshedSettingsRows.length && typeof enabled !== 'boolean' && companyId) {
      const companyRows = await base44.asServiceRole.entities.Company.filter({ id: companyId });
      const companyFlag = companyRows?.[0]?.failure_triggers_enabled;
      if (typeof companyFlag === 'boolean') {
        persistedEnabled = companyFlag;
      }
    }

    if (companyId) {
      // Keep company field synced with global setting (best effort).
      await base44.asServiceRole.entities.Company.update(companyId, {
        failure_triggers_enabled: persistedEnabled,
      }).catch(() => null);
    }

    if (typeof enabled === 'boolean') {
      const isWorkerRestartCommand = (cmd: any) => {
        const commandType = String(cmd?.type || '').toLowerCase().trim();
        return commandType === 'worker_restart'
          || commandType === 'restart_worker'
          || commandType === 'bridge_worker_restart';
      };
      const flightFilter = companyId
        ? { company_id: companyId, status: 'in_flight' }
        : { status: 'in_flight' };
      const activeFlights = await base44.asServiceRole.entities.Flight.filter(flightFilter);
      await Promise.all(
        (Array.isArray(activeFlights) ? activeFlights : [])
          .filter((fl: any) => fl?.id)
          .map(async (fl: any) => {
            const rawQueue = Array.isArray(fl?.bridge_command_queue)
              ? fl.bridge_command_queue
              : (Array.isArray(fl?.xplane_data?.bridge_command_queue)
                  ? fl.xplane_data.bridge_command_queue
                  : []);
            const nextQueue = enabled
              ? rawQueue
              : rawQueue.filter((cmd: any) => isWorkerRestartCommand(cmd));
            const nextXplaneData = {
              ...(fl?.xplane_data || {}),
              failure_triggers_enabled: !!enabled,
              bridge_command_queue: nextQueue,
              maintenance_failure_category: enabled ? (fl?.xplane_data?.maintenance_failure_category ?? null) : null,
              maintenance_failure_severity: enabled ? (fl?.xplane_data?.maintenance_failure_severity ?? null) : null,
              maintenance_failure_timestamp: enabled ? (fl?.xplane_data?.maintenance_failure_timestamp ?? null) : null,
            };
            const updatePayload: any = {
              bridge_command_queue: nextQueue,
              xplane_data: nextXplaneData,
            };
            if (!enabled && Array.isArray(fl?.active_failures)) {
              updatePayload.active_failures = fl.active_failures.filter((f: any) => (
                String(f?.source || '').toLowerCase() !== 'bridge_maintenance_failure'
              ));
            }
            await base44.asServiceRole.entities.Flight.update(fl.id, updatePayload).catch(() => null);
          })
      );
    }

    return Response.json({
      success: true,
      enabled: persistedEnabled,
      company_id: companyId,
      settings_id: refreshedSettings?.id || null,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'toggle failed' }, { status: 500 });
  }
});
