import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status } = await req.json();

    if (!['connected', 'disconnected', 'connecting'].includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Update company connection status
    const companies = await base44.entities.Company.filter({ created_by: user.email });
    const company = companies[0];

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    await base44.entities.Company.update(company.id, {
      xplane_connection_status: status
    });

    return Response.json({ 
      success: true,
      status 
    });

  } catch (error) {
    console.error('Error updating X-Plane connection:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});