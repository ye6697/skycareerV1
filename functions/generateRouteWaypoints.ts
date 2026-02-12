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

    // Look up airport coordinates first
    const airportInfo = await base44.integrations.Core.InvokeLLM({
      prompt: `What are the exact coordinates of ${departure_icao} and ${arrival_icao} airports? Search online for their precise coordinates.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          departure: {
            type: "object",
            properties: { lat: { type: "number" }, lon: { type: "number" } },
            required: ["lat", "lon"]
          },
          arrival: {
            type: "object",
            properties: { lat: { type: "number" }, lon: { type: "number" } },
            required: ["lat", "lon"]
          }
        },
        required: ["departure", "arrival"]
      }
    });

    const depLat = airportInfo?.departure?.lat || 0;
    const depLon = airportInfo?.departure?.lon || 0;
    const arrLat = airportInfo?.arrival?.lat || 0;
    const arrLon = airportInfo?.arrival?.lon || 0;

    // Generate route with explicit airport coordinates context
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate IFR route from ${departure_icao} (${depLat.toFixed(4)}°N, ${depLon.toFixed(4)}°E) to ${arrival_icao} (${arrLat.toFixed(4)}°N, ${arrLon.toFixed(4)}°E).
Distance: ${dist}NM. Aircraft: ${acType}. Cruise: FL${cruiseFL}.

I need ${wpCount} waypoints using real navigation fixes from AIRAC data. Search opennav.com or skyvector.com for real fixes and their coordinates along this route.

CRITICAL COORDINATE RULES:
- Waypoint 1 should be near ${departure_icao} (within ~20nm of ${depLat.toFixed(2)}°N, ${depLon.toFixed(2)}°E)
- Middle waypoints should have coordinates that gradually transition from departure to arrival
- Last waypoint should be near ${arrival_icao} (within ~20nm of ${arrLat.toFixed(2)}°N, ${arrLon.toFixed(2)}°E)
- Each waypoint MUST have UNIQUE coordinates that are DIFFERENT from all others
- Latitude must transition from ~${depLat.toFixed(1)} to ~${arrLat.toFixed(1)}
- Longitude must transition from ~${depLon.toFixed(1)} to ~${arrLon.toFixed(1)}

Use real SIDs, airways, STARs. Altitudes: SID 3000-15000ft, enroute ${cruiseAlt}ft, STAR descending to 4000ft.`,
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

      // Validate distribution: check that waypoints span the route
      if (result.waypoints.length >= 2 && depLat && arrLat) {
        const lats = result.waypoints.map(w => w.lat);
        const latRange = Math.max(...lats) - Math.min(...lats);
        const expectedLatRange = Math.abs(arrLat - depLat);
        
        // If waypoints span less than 30% of the expected range, coordinates are likely wrong
        if (expectedLatRange > 0.5 && latRange < expectedLatRange * 0.3) {
          result._coordinate_warning = "Waypoint coordinates may be inaccurate - limited geographic spread detected";
        }
      }
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});