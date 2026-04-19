import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { loadGLB, normalizeModel } from '@/components/flights/glbLoader';

// User-provided airplane model hosted on catbox.moe.
const OBJ_URL = 'https://files.catbox.moe/szsofq.obj';
const TEX_URL = 'https://files.catbox.moe/ylgpjo.jpg';

// Propeller-aircraft GLB models. Picked randomly for prop/turboprop flights.
const PROP_GLB_URLS = [
  'https://files.catbox.moe/oyc0jm.glb',
  'https://files.catbox.moe/y4rer7.glb',
];

function isPropAircraft(hint) {
  const s = String(hint || '').toLowerCase();
  if (!s) return false;
  if (s.includes('small_prop') || s.includes('turboprop')) return true;
  if (/\b(c172|c152|c182|p28|sr22|da40|pa28|pc12|dh8|dhc|atr|saab|sf34|e120|e110|c208|king\s?air|baron|caravan)\b/.test(s)) return true;
  return false;
}

// Target length (meters) for the aircraft's longest axis in world space.
const TARGET_LENGTH = 30;
// Extra clearance above ground so the aircraft visibly rests on its gear
// rather than the belly touching the asphalt.
const GROUND_CLEARANCE = 1.2;

let cachedObject = null;
let inflightPromise = null;

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
      () => resolve(null),
    );
  });
}

// Attach navigation, strobe, and beacon lights as CHILDREN of the model so
// they move/rotate exactly with it. Positions are derived from the model's
// actual bounding box so wingtips line up with the real geometry.
// Light sizes scale with the model so small props don't get giant beach-ball
// wingtip lights.
function attachLightsToModel(model, strobe) {
  // Measure in world space to respect any scale that was applied to the model
  // before this function is called (e.g. GLB normalizeModel scaling).
  model.updateMatrixWorld(true);
  const worldBox = new THREE.Box3().setFromObject(model);
  const worldSize = new THREE.Vector3();
  worldBox.getSize(worldSize);
  const worldLongest = Math.max(worldSize.x, worldSize.y, worldSize.z) || 1;

  // Invert the model's world scale so positions we set below (in model-local
  // space) land at world positions derived from the world bounding box.
  const modelWorldScale = new THREE.Vector3();
  model.getWorldScale(modelWorldScale);
  const invScale = 1 / (modelWorldScale.x || 1);

  // Local-frame bounding box (divide world bbox by world scale).
  const halfSpan = (worldSize.z / 2) * invScale;
  const tailX = worldBox.min.x * invScale - model.position.x;
  const topY = worldBox.max.y * invScale - model.position.y;
  const bottomY = worldBox.min.y * invScale - model.position.y;
  const midY = ((worldBox.min.y + worldBox.max.y) / 2) * invScale - model.position.y;

  // Light radius scales with aircraft size so both small props and airliners
  // get proportional lights. Base radius ~0.7% of the longest axis (world),
  // then converted back to local space.
  const navRadiusWorld = Math.max(0.12, worldLongest * 0.007);
  const navRadiusLocal = navRadiusWorld * invScale;
  const strobeRadiusLocal = navRadiusLocal * 0.8;
  const beaconRadiusLocal = navRadiusLocal * 0.9;

  const navGeo = new THREE.SphereGeometry(navRadiusLocal, 10, 10);
  const red = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  red.position.set(0, midY, -halfSpan);
  model.add(red);
  const green = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0x22ff22 }));
  green.position.set(0, midY, halfSpan);
  model.add(green);

  // Tail strobe: resize and reposition the caller-provided mesh.
  strobe.geometry.dispose();
  strobe.geometry = new THREE.SphereGeometry(strobeRadiusLocal, 10, 10);
  strobe.position.set(tailX + navRadiusLocal * 3, topY, 0);
  model.add(strobe);

  // Wing strobes at each wingtip.
  const wingStrobeGeo = new THREE.SphereGeometry(strobeRadiusLocal * 0.9, 8, 8);
  const leftStrobe = new THREE.Mesh(
    wingStrobeGeo,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  );
  leftStrobe.position.set(0, midY, -halfSpan);
  leftStrobe.name = 'wingStrobe';
  model.add(leftStrobe);
  const rightStrobe = new THREE.Mesh(
    wingStrobeGeo,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  );
  rightStrobe.position.set(0, midY, halfSpan);
  rightStrobe.name = 'wingStrobe';
  model.add(rightStrobe);

  // Red belly beacon.
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(beaconRadiusLocal, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.9 }),
  );
  beacon.position.set(0, bottomY + beaconRadiusLocal * 0.5, 0);
  beacon.name = 'beacon';
  model.add(beacon);

  // Hijack the strobe material's opacity setter so that wing strobes blink
  // in sync and the beacon blinks in anti-phase.
  const origMat = strobe.material;
  let current = origMat.opacity ?? 0;
  Object.defineProperty(origMat, 'opacity', {
    configurable: true,
    get() { return current; },
    set(v) {
      current = v;
      leftStrobe.material.opacity = v;
      rightStrobe.material.opacity = v;
      beacon.material.opacity = v > 0.1 ? 0.2 : 0.85;
    },
  });
}

async function loadCustomObject() {
  if (cachedObject) return cachedObject.clone(true);
  if (inflightPromise) return (await inflightPromise).clone(true);

  inflightPromise = (async () => {
    const [objText, texture] = await Promise.all([fetchText(OBJ_URL), loadTexture(TEX_URL)]);
    const loader = new OBJLoader();
    const raw = loader.parse(objText);

    const material = new THREE.MeshStandardMaterial({
      map: texture || null,
      color: texture ? 0xffffff : 0xd8dde4,
      roughness: 0.45,
      metalness: 0.65,
    });
    raw.traverse((c) => {
      if (c.isMesh) c.material = material;
    });

    // Step 1: measure raw bounding box to find the longest axis.
    let box = new THREE.Box3().setFromObject(raw);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z);
    const scale = longest > 0.001 ? TARGET_LENGTH / longest : 1;
    raw.scale.setScalar(scale);

    // Orient so the nose points along +X. The OBJ's long axis is Z, so rotate
    // the mesh itself (not a wrapper) — this way the mesh's local origin
    // travels with it and we can then recenter it precisely.
    raw.rotation.y = Math.PI / 2;
    raw.updateMatrixWorld(true);

    // Measure after scale + rotation, then shift the mesh so its geometric
    // center lies exactly at (0, GROUND_CLEARANCE - minY, 0) — meaning the
    // outer Group's origin sits at the aircraft's true geometric center in X/Z
    // and the belly rests on the ground in Y.
    box = new THREE.Box3().setFromObject(raw);
    const center = new THREE.Vector3();
    box.getCenter(center);
    raw.position.x -= center.x;
    raw.position.z -= center.z;
    raw.position.y -= (box.min.y - GROUND_CLEARANCE);
    raw.updateMatrixWorld(true);

    // Wrap in a Group so callers get a consistent handle. The wrapper has
    // identity transform — all centering is baked into `raw.position`.
    const wrapper = new THREE.Group();
    wrapper.add(raw);

    cachedObject = wrapper;
    return wrapper;
  })();

  try {
    const obj = await inflightPromise;
    return obj.clone(true);
  } finally {
    inflightPromise = null;
  }
}

export function buildCustomAircraftModel(aircraftHint) {
  const group = new THREE.Group();

  // Strobe placeholder - gets parented to the model and repositioned once loaded.
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  );

  // For propeller aircraft, load one of the user-provided GLB models instead
  // of the default OBJ jet. Pick one randomly from the pool.
  if (isPropAircraft(aircraftHint)) {
    const url = PROP_GLB_URLS[Math.floor(Math.random() * PROP_GLB_URLS.length)];
    loadGLB(url)
      .then((obj) => {
        // Orient nose along +X FIRST, then normalize/center so the X/Z
        // centering happens after rotation — this keeps the aircraft
        // perfectly centered on the chase path.
        obj.rotation.y = Math.PI / 2;
        obj.updateMatrixWorld(true);
        normalizeModel(obj, { targetSize: 15, yOffset: 1.2 });
        group.add(obj);
        attachLightsToModel(obj, strobe);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[propAircraftGLB] load failed, falling back to OBJ:', err?.message || err);
        loadCustomObject().then((obj) => {
          group.add(obj);
          attachLightsToModel(obj, strobe);
        }).catch(() => {});
      });
    return { group, strobe };
  }

  loadCustomObject()
    .then((obj) => {
      group.add(obj);
      attachLightsToModel(obj, strobe);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[customAircraftModel] load failed:', err?.message || err);
    });

  return { group, strobe };
}