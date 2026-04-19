import * as THREE from 'three';

// Realistic airport detail props: ground service vehicles, jet bridges,
// runway markings, approach lighting. Kept in a separate module so the
// main customAirportModel stays focused on layout.

// ------- GSE: pushback tug -------
function makePushbackTug(color = 0xf5d030) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.2, 1.6),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3 }),
  );
  body.position.y = 0.9;
  g.add(body);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.0, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x1a2942, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.7 }),
  );
  cab.position.set(-0.4, 2.0, 0);
  g.add(cab);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
  [[-1.0, -0.85], [1.0, -0.85], [-1.0, 0.85], [1.0, 0.85]].forEach(([x, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.4, z);
    g.add(w);
  });
  return g;
}

// ------- GSE: baggage cart train -------
function makeBaggageCart() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 1.2, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.8 }),
  );
  body.position.y = 0.9;
  g.add(body);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.1, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xc04030, roughness: 0.7 }),
  );
  roof.position.y = 1.55;
  g.add(roof);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
  [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(([x, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 10), wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.25, z);
    g.add(w);
  });
  return g;
}

// ------- GSE: fuel truck -------
function makeFuelTruck() {
  const g = new THREE.Group();
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 4.5, 16),
    new THREE.MeshStandardMaterial({ color: 0xe5e5e5, roughness: 0.5, metalness: 0.6 }),
  );
  tank.rotation.z = Math.PI / 2;
  tank.position.set(0.5, 1.5, 0);
  g.add(tank);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
  );
  cab.position.set(-2.5, 1.4, 0);
  g.add(cab);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.3, 2.05),
    new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.6 }),
  );
  stripe.position.set(0.5, 1.0, 0);
  g.add(stripe);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
  [[-2.5, -0.9], [-2.5, 0.9], [-0.5, -0.9], [-0.5, 0.9], [1.8, -0.9], [1.8, 0.9]].forEach(([x, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.45, z);
    g.add(w);
  });
  return g;
}

// ------- Jet bridge from terminal to parked aircraft -------
function makeJetBridge(length = 18) {
  const g = new THREE.Group();
  const tunnel = new THREE.Mesh(
    new THREE.BoxGeometry(length, 2.2, 2.8),
    new THREE.MeshStandardMaterial({ color: 0xd0d4dc, roughness: 0.4, metalness: 0.5 }),
  );
  tunnel.position.set(0, 3.5, 0);
  g.add(tunnel);
  // Window strip on side
  const windows = new THREE.Mesh(
    new THREE.BoxGeometry(length * 0.9, 0.6, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1a2942, emissive: 0x6a90b8, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.5 }),
  );
  windows.position.set(0, 3.7, 1.42);
  g.add(windows);
  // Support pillars
  for (let i = 0; i < 3; i += 1) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 3.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x808890, roughness: 0.6, metalness: 0.7 }),
    );
    pillar.position.set(-length / 2 + (i + 0.5) * (length / 3), 1.75, 0);
    g.add(pillar);
  }
  return g;
}

// ------- Runway threshold/touchdown markings on the runway surface -------
// Adds piano keys, threshold designator stripes, and TDZ marks to a runway.
export function addRunwayMarkings(parent, { runwayLenM, runwayWidthM = 45 }) {
  const paintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  // Piano keys at the landing threshold (north end, +Z direction visually)
  // The runway in the scene runs along Z. We paint markings at both ends.
  const halfLen = runwayLenM / 2;
  const halfWidth = runwayWidthM / 2;

  [-1, 1].forEach((endSign) => {
    const endZ = endSign * halfLen;
    // 8 piano keys (threshold bars)
    for (let i = 0; i < 8; i += 1) {
      const offset = -halfWidth + 2 + i * (halfWidth * 2 - 4) / 8;
      const key = new THREE.Mesh(
        new THREE.PlaneGeometry((halfWidth * 2 - 4) / 8 - 0.6, 25),
        paintMat,
      );
      key.rotation.x = -Math.PI / 2;
      key.position.set(
        offset + ((halfWidth * 2 - 4) / 8) / 2,
        0.06,
        endZ - endSign * (12.5 + 8),
      );
      parent.add(key);
    }
    // Touchdown zone markers (3 sets of double bars at 150m, 300m, 450m from threshold)
    [150, 300, 450].forEach((dist) => {
      [-1, 1].forEach((side) => {
        const tdz = new THREE.Mesh(
          new THREE.PlaneGeometry(2.5, 22),
          paintMat,
        );
        tdz.rotation.x = -Math.PI / 2;
        tdz.position.set(side * 4, 0.06, endZ - endSign * dist);
        parent.add(tdz);
      });
    });
    // Aiming point (large solid bar at ~300m)
    [-1, 1].forEach((side) => {
      const aim = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 50),
        paintMat,
      );
      aim.rotation.x = -Math.PI / 2;
      aim.position.set(side * 9, 0.06, endZ - endSign * 380);
      parent.add(aim);
    });
  });
}

// ------- Approach lighting system (PAPI + lead-in lights) -------
export function addApproachLights(parent, { runwayLenM }) {
  const halfLen = runwayLenM / 2;
  // PAPI: 4 lights to the left of the threshold
  for (let end = 0; end < 2; end += 1) {
    const endSign = end === 0 ? 1 : -1;
    for (let i = 0; i < 4; i += 1) {
      const isWhite = i < 2;
      const papi = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 8, 8),
        new THREE.MeshBasicMaterial({ color: isWhite ? 0xffffff : 0xff4030 }),
      );
      papi.position.set(-30, 0.5, endSign * (halfLen - 50) - i * 3);
      parent.add(papi);
    }
    // Lead-in approach lights extending out from threshold
    for (let i = 1; i <= 15; i += 1) {
      const lite = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffe0 }),
      );
      lite.position.set(0, 0.4, endSign * (halfLen + i * 30));
      parent.add(lite);
      // Crossbar at every 5th
      if (i % 5 === 0) {
        for (let xOff = -15; xOff <= 15; xOff += 5) {
          if (xOff === 0) continue;
          const cross = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xffffe0 }),
          );
          cross.position.set(xOff, 0.4, endSign * (halfLen + i * 30));
          parent.add(cross);
        }
      }
    }
    // Threshold lights (green bar)
    for (let xOff = -22; xOff <= 22; xOff += 4) {
      const thr = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x30ff60 }),
      );
      thr.position.set(xOff, 0.4, endSign * halfLen);
      parent.add(thr);
    }
    // Runway end lights (red bar)
    for (let xOff = -22; xOff <= 22; xOff += 4) {
      const re = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff3030 }),
      );
      re.position.set(xOff, 0.4, endSign * (halfLen + 1));
      parent.add(re);
    }
  }
}

// ------- Apron windsock -------
function makeWindsock() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.15, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.7 }),
  );
  pole.position.y = 4;
  g.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 2.5, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xff7020, roughness: 0.9, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2 + 0.3;
  sock.position.set(1.5, 7.8, 0);
  g.add(sock);
  return g;
}

// ------- Place ground service equipment near each gate -------
export function addGroundServiceEquipment(parent, { apronX, apronW, gatePositions }) {
  const tugColors = [0xf5d030, 0xf04030, 0x4080f0, 0xf5d030];
  gatePositions.forEach((gz, idx) => {
    // Pushback tug parked behind the aircraft
    const tug = makePushbackTug(tugColors[idx % tugColors.length]);
    tug.position.set(apronX - 90, -1.4, gz - 4);
    tug.rotation.y = Math.PI / 2;
    parent.add(tug);
    // Baggage cart train (3 carts)
    for (let i = 0; i < 3; i += 1) {
      const cart = makeBaggageCart();
      cart.position.set(apronX - 60 + i * 2.5, -1.4, gz + 6);
      cart.rotation.y = Math.PI / 2;
      parent.add(cart);
    }
    // Fuel truck on every 3rd gate
    if (idx % 3 === 0) {
      const ft = makeFuelTruck();
      ft.position.set(apronX - 80, -1.4, gz + 10);
      ft.rotation.y = Math.PI / 2;
      parent.add(ft);
    }
  });

  // Windsock at edge of apron
  const ws = makeWindsock();
  ws.position.set(apronX + apronW / 2 - 5, -1.4, 100);
  parent.add(ws);
}

// ------- Add jet bridges connecting terminal to each parked aircraft -------
export function addJetBridges(parent, { termX, gatePositions }) {
  gatePositions.forEach((gz) => {
    const bridge = makeJetBridge(22);
    bridge.position.set(termX - 50, 0, gz);
    parent.add(bridge);
  });
}