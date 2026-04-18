import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// User-provided airplane model hosted on catbox.moe.
// The OBJ references a texture (Material_metal.jpg) via its MTL; we load the
// texture directly and apply it to all meshes so we don't need the MTL file.
const OBJ_URL = 'https://files.catbox.moe/szsofq.obj';
const TEX_URL = 'https://files.catbox.moe/ylgpjo.jpg';

// Target length (meters) for the aircraft's longest axis in world space.
const TARGET_LENGTH = 30;
// Extra clearance above ground so the aircraft visibly rests on its gear
// rather than the belly touching the asphalt.
const GROUND_CLEARANCE = 1.2;

let cachedGeometry = null;     // shared geometry data (origin-centered, scaled, oriented)
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
      () => resolve(null),
    );
  });
}

// Load + parse OBJ once, compute orientation + scale so that:
//  - the aircraft's geometric center (X/Z) sits at x=0, z=0
//  - the aircraft's BELLY (lowest Y vertex) sits at y = GROUND_CLEARANCE
//  - the nose points in +X, longest horizontal axis = TARGET_LENGTH
// That way the group's local origin matches the flight-path reference point,
// and the aircraft never clips through the runway on touchdown.
async function loadCustomObject() {
  if (cachedGeometry) return cachedGeometry.object.clone(true);
  if (inflightPromise) {
    const g = await inflightPromise;
    return g.object.clone(true);
  }

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
    raw.traverse((child) => {
      if (child.isMesh) {
        child.material = material;
      }
    });

    // Step 1: measure raw bounding box to find the longest axis.
    let box = new THREE.Box3().setFromObject(raw);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z);
    const scale = longest > 0.001 ? TARGET_LENGTH / longest : 1;

    // Wrap in a container so we can apply scale + orientation cleanly.
    const wrapper = new THREE.Group();
    raw.scale.setScalar(scale);
    wrapper.add(raw);

    // Step 2: orient so the nose points +X. The authored OBJ's long axis is
    // along Z, so rotate 90° around Y.
    wrapper.rotation.y = Math.PI / 2;
    wrapper.updateMatrixWorld(true);

    // Step 3: re-measure after scale+rotation, then center and lift.
    box = new THREE.Box3().setFromObject(wrapper);
    const center = new THREE.Vector3();
    box.getCenter(center);
    // Shift inner object so wrapper's (0,0,0) == aircraft's geometric center
    // on X/Z, and the belly sits at y = GROUND_CLEARANCE.
    raw.position.x -= center.x;
    raw.position.z -= center.z;
    raw.position.y -= box.min.y - GROUND_CLEARANCE;

    cachedGeometry = { object: wrapper };
    return cachedGeometry;
  })();

  try {
    const g = await inflightPromise;
    return g.object.clone(true);
  } finally {
    inflightPromise = null;
  }
}

// Build navigation + strobe lights that sit on the aircraft. They are added
// to the same group as the model, so they move/rotate with it automatically.
// Positions are set in world-scale meters relative to the aircraft center.
function addAircraftLights(group, strobe) {
  // Nav lights: red on left wingtip, green on right wingtip.
  const navGeo = new THREE.SphereGeometry(0.28, 10, 10);
  const red = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  red.position.set(0, 1.5, -13);  // left wingtip (-Z = left in our convention)
  group.add(red);

  const green = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0x22ff22 }));
  green.position.set(0, 1.5, 13); // right wingtip
  group.add(green);

  // Tail strobe (white, on top of vertical stabilizer). This one is the
  // mesh returned as `strobe` so the animation loop pulses its opacity.
  strobe.position.set(-11, 4.5, 0);

  // Belly beacon (red, blinking in anti-phase to the strobe for realism).
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.9 }),
  );
  beacon.position.set(0, -0.4, 0);
  beacon.name = 'beacon';
  group.add(beacon);

  // Wing strobes that flash together with the tail strobe.
  const wingStrobeGeo = new THREE.SphereGeometry(0.22, 8, 8);
  const wingStrobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  const leftStrobe = new THREE.Mesh(wingStrobeGeo, wingStrobeMat.clone());
  leftStrobe.position.set(0, 1.5, -13);
  leftStrobe.name = 'wingStrobe';
  group.add(leftStrobe);
  const rightStrobe = new THREE.Mesh(wingStrobeGeo, wingStrobeMat.clone());
  rightStrobe.position.set(0, 1.5, 13);
  rightStrobe.name = 'wingStrobe';
  group.add(rightStrobe);
}

// Hook into the animation loop: we don't have direct access, but we can use
// a userData callback. FinalApproach3D's loop only pulses the `strobe` mesh
// opacity based on time. To also blink the beacon + wing strobes in sync, we
// wrap strobe.material so that setting its opacity also updates the others.
function linkStrobeGroup(group, strobe) {
  const wingStrobes = group.children.filter((c) => c.name === 'wingStrobe');
  const beacon = group.children.find((c) => c.name === 'beacon');
  const origMat = strobe.material;
  const origDescriptor = Object.getOwnPropertyDescriptor(origMat, 'opacity');
  // Fallback: just poll via Object.defineProperty on this instance.
  let current = origMat.opacity ?? 0;
  Object.defineProperty(origMat, 'opacity', {
    configurable: true,
    get() { return current; },
    set(v) {
      current = v;
      wingStrobes.forEach((m) => { if (m.material) m.material.opacity = v; });
      // Beacon blinks in anti-phase (on when strobe off, dimmer).
      if (beacon && beacon.material) {
        beacon.material.opacity = v > 0.1 ? 0.2 : 0.85;
      }
    },
  });
  // Preserve any existing opacity value.
  if (origDescriptor && typeof origDescriptor.value === 'number') current = origDescriptor.value;
}

export function buildCustomAircraftModel() {
  const group = new THREE.Group();

  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  );
  group.add(strobe);

  // Add nav lights immediately (not dependent on model load).
  addAircraftLights(group, strobe);
  linkStrobeGroup(group, strobe);

  loadCustomObject()
    .then((obj) => {
      group.add(obj);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[customAircraftModel] load failed:', err?.message || err);
    });

  return { group, strobe };
}