export const INSURANCE_PACKAGES = {
  basic: {
    key: 'basic',
    name: { en: 'Basic Cover', de: 'Basis-Schutz' },
    description: {
      en: 'Low premium, low maintenance coverage.',
      de: 'Niedrige Prämie, geringe Wartungsabdeckung.',
    },
    hourlyRatePctOfNewValue: 0.000015,
    maintenanceCoveragePct: 0.15,
    scoreBonusPct: 0,
  },
  plus: {
    key: 'plus',
    name: { en: 'Plus Cover', de: 'Plus-Schutz' },
    description: {
      en: 'Balanced premium with meaningful maintenance coverage.',
      de: 'Ausgewogene Prämie mit spürbarer Wartungsabdeckung.',
    },
    hourlyRatePctOfNewValue: 0.00003,
    maintenanceCoveragePct: 0.4,
    scoreBonusPct: 0.03,
  },
  premium: {
    key: 'premium',
    name: { en: 'Premium Cover', de: 'Premium-Schutz' },
    description: {
      en: 'Highest premium, strongest protection and score bonus.',
      de: 'Höchste Prämie, stärkster Schutz und Score-Bonus.',
    },
    hourlyRatePctOfNewValue: 0.00005,
    maintenanceCoveragePct: 0.65,
    scoreBonusPct: 0.05,
  },
};

export const DEFAULT_INSURANCE_PLAN = 'basic';

export function getInsurancePlanConfig(planKey) {
  return INSURANCE_PACKAGES[planKey] || INSURANCE_PACKAGES[DEFAULT_INSURANCE_PLAN];
}

export function getReputationInsuranceFactor(reputation) {
  const rep = Number.isFinite(Number(reputation)) ? Number(reputation) : 50;
  const normalized = Math.max(0, Math.min(100, rep));
  // High reputation lowers premium up to -20%, low reputation raises up to +20%.
  return 1 + ((50 - normalized) / 50) * 0.2;
}

export function resolveAircraftInsurance(aircraft) {
  const planKey = aircraft?.insurance_plan || DEFAULT_INSURANCE_PLAN;
  const plan = getInsurancePlanConfig(planKey);
  return {
    planKey: plan.key,
    plan,
    maintenanceCoveragePct: Number(aircraft?.insurance_maintenance_coverage_pct ?? plan.maintenanceCoveragePct),
    scoreBonusPct: Number(aircraft?.insurance_score_bonus_pct ?? plan.scoreBonusPct),
    hourlyRatePctOfNewValue: Number(aircraft?.insurance_hourly_rate_pct ?? plan.hourlyRatePctOfNewValue),
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
