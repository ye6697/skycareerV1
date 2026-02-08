import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company using service role
    const companies = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
    const company = companies[0] || null;
    
    if (!company) {
      return Response.json({ company: null, aircraft: [] });
    }

    // Get aircraft for this company
    const allAircraft = await base44.asServiceRole.entities.Aircraft.filter({ company_id: company.id });
    const aircraft = allAircraft.filter(a => a.status !== 'sold');

    return Response.json({ company, aircraft });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});