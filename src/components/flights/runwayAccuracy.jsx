// Runway accuracy utilities
// Computes how "straight" the takeoff roll and the final landing approach/rollout were,
// as a proxy for how well the pilot held the runway centerline.
//
// Method (no runway database required):
// 1) Extract the contiguous "on ground" telemetry samples around the takeoff and the landing.
// 2) Fit a best-fit straight line through those samples (ideal runway track).
// 3) Measure each sample's perpendicular distance to that line (in meters).
// 4) Report the RMS (root-mean-square) lateral deviation as the centerline accuracy metric.
//
// Lower RMS = straighter track = closer to centerline.

const EARTH_RADIUS_M = 6371000;

const toRad = (deg) => (Number(deg) * Math.PI) / 180;

const readNumber = (...values) => {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
};

const readOnGround = (point) => {
  const raw = point?.on_ground ?? point?.onGround ?? point?.grounded;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw > 0.5;
  if (typeof raw === "string") {
    const s = raw.trim().toLowerCase();
    if (["1", "true", "yes", "on", "ground"].includes(s)) return true;
    if (["0", "false", "no", "off", "air"].includes(s)) return false;
  }
  return null;
};

const readSpeedKts = (point) => readNumber(point?.spd, point?.speed, point?.gs, point?.ground_speed);

// Convert lat/lon to local XY meters around a reference point (equirectangular approximation).
const projectToLocalMeters = (points, refLat, refLon) => {
  const cosRef = Math.cos(toRad(refLat));
  return points.map((p) => {
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    const x = toRad(lon - refLon) * EARTH_RADIUS_M * cosRef; // east
    const y = toRad(lat - refLat) * EARTH_RADIUS_M;          // north
    return { x, y };
  });
};

// Fit a line through 2D points using total least squares (minimizes perpendicular distance).
// Returns { valid, rmsDeviation, maxDeviation, sampleCount, lengthMeters }.
const fitLineAndMeasureDeviation = (xyPoints) => {
  if (!Array.isArray(xyPoints) || xyPoints.length < 3) {
    return { valid: false, rmsDeviation: 0, maxDeviation: 0, sampleCount: xyPoints?.length || 0, lengthMeters: 0 };
  }
  const n = xyPoints.length;
  let sumX = 0, sumY = 0;
  for (const p of xyPoints) { sumX += p.x; sumY += p.y; }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let sxx = 0, syy = 0, sxy = 0;
  for (const p of xyPoints) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  // Direction of best-fit line = largest eigenvector of covariance matrix.
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const dirX = Math.cos(theta);
  const dirY = Math.sin(theta);
  // Perpendicular unit vector
  const perpX = -dirY;
  const perpY = dirX;

  let sumSq = 0;
  let maxAbs = 0;
  let minProj = Infinity;
  let maxProj = -Infinity;
  for (const p of xyPoints) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    const perpDist = dx * perpX + dy * perpY;
    const alongDist = dx * dirX + dy * dirY;
    sumSq += perpDist * perpDist;
    const abs = Math.abs(perpDist);
    if (abs > maxAbs) maxAbs = abs;
    if (alongDist < minProj) minProj = alongDist;
    if (alongDist > maxProj) maxProj = alongDist;
  }

  const rms = Math.sqrt(sumSq / n);
  const lengthMeters = Number.isFinite(minProj) && Number.isFinite(maxProj) ? (maxProj - minProj) : 0;

  return {
    valid: lengthMeters >= 100, // need at least 100 m of ground track for a meaningful fit
    rmsDeviation: rms,
    maxDeviation: maxAbs,
    sampleCount: n,
    lengthMeters,
  };
};

const extractCoordinate = (point) => {
  const lat = readNumber(point?.lat, point?.latitude);
  const lon = readNumber(point?.lon, point?.longitude, point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) < 0.5 && Math.abs(lon) < 0.5) return null;
  return { lat, lon };
};

// Find the index of the first airborne sample (liftoff).
const findLiftoffIndex = (history) => {
  let onGroundSeen = false;
  for (let i = 0; i < history.length; i += 1) {
    const og = readOnGround(history[i]);
    if (og === true) onGroundSeen = true;
    if (onGroundSeen && og === false) {
      return i;
    }
  }
  return -1;
};

// Find the index of touchdown (first on_ground after airborne).
const findTouchdownIndex = (history) => {
  let airborneSeen = false;
  for (let i = 0; i < history.length; i += 1) {
    const og = readOnGround(history[i]);
    if (og === false) airborneSeen = true;
    if (airborneSeen && og === true) {
      return i;
    }
  }
  return -1;
};

// Collect the takeoff roll: samples on_ground with increasing speed ending at liftoff.
const collectTakeoffRollPoints = (history) => {
  const liftoffIdx = findLiftoffIndex(history);
  if (liftoffIdx < 2) return [];
  // Walk backwards from liftoff-1 as long as on_ground and speed > 20 kts (moving).
  const rollPoints = [];
  for (let i = liftoffIdx - 1; i >= 0; i -= 1) {
    const og = readOnGround(history[i]);
    if (og !== true) break;
    const spd = readSpeedKts(history[i]);
    if (!Number.isFinite(spd) || spd < 20) break;
    const coord = extractCoordinate(history[i]);
    if (!coord) break;
    rollPoints.unshift(coord);
    if (rollPoints.length > 120) break;
  }
  return rollPoints;
};

// Collect the landing rollout: from touchdown forward as long as on_ground and speed > 20 kts.
const collectLandingRollPoints = (history) => {
  const tdIdx = findTouchdownIndex(history);
  if (tdIdx < 0) return [];
  const rollPoints = [];
  // Include a couple of samples before touchdown to capture flare/crab crossing centerline.
  const startIdx = Math.max(0, tdIdx - 2);
  for (let i = startIdx; i < history.length; i += 1) {
    const og = readOnGround(history[i]);
    if (i > tdIdx + 1 && og !== true) break;
    const spd = readSpeedKts(history[i]);
    if (i > tdIdx + 2 && Number.isFinite(spd) && spd < 20) break;
    const coord = extractCoordinate(history[i]);
    if (!coord) continue;
    rollPoints.push(coord);
    if (rollPoints.length > 120) break;
  }
  return rollPoints;
};

const computeAccuracyFromPoints = (points) => {
  if (!Array.isArray(points) || points.length < 3) {
    return { valid: false, rmsMeters: 0, maxMeters: 0, sampleCount: points?.length || 0, lengthMeters: 0 };
  }
  const ref = points[Math.floor(points.length / 2)];
  const xy = projectToLocalMeters(points, ref.lat, ref.lon);
  const fit = fitLineAndMeasureDeviation(xy);
  return {
    valid: fit.valid,
    rmsMeters: fit.rmsDeviation,
    maxMeters: fit.maxDeviation,
    sampleCount: fit.sampleCount,
    lengthMeters: fit.lengthMeters,
  };
};

// Main entry point: compute takeoff + landing centerline accuracy from telemetry_history.
export function computeRunwayAccuracy(telemetryHistory) {
  const history = Array.isArray(telemetryHistory) ? telemetryHistory : [];
  if (history.length < 5) {
    return { takeoff: null, landing: null };
  }

  const takeoffPoints = collectTakeoffRollPoints(history);
  const landingPoints = collectLandingRollPoints(history);

  const takeoff = computeAccuracyFromPoints(takeoffPoints);
  const landing = computeAccuracyFromPoints(landingPoints);

  return {
    takeoff: takeoff.valid ? takeoff : null,
    landing: landing.valid ? landing : null,
  };
}

// Convert a single accuracy measurement (rmsMeters) into a score delta and cash delta.
// Lower rms = better. Thresholds are in meters of average lateral deviation.
//  - <= 2 m   : excellent  -> +5 score, +3% payout bonus
//  - <= 5 m   : good       -> +2 score, +1% payout bonus
//  - <= 10 m  : acceptable -> 0 score, 0 cash
//  - <= 20 m  : sloppy     -> -3 score, -1% payout penalty
//  - >  20 m  : poor       -> -6 score, -2% payout penalty
export function evaluateRunwayAccuracy(rmsMeters, basePayout = 0) {
  const rms = Math.max(0, Number(rmsMeters) || 0);
  let qualityKey = "acceptable";
  let scoreDelta = 0;
  let cashPct = 0;

  if (rms <= 2) {
    qualityKey = "excellent";
    scoreDelta = 5;
    cashPct = 0.03;
  } else if (rms <= 5) {
    qualityKey = "good";
    scoreDelta = 2;
    cashPct = 0.01;
  } else if (rms <= 10) {
    qualityKey = "acceptable";
    scoreDelta = 0;
    cashPct = 0;
  } else if (rms <= 20) {
    qualityKey = "sloppy";
    scoreDelta = -3;
    cashPct = -0.01;
  } else {
    qualityKey = "poor";
    scoreDelta = -6;
    cashPct = -0.02;
  }

  const cashDelta = Math.round(Math.max(0, Number(basePayout) || 0) * cashPct);
  return { qualityKey, scoreDelta, cashDelta, cashPct };
}

export const RUNWAY_QUALITY_COLOR = {
  excellent: "text-emerald-400",
  good: "text-green-400",
  acceptable: "text-amber-400",
  sloppy: "text-orange-400",
  poor: "text-red-400",
};

export const RUNWAY_QUALITY_LABEL = {
  en: {
    excellent: "Excellent",
    good: "Good",
    acceptable: "Acceptable",
    sloppy: "Sloppy",
    poor: "Poor",
  },
  de: {
    excellent: "Ausgezeichnet",
    good: "Gut",
    acceptable: "Akzeptabel",
    sloppy: "Unsauber",
    poor: "Schlecht",
  },
};