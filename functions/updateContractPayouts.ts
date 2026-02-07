import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const contracts = await base44.asServiceRole.entities.Contract.list();
    
    // Aircraft type multiplier
    const aircraftMultiplier = {
      small_prop: 1.0,
      turboprop: 1.3,
      regional_jet: 1.6,
      narrow_body: 2.0,
      wide_body: 2.8,
      cargo: 2.5
    };

    // Distance multiplier
    const getDistanceMultiplier = (nm) => {
      if (!nm) return 1.0;
      if (nm <= 300) return 0.8;
      if (nm <= 600) return 1.0;
      if (nm <= 1200) return 1.3;
      if (nm <= 2000) return 1.6;
      return 2.0;
    };

    // Base payout calculation
    const getBasePayout = (contract) => {
      let base = 5000;
      if (contract.type === 'passenger' && contract.passenger_count) {
        base = 3000 + (contract.passenger_count * 50);
      } else if (contract.type === 'cargo' && contract.cargo_weight_kg) {
        base = 3000 + (contract.cargo_weight_kg * 0.5);
      }
      return base;
    };

    // Update all contracts
    for (const contract of contracts) {
      const basePayout = getBasePayout(contract);
      const aircraftType = contract.required_aircraft_type?.[0] || 'small_prop';
      const aircraftMult = aircraftMultiplier[aircraftType] || 1.0;
      const distanceMult = getDistanceMultiplier(contract.distance_nm);
      
      const newPayout = Math.round(basePayout * aircraftMult * distanceMult);
      
      await base44.asServiceRole.entities.Contract.update(contract.id, {
        payout: newPayout
      });
    }

    return Response.json({ updated: contracts.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});