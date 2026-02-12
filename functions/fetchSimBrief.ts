import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { simbrief_username, simbrief_userid } = await req.json();

    if (!simbrief_username && !simbrief_userid) {
      return Response.json({ error: 'simbrief_username oder simbrief_userid erforderlich' }, { status: 400 });
    }

    // Build SimBrief API URL
    let url = 'https://www.simbrief.com/api/xml.fetcher.php?json=1';
    if (simbrief_userid) {
      url += `&userid=${encodeURIComponent(simbrief_userid)}`;
    } else {
      url += `&username=${encodeURIComponent(simbrief_username)}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      return Response.json({ error: 'SimBrief API Fehler', status: response.status }, { status: 400 });
    }

    const data = await response.json();

    if (data.fetch?.status === 'Error') {
      return Response.json({ error: data.fetch.result || 'SimBrief Fehler' }, { status: 400 });
    }

    // Extract relevant flight plan data
    const origin = data.origin || {};
    const destination = data.destination || {};
    const general = data.general || {};
    const navlog = data.navlog?.fix || [];
    const atc = data.atc || {};

    // Build waypoints from navlog
    const waypoints = [];
    for (const fix of navlog) {
      if (!fix.pos_lat || !fix.pos_long) continue;
      const lat = parseFloat(fix.pos_lat);
      const lon = parseFloat(fix.pos_long);
      if (isNaN(lat) || isNaN(lon)) continue;

      let wpType = 'enroute';
      if (fix.stage === 'CLB' || fix.is_sid_star === '1') wpType = 'sid';
      if (fix.stage === 'DSC' || fix.is_sid_star === '1') {
        // Check if it's closer to arrival than departure
        const arrLat = parseFloat(destination.pos_lat);
        const arrLon = parseFloat(destination.pos_long);
        const depLat = parseFloat(origin.pos_lat);
        const depLon = parseFloat(origin.pos_long);
        if (!isNaN(arrLat) && !isNaN(depLat)) {
          const dArr = Math.abs(lat - arrLat) + Math.abs(lon - arrLon);
          const dDep = Math.abs(lat - depLat) + Math.abs(lon - depLon);
          if (dArr < dDep) wpType = 'star';
        }
      }

      waypoints.push({
        name: fix.ident || fix.name || `WPT${waypoints.length + 1}`,
        lat,
        lon,
        alt: parseInt(fix.altitude_feet || '0', 10),
        type: wpType,
        airway: fix.via_airway || null
      });
    }

    // Extract route string
    const routeString = atc?.route || general?.route || '';

    // Departure/arrival coords
    const depLat = parseFloat(origin.pos_lat);
    const depLon = parseFloat(origin.pos_long);
    const arrLat = parseFloat(destination.pos_lat);
    const arrLon = parseFloat(destination.pos_long);

    const result = {
      source: 'simbrief',
      route_string: routeString,
      waypoints,
      departure_airport: origin.icao_code || '',
      arrival_airport: destination.icao_code || '',
      departure_runway: origin.plan_rwy || null,
      arrival_runway: destination.plan_rwy || null,
      departure_rwy_length_m: origin.plan_rwy_length ? Math.round(parseInt(origin.plan_rwy_length, 10) * 0.3048) : null,
      arrival_rwy_length_m: destination.plan_rwy_length ? Math.round(parseInt(destination.plan_rwy_length, 10) * 0.3048) : null,
      departure_coords: (!isNaN(depLat) && !isNaN(depLon)) ? { lat: depLat, lon: depLon } : null,
      arrival_coords: (!isNaN(arrLat) && !isNaN(arrLon)) ? { lat: arrLat, lon: arrLon } : null,
      cruise_altitude: parseInt(general.initial_altitude || '0', 10),
      aircraft_icao: general.icao_airline || '',
      flight_number: general.flight_number || '',
      estimated_time_enroute: general.time_enroute || '',
      fuel_plan: {
        trip_fuel_kg: parseInt(general.fuel_plan_ramp || '0', 10),
        reserve_fuel_kg: parseInt(general.reserve_fuel || '0', 10)
      },
      distance_nm: parseInt(general.route_distance || '0', 10),
      raw_general: {
        icao_airline: general.icao_airline,
        flight_number: general.flight_number,
        cruise_tas: general.cruise_tas,
        avg_wind_comp: general.avg_wind_comp,
        costindex: general.costindex
      }
    };

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});