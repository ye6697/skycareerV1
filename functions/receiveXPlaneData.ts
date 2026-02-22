import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const haversineNm = (lat1, lon1, lat2, lon2) => {
      const R = 3440.065;
      const toRad = (d) => d * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };
    const routeTotalNm = (wps) => {
      if (!Array.isArray(wps) || wps.length < 2) return 0;
      let total = 0;
      for (let i = 0; i < wps.length - 1; i++) {
        total += haversineNm(wps[i].lat, wps[i].lon, wps[i + 1].lat, wps[i + 1].lon);
      }
      return total;
    };
    const routeRemainingNm = (wps, curLat, curLon) => {
      if (!Array.isArray(wps) || wps.length === 0) return 0;
      let best = Infinity;
      for (let i = 0; i < wps.length; i++) {
        let candidate = haversineNm(curLat, curLon, wps[i].lat, wps[i].lon);
        for (let j = i; j < wps.length - 1; j++) {
          candidate += haversineNm(wps[j].lat, wps[j].lon, wps[j + 1].lat, wps[j + 1].lon);
        }
        if (candidate < best) best = candidate;
      }
      return Number.isFinite(best) ? best : 0;
    };
    const routeCompact = (wps) => {
      if (!Array.isArray(wps) || wps.length === 0) return null;
      const cleanToken = (v, fallback = "") => String(v ?? fallback)
        .toUpperCase()
        .replace(/[;,]/g, "")
        .trim();
      const toAlt = (wp) => {
        const raw = Number(wp?.alt ?? wp?.altitude_feet ?? wp?.altitude ?? 0);
        if (!Number.isFinite(raw)) return 0;
        return Math.max(0, Math.round(raw));
      };

      // Extended compact format for FlyWithLua:
      // NAME,LAT,LON,ALT,VIA;NAME,LAT,LON,ALT,VIA...
      return wps
        .slice(0, 120)
        .map((wp, idx) => {
          const lat = Number(wp?.lat);
          const lon = Number(wp?.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          const name = cleanToken(wp?.name || wp?.ident || `WP${idx + 1}`, `WP${idx + 1}`) || `WP${idx + 1}`;
          const via = cleanToken(wp?.airway || wp?.via_airway || wp?.via || wp?.airway_ident || "DCT", "DCT") || "DCT";
          const alt = toAlt(wp);
          return `${name},${lat.toFixed(5)},${lon.toFixed(5)},${alt},${via}`;
        })
        .filter(Boolean)
        .join(";");
    };
    
    // Get API key from query params
    const url = new URL(req.url);
    const apiKey = url.searchParams.get('api_key');
    
    if (!apiKey) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    // Find company by API key
    const companies = await base44.asServiceRole.entities.Company.filter({ xplane_api_key: apiKey });
    if (companies.length === 0) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    const company = companies[0];
    
    const data = await req.json();
    
    // --- FAST POSITION UPDATE: lightweight path for ~30Hz ARC mode data ---
    // These packets only contain position/heading/altitude/speed and skip all DB writes.
    // The frontend polls for these via the flight's xplane_data, but fast_position
    // packets are returned directly to the plugin without touching the Flight entity.
    if (data.fast_position) {
      // With full updates now at 1s interval, fast_position at 30Hz is redundant
      // and wastes DB reads/writes. Simply acknowledge and return immediately.
      return Response.json({ 
        status: 'fast_skipped',
        xplane_connection_status: 'connected'
      });
    }
    
    const altitude = data.altitude;
    const speed = data.speed;
    const vertical_speed = data.vertical_speed;
    const heading = data.heading;
    const fuel_percentage = data.fuel_percentage;
    const fuel_kg = data.fuel_kg;
    const g_force = data.g_force;
    const max_g_force = data.max_g_force;
    const latitude = data.latitude;
    const longitude = data.longitude;
    const on_ground = data.on_ground;
    const touchdown_vspeed = data.touchdown_vspeed;
    const landing_g_force = data.landing_g_force;
    const tailstrike = data.tailstrike;
    const stall = data.stall;
    const is_in_stall = data.is_in_stall;
    const stall_warning = data.stall_warning;
    const override_alpha = data.override_alpha;
    const overstress = data.overstress;
    const flaps_overspeed = data.flaps_overspeed;
    const fuel_emergency = data.fuel_emergency;
    const gear_up_landing = data.gear_up_landing;
    const crash = data.crash;
    const has_crashed = data.has_crashed;
    const overspeed = data.overspeed;
    const gear_down = data.gear_down;
    // flap_ratio: preserve 0 as valid value (don't use || which treats 0 as falsy)
    const flap_ratio = data.flap_ratio !== undefined && data.flap_ratio !== null ? data.flap_ratio : 0;
    const pitch = data.pitch;
    const ias = data.ias;
    // Legacy fields from old plugins
    const flight_score = data.flight_score;
    const maintenance_cost = data.maintenance_cost;
    const reputation = data.reputation;
    const landing_quality = data.landing_quality;

    // Normalize field names (support both naming conventions)
    const park_brake = data.parking_brake || data.park_brake || false;
    const engine1_running = data.engine1_running || false;
    const engine2_running = data.engine2_running || false;
    const engines_running = data.engines_running || engine1_running || engine2_running;
    const isCrash = crash || has_crashed || false;

    // Verify we have valid flight data before marking as connected
    if (altitude === undefined || speed === undefined) {
      return Response.json({ 
        error: 'Invalid data - no altitude or speed received',
        xplane_connection_status: 'disconnected' 
      }, { status: 400 });
    }

    // Update company connection status - fire and forget (don't block response)
    if (company && company.xplane_connection_status !== 'connected') {
      base44.asServiceRole.entities.Company.update(company.id, { 
        xplane_connection_status: 'connected' 
      }).catch(() => {});
    }

    // Get active flight for this company (single DB query)
    const flights = await base44.asServiceRole.entities.Flight.filter({ 
      company_id: company.id,
      status: 'in_flight'
    });
    
    const flight = flights[0] || null;
    
    if (!flight) {
      // No active flight - log to XPlaneLog so debug page can show data
      base44.asServiceRole.entities.XPlaneLog.create({
        company_id: company.id,
        raw_data: data,
        altitude,
        speed,
        on_ground,
        flight_score,
        has_active_flight: false
      }).catch(() => {});

      // Cleanup old logs very rarely
      if (Math.random() < 0.03) {
        base44.asServiceRole.entities.XPlaneLog.filter(
          { company_id: company.id }, '-created_date', 60
        ).then(async (oldLogs) => {
          if (oldLogs.length > 30) {
            await Promise.all(oldLogs.slice(30).map(l => base44.asServiceRole.entities.XPlaneLog.delete(l.id)));
          }
        }).catch(() => {});
      }

      return Response.json({ 
        message: 'X-Plane connected - no active flight',
        xplane_connection_status: 'connected',
        data_logged: true
      }, { status: 200 });
    }
    
    // Active flight exists - skip XPlaneLog write entirely to maximize speed
    let contract = null;
    if (flight.contract_id) {
      try {
        const contracts = await base44.asServiceRole.entities.Contract.filter({ id: flight.contract_id });
        contract = contracts[0] || null;
      } catch (_) {
        contract = null;
      }
    }

    // Extract new aircraft/env fields from plugin
    const total_weight_kg = data.total_weight_kg;
    const oat_c = data.oat_c;
    const ground_elevation_ft = data.ground_elevation_ft;
    const baro_setting = data.baro_setting;
    const wind_speed_kts = data.wind_speed_kts;
    const wind_direction = data.wind_direction;
    const aircraft_icao = data.aircraft_icao;
    const fms_waypoints = data.fms_waypoints; // array of {name, lat, lon, alt}

    const areEnginesRunning = engines_running || engine1_running || engine2_running;
    const wasAirborne = flight.xplane_data?.was_airborne || false;
    const isNowAirborne = !on_ground && altitude > 50;
    const hasBeenAirborne = wasAirborne || isNowAirborne;

    // Track initial fuel for consumption calculation
    const initial_fuel_kg = flight.xplane_data?.initial_fuel_kg || fuel_kg || 0;

    // Track flight path (add position every update, limited to keep data manageable)
    const existingPath = flight.xplane_data?.flight_path || [];
    let newPath = existingPath;
    if (latitude && longitude && !on_ground) {
      const lastPt = existingPath[existingPath.length - 1];
      // Add point only if moved enough (reduce data)
      if (!lastPt || Math.abs(lastPt[0] - latitude) > 0.005 || Math.abs(lastPt[1] - longitude) > 0.005) {
        newPath = [...existingPath, [latitude, longitude]];
        // Keep max 500 points
        if (newPath.length > 500) newPath = newPath.filter((_, i) => i % 2 === 0 || i === newPath.length - 1);
      }
    }

    // Build a LEAN xplane_data object - only current sensor readings
    // No merging with previous data (the frontend tracks accumulated state)
    const xplaneData = {
      altitude,
      speed,
      vertical_speed,
      heading,
      fuel_percentage,
      fuel_kg: fuel_kg || 0,
      initial_fuel_kg,
      g_force,
      max_g_force,
      latitude,
      longitude,
      on_ground,
      park_brake,
      engine1_running,
      engine2_running,
      engines_running: areEnginesRunning,
      touchdown_vspeed,
      landing_g_force,
      landing_quality,
      gear_down: gear_down !== undefined ? gear_down : true,
      flap_ratio,
      pitch: pitch || 0,
      ias: ias || 0,
      tailstrike,
      stall: stall || is_in_stall || stall_warning || override_alpha,
      is_in_stall,
      stall_warning,
      override_alpha,
      overstress,
      overspeed: overspeed || false,
      flaps_overspeed: flaps_overspeed || false,
      fuel_emergency,
      gear_up_landing,
      crash: isCrash,
      has_crashed: isCrash,
      was_airborne: hasBeenAirborne,
      // Preserve departure/arrival coords from first packet
      departure_lat: data.departure_lat || (flight.xplane_data?.departure_lat || 0),
      departure_lon: data.departure_lon || (flight.xplane_data?.departure_lon || 0),
      arrival_lat: data.arrival_lat || (flight.xplane_data?.arrival_lat || 0),
      arrival_lon: data.arrival_lon || (flight.xplane_data?.arrival_lon || 0),
      // Aircraft environment data for calculator
      total_weight_kg: total_weight_kg || (flight.xplane_data?.total_weight_kg || null),
      oat_c: oat_c !== undefined ? oat_c : (flight.xplane_data?.oat_c ?? null),
      ground_elevation_ft: ground_elevation_ft || (flight.xplane_data?.ground_elevation_ft || null),
      baro_setting: baro_setting || (flight.xplane_data?.baro_setting || null),
      wind_speed_kts: wind_speed_kts !== undefined ? wind_speed_kts : (flight.xplane_data?.wind_speed_kts ?? null),
      wind_direction: wind_direction !== undefined ? wind_direction : (flight.xplane_data?.wind_direction ?? null),
      aircraft_icao: aircraft_icao || (flight.xplane_data?.aircraft_icao || null),
      // FMS waypoints - only update if plugin sends them (they don't change often)
      fms_waypoints: fms_waypoints || (flight.xplane_data?.fms_waypoints || []),
      // Preserve SimBrief route data if present (set by web app/import)
      simbrief_waypoints: data.simbrief_waypoints || (flight.xplane_data?.simbrief_waypoints || []),
      simbrief_route_string: data.simbrief_route_string || (flight.xplane_data?.simbrief_route_string || null),
      simbrief_departure_coords: data.simbrief_departure_coords || (flight.xplane_data?.simbrief_departure_coords || null),
      simbrief_arrival_coords: data.simbrief_arrival_coords || (flight.xplane_data?.simbrief_arrival_coords || null),
      // Flight path for map visualization
      flight_path: newPath,
      timestamp: new Date().toISOString()
    };

    // Build minimal update object - only include what changes
    const updateData = { xplane_data: xplaneData };

    // Track max G-force on flight level
    if (max_g_force > (flight.max_g_force || 0)) {
      updateData.max_g_force = max_g_force;
    }

    // Only process failures if plugin sends them (rare event, not every packet)
    const pluginFailures = data.active_failures || [];
    if (pluginFailures.length > 0) {
      const existingFailures = flight.active_failures || [];
      const existingNames = new Set(existingFailures.map(f => f.name));
      const newFailures = [];
      for (const pf of pluginFailures) {
        if (!existingNames.has(pf.name)) {
          newFailures.push({
            name: pf.name,
            severity: pf.severity,
            category: pf.category,
            timestamp: new Date().toISOString()
          });
        }
      }
      if (newFailures.length > 0) {
        updateData.active_failures = [...existingFailures, ...newFailures];
        const existingDamage = flight.maintenance_damage || {};
        const newDamage = { ...existingDamage };
        for (const f of newFailures) {
          const cat = f.category || 'airframe';
          const dmg = f.severity === 'schwer' ? 15 : f.severity === 'mittel' ? 8 : 3;
          newDamage[cat] = (newDamage[cat] || 0) + dmg;
        }
        updateData.maintenance_damage = newDamage;
      }
    }

    // CRITICAL: Fire-and-forget the DB write so X-Plane gets a response IMMEDIATELY.
    // The plugin blocks on the HTTP response, so fast response = fast next send cycle.
    base44.asServiceRole.entities.Flight.update(flight.id, updateData).catch(() => {});

    // Use cached maintenance_ratio from Company (updated in background ~10% of requests)
    const maintenanceRatio = company?.current_maintenance_ratio || 0;
    
    const flightStatus = on_ground && park_brake && !areEnginesRunning && hasBeenAirborne ? 'ready_to_complete' : 'updated';
    
    // === FAILURE TRIGGER SYSTEM ===
    // Failures are triggered based on maintenance wear percentage.
    // Higher wear = higher chance of failure per data packet.
    // Only trigger failures when airborne to avoid ground anomalies.
    let triggeredFailures = [];
    if (hasBeenAirborne && !on_ground && flight.aircraft_id) {
      // Use cached maintenance ratio for quick check (0.0 = perfect, 1.0 = 100% worn)
      // Only attempt failure rolls if maintenance is above 15%
      if (maintenanceRatio > 0.15) {
        // Base chance per data packet (~1 per second): 
        // At 20% wear: 0.05% chance per tick (~3% per minute)
        // At 50% wear: 0.25% chance per tick (~15% per minute) 
        // At 80% wear: 0.8% chance per tick (~40% per minute)
        // At 100% wear: 1.5% chance per tick (~60% per minute)
        const baseChance = Math.pow(maintenanceRatio, 2.5) * 0.015;
        
        // Roll for failure
        if (Math.random() < baseChance) {
          // Determine which category fails based on individual wear levels
          // Fetch aircraft data (async, but we respond before it completes)
          (async () => {
            try {
              const aircraftList = await base44.asServiceRole.entities.Aircraft.filter({ id: flight.aircraft_id });
              const ac = aircraftList[0];
              if (!ac?.maintenance_categories) return;
              
              const cats = ac.maintenance_categories;
              // Build weighted pool: categories with higher wear are more likely to fail
              const pool = [];
              const categoryFailures = {
                engine: [
                  { name: 'Engine Power Loss', name_de: 'Triebwerk Leistungsverlust', severity: 'schwer' },
                  { name: 'Engine Vibration', name_de: 'Triebwerk Vibration', severity: 'mittel' },
                  { name: 'Oil Pressure Warning', name_de: 'Öldruck Warnung', severity: 'leicht' },
                ],
                hydraulics: [
                  { name: 'Hydraulic Pressure Low', name_de: 'Hydraulikdruck niedrig', severity: 'mittel' },
                  { name: 'Hydraulic Leak', name_de: 'Hydraulikleck', severity: 'schwer' },
                ],
                avionics: [
                  { name: 'Autopilot Disconnect', name_de: 'Autopilot Abschaltung', severity: 'mittel' },
                  { name: 'Navigation Display Failure', name_de: 'Navigationsanzeige Ausfall', severity: 'leicht' },
                  { name: 'Radio Failure', name_de: 'Funkausfall', severity: 'leicht' },
                ],
                airframe: [
                  { name: 'Cabin Pressure Warning', name_de: 'Kabinendruck Warnung', severity: 'schwer' },
                  { name: 'Structural Vibration', name_de: 'Strukturelle Vibration', severity: 'mittel' },
                ],
                landing_gear: [
                  { name: 'Gear Indicator Fault', name_de: 'Fahrwerksanzeige Fehler', severity: 'leicht' },
                  { name: 'Gear Retraction Problem', name_de: 'Fahrwerk Einfahrproblem', severity: 'mittel' },
                ],
                electrical: [
                  { name: 'Generator Failure', name_de: 'Generator Ausfall', severity: 'mittel' },
                  { name: 'Bus Voltage Low', name_de: 'Bus Spannung niedrig', severity: 'leicht' },
                  { name: 'Battery Overheat', name_de: 'Batterie Überhitzung', severity: 'schwer' },
                ],
                flight_controls: [
                  { name: 'Trim Runaway', name_de: 'Trimmung Durchdrehen', severity: 'schwer' },
                  { name: 'Aileron Stiffness', name_de: 'Querruder Schwergängig', severity: 'leicht' },
                  { name: 'Elevator Malfunction', name_de: 'Höhenruder Fehlfunktion', severity: 'mittel' },
                ],
                pressurization: [
                  { name: 'Bleed Air Leak', name_de: 'Zapfluft Leck', severity: 'mittel' },
                  { name: 'Pack Failure', name_de: 'Klimaanlage Ausfall', severity: 'leicht' },
                  { name: 'Pressurization Loss', name_de: 'Druckverlust', severity: 'schwer' },
                ]
              };
              
              for (const [cat, wear] of Object.entries(cats)) {
                if (wear > 20 && categoryFailures[cat]) {
                  // Weight: more wear = more likely to be selected
                  const weight = Math.round(wear);
                  for (let w = 0; w < weight; w++) {
                    pool.push(cat);
                  }
                }
              }
              
              if (pool.length === 0) return;
              
              // Pick a random category from weighted pool
              const selectedCat = pool[Math.floor(Math.random() * pool.length)];
              const possibleFailures = categoryFailures[selectedCat] || [];
              if (possibleFailures.length === 0) return;
              
              // Higher wear = more severe failures possible
              const catWear = cats[selectedCat] || 0;
              let filtered = possibleFailures;
              if (catWear < 40) {
                filtered = possibleFailures.filter(f => f.severity === 'leicht');
              } else if (catWear < 70) {
                filtered = possibleFailures.filter(f => f.severity !== 'schwer');
              }
              if (filtered.length === 0) filtered = possibleFailures;
              
              const failure = filtered[Math.floor(Math.random() * filtered.length)];
              
              // Check if this failure already exists on the flight
              const existingFailures = flight.active_failures || [];
              const alreadyExists = existingFailures.some(f => f.name === failure.name || f.name === failure.name_de);
              if (alreadyExists) return;
              
              const newFailure = {
                name: failure.name_de,
                severity: failure.severity,
                category: selectedCat,
                timestamp: new Date().toISOString()
              };
              
              // Calculate damage
              const dmg = failure.severity === 'schwer' ? 15 : failure.severity === 'mittel' ? 8 : 3;
              const existingDamage = flight.maintenance_damage || {};
              const updatedDamage = { ...existingDamage };
              updatedDamage[selectedCat] = (updatedDamage[selectedCat] || 0) + dmg;
              
              await base44.asServiceRole.entities.Flight.update(flight.id, {
                active_failures: [...existingFailures, newFailure],
                maintenance_damage: updatedDamage
              });
            } catch (_) { /* ignore failure trigger errors */ }
          })();
        }
      }
    }
    
    // Background maintenance ratio recalculation (~10% of requests, fully async)
    if (Math.random() < 0.1 && flight.aircraft_id) {
      (async () => {
        try {
          const aircraftList = await base44.asServiceRole.entities.Aircraft.filter({ id: flight.aircraft_id });
          const ac = aircraftList[0];
          if (ac?.maintenance_categories) {
            const cats = Object.values(ac.maintenance_categories);
            if (cats.length > 0) {
              const avg = cats.reduce((a, b) => a + (b || 0), 0) / cats.length;
              await base44.asServiceRole.entities.Company.update(company.id, { 
                current_maintenance_ratio: avg / 100 
              });
            }
          }
        } catch (_) { /* ignore */ }
      })();
    }

    const mergedFms = fms_waypoints || flight.xplane_data?.fms_waypoints || [];
    const mergedSimbriefWps = data.simbrief_waypoints || flight.xplane_data?.simbrief_waypoints || contract?.simbrief_waypoints || [];
    const depWp = mergedFms.length > 0 ? mergedFms[0] : null;
    const arrWp = mergedFms.length > 0 ? mergedFms[mergedFms.length - 1] : null;

    const departure_lat = data.departure_lat || flight.xplane_data?.departure_lat || depWp?.lat || 0;
    const departure_lon = data.departure_lon || flight.xplane_data?.departure_lon || depWp?.lon || 0;
    const arrival_lat = data.arrival_lat || flight.xplane_data?.arrival_lat || arrWp?.lat || 0;
    const arrival_lon = data.arrival_lon || flight.xplane_data?.arrival_lon || arrWp?.lon || 0;
    const currentLat = latitude || 0;
    const currentLon = longitude || 0;
    const validSimbriefWps = Array.isArray(mergedSimbriefWps)
      ? mergedSimbriefWps.filter(wp => wp?.lat && wp?.lon)
      : [];
    const simbriefTotalNm = validSimbriefWps.length >= 2 ? routeTotalNm(validSimbriefWps) : null;
    const simbriefRemainingNm = (simbriefTotalNm && simbriefTotalNm > 0)
      ? routeRemainingNm(validSimbriefWps, currentLat, currentLon)
      : null;
    const simbriefFlownNm = (simbriefTotalNm && simbriefRemainingNm !== null)
      ? Math.max(0, simbriefTotalNm - simbriefRemainingNm)
      : null;
    const simbriefProgressPct = (simbriefTotalNm && simbriefRemainingNm !== null && simbriefTotalNm > 0)
      ? Math.max(0, Math.min(100, (simbriefFlownNm / simbriefTotalNm) * 100))
      : null;
    const simbriefRouteCompact = validSimbriefWps.length ? routeCompact(validSimbriefWps) : null;
    const appOrigin = new URL(req.url).origin.replace(/\/$/, '');
    const liveMapUrl = flight.contract_id
      ? `${appOrigin}/FlightTracker?contractId=${encodeURIComponent(flight.contract_id)}`
      : `${appOrigin}/ActiveFlights`;

    // Respond IMMEDIATELY - no awaiting any DB operations
    return Response.json({ 
      flight_id: flight.id,
      contract_id: flight.contract_id || null,
      departure_airport: contract?.departure_airport || null,
      arrival_airport: contract?.arrival_airport || null,
      // Livemap source values (primary for plugin HUD)
      livemap_total_nm: simbriefTotalNm,
      livemap_remaining_nm: simbriefRemainingNm,
      livemap_flown_nm: simbriefFlownNm,
      livemap_progress_pct: simbriefProgressPct,
      // Keep legacy fields for compatibility
      distance_nm: simbriefRemainingNm ?? contract?.distance_nm ?? null,
      deadline_minutes: contract?.deadline_minutes || null,
      contract_payout: contract?.payout ?? null,
      contract_bonus_potential: contract?.bonus_potential ?? null,
      contract_total_potential: ((contract?.payout ?? 0) + (contract?.bonus_potential ?? 0)) || null,
      contract_payout_currency: "$",
      departure_lat,
      departure_lon,
      arrival_lat,
      arrival_lon,
      simbrief_total_nm: simbriefTotalNm,
      simbrief_remaining_nm: simbriefRemainingNm,
      simbrief_flown_nm: simbriefFlownNm,
      simbrief_progress_pct: simbriefProgressPct,
      simbrief_route_compact: simbriefRouteCompact,
      live_map_url: liveMapUrl,
      status: flightStatus,
      on_ground,
      park_brake,
      engines_running: areEnginesRunning,
      maintenance_ratio: maintenanceRatio,
      xplane_connection_status: 'connected'
    });

  } catch (error) {
    console.error('Error receiving X-Plane data:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
