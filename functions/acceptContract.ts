import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contractId } = await req.json();
    if (!contractId) {
      return Response.json({ error: 'contractId required' }, { status: 400 });
    }

    // Get user's company - prefer company_id from user, fallback to created_by
    let company = null;
    if (user.company_id) {
      const companies = await base44.asServiceRole.entities.Company.filter({ id: user.company_id });
      company = companies[0] || null;
    }
    if (!company) {
      const companies = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
      company = companies[0] || null;
    }
    if (!company) {
      return Response.json({ error: 'Keine Firma gefunden' }, { status: 400 });
    }

    // Update contract via service role
    await base44.asServiceRole.entities.Contract.update(contractId, {
      status: 'accepted',
      company_id: company.id
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});