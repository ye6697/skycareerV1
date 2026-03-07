import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const cid = user?.company_id;
    if (!cid) return Response.json({ error: 'No company found' }, { status: 400 });

    // Check connection status first
    const companies = await base44.asServiceRole.entities.Company.filter({ id: cid });
    const company = companies[0];
    if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

    if (company.xplane_connection_status !== 'connected') {
      return Response.json({ error: 'Simulator not connected' }, { status: 400 });
    }

    // Get the latest XPlaneLog entry which has the raw_data with all sensor values
    const logs = await base44.asServiceRole.entities.XPlaneLog.filter(
      { company_id: cid },
      '-created_date',
      1
    );

    if (!logs || logs.length === 0) {
      return Response.json({ error: 'No simulator data received yet' }, { status: 404 });
    }

    const log = logs[0];
    const raw = log.raw_data || {};

    // Also check for an active in_flight entry for richer data
    const flights = await base44.asServiceRole.entities.Flight.filter(
      { company_id: cid, status: 'in_flight' },
      '-created_date',
      1
    );
    const flight = flights[0] || null;
    const xd = flight?.xplane_data || {};

    // Merge: prefer live raw_data, fall back to xplane_data on active flight
    const result = {
      aircraft_icao: raw.aircraft_icao || xd.aircraft_icao || null,
      total_weight_kg: raw.total_weight_kg || xd.total_weight_kg || null,
      oat_c: raw.oat_c ?? xd.oat_c ?? null,
      ground_elevation_ft: raw.ground_elevation_ft ?? xd.ground_elevation_ft ?? null,
      baro_setting: raw.baro_setting || xd.baro_setting || null,
      wind_speed_kts: raw.wind_speed_kts ?? xd.wind_speed_kts ?? null,
      wind_dir: raw.wind_direction ?? raw.wind_dir ?? xd.wind_direction ?? null,
      altitude: raw.altitude || xd.altitude || null,
      latitude: raw.latitude || xd.latitude || null,
      longitude: raw.longitude || xd.longitude || null,
      on_ground: raw.on_ground ?? xd.on_ground ?? true,
      fuel_kg: raw.fuel_kg || xd.fuel_kg || null,
      simulator: raw.simulator || xd.simulator || 'xplane',
      timestamp: log.created_date,
    };

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});