import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Use service role to bypass RLS
    const contracts = await base44.asServiceRole.entities.Contract.list();
    
    // Filter for available contracts without company_id
    const availableContracts = contracts.filter(c => 
      c.status === 'available' && !c.company_id
    );
    
    // Get company level
    const user = await base44.auth.me();
    const companies = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
    const companyLevel = companies[0]?.level || 1;
    
    // Filter by level requirement
    const filteredByLevel = availableContracts.filter(c => 
      (c.level_requirement || 1) <= companyLevel
    );
    
    return Response.json({ contracts: filteredByLevel });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});