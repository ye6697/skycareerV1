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
    const persistedEnabled = refreshedSettingsRows.length
      ? refreshedSettingsRows.some((row) => row?.failure_triggers_enabled !== false)
      : (typeof enabled === 'boolean' ? !!enabled : true);

    if (companyId) {
      // Keep company field synced with global setting (best effort).
      await base44.asServiceRole.entities.Company.update(companyId, {
        failure_triggers_enabled: persistedEnabled,
      }).catch(() => null);
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
