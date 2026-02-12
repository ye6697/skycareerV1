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

    let wpMin, wpMax;
    if (dist < 60) { wpMin = 2; wpMax = 3; }
    else if (dist < 120) { wpMin = 3; wpMax = 4; }
    else if (dist < 250) { wpMin = 4; wpMax = 6; }
    else if (dist < 600) { wpMin = 5; wpMax = 8; }
    else { wpMin = 7; wpMax = 14; }

    let altitudeProfile;
    if (dist < 60) {
      altitudeProfile = `Very short flight. May only reach ${Math.min(cruiseAlt, 10000)}ft.`;
    } else if (dist < 120) {
      altitudeProfile = `Short flight. Brief cruise at FL${cruiseFL}.`;
    } else {
      altitudeProfile = `Climb-cruise-descent: SID fixes climbing to FL150+. Enroute at FL${cruiseFL}. STAR descending.`;
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert IFR flight planner. Generate a realistic IFR route from ${departure_icao} to ${arrival_icao}. Distance: ~${dist}NM. Aircraft: ${acType}. Cruise: FL${cruiseFL}.

ABSOLUTE REQUIREMENT - CORRECT COORDINATES:
Each waypoint MUST have its REAL, PUBLISHED coordinates from official aviation databases (AIRAC data).
DO NOT guess, estimate, or interpolate coordinates! 
DO NOT place waypoints at round numbers like 51.0, 52.0, 53.0 etc. - real fixes have precise coordinates like 50.8547, 9.2631.
Search the internet for "ICAO fix name coordinates" for each fix to verify.

For example, if you use the fix "ASKIK", search for its actual published coordinates and use those EXACT numbers.
If you cannot find the exact coordinates for a fix, DO NOT include that fix. Only use fixes whose coordinates you can verify.

ROUTE REQUIREMENTS:
1. Use ${wpMin}-${wpMax} REAL published waypoints (5-letter ICAO fixes or VOR/NDB identifiers).
2. Use real published airways connecting the fixes.
3. Include a real SID from ${departure_icao} and a real STAR into ${arrival_icao}.
4. Waypoints must be geographically distributed along the route, NOT clustered.
5. ${altitudeProfile}

ALTITUDE PROFILE:
- SID waypoints: climbing (3000-15000ft)
- Enroute waypoints: cruise at ${cruiseAlt}ft
- STAR waypoints: descending (FL150, FL080, 4000ft)

ROUTE STRING format: "${departure_icao}/RWY xx waypoints-and-airways ${arrival_icao}/RWY xx"`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          waypoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Real ICAO fix name" },
                lat: { type: "number", description: "EXACT published latitude - must be precise, not rounded" },
                lon: { type: "number", description: "EXACT published longitude - must be precise, not rounded" },
                alt: { type: "number", description: "Altitude in feet" },
                type: { type: "string", enum: ["sid", "enroute", "star"] }
              },
              required: ["name", "lat", "lon", "alt", "type"]
            }
          },
          route_string: { type: "string", description: "Full route string with airways" },
          sid_name: { type: "string", description: "Published SID name" },
          star_name: { type: "string", description: "Published STAR name" },
          cruise_altitude: { type: "number" },
          departure_runway: { type: "string" },
          arrival_runway: { type: "string" }
        },
        required: ["waypoints", "route_string", "cruise_altitude"]
      }
    });

    // Post-process: remove duplicate waypoints and airport names appearing as waypoints
    if (result && result.waypoints && Array.isArray(result.waypoints)) {
      const seen = new Set();
      result.waypoints = result.waypoints.filter(wp => {
        if (!wp.name || !wp.lat || !wp.lon) return false;
        if (wp.name === departure_icao || wp.name === arrival_icao) return false;
        if (wp.name.startsWith(departure_icao) || wp.name.startsWith(arrival_icao)) return false;
        const key = wp.name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});