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

export function calculatePermanentWearIncrease({ repairedWearPct, repairCost, purchasePrice }) {
  const repairedWear = clamp(toFinite(repairedWearPct, 0), 0, 100);
  const cost = Math.max(0, toFinite(repairCost, 0));
  const baseValue = Math.max(1, toFinite(purchasePrice, 1));
  const costRatio = cost / baseValue;

  // Blend wear severity + economic impact for a clearly visible but controlled permanent increase.
  const wearComponent = repairedWear * 0.08;
  const costComponent = costRatio * 120;
  const raw = wearComponent + costComponent;
  return clamp(Math.max(0.2, raw), 0, 25);
}

export function applyPermanentWearIncrease({
  currentPermanentWear,
  repairedWearPct,
  repairCost,
  purchasePrice,
  maxPermanentWear = 45,
}) {
  const current = clamp(toFinite(currentPermanentWear, 0), 0, 100);
  const increase = calculatePermanentWearIncrease({
    repairedWearPct,
    repairCost,
    purchasePrice,
  });
  return clamp(current + increase, 0, clamp(toFinite(maxPermanentWear, 95), 0, 100));
}
