export const INSURANCE_PACKAGES = {
  basic: {
    key: 'basic',
    name: { en: 'Basic Cover', de: 'Basis-Schutz' },
    description: {
      en: 'Lowest fees with limited maintenance coverage.',
      de: 'Niedrige Gebuehren mit begrenzter Wartungsabdeckung.',
    },
    hourlyRatePctOfNewValue: 0.00007,
    maintenanceCoveragePct: 0.2,
    scoreBonusPct: 0,
  },
  plus: {
    key: 'plus',
    name: { en: 'Plus Cover', de: 'Plus-Schutz' },
    description: {
      en: 'Higher fees with strong maintenance protection.',
      de: 'Hoehere Gebuehren mit starkem Wartungsschutz.',
    },
    hourlyRatePctOfNewValue: 0.00018,
    maintenanceCoveragePct: 0.48,
    scoreBonusPct: 0.02,
  },
  premium: {
    key: 'premium',
    name: { en: 'Premium Cover', de: 'Premium-Schutz' },
    description: {
      en: 'Very high fees, maximum protection and top score bonus.',
      de: 'Sehr hohe Gebuehren, maximaler Schutz und bester Score-Bonus.',
    },
    hourlyRatePctOfNewValue: 0.00055,
    maintenanceCoveragePct: 0.8,
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

  // Strong dynamic pricing:
  // - High reputation (100) => up to 30% lower fees (factor 0.70)
  // - Low reputation (0) => up to 180% higher fees (factor 2.80)
  if (normalized >= 50) {
    return 1 - ((normalized - 50) / 50) * 0.3;
  }
  return 1 + ((50 - normalized) / 50) * 1.8;
}

export function resolveAircraftInsurance(aircraft) {
  const planKey = aircraft?.insurance_plan || DEFAULT_INSURANCE_PLAN;
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
