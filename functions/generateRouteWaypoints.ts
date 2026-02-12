import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { departure_icao, arrival_icao, aircraft_type, distance_nm } = await req.json();
    if (!departure_icao || !arrival_icao) {
      return Response.json({ error: 'Missing departure_icao or arrival_icao' }, { status: 400 });
    }

    const dist = distance_nm || 300;
    const acType = (aircraft_type || 'narrow_body').toLowerCase();

    let maxFL;
    if (acType === 'small_prop') maxFL = 140;
    else if (acType === 'turboprop') maxFL = 250;
    else maxFL = 410;

    let flRangeMin, flRangeMax;
    if (dist < 80) { flRangeMin = 80; flRangeMax = 140; }
    else if (dist < 150) { flRangeMin = 150; flRangeMax = 220; }
    else if (dist < 300) { flRangeMin = 230; flRangeMax = 340; }
    else { flRangeMin = 350; flRangeMax = 390; }

    flRangeMin = Math.min(flRangeMin, maxFL);
    flRangeMax = Math.min(flRangeMax, maxFL);
    const cruiseFL = Math.round((flRangeMin + flRangeMax) / 2 / 10) * 10;
    const cruiseAlt = cruiseFL * 100;

    let wpCount;
    if (dist < 60) wpCount = 3;
    else if (dist < 120) wpCount = 4;
    else if (dist < 250) wpCount = 5;
    else if (dist < 600) wpCount = 7;
    else wpCount = 10;

    // Step 1: Get waypoint names and route string
    const routeResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a realistic IFR route from ${departure_icao} to ${arrival_icao}. Distance: ${dist}NM. Aircraft: ${acType}. Cruise altitude: FL${cruiseFL}.

Return ${wpCount} waypoints using real published navigation fixes from AIRAC data. Use real SIDs from ${departure_icao}, real airways, and real STARs into ${arrival_icao}. Distribute waypoints evenly along the route.

Altitude: SID 3000-15000ft, enroute ${cruiseAlt}ft, STAR descending to 4000ft.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          waypoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                alt: { type: "number" },
                type: { type: "string", enum: ["sid", "enroute", "star"] }
              },
              required: ["name", "alt", "type"]
            }
          },
          route_string: { type: "string" },
          sid_name: { type: "string" },
          star_name: { type: "string" },
          cruise_altitude: { type: "number" },
          departure_runway: { type: "string" },
          arrival_runway: { type: "string" }
        },
        required: ["waypoints", "route_string", "cruise_altitude"]
      }
    });

    if (!routeResult || !routeResult.waypoints || routeResult.waypoints.length === 0) {
      return Response.json({ error: 'Failed to generate route' }, { status: 500 });
    }

    // Step 2: Look up exact coordinates for each waypoint
    const wpNames = routeResult.waypoints.map(wp => wp.name).join(', ');
    const coordResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Look up the EXACT published coordinates for these aviation navigation fixes/waypoints: ${wpNames}

These are ICAO navigation fixes used in IFR flight routes in the area between ${departure_icao} and ${arrival_icao}. 

For each fix, provide the precise latitude and longitude as published in aviation databases. The coordinates must be accurate to at least 4 decimal places. Do NOT round to whole numbers. For example, a fix might be at 50.0333, 8.5667 - NOT at 50.0, 9.0.

Search online aviation databases like OpenNav, SkyVector, or similar sources for the exact coordinates.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          fixes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                lat: { type: "number" },
                lon: { type: "number" }
              },
              required: ["name", "lat", "lon"]
            }
          }
        },
        required: ["fixes"]
      }
    });

    // Merge coordinates into waypoints
    const coordMap = {};
    if (coordResult?.fixes) {
      for (const fix of coordResult.fixes) {
        if (fix.name && fix.lat && fix.lon) {
          coordMap[fix.name.toUpperCase()] = { lat: fix.lat, lon: fix.lon };
        }
      }
    }

    const waypoints = routeResult.waypoints.map(wp => {
      const coords = coordMap[wp.name.toUpperCase()];
      return {
        name: wp.name,
        lat: coords?.lat || 0,
        lon: coords?.lon || 0,
        alt: wp.alt,
        type: wp.type
      };
    }).filter(wp => wp.lat !== 0 && wp.lon !== 0);

    // Remove duplicates and airport names
    const seen = new Set();
    const filteredWaypoints = waypoints.filter(wp => {
      if (wp.name === departure_icao || wp.name === arrival_icao) return false;
      if (wp.name.startsWith(departure_icao) || wp.name.startsWith(arrival_icao)) return false;
      const key = wp.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return Response.json({
      waypoints: filteredWaypoints,
      route_string: routeResult.route_string,
      sid_name: routeResult.sid_name,
      star_name: routeResult.star_name,
      cruise_altitude: routeResult.cruise_altitude,
      departure_runway: routeResult.departure_runway,
      arrival_runway: routeResult.arrival_runway
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});