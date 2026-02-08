import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company - prefer company_id from user, fallback to created_by
    let company = null;
    const companyId = user.company_id || user.data?.company_id;
    if (companyId) {
      const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
      company = companies[0] || null;
    }
    if (!company) {
      const companies = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
      company = companies[0] || null;
    }
    
    if (!company) {
      return Response.json({ company: null, aircraft: [], contracts: [] });
    }

    // Get aircraft for this company
    const allAircraft = await base44.asServiceRole.entities.Aircraft.filter({ company_id: company.id });
    const aircraft = allAircraft.filter(a => a.status !== 'sold');

    // Get contracts for this company (available + accepted)
    const allContracts = await base44.asServiceRole.entities.Contract.filter({ company_id: company.id });
    const contracts = allContracts.filter(c => c.status === 'available' || c.status === 'accepted');

    return Response.json({ company, aircraft, contracts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});