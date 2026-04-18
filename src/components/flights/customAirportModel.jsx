import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// User-provided 3D airport model (OBJ). Loaded at runtime and cached.
const AIRPORT_OBJ_URL = 'https://files.catbox.moe/sv63na.obj';

// The asset's real-world scale is unknown; we auto-fit so the longest
// horizontal dimension lines up with the runway length we need to cover.
// Caller passes in `runwayLenM` so the model spans the whole apron area.
let cachedAirport = null;
let inflightAirport = null;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
  return await res.text();
}

async function loadAirportOnce() {
  if (cachedAirport) return cachedAirport.clone(true);
  if (inflightAirport) return (await inflightAirport).clone(true);

  inflightAirport = (async () => {
    const objText = await fetchText(AIRPORT_OBJ_URL);
    const loader = new OBJLoader();
    const root = loader.parse(objText);

    // Apply a neutral material to every mesh so it reads well at dusk.
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9aa2b0,
      roughness: 0.85,
      metalness: 0.15,
      vertexColors: false,
      flatShading: false,
    });
    root.traverse((c) => {
      if (c.isMesh) {
        c.material = mat;
        c.castShadow = false;
        c.receiveShadow = false;
      }
    });

    cachedAirport = root;
    return root;
  })();

  try {
    const obj = await inflightAirport;
    return obj.clone(true);
  } finally {
    inflightAirport = null;
  }
}

// Returns a Group that:
//  - sits with its ground plane at y=0
//  - is centered on x=0, with its longest axis along Z so it aligns with the runway
//  - scales roughly to cover a `targetFootprint` meters span
export function buildCustomAirport({ runwayLenM = 2500 } = {}) {
  const group = new THREE.Group();

  loadAirportOnce()
    .then((obj) => {
      // Measure and normalize into a wrapper so we can scale + orient cleanly.
      const wrapper = new THREE.Group();
      wrapper.add(obj);

      // Initial bounds on the raw asset.
      let box = new THREE.Box3().setFromObject(wrapper);
      const size = new THREE.Vector3();
      box.getSize(size);

      // Fit the longest horizontal dimension to ~1.4x the runway length so
      // the airport extends a bit beyond both runway ends.
      const longestHoriz = Math.max(size.x, size.z);
      const targetSpan = runwayLenM * 1.4;
      const scale = longestHoriz > 0.001 ? targetSpan / longestHoriz : 1;
      wrapper.scale.setScalar(scale);
      wrapper.updateMatrixWorld(true);

      // Orient so the longest axis aligns with Z (runway direction).
      box = new THREE.Box3().setFromObject(wrapper);
      box.getSize(size);
      if (size.x > size.z) {
        wrapper.rotation.y = Math.PI / 2;
        wrapper.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(wrapper);
      }

      // Center on X, put ground at y=0, center along Z on runway midpoint
      // (runway spans z=0..-runwayLenM, so midpoint = -runwayLenM/2).
      const center = new THREE.Vector3();
      box.getCenter(center);
      wrapper.position.x -= center.x;
      wrapper.position.z -= center.z + runwayLenM / 2;
      wrapper.position.y -= box.min.y; // ground to 0

      // Drop the whole thing slightly below so painted runway markings stay visible on top.
      wrapper.position.y -= 0.05;

      group.add(wrapper);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[customAirportModel] load failed:', err?.message || err);
    });

  return group;
}