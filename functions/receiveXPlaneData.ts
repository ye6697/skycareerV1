import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const data = await req.json();
    
    const {
      company_id,
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
      overstress,
      flaps_overspeed,
      fuel_emergency,
      gear_up_landing,
      crash,
      flight_score,
      maintenance_cost,
      reputation
    } = data;

    if (!company_id) {
      return Response.json({ error: 'company_id required' }, { status: 400 });
    }

    // Get active flight for this company
    const flights = await base44.asServiceRole.entities.Flight.filter({ 
      status: 'in_flight',
      company_id: company_id
    });
    const flight = flights[0];

    // Update company connection status
    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    const company = companies[0];

    if (!flight) {
      // No active flight - set status to disconnected
      if (company && company.xplane_connection_status !== 'disconnected') {
        await base44.asServiceRole.entities.Company.update(company.id, { 
          xplane_connection_status: 'disconnected' 
        });
      }
      return Response.json({ 
        error: 'No active flight found',
        xplane_connection_status: 'disconnected' 
      }, { status: 404 });
    }

    // Active flight found - set status to connected
    if (company && company.xplane_connection_status !== 'connected') {
      await base44.asServiceRole.entities.Company.update(company.id, { 
        xplane_connection_status: 'connected' 
      });
    }

    const engines_running = engine1_running || engine2_running;

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
        engines_running,
        touchdown_vspeed,
        landing_g_force,
        landing_quality,
        tailstrike,
        stall,
        overstress,
        flaps_overspeed,
        fuel_emergency,
        gear_up_landing,
        crash,
        flight_score,
        maintenance_cost,
        reputation,
        timestamp: new Date().toISOString()
      }
    };

    // Track max G-force
    if (max_g_force > (flight.max_g_force || 0)) {
      updateData.max_g_force = max_g_force;
    }

    // Auto-complete flight if parked with engines off
    if (on_ground && park_brake && !engines_running && flight.status === 'in_flight') {
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
      if (stall) comments.push("Der Strömungsabriss war beängstigend!");
      if (overstress) comments.push("Die G-Kräfte waren extrem unangenehm!");
      if (flaps_overspeed) comments.push("Die Klappen haben verdächtig geknarzt...");
      if (fuel_emergency) comments.push("Wir hatten kaum noch Treibstoff!");
      if (gear_up_landing) comments.push("NOTLANDUNG OHNE FAHRWERK! Nie wieder!");
      if (crash) comments.push("Das war ein CRASH! Wir hätten sterben können!");

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
      
      let revenue = contract?.payout || 0;
      
      // Bonus based on score
      if (flight_score >= 95 && contract?.bonus_potential) {
        revenue += contract.bonus_potential;
      } else if (flight_score >= 85 && contract?.bonus_potential) {
        revenue += contract.bonus_potential * 0.5;
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
        await base44.asServiceRole.entities.Contract.update(contract.id, { status: 'completed' });
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