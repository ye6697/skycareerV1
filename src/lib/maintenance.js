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

const firstFiniteValue = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
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

export function calculateActiveMaintenanceCost(aircraft) {
  const purchasePrice = Math.max(
    0,
    firstFiniteValue(
      aircraft?.purchase_price,
      aircraft?.original_purchase_price,
      aircraft?.current_value,
    ),
  );
  const categories = normalizeMaintenanceCategoryMap(aircraft?.maintenance_categories);
  const modeledCost = MAINTENANCE_CATEGORY_KEYS.reduce(
    (sum, key) => sum + calculateCategoryRepairCost({ wearPct: categories[key], purchasePrice }),
    0,
  );
  const accumulatedCost = Math.max(0, toFinite(aircraft?.accumulated_maintenance_cost, 0));
  const cap = purchasePrice > 0 ? purchasePrice : Math.max(0, toFinite(aircraft?.current_value, 0));
  const activeCost = Math.max(modeledCost, accumulatedCost);
  return cap > 0 ? Math.min(activeCost, cap) : activeCost;
}

export function resolveAircraftValueSnapshot(aircraft) {
  const newValue = Math.max(
    0,
    firstFiniteValue(
      aircraft?.original_purchase_price,
      aircraft?.purchase_price,
      aircraft?.current_value,
    ),
  );
  const storedCurrentValue = Math.max(
    0,
    firstFiniteValue(
      aircraft?.current_value,
      aircraft?.purchase_price,
      aircraft?.original_purchase_price,
    ),
  );
  const activeMaintenanceCost = calculateActiveMaintenanceCost(aircraft);
  const permanentWearFallback = clamp(
    firstFiniteValue(
      aircraft?.used_permanent_avg,
      aircraft?.used_wear_avg,
      0,
    ),
    0,
    100,
  );
  const permanentWearCategories = resolvePermanentWearCategories(
    aircraft?.permanent_wear_categories,
    permanentWearFallback,
  );
  const permanentMaintenanceCost = MAINTENANCE_CATEGORY_KEYS.reduce(
    (sum, key) => sum + calculateCategoryRepairCost({
      wearPct: permanentWearCategories[key],
      purchasePrice: newValue,
    }),
    0,
  );
  const effectiveCurrentValue = Math.max(
    0,
    storedCurrentValue - activeMaintenanceCost - permanentMaintenanceCost,
  );
  return {
    newValue,
    storedCurrentValue,
    activeMaintenanceCost,
    permanentMaintenanceCost,
    effectiveCurrentValue,
  };
}

/**
 * Permanent wear added when repairing a category, linear in the repaired wear.
 * Permanent wear only increases by 25% of the repaired category share.
 * Full category repair adds +25% permanent wear in that category.
 */
export function calculatePermanentWearIncrease({ repairedWearPct, repairCost, purchasePrice }) {
  const repairedWear = clamp(toFinite(repairedWearPct, 0), 0, 100);
  const grossRepairCost = Math.max(0, toFinite(repairCost, 0));
  const baseValue = Math.max(0, toFinite(purchasePrice, 0));

  // Independent from insurance: use total category repair price as baseline.
  const categoryBaseValue = baseValue * CATEGORY_VALUE_SHARE;
  const impliedRepairedWear = categoryBaseValue > 0
    ? clamp((grossRepairCost / categoryBaseValue) * 100, 0, 100)
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
