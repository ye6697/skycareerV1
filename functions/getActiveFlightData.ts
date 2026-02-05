import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const flightId = url.searchParams.get('flight_id');

    if (!flightId) {
      return Response.json({ error: 'flight_id parameter required' }, { status: 400 });
    }

    // Get flight data
    const flights = await base44.entities.Flight.filter({ id: flightId });
    const flight = flights[0];

    if (!flight) {
      return Response.json({ error: 'Flight not found' }, { status: 404 });
    }

    // Return latest X-Plane data
    return Response.json({
      flight_id: flight.id,
      status: flight.status,
      xplane_data: flight.xplane_data || null,
      max_g_force: flight.max_g_force || 1.0,
      departure_time: flight.departure_time,
      arrival_time: flight.arrival_time,
      ratings: flight.status === 'completed' ? {
        takeoff: flight.takeoff_rating,
        flight: flight.flight_rating,
        landing: flight.landing_rating,
        overall: flight.overall_rating
      } : null
    });

  } catch (error) {
    console.error('Error getting flight data:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});