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

    // Determine realistic cruise FL based on distance and aircraft type
    let flRangeMin, flRangeMax, maxFL;
    const dist = distance_nm || 300; // fallback estimate

    // Aircraft ceiling limits
    const acType = (aircraft_type || '').toLowerCase();
    if (acType === 'small_prop') {
      maxFL = 140;
    } else if (acType === 'turboprop') {
      maxFL = 250;
    } else if (acType === 'regional_jet') {
      maxFL = 410;
    } else {
      maxFL = 410; // narrow_body, wide_body, cargo
    }

    // Distance-based FL ranges
    if (dist < 80) {
      flRangeMin = 80; flRangeMax = 140;
    } else if (dist < 150) {
      flRangeMin = 150; flRangeMax = 220;
    } else if (dist < 300) {
      flRangeMin = 230; flRangeMax = 340;
    } else {
      flRangeMin = 350; flRangeMax = 390;
    }

    // Clamp to aircraft ceiling
    flRangeMin = Math.min(flRangeMin, maxFL);
    flRangeMax = Math.min(flRangeMax, maxFL);

    // Pick a realistic cruise FL (round to nearest 10)
    const cruiseFL = Math.round((flRangeMin + flRangeMax) / 2 / 10) * 10;
    const cruiseAlt = cruiseFL * 100;

    // Determine waypoint count guidance
    let waypointGuidance;
    if (dist < 80) {
      waypointGuidance = "2-4 waypoints (very short route, possibly just a SID exit fix and a STAR entry fix)";
    } else if (dist < 150) {
      waypointGuidance = "3-5 waypoints (short route: SID, 1-2 enroute fixes, STAR)";
    } else if (dist < 300) {
      waypointGuidance = "5-8 waypoints (medium route: SID, 3-5 enroute fixes on airways, STAR)";
    } else if (dist < 1000) {
      waypointGuidance = "6-12 waypoints (long route: SID, airways with multiple fixes, STAR)";
    } else {
      waypointGuidance = "10-18 waypoints (ultra-long route: SID, multiple airways, possibly oceanic tracks, STAR)";
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a REALISTIC IFR flight route between ${departure_icao} and ${arrival_icao} for X-Plane 12 flight simulation.

DISTANCE: approximately ${dist} NM
CRUISE ALTITUDE: FL${cruiseFL} (${cruiseAlt} ft) - this is MANDATORY as the cruise altitude.
AIRCRAFT TYPE: ${acType || 'airliner'}

CRITICAL REQUIREMENTS:
1. Use REAL published waypoint identifiers - 5-letter ICAO fixes (like AMLUH, SUGOL, KERAX, ABUKA etc.) and 3-letter VOR/NDB identifiers (like MUN, FFM, SPR, etc.)
2. Use REAL airway designators (like Y163, UL608, UN871, T180, L980, etc.)
3. The route MUST include a realistic SID from ${departure_icao} with proper SID waypoints
4. The route MUST include a realistic STAR into ${arrival_icao} with proper STAR waypoints
5. Enroute waypoints MUST follow real airways between SID exit and STAR entry
6. Include ${waypointGuidance}

ALTITUDE PROFILE (REALISTIC stepped climb/descent):
- SID waypoints: climbing from departure elevation, typically between 3,000-10,000 ft with altitude restrictions
- Transition altitude: typically around FL100-FL150 (set some waypoints at these intermediate levels)
- Enroute (cruise): FL${cruiseFL} (${cruiseAlt} ft)
- STAR waypoints: descending from cruise, step-down fixes at FL240, FL180, FL120, FL100, then lower
- Final STAR fixes: typically between 3,000-8,000 ft with published altitude restrictions

DO NOT just put all enroute waypoints at FL${cruiseFL}. Show a realistic climb profile through the SID and a realistic descent profile through the STAR.

ROUTE STRING FORMAT: Use standard pilot notation like "SURMA1G SURMA Y163 AMLUH UL608 FFM T725 ROLIS ROLIS2A" (SID name, waypoints with airways, STAR name).

Return coordinates that are geographically accurate for the real-world positions of these fixes.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          waypoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Waypoint identifier (e.g. AMLUH, MUN, FFM)" },
                lat: { type: "number", description: "Latitude" },
                lon: { type: "number", description: "Longitude" },
                alt: { type: "number", description: "Altitude in feet (with realistic altitude restrictions)" },
                type: { type: "string", enum: ["sid", "enroute", "star"], description: "Waypoint type" }
              },
              required: ["name", "lat", "lon", "alt", "type"]
            }
          },
          route_string: {
            type: "string",
            description: "Compact route string with SID, airways, and STAR (e.g. SURMA1G SURMA Y163 AMLUH UL608 FFM ROLIS2A)"
          },
          sid_name: {
            type: "string",
            description: "Name of the SID used (e.g. SURMA1G, AGSIK5B)"
          },
          star_name: {
            type: "string",
            description: "Name of the STAR used (e.g. ROLIS2A, BRANE3R)"
          },
          cruise_altitude: {
            type: "number",
            description: "Cruise altitude in feet"
          },
          estimated_distance_nm: {
            type: "number",
            description: "Estimated route distance in nautical miles"
          }
        },
        required: ["waypoints", "route_string", "cruise_altitude"]
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});