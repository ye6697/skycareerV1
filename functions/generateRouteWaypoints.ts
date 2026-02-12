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
      }
    } catch (e) {
      console.log('FPD API failed, falling back to LLM:', e.message);
    }

    // Parse FPD route into our format
    if (fpdRoute && fpdRoute.route && fpdRoute.route.nodes && fpdRoute.route.nodes.length > 0) {
      const nodes = fpdRoute.route.nodes;
      const waypoints = [];
      let routeStringParts = [];
      let depRunway = '';
      let arrRunway = '';

      for (const node of nodes) {
        const ident = node.ident;
        const lat = node.lat;
        const lon = node.lon;
        const nodeAlt = node.alt || 0;
        const nodeType = node.type; // e.g. "SID", "STAR", "AWY", "FIX", "APT"
        const via = node.via; // airway info

        if (nodeType === 'APT') {
          // Airport node - extract runway if present
          if (ident === departure_icao && node.name) {
            // Check for runway info
          } else if (ident === arrival_icao && node.name) {
            // Check for runway info
          }
          continue;
        }

        // Determine our waypoint type
        let wpType = 'enroute';
        if (node.type === 'SID' || (via && via.type === 'SID')) wpType = 'sid';
        else if (node.type === 'STAR' || (via && via.type === 'STAR')) wpType = 'star';

        if (lat && lon && ident) {
          waypoints.push({
            name: ident,
            lat: lat,
            lon: lon,
            alt: nodeAlt || cruiseAlt,
            type: wpType
          });
        }

        // Build route string
        if (via && via.ident) {
          routeStringParts.push(via.ident);
        }
        if (ident) {
          routeStringParts.push(ident);
        }
      }

      // Set altitude profile
      if (waypoints.length > 0) {
        const total = waypoints.length;
        for (let i = 0; i < total; i++) {
          const progress = i / (total - 1);
          if (progress < 0.2) {
            // Climbing
            waypoints[i].alt = Math.round(3000 + progress * 5 * cruiseAlt * 0.8);
            waypoints[i].type = waypoints[i].type || 'sid';
          } else if (progress > 0.8) {
            // Descending
            const descProgress = (progress - 0.8) / 0.2;
            waypoints[i].alt = Math.round(cruiseAlt * (1 - descProgress * 0.85));
            waypoints[i].type = waypoints[i].type || 'star';
          } else {
            waypoints[i].alt = cruiseAlt;
            waypoints[i].type = waypoints[i].type || 'enroute';
          }
        }
      }

      // Remove duplicate waypoints
      const seen = new Set();
      const filteredWaypoints = waypoints.filter(wp => {
        if (!wp.name || !wp.lat || !wp.lon) return false;
        if (wp.name === departure_icao || wp.name === arrival_icao) return false;
        const key = wp.name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Limit to reasonable count
      let finalWaypoints = filteredWaypoints;
      if (finalWaypoints.length > 14) {
        // Keep every Nth waypoint to get ~10
        const step = Math.ceil(finalWaypoints.length / 10);
        const sampled = [finalWaypoints[0]];
        for (let i = step; i < finalWaypoints.length - 1; i += step) {
          sampled.push(finalWaypoints[i]);
        }
        sampled.push(finalWaypoints[finalWaypoints.length - 1]);
        finalWaypoints = sampled;
      }

      const routeString = `${departure_icao} ${routeStringParts.join(' ')} ${arrival_icao}`;

      return Response.json({
        waypoints: finalWaypoints,
        route_string: routeString,
        sid_name: fpdRoute.route.nodes.find(n => n.via?.type === 'SID')?.via?.ident || '',
        star_name: fpdRoute.route.nodes.find(n => n.via?.type === 'STAR')?.via?.ident || '',
        cruise_altitude: cruiseAlt,
        departure_runway: depRunway,
        arrival_runway: arrRunway
      });
    }

    // Fallback: Use LLM
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate IFR route from ${departure_icao} to ${arrival_icao}. Distance: ${dist}NM. Aircraft: ${acType}. Cruise: FL${cruiseFL}. Use real AIRAC navigation fixes with correct coordinates. Distribute waypoints evenly along the route.`,
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

    if (result && result.waypoints && Array.isArray(result.waypoints)) {
      const seen = new Set();
      result.waypoints = result.waypoints.filter(wp => {
        if (!wp.name || !wp.lat || !wp.lon) return false;
        if (wp.name === departure_icao || wp.name === arrival_icao) return false;
        const coordKey = `${wp.lat.toFixed(3)}_${wp.lon.toFixed(3)}`;
        const nameKey = wp.name;
        if (seen.has(nameKey) || seen.has(coordKey)) return false;
        seen.add(nameKey);
        seen.add(coordKey);
        return true;
      });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});