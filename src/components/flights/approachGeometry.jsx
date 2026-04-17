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

  // Runway surface (asphalt)
  const surfaceGeo = new THREE.PlaneGeometry(widM, lenM);
  const surfaceMat = new THREE.MeshStandardMaterial({ color: 0x1a1f2a, roughness: 0.95, metalness: 0 });
  const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(0, 0.02, -lenM / 2);
  group.add(surface);

  // White shoulders
  [-1, 1].forEach((side) => {
    const shoulderGeo = new THREE.PlaneGeometry(1.2, lenM);
    const shoulderMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(side * (widM / 2 - 0.6), 0.04, -lenM / 2);
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

  // ICAO runway designator label (big number painted near threshold)
  const labelTex = makeLabelTexture(runway?.landingIdent || '');
  if (labelTex) {
    const labelGeo = new THREE.PlaneGeometry(widM * 0.6, 40);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.rotation.x = -Math.PI / 2;
    // Label oriented so pilots read it approaching from +Z.
    label.rotation.z = Math.PI;
    label.position.set(0, 0.06, -60);
    group.add(label);
  }

  // Opposite-end designator
  const oppLabelTex = makeLabelTexture(runway?.oppositeIdent || '');
  if (oppLabelTex) {
    const labelGeo = new THREE.PlaneGeometry(widM * 0.6, 40);
    const labelMat = new THREE.MeshBasicMaterial({ map: oppLabelTex, transparent: true });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.06, -lenM + 60);
    group.add(label);
  }

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
export function makeRunwayLabelTexture(text) {
  if (!text) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 200px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text).toUpperCase(), canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
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
  const path = geoPts.map((p) => {
    const { alongM, lateralM } = projectToRunwayFrame(p.lat, p.lon, runway);
    // alongM: positive = in front of threshold toward approach direction
    // But approach direction from runway frame: threshold heading points away from approach.
    // Since runway extends from Z=0 (threshold) to Z=-lenM (far end), approach comes from +Z.
    // Project alongM accordingly: points on approach path are at positive Z (in front of threshold),
    // points past threshold rolling down the runway are at negative Z.
    const z = alongM; // alongM > 0 = not yet at threshold; alongM < 0 = past threshold
    const x = lateralM; // + = right of centerline
    const altM = Math.max(0, (p.alt || 0) * 0.3048 - thresholdElevM);
    return new THREE.Vector3(x, altM, z);
  });
  return path;
}

// Fallback synthetic path when no geo data is available.
// Uses altitude + synthesized S-curve so the viewer still gets a visual.
export function buildSyntheticPath(telemetryPoints, runway) {
  const lenM = Math.max(800, runway?.lengthM || 2500);
  const thresholdElevM = runway?.thresholdElevM || 0;
  const minAlt = Math.min(...telemetryPoints.map((p) => p.alt || 0));
  const n = telemetryPoints.length;
  return telemetryPoints.map((p, i) => {
    const t = i / Math.max(1, n - 1);
    // Approach path: start far from runway, touch down near threshold, rollout on runway.
    const z = 600 - t * (600 + lenM * 0.3); // from +600 (far approach) toward -lenM*0.3 (into runway)
    const altM = Math.max(0, ((p.alt || 0) - minAlt) * 0.3048);
    const x = Math.sin(t * Math.PI * 0.5) * 3;
    const groundY = Math.max(0, altM);
    void thresholdElevM;
    return new THREE.Vector3(x, groundY, z);
  });
}