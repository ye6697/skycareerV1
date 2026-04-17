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

// Pick the runway where landing happened, based on touchdown position.
function pickLandingRunway(runways, touchdownLat, touchdownLon) {
  if (!runways.length) return null;
  if (!Number.isFinite(touchdownLat) || !Number.isFinite(touchdownLon)) {
    return runways[0];
  }
  let best = null;
  let bestDist = Infinity;
  for (const rw of runways) {
    // Distance from touchdown to the closest threshold (landing end).
    const dLe = haversineMeters(touchdownLat, touchdownLon, rw.le_lat, rw.le_lon);
    const dHe = haversineMeters(touchdownLat, touchdownLon, rw.he_lat, rw.he_lon);
    const dMin = Math.min(dLe, dHe);
    if (dMin < bestDist) {
      bestDist = dMin;
      // Mark which end is the landing threshold (the one the aircraft approached).
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