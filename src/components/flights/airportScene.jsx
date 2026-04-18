import * as THREE from 'three';

// Builds a realistic airport environment around the runway: parallel taxiway,
// connecting taxiway stubs, apron, terminal, jet bridges, tower, hangars,
// fuel farm, and parking. All geometry is placed in runway-local coordinates
// (same frame as buildRunwayScene): runway extends from Z=0 to Z=-lenM, with
// +X being right of the centerline.
//
// `runwayLenM` and `runwayWidthM` come from buildRunwayScene so everything
// lines up perfectly with the real runway.
export function buildAirportEnvironment({ runwayLenM, runwayWidthM }) {
  const group = new THREE.Group();
  const lenM = runwayLenM;
  const widM = runwayWidthM;

  // Common materials
  const taxiMat = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.95 });
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x323848, roughness: 0.95 });
  const yellowLine = new THREE.MeshBasicMaterial({ color: 0xf5c146 });
  const terminalMat = new THREE.MeshStandardMaterial({ color: 0x3e4656, roughness: 0.85, metalness: 0.2 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f1a,
    emissive: 0xffd68a,
    emissiveIntensity: 1.4,
    roughness: 0.3,
    metalness: 0.3,
  });
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x5a6474, roughness: 0.9, metalness: 0.3 });
  const hangarRoofMat = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.9 });
  const towerBaseMat = new THREE.MeshStandardMaterial({ color: 0xbac2d0, roughness: 0.8 });
  const towerGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0a1220,
    emissive: 0x88bfe0,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.5,
  });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xdde4ec, roughness: 0.6, metalness: 0.6 });
  const carColors = [0x9aa4b4, 0x8088a0, 0x5a6070, 0x3a4050, 0xa8b0c0, 0x707888, 0x606878];

  // --- Parallel taxiway on the +X side, full length ---
  const taxiOffset = widM / 2 + 80; // ~80m from centerline
  const taxiWidth = 25;
  const taxiway = new THREE.Mesh(new THREE.PlaneGeometry(taxiWidth, lenM), taxiMat);
  taxiway.rotation.x = -Math.PI / 2;
  taxiway.position.set(taxiOffset, 0.018, -lenM / 2);
  group.add(taxiway);
  // Yellow taxi centerline
  const taxiLine = new THREE.Mesh(new THREE.PlaneGeometry(0.4, lenM - 20), yellowLine);
  taxiLine.rotation.x = -Math.PI / 2;
  taxiLine.position.set(taxiOffset, 0.04, -lenM / 2);
  group.add(taxiLine);

  // --- Connecting taxiway stubs (every ~500m) from runway to parallel taxiway ---
  const stubCount = Math.max(3, Math.floor(lenM / 500));
  for (let i = 0; i < stubCount; i += 1) {
    const z = -((i + 0.5) * lenM) / stubCount;
    const stubW = 25;
    const stubLen = taxiOffset - widM / 2 - 6;
    const stub = new THREE.Mesh(new THREE.PlaneGeometry(stubLen, stubW), taxiMat);
    stub.rotation.x = -Math.PI / 2;
    stub.position.set(widM / 2 + 6 + stubLen / 2, 0.017, z);
    group.add(stub);
    const stubLine = new THREE.Mesh(new THREE.PlaneGeometry(stubLen - 4, 0.4), yellowLine);
    stubLine.rotation.x = -Math.PI / 2;
    stubLine.position.set(widM / 2 + 6 + stubLen / 2, 0.04, z);
    group.add(stubLine);
  }

  // --- Apron (big paved area next to the parallel taxiway) ---
  const apronX = taxiOffset + taxiWidth / 2 + 90;
  const apronW = 180;
  const apronD = Math.min(lenM * 0.7, 1800);
  const apronZ = -lenM / 2;
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(apronW, apronD), apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(apronX, 0.018, apronZ);
  group.add(apron);

  // --- Terminal building (long, multi-story, with glowing windows) ---
  const termW = 40;
  const termLen = Math.min(apronD * 0.8, 900);
  const termH = 18;
  const termX = apronX + apronW / 2 + termW / 2 + 8;
  // Terminal body
  const terminalBody = new THREE.Mesh(new THREE.BoxGeometry(termW, termH, termLen), terminalMat);
  terminalBody.position.set(termX, termH / 2 - 1.5, apronZ);
  group.add(terminalBody);
  // Window bands (two rows on apron side)
  for (let row = 0; row < 3; row += 1) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 3.2, termLen * 0.95),
      windowMat,
    );
    band.position.set(termX - termW / 2 - 0.1, 3 + row * 5.2, apronZ);
    group.add(band);
  }
  // Flat roof trim
  const termRoof = new THREE.Mesh(
    new THREE.BoxGeometry(termW + 2, 0.8, termLen + 2),
    new THREE.MeshStandardMaterial({ color: 0x20262f, roughness: 0.9 }),
  );
  termRoof.position.set(termX, termH - 1.5 + 0.4, apronZ);
  group.add(termRoof);

  // --- Jet bridges extending from terminal toward parked aircraft ---
  const bridgeCount = Math.max(4, Math.floor(termLen / 110));
  for (let i = 0; i < bridgeCount; i += 1) {
    const bz = apronZ - termLen / 2 + ((i + 0.5) * termLen) / bridgeCount;
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(55, 3.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x8a94a8, roughness: 0.7, metalness: 0.3 }),
    );
    bridge.position.set(termX - termW / 2 - 28, 4.5, bz);
    group.add(bridge);
    // Bridge support pillar
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.0, 6, 10),
      new THREE.MeshStandardMaterial({ color: 0x6a7080, roughness: 0.8 }),
    );
    pillar.position.set(termX - termW / 2 - 55, 1.5, bz);
    group.add(pillar);
    // Parked aircraft silhouette at the gate (simple stand-in)
    buildParkedAircraft(group, termX - termW / 2 - 85, bz);
  }

  // --- Control tower (tall cylinder with glass cab on top) ---
  const towerX = apronX - 40;
  const towerZ = apronZ + apronD / 2 + 80;
  const towerH = 42;
  const towerBase = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5, towerH, 16),
    towerBaseMat,
  );
  towerBase.position.set(towerX, towerH / 2 - 1.5, towerZ);
  group.add(towerBase);
  const towerCab = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 6, 5, 18),
    towerGlassMat,
  );
  towerCab.position.set(towerX, towerH - 1.5 + 2.5, towerZ);
  group.add(towerCab);
  // Cab roof
  const towerRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(7.5, 7.5, 1, 18),
    new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 }),
  );
  towerRoof.position.set(towerX, towerH - 1.5 + 5.5, towerZ);
  group.add(towerRoof);
  // Red beacon on top
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  );
  beacon.position.set(towerX, towerH - 1.5 + 6.5, towerZ);
  group.add(beacon);

  // --- Hangars (several large boxes with arched roofs) ---
  const hangarCount = 4;
  const hangarZStart = apronZ - apronD / 2 - 60;
  for (let i = 0; i < hangarCount; i += 1) {
    const hx = apronX - 40 + i * 70;
    const hz = hangarZStart - 50;
    const hW = 55;
    const hH = 14;
    const hD = 70;
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(hW, hH, hD), hangarMat);
    hangar.position.set(hx, hH / 2 - 1.5, hz);
    group.add(hangar);
    // Arched roof (half cylinder)
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(hW / 2, hW / 2, hD, 16, 1, false, 0, Math.PI),
      hangarRoofMat,
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.set(hx, hH - 1.5, hz);
    group.add(roof);
    // Big front door (darker rectangle)
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(hW * 0.8, hH * 0.85),
      new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.9 }),
    );
    door.position.set(hx, hH / 2 - 1.5 - 1, hz - hD / 2 - 0.05);
    group.add(door);
  }

  // --- Fuel farm: cluster of cylindrical tanks ---
  const fuelX = apronX + apronW / 2 + 120;
  const fuelZ = apronZ + apronD / 2 - 100;
  for (let i = 0; i < 6; i += 1) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 10, 20),
      tankMat,
    );
    tank.position.set(fuelX + col * 22, 3.5, fuelZ + row * 22);
    group.add(tank);
    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 0.5, 20),
      new THREE.MeshStandardMaterial({ color: 0x98a0ac, roughness: 0.7, metalness: 0.5 }),
    );
    topCap.position.set(fuelX + col * 22, 8.8, fuelZ + row * 22);
    group.add(topCap);
  }

  // --- Parking lot with rows of cars behind the terminal ---
  const lotX = termX + termW / 2 + 35;
  const lotZ = apronZ;
  const lotW = 80;
  const lotD = Math.min(termLen, 500);
  const lot = new THREE.Mesh(
    new THREE.PlaneGeometry(lotW, lotD),
    new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 1 }),
  );
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(lotX, 0.015, lotZ);
  group.add(lot);
  // Car rows
  const carGeo = new THREE.BoxGeometry(1.8, 1.3, 3.8);
  for (let row = 0; row < 6; row += 1) {
    for (let c = 0; c < Math.floor(lotD / 5); c += 1) {
      if (Math.random() > 0.75) continue; // some empty spots
      const car = new THREE.Mesh(
        carGeo,
        new THREE.MeshStandardMaterial({
          color: carColors[Math.floor(Math.random() * carColors.length)],
          roughness: 0.6, metalness: 0.4,
        }),
      );
      car.position.set(lotX - lotW / 2 + 6 + row * 12, 0.15, lotZ - lotD / 2 + 3 + c * 5);
      group.add(car);
    }
  }

  // --- Airport perimeter: service road along the apron ---
  const serviceRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(6, apronD + 200),
    new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 1 }),
  );
  serviceRoad.rotation.x = -Math.PI / 2;
  serviceRoad.position.set(apronX - apronW / 2 - 15, 0.016, apronZ);
  group.add(serviceRoad);

  // --- Mirror a smaller GA apron + small hangars on the opposite (-X) side ---
  const gaX = -(widM / 2 + 120);
  const gaApron = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 400),
    apronMat,
  );
  gaApron.rotation.x = -Math.PI / 2;
  gaApron.position.set(gaX, 0.018, -lenM * 0.25);
  group.add(gaApron);
  for (let i = 0; i < 3; i += 1) {
    const hx = gaX - 60;
    const hz = -lenM * 0.25 - 150 + i * 120;
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(30, 8, 35), hangarMat);
    hangar.position.set(hx, 4 - 1.5, hz);
    group.add(hangar);
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(15, 15, 35, 12, 1, false, 0, Math.PI),
      hangarRoofMat,
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.set(hx, 8 - 1.5, hz);
    group.add(roof);
    // Parked GA plane silhouettes on the apron
    for (let j = 0; j < 4; j += 1) {
      buildSmallParkedPlane(group, gaX + 15 + j * 18, hz);
    }
  }

  return group;
}

// Very simple parked-airliner silhouette: fuselage + wings + tail.
function buildParkedAircraft(parent, x, z) {
  const fuselageMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf1, roughness: 0.5, metalness: 0.4 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x2a4a8a, roughness: 0.5 });
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 30, 14), fuselageMat);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.position.set(x, 3.5, z);
  parent.add(fuselage);
  // Nose
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4, 14), fuselageMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(x - 17, 3.5, z);
  parent.add(nose);
  // Wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 28), fuselageMat);
  wing.position.set(x + 1, 2.8, z);
  parent.add(wing);
  // Tail
  const vtail = new THREE.Mesh(new THREE.BoxGeometry(4, 4.5, 0.3), accentMat);
  vtail.position.set(x + 12, 6, z);
  parent.add(vtail);
  const htail = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 9), fuselageMat);
  htail.position.set(x + 12.5, 4.8, z);
  parent.add(htail);
  // Engines
  [-6, 6].forEach((zOff) => {
    const eng = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0xcfd4dc, roughness: 0.5, metalness: 0.6 }),
    );
    eng.rotation.z = Math.PI / 2;
    eng.position.set(x + 1, 1.9, z + zOff);
    parent.add(eng);
  });
}

// Simple parked small prop silhouette for GA apron.
function buildSmallParkedPlane(parent, x, z) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xeef0f4, roughness: 0.6 });
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 7, 10), mat);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.position.set(x, 1.1, z);
  parent.add(fuselage);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 10), mat);
  wing.position.set(x, 1.5, z);
  parent.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.1), mat);
  tail.position.set(x + 3, 1.9, z);
  parent.add(tail);
}