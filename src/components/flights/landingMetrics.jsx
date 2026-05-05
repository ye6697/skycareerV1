const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Approximate touchdown vertical speed (ft/min) from landing G-force.
// Based on simplified impact dynamics: heavier G at touchdown implies
// higher sink rate. Calibrated to typical airliner data:
//   1.0 G  = ~0 fpm (butter), 1.3 G = ~200 fpm, 1.5 G = ~350 fpm,
//   1.8 G = ~550 fpm, 2.0 G = ~700 fpm, 2.5 G = ~1000 fpm.
const approximateVsFromG = (gForce) => {
  const g = Number(gForce);
  if (!Number.isFinite(g) || g <= 1.0) return 0;
  return Math.round((g - 1.0) * 700);
};

const firstFiniteNumber = (...values) => {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
};

const parseTimestampMs = (value) => {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : NaN;
};

const readTelemetryPointTimestampMs = (point) => {
  return parseTimestampMs(
    point?.t ||
    point?.timestamp ||
    point?.created_date ||
    point?.time ||
    null
  );
};

const readOnGroundFlag = (point) => {
  const raw = point?.on_ground ?? point?.onGround ?? point?.is_on_ground ?? point?.grounded ?? point?.og;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw > 0.5;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["1", "true", "yes", "on", "ground"].includes(normalized)) return true;
    if (["0", "false", "no", "off", "air"].includes(normalized)) return false;
  }
  return null;
};

const readVerticalSpeedFpm = (point) => {
  return firstFiniteNumber(
    point?.vs,
    point?.vertical_speed,
    point?.verticalSpeed,
    point?.vertical_speed_fpm,
    point?.verticalSpeedFpm,
    point?.vs_fpm,
    point?.touchdown_vspeed
  );
};

const readTouchdownVerticalSpeedFpm = (point) => {
  return firstFiniteNumber(
    point?.touchdown_vspeed,
    point?.touchdownVs,
    point?.landing_vs,
    point?.landingVs
  );
};

const readGForce = (point) => {
  return firstFiniteNumber(
    point?.g,
    point?.g_force,
    point?.gForce,
    point?.landing_g_force,
    point?.landingGForce
  );
};

const filterTelemetryHistoryForSession = (telemetryHistory, sessionStartIso) => {
  const history = Array.isArray(telemetryHistory) ? telemetryHistory : [];
  const sessionStartMs = parseTimestampMs(sessionStartIso);
  if (!Number.isFinite(sessionStartMs)) return history;

  const minTs = sessionStartMs - 5000;
  const withTimestamp = history.filter((point) => Number.isFinite(readTelemetryPointTimestampMs(point)));
  if (withTimestamp.length >= 2) {
    return withTimestamp.filter((point) => readTelemetryPointTimestampMs(point) >= minTs);
  }
  return history;
};

const readSpeed = (point) => firstFiniteNumber(
  point?.spd, point?.speed, point?.gs, point?.ground_speed, point?.ias,
);

// Find true touchdown: an airborne→ground transition (with sustained airborne
// before, sustained ground after) AND the aircraft moving with realistic
// landing speed (>30 kts). This prevents picking initial taxi spikes or
// momentary glitches mid-flight where on_ground briefly toggles.
const findTouchdownIndex = (history) => {
  // 1) Find the LAST stable airborne→ground transition with these guards:
  //    - At least 5 consecutive airborne samples before (real approach, not a spike)
  //    - At least 3 consecutive ground samples after (or end of history)
  //    - Speed > 40 kts at touchdown sample (firmly rolling, not still floating)
  //    - Sample BEFORE touchdown also had reasonable approach speed (>= 60 kts)
  //      so we don't pick up a brief on_ground glitch while still high in the air.
  let touchdownIdx = -1;
  for (let i = 1; i < history.length; i += 1) {
    if (readOnGroundFlag(history[i]) !== true) continue;
    if (readOnGroundFlag(history[i - 1]) !== false) continue;
    const spd = readSpeed(history[i]);
    if (Number.isFinite(spd) && spd < 40) continue;
    const prevSpd = readSpeed(history[i - 1]);
    if (Number.isFinite(prevSpd) && prevSpd < 60) continue;

    // Verify sustained airborne BEFORE (looking back up to 8 samples)
    let airborneBeforeCount = 0;
    for (let j = i - 1; j >= Math.max(0, i - 8); j -= 1) {
      if (readOnGroundFlag(history[j]) === false) airborneBeforeCount += 1;
      else break;
    }
    if (airborneBeforeCount < 5) continue;

    // Verify sustained ground AFTER (looking forward up to 5 samples)
    let groundAfterCount = 1;
    for (let j = i + 1; j < Math.min(history.length, i + 6); j += 1) {
      const og = readOnGroundFlag(history[j]);
      if (og === true || og === null) groundAfterCount += 1;
      else break;
    }
    // If we're at the very end of telemetry, accept fewer trailing samples
    const remaining = history.length - 1 - i;
    if (remaining >= 3 && groundAfterCount < 3) continue;

    touchdownIdx = i; // keep updating to find LAST valid transition
  }
  if (touchdownIdx >= 0) return touchdownIdx;

  // 2) Fallback: only look in the last 15% of history for a touchdown.
  //    Find the FIRST on_ground=true sample with speed >30 kts in that range,
  //    after seeing airborne in the same window.
  const searchStart = Math.max(0, Math.floor(history.length * 0.85));
  let airborneSeenLate = false;
  for (let i = searchStart; i < history.length; i += 1) {
    const og = readOnGroundFlag(history[i]);
    if (og === false) airborneSeenLate = true;
    if (airborneSeenLate && og === true) {
      const spd = readSpeed(history[i]);
      if (!Number.isFinite(spd) || spd >= 30) return i;
    }
  }
  return -1;
};

export function deriveLandingMetricsFromTelemetry(telemetryHistory, sessionStartIso) {
  const sessionHistory = filterTelemetryHistoryForSession(telemetryHistory, sessionStartIso);
  if (!Array.isArray(sessionHistory) || sessionHistory.length === 0) {
    return { landingVs: 0, landingG: 0, source: "none" };
  }

  const touchdownIdx = findTouchdownIndex(sessionHistory);
  if (touchdownIdx < 0) {
    return { landingVs: 0, landingG: 0, source: "none" };
  }

  // Use the last 6 samples around touchdown for peak landing values.
  const start = Math.max(0, touchdownIdx - 2);
  const end = Math.min(sessionHistory.length - 1, touchdownIdx + 3);
  const window = sessionHistory.slice(start, end + 1);

  const touchdownVsValues = window
    .map((point) => readTouchdownVerticalSpeedFpm(point))
    .filter((value) => Number.isFinite(value) && Math.abs(value) > 0);
  const vsValues = window
    .map((point) => readVerticalSpeedFpm(point))
    .filter((value) => Number.isFinite(value));
  const descendingVs = vsValues.filter((value) => value < 0);
  let resolvedVs = 0;
  if (touchdownVsValues.length > 0) {
    resolvedVs = Math.max(...touchdownVsValues.map((value) => Math.abs(value)));
  }
  if (resolvedVs <= 0 && descendingVs.length > 0) {
    resolvedVs = Math.abs(Math.min(...descendingVs));
  } else if (resolvedVs <= 0 && vsValues.length > 0) {
    resolvedVs = Math.max(...vsValues.map((value) => Math.abs(value)));
  }

  const gValues = window
    .map((point) => readGForce(point))
    .filter((value) => Number.isFinite(value) && value > 0);
  const resolvedG = gValues.length > 0 ? Math.max(...gValues) : 0;

  // Sanitize: real touchdown V/S is 0..1500 fpm. Higher values are sensor
  // spikes — approximate from G instead.
  if (resolvedVs > 1500 && resolvedG > 0) {
    resolvedVs = approximateVsFromG(resolvedG);
  }

  return {
    landingVs: Math.round(clamp(resolvedVs, 0, 10000)),
    landingG: Number(clamp(resolvedG, 0, 6).toFixed(2)),
    source: "telemetry",
  };
}

const firstPositiveAbs = (...values) => {
  for (const value of values) {
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    const abs = Math.abs(n);
    if (abs > 0) return abs;
  }
  return 0;
};

const firstPositive = (...values) => {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

export function resolveLandingMetricsFromFlight(flight) {
  const xpd = flight?.xplane_data || {};
  const telemetryHistory = xpd.telemetry_history || xpd.telemetryHistory || xpd.profile_history || xpd.flight_profile || [];

  // Preferred path: derive from telemetry_history (same as chart + 3D replay).
  if (Array.isArray(telemetryHistory) && telemetryHistory.length >= 2) {
    const derived = deriveLandingMetricsFromTelemetry(
      telemetryHistory,
      xpd.airborne_started_at || xpd.session_started_at || null
    );
    if (derived && (derived.landingVs > 0 || derived.landingG > 0)) {
      return { landingVs: derived.landingVs, landingG: derived.landingG };
    }
  }

  // Fallback: use bridge-stored landing fields but sanitize unrealistic spikes.
  // A real airliner touchdown is between 0 and ~1000 fpm. Anything above 1500 fpm
  // is a sensor spike (the bridge sometimes logs 5000+ fpm garbage values).
  // In that case approximate V/S from landing G-force instead.
  // Reads both snake_case and camelCase variants of the bridge fields.
  const bridgeG = firstPositive(xpd.landing_g_force, xpd.landingGForce, xpd.landing_gforce);
  const bridgeVs = firstPositiveAbs(xpd.touchdown_vspeed, xpd.landingVs, xpd.landing_vs, xpd.touchdownVs);
  const safeG = bridgeG > 0 && bridgeG < 4 ? bridgeG : 0;
  let safeVs = 0;
  if (bridgeVs > 0 && bridgeVs <= 1500) {
    safeVs = bridgeVs;
  } else if (safeG > 0) {
    safeVs = approximateVsFromG(safeG);
  }

  return { landingVs: Math.round(safeVs), landingG: Number(safeG.toFixed(2)) };
}
