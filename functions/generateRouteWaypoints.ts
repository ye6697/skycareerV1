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

    // Try Flight Plan Database API first (real AIRAC data)
    let fpdRoute = null;
    try {
      const fpdResponse = await fetch(
        `https://api.flightplandatabase.com/auto/generate?fromICAO=${departure_icao}&toICAO=${arrival_icao}&cruiseAlt=${cruiseAlt}&useNAT=true&usePACOT=true&useAWYHI=true&useAWYLO=true`,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );
      if (fpdResponse.ok) {
        fpdRoute = await fpdResponse.json();
      } else {
        console.log('FPD API returned status:', fpdResponse.status);
      }
    } catch (e) {
      console.log('FPD API failed, falling back to LLM:', e.message);
    }

    // Parse FPD route into our format
    if (fpdRoute && fpdRoute.route && fpdRoute.route.nodes && fpdRoute.route.nodes.length > 0) {
      const nodes = fpdRoute.route.nodes;
      const waypoints = [];
      const routeStringParts = [];
      let depRunway = '';
      let arrRunway = '';

      // Log for debugging
      console.log('FPD returned', nodes.length, 'nodes');

      for (const node of nodes) {
        const ident = node.ident || '';
        const lat = node.lat;
        const lon = node.lon;
        const nodeType = node.type || '';
        const via = node.via;

        // Extract runway info from airport nodes
        if (ident === departure_icao) {
          // Check if via contains runway info
          if (via && via.ident) depRunway = via.ident;
          continue;
        }
        if (ident === arrival_icao) {
          if (via && via.ident) arrRunway = via.ident;
          continue;
        }

        // Skip "DCT" as waypoint name — it's a routing keyword, not a fix
        if (ident === 'DCT' || ident === 'dct') continue;

        // Only add waypoints that have valid coordinates and a real name
        if (lat != null && lon != null && ident && ident.length >= 2) {
          // Determine waypoint type
          let wpType = 'enroute';
          if (via && via.type === 'SID') wpType = 'sid';
          else if (via && via.type === 'STAR') wpType = 'star';

          waypoints.push({
            name: ident,
            lat: lat,
            lon: lon,
            alt: 0, // will be set by altitude profile below
            type: wpType
          });
        }

        // Build route string
        if (via && via.ident && via.ident !== 'DCT') {
          const lastPart = routeStringParts[routeStringParts.length - 1];
          if (lastPart !== via.ident) {
            routeStringParts.push(via.ident);
          }
        } else if (via && via.type === 'DCT') {
          const lastPart = routeStringParts[routeStringParts.length - 1];
          if (lastPart !== 'DCT') {
            routeStringParts.push('DCT');
          }
        }
        if (ident && ident !== 'DCT') {
          routeStringParts.push(ident);
        }
      }

      // Extract airport coordinates from FPD route nodes
      let depLat = null, depLon = null, arrLat = null, arrLon = null;
      for (const node of nodes) {
        if (node.ident === departure_icao && node.lat != null && node.lon != null) {
          depLat = node.lat;
          depLon = node.lon;
        }
        if (node.ident === arrival_icao && node.lat != null && node.lon != null) {
          arrLat = node.lat;
          arrLon = node.lon;
        }
      }

      console.log('Parsed', waypoints.length, 'waypoints from FPD');

      // Set altitude profile
      if (waypoints.length > 0) {
        const total = waypoints.length;
        for (let i = 0; i < total; i++) {
          const progress = total === 1 ? 0.5 : i / (total - 1);
          if (progress < 0.2) {
            waypoints[i].alt = Math.round(3000 + progress * 5 * cruiseAlt * 0.8);
            if (waypoints[i].type === 'enroute') waypoints[i].type = 'sid';
          } else if (progress > 0.8) {
            const descProgress = (progress - 0.8) / 0.2;
            waypoints[i].alt = Math.round(cruiseAlt * (1 - descProgress * 0.85));
            if (waypoints[i].type === 'enroute') waypoints[i].type = 'star';
          } else {
            waypoints[i].alt = cruiseAlt;
          }
        }
      }

      // Remove duplicates
      const seen = new Set();
      const filteredWaypoints = waypoints.filter(wp => {
        if (!wp.name || wp.lat == null || wp.lon == null) return false;
        if (wp.name === departure_icao || wp.name === arrival_icao) return false;
        const key = wp.name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Limit to reasonable count (~10-12)
      let finalWaypoints = filteredWaypoints;
      if (finalWaypoints.length > 14) {
        const step = Math.ceil(finalWaypoints.length / 10);
        const sampled = [finalWaypoints[0]];
        for (let i = step; i < finalWaypoints.length - 1; i += step) {
          sampled.push(finalWaypoints[i]);
        }
        sampled.push(finalWaypoints[finalWaypoints.length - 1]);
        finalWaypoints = sampled;
      }

      // If FPD returned a valid route with real waypoints, use it
      if (finalWaypoints.length > 0) {
        // Build proper route string with airways
        const routeString = routeStringParts.join(' ');

        // Extract SID and STAR names properly
        let sidName = '';
        let starName = '';
        for (const node of nodes) {
          if (node.via?.type === 'SID' && node.via?.ident) {
            sidName = node.via.ident;
          }
          if (node.via?.type === 'STAR' && node.via?.ident) {
            starName = node.via.ident;
          }
        }

        return Response.json({
          waypoints: finalWaypoints,
          route_string: routeString,
          sid_name: sidName,
          star_name: starName,
          cruise_altitude: cruiseAlt,
          departure_runway: depRunway,
          arrival_runway: arrRunway,
          departure_coords: depLat != null ? { lat: depLat, lon: depLon } : null,
          arrival_coords: arrLat != null ? { lat: arrLat, lon: arrLon } : null
        });
      }

      // FPD returned nodes but no usable waypoints (all DCT) — fall through to LLM
      console.log('FPD had no usable waypoints, falling back to LLM');
    }

    // Fallback: Use LLM with detailed aviation prompt
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert IFR flight planner with access to current AIRAC navigation data. Generate a COMPLETE and REALISTIC IFR flight plan from ${departure_icao} to ${arrival_icao}.

Flight parameters:
- Distance: ~${dist} NM
- Aircraft type: ${acType}
- Cruise altitude: FL${cruiseFL} (${cruiseAlt} ft)

CRITICAL REQUIREMENTS - follow these exactly:

1. SID (Standard Instrument Departure):
   - Pick a REAL published SID procedure for ${departure_icao}
   - Provide the SID name (e.g. "TOBAK7F", "OBOKA1S", "MARUN6G")
   - Include 1-2 waypoints that belong to this SID with type "sid"
   - Pick a real runway for departure

2. AIRWAY ROUTING (enroute):
   - Use REAL published airways (e.g. L620, T180, UL607, UN850, Z850, Y163)
   - The route_string MUST contain airways between fixes, like: "TOBAK L620 KERAX T180 PIROT"
   - NOT just a list of waypoint names
   - Include 3-6 enroute waypoints with type "enroute"

3. STAR (Standard Terminal Arrival Route):
   - Pick a REAL published STAR procedure for ${arrival_icao}
   - Provide the STAR name (e.g. "ANEK2D", "OSBIT1B", "DEBHI1A")
   - Include 1-2 waypoints that belong to this STAR with type "star"
   - Pick a real runway for arrival

4. COORDINATES:
   - All lat/lon MUST be accurate to at least 4 decimal places
   - Use internet search to verify real waypoint positions
   - departure_coords = exact airport coordinates of ${departure_icao}
   - arrival_coords = exact airport coordinates of ${arrival_icao}

5. ROUTE STRING FORMAT:
   - Must follow real ATC format: "SID_TRANSITION AIRWAY FIX AIRWAY FIX ... STAR_TRANSITION"
   - Example: "TOBAK7F TOBAK L620 KERAX T180 PIROT UL607 ERSEN DEBHI1A"
   - DO NOT include departure/arrival ICAO codes in the route_string

6. Do NOT use "DCT" as a waypoint name. Only use it in route_string if direct routing is needed between fixes.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          waypoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Waypoint/fix name (e.g. TOBAK, KERAX)" },
                lat: { type: "number", description: "Latitude in decimal degrees (4+ decimals)" },
                lon: { type: "number", description: "Longitude in decimal degrees (4+ decimals)" },
                alt: { type: "number", description: "Altitude in feet" },
                type: { type: "string", enum: ["sid", "enroute", "star"] }
              },
              required: ["name", "lat", "lon", "alt", "type"]
            }
          },
          route_string: { type: "string", description: "IFR route string with airways, e.g. TOBAK7F TOBAK L620 KERAX T180 PIROT DEBHI1A" },
          sid_name: { type: "string", description: "SID procedure name with number, e.g. TOBAK7F" },
          star_name: { type: "string", description: "STAR procedure name with number, e.g. DEBHI1A" },
          cruise_altitude: { type: "number" },
          departure_runway: { type: "string", description: "Runway number, e.g. 25C, 07R" },
          arrival_runway: { type: "string", description: "Runway number, e.g. 27L, 09" },
          departure_coords: {
            type: "object",
            properties: { lat: { type: "number" }, lon: { type: "number" } },
            description: "Exact airport reference point coordinates"
          },
          arrival_coords: {
            type: "object",
            properties: { lat: { type: "number" }, lon: { type: "number" } },
            description: "Exact airport reference point coordinates"
          }
        },
        required: ["waypoints", "route_string", "sid_name", "star_name", "cruise_altitude", "departure_coords", "arrival_coords", "departure_runway", "arrival_runway"]
      }
    });

    if (result && result.waypoints && Array.isArray(result.waypoints)) {
      const seen = new Set();
      result.waypoints = result.waypoints.filter(wp => {
        if (!wp.name || !wp.lat || !wp.lon) return false;
        if (wp.name === departure_icao || wp.name === arrival_icao) return false;
        if (wp.name === 'DCT' || wp.name === 'dct') return false;
        const coordKey = `${wp.lat.toFixed(3)}_${wp.lon.toFixed(3)}`;
        const nameKey = wp.name;
        if (seen.has(nameKey) || seen.has(coordKey)) return false;
        seen.add(nameKey);
        seen.add(coordKey);
        return true;
      });

      // Apply altitude profile to LLM results (often returns alt=0)
      const total = result.waypoints.length;
      if (total > 0) {
        for (let i = 0; i < total; i++) {
          const progress = total === 1 ? 0.5 : i / (total - 1);
          if (progress < 0.2) {
            result.waypoints[i].alt = Math.round(3000 + progress * 5 * cruiseAlt * 0.8);
            if (result.waypoints[i].type === 'enroute') result.waypoints[i].type = 'sid';
          } else if (progress > 0.8) {
            const descProgress = (progress - 0.8) / 0.2;
            result.waypoints[i].alt = Math.round(cruiseAlt * (1 - descProgress * 0.85));
            if (result.waypoints[i].type === 'enroute') result.waypoints[i].type = 'star';
          } else {
            result.waypoints[i].alt = cruiseAlt;
          }
        }
      }

      if (!result.cruise_altitude) result.cruise_altitude = cruiseAlt;
    }

    // Ensure departure/arrival coords are present
    if (!result.departure_coords || !result.departure_coords.lat) {
      result.departure_coords = null;
    }
    if (!result.arrival_coords || !result.arrival_coords.lat) {
      result.arrival_coords = null;
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});