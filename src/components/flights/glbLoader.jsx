import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Simple cached GLB loader. Returns a clone of the loaded scene each call so
// the same model can be placed many times without sharing transforms.
//
// Cache uses an LRU policy: when the cache exceeds MAX_CACHE_SIZE, the
// least-recently-used GLB is disposed (geometries + materials freed) to keep
// memory usage bounded. Without this, browsing a long aircraft catalog would
// accumulate dozens of GLBs in RAM and eventually crash on mobile devices.
const cache = new Map();
const inflight = new Map();
const MAX_CACHE_SIZE = 8;

function disposeRoot(root) {
  if (!root) return;
  root.traverse((node) => {
    if (node.geometry?.dispose) node.geometry.dispose();
    if (node.material) {
      if (Array.isArray(node.material)) {
        node.material.forEach((m) => m?.dispose?.());
      } else {
        node.material.dispose?.();
      }
    }
  });
}

function evictIfNeeded() {
  while (cache.size > MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    const oldestRoot = cache.get(oldestKey);
    cache.delete(oldestKey);
    try { disposeRoot(oldestRoot); } catch (_) { /* noop */ }
  }
}

function touchCache(key) {
  // Re-insert to mark as most-recently used (Map preserves insertion order).
  if (cache.has(key)) {
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
  }
}

// Enable Three's built-in HTTP cache so re-loads (e.g. after navigation) skip
// the network round-trip entirely.
try { THREE.Cache.enabled = true; } catch (_) { /* noop */ }

// Singleton loader with Draco + Meshopt decoders pre-configured. Many GLB
// files in the model catalog are Draco-compressed; without these decoders
// loading either fails or falls back to slow JS decoding paths. Reusing one
// loader (and one Draco worker pool) across all calls dramatically cuts
// per-model load time after the first model. We use the WASM decoder
// (much faster than the JS fallback) so first-load parse time drops too.
let sharedLoader = null;
function getLoader() {
  if (sharedLoader) return sharedLoader;
  const loader = new GLTFLoader();
  try {
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    draco.setDecoderConfig({ type: 'wasm' });
    draco.preload();
    loader.setDRACOLoader(draco);
  } catch (_) { /* ignore – non-draco GLBs still work */ }
  try {
    loader.setMeshoptDecoder(MeshoptDecoder);
  } catch (_) { /* ignore */ }
  sharedLoader = loader;
  return loader;
}

function cloneSceneDeep(root) {
  const cloned = skeletonClone(root);
  cloned.traverse((node) => {
    if (!node?.isMesh) return;
    if (node.geometry?.clone) {
      node.geometry = node.geometry.clone();
    }
    if (Array.isArray(node.material)) {
      node.material = node.material.map((material) => (material?.clone ? material.clone() : material));
    } else if (node.material?.clone) {
      node.material = node.material.clone();
    }
  });
  return cloned;
}

export function loadGLB(url) {
  if (cache.has(url)) {
    touchCache(url);
    return Promise.resolve(cloneSceneDeep(cache.get(url)));
  }
  if (inflight.has(url)) return inflight.get(url).then((o) => cloneSceneDeep(o));
  const p = new Promise((resolve, reject) => {
    getLoader().load(
      url,
      (gltf) => {
        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) { reject(new Error('GLB has no scene')); return; }
        cache.set(url, root);
        evictIfNeeded();
        resolve(cloneSceneDeep(root));
      },
      undefined,
      (err) => reject(err),
    );
  });
  inflight.set(url, p);
  p.finally(() => inflight.delete(url));
  return p;
}

// Kick off a background load without waiting for the result. Useful for
// preloading the next aircraft model while the user is still browsing the
// hangar carousel.
export function prefetchGLB(url) {
  if (!url) return;
  if (cache.has(url) || inflight.has(url)) return;
  loadGLB(url).catch(() => { /* swallow – best-effort */ });
}

// Normalize a loaded GLB so its longest horizontal axis = targetSize meters,
// centered on origin, with its bottom resting on y=0 (+yOffset).
export function normalizeModel(obj, { targetSize = 10, yOffset = 0 } = {}) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.y, size.z);
  const scale = longest > 0.001 ? targetSize / longest : 1;
  obj.scale.setScalar(scale);
  obj.updateMatrixWorld(true);

  const box2 = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  obj.position.y -= (box2.min.y - yOffset);
  obj.updateMatrixWorld(true);
  return obj;
}