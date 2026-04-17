import * as THREE from 'three';

// Realistic materials - brushed aluminum look without the plasticky glow.
function makeMaterials() {
  return {
    fuselage: new THREE.MeshStandardMaterial({
      color: 0xe8ecf1, roughness: 0.45, metalness: 0.65,
    }),
    wing: new THREE.MeshStandardMaterial({
      color: 0xdde2e8, roughness: 0.5, metalness: 0.6,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: 0x1e4a8c, roughness: 0.4, metalness: 0.5,
    }),
    belly: new THREE.MeshStandardMaterial({
      color: 0x94a3b8, roughness: 0.55, metalness: 0.55,
    }),
    window: new THREE.MeshStandardMaterial({
      color: 0x0b1220, roughness: 0.15, metalness: 0.3,
    }),
    cockpitGlass: new THREE.MeshStandardMaterial({
      color: 0x1a2942, roughness: 0.08, metalness: 0.2,
      transparent: true, opacity: 0.85,
    }),
    engineDark: new THREE.MeshStandardMaterial({
      color: 0x3b4451, roughness: 0.6, metalness: 0.7,
    }),
    engineCowl: new THREE.MeshStandardMaterial({
      color: 0xd5dae1, roughness: 0.4, metalness: 0.75,
    }),
    tire: new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, roughness: 0.9, metalness: 0.1,
    }),
    prop: new THREE.MeshStandardMaterial({
      color: 0x111418, roughness: 0.6, metalness: 0.4,
    }),
  };
}

// Lathe-based fuselage: smooth tapered body with rounded nose and pointed tail.
function makeFuselage(radius, length, mat) {
  const halfLen = length / 2;
  // Profile points from nose to tail (x = along fuselage, y = radius).
  const pts = [
    new THREE.Vector2(0.0, halfLen + radius * 0.9),       // nose tip
    new THREE.Vector2(radius * 0.35, halfLen + radius * 0.6),
    new THREE.Vector2(radius * 0.7, halfLen + radius * 0.25),
    new THREE.Vector2(radius * 0.92, halfLen),             // nose-body blend
    new THREE.Vector2(radius, halfLen - radius * 0.5),     // constant section
    new THREE.Vector2(radius, -halfLen * 0.55),
    new THREE.Vector2(radius * 0.85, -halfLen * 0.85),
    new THREE.Vector2(radius * 0.5, -halfLen - radius * 0.4),
    new THREE.Vector2(radius * 0.2, -halfLen - radius * 0.9),
    new THREE.Vector2(0.0, -halfLen - radius * 1.1),       // tail tip
  ];
  const geo = new THREE.LatheGeometry(pts, 28);
  const mesh = new THREE.Mesh(geo, mat);
  // Lathe spins around Y; rotate so length lies along X.
  mesh.rotation.z = -Math.PI / 2;
  return mesh;
}

// Swept wing panel using ShapeGeometry - one per side, with dihedral.
function makeSweptWing(mat, { rootChord, tipChord, halfSpan, sweep, thickness = 0.12, dihedral = 0.04 }) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(rootChord, 0);
  shape.lineTo(rootChord - sweep * 0.6, halfSpan);
  shape.lineTo(rootChord - sweep - tipChord * 0.2, halfSpan);
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true, bevelSize: thickness * 0.3,
    bevelThickness: thickness * 0.3, bevelSegments: 2, steps: 1,
  });
  // Center on leading edge root; flatten to XZ plane.
  geo.rotateX(-Math.PI / 2);
  geo.translate(-rootChord * 0.3, -thickness / 2, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = dihedral; // slight upward dihedral
  return mesh;
}

// Realistic jet engine nacelle with intake lip, fan, and exhaust.
function makeJetEngine(mats, { radius, length }) {
  const group = new THREE.Group();
  // Main cowling - slightly tapered
  const cowl = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.88, length, 22),
    mats.engineCowl,
  );
  cowl.rotation.z = Math.PI / 2;
  group.add(cowl);
  // Intake lip (chrome ring at front)
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.02, radius * 0.08, 10, 24),
    mats.engineCowl,
  );
  lip.rotation.y = Math.PI / 2;
  lip.position.x = length / 2;
  group.add(lip);
  // Dark fan disk recessed into intake
  const fan = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.92, 24),
    mats.window,
  );
  fan.rotation.y = -Math.PI / 2;
  fan.position.x = length / 2 - 0.04;
  group.add(fan);
  // Spinner cone
  const spinner = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.18, radius * 0.6, 12),
    mats.engineDark,
  );
  spinner.rotation.z = -Math.PI / 2;
  spinner.position.x = length / 2 - radius * 0.15;
  group.add(spinner);
  // Exhaust nozzle
  const exhaust = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.7, radius * 0.55, length * 0.25, 18),
    mats.engineDark,
  );
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.x = -length / 2 - length * 0.1;
  group.add(exhaust);
  return group;
}

// Propeller assembly - spinner + 3 blades.
function makePropeller(mats, { radius, bladeCount = 3 }) {
  const group = new THREE.Group();
  const spinner = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.18, radius * 0.55, 14),
    mats.engineCowl,
  );
  spinner.rotation.z = -Math.PI / 2;
  group.add(spinner);
  for (let i = 0; i < bladeCount; i += 1) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, radius * 1.8, 0.25),
      mats.prop,
    );
    const angle = (i / bladeCount) * Math.PI * 2;
    blade.position.set(0, 0, 0);
    blade.rotation.x = angle;
    blade.rotation.y = 0.3; // pitch
    group.add(blade);
  }
  return group;
}

// Nav lights + strobe.
function addNavLights(group, wingTipZ, tailX, strobeY) {
  const red = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }),
  );
  red.position.set(0, 0, -wingTipZ);
  group.add(red);
  const green = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x22ff22 }),
  );
  green.position.set(0, 0, wingTipZ);
  group.add(green);
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  );
  strobe.position.set(tailX, strobeY, 0);
  group.add(strobe);
  return strobe;
}

// --- Small single-engine propeller (Cessna 172-like) ---
function buildSmallProp(mats) {
  const g = new THREE.Group();
  const fusLen = 6.5;
  const fusR = 0.55;
  g.add(makeFuselage(fusR, fusLen, mats.fuselage));

  // High straight wing with dihedral
  [-1, 1].forEach((side) => {
    const w = makeSweptWing(mats.wing, {
      rootChord: 1.3, tipChord: 1.0, halfSpan: 5.5, sweep: 0.15, thickness: 0.12, dihedral: 0.05,
    });
    w.position.set(0.2, 1.0, 0);
    w.scale.z = side;
    g.add(w);
    // wing strut
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), mats.wing);
    strut.position.set(0.3, 0.35, side * 2.0);
    strut.rotation.x = side * 0.3;
    g.add(strut);
  });

  // Propeller at nose
  const prop = makePropeller(mats, { radius: 1.1, bladeCount: 2 });
  prop.position.set(fusLen / 2 + fusR * 0.9, 0, 0);
  g.add(prop);

  // Tail surfaces
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 3.0), mats.wing);
  hStab.position.set(-fusLen / 2 - 0.2, 0.3, 0);
  g.add(hStab);
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 0.08), mats.wing);
  vStab.position.set(-fusLen / 2 - 0.2, 0.9, 0);
  g.add(vStab);

  // Cockpit glass
  const cock = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.2),
    mats.cockpitGlass,
  );
  cock.rotation.z = -Math.PI / 2;
  cock.position.set(1.4, 0.55, 0);
  g.add(cock);

  // Fixed tricycle gear
  [-0.8, 0.8, 2.4].forEach((x, i) => {
    const wheelZ = i === 2 ? 0 : 1.2;
    const sides = i === 2 ? [0] : [-1, 1];
    sides.forEach((s) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.05), mats.engineDark);
      leg.position.set(x, -fusR - 0.35, s * wheelZ);
      g.add(leg);
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.08, 8, 14), mats.tire);
      tire.rotation.y = Math.PI / 2;
      tire.position.set(x, -fusR - 0.7, s * wheelZ);
      g.add(tire);
    });
  });

  const strobe = addNavLights(g, 5.2, -fusLen / 2 - 0.2, 1.5);
  g.scale.setScalar(1.6);
  return { group: g, strobe };
}

// --- Twin turboprop (Dash 8 Q400-like, T-tail) ---
function buildTurboprop(mats) {
  const g = new THREE.Group();
  const fusLen = 10;
  const fusR = 0.85;
  g.add(makeFuselage(fusR, fusLen, mats.fuselage));

  // High-mounted wings
  [-1, 1].forEach((side) => {
    const w = makeSweptWing(mats.wing, {
      rootChord: 2.2, tipChord: 1.1, halfSpan: 7.5, sweep: 0.4, thickness: 0.18, dihedral: 0.06,
    });
    w.position.set(-0.3, fusR * 0.9, 0);
    w.scale.z = side;
    g.add(w);
  });

  // Nacelles with turboprops
  [-3.3, 3.3].forEach((zOffset) => {
    const nacelle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.42, 2.6, 16),
      mats.engineCowl,
    );
    nacelle.rotation.z = Math.PI / 2;
    nacelle.position.set(0.4, fusR * 0.65, zOffset);
    g.add(nacelle);
    const prop = makePropeller(mats, { radius: 1.6, bladeCount: 6 });
    prop.position.set(1.9, fusR * 0.65, zOffset);
    g.add(prop);
  });

  // T-tail
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.6, 0.14), mats.wing);
  vStab.position.set(-fusLen / 2 - 0.3, 1.3, 0);
  vStab.rotation.z = -0.15;
  g.add(vStab);
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 4.5), mats.wing);
  hStab.position.set(-fusLen / 2 - 0.6, 2.55, 0);
  g.add(hStab);

  // Cabin windows
  [-1, 1].forEach((side) => {
    const row = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.22, 0.03), mats.window);
    row.position.set(-0.2, fusR * 0.3, side * fusR * 0.95);
    g.add(row);
  });
  // Cockpit glass
  const cock = new THREE.Mesh(
    new THREE.SphereGeometry(fusR * 0.85, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.2),
    mats.cockpitGlass,
  );
  cock.rotation.z = -Math.PI / 2;
  cock.position.set(fusLen / 2 - 0.6, fusR * 0.25, 0);
  g.add(cock);

  const strobe = addNavLights(g, 7.5, -fusLen / 2 - 0.3, 2.6);
  g.scale.setScalar(1.55);
  return { group: g, strobe };
}

// --- Regional jet (CRJ/E-Jet-like) with rear-mounted engines ---
function buildRegionalJet(mats) {
  const g = new THREE.Group();
  const fusLen = 11;
  const fusR = 0.85;
  g.add(makeFuselage(fusR, fusLen, mats.fuselage));

  // Low-mounted swept wings
  [-1, 1].forEach((side) => {
    const w = makeSweptWing(mats.wing, {
      rootChord: 2.4, tipChord: 0.9, halfSpan: 6.5, sweep: 1.0, thickness: 0.16, dihedral: 0.08,
    });
    w.position.set(-0.5, -fusR * 0.5, 0);
    w.scale.z = side;
    g.add(w);
    // winglet
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.1), mats.wing);
    winglet.position.set(-1.4, -fusR * 0.1, side * 6.5);
    winglet.rotation.z = side * 0.3;
    g.add(winglet);
  });

  // Rear fuselage-mounted engines (distinctive RJ trait)
  [-1, 1].forEach((side) => {
    const eng = makeJetEngine(mats, { radius: 0.5, length: 2.0 });
    eng.position.set(-fusLen / 2 + 0.2, fusR * 0.2, side * (fusR + 0.7));
    g.add(eng);
    // Pylon between engine and fuselage
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.7), mats.fuselage);
    pylon.position.set(-fusLen / 2 + 0.2, fusR * 0.2, side * fusR * 0.9);
    g.add(pylon);
  });

  // T-tail
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 0.14), mats.wing);
  vStab.position.set(-fusLen / 2 - 0.5, 1.4, 0);
  vStab.rotation.z = -0.2;
  g.add(vStab);
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 3.8), mats.wing);
  hStab.position.set(-fusLen / 2 - 0.9, 2.75, 0);
  g.add(hStab);

  // Windows & cockpit
  [-1, 1].forEach((side) => {
    const row = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.2, 0.03), mats.window);
    row.position.set(-0.3, fusR * 0.3, side * fusR * 0.95);
    g.add(row);
  });
  const cock = new THREE.Mesh(
    new THREE.SphereGeometry(fusR * 0.82, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.2),
    mats.cockpitGlass,
  );
  cock.rotation.z = -Math.PI / 2;
  cock.position.set(fusLen / 2 - 0.4, fusR * 0.2, 0);
  g.add(cock);

  const strobe = addNavLights(g, 6.5, -fusLen / 2 - 0.5, 2.85);
  g.scale.setScalar(1.5);
  return { group: g, strobe };
}

// --- Narrow-body (A320/737-like) with underwing engines ---
function buildNarrowBody(mats) {
  const g = new THREE.Group();
  const fusLen = 13;
  const fusR = 1.05;
  g.add(makeFuselage(fusR, fusLen, mats.fuselage));

  // Low swept wings
  [-1, 1].forEach((side) => {
    const w = makeSweptWing(mats.wing, {
      rootChord: 3.4, tipChord: 1.1, halfSpan: 8.5, sweep: 1.6, thickness: 0.22, dihedral: 0.08,
    });
    w.position.set(-0.8, -fusR * 0.5, 0);
    w.scale.z = side;
    g.add(w);
    // sharklet / winglet
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.12), mats.wing);
    winglet.position.set(-2.0, 0.2, side * 8.5);
    winglet.rotation.z = side * 0.4;
    g.add(winglet);
  });

  // Underwing engines
  [-3.8, 3.8].forEach((zOffset) => {
    const eng = makeJetEngine(mats, { radius: 0.7, length: 2.6 });
    eng.position.set(0.6, -fusR * 0.95, zOffset);
    g.add(eng);
    // Pylon
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.25), mats.fuselage);
    pylon.position.set(0.3, -fusR * 0.55, zOffset);
    g.add(pylon);
  });

  // Tail
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.8, 0.18), mats.wing);
  vStab.position.set(-fusLen / 2 - 0.3, 1.4, 0);
  vStab.rotation.z = -0.2;
  g.add(vStab);
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 5.5), mats.wing);
  hStab.position.set(-fusLen / 2 - 0.1, 0.3, 0);
  g.add(hStab);

  // Windows (long row)
  [-1, 1].forEach((side) => {
    const row = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.24, 0.03), mats.window);
    row.position.set(-0.5, fusR * 0.35, side * fusR * 0.96);
    g.add(row);
  });
  // Cockpit
  const cock = new THREE.Mesh(
    new THREE.SphereGeometry(fusR * 0.85, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2.2),
    mats.cockpitGlass,
  );
  cock.rotation.z = -Math.PI / 2;
  cock.position.set(fusLen / 2 - 0.4, fusR * 0.25, 0);
  g.add(cock);
  // Livery cheat-line along cabin
  [-1, 1].forEach((side) => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 0.02), mats.accent);
    stripe.position.set(-0.3, -fusR * 0.05, side * fusR * 0.97);
    g.add(stripe);
  });

  const strobe = addNavLights(g, 8.5, -fusLen / 2 - 0.3, 2.85);
  g.scale.setScalar(1.35);
  return { group: g, strobe };
}

// --- Wide-body (B777/A350-like) with 2 huge underwing engines ---
function buildWideBody(mats) {
  const g = new THREE.Group();
  const fusLen = 18;
  const fusR = 1.55;
  g.add(makeFuselage(fusR, fusLen, mats.fuselage));

  // Big swept wings
  [-1, 1].forEach((side) => {
    const w = makeSweptWing(mats.wing, {
      rootChord: 4.8, tipChord: 1.4, halfSpan: 12, sweep: 2.6, thickness: 0.32, dihedral: 0.1,
    });
    w.position.set(-1.2, -fusR * 0.5, 0);
    w.scale.z = side;
    g.add(w);
    // raked wingtip
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.14), mats.wing);
    winglet.position.set(-3.5, 0.0, side * 12);
    winglet.rotation.y = side * 0.3;
    g.add(winglet);
  });

  // Two large underwing engines
  [-5.2, 5.2].forEach((zOffset) => {
    const eng = makeJetEngine(mats, { radius: 1.05, length: 3.6 });
    eng.position.set(0.9, -fusR * 1.0, zOffset);
    g.add(eng);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.3), mats.fuselage);
    pylon.position.set(0.4, -fusR * 0.55, zOffset);
    g.add(pylon);
  });

  // Tail
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.8, 0.22), mats.wing);
  vStab.position.set(-fusLen / 2 - 0.4, 2.0, 0);
  vStab.rotation.z = -0.22;
  g.add(vStab);
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 7.5), mats.wing);
  hStab.position.set(-fusLen / 2 - 0.1, 0.5, 0);
  g.add(hStab);

  // Double deck hint / long window row
  [-1, 1].forEach((side) => {
    const row = new THREE.Mesh(new THREE.BoxGeometry(13, 0.28, 0.03), mats.window);
    row.position.set(-0.5, fusR * 0.35, side * fusR * 0.97);
    g.add(row);
  });
  // Cockpit
  const cock = new THREE.Mesh(
    new THREE.SphereGeometry(fusR * 0.9, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2.2),
    mats.cockpitGlass,
  );
  cock.rotation.z = -Math.PI / 2;
  cock.position.set(fusLen / 2 - 0.5, fusR * 0.3, 0);
  g.add(cock);

  const strobe = addNavLights(g, 12, -fusLen / 2 - 0.4, 3.9);
  g.scale.setScalar(1.1);
  return { group: g, strobe };
}

// --- 4-engine wide-body variant (B747/A340-like) for "cargo" or large birds ---
function buildFourEngine(mats) {
  const g = new THREE.Group();
  const fusLen = 20;
  const fusR = 1.55;
  g.add(makeFuselage(fusR, fusLen, mats.fuselage));

  [-1, 1].forEach((side) => {
    const w = makeSweptWing(mats.wing, {
      rootChord: 5.2, tipChord: 1.3, halfSpan: 13, sweep: 3.0, thickness: 0.32, dihedral: 0.09,
    });
    w.position.set(-1.4, -fusR * 0.5, 0);
    w.scale.z = side;
    g.add(w);
  });

  // Four engines (inboard + outboard)
  [-8.5, -4.5, 4.5, 8.5].forEach((zOffset) => {
    const eng = makeJetEngine(mats, { radius: 0.85, length: 3.0 });
    eng.position.set(0.6, -fusR * 0.95, zOffset);
    g.add(eng);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.28), mats.fuselage);
    pylon.position.set(0.2, -fusR * 0.55, zOffset);
    g.add(pylon);
  });

  // Tail
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.0, 0.22), mats.wing);
  vStab.position.set(-fusLen / 2 - 0.4, 2.2, 0);
  vStab.rotation.z = -0.22;
  g.add(vStab);
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 8.2), mats.wing);
  hStab.position.set(-fusLen / 2 - 0.1, 0.6, 0);
  g.add(hStab);

  // Cockpit
  const cock = new THREE.Mesh(
    new THREE.SphereGeometry(fusR * 0.9, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2.2),
    mats.cockpitGlass,
  );
  cock.rotation.z = -Math.PI / 2;
  cock.position.set(fusLen / 2 - 0.5, fusR * 0.3, 0);
  g.add(cock);

  const strobe = addNavLights(g, 13, -fusLen / 2 - 0.4, 4.1);
  g.scale.setScalar(1.0);
  return { group: g, strobe };
}

// Classify free-form aircraft string into a simple category.
function classifyAircraft(raw) {
  const s = String(raw || '').toLowerCase();
  if (!s) return 'narrow_body';
  if (s.includes('small_prop')) return 'small_prop';
  if (s.includes('turboprop')) return 'turboprop';
  if (s.includes('regional_jet') || s.includes('regional')) return 'regional_jet';
  if (s.includes('wide_body') || s.includes('widebody')) return 'wide_body';
  if (s.includes('narrow_body') || s.includes('narrowbody')) return 'narrow_body';
  if (s.includes('cargo')) return 'cargo';
  if (/\b(c172|c152|c182|p28|sr22|da40|pa28|pc12)\b/.test(s)) return 'small_prop';
  if (/\b(dh8|dhc|at[r]?4|atr5|atr7|at7[256]|saab|sf34|e120|e110|c208)\b/.test(s)) return 'turboprop';
  if (/\b(crj|e145|e170|e175|e190|e195|e75|e19|rj85|rj1|erj)\b/.test(s)) return 'regional_jet';
  if (/\b(b74|a34|a38|il96|md11)\b/.test(s)) return 'four_engine';
  if (/\b(b77|b78|a33|a35)\b/.test(s)) return 'wide_body';
  if (/\b(b73|b75|a31|a32|a22|md8|md9|md88|md90|fokker|bae146)\b/.test(s)) return 'narrow_body';
  if (/\b(freighter|cargo|b74f|b77f|md11f)\b/.test(s)) return 'four_engine';
  return 'narrow_body';
}

// Main factory.
export function buildAircraftModel(aircraftHint) {
  const mats = makeMaterials();
  const category = classifyAircraft(aircraftHint);
  switch (category) {
    case 'small_prop': return buildSmallProp(mats);
    case 'turboprop': return buildTurboprop(mats);
    case 'regional_jet': return buildRegionalJet(mats);
    case 'wide_body': return buildWideBody(mats);
    case 'four_engine': return buildFourEngine(mats);
    case 'cargo': return buildFourEngine(mats);
    case 'narrow_body':
    default: return buildNarrowBody(mats);
  }
}