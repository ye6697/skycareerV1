import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const airports = [
  { icao: "EDDF", city: "Frankfurt", lat: 50.0379, lon: 8.5622 },
  { icao: "EDDM", city: "München", lat: 48.3538, lon: 11.7861 },
  { icao: "EDDB", city: "Berlin", lat: 52.3667, lon: 13.5033 },
  { icao: "EDDH", city: "Hamburg", lat: 53.6304, lon: 9.9882 },
  { icao: "EDDK", city: "Köln", lat: 50.8659, lon: 7.1427 },
  { icao: "EDDL", city: "Düsseldorf", lat: 51.2895, lon: 6.7668 },
  { icao: "EDDW", city: "Bremen", lat: 53.0475, lon: 8.7867 },
  { icao: "EDDS", city: "Stuttgart", lat: 48.6899, lon: 9.2219 },
  { icao: "EDDN", city: "Nürnberg", lat: 49.4987, lon: 11.0669 },
  { icao: "EDDV", city: "Hannover", lat: 52.4611, lon: 9.6851 },
  { icao: "LOWW", city: "Wien", lat: 48.1103, lon: 16.5697 },
  { icao: "LSZH", city: "Zürich", lat: 47.4647, lon: 8.5492 },
  { icao: "EHAM", city: "Amsterdam", lat: 52.3086, lon: 4.7639 },
  { icao: "LFPG", city: "Paris", lat: 49.0097, lon: 2.5479 },
  { icao: "EGLL", city: "London", lat: 51.4700, lon: -0.4543 },
  { icao: "LIRF", city: "Rom", lat: 41.8003, lon: 12.2389 },
  { icao: "LEMD", city: "Madrid", lat: 40.4983, lon: -3.5676 },
  { icao: "LPPT", city: "Lissabon", lat: 38.7813, lon: -9.1359 },
  { icao: "EKCH", city: "Kopenhagen", lat: 55.6180, lon: 12.6560 },
  { icao: "ESSA", city: "Stockholm", lat: 59.6519, lon: 17.9186 }
];

const allAircraftTypes = [
  { type: "small_prop", passengers: 4, cargo: 200, range: 500 },
  { type: "turboprop", passengers: 19, cargo: 1500, range: 1000 },
  { type: "regional_jet", passengers: 50, cargo: 3000, range: 1500 },
  { type: "narrow_body", passengers: 150, cargo: 5000, range: 3000 },
  { type: "wide_body", passengers: 300, cargo: 10000, range: 6000 },
  { type: "cargo", passengers: 0, cargo: 20000, range: 4000 }
];

const contractTypes = ["passenger", "cargo", "charter", "emergency"];

const briefingTemplates = {
  passenger: [
    "Befördern Sie Urlauber zu ihrem Zielort.",
    "Geschäftsreisende benötigen einen zuverlässigen Transport.",
    "Eine Gruppe Touristen wartet auf ihren Flug.",
    "Familien reisen zum Wochenende ans Meer.",
    "Studenten kehren nach Hause zurück."
  ],
  cargo: [
    "Transportieren Sie dringende Fracht zum Zielflughafen.",
    "Medizinische Güter müssen schnell geliefert werden.",
    "Ersatzteile für die Automobilindustrie.",
    "Elektronikware für den Einzelhandel.",
    "Lebensmittel für Restaurants und Hotels."
  ],
  charter: [
    "Ein VIP-Gast benötigt einen privaten Flug.",
    "Sportmannschaft muss zum Auswärtsspiel.",
    "Hochzeitsgesellschaft reist zur Feier.",
    "Konzertband auf Tour.",
    "Diplomaten benötigen diskreten Transport."
  ],
  emergency: [
    "Medizinischer Notfalltransport erforderlich.",
    "Organtransport für lebensrettende OP.",
    "Evakuierung aufgrund von Naturkatastrophe.",
    "Rettungsteam muss zum Einsatzort.",
    "Blutkonserven für Krankenhaus."
  ]
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
};

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateContract(companyId, aircraftType, companyLevel) {
  const depAirport = randomItem(airports);
  let arrAirport = randomItem(airports);
  while (arrAirport.icao === depAirport.icao) {
    arrAirport = randomItem(airports);
  }

  const distance = calculateDistance(depAirport.lat, depAirport.lon, arrAirport.lat, arrAirport.lon);
  
  // Only generate if distance is within aircraft range
  if (distance > aircraftType.range) return null;

  const contractType = randomItem(contractTypes);
  
  const passengers = (contractType === "passenger" || contractType === "charter")
    ? Math.max(1, Math.floor(Math.random() * aircraftType.passengers * 0.8) + Math.floor(aircraftType.passengers * 0.2))
    : 0;
  
  const cargo = contractType === "cargo"
    ? Math.max(10, Math.floor(Math.random() * aircraftType.cargo * 0.8) + Math.floor(aircraftType.cargo * 0.2))
    : 0;

  // Exponential payout scaling based on aircraft tier
  // Tier multipliers: small_prop=1, turboprop=3, regional_jet=8, narrow_body=25, wide_body=80, cargo=40
  const tierMultiplier = {
    small_prop: 1,
    turboprop: 3,
    regional_jet: 8,
    narrow_body: 25,
    wide_body: 80,
    cargo: 40
  }[aircraftType.type] || 1;

  const basePayout = (distance * 8 + passengers * 120 + cargo * 1.5) * tierMultiplier;
  const payout = Math.round(basePayout * (0.85 + Math.random() * 0.3));

  const briefings = briefingTemplates[contractType];
  const briefing = randomItem(briefings);

  const difficulty = distance < 500 ? "easy" : distance < 1500 ? "medium" : distance < 3000 ? "hard" : "extreme";

  // Realistic cruise speeds per aircraft type (in knots)
  const cruiseSpeeds = {
    small_prop: 120,
    turboprop: 280,
    regional_jet: 420,
    narrow_body: 460,
    wide_body: 490,
    cargo: 450
  };
  const cruiseSpeed = cruiseSpeeds[aircraftType.type] || 250;
  // Flight time = distance/speed, plus 20min taxi/climb/descent overhead, plus 15min buffer
  const flightTimeMinutes = Math.round((distance / cruiseSpeed) * 60 + 20 + 15);

  return {
    company_id: companyId,
    title: `${depAirport.city} → ${arrAirport.city}`,
    briefing,
    type: contractType,
    departure_airport: depAirport.icao,
    departure_city: depAirport.city,
    arrival_airport: arrAirport.icao,
    arrival_city: arrAirport.city,
    distance_nm: distance,
    passenger_count: passengers,
    cargo_weight_kg: cargo,
    payout,
    bonus_potential: Math.round(payout * 0.3),
    required_aircraft_type: [aircraftType.type],
    required_crew: {
      captain: 1,
      first_officer: passengers > 50 ? 1 : 0,
      flight_attendant: passengers > 20 ? Math.ceil(passengers / 50) : 0,
      loadmaster: cargo > 5000 ? 1 : 0
    },
    status: "available",
    difficulty,
    level_requirement: 1,
    deadline_minutes: flightTimeMinutes
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse optional distance filter from request body
    let minNm = 0;
    let maxNm = Infinity;
    try {
      const body = await req.json();
      if (body.minNm && !isNaN(body.minNm)) minNm = Number(body.minNm);
      if (body.maxNm && !isNaN(body.maxNm)) maxNm = Number(body.maxNm);
    } catch (_) {}

    // Get user's company - prefer company_id from user, fallback to created_by
    let company = null;
    const companyId = user.company_id || user.data?.company_id;
    if (companyId) {
      const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
      company = companies[0] || null;
    }
    if (!company) {
      const companies = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
      company = companies[0] || null;
    }
    if (!company) {
      return Response.json({ error: 'Keine Firma gefunden' }, { status: 400 });
    }

    // Get user's aircraft
    const aircraft = await base44.asServiceRole.entities.Aircraft.filter({ company_id: company.id });
    const availableAircraft = aircraft.filter(a => a.status !== 'sold');

    if (availableAircraft.length === 0) {
      return Response.json({ error: 'Keine Flugzeuge vorhanden' }, { status: 400 });
    }

    // Delete old available contracts (all at once, parallel)
    const oldContracts = await base44.asServiceRole.entities.Contract.filter({ company_id: company.id, status: 'available' });
    await Promise.all(oldContracts.map(old => base44.asServiceRole.entities.Contract.delete(old.id)));

    // Get the types the user owns
    const ownedTypes = [...new Set(availableAircraft.map(a => a.type))];
    const ownedTypeSpecs = allAircraftTypes.filter(t => ownedTypes.includes(t.type));
    const notOwnedTypeSpecs = allAircraftTypes.filter(t => !ownedTypes.includes(t.type));

    const compatibleContracts = [];
    const incompatibleContracts = [];

    // Generate 4 compatible contracts (with optional distance filter)
    let attempts = 0;
    while (compatibleContracts.length < 4 && attempts < 80) {
      attempts++;
      const acType = randomItem(ownedTypeSpecs);
      const contract = generateContract(company.id, acType, company.level || 1);
      if (contract) {
        // Apply distance filter
        if (contract.distance_nm < minNm || contract.distance_nm > maxNm) continue;
        const canFulfill = availableAircraft.some(plane => {
          const typeMatch = contract.required_aircraft_type.includes(plane.type);
          const cargoMatch = !contract.cargo_weight_kg || (plane.cargo_capacity_kg && plane.cargo_capacity_kg >= contract.cargo_weight_kg);
          const rangeMatch = !contract.distance_nm || (plane.range_nm && plane.range_nm >= contract.distance_nm);
          const passengerMatch = !contract.passenger_count || (plane.passenger_capacity && plane.passenger_capacity >= contract.passenger_count);
          return typeMatch && cargoMatch && rangeMatch && passengerMatch;
        });
        if (canFulfill) compatibleContracts.push(contract);
      }
    }

    // Generate 3 incompatible contracts
    attempts = 0;
    while (incompatibleContracts.length < 3 && attempts < 50) {
      attempts++;
      if (notOwnedTypeSpecs.length > 0) {
        const acType = randomItem(notOwnedTypeSpecs);
        const contract = generateContract(company.id, acType, company.level || 1);
        if (contract) {
          if (contract.distance_nm < minNm || contract.distance_nm > maxNm) continue;
          incompatibleContracts.push(contract);
        }
      } else {
        const acType = randomItem(ownedTypeSpecs);
        const contract = generateContract(company.id, acType, company.level || 1);
        if (contract) {
          const maxRange = Math.max(...availableAircraft.map(a => a.range_nm || 0));
          const maxCargo = Math.max(...availableAircraft.map(a => a.cargo_capacity_kg || 0));
          const maxPax = Math.max(...availableAircraft.map(a => a.passenger_capacity || 0));
          const exceedType = Math.floor(Math.random() * 3);
          if (exceedType === 0) contract.distance_nm = maxRange + 500 + Math.floor(Math.random() * 1000);
          else if (exceedType === 1 && contract.cargo_weight_kg > 0) contract.cargo_weight_kg = maxCargo + 1000;
          else contract.passenger_count = maxPax + 50;
          contract.title = contract.title + " (Spezial)";
          incompatibleContracts.push(contract);
        }
      }
    }

    const allContracts = [...compatibleContracts, ...incompatibleContracts];
    if (allContracts.length > 0) {
      await base44.asServiceRole.entities.Contract.bulkCreate(allContracts);
    }

    return Response.json({
      success: true,
      created: allContracts.length,
      compatible: compatibleContracts.length,
      incompatible: incompatibleContracts.length,
      message: `${allContracts.length} Aufträge generiert (${compatibleContracts.length} kompatibel, ${incompatibleContracts.length} nicht kompatibel)`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});