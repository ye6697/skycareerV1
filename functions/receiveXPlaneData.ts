import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ----------------------------
// Cache
// ----------------------------
const companyCache = new Map(); // api_key → Company
const flightCache = new Map();  // company.id → Flight

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const apiKey = url.searchParams.get('api_key');

    if (!apiKey) return Response.json({ error: 'API key required' }, { status: 401 });

    // --------- Company Fetch + Cache ---------
    let company = companyCache.get(apiKey);
    if (!company) {
      const companies = await base44.asServiceRole.entities.Company.filter({ xplane_api_key: apiKey });
      if (companies.length === 0) return Response.json({ error: 'Invalid API key' }, { status: 401 });
      company = companies[0];
      companyCache.set(apiKey, company);
    }

    const data = await req.json();

    if (data.fast_position) {
      return Response.json({ status: 'fast_skipped', xplane_connection_status: 'connected' });
    }

    // --------- Flight Fetch + Cache ---------
    let flight = flightCache.get(company.id);
    if (!flight) {
      const flights = await base44.asServiceRole.entities.Flight.filter({ company_id: company.id, status: 'in_flight' });
      flight = flights[0] || null;
      flightCache.set(company.id, flight);
    }

    const {
      altitude, speed, vertical_speed, heading,
      fuel_percentage, fuel_kg, g_force, max_g_force,
      latitude, longitude, on_ground, touchdown_vspeed,
      landing_g_force, tailstrike, stall, is_in_stall,
      stall_warning, override_alpha, overstress, flaps_overspeed,
      fuel_emergency, gear_up_landing, crash, has_crashed,
      overspeed, gear_down, flap_ratio = 0, pitch = 0, ias = 0,
      flight_score, landing_quality,
      departure_lat, departure_lon, arrival_lat, arrival_lon
    } = data;

    const park_brake = data.parking_brake ?? data.park_brake ?? false;
    const engine1_running = data.engine1_running ?? false;
    const engine2_running = data.engine2_running ?? false;
    const engines_running = data.engines_running || engine1_running || engine2_running;
    const isCrash = crash || has_crashed || false;

    if (altitude === undefined || speed === undefined) {
      return Response.json({ error: 'Invalid data - no altitude or speed received', xplane_connection_status: 'disconnected' }, { status: 400 });
    }

    if (company?.xplane_connection_status !== 'connected') {
      base44.asServiceRole.entities.Company.update(company.id, { xplane_connection_status: 'connected' }).catch(() => {});
    }

    if (!flight) {
      base44.asServiceRole.entities.XPlaneLog.create({
        company_id: company.id,
        raw_data: data,
        altitude,
        speed,
        on_ground,
        flight_score,
        has_active_flight: false
      }).catch(() => {});

      if (Math.random() < 0.03) {
        base44.asServiceRole.entities.XPlaneLog.filter({ company_id: company.id }, '-created_date', 60)
          .then(oldLogs => oldLogs.slice(30).forEach(l => base44.asServiceRole.entities.XPlaneLog.delete(l.id).catch(() => {})))
          .catch(() => {});
      }

      return Response.json({ message: 'X-Plane connected - no active flight', xplane_connection_status: 'connected', data_logged: true }, { status: 200 });
    }

    const wasAirborne = flight.xplane_data?.was_airborne ?? false;
    const isNowAirborne = !on_ground && altitude > 50;
    const hasBeenAirborne = wasAirborne || isNowAirborne;
    const initial_fuel_kg = flight.xplane_data?.initial_fuel_kg ?? fuel_kg ?? 0;

    const existingPath = flight.xplane_data?.flight_path || [];
    let newPath = existingPath;
    if (latitude && longitude && !on_ground) {
      const lastPt = existingPath[existingPath.length - 1];
      if (!lastPt || Math.abs(lastPt[0] - latitude) > 0.005 || Math.abs(lastPt[1] - longitude) > 0.005) {
        newPath = [...existingPath, [latitude, longitude]];
        if (newPath.length > 500) newPath = newPath.filter((_, i) => i % 2 === 0 || i === newPath.length - 1);
      }
    }

    const xplaneData = {
      altitude, speed, vertical_speed, heading, fuel_percentage,
      fuel_kg: fuel_kg ?? 0, initial_fuel_kg, g_force, max_g_force,
      latitude, longitude, on_ground, park_brake,
      engine1_running, engine2_running, engines_running,
      touchdown_vspeed, landing_g_force, landing_quality,
      gear_down: gear_down ?? true, flap_ratio, pitch, ias,
      tailstrike, stall: stall || is_in_stall || stall_warning || override_alpha,
      is_in_stall, stall_warning, override_alpha, overstress,
      overspeed: overspeed ?? false, flaps_overspeed: flaps_overspeed ?? false,
      fuel_emergency, gear_up_landing, crash: isCrash, has_crashed: isCrash,
      was_airborne: hasBeenAirborne,
      departure_lat: departure_lat ?? flight.xplane_data?.departure_lat ?? 0,
      departure_lon: departure_lon ?? flight.xplane_data?.departure_lon ?? 0,
      arrival_lat: arrival_lat ?? flight.xplane_data?.arrival_lat ?? 0,
      arrival_lon: arrival_lon ?? flight.xplane_data?.arrival_lon ?? 0,
      flight_path: newPath,
      timestamp: new Date().toISOString()
    };

    const updateData = { xplane_data: xplaneData };
    if (max_g_force > (flight.max_g_force ?? 0)) updateData.max_g_force = max_g_force;
    base44.asServiceRole.entities.Flight.update(flight.id, updateData).catch(() => {});

    const maintenanceRatio = company?.current_maintenance_ratio ?? 0;
    const flightStatus = on_ground && park_brake && !engines_running && hasBeenAirborne ? 'ready_to_complete' : 'updated';

    return Response.json({
      status: flightStatus,
      on_ground,
      park_brake,
      engines_running,
      maintenance_ratio: maintenanceRatio,
      xplane_connection_status: 'connected'
    });

  } catch (error) {
    console.error('Error receiving X-Plane data:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});