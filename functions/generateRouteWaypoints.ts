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

    // Aircraft ceiling
    let maxFL;
    if (acType === 'small_prop') maxFL = 140;
    else if (acType === 'turboprop') maxFL = 250;
    else maxFL = 410;

    // Distance-based FL
    let flRangeMin, flRangeMax;
    if (dist < 80) { flRangeMin = 80; flRangeMax = 140; }
    else if (dist < 150) { flRangeMin = 150; flRangeMax = 220; }
    else if (dist < 300) { flRangeMin = 230; flRangeMax = 340; }
    else { flRangeMin = 350; flRangeMax = 390; }

    flRangeMin = Math.min(flRangeMin, maxFL);
    flRangeMax = Math.min(flRangeMax, maxFL);
    const cruiseFL = Math.round((flRangeMin + flRangeMax) / 2 / 10) * 10;
    const cruiseAlt = cruiseFL * 100;

    // Waypoint count based on distance - REALISTIC and minimal
    let wpMin, wpMax, routeType;
    if (dist < 60) {
      wpMin = 2; wpMax = 3;
      routeType = "VERY SHORT hop. Only 2-3 waypoints: one SID exit fix and one STAR entry fix (possibly the same). Aircraft may never reach cruise FL - just climb and immediately descend. No enroute waypoints needed.";
    } else if (dist < 120) {
      wpMin = 3; wpMax = 4;
      routeType = "SHORT route. 3-4 waypoints max: 1 SID fix, maybe 1 enroute fix, 1-2 STAR fixes. Brief cruise segment.";
    } else if (dist < 250) {
      wpMin = 4; wpMax = 6;
      routeType = "MEDIUM route. 4-6 waypoints: 1-2 SID fixes, 1-2 enroute fixes on an airway, 1-2 STAR fixes. Normal climb-cruise-descent profile.";
    } else if (dist < 600) {
      wpMin = 5; wpMax = 8;
      routeType = "MEDIUM-LONG route. 5-8 waypoints: SID, multiple enroute fixes on airways, STAR.";
    } else {
      wpMin = 7; wpMax = 14;
      routeType = "LONG route. 7-14 waypoints: full SID, many enroute fixes/airways, full STAR.";
    }

    // Build altitude profile description
    let altitudeProfile;
    if (dist < 60) {
      altitudeProfile = `Very short flight. Altitude profile:
- SID fix: around ${Math.min(5000, cruiseAlt)} ft (still climbing)
- Top of climb may only reach ${cruiseAlt} ft briefly or not at all
- STAR fix: around 5000-8000 ft (already descending)
For very short routes the aircraft may only climb to ${Math.min(cruiseAlt, 10000)} ft before descending again. Set altitudes accordingly - NOT cruise FL for every waypoint.`;
    } else if (dist < 120) {
      altitudeProfile = `Short flight. Altitude profile:
- First SID fix: 5000-8000 ft (climbing)
- Brief cruise at FL${cruiseFL} for maybe 1 waypoint
- STAR fix: 8000-12000 ft (descending)`;
    } else {
      altitudeProfile = `Altitude profile should show a realistic climb-cruise-descent:
- SID fixes: climbing through 5000, 8000, FL100-FL150 (each fix HIGHER than the last)
- Enroute fixes: at cruise FL${cruiseFL} (${cruiseAlt} ft)
- STAR fixes: descending through FL180, FL120, FL100, down to 5000-8000 ft (each fix LOWER than the last)
The altitude MUST always be logical: always climbing during SID, level during cruise, always descending during STAR. Never jump up and down.`;
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a REALISTIC IFR flight route between ${departure_icao} and ${arrival_icao}.

DISTANCE: ${dist} NM
CRUISE: FL${cruiseFL} (max)
AIRCRAFT: ${acType}

ROUTE TYPE: ${routeType}

CRITICAL RULES:
1. Use EXACTLY ${wpMin} to ${wpMax} waypoints total. NOT MORE.
2. Use REAL published 5-letter ICAO fixes (AMLUH, SUGOL, KERAX etc.) and 3-letter VOR identifiers (MUN, FFM etc.)
3. Use REAL airway designators (Y163, UL608, UN871, T180 etc.)
4. Include a SID name and STAR name if they exist for these airports
5. Return ACCURATE real-world coordinates for each fix

${altitudeProfile}

IMPORTANT: The altitudes MUST form a logical profile:
- Waypoint 1 (SID): lowest altitude (climbing)
- Middle waypoints: cruise altitude
- Last waypoints (STAR): descending, each lower than the previous
NEVER set all waypoints to the same altitude. This is the most critical requirement.

Route string format: "SID_NAME FIX AIRWAY FIX AIRWAY FIX STAR_NAME" (standard pilot notation)`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          waypoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Waypoint identifier" },
                lat: { type: "number", description: "Latitude" },
                lon: { type: "number", description: "Longitude" },
                alt: { type: "number", description: "Altitude in feet - MUST follow climb-cruise-descent profile" },
                type: { type: "string", enum: ["sid", "enroute", "star"], description: "Waypoint type" }
              },
              required: ["name", "lat", "lon", "alt", "type"]
            }
          },
          route_string: { type: "string", description: "Compact route string with SID, airways, STAR" },
          sid_name: { type: "string", description: "SID name" },
          star_name: { type: "string", description: "STAR name" },
          cruise_altitude: { type: "number", description: "Cruise altitude in feet" },
          estimated_distance_nm: { type: "number", description: "Estimated distance in NM" }
        },
        required: ["waypoints", "route_string", "cruise_altitude"]
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});