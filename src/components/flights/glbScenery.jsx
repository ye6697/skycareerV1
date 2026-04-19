import * as THREE from 'three';
import { loadGLB, normalizeModel } from '@/components/flights/glbLoader';

// Pools of user-provided GLB models for scenery props.
const TREE_GLBS = ['https://files.catbox.moe/vv169m.glb'];
const BUILDING_GLBS = [
  'https://files.catbox.moe/h3pyk0.glb',
  'https://files.catbox.moe/twdu1h.glb',
];
const CLOUD_GLBS = ['https://files.catbox.moe/qdwvfu.glb'];

// Place `count` instances of a random GLB from `pool` around the scene.
// placementFn(i) must return { x, z, scale?, rotY? }.
function scatterGLB(parent, pool, count, targetSize, placementFn) {
  if (!pool.length) return;
  pool.forEach((url) => {
    // Preload each model once so clones are ready.
    loadGLB(url).then((template) => {
      normalizeModel(template, { targetSize, yOffset: 0 });
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[glbScenery] preload failed', url, err?.message || err);
    });
  });

  for (let i = 0; i < count; i += 1) {
    const url = pool[Math.floor(Math.random() * pool.length)];
    const place = placementFn(i);
    if (!place) continue;
    loadGLB(url).then((obj) => {
      normalizeModel(obj, { targetSize: targetSize * (place.scale || 1), yOffset: 0 });
      obj.position.set(place.x, -1.4, place.z);
      obj.rotation.y = place.rotY ?? Math.random() * Math.PI * 2;
      parent.add(obj);
    }).catch(() => { /* ignore per-instance failures */ });
  }
}

// Scatter trees around the scene, avoiding runway/apron corridors.
export function scatterTrees(parent, { runwayLenM, apronX, apronW, apronD, count = 400 }) {
  scatterGLB(parent, TREE_GLBS, count, 8, () => {
    const angle = Math.random() * Math.PI * 2;
    const radius = 250 + Math.pow(Math.random(), 0.6) * 2800;
    const x = Math.cos(angle) * radius;
    const z = -runwayLenM / 2 + Math.sin(angle) * radius;
    // Skip runway corridor.
    if (Math.abs(x) < 200 && Math.abs(z + runwayLenM / 2) < runwayLenM / 2) return null;
    // Skip apron.
    if (x > apronX - apronW / 2 - 20 && x < apronX + apronW / 2 + 20 &&
        Math.abs(z + runwayLenM / 2) < apronD / 2 + 20) return null;
    return { x, z, scale: 0.6 + Math.random() * 1.2 };
  });
}

// Scatter buildings in a ring around the airport (mid-distance).
export function scatterBuildings(parent, { runwayLenM, count = 80 }) {
  scatterGLB(parent, BUILDING_GLBS, count, 30, () => {
    const angle = Math.random() * Math.PI * 2;
    const radius = 600 + Math.random() * 1200;
    const x = Math.cos(angle) * radius;
    const z = -runwayLenM / 2 + Math.sin(angle) * radius;
    // Skip runway corridor.
    if (Math.abs(x) < 250) return null;
    return { x, z, scale: 0.7 + Math.random() * 1.6 };
  });
}

// Scatter clouds high in the sky around the approach path.
export function scatterClouds(parent, { runwayLenM, count = 25 }) {
  if (!CLOUD_GLBS.length) return;
  const url = CLOUD_GLBS[0];
  // Preload.
  loadGLB(url).then((template) => {
    normalizeModel(template, { targetSize: 200, yOffset: 0 });
  }).catch(() => {});

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 500 + Math.random() * 2500;
    const x = Math.cos(angle) * radius;
    const z = -runwayLenM / 2 + Math.sin(angle) * radius;
    const y = 300 + Math.random() * 500;
    const scale = 150 + Math.random() * 200;
    loadGLB(url).then((obj) => {
      normalizeModel(obj, { targetSize: scale, yOffset: 0 });
      obj.position.set(x, y, z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      // Make cloud materials soft-lit (additive feel).
      obj.traverse((c) => {
        if (c.isMesh && c.material) {
          c.material.transparent = true;
          c.material.opacity = 0.75;
          c.material.depthWrite = false;
        }
      });
      parent.add(obj);
    }).catch(() => {});
  }
}