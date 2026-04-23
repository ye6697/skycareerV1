import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Simple cached GLB loader. Returns a clone of the loaded scene each call so
// the same model can be placed many times without sharing transforms.
const cache = new Map();
const inflight = new Map();

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
  if (cache.has(url)) return Promise.resolve(cloneSceneDeep(cache.get(url)));
  if (inflight.has(url)) return inflight.get(url).then((o) => cloneSceneDeep(o));
  const p = new Promise((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) { reject(new Error('GLB has no scene')); return; }
        cache.set(url, root);
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
