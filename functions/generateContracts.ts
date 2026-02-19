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
  { icao: "ESSA", city: "Stockholm", lat: 59.6519, lon: 17.9186 },
  { icao: "KLAX", city: "Los Angeles", lat: 33.9416, lon: -118.4085 },
{ icao: "KJFK", city: "New York", lat: 40.6413, lon: -73.7781 },
{ icao: "KDFW", city: "Dallas", lat: 32.8998, lon: -97.0403 },
{ icao: "KDEN", city: "Denver", lat: 39.8561, lon: -104.6737 },
{ icao: "KSFO", city: "San Francisco", lat: 37.6213, lon: -122.3790 },
{ icao: "KSEA", city: "Seattle", lat: 47.4502, lon: -122.3088 },
{ icao: "KMIA", city: "Miami", lat: 25.7959, lon: -80.2870 },
{ icao: "KBOS", city: "Boston", lat: 42.3656, lon: -71.0096 },
{ icao: "CYYZ", city: "Toronto", lat: 43.6777, lon: -79.6248 },
{ icao: "CYVR", city: "Vancouver", lat: 49.1951, lon: -123.1779 },
{ icao: "CYUL", city: "Montreal", lat: 45.4706, lon: -73.7408 },
{ icao: "MMMX", city: "Mexico City", lat: 19.4361, lon: -99.0719 },
{ icao: "MMUN", city: "Cancun", lat: 21.0365, lon: -86.8771 },
{ icao: "SBGR", city: "São Paulo", lat: -23.4356, lon: -46.4731 },
{ icao: "SBGL", city: "Rio de Janeiro", lat: -22.8099, lon: -43.2506 },
{ icao: "SAEZ", city: "Buenos Aires", lat: -34.8222, lon: -58.5358 },
{ icao: "SCEL", city: "Santiago", lat: -33.3930, lon: -70.7858 },
{ icao: "SKBO", city: "Bogota", lat: 4.7016, lon: -74.1469 },
{ icao: "EGKK", city: "London Gatwick", lat: 51.1537, lon: -0.1821 },
{ icao: "EIDW", city: "Dublin", lat: 53.4213, lon: -6.2701 },
{ icao: "LEBL", city: "Barcelona", lat: 41.2974, lon: 2.0833 },
{ icao: "LEPA", city: "Palma de Mallorca", lat: 39.5517, lon: 2.7388 },
{ icao: "GCTS", city: "Tenerife", lat: 28.0445, lon: -16.5725 },
{ icao: "LFMN", city: "Nice", lat: 43.6653, lon: 7.2150 },
{ icao: "LFML", city: "Marseille", lat: 43.4393, lon: 5.2214 },
{ icao: "LIPZ", city: "Venice", lat: 45.5053, lon: 12.3519 },
{ icao: "LIMC", city: "Milan", lat: 45.6301, lon: 8.7281 },
{ icao: "LGAV", city: "Athens", lat: 37.9364, lon: 23.9475 },
{ icao: "EPWA", city: "Warsaw", lat: 52.1657, lon: 20.9671 },
{ icao: "LKPR", city: "Prague", lat: 50.1008, lon: 14.2600 },
{ icao: "LHBP", city: "Budapest", lat: 47.4399, lon: 19.2619 },
{ icao: "LROP", city: "Bucharest", lat: 44.5711, lon: 26.0850 },
{ icao: "LBSF", city: "Sofia", lat: 42.6967, lon: 23.4114 },
{ icao: "LYBE", city: "Belgrade", lat: 44.8184, lon: 20.3091 },
{ icao: "LDZA", city: "Zagreb", lat: 45.7429, lon: 16.0688 },
{ icao: "LJLJ", city: "Ljubljana", lat: 46.2237, lon: 14.4576 },
{ icao: "EETN", city: "Tallinn", lat: 59.4133, lon: 24.8328 },
{ icao: "EVRA", city: "Riga", lat: 56.9236, lon: 23.9711 },
{ icao: "LTBA", city: "Istanbul", lat: 40.9769, lon: 28.8146 },
{ icao: "LTAI", city: "Antalya", lat: 36.8987, lon: 30.8005 },
{ icao: "OTHH", city: "Doha", lat: 25.2731, lon: 51.6081 },
{ icao: "OMDB", city: "Dubai", lat: 25.2532, lon: 55.3657 },
{ icao: "OMAA", city: "Abu Dhabi", lat: 24.4330, lon: 54.6511 },
{ icao: "OERK", city: "Riyadh", lat: 24.9576, lon: 46.6988 },
{ icao: "OEJN", city: "Jeddah", lat: 21.6796, lon: 39.1565 },
{ icao: "HECA", city: "Cairo", lat: 30.1219, lon: 31.4056 },
{ icao: "FACT", city: "Cape Town", lat: -33.9696, lon: 18.5972 },
{ icao: "FAOR", city: "Johannesburg", lat: -26.1337, lon: 28.2420 },
{ icao: "VIDP", city: "New Delhi", lat: 28.5562, lon: 77.1000 },
{ icao: "VABB", city: "Mumbai", lat: 19.0896, lon: 72.8656 },
{ icao: "VOBL", city: "Bangalore", lat: 13.1986, lon: 77.7066 },
{ icao: "VTBS", city: "Bangkok", lat: 13.6900, lon: 100.7501 },
{ icao: "WMKK", city: "Kuala Lumpur", lat: 2.7456, lon: 101.7072 },
{ icao: "WIII", city: "Jakarta", lat: -6.1256, lon: 106.6559 },
{ icao: "RPLL", city: "Manila", lat: 14.5086, lon: 121.0198 },
{ icao: "VVTS", city: "Ho Chi Minh City", lat: 10.8188, lon: 106.6519 },
{ icao: "VHHH", city: "Hong Kong", lat: 22.3080, lon: 113.9185 },
{ icao: "VMMC", city: "Macau", lat: 22.1496, lon: 113.5925 },
{ icao: "ZBAA", city: "Beijing", lat: 40.0799, lon: 116.6031 },
{ icao: "ZSPD", city: "Shanghai", lat: 31.1443, lon: 121.8083 },
{ icao: "ZGGG", city: "Guangzhou", lat: 23.3924, lon: 113.2988 },
{ icao: "ZUUU", city: "Chengdu", lat: 30.5785, lon: 103.9471 },
{ icao: "RJTT", city: "Tokyo", lat: 35.5494, lon: 139.7798 },
{ icao: "RJAA", city: "Tokyo Narita", lat: 35.7720, lon: 140.3929 },
{ icao: "RKSI", city: "Seoul", lat: 37.4602, lon: 126.4407 },
{ icao: "ZKPY", city: "Pyongyang", lat: 39.2241, lon: 125.6690 },
{ icao: "RCTP", city: "Taipei", lat: 25.0797, lon: 121.2328 },
{ icao: "RPLL", city: "Clark", lat: 15.1860, lon: 120.5603 },
{ icao: "WSSS", city: "Singapore", lat: 1.3644, lon: 103.9915 },
{ icao: "YSSY", city: "Sydney", lat: -33.9399, lon: 151.1753 },
{ icao: "YMML", city: "Melbourne", lat: -37.6733, lon: 144.8433 },
{ icao: "YBBN", city: "Brisbane", lat: -27.3842, lon: 153.1175 },
{ icao: "YPPH", city: "Perth", lat: -31.9403, lon: 115.9672 },
{ icao: "NZAA", city: "Auckland", lat: -37.0082, lon: 174.7850 },
{ icao: "NZWN", city: "Wellington", lat: -41.3272, lon: 174.8053 },
{ icao: "UUEE", city: "Moscow", lat: 55.9726, lon: 37.4146 },
{ icao: "UUWW", city: "Moscow Vnukovo", lat: 55.5915, lon: 37.2615 },
{ icao: "ULLI", city: "St Petersburg", lat: 59.8003, lon: 30.2625 },
{ icao: "UKBB", city: "Kyiv", lat: 50.3450, lon: 30.8947 },
{ icao: "UBBB", city: "Baku", lat: 40.4675, lon: 50.0467 },
{ icao: "UAAA", city: "Almaty", lat: 43.3521, lon: 77.0405 },
{ icao: "PHNL", city: "Honolulu", lat: 21.3187, lon: -157.9225 },
{ icao: "PANC", city: "Anchorage", lat: 61.1743, lon: -149.9983 },
{ icao: "BIKF", city: "Reykjavik", lat: 63.9850, lon: -22.6056 },
{ icao: "GMMN", city: "Casablanca", lat: 33.3675, lon: -7.5899 },
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