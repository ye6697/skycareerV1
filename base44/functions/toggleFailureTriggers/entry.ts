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
    if (typeof enabled !== 'boolean') {
      return Response.json({ error: 'enabled boolean required' }, { status: 400 });
    }

    const userCompanyId = resolveUserCompanyId(user);
    let company = null;

    const tryLoadCompanyById = async (id: string | null) => {
      if (!id) return null;
      const rows = await base44.asServiceRole.entities.Company.filter({ id });
      return rows[0] || null;
    };

    company = await tryLoadCompanyById(requestedCompanyId);
    if (!company) company = await tryLoadCompanyById(userCompanyId);
    if (!company && user?.email) {
      const rows = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
      company = rows[0] || null;
    }
    if (!company) {
      const allCompanies = await base44.asServiceRole.entities.Company.list();
      if (allCompanies.length === 1) company = allCompanies[0];
    }
    if (!company?.id) {
      return Response.json({ error: 'Unternehmen nicht gefunden' }, { status: 404 });
    }

    if (userCompanyId && userCompanyId !== company.id && company.created_by !== user.email) {
      return Response.json({ error: 'Keine Berechtigung fuer dieses Unternehmen' }, { status: 403 });
    }

    await base44.asServiceRole.entities.Company.update(company.id, {
      failure_triggers_enabled: !!enabled,
    });

    if (!userCompanyId || userCompanyId !== company.id) {
      try {
        await base44.auth.updateMe({ company_id: company.id });
      } catch (_) {
        // Keep toggle result successful even if profile sync fails.
      }
    }

    return Response.json({
      success: true,
      enabled: !!enabled,
      company_id: company.id,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'toggle failed' }, { status: 500 });
  }
});

