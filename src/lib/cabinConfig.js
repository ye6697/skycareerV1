// Cabin configuration + booking (load factor) system.
// Every passenger aircraft has a cabin_config: { economy_tier, business_seats, first_seats }.
// Business/First seats consume more floor space than economy seats.

export const ECONOMY_TIERS = {
  1: {
    key: 1, label: { de: 'Economy Basic', en: 'Economy Basic' },
    desc: { de: '29" Sitzabstand, keine Extras', en: '29" pitch, no frills' },
    priceMult: 1.0, loadBonus: 0, upgradeCostPerSeat: 0, levelReq: 1,
  },
  2: {
    key: 2, label: { de: 'Economy Comfort', en: 'Economy Comfort' },
    desc: { de: '32" Sitzabstand, verstellbare Lehnen', en: '32" pitch, recliner seats' },
    priceMult: 1.2, loadBonus: 0.04, upgradeCostPerSeat: 1200, levelReq: 3,
  },
  3: {
    key: 3, label: { de: 'Economy Premium', en: 'Economy Premium' },
    desc: { de: '34" Sitzabstand, Entertainment & Catering', en: '34" pitch, IFE & catering' },
    priceMult: 1.45, loadBonus: 0.08, upgradeCostPerSeat: 2600, levelReq: 8,
  },
};

export const BUSINESS_CLASS = {
  allowedTypes: ['regional_jet', 'narrow_body', 'wide_body'],
  levelReq: 5,
  costPerSeat: 9000,
  spacePerSeat: 2.5,
  priceMult: 3,
};

export const FIRST_CLASS = {
  allowedTypes: ['narrow_body', 'wide_body'],
  levelReq: 12,
  costPerSeat: 25000,
  spacePerSeat: 6,
  priceMult: 6,
};

export function getCabinConfig(aircraft) {
  const raw = aircraft?.cabin_config || {};
  return {
    economy_tier: Math.min(3, Math.max(1, Number(raw.economy_tier) || 1)),
    business_seats: Math.max(0, Math.round(Number(raw.business_seats) || 0)),
    first_seats: Math.max(0, Math.round(Number(raw.first_seats) || 0)),
  };
}

// Seat counts derived from capacity and premium seat space usage.
export function getSeatCounts(aircraft, cabinOverride = null) {
  const capacity = Math.max(0, Math.round(Number(aircraft?.passenger_capacity) || 0));
  const cabin = cabinOverride || getCabinConfig(aircraft);
  const spaceUsed = cabin.business_seats * BUSINESS_CLASS.spacePerSeat + cabin.first_seats * FIRST_CLASS.spacePerSeat;
  const economy = Math.max(0, Math.floor(capacity - spaceUsed));
  return {
    capacity,
    economy,
    business: cabin.business_seats,
    first: cabin.first_seats,
    total: economy + cabin.business_seats + cabin.first_seats,
    spaceLeft: Math.max(0, capacity - spaceUsed),
    economy_tier: cabin.economy_tier,
  };
}

export function canHaveBusiness(aircraft) {
  return BUSINESS_CLASS.allowedTypes.includes(String(aircraft?.type || ''));
}

export function canHaveFirst(aircraft) {
  return FIRST_CLASS.allowedTypes.includes(String(aircraft?.type || ''));
}

// Deterministic pseudo-random from a string seed (same contract+aircraft => same booking).
function seededRandom(seedStr) {
  let h = 2166136261;
  const s = String(seedStr || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h = (h ^= h >>> 16) >>> 0;
    return h / 4294967296;
  };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// Compute booked seats + revenue for a passenger/charter contract.
// contract.payout is treated as "route revenue at full demand in basic economy",
// so ticketBase = payout / demand.
// Booking drivers:
//  - Reputation (main): fuller flights, more premium bookings.
//  - Economy tier: comfortable cabins attract more passengers (+load factor).
//  - Route distance: long-haul routes have much stronger premium demand and
//    premium fares scale up with distance.
export function computeBooking({ contract, aircraft, company }) {
  const seats = getSeatCounts(aircraft);
  const demand = Math.max(1, Math.round(Number(contract?.passenger_count) || 0));
  const basePayout = Math.max(0, Number(contract?.payout) || 0);
  const ticketBase = basePayout / demand;
  const rep = clamp(Number(company?.reputation) || 50, 0, 100);
  const rand = seededRandom(`${contract?.id || ''}_${aircraft?.id || ''}`);

  const distanceNm = Math.max(50, Number(contract?.distance_nm) || 300);
  // 0 for short hops (<=500 NM), 1 for true long-haul (>=3000 NM).
  const longHaul = clamp((distanceNm - 500) / 2500, 0, 1);
  const tierBonus = ECONOMY_TIERS[seats.economy_tier]?.loadBonus || 0;

  // Economy load factor: reputation-driven, boosted by cabin comfort.
  const loadFactor = clamp(0.32 + (rep / 100) * 0.55 + tierBonus + (rand() - 0.5) * 0.1, 0.25, 1);
  const ecoDemand = Math.min(demand, seats.economy);
  const economyBooked = Math.min(seats.economy, Math.max(0, Math.round(ecoDemand * loadFactor)));

  // Premium demand: needs reputation AND route length (nobody books First on a hop).
  const premiumAppeal = clamp((rep - 30) / 60, 0, 1) * (0.55 + 0.45 * longHaul);
  const businessBooked = Math.min(
    seats.business,
    Math.round(seats.business * premiumAppeal * (0.5 + rand() * 0.5))
  );
  const firstBooked = Math.min(
    seats.first,
    Math.round(seats.first * Math.pow(premiumAppeal, 1.6) * (0.35 + rand() * 0.65))
  );

  // Per-class ticket prices. Premium fares scale further with distance.
  const ecoMult = ECONOMY_TIERS[seats.economy_tier]?.priceMult || 1;
  const ticketEconomy = ticketBase * ecoMult;
  const ticketBusiness = ticketBase * BUSINESS_CLASS.priceMult * (1 + 0.5 * longHaul);
  const ticketFirst = ticketBase * FIRST_CLASS.priceMult * (1 + 0.7 * longHaul);

  const revenueEconomy = Math.round(economyBooked * ticketEconomy);
  const revenueBusiness = Math.round(businessBooked * ticketBusiness);
  const revenueFirst = Math.round(firstBooked * ticketFirst);
  const totalBooked = economyBooked + businessBooked + firstBooked;

  // ---- Freight -------------------------------------------------------------
  // Cargo contracts: the contract payout IS the freight rate for the requested
  // tonnage. Passenger contracts: belly freight billed per kg over distance.
  const cargoDemandKg = Math.max(0, Math.round(Number(contract?.cargo_weight_kg) || 0));
  const cargoCapacityKg = Math.max(0, Math.round(Number(aircraft?.cargo_capacity_kg) || 0));
  const isCargoContract = !Number(contract?.passenger_count);
  const cargoFillFactor = clamp(0.7 + (rep / 100) * 0.3 + (rand() - 0.5) * 0.08, 0.6, 1);
  const cargoLoadedKg = Math.round(
    Math.min(cargoDemandKg, cargoCapacityKg) * (isCargoContract ? 1 : cargoFillFactor)
  );
  const cargoRatePerKg = isCargoContract && cargoDemandKg > 0
    ? basePayout / cargoDemandKg
    : 0.12 + 0.00035 * distanceNm;
  const revenueCargo = Math.round(cargoLoadedKg * cargoRatePerKg);

  const totalRevenue = revenueEconomy + revenueBusiness + revenueFirst + revenueCargo;

  return {
    seats,
    demand,
    cargo: {
      demand_kg: cargoDemandKg,
      capacity_kg: cargoCapacityKg,
      loaded_kg: cargoLoadedKg,
      rate_per_kg: Math.round(cargoRatePerKg * 100) / 100,
      is_cargo_contract: isCargoContract,
      fill: cargoDemandKg > 0 ? cargoLoadedKg / cargoDemandKg : 0,
    },
    economy_booked: economyBooked,
    business_booked: businessBooked,
    first_booked: firstBooked,
    total_booked: totalBooked,
    load_factor: seats.total > 0 ? totalBooked / seats.total : 0,
    ticket_base: Math.round(ticketBase),
    tickets: {
      economy: Math.round(ticketEconomy),
      business: Math.round(ticketBusiness),
      first: Math.round(ticketFirst),
    },
    factors: {
      reputation: rep,
      long_haul: longHaul,
      tier_bonus: tierBonus,
      distance_nm: distanceNm,
    },
    revenue: {
      economy: revenueEconomy,
      business: revenueBusiness,
      first: revenueFirst,
      cargo: revenueCargo,
      total: totalRevenue,
      avg_ticket: totalBooked > 0 ? Math.round(totalRevenue / totalBooked) : 0,
    },
  };
}

// Expected revenue index of a cabin layout (reference reputation 70).
// Used in the cabin editor to compare configurations independent of a contract.
export function getRevenuePotential(aircraft, cabinOverride = null) {
  const seats = getSeatCounts(aircraft, cabinOverride);
  const ecoMult = ECONOMY_TIERS[seats.economy_tier]?.priceMult || 1;
  const tierBonus = ECONOMY_TIERS[seats.economy_tier]?.loadBonus || 0;
  const ecoFill = clamp(0.32 + 0.7 * 0.55 + tierBonus, 0, 1);
  const economy = seats.economy * ecoMult * ecoFill;
  const business = seats.business * BUSINESS_CLASS.priceMult * 0.55;
  const first = seats.first * FIRST_CLASS.priceMult * 0.42;
  return {
    economy: Math.round(economy * 10),
    business: Math.round(business * 10),
    first: Math.round(first * 10),
    total: Math.round((economy + business + first) * 10),
  };
}

// Payout range for a contract flown with a specific aircraft AT FULL LOAD.
// min = every seat sold but no premium demand (economy fares only for premium seats)
// max = every seat sold at its own class fare.
export function getPayoutRange({ contract, aircraft }) {
  const seats = getSeatCounts(aircraft);
  const demand = Math.max(1, Math.round(Number(contract?.passenger_count) || 0));
  const ticketBase = Math.max(0, Number(contract?.payout) || 0) / demand;
  const distanceNm = Math.max(50, Number(contract?.distance_nm) || 300);
  const longHaul = clamp((distanceNm - 500) / 2500, 0, 1);
  const ecoMult = ECONOMY_TIERS[seats.economy_tier]?.priceMult || 1;

  const ticketEconomy = ticketBase * ecoMult;
  const ticketBusiness = ticketBase * BUSINESS_CLASS.priceMult * (1 + 0.5 * longHaul);
  const ticketFirst = ticketBase * FIRST_CLASS.priceMult * (1 + 0.7 * longHaul);

  // Freight share (same model as computeBooking, at full load).
  const cargoDemandKg = Math.max(0, Math.round(Number(contract?.cargo_weight_kg) || 0));
  const cargoCapacityKg = Math.max(0, Math.round(Number(aircraft?.cargo_capacity_kg) || 0));
  const isCargoContract = !Number(contract?.passenger_count);
  const cargoLoadedKg = Math.min(cargoDemandKg, cargoCapacityKg);
  const cargoRatePerKg = isCargoContract && cargoDemandKg > 0
    ? Math.max(0, Number(contract?.payout) || 0) / cargoDemandKg
    : 0.12 + 0.00035 * distanceNm;
  const cargoRevenue = Math.round(cargoLoadedKg * cargoRatePerKg);

  const min = Math.round(seats.total * ticketEconomy) + cargoRevenue;
  const max = Math.round(
    seats.economy * ticketEconomy + seats.business * ticketBusiness + seats.first * ticketFirst
  ) + cargoRevenue;
  return { min, max: Math.max(min, max), seats, cargo_revenue: cargoRevenue, cargo_kg: cargoLoadedKg };
}

export function isPassengerContract(contract) {
  return ['passenger', 'charter', 'emergency'].includes(String(contract?.type || '')) && Number(contract?.passenger_count) > 0;
}

// Contracts that get the booking/loading animation: passengers, freight or both.
export function hasBookingLoad(contract) {
  return Number(contract?.passenger_count) > 0 || Number(contract?.cargo_weight_kg) > 0;
}