import * as THREE from 'three';

// Realistic textured ground environment around the runway.
// Uses canvas-generated textures for grass, asphalt and concrete so there's
// no external dependency that could fail to load.

function makeGrassTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  // Base green.
  ctx.fillStyle = '#2f4a28';
  ctx.fillRect(0, 0, 512, 512);
  // Darker and lighter speckle for variation.
  for (let i = 0; i < 6000; i += 1) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = Math.random() < 0.5 ? '#253d1e' : '#3b5f33';
    ctx.fillStyle = shade;
    ctx.globalAlpha = 0.35 + Math.random() * 0.4;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  // Occasional brighter patches.
  for (let i = 0; i < 400; i += 1) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = '#4a7040';
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(x, y, 4 + Math.random() * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(80, 80);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeAsphaltTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a2f38';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const g = Math.floor(30 + Math.random() * 40);
    ctx.fillStyle = `rgb(${g},${g},${g + 4})`;
    ctx.globalAlpha = 0.5 + Math.random() * 0.3;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeConcreteTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#55606e';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const g = Math.floor(70 + Math.random() * 50);
    ctx.fillStyle = `rgb(${g},${g + 2},${g + 8})`;
    ctx.globalAlpha = 0.4 + Math.random() * 0.3;
    ctx.fillRect(x, y, 2, 2);
  }
  // Expansion joints (grid lines) every ~6m equivalent.
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = '#30363f';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCustomAirport({ runwayLenM = 2500 } = {}) {
  const group = new THREE.Group();

  const grassTex = makeGrassTexture();
  const asphaltTex = makeAsphaltTexture();
  const concreteTex = makeConcreteTexture();

  // Big grass field (replaces all the weird floating squares from before).
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(8000, 8000),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 }),
  );
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, -1.4, -runwayLenM / 2);
  group.add(field);

  // Parallel taxiway running alongside the runway (east side).
  const taxiOffset = 90;
  const taxiWidth = 23;
  const taxiTex = asphaltTex.clone();
  taxiTex.needsUpdate = true;
  taxiTex.repeat.set(taxiWidth / 8, (runwayLenM + 80) / 8);
  const taxi = new THREE.Mesh(
    new THREE.PlaneGeometry(taxiWidth, runwayLenM + 80),
    new THREE.MeshStandardMaterial({ map: taxiTex, roughness: 0.95 }),
  );
  taxi.rotation.x = -Math.PI / 2;
  taxi.position.set(taxiOffset, 0.02, -runwayLenM / 2);
  group.add(taxi);
  // Yellow taxi centerline.
  const taxiLine = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, runwayLenM + 60),
    new THREE.MeshBasicMaterial({ color: 0xf5c146 }),
  );
  taxiLine.rotation.x = -Math.PI / 2;
  taxiLine.position.set(taxiOffset, 0.05, -runwayLenM / 2);
  group.add(taxiLine);

  // Rapid-exit connectors to the runway (4 evenly spaced).
  for (let i = 0; i < 4; i += 1) {
    const z = -((i + 0.6) * runwayLenM) / 4;
    const stubLen = 60;
    const stubTex = asphaltTex.clone();
    stubTex.needsUpdate = true;
    stubTex.repeat.set(stubLen / 8, 21 / 8);
    const stub = new THREE.Mesh(
      new THREE.PlaneGeometry(stubLen, 21),
      new THREE.MeshStandardMaterial({ map: stubTex, roughness: 0.95 }),
    );
    stub.rotation.x = -Math.PI / 2;
    stub.position.set(taxiOffset / 2, 0.019, z);
    group.add(stub);
  }

  // Apron (concrete).
  const apronX = taxiOffset + taxiWidth / 2 + 80;
  const apronW = 160;
  const apronD = Math.min(runwayLenM * 0.7, 1600);
  const apronTex = concreteTex.clone();
  apronTex.needsUpdate = true;
  apronTex.repeat.set(apronW / 12, apronD / 12);
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(apronW, apronD),
    new THREE.MeshStandardMaterial({ map: apronTex, roughness: 0.9 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(apronX, 0.018, -runwayLenM / 2);
  group.add(apron);

  // Terminal building (glass facade toward the apron).
  const termX = apronX + apronW / 2 + 30;
  const termLen = Math.min(apronD * 0.8, 900);
  const termH = 18;
  const terminal = new THREE.Mesh(
    new THREE.BoxGeometry(45, termH, termLen),
    new THREE.MeshStandardMaterial({ color: 0xdde3ec, roughness: 0.7 }),
  );
  terminal.position.set(termX, termH / 2 - 1.4, -runwayLenM / 2);
  group.add(terminal);
  // Glass strip.
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, termH - 3, termLen * 0.96),
    new THREE.MeshStandardMaterial({
      color: 0x0a1220,
      emissive: 0x88bfe0,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.6,
    }),
  );
  glass.position.set(termX - 22.6, (termH - 3) / 2 - 1.4, -runwayLenM / 2);
  group.add(glass);
  // Roof.
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(52, 0.5, termLen + 4),
    new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 }),
  );
  roof.position.set(termX, termH - 1.4 + 0.25, -runwayLenM / 2);
  group.add(roof);

  // Parked airliners at the gates (simple silhouettes).
  const gateCount = 5;
  for (let g = 0; g < gateCount; g += 1) {
    const gz = -runwayLenM / 2 - termLen / 2 + (g + 0.5) * (termLen / gateCount);
    const fuselage = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 30, 14),
      new THREE.MeshStandardMaterial({ color: 0xeef1f6, roughness: 0.5, metalness: 0.5 }),
    );
    fuselage.rotation.z = Math.PI / 2;
    fuselage.position.set(termX - 70, 3, gz);
    group.add(fuselage);
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.4, 28),
      new THREE.MeshStandardMaterial({ color: 0xdde2e8, roughness: 0.5, metalness: 0.55 }),
    );
    wing.position.set(termX - 68, 2.2, gz);
    group.add(wing);
    const vtail = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4.5, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2a4a8a, roughness: 0.5 }),
    );
    vtail.position.set(termX - 82, 5.5, gz);
    group.add(vtail);
  }

  // Control tower.
  const towerX = apronX - 50;
  const towerZ = -runwayLenM / 2 + apronD / 2 + 70;
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 5, 40, 16),
    new THREE.MeshStandardMaterial({ color: 0xbac2d0, roughness: 0.8 }),
  );
  tower.position.set(towerX, 18.6, towerZ);
  group.add(tower);
  const cab = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 6.5, 4, 16),
    new THREE.MeshStandardMaterial({
      color: 0x0a1220, emissive: 0x88bfe0, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.6,
    }),
  );
  cab.position.set(towerX, 40, towerZ);
  group.add(cab);

  // A few hangars on the opposite side of the runway.
  for (let i = 0; i < 3; i += 1) {
    const hx = -(90 + i * 55);
    const hz = -runwayLenM / 2 + (i - 1) * 150;
    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(50, 14, 60),
      new THREE.MeshStandardMaterial({ color: 0x5a6474, roughness: 0.9 }),
    );
    hangar.position.set(hx, 5.6, hz);
    group.add(hangar);
    const hroof = new THREE.Mesh(
      new THREE.CylinderGeometry(25, 25, 60, 16, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.9 }),
    );
    hroof.rotation.z = Math.PI / 2;
    hroof.rotation.y = Math.PI / 2;
    hroof.position.set(hx, 12.6, hz);
    group.add(hroof);
  }

  return group;
}