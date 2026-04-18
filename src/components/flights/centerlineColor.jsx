import * as THREE from 'three';

// Map an absolute lateral deviation (meters) from the runway centerline to a
// color that visually grades the precision. Used both for the path line and
// the touchdown / liftoff marker so the visual language is consistent.
//
// Thresholds match the score evaluation in functions/recomputeRunwayAccuracy:
//   <= 2 m   : excellent  -> emerald
//   <= 5 m   : good       -> green
//   <= 10 m  : acceptable -> amber
//   <= 20 m  : sloppy     -> orange
//   >  20 m  : poor       -> red
export function lateralDeviationColor(absLateralM) {
  const d = Math.max(0, Number(absLateralM) || 0);
  // Fully saturated, pure hues so all grades read as clearly as the red tier.
  if (d <= 2) return 0x00ff88;   // neon emerald
  if (d <= 5) return 0x7cff00;   // neon lime
  if (d <= 10) return 0xffe600;  // pure yellow
  if (d <= 20) return 0xff7a00;  // pure orange
  return 0xff2020;               // pure red
}

// Build a Float32 color buffer for a path of THREE.Vector3 points so each
// vertex is colored by its lateral distance to the centerline.
// In the runway frame (used by buildGeoPath), point.x IS the lateral offset
// in meters – so we can color directly without any extra projection.
export function buildPathColors(path3D) {
  const colors = new Float32Array(path3D.length * 3);
  const c = new THREE.Color();
  for (let i = 0; i < path3D.length; i += 1) {
    const lat = Math.abs(path3D[i].x);
    c.setHex(lateralDeviationColor(lat));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  return colors;
}