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

    // Single call: ask for route with coordinates, and explicitly tell LLM to search for each fix
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a realistic IFR flight route from ${departure_icao} to ${arrival_icao}. Distance: ~${dist}NM. Aircraft: ${acType}. Cruise: FL${cruiseFL}.

TASK: Create an IFR route with ${wpCount} waypoints. For each waypoint, search for its real coordinates on aviation databases.

SEARCH INSTRUCTIONS: For each waypoint you choose, search for it on opennav.com. For example:
- Search "site:opennav.com ASKIK" to find the fix ASKIK and its coordinates
- Search "site:opennav.com TOBAK" for the fix TOBAK
- Do this for EVERY fix in your route

The coordinates MUST come from actual search results, not from your memory. Real aviation fixes have precise coordinates like 50.0333, 8.5667 - NOT round numbers like 50.0, 9.0 or incrementing patterns like 50.1, 50.2, 50.3.

GEOGRAPHIC REQUIREMENT: ${departure_icao} to ${arrival_icao} means waypoints must geographically transition from the departure area to the arrival area. If departure is in southern Germany and arrival is in northern Germany, waypoint latitudes must increase from south to north.

ROUTE RULES:
- Use real SIDs, airways (L607, T180, Y163, UN872, etc.), and STARs
- Altitudes: SID 3000-15000ft, enroute ${cruiseAlt}ft, STAR descending to 4000ft
- Route string format: "${departure_icao}/RWY waypoints ${arrival_icao}/RWY"`,
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
                lat: { type: "number" },
                lon: { type: "number" },
                alt: { type: "number" },
                type: { type: "string", enum: ["sid", "enroute", "star"] }
              },
              required: ["name", "lat", "lon", "alt", "type"]
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

    // Post-process
    if (result && result.waypoints && Array.isArray(result.waypoints)) {
      const seen = new Set();
      result.waypoints = result.waypoints.filter(wp => {
        if (!wp.name || !wp.lat || !wp.lon) return false;
        if (wp.name === departure_icao || wp.name === arrival_icao) return false;
        if (wp.name.startsWith(departure_icao) || wp.name.startsWith(arrival_icao)) return false;
        const coordKey = `${wp.lat.toFixed(3)}_${wp.lon.toFixed(3)}`;
        const nameKey = wp.name;
        if (seen.has(nameKey) || seen.has(coordKey)) return false;
        seen.add(nameKey);
        seen.add(coordKey);
        return true;
      });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});