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
    
    return Response.json({ contracts: availableContracts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});