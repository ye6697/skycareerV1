import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// User-provided airplane model hosted on catbox.moe.
// The OBJ references a texture (Material_metal.jpg) via its MTL; we load the
// texture directly and apply it to all meshes so we don't need the MTL file.
const OBJ_URL = 'https://files.catbox.moe/szsofq.obj';
const TEX_URL = 'https://files.catbox.moe/ylgpjo.jpg';

let cachedObject = null;       // parsed + normalized Object3D (clone before each use)
let inflightPromise = null;    // dedupe concurrent loads

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
  return await res.text();
}

function loadTexture(url) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); },
      undefined,
      () => resolve(null), // texture optional - fall back to plain material
    );
  });
}

// Load + parse OBJ once, then cache. Each caller gets a fresh clone so they
// can mutate position / rotation independently.
async function loadCustomObject() {
  if (cachedObject) return cachedObject.clone(true);
  if (inflightPromise) return (await inflightPromise).clone(true);

  inflightPromise = (async () => {
    const [objText, texture] = await Promise.all([fetchText(OBJ_URL), loadTexture(TEX_URL)]);
    const loader = new OBJLoader();
    const root = loader.parse(objText);

    // Apply a single PBR material (with texture if available) to every mesh.
    const material = new THREE.MeshStandardMaterial({
      map: texture || null,
      color: texture ? 0xffffff : 0xd8dde4,
      roughness: 0.45,
      metalness: 0.65,
    });
    root.traverse((child) => {
      if (child.isMesh) {
        child.material = material;
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });

    // Normalize: center at origin, scale to a reference length (~30m along X).
    // The OBJ is authored with an arbitrary scale/orientation; we measure its
    // bounding box and rescale so it matches the size of our procedural jets.
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    root.position.sub(center); // center at origin

    // Uniform scale so the longest horizontal axis = 30 units (≈ narrow-body length).
    const longest = Math.max(size.x, size.z);
    if (longest > 0.001) {
      const targetLen = 30;
      const s = targetLen / longest;
      root.scale.setScalar(s);
    }

    // The authored model's "forward" axis may not be +X (our convention).
    // Based on inspection of the vertex ranges, this model's long axis is Z
    // and its "up" is Y — rotate so nose points +X.
    root.rotation.y = Math.PI / 2;

    cachedObject = root;
    return root;
  })();

  try {
    const obj = await inflightPromise;
    return obj.clone(true);
  } finally {
    inflightPromise = null;
  }
}

// Public API: matches buildAircraftModel's return shape.
// Returns { group, strobe } where `group` is an Object3D and `strobe` is a
// Mesh with material.opacity to animate the strobe light. We attach a simple
// strobe light so the existing animation loop's strobe logic still works.
export function buildCustomAircraftModel() {
  const group = new THREE.Group();

  // Strobe placeholder (tail light). Position refined once the model loads.
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  );
  strobe.position.set(-15, 2, 0);
  group.add(strobe);

  loadCustomObject()
    .then((obj) => {
      group.add(obj);
      // Move strobe to the tail based on final bounding box.
      const box = new THREE.Box3().setFromObject(obj);
      strobe.position.set(box.min.x + 0.5, box.max.y * 0.8, 0);
    })
    .catch((err) => {
      // Loading failed (network / parse) - leave group empty so caller's
      // fallback logic (if any) can kick in. Log once.
      // eslint-disable-next-line no-console
      console.warn('[customAircraftModel] load failed:', err?.message || err);
    });

  return { group, strobe };
}