import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Recomputes runway centerline accuracy for a single flight.
// Uses flight_path (lat/lon only) as fallback when telemetry_history is missing.
// Fetches runway info from OurAirports for departure + arrival ICAOs, then
// measures perpendicular distance from the actual track to the true centerline.

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
    if (!line || !line.includes(upper)) continue;
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

// Perpendicular distance from point P to segment AB, in meters, using
// equirectangular projection around the runway midpoint.
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

function pickRunway(runways, lat, lon) {
  if (!runways.length) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return runways[0];
  let best = null;
  let bestDist = Infinity;
  for (const rw of runways) {
    const d = perpToCenterline(rw, lat, lon);
    if (d < bestDist) { bestDist = d; best = rw; }
  }
  return best;
}

// Measure average perpendicular distance from a set of track points to the
// true runway centerline. Returns { rmsMeters, maxMeters, sampleCount }.
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
  return {
    rmsMeters: Math.sqrt(sumSq / count),
    maxMeters: maxAbs,
    sampleCount: count,
    valid: true,
  };
}

// Convert rmsMeters into score + cash delta (same thresholds as the frontend).
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

    // Load flight (service role to bypass RLS quirks on older records).
    const flights = await base44.asServiceRole.entities.Flight.filter({ id: flightId });
    const flight = flights[0];
    if (!flight) return Response.json({ error: 'Flight not found' }, { status: 404 });

    // Make sure this user owns the flight (company must be theirs).
    const ownCompanies = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
    const ownCompanyIds = new Set(ownCompanies.map((c) => c.id));
    if (!ownCompanyIds.has(flight.company_id)) {
      return Response.json({ error: 'Forbidden', debug: { user_email: user.email, flight_company_id: flight.company_id, own_company_ids: [...ownCompanyIds] } }, { status: 403 });
    }

    // Load contract for ICAO codes + payout.
    const contracts = await base44.asServiceRole.entities.Contract.filter({ id: flight.contract_id });
    const contract = contracts[0] || {};

    const xpd = flight.xplane_data || {};
    const depIcao = xpd.departure_icao || xpd.departure_airport || contract.departure_airport || '';
    const arrIcao = xpd.arrival_icao || xpd.arrival_airport || contract.arrival_airport || '';
    const basePayout = Number(contract.payout || flight.revenue || 0);

    // Build track points from telemetry_history OR flight_path fallback.
    let trackPoints = [];
    const th = Array.isArray(xpd.telemetry_history) ? xpd.telemetry_history : [];
    if (th.length >= 10) {
      trackPoints = th
        .map((p) => ({ lat: Number(p?.lat ?? p?.latitude), lon: Number(p?.lon ?? p?.lng ?? p?.longitude) }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && !(Math.abs(p.lat) < 0.01 && Math.abs(p.lon) < 0.01));
    }
    if (trackPoints.length < 10) {
      const fp = Array.isArray(xpd.flight_path) ? xpd.flight_path : [];
      trackPoints = fp
        .map((p) => {
          if (Array.isArray(p) && p.length >= 2) return { lat: Number(p[0]), lon: Number(p[1]) };
          if (p && typeof p === 'object') return { lat: Number(p.lat ?? p.latitude), lon: Number(p.lon ?? p.lng ?? p.longitude) };
          return null;
        })
        .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && !(Math.abs(p.lat) < 0.01 && Math.abs(p.lon) < 0.01));
    }

    if (trackPoints.length < 10 || (!depIcao && !arrIcao)) {
      await base44.asServiceRole.entities.Flight.update(flightId, {
        xplane_data: {
          ...xpd,
          runway_accuracy_applied: true,
          runway_accuracy: {
            takeoff: null, landing: null,
            totalScoreDelta: 0, totalCashDelta: 0,
            unavailable_reason: trackPoints.length < 10 ? 'no_track_data' : 'no_icao',
          },
        },
      });
      return Response.json({
        status: 'no_data',
        reason: trackPoints.length < 10 ? 'no_track_data' : 'no_icao',
      });
    }

    // Isolate the first ~3% and last ~3% of points as ground-roll segments.
    const n = trackPoints.length;
    const takeoffEnd = Math.max(5, Math.floor(n * 0.03));
    const landingStart = Math.min(n - 5, Math.max(takeoffEnd + 1, Math.floor(n * 0.97)));
    const takeoffPoints = trackPoints.slice(0, takeoffEnd);
    const landingPoints = trackPoints.slice(landingStart);

    // Resolve runways via OurAirports.
    const [depRunways, arrRunways] = await Promise.all([
      depIcao ? fetchRunwaysForAirport(depIcao).catch(() => []) : Promise.resolve([]),
      arrIcao ? fetchRunwaysForAirport(arrIcao).catch(() => []) : Promise.resolve([]),
    ]);
    const depRunway = depRunways.length && takeoffPoints.length
      ? pickRunway(depRunways, takeoffPoints[0].lat, takeoffPoints[0].lon)
      : null;
    const arrRunway = arrRunways.length && landingPoints.length
      ? pickRunway(arrRunways, landingPoints[landingPoints.length - 1].lat, landingPoints[landingPoints.length - 1].lon)
      : null;

    const takeoffAcc = depRunway ? measureDeviation(takeoffPoints, depRunway) : null;
    const landingAcc = arrRunway ? measureDeviation(landingPoints, arrRunway) : null;

    if (!takeoffAcc && !landingAcc) {
      await base44.asServiceRole.entities.Flight.update(flightId, {
        xplane_data: {
          ...xpd,
          runway_accuracy_applied: true,
          runway_accuracy: {
            takeoff: null, landing: null,
            totalScoreDelta: 0, totalCashDelta: 0,
            unavailable_reason: 'no_runway_resolved',
            dep_icao: depIcao, arr_icao: arrIcao,
            dep_runways_found: depRunways.length,
            arr_runways_found: arrRunways.length,
          },
        },
      });
      return Response.json({ status: 'no_runway', dep_runways: depRunways.length, arr_runways: arrRunways.length });
    }

    const takeoffEval = takeoffAcc ? evaluate(takeoffAcc.rmsMeters, basePayout) : null;
    const landingEval = landingAcc ? evaluate(landingAcc.rmsMeters, basePayout) : null;
    const totalScoreDelta = (takeoffEval?.scoreDelta || 0) + (landingEval?.scoreDelta || 0);
    const totalCashDelta = (takeoffEval?.cashDelta || 0) + (landingEval?.cashDelta || 0);

    const currentScore = Number(xpd.final_score ?? flight.flight_score ?? 0);
    const adjustedScore = Math.max(0, Math.min(100, currentScore + totalScoreDelta));
    const adjustedProfit = Number(flight.profit || 0) + totalCashDelta;
    const adjustedRevenue = Number(flight.revenue || 0) + totalCashDelta;

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
        },
      },
    });

    // Apply cash delta to company balance + add transaction.
    if (totalCashDelta !== 0) {
      const co = ownCompanies.find((c) => c.id === flight.company_id);
      if (co) {
        await base44.asServiceRole.entities.Company.update(co.id, {
          balance: Number(co.balance || 0) + totalCashDelta,
        });
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