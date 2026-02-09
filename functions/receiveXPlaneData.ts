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
    
    const {
      altitude,
      speed,
      vertical_speed,
      heading,
      fuel_percentage,
      fuel_kg,
      g_force,
      max_g_force,
      latitude,
      longitude,
      on_ground,
      touchdown_vspeed,
      landing_g_force,
      tailstrike,
      stall,
      is_in_stall,
      stall_warning,
      override_alpha,
      overstress,
      flaps_overspeed,
      fuel_emergency,
      gear_up_landing,
      crash,
      has_crashed,
      overspeed,
      gear_down,
      flap_ratio,
      pitch,
      ias,
      // Legacy fields from old plugins
      flight_score,
      maintenance_cost,
      reputation,
      landing_quality
    } = data;

    // Normalize field names (support both naming conventions)
    const park_brake = data.parking_brake || data.park_brake || false;
    const engine1_running = data.engine1_running || false;
    const engine2_running = data.engine2_running || false;
    const engines_running = data.engines_running || engine1_running || engine2_running;
    const isCrash = crash || has_crashed || false;

    // Log ALL received data (regardless of active flight)
    await base44.asServiceRole.entities.XPlaneLog.create({
      company_id: company.id,
      raw_data: data,
      altitude,
      speed,
      on_ground,
      flight_score,
      has_active_flight: false // will update below if flight exists
    });

    // Verify we have valid flight data before marking as connected
    if (altitude === undefined || speed === undefined) {
      return Response.json({ 
        error: 'Invalid data - no altitude or speed received',
        xplane_connection_status: 'disconnected' 
      }, { status: 400 });
    }

    // Update company connection status ONLY if we have valid data
    if (company && company.xplane_connection_status !== 'connected') {
      await base44.asServiceRole.entities.Company.update(company.id, { 
        xplane_connection_status: 'connected' 
      });
    }

    // Get active flight for this company
    const flights = await base44.asServiceRole.entities.Flight.filter({ 
      company_id: company.id,
      status: 'in_flight'
    });
    
    const flight = flights[0] || null;
    
    if (!flight) {
      // No active flight - but X-Plane is connected and sending data
      return Response.json({ 
        message: 'X-Plane connected - no active flight',
        xplane_connection_status: 'connected',
        data_logged: true
      }, { status: 200 });
    }

    // Track if aircraft was ever airborne during this flight
    // This prevents auto-completing a flight that never took off
    const wasAirborne = flight.xplane_data?.was_airborne || false;
    const isNowAirborne = !on_ground && altitude > 50;
    const hasBeenAirborne = wasAirborne || isNowAirborne;

    // Update log to mark that there was an active flight
    const logs = await base44.asServiceRole.entities.XPlaneLog.filter({ company_id: company.id });
    if (logs.length > 0) {
      await base44.asServiceRole.entities.XPlaneLog.update(logs[0].id, {
        has_active_flight: true
      });
    }

    const areEnginesRunning = engines_running || engine1_running || engine2_running;

    // Update flight with comprehensive X-Plane data
    const updateData = {
      xplane_data: {
        altitude,
        speed,
        vertical_speed,
        heading,
        fuel_percentage,
        fuel_kg: fuel_kg || 0,
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
        flap_ratio: flap_ratio !== undefined && flap_ratio !== null ? flap_ratio : 0,
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
        flight_score,
        maintenance_cost,
        reputation,
        was_airborne: hasBeenAirborne,
        timestamp: new Date().toISOString()
      }
    };

    // Track max G-force
    if (max_g_force > (flight.max_g_force || 0)) {
      updateData.max_g_force = max_g_force;
    }

    // Auto-complete flight if parked with engines off
    // CRITICAL: Only auto-complete if the aircraft was airborne at some point
    // NOTE: The frontend FlightTracker handles the full flight completion with proper score calculations.
    // This backend completion is a FALLBACK only. It should preserve the xplane_data events that
    // the FlightTracker has been accumulating on the Flight record.
    if (on_ground && park_brake && !areEnginesRunning && flight.status === 'in_flight' && hasBeenAirborne) {
      // Don't auto-complete here - let the frontend FlightTracker handle it
      // The frontend has the full accumulated events, scores, and maintenance costs
      // Just update the xplane_data so the frontend knows to trigger completion
      await base44.asServiceRole.entities.Flight.update(flight.id, {
        ...updateData,
        xplane_data: {
          ...updateData.xplane_data,
          // Preserve existing accumulated data from previous updates
          ...(flight.xplane_data || {}),
          // Override with latest raw values
          altitude,
          speed,
          vertical_speed,
          heading,
          fuel_percentage,
          g_force,
          latitude,
          longitude,
          on_ground: true,
          park_brake: true,
          engines_running: false,
          was_airborne: true,
          // Ensure crash/event data from current packet is merged
          crash: isCrash || (flight.xplane_data?.crash || false),
          has_crashed: isCrash || (flight.xplane_data?.has_crashed || false),
          tailstrike: tailstrike || (flight.xplane_data?.tailstrike || false),
          stall: (stall || is_in_stall || stall_warning || override_alpha) || (flight.xplane_data?.stall || false),
          overstress: overstress || (flight.xplane_data?.overstress || false),
          overspeed: (overspeed || false) || (flight.xplane_data?.overspeed || false),
          flaps_overspeed: flaps_overspeed || (flight.xplane_data?.flaps_overspeed || false),
          landing_g_force: landing_g_force || flight.xplane_data?.landing_g_force,
          timestamp: new Date().toISOString()
        }
      });

      return Response.json({ 
        status: 'ready_to_complete',
        message: 'Aircraft parked - waiting for frontend to complete flight',
        xplane_connection_status: 'connected'
      });
    }

    // Regular update - not completed yet
    await base44.asServiceRole.entities.Flight.update(flight.id, updateData);

    return Response.json({ 
      status: 'updated',
      message: 'Flight data received',
      on_ground,
      park_brake,
      engines_running,
      flight_score,
      xplane_connection_status: 'connected'
    });

  } catch (error) {
    console.error('Error receiving X-Plane data:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});