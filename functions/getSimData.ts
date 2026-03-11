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
    // Covers X-Plane 12, MSFS 2020, MSFS 2024 field name variations

    // Temperature: X-Plane uses oat_c, MSFS uses ambient_temperature, outside_temperature, temperature
    const oat_c = pick(
      raw.oat_c, raw.oat, raw.outside_air_temp_c, raw.temperature_c,
      raw.ambient_temperature, raw.outside_temperature, raw.temperature,
      raw.sim_weather_temperature_sealevel_c, raw.ambient_temp_c,
      xd.oat_c
    );

    // Weight: X-Plane uses total_weight_kg, MSFS uses total_weight_pounds (convert), gross_weight
    let total_weight_kg = pick(raw.total_weight_kg, raw.gross_weight_kg, raw.weight_kg, xd.total_weight_kg);
    if (!total_weight_kg) {
      // MSFS often sends weight in pounds
      const lbs = pick(raw.total_weight_lbs, raw.gross_weight_lbs, raw.weight_lbs, raw.total_weight_pounds, raw.gross_weight_pounds);
      if (lbs) total_weight_kg = lbs * 0.453592;
    }

    // Wind speed: X-Plane uses wind_speed_kts, MSFS uses ambient_wind_velocity_x/z or wind_velocity
    let wind_speed_kts = pick(raw.wind_speed_kts, raw.wind_speed, raw.windspeed_kts, raw.ambient_wind_speed, raw.wind_velocity, xd.wind_speed_kts);
    if (!wind_speed_kts && raw.ambient_wind_x !== undefined && raw.ambient_wind_z !== undefined) {
      // MSFS: wind components in m/s -> knots
      wind_speed_kts = Math.sqrt(raw.ambient_wind_x ** 2 + raw.ambient_wind_z ** 2) * 1.94384;
    }

    // Wind direction
    const wind_dir = pick(raw.wind_direction, raw.wind_dir, raw.wind_heading, raw.ambient_wind_direction, raw.wind_deg, xd.wind_direction, xd.wind_dir);

    // QNH/Baro: X-Plane uses baro_setting (hPa), MSFS uses kohlsman_setting_hg (inHg) -> convert
    let baro_setting = pick(raw.baro_setting, raw.qnh, raw.altimeter_setting, raw.baro, raw.baro_hpa, xd.baro_setting);
    if (!baro_setting) {
      const inHg = pick(raw.kohlsman_setting_hg, raw.altimeter_setting_hg, raw.baro_setting_inhg);
      if (inHg) baro_setting = inHg * 33.8639; // inHg to hPa
    }

    // Ground elevation
    const ground_elevation_ft = pick(raw.ground_elevation_ft, raw.elevation_ft, raw.airport_elevation_ft, raw.ground_altitude, raw.plane_alt_above_ground, xd.ground_elevation_ft);

    // Weather extras: turbulence, rain/precipitation, visibility
    const turbulence = pick(raw.turbulence, raw.turbulence_intensity, raw.sim_weather_turbulence, raw.turb_intensity);
    const rain_intensity = pick(raw.rain_intensity, raw.precipitation, raw.rain, raw.precip_rate, raw.sim_weather_precipitation_rate);
    const visibility_m = pick(raw.visibility_m, raw.visibility, raw.ambient_visibility, raw.sim_weather_visibility_m);

    // Simulator type detection
    const simulator = pick(raw.simulator, xd.simulator);
    let sim_type = simulator || 'unknown';
    if (!simulator) {
      // Auto-detect from field presence
      if (raw.kohlsman_setting_hg !== undefined || raw.ambient_temperature !== undefined) sim_type = 'msfs';
      else if (raw.oat_c !== undefined || raw.baro_setting !== undefined) sim_type = 'xplane';
    }

    // For active flights, xplane_data already has normalized performance fields
    // that receiveXPlaneData persists. These are more reliable than raw XPlaneLog data.
    const final_weight = total_weight_kg || pick(xd.total_weight_kg) || null;
    const final_oat = oat_c ?? pick(xd.oat_c) ?? null;
    const final_baro = baro_setting || pick(xd.baro_setting) || null;
    const final_wind_speed = wind_speed_kts ?? pick(xd.wind_speed_kts) ?? null;
    const final_wind_dir = wind_dir ?? pick(xd.wind_direction, xd.wind_dir) ?? null;
    const final_elev = ground_elevation_ft || pick(xd.ground_elevation_ft) || null;

    const result = {
      aircraft_icao: pick(raw.aircraft_icao, xd.aircraft_icao),
      total_weight_kg: final_weight,
      oat_c: final_oat,
      ground_elevation_ft: final_elev,
      baro_setting: final_baro,
      wind_speed_kts: final_wind_speed,
      wind_dir: final_wind_dir,
      turbulence,
      rain_intensity,
      visibility_m,
      altitude: pick(raw.altitude, xd.altitude),
      latitude: pick(raw.latitude, xd.latitude),
      longitude: pick(raw.longitude, xd.longitude),
      on_ground: raw.on_ground ?? xd.on_ground ?? true,
      fuel_kg: pick(raw.fuel_kg, xd.fuel_kg),
      simulator: sim_type,
      timestamp: log.created_date,
      has_active_flight: !!flight,
      // Include the full raw_data so frontend can inspect if needed
      _raw_fields: Object.keys(raw),
    };

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});