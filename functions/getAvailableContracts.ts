import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const companies = await base44.entities.Company.filter({ created_by: user.email });
    const company = companies[0];
    if (!company) {
      return Response.json({ contracts: [] });
    }

    // Use service role to get all contracts (available + accepted for this company)
    const availableContracts = await base44.asServiceRole.entities.Contract.filter({ status: 'available' });
    const acceptedContracts = await base44.asServiceRole.entities.Contract.filter({ status: 'accepted', company_id: company.id });
    
    // Filter available: show contracts that either have no company_id (global) or belong to this user's company
    const filteredAvailable = availableContracts.filter(c => 
      !c.company_id || c.company_id === company.id
    );
    
    const allContracts = [...filteredAvailable, ...acceptedContracts];
    
    return Response.json({ contracts: allContracts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});