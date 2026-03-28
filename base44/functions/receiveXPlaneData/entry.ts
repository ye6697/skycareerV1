import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

const COMPANY_CACHE_TTL_MS = 5 * 60 * 1000;
const ACTIVE_FLIGHT_CACHE_TTL_MS = 15 * 1000;
const NO_ACTIVE_FLIGHT_CACHE_TTL_MS = 2500;

const companyByApiKeyCache = new Map();
const companyRefreshInFlight = new Map();
const activeFlightByCompanyCache = new Map();
const activeFlightRefreshInFlight = new Map();

const cloneValue = (value) => {
  if (value === undefined || value === null) return value;
  try {
    return structuredClone(value);
  } catch (_) {
    return value;
  }
};

const fetchCompanyByApiKey = async (base44, apiKey) => {
  const companies = await base44.asServiceRole.entities.Company.filter({ xplane_api_key: apiKey });
  return companies[0] || null;
};

const setCompanyCache = (apiKey, company, ttlMs = COMPANY_CACHE_TTL_MS) => {
  companyByApiKeyCache.set(apiKey, {
    company: cloneValue(company),
    expiresAt: Date.now() + ttlMs,
  });
};

const refreshCompanyCacheAsync = (base44, apiKey) => {
  if (companyRefreshInFlight.has(apiKey)) return;
  const p = (async () => {
    try {
      const fresh = await fetchCompanyByApiKey(base44, apiKey);
      if (fresh) setCompanyCache(apiKey, fresh);
      else companyByApiKeyCache.delete(apiKey);
    } catch (_) {
      // Keep stale cache on refresh errors.
    } finally {
      companyRefreshInFlight.delete(apiKey);
    }
  })();
  companyRefreshInFlight.set(apiKey, p);
};

const getCompanyByApiKeyCached = async (base44, apiKey) => {
  const now = Date.now();
  const cached = companyByApiKeyCache.get(apiKey);
  if (cached && cached.expiresAt > now) {
    return cloneValue(cached.company);
  }
  if (cached?.company) {
    refreshCompanyCacheAsync(base44, apiKey);
    return cloneValue(cached.company);
  }
  const fresh = await fetchCompanyByApiKey(base44, apiKey);
  if (!fresh) return null;
  setCompanyCache(apiKey, fresh);
  return cloneValue(fresh);
};

const fetchActiveFlightForCompany = async (base44, companyId) => {
  const flights = await base44.asServiceRole.entities.Flight.filter({
    company_id: companyId,
    status: "in_flight",
  });
  return flights[0] || null;
};

const setActiveFlightCache = (
  companyId,
  flight,
  ttlMs = flight ? ACTIVE_FLIGHT_CACHE_TTL_MS : NO_ACTIVE_FLIGHT_CACHE_TTL_MS,
) => {
  activeFlightByCompanyCache.set(companyId, {
    flight: cloneValue(flight),
    expiresAt: Date.now() + ttlMs,
  });
};

const refreshActiveFlightCacheAsync = (base44, companyId) => {
  if (activeFlightRefreshInFlight.has(companyId)) return;
  const p = (async () => {
    try {
      const fresh = await fetchActiveFlightForCompany(base44, companyId);
      setActiveFlightCache(companyId, fresh);
    } catch (_) {
      // Keep stale cache on refresh errors.
    } finally {
      activeFlightRefreshInFlight.delete(companyId);
    }
  })();
  activeFlightRefreshInFlight.set(companyId, p);
};

const getActiveFlightForCompanyCached = async (base44, companyId) => {
  const now = Date.now();
  const cached = activeFlightByCompanyCache.get(companyId);
  if (cached && cached.expiresAt > now) {
    return cloneValue(cached.flight);
  }
  if (cached) {
    // If we have a stale active flight, return it immediately and refresh in background.
    // If we have stale "no flight", do a blocking refresh so newly started flights are detected quickly.
    if (cached.flight) {
      refreshActiveFlightCacheAsync(base44, companyId);
      return cloneValue(cached.flight);
    }
  }
  const fresh = await fetchActiveFlightForCompany(base44, companyId);
  setActiveFlightCache(companyId, fresh);
  return cloneValue(fresh);
};

const patchActiveFlightCache = (companyId, partialFlight) => {
  const now = Date.now();
  const cached = activeFlightByCompanyCache.get(companyId);
  const prevFlight = cached?.flight && typeof cached.flight === "object" ? cached.flight : {};
  const merged = { ...prevFlight, ...partialFlight };
  const expiresAt = Number(cached?.expiresAt ?? 0) > now
    ? Number(cached.expiresAt)
    : (now + ACTIVE_FLIGHT_CACHE_TTL_MS);
  activeFlightByCompanyCache.set(companyId, {
    flight: cloneValue(merged),
    expiresAt,
  });
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const reqStartedAtMs = Date.now();
    const haversineNm = (lat1, lon1, lat2, lon2) => {
      const R = 3440.065;
      const toRad = (d) => d * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };
    const routeTotalNm = (wps) => {
      if (!Array.isArray(wps) || wps.length < 2) return 0;
      let total = 0;
      for (let i = 0; i < wps.length - 1; i++) {
        total += haversineNm(wps[i].lat, wps[i].lon, wps[i + 1].lat, wps[i + 1].lon);
      }
      return total;
    };
    const pointToSegment = (pLat, pLon, aLat, aLon, bLat, bLon) => {
      const segLen = haversineNm(aLat, aLon, bLat, bLon);
      if (segLen < 0.1) {
        return { dist: haversineNm(pLat, pLon, aLat, aLon), fraction: 0 };
      }
      const dA = haversineNm(aLat, aLon, pLat, pLon);
      const dB = haversineNm(bLat, bLon, pLat, pLon);
      let fraction = (dA * dA - dB * dB + segLen * segLen) / (2 * segLen * segLen);
      fraction = Math.max(0, Math.min(1, fraction));
      const projLat = aLat + fraction * (bLat - aLat);
      const projLon = aLon + fraction * (bLon - aLon);
      return { dist: haversineNm(pLat, pLon, projLat, projLon), fraction };
    };
    const distanceAlongRouteNm = (routePoints, curLat, curLon) => {
      if (!Array.isArray(routePoints) || routePoints.length < 2) return { totalRemaining: 0, closestSegIdx: 0, closestFraction: 0 };
      let minDist = Infinity;
      let closestSegIdx = 0;
      let closestFraction = 0;
      for (let i = 0; i < routePoints.length - 1; i++) {
        const r = pointToSegment(
          curLat,
          curLon,
          routePoints[i].lat,
          routePoints[i].lon,
          routePoints[i + 1].lat,
          routePoints[i + 1].lon
        );
        if (r.dist < minDist) {
          minDist = r.dist;
          closestSegIdx = i;
          closestFraction = r.fraction;
        }
      }
      const segLen = haversineNm(
        routePoints[closestSegIdx].lat,
        routePoints[closestSegIdx].lon,
        routePoints[closestSegIdx + 1].lat,
        routePoints[closestSegIdx + 1].lon
      );
      let rem = segLen * (1 - closestFraction);
      for (let j = closestSegIdx + 1; j < routePoints.length - 1; j++) {
        rem += haversineNm(
          routePoints[j].lat,
          routePoints[j].lon,
          routePoints[j + 1].lat,
          routePoints[j + 1].lon
        );
      }
      return {
        totalRemaining: Math.max(0, Math.round(rem)),
        closestSegIdx,
        closestFraction,
      };
    };
    const toHudAscii = (v, fallback = "") => {
      const base = (v === undefined || v === null) ? fallback : String(v);
      const noDiacritics = base.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
      const cleaned = noDiacritics.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
      if (cleaned.length > 0) {
        const alphaNum = cleaned.replace(/[^A-Za-z0-9]/g, "");
        if (alphaNum.length > 0) return cleaned;
      }
      const fb = String(fallback ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, " ").trim();
      return fb;
    };
    const sanitizeWpToken = (v, fallback = "") => {
      const tok = toHudAscii(v, fallback)
        .toUpperCase()
        .replace(/[^A-Z0-9+\-]/g, "")
        .trim();
      if (tok.length > 0) return tok;
      const fb = toHudAscii(fallback, "WP")
        .toUpperCase()
        .replace(/[^A-Z0-9+\-]/g, "")
        .trim();
      return fb || "WP";
    };
    const routeCompact = (wps) => {
      if (!Array.isArray(wps) || wps.length === 0) return null;
      const cleanToken = (v, fallback = "") => sanitizeWpToken(v, fallback);
      const toAlt = (wp) => {
        const raw = Number(wp?.alt ?? wp?.altitude_feet ?? wp?.altitude ?? 0);
        if (!Number.isFinite(raw)) return 0;
        return Math.max(0, Math.round(raw));
      };

      // Extended compact format for FlyWithLua:
      // NAME,LAT,LON,ALT,VIA;NAME,LAT,LON,ALT,VIA...
      return wps
        .slice(0, 120)
        .map((wp, idx) => {
          const lat = Number(wp?.lat);
          const lon = Number(wp?.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          const name = cleanToken(wp?.name || wp?.ident || `WP${idx + 1}`, `WP${idx + 1}`) || `WP${idx + 1}`;
          const via = cleanToken(wp?.airway || wp?.via_airway || wp?.via || wp?.airway_ident || "DCT", "DCT") || "DCT";
          const alt = toAlt(wp);
          return `${name},${lat.toFixed(5)},${lon.toFixed(5)},${alt},${via}`;
        })
        .filter(Boolean)
        .join(";");
    };
    const aircraftCruiseSpeeds = {
      C172: 122, C182: 145, C206: 155, C208: 185, C210: 165,
      PA28: 125, PA32: 155, PA34: 170, PA46: 215, BE36: 175,
      BE58: 200, M20T: 195, SR22: 185, DA40: 147, DA42: 190,
      P28A: 125, P32R: 160, BE35: 170, C150: 105, C152: 110,
      RV7: 185, RV10: 195, P28R: 155, PA24: 160, C177: 130,
      C185: 155, PA18: 100, PA22: 120, DV20: 120, VENT: 100,
      B350: 310, PC12: 280, C90: 245, BE20: 290, TBM9: 330,
      TBM8: 320, TBM7: 300, AT76: 275, AT75: 270, AT72: 275,
      AT45: 260, AT43: 260, DH8D: 360, DH8C: 310, DH8B: 290,
      DH8A: 270, JS41: 260, JS32: 280, D228: 195, L410: 210,
      SF34: 260, E120: 290, AN24: 250, C130: 290, P180: 395,
      SW4: 240, BE99: 240, PC6T: 130, DHC6: 160, B190: 280,
      U21A: 245, SH36: 190,
      E170: 430, E175: 430, E190: 445, E195: 445, E75S: 430,
      E75L: 430, E55P: 465, CRJ2: 420, CRJ7: 430, CRJ9: 430,
      CRJX: 435, E135: 420, E145: 420, F100: 420, F70: 420,
      BA46: 400, SB20: 340, D328: 335, BCS1: 470, BCS3: 470,
      A318: 450, A319: 455, A320: 460, A321: 460, A20N: 460,
      A21N: 460, B731: 440, B732: 440, B733: 445, B734: 450,
      B735: 450, B736: 450, B737: 455, B738: 460, B739: 460,
      B38M: 460, B39M: 460, B37M: 460, B752: 470, B753: 470,
      MD82: 440, MD83: 440, MD87: 440, MD88: 440, MD90: 445,
      B712: 440, T204: 430, T154: 460, IL62: 450, C25A: 405,
      C25B: 405, C510: 360, C525: 380, C56X: 430, C560: 420,
      C680: 460, CL30: 460, CL35: 460, CL60: 460, GL5T: 480,
      GLEX: 480, G280: 470, GLF4: 460, GLF5: 480, GLF6: 480,
      E550: 460, F2TH: 460, FA7X: 460, FA8X: 470,
      FA50: 440, LJ35: 430, LJ45: 440, LJ60: 440, LJ75: 445,
      PC24: 420, PRM1: 430, HDJT: 380, SF50: 300, EA50: 340,
      A332: 480, A333: 480, A338: 480, A339: 480, A342: 475,
      A343: 475, A345: 480, A346: 480, A359: 490, A35K: 490,
      A388: 490, B762: 475, B763: 480, B764: 480, B772: 490,
      B773: 490, B77L: 490, B77W: 490, B744: 490, B748: 495,
      B788: 490, B789: 490, B78X: 490, MD11: 480, DC10: 470,
      A306: 470, A310: 470, IL96: 470, B741: 480, B742: 480,
      B743: 485, L101: 470,
      A30B: 450, AN12: 330, AN26: 250, IL76: 430, C17: 450,
      C5: 450, B462: 410,
    };
    const categoryFallbackSpeeds = {
      small_prop: 140,
      turboprop: 280,
      regional_jet: 430,
      narrow_body: 460,
      wide_body: 490,
      cargo: 450,
    };
    const getCruiseSpeed = (xplaneIcao, fleetAircraftType) => {
      if (xplaneIcao) {
        const upper = String(xplaneIcao).toUpperCase();
        if (aircraftCruiseSpeeds[upper]) return aircraftCruiseSpeeds[upper];
        const cleaned = upper.replace(/[^A-Z0-9]/g, '');
        for (const len of [4, 3]) {
          const prefix = cleaned.slice(0, len);
          if (aircraftCruiseSpeeds[prefix]) return aircraftCruiseSpeeds[prefix];
        }
      }
      if (fleetAircraftType && categoryFallbackSpeeds[fleetAircraftType]) {
        return categoryFallbackSpeeds[fleetAircraftType];
      }
      return 250;
    };
    const calculateDeadlineMinutes = (distanceNm, xplaneIcao, fleetAircraftType) => {
      const d = Number(distanceNm || 0);
      if (!Number.isFinite(d) || d <= 0) return null;
      const cruise = getCruiseSpeed(xplaneIcao, fleetAircraftType);
      return Math.round((d / cruise) * 60 + 20 + 15);
    };
    const computeLiveScore = (packet) => {
      let scoreNow = 100;
      const maxG = Number(packet?.max_g_force ?? 1);
      const stall = !!(packet?.stall || packet?.is_in_stall || packet?.stall_warning || packet?.override_alpha);
      const tailstrike = !!packet?.tailstrike;
      const overstress = !!packet?.overstress;
      const overspeed = !!packet?.overspeed;
      const flapsOver = !!packet?.flaps_overspeed;
      const gearUpLanding = !!packet?.gear_up_landing;
      const crashed = !!(packet?.crash || packet?.has_crashed);
      if (tailstrike) scoreNow -= 20;
      if (stall) scoreNow -= 50;
      if (overstress) scoreNow -= 30;
      if (overspeed) scoreNow -= 15;
      if (flapsOver) scoreNow -= 15;
      if (gearUpLanding) scoreNow -= 35;
      if (maxG >= 1.5) {
        scoreNow -= Math.max(10, Math.floor(maxG) * 10);
      }
      const lg = Number(packet?.landing_g_force ?? 0);
      if (lg > 0) {
        if (lg < 0.5) scoreNow += 40;
        else if (lg < 1.0) scoreNow += 20;
        else if (lg < 1.6) scoreNow += 5;
        else if (lg < 2.0) scoreNow -= 30;
        else scoreNow -= 50;
      }
      if (crashed) scoreNow -= 100;
      return Math.max(0, Math.min(100, Math.round(scoreNow)));
    };
    
    // Get API key from query params
    const url = new URL(req.url);
    const apiKey = url.searchParams.get('api_key');
    
    if (!apiKey) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    // Resolve company by API key with cache (stale-while-revalidate).
    const company = await getCompanyByApiKeyCached(base44, apiKey);
    if (!company) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    
    const data = await req.json();
    const simulator = String(data?.simulator || "xplane12").toLowerCase();
    
    // --- FAST POSITION UPDATE: lightweight path for ~30Hz ARC mode data ---
    // These packets only contain position/heading/altitude/speed and skip all DB writes.
    // The frontend polls for these via the flight's xplane_data, but fast_position
    // packets are returned directly to the plugin without touching the Flight entity.
    if (data.fast_position) {
      // With full updates now at 1s interval, fast_position at 30Hz is redundant
      // and wastes DB reads/writes. Simply acknowledge and return immediately.
      return Response.json({ 
        status: 'fast_skipped',
        xplane_connection_status: 'connected'
      });
    }
    
    // Normalize all data fields - support both X-Plane and MSFS field naming conventions
    // MSFS bridges may use camelCase or different names
    const toBool = (value: any, defaultValue = false) => {
      if (value === undefined || value === null) return defaultValue;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        const s = value.trim().toLowerCase();
        if (s === '') return defaultValue;
        if (['1', 'true', 'yes', 'on'].includes(s)) return true;
        if (['0', 'false', 'no', 'off'].includes(s)) return false;
        const n = Number(s);
        if (Number.isFinite(n)) return n !== 0;
      }
      return defaultValue;
    };
    const altitude = data.altitude ?? data.alt ?? data.indicated_altitude;
    const speed = data.speed ?? data.airspeed ?? data.true_airspeed ?? data.tas;
    const vertical_speed = data.vertical_speed ?? data.verticalSpeed ?? data.vspeed ?? data.vertical_rate;
    const vertical_speed_window_min = data.vertical_speed_window_min ?? data.min_vertical_speed_window ?? data.window_min_vs;
    const heading = data.heading ?? data.hdg ?? data.true_heading ?? data.magnetic_heading;
    const fuel_percentage = data.fuel_percentage ?? data.fuelPercentage ?? data.fuel_percent;
    const fuel_kg = data.fuel_kg ?? data.fuelKg ?? data.fuel_weight_kg ?? data.total_fuel_kg;
    const g_force = data.g_force ?? data.gForce ?? data.g_load ?? data.gLoad;
    const g_force_window_peak = data.g_force_window_peak ?? data.g_peak_window ?? data.window_peak_g;
    const gForceNumeric = Number(g_force ?? 1);
    const gForceWindowPeakNumeric = Number(g_force_window_peak ?? 0);
    const gForceCurrent = Number.isFinite(gForceNumeric) ? gForceNumeric : 1;
    const gForcePeakForStats = Math.max(
      gForceCurrent,
      Number.isFinite(gForceWindowPeakNumeric) ? gForceWindowPeakNumeric : 0
    );
    const max_g_force = Math.max(
      Number(data.max_g_force ?? data.maxGForce ?? data.max_g ?? data.peakG ?? 0) || 0,
      gForcePeakForStats
    );
    const latitude = data.latitude ?? data.lat;
    const longitude = data.longitude ?? data.lon ?? data.lng;
    const on_ground = toBool(data.on_ground ?? data.onGround ?? data.sim_on_ground ?? data.isOnGround, false);
    const touchdown_vspeed = data.touchdown_vspeed ?? data.touchdownVspeed ?? data.landing_vspeed ?? data.touchdown_vs ?? data.landing_vs;
    const landing_g_force = data.landing_g_force ?? data.landingGForce ?? data.touchdown_g ?? data.landing_g;
    // Events - support X-Plane datarefs AND MSFS SimConnect event names
    const tailstrike = data.tailstrike ?? data.tail_strike ?? data.tailStrike ?? false;
    const stall = data.stall ?? data.isStalling ?? data.stall_active ?? false;
    const is_in_stall = data.is_in_stall ?? data.isInStall ?? data.stalling ?? false;
    const stall_warning = data.stall_warning ?? data.stallWarning ?? data.stall_warn ?? false;
    const override_alpha = data.override_alpha ?? data.overrideAlpha ?? false;
    const overstress = data.overstress ?? data.overStress ?? data.structural_damage ?? data.structuralDamage ?? data.overstressed ?? false;
    const flaps_overspeed = data.flaps_overspeed ?? data.flapsOverspeed ?? data.flap_overspeed ?? false;
    const fuel_emergency = data.fuel_emergency ?? data.fuelEmergency ?? false;
    const gear_up_landing = data.gear_up_landing ?? data.gearUpLanding ?? data.gear_retracted_landing ?? false;
    const crash = data.crash ?? data.crashed ?? false;
    const has_crashed = data.has_crashed ?? data.hasCrashed ?? data.is_crashed ?? data.sim_crashed ?? false;
    const overspeed = data.overspeed ?? data.overSpeed ?? data.vmo_exceeded ?? data.over_speed ?? false;
    const gear_down = data.gear_down ?? data.gearDown ?? data.gear_extended;
    // flap_ratio: preserve 0 as valid value (don't use || which treats 0 as falsy)
    const flap_ratio = data.flap_ratio ?? data.flapRatio ?? data.flap_position ?? data.flapPosition ?? 0;
    const pitch = data.pitch ?? data.pitch_angle ?? data.pitchAngle;
    const ias = data.ias ?? data.indicated_airspeed ?? data.indicatedAirspeed;
    // Legacy fields from old plugins
    const flight_score = data.flight_score ?? data.flightScore;
    const maintenance_cost = data.maintenance_cost ?? data.maintenanceCost;
    const reputation = data.reputation;
    const landing_quality = data.landing_quality ?? data.landingQuality;
    const bridgePostIntervalRaw = Number(data.bridge_post_interval_ms ?? data.bridgePostIntervalMs ?? data.loop_interval_ms ?? data.loopIntervalMs ?? 0);
    const bridgeSampleIntervalRaw = Number(data.bridge_sample_interval_ms ?? data.bridgeSampleIntervalMs ?? data.sample_interval_ms ?? data.sampleIntervalMs ?? 0);
    const bridgePostIntervalMs = Number.isFinite(bridgePostIntervalRaw) && bridgePostIntervalRaw > 0
      ? Math.max(1000, Math.min(15000, Math.round(bridgePostIntervalRaw)))
      : null;
    const bridgeSampleIntervalMs = Number.isFinite(bridgeSampleIntervalRaw) && bridgeSampleIntervalRaw > 0
      ? Math.max(50, Math.min(5000, Math.round(bridgeSampleIntervalRaw)))
      : null;
    const incomingBridgePositionSamples = Array.isArray(data.bridge_position_samples)
      ? data.bridge_position_samples
      : (Array.isArray(data.position_samples) ? data.position_samples : []);
    const incomingBridgeEventLog = Array.isArray(data.bridge_event_log)
      ? data.bridge_event_log
      : (Array.isArray(data.event_log) ? data.event_log : []);

    // Normalize field names (support both X-Plane and MSFS naming conventions)
    // MSFS bridges may use different field names for the same data
    const park_brake = toBool(data.parking_brake ?? data.park_brake ?? data.parkingBrake, false);
    const engine1_running = toBool(data.engine1_running ?? data.eng1Running ?? data.engine_1_running, false);
    const engine2_running = toBool(data.engine2_running ?? data.eng2Running ?? data.engine_2_running, false);
    const engines_running = toBool(data.engines_running ?? data.enginesRunning, false) || engine1_running || engine2_running;
    // MSFS crash detection: support multiple field names + bridge fallbacks
    const crash_flag = data.crash_flag ?? data.crashFlag ?? data.crashflag ?? false;
    const sim_disabled = data.sim_disabled ?? data.simDisabled ?? data.sim_is_disabled ?? data.simDisabledFlag ?? false;
    const hasCrashFailure = Array.isArray(data.active_failures) && data.active_failures.some((f) =>
      /crash/i.test(String(f?.name || f?.name_de || ""))
    );
    const explicitCrashSignal = !!(crash || has_crashed || data.crashed || data.is_crashed || data.sim_crashed || crash_flag || hasCrashFailure);
    const aircraft_icao = data.aircraft_icao || data.aircraftIcao || data.atc_type || data.icao_type;
    const normalizeIcaoCode = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const asFinite = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const deriveWeather = () => {
      const oat_c = data.oat_c ?? data.oat ?? data.outside_air_temp_c ?? data.temperature_c ?? data.ambient_temperature ?? data.outside_temperature ?? data.temperature ?? data.ambient_temp_c ?? undefined;
      const oat_c_num = asFinite(oat_c);
      let tat_c = asFinite(data.tat_c ?? data.tat ?? data.total_air_temp_c ?? data.total_air_temperature ?? data.total_air_temperature_c);
      if (tat_c === undefined && oat_c_num !== undefined) {
        const tasForTat = asFinite(data.true_airspeed ?? data.tas);
        if (tasForTat !== undefined) {
          tat_c = oat_c_num + ((Math.max(0, tasForTat) * Math.max(0, tasForTat)) / 7592);
        }
      }

      const precip_state_num = asFinite(data.precip_state ?? data.ambient_precip_state ?? data.precipitation_state);
      const precip_state = precip_state_num !== undefined ? Math.round(precip_state_num) : undefined;
      const precip_rate = asFinite(
        data.precip_rate ??
        data.ambient_precip_rate ??
        data.sim_weather_precipitation_rate ??
        data.rain_rate ??
        data.precipitation_rate
      );
      const hasRainMask = precip_state !== undefined && (precip_state & 4) === 4;
      let rain_intensity = asFinite(data.rain_intensity ?? data.precipitation ?? data.rain);
      const wind_speed_num = asFinite(
        data.wind_speed_kts ??
        data.wind_speed ??
        data.windspeed_kts ??
        data.ambient_wind_speed ??
        data.wind_velocity
      );
      const wind_gust_num = asFinite(
        data.wind_gust_kts ??
        data.wind_gust ??
        data.wind_gust_speed ??
        data.ambient_wind_gust ??
        data.ambient_wind_velocity_gust
      );

      // Some bridges emit fixed 0.2 when only "rain present" mask is known.
      // Treat this as synthetic when no precip rate is available.
      const isLikelySyntheticRain20 = rain_intensity !== undefined &&
        Math.abs(rain_intensity - 0.2) < 0.0001 &&
        hasRainMask &&
        !(precip_rate !== undefined && precip_rate > 0);
      if (isLikelySyntheticRain20) {
        rain_intensity = undefined;
      }

      if (rain_intensity === undefined && precip_rate !== undefined) {
        rain_intensity = precip_rate <= 1
          ? Math.max(0, precip_rate)
          : Math.min(1, Math.max(0, precip_rate / 4));
      }
      if (rain_intensity === undefined && hasRainMask) {
        // No real intensity available: estimate from wind/gust as a better fallback than constant 20%.
        const gustSpread = (wind_gust_num !== undefined && wind_speed_num !== undefined)
          ? Math.max(0, wind_gust_num - wind_speed_num)
          : undefined;
        const windBased = wind_speed_num !== undefined ? Math.min(1, 0.08 + (wind_speed_num / 85)) : undefined;
        const gustBased = gustSpread !== undefined ? Math.min(1, 0.10 + (gustSpread / 35)) : undefined;
        const estimated = Math.max(windBased ?? 0, gustBased ?? 0);
        rain_intensity = estimated > 0 ? estimated : 0.10;
      }
      if (rain_intensity !== undefined && rain_intensity > 1) {
        rain_intensity = Math.min(1, rain_intensity / 100);
      }
      if (rain_intensity !== undefined && rain_intensity < 0) {
        rain_intensity = 0;
      }

      const ground_elevation_ft = data.ground_elevation_ft ?? data.elevation_ft ?? data.airport_elevation_ft ?? data.ground_altitude ?? null;
      let baro_setting = data.baro_setting ?? data.qnh ?? data.altimeter_setting ?? data.baro ?? data.baro_hpa ?? null;
      if (!baro_setting) {
        const inHg = data.kohlsman_setting_hg ?? data.altimeter_setting_hg ?? data.baro_setting_inhg ?? null;
        if (inHg) baro_setting = inHg * 33.8639;
      }
      let wind_speed_kts = wind_speed_num;
      if (wind_speed_kts === undefined && data.ambient_wind_x !== undefined && data.ambient_wind_z !== undefined) {
        wind_speed_kts = Math.sqrt(data.ambient_wind_x ** 2 + data.ambient_wind_z ** 2) * 1.94384;
      }
      const wind_direction = data.wind_direction ?? data.wind_dir ?? data.wind_heading ?? data.ambient_wind_direction ?? data.wind_deg ?? undefined;
      const wind_gust_kts = wind_gust_num;

      let turbulence = asFinite(data.turbulence ?? data.turbulence_intensity ?? data.sim_weather_turbulence);
      const verticalWind = asFinite(data.wind_vertical_mps ?? data.ambient_wind_y ?? data.wind_y_mps);
      const verticalSpeedNow = asFinite(data.vertical_speed ?? data.verticalSpeed ?? data.vspeed ?? data.vertical_rate);
      const gForceNow = asFinite(data.g_force ?? data.gForce ?? data.g_load ?? data.gLoad);
      const gustSpread = (wind_gust_kts !== undefined && wind_speed_kts !== undefined)
        ? Math.max(0, wind_gust_kts - wind_speed_kts)
        : undefined;
      const turbulenceCandidates = [];
      if (turbulence !== undefined) turbulenceCandidates.push(turbulence);
      if (verticalWind !== undefined) turbulenceCandidates.push(Math.min(1, Math.abs(verticalWind) / 4.5));
      if (verticalSpeedNow !== undefined) turbulenceCandidates.push(Math.min(1, Math.abs(verticalSpeedNow) / 1600));
      if (gForceNow !== undefined) turbulenceCandidates.push(Math.min(1, Math.max(0, (Math.abs(gForceNow - 1.0) - 0.03) * 3.5)));
      if (gustSpread !== undefined) turbulenceCandidates.push(Math.min(1, gustSpread / 22));
      if (wind_speed_kts !== undefined) turbulenceCandidates.push(Math.min(1, wind_speed_kts / 90) * 0.45);
      if (rain_intensity !== undefined) turbulenceCandidates.push(Math.min(1, rain_intensity * 0.55));
      if (turbulenceCandidates.length > 0) {
        turbulence = Math.max(...turbulenceCandidates);
      }
      if (turbulence !== undefined && turbulence > 1) {
        turbulence = Math.min(1, turbulence / 100);
      }
      if (turbulence !== undefined && turbulence < 0) {
        turbulence = 0;
      }
      const rain_detected = !!(
        hasRainMask ||
        (precip_rate !== undefined && precip_rate > 0) ||
        (rain_intensity !== undefined && rain_intensity > 0.01)
      );

      return {
        oat_c,
        tat_c,
        precip_state,
        precip_rate,
        rain_intensity,
        rain_detected,
        turbulence,
        ground_elevation_ft,
        baro_setting,
        wind_speed_kts,
        wind_gust_kts,
        wind_direction,
      };
    };
    const derivedWeather = deriveWeather();
    const pickFirstNumber = (...vals) => {
      for (const v of vals) {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
      }
      return null;
    };
    const pickAircraftNumber = (obj, keys) => {
      if (!obj || typeof obj !== "object") return null;
      for (const k of keys) {
        const n = Number(obj[k]);
        if (Number.isFinite(n)) return n;
      }
      return null;
    };
    const pickAircraftString = (obj, keys) => {
      if (!obj || typeof obj !== "object") return null;
      for (const k of keys) {
        const v = obj[k];
        if (v !== undefined && v !== null) {
          const s = String(v).trim();
          if (s.length > 0) return s;
        }
      }
      return null;
    };
    const companyLevel = pickFirstNumber(
      company?.level,
      company?.company_level,
      company?.pilot_level,
      company?.career_level,
      company?.xp_level
    );
    const aircraftIcaoFields = [
      "xplane_icao",
      "aircraft_icao",
      "icao_code",
      "icao",
      "icao_type",
      "icaoType",
    ];
    const icaoAliasMap = {
      A20N: "A320",
      A21N: "A321",
      A19N: "A319",
      B38M: "B738",
      B39M: "B739",
      B78X: "B789",
      E75L: "E75S",
    };
    const canonicalIcao = (v) => {
      const n = normalizeIcaoCode(v);
      if (!n) return "";
      if (icaoAliasMap[n]) return icaoAliasMap[n];
      const patternAliases = [
        [/B38M|B738|7378|B737800/, "B738"],
        [/B39M|B739|7379|B737900/, "B739"],
        [/B737|7377|B737700/, "B737"],
        [/B78X|B789|7879|B787900/, "B789"],
        [/B788|7878|B787800/, "B788"],
        [/A20N|A320NEO|A320/, "A320"],
        [/A21N|A321NEO|A321/, "A321"],
        [/A19N|A319NEO|A319/, "A319"],
        [/C172|CESSNA172/, "C172"],
        [/DA62/, "DA62"],
        [/TBM9|TBM930|TBM940/, "TBM9"],
      ];
      for (const [rx, code] of patternAliases) {
        if (rx.test(n)) return code;
      }
      const four = n.match(/^[A-Z0-9]{4}/);
      if (four) return four[0];
      return n;
    };
    const levenshteinDistance = (a, b) => {
      if (a === b) return 0;
      if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
      const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
      for (let i = 1; i <= a.length; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= b.length; j++) {
          const tmp = dp[j];
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          dp[j] = Math.min(
            dp[j] + 1,
            dp[j - 1] + 1,
            prev + cost
          );
          prev = tmp;
        }
      }
      return dp[b.length];
    };
    const icaoMatchScore = (targetRaw, candidateRaw) => {
      const target = normalizeIcaoCode(targetRaw);
      const candidate = normalizeIcaoCode(candidateRaw);
      if (!target || !candidate) return 0;
      if (target === candidate) return 100;
      const ct = canonicalIcao(target);
      const cc = canonicalIcao(candidate);
      if (ct && cc && ct === cc) return 95;
      if (target.slice(0, 4) === candidate.slice(0, 4)) return 90;
      if (target.slice(0, 3) === candidate.slice(0, 3) && Math.abs(target.length - candidate.length) <= 1) return 80;
      if (target.slice(0, 2) === candidate.slice(0, 2) && levenshteinDistance(target, candidate) <= 1) return 72;
      return 0;
    };
    const aircraftTextFields = [
      "display_name",
      "aircraft_name",
      "name",
      "model_name",
      "title",
      "model",
      "type",
      "aircraft_type",
      "manufacturer",
      "make",
      "variant",
      "family",
    ];
    const extractAircraftText = (ac) => {
      if (!ac || typeof ac !== "object") return "";
      const parts = [];
      for (const f of [...aircraftIcaoFields, ...aircraftTextFields]) {
        const v = ac[f];
        if (v !== undefined && v !== null) {
          const s = normalizeIcaoCode(v);
          if (s) parts.push(s);
        }
      }
      return parts.join(" ");
    };
    const buildTargetTokens = (icaoRaw) => {
      const n = normalizeIcaoCode(icaoRaw);
      const c = canonicalIcao(n);
      const tokens = new Set();
      const add = (v) => {
        const t = normalizeIcaoCode(v);
        if (t && t.length >= 3) tokens.add(t);
      };
      add(n);
      add(c);
      if (n.length >= 4) add(n.slice(0, 4));
      if (c.length >= 4) add(c.slice(0, 4));
      if (n.length >= 3) add(n.slice(0, 3));
      if (c.length >= 3) add(c.slice(0, 3));

      const b = c.match(/^B(\d)(\d)(\d)$/);
      if (b) {
        const model = `7${b[1]}${b[2]}`;
        const variant = `${b[3]}00`;
        add(model);
        add(`${model}${variant}`);
        add(`BOEING${model}${variant}`);
        add(`B${model}${variant}`);
      }
      const a = c.match(/^A(\d)(\d)(\d)$/);
      if (a) {
        const model = `${a[1]}${a[2]}${a[3]}`;
        add(model);
        add(`A${model}`);
        add(`AIRBUS${model}`);
      }
      const e = c.match(/^E(\d)(\d)([A-Z0-9])$/);
      if (e) {
        const model = `E${e[1]}${e[2]}${e[3]}`;
        add(model);
        add(`EMBRAER${model}`);
      }
      return Array.from(tokens);
    };
    const extractAircraftIcao = (ac) => {
      if (!ac || typeof ac !== "object") return "";
      for (const field of aircraftIcaoFields) {
        const v = ac[field];
        if (v !== undefined && v !== null) {
          const n = normalizeIcaoCode(v);
          if (n) return n;
        }
      }
      return "";
    };
    const aircraftRowMatchScore = (targetIcao, row) => {
      if (!targetIcao || !row) return 0;
      const t = normalizeIcaoCode(targetIcao);
      const tc = canonicalIcao(t);
      let best = 0;

      const rowIcao = extractAircraftIcao(row);
      best = Math.max(best, icaoMatchScore(t, rowIcao));

      const hay = extractAircraftText(row);
      if (hay) {
        if (hay.includes(t) || hay.includes(tc)) best = Math.max(best, 94);
        if (tc && tc.length >= 4 && hay.includes(tc.slice(0, 4))) best = Math.max(best, 90);
        const tokens = buildTargetTokens(tc || t);
        let tokenHits = 0;
        for (const tk of tokens) {
          if (tk.length >= 4 && hay.includes(tk)) tokenHits += 1;
        }
        if (tokenHits >= 2) best = Math.max(best, 86);
        else if (tokenHits >= 1) best = Math.max(best, 80);

        if (t.startsWith("B") && hay.includes("BOEING")) best = Math.max(best, Math.min(100, best + 4));
        if (t.startsWith("A") && hay.includes("AIRBUS")) best = Math.max(best, Math.min(100, best + 4));
        if (t.startsWith("E") && hay.includes("EMBRAER")) best = Math.max(best, Math.min(100, best + 4));
        if (t.startsWith("C") && hay.includes("CESSNA")) best = Math.max(best, Math.min(100, best + 4));
      }
      return best;
    };
    const pickBestAircraftMatch = (rows, targetIcao, minScore = 0) => {
      if (!Array.isArray(rows) || rows.length === 0 || !targetIcao) return null;
      let best = null;
      let bestScore = 0;
      for (const row of rows) {
        const score = aircraftRowMatchScore(targetIcao, row);
        if (score > bestScore) {
          best = row;
          bestScore = score;
        }
      }
      if (best && bestScore >= minScore) return { row: best, score: bestScore };
      return null;
    };
    const fetchAircraftByIcao = async (icaoCode, baseFilter, limit = 20) => {
      if (!icaoCode) return [];
      for (const field of aircraftIcaoFields) {
        try {
          const rows = await base44.asServiceRole.entities.Aircraft.filter(
            { ...baseFilter, [field]: icaoCode },
            "-created_date",
            limit
          );
          if (Array.isArray(rows) && rows.length > 0) {
            return rows;
          }
        } catch (_) {
          // Try next possible ICAO field.
        }
      }
      return [];
    };
    const resolveAircraftGateMeta = async (opts = {}) => {
      const assignedAircraft = opts.assignedAircraft || null;
      const flightXplaneData = opts.flightXplaneData || null;
      const icaoCode = normalizeIcaoCode(aircraft_icao || flightXplaneData?.aircraft_icao || "");
      const displayName = pickAircraftString(assignedAircraft, [
        "display_name",
        "aircraft_name",
        "name",
        "model_name",
        "title",
        "model",
      ]);
      return {
        owned: true,
        blocked: false,
        reason: null,
        icao: icaoCode || aircraft_icao || null,
        displayName,
        price: null,
        requiredLevel: null,
        companyLevel,
      };
    };

    // Verify we have valid flight data before marking as connected
    if (altitude === undefined || speed === undefined) {
      return Response.json({ 
        error: 'Invalid data - no altitude or speed received',
        xplane_connection_status: 'disconnected' 
      }, { status: 400 });
    }

    // Update company connection status - fire and forget (don't block response)
    if (company && company.xplane_connection_status !== 'connected') {
      base44.asServiceRole.entities.Company.update(company.id, { 
        xplane_connection_status: 'connected' 
      }).catch(() => {});
    }

    // Resolve active flight with cache to avoid a blocking DB read on every telemetry packet.
    const flight = await getActiveFlightForCompanyCached(base44, company.id);
    if (flight) {
      setActiveFlightCache(company.id, flight, ACTIVE_FLIGHT_CACHE_TTL_MS);
    }
    
    if (!flight) {
      setActiveFlightCache(company.id, null, NO_ACTIVE_FLIGHT_CACHE_TTL_MS);
      const gateMeta = await resolveAircraftGateMeta();
      const noFlightData = {
        ...data,
        simulator,
        altitude,
        speed,
        vertical_speed,
        heading,
        latitude,
        longitude,
        on_ground,
        park_brake,
        engine1_running,
        engine2_running,
        engines_running,
        pitch,
        ias,
        crash: explicitCrashSignal,
        has_crashed: explicitCrashSignal,
        crash_flag,
        sim_disabled,
        oat_c: derivedWeather.oat_c ?? null,
        tat_c: derivedWeather.tat_c ?? null,
      rain_intensity: derivedWeather.rain_intensity ?? null,
      rain_detected: derivedWeather.rain_detected ?? false,
      precipitation: derivedWeather.rain_intensity ?? null,
      precip_rate: derivedWeather.precip_rate ?? null,
      precip_state: derivedWeather.precip_state ?? null,
      turbulence: derivedWeather.turbulence ?? null,
      turbulence_intensity: derivedWeather.turbulence ?? null,
      wind_speed_kts: derivedWeather.wind_speed_kts ?? null,
      wind_gust_kts: derivedWeather.wind_gust_kts ?? null,
      wind_direction: derivedWeather.wind_direction ?? null,
      };
      // No active flight - log to XPlaneLog so debug page can show data
      base44.asServiceRole.entities.XPlaneLog.create({
        company_id: company.id,
        raw_data: noFlightData,
        altitude,
        speed,
        on_ground,
        flight_score,
        has_active_flight: false
      }).catch(() => {});

      // Cleanup old logs very rarely
      if (Math.random() < 0.03) {
        base44.asServiceRole.entities.XPlaneLog.filter(
          { company_id: company.id }, '-created_date', 60
        ).then(async (oldLogs) => {
          if (oldLogs.length > 30) {
            await Promise.all(oldLogs.slice(30).map(l => base44.asServiceRole.entities.XPlaneLog.delete(l.id)));
          }
        }).catch(() => {});
      }

      return Response.json({ 
        message: 'Simulator connected - no active flight',
        xplane_connection_status: 'connected',
        simulator,
        data_logged: true,
        server_processing_ms: Date.now() - reqStartedAtMs,
        aircraft_gate_blocked: gateMeta.blocked,
        aircraft_gate_reason: gateMeta.reason,
        aircraft_gate_icao: gateMeta.icao,
        aircraft_gate_display_name: gateMeta.displayName,
        aircraft_gate_price: gateMeta.price,
        aircraft_gate_required_level: gateMeta.requiredLevel,
        aircraft_gate_company_level: gateMeta.companyLevel,
        aircraft_owned: gateMeta.owned,
      }, { status: 200 });
    }
    
    // Active flight: keep per-packet DB reads minimal so bridge latency stays low.
    const prevXd = flight.xplane_data || {};
    const referenceRefreshMsPrev = Number(prevXd.reference_refresh_ms ?? 0);
    const shouldRefreshReferenceData =
      !Number.isFinite(referenceRefreshMsPrev) ||
      referenceRefreshMsPrev <= 0 ||
      (Date.now() - referenceRefreshMsPrev) >= 30000;

    let contract = null;
    let assignedAircraft = null;
    let assignedAircraftType = prevXd.aircraft_type || null;

    if (shouldRefreshReferenceData && flight.contract_id) {
      try {
        const contracts = await base44.asServiceRole.entities.Contract.filter({ id: flight.contract_id });
        contract = contracts[0] || null;
      } catch (_) {
        contract = null;
      }
    }

    if (shouldRefreshReferenceData && flight.aircraft_id) {
      try {
        const aircraftList = await base44.asServiceRole.entities.Aircraft.filter({ id: flight.aircraft_id });
        assignedAircraft = aircraftList?.[0] || null;
        assignedAircraftType = assignedAircraft?.type || assignedAircraftType || null;
      } catch (_) {
        assignedAircraft = null;
      }
    }

    const contractDepartureAirport = contract?.departure_airport ?? prevXd.contract_departure_airport ?? null;
    const contractArrivalAirport = contract?.arrival_airport ?? prevXd.contract_arrival_airport ?? null;
    const contractDistanceNm = Number(contract?.distance_nm ?? prevXd.contract_distance_nm ?? 0) || null;
    const contractDeadlineMinutes = Number(contract?.deadline_minutes ?? prevXd.contract_deadline_minutes ?? 0) || null;
    const contractPayout = Number(contract?.payout ?? prevXd.contract_payout ?? 0) || null;
    const contractBonusPotential = Number(contract?.bonus_potential ?? prevXd.contract_bonus_potential ?? 0) || null;
    const incomingTouchdownVspeed = Math.abs(Number(touchdown_vspeed ?? data.landing_vs ?? data.landingVs ?? 0));
    const incomingLandingG = Number(landing_g_force ?? data.landingG ?? 0);
    const landingDataSource = String(data.landing_data_source || "").trim().toLowerCase();
    const bridgeLocalLandingLocked = toBool(data.bridge_local_landing_locked ?? data.landing_data_locked, false);
    const useBridgeLocalLanding = bridgeLocalLandingLocked || landingDataSource.includes("bridge_local");
    const prevTouchdownVspeed = Number(prevXd.touchdown_vspeed ?? prevXd.landing_vs ?? 0);
    const prevLandingG = Number(prevXd.landing_g_force ?? prevXd.landingGForce ?? 0);
    const mergedTouchdownVspeed = Math.abs(incomingTouchdownVspeed) > 0 ? incomingTouchdownVspeed : prevTouchdownVspeed;
    const mergedLandingG = incomingLandingG > 0 ? incomingLandingG : prevLandingG;

    // Extract aircraft/env fields from plugin - normalize across X-Plane and MSFS naming
    let total_weight_kg = data.total_weight_kg ?? data.gross_weight_kg ?? data.weight_kg ?? null;
    if (!total_weight_kg) {
      const lbs = data.total_weight_lbs ?? data.gross_weight_lbs ?? data.weight_lbs ?? data.total_weight_pounds ?? data.gross_weight_pounds ?? null;
      if (lbs) total_weight_kg = lbs * 0.453592;
    }
    // If still no weight but we have fuel_kg + aircraft_icao, estimate from OEW
    if (!total_weight_kg && fuel_kg && aircraft_icao) {
      const oewLookup = {
        C172: 767, C182: 880, C208: 2145, PA28: 680, SR22: 1050,
        DA40: 800, DA42: 1280, TBM9: 2100, PC12: 2845, B350: 4080,
        AT76: 13500, DH8D: 17745, CRJ9: 22300,
        E170: 21000, E175: 21800, E190: 28000, E195: 28970,
        A318: 39500, A319: 40800, A320: 42600, A321: 48500, A20N: 44300, A21N: 50100,
        B733: 31500, B734: 33200, B735: 31300, B736: 36400, B737: 37600,
        B738: 41400, B739: 42100, B38M: 45070, B39M: 45860, '737': 41400,
        B752: 58400, B753: 62100, B763: 86070, B764: 92500,
        B772: 138100, B773: 160530, B77W: 167800, B788: 119950, B789: 128850, B78X: 135500,
        B744: 178756, B748: 197131,
        A332: 120600, A333: 125200, A339: 130000, A359: 142400, A35K: 149000, A388: 276800,
      };
      const ic = normalizeIcaoCode(aircraft_icao);
      const oew = oewLookup[ic] || oewLookup[ic.slice(0, 4)] || oewLookup[ic.slice(0, 3)] || null;
      if (oew) {
        total_weight_kg = Math.round(oew + fuel_kg + oew * 0.25);
      }
    }
    const {
      oat_c,
      tat_c,
      precip_state,
      precip_rate,
      rain_intensity,
      rain_detected,
      turbulence,
      ground_elevation_ft,
      baro_setting,
      wind_speed_kts,
      wind_gust_kts,
      wind_direction,
    } = derivedWeather;
    const gateMeta = await resolveAircraftGateMeta({
      assignedAircraft,
      contract,
      flightXplaneData: flight.xplane_data || null,
    });
    const aircraftOwned = gateMeta.owned;
    const aircraftGateBlocked = gateMeta.blocked;
    const aircraftGateReason = gateMeta.reason;
    const aircraftIcao = gateMeta.icao;
    const aircraftGateDisplayName = gateMeta.displayName;
    const aircraftGatePrice = gateMeta.price;
    const aircraftGateRequiredLevel = gateMeta.requiredLevel;

    const normalizeWpList = (wps) => {
      if (!Array.isArray(wps)) return [];
      return wps
        .map((wp, idx) => {
          const lat = Number(wp?.lat);
          const lon = Number(wp?.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          const rawName = wp?.name || wp?.ident || wp?.fix || wp?.waypoint || `WP${idx + 1}`;
          const name = toHudAscii(rawName, `WP${idx + 1}`)
            .toUpperCase()
            .replace(/[^A-Z0-9+\-]/g, "")
            .trim() || `WP${idx + 1}`;
          const rawVia = wp?.airway || wp?.via_airway || wp?.via || wp?.airway_ident || "DCT";
          const via = toHudAscii(rawVia, "DCT")
            .toUpperCase()
            .replace(/[^A-Z0-9+\-]/g, "")
            .trim() || "DCT";
          const rawAlt = Number(wp?.alt ?? wp?.altitude_feet ?? wp?.altitude ?? 0);
          const alt = Number.isFinite(rawAlt) ? Math.max(0, Math.round(rawAlt)) : 0;
          return { ...wp, lat, lon, name, via, alt };
        })
        .filter(Boolean);
    };
    const incomingFmsWaypoints = normalizeWpList(data.fms_waypoints); // array of {name, lat, lon, alt}

    const areEnginesRunning = engines_running || engine1_running || engine2_running;
    const prevAirborneStartedAt = prevXd.airborne_started_at || null;
    const flightCreatedAtMs = Date.parse(String(flight.created_date || ""));
    const prevAirborneStartedAtMs = Date.parse(String(prevAirborneStartedAt || ""));
    const hasFreshAirborneState =
      Number.isFinite(prevAirborneStartedAtMs) &&
      (!Number.isFinite(flightCreatedAtMs) || prevAirborneStartedAtMs >= (flightCreatedAtMs - 5000));
    const wasAirborne = hasFreshAirborneState ? toBool(prevXd.was_airborne, false) : false;
    const payloadWasAirborne = toBool(data.was_airborne ?? data.wasAirborne, false);
    const speedNow = Number(speed || 0);
    const verticalNow = Math.abs(Number(vertical_speed || 0));
    const isNowAirborne = !on_ground && (speedNow > 35 || verticalNow > 200);
    const payloadAirborneCredible = payloadWasAirborne && !on_ground && (speedNow > 20 || verticalNow > 100);
    const hasBeenAirborne = wasAirborne || isNowAirborne || payloadAirborneCredible;
    const prevOnGround = toBool(prevXd.on_ground, false);
    const justTouchedDown = hasBeenAirborne && on_ground && !prevOnGround;

    // Fuel smoothing: preserve last valid fuel value when packets arrive late/missing.
    const prevFuelKg = Number(prevXd.fuel_kg ?? prevXd.last_valid_fuel_kg ?? 0);
    const incomingFuelKg = Number(fuel_kg ?? 0);
    let effectiveFuelKg = Number.isFinite(incomingFuelKg) ? incomingFuelKg : 0;
    if (effectiveFuelKg <= 0 && prevFuelKg > 0) {
      effectiveFuelKg = prevFuelKg;
    }
    const airborneFuelJumpThresholdKg = 2500;
    if (hasBeenAirborne && prevFuelKg > 0 && effectiveFuelKg > (prevFuelKg + airborneFuelJumpThresholdKg)) {
      effectiveFuelKg = prevFuelKg;
    }
    const prevFuelPct = Number(prevXd.fuel_percentage ?? 0);
    const incomingFuelPct = Number(fuel_percentage ?? 0);
    let effectiveFuelPct = Number.isFinite(incomingFuelPct) ? incomingFuelPct : prevFuelPct;
    if ((!Number.isFinite(incomingFuelKg) || incomingFuelKg <= 0) && prevFuelPct > 0) {
      effectiveFuelPct = prevFuelPct;
    }
    const lastValidFuelKg = effectiveFuelKg > 0
      ? effectiveFuelKg
      : (Number(prevXd.last_valid_fuel_kg ?? 0) > 0 ? Number(prevXd.last_valid_fuel_kg ?? 0) : 0);

    // Track initial fuel for consumption calculation
    const prevInitialFuelKg = Number(prevXd.initial_fuel_kg ?? 0);
    const initial_fuel_kg = hasBeenAirborne
      ? (prevInitialFuelKg > 0 ? prevInitialFuelKg : lastValidFuelKg)
      : (lastValidFuelKg > 0 ? lastValidFuelKg : prevInitialFuelKg);
    const prevSampleTsMs = Date.parse(String(prevXd.timestamp || ""));
    const fuelSampleDeltaSec = Number.isFinite(prevSampleTsMs)
      ? Math.max(0, (Date.now() - prevSampleTsMs) / 1000)
      : 0;
    const prevFuelBurnRateKgph = Number(prevXd.fuel_burn_rate_kgph ?? 0);
    let instantFuelBurnRateKgph = 0;
    if (
      hasBeenAirborne &&
      fuelSampleDeltaSec >= 1 &&
      prevFuelKg > 0 &&
      effectiveFuelKg >= 0 &&
      effectiveFuelKg <= prevFuelKg
    ) {
      const burnedKg = prevFuelKg - effectiveFuelKg;
      if (burnedKg > 0) {
        const computedRate = (burnedKg * 3600) / fuelSampleDeltaSec;
        if (Number.isFinite(computedRate) && computedRate >= 5 && computedRate <= 12000) {
          instantFuelBurnRateKgph = computedRate;
        }
      }
    }
    const fuelBurnRateKgph = instantFuelBurnRateKgph > 0
      ? (prevFuelBurnRateKgph > 0
          ? ((prevFuelBurnRateKgph * 0.75) + (instantFuelBurnRateKgph * 0.25))
          : instantFuelBurnRateKgph)
      : (prevFuelBurnRateKgph > 0 ? prevFuelBurnRateKgph : 0);
    const fuelBurnRateLph = fuelBurnRateKgph > 0 ? (fuelBurnRateKgph * 1.25) : 0;

    // Track flight path: denser capture + interpolation to avoid visual data loss on slower packet delivery.
    const existingPath = Array.isArray(prevXd.flight_path) ? prevXd.flight_path : [];
    let newPath = existingPath;
    const hasValidCoords = Number.isFinite(latitude) && Number.isFinite(longitude)
      && (Math.abs(latitude) > 0.5 || Math.abs(longitude) > 0.5);
    const normalizeSamplePoint = (point) => {
      if (!point) return null;
      const latNum = Number(point?.lat ?? point?.latitude);
      const lonNum = Number(point?.lon ?? point?.longitude ?? point?.lng);
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
      if (Math.abs(latNum) <= 0.5 && Math.abs(lonNum) <= 0.5) return null;
      return {
        lat: latNum,
        lon: lonNum,
        onGround: toBool(point?.on_ground ?? point?.onGround, on_ground),
      };
    };
    const bridgedPathSamples = incomingBridgePositionSamples
      .map(normalizeSamplePoint)
      .filter(Boolean)
      .slice(-120);
    const appendPathPoint = (path, latNum, lonNum, isGroundPoint) => {
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return path;
      if (Math.abs(latNum) <= 0.5 && Math.abs(lonNum) <= 0.5) return path;
      const nextPath = Array.isArray(path) ? path : [];
      const last = nextPath.length > 0 ? nextPath[nextPath.length - 1] : null;
      if (!last) {
        nextPath.push([latNum, lonNum]);
        return nextPath;
      }
      const distNm = haversineNm(Number(last[0]), Number(last[1]), latNum, lonNum);
      const minStepNm = isGroundPoint ? 0.010 : 0.035; // ~18m ground, ~65m airborne
      if (!Number.isFinite(distNm) || distNm < minStepNm) return nextPath;

      // Backfill large jumps so map and event markers keep a continuous visual path.
      const maxLegNm = isGroundPoint ? 0.08 : 0.22;
      if (distNm > (maxLegNm * 1.5)) {
        const steps = Math.min(20, Math.max(1, Math.floor(distNm / maxLegNm)));
        for (let i = 1; i <= steps; i++) {
          const frac = i / (steps + 1);
          const ilat = Number(last[0]) + ((latNum - Number(last[0])) * frac);
          const ilon = Number(last[1]) + ((lonNum - Number(last[1])) * frac);
          nextPath.push([ilat, ilon]);
        }
      }
      nextPath.push([latNum, lonNum]);
      return nextPath;
    };
    if (hasValidCoords || bridgedPathSamples.length > 0) {
      let cleanPath = existingPath
        .filter((p) => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
        .filter((p) => Math.abs(Number(p[0])) > 0.5 || Math.abs(Number(p[1])) > 0.5);

      for (const sample of bridgedPathSamples) {
        cleanPath = appendPathPoint(cleanPath, sample.lat, sample.lon, sample.onGround);
      }
      if (hasValidCoords) {
        cleanPath = appendPathPoint(cleanPath, Number(latitude), Number(longitude), on_ground);
      }

      // Keep more detail for long flights while still capping entity size.
      if (cleanPath.length > 2600) {
        const compacted = [];
        const stride = Math.max(2, Math.ceil(cleanPath.length / 1800));
        for (let i = 0; i < cleanPath.length; i += stride) {
          compacted.push(cleanPath[i]);
        }
        if (compacted.length === 0 || compacted[compacted.length - 1] !== cleanPath[cleanPath.length - 1]) {
          compacted.push(cleanPath[cleanPath.length - 1]);
        }
        cleanPath = compacted.slice(-1800);
      }
      newPath = cleanPath;
    }

    // Build a LEAN xplane_data object - only current sensor readings
    // No merging with previous data (the frontend tracks accumulated state)
    const justLiftedOff = !on_ground && prevOnGround;
    const airborneStartedAt = (!on_ground && altitude > 10)
      ? (justLiftedOff
          ? new Date().toISOString()
          : (prevAirborneStartedAt || new Date().toISOString()))
      : prevAirborneStartedAt;
    const airborneStartedAtMs = Date.parse(String(airborneStartedAt || ""));
    const airborneDurationSec = Number.isFinite(airborneStartedAtMs)
      ? Math.max(0, Math.floor((Date.now() - airborneStartedAtMs) / 1000))
      : 0;
    const prevCompletionArmed = toBool(prevXd.completion_armed, false);
    const prevCompletionArmedAt = prevXd.completion_armed_at || null;
    const minAirborneSecondsForCompletion = 35;
    const completionArmSignal = hasBeenAirborne && !on_ground && (
      airborneDurationSec >= minAirborneSecondsForCompletion ||
      (speedNow >= 120 && altitude >= 300)
    );
    const completionArmed = completionArmSignal || (prevCompletionArmed && hasBeenAirborne);
    const completionArmedAt = completionArmSignal
      ? (prevCompletionArmedAt || new Date().toISOString())
      : ((on_ground && !hasBeenAirborne) ? null : prevCompletionArmedAt);
    const incidentArmed = hasBeenAirborne || completionArmed;
    const normalizedBridgeEventTypes = new Set(
      (Array.isArray(incomingBridgeEventLog) ? incomingBridgeEventLog : [])
        .map((evt) => toHudAscii(evt?.type || evt?.event || evt?.name || evt?.code || "", ""))
        .map((evtTypeRaw) => String(evtTypeRaw || "").toLowerCase().replace(/[^a-z0-9_]/g, "_").trim())
        .filter(Boolean)
    );
    const hasBridgeEventType = (tp) => normalizedBridgeEventTypes.has(String(tp || "").toLowerCase());
    const rawTailstrikeFlag = toBool(tailstrike, false);
    const rawStallFlag = !!(stall || is_in_stall || stall_warning || override_alpha);
    const rawOverspeedFlag = toBool(overspeed, false);
    const rawFlapsOverspeedFlag = toBool(flaps_overspeed, false);
    const rawGearUpLandingFlag = toBool(gear_up_landing, false);
    const rawHarshControlsFlag = toBool(data.harsh_controls || data.harshControls, false);
    const rawCrashFlag = !!(crash || has_crashed || crash_flag || hasCrashFailure);
    const prevTakeoffSuppress = (prevXd?.event_takeoff_suppress && typeof prevXd.event_takeoff_suppress === "object")
      ? prevXd.event_takeoff_suppress
      : {};
    const eventTakeoffSuppress = {
      tailstrike: justLiftedOff ? rawTailstrikeFlag : toBool(prevTakeoffSuppress.tailstrike, false),
      stall: justLiftedOff ? rawStallFlag : toBool(prevTakeoffSuppress.stall, false),
      overspeed: justLiftedOff ? rawOverspeedFlag : toBool(prevTakeoffSuppress.overspeed, false),
      flaps_overspeed: justLiftedOff ? rawFlapsOverspeedFlag : toBool(prevTakeoffSuppress.flaps_overspeed, false),
      gear_up_landing: justLiftedOff ? rawGearUpLandingFlag : toBool(prevTakeoffSuppress.gear_up_landing, false),
      harsh_controls: justLiftedOff ? rawHarshControlsFlag : toBool(prevTakeoffSuppress.harsh_controls, false),
      crash: justLiftedOff ? rawCrashFlag : toBool(prevTakeoffSuppress.crash, false),
    };
    if (!rawTailstrikeFlag) eventTakeoffSuppress.tailstrike = false;
    if (!rawStallFlag) eventTakeoffSuppress.stall = false;
    if (!rawOverspeedFlag) eventTakeoffSuppress.overspeed = false;
    if (!rawFlapsOverspeedFlag) eventTakeoffSuppress.flaps_overspeed = false;
    if (!rawGearUpLandingFlag) eventTakeoffSuppress.gear_up_landing = false;
    if (!rawHarshControlsFlag) eventTakeoffSuppress.harsh_controls = false;
    if (!rawCrashFlag) eventTakeoffSuppress.crash = false;

    const tailstrikeDetected = incidentArmed && (hasBridgeEventType("tailstrike") || (rawTailstrikeFlag && !eventTakeoffSuppress.tailstrike));
    const stallDetected = incidentArmed && (hasBridgeEventType("stall") || (rawStallFlag && !eventTakeoffSuppress.stall));
    const overspeedDetected = incidentArmed && (hasBridgeEventType("overspeed") || (rawOverspeedFlag && !eventTakeoffSuppress.overspeed));
    const flapsOverspeedDetected = incidentArmed && (hasBridgeEventType("flaps_overspeed") || (rawFlapsOverspeedFlag && !eventTakeoffSuppress.flaps_overspeed));
    const gearUpLandingDetected = incidentArmed && (hasBridgeEventType("gear_up_landing") || (rawGearUpLandingFlag && !eventTakeoffSuppress.gear_up_landing));
    const harshControlsDetected = incidentArmed && (hasBridgeEventType("harsh_controls") || (rawHarshControlsFlag && !eventTakeoffSuppress.harsh_controls));
    const fuelEmergencyDetected = hasBeenAirborne && toBool(fuel_emergency, false);

    const shouldSynthesizeTouchdownEvidence =
      hasBeenAirborne &&
      on_ground &&
      Number(speed || 0) <= 30;
    const prevVerticalSpeed = Number(prevXd.vertical_speed ?? 0);
    const transitionTouchdownVspeed = justTouchedDown
      ? Math.max(
          50,
          Math.abs(
            Math.min(
              Number.isFinite(prevVerticalSpeed) && Math.abs(prevVerticalSpeed) > 0
                ? prevVerticalSpeed
                : Number(vertical_speed || 0),
              Number(vertical_speed || 0),
              Number(vertical_speed_window_min || 0)
            )
          )
        )
      : 0;
    const captureNowMs = Date.now();
    const prevLandingCaptureStartedAtMs = Date.parse(String(prevXd.landing_capture_started_at || ""));
    const landingCaptureStartedAtMs = justTouchedDown
      ? captureNowMs
      : (Number.isFinite(prevLandingCaptureStartedAtMs) ? prevLandingCaptureStartedAtMs : NaN);
    const landingCaptureActive = hasBeenAirborne && on_ground && Number.isFinite(landingCaptureStartedAtMs)
      ? (captureNowMs - landingCaptureStartedAtMs) <= 9000
      : false;
    const mergedTouchdownVspeedNum = Math.abs(Number(mergedTouchdownVspeed || 0));
    const touchdownCandidate = mergedTouchdownVspeedNum > 0
      ? mergedTouchdownVspeedNum
      : (useBridgeLocalLanding
          ? 0
          : (transitionTouchdownVspeed > 0
              ? transitionTouchdownVspeed
              : (shouldSynthesizeTouchdownEvidence ? Math.max(60, Math.abs(Number(vertical_speed || 0))) : 0)));
    const effectiveTouchdownVspeed = landingCaptureActive
      ? Math.max(Number(prevTouchdownVspeed || 0), touchdownCandidate)
      : ((Number(prevTouchdownVspeed || 0) > 0) ? Number(prevTouchdownVspeed || 0) : touchdownCandidate);
    const mergedLandingGNum = Number(mergedLandingG || 0);
    const transitionLandingG = justTouchedDown ? Math.max(1.0, gForceCurrent) : 0;
    const landingGCandidate = mergedLandingGNum > 0
      ? mergedLandingGNum
      : (useBridgeLocalLanding ? 0 : transitionLandingG);
    const effectiveLandingG = landingCaptureActive
      ? Math.max(Number(prevLandingG || 0), landingGCandidate)
      : ((Number(prevLandingG || 0) > 0) ? Number(prevLandingG || 0) : landingGCandidate);
    const landingDataLocked = bridgeLocalLandingLocked || (
      hasBeenAirborne &&
      on_ground &&
      !landingCaptureActive &&
      (Math.abs(Number(effectiveTouchdownVspeed || 0)) > 0 || Number(effectiveLandingG || 0) > 0)
    );
    const landingCaptureStartedAt = (hasBeenAirborne && on_ground && Number.isFinite(landingCaptureStartedAtMs))
      ? new Date(landingCaptureStartedAtMs).toISOString()
      : null;
    const crashFromTouchdown = hasBeenAirborne && on_ground && (
      Math.abs(Number(effectiveTouchdownVspeed || 0)) >= 900 ||
      Number(effectiveLandingG || 0) >= 2.9
    );
    const overstressDetected = incidentArmed && (toBool(overstress, false) || (hasBeenAirborne && Math.abs(gForceCurrent) >= 2.6));
    const prevCrashState = (!justLiftedOff && hasFreshAirborneState)
      ? toBool(prevXd.crash ?? prevXd.has_crashed, false)
      : false;
    const simDisabledCrashSignal = incidentArmed && toBool(sim_disabled, false) && (
      crashFromTouchdown ||
      Math.abs(Number(vertical_speed || 0)) >= 1800 ||
      Number(gForceCurrent || 0) >= 3.2
    );
    const crashSignalTrusted = incidentArmed
      ? (((rawCrashFlag && !eventTakeoffSuppress.crash) || simDisabledCrashSignal))
      : false;
    const isCrash = !!(crashSignalTrusted || crashFromTouchdown || prevCrashState);
    const effectiveBridgePostInterval = bridgePostIntervalMs ?? (Number(prevXd.bridge_post_interval_ms ?? 0) || null);
    const effectiveBridgeSampleInterval = bridgeSampleIntervalMs ?? (Number(prevXd.bridge_sample_interval_ms ?? 0) || null);
    const resolvedAircraftIcao = canonicalIcao(aircraft_icao || prevXd.aircraft_icao || "");

    const xplaneData = {
      simulator,
      flight_id: flight.id,
      contract_id: flight.contract_id || null,
      altitude,
      speed,
      vertical_speed,
      heading,
      fuel_percentage: effectiveFuelPct,
      fuel_kg: effectiveFuelKg || 0,
      last_valid_fuel_kg: lastValidFuelKg || 0,
      initial_fuel_kg,
      fuel_burn_rate_kgph: fuelBurnRateKgph > 0 ? Number(fuelBurnRateKgph.toFixed(1)) : 0,
      fuel_burn_rate_lph: fuelBurnRateLph > 0 ? Number(fuelBurnRateLph.toFixed(1)) : 0,
      g_force: gForceCurrent,
      max_g_force,
      g_force_window_peak: Number.isFinite(gForceWindowPeakNumeric) ? gForceWindowPeakNumeric : null,
      vertical_speed_window_min: Number(vertical_speed_window_min ?? 0) || 0,
      bridge_post_interval_ms: effectiveBridgePostInterval,
      bridge_sample_interval_ms: effectiveBridgeSampleInterval,
      latitude,
      longitude,
      on_ground,
      park_brake,
      engine1_running,
      engine2_running,
      engines_running: areEnginesRunning,
      touchdown_vspeed: effectiveTouchdownVspeed,
      landing_g_force: effectiveLandingG,
      landing_data_source: useBridgeLocalLanding ? "bridge_local" : (data.landing_data_source || null),
      bridge_local_landing_locked: useBridgeLocalLanding,
      landing_data_locked: landingDataLocked,
      landing_capture_started_at: landingCaptureStartedAt,
      landing_data_timestamp: data.landing_data_timestamp || prevXd.landing_data_timestamp || null,
      landing_quality,
      gear_down: gear_down !== undefined ? gear_down : true,
      flap_ratio,
      pitch: pitch || 0,
      ias: ias || 0,
      tailstrike: tailstrikeDetected,
      stall: stallDetected,
      is_in_stall: incidentArmed && toBool(is_in_stall, false),
      stall_warning: incidentArmed && toBool(stall_warning, false),
      override_alpha: incidentArmed && toBool(override_alpha, false),
      overstress: overstressDetected,
      overspeed: overspeedDetected,
      flaps_overspeed: flapsOverspeedDetected,
      fuel_emergency: fuelEmergencyDetected,
      gear_up_landing: gearUpLandingDetected,
      crash: isCrash,
      has_crashed: isCrash,
      // Expose only trusted crash state (raw plugin crash_flag can be stale/high all the time).
      crash_flag: !!isCrash,
      sim_disabled: !!sim_disabled,
      harsh_controls: harshControlsDetected,
      event_takeoff_suppress: eventTakeoffSuppress,
      was_airborne: hasBeenAirborne,
      airborne_started_at: airborneStartedAt,
      completion_armed: completionArmed,
      completion_armed_at: completionArmedAt,
      // Preserve departure/arrival coords from first packet
      departure_lat: data.departure_lat || (prevXd.departure_lat || 0),
      departure_lon: data.departure_lon || (prevXd.departure_lon || 0),
      arrival_lat: data.arrival_lat || (prevXd.arrival_lat || 0),
      arrival_lon: data.arrival_lon || (prevXd.arrival_lon || 0),
      // Aircraft environment data for calculator
      total_weight_kg: total_weight_kg || (prevXd.total_weight_kg || null),
      oat_c: oat_c !== undefined ? oat_c : (prevXd.oat_c ?? null),
      tat_c: tat_c !== undefined ? tat_c : null,
      ground_elevation_ft: ground_elevation_ft || (prevXd.ground_elevation_ft || null),
      baro_setting: baro_setting || (prevXd.baro_setting || null),
      wind_speed_kts: wind_speed_kts !== undefined ? wind_speed_kts : (prevXd.wind_speed_kts ?? null),
      wind_gust_kts: wind_gust_kts !== undefined ? wind_gust_kts : (prevXd.wind_gust_kts ?? null),
      wind_direction: wind_direction !== undefined ? wind_direction : (prevXd.wind_direction ?? null),
      rain_intensity: rain_intensity !== undefined ? rain_intensity : null,
      rain_detected: rain_detected !== undefined ? rain_detected : (prevXd.rain_detected ?? false),
      precipitation: rain_intensity !== undefined ? rain_intensity : null,
      precip_rate: precip_rate !== undefined ? precip_rate : null,
      precip_state: precip_state !== undefined ? precip_state : null,
      turbulence: turbulence !== undefined ? turbulence : null,
      turbulence_intensity: turbulence !== undefined ? turbulence : null,
      aircraft_icao: resolvedAircraftIcao || aircraft_icao || (prevXd.aircraft_icao || null),
      aircraft_icao_raw: aircraft_icao || (prevXd.aircraft_icao_raw || null),
      aircraft_type: assignedAircraftType || (prevXd.aircraft_type || null),
      reference_refresh_ms: shouldRefreshReferenceData ? Date.now() : (referenceRefreshMsPrev || Date.now()),
      contract_departure_airport: contractDepartureAirport,
      contract_arrival_airport: contractArrivalAirport,
      contract_distance_nm: contractDistanceNm,
      contract_deadline_minutes: contractDeadlineMinutes,
      contract_payout: contractPayout,
      contract_bonus_potential: contractBonusPotential,
      // FMS waypoints - only update if plugin sends them (they don't change often)
      fms_waypoints: incomingFmsWaypoints.length
        ? incomingFmsWaypoints
        : normalizeWpList(prevXd.fms_waypoints || []),
      // Preserve SimBrief route data if present (set by web app/import)
      simbrief_waypoints: data.simbrief_waypoints || (prevXd.simbrief_waypoints || []),
      simbrief_route_string: data.simbrief_route_string || (prevXd.simbrief_route_string || null),
      simbrief_departure_coords: data.simbrief_departure_coords || (prevXd.simbrief_departure_coords || null),
      simbrief_arrival_coords: data.simbrief_arrival_coords || (prevXd.simbrief_arrival_coords || null),
      // Flight path for map visualization
      flight_path: newPath,
      // Flight events log for map markers (gear, flaps, speedbrake, incidents)
      flight_events_log: (() => {
        const prevLog = justLiftedOff
          ? []
          : (Array.isArray(prevXd.flight_events_log) ? prevXd.flight_events_log : []);
        if (!hasBeenAirborne) return prevLog;
        if (!hasValidCoords && incomingBridgeEventLog.length === 0) return prevLog;

        const merged = [...prevLog];
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const recentFingerprints = new Set(
          merged.slice(-500).map((ev) => {
            const latNum = Number(ev?.lat ?? 0);
            const lonNum = Number(ev?.lon ?? 0);
            return `${String(ev?.type || '')}|${latNum.toFixed(4)}|${lonNum.toFixed(4)}|${String(ev?.t || '').slice(0, 19)}`;
          })
        );
        const fallbackLat = Number(latitude);
        const fallbackLon = Number(longitude);
        const fallbackAlt = Math.round(Number(altitude || 0));
        const fallbackSpd = Math.round(Number(speed || 0));
        const fallbackVs = Math.round(Number(vertical_speed || 0));
        const fallbackG = Number((Number(gForceCurrent || 1) || 1).toFixed(2));

        const appendEvent = (type, payload = {}, options = {}) => {
          if (!type) return false;
          const eventType = String(type).trim().toLowerCase();
          if (!eventType) return false;
          const latNum = Number(payload.lat ?? fallbackLat);
          const lonNum = Number(payload.lon ?? fallbackLon);
          if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return false;
          const altNum = Number(payload.alt ?? fallbackAlt);
          const spdNum = Number(payload.spd ?? payload.gs ?? fallbackSpd);
          const vsNum = Number(payload.vs ?? fallbackVs);
          const gNum = Number(payload.g ?? fallbackG);
          const parsedTs = Date.parse(String(payload.t || payload.timestamp || nowIso));
          const eventIso = Number.isFinite(parsedTs) ? new Date(parsedTs).toISOString() : nowIso;
          const force = !!options.force;
          const cooldownSec = Number(options.cooldownSec ?? 0);
          const minDistanceNm = Number(options.minDistanceNm ?? 0);

          if (!force) {
            let lastSame = null;
            for (let i = merged.length - 1; i >= 0; i--) {
              if (String(merged[i]?.type || '').toLowerCase() === eventType) {
                lastSame = merged[i];
                break;
              }
            }
            if (lastSame) {
              const lastTs = Date.parse(String(lastSame?.t || ''));
              if (Number.isFinite(lastTs) && cooldownSec > 0 && (nowMs - lastTs) < (cooldownSec * 1000)) {
                if (!(Number.isFinite(minDistanceNm) && minDistanceNm > 0)) return false;
                const lastLat = Number(lastSame?.lat ?? NaN);
                const lastLon = Number(lastSame?.lon ?? NaN);
                if (Number.isFinite(lastLat) && Number.isFinite(lastLon)) {
                  const movedNm = haversineNm(lastLat, lastLon, latNum, lonNum);
                  if (!Number.isFinite(movedNm) || movedNm < minDistanceNm) return false;
                } else {
                  return false;
                }
              }
            }
          }

          const fingerprint = `${eventType}|${latNum.toFixed(4)}|${lonNum.toFixed(4)}|${eventIso.slice(0, 19)}`;
          if (recentFingerprints.has(fingerprint)) return false;
          recentFingerprints.add(fingerprint);

          merged.push({
            type: eventType,
            lat: latNum,
            lon: lonNum,
            alt: Number.isFinite(altNum) ? Math.round(altNum) : fallbackAlt,
            spd: Number.isFinite(spdNum) ? Math.round(spdNum) : fallbackSpd,
            vs: Number.isFinite(vsNum) ? Math.round(vsNum) : fallbackVs,
            g: Number.isFinite(gNum) ? Number(gNum.toFixed(2)) : fallbackG,
            ...(payload.val !== undefined ? { val: payload.val } : {}),
            t: eventIso,
          });
          return true;
        };

        // Prefer bridge-local event batches when available (prevents missing short incidents between posts).
        const normalizedBridgeEvents = incomingBridgeEventLog
          .map((evt) => {
            const eventTypeRaw = toHudAscii(evt?.type || evt?.event || evt?.name || evt?.code || "", "");
            const eventType = eventTypeRaw.toLowerCase().replace(/[^a-z0-9_]/g, "_").trim();
            if (!eventType) return null;
            const latNum = Number(evt?.lat ?? evt?.latitude ?? fallbackLat);
            const lonNum = Number(evt?.lon ?? evt?.longitude ?? evt?.lng ?? fallbackLon);
            if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
            const eventTsMsRaw = Date.parse(String(evt?.t ?? evt?.timestamp ?? ""));
            const eventTsMs = Number.isFinite(eventTsMsRaw) ? eventTsMsRaw : null;
            return {
              type: eventType,
              lat: latNum,
              lon: lonNum,
              alt: Number(evt?.alt ?? evt?.altitude ?? fallbackAlt),
              spd: Number(evt?.spd ?? evt?.gs ?? evt?.speed ?? fallbackSpd),
              vs: Number(evt?.vs ?? evt?.vertical_speed ?? evt?.verticalSpeed ?? fallbackVs),
              g: Number(evt?.g ?? evt?.g_force ?? evt?.gForce ?? fallbackG),
              t: eventTsMs ? new Date(eventTsMs).toISOString() : nowIso,
              tsMs: eventTsMs,
              val: evt?.val,
            };
          })
          .filter(Boolean)
          .slice(-120);
        const bridgeIncidentTypes = new Set([
          "tailstrike",
          "stall",
          "overstress",
          "overspeed",
          "flaps_overspeed",
          "gear_up_landing",
          "fuel_emergency",
          "harsh_controls",
          "crash",
          "crashed",
          "has_crashed",
        ]);
        const isCrashEventType = (eventType) => eventType === "crash" || eventType === "crashed" || eventType === "has_crashed";
        const suppressByTakeoffType: Record<string, boolean> = {
          tailstrike: !!eventTakeoffSuppress.tailstrike,
          stall: !!eventTakeoffSuppress.stall,
          overspeed: !!eventTakeoffSuppress.overspeed,
          flaps_overspeed: !!eventTakeoffSuppress.flaps_overspeed,
          gear_up_landing: !!eventTakeoffSuppress.gear_up_landing,
          harsh_controls: !!eventTakeoffSuppress.harsh_controls,
          crash: !!eventTakeoffSuppress.crash,
          crashed: !!eventTakeoffSuppress.crash,
          has_crashed: !!eventTakeoffSuppress.crash,
        };
        for (const eventItem of normalizedBridgeEvents) {
          const eventType = String(eventItem?.type || "").toLowerCase();
          const eventTsMs = Number(eventItem?.tsMs ?? NaN);
          const hasValidEventTs = Number.isFinite(eventTsMs);
          const isBridgeIncidentType = bridgeIncidentTypes.has(eventType);
          if (isBridgeIncidentType) {
            if (!incidentArmed) continue;
            if (suppressByTakeoffType[eventType]) continue;
            if (hasValidEventTs && Number.isFinite(airborneStartedAtMs) && eventTsMs < (airborneStartedAtMs - 1500)) continue;
            if (hasValidEventTs && (nowMs - eventTsMs) > 180000) continue;
            if (!hasValidEventTs && airborneDurationSec > 0 && airborneDurationSec < 20) continue;
          }
          if (isCrashEventType(eventItem.type)) {
            if (!isCrash) continue;
            appendEvent("crash", eventItem, {
              force: !!(isCrash && !prevCrashState),
              cooldownSec: 36000,
              minDistanceNm: 9999,
            });
            continue;
          }
          appendEvent(eventItem.type, eventItem, { cooldownSec: 1, minDistanceNm: 0.02 });
        }

        const prevGear = prevXd.gear_down;
        const curGear = gear_down !== undefined ? gear_down : true;
        if (prevGear !== undefined && prevGear !== curGear) {
          appendEvent(curGear ? "gear_down" : "gear_up", {}, { force: true });
        }

        const prevFlap = prevXd.flap_ratio;
        const curFlap = Number(flap_ratio || 0);
        if (prevFlap !== undefined && prevFlap !== null) {
          const prevPct = Math.round(Number(prevFlap) * 100);
          const curPct = Math.round(curFlap * 100);
          if (Math.abs(prevPct - curPct) >= 4) {
            appendEvent("flaps", { val: curPct }, { force: true });
          }
        }

        const prevSpeedbrake = prevXd.speedbrake;
        const curSpeedbrake = data.speedbrake ?? data.speed_brake ?? data.speedBrake ?? data.spoiler ?? null;
        if (curSpeedbrake !== null && curSpeedbrake !== undefined) {
          const prevSb = Number(prevSpeedbrake || 0) > 0.1;
          const curSb = Number(curSpeedbrake) > 0.1;
          if (prevSpeedbrake !== undefined && prevSpeedbrake !== null && prevSb !== curSb) {
            appendEvent(curSb ? "spoiler_on" : "spoiler_off", {}, { force: true });
          }
        }

        const stallNow = stallDetected;
        if (tailstrikeDetected) {
          appendEvent("tailstrike", {}, {
            force: !!(tailstrikeDetected && !prevXd.tailstrike),
            cooldownSec: 60,
            minDistanceNm: 0.4,
          });
        }
        if (stallNow) {
          appendEvent("stall", {}, {
            force: !!(stallNow && !prevXd.stall && !prevXd.is_in_stall && !prevXd.stall_warning),
            cooldownSec: 16,
            minDistanceNm: 0.25,
          });
        }
        if (overstressDetected) {
          appendEvent("overstress", {}, {
            force: !!(overstressDetected && !prevXd.overstress),
            cooldownSec: 14,
            minDistanceNm: 0.2,
          });
        }
        if (overspeedDetected) {
          appendEvent("overspeed", {}, {
            force: !!(overspeedDetected && !prevXd.overspeed),
            cooldownSec: 14,
            minDistanceNm: 0.2,
          });
        }
        if (flapsOverspeedDetected) {
          appendEvent("flaps_overspeed", {}, {
            force: !!(flapsOverspeedDetected && !prevXd.flaps_overspeed),
            cooldownSec: 20,
            minDistanceNm: 0.2,
          });
        }
        if (gearUpLandingDetected) {
          appendEvent("gear_up_landing", {}, {
            force: !!(gearUpLandingDetected && !prevXd.gear_up_landing),
            cooldownSec: 120,
            minDistanceNm: 0.1,
          });
        }
        if (isCrash) {
          appendEvent("crash", {}, {
            force: !!(isCrash && !prevCrashState),
            cooldownSec: 36000,
            minDistanceNm: 9999,
          });
        }

        return merged.length > 650 ? merged.slice(-650) : merged;
      })(),
      // Speedbrake state for change detection
      speedbrake: data.speedbrake ?? data.speed_brake ?? data.speedBrake ?? data.spoiler ?? (prevXd.speedbrake ?? null),
      // Telemetry history for post-flight profile chart.
      // Sample close to bridge post interval so spikes are less likely to disappear.
      telemetry_history: (() => {
        const prevHistory = Array.isArray(prevXd.telemetry_history) ? prevXd.telemetry_history : [];
        const now = Date.now();
        const lastEntry = prevHistory.length > 0 ? prevHistory[prevHistory.length - 1] : null;
        const lastTs = lastEntry?.t ? new Date(lastEntry.t).getTime() : 0;
        const fallbackInterval = Number(prevXd.bridge_post_interval_ms ?? 2000) || 2000;
        const desiredInterval = bridgePostIntervalMs || fallbackInterval;
        const historySampleMs = Math.max(1200, Math.min(4000, desiredInterval));
        if (now - lastTs >= historySampleMs) {
          const newPt = {
            t: new Date().toISOString(),
            alt: Math.round(altitude || 0),
            spd: Math.round(speed || 0),
            ias: Math.round(ias || 0),
            vs: Math.round(vertical_speed || 0),
            g: Number((gForceCurrent || 1).toFixed(2)),
            lat: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
            lon: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
            hdg: Number.isFinite(Number(heading)) ? Math.round(Number(heading)) : null,
          };
          const updated = [...prevHistory, newPt];
          // Keep max 3600 points (~2h at 2s intervals) for detailed post-flight charts.
          return updated.length > 3600 ? updated.slice(-3600) : updated;
        }
        return prevHistory;
      })(),
      timestamp: new Date().toISOString()
    };

    // Build minimal update object - only include what changes
    const updateData = { xplane_data: xplaneData };

    // Track max G-force on flight level
    if (max_g_force > (flight.max_g_force || 0)) {
      updateData.max_g_force = max_g_force;
    }

    // Only process failures if plugin sends them (rare event, not every packet)
    const pluginFailures = data.active_failures || [];
    if (pluginFailures.length > 0) {
      const existingFailures = flight.active_failures || [];
      const existingNames = new Set(existingFailures.map(f => f.name));
      const newFailures = [];
      for (const pf of pluginFailures) {
        if (!existingNames.has(pf.name)) {
          newFailures.push({
            name: toHudAscii(pf.name || pf.name_de || "INCIDENT", "INCIDENT"),
            severity: toHudAscii(pf.severity || "medium", "medium"),
            category: toHudAscii(pf.category || "system", "system"),
            timestamp: new Date().toISOString()
          });
        }
      }
      if (newFailures.length > 0) {
        updateData.active_failures = [...existingFailures, ...newFailures];
        const existingDamage = flight.maintenance_damage || {};
        const newDamage = { ...existingDamage };
        for (const f of newFailures) {
          const cat = f.category || 'airframe';
          const dmg = f.severity === 'schwer' ? 15 : f.severity === 'mittel' ? 8 : 3;
          newDamage[cat] = (newDamage[cat] || 0) + dmg;
        }
        updateData.maintenance_damage = newDamage;
      }
    }

    // Keep request path non-blocking so bridge packets cannot stall on DB latency.
    base44.asServiceRole.entities.Flight.update(flight.id, updateData).catch((err) => {
      console.error("Flight.update failed:", err);
    });
    patchActiveFlightCache(company.id, {
      ...flight,
      xplane_data: xplaneData,
      max_g_force: updateData.max_g_force ?? flight.max_g_force,
      active_failures: updateData.active_failures ?? flight.active_failures,
      maintenance_damage: updateData.maintenance_damage ?? flight.maintenance_damage,
      status: flight.status || "in_flight",
    });

    // Use cached maintenance_ratio from Company (updated in background ~10% of requests)
    const maintenanceRatio = company?.current_maintenance_ratio || 0;
    
    const completionReady = on_ground && hasBeenAirborne && completionArmed;
    const flightStatus = completionReady ? 'ready_to_complete' : 'updated';
    
    // === FAILURE TRIGGER SYSTEM ===
    // Failures are triggered based on maintenance wear percentage.
    // Higher wear = higher chance of failure per data packet.
    // Only trigger failures when airborne to avoid ground anomalies.
    let triggeredFailures = [];
    if (hasBeenAirborne && !on_ground && flight.aircraft_id) {
      // Use cached maintenance ratio for quick check (0.0 = perfect, 1.0 = 100% worn)
      // Only attempt failure rolls if maintenance is above 15%
      if (maintenanceRatio > 0.15) {
        // Base chance per data packet (~1 per second): 
        // At 20% wear: 0.05% chance per tick (~3% per minute)
        // At 50% wear: 0.25% chance per tick (~15% per minute) 
        // At 80% wear: 0.8% chance per tick (~40% per minute)
        // At 100% wear: 1.5% chance per tick (~60% per minute)
        const baseChance = Math.pow(maintenanceRatio, 2.5) * 0.015;
        
        // Roll for failure
        if (Math.random() < baseChance) {
          // Determine which category fails based on individual wear levels
          // Fetch aircraft data (async, but we respond before it completes)
          (async () => {
            try {
              const aircraftList = await base44.asServiceRole.entities.Aircraft.filter({ id: flight.aircraft_id });
              const ac = aircraftList[0];
              if (!ac?.maintenance_categories) return;
              
              const cats = ac.maintenance_categories;
              // Build weighted pool: categories with higher wear are more likely to fail
              const pool = [];
              const categoryFailures = {
                engine: [
                  { name: 'Engine Power Loss', name_de: 'Triebwerk Leistungsverlust', severity: 'schwer' },
                  { name: 'Engine Vibration', name_de: 'Triebwerk Vibration', severity: 'mittel' },
                  { name: 'Oil Pressure Warning', name_de: 'Öldruck Warnung', severity: 'leicht' },
                ],
                hydraulics: [
                  { name: 'Hydraulic Pressure Low', name_de: 'Hydraulikdruck niedrig', severity: 'mittel' },
                  { name: 'Hydraulic Leak', name_de: 'Hydraulikleck', severity: 'schwer' },
                ],
                avionics: [
                  { name: 'Autopilot Disconnect', name_de: 'Autopilot Abschaltung', severity: 'mittel' },
                  { name: 'Navigation Display Failure', name_de: 'Navigationsanzeige Ausfall', severity: 'leicht' },
                  { name: 'Radio Failure', name_de: 'Funkausfall', severity: 'leicht' },
                ],
                airframe: [
                  { name: 'Cabin Pressure Warning', name_de: 'Kabinendruck Warnung', severity: 'schwer' },
                  { name: 'Structural Vibration', name_de: 'Strukturelle Vibration', severity: 'mittel' },
                ],
                landing_gear: [
                  { name: 'Gear Indicator Fault', name_de: 'Fahrwerksanzeige Fehler', severity: 'leicht' },
                  { name: 'Gear Retraction Problem', name_de: 'Fahrwerk Einfahrproblem', severity: 'mittel' },
                ],
                electrical: [
                  { name: 'Generator Failure', name_de: 'Generator Ausfall', severity: 'mittel' },
                  { name: 'Bus Voltage Low', name_de: 'Bus Spannung niedrig', severity: 'leicht' },
                  { name: 'Battery Overheat', name_de: 'Batterie Überhitzung', severity: 'schwer' },
                ],
                flight_controls: [
                  { name: 'Trim Runaway', name_de: 'Trimmung Durchdrehen', severity: 'schwer' },
                  { name: 'Aileron Stiffness', name_de: 'Querruder Schwergängig', severity: 'leicht' },
                  { name: 'Elevator Malfunction', name_de: 'Höhenruder Fehlfunktion', severity: 'mittel' },
                ],
                pressurization: [
                  { name: 'Bleed Air Leak', name_de: 'Zapfluft Leck', severity: 'mittel' },
                  { name: 'Pack Failure', name_de: 'Klimaanlage Ausfall', severity: 'leicht' },
                  { name: 'Pressurization Loss', name_de: 'Druckverlust', severity: 'schwer' },
                ]
              };
              
              for (const [cat, wear] of Object.entries(cats)) {
                if (wear > 20 && categoryFailures[cat]) {
                  // Weight: more wear = more likely to be selected
                  const weight = Math.round(wear);
                  for (let w = 0; w < weight; w++) {
                    pool.push(cat);
                  }
                }
              }
              
              if (pool.length === 0) return;
              
              // Pick a random category from weighted pool
              const selectedCat = pool[Math.floor(Math.random() * pool.length)];
              const possibleFailures = categoryFailures[selectedCat] || [];
              if (possibleFailures.length === 0) return;
              
              // Higher wear = more severe failures possible
              const catWear = cats[selectedCat] || 0;
              let filtered = possibleFailures;
              if (catWear < 40) {
                filtered = possibleFailures.filter(f => f.severity === 'leicht');
              } else if (catWear < 70) {
                filtered = possibleFailures.filter(f => f.severity !== 'schwer');
              }
              if (filtered.length === 0) filtered = possibleFailures;
              
              const failure = filtered[Math.floor(Math.random() * filtered.length)];
              
              // Check if this failure already exists on the flight
              const existingFailures = flight.active_failures || [];
              const alreadyExists = existingFailures.some(f => f.name === failure.name || f.name === failure.name_de);
              if (alreadyExists) return;
              
              const newFailure = {
                name: failure.name_de,
                severity: failure.severity,
                category: selectedCat,
                timestamp: new Date().toISOString()
              };
              
              // Calculate damage
              const dmg = failure.severity === 'schwer' ? 15 : failure.severity === 'mittel' ? 8 : 3;
              const existingDamage = flight.maintenance_damage || {};
              const updatedDamage = { ...existingDamage };
              updatedDamage[selectedCat] = (updatedDamage[selectedCat] || 0) + dmg;
              
              await base44.asServiceRole.entities.Flight.update(flight.id, {
                active_failures: [...existingFailures, newFailure],
                maintenance_damage: updatedDamage
              });
            } catch (_) { /* ignore failure trigger errors */ }
          })();
        }
      }
    }
    
    // Background maintenance ratio recalculation (~10% of requests, fully async)
    if (Math.random() < 0.1 && flight.aircraft_id) {
      (async () => {
        try {
          const aircraftList = await base44.asServiceRole.entities.Aircraft.filter({ id: flight.aircraft_id });
          const ac = aircraftList[0];
          if (ac?.maintenance_categories) {
            const cats = Object.values(ac.maintenance_categories);
            if (cats.length > 0) {
              const avg = cats.reduce((a, b) => a + (b || 0), 0) / cats.length;
              await base44.asServiceRole.entities.Company.update(company.id, { 
                current_maintenance_ratio: avg / 100 
              });
            }
          }
        } catch (_) { /* ignore */ }
      })();
    }

    const mergedFms = incomingFmsWaypoints.length
      ? incomingFmsWaypoints
      : normalizeWpList(flight.xplane_data?.fms_waypoints || []);
    const mergedSimbriefWps = data.simbrief_waypoints || flight.xplane_data?.simbrief_waypoints || contract?.simbrief_waypoints || [];
    const simbriefDepartureCoords = data.simbrief_departure_coords || flight.xplane_data?.simbrief_departure_coords || contract?.simbrief_departure_coords || null;
    const simbriefArrivalCoords = data.simbrief_arrival_coords || flight.xplane_data?.simbrief_arrival_coords || contract?.simbrief_arrival_coords || null;
    const depWp = mergedFms.length > 0 ? mergedFms[0] : null;
    const arrWp = mergedFms.length > 0 ? mergedFms[mergedFms.length - 1] : null;

    const departure_lat = data.departure_lat || flight.xplane_data?.departure_lat || depWp?.lat || 0;
    const departure_lon = data.departure_lon || flight.xplane_data?.departure_lon || depWp?.lon || 0;
    const arrival_lat = data.arrival_lat || flight.xplane_data?.arrival_lat || arrWp?.lat || 0;
    const arrival_lon = data.arrival_lon || flight.xplane_data?.arrival_lon || arrWp?.lon || 0;
    const currentLat = latitude || 0;
    const currentLon = longitude || 0;
    const validSimbriefWps = Array.isArray(mergedSimbriefWps)
      ? mergedSimbriefWps
          .filter(wp => Number.isFinite(Number(wp?.lat)) && Number.isFinite(Number(wp?.lon)))
          .map((wp, idx) => {
            const lat = Number(wp.lat);
            const lon = Number(wp.lon);
            const rawName = wp?.name || wp?.ident || wp?.fix || wp?.waypoint || `WP${idx + 1}`;
            const name = sanitizeWpToken(rawName, `WP${idx + 1}`) || `WP${idx + 1}`;
            const rawVia = wp?.airway || wp?.via_airway || wp?.via || wp?.airway_ident || "DCT";
            const via = sanitizeWpToken(rawVia, "DCT") || "DCT";
            const rawAlt = Number(wp?.alt ?? wp?.altitude_feet ?? wp?.altitude ?? 0);
            const alt = Number.isFinite(rawAlt) ? Math.max(0, Math.round(rawAlt)) : 0;
            return { lat, lon, name, via, alt };
          })
      : [];
    const depPos = (simbriefDepartureCoords?.lat && simbriefDepartureCoords?.lon)
      ? { lat: Number(simbriefDepartureCoords.lat), lon: Number(simbriefDepartureCoords.lon) }
      : (departure_lat && departure_lon) ? { lat: Number(departure_lat), lon: Number(departure_lon) } : null;
    const arrPos = (simbriefArrivalCoords?.lat && simbriefArrivalCoords?.lon)
      ? { lat: Number(simbriefArrivalCoords.lat), lon: Number(simbriefArrivalCoords.lon) }
      : (arrival_lat && arrival_lon) ? { lat: Number(arrival_lat), lon: Number(arrival_lon) } : null;

    let routePoints = [];
    if (depPos) routePoints.push(depPos);
    routePoints = routePoints.concat(validSimbriefWps);
    if (arrPos) routePoints.push(arrPos);
    if (routePoints.length < 2 && depPos && arrPos) {
      routePoints = [depPos, arrPos];
    }

    const hasValidPosition = Number.isFinite(currentLat) && Number.isFinite(currentLon) && (currentLat !== 0 || currentLon !== 0);
    const simbriefTotalNmRaw = routePoints.length >= 2 ? routeTotalNm(routePoints) : null;
    const simbriefRemainingNm = (simbriefTotalNmRaw && simbriefTotalNmRaw > 0 && hasValidPosition)
      ? distanceAlongRouteNm(routePoints, currentLat, currentLon).totalRemaining
      : null;
    const simbriefTotalNm = simbriefTotalNmRaw !== null ? Math.round(simbriefTotalNmRaw) : null;
    const simbriefFlownNm = (simbriefTotalNm !== null && simbriefRemainingNm !== null)
      ? Math.max(0, Math.round(simbriefTotalNm - simbriefRemainingNm))
      : null;
    const simbriefProgressPct = (simbriefTotalNm !== null && simbriefRemainingNm !== null && simbriefTotalNm > 0)
      ? Math.max(0, Math.min(100, Math.round((simbriefFlownNm / simbriefTotalNm) * 100)))
      : null;
    const simbriefRouteCompact = validSimbriefWps.length ? routeCompact(validSimbriefWps) : null;
    const appOrigin = new URL(req.url).origin.replace(/\/$/, '');
    const liveMapUrl = flight.contract_id
      ? `${appOrigin}/FlightTracker?contractId=${encodeURIComponent(flight.contract_id)}`
      : `${appOrigin}/ActiveFlights`;
    const activeFailuresForHud = Array.isArray(flight.active_failures) ? flight.active_failures : [];
    const lastFailureForHud = activeFailuresForHud.length ? activeFailuresForHud[activeFailuresForHud.length - 1] : null;
    const base44LastIncident = lastFailureForHud
      ? toHudAscii(lastFailureForHud.name || lastFailureForHud.name_de || null, null)
      : null;
    const dynamicDeadlineMinutes = calculateDeadlineMinutes(
      contractDistanceNm ?? null,
      aircraft_icao || flight.xplane_data?.aircraft_icao || null,
      assignedAircraftType || flight.xplane_data?.aircraft_type || null
    );
    const selectedDeadlineMinutes = dynamicDeadlineMinutes ?? contractDeadlineMinutes ?? null;
    let deadlineRemainingSec = null;
    if (selectedDeadlineMinutes !== null && Number.isFinite(Number(selectedDeadlineMinutes))) {
      const totalDeadlineSec = Math.max(0, Math.round(Number(selectedDeadlineMinutes) * 60));
      let elapsedSec = 0;
      const airborneTs = xplaneData.airborne_started_at || flight.xplane_data?.airborne_started_at || null;
      if (airborneTs) {
        const parsed = Date.parse(airborneTs);
        if (Number.isFinite(parsed)) {
          elapsedSec = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
        }
      }
      deadlineRemainingSec = totalDeadlineSec - elapsedSec;
    }
    const prev = prevXd;
    // Use already-normalized variables (not raw data.*) so MSFS aliases are covered
    const mergedScorePacket = {
      max_g_force: Math.max(Number(max_g_force || 0), Number(prev.max_g_force || 0)),
      landing_g_force: Number(effectiveLandingG ?? prev.landing_g_force ?? 0),
      tailstrike: !!tailstrikeDetected,
      stall: !!stallDetected,
      overstress: !!overstressDetected,
      overspeed: !!overspeedDetected,
      flaps_overspeed: !!flapsOverspeedDetected,
      gear_up_landing: !!gearUpLandingDetected,
      crash: !!isCrash,
      has_crashed: !!isCrash,
    };
    const liveScore = computeLiveScore(mergedScorePacket);

    // Keep a live XPlaneLog stream during active contracts, but throttle writes
    // to reduce backend load and telemetry lag.
    const prevXPlaneLogAtMs = Number(prevXd.last_xplanelog_at_ms ?? 0);
    const nowMs = Date.now();
    const shouldWriteLiveLog =
      !Number.isFinite(prevXPlaneLogAtMs) ||
      prevXPlaneLogAtMs <= 0 ||
      (nowMs - prevXPlaneLogAtMs) >= 2000;
    xplaneData.last_xplanelog_at_ms = shouldWriteLiveLog ? nowMs : prevXPlaneLogAtMs;
    if (shouldWriteLiveLog) {
      base44.asServiceRole.entities.XPlaneLog.create({
        company_id: company.id,
        raw_data: xplaneData,
        altitude,
        speed,
        on_ground,
        flight_score: liveScore,
        has_active_flight: true,
      }).catch(() => {});
    }

    // Background cleanup so logs do not grow unbounded.
    if (Math.random() < 0.02) {
      base44.asServiceRole.entities.XPlaneLog.filter(
        { company_id: company.id }, '-created_date', 120
      ).then(async (oldLogs) => {
        if (oldLogs.length > 40) {
          await Promise.all(oldLogs.slice(40).map(l => base44.asServiceRole.entities.XPlaneLog.delete(l.id)));
        }
      }).catch(() => {});
    }

    // Respond IMMEDIATELY - no awaiting any DB operations
    return Response.json({ 
      flight_id: flight.id,
      contract_id: flight.contract_id || null,
      departure_airport: contractDepartureAirport,
      arrival_airport: contractArrivalAirport,
      // Livemap source values (primary for plugin HUD)
      livemap_total_nm: simbriefTotalNm,
      livemap_remaining_nm: simbriefRemainingNm,
      livemap_flown_nm: simbriefFlownNm,
      livemap_progress_pct: simbriefProgressPct,
      // Keep legacy fields for compatibility
      distance_nm: simbriefRemainingNm ?? contractDistanceNm ?? null,
      deadline_minutes: selectedDeadlineMinutes,
      base44_score: liveScore ?? data.flight_score ?? flight.flight_score ?? 100,
      base44_last_incident: base44LastIncident,
      base44_active_failures_count: activeFailuresForHud.length,
      base44_deadline_remaining_sec: deadlineRemainingSec,
      contract_payout: contractPayout ?? null,
      contract_bonus_potential: contractBonusPotential ?? null,
      contract_total_potential: ((contractPayout ?? 0) + (contractBonusPotential ?? 0)) || null,
      contract_payout_currency: "$",
      departure_lat,
      departure_lon,
      arrival_lat,
      arrival_lon,
      simbrief_total_nm: simbriefTotalNm,
      simbrief_remaining_nm: simbriefRemainingNm,
      simbrief_flown_nm: simbriefFlownNm,
      simbrief_progress_pct: simbriefProgressPct,
      simbrief_route_compact: simbriefRouteCompact,
      live_map_url: liveMapUrl,
      status: flightStatus,
      on_ground,
      park_brake,
      engines_running: areEnginesRunning,
      maintenance_ratio: maintenanceRatio,
      aircraft_gate_blocked: aircraftGateBlocked,
      aircraft_gate_reason: aircraftGateReason,
      aircraft_gate_icao: aircraftIcao || aircraft_icao || null,
      aircraft_gate_display_name: aircraftGateDisplayName,
      aircraft_gate_price: aircraftGatePrice,
      aircraft_gate_required_level: aircraftGateRequiredLevel,
      aircraft_gate_company_level: gateMeta.companyLevel,
      aircraft_owned: aircraftOwned,
      xplane_connection_status: 'connected',
      server_processing_ms: Date.now() - reqStartedAtMs,
      simulator
    });

  } catch (error) {
    console.error('Error receiving X-Plane data:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
