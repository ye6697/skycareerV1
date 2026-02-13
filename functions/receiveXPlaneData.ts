import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
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
      // fast_position packets come at ~30Hz from the plugin but the frontend only polls
      // at 2Hz. Writing 30x/sec to the DB is wasteful. Instead, only write every ~200ms
      // by checking the timestamp on the existing flight data.
      
      // Update company connection status if needed
      if (company && company.xplane_connection_status !== 'connected') {
        await base44.asServiceRole.entities.Company.update(company.id, { 
          xplane_connection_status: 'connected' 
        });
      }
      
      // Get active flight to return status
      const flights = await base44.asServiceRole.entities.Flight.filter({ 
        company_id: company.id,
        status: 'in_flight'
      });
      const flight = flights[0] || null;
      
      if (!flight) {
        return Response.json({ 
          message: 'fast_position - no active flight',
          xplane_connection_status: 'connected'
        });
      }
      
      // Throttle DB writes: only update if last write was >200ms ago
      const existingXpData = flight.xplane_data || {};
      const lastTs = existingXpData.timestamp ? new Date(existingXpData.timestamp).getTime() : 0;
      const now = Date.now();
      if (now - lastTs < 200) {
        // Skip this write – too recent
        return Response.json({ 
          status: 'fast_throttled',
          xplane_connection_status: 'connected'
        });
      }
      
      const fastUpdate = {
        xplane_data: {
          ...existingXpData,
          latitude: data.latitude,
          longitude: data.longitude,
          heading: data.heading,
          altitude: data.altitude,
          speed: data.speed,
          timestamp: new Date().toISOString()
        }
      };
      await base44.asServiceRole.entities.Flight.update(flight.id, fastUpdate);
      
      return Response.json({ 
        status: 'fast_ok',
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

    // Update company connection status ONLY if needed (skip DB write if already connected)
    if (company && company.xplane_connection_status !== 'connected') {
      await base44.asServiceRole.entities.Company.update(company.id, { 
        xplane_connection_status: 'connected' 
      });
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

    // Write to DB and respond immediately
    await base44.asServiceRole.entities.Flight.update(flight.id, updateData);

    // Calculate maintenance_ratio from aircraft's maintenance categories
    let maintenanceRatio = 0;
    if (flight.aircraft_id) {
      try {
        const aircraftList = await base44.asServiceRole.entities.Aircraft.filter({ id: flight.aircraft_id });
        const ac = aircraftList[0];
        if (ac?.maintenance_categories) {
          const cats = Object.values(ac.maintenance_categories);
          if (cats.length > 0) {
            const avg = cats.reduce((a, b) => a + (b || 0), 0) / cats.length;
            maintenanceRatio = avg / 100; // 0.0 - 1.0
          }
        }
      } catch (e) { /* ignore */ }
    }

    return Response.json({ 
      status: on_ground && park_brake && !areEnginesRunning && hasBeenAirborne ? 'ready_to_complete' : 'updated',
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