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

    // Helper: pick first defined non-null value
    const pick = (...vals) => {
      for (const v of vals) {
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return null;
    };

    // Merge: prefer live raw_data, fall back to xplane_data on active flight
    // Note: plugin may use different field names depending on version
    const result = {
      aircraft_icao: pick(raw.aircraft_icao, xd.aircraft_icao),
      total_weight_kg: pick(raw.total_weight_kg, raw.gross_weight_kg, raw.weight_kg, xd.total_weight_kg),
      oat_c: pick(raw.oat_c, raw.oat, raw.outside_air_temp_c, raw.temperature_c, xd.oat_c),
      ground_elevation_ft: pick(raw.ground_elevation_ft, raw.elevation_ft, raw.airport_elevation_ft, xd.ground_elevation_ft),
      baro_setting: pick(raw.baro_setting, raw.qnh, raw.altimeter_setting, raw.baro, xd.baro_setting),
      wind_speed_kts: pick(raw.wind_speed_kts, raw.wind_speed, raw.windspeed_kts, xd.wind_speed_kts),
      wind_dir: pick(raw.wind_direction, raw.wind_dir, raw.wind_heading, xd.wind_direction, xd.wind_dir),
      altitude: pick(raw.altitude, xd.altitude),
      latitude: pick(raw.latitude, xd.latitude),
      longitude: pick(raw.longitude, xd.longitude),
      on_ground: raw.on_ground ?? xd.on_ground ?? true,
      fuel_kg: pick(raw.fuel_kg, xd.fuel_kg),
      simulator: pick(raw.simulator, xd.simulator, 'xplane'),
      timestamp: log.created_date,
      // Include the full raw_data so frontend can inspect if needed
      _raw_fields: Object.keys(raw),
    };

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});