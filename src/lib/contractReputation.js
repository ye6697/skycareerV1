function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function seededUnitInterval(seed) {
  const text = String(seed || "contract");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0) / 4294967295;
}

function normalizeStoredMultiplier(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;

  // Base44/backfilled rows can have a neutral default. Treat exact 1.0 like
  // missing data so old contracts still get a real displayed reputation effect.
  if (raw === 1) return null;

  if (raw > 0 && raw <= 3) return raw;
  if (raw > -100 && raw <= 100) return 1 + raw / 100;

  return null;
}

export function getContractReputationMultiplier(contract, companyReputation = 50) {
  const storedMultiplier = normalizeStoredMultiplier(contract?.reputation_multiplier);
  if (storedMultiplier !== null) {
    return clamp(storedMultiplier, 0.68, 1.25);
  }

  const hasReputation = companyReputation !== null && companyReputation !== undefined && companyReputation !== "";
  const reputation = hasReputation && Number.isFinite(Number(companyReputation))
    ? Number(companyReputation)
    : 50;
  const baseMultiplier = clamp(1 + ((reputation - 50) / 170), 0.72, 1.22);
  const seed = contract?.id || contract?.title || `${contract?.departure_airport || ""}-${contract?.arrival_airport || ""}`;
  const variance = 0.975 + seededUnitInterval(seed) * 0.05;

  return clamp(baseMultiplier * variance, 0.68, 1.25);
}

export function getContractReputationImpactPercent(contract, companyReputation = 50) {
  const multiplier = getContractReputationMultiplier(contract, companyReputation);
  const rawPercent = (multiplier - 1) * 100;
  if (Math.abs(rawPercent) < 0.005) return 0;
  return Number(rawPercent.toFixed(2));
}

export function formatContractReputationImpact(contract, companyReputation = 50) {
  const percent = getContractReputationImpactPercent(contract, companyReputation);
  const absoluteLabel = Number.isInteger(percent)
    ? Math.abs(percent).toFixed(0)
    : Math.abs(percent).toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");

  if (percent > 0) return `+${absoluteLabel}%`;
  if (percent < 0) return `-${absoluteLabel}%`;
  return "0%";
}
