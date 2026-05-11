/**
 * Advanced Landing Score Calculator
 * 
 * Calculates a weighted landing score based on factors that are not
 * touchdown V/S. Sink rate is stored and displayed as telemetry only.
 */

const WEIGHTS = {
  gForce: 0.50,
  crosswind: 0.30,
  braking: 0.20,
};

// --- Individual metric scorers (0-100 each) ---

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
 * @param {number} params.landingGForce - G-force at moment of touchdown
 * @param {number} params.headingAtTouchdown - Aircraft heading at touchdown
 * @param {number} params.windDirection - Wind direction (degrees)
 * @param {number} params.windSpeed - Wind speed (knots)
 * @param {number} [params.runwayHeading] - Runway heading if known
 * @param {number[]} params.speedAfterTouchdown - Speed readings after touchdown
 * @returns {object} Detailed scoring breakdown
 */
export function calculateAdvancedLandingScore(params) {
  const {
    landingGForce = 1.0,
    headingAtTouchdown = 0,
    windDirection = 0,
    windSpeed = 0,
    runwayHeading = null,
    speedAfterTouchdown = [],
  } = params;

  const scores = {
    gForce: scoreGForce(landingGForce),
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
      landingGForce,
      crosswindKts: windSpeed > 0 ? Math.abs(windSpeed * Math.sin(
        Math.abs(((windDirection || 0) - (runwayHeading || headingAtTouchdown) + 540) % 360 - 180) * Math.PI / 180
      )) : 0,
      brakingDataPoints: speedAfterTouchdown.length,
    }
  };
}

export { WEIGHTS };
