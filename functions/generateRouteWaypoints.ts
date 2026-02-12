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

    let wpMin, wpMax, routeType;
    if (dist < 60) {
      wpMin = 2; wpMax = 3;
      routeType = "VERY SHORT hop. Only 2-3 waypoints.";
    } else if (dist < 120) {
      wpMin = 3; wpMax = 4;
      routeType = "SHORT route. 3-4 waypoints.";
    } else if (dist < 250) {
      wpMin = 4; wpMax = 6;
      routeType = "MEDIUM route. 4-6 waypoints.";
    } else if (dist < 600) {
      wpMin = 5; wpMax = 8;
      routeType = "MEDIUM-LONG route. 5-8 waypoints.";
    } else {
      wpMin = 7; wpMax = 14;
      routeType = "LONG route. 7-14 waypoints.";
    }

    let altitudeProfile;
    if (dist < 60) {
      altitudeProfile = `Very short flight. May only reach ${Math.min(cruiseAlt, 10000)}ft.`;
    } else if (dist < 120) {
      altitudeProfile = `Short flight. Brief cruise at FL${cruiseFL}.`;
    } else {
      altitudeProfile = `Climb-cruise-descent: SID fixes climbing to FL150+. Enroute at FL${cruiseFL}. STAR descending.`;
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an IFR flight planning expert with access to current AIRAC navigation data. Generate a realistic IFR flight route from ${departure_icao} to ${arrival_icao}. Distance: ${dist}NM. Aircraft: ${acType}. Cruise: FL${cruiseFL}.

CRITICAL - USE REAL AIRAC DATA:
- You MUST use REAL published navigation fixes from the current AIRAC cycle.
- Every waypoint MUST have its REAL, CORRECT coordinates from the AIRAC database - NOT estimated or interpolated positions!
- Use real SIDs from ${departure_icao} and real STARs into ${arrival_icao}.
- Use real published airways (e.g. L607, UL607, T180, UN872, Y163 etc.) connecting the fixes.
- VERIFY each fix's coordinates are correct. For example: ASKIK is at N50°02.0'/E008°34.0', not somewhere else.
- If you're unsure about a fix's exact coordinates, look them up. Wrong coordinates will cause the route to display incorrectly on the map.

GEOGRAPHIC DISTRIBUTION:
- The waypoints MUST be evenly spread along the ENTIRE route from departure to arrival.
- The FIRST SID waypoint should be close to ${departure_icao} (within 10-30nm).
- The LAST STAR waypoint should be close to ${arrival_icao} (within 10-30nm).
- Enroute waypoints should fill the middle portion evenly.
- NEVER cluster all waypoints near one end!

RULES:
1. Return ${wpMin}-${wpMax} waypoints. Each MUST be UNIQUE.
2. Use ONLY real published 5-letter ICAO fixes or VOR identifiers with their EXACT real-world coordinates.
3. Use real airways connecting the fixes.
4. ${altitudeProfile}

ALTITUDE PROFILE (each waypoint needs altitude in feet):
- SID waypoints: climbing (3000-15000ft)
- Enroute waypoints: cruise at ${cruiseAlt}ft
- STAR waypoints: descending (FL150, FL080, 4000-5000ft)

ROUTE STRING format: "${departure_icao}/RWY waypoints-and-airways ${arrival_icao}/RWY"
Pick commonly used runways for both airports.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          waypoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Real ICAO fix name from AIRAC data" },
                lat: { type: "number", description: "EXACT latitude from AIRAC database" },
                lon: { type: "number", description: "EXACT longitude from AIRAC database" },
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