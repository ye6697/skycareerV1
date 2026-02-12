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

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate IFR route: ${departure_icao} to ${arrival_icao}, ${dist}NM, ${acType}, FL${cruiseFL}.

Return ${wpCount} waypoints using REAL AIRAC navigation fixes with their CORRECT published coordinates. Use real SIDs, airways, and STARs. Each fix must have precise coordinates (NOT rounded to whole degrees). Distribute waypoints evenly along the route.

Altitude profile: SID 3000-15000ft, enroute ${cruiseAlt}ft, STAR descending to 4000ft.`,
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

    // Post-process: remove duplicate waypoints and airport names
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