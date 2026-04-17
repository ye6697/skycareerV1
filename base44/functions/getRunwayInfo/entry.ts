import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Simple in-memory cache per warm instance. Keyed by airport ICAO.
// Value: { runways: [...], fetchedAt: timestamp }
const CACHE = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Fetches runway data from OurAirports public CSV endpoints.
// Returns parsed runway objects for a given airport ICAO.
async function fetchRunwaysForAirport(icao) {
  const upper = String(icao || '').toUpperCase().trim();
  if (!upper) return [];

  const cached = CACHE.get(upper);
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.runways;
  }

  // OurAirports CSV: https://davidmegginson.github.io/ourairports-data/runways.csv
  // Columns: id,airport_ref,airport_ident,length_ft,width_ft,surface,lighted,closed,
  //   le_ident,le_latitude_deg,le_longitude_deg,le_elevation_ft,le_heading_degT,le_displaced_threshold_ft,
  //   he_ident,he_latitude_deg,he_longitude_deg,he_elevation_ft,he_heading_degT,he_displaced_threshold_ft
  const url = 'https://davidmegginson.github.io/ourairports-data/runways.csv';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OurAirports fetch failed: ${res.status}`);
  const text = await res.text();

  const lines = text.split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.replace(/^"|"$/g, ''));
  const idxOf = (name) => header.indexOf(name);
  const colIdent = idxOf('airport_ident');
  const colLenFt = idxOf('length_ft');
  const colWidthFt = idxOf('width_ft');
  const colSurface = idxOf('surface');
  const colClosed = idxOf('closed');
  const colLeIdent = idxOf('le_ident');
  const colLeLat = idxOf('le_latitude_deg');
  const colLeLon = idxOf('le_longitude_deg');
  const colLeElev = idxOf('le_elevation_ft');
  const colLeHdg = idxOf('le_heading_degT');
  const colLeDispl = idxOf('le_displaced_threshold_ft');
  const colHeIdent = idxOf('he_ident');
  const colHeLat = idxOf('he_latitude_deg');
  const colHeLon = idxOf('he_longitude_deg');
  const colHeElev = idxOf('he_elevation_ft');
  const colHeHdg = idxOf('he_heading_degT');
  const colHeDispl = idxOf('he_displaced_threshold_ft');

  const parseCsvLine = (line) => {
    // Simple CSV parse (OurAirports uses quoted strings). This is enough for our fields.
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
    // Fast prefilter: skip lines that don't contain the airport ident.
    if (!line.includes(upper)) continue;
    const cols = parseCsvLine(line);
    if (cols[colIdent] !== upper) continue;
    const closed = Number(cols[colClosed] || 0) === 1;
    if (closed) continue;

    const leLat = parseFloat(cols[colLeLat]);
    const leLon = parseFloat(cols[colLeLon]);
    const heLat = parseFloat(cols[colHeLat]);
    const heLon = parseFloat(cols[colHeLon]);
    if (!Number.isFinite(leLat) || !Number.isFinite(leLon) || !Number.isFinite(heLat) || !Number.isFinite(heLon)) continue;

    runways.push({
      length_ft: parseFloat(cols[colLenFt]) || 0,
      width_ft: parseFloat(cols[colWidthFt]) || 0,
      surface: cols[colSurface] || '',
      le_ident: cols[colLeIdent] || '',
      le_lat: leLat,
      le_lon: leLon,
      le_elevation_ft: parseFloat(cols[colLeElev]) || 0,
      le_heading: parseFloat(cols[colLeHdg]) || 0,
      le_displaced_threshold_ft: parseFloat(cols[colLeDispl]) || 0,
      he_ident: cols[colHeIdent] || '',
      he_lat: heLat,
      he_lon: heLon,
      he_elevation_ft: parseFloat(cols[colHeElev]) || 0,
      he_heading: parseFloat(cols[colHeHdg]) || 0,
      he_displaced_threshold_ft: parseFloat(cols[colHeDispl]) || 0,
    });
  }

  CACHE.set(upper, { runways, fetchedAt: Date.now() });
  return runways;
}

// Haversine distance between two lat/lon points in meters.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Perpendicular distance from a point to the runway centerline segment (meters).
// Uses equirectangular projection around the runway midpoint – good enough for
// runway-scale distances (< 5 km).
function perpendicularToCenterline(rw, lat, lon) {
  const toRad = (d) => (d * Math.PI) / 180;
  const midLat = (rw.le_lat + rw.he_lat) / 2;
  const cosMid = Math.cos(toRad(midLat));
  const R = 6371000;
  const project = (la, lo) => ({
    x: toRad(lo) * R * cosMid,
    y: toRad(la) * R,
  });
  const A = project(rw.le_lat, rw.le_lon);
  const B = project(rw.he_lat, rw.he_lon);
  const P = project(lat, lon);
  const ABx = B.x - A.x;
  const ABy = B.y - A.y;
  const lenSq = ABx * ABx + ABy * ABy;
  if (lenSq < 1) return Infinity;
  // Parametric position of P projected onto AB.
  const tRaw = ((P.x - A.x) * ABx + (P.y - A.y) * ABy) / lenSq;
  const t = Math.max(0, Math.min(1, tRaw));
  const Cx = A.x + t * ABx;
  const Cy = A.y + t * ABy;
  return Math.hypot(P.x - Cx, P.y - Cy);
}

// Pick the runway the aircraft was on, based on a reference position (touchdown
// for landing, liftoff for takeoff). We pick the runway whose centerline the
// reference point lies closest to – this is robust against parallel runways.
function pickLandingRunway(runways, refLat, refLon) {
  if (!runways.length) return null;
  if (!Number.isFinite(refLat) || !Number.isFinite(refLon)) {
    return runways[0];
  }
  let best = null;
  let bestCenterDist = Infinity;
  for (const rw of runways) {
    const dCenter = perpendicularToCenterline(rw, refLat, refLon);
    if (dCenter < bestCenterDist) {
      bestCenterDist = dCenter;
      // Mark which end is the landing/rolling-out threshold: the one closer to the ref point.
      const dLe = haversineMeters(refLat, refLon, rw.le_lat, rw.le_lon);
      const dHe = haversineMeters(refLat, refLon, rw.he_lat, rw.he_lon);
      best = { ...rw, landing_end: dLe <= dHe ? 'le' : 'he' };
    }
  }
  return best;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const icao = String(body?.icao || '').toUpperCase().trim();
    const touchdownLat = Number(body?.touchdown_lat);
    const touchdownLon = Number(body?.touchdown_lon);

    if (!icao) return Response.json({ error: 'icao required' }, { status: 400 });

    const runways = await fetchRunwaysForAirport(icao);
    const best = pickLandingRunway(runways, touchdownLat, touchdownLon);

    return Response.json({
      icao,
      runways,
      landing_runway: best,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});