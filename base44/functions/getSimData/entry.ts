import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const url = new URL(req.url);
    const apiKeyFromRequest =
      (url.searchParams.get('api_key') || String(payload?.api_key || '')).trim();

    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }

    let cid = user?.company_id || null;
    if (!cid && apiKeyFromRequest) {
      const companiesByKey = await base44.asServiceRole.entities.Company.filter({
        xplane_api_key: apiKeyFromRequest,
      });
      cid = companiesByKey?.[0]?.id || null;
    }
    if (!cid) {
      return Response.json(
        {
          error: 'Unauthorized',
          requires_auth: true,
          xplane_connection_status: 'disconnected',
        },
        { status: 200 }
      );
    }

    // Check connection status first
    const companies = await base44.asServiceRole.entities.Company.filter({ id: cid });
    const company = companies[0];
    if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

    if (company.xplane_connection_status !== 'connected') {
      return Response.json({ error: 'Simulator not connected' }, { status: 400 });
    }

    // Get the latest XPlaneLog entry which has the raw_data with all sensor values
    const logs = await base44.asServiceRole.entities.XPlaneLog.filter(
      { company_id: cid },
      '-created_date',
      1
    );

    if (!logs || logs.length === 0) {
      return Response.json({ error: 'No simulator data received yet' }, { status: 404 });
    }

    const log = logs[0];
    const raw = log.raw_data || {};

    // Also check for an active in_flight entry for richer data
    const flights = await base44.asServiceRole.entities.Flight.filter(
      { company_id: cid, status: 'in_flight' },
      '-created_date',
      1
    );
    const flight = flights[0] || null;
    const xd = flight?.xplane_data || {};

    // Helper: pick first defined non-null value
    const pick = (...vals) => {
      for (const v of vals) {
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return null;
    };
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const norm01 = (v) => {
      const n = num(v);
      if (n === null) return null;
      if (n <= 0) return 0;
      if (n <= 1) return n;
      return Math.min(1, n / 100);
    };
    const normalizeIcao = (v) => {
      const s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!s) return '';
      return s.slice(0, 8);
    };
    const inferIcaoFromText = (...values) => {
      const combined = values
        .map((v) => String(v || '').toUpperCase())
        .join(' ');
      const text = combined.replace(/[^A-Z0-9]/g, '');
      if (!text) return null;
      const aliases = [
        [/A20N|A320NEO|AIRBUSA320|A320/, 'A320'],
        [/A21N|A321NEO|AIRBUSA321|A321/, 'A321'],
        [/A19N|A319NEO|AIRBUSA319|A319/, 'A319'],
        [/B38M|B737MAX8|BOEING7378|B737800|737800|B738/, 'B738'],
        [/B39M|B737MAX9|BOEING7379|B737900|737900|B739/, 'B739'],
        [/B78X|B789|BOEING7879|B787900|787900/, 'B789'],
        [/B788|BOEING7878|B787800|787800/, 'B788'],
        [/B77W|B777300ER|B773/, 'B77W'],
        [/C172|CESSNA172/, 'C172'],
        [/C182|CESSNA182/, 'C182'],
        [/TBM9|TBM930|TBM940/, 'TBM9'],
        [/DA62/, 'DA62'],
      ];
      for (const [rx, code] of aliases) {
        if (rx.test(text)) return code;
      }
      const fallback4 = text.match(/[A-Z][A-Z0-9]{3}/);
      if (fallback4) return fallback4[0];
      return null;
    };

    // Merge: prefer live raw_data, fall back to xplane_data on active flight
    // Covers X-Plane 12, MSFS 2020, MSFS 2024 field name variations

    // Temperature: X-Plane uses oat_c, MSFS uses ambient_temperature, outside_temperature, temperature
    const oat_c = pick(
      raw.oat_c, raw.oat, raw.outside_air_temp_c, raw.temperature_c,
      raw.ambient_temperature, raw.outside_temperature, raw.temperature,
      raw.sim_weather_temperature_sealevel_c, raw.ambient_temp_c,
      xd.oat_c
    );

    // Weight: X-Plane uses total_weight_kg, MSFS uses total_weight_pounds (convert), gross_weight
    let total_weight_kg = pick(raw.total_weight_kg, raw.gross_weight_kg, raw.weight_kg, xd.total_weight_kg);
    if (!total_weight_kg) {
      // MSFS often sends weight in pounds
      const lbs = pick(raw.total_weight_lbs, raw.gross_weight_lbs, raw.weight_lbs, raw.total_weight_pounds, raw.gross_weight_pounds);
      if (lbs) total_weight_kg = lbs * 0.453592;
    }

    // Wind speed: X-Plane uses wind_speed_kts, MSFS uses ambient_wind_velocity_x/z or wind_velocity
    let wind_speed_kts = pick(raw.wind_speed_kts, raw.wind_speed, raw.windspeed_kts, raw.ambient_wind_speed, raw.wind_velocity, xd.wind_speed_kts);
    if (!wind_speed_kts && raw.ambient_wind_x !== undefined && raw.ambient_wind_z !== undefined) {
      // MSFS: wind components in m/s -> knots
      wind_speed_kts = Math.sqrt(raw.ambient_wind_x ** 2 + raw.ambient_wind_z ** 2) * 1.94384;
    }

    // Wind direction
    const wind_dir = pick(raw.wind_direction, raw.wind_dir, raw.wind_heading, raw.ambient_wind_direction, raw.wind_deg, xd.wind_direction, xd.wind_dir);

    // QNH/Baro: X-Plane uses baro_setting (hPa), MSFS uses kohlsman_setting_hg (inHg) -> convert
    let baro_setting = pick(raw.baro_setting, raw.qnh, raw.altimeter_setting, raw.baro, raw.baro_hpa, xd.baro_setting);
    if (!baro_setting) {
      const inHg = pick(raw.kohlsman_setting_hg, raw.altimeter_setting_hg, raw.baro_setting_inhg);
      if (inHg) baro_setting = inHg * 33.8639; // inHg to hPa
    }

    // Ground elevation
    const ground_elevation_ft = pick(raw.ground_elevation_ft, raw.elevation_ft, raw.airport_elevation_ft, raw.ground_altitude, raw.plane_alt_above_ground, xd.ground_elevation_ft);

    // Weather extras: turbulence, rain/precipitation, visibility
    const precipRate = pick(raw.precip_rate, raw.ambient_precip_rate, raw.sim_weather_precipitation_rate, raw.rain_rate, xd.precip_rate);
    const precipState = pick(raw.precip_state, raw.ambient_precip_state, raw.precipitation_state, xd.precip_state);
    const hasRainMask = (() => {
      const p = num(precipState);
      return p !== null && (Math.round(p) & 4) === 4;
    })();
    let rain_intensity = norm01(pick(raw.rain_intensity, raw.precipitation, raw.rain, xd.rain_intensity, xd.precipitation, xd.rain));
    if (rain_intensity == null && precipRate != null) {
      const pr = num(precipRate);
      if (pr !== null) rain_intensity = pr <= 1 ? Math.max(0, pr) : Math.min(1, Math.max(0, pr / 4));
    }
    if (rain_intensity == null && hasRainMask) rain_intensity = 0.1;

    const windGust = pick(raw.wind_gust_kts, raw.wind_gust, raw.wind_gust_speed, raw.ambient_wind_gust, xd.wind_gust_kts);
    const gForce = pick(raw.g_force, raw.gForce, raw.g_load, raw.gLoad, xd.g_force);
    const verticalSpeed = pick(raw.vertical_speed, raw.verticalSpeed, raw.vspeed, raw.vertical_rate, xd.vertical_speed);
    const gustSpread = (() => {
      const gust = num(windGust);
      const wind = num(wind_speed_kts);
      if (gust === null || wind === null) return null;
      return Math.max(0, gust - wind);
    })();
    let turbulence = norm01(pick(raw.turbulence, raw.turbulence_intensity, raw.sim_weather_turbulence, raw.turb_intensity, xd.turbulence, xd.turbulence_intensity));
    if (turbulence == null) {
      let estimate = 0;
      const g = num(gForce);
      const vs = num(verticalSpeed);
      const ws = num(wind_speed_kts);
      const gs = num(gustSpread);
      if (g !== null) estimate = Math.max(estimate, Math.min(1, Math.max(0, (Math.abs(g - 1.0) - 0.03) * 3.5)));
      if (vs !== null) estimate = Math.max(estimate, Math.min(1, Math.abs(vs) / 1600));
      if (gs !== null) estimate = Math.max(estimate, Math.min(1, gs / 22));
      if (ws !== null) estimate = Math.max(estimate, Math.min(1, ws / 90) * 0.45);
      if (rain_intensity !== null) estimate = Math.max(estimate, Math.min(1, rain_intensity * 0.55));
      turbulence = estimate > 0 ? estimate : null;
    }
    const visibility_m = pick(raw.visibility_m, raw.visibility, raw.ambient_visibility, raw.sim_weather_visibility_m);

    // Simulator type detection
    const simulator = pick(raw.simulator, xd.simulator);
    let sim_type = simulator || 'unknown';
    if (!simulator) {
      // Auto-detect from field presence
      if (raw.kohlsman_setting_hg !== undefined || raw.ambient_temperature !== undefined) sim_type = 'msfs';
      else if (raw.oat_c !== undefined || raw.baro_setting !== undefined) sim_type = 'xplane';
    }

    // For active flights, xplane_data is fresher than XPlaneLog.raw_data.
    // Prefer xplane_data during in-flight tracking to avoid stale telemetry.
    const hasActiveFlight = !!flight;
    const pickPreferred = (...vals) => {
      if (!vals || vals.length === 0) return null;
      const rawVals = [];
      const xdVals = [];
      for (let i = 0; i < vals.length; i += 2) {
        rawVals.push(vals[i]);
        xdVals.push(vals[i + 1]);
      }
      return hasActiveFlight ? pick(...xdVals, ...rawVals) : pick(...rawVals, ...xdVals);
    };
    const final_weight = pickPreferred(total_weight_kg, pick(xd.total_weight_kg)) ?? null;
    const final_oat = pickPreferred(oat_c, pick(xd.oat_c)) ?? null;
    const final_baro = pickPreferred(baro_setting, pick(xd.baro_setting)) ?? null;
    const final_wind_speed = pickPreferred(wind_speed_kts, pick(xd.wind_speed_kts)) ?? null;
    const final_wind_dir = pickPreferred(wind_dir, pick(xd.wind_direction, xd.wind_dir)) ?? null;
    const final_elev = pickPreferred(ground_elevation_ft, pick(xd.ground_elevation_ft)) ?? null;

    // If plugin doesn't send weight but sends fuel_kg + aircraft_icao, estimate GWT
    // by looking up the aircraft's OEW (operating empty weight) from known types
    let estimated_weight = final_weight;
    const acIcaoRaw = pickPreferred(
      raw.aircraft_icao, xd.aircraft_icao,
      raw.aircraftIcao, xd.aircraftIcao,
      raw.atc_model, xd.atc_model,
      raw.atc_type, xd.atc_type,
      raw.icao_type, xd.icao_type
    );
    const aircraftType = pickPreferred(
      raw.aircraft_type, xd.aircraft_type,
      raw.aircraftType, xd.aircraftType,
      raw.aircraft_name, xd.aircraft_name,
      raw.aircraft, xd.aircraft,
      raw.model, xd.model,
      raw.model_name, xd.model_name,
      raw.title, xd.title
    );
    const acIcao = normalizeIcao(acIcaoRaw) ||
      inferIcaoFromText(acIcaoRaw, aircraftType, xd.aircraft_type, raw.atc_model, raw.atc_type) ||
      null;
    const fuelKg = pickPreferred(raw.fuel_kg, xd.fuel_kg);
    if (!estimated_weight && fuelKg && acIcao) {
      // Known OEW (Operating Empty Weight) in kg for common types
      const oewTable = {
        'C172': 767, 'C182': 880, 'C208': 2145, 'PA28': 680, 'SR22': 1050,
        'DA40': 800, 'DA42': 1280, 'DA62': 1470, 'TBM9': 2100, 'PC12': 2845,
        'B350': 4080, 'AT76': 13500, 'DH8D': 17745, 'CRJ9': 22300,
        'E170': 21000, 'E175': 21800, 'E190': 28000, 'E195': 28970,
        'A318': 39500, 'A319': 40800, 'A320': 42600, 'A321': 48500,
        'A20N': 44300, 'A21N': 50100,
        'B731': 28100, 'B732': 29000, 'B733': 31500, 'B734': 33200,
        'B735': 31300, 'B736': 36400, 'B737': 37600, 'B738': 41400,
        'B739': 42100, 'B38M': 45070, 'B39M': 45860,
        '737': 41400, '738': 41400, '739': 42100, // short MSFS ICAO codes
        'B752': 58400, 'B753': 62100,
        'B763': 86070, 'B764': 92500,
        'B772': 138100, 'B773': 160530, 'B77W': 167800, 'B77L': 155530,
        'B744': 178756, 'B748': 197131, 'B788': 119950, 'B789': 128850, 'B78X': 135500,
        'A332': 120600, 'A333': 125200, 'A339': 130000, 'A338': 129800,
        'A343': 129000, 'A346': 177000, 'A359': 142400, 'A35K': 149000,
        'A388': 276800, 'MD11': 131000,
      };
      const upperIcao = String(acIcao).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const oew = oewTable[upperIcao] || oewTable[upperIcao.slice(0, 4)] || oewTable[upperIcao.slice(0, 3)] || null;
      if (oew) {
        // Estimate: assume average passenger/cargo load from fuel percentage
        // GWT ≈ OEW + fuel + estimated payload
        // For a rough estimate: payload ≈ 70% of (MTOW - OEW - max_fuel)
        // Simpler: OEW + fuel gives minimum, add ~60% payload estimate
        const fuelPct = pickPreferred(raw.fuel_percentage, xd.fuel_percentage);
        // Conservative estimate: OEW + fuel + moderate payload
        const payloadEstimate = oew * 0.25; // ~25% of OEW as payload estimate
        estimated_weight = Math.round(oew + fuelKg + payloadEstimate);
      }
    }

    const result = {
      aircraft_icao: acIcao,
      aircraft_type: aircraftType || null,
      total_weight_kg: estimated_weight,
      oat_c: final_oat,
      ground_elevation_ft: final_elev,
      baro_setting: final_baro,
      wind_speed_kts: final_wind_speed,
      wind_gust_kts: pickPreferred(windGust, pick(xd.wind_gust_kts)) ?? null,
      wind_dir: final_wind_dir,
      turbulence,
      rain_intensity,
      visibility_m,
      altitude: pickPreferred(raw.altitude, xd.altitude),
      latitude: pickPreferred(raw.latitude, xd.latitude),
      longitude: pickPreferred(raw.longitude, xd.longitude),
      on_ground: hasActiveFlight ? (xd.on_ground ?? raw.on_ground ?? true) : (raw.on_ground ?? xd.on_ground ?? true),
      fuel_kg: fuelKg,
      simulator: sim_type,
      timestamp: hasActiveFlight ? (flight.updated_date || flight.created_date || log.created_date) : log.created_date,
      has_active_flight: hasActiveFlight,
      weight_estimated: !final_weight && !!estimated_weight,
      // Include the full raw_data so frontend can inspect if needed
      _raw_fields: Array.from(new Set([...Object.keys(raw), ...Object.keys(xd)])),
    };

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
