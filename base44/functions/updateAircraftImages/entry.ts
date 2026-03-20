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
      
      if (template) {
        const updateData = {};
        
        if (template.image_url) {
          updateData.image_url = template.image_url;
        }
        
        if (template.purchase_price && (!aircraft.purchase_price || aircraft.purchase_price === 0)) {
          updateData.purchase_price = template.purchase_price;
        }
        
        if (template.purchase_price && (!aircraft.current_value || aircraft.current_value === 0)) {
          updateData.current_value = template.purchase_price;
        }
        
        if (Object.keys(updateData).length > 0) {
          await base44.asServiceRole.entities.Aircraft.update(aircraft.id, updateData);
          updated++;
        }
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