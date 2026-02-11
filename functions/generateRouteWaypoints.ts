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
      routeType = "VERY SHORT hop. Only 2-3 waypoints: one SID exit fix and one STAR entry fix. Aircraft may never reach cruise FL.";
    } else if (dist < 120) {
      wpMin = 3; wpMax = 4;
      routeType = "SHORT route. 3-4 waypoints max: 1 SID fix, maybe 1 enroute fix, 1-2 STAR fixes.";
    } else if (dist < 250) {
      wpMin = 4; wpMax = 6;
      routeType = "MEDIUM route. 4-6 waypoints: 1-2 SID, 1-2 enroute, 1-2 STAR.";
    } else if (dist < 600) {
      wpMin = 5; wpMax = 8;
      routeType = "MEDIUM-LONG route. 5-8 waypoints: SID, multiple enroute fixes, STAR.";
    } else {
      wpMin = 7; wpMax = 14;
      routeType = "LONG route. 7-14 waypoints: full SID, many enroute, full STAR.";
    }

    let altitudeProfile;
    if (dist < 60) {
      altitudeProfile = `Very short flight. SID fix: ~${Math.min(5000, cruiseAlt)}ft (climbing). May only reach ${Math.min(cruiseAlt, 10000)}ft before descending. STAR fix: ~5000-8000ft.`;
    } else if (dist < 120) {
      altitudeProfile = `Short flight. First SID fix: 5000-8000ft. Brief cruise at FL${cruiseFL}. STAR fix: 8000-12000ft.`;
    } else {
      altitudeProfile = `Climb-cruise-descent: SID fixes climbing 5000→FL150. Enroute at FL${cruiseFL}. STAR descending FL180→5000ft. Always logical.`;
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a REALISTIC IFR flight route between ${departure_icao} and ${arrival_icao}.

DISTANCE: ${dist} NM | CRUISE: FL${cruiseFL} | AIRCRAFT: ${acType}

ROUTE TYPE: ${routeType}

CRITICAL RULES:
1. EXACTLY ${wpMin} to ${wpMax} waypoints total. NOT MORE.
2. Use REAL 5-letter ICAO fixes (AMLUH, SUGOL etc.) and 3-letter VOR identifiers
3. Use REAL airway designators (Y163, UL608, T180 etc.)
4. Return ACCURATE real-world coordinates
5. ${altitudeProfile}
6. Altitudes MUST form logical climb-cruise-descent profile

RUNWAY SELECTION:
- For ${departure_icao}: pick the most likely active runway based on common wind patterns. Return the runway designator (e.g. "08L", "26R", "09").
- For ${arrival_icao}: same, pick the most likely active runway.

Route string format: "SID_NAME FIX AIRWAY FIX AIRWAY FIX STAR_NAME"`,
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
                alt: { type: "number", description: "Altitude in feet" },
                type: { type: "string", enum: ["sid", "enroute", "star"] }
              },
              required: ["name", "lat", "lon", "alt", "type"]
            }
          },
          route_string: { type: "string" },
          sid_name: { type: "string" },
          star_name: { type: "string" },
          cruise_altitude: { type: "number" },
          estimated_distance_nm: { type: "number" },
          departure_runway: { type: "string", description: "Likely active departure runway e.g. 08L" },
          arrival_runway: { type: "string", description: "Likely active arrival runway e.g. 26R" }
        },
        required: ["waypoints", "route_string", "cruise_altitude"]
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});