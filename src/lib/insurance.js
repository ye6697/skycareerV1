export const INSURANCE_PACKAGES = {
  basic: {
    key: 'basic',
    name: { en: 'Basic Cover', de: 'Basis-Schutz' },
    description: {
      en: 'Lowest fees with limited maintenance coverage.',
      de: 'Niedrige Gebuehren mit begrenzter Wartungsabdeckung.',
    },
    hourlyRatePctOfNewValue: 0.00022,
    maintenanceCoveragePct: 0.22,
    scoreBonusPct: 0,
  },
  plus: {
    key: 'plus',
    name: { en: 'Plus Cover', de: 'Plus-Schutz' },
    description: {
      en: 'Higher fees with strong maintenance protection.',
      de: 'Hoehere Gebuehren mit starkem Wartungsschutz.',
    },
    hourlyRatePctOfNewValue: 0.00065,
    maintenanceCoveragePct: 0.5,
    scoreBonusPct: 0.02,
  },
  premium: {
    key: 'premium',
    name: { en: 'Premium Cover', de: 'Premium-Schutz' },
    description: {
      en: 'Very high fees, maximum protection and top score bonus.',
      de: 'Sehr hohe Gebuehren, maximaler Schutz und bester Score-Bonus.',
    },
    hourlyRatePctOfNewValue: 0.0022,
    maintenanceCoveragePct: 0.82,
    scoreBonusPct: 0.05,
  },
};

export const DEFAULT_INSURANCE_PLAN = 'basic';

export function getInsurancePlanConfig(planKey) {
  return INSURANCE_PACKAGES[planKey] || INSURANCE_PACKAGES[DEFAULT_INSURANCE_PLAN];
}

const normalizePct = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  if (n > 1 && n <= 100) return n / 100;
  return n;
};

const inferInsurancePlanKeyFromStoredValues = (aircraft) => {
  const hourly = normalizePct(aircraft?.insurance_hourly_rate_pct);
  const coverage = normalizePct(aircraft?.insurance_maintenance_coverage_pct);
  const score = normalizePct(aircraft?.insurance_score_bonus_pct);
  if (!Number.isFinite(hourly) && !Number.isFinite(coverage) && !Number.isFinite(score)) {
    return null;
  }

  const planEntries = Object.entries(INSURANCE_PACKAGES);
  let bestKey = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [key, cfg] of planEntries) {
    const dHourly = Number.isFinite(hourly) ? Math.abs(hourly - cfg.hourlyRatePctOfNewValue) : 0;
    const dCoverage = Number.isFinite(coverage) ? Math.abs(coverage - cfg.maintenanceCoveragePct) : 0;
    const dScore = Number.isFinite(score) ? Math.abs(score - cfg.scoreBonusPct) : 0;
    const distance = dHourly + dCoverage + dScore;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = key;
    }
  }
  return bestKey;
};

export function getReputationInsuranceFactor(reputation) {
  const rep = Number.isFinite(Number(reputation)) ? Number(reputation) : 50;
  const normalized = Math.max(0, Math.min(100, rep));

  // Strong dynamic pricing:
  // - High reputation (100) => up to 30% lower fees (factor 0.70)
  // - Low reputation (0) => up to 180% higher fees (factor 2.80)
  if (normalized >= 50) {
    return 1 - ((normalized - 50) / 50) * 0.3;
  }
  return 1 + ((50 - normalized) / 50) * 1.8;
}

export function resolveAircraftInsurance(aircraft) {
  const storedPlanKeyRaw = aircraft?.insurance_plan;
  const storedPlanKey = typeof storedPlanKeyRaw === 'string'
    ? storedPlanKeyRaw.trim().toLowerCase()
    : null;
  const planKey =
    (storedPlanKey && INSURANCE_PACKAGES[storedPlanKey] ? storedPlanKey : null)
    || inferInsurancePlanKeyFromStoredValues(aircraft)
    || DEFAULT_INSURANCE_PLAN;
  const plan = getInsurancePlanConfig(planKey);

  // Always resolve package values from the current config so insurance terms stay dynamic.
  return {
    planKey: plan.key,
    plan,
    maintenanceCoveragePct: plan.maintenanceCoveragePct,
    scoreBonusPct: plan.scoreBonusPct,
    hourlyRatePctOfNewValue: plan.hourlyRatePctOfNewValue,
  };
}

export function calculateInsuranceForFlight({
  aircraft,
  flightHours,
  maintenanceCost,
  companyReputation,
  baseScore,
}) {
  const hours = Math.max(0, Number(flightHours || 0));
  const rawMaintenance = Math.max(0, Number(maintenanceCost || 0));
  const newValue = Math.max(0, Number(aircraft?.purchase_price || aircraft?.current_value || 0));
  const resolved = resolveAircraftInsurance(aircraft);
  const reputationFactor = getReputationInsuranceFactor(companyReputation);
  const hourlyCost = newValue * resolved.hourlyRatePctOfNewValue * reputationFactor;
  const insuranceCost = hourlyCost * hours;
  const maintenanceCovered = rawMaintenance * Math.max(0, Math.min(1, resolved.maintenanceCoveragePct));
  const maintenanceAfterCoverage = Math.max(0, rawMaintenance - maintenanceCovered);

  const score = Math.max(0, Number(baseScore || 0));
  const scoreBonusPoints = score * Math.max(0, resolved.scoreBonusPct);

  return {
    ...resolved,
    newValue,
    reputationFactor,
    hourlyCost,
    insuranceCost,
    maintenanceCovered,
    maintenanceAfterCoverage,
    scoreBonusPoints,
  };
}
