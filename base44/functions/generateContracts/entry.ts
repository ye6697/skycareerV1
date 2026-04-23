import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const resolveUserCompanyId = (user: any): string | null => (
  user?.company_id
  || user?.data?.company_id
  || user?.company?.id
  || user?.data?.company?.id
  || null
);

async function resolveCompany(base44: any, user: any) {
  const companyId = resolveUserCompanyId(user);
  if (companyId) {
    const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
    if (companies?.[0]) return companies[0];
  }

  const email = String(user?.email || '').trim();
  if (!email) return null;
  const candidateEmails = Array.from(new Set([email, email.toLowerCase()]));
  for (const candidate of candidateEmails) {
    const companies = await base44.asServiceRole.entities.Company.filter({ created_by: candidate });
    if (companies?.[0]) return companies[0];
  }
  return null;
}

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
{ icao: "EDLW", city: "Dortmund", lat: 51.5183, lon: 7.6122 },
{ icao: "LPMA", city: "Madeira", lat: 32.6979, lon: -16.7745 },
{ icao: "LOWI", city: "Innsbruck", lat: 47.2602, lon: 11.3439 },
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
const HANGAR_SIZE_RULES: Record<string, { slots: number; allowed_types: string[] }> = {
  small: { slots: 2, allowed_types: ['small_prop', 'turboprop'] },
  medium: { slots: 4, allowed_types: ['small_prop', 'turboprop', 'regional_jet'] },
  large: { slots: 6, allowed_types: ['small_prop', 'turboprop', 'regional_jet', 'narrow_body', 'cargo'] },
  mega: { slots: 10, allowed_types: ['small_prop', 'turboprop', 'regional_jet', 'narrow_body', 'wide_body', 'cargo'] }
};

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

function normalizeIcao(value: unknown) {
  return String(value || '').toUpperCase().trim();
}

function getHangarAirportIcao(rawHangar: any): string {
  return normalizeIcao(
    rawHangar?.airport_icao
    || rawHangar?.hangar_airport
    || rawHangar?.airport
    || rawHangar?.icao
    || rawHangar?.airportIcao
  );
}

function routeKeyFromIcao(depIcao, arrIcao) {
  if (!depIcao || !arrIcao) return null;
  return `${String(depIcao).toUpperCase()}->${String(arrIcao).toUpperCase()}`;
}

function getLegacyHangarId(airportIcao, ordinal = 1) {
  const airport = String(airportIcao || '').toUpperCase() || 'UNKNOWN';
  if (ordinal > 1) return `legacy_hangar_${airport}_${ordinal}`;
  return `legacy_hangar_${airport}`;
}

function normalizeCompanyHangars(rawHangars = []) {
  const perAirportCounts = new Map();
  return rawHangars.map((rawHangar, index) => {
    const airport = getHangarAirportIcao(rawHangar);
    const rawId = String(rawHangar?.id || rawHangar?.hangar_id || rawHangar?._id || '').trim();
    const airportKey = airport || `UNKNOWN_${index + 1}`;
    const nextCount = (perAirportCounts.get(airportKey) || 0) + 1;
    perAirportCounts.set(airportKey, nextCount);
    return {
      ...(rawHangar || {}),
      id: rawId || getLegacyHangarId(airport || `UNKNOWN_${index + 1}`, nextCount),
      airport_icao: airport,
    };
  });
}

function hangarsNeedMigration(rawHangars = [], normalizedHangars = []) {
  if (rawHangars.length !== normalizedHangars.length) return true;
  for (let i = 0; i < normalizedHangars.length; i += 1) {
    const raw = rawHangars[i] || {};
    const normalized = normalizedHangars[i] || {};
    const rawId = String(raw?.id || raw?.hangar_id || raw?._id || '').trim();
    const normalizedId = String(normalized?.id || '').trim();
    const rawAirport = getHangarAirportIcao(raw);
    const normalizedAirport = String(normalized?.airport_icao || '').toUpperCase();
    if (rawId !== normalizedId || rawAirport !== normalizedAirport) return true;
  }
  return false;
}

function buildHangarLookup(hangars = []) {
  const byId = new Map();
  const byAirport = new Map();
  for (const hangar of hangars) {
    const id = String(hangar?.id || '').trim();
    const airport = String(hangar?.airport_icao || '').toUpperCase();
    if (id) byId.set(id, hangar);
    if (airport) {
      const list = byAirport.get(airport) || [];
      list.push(hangar);
      byAirport.set(airport, list);
    }
  }
  return { byId, byAirport };
}

function resolveAircraftHangarId(plane, hangarLookup, normalizedHangars = []) {
  const directId = String(plane?.hangar_id || '').trim();
  if (directId && hangarLookup.byId.has(directId)) return directId;

  const airport = String(plane?.hangar_airport || '').toUpperCase();
  const airportHangars = hangarLookup.byAirport.get(airport) || [];
  if (airportHangars.length > 0) {
    return String(airportHangars[0]?.id || '').trim();
  }

  if (!directId && normalizedHangars.length > 0) {
    return String(normalizedHangars[0]?.id || '').trim();
  }

  return '';
}

function pickDepartureAirport(departureUsage, departurePool = airports) {
  if (!departurePool || departurePool.length === 0) return randomItem(airports);
  if (!departureUsage || departureUsage.size === 0) return randomItem(departurePool);
  const shuffled = [...departurePool].sort(() => Math.random() - 0.5);
  shuffled.sort((a, b) => (departureUsage.get(a.icao) || 0) - (departureUsage.get(b.icao) || 0));
  const candidatePool = shuffled.slice(0, Math.max(12, Math.floor(shuffled.length * 0.2)));
  return randomItem(candidatePool);
}

function pickRouteForContract(aircraftRange, options = {}) {
  const blockedPairs = options.blockedPairs || new Set();
  const departureUsage = options.departureUsage || new Map();
  const maxDepartureReuse = options.maxDepartureReuse || 2;

  const phases = [
    { respectDepartureLimit: true, respectPairBlacklist: true, attempts: 240 },
    { respectDepartureLimit: false, respectPairBlacklist: true, attempts: 160 },
    { respectDepartureLimit: false, respectPairBlacklist: false, attempts: 120 }
  ];

  for (const phase of phases) {
    for (let i = 0; i < phase.attempts; i++) {
      const depAirport = pickDepartureAirport(departureUsage, options.departurePool || airports);
      const depCount = departureUsage.get(depAirport.icao) || 0;
      if (phase.respectDepartureLimit && depCount >= maxDepartureReuse) continue;

      const arrAirport = randomItem(airports);
      if (arrAirport.icao === depAirport.icao) continue;

      const distance = calculateDistance(depAirport.lat, depAirport.lon, arrAirport.lat, arrAirport.lon);
      if (distance > aircraftRange) continue;

      const pairKey = routeKeyFromIcao(depAirport.icao, arrAirport.icao);
      if (phase.respectPairBlacklist && pairKey && blockedPairs.has(pairKey)) continue;

      return { depAirport, arrAirport, distance, pairKey };
    }
  }

  return null;
}

function rememberRoute(contract, blockedPairs, departureUsage) {
  const key = routeKeyFromIcao(contract?.departure_airport, contract?.arrival_airport);
  if (key) blockedPairs.add(key);
  if (contract?.departure_airport) {
    const current = departureUsage.get(contract.departure_airport) || 0;
    departureUsage.set(contract.departure_airport, current + 1);
  }
}

function generateContract(companyId, aircraftType, companyLevel, options = {}) {
  const route = pickRouteForContract(aircraftType.range, options);
  if (!route) return null;
  const { depAirport, arrAirport, distance } = route;

  const contractType = options.forceContractType || randomItem(contractTypes);
  
  const passengers = (contractType === "passenger" || contractType === "charter")
    ? Math.max(1, Math.floor(Math.random() * aircraftType.passengers * 0.8) + Math.floor(aircraftType.passengers * 0.2))
    : 0;
  
  const cargo = contractType === "cargo"
    ? Math.max(10, Math.floor(Math.random() * aircraftType.cargo * 0.8) + Math.floor(aircraftType.cargo * 0.2))
    : 0;

  // Exponential payout scaling based on aircraft tier
  // Tier multipliers: small_prop=1, turboprop=3, regional_jet=8, narrow_body=25, wide_body=80, cargo=40
  const tierMultiplier = {
    small_prop: 4,
    turboprop: 8,
    regional_jet: 20,
    narrow_body: 65,
    wide_body: 100,
    cargo: 120
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
    hangar_airport: depAirport.icao,
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

    // Parse optional filters from request body
    let minNm = 0;
    let maxNm = Infinity;
    let filterContractType = null; // e.g. "passenger", "cargo", "charter"
    let filterAircraftId = null;   // specific aircraft ID to generate for
    try {
      const body = await req.json();
      if (body.minNm && !isNaN(body.minNm)) minNm = Number(body.minNm);
      if (body.maxNm && !isNaN(body.maxNm)) maxNm = Number(body.maxNm);
      if (body.contractType && typeof body.contractType === 'string') {
        const validTypes = ["passenger", "cargo", "charter", "emergency"];
        if (validTypes.includes(body.contractType)) filterContractType = body.contractType;
      }
      if (body.aircraftId && typeof body.aircraftId === 'string') filterAircraftId = body.aircraftId;
    } catch (_) {}

    let company = await resolveCompany(base44, user);
    if (!company) {
      return Response.json({ error: 'Keine Firma gefunden' }, { status: 400 });
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const airportByIcao = new Map(airports.map((airport) => [airport.icao, airport]));
    const rawCompanyHangars = Array.isArray(company.hangars) ? company.hangars : [];
    const normalizedHangars = normalizeCompanyHangars(rawCompanyHangars);
    if (hangarsNeedMigration(rawCompanyHangars, normalizedHangars)) {
      await base44.asServiceRole.entities.Company.update(company.id, { hangars: normalizedHangars });
      company = { ...company, hangars: normalizedHangars };
    }
    const validHangars = normalizedHangars.filter((hangar) => airportByIcao.has(normalizeIcao(hangar?.airport_icao)));
    const hangarLookup = buildHangarLookup(normalizedHangars);
    const hangarAirports = validHangars
      .map((hangar) => normalizeIcao(hangar?.airport_icao))
      .filter(Boolean);

    // Get user's aircraft
    const aircraft = await base44.asServiceRole.entities.Aircraft.filter({ company_id: company.id });
    const availableAircraft = aircraft.filter(a => a.status !== 'sold');
    const availableAircraftById = new Map(availableAircraft.map((plane) => [plane.id, plane]));
    const normalizedAvailableAircraft = availableAircraft.map((plane) => {
      const resolvedHangarId = resolveAircraftHangarId(plane, hangarLookup, normalizedHangars);
      if (!resolvedHangarId) return plane;
      const resolvedHangar = hangarLookup.byId.get(resolvedHangarId);
      const resolvedAirport = String(resolvedHangar?.airport_icao || plane?.hangar_airport || '').toUpperCase();
      return {
        ...plane,
        hangar_id: resolvedHangarId,
        hangar_airport: resolvedAirport,
      };
    });

    const aircraftHangarFixes = [];
    for (const plane of normalizedAvailableAircraft) {
      const original = availableAircraftById.get(plane.id);
      if (!original) continue;
      const nextHangarId = String(plane?.hangar_id || '').trim();
      if (!nextHangarId) continue;
      const prevHangarId = String(original?.hangar_id || '').trim();
      const nextAirport = String(plane?.hangar_airport || '').toUpperCase();
      const prevAirport = String(original?.hangar_airport || '').toUpperCase();
      if (nextHangarId === prevHangarId && nextAirport === prevAirport) continue;
      aircraftHangarFixes.push({
        id: plane.id,
        hangar_id: nextHangarId,
        hangar_airport: nextAirport,
      });
    }

    if (aircraftHangarFixes.length > 0) {
      await Promise.all(
        aircraftHangarFixes.map((fix) => {
          const updatePayload = { hangar_id: fix.hangar_id };
          if (fix.hangar_airport) updatePayload.hangar_airport = fix.hangar_airport;
          return base44.asServiceRole.entities.Aircraft.update(fix.id, updatePayload);
        })
      );
    }

    if (normalizedAvailableAircraft.length === 0) {
      return Response.json({ error: 'Keine Flugzeuge vorhanden' }, { status: 400 });
    }

    let filteredAircraft = normalizedAvailableAircraft;
    if (filterAircraftId) {
      const selectedAc = normalizedAvailableAircraft.find(a => a.id === filterAircraftId);
      if (selectedAc) filteredAircraft = [selectedAc];
    }

    const existingContracts = await base44.asServiceRole.entities.Contract.filter({ company_id: company.id });
    const todaysAlreadyGenerated = company.last_contract_generation_date === todayIso;
    const hasFulfillableAvailableContract = existingContracts.some((contract) => {
      if (contract?.status !== 'available') return false;
      const departureAirport = String(contract?.departure_airport || '').toUpperCase();
      if (!departureAirport) return false;
      return filteredAircraft.some((plane) => {
        const aircraftAirport = String(plane?.hangar_airport || '').toUpperCase();
        if (!aircraftAirport || aircraftAirport !== departureAirport) return false;
        const requiredTypes = Array.isArray(contract?.required_aircraft_type) ? contract.required_aircraft_type : [];
        const typeMatch = requiredTypes.length === 0 || requiredTypes.includes(plane.type);
        const cargoMatch = !contract?.cargo_weight_kg || Number(plane?.cargo_capacity_kg || 0) >= Number(contract?.cargo_weight_kg || 0);
        const rangeMatch = !contract?.distance_nm || Number(plane?.range_nm || 0) >= Number(contract?.distance_nm || 0);
        const passengerMatch = !contract?.passenger_count || Number(plane?.passenger_capacity || 0) >= Number(contract?.passenger_count || 0);
        return typeMatch && cargoMatch && rangeMatch && passengerMatch;
      });
    });
    if (todaysAlreadyGenerated && hasFulfillableAvailableContract) {
      return Response.json({
        success: true,
        skipped: true,
        created: 0,
        message: 'Aufträge wurden heute bereits generiert.'
      });
    }
    const oldContracts = existingContracts.filter(c => c.status === 'available');
    await Promise.all(oldContracts.map(old => base44.asServiceRole.entities.Contract.delete(old.id)));

    // Seed anti-repeat memory with recent contracts for route variety.
    const sortedRecent = [...existingContracts].sort((a, b) => {
      const aTs = new Date(a.updated_date || a.created_date || 0).getTime();
      const bTs = new Date(b.updated_date || b.created_date || 0).getTime();
      return bTs - aTs;
    });
    const recentSlice = sortedRecent.slice(0, 120);
    const usedRoutePairs = new Set(
      recentSlice
        .map(c => routeKeyFromIcao(c.departure_airport, c.arrival_airport))
        .filter(Boolean)
    );
    const departureUsage = new Map();
    for (const c of recentSlice.slice(0, 60)) {
      if (!c?.departure_airport) continue;
      departureUsage.set(c.departure_airport, (departureUsage.get(c.departure_airport) || 0) + 1);
    }

    // Get the types the user owns (based on filtered aircraft)
    const ownedTypes = [...new Set(filteredAircraft.map(a => a.type))];
    const ownedTypeSpecs = allAircraftTypes.filter(t => ownedTypes.includes(t.type));
    const notOwnedTypeSpecs = allAircraftTypes.filter(t => !ownedTypes.includes(t.type));

    const compatibleContracts = [];
    const incompatibleContracts = [];
    const aircraftStationAirports = availableAircraft
      .map((plane) => normalizeIcao(plane?.hangar_airport))
      .filter((icao) => airportByIcao.has(icao));
    const fallbackHubAirport = normalizeIcao(company?.hub_airport);
    const generationAirportPool = hangarAirports.length > 0
      ? hangarAirports
      : aircraftStationAirports.length > 0
        ? [...new Set(aircraftStationAirports)]
        : airportByIcao.has(fallbackHubAirport)
          ? [fallbackHubAirport]
          : [airports[0].icao];

    const globalGenerationOptions = {
      blockedPairs: usedRoutePairs,
      departureUsage,
      maxDepartureReuse: 3,
      forceContractType: filterContractType || null,
      departurePool: airports.filter((airport) => generationAirportPool.includes(airport.icao)),
    };

    const hangarsForGeneration = validHangars.length > 0
      ? validHangars
      : [{
          id: 'legacy-world-hangar',
          airport_icao: generationAirportPool[0] || airports[0].icao,
          size: 'mega'
        }];

    for (const hangar of hangarsForGeneration) {
      const hangarRule = HANGAR_SIZE_RULES[hangar?.size] || HANGAR_SIZE_RULES.small;
      const hangarAirport = String(hangar?.airport_icao || '').toUpperCase();
      const hangarId = String(hangar?.id || '').trim();
      const departurePool = airports.filter((airport) => airport.icao === hangarAirport);
      const hangarAircraft = filteredAircraft.filter((plane) => {
        const aircraftHangarId = String(plane?.hangar_id || '').trim();
        const planeHangarAirport = String(plane?.hangar_airport || '').toUpperCase();
        const stationedHere =
          (aircraftHangarId && hangarId && aircraftHangarId === hangarId) ||
          planeHangarAirport === hangarAirport;
        return stationedHere && hangarRule.allowed_types.includes(plane.type);
      });
      const ownedTypesAtHangar = [...new Set(hangarAircraft.map((plane) => plane.type))];
      const typePool = allAircraftTypes.filter((entry) => ownedTypesAtHangar.includes(entry.type));
      if (typePool.length === 0 || departurePool.length === 0) continue;

      const genOptions = {
        blockedPairs: usedRoutePairs,
        departureUsage,
        maxDepartureReuse: 3,
        forceContractType: filterContractType || null,
        departurePool,
      };

      let attempts = 0;
      while (attempts < 60) {
        attempts++;
        const acType = randomItem(typePool);
        const contract = generateContract(company.id, acType, company.level || 1, genOptions);
        if (!contract) continue;
        if (contract.distance_nm < minNm || contract.distance_nm > maxNm) continue;
        const canFulfill = hangarAircraft.some((plane) => {
          const typeMatch = contract.required_aircraft_type.includes(plane.type);
          const cargoMatch = !contract.cargo_weight_kg || (plane.cargo_capacity_kg && plane.cargo_capacity_kg >= contract.cargo_weight_kg);
          const rangeMatch = !contract.distance_nm || (plane.range_nm && plane.range_nm >= contract.distance_nm);
          const passengerMatch = !contract.passenger_count || (plane.passenger_capacity && plane.passenger_capacity >= contract.passenger_count);
          return typeMatch && cargoMatch && rangeMatch && passengerMatch;
        });
        if (!canFulfill) continue;
        contract.hangar_airport = hangarAirport;
        contract.hangar_id = hangar.id;
        compatibleContracts.push(contract);
        rememberRoute(contract, usedRoutePairs, departureUsage);
        if (compatibleContracts.filter((entry) => entry.hangar_id === hangar.id).length >= 4) break;
      }
    }

    // Generate 3 incompatible contracts
    let attempts = 0;
    while (incompatibleContracts.length < 3 && attempts < 50) {
      attempts++;
      if (notOwnedTypeSpecs.length > 0) {
        const acType = randomItem(notOwnedTypeSpecs);
        const contract = generateContract(company.id, acType, company.level || 1, globalGenerationOptions);
        if (contract) {
          if (contract.distance_nm < minNm || contract.distance_nm > maxNm) continue;
          incompatibleContracts.push(contract);
          rememberRoute(contract, usedRoutePairs, departureUsage);
        }
      } else {
        const acType = randomItem(ownedTypeSpecs);
        const contract = generateContract(company.id, acType, company.level || 1, globalGenerationOptions);
        if (contract) {
          const maxRange = Math.max(...filteredAircraft.map(a => a.range_nm || 0));
          const maxCargo = Math.max(...filteredAircraft.map(a => a.cargo_capacity_kg || 0));
          const maxPax = Math.max(...filteredAircraft.map(a => a.passenger_capacity || 0));
          const exceedType = Math.floor(Math.random() * 3);
          if (exceedType === 0) contract.distance_nm = maxRange + 500 + Math.floor(Math.random() * 1000);
          else if (exceedType === 1 && contract.cargo_weight_kg > 0) contract.cargo_weight_kg = maxCargo + 1000;
          else contract.passenger_count = maxPax + 50;
          contract.title = contract.title + " (Spezial)";
          incompatibleContracts.push(contract);
          rememberRoute(contract, usedRoutePairs, departureUsage);
        }
      }
    }

    const allContracts = [...compatibleContracts, ...incompatibleContracts];
    if (allContracts.length > 0) {
      await base44.asServiceRole.entities.Contract.bulkCreate(allContracts);
      await base44.asServiceRole.entities.Company.update(company.id, {
        last_contract_generation_date: todayIso
      });
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
