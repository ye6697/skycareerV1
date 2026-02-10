import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all companies
    const companies = await base44.asServiceRole.entities.Company.list();

    for (const company of companies) {
      if (company.xplane_connection_status === 'connected') {
        // Get the most recent log for this company
        const logs = await base44.asServiceRole.entities.XPlaneLog.filter(
          { company_id: company.id },
          '-created_date',
          1
        );

        if (logs.length === 0) {
          // No logs at all - disconnect
          await base44.asServiceRole.entities.Company.update(company.id, {
            xplane_connection_status: 'disconnected'
          });
          continue;
        }

        const lastLog = logs[0];
        const lastUpdate = new Date(lastLog.created_date);
        const now = new Date();
        const secondsSinceLastUpdate = (now - lastUpdate) / 1000;

        // If no data in last 15 seconds, mark as disconnected
        // Note: This only changes connection status, it does NOT affect active flights
        if (secondsSinceLastUpdate > 15) {
          await base44.asServiceRole.entities.Company.update(company.id, {
            xplane_connection_status: 'disconnected'
          });
        }
      }
    }

    return Response.json({ 
      message: 'Timeout check completed',
      companies_checked: companies.length
    });

  } catch (error) {
    console.error('Error checking X-Plane timeout:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});