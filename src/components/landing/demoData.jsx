// Realistic mock data for landing-page demos that re-use the real in-app
// components (AircraftHangar3D, Fleet3DView, MarketHangar3DView, FinalApproach3D,
// HangarWorldGlobe3D). All shapes match what the production components expect.

import { HANGAR_MODEL_VARIANTS } from '@/components/contracts/hangarModelCatalog';

export const DEMO_AIRCRAFT_FLEET = [
  {
    id: 'demo-ac-1',
    company_id: 'demo-company',
    name: 'Boeing 737 MAX 8',
    registration: 'D-DEMO',
    type: 'narrow_body',
    passenger_capacity: 178,
    cargo_capacity_kg: 18000,
    fuel_consumption_per_hour: 2600,
    range_nm: 3550,
    purchase_price: 110000000,
    original_purchase_price: 110000000,
    current_value: 92000000,
    status: 'available',
    total_flight_hours: 1840,
    hangar_id: 'demo-hangar-eddf',
    hangar_airport: 'EDDF',
    maintenance_categories: {
      engine: 28, hydraulics: 12, avionics: 8, airframe: 18,
      landing_gear: 35, electrical: 15, flight_controls: 22, pressurization: 10,
    },
    permanent_wear_categories: {
      engine: 4, hydraulics: 2, avionics: 1, airframe: 3,
      landing_gear: 6, electrical: 2, flight_controls: 3, pressurization: 1,
    },
  },
  {
    id: 'demo-ac-2',
    company_id: 'demo-company',
    name: 'Airbus A320neo',
    registration: 'D-NEOX',
    type: 'narrow_body',
    passenger_capacity: 180,
    cargo_capacity_kg: 19000,
    fuel_consumption_per_hour: 2500,
    range_nm: 3500,
    purchase_price: 100000000,
    original_purchase_price: 100000000,
    current_value: 84000000,
    status: 'available',
    total_flight_hours: 920,
    hangar_id: 'demo-hangar-eddf',
    hangar_airport: 'EDDF',
    maintenance_categories: {
      engine: 64, hydraulics: 42, avionics: 30, airframe: 48,
      landing_gear: 78, electrical: 35, flight_controls: 52, pressurization: 28,
    },
    permanent_wear_categories: {
      engine: 8, hydraulics: 4, avionics: 2, airframe: 6,
      landing_gear: 12, electrical: 4, flight_controls: 6, pressurization: 3,
    },
  },
  {
    id: 'demo-ac-3',
    company_id: 'demo-company',
    name: 'Cessna 172 Skyhawk',
    registration: 'D-SKYH',
    type: 'small_prop',
    passenger_capacity: 3,
    cargo_capacity_kg: 200,
    fuel_consumption_per_hour: 35,
    range_nm: 640,
    purchase_price: 425000,
    original_purchase_price: 425000,
    current_value: 380000,
    status: 'available',
    total_flight_hours: 620,
    hangar_id: 'demo-hangar-eddf',
    hangar_airport: 'EDDF',
    maintenance_categories: {
      engine: 18, hydraulics: 8, avionics: 12, airframe: 14,
      landing_gear: 22, electrical: 10, flight_controls: 15, pressurization: 0,
    },
    permanent_wear_categories: {
      engine: 2, hydraulics: 1, avionics: 1, airframe: 2,
      landing_gear: 3, electrical: 1, flight_controls: 2, pressurization: 0,
    },
  },
];

// Used by MarketHangar3DView – needs the same shape as listings from generation.
export const DEMO_MARKET_LISTINGS = [
  {
    id: 'demo-listing-1',
    market_listing_id: 'demo-listing-1',
    name: 'Airbus A320neo',
    type: 'narrow_body',
    passenger_capacity: 180,
    cargo_capacity_kg: 19000,
    fuel_consumption_per_hour: 2500,
    range_nm: 3500,
    purchase_price: 100000000,
    maintenance_cost_per_hour: 1800,
    level_requirement: 17,
  },
  {
    id: 'demo-listing-2',
    market_listing_id: 'demo-listing-2',
    name: 'Boeing 777-300ER',
    type: 'wide_body',
    passenger_capacity: 396,
    cargo_capacity_kg: 70000,
    fuel_consumption_per_hour: 7800,
    range_nm: 7370,
    purchase_price: 285000000,
    maintenance_cost_per_hour: 4200,
    level_requirement: 26,
  },
  {
    id: 'demo-listing-3',
    market_listing_id: 'demo-listing-3',
    name: 'Cessna 172 Skyhawk',
    type: 'small_prop',
    passenger_capacity: 3,
    cargo_capacity_kg: 200,
    fuel_consumption_per_hour: 35,
    range_nm: 640,
    purchase_price: 425000,
    maintenance_cost_per_hour: 60,
    level_requirement: 1,
  },
  {
    id: 'demo-listing-4',
    market_listing_id: 'demo-listing-4',
    name: 'Boeing 747-8F',
    type: 'cargo',
    passenger_capacity: 0,
    cargo_capacity_kg: 134000,
    fuel_consumption_per_hour: 9500,
    range_nm: 4120,
    purchase_price: 400000000,
    maintenance_cost_per_hour: 5800,
    level_requirement: 30,
  },
];

export const DEMO_COMPANY = {
  id: 'demo-company',
  name: 'SkyCareer Demo Airline',
  callsign: 'DEMO',
  balance: 12500000,
  reputation: 78,
  level: 18,
  experience_points: 84200,
  hub_airport: 'EDDF',
  hangars: [
    {
      id: 'demo-hangar-eddf',
      airport_icao: 'EDDF',
      size: 'large',
      slots: 8,
      model_variant: HANGAR_MODEL_VARIANTS?.[2]?.id || HANGAR_MODEL_VARIANTS?.[0]?.id || 'standard',
      upgrade_tier: 2,
      purchase_price: 2500000,
      allowed_types: ['small_prop', 'turboprop', 'regional_jet', 'narrow_body'],
      purchased_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
    },
    {
      id: 'demo-hangar-egll',
      airport_icao: 'EGLL',
      size: 'medium',
      slots: 4,
      model_variant: HANGAR_MODEL_VARIANTS?.[1]?.id || HANGAR_MODEL_VARIANTS?.[0]?.id || 'standard',
      upgrade_tier: 1,
      purchase_price: 850000,
      allowed_types: ['small_prop', 'turboprop', 'regional_jet'],
      purchased_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    },
  ],
};

export const DEMO_CONTRACTS = [
  {
    id: 'demo-contract-1',
    title: 'Express Cargo to JFK',
    type: 'cargo',
    departure_airport: 'EDDF',
    arrival_airport: 'KJFK',
    dep_lat: 50.0379, dep_lon: 8.5622,
    arr_lat: 40.6413, arr_lon: -73.7781,
    distance_nm: 3340,
    cargo_weight_kg: 18000,
    payout: 284000,
    bonus_potential: 28000,
    difficulty: 'hard',
    status: 'available',
    required_aircraft_type: ['narrow_body', 'wide_body'],
    level_requirement: 12,
  },
  {
    id: 'demo-contract-2',
    title: 'Premium Charter to Dubai',
    type: 'charter',
    departure_airport: 'EDDF',
    arrival_airport: 'OMDB',
    dep_lat: 50.0379, dep_lon: 8.5622,
    arr_lat: 25.2532, arr_lon: 55.3657,
    distance_nm: 2780,
    passenger_count: 156,
    payout: 192000,
    bonus_potential: 22000,
    difficulty: 'medium',
    status: 'available',
    required_aircraft_type: ['narrow_body', 'wide_body'],
    level_requirement: 14,
  },
  {
    id: 'demo-contract-3',
    title: 'Long Haul to Sydney',
    type: 'passenger',
    departure_airport: 'EDDF',
    arrival_airport: 'YSSY',
    dep_lat: 50.0379, dep_lon: 8.5622,
    arr_lat: -33.9399, arr_lon: 151.1753,
    distance_nm: 9180,
    passenger_count: 380,
    payout: 612000,
    bonus_potential: 70000,
    difficulty: 'extreme',
    status: 'available',
    required_aircraft_type: ['wide_body'],
    level_requirement: 24,
  },
  {
    id: 'demo-contract-4',
    title: 'London Shuttle',
    type: 'passenger',
    departure_airport: 'EGLL',
    arrival_airport: 'EDDF',
    dep_lat: 51.4700, dep_lon: -0.4543,
    arr_lat: 50.0379, arr_lon: 8.5622,
    distance_nm: 360,
    passenger_count: 132,
    payout: 38000,
    bonus_potential: 4000,
    difficulty: 'easy',
    status: 'available',
    required_aircraft_type: ['narrow_body', 'regional_jet'],
    level_requirement: 4,
  },
];

export const DEMO_MARKET_AIRPORTS = [
  { airport_icao: 'EDDF', label: 'Frankfurt', lat: 50.0379, lon: 8.5622 },
  { airport_icao: 'EGLL', label: 'London Heathrow', lat: 51.4700, lon: -0.4543 },
  { airport_icao: 'KJFK', label: 'New York JFK', lat: 40.6413, lon: -73.7781 },
  { airport_icao: 'OMDB', label: 'Dubai', lat: 25.2532, lon: 55.3657 },
  { airport_icao: 'YSSY', label: 'Sydney', lat: -33.9399, lon: 151.1753 },
  { airport_icao: 'RJTT', label: 'Tokyo Haneda', lat: 35.5494, lon: 139.7798 },
  { airport_icao: 'KLAX', label: 'Los Angeles', lat: 33.9416, lon: -118.4085 },
  { airport_icao: 'WSSS', label: 'Singapore Changi', lat: 1.3644, lon: 103.9915 },
];

// Generate a realistic landing telemetry segment (last 30s of a flight)
// for the FinalApproach3D replay.
function makeLandingTelemetry() {
  const now = Date.now();
  const points = [];
  const totalSamples = 60;
  const totalSec = 30;
  // Approach EDDF runway 07C: bearing ~70°, threshold near 50.0264, 8.5333
  const thresholdLat = 50.0264;
  const thresholdLon = 8.5333;
  const bearingDeg = 70;
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const cosLat = Math.cos((thresholdLat * Math.PI) / 180);

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / (totalSamples - 1); // 0..1
    const tSec = t * totalSec;
    // Distance from threshold: starts ~3.5 NM out, ends ~500m past threshold.
    const distFromThreshold = (1 - t) * 6500 - 500; // meters along runway axis
    // Lateral wobble: ±2m, very small
    const lateral = Math.sin(t * Math.PI * 3) * 2.5;
    // Convert (alongAxis, lateral) to lat/lon
    const dxAlong = -distFromThreshold * Math.sin(bearingRad);
    const dyAlong = -distFromThreshold * Math.cos(bearingRad);
    const dxLat = lateral * Math.cos(bearingRad);
    const dyLat = -lateral * Math.sin(bearingRad);
    const dxTotal = dxAlong + dxLat;
    const dyTotal = dyAlong + dyLat;
    const lon = thresholdLon + (dxTotal / 111320) / cosLat;
    const lat = thresholdLat + dyTotal / 111320;
    // Glideslope: 3° from 1000ft AGL down to runway, smooth flare in last 5%
    const altAGL = t < 0.95 ? Math.max(0, (1 - t / 0.95) * 980) : Math.max(0, (1 - t) / 0.05 * 30);
    const alt = 364 + altAGL; // EDDF elev ≈ 364ft
    const spd = t < 0.95 ? 145 - t * 15 : 130 - (t - 0.95) * 100;
    const vs = t < 0.92 ? -650 - Math.sin(t * Math.PI) * 80 : -100 - (1 - t) * 200;
    const g = t > 0.93 && t < 0.99 ? 1.05 + Math.sin((t - 0.93) / 0.06 * Math.PI) * 0.18 : 1.02;
    const onGround = t >= 0.95;
    const pitch = t < 0.92 ? -1.5 : 4 + (t - 0.92) * 20;
    const roll = Math.sin(t * Math.PI * 2.5) * 1.5;

    points.push({
      t: new Date(now - (totalSec - tSec) * 1000).toISOString(),
      alt,
      spd,
      ias: spd,
      vs,
      g,
      lat,
      lon,
      pitch,
      roll,
      on_ground: onGround,
    });
  }
  return points;
}

export const DEMO_FLIGHT = {
  id: 'demo-flight-1',
  company_id: 'demo-company',
  contract_id: 'demo-contract-4',
  aircraft_id: 'demo-ac-2',
  aircraft_name: 'Airbus A320neo',
  aircraft_model: 'A320neo',
  departure_airport: 'EGLL',
  arrival_airport: 'EDDF',
  status: 'completed',
  flight_score: 92,
  landing_g_force: 1.18,
  landing_vs: -180,
  flight_duration_hours: 1.4,
  profit: 18400,
  revenue: 38000,
  xplane_data: {
    arrival_icao: 'EDDF',
    departure_icao: 'EGLL',
    fleet_aircraft_type: 'A320',
    aircraft_icao: 'A320',
    final_score: 92,
    landingGForce: 1.18,
    touchdown_vspeed: -180,
    runway_accuracy: {
      landing: { rmsMeters: 1.8, scoreDelta: 12, cashDelta: 800 },
    },
    telemetry_history: makeLandingTelemetry(),
  },
};