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
      prompt: `You are an IFR flight planning system with access to real-world aeronautical databases.
Generate a REALISTIC IFR route from ${departure_icao} to ${arrival_icao}.

DISTANCE: ${dist} NM | CRUISE: FL${cruiseFL} | AIRCRAFT: ${acType}
ROUTE TYPE: ${routeType}

ABSOLUTE RULES FOR WAYPOINTS:
1. ONLY use waypoints that ACTUALLY EXIST in the real AIRAC navigational database.
2. Use real published 5-letter ICAO intersection names (e.g. AMKOS, BADGO, LINDO, OLSEN, TENPA).
3. Use real 3-letter VOR/DME identifiers (e.g. FFM, KPT, MUN, DKB).
4. Use real published airway identifiers (e.g. L607, UL607, T180, Y163, UN872, Q63).
5. DO NOT INVENT waypoint names. Every single waypoint MUST be a real navigational fix.
6. The route must follow real published airways where possible.
7. Use SID/STAR names that are actually published for those airports.
8. Coordinates MUST be accurate for the named fix (within 0.01 degrees).
9. Return ${wpMin} to ${wpMax} waypoints.
10. ${altitudeProfile}

CRITICAL ALTITUDE RULES - Each waypoint MUST have a REALISTIC altitude:
- SID waypoints: Climbing! First SID fix ~3000-5000ft, subsequent SID fixes increasing to ~8000-15000ft.
- Enroute waypoints: At or near cruise altitude FL${cruiseFL} (=${cruiseAlt}ft). ALL enroute waypoints should be at ${cruiseAlt}ft.
- STAR waypoints: Descending! First STAR fix ~FL180-FL250, then stepping down: FL150, FL120, FL080, ~4000-6000ft for the last fix.
- The altitudes MUST form a realistic climb-cruise-descent profile. They should NOT all be the same value.
- Example for a FL350 cruise: SID fixes at 5000, 12000. Enroute at 35000, 35000, 35000. STAR at 24000, 15000, 8000, 5000.

RUNWAY SELECTION:
- For ${departure_icao}: pick the most commonly used runway. Return just the designator (e.g. "08L", "26R", "09").
- For ${arrival_icao}: same.

Route string format example: "TOBAK Y163 AMKOS T180 LINDO"`,
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