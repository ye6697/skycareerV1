import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Recomputes runway centerline accuracy for a single flight.
//
// IMPORTANT: Accuracy is ONLY computed when we have high-frequency telemetry
// samples with an explicit on_ground=true flag. flight_path (10-second-spaced
// lat/lon pairs from the full flight) is NOT sufficient — with ground-roll
// speeds of 70-150 kt, samples are 360-770 m apart, far too sparse to measure
// centerline deviation. For flights without telemetry_history, we return
// "unavailable" and apply zero score/cash delta.

const EARTH_RADIUS_M = 6371000;
const toRad = (d) => (Number(d) * Math.PI) / 180;

function haversine(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

// Cache runway CSV in a warm Deno instance.
let RUNWAY_CSV_CACHE = null;
let RUNWAY_CSV_CACHE_AT = 0;
const CSV_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchRunwaysForAirport(icao) {
  const upper = String(icao || '').toUpperCase().trim();
  if (!upper) return [];

  const now = Date.now();
  let text = RUNWAY_CSV_CACHE;
  if (!text || (now - RUNWAY_CSV_CACHE_AT) > CSV_TTL_MS) {
    const url = 'https://davidmegginson.github.io/ourairports-data/runways.csv';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OurAirports fetch failed: ${res.status}`);
    text = await res.text();
    RUNWAY_CSV_CACHE = text;
    RUNWAY_CSV_CACHE_AT = now;
  }

  const lines = text.split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.replace(/^"|"$/g, ''));
  const idx = (name) => header.indexOf(name);
  const cIdent = idx('airport_ident');
  const cLen = idx('length_ft');
  const cWidth = idx('width_ft');
  const cClosed = idx('closed');
  const cLeIdent = idx('le_ident');
  const cLeLat = idx('le_latitude_deg');
  const cLeLon = idx('le_longitude_deg');
  const cLeElev = idx('le_elevation_ft');
  const cLeHdg = idx('le_heading_degT');
  const cHeIdent = idx('he_ident');
  const cHeLat = idx('he_latitude_deg');
  const cHeLon = idx('he_longitude_deg');
  const cHeElev = idx('he_elevation_ft');
  const cHeHdg = idx('he_heading_degT');

  const parse = (line) => {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  };

  const runways = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const cols = parse(line);
    if (cols[cIdent] !== upper) continue;
    if (Number(cols[cClosed] || 0) === 1) continue;
    const leLat = parseFloat(cols[cLeLat]);
    const leLon = parseFloat(cols[cLeLon]);
    const heLat = parseFloat(cols[cHeLat]);
    const heLon = parseFloat(cols[cHeLon]);
    if (!Number.isFinite(leLat) || !Number.isFinite(leLon) || !Number.isFinite(heLat) || !Number.isFinite(heLon)) continue;
    runways.push({
      length_ft: parseFloat(cols[cLen]) || 0,
      width_ft: parseFloat(cols[cWidth]) || 0,
      le_ident: cols[cLeIdent] || '',
      le_lat: leLat,
      le_lon: leLon,
      le_elevation_ft: parseFloat(cols[cLeElev]) || 0,
      le_heading: parseFloat(cols[cLeHdg]) || 0,
      he_ident: cols[cHeIdent] || '',
      he_lat: heLat,
      he_lon: heLon,
      he_elevation_ft: parseFloat(cols[cHeElev]) || 0,
      he_heading: parseFloat(cols[cHeHdg]) || 0,
    });
  }
  return runways;
}

// Perpendicular distance from point P to the runway centerline segment AB.
function perpToCenterline(rw, lat, lon) {
  const midLat = (rw.le_lat + rw.he_lat) / 2;
  const cosMid = Math.cos(toRad(midLat));
  const project = (la, lo) => ({
    x: toRad(lo) * EARTH_RADIUS_M * cosMid,
    y: toRad(la) * EARTH_RADIUS_M,
  });
  const A = project(rw.le_lat, rw.le_lon);
  const B = project(rw.he_lat, rw.he_lon);
  const P = project(lat, lon);
  const ABx = B.x - A.x;
  const ABy = B.y - A.y;
  const lenSq = ABx * ABx + ABy * ABy;
  if (lenSq < 1) return Infinity;
  const tRaw = ((P.x - A.x) * ABx + (P.y - A.y) * ABy) / lenSq;
  const t = Math.max(0, Math.min(1, tRaw));
  const Cx = A.x + t * ABx;
  const Cy = A.y + t * ABy;
  return Math.hypot(P.x - Cx, P.y - Cy);
}

// Airport center = midpoint of first runway's thresholds.
function airportCenter(runways) {
  if (!runways.length) return null;
  const rw = runways[0];
  return {
    lat: (rw.le_lat + rw.he_lat) / 2,
    lon: (rw.le_lon + rw.he_lon) / 2,
  };
}

// Find the runway whose centerline is closest to the majority of points.
// Uses median perpendicular distance (robust against outliers).
function pickRunwayForPoints(runways, points) {
  if (!runways.length || !points.length) return null;
  let best = null;
  let bestMedian = Infinity;
  for (const rw of runways) {
    const dists = points.map((p) => perpToCenterline(rw, p.lat, p.lon))
      .filter((d) => Number.isFinite(d))
      .sort((a, b) => a - b);
    if (dists.length === 0) continue;
    const median = dists[Math.floor(dists.length / 2)];
    if (median < bestMedian) { bestMedian = median; best = rw; }
  }
  // If even the best runway has median > 200 m, nothing on this airport fits.
  if (bestMedian > 200) return null;
  return best;
}

function normalizeRunwayIdent(raw) {
  const txt = String(raw || '').trim().toUpperCase();
  if (!txt) return null;
  const cleaned = txt.replace(/^RWY\s*/i, '').replace(/\s+/g, '');
  const m = cleaned.match(/^0?(\d{1,2})([LRC])?$/);
  if (!m) return cleaned;
  const num = String(Number(m[1])).padStart(2, '0');
  return `${num}${m[2] || ''}`;
}

function resolveLikelyRunwayEnd(runway, points) {
  if (!runway || !Array.isArray(points) || points.length === 0) return null;
  const ref = points[0];
  const dLe = haversine(ref.lat, ref.lon, runway.le_lat, runway.le_lon);
  const dHe = haversine(ref.lat, ref.lon, runway.he_lat, runway.he_lon);
  return dLe <= dHe ? 'le' : 'he';
}

// Read on_ground flag from a telemetry point. Accepts multiple field names.
function readOnGround(point) {
  const raw = point?.on_ground ?? point?.onGround ?? point?.grounded ?? point?.og ?? point?.isOnGround;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw > 0.5;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'ground'].includes(s)) return true;
    if (['0', 'false', 'no', 'off', 'air'].includes(s)) return false;
  }
  return null;
}

// Extract lat/lon from a point.
function extractCoord(point) {
  const lat = Number(point?.lat ?? point?.latitude);
  const lon = Number(point?.lon ?? point?.lng ?? point?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) < 0.5 && Math.abs(lon) < 0.5) return null;
  return { lat, lon };
}

// Extract the takeoff roll: all samples between start of acceleration on the
// ground and the moment of liftoff. We do NOT require every sample to have a
// confirmed on_ground=true flag — some telemetry streams only send the flag
// when it changes, so intermediate samples have og=null. We therefore include
// samples that are either on_ground=true OR og=null, as long as we've seen at
// least one on_ground=true before liftoff. Includes all samples with speed >
// 10 kt (covers the entire acceleration phase, not just > 20 kt).
function extractTakeoffRoll(telemetry) {
  const roll = [];
  let groundConfirmed = false;
  let airborneSeen = false;
  for (let i = 0; i < telemetry.length; i += 1) {
    const p = telemetry[i];
    const og = readOnGround(p);
    if (og === true) groundConfirmed = true;
    if (og === false) { airborneSeen = true; break; }
    // Accept og=true or og=null (unknown) samples. Skip og=false — that means
    // airborne, which we shouldn't see before the liftoff break above, but be safe.
    if (og === false) continue;
    const spd = Number(p?.spd ?? p?.speed ?? p?.gs ?? p?.ground_speed ?? 0);
    if (!Number.isFinite(spd) || spd < 10) continue;
    const coord = extractCoord(p);
    if (!coord) continue;
    roll.push(coord);
  }
  // Require at least one confirmed ground sample AND an airborne transition,
  // OR (fallback) enough speed progression that it clearly was a takeoff roll.
  if (!groundConfirmed && !airborneSeen) return [];
  return roll;
}

// Extract the landing rollout: from touchdown (first on_ground=true after
// airborne) until speed drops below 10 kt OR we see another airborne sample
// (e.g. bounce). Intermediate og=null samples are included.
function extractLandingRoll(telemetry) {
  const roll = [];
  let airborneSeen = false;
  let touchdownIdx = -1;
  for (let i = 0; i < telemetry.length; i += 1) {
    const og = readOnGround(telemetry[i]);
    if (og === false) airborneSeen = true;
    if (airborneSeen && og === true) { touchdownIdx = i; break; }
  }
  if (touchdownIdx < 0) {
    // Fallback for streams with missing on_ground transition near touchdown:
    // find the lowest-altitude point in the last ~40% of the flight where the
    // aircraft still has rollout-like speed. This is a conservative proxy for
    // touchdown and avoids "No data" when telemetry exists but on_ground flags
    // are sparse around landing.
    const start = Math.max(0, Math.floor(telemetry.length * 0.6));
    let bestAlt = Infinity;
    let bestIdx = -1;
    for (let i = start; i < telemetry.length; i += 1) {
      const p = telemetry[i];
      const coord = extractCoord(p);
      if (!coord) continue;
      const spd = Number(p?.spd ?? p?.speed ?? p?.gs ?? p?.ground_speed ?? 0);
      if (Number.isFinite(spd) && spd < 20) continue;
      const alt = Number(p?.alt ?? p?.altitude ?? p?.elevation ?? Infinity);
      if (Number.isFinite(alt) && alt < bestAlt) {
        bestAlt = alt;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return [];
    touchdownIdx = bestIdx;
  }
  for (let i = touchdownIdx; i < telemetry.length; i += 1) {
    const p = telemetry[i];
    const og = readOnGround(p);
    // og=false = bounce/go-around → stop. og=true or og=null = still rolling.
    if (og === false) break;
    const spd = Number(p?.spd ?? p?.speed ?? p?.gs ?? p?.ground_speed ?? 0);
    if (Number.isFinite(spd) && spd < 10 && roll.length > 3) break;
    const coord = extractCoord(p);
    if (!coord) continue;
    roll.push(coord);
  }
  return roll;
}

// Measure RMS perpendicular distance from points to runway centerline.
function measureDeviation(points, runway) {
  if (!runway || !Array.isArray(points) || points.length < 3) return null;
  let sumSq = 0;
  let maxAbs = 0;
  let count = 0;
  for (const p of points) {
    const d = perpToCenterline(runway, p.lat, p.lon);
    if (!Number.isFinite(d)) continue;
    sumSq += d * d;
    if (d > maxAbs) maxAbs = d;
    count += 1;
  }
  if (count < 3) return null;
  const rms = Math.sqrt(sumSq / count);
  // Sanity: centerline measurement above 200 m means the runway picker was
  // wrong — refuse to score rather than produce nonsense.
  if (rms > 200) return null;
  return {
    rmsMeters: rms,
    maxMeters: maxAbs,
    sampleCount: count,
    valid: true,
  };
}

function evaluate(rms, basePayout) {
  const r = Math.max(0, Number(rms) || 0);
  let qualityKey = 'acceptable';
  let scoreDelta = 0;
  let cashPct = 0;
  if (r <= 2) { qualityKey = 'excellent'; scoreDelta = 15; cashPct = 0.08; }
  else if (r <= 5) { qualityKey = 'good'; scoreDelta = 8; cashPct = 0.04; }
  else if (r <= 10) { qualityKey = 'acceptable'; scoreDelta = 0; cashPct = 0; }
  else if (r <= 20) { qualityKey = 'sloppy'; scoreDelta = -12; cashPct = -0.05; }
  else { qualityKey = 'poor'; scoreDelta = -25; cashPct = -0.10; }
  const cashDelta = Math.round(Math.max(0, Number(basePayout) || 0) * cashPct);
  return { qualityKey, scoreDelta, cashDelta };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const flightId = String(body?.flight_id || '').trim();
    if (!flightId) return Response.json({ error: 'flight_id required' }, { status: 400 });

    const flights = await base44.asServiceRole.entities.Flight.filter({ id: flightId });
    const flight = flights[0];
    if (!flight) return Response.json({ error: 'Flight not found' }, { status: 404 });

    const ownCompanies = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
    const ownCompanyIds = new Set(ownCompanies.map((c) => c.id));
    if (!ownCompanyIds.has(flight.company_id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const contracts = await base44.asServiceRole.entities.Contract.filter({ id: flight.contract_id });
    const contract = contracts[0] || {};

    const xpd = flight.xplane_data || {};
    const depIcao = xpd.departure_icao || xpd.departure_airport || contract.departure_airport || '';
    const arrIcao = xpd.arrival_icao || xpd.arrival_airport || contract.arrival_airport || '';
    const basePayout = Number(contract.payout || flight.revenue || 0);

    // Roll back previous deltas (idempotent recompute).
    const prev = xpd.runway_accuracy || null;
    const prevScoreDelta = Number(prev?.totalScoreDelta || 0);
    const prevCashDelta = Number(prev?.totalCashDelta || 0);
    const baseScore = Number(xpd.final_score ?? flight.flight_score ?? 0) - prevScoreDelta;
    const baseRevenue = Number(flight.revenue || 0) - prevCashDelta;
    const baseProfit = Number(flight.profit || 0) - prevCashDelta;

    const saveUnavailable = async (reason) => {
      const neutralScore = Math.max(0, Math.min(100, baseScore));
      await base44.asServiceRole.entities.Flight.update(flightId, {
        flight_score: neutralScore,
        overall_rating: (neutralScore / 100) * 5,
        revenue: baseRevenue,
        profit: baseProfit,
        xplane_data: {
          ...xpd,
          final_score: neutralScore,
          runway_accuracy_applied: true,
          runway_accuracy: {
            takeoff: null, landing: null,
            totalScoreDelta: 0, totalCashDelta: 0,
            unavailable_reason: reason,
            dep_icao: depIcao,
            arr_icao: arrIcao,
          },
        },
      });
      // Reverse any previously applied cash delta on company balance.
      if (prevCashDelta !== 0) {
        const co = ownCompanies.find((c) => c.id === flight.company_id);
        if (co) {
          await base44.asServiceRole.entities.Company.update(co.id, {
            balance: Number(co.balance || 0) - prevCashDelta,
          });
        }
      }
      return Response.json({ status: 'unavailable', reason });
    };

    // Only use telemetry_history with on_ground flag. flight_path is too sparse.
    const telemetry = Array.isArray(xpd.telemetry_history) ? xpd.telemetry_history : [];
    if (telemetry.length < 10) {
      return await saveUnavailable('no_telemetry_history');
    }

    // Check at least one sample has the on_ground flag — without it we can't
    // distinguish ground roll from airborne.
    const hasOnGroundFlag = telemetry.some((p) => readOnGround(p) !== null);
    if (!hasOnGroundFlag) {
      return await saveUnavailable('no_on_ground_flag');
    }

    if (!depIcao && !arrIcao) {
      return await saveUnavailable('no_icao');
    }

    const takeoffPoints = extractTakeoffRoll(telemetry);
    const landingPoints = extractLandingRoll(telemetry);

    // Resolve runways via OurAirports.
    const [depRunways, arrRunways] = await Promise.all([
      depIcao ? fetchRunwaysForAirport(depIcao).catch(() => []) : Promise.resolve([]),
      arrIcao ? fetchRunwaysForAirport(arrIcao).catch(() => []) : Promise.resolve([]),
    ]);

    // Sanity: at least one takeoff point must be within 5 km of departure airport.
    const depCenter = airportCenter(depRunways);
    const validTakeoff = depCenter && takeoffPoints.length >= 3
      && takeoffPoints.some((p) => haversine(p.lat, p.lon, depCenter.lat, depCenter.lon) < 5000);

    const arrCenter = airportCenter(arrRunways);
    const validLanding = arrCenter && landingPoints.length >= 3
      && landingPoints.some((p) => haversine(p.lat, p.lon, arrCenter.lat, arrCenter.lon) < 5000);

    const depRunway = validTakeoff ? pickRunwayForPoints(depRunways, takeoffPoints) : null;
    const arrRunway = validLanding ? pickRunwayForPoints(arrRunways, landingPoints) : null;
    const depEnd = resolveLikelyRunwayEnd(depRunway, takeoffPoints);
    const arrEnd = resolveLikelyRunwayEnd(arrRunway, landingPoints);
    const detectedDepRunway = depRunway ? (depEnd === 'le' ? depRunway.le_ident : depRunway.he_ident) : null;
    const detectedArrRunway = arrRunway ? (arrEnd === 'le' ? arrRunway.le_ident : arrRunway.he_ident) : null;
    const plannedDepRunwayRaw = xpd.simbrief_departure_runway || xpd.departure_runway || contract.departure_runway || null;
    const plannedArrRunwayRaw = xpd.simbrief_arrival_runway || xpd.arrival_runway || contract.arrival_runway || null;
    const plannedDepRunway = normalizeRunwayIdent(plannedDepRunwayRaw);
    const plannedArrRunway = normalizeRunwayIdent(plannedArrRunwayRaw);
    const depRunwayMismatch = !!(plannedDepRunway && detectedDepRunway && normalizeRunwayIdent(detectedDepRunway) !== plannedDepRunway);
    const arrRunwayMismatch = !!(plannedArrRunway && detectedArrRunway && normalizeRunwayIdent(detectedArrRunway) !== plannedArrRunway);

    const takeoffAcc = depRunway && !depRunwayMismatch ? measureDeviation(takeoffPoints, depRunway) : null;
    const landingAcc = arrRunway && !arrRunwayMismatch ? measureDeviation(landingPoints, arrRunway) : null;

    const takeoffEval = takeoffAcc ? evaluate(takeoffAcc.rmsMeters, basePayout) : null;
    const landingEval = landingAcc ? evaluate(landingAcc.rmsMeters, basePayout) : null;
    const totalScoreDelta = (takeoffEval?.scoreDelta || 0) + (landingEval?.scoreDelta || 0);
    const totalCashDelta = (takeoffEval?.cashDelta || 0) + (landingEval?.cashDelta || 0);

    const adjustedScore = Math.max(0, Math.min(100, baseScore + totalScoreDelta));
    const adjustedRevenue = baseRevenue + totalCashDelta;
    const adjustedProfit = baseProfit + totalCashDelta;

    await base44.asServiceRole.entities.Flight.update(flightId, {
      flight_score: adjustedScore,
      overall_rating: (adjustedScore / 100) * 5,
      revenue: adjustedRevenue,
      profit: adjustedProfit,
      xplane_data: {
        ...xpd,
        final_score: adjustedScore,
        runway_accuracy_applied: true,
        runway_accuracy: {
          takeoff: takeoffAcc ? { ...takeoffAcc, ...(takeoffEval || {}) } : null,
          landing: landingAcc ? { ...landingAcc, ...(landingEval || {}) } : null,
          totalScoreDelta,
          totalCashDelta,
          dep_icao: depIcao,
          arr_icao: arrIcao,
          planned_dep_runway: plannedDepRunway,
          planned_arr_runway: plannedArrRunway,
          detected_dep_runway: detectedDepRunway,
          detected_arr_runway: detectedArrRunway,
          departure_runway_mismatch: depRunwayMismatch,
          arrival_runway_mismatch: arrRunwayMismatch,
          takeoff_points_used: takeoffPoints.length,
          landing_points_used: landingPoints.length,
          unavailable_reason: (!takeoffAcc && !landingAcc)
            ? (depRunwayMismatch || arrRunwayMismatch ? 'runway_mismatch' : 'no_runway_match')
            : null,
        },
      },
    });

    // Apply net cash delta (roll back old, apply new).
    const netCashChange = totalCashDelta - prevCashDelta;
    if (netCashChange !== 0) {
      const co = ownCompanies.find((c) => c.id === flight.company_id);
      if (co) {
        await base44.asServiceRole.entities.Company.update(co.id, {
          balance: Number(co.balance || 0) + netCashChange,
        });
        if (totalCashDelta !== 0) {
          await base44.asServiceRole.entities.Transaction.create({
            company_id: co.id,
            type: totalCashDelta >= 0 ? 'income' : 'expense',
            category: totalCashDelta >= 0 ? 'bonus' : 'other',
            amount: Math.abs(totalCashDelta),
            description: totalCashDelta >= 0
              ? `Runway centerline bonus: ${contract.title || 'Flight'}`
              : `Runway centerline penalty: ${contract.title || 'Flight'}`,
            reference_id: flightId,
            date: new Date().toISOString(),
          });
        }
      }
    }

    return Response.json({
      status: 'ok',
      takeoff: takeoffAcc ? { rmsMeters: takeoffAcc.rmsMeters, scoreDelta: takeoffEval.scoreDelta, cashDelta: takeoffEval.cashDelta } : null,
      landing: landingAcc ? { rmsMeters: landingAcc.rmsMeters, scoreDelta: landingEval.scoreDelta, cashDelta: landingEval.cashDelta } : null,
      totalScoreDelta,
      totalCashDelta,
    });
  } catch (err) {
    return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
});
