const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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

const toSignedSinkRate = (value) => {
  const n = Math.abs(Number(value || 0));
  return n > 0 ? -Math.round(n) : 0;
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
    point?.touchdown_vspeed,
    point?.landing_vspeed,
    point?.landing_vs,
    point?.landingVs,
    point?.touchdownVs,
    point?.vs,
    point?.vertical_speed,
    point?.verticalSpeed,
    point?.vertical_speed_fpm,
    point?.verticalSpeedFpm,
    point?.vs_fpm
  );
};

const readGForce = (point) => {
  return firstFiniteNumber(
    point?.g,
    point?.g_force,
    point?.gForce,
    point?.landing_g_force,
    point?.landing_gforce,
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

  const landingWindow = sessionHistory.slice(touchdownIdx, Math.min(sessionHistory.length, touchdownIdx + 4));
  const landingPacket = landingWindow.reduce((best, point) => {
    const currentG = readGForce(point);
    if (!Number.isFinite(currentG) || currentG <= 0) return best;
    if (!best) return point;
    const bestG = readGForce(best);
    return currentG > bestG ? point : best;
  }, null) || sessionHistory[touchdownIdx];

  const resolvedG = readGForce(landingPacket);
  const rawVs = readVerticalSpeedFpm(landingPacket);
  const safeResolvedG = Number.isFinite(resolvedG) && resolvedG > 0 ? resolvedG : 0;
  let resolvedVs = safeResolvedG > 0 && Number.isFinite(rawVs) ? Math.abs(rawVs) : 0;

  if (resolvedVs > 1500 && safeResolvedG > 0) {
    resolvedVs = approximateVsFromG(safeResolvedG);
  }

  return {
    landingVs: toSignedSinkRate(clamp(resolvedVs, 0, 10000)),
    landingG: Number(clamp(safeResolvedG, 0, 6).toFixed(2)),
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
  const hasTelemetryHistory = Array.isArray(telemetryHistory) && telemetryHistory.length >= 2;
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
    xpd?.landingGForce,
    xpd?.landing_gforce
  );
  const safeStoredG = storedG > 0 && storedG < 4 ? storedG : 0;
  const storedVs = trustedStoredVs > 0 ? trustedStoredVs : legacyStoredVs;
  const safeStoredVs = (() => {
    if (storedVs > 0 && storedVs <= 1500) return storedVs;
    if (safeStoredG > 0) return approximateVsFromG(safeStoredG);
    return 0;
  })();

  const landingVs = (() => {
    if (Math.abs(derived.landingVs) > 0) return derived.landingVs;
    if (safeStoredVs > 0) return toSignedSinkRate(clamp(safeStoredVs, 0, 10000));
    if (hasTelemetryHistory) return 0;
    return 0;
  })();

  return {
    landingVs,
    landingG: derived.landingG > 0 ? Number(clamp(derived.landingG, 0, 6).toFixed(2)) : Number(clamp(safeStoredG, 0, 6).toFixed(2)),
  };
}
