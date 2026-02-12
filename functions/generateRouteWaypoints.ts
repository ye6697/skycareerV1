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
      prompt: `You are an IFR flight planning system. Generate a REALISTIC IFR route from ${departure_icao} to ${arrival_icao}.

DISTANCE: ${dist} NM | CRUISE: FL${cruiseFL} | AIRCRAFT: ${acType}
ROUTE TYPE: ${routeType}

CRITICAL COORDINATE RULES:
- Each waypoint MUST have ACCURATE real-world coordinates. Look up the ACTUAL lat/lon for each fix.
- The waypoints must be GEOGRAPHICALLY SPREAD between ${departure_icao} and ${arrival_icao}, NOT clustered in one area.
- The route must make geographic sense: waypoints should progress from departure to arrival.
- For example, EDDF (50.03°N/8.57°E) to EDDV (52.46°N/9.69°E) - waypoints should span from ~50°N to ~52.5°N, NOT all be at 50°N.
- VERIFY each coordinate is correct for the named fix. Do NOT just increment by 0.01 degrees.

WAYPOINT RULES:
1. Use REAL published 5-letter ICAO fixes (e.g. KERAX, SPESA, RUDNO) and VOR/DME (e.g. FFM, WRB, DLE).
2. Use real airways (e.g. L607, T180, Y163, UN872).
3. Return ${wpMin} to ${wpMax} waypoints.
4. ${altitudeProfile}

ALTITUDE RULES:
- SID waypoints: Climbing. First ~3000-5000ft, then ~8000-15000ft.
- Enroute waypoints: At cruise FL${cruiseFL} (=${cruiseAlt}ft).
- STAR waypoints: Descending. Step down from cruise: FL180, FL120, FL080, then ~4000-5000ft.
- Altitudes MUST form a realistic climb-cruise-descent profile.

RUNWAY SELECTION:
- Pick the most commonly used runway for each airport (e.g. "07C", "27L", "25R").

ROUTE STRING FORMAT:
- Must include departure airport/runway AND arrival airport/runway.
- Format: "${departure_icao}/RWY SID WAYPOINT AIRWAY WAYPOINT ... STAR ${arrival_icao}/RWY"
- Example: "EDDF/07C TOBAK Y163 AMKOS T180 LINDO EDDV/27L"`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          waypoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "MUST be a real ICAO fix name" },
                lat: { type: "number", description: "Accurate latitude of the fix" },
                lon: { type: "number", description: "Accurate longitude of the fix" },
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

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});