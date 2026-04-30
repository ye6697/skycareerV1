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

const findTouchdownIndex = (history) => {
  let airborneSeen = false;
  let touchdownIdx = -1;

  for (let i = 0; i < history.length; i += 1) {
    const currentOnGround = readOnGroundFlag(history[i]);
    if (currentOnGround === false) {
      airborneSeen = true;
    }
    if (i <= 0 || !airborneSeen) continue;
    const prevOnGround = readOnGroundFlag(history[i - 1]);
    if (prevOnGround === false && currentOnGround === true) {
      touchdownIdx = i;
    }
  }

  if (touchdownIdx >= 0) return touchdownIdx;

  // Fallback: find last on_ground point only if we actually saw airborne state
  if (airborneSeen) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (readOnGroundFlag(history[i]) === true) return i;
    }
  }

  // Last resort: find most negative V/S, but ONLY in the last 15% of the flight
  // to avoid picking a cruise-descent point 10+ minutes before landing.
  const searchStart = Math.max(0, Math.floor(history.length * 0.85));
  let bestIdx = -1;
  let mostNegativeVs = Infinity;
  for (let i = searchStart; i < history.length; i += 1) {
    const vs = readVerticalSpeedFpm(history[i]);
    if (!Number.isFinite(vs)) continue;
    if (vs < mostNegativeVs) {
      mostNegativeVs = vs;
      bestIdx = i;
    }
  }
  return bestIdx;
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

  // Use the EXACT telemetry sample at the touchdown moment — same data the
  // FlightProfileChart displays. No window-max, no approximation — so the
  // result card matches the chart 1:1.
  const tdPoint = sessionHistory[touchdownIdx] || {};
  const tdVsRaw = readTouchdownVerticalSpeedFpm(tdPoint);
  const vsRaw = Number.isFinite(tdVsRaw) && Math.abs(tdVsRaw) > 0
    ? tdVsRaw
    : readVerticalSpeedFpm(tdPoint);
  const gRaw = readGForce(tdPoint);

  let resolvedVs = Number.isFinite(vsRaw) ? Math.abs(vsRaw) : 0;
  const resolvedG = Number.isFinite(gRaw) && gRaw > 0 ? gRaw : 0;

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