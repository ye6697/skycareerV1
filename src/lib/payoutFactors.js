// Payout multipliers per aircraft type (kept in sync with functions/generateContracts).
// Normalized so the lowest tier (small_prop) starts at 1.0.
const RAW_TIER_MULTIPLIER = {
  small_prop: 12,
  turboprop: 25,
  regional_jet: 55,
  narrow_body: 160,
  wide_body: 260,
  cargo: 280,
};

const BASE_TIER = RAW_TIER_MULTIPLIER.small_prop;

export function getPayoutFactor(aircraftType) {
  const raw = RAW_TIER_MULTIPLIER[String(aircraftType || '').trim().toLowerCase()];
  if (!raw) return 1.0;
  return raw / BASE_TIER;
}

export function formatPayoutFactor(aircraftType) {
  const factor = getPayoutFactor(aircraftType);
  return factor >= 10 ? `${factor.toFixed(1)}x` : `${factor.toFixed(1)}x`;
}