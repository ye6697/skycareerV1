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

const aircraftTypes = [
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const companies = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
    if (!companies[0]) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];

    const contracts = [];
    
    for (let i = 0; i < 1000; i++) {
      const depAirport = airports[Math.floor(Math.random() * airports.length)];
      let arrAirport = airports[Math.floor(Math.random() * airports.length)];
      
      while (arrAirport.icao === depAirport.icao) {
        arrAirport = airports[Math.floor(Math.random() * airports.length)];
      }
      
      const distance = calculateDistance(depAirport.lat, depAirport.lon, arrAirport.lat, arrAirport.lon);
      
      const suitableAircraft = aircraftTypes.filter(ac => ac.range >= distance);
      if (suitableAircraft.length === 0) continue;
      
      const selectedAircraft = suitableAircraft[Math.floor(Math.random() * suitableAircraft.length)];
      const contractType = contractTypes[Math.floor(Math.random() * contractTypes.length)];
      
      const passengers = contractType === "passenger" || contractType === "charter" 
        ? Math.floor(Math.random() * selectedAircraft.passengers * 0.8) + Math.floor(selectedAircraft.passengers * 0.2)
        : 0;
      
      const cargo = contractType === "cargo" 
        ? Math.floor(Math.random() * selectedAircraft.cargo * 0.8) + Math.floor(selectedAircraft.cargo * 0.2)
        : 0;
      
      const basePayout = distance * 5 + passengers * 50 + cargo * 0.5;
      const payout = Math.round(basePayout * (0.8 + Math.random() * 0.4));
      
      const level = Math.max(1, Math.floor(distance / 300) + Math.floor(i / 100));
      
      const briefings = briefingTemplates[contractType];
      const briefing = briefings[Math.floor(Math.random() * briefings.length)];
      
      contracts.push({
        company_id: company.id,
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
        bonus_potential: Math.round(payout * 0.2),
        required_aircraft_type: [selectedAircraft.type],
        required_crew: {
          captain: 1,
          first_officer: passengers > 50 ? 1 : 0,
          flight_attendant: passengers > 20 ? Math.ceil(passengers / 50) : 0,
          loadmaster: cargo > 5000 ? 1 : 0
        },
        status: "available",
        difficulty: distance < 500 ? "easy" : distance < 1500 ? "medium" : distance < 3000 ? "hard" : "extreme",
        level_requirement: level
      });
    }
    
    for (const contract of contracts) {
      await base44.asServiceRole.entities.Contract.create(contract);
    }
    
    return Response.json({ 
      success: true, 
      created: contracts.length,
      message: `${contracts.length} Aufträge erfolgreich erstellt`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});