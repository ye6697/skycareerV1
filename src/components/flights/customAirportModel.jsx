import * as THREE from 'three';

// Realistic textured airport environment using CC0 PBR textures from Poly Haven.
// No external model loading — we build the layout procedurally but skin every
// surface with real photographic textures (asphalt, concrete, grass) so the
// ground actually looks like a real airport instead of flat gray.

const TEX_URLS = {
  grassDiff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg',
  asphaltDiff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_02/asphalt_02_diff_1k.jpg',
  concreteDiff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_floor_worn_001/concrete_floor_worn_001_diff_1k.jpg',
  rockDiff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_rocks_02/aerial_rocks_02_diff_1k.jpg',
  brickDiff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/red_brick_03/red_brick_03_diff_1k.jpg',
  roofDiff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/roof_tiles_14/roof_tiles_14_diff_1k.jpg',
  barkDiff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/bark_brown_02/bark_brown_02_diff_1k.jpg',
  leavesDiff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/leaves_forest_ground/leaves_forest_ground_diff_1k.jpg',
};

const textureCache = new Map();
function loadTex(url) {
  if (textureCache.has(url)) return textureCache.get(url);
  const tex = new THREE.TextureLoader().load(url, (t) => { t.needsUpdate = true; });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  textureCache.set(url, tex);
  return tex;
}

function texturedMat(url, repeatU, repeatV, baseColor = 0xffffff, roughness = 0.9) {
  const tex = loadTex(url).clone();
  tex.needsUpdate = true;
  tex.repeat.set(repeatU, repeatV);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({
    map: tex,
    color: baseColor,
    roughness,
    metalness: 0,
  });
}

export function buildCustomAirport({ runwayLenM = 2500 } = {}) {
  const group = new THREE.Group();

  // ------- Base grass field (real grass texture) -------
  const fieldSize = 8000;
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(fieldSize, fieldSize),
    texturedMat(TEX_URLS.grassDiff, 120, 120, 0xbfd3a8, 1),
  );
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, -1.4, -runwayLenM / 2);
  group.add(field);

  // ------- Parallel taxiway (asphalt PBR) -------
  const taxiOffset = 90;
  const taxiWidth = 23;
  const taxiLenM = runwayLenM + 80;
  const taxi = new THREE.Mesh(
    new THREE.PlaneGeometry(taxiWidth, taxiLenM),
    texturedMat(TEX_URLS.asphaltDiff, taxiWidth / 4, taxiLenM / 4, 0x6e7480),
  );
  taxi.rotation.x = -Math.PI / 2;
  taxi.position.set(taxiOffset, 0.02, -runwayLenM / 2);
  group.add(taxi);
  // Yellow centerline.
  const taxiLine = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, runwayLenM + 60),
    new THREE.MeshBasicMaterial({ color: 0xf5c146 }),
  );
  taxiLine.rotation.x = -Math.PI / 2;
  taxiLine.position.set(taxiOffset, 0.05, -runwayLenM / 2);
  group.add(taxiLine);

  // ------- Rapid-exit connectors -------
  for (let i = 0; i < 4; i += 1) {
    const z = -((i + 0.6) * runwayLenM) / 4;
    const stubLen = 60;
    const stub = new THREE.Mesh(
      new THREE.PlaneGeometry(stubLen, 21),
      texturedMat(TEX_URLS.asphaltDiff, stubLen / 4, 21 / 4, 0x6e7480),
    );
    stub.rotation.x = -Math.PI / 2;
    stub.position.set(taxiOffset / 2, 0.019, z);
    group.add(stub);
  }

  // ------- Apron (real concrete texture) -------
  const apronX = taxiOffset + taxiWidth / 2 + 80;
  const apronW = 180;
  const apronD = Math.min(runwayLenM * 0.7, 1600);
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(apronW, apronD),
    texturedMat(TEX_URLS.concreteDiff, apronW / 6, apronD / 6, 0xc5ccd5, 0.85),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(apronX, 0.018, -runwayLenM / 2);
  group.add(apron);
  // Apron stripes: yellow gate lead-in lines (every 100 m).
  const gateCount = Math.max(5, Math.floor(apronD / 100));
  for (let g = 0; g < gateCount; g += 1) {
    const gz = -runwayLenM / 2 - apronD / 2 + (g + 0.5) * (apronD / gateCount);
    const lead = new THREE.Mesh(
      new THREE.PlaneGeometry(apronW * 0.8, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xf5c146 }),
    );
    lead.rotation.x = -Math.PI / 2;
    lead.position.set(apronX - apronW * 0.08, 0.04, gz);
    group.add(lead);
  }

  // ------- Terminal with glass facade -------
  const termX = apronX + apronW / 2 + 35;
  const termLen = Math.min(apronD * 0.82, 900);
  const termH = 20;
  // Concrete-textured body (real photo of weathered concrete).
  const terminalBody = new THREE.Mesh(
    new THREE.BoxGeometry(48, termH, termLen),
    texturedMat(TEX_URLS.concreteDiff, 4, termLen / 16, 0xdfe4ec, 0.75),
  );
  terminalBody.position.set(termX, termH / 2 - 1.4, -runwayLenM / 2);
  group.add(terminalBody);
  // Glass facade toward apron (emissive for dusk mood).
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, termH - 3, termLen * 0.97),
    new THREE.MeshStandardMaterial({
      color: 0x0a1220,
      emissive: 0x7fc2e8,
      emissiveIntensity: 0.55,
      roughness: 0.15,
      metalness: 0.65,
    }),
  );
  glass.position.set(termX - 24.1, (termH - 3) / 2 - 1.4, -runwayLenM / 2);
  group.add(glass);
  // Dark roof.
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(54, 0.6, termLen + 4),
    new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 }),
  );
  roof.position.set(termX, termH - 1.4 + 0.3, -runwayLenM / 2);
  group.add(roof);
  // Warm interior window bands (visible from the landside).
  for (let row = 0; row < 3; row += 1) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 2.4, termLen * 0.95),
      new THREE.MeshStandardMaterial({
        color: 0x0a0f1a, emissive: 0xffd68a, emissiveIntensity: 1.2, roughness: 0.3,
      }),
    );
    band.position.set(termX + 24.1, 2 + row * 5.5, -runwayLenM / 2);
    group.add(band);
  }

  // ------- Parked airliners at gates -------
  for (let g = 0; g < gateCount; g += 1) {
    const gz = -runwayLenM / 2 - termLen / 2 + (g + 0.5) * (termLen / gateCount);
    const liveryColor = [0xeef1f6, 0xfafbfc, 0xf5f7fa][g % 3];
    const tailColor = [0x2a4a8a, 0xc0404a, 0x2a8a4a][g % 3];
    const fuselage = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 1.9, 32, 16),
      new THREE.MeshStandardMaterial({ color: liveryColor, roughness: 0.45, metalness: 0.55 }),
    );
    fuselage.rotation.z = Math.PI / 2;
    fuselage.position.set(termX - 70, 3.2, gz);
    group.add(fuselage);
    // Dark window strip.
    [-1, 1].forEach((side) => {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(24, 0.25, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x0a0f1a, roughness: 0.3 }),
      );
      win.position.set(termX - 70, 3.5, gz + side * 1.85);
      group.add(win);
    });
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 0.45, 30),
      new THREE.MeshStandardMaterial({ color: liveryColor, roughness: 0.5, metalness: 0.55 }),
    );
    wing.position.set(termX - 68, 2.3, gz);
    group.add(wing);
    const vtail = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 5, 0.3),
      new THREE.MeshStandardMaterial({ color: tailColor, roughness: 0.5 }),
    );
    vtail.position.set(termX - 84, 6, gz);
    group.add(vtail);
    // Under-wing engines.
    [-5, 5].forEach((zOff) => {
      const eng = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.7, 2.4, 12),
        new THREE.MeshStandardMaterial({ color: 0xbac0c8, roughness: 0.4, metalness: 0.7 }),
      );
      eng.rotation.z = Math.PI / 2;
      eng.position.set(termX - 68.5, 1.5, gz + zOff);
      group.add(eng);
    });
  }

  // ------- Control tower -------
  const towerX = apronX - 55;
  const towerZ = -runwayLenM / 2 + apronD / 2 + 70;
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 5.5, 42, 18),
    texturedMat(TEX_URLS.concreteDiff, 2, 6, 0xbac2d0, 0.8),
  );
  tower.position.set(towerX, 19.6, towerZ);
  group.add(tower);
  const cab = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 6.5, 4.5, 18),
    new THREE.MeshStandardMaterial({
      color: 0x0a1220, emissive: 0x88bfe0, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.6,
    }),
  );
  cab.position.set(towerX, 42.5, towerZ);
  group.add(cab);
  const cabRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(7.6, 7.6, 0.6, 18),
    new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 }),
  );
  cabRoof.position.set(towerX, 45, towerZ);
  group.add(cabRoof);
  // Red obstruction beacon.
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  );
  beacon.position.set(towerX, 48, towerZ);
  group.add(beacon);

  // ------- Hangars on the opposite side of the runway -------
  for (let i = 0; i < 3; i += 1) {
    const hx = -(110 + i * 62);
    const hz = -runwayLenM / 2 + (i - 1) * 160;
    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(55, 15, 65),
      texturedMat(TEX_URLS.concreteDiff, 4, 1, 0x6a7280, 0.9),
    );
    hangar.position.set(hx, 6.1, hz);
    group.add(hangar);
    // Arched corrugated roof.
    const hroof = new THREE.Mesh(
      new THREE.CylinderGeometry(27.5, 27.5, 65, 16, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.9 }),
    );
    hroof.rotation.z = Math.PI / 2;
    hroof.rotation.y = Math.PI / 2;
    hroof.position.set(hx, 13.6, hz);
    group.add(hroof);
    // Sliding door.
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 13),
      new THREE.MeshStandardMaterial({ color: 0x1f2430, roughness: 0.9 }),
    );
    door.position.set(hx, 5.5, hz - 32.6);
    group.add(door);
  }

  // ------- Suburban houses scattered off the runway axis -------
  // Brick walls with textured tile roofs. Placed on both sides so the approach
  // flies over inhabited terrain rather than empty grass.
  const brickWallMat = texturedMat(TEX_URLS.brickDiff, 2, 1.2, 0xd8c0a0, 0.85);
  const roofMat = texturedMat(TEX_URLS.roofDiff, 1, 1, 0xb8756a, 0.9);
  for (let i = 0; i < 140; i += 1) {
    const side = Math.random() > 0.5 ? -1 : 1;
    const lateral = side * (280 + Math.random() * 1800);
    const along = (Math.random() - 0.5) * 5000;
    // Skip anything inside a 200 m runway corridor so houses don't clip.
    if (Math.abs(lateral) < 200) continue;
    const w = 5 + Math.random() * 5;
    const d = 6 + Math.random() * 6;
    const h = 3.5 + Math.random() * 2.5;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brickWallMat);
    wall.position.set(lateral, h / 2 - 1.4, along);
    wall.rotation.y = Math.random() * Math.PI;
    group.add(wall);
    // Pyramidal textured roof.
    const rf = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.75, 2.4, 4),
      roofMat,
    );
    rf.rotation.y = wall.rotation.y + Math.PI / 4;
    rf.position.set(lateral, h - 1.4 + 1.1, along);
    group.add(rf);
  }

  // ------- Trees (textured trunk + textured leaf canopy) -------
  const trunkMat = texturedMat(TEX_URLS.barkDiff, 1, 2, 0x6a4a32, 1);
  const leavesMat = texturedMat(TEX_URLS.leavesDiff, 1.5, 1.5, 0x4a7a3a, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.45, 3, 6);
  const canopyGeo = new THREE.SphereGeometry(2.4, 8, 6);
  const coneCanopyGeo = new THREE.ConeGeometry(2.2, 6, 7);
  for (let i = 0; i < 1800; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 220 + Math.pow(Math.random(), 0.6) * 3400;
    const x = Math.cos(angle) * radius;
    const z = -runwayLenM / 2 + Math.sin(angle) * radius;
    // Avoid the runway corridor.
    if (Math.abs(x) < 200 && Math.abs(z + runwayLenM / 2) < runwayLenM / 2) continue;
    // Avoid apron area.
    if (x > apronX - apronW / 2 - 20 && x < apronX + apronW / 2 + 20 &&
        Math.abs(z + runwayLenM / 2) < apronD / 2 + 20) continue;
    const scale = 0.8 + Math.random() * 1.8;
    const isConifer = Math.random() < 0.55;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.scale.setScalar(scale);
    trunk.position.set(x, 1.5 * scale - 1.4, z);
    group.add(trunk);
    const canopy = new THREE.Mesh(isConifer ? coneCanopyGeo : canopyGeo, leavesMat);
    canopy.scale.setScalar(scale);
    canopy.position.set(x, (isConifer ? 6 : 5) * scale - 1.4, z);
    group.add(canopy);
  }

  // ------- Distant mountain range with real rock texture -------
  // Ring of rugged mountains with multi-octave noise displacement and a real
  // aerial rock photo as their surface. Snow-capped peaks via a subtle white
  // overlay mesh.
  const rockMat = texturedMat(TEX_URLS.rockDiff, 3, 3, 0x8a8278, 1);
  rockMat.flatShading = true;
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.85, flatShading: true });
  const hash2 = (a, b) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const valueNoise = (x, y) => {
    const xi = Math.floor(x); const yi = Math.floor(y);
    const xf = x - xi; const yf = y - yi;
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    const u = smoothstep(xf), v = smoothstep(yf);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };
  const fbm = (x, y) => {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < 4; o += 1) { sum += valueNoise(x * freq, y * freq) * amp; norm += amp; amp *= 0.5; freq *= 2.05; }
    return sum / norm;
  };
  const ringCount = 26;
  for (let i = 0; i < ringCount; i += 1) {
    const angle = (i / ringCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.06;
    const radius = 3800 + Math.random() * 900;
    const chunkW = 1400 + Math.random() * 500;
    const chunkD = 700 + Math.random() * 300;
    const peakH = 450 + Math.random() * 500;
    const seedX = Math.random() * 100;
    const seedY = Math.random() * 100;
    const geo = new THREE.PlaneGeometry(chunkW, chunkD, 24, 12);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v += 1) {
      const px = pos.getX(v); const pz = pos.getZ(v);
      const rX = 1 - Math.pow(Math.abs(px / (chunkW / 2)), 1.6);
      const rZ = 1 - Math.pow(Math.abs(pz / (chunkD / 2)), 1.4);
      const ridge = Math.max(0, rX) * Math.max(0, rZ);
      const n = fbm(px * 0.003 + seedX, pz * 0.004 + seedY);
      const h = peakH * Math.pow(ridge, 1.3) * (0.55 + n * 0.85);
      pos.setY(v, h);
    }
    geo.computeVertexNormals();
    const mountain = new THREE.Mesh(geo, rockMat);
    mountain.position.set(
      Math.cos(angle) * radius,
      -1.4,
      -runwayLenM / 2 + Math.sin(angle) * radius,
    );
    mountain.rotation.y = -angle + Math.PI / 2;
    group.add(mountain);
    // Snow cap: duplicate geometry, lift it up so only peaks poke through.
    const snowGeo = geo.clone();
    const snowPos = snowGeo.attributes.position;
    for (let v = 0; v < snowPos.count; v += 1) {
      const y = snowPos.getY(v);
      snowPos.setY(v, y < peakH * 0.72 ? -9999 : y + 2); // hide low parts far below
    }
    snowGeo.computeVertexNormals();
    const snow = new THREE.Mesh(snowGeo, snowMat);
    snow.position.copy(mountain.position);
    snow.rotation.copy(mountain.rotation);
    group.add(snow);
  }

  return group;
}