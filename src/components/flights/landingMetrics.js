const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
  const raw = point?.on_ground ?? point?.onGround ?? point?.is_on_ground ?? point?.grounded;
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

  if (airborneSeen) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (readOnGroundFlag(history[i]) === true) return i;
    }
  }

  let bestIdx = -1;
  let mostNegativeVs = Infinity;
  for (let i = 0; i < history.length; i += 1) {
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

  const start = Math.max(0, touchdownIdx - 3);
  const end = Math.min(sessionHistory.length - 1, touchdownIdx + 3);
  const window = sessionHistory.slice(start, end + 1);
  const center = touchdownIdx - start;

  let gPeakIdx = -1;
  let gPeak = 0;
  for (let i = 0; i < window.length; i += 1) {
    const g = readGForce(window[i]);
    if (Number.isFinite(g) && g > gPeak) {
      gPeak = g;
      gPeakIdx = i;
    }
  }

  const vsValues = window
    .map((point) => readVerticalSpeedFpm(point))
    .filter((value) => Number.isFinite(value));
  const touchdownVsValues = window
    .map((point) => readTouchdownVerticalSpeedFpm(point))
    .filter((value) => Number.isFinite(value) && Math.abs(value) > 0);
  const descendingVs = vsValues.filter((value) => value < 0);
  let resolvedVs = 0;
  if (gPeakIdx >= 0) {
    const gPeakPoint = window[gPeakIdx] || {};
    const fromTouchdownField = readTouchdownVerticalSpeedFpm(gPeakPoint);
    if (Number.isFinite(fromTouchdownField) && Math.abs(fromTouchdownField) > 0) {
      resolvedVs = Math.abs(fromTouchdownField);
    } else {
      const fromVerticalField = readVerticalSpeedFpm(gPeakPoint);
      if (Number.isFinite(fromVerticalField) && Math.abs(fromVerticalField) > 0) {
        resolvedVs = Math.abs(fromVerticalField);
      }
    }
  }
  if (resolvedVs <= 0 && touchdownVsValues.length > 0) {
    resolvedVs = Math.max(...touchdownVsValues.map((value) => Math.abs(value)));
  }
  if (resolvedVs <= 0 && descendingVs.length > 0) {
    resolvedVs = Math.abs(Math.min(...descendingVs));
  } else if (resolvedVs <= 0 && vsValues.length > 0) {
    const nearTouchdownVs = readVerticalSpeedFpm(window[center] || {});
    if (Number.isFinite(nearTouchdownVs) && Math.abs(nearTouchdownVs) > 0) {
      resolvedVs = Math.abs(nearTouchdownVs);
    } else {
    resolvedVs = Math.max(...vsValues.map((value) => Math.abs(value)));
    }
  }

  const gValues = window
    .map((point) => readGForce(point))
    .filter((value) => Number.isFinite(value) && value > 0);
  const resolvedG = gValues.length > 0 ? Math.max(...gValues) : 0;

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
  const sessionStartIso = flight?.departure_time || flight?.created_date || null;
  const derived = deriveLandingMetricsFromTelemetry(telemetryHistory, sessionStartIso);

  const landingPacketTrusted = !!(
    xpd?.touchdown_detected ||
    xpd?.landing_data_locked ||
    xpd?.bridge_local_landing_locked ||
    xpd?.landing_data_source === "bridge_local"
  );
  const trustedStoredVs = firstPositiveAbs(
    landingPacketTrusted ? xpd?.touchdown_vspeed : 0,
    landingPacketTrusted ? xpd?.landing_vs : 0
  );
  const legacyStoredVs = firstPositiveAbs(
    flight?.landing_vs,
    xpd?.touchdown_vspeed,
    xpd?.landing_vs
  );
  const storedG = firstPositive(
    xpd?.landing_g_force,
    xpd?.landingGForce
  );

  const landingVs = (() => {
    if (derived.landingVs > 0) return derived.landingVs;
    if (derived.landingG > 0) return Math.round(clamp(trustedStoredVs, 0, 10000));
    return Math.round(clamp(legacyStoredVs, 0, 10000));
  })();

  return {
    landingVs,
    landingG: derived.landingG > 0 ? Number(clamp(derived.landingG, 0, 6).toFixed(2)) : Number(clamp(storedG, 0, 6).toFixed(2)),
  };
}
