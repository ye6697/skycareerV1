// Catalog of one-time purchase items (type-ratings, aircraft, SC$ packs).
// The variant_id is filled in by the lemonsqueezySetupProducts function and
// stored in the Subscription entity (record with plan_type='catalog').

// Aircraft tier pricing — chosen by aircraft.type
export const AIRCRAFT_TIERS = {
  small_prop:    { sku: 'aircraft_tier1', label: 'Aircraft Instant Unlock — Tier 1', priceCents: 99 },
  turboprop:     { sku: 'aircraft_tier1', label: 'Aircraft Instant Unlock — Tier 1', priceCents: 99 },
  regional_jet:  { sku: 'aircraft_tier2', label: 'Aircraft Instant Unlock — Tier 2', priceCents: 299 },
  narrow_body:   { sku: 'aircraft_tier2', label: 'Aircraft Instant Unlock — Tier 2', priceCents: 299 },
  wide_body:     { sku: 'aircraft_tier3', label: 'Aircraft Instant Unlock — Tier 3', priceCents: 499 },
  cargo:         { sku: 'aircraft_tier3', label: 'Aircraft Instant Unlock — Tier 3', priceCents: 499 },
};

// SkyCareer Dollar packs. Pack S is the baseline ($/SC$ ratio).
// "savings_pct" is computed automatically from the baseline.
export const SC_PACKS = [
  { sku: 'sc_pack_s',       label: 'SC$ Pack S',       priceCents:   99, scAmount:     100000 },
  { sku: 'sc_pack_m',       label: 'SC$ Pack M',       priceCents:  499, scAmount:     600000 },
  { sku: 'sc_pack_l',       label: 'SC$ Pack L',       priceCents:  999, scAmount:    1500000 },
  { sku: 'sc_pack_xl',      label: 'SC$ Pack XL',      priceCents: 1499, scAmount:    4000000 },
  { sku: 'sc_pack_xxl',     label: 'SC$ Pack XXL',     priceCents: 1999, scAmount:   12000000 },
  { sku: 'sc_pack_ultimate',label: 'SC$ Pack Ultimate',priceCents: 2999, scAmount:  300000000 },
];

// Type-rating instant unlock — one fixed price for any model.
export const TYPE_RATING_ITEM = {
  sku: 'type_rating_unlock',
  label: 'Type-Rating Instant Unlock',
  priceCents: 99,
};

// All catalog SKUs (used by setup function to know what to create)
export function getAllCatalogSkus() {
  const skus = new Set();
  Object.values(AIRCRAFT_TIERS).forEach((t) => skus.add(t.sku));
  SC_PACKS.forEach((p) => skus.add(p.sku));
  skus.add(TYPE_RATING_ITEM.sku);
  return Array.from(skus);
}

// Helper: SC$ baseline ($-per-SC$ ratio of the cheapest pack).
function baselineRatio() {
  const base = SC_PACKS[0];
  return base.priceCents / base.scAmount;
}

// Returns savings percent vs baseline pack (0 = same ratio, 50 = half price/SC$).
export function getScPackSavingsPct(pack) {
  const ratio = pack.priceCents / pack.scAmount;
  const base = baselineRatio();
  if (ratio >= base) return 0;
  return Math.round((1 - ratio / base) * 100);
}

// Find aircraft tier item by aircraft type
export function getAircraftTierItem(aircraftType) {
  return AIRCRAFT_TIERS[aircraftType] || AIRCRAFT_TIERS.narrow_body;
}