import * as THREE from 'three';

// Scene scale: 1 three.js unit == 1 meter.
// World coordinates:
//   X = lateral (right is +, from pilot's view along approach)
//   Y = altitude (meters AGL above runway threshold elevation)
//   Z = along-runway direction (negative = approach, runway extends from ~0 to runway_length)
//   Origin (0,0,0) = landing threshold of the runway
// Note: this is positioned so the runway sits centered with threshold at +Z/2 visually.

const FT_TO_M = 0.3048;

// Haversine distance in meters between two lat/lon points.
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Initial bearing (degrees 0..360) from point 1 to point 2.
function initialBearing(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Project a lat/lon point into local runway-relative meters.
// Returns { alongM, lateralM } where
//   alongM is meters along the runway centerline (0 at landing threshold, + toward departure end)
//   lateralM is meters right of centerline (looking along landing direction)
export function projectToRunwayFrame(lat, lon, runway) {
  const { tdLat, tdLon, runwayHeadingDeg } = runway;
  const distM = haversineMeters(tdLat, tdLon, lat, lon);
  const brg = initialBearing(tdLat, tdLon, lat, lon);
  // Angle between point bearing and runway heading (centerline direction).
  const deltaDeg = ((brg - runwayHeadingDeg + 540) % 360) - 180; // -180..180
  const deltaRad = (deltaDeg * Math.PI) / 180;
  const alongM = distM * Math.cos(deltaRad);
  const lateralM = distM * Math.sin(deltaRad);
  return { alongM, lateralM };
}

// Given a picked landing_runway object from backend, return a normalized runway
// descriptor with touchdown (threshold) point and heading along the landing direction.
export function normalizeRunway(landingRunway) {
  if (!landingRunway) return null;
  const le = landingRunway.landing_end === 'le';
  const tdLat = le ? landingRunway.le_lat : landingRunway.he_lat;
  const tdLon = le ? landingRunway.le_lon : landingRunway.he_lon;
  const thresholdElevFt = (le ? landingRunway.le_elevation_ft : landingRunway.he_elevation_ft) || 0;
  // Landing heading points from landing threshold toward opposite threshold.
  const runwayHeadingDeg = le ? landingRunway.le_heading : landingRunway.he_heading;
  const landingIdent = le ? landingRunway.le_ident : landingRunway.he_ident;
  const oppositeIdent = le ? landingRunway.he_ident : landingRunway.le_ident;
  return {
    tdLat,
    tdLon,
    thresholdElevM: thresholdElevFt * FT_TO_M,
    runwayHeadingDeg: Number.isFinite(runwayHeadingDeg) ? runwayHeadingDeg : 0,
    lengthM: (landingRunway.length_ft || 0) * FT_TO_M,
    widthM: (landingRunway.width_ft || 0) * FT_TO_M,
    landingIdent,
    oppositeIdent,
  };
}

// Build a 3D runway mesh group. Returns { group, runwayLenM, runwayWidthM }.
// Runway is placed with landing threshold at Z = runwayLen/2, opposite end at -runwayLen/2,
// so that aircraft approaching along landing heading travels from +Z to -Z ...
// BUT we want approach path coming from behind camera in default side view.
// We'll use: approach comes from +Z, touchdown at Z=0, rollout toward -Z.
// Therefore runway extends from Z=0 (landing threshold) to Z=-runwayLen.
export function buildRunwayScene(runway, makeLabelTexture) {
  const group = new THREE.Group();
  const lenM = Math.max(800, runway?.lengthM || 2500);
  const widM = Math.max(30, runway?.widthM || 45);

  // Paved shoulder strip (visible border around the actual runway surface).
  // Real runways have asphalt shoulders 3-7.5m wide; we render 6m each side so
  // that small GPS offsets (~5m) still appear "on the paved area".
  const shoulderExtraM = 6;
  const totalPavedWidM = widM + shoulderExtraM * 2;
  const pavedGeo = new THREE.PlaneGeometry(totalPavedWidM, lenM);
  const pavedMat = new THREE.MeshStandardMaterial({ color: 0x0f131b, roughness: 1, metalness: 0 });
  const paved = new THREE.Mesh(pavedGeo, pavedMat);
  paved.rotation.x = -Math.PI / 2;
  paved.position.set(0, 0.015, -lenM / 2);
  group.add(paved);

  // Runway surface (asphalt)
  const surfaceGeo = new THREE.PlaneGeometry(widM, lenM);
  const surfaceMat = new THREE.MeshStandardMaterial({ color: 0x1a1f2a, roughness: 0.95, metalness: 0 });
  const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(0, 0.02, -lenM / 2);
  group.add(surface);

  // White edge stripes (sit just inside the runway edges, not on the shoulders)
  [-1, 1].forEach((side) => {
    const shoulderGeo = new THREE.PlaneGeometry(0.9, lenM);
    const shoulderMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(side * (widM / 2 - 0.5), 0.04, -lenM / 2);
    group.add(shoulder);
  });

  // Centerline dashes (white, ICAO: 30m stripe, 20m gap)
  for (let z = -25; z > -lenM + 25; z -= 50) {
    const stripeGeo = new THREE.PlaneGeometry(0.9, 30);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.05, z);
    group.add(stripe);
  }

  // Threshold piano-key bars (at Z = 0, on the approach side just inside the runway)
  for (let i = -6; i <= 6; i += 1) {
    if (i === 0) continue;
    const barGeo = new THREE.PlaneGeometry(2.2, 8);
    const barMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(i * 2.8, 0.05, -5);
    group.add(bar);
  }

  // Touchdown zone markers at standard positions (150m, 300m, 450m from threshold)
  [150, 300, 450].forEach((dist) => {
    [-1, 1].forEach((side) => {
      const tdzGeo = new THREE.PlaneGeometry(3, 22);
      const tdzMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
      const tdz = new THREE.Mesh(tdzGeo, tdzMat);
      tdz.rotation.x = -Math.PI / 2;
      tdz.position.set(side * 8, 0.05, -dist);
      group.add(tdz);
    });
  });

  // ICAO runway designator label painted on the runway surface. Uses a tall
  // rectangle (ICAO-style) – taller along the runway axis than wide – and is
  // drawn with depthTest off and a high renderOrder so it's always on top of
  // the asphalt paint.
  const buildLabel = (text, zPos, flipForApproach) => {
    if (!text) return;
    const tex = makeLabelTexture(text);
    if (!tex) return;
    const labelWidth = Math.min(widM * 0.7, 28);
    const labelHeight = labelWidth * 1.4;
    const geo = new THREE.PlaneGeometry(labelWidth, labelHeight);
    // depthTest stays TRUE so the aircraft correctly occludes the painted label
    // when flying overhead. polygonOffset lifts the label just above the asphalt
    // to prevent z-fighting with the runway surface.
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    if (flipForApproach) mesh.rotation.z = Math.PI;
    mesh.position.set(0, 0.05, zPos);
    group.add(mesh);
  };
  // Only paint the runway designator when we have real data from OurAirports.
  // Place it ~80m inside the runway (standard ICAO designator placement).
  if (runway?.landingIdent) buildLabel(runway.landingIdent, -80, false);
  if (runway?.oppositeIdent) buildLabel(runway.oppositeIdent, -lenM + 80, true);

  // Approach lighting (leading to threshold from +Z)
  const alsMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  for (let i = 1; i <= 10; i += 1) {
    const lightGeo = new THREE.SphereGeometry(0.5, 6, 6);
    const light = new THREE.Mesh(lightGeo, alsMat);
    light.position.set(0, 0.6, i * 30);
    group.add(light);
  }

  // Edge lights
  for (let z = 0; z >= -lenM; z -= 25) {
    [-1, 1].forEach((side) => {
      const nearEnd = Math.abs(z) < 300 || Math.abs(z + lenM) < 300;
      const edgeMat = new THREE.MeshBasicMaterial({ color: nearEnd ? 0xfef08a : 0xf8fafc });
      const edge = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), edgeMat);
      edge.position.set(side * (widM / 2 + 1.5), 0.5, z);
      group.add(edge);
    });
  }

  // PAPI lights left of threshold
  [-3, -1, 1, 3].forEach((offset, idx) => {
    const papiMat = new THREE.MeshBasicMaterial({ color: idx < 2 ? 0xff4444 : 0xf8fafc });
    const papi = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), papiMat);
    papi.position.set(-widM / 2 - 6, 0.8, -40 + offset * 2.5);
    group.add(papi);
  });

  return { group, runwayLenM: lenM, runwayWidthM: widM };
}

// Create a canvas-based texture of the runway designator (e.g. "25L").
// Uses a transparent background + tall rectangle (ICAO-style vertical stacking
// for letter-suffixed designators like "25L").
export function makeRunwayLabelTexture(text) {
  if (!text) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';

  const label = String(text).toUpperCase();
  const match = label.match(/^(\d{1,2})([LRC])?$/);
  const numberPart = match ? match[1] : label;
  const letterPart = match && match[2] ? match[2] : '';

  const cx = canvas.width / 2;
  const drawText = (txt, y, size) => {
    ctx.font = `bold ${size}px Impact, "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(18, size * 0.08);
    ctx.strokeStyle = '#0a0f1a';
    ctx.strokeText(txt, cx, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(txt, cx, y);
  };

  if (letterPart) {
    // Number on top, letter stacked below (ICAO style).
    drawText(numberPart, 250, 380);
    drawText(letterPart, 580, 240);
  } else {
    drawText(numberPart, canvas.height / 2, 440);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

// Build 3D path from telemetry points referenced to runway frame.
// Points need at least { lat, lon, alt } (altitude MSL in ft) to be georeferenced.
// Returns null if not enough georeferenced points.
export function buildGeoPath(telemetryPoints, runway) {
  if (!runway) return null;
  const geoPts = telemetryPoints.filter((p) =>
    Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) + Math.abs(p.lon) > 0.001,
  );
  if (geoPts.length < 2) return null;

  const thresholdElevM = runway.thresholdElevM || 0;
  // Runway-frame convention from projectToRunwayFrame:
  //   alongM = distance along landing heading (0 at threshold, + toward departure end)
  //   lateralM = + right of centerline (looking along landing direction)
  // Scene convention (buildRunwayScene):
  //   Runway extends from Z=0 (threshold) to Z=-lenM (far end),
  //   approach comes from +Z (in front of threshold = BEFORE touchdown).
  //   Positive X = right of centerline (same as lateralM).
  // Therefore: sceneZ = -alongM.  A point in front of the threshold has
  // alongM < 0 (opposite to landing heading) and must map to Z > 0.
  // Trail-Floor-Lift: lift the entire path slightly above the runway/ground
  // so the colored centerline track stays visible during the ground roll
  // (touchdown, takeoff roll). Without this, samples with alt = 0 disappear
  // into the dark floor / runway surface.
  const TRAIL_FLOOR_LIFT_M = 1.6;
  const path = geoPts.map((p) => {
    const { alongM, lateralM } = projectToRunwayFrame(p.lat, p.lon, runway);
    const z = -alongM;
    const x = lateralM;
    const altM = Math.max(0, (p.alt || 0) * 0.3048 - thresholdElevM) + TRAIL_FLOOR_LIFT_M;
    return new THREE.Vector3(x, altM, z);
  });
  return path;
}

// Given a phase ('takeoff' | 'landing') and telemetry history, compute the
// RMS lateral deviation from the TRUE runway centerline (not a best-fit line).
// Requires a normalized runway. Returns null if not enough ground samples.
export function computeGeoCenterlineAccuracy(telemetryHistory, runway, phase) {
  if (!runway || !Array.isArray(telemetryHistory) || telemetryHistory.length < 5) return null;
  const readOnGround = (p) => {
    const raw = p?.on_ground ?? p?.onGround ?? p?.grounded ?? p?.og;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw > 0.5;
    if (typeof raw === 'string') {
      const s = raw.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on', 'ground'].includes(s)) return true;
      if (['0', 'false', 'no', 'off', 'air'].includes(s)) return false;
    }
    return null;
  };
  const readSpd = (p) => Number(p?.spd ?? p?.speed ?? p?.gs ?? p?.ground_speed ?? 0);
  const extractCoord = (p) => {
    const lat = Number(p?.lat ?? p?.latitude);
    const lon = Number(p?.lon ?? p?.lng ?? p?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (Math.abs(lat) < 0.5 && Math.abs(lon) < 0.5) return null;
    return { lat, lon };
  };

  // Find the indices bounding the relevant ground-roll phase.
  let startIdx = -1;
  let endIdx = -1;
  if (phase === 'takeoff') {
    // From first on_ground moving sample to last on_ground before liftoff.
    let onGroundSeen = false;
    for (let i = 0; i < telemetryHistory.length; i += 1) {
      const og = readOnGround(telemetryHistory[i]);
      const spd = readSpd(telemetryHistory[i]);
      if (og === true && spd > 20) {
        if (startIdx < 0) startIdx = i;
        endIdx = i;
        onGroundSeen = true;
      } else if (onGroundSeen && og === false) {
        break; // airborne => stop
      }
    }
  } else {
    // Landing: from touchdown to rollout stop (< 20 kts or airborne again).
    let airborneSeen = false;
    for (let i = 0; i < telemetryHistory.length; i += 1) {
      const og = readOnGround(telemetryHistory[i]);
      if (og === false) airborneSeen = true;
      if (airborneSeen && og === true) {
        if (startIdx < 0) startIdx = Math.max(0, i - 1);
        endIdx = i;
      }
      if (startIdx >= 0) {
        const spd = readSpd(telemetryHistory[i]);
        if (i > startIdx + 2 && (og !== true || (Number.isFinite(spd) && spd < 20))) break;
        endIdx = i;
      }
    }
  }
  if (startIdx < 0 || endIdx <= startIdx) return null;

  const coords = [];
  for (let i = startIdx; i <= endIdx; i += 1) {
    const c = extractCoord(telemetryHistory[i]);
    if (c) coords.push(c);
  }
  if (coords.length < 3) return null;

  // Project each coord into runway frame and measure lateralM (= perpendicular
  // distance to the true centerline through the threshold at the runway heading).
  let sumSq = 0;
  let maxAbs = 0;
  let minAlong = Infinity;
  let maxAlong = -Infinity;
  for (const c of coords) {
    const { alongM, lateralM } = projectToRunwayFrame(c.lat, c.lon, runway);
    sumSq += lateralM * lateralM;
    const abs = Math.abs(lateralM);
    if (abs > maxAbs) maxAbs = abs;
    if (alongM < minAlong) minAlong = alongM;
    if (alongM > maxAlong) maxAlong = alongM;
  }
  const rms = Math.sqrt(sumSq / coords.length);
  const lengthMeters = Number.isFinite(minAlong) && Number.isFinite(maxAlong) ? Math.abs(maxAlong - minAlong) : 0;
  if (lengthMeters < 100) return null;
  return {
    rmsMeters: rms,
    maxMeters: maxAbs,
    sampleCount: coords.length,
    lengthMeters,
    valid: true,
  };
}

// Fallback synthetic path when no geo data is available.
// Uses altitude + synthesized geometry so the viewer still gets a visual.
// IMPORTANT: when telemetry contains lat/lon but no runway info we project into
// a local metric frame centered on the first point so the lateral deviation
// from the aircraft's own mean track is preserved (no "always centered" lie).
export function buildSyntheticPath(telemetryPoints, runway, phase = 'landing') {
  const lenM = Math.max(800, runway?.lengthM || 2500);
  const minAlt = Math.min(...telemetryPoints.map((p) => p.alt || 0));
  const n = telemetryPoints.length;

  // If we have real lat/lon, compute local meters vs a best-fit track and keep
  // the perpendicular offset. This reveals real lateral deviation even without
  // a runway database entry.
  const geoPts = telemetryPoints.filter((p) =>
    Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) + Math.abs(p.lon) > 0.001,
  );
  let localXY = null;
  if (geoPts.length >= 2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const refLat = geoPts[0].lat;
    const refLon = geoPts[0].lon;
    const cosRef = Math.cos(toRad(refLat));
    const xy = telemetryPoints.map((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
      const east = toRad(p.lon - refLon) * R * cosRef;
      const north = toRad(p.lat - refLat) * R;
      return { east, north };
    });
    // Best-fit direction = vector from first to last valid point.
    const firstXY = xy.find((v) => v);
    const lastXY = [...xy].reverse().find((v) => v);
    if (firstXY && lastXY) {
      const dx = lastXY.east - firstXY.east;
      const dy = lastXY.north - firstXY.north;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // along = projection on track, lateral = perpendicular (right positive).
      localXY = xy.map((v) => {
        if (!v) return { along: 0, lateral: 0 };
        const along = (v.east - firstXY.east) * ux + (v.north - firstXY.north) * uy;
        const lateral = (v.east - firstXY.east) * (-uy) + (v.north - firstXY.north) * ux;
        return { along, lateral };
      });
    }
  }

  return telemetryPoints.map((p, i) => {
    const t = i / Math.max(1, n - 1);
    // Z mapping: landing starts far from runway and rolls past threshold;
    // takeoff starts at threshold and flies out in the approach direction.
    const z = phase === 'takeoff'
      ? -t * (lenM * 0.4) + (1 - t) * 30          // rollout from ~+30 toward -40% of rwy
      : 600 - t * (600 + lenM * 0.3);
    // Same trail-floor-lift as in buildGeoPath – keeps the colored line
    // visible above the dark ground during the ground roll phase.
    const altM = Math.max(0, ((p.alt || 0) - minAlt) * 0.3048) + 1.6;
    // X: real lateral offset from track if we have geo, else 0.
    const x = localXY ? Math.max(-60, Math.min(60, localXY[i]?.lateral || 0)) : 0;
    return new THREE.Vector3(x, altM, z);
  });
}