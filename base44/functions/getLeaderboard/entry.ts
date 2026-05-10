import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const aircraftTypeFilter = body.aircraft_type || null; // e.g. "narrow_body"
    const regionFilter = body.region || null; // e.g. "ED" (first 2 chars of ICAO hub)

    // Fetch all companies
    const companies = await base44.asServiceRole.entities.Company.filter({}, '-level', 200);
    if (!companies || companies.length === 0) {
      return Response.json({ leaderboard: [], my_rank: null });
    }

    // Filter by region (hub airport ICAO prefix)
    let filtered = companies;
    if (regionFilter && regionFilter !== 'all') {
      filtered = filtered.filter(c => c.hub_airport && c.hub_airport.toUpperCase().startsWith(regionFilter.toUpperCase()));
    }

    // Fetch all completed flights in one batch for scoring
    const allFlights = await base44.asServiceRole.entities.Flight.filter({ status: 'completed' }, '-created_date', 5000);

    // Group flights by company_id
    const flightsByCompany = {};
    for (const f of allFlights) {
      if (!f.company_id) continue;
      if (!flightsByCompany[f.company_id]) flightsByCompany[f.company_id] = [];
      flightsByCompany[f.company_id].push(f);
    }

    const allAircraft = await base44.asServiceRole.entities.Aircraft.filter({}, '-created_date', 5000);
    const aircraftTypeMap = {};
    const aircraftByCompany = {};
    for (const ac of allAircraft) {
      aircraftTypeMap[ac.id] = ac.type;
      if (!ac.company_id) continue;
      if (!aircraftByCompany[ac.company_id]) aircraftByCompany[ac.company_id] = [];
      aircraftByCompany[ac.company_id].push(ac);
    }

    const normalizeScore = (value) => {
      const n = Number(value || 0);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return n <= 5 ? n * 20 : n;
    };

    const getFlightDate = (flight) => {
      const raw = flight?.completed_at || flight?.arrival_time || flight?.updated_date || flight?.created_date;
      const date = raw ? new Date(raw) : null;
      return date && !Number.isNaN(date.getTime()) ? date : null;
    };

    // Build leaderboard entries
    const entries = [];
    for (const company of filtered) {
      let companyFlights = flightsByCompany[company.id] || [];
      
      // Filter by aircraft type if needed
      if (aircraftTypeFilter && aircraftTypeFilter !== 'all') {
        companyFlights = companyFlights.filter(f => {
          const acType = aircraftTypeMap[f.aircraft_id];
          return acType === aircraftTypeFilter;
        });
      }

      const totalFlights = companyFlights.length;
      if (totalFlights === 0 && (aircraftTypeFilter && aircraftTypeFilter !== 'all')) continue;

      const companyAircraft = aircraftByCompany[company.id] || [];
      const aircraftTypes = {};
      for (const ac of companyAircraft) {
        const type = ac.type || 'unknown';
        aircraftTypes[type] = (aircraftTypes[type] || 0) + 1;
      }
      const primaryAircraftType = Object.entries(aircraftTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const fleetValue = companyAircraft.reduce((sum, ac) => sum + Number(ac.current_value || ac.value || ac.purchase_price || ac.price || 0), 0);

      // Calculate averages
      const scores = companyFlights.map(f => normalizeScore(f.flight_score ?? f.overall_rating ?? 0)).filter(s => s > 0);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      const landingVs = companyFlights.map(f => Math.abs(f.landing_vs || 0)).filter(v => v > 0);
      const avgLandingVs = landingVs.length > 0 ? landingVs.reduce((a, b) => a + b, 0) / landingVs.length : 999;

      // Butter landings (< 100 fpm)
      const butterCount = landingVs.filter(v => v < 100).length;
      const butterPct = landingVs.length > 0 ? (butterCount / landingVs.length) * 100 : 0;
      const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
      const bestLandingVs = landingVs.length > 0 ? Math.min(...landingVs) : null;
      const lastFlightDate = companyFlights
        .map(getFlightDate)
        .filter(Boolean)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

      // Composite ranking score:
      // 40% avg flight score + 25% level contribution + 20% landing quality + 15% reputation
      const levelScore = Math.min(100, (company.level || 1) * 1.0); // max 100 at level 100
      const landingScore = Math.max(0, 100 - (avgLandingVs / 5)); // lower VS = better, 0 fpm = 100, 500 fpm = 0
      const repScore = company.reputation || 0;

      const compositeScore = (
        avgScore * 0.40 +
        levelScore * 0.25 +
        Math.max(0, landingScore) * 0.20 +
        repScore * 0.15
      );

      entries.push({
        company_id: company.id,
        name: company.name || 'Unknown',
        callsign: company.callsign || '',
        hub_airport: company.hub_airport || '',
        logo_url: company.logo_url || null,
        level: company.level || 1,
        reputation: company.reputation || 50,
        total_flights: company.total_flights || totalFlights,
        total_passengers: company.total_passengers || 0,
        total_cargo_kg: company.total_cargo_kg || 0,
        xp: company.experience_points || 0,
        fleet_size: companyAircraft.length,
        fleet_value: Math.round(fleetValue),
        aircraft_types: aircraftTypes,
        primary_aircraft_type: primaryAircraftType,
        maintenance_ratio: company.current_maintenance_ratio || 0,
        avg_score: Math.round(avgScore * 10) / 10,
        avg_landing_vs: Math.round(avgLandingVs),
        best_score: Math.round(bestScore * 10) / 10,
        best_landing_vs: bestLandingVs === null ? null : Math.round(bestLandingVs),
        butter_pct: Math.round(butterPct),
        composite_score: Math.round(compositeScore * 10) / 10,
        last_flight_date: lastFlightDate ? lastFlightDate.toISOString() : null,
        is_me: company.created_by === user.email,
      });
    }

    // Sort by composite score descending
    entries.sort((a, b) => b.composite_score - a.composite_score);

    // Add rank
    entries.forEach((e, i) => { e.rank = i + 1; });

    const myRank = entries.find(e => e.is_me)?.rank || null;

    return Response.json({
      leaderboard: entries.slice(0, 100),
      my_rank: myRank,
      total_airlines: entries.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
