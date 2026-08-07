// Cabin configuration + booking (load factor) system.
// Every passenger aircraft has a cabin_config: { economy_tier, business_seats, first_seats }.
// Business/First seats consume more floor space than economy seats.

export const ECONOMY_TIERS = {
  1: { key: 1, label: { de: 'Economy Basic', en: 'Economy Basic' }, priceMult: 1.0, upgradeCostPerSeat: 0, levelReq: 1 },
  2: { key: 2, label: { de: 'Economy Comfort', en: 'Economy Comfort' }, priceMult: 1.2, upgradeCostPerSeat: 1200, levelReq: 3 },
  3: { key: 3, label: { de: 'Economy Premium', en: 'Economy Premium' }, priceMult: 1.45, upgradeCostPerSeat: 2600, levelReq: 8 },
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
// so ticketBase = payout / demand. Reputation drives the load factor.
export function computeBooking({ contract, aircraft, company }) {
  const seats = getSeatCounts(aircraft);
  const demand = Math.max(1, Math.round(Number(contract?.passenger_count) || 0));
  const basePayout = Math.max(0, Number(contract?.payout) || 0);
  const ticketBase = basePayout / demand;
  const rep = clamp(Number(company?.reputation) || 50, 0, 100);
  const rand = seededRandom(`${contract?.id || ''}_${aircraft?.id || ''}`);

  // Economy load factor: 35%..100%, mostly reputation-driven.
  const loadFactor = clamp(0.35 + (rep / 100) * 0.58 + (rand() - 0.5) * 0.12, 0.3, 1);
  const ecoDemand = Math.min(demand, seats.economy);
  const economyBooked = Math.min(seats.economy, Math.max(0, Math.round(ecoDemand * loadFactor)));

  // Premium classes fill only with good reputation.
  const premiumAppeal = clamp((rep - 35) / 60, 0, 1);
  const businessBooked = Math.min(
    seats.business,
    Math.round(seats.business * premiumAppeal * (0.55 + rand() * 0.45))
  );
  const firstBooked = Math.min(
    seats.first,
    Math.round(seats.first * premiumAppeal * premiumAppeal * (0.4 + rand() * 0.6))
  );

  const ecoMult = ECONOMY_TIERS[seats.economy_tier]?.priceMult || 1;
  const revenueEconomy = Math.round(economyBooked * ticketBase * ecoMult);
  const revenueBusiness = Math.round(businessBooked * ticketBase * BUSINESS_CLASS.priceMult);
  const revenueFirst = Math.round(firstBooked * ticketBase * FIRST_CLASS.priceMult);

  return {
    seats,
    economy_booked: economyBooked,
    business_booked: businessBooked,
    first_booked: firstBooked,
    total_booked: economyBooked + businessBooked + firstBooked,
    load_factor: seats.total > 0 ? (economyBooked + businessBooked + firstBooked) / seats.total : 0,
    ticket_base: Math.round(ticketBase),
    revenue: {
      economy: revenueEconomy,
      business: revenueBusiness,
      first: revenueFirst,
      total: revenueEconomy + revenueBusiness + revenueFirst,
    },
  };
}

export function isPassengerContract(contract) {
  return ['passenger', 'charter', 'emergency'].includes(String(contract?.type || '')) && Number(contract?.passenger_count) > 0;
}