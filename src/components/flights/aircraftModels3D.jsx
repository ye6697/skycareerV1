import * as THREE from 'three';

// Shared materials factory for a bright, readable aircraft look.
function makeMaterials() {
  return {
    fuselage: new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.25, metalness: 0.85,
      emissive: 0x8899aa, emissiveIntensity: 0.35,
    }),
    wing: new THREE.MeshStandardMaterial({
      color: 0xf5f7fa, roughness: 0.3, metalness: 0.8,
      emissive: 0x7788aa, emissiveIntensity: 0.3,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: 0x22d3ee, roughness: 0.3, metalness: 0.9,
      emissive: 0x0891b2, emissiveIntensity: 0.6,
    }),
    belly: new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, roughness: 0.35, metalness: 0.75,
      emissive: 0x5a6a7a, emissiveIntensity: 0.25,
    }),
    window: new THREE.MeshStandardMaterial({
      color: 0x0a1220, roughness: 0.1, metalness: 0.95,
      emissive: 0x1e3a5f, emissiveIntensity: 0.4,
    }),
    prop: new THREE.MeshStandardMaterial({
      color: 0x1e293b, roughness: 0.5, metalness: 0.7,
      emissive: 0x334155, emissiveIntensity: 0.3,
    }),
  };
}

// Adds red/green nav lights and a strobe. Returns the strobe mesh so the
// caller can keep animating its opacity.
function addNavLights(group, tailX, tailFinTop) {
  const redNav = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }),
  );
  redNav.position.set(-0.5, -0.3, -7);
  group.add(redNav);

  const greenNav = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x22ff22 }),
  );
  greenNav.position.set(-0.5, -0.3, 7);
  group.add(greenNav);

  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  );
  strobe.position.set(tailX, tailFinTop, 0);
  group.add(strobe);
  return strobe;
}

// --- Small single-engine propeller (Cessna-like) ---
function buildSmallProp(mats) {
  const g = new THREE.Group();
  // short stubby fuselage
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 5, 14), mats.fuselage);
  fus.rotation.z = Math.PI / 2;
  g.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.5, 14), mats.fuselage);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 3.25;
  g.add(nose);
  // propeller
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 12), mats.accent);
  spinner.rotation.z = -Math.PI / 2;
  spinner.position.x = 4.2;
  g.add(spinner);
  const propDisk = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 24),
    new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
  );
  propDisk.rotation.y = Math.PI / 2;
  propDisk.position.x = 4.4;
  g.add(propDisk);
  // high wing
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 11), mats.wing);
  wing.position.set(0.4, 1.0, 0);
  g.add(wing);
  // wing struts
  [-1, 1].forEach((side) => {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), mats.wing);
    strut.position.set(0.4, 0.3, side * 2.2);
    g.add(strut);
  });
  // tail
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 3.2), mats.wing);
  hStab.position.set(-2.6, 0.35, 0);
  g.add(hStab);
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.4, 0.1), mats.wing);
  vStab.position.set(-2.6, 1.0, 0);
  g.add(vStab);
  // cockpit window
  const cock = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.2),
    mats.window,
  );
  cock.rotation.z = -Math.PI / 2;
  cock.position.set(2.0, 0.4, 0);
  g.add(cock);
  const strobe = addNavLights(g, -3.2, 1.7);
  g.scale.setScalar(1.3);
  return { group: g, strobe };
}

// --- Twin turboprop (Dash 8 / ATR-like) ---
function buildTurboprop(mats) {
  const g = new THREE.Group();
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 9, 16), mats.fuselage);
  fus.rotation.z = Math.PI / 2;
  g.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.2, 16), mats.fuselage);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 5.6;
  g.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.2, 16), mats.fuselage);
  tailCone.rotation.z = Math.PI / 2;
  tailCone.position.x = -5.6;
  g.add(tailCone);
  // high wing (distinctive turboprop trait)
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 16), mats.wing);
  wing.position.set(-0.3, 1.05, 0);
  g.add(wing);
  // turboprops on wing
  [-4.5, 4.5].forEach((zOffset) => {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.55, 2.8, 14), mats.fuselage);
    nacelle.rotation.z = Math.PI / 2;
    nacelle.position.set(0.4, 1.05, zOffset);
    g.add(nacelle);
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 12), mats.accent);
    spinner.rotation.z = -Math.PI / 2;
    spinner.position.set(1.9, 1.05, zOffset);
    g.add(spinner);
    const prop = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 24),
      new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
    );
    prop.rotation.y = Math.PI / 2;
    prop.position.set(2.1, 1.05, zOffset);
    g.add(prop);
  });
  // tail
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 4.8), mats.wing);
  hStab.position.set(-4.8, 2.2, 0);
  g.add(hStab);
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.4, 0.18), mats.wing);
  vStab.position.set(-4.8, 1.2, 0);
  g.add(vStab);
  const tailAccent = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 0.2), mats.accent);
  tailAccent.position.set(-4.8, 2.3, 0);
  g.add(tailAccent);
  // windows & cockpit
  [-1, 1].forEach((side) => {
    const row = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.28, 0.04), mats.window);
    row.position.set(-0.3, 0.25, side * 0.93);
    g.add(row);
  });
  const cock = new THREE.Mesh(
    new THREE.SphereGeometry(0.82, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.2),
    mats.window,
  );
  cock.rotation.z = -Math.PI / 2;
  cock.position.set(4.3, 0.25, 0);
  g.add(cock);
  const strobe = addNavLights(g, -5.0, 2.4);
  g.scale.setScalar(1.4);
  return { group: g, strobe };
}

// --- Generic twin-jet airliner (CRJ/E-Jet/A320/737 proportions, scaled by size) ---
function buildJetAirliner(mats, { fusLen = 10, fusRadius = 1.1, wingSpan = 14, engines = 2, isWide = false, scale = 1.5 }) {
  const g = new THREE.Group();
  // fuselage
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(fusRadius, fusRadius, fusLen, 18), mats.fuselage);
  fus.rotation.z = Math.PI / 2;
  g.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(fusRadius, fusLen * 0.3, 18), mats.fuselage);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = fusLen / 2 + fusLen * 0.15;
  g.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(fusRadius, fusLen * 0.25, 18), mats.fuselage);
  tailCone.rotation.z = Math.PI / 2;
  tailCone.position.x = -(fusLen / 2 + fusLen * 0.12);
  g.add(tailCone);
  // main wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(fusLen * 0.35, 0.2, wingSpan), mats.wing);
  wing.position.set(-0.5, -0.3, 0);
  g.add(wing);
  // wing accent
  const wingStripe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, wingSpan), mats.accent);
  wingStripe.position.set(0.8, -0.3, 0);
  g.add(wingStripe);
  // horiz stab
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(fusLen * 0.18, 0.15, wingSpan * 0.4), mats.wing);
  hStab.position.set(-fusLen * 0.52, 0.1, 0);
  g.add(hStab);
  // vert stab
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(fusLen * 0.22, fusLen * 0.28, 0.2), mats.wing);
  vStab.position.set(-fusLen * 0.54, fusLen * 0.14, 0);
  g.add(vStab);
  const tailAccent = new THREE.Mesh(new THREE.BoxGeometry(fusLen * 0.22, 0.3, 0.22), mats.accent);
  tailAccent.position.set(-fusLen * 0.54, fusLen * 0.26, 0);
  g.add(tailAccent);
  // belly
  const belly = new THREE.Mesh(
    new THREE.CylinderGeometry(fusRadius * 0.95, fusRadius * 0.95, fusLen, 18, 1, false, Math.PI * 0.15, Math.PI * 0.7),
    mats.belly,
  );
  belly.rotation.z = Math.PI / 2;
  belly.position.y = -0.02;
  g.add(belly);
  // cockpit window
  const cock = new THREE.Mesh(
    new THREE.SphereGeometry(fusRadius * 0.86, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.2),
    mats.window,
  );
  cock.rotation.z = -Math.PI / 2;
  cock.position.set(fusLen / 2 + fusLen * 0.02, fusRadius * 0.23, 0);
  g.add(cock);
  // cabin windows
  [-1, 1].forEach((side) => {
    const row = new THREE.Mesh(new THREE.BoxGeometry(fusLen * 0.75, 0.3, 0.04), mats.window);
    row.position.set(-0.5, fusRadius * 0.32, side * (fusRadius * 0.98));
    g.add(row);
  });
  // engines
  const enginePositions = engines === 4
    ? [-wingSpan * 0.18, -wingSpan * 0.33, wingSpan * 0.18, wingSpan * 0.33]
    : [-wingSpan * 0.32, wingSpan * 0.32];
  enginePositions.forEach((zOffset) => {
    const engineR = isWide ? 0.95 : 0.75;
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(engineR, engineR * 0.9, 2.8, 16), mats.fuselage);
    nacelle.rotation.z = Math.PI / 2;
    nacelle.position.set(-0.3, -1.0, zOffset);
    g.add(nacelle);
    const intake = new THREE.Mesh(new THREE.TorusGeometry(engineR + 0.04, 0.15, 8, 20), mats.accent);
    intake.rotation.y = Math.PI / 2;
    intake.position.set(1.05, -1.0, zOffset);
    g.add(intake);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(engineR * 0.82, 16), mats.window);
    fan.rotation.y = Math.PI / 2;
    fan.position.set(1.06, -1.0, zOffset);
    g.add(fan);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.25), mats.wing);
    pylon.position.set(-0.3, -0.55, zOffset);
    g.add(pylon);
  });
  // winglets
  [-wingSpan / 2, wingSpan / 2].forEach((zOffset) => {
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.18), mats.wing);
    winglet.position.set(-0.7, 0.25, zOffset);
    winglet.rotation.z = Math.sign(zOffset) * 0.1;
    g.add(winglet);
  });
  const strobe = addNavLights(g, -fusLen * 0.54, fusLen * 0.26);
  g.scale.setScalar(scale);
  return { group: g, strobe };
}

// Classify free-form aircraft string into a simple category.
function classifyAircraft(raw) {
  const s = String(raw || '').toLowerCase();
  if (!s) return 'narrow_body';
  // direct category matches from fleet types
  if (s.includes('small_prop')) return 'small_prop';
  if (s.includes('turboprop')) return 'turboprop';
  if (s.includes('regional_jet') || s.includes('regional')) return 'regional_jet';
  if (s.includes('wide_body') || s.includes('widebody')) return 'wide_body';
  if (s.includes('narrow_body') || s.includes('narrowbody')) return 'narrow_body';
  if (s.includes('cargo')) return 'cargo';
  // ICAO / model string heuristics
  if (/\b(c172|c152|c182|p28|sr22|da40|pa28|pc12)\b/.test(s)) return 'small_prop';
  if (/\b(dh8|dhc|at[r]?4|atr5|atr7|at7[256]|saab|sf34|e120|e110|c208)\b/.test(s)) return 'turboprop';
  if (/\b(crj|e145|e170|e175|e190|e195|e75|e19|rj85|rj1|erj)\b/.test(s)) return 'regional_jet';
  if (/\b(b74|b77|b78|a33|a34|a35|a38|md1[12]|dc10|il96)\b/.test(s)) return 'wide_body';
  if (/\b(b73|b75|a31|a32|a22|md8|md9|md88|md90|fokker|bae146)\b/.test(s)) return 'narrow_body';
  if (/\b(freighter|cargo|b74f|b77f|md11f)\b/.test(s)) return 'cargo';
  return 'narrow_body';
}

// Main factory: returns { group, strobe } for the three.js scene.
export function buildAircraftModel(aircraftHint) {
  const mats = makeMaterials();
  const category = classifyAircraft(aircraftHint);
  switch (category) {
    case 'small_prop':
      return buildSmallProp(mats);
    case 'turboprop':
      return buildTurboprop(mats);
    case 'regional_jet':
      return buildJetAirliner(mats, { fusLen: 9, fusRadius: 0.95, wingSpan: 12, engines: 2, scale: 1.35 });
    case 'wide_body':
      return buildJetAirliner(mats, { fusLen: 14, fusRadius: 1.5, wingSpan: 20, engines: 4, isWide: true, scale: 1.6 });
    case 'cargo':
      return buildJetAirliner(mats, { fusLen: 13, fusRadius: 1.45, wingSpan: 18, engines: 4, isWide: true, scale: 1.55 });
    case 'narrow_body':
    default:
      return buildJetAirliner(mats, { fusLen: 10, fusRadius: 1.1, wingSpan: 14, engines: 2, scale: 1.5 });
  }
}