import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { departure_icao, arrival_icao } = await req.json();
    if (!departure_icao || !arrival_icao) {
      return Response.json({ error: 'Missing departure_icao or arrival_icao' }, { status: 400 });
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a realistic IFR flight route between ${departure_icao} and ${arrival_icao} for flight simulation (X-Plane 12).

Return waypoints that a real pilot would use, including:
- SIDs (Standard Instrument Departures) waypoints from the departure airport
- Enroute waypoints (VORs, intersections, airways)
- STARs (Standard Terminal Arrival Routes) waypoints for the arrival airport

Use REAL navigation waypoint identifiers (5-letter fixes like AMLUH, SUGOL, etc., or 3-letter VOR identifiers like MUN, FFM, etc.).
Include realistic cruise altitudes based on the route direction and distance.
For short routes (<200nm), use 3-6 waypoints.
For medium routes (200-1000nm), use 5-10 waypoints.
For long routes (>1000nm), use 8-15 waypoints.

IMPORTANT: Return REAL coordinates (latitude/longitude) for each waypoint. Use your knowledge of real-world aviation waypoints.`,
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
                alt: { type: "number", description: "Suggested altitude in feet (0 if no restriction)" },
                type: { type: "string", enum: ["sid", "enroute", "star"], description: "Waypoint type" }
              },
              required: ["name", "lat", "lon", "alt", "type"]
            }
          },
          route_string: {
            type: "string",
            description: "Compact route string like pilots use, e.g. AMLUH Y163 SUGOL UL608 FFM"
          },
          cruise_altitude: {
            type: "number",
            description: "Recommended cruise altitude in feet"
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