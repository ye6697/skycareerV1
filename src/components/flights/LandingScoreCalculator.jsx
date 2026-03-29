/**
 * Advanced Landing Score Calculator
 * 
 * Calculates a weighted landing score based on multiple factors:
 * 1. Vertical Speed (V/S) at touchdown – 30%
 * 2. G-Force at touchdown – 25%
 * 3. Flare technique (V/S smoothness before touchdown) – 20%
 * 4. Crosswind correction (heading vs wind at touchdown) – 15%
 * 5. Braking quality (deceleration smoothness after touchdown) – 10%
 */

const WEIGHTS = {
  verticalSpeed: 0.30,
  gForce: 0.25,
  flare: 0.20,
  crosswind: 0.15,
  braking: 0.10,
};

// --- Individual metric scorers (0-100 each) ---

function scoreVerticalSpeed(touchdownVs) {
  const vs = Math.abs(touchdownVs || 0);
  if (vs <= 60) return 100;        // butter
  if (vs <= 120) return 90;        // very soft
  if (vs <= 200) return 75;        // soft
  if (vs <= 400) return 55;        // acceptable
  if (vs <= 600) return 30;        // hard
  if (vs <= 800) return 10;        // very hard
  return 0;                         // crash zone
}

function scoreGForce(landingG) {
  const g = Math.abs(landingG || 1.0);
  if (g <= 1.1) return 100;        // butter
  if (g <= 1.3) return 85;         // soft
  if (g <= 1.5) return 70;         // acceptable
  if (g <= 1.8) return 45;         // firm
  if (g <= 2.2) return 20;         // hard
  return 0;                         // structural risk
}

/**
 * Flare technique: measures how smoothly the pilot reduced V/S before touchdown.
 * A good flare: V/S gradually decreases in the last ~10 seconds before touchdown.
 * A bad flare: V/S stays constant (no flare) or increases (dive).
 * "Float" penalty: if V/S goes near 0 and stays there too long before touchdown.
 * 
 * @param {number[]} vsHistory - V/S readings in the last ~15s before touchdown (most recent last)
 */
function scoreFlare(vsHistory) {
  if (!Array.isArray(vsHistory) || vsHistory.length < 3) return 50; // no data = neutral

  // Take last 10 readings (roughly last 10 seconds at 1Hz)
  const recent = vsHistory.slice(-10);
  
  // All values should be negative (descending). Convert to positive descent rates.
  const descRates = recent.map(v => Math.abs(v));
  
  // Check for progressive reduction (good flare)
  let improvements = 0;
  let totalTransitions = 0;
  for (let i = 1; i < descRates.length; i++) {
    totalTransitions++;
    if (descRates[i] < descRates[i - 1]) improvements++; // rate is decreasing = good
  }
  
  if (totalTransitions === 0) return 50;
  
  const improvementRatio = improvements / totalTransitions;
  
  // Check for float (V/S near 0 for too many consecutive readings)
  const nearZeroCount = descRates.filter(v => v < 30).length;
  const floatPenalty = nearZeroCount > 4 ? Math.min(20, (nearZeroCount - 4) * 5) : 0;
  
  // Check for initial descent rate (should be reasonable, 400-800 fpm at start of flare)
  const initialRate = descRates[0] || 0;
  const approachBonus = (initialRate >= 300 && initialRate <= 900) ? 10 : 0;
  
  // Final flare score
  const baseScore = improvementRatio * 80 + approachBonus;
  return Math.max(0, Math.min(100, Math.round(baseScore - floatPenalty)));
}

/**
 * Crosswind correction: measures how well the pilot aligned with runway heading
 * despite crosswind. Uses the crab angle (difference between heading and track).
 * 
 * @param {number} headingAtTouchdown - Aircraft heading at moment of touchdown
 * @param {number} windDirection - Wind direction in degrees (where wind is coming FROM)
 * @param {number} windSpeed - Wind speed in knots
 * @param {number} runwayHeading - Runway heading (if available), or track heading
 */
function scoreCrosswind(headingAtTouchdown, windDirection, windSpeed, runwayHeading) {
  // If no wind data, give neutral score
  if (!windSpeed || windSpeed < 3) return 85; // calm wind = easy, still good job
  
  // Calculate crosswind component
  const rwyHdg = runwayHeading || headingAtTouchdown; // fallback to aircraft heading
  const windAngle = Math.abs(((windDirection || 0) - rwyHdg + 540) % 360 - 180);
  const crosswindKts = Math.abs(windSpeed * Math.sin(windAngle * Math.PI / 180));
  
  if (crosswindKts < 3) return 85; // negligible crosswind
  
  // How well did pilot align with runway? (heading vs runway heading)
  const alignmentError = Math.abs(((headingAtTouchdown || 0) - rwyHdg + 540) % 360 - 180);
  
  // Scale: crosswind makes alignment harder, so we're more forgiving with stronger crosswind
  const difficultyFactor = Math.min(1.5, 1 + crosswindKts / 30); // up to 1.5x forgiveness
  const adjustedError = alignmentError / difficultyFactor;
  
  if (adjustedError <= 2) return 100;   // perfect alignment
  if (adjustedError <= 5) return 85;    // excellent
  if (adjustedError <= 10) return 70;   // good
  if (adjustedError <= 15) return 50;   // acceptable
  if (adjustedError <= 25) return 30;   // poor
  return 10;                             // very poor
}

/**
 * Braking quality: measures how smoothly the pilot decelerated after touchdown.
 * Good braking: steady, progressive deceleration.
 * Bad braking: sudden jerky stops or very slow deceleration.
 * 
 * @param {number[]} speedHistory - Ground speed readings after touchdown (most recent last)
 */
function scoreBraking(speedHistory) {
  if (!Array.isArray(speedHistory) || speedHistory.length < 3) return 50; // no data = neutral
  
  // Calculate deceleration rates between consecutive readings
  const decelRates = [];
  for (let i = 1; i < speedHistory.length; i++) {
    decelRates.push(speedHistory[i - 1] - speedHistory[i]); // positive = slowing down
  }
  
  if (decelRates.length === 0) return 50;
  
  // Check that aircraft is actually decelerating
  const avgDecel = decelRates.reduce((a, b) => a + b, 0) / decelRates.length;
  if (avgDecel <= 0) return 20; // not decelerating = bad
  
  // Smoothness: standard deviation of deceleration rates (lower = smoother)
  const mean = avgDecel;
  const variance = decelRates.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / decelRates.length;
  const stdDev = Math.sqrt(variance);
  
  // Coefficient of variation: stdDev relative to mean
  const cv = mean > 0 ? stdDev / mean : 1;
  
  // Score based on smoothness
  if (cv <= 0.2) return 100;    // very smooth
  if (cv <= 0.4) return 85;     // smooth
  if (cv <= 0.6) return 70;     // acceptable
  if (cv <= 1.0) return 50;     // jerky
  return 30;                     // very jerky
}

/**
 * Calculate the complete weighted landing score.
 * 
 * @param {object} params
 * @param {number} params.touchdownVs - Vertical speed at touchdown (ft/min, negative = descending)
 * @param {number} params.landingGForce - G-force at moment of touchdown
 * @param {number[]} params.vsHistory - V/S readings before touchdown (last ~15s)
 * @param {number} params.headingAtTouchdown - Aircraft heading at touchdown
 * @param {number} params.windDirection - Wind direction (degrees)
 * @param {number} params.windSpeed - Wind speed (knots)
 * @param {number} [params.runwayHeading] - Runway heading if known
 * @param {number[]} params.speedAfterTouchdown - Speed readings after touchdown
 * @returns {object} Detailed scoring breakdown
 */
export function calculateAdvancedLandingScore(params) {
  const {
    touchdownVs = 0,
    landingGForce = 1.0,
    vsHistory = [],
    headingAtTouchdown = 0,
    windDirection = 0,
    windSpeed = 0,
    runwayHeading = null,
    speedAfterTouchdown = [],
  } = params;

  const scores = {
    verticalSpeed: scoreVerticalSpeed(touchdownVs),
    gForce: scoreGForce(landingGForce),
    flare: scoreFlare(vsHistory),
    crosswind: scoreCrosswind(headingAtTouchdown, windDirection, windSpeed, runwayHeading),
    braking: scoreBraking(speedAfterTouchdown),
  };

  const weightedTotal = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => {
    return sum + (scores[key] * weight);
  }, 0);

  const totalScore = Math.max(0, Math.min(100, Math.round(weightedTotal)));

  // Determine overall grade
  let grade, gradeLabel, gradeColor;
  if (totalScore >= 90) { grade = 'A+'; gradeLabel = 'Butterweich!'; gradeColor = 'amber'; }
  else if (totalScore >= 80) { grade = 'A'; gradeLabel = 'Exzellent'; gradeColor = 'emerald'; }
  else if (totalScore >= 70) { grade = 'B'; gradeLabel = 'Sehr Gut'; gradeColor = 'emerald'; }
  else if (totalScore >= 60) { grade = 'C'; gradeLabel = 'Gut'; gradeColor = 'blue'; }
  else if (totalScore >= 45) { grade = 'D'; gradeLabel = 'Akzeptabel'; gradeColor = 'amber'; }
  else if (totalScore >= 25) { grade = 'E'; gradeLabel = 'Hart'; gradeColor = 'orange'; }
  else { grade = 'F'; gradeLabel = 'Gefährlich'; gradeColor = 'red'; }

  return {
    totalScore,
    grade,
    gradeLabel,
    gradeColor,
    scores,
    weights: WEIGHTS,
    details: {
      touchdownVs: Math.abs(touchdownVs),
      landingGForce,
      crosswindKts: windSpeed > 0 ? Math.abs(windSpeed * Math.sin(
        Math.abs(((windDirection || 0) - (runwayHeading || headingAtTouchdown) + 540) % 360 - 180) * Math.PI / 180
      )) : 0,
      flareDataPoints: vsHistory.length,
      brakingDataPoints: speedAfterTouchdown.length,
    }
  };
}

export { WEIGHTS };