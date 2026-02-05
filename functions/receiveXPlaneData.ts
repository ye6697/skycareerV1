import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get flight data from X-Plane plugin
    const data = await req.json();
    
    const {
      flight_id,
      altitude,
      speed,
      vertical_speed,
      heading,
      fuel_percentage,
      g_force,
      latitude,
      longitude,
      on_ground,
      parking_brake,
      engines_running
    } = data;

    if (!flight_id) {
      return Response.json({ error: 'flight_id required' }, { status: 400 });
    }

    // Get current flight
    const flights = await base44.asServiceRole.entities.Flight.filter({ id: flight_id });
    const flight = flights[0];

    if (!flight) {
      return Response.json({ error: 'Flight not found' }, { status: 404 });
    }

    // Update flight with current data
    const updateData = {
      xplane_data: {
        altitude,
        speed,
        vertical_speed,
        heading,
        fuel_percentage,
        g_force,
        latitude,
        longitude,
        on_ground,
        parking_brake,
        engines_running,
        timestamp: new Date().toISOString()
      }
    };

    // Track max G-force
    if (g_force > (flight.max_g_force || 0)) {
      updateData.max_g_force = g_force;
    }

    // Auto-complete flight if parked
    if (on_ground && parking_brake && !engines_running && flight.status === 'in_flight') {
      // Flight is complete - calculate landing vertical speed
      const landingVs = vertical_speed || flight.xplane_data?.vertical_speed || -200;
      
      // Calculate ratings
      const landingRating = Math.abs(landingVs) < 100 ? 5 :
                          Math.abs(landingVs) < 200 ? 4 :
                          Math.abs(landingVs) < 300 ? 3 :
                          Math.abs(landingVs) < 500 ? 2 : 1;

      const gForceRating = (flight.max_g_force || 1.0) < 1.3 ? 5 :
                          (flight.max_g_force || 1.0) < 1.5 ? 4 :
                          (flight.max_g_force || 1.0) < 1.8 ? 3 :
                          (flight.max_g_force || 1.0) < 2.0 ? 2 : 1;

      const takeoffRating = 3 + Math.random() * 2;
      const flightRating = gForceRating;
      const overallRating = (takeoffRating + flightRating + landingRating) / 3;

      // Generate comments
      const comments = [];
      if (landingRating >= 4) comments.push("Butterweiche Landung! Professionell!");
      else if (landingRating <= 2) comments.push("Die Landung war etwas ruppig...");
      
      if (gForceRating >= 4) comments.push("Sehr angenehmer, sanfter Flug.");
      else if (gForceRating <= 2) comments.push("Mir wurde bei den Turbulenzen übel.");

      if (overallRating >= 4) comments.push("Werde diese Airline weiterempfehlen!");
      else if (overallRating <= 2) comments.push("Ich buche nie wieder hier.");

      // Calculate financials
      const contract = (await base44.asServiceRole.entities.Contract.filter({ id: flight.contract_id }))[0];
      const aircraft = (await base44.asServiceRole.entities.Aircraft.filter({ id: flight.aircraft_id }))[0];
      
      const fuelUsed = (100 - fuel_percentage) * 10;
      const fuelCost = fuelUsed * 1.5;
      const crewCost = 500;
      const maintenanceCost = aircraft?.maintenance_cost_per_hour || 200;
      
      let revenue = contract?.payout || 0;
      if (overallRating >= 4.5 && contract?.bonus_potential) {
        revenue += contract.bonus_potential;
      } else if (overallRating >= 4) {
        revenue += (contract?.bonus_potential || 0) * 0.5;
      }

      const profit = revenue - fuelCost - crewCost - maintenanceCost;

      // Complete flight
      await base44.asServiceRole.entities.Flight.update(flight_id, {
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
        maintenance_cost: maintenanceCost,
        revenue,
        profit,
        passenger_comments: comments
      });

      // Update contract
      if (contract) {
        await base44.asServiceRole.entities.Contract.update(contract.id, { status: 'completed' });
      }

      // Update company
      const companies = await base44.asServiceRole.entities.Company.list();
      const company = companies[0];
      if (company) {
        await base44.asServiceRole.entities.Company.update(company.id, {
          balance: (company.balance || 0) + profit,
          reputation: Math.min(100, Math.max(0, (company.reputation || 50) + (overallRating - 3) * 2)),
          total_flights: (company.total_flights || 0) + 1,
          total_passengers: (company.total_passengers || 0) + (contract?.passenger_count || 0),
          total_cargo_kg: (company.total_cargo_kg || 0) + (contract?.cargo_weight_kg || 0)
        });
      }

      // Create transaction
      await base44.asServiceRole.entities.Transaction.create({
        type: 'income',
        category: 'flight_revenue',
        amount: profit,
        description: `Flug: ${contract?.title}`,
        reference_id: flight_id,
        date: new Date().toISOString()
      });

      // Release aircraft and crew
      if (flight.aircraft_id) {
        await base44.asServiceRole.entities.Aircraft.update(flight.aircraft_id, { 
          status: 'available',
          total_flight_hours: (aircraft?.total_flight_hours || 0) + ((Date.now() - new Date(flight.departure_time).getTime()) / 3600000)
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
        profit 
      });
    }

    // Just update flight data
    await base44.asServiceRole.entities.Flight.update(flight_id, updateData);

    return Response.json({ 
      status: 'updated',
      message: 'Flight data received',
      on_ground,
      parking_brake,
      engines_running
    });

  } catch (error) {
    console.error('Error receiving X-Plane data:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});