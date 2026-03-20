import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
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

    // Find company by API key
    const companies = await base44.asServiceRole.entities.Company.filter({ xplane_api_key: apiKey });
    if (companies.length === 0) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    const company = companies[0];
    
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
    const altitude = data.altitude ?? data.alt ?? data.indicated_altitude;
    const speed = data.speed ?? data.airspeed ?? data.true_airspeed ?? data.tas;
    const vertical_speed = data.vertical_speed ?? data.verticalSpeed ?? data.vspeed ?? data.vertical_rate;
    const heading = data.heading ?? data.hdg ?? data.true_heading ?? data.magnetic_heading;
    const fuel_percentage = data.fuel_percentage ?? data.fuelPercentage ?? data.fuel_percent;
    const fuel_kg = data.fuel_kg ?? data.fuelKg ?? data.fuel_weight_kg ?? data.total_fuel_kg;
    const g_force = data.g_force ?? data.gForce ?? data.g_load ?? data.gLoad;
    const max_g_force = data.max_g_force ?? data.maxGForce ?? data.max_g ?? data.peakG;
    const latitude = data.latitude ?? data.lat;
    const longitude = data.longitude ?? data.lon ?? data.lng;
    const on_ground = data.on_ground ?? data.onGround ?? data.sim_on_ground ?? data.isOnGround;
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

    // Normalize field names (support both X-Plane and MSFS naming conventions)
    // MSFS bridges may use different field names for the same data
    const park_brake = data.parking_brake || data.park_brake || data.parkingBrake || false;
    const engine1_running = data.engine1_running || data.eng1Running || data.engine_1_running || false;
    const engine2_running = data.engine2_running || data.eng2Running || data.engine_2_running || false;
    const engines_running = data.engines_running || data.enginesRunning || engine1_running || engine2_running;
    // MSFS crash detection: support multiple field names
    const isCrash = crash || has_crashed || data.crashed || data.is_crashed || data.sim_crashed || false;
    const aircraft_icao = data.aircraft_icao || data.aircraftIcao || data.atc_type || data.icao_type;
    const normalizeIcaoCode = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
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

    // Get active flight for this company (single DB query)
    const flights = await base44.asServiceRole.entities.Flight.filter({ 
      company_id: company.id,
      status: 'in_flight'
    });
    
    const flight = flights[0] || null;
    
    if (!flight) {
      const gateMeta = await resolveAircraftGateMeta();
      // No active flight - log to XPlaneLog so debug page can show data
      base44.asServiceRole.entities.XPlaneLog.create({
        company_id: company.id,
        raw_data: data,
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
    
    // Active flight exists - skip XPlaneLog write entirely to maximize speed
    let contract = null;
    let assignedAircraft = null;
    let assignedAircraftType = null;
    if (flight.contract_id) {
      try {
        const contracts = await base44.asServiceRole.entities.Contract.filter({ id: flight.contract_id });
        contract = contracts[0] || null;
      } catch (_) {
        contract = null;
      }
    }
    if (flight.aircraft_id) {
      try {
        const aircraftList = await base44.asServiceRole.entities.Aircraft.filter({ id: flight.aircraft_id });
        assignedAircraft = aircraftList?.[0] || null;
        assignedAircraftType = assignedAircraft?.type || null;
      } catch (_) {
        assignedAircraft = null;
        assignedAircraftType = null;
      }
    }

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
    const oat_c = data.oat_c ?? data.oat ?? data.outside_air_temp_c ?? data.temperature_c ?? data.ambient_temperature ?? data.outside_temperature ?? data.temperature ?? data.ambient_temp_c ?? undefined;
    const ground_elevation_ft = data.ground_elevation_ft ?? data.elevation_ft ?? data.airport_elevation_ft ?? data.ground_altitude ?? null;
    let baro_setting = data.baro_setting ?? data.qnh ?? data.altimeter_setting ?? data.baro ?? data.baro_hpa ?? null;
    if (!baro_setting) {
      const inHg = data.kohlsman_setting_hg ?? data.altimeter_setting_hg ?? data.baro_setting_inhg ?? null;
      if (inHg) baro_setting = inHg * 33.8639;
    }
    let wind_speed_kts = data.wind_speed_kts ?? data.wind_speed ?? data.windspeed_kts ?? data.ambient_wind_speed ?? data.wind_velocity ?? undefined;
    if (wind_speed_kts === undefined && data.ambient_wind_x !== undefined && data.ambient_wind_z !== undefined) {
      wind_speed_kts = Math.sqrt(data.ambient_wind_x ** 2 + data.ambient_wind_z ** 2) * 1.94384;
    }
    const wind_direction = data.wind_direction ?? data.wind_dir ?? data.wind_heading ?? data.ambient_wind_direction ?? data.wind_deg ?? undefined;
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
    const wasAirborne = flight.xplane_data?.was_airborne || false;
    const isNowAirborne = !on_ground && altitude > 50;
    const hasBeenAirborne = wasAirborne || isNowAirborne;

    // Track initial fuel for consumption calculation
    const initial_fuel_kg = flight.xplane_data?.initial_fuel_kg || fuel_kg || 0;

    // Track flight path (add position every update, limited to keep data manageable)
    // Record positions both airborne AND on ground (for takeoff/landing path visualization)
    const existingPath = flight.xplane_data?.flight_path || [];
    let newPath = existingPath;
    // Only record path if we have a valid position (not near 0,0 which is default/uninitialized)
    const hasValidCoords = Number.isFinite(latitude) && Number.isFinite(longitude) 
      && (Math.abs(latitude) > 0.5 || Math.abs(longitude) > 0.5);
    if (hasValidCoords) {
      // Filter out any bad initial points near 0,0 from existing path
      const cleanPath = existingPath.filter(p => Math.abs(p[0]) > 0.5 || Math.abs(p[1]) > 0.5);
      const lastPt = cleanPath[cleanPath.length - 1];
      // Add point only if moved enough (reduce data) - tighter threshold on ground for taxi path
      const threshold = on_ground ? 0.001 : 0.005;
      if (!lastPt || Math.abs(lastPt[0] - latitude) > threshold || Math.abs(lastPt[1] - longitude) > threshold) {
        newPath = [...cleanPath, [latitude, longitude]];
        // Keep max 800 points (increased for ground segments)
        if (newPath.length > 800) newPath = newPath.filter((_, i) => i % 2 === 0 || i === newPath.length - 1);
      } else {
        newPath = cleanPath;
      }
    }

    // Build a LEAN xplane_data object - only current sensor readings
    // No merging with previous data (the frontend tracks accumulated state)
    const prevAirborneStartedAt = flight.xplane_data?.airborne_started_at || null;
    const airborneStartedAt = (!on_ground && altitude > 10)
      ? (prevAirborneStartedAt || new Date().toISOString())
      : prevAirborneStartedAt;

    const xplaneData = {
      simulator,
      altitude,
      speed,
      vertical_speed,
      heading,
      fuel_percentage,
      fuel_kg: fuel_kg || 0,
      initial_fuel_kg,
      g_force,
      max_g_force,
      latitude,
      longitude,
      on_ground,
      park_brake,
      engine1_running,
      engine2_running,
      engines_running: areEnginesRunning,
      touchdown_vspeed,
      landing_g_force,
      landing_quality,
      gear_down: gear_down !== undefined ? gear_down : true,
      flap_ratio,
      pitch: pitch || 0,
      ias: ias || 0,
      tailstrike,
      stall: stall || is_in_stall || stall_warning || override_alpha,
      is_in_stall,
      stall_warning,
      override_alpha,
      overstress,
      overspeed: overspeed || false,
      flaps_overspeed: flaps_overspeed || false,
      fuel_emergency,
      gear_up_landing,
      crash: isCrash,
      has_crashed: isCrash,
      harsh_controls: data.harsh_controls || data.harshControls || false,
      was_airborne: hasBeenAirborne,
      airborne_started_at: airborneStartedAt,
      // Preserve departure/arrival coords from first packet
      departure_lat: data.departure_lat || (flight.xplane_data?.departure_lat || 0),
      departure_lon: data.departure_lon || (flight.xplane_data?.departure_lon || 0),
      arrival_lat: data.arrival_lat || (flight.xplane_data?.arrival_lat || 0),
      arrival_lon: data.arrival_lon || (flight.xplane_data?.arrival_lon || 0),
      // Aircraft environment data for calculator
      total_weight_kg: total_weight_kg || (flight.xplane_data?.total_weight_kg || null),
      oat_c: oat_c !== undefined ? oat_c : (flight.xplane_data?.oat_c ?? null),
      ground_elevation_ft: ground_elevation_ft || (flight.xplane_data?.ground_elevation_ft || null),
      baro_setting: baro_setting || (flight.xplane_data?.baro_setting || null),
      wind_speed_kts: wind_speed_kts !== undefined ? wind_speed_kts : (flight.xplane_data?.wind_speed_kts ?? null),
      wind_direction: wind_direction !== undefined ? wind_direction : (flight.xplane_data?.wind_direction ?? null),
      aircraft_icao: aircraft_icao || (flight.xplane_data?.aircraft_icao || null),
      aircraft_type: assignedAircraftType || (flight.xplane_data?.aircraft_type || null),
      // FMS waypoints - only update if plugin sends them (they don't change often)
      fms_waypoints: incomingFmsWaypoints.length
        ? incomingFmsWaypoints
        : normalizeWpList(flight.xplane_data?.fms_waypoints || []),
      // Preserve SimBrief route data if present (set by web app/import)
      simbrief_waypoints: data.simbrief_waypoints || (flight.xplane_data?.simbrief_waypoints || []),
      simbrief_route_string: data.simbrief_route_string || (flight.xplane_data?.simbrief_route_string || null),
      simbrief_departure_coords: data.simbrief_departure_coords || (flight.xplane_data?.simbrief_departure_coords || null),
      simbrief_arrival_coords: data.simbrief_arrival_coords || (flight.xplane_data?.simbrief_arrival_coords || null),
      // Flight path for map visualization
      flight_path: newPath,
      // Telemetry history for post-flight profile chart (sampled every ~15s, max 600 points)
      telemetry_history: (() => {
        const prevHistory = flight.xplane_data?.telemetry_history || [];
        const now = Date.now();
        const lastEntry = prevHistory.length > 0 ? prevHistory[prevHistory.length - 1] : null;
        const lastTs = lastEntry?.t ? new Date(lastEntry.t).getTime() : 0;
        // Only record a new sample every ~15 seconds
        if (now - lastTs >= 15000) {
          const newPt = {
            t: new Date().toISOString(),
            alt: Math.round(altitude || 0),
            spd: Math.round(speed || 0),
            ias: Math.round(ias || 0),
            vs: Math.round(vertical_speed || 0),
            g: Number((g_force || 1).toFixed(2)),
          };
          const updated = [...prevHistory, newPt];
          // Keep max 600 points (~2.5 hours at 15s intervals)
          return updated.length > 600 ? updated.slice(-600) : updated;
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

    // CRITICAL: Fire-and-forget the DB write so X-Plane gets a response IMMEDIATELY.
    // The plugin blocks on the HTTP response, so fast response = fast next send cycle.
    base44.asServiceRole.entities.Flight.update(flight.id, updateData).catch(() => {});

    // Use cached maintenance_ratio from Company (updated in background ~10% of requests)
    const maintenanceRatio = company?.current_maintenance_ratio || 0;
    
    const flightStatus = on_ground && park_brake && !areEnginesRunning && hasBeenAirborne ? 'ready_to_complete' : 'updated';
    
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
      contract?.distance_nm ?? null,
      aircraft_icao || flight.xplane_data?.aircraft_icao || null,
      assignedAircraftType || flight.xplane_data?.aircraft_type || null
    );
    const selectedDeadlineMinutes = dynamicDeadlineMinutes ?? contract?.deadline_minutes ?? null;
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
    const prev = flight.xplane_data || {};
    // Use already-normalized variables (not raw data.*) so MSFS aliases are covered
    const mergedScorePacket = {
      max_g_force: Math.max(Number(max_g_force || 0), Number(prev.max_g_force || 0)),
      landing_g_force: Number(landing_g_force ?? prev.landing_g_force ?? 0),
      tailstrike: !!(tailstrike || prev.tailstrike),
      stall: !!(stall || is_in_stall || stall_warning || override_alpha || prev.stall || prev.is_in_stall || prev.stall_warning || prev.override_alpha),
      overstress: !!(overstress || prev.overstress),
      overspeed: !!(overspeed || prev.overspeed),
      flaps_overspeed: !!(flaps_overspeed || prev.flaps_overspeed),
      gear_up_landing: !!(gear_up_landing || prev.gear_up_landing),
      crash: !!(isCrash || prev.crash || prev.has_crashed),
      has_crashed: !!(isCrash || prev.has_crashed || prev.crash),
    };
    const liveScore = computeLiveScore(mergedScorePacket);

    // Respond IMMEDIATELY - no awaiting any DB operations
    return Response.json({ 
      flight_id: flight.id,
      contract_id: flight.contract_id || null,
      departure_airport: contract?.departure_airport || null,
      arrival_airport: contract?.arrival_airport || null,
      // Livemap source values (primary for plugin HUD)
      livemap_total_nm: simbriefTotalNm,
      livemap_remaining_nm: simbriefRemainingNm,
      livemap_flown_nm: simbriefFlownNm,
      livemap_progress_pct: simbriefProgressPct,
      // Keep legacy fields for compatibility
      distance_nm: simbriefRemainingNm ?? contract?.distance_nm ?? null,
      deadline_minutes: selectedDeadlineMinutes,
      base44_score: liveScore ?? data.flight_score ?? flight.flight_score ?? 100,
      base44_last_incident: base44LastIncident,
      base44_active_failures_count: activeFailuresForHud.length,
      base44_deadline_remaining_sec: deadlineRemainingSec,
      contract_payout: contract?.payout ?? null,
      contract_bonus_potential: contract?.bonus_potential ?? null,
      contract_total_potential: ((contract?.payout ?? 0) + (contract?.bonus_potential ?? 0)) || null,
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
      simulator
    });

  } catch (error) {
    console.error('Error receiving X-Plane data:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});