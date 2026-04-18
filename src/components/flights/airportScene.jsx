import * as THREE from 'three';

// Builds a realistic airport environment around the runway: parallel taxiways,
// connecting rapid-exit taxiways with yellow hold-short lines, apron with
// gate markings and numbers, a glass-fronted terminal with realistic jet
// bridges, a control tower, hangars, fuel farm, parking and ground service
// vehicles. Everything is placed in runway-local coordinates so it lines up
// perfectly with buildRunwayScene.
export function buildAirportEnvironment({ runwayLenM, runwayWidthM }) {
  const group = new THREE.Group();
  const lenM = runwayLenM;
  const widM = runwayWidthM;

  // ================= Common materials =================
  const taxiMat = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.95 });
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x363c4a, roughness: 0.95 });
  const yellowLine = new THREE.MeshBasicMaterial({ color: 0xf5c146 });
  const whiteLine = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
  const redLine = new THREE.MeshBasicMaterial({ color: 0xd44a3a });
  const grass = new THREE.MeshStandardMaterial({ color: 0x2e4226, roughness: 1 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8a90a0, roughness: 0.9 });
  const darkConcrete = new THREE.MeshStandardMaterial({ color: 0x2f3442, roughness: 0.95 });

  // Glass facade material (lit at dusk)
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a1220,
    emissive: 0x88bfe0,
    emissiveIntensity: 0.55,
    roughness: 0.2,
    metalness: 0.6,
  });
  const warmWindowMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f1a,
    emissive: 0xffd68a,
    emissiveIntensity: 1.3,
    roughness: 0.3,
    metalness: 0.3,
  });
  const terminalSteelMat = new THREE.MeshStandardMaterial({
    color: 0xcdd3dd,
    roughness: 0.55,
    metalness: 0.6,
  });
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x5a6474, roughness: 0.9, metalness: 0.3 });
  const hangarRoofMat = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.9 });
  const towerBaseMat = new THREE.MeshStandardMaterial({ color: 0xbac2d0, roughness: 0.8 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xdde4ec, roughness: 0.55, metalness: 0.65 });
  const carColors = [0x9aa4b4, 0x8088a0, 0x5a6070, 0x3a4050, 0xa8b0c0, 0x707888, 0x606878, 0xc8d0dc];

  // Helper: add a flat rectangular marking on the ground.
  const paint = (w, d, mat, x, z, y = 0.04, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rotY;
    m.position.set(x, y, z);
    group.add(m);
  };

  // ================= Parallel taxiways (both sides) =================
  // Main parallel taxiway (east side, +X), full length.
  const taxiOffset = widM / 2 + 90;
  const taxiWidth = 23;
  const mainTaxi = new THREE.Mesh(new THREE.PlaneGeometry(taxiWidth, lenM + 80), taxiMat);
  mainTaxi.rotation.x = -Math.PI / 2;
  mainTaxi.position.set(taxiOffset, 0.02, -lenM / 2);
  group.add(mainTaxi);
  // Yellow taxi centerline
  paint(0.4, lenM + 60, yellowLine, taxiOffset, -lenM / 2, 0.05);
  // Edge lights (blue) along both sides of the taxiway at intervals
  for (let z = 0; z >= -lenM; z -= 40) {
    [-1, 1].forEach((side) => {
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x3a7aff }),
      );
      light.position.set(taxiOffset + side * (taxiWidth / 2 + 0.8), 0.4, z);
      group.add(light);
    });
  }

  // Secondary parallel taxiway on the opposite side, shorter (for GA / overflow).
  const taxi2Offset = -(widM / 2 + 70);
  const secondaryTaxi = new THREE.Mesh(new THREE.PlaneGeometry(18, lenM * 0.7), taxiMat);
  secondaryTaxi.rotation.x = -Math.PI / 2;
  secondaryTaxi.position.set(taxi2Offset, 0.02, -lenM * 0.5);
  group.add(secondaryTaxi);
  paint(0.4, lenM * 0.7 - 20, yellowLine, taxi2Offset, -lenM * 0.5, 0.05);

  // ================= Rapid-exit taxiways =================
  // Realistic airports have several angled rapid-exit taxiways. We build them
  // at 30° off the runway heading with proper yellow centerlines and red/white
  // "hold-short" bars where they meet the runway.
  const exitCount = Math.max(4, Math.floor(lenM / 450));
  for (let i = 0; i < exitCount; i += 1) {
    const z = -((i + 0.6) * lenM) / exitCount;
    const angled = i % 2 === 0;
    const stubW = 21;
    const stubLen = taxiOffset - widM / 2 - 6;
    const stub = new THREE.Mesh(new THREE.PlaneGeometry(stubLen, stubW), taxiMat);
    stub.rotation.x = -Math.PI / 2;
    if (angled) stub.rotation.z = Math.PI / 9; // ~20° angled rapid exit
    stub.position.set(widM / 2 + 6 + stubLen / 2, 0.019, z);
    group.add(stub);
    // Yellow centerline
    const sline = new THREE.Mesh(
      new THREE.PlaneGeometry(stubLen - 8, 0.4),
      yellowLine,
    );
    sline.rotation.x = -Math.PI / 2;
    if (angled) sline.rotation.z = Math.PI / 9;
    sline.position.set(widM / 2 + 6 + stubLen / 2, 0.05, z);
    group.add(sline);
    // Hold-short: 4 solid yellow bars across the exit just before the runway.
    for (let b = 0; b < 4; b += 1) {
      const bar = new THREE.Mesh(
        new THREE.PlaneGeometry(stubW * 0.9, 0.35),
        b < 2 ? yellowLine : yellowLine,
      );
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(widM / 2 + 8 + b * 1.2, 0.06, z);
      group.add(bar);
    }
  }

  // ================= Runway threshold markings =================
  // Large white arrows on the approach apron just before the runway end
  // (other end of runway, Z = -lenM). Plus blast-pad chevrons (red).
  const blastPad = new THREE.Mesh(
    new THREE.PlaneGeometry(widM, 80),
    new THREE.MeshStandardMaterial({ color: 0x3a2a28, roughness: 1 }),
  );
  blastPad.rotation.x = -Math.PI / 2;
  blastPad.position.set(0, 0.014, -lenM - 40);
  group.add(blastPad);
  for (let i = 0; i < 6; i += 1) {
    const chev = new THREE.Mesh(new THREE.PlaneGeometry(widM * 0.8, 0.8), redLine);
    chev.rotation.x = -Math.PI / 2;
    chev.position.set(0, 0.04, -lenM - 10 - i * 8);
    group.add(chev);
  }
  // Approach-end piano-key bars on the far threshold too (symmetric look).
  for (let i = -6; i <= 6; i += 1) {
    if (i === 0) continue;
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 8), whiteLine);
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(i * 2.8, 0.05, -lenM + 5);
    group.add(bar);
  }

  // ================= Apron with gate markings =================
  const apronX = taxiOffset + taxiWidth / 2 + 100;
  const apronW = 190;
  const apronD = Math.min(lenM * 0.75, 2000);
  const apronZ = -lenM / 2;
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(apronW, apronD), apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(apronX, 0.019, apronZ);
  group.add(apron);
  // Gate lead-in lines (curved yellow lines from taxi edge to each gate)
  const gateCount = Math.max(6, Math.floor(apronD / 100));
  for (let g = 0; g < gateCount; g += 1) {
    const gz = apronZ - apronD / 2 + (g + 0.5) * (apronD / gateCount);
    // Straight yellow lead-in line from taxi to gate stop bar.
    const lead = new THREE.Mesh(
      new THREE.PlaneGeometry(apronW * 0.75, 0.35),
      yellowLine,
    );
    lead.rotation.x = -Math.PI / 2;
    lead.position.set(apronX - apronW * 0.1, 0.05, gz);
    group.add(lead);
    // Red stop bar
    const stop = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.45), redLine);
    stop.rotation.x = -Math.PI / 2;
    stop.position.set(apronX + apronW / 2 - 58, 0.06, gz);
    group.add(stop);
    // Gate circle safety marking
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.0, 3.4, 24),
      whiteLine,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(apronX + apronW / 2 - 55, 0.05, gz);
    group.add(ring);
  }

  // ================= Terminal building =================
  const termW = 48;
  const termLen = Math.min(apronD * 0.8, 1000);
  const termH = 22;
  const termX = apronX + apronW / 2 + termW / 2 + 10;
  // Main terminal body (light concrete)
  const terminalBody = new THREE.Mesh(
    new THREE.BoxGeometry(termW, termH, termLen),
    new THREE.MeshStandardMaterial({ color: 0xdee3ec, roughness: 0.7, metalness: 0.2 }),
  );
  terminalBody.position.set(termX, termH / 2 - 1.5, apronZ);
  group.add(terminalBody);
  // Full-height glass facade toward the apron
  const facade = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, termH - 2, termLen * 0.98),
    glassMat,
  );
  facade.position.set(termX - termW / 2 - 0.1, (termH - 2) / 2 - 1.5, apronZ);
  group.add(facade);
  // Curved steel roof overhang (big airports have this distinctive look)
  const overhang = new THREE.Mesh(
    new THREE.BoxGeometry(termW + 16, 0.5, termLen + 6),
    terminalSteelMat,
  );
  overhang.position.set(termX - 6, termH - 1.5 + 0.25, apronZ);
  group.add(overhang);
  // Support columns for the overhang on the apron side
  for (let i = 0; i < 6; i += 1) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, termH + 1, 10),
      terminalSteelMat,
    );
    col.position.set(
      termX - termW / 2 - 9,
      (termH + 1) / 2 - 1.5,
      apronZ - termLen / 2 + (i + 0.5) * (termLen / 6),
    );
    group.add(col);
  }
  // Warm interior window bands on the landside (opposite apron)
  for (let row = 0; row < 3; row += 1) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 2.8, termLen * 0.95),
      warmWindowMat,
    );
    band.position.set(termX + termW / 2 + 0.1, 3 + row * 6, apronZ);
    group.add(band);
  }
  // Pier satellites (two smaller concourses branching from the terminal)
  [-1, 1].forEach((side) => {
    const pierW = 24;
    const pierLen = 160;
    const pierH = 12;
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(pierLen, pierH, pierW),
      new THREE.MeshStandardMaterial({ color: 0xc8cfda, roughness: 0.75, metalness: 0.2 }),
    );
    pier.position.set(termX - pierLen / 2 + termW / 2, pierH / 2 - 1.5, apronZ + side * (termLen / 2 + pierW / 2 + 10));
    group.add(pier);
    // Glass band
    const pierGlass = new THREE.Mesh(
      new THREE.BoxGeometry(pierLen * 0.95, pierH - 4, 0.5),
      glassMat,
    );
    pierGlass.position.set(
      termX - pierLen / 2 + termW / 2,
      (pierH - 4) / 2 - 1.5 + 1,
      apronZ + side * (termLen / 2 + pierW + 10) - side * 0.2,
    );
    group.add(pierGlass);
  });

  // ================= Realistic jet bridges =================
  // A jet bridge has: rotunda at the terminal, an extending tunnel, a
  // cabin head that docks at the aircraft door, supported by a tall
  // drive column with wheels on the apron.
  const bridgeCount = Math.max(5, Math.floor(termLen / 120));
  for (let i = 0; i < bridgeCount; i += 1) {
    const bz = apronZ - termLen / 2 + ((i + 0.5) * termLen) / bridgeCount;
    buildJetBridge(group, termX - termW / 2 - 2, 4.5, bz, 52);
    // Parked airliner at the gate
    buildParkedAirliner(group, termX - termW / 2 - 85, bz, i % 3);
    // Gate number sign (small box with glowing digits, facing the apron)
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2, 0.4),
      new THREE.MeshStandardMaterial({
        color: 0x10141c,
        emissive: 0xffcf68,
        emissiveIntensity: 1.1,
        roughness: 0.4,
      }),
    );
    sign.position.set(termX - termW / 2 - 4, termH + 1, bz);
    group.add(sign);
  }

  // ================= Control tower =================
  const towerX = apronX - 60;
  const towerZ = apronZ + apronD / 2 + 90;
  const towerH = 48;
  // Tapered concrete shaft
  const towerShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 5.5, towerH, 20),
    towerBaseMat,
  );
  towerShaft.position.set(towerX, towerH / 2 - 1.5, towerZ);
  group.add(towerShaft);
  // Support fins (three vertical ribs) for realism
  for (let r = 0; r < 3; r += 1) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, towerH, 2),
      towerBaseMat,
    );
    fin.rotation.y = (r / 3) * Math.PI * 2;
    fin.position.set(
      towerX + Math.cos((r / 3) * Math.PI * 2) * 4.2,
      towerH / 2 - 1.5,
      towerZ + Math.sin((r / 3) * Math.PI * 2) * 4.2,
    );
    group.add(fin);
  }
  // Cab base ring (concrete)
  const cabRing = new THREE.Mesh(
    new THREE.CylinderGeometry(7.5, 7, 1.2, 20),
    towerBaseMat,
  );
  cabRing.position.set(towerX, towerH - 1.5 + 0.6, towerZ);
  group.add(cabRing);
  // Glass cab (slanted outward - classic tower look via cone)
  const cab = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 7, 4.5, 20),
    glassMat,
  );
  cab.position.set(towerX, towerH - 1.5 + 3.4, towerZ);
  group.add(cab);
  // Roof
  const cabRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(8.4, 8.4, 0.7, 20),
    new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 }),
  );
  cabRoof.position.set(towerX, towerH - 1.5 + 6, towerZ);
  group.add(cabRoof);
  // Antenna mast
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xd0d4dc, roughness: 0.5, metalness: 0.7 }),
  );
  mast.position.set(towerX, towerH - 1.5 + 10, towerZ);
  group.add(mast);
  // Red obstruction beacon
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  );
  beacon.position.set(towerX, towerH - 1.5 + 14, towerZ);
  group.add(beacon);

  // ================= Hangars =================
  const hangarCount = 4;
  const hangarZStart = apronZ - apronD / 2 - 80;
  for (let i = 0; i < hangarCount; i += 1) {
    const hx = apronX - 60 + i * 78;
    const hz = hangarZStart - 60;
    const hW = 60;
    const hH = 16;
    const hD = 75;
    // Hangar box
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(hW, hH, hD), hangarMat);
    hangar.position.set(hx, hH / 2 - 1.5, hz);
    group.add(hangar);
    // Arched corrugated roof
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(hW / 2, hW / 2, hD, 20, 1, false, 0, Math.PI),
      hangarRoofMat,
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.set(hx, hH - 1.5, hz);
    group.add(roof);
    // Large sliding door (dark gray with vertical panel lines)
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(hW * 0.85, hH * 0.9),
      new THREE.MeshStandardMaterial({ color: 0x1f2430, roughness: 0.9 }),
    );
    door.position.set(hx, hH / 2 - 1.5 - 0.8, hz - hD / 2 - 0.05);
    group.add(door);
    // Door panel divider lines
    for (let p = 1; p < 6; p += 1) {
      const ln = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, hH * 0.85),
        new THREE.MeshBasicMaterial({ color: 0x3a4050 }),
      );
      ln.position.set(hx - hW * 0.42 + p * (hW * 0.85 / 6), hH / 2 - 1.5 - 0.8, hz - hD / 2 - 0.04);
      group.add(ln);
    }
    // Airline logo panel above door
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 2.2),
      new THREE.MeshStandardMaterial({
        color: 0x0a1220,
        emissive: 0xe84a4a,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      }),
    );
    logo.position.set(hx, hH - 1.5 - 1.5, hz - hD / 2 - 0.05);
    group.add(logo);
  }

  // ================= Fuel farm =================
  const fuelX = apronX + apronW / 2 + 140;
  const fuelZ = apronZ + apronD / 2 - 120;
  // Secure fence
  for (let i = 0; i < 10; i += 1) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2, 6),
      concreteMat,
    );
    post.position.set(fuelX - 15 + i * 7, 0, fuelZ - 25);
    group.add(post);
  }
  for (let i = 0; i < 6; i += 1) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 11, 24), tankMat);
    tank.position.set(fuelX + col * 24, 4, fuelZ + row * 24);
    group.add(tank);
    // Stripe band
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(9.05, 9.05, 1.2, 24),
      new THREE.MeshStandardMaterial({ color: 0xc0404a, roughness: 0.7 }),
    );
    band.position.set(fuelX + col * 24, 2.5, fuelZ + row * 24);
    group.add(band);
    // Catwalk ring on top
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(9.3, 9.3, 0.3, 24),
      new THREE.MeshStandardMaterial({ color: 0x9aa0ac, roughness: 0.7, metalness: 0.5 }),
    );
    top.position.set(fuelX + col * 24, 9.7, fuelZ + row * 24);
    group.add(top);
  }

  // ================= Parking lot with cars =================
  const lotX = termX + termW / 2 + 45;
  const lotZ = apronZ;
  const lotW = 90;
  const lotD = Math.min(termLen, 550);
  const lot = new THREE.Mesh(
    new THREE.PlaneGeometry(lotW, lotD),
    new THREE.MeshStandardMaterial({ color: 0x1f232b, roughness: 1 }),
  );
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(lotX, 0.016, lotZ);
  group.add(lot);
  // Lot stripes (yellow)
  for (let r = 0; r < 7; r += 1) {
    const stripeRow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, lotD * 0.9),
      yellowLine,
    );
    stripeRow.rotation.x = -Math.PI / 2;
    stripeRow.position.set(lotX - lotW / 2 + 5 + r * 13, 0.04, lotZ);
    group.add(stripeRow);
  }
  // Cars
  const carGeo = new THREE.BoxGeometry(1.9, 1.4, 4.0);
  const carTopGeo = new THREE.BoxGeometry(1.7, 0.9, 2.4);
  for (let row = 0; row < 7; row += 1) {
    for (let c = 0; c < Math.floor(lotD / 5); c += 1) {
      if (Math.random() > 0.75) continue;
      const color = carColors[Math.floor(Math.random() * carColors.length)];
      const body = new THREE.Mesh(
        carGeo,
        new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.45 }),
      );
      body.position.set(lotX - lotW / 2 + 8 + row * 12, 0.2, lotZ - lotD / 2 + 3 + c * 5);
      group.add(body);
      const top = new THREE.Mesh(
        carTopGeo,
        new THREE.MeshStandardMaterial({ color: color * 0x999999, roughness: 0.4, metalness: 0.5 }),
      );
      top.position.set(body.position.x, 1.25, body.position.z - 0.3);
      group.add(top);
    }
  }

  // Light poles over the parking lot
  for (let i = 0; i < 8; i += 1) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x6a7080, roughness: 0.8 }),
    );
    pole.position.set(lotX, 3.5, lotZ - lotD / 2 + (i + 0.5) * (lotD / 8));
    group.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.4, 1),
      new THREE.MeshStandardMaterial({
        color: 0x10141c,
        emissive: 0xfff0c0,
        emissiveIntensity: 1.5,
        roughness: 0.3,
      }),
    );
    lamp.position.set(lotX, 8.5, lotZ - lotD / 2 + (i + 0.5) * (lotD / 8));
    group.add(lamp);
  }

  // ================= Service roads =================
  const serviceRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(6, apronD + 250),
    new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 1 }),
  );
  serviceRoad.rotation.x = -Math.PI / 2;
  serviceRoad.position.set(apronX - apronW / 2 - 15, 0.017, apronZ);
  group.add(serviceRoad);
  // Dashed center line on the service road
  for (let z = apronZ - apronD / 2; z < apronZ + apronD / 2; z += 6) {
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 2.5),
      whiteLine,
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(apronX - apronW / 2 - 15, 0.04, z);
    group.add(dash);
  }

  // ================= Ground service vehicles scattered on apron =================
  for (let i = 0; i < 18; i += 1) {
    const vx = apronX - apronW / 2 + 20 + Math.random() * (apronW - 60);
    const vz = apronZ - apronD / 2 + 20 + Math.random() * (apronD - 40);
    const type = Math.floor(Math.random() * 3);
    if (type === 0) buildTug(group, vx, vz);
    else if (type === 1) buildBaggageCart(group, vx, vz);
    else buildFuelTruck(group, vx, vz);
  }

  // ================= GA side (opposite) =================
  const gaX = -(widM / 2 + 150);
  const gaApron = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 450),
    apronMat,
  );
  gaApron.rotation.x = -Math.PI / 2;
  gaApron.position.set(gaX, 0.019, -lenM * 0.28);
  group.add(gaApron);
  for (let i = 0; i < 3; i += 1) {
    const hx = gaX - 70;
    const hz = -lenM * 0.28 - 180 + i * 130;
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(34, 9, 40), hangarMat);
    hangar.position.set(hx, 4.5 - 1.5, hz);
    group.add(hangar);
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(17, 17, 40, 14, 1, false, 0, Math.PI),
      hangarRoofMat,
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.set(hx, 9 - 1.5, hz);
    group.add(roof);
    // Small GA planes parked in a row on the apron
    for (let j = 0; j < 5; j += 1) {
      buildSmallParkedPlane(group, gaX + 15 + j * 18, hz + ((j % 2) - 0.5) * 6);
    }
  }

  // ================= Airfield perimeter fence (subtle) =================
  // A thin dark strip + posts running around the airport outskirts.
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x1a1e25, roughness: 0.9 });
  const fenceSegments = [
    { x: apronX + 280, z: apronZ, w: 2, d: apronD + 400 },
    { x: apronX - 40, z: apronZ + apronD / 2 + 160, w: 640, d: 2 },
    { x: apronX - 40, z: apronZ - apronD / 2 - 160, w: 640, d: 2 },
    { x: gaX - 140, z: -lenM * 0.28, w: 2, d: 700 },
  ];
  fenceSegments.forEach((f) => {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(f.w, 2.2, f.d), fenceMat);
    fence.position.set(f.x, -0.4, f.z);
    group.add(fence);
  });

  return group;
}

// ===============================================================
// Helper builders
// ===============================================================

// Jet bridge: rotunda + extendable tunnel + cabin head + support column.
function buildJetBridge(parent, rotundaX, baseY, z, length) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xa0a8b8, roughness: 0.6, metalness: 0.35 });
  const windowStripMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f1a,
    emissive: 0xffd68a,
    emissiveIntensity: 0.9,
    roughness: 0.3,
  });
  // Rotunda at the terminal
  const rotunda = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 3.6, 14),
    bodyMat,
  );
  rotunda.position.set(rotundaX, baseY, z);
  parent.add(rotunda);
  // Tunnel (long box extending toward the parked aircraft)
  const tunnel = new THREE.Mesh(
    new THREE.BoxGeometry(length, 3.2, 3),
    bodyMat,
  );
  tunnel.position.set(rotundaX - length / 2 - 1, baseY, z);
  parent.add(tunnel);
  // Window strip along the tunnel (both sides)
  [-1, 1].forEach((side) => {
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(length * 0.9, 1, 0.1),
      windowStripMat,
    );
    win.position.set(rotundaX - length / 2 - 1, baseY + 0.3, z + side * 1.55);
    parent.add(win);
  });
  // Cabin head (docking bulb at the end)
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 3.8, 4),
    bodyMat,
  );
  head.position.set(rotundaX - length - 2.5, baseY, z);
  parent.add(head);
  // Drive column under the head, with wheel base
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, baseY + 1.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x5a6070, roughness: 0.7 }),
  );
  column.position.set(rotundaX - length - 2.5, (baseY - 1.5) / 2 - 0.75, z);
  parent.add(column);
  const wheelBase = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.4, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x3a4050, roughness: 0.8 }),
  );
  wheelBase.position.set(rotundaX - length - 2.5, -1.1, z);
  parent.add(wheelBase);
  // Wheels
  [-1, 1].forEach((side) => {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0x15181e, roughness: 0.9 }),
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(rotundaX - length - 2.5 + side * 1.3, -1.1, z);
    parent.add(wheel);
  });
}

// Parked airliner at the gate. Three liveries (0/1/2) for visual variety.
function buildParkedAirliner(parent, x, z, liveryIdx = 0) {
  const liveries = [
    { body: 0xe8ecf1, tail: 0x2a4a8a }, // blue
    { body: 0xeff1f6, tail: 0xc0404a }, // red
    { body: 0xfafbfc, tail: 0x2a8a4a }, // green
  ];
  const l = liveries[liveryIdx % liveries.length];
  const bodyMat = new THREE.MeshStandardMaterial({ color: l.body, roughness: 0.45, metalness: 0.55 });
  const accentMat = new THREE.MeshStandardMaterial({ color: l.tail, roughness: 0.5, metalness: 0.3 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1a, roughness: 0.3, metalness: 0.3 });
  const engMat = new THREE.MeshStandardMaterial({ color: 0xbac0c8, roughness: 0.5, metalness: 0.7 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x15181e, roughness: 0.9 });

  // Fuselage
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 34, 18), bodyMat);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.position.set(x, 3.3, z);
  parent.add(fuselage);
  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.0, 4.5, 18), bodyMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(x - 19, 3.3, z);
  parent.add(nose);
  // Tail cone
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(2.0, 4, 18), bodyMat);
  tailCone.rotation.z = Math.PI / 2;
  tailCone.position.set(x + 19, 3.3, z);
  parent.add(tailCone);
  // Cabin windows (two dark strips)
  [-1, 1].forEach((side) => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(26, 0.25, 0.05), windowMat);
    win.position.set(x, 3.6, z + side * 1.95);
    parent.add(win);
  });
  // Wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(7, 0.45, 32), bodyMat);
  wing.position.set(x + 2, 2.5, z);
  parent.add(wing);
  // Winglets
  [-1, 1].forEach((side) => {
    const wl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.2), bodyMat);
    wl.position.set(x + 2, 3.2, z + side * 15.8);
    wl.rotation.x = side * 0.4;
    parent.add(wl);
  });
  // Vertical stabilizer (tail with accent color)
  const vtail = new THREE.Mesh(new THREE.BoxGeometry(4.5, 5.5, 0.4), accentMat);
  vtail.position.set(x + 14, 6.8, z);
  parent.add(vtail);
  // Horizontal stabilizer
  const htail = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 10), bodyMat);
  htail.position.set(x + 14.5, 5.4, z);
  parent.add(htail);
  // Under-wing engines
  [-7, 7].forEach((zOff) => {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 4.5, 16), engMat);
    eng.rotation.z = Math.PI / 2;
    eng.position.set(x + 1, 1.6, z + zOff);
    parent.add(eng);
    // Engine intake fan (dark)
    const fan = new THREE.Mesh(
      new THREE.CircleGeometry(1.05, 16),
      new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.5 }),
    );
    fan.rotation.y = Math.PI / 2;
    fan.position.set(x - 1.3, 1.6, z + zOff);
    parent.add(fan);
  });
  // Landing gear (nose + two main)
  const gearPositions = [
    { gx: x - 13, gz: z, tires: 2 },
    { gx: x + 4, gz: z - 3.5, tires: 4 },
    { gx: x + 4, gz: z + 3.5, tires: 4 },
  ];
  gearPositions.forEach((g) => {
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 2, 6),
      engMat,
    );
    strut.position.set(g.gx, 1.3, g.gz);
    parent.add(strut);
    for (let t = 0; t < g.tires; t += 1) {
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.7, 0.35, 12),
        tireMat,
      );
      tire.rotation.z = Math.PI / 2;
      tire.position.set(g.gx + (t - (g.tires - 1) / 2) * 0.5, 0.3, g.gz);
      parent.add(tire);
    }
  });
}

// GA light aircraft silhouette.
function buildSmallParkedPlane(parent, x, z) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xeef0f4, roughness: 0.55, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3a6a, roughness: 0.6 });
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 7.2, 10), mat);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.position.set(x, 1.2, z);
  parent.add(fuselage);
  // High wing
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 10), mat);
  wing.position.set(x, 1.8, z);
  parent.add(wing);
  // Tail
  const vtail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.08), mat);
  vtail.position.set(x + 3.2, 2, z);
  parent.add(vtail);
  const htail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 3.2), mat);
  htail.position.set(x + 3.2, 1.5, z);
  parent.add(htail);
  // Prop spinner
  const spin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 10), dark);
  spin.rotation.z = -Math.PI / 2;
  spin.position.set(x - 3.8, 1.2, z);
  parent.add(spin);
  // Tires
  [-1, 1].forEach((side) => {
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.15, 10),
      new THREE.MeshStandardMaterial({ color: 0x15181e, roughness: 0.9 }),
    );
    tire.rotation.z = Math.PI / 2;
    tire.position.set(x, 0.1, z + side * 0.8);
    parent.add(tire);
  });
}

// Airport tug (small pushback tractor).
function buildTug(parent, x, z) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xf2c542, roughness: 0.6, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 4.5), mat);
  body.position.set(x, 0.5, z);
  parent.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 1.8), dark);
  cab.position.set(x, 1.7, z + 0.6);
  parent.add(cab);
}

// Baggage cart train (locomotive + 2 trailers).
function buildBaggageCart(parent, x, z) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xd0d4dc, roughness: 0.7, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a4050, roughness: 0.8 });
  for (let i = 0; i < 3; i += 1) {
    const cart = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.6, 3), mat);
    cart.position.set(x, 0.8, z + i * 3.5);
    parent.add(cart);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 3.1), dark);
    roof.position.set(x, 1.7, z + i * 3.5);
    parent.add(roof);
  }
}

// Fuel truck.
function buildFuelTruck(parent, x, z) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xe0e4ea, roughness: 0.6, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.8 });
  // Cab
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 2.8), mat);
  cab.position.set(x, 1.1, z);
  parent.add(cab);
  // Tank (cylinder)
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 6, 14), mat);
  tank.rotation.z = Math.PI / 2;
  tank.position.set(x, 1.5, z + 4.5);
  parent.add(tank);
  // Red stripe on tank
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(1.42, 1.42, 0.6, 14),
    new THREE.MeshStandardMaterial({ color: 0xc0404a, roughness: 0.7 }),
  );
  stripe.rotation.z = Math.PI / 2;
  stripe.position.set(x, 1.5, z + 4.5);
  parent.add(stripe);
  // Bumper
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 0.2), dark);
  bumper.position.set(x, 0.3, z - 1.4);
  parent.add(bumper);
}