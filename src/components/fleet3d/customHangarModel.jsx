import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

// User-provided hangar model.
const OBJ_URL = 'https://files.catbox.moe/g8kbjl.obj';
const MTL_URL = 'https://files.catbox.moe/121rdg.mtl';

// Target interior size (meters) – hangar should be tall and roomy so an
// airliner fits comfortably inside.
const TARGET_SIZE = 140;

let cachedHangar = null;
let inflightPromise = null;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
  return await res.text();
}

async function loadHangarRaw() {
  if (cachedHangar) return cachedHangar.clone(true);
  if (inflightPromise) return (await inflightPromise).clone(true);

  inflightPromise = (async () => {
    let materials = null;
    try {
      const mtlText = await fetchText(MTL_URL);
      const mtlLoader = new MTLLoader();
      // MTL files often reference textures via relative paths — we set the
      // resourcePath to an empty string and rely on the parsed materials
      // without textures (they would 404 anyway from catbox).
      mtlLoader.setResourcePath('');
      materials = mtlLoader.parse(mtlText, '');
      materials.preload();
    } catch (_) {
      // Ignore MTL failures and fall back to default gray material.
      materials = null;
    }

    const objText = await fetchText(OBJ_URL);
    const objLoader = new OBJLoader();
    if (materials) objLoader.setMaterials(materials);
    const raw = objLoader.parse(objText);

    // Replace any textured materials that failed to load (no map available)
    // with a realistic PBR metal/concrete material so the hangar renders
    // nicely instead of pitch-black or plain white.
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0x8a8f98,
      roughness: 0.75,
      metalness: 0.25,
      side: THREE.DoubleSide,
    });
    raw.traverse((c) => {
      if (!c.isMesh) return;
      const mat = c.material;
      const isBroken = !mat
        || (Array.isArray(mat) && mat.length === 0)
        || (mat && mat.isMeshBasicMaterial && mat.color?.r === 1 && mat.color?.g === 1 && mat.color?.b === 1 && !mat.map);
      if (isBroken) {
        c.material = fallbackMat;
      } else if (Array.isArray(mat)) {
        c.material = mat.map((m) => {
          if (!m) return fallbackMat;
          m.side = THREE.DoubleSide;
          if (m.isMeshPhongMaterial || m.isMeshLambertMaterial) {
            // Upgrade to Standard for nicer lighting.
            return new THREE.MeshStandardMaterial({
              color: m.color || new THREE.Color(0x8a8f98),
              roughness: 0.7,
              metalness: 0.25,
              side: THREE.DoubleSide,
              map: m.map || null,
            });
          }
          return m;
        });
      } else {
        mat.side = THREE.DoubleSide;
        if (mat.isMeshPhongMaterial || mat.isMeshLambertMaterial) {
          c.material = new THREE.MeshStandardMaterial({
            color: mat.color || new THREE.Color(0x8a8f98),
            roughness: 0.7,
            metalness: 0.25,
            side: THREE.DoubleSide,
            map: mat.map || null,
          });
        }
      }
    });

    // Normalize size – scale the whole hangar so its longest axis equals
    // TARGET_SIZE, then place its floor at y=0.
    const box = new THREE.Box3().setFromObject(raw);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z);
    const scale = longest > 0.001 ? TARGET_SIZE / longest : 1;
    raw.scale.setScalar(scale);
    raw.updateMatrixWorld(true);

    const box2 = new THREE.Box3().setFromObject(raw);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    raw.position.x -= center.x;
    raw.position.z -= center.z;
    raw.position.y -= box2.min.y;
    raw.updateMatrixWorld(true);

    const wrapper = new THREE.Group();
    wrapper.add(raw);
    cachedHangar = wrapper;
    return wrapper;
  })();

  try {
    return (await inflightPromise).clone(true);
  } finally {
    inflightPromise = null;
  }
}

// Build the hangar for the scene. Returns { group, ready } where `ready` is
// a Promise resolving once the GLB is loaded and added.
export function buildCustomHangar() {
  const group = new THREE.Group();
  const ready = loadHangarRaw()
    .then((hangar) => {
      group.add(hangar);
      return hangar;
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[customHangar] load failed:', err?.message || err);
      return null;
    });
  return { group, ready };
}