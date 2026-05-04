export const MAINTENANCE_CATEGORY_KEYS = [
  'engine',
  'hydraulics',
  'avionics',
  'airframe',
  'landing_gear',
  'electrical',
  'flight_controls',
  'pressurization',
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toFinite = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseMaybeJsonObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
  }
};

export function normalizeMaintenanceCategoryMap(source, fallbackValue = 0) {
  const map = parseMaybeJsonObject(source);
  const fallback = clamp(toFinite(fallbackValue, 0), 0, 100);
  return MAINTENANCE_CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = clamp(toFinite(map[key], fallback), 0, 100);
    return acc;
  }, {});
}

export function resolvePermanentWearCategories(source, fallbackValue = 0) {
  const normalized = normalizeMaintenanceCategoryMap(source, 0);
  const fallback = clamp(toFinite(fallbackValue, 0), 0, 100);
  const hasExplicitPermanentWear = MAINTENANCE_CATEGORY_KEYS.some((key) => normalized[key] > 0);
  if (hasExplicitPermanentWear || fallback <= 0) return normalized;
  return MAINTENANCE_CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = fallback;
    return acc;
  }, {});
}

// Each category contributes 1/N of the aircraft's new value at 100% wear.
// So 1% wear in one category = (1 / N / 100) × purchasePrice.
// Repair cost and permanent wear gain are both linear in wear share.
const CATEGORY_VALUE_SHARE = 1 / MAINTENANCE_CATEGORY_KEYS.length;

/**
 * Maintenance/repair cost for a given wear percentage in a single category,
 * scaled linearly against the aircraft's new value.
 *  - 100% wear in one category = 1/8 of new value
 *  - 100% wear in all 8 categories = 100% of new value
 */
export function calculateCategoryRepairCost({ wearPct, purchasePrice }) {
  const wear = clamp(toFinite(wearPct, 0), 0, 100);
  const baseValue = Math.max(0, toFinite(purchasePrice, 0));
  if (wear <= 0 || baseValue <= 0) return 0;
  return baseValue * CATEGORY_VALUE_SHARE * (wear / 100);
}

/**
 * Permanent wear added when repairing a category, linear in the repaired wear.
 * Permanent wear only increases by 25% of the repaired share paid for maintenance.
 * Full paid repair of one category now adds +25% permanent wear in that category.
 */
export function calculatePermanentWearIncrease({ repairedWearPct, repairCost, purchasePrice }) {
  const repairedWear = clamp(toFinite(repairedWearPct, 0), 0, 100);
  const paidRepairCost = Math.max(0, toFinite(repairCost, 0));
  const baseValue = Math.max(0, toFinite(purchasePrice, 0));

  // Infer the effective repaired share from paid maintenance cost when possible,
  // so insurance-covered repairs grow permanent wear less.
  const categoryBaseValue = baseValue * CATEGORY_VALUE_SHARE;
  const impliedRepairedWear = categoryBaseValue > 0
    ? clamp((paidRepairCost / categoryBaseValue) * 100, 0, 100)
    : repairedWear;

  const effectiveRepairedWear = Math.min(repairedWear, impliedRepairedWear);
  return effectiveRepairedWear * 0.25;
}

export function applyPermanentWearIncrease({
  currentPermanentWear,
  repairedWearPct,
  repairCost,
  purchasePrice,
  maxPermanentWear = 100,
}) {
  const current = clamp(toFinite(currentPermanentWear, 0), 0, 100);
  const increase = calculatePermanentWearIncrease({
    repairedWearPct,
    repairCost,
    purchasePrice,
  });
  return clamp(current + increase, 0, clamp(toFinite(maxPermanentWear, 100), 0, 100));
}