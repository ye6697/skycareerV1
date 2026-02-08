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
      g_force,
      max_g_force,
      latitude,
      longitude,
      on_ground,
      park_brake,
      engine1_running,
      engine2_running,
      touchdown_vspeed,
      landing_g_force,
      landing_quality,
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
      flight_score,
      maintenance_cost,
      reputation,
      parking_brake,
      engines_running
    } = data;

    // Normalize field names (plugin sends parking_brake/engines_running, also support park_brake/engine1_running)
    const park_brake = parking_brake || data.park_brake || false;
    const engine1_running = data.engine1_running || false;
    const engine2_running = data.engine2_running || false;
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
        tailstrike,
        stall: stall || is_in_stall || stall_warning || override_alpha,
        is_in_stall,
        stall_warning,
        override_alpha,
        overstress,
        flaps_overspeed,
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
    if (on_ground && park_brake && !areEnginesRunning && flight.status === 'in_flight' && hasBeenAirborne) {
      const contract = (await base44.asServiceRole.entities.Contract.filter({ id: flight.contract_id }))[0];
      const aircraft = (await base44.asServiceRole.entities.Aircraft.filter({ id: flight.aircraft_id }))[0];
      
      // Use Lua-calculated values
      const landingVs = touchdown_vspeed || vertical_speed || -200;
      
      // Convert Lua flight_score (0-100) to ratings (1-5)
      const scoreToRating = (score) => {
        if (score >= 95) return 5;
        if (score >= 85) return 4;
        if (score >= 70) return 3;
        if (score >= 50) return 2;
        return 1;
      };

      const overallRating = scoreToRating(flight_score);
      const landingRating = landing_quality === "SOFT" ? 5 : landing_quality === "MEDIUM" ? 3 : 1;
      const flightRating = overallRating;
      const takeoffRating = overallRating;

      // Generate passenger comments based on events and score
      const comments = [];
      
      if (landing_quality === "SOFT") {
        comments.push("Butterweiche Landung! Professionell!");
      } else if (landing_quality === "HARD") {
        comments.push("Die Landung war sehr ruppig...");
      }

      if (tailstrike) comments.push("Ich habe gehört, wie das Heck aufgesetzt hat!");
      if (stall || is_in_stall || stall_warning || override_alpha) comments.push("Der Strömungsabriss war beängstigend!");
      if (overstress) comments.push("Die G-Kräfte waren extrem unangenehm!");
      if (flaps_overspeed) comments.push("Die Klappen haben verdächtig geknarzt...");
      if (fuel_emergency) comments.push("Wir hatten kaum noch Treibstoff!");
      if (gear_up_landing) comments.push("NOTLANDUNG OHNE FAHRWERK! Nie wieder!");
      if (isCrash) comments.push("Das war ein CRASH! Wir hätten sterben können!");

      if (flight_score >= 95) {
        comments.push("Perfekter Flug! Werde diese Airline weiterempfehlen!");
      } else if (flight_score >= 85) {
        comments.push("Sehr guter Flug, professionelle Crew.");
      } else if (flight_score < 50) {
        comments.push("Nie wieder mit dieser Airline!");
      }

      // Calculate costs
      const fuelUsed = (100 - fuel_percentage) * 10;
      const fuelCost = fuelUsed * 1.5;
      const crewCost = 500;
      const baseMaintenance = aircraft?.maintenance_cost_per_hour || 200;
      const totalMaintenanceCost = baseMaintenance + (maintenance_cost || 0);
      
      // Bei Crash: KEIN Payout und KEIN Bonus
      let revenue = 0;
      if (!crash) {
        revenue = contract?.payout || 0;
        
        // Bonus based on score
        if (flight_score >= 95 && contract?.bonus_potential) {
          revenue += contract.bonus_potential;
        } else if (flight_score >= 85 && contract?.bonus_potential) {
          revenue += contract.bonus_potential * 0.5;
        }
      }

      const profit = revenue - fuelCost - crewCost - totalMaintenanceCost;

      // Calculate reputation change based on flight_score
      let reputationChange = 0;
      if (flight_score >= 95) reputationChange = 5;
      else if (flight_score >= 85) reputationChange = 3;
      else if (flight_score >= 70) reputationChange = 1;
      else if (flight_score >= 50) reputationChange = -2;
      else reputationChange = -5;

      await base44.asServiceRole.entities.Flight.update(flight.id, {
        ...updateData,
        status: 'completed',
        arrival_time: new Date().toISOString(),
        takeoff_rating: takeoffRating,
        flight_rating: flightRating,
        landing_rating: landingRating,
        overall_rating: overallRating,
        landing_vs: landingVs,
        fuel_used_liters: fuelUsed,
        fuel_cost: fuelCost,
        crew_cost: crewCost,
        maintenance_cost: totalMaintenanceCost,
        revenue,
        profit,
        passenger_comments: comments
      });

      if (contract) {
        await base44.asServiceRole.entities.Contract.update(contract.id, { status: crash ? 'failed' : 'completed' });
      }

      if (company) {
        await base44.asServiceRole.entities.Company.update(company.id, {
          balance: (company.balance || 0) + profit,
          reputation: Math.min(100, Math.max(0, (company.reputation || 50) + reputationChange)),
          total_flights: (company.total_flights || 0) + 1,
          total_passengers: (company.total_passengers || 0) + (contract?.passenger_count || 0),
          total_cargo_kg: (company.total_cargo_kg || 0) + (contract?.cargo_weight_kg || 0)
        });
      }

      await base44.asServiceRole.entities.Transaction.create({
        company_id: company.id,
        type: profit >= 0 ? 'income' : 'expense',
        category: 'flight_revenue',
        amount: Math.abs(profit),
        description: `Flug: ${contract?.title} (Score: ${flight_score})`,
        reference_id: flight.id,
        date: new Date().toISOString()
      });

      if (flight.aircraft_id) {
        const flightDurationHours = (Date.now() - new Date(flight.departure_time).getTime()) / 3600000;
        await base44.asServiceRole.entities.Aircraft.update(flight.aircraft_id, { 
          status: 'available',
          total_flight_hours: (aircraft?.total_flight_hours || 0) + flightDurationHours
        });
      }
      
      if (flight.crew) {
        for (const member of flight.crew) {
          await base44.asServiceRole.entities.Employee.update(member.employee_id, { status: 'available' });
        }
      }

      return Response.json({ 
        status: 'completed',
        message: 'Flight automatically completed',
        rating: overallRating,
        flight_score,
        profit,
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