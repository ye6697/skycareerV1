import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companies = await base44.entities.Company.list();
    const company = companies[0];
    
    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    let apiKey = company.xplane_api_key;
    
    // Generate API key if not exists
    if (!apiKey) {
      apiKey = crypto.randomUUID();
      await base44.entities.Company.update(company.id, { xplane_api_key: apiKey });
    }

    return Response.json({ api_key: apiKey });

  } catch (error) {
    console.error('Error ensuring API key:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});