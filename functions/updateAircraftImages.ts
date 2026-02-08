import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all templates
    const templates = await base44.asServiceRole.entities.AircraftTemplate.list();
    
    // Get all aircraft
    const allAircraft = await base44.asServiceRole.entities.Aircraft.list();
    
    let updated = 0;
    
    for (const aircraft of allAircraft) {
      const template = templates.find(t => t.name === aircraft.name);
      
      if (template && template.image_url) {
        await base44.asServiceRole.entities.Aircraft.update(aircraft.id, {
          image_url: template.image_url
        });
        updated++;
      }
    }
    
    return Response.json({ 
      success: true, 
      updated,
      message: `${updated} Flugzeuge aktualisiert`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});