import * as THREE from 'three';

// Modern premium hangar: polished dark epoxy floor with glossy reflections,
// LED light bars, cyan accent lighting (matching the app theme), clean white
// panel walls with glass bands and minimal, modern equipment. Fully
// procedural canvas textures — no external CDNs.

const texCache = new Map();

function makeCanvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}

function noisePx(g, w, h, base, variance, alpha = 1) {
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * variance;
    img.data[i] = Math.max(0, Math.min(255, base[0] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, base[1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, base[2] + n));
    img.data[i + 3] = alpha * 255;
  }
  g.putImageData(img, 0, 0);
}

// --- Dark polished epoxy floor ---
function epoxyFloorTex() {
  return makeCanvasTex('epoxy', 512, 512, (g, w, h) => {
    const base = g.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#20262e');
    base.addColorStop(0.5, '#1a2028');
    base.addColorStop(1, '#161c24');
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    // Subtle metallic flake sparkle
    for (let i = 0; i < 1200; i += 1) {
      g.fillStyle = `rgba(180,200,220,${0.02 + Math.random() * 0.07})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }

    // Soft cloud variation so tiling is invisible
    for (let i = 0; i < 14; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 70 + Math.random() * 140;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(255,255,255,${0.015 + Math.random() * 0.03})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }

    // Faint expansion-joint grid (large modern slabs)
    g.strokeStyle = 'rgba(8,12,18,0.55)';
    g.lineWidth = 2;
    for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = 'rgba(120,150,180,0.06)';
    g.lineWidth = 1;
    for (let x = 3; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  });
}

// --- Clean modern wall panels ---
function panelWallTex() {
  return makeCanvasTex('panelwall', 512, 512, (g, w, h) => {
    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#e8ebef');
    base.addColorStop(1, '#d4d9e0');
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    // Large architectural panels with crisp shadow gaps
    const pw = 128, ph = 170;
    for (let y = 0; y < h; y += ph) {
      for (let x = 0; x < w; x += pw) {
        g.fillStyle = 'rgba(20,28,38,0.35)';
        g.fillRect(x, y, pw, 3);
        g.fillRect(x, y, 3, ph);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(x + 3, y + 3, pw - 3, 2);
      }
    }
    noisePx(g, w, h, [222, 226, 232], 8, 0.18);
  });
}

// --- Dark ceiling panels ---
function ceilingTex() {
  return makeCanvasTex('modceiling', 512, 512, (g, w, h) => {
    g.fillStyle = '#242a33'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#161b22'; g.lineWidth = 3;
    for (let x = 0; x < w; x += 85) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 85) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    noisePx(g, w, h, [38, 44, 53], 10, 0.25);
  });
}

// --- Brushed steel for structure ---
function brushedSteelTex() {
  return makeCanvasTex('brushed', 256, 256, (g, w, h) => {
    g.fillStyle = '#7d8590'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i += 1) {
      g.strokeStyle = `rgba(${180 + Math.random() * 60},${185 + Math.random() * 60},${195 + Math.random() * 60},${0.05 + Math.random() * 0.08})`;
      g.lineWidth = 1;
      const y = Math.random() * h;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    for (let i = 0; i < 120; i += 1) {
      g.strokeStyle = `rgba(30,35,42,${0.04 + Math.random() * 0.07})`;
      const y = Math.random() * h;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
  });
}

function makeTexturedMat({ tex, repeat = [1, 1], color = 0xffffff, roughness = 0.85, metalness = 0.1, envMapIntensity }) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  const mat = new THREE.MeshStandardMaterial({ map: t, color, roughness, metalness });
  if (envMapIntensity !== undefined) mat.envMapIntensity = envMapIntensity;
  return mat;
}

function logoTex() {
  const tex = new THREE.TextureLoader().load('/skycareer-logo-clean.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

const CYAN = 0x22d3ee;
const CYAN_SOFT = 0x67e8f9;

export function buildHangar({ width = 110, depth = 130, height = 55 } = {}) {
  const group = new THREE.Group();

  const floorMap = epoxyFloorTex();
  const wallMap = panelWallTex();
  const ceilMap = ceilingTex();
  const steelMap = brushedSteelTex();
  const logoMap = logoTex();

  // ---------- Polished floor ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    makeTexturedMat({ tex: floorMap, repeat: [width / 16, depth / 16], color: 0xffffff, roughness: 0.22, metalness: 0.55, envMapIntensity: 1.1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // Glossy fake-reflection sheen strip under the aircraft
  const sheen = new THREE.Mesh(
    new THREE.CircleGeometry(24, 48),
    new THREE.MeshBasicMaterial({ color: 0x2a3a4c, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.y = 0.01;
  group.add(sheen);

  // ---------- Cyan LED parking ring + guidelines ----------
  const ringGlow = new THREE.Mesh(
    new THREE.RingGeometry(13, 14.2, 96),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ringGlow.rotation.x = -Math.PI / 2;
  ringGlow.position.y = 0.025;
  group.add(ringGlow);

  const ringHalo = new THREE.Mesh(
    new THREE.RingGeometry(12.2, 15.2, 96),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.14, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ringHalo.rotation.x = -Math.PI / 2;
  ringHalo.position.y = 0.02;
  group.add(ringHalo);

  // Center guideline toward the door (LED dashes)
  const dashMat = new THREE.MeshBasicMaterial({ color: CYAN_SOFT, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 9; i += 1) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.2), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.028, 17 + i * 5.5);
    group.add(dash);
  }

  // Side lane LED strips embedded in the floor
  [-1, 1].forEach((side) => {
    const lane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, depth * 0.82),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(side * 20, 0.022, -3);
    group.add(lane);
  });

  // ---------- Walls: clean panels with dark base band ----------
  const wallMat = makeTexturedMat({ tex: wallMap, repeat: [7, 4], color: 0xf2f4f7, roughness: 0.6, metalness: 0.15 });
  const baseBandMat = new THREE.MeshStandardMaterial({ color: 0x1b222b, roughness: 0.5, metalness: 0.4 });
  const wallH = height * 0.95;
  const baseH = 4;

  [-1, 1].forEach((side) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1, wallH - baseH, depth - 4), wallMat);
    wall.position.set(side * (width / 2 - 0.5), baseH + (wallH - baseH) / 2, 0);
    group.add(wall);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.2, baseH, depth - 4), baseBandMat);
    band.position.set(side * (width / 2 - 0.6), baseH / 2, 0);
    group.add(band);
    // Horizontal LED accent strip along the wall
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.35, depth - 10),
      new THREE.MeshBasicMaterial({ color: CYAN }),
    );
    strip.position.set(side * (width / 2 - 1.05), baseH + 0.6, 0);
    group.add(strip);
  });

  const rearWall = new THREE.Mesh(new THREE.BoxGeometry(width - 2, wallH - baseH, 1), wallMat);
  rearWall.position.set(0, baseH + (wallH - baseH) / 2, -depth / 2 + 0.5);
  group.add(rearWall);
  const rearBand = new THREE.Mesh(new THREE.BoxGeometry(width - 2, baseH, 1.2), baseBandMat);
  rearBand.position.set(0, baseH / 2, -depth / 2 + 0.6);
  group.add(rearBand);

  // Rear wall: big backlit logo panel
  const logoPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.42, height * 0.2),
    new THREE.MeshStandardMaterial({ color: 0x10161f, roughness: 0.35, metalness: 0.5 }),
  );
  logoPanel.position.set(0, height * 0.6, -depth / 2 + 1.15);
  group.add(logoPanel);
  const rearLogo = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.34, height * 0.15),
    new THREE.MeshStandardMaterial({
      map: logoMap.clone(), transparent: true, alphaTest: 0.08,
      roughness: 0.4, metalness: 0.1, emissive: 0x2aa4c8, emissiveIntensity: 0.35,
    }),
  );
  rearLogo.position.set(0, height * 0.6, -depth / 2 + 1.25);
  group.add(rearLogo);
  // Backlight glow behind logo panel
  const logoGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.46, height * 0.24),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  logoGlow.position.set(0, height * 0.6, -depth / 2 + 1.1);
  group.add(logoGlow);

  // Side wall logos (subtle)
  [-1, 1].forEach((side) => {
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(depth * 0.16, height * 0.12),
      new THREE.MeshStandardMaterial({
        map: logoMap.clone(), transparent: true, alphaTest: 0.08,
        roughness: 0.55, metalness: 0.1, emissive: 0x123344, emissiveIntensity: 0.2,
      }),
    );
    logo.position.set(side * (width / 2 - 1.15), height * 0.62, -depth * 0.15);
    logo.rotation.y = -side * Math.PI / 2;
    group.add(logo);
  });

  // ---------- Glass band windows (upper walls) ----------
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9fc6e8, emissive: 0xbcd9ef, emissiveIntensity: 0.45,
    roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.8,
  });
  [-1, 1].forEach((side) => {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(depth * 0.78, 5), glassMat);
    band.position.set(side * (width / 2 - 1.15), height - 9, 0);
    band.rotation.y = -side * Math.PI / 2;
    group.add(band);
    // Slim mullions
    for (let i = 0; i < 9; i += 1) {
      const z = -depth * 0.36 + i * (depth * 0.78 / 8);
      const mull = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 5.4, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.45, metalness: 0.6 }),
      );
      mull.position.set(side * (width / 2 - 1.1), height - 9, z);
      group.add(mull);
    }
  });

  // ---------- Front opening: sleek frame, fully open ----------
  const doorOpeningW = width * 0.92;
  const doorOpeningH = height * 0.88;
  const sidePanelW = (width - doorOpeningW) / 2;
  const topBandH = height - doorOpeningH;

  const header = new THREE.Mesh(
    new THREE.BoxGeometry(width, topBandH, 1),
    makeTexturedMat({ tex: wallMap, repeat: [8, 1.4], color: 0xe6e9ee, roughness: 0.6, metalness: 0.2 }),
  );
  header.position.set(0, height - topBandH / 2, depth / 2 - 0.5);
  group.add(header);

  [-1, 1].forEach((side) => {
    const sp = new THREE.Mesh(
      new THREE.BoxGeometry(sidePanelW, doorOpeningH, 1),
      makeTexturedMat({ tex: wallMap, repeat: [1, 5], color: 0xe6e9ee, roughness: 0.6, metalness: 0.2 }),
    );
    sp.position.set(side * (doorOpeningW / 2 + sidePanelW / 2), doorOpeningH / 2, depth / 2 - 0.5);
    group.add(sp);
  });

  // Minimal dark frame + vertical LED edge lights at the door
  const frameMat = new THREE.MeshStandardMaterial({ map: steelMap, color: 0x39404a, roughness: 0.4, metalness: 0.75 });
  const topTrack = new THREE.Mesh(new THREE.BoxGeometry(doorOpeningW + 2, 1.6, 1.4), frameMat);
  topTrack.position.set(0, doorOpeningH + 0.4, depth / 2 - 0.3);
  group.add(topTrack);
  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, doorOpeningH + 1.6, 1.6), frameMat);
    post.position.set(side * doorOpeningW / 2, doorOpeningH / 2, depth / 2 - 0.3);
    group.add(post);
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, doorOpeningH * 0.92, 0.2),
      new THREE.MeshBasicMaterial({ color: CYAN }),
    );
    led.position.set(side * (doorOpeningW / 2 - 0.75), doorOpeningH / 2, depth / 2 - 0.3);
    group.add(led);
  });

  // ---------- Ceiling with recessed LED light bars ----------
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    makeTexturedMat({ tex: ceilMap, repeat: [width / 14, depth / 14], color: 0x39424e, roughness: 0.85, metalness: 0.25 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  group.add(ceiling);

  // Slim structural beams (clean, no clutter)
  const beamMat = new THREE.MeshStandardMaterial({ map: steelMap, color: 0x5a626e, roughness: 0.5, metalness: 0.7 });
  for (let i = 0; i < 5; i += 1) {
    const z = -depth / 2 + (i + 0.5) * (depth / 5);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(width - 4, 1.2, 0.9), beamMat);
    beam.position.set(0, height - 2, z);
    group.add(beam);
  }

  // Long linear LED light bars (modern industrial lighting)
  const barLightMat = new THREE.MeshBasicMaterial({ color: 0xf2f8ff });
  for (let i = 0; i < 3; i += 1) {
    const x = -width * 0.28 + i * width * 0.28;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, depth * 0.7), barLightMat);
    bar.position.set(x, height - 3.2, -6);
    group.add(bar);
    // Soft glow plane beneath each bar
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(5, depth * 0.7),
      new THREE.MeshBasicMaterial({ color: 0xd8ecff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.set(x, height - 3.6, -6);
    group.add(glow);
  }

  // Real lights: fewer, stronger, cooler tone
  [[-width * 0.28, -depth * 0.22], [width * 0.28, -depth * 0.22], [-width * 0.28, depth * 0.18], [width * 0.28, depth * 0.18], [0, -2]].forEach(([x, z]) => {
    const pl = new THREE.PointLight(0xeaf4ff, 1.5, 100, 1.9);
    pl.position.set(x, height - 6, z);
    group.add(pl);
  });
  // Cyan accent fill from the floor strips
  const accent = new THREE.PointLight(CYAN, 0.5, 90, 2);
  accent.position.set(0, 4, 0);
  group.add(accent);

  // ---------- Modern equipment (minimal, clean) ----------
  // Sleek tool cabinets along the rear wall
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x232a34, roughness: 0.35, metalness: 0.6 });
  const cabinetAccent = new THREE.MeshBasicMaterial({ color: CYAN });
  for (let i = 0; i < 5; i += 1) {
    const x = -width * 0.32 + i * (width * 0.16);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(6, 5.5, 2.4), cabinetMat);
    cab.position.set(x, 2.75, -depth / 2 + 2.6);
    group.add(cab);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 0.1), cabinetAccent);
    handle.position.set(x, 4.6, -depth / 2 + 3.85);
    group.add(handle);
  }

  // Modern mobile work platforms (two, near the sides)
  const platMat = new THREE.MeshStandardMaterial({ color: 0x3b4450, roughness: 0.45, metalness: 0.55 });
  [[-width * 0.34, -depth * 0.1], [width * 0.34, depth * 0.05]].forEach(([x, z]) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.5, 3), platMat);
    base.position.set(x, 0.25, z);
    group.add(base);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), platMat);
    mast.position.set(x - 1.6, 3, z);
    group.add(mast);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 3), platMat);
    deck.position.set(x, 5.6, z);
    group.add(deck);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.5 }),
    );
    rail.position.set(x, 6.6, z + 1.4);
    group.add(rail);
  });

  // Charging station / GPU unit near the door
  const gpu = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 2, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xe8ebef, roughness: 0.4, metalness: 0.3 }),
  );
  gpu.position.set(-width * 0.3, 1, depth * 0.32);
  group.add(gpu);
  const gpuLight = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.1), cabinetAccent);
  gpuLight.position.set(-width * 0.3, 1.9, depth * 0.32 + 0.82);
  group.add(gpuLight);

  // ---------- Exterior apron + bright backdrop ----------
  const exteriorFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 2.2, depth * 1.4),
    makeTexturedMat({ tex: epoxyFloorTex(), repeat: [width / 8, depth / 10], color: 0x8f99a6, roughness: 0.75, metalness: 0.1 }),
  );
  exteriorFloor.rotation.x = -Math.PI / 2;
  exteriorFloor.position.set(0, 0.012, depth / 2 + depth * 0.55);
  group.add(exteriorFloor);

  const horizonBackdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 3, height * 1.9),
    new THREE.MeshBasicMaterial({
      color: 0x9cc3ef, transparent: true, opacity: 0.2, fog: false, side: THREE.DoubleSide,
    }),
  );
  horizonBackdrop.position.set(0, height * 0.68, depth / 2 + 330);
  group.add(horizonBackdrop);

  // Daylight through the open door (cooler, modern)
  const doorSun = new THREE.DirectionalLight(0xfff2e0, 1.6);
  doorSun.position.set(20, height * 0.45, depth / 2 + 60);
  doorSun.target.position.set(-5, 2, -depth / 4);
  group.add(doorSun);
  group.add(doorSun.target);

  const doorBounce = new THREE.PointLight(0xffe0b8, 0.9, 70, 2);
  doorBounce.position.set(0, 6, depth / 2 - 12);
  group.add(doorBounce);

  const sunPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 35),
    new THREE.MeshBasicMaterial({
      color: 0xffd9a8, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  sunPatch.rotation.x = -Math.PI / 2;
  sunPatch.position.set(0, 0.035, depth / 4);
  group.add(sunPatch);

  return { group };
}