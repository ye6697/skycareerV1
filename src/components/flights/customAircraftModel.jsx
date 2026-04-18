import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// User-provided airplane model hosted on catbox.moe.
const OBJ_URL = 'https://files.catbox.moe/szsofq.obj';
const TEX_URL = 'https://files.catbox.moe/ylgpjo.jpg';

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
function attachLightsToModel(model, strobe) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  // Long axis = X (we orient the model that way). Z spans the wings.
  const halfSpan = size.z / 2;
  const noseX = box.max.x;
  const tailX = box.min.x;
  const midY = (box.min.y + box.max.y) / 2;
  const topY = box.max.y;
  const bottomY = box.min.y;

  // Red wingtip (left = -Z) and green wingtip (right = +Z).
  const navGeo = new THREE.SphereGeometry(0.3, 10, 10);
  const red = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  red.position.set(0, midY, -halfSpan);
  model.add(red);
  const green = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0x22ff22 }));
  green.position.set(0, midY, halfSpan);
  model.add(green);

  // White tail strobe on top of fin (this is the mesh whose opacity pulses).
  strobe.position.set(tailX + 1, topY, 0);
  model.add(strobe);

  // Wing strobes at each wingtip (flash in sync with tail strobe).
  const wingStrobeGeo = new THREE.SphereGeometry(0.22, 8, 8);
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
    new THREE.SphereGeometry(0.3, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.9 }),
  );
  beacon.position.set(0, bottomY + 0.1, 0);
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

export function buildCustomAircraftModel() {
  const group = new THREE.Group();

  // Strobe placeholder - gets parented to the model and repositioned once loaded.
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  );

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