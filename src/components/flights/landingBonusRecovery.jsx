// Recompute landing bonus/penalty + landingType from a final authoritative
// touchdown G-force when the live reducer missed setting them (e.g. when
// landing_data_trusted arrived late, or the bridge sent g_force=0 at touchdown).
//
// Without this recovery the post-flight UI shows a "Bonus +$XX,XXX" preview
// based on G-force, but the actual bonus stored on the flight (and added to
// the company balance) stays at 0.
//
// Returns either the original finalFlightData (if no recovery needed) or a
// shallow-merged copy with corrected landingType/landingScoreChange/
// landingBonus/landingMaintenanceCost.
export function recoverLandingBonus(finalFlightData, contract) {
  const finalG = Number(finalFlightData?.landingGForce || 0);
  const totalRevenueBase = Number(contract?.payout || 0);
  const hasNoBonusYet = !Number(finalFlightData?.landingBonus || 0)
    && !Number(finalFlightData?.landingMaintenanceCost || 0);
  if (finalG <= 0 || totalRevenueBase <= 0 || !hasNoBonusYet || finalFlightData?.events?.crash) {
    return finalFlightData;
  }

  let recoveredType = finalFlightData.landingType || null;
  let recoveredScoreChange = Number(finalFlightData.landingScoreChange || 0);
  let recoveredBonus = 0;
  let recoveredPenalty = 0;
  if (finalG < 1.0) {
    recoveredType = recoveredType || 'butter';
    recoveredScoreChange = recoveredScoreChange || 40;
    recoveredBonus = totalRevenueBase * 4;
  } else if (finalG < 1.2) {
    recoveredType = recoveredType || 'soft';
    recoveredScoreChange = recoveredScoreChange || 20;
    recoveredBonus = totalRevenueBase * 2;
  } else if (finalG < 1.6) {
    recoveredType = recoveredType || 'acceptable';
    recoveredScoreChange = recoveredScoreChange || 5;
  } else if (finalG < 2.0) {
    recoveredType = recoveredType || 'hard';
    recoveredScoreChange = recoveredScoreChange || -30;
    recoveredPenalty = totalRevenueBase * 0.25;
  } else {
    recoveredType = recoveredType || 'very_hard';
    recoveredScoreChange = recoveredScoreChange || -50;
    recoveredPenalty = totalRevenueBase * 0.5;
  }

  return {
    ...finalFlightData,
    landingType: recoveredType,
    landingScoreChange: recoveredScoreChange,
    landingBonus: recoveredBonus,
    landingMaintenanceCost: recoveredPenalty,
  };
}