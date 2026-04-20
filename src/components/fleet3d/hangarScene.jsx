import * as THREE from 'three';

// Fully procedural hangar with canvas-generated PBR textures so we never
// depend on external texture CDNs (which were blocked and left everything
// flat-black). Every wall, floor, pillar, and door panel has its own
// procedural texture so the hangar actually reads as a real industrial
// building in 3D.

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

// Noise helper
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

// --- Modern sealed-concrete / epoxy floor texture ---
function concreteTex() {
  return makeCanvasTex('concrete', 512, 512, (g, w, h) => {
    // Slight cool gradient base to avoid flat/dirty-looking concrete.
    const base = g.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#cfd5dd');
    base.addColorStop(0.5, '#c4cad3');
    base.addColorStop(1, '#bcc3cd');
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);

    // Fine aggregate noise (small, subtle grain).
    noisePx(g, w, h, [198, 204, 212], 18, 0.5);

    // Very soft cloud variation so repeats are less obvious.
    for (let i = 0; i < 18; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 60 + Math.random() * 120;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(255,255,255,${0.03 + Math.random() * 0.05})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }

    // Polishing/machine sweep lines to make it feel newer + premium.
    for (let i = 0; i < 45; i += 1) {
      g.strokeStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.04})`;
      g.lineWidth = 1 + Math.random() * 1.5;
      const y = (i / 45) * h + (Math.random() - 0.5) * 10;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.25, y - 6, w * 0.75, y + 6, w, y);
      g.stroke();
    }

    // Slight dirt accumulation and micro-cracks to prevent flat look.
    for (let i = 0; i < 34; i += 1) {
      const y = Math.random() * h;
      g.strokeStyle = `rgba(52,58,68,${0.06 + Math.random() * 0.08})`;
      g.lineWidth = 0.6 + Math.random() * 1.2;
      g.beginPath();
      g.moveTo(Math.random() * (w * 0.2), y);
      g.bezierCurveTo(w * 0.35, y + (Math.random() - 0.5) * 12, w * 0.7, y + (Math.random() - 0.5) * 12, w - Math.random() * (w * 0.2), y + (Math.random() - 0.5) * 8);
      g.stroke();
    }

    for (let i = 0; i < 450; i += 1) {
      g.fillStyle = `rgba(75,82,94,${0.03 + Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
    }

    // Micro metallic flakes + subtle wet reflection streaks for a
    // "new epoxy hangar floor" look.
    for (let i = 0; i < 850; i += 1) {
      g.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 14; i += 1) {
      const y = h * (0.12 + i * 0.055) + (Math.random() - 0.5) * 8;
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.2, y - 4, w * 0.8, y + 4, w, y);
      g.stroke();
    }

    // Very soft wheel wear only (no hard dark line pattern on the floor).
    const wheelPath = g.createLinearGradient(0, h * 0.35, 0, h * 0.65);
    wheelPath.addColorStop(0, 'rgba(45,50,58,0)');
    wheelPath.addColorStop(0.5, 'rgba(45,50,58,0.08)');
    wheelPath.addColorStop(1, 'rgba(45,50,58,0)');
    g.fillStyle = wheelPath;
    g.fillRect(0, h * 0.34, w, h * 0.08);
    g.fillRect(0, h * 0.58, w, h * 0.08);
  });
}

// --- Corrugated metal wall texture ---
function wallTex() {
  return makeCanvasTex('wall', 256, 512, (g, w, h) => {
    // Base coat
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#5a6470');
    grd.addColorStop(0.5, '#7a8494');
    grd.addColorStop(1, '#5a6470');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // Vertical corrugations (dark/light stripes)
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, 0, 4, h);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 4, 0, 4, h);
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(x + 8, 0, 2, h);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 12, 0, 2, h);
    }
    // Horizontal panel seams every ~170px
    g.fillStyle = 'rgba(0,0,0,0.45)';
    for (let y = 0; y < h; y += 170) g.fillRect(0, y, w, 2);
    // Rust streaks (kept subtle for a modern but used industrial look)
    for (let i = 0; i < 4; i += 1) {
      const x = Math.random() * w;
      const grd2 = g.createLinearGradient(x, 0, x + 8, 0);
      grd2.addColorStop(0, 'rgba(110,55,30,0)');
      grd2.addColorStop(0.5, 'rgba(110,55,30,0.25)');
      grd2.addColorStop(1, 'rgba(110,55,30,0)');
      g.fillStyle = grd2;
      g.fillRect(x, Math.random() * h, 10, 40 + Math.random() * 80);
    }
    // Painted panel accents for richer texture depth.
    for (let y = 30; y < h; y += 90) {
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, y, w, 8);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.fillRect(0, y + 8, w, 2);
    }

    // Additional grunge/noise breakup so large walls feel less smooth.
    for (let i = 0; i < 700; i += 1) {
      g.fillStyle = `rgba(${110 + Math.random() * 55},${120 + Math.random() * 55},${130 + Math.random() * 55},${0.02 + Math.random() * 0.08})`;
      const px = Math.random() * w;
      const py = Math.random() * h;
      g.fillRect(px, py, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }

    for (let i = 0; i < 40; i += 1) {
      const y = Math.random() * h;
      g.strokeStyle = `rgba(25,30,38,${0.08 + Math.random() * 0.1})`;
      g.lineWidth = 0.8 + Math.random() * 1.2;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + (Math.random() - 0.5) * 10);
      g.stroke();
    }
  });
}

// --- Metal roof panels ---
function roofTex() {
  return makeCanvasTex('roof', 512, 512, (g, w, h) => {
    g.fillStyle = '#3a434e'; g.fillRect(0, 0, w, h);
    // Panel grid
    g.strokeStyle = '#222830'; g.lineWidth = 2;
    for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // Rivets at intersections
    g.fillStyle = '#1a2028';
    for (let x = 0; x <= w; x += 64) {
      for (let y = 0; y <= h; y += 64) {
        g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
      }
    }
    // Highlights
    noisePx(g, w, h, [58, 67, 78], 15, 0.3);
  });
}

// --- Steel I-beam texture (painted with rust streaks) ---
function steelTex() {
  return makeCanvasTex('steel', 256, 256, (g, w, h) => {
    g.fillStyle = '#9aa0a8'; g.fillRect(0, 0, w, h);
    // Horizontal painted streaks
    for (let i = 0; i < 20; i += 1) {
      g.fillStyle = `rgba(${80 + Math.random() * 40}, ${80 + Math.random() * 40}, ${80 + Math.random() * 40}, 0.3)`;
      g.fillRect(0, Math.random() * h, w, 2 + Math.random() * 4);
    }
    // Bolt rows
    g.fillStyle = '#3a3a3a';
    for (let y = 20; y < h; y += 40) {
      for (let x = 20; x < w; x += 40) {
        g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)';
        g.beginPath(); g.arc(x - 1, y - 1, 1, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3a3a3a';
      }
    }
    // Rust
    for (let i = 0; i < 4; i += 1) {
      const x = Math.random() * w, y = Math.random() * h;
      const grd = g.createRadialGradient(x, y, 0, x, y, 20 + Math.random() * 30);
      grd.addColorStop(0, 'rgba(120,55,25,0.6)');
      grd.addColorStop(1, 'rgba(120,55,25,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, 40, 0, Math.PI * 2); g.fill();
    }
  });
}

// --- Hangar door (large metal roll-up door) ---
function hangarDoorTex() {
  return makeCanvasTex('hangardoor', 1024, 512, (g, w, h) => {
    // Background metal
    g.fillStyle = '#b8bcc4'; g.fillRect(0, 0, w, h);
    // Horizontal panel segments (typical hangar roll-up door)
    const panels = 12;
    const ph = h / panels;
    for (let i = 0; i < panels; i += 1) {
      const y = i * ph;
      // Panel gradient (top lighter, bottom darker)
      const grd = g.createLinearGradient(0, y, 0, y + ph);
      grd.addColorStop(0, '#d0d4dc');
      grd.addColorStop(0.5, '#a8acb4');
      grd.addColorStop(1, '#888c94');
      g.fillStyle = grd; g.fillRect(0, y, w, ph);
      // Top/bottom seam
      g.fillStyle = '#3a3d42'; g.fillRect(0, y, w, 2);
      g.fillStyle = '#4a4d52'; g.fillRect(0, y + ph - 2, w, 2);
    }
    // Vertical reinforcement ribs
    g.strokeStyle = 'rgba(60,60,70,0.5)'; g.lineWidth = 2;
    for (let x = 0; x < w; x += 80) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    }
    // Rivets along seams
    g.fillStyle = '#2a2d32';
    for (let i = 0; i < panels; i += 1) {
      const y = i * ph + 3;
      for (let x = 12; x < w; x += 50) {
        g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
      }
    }
    // Red warning stripe along the bottom
    g.fillStyle = '#c02020';
    g.fillRect(0, h - 30, w, 12);
    g.fillStyle = '#f0f0f0';
    for (let x = 0; x < w; x += 40) {
      g.fillRect(x, h - 30, 20, 12);
    }
    // Wear / dirt along the bottom
    for (let i = 0; i < 40; i += 1) {
      g.fillStyle = `rgba(40,40,40,${Math.random() * 0.4})`;
      g.fillRect(Math.random() * w, h - 50 - Math.random() * 60, 3 + Math.random() * 15, 2 + Math.random() * 3);
    }
  });
}

// Build a matte PBR-like material from a texture with optional repeat.
function makeTexturedMat({ tex, repeat = [1, 1], color = 0xffffff, roughness = 0.85, metalness = 0.1 }) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  return new THREE.MeshStandardMaterial({ map: t, color, roughness, metalness });
}

// Hazard-striped band
function makeHazardMat() {
  const t = makeCanvasTex('hazard', 128, 16, (g, w, h) => {
    g.fillStyle = '#f0c040'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a1a1a';
    for (let i = 0; i < w; i += 32) g.fillRect(i, 0, 16, h);
  });
  const tex = t.clone(); tex.needsUpdate = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
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

export function buildHangar({ width = 110, depth = 130, height = 55 } = {}) {
  const group = new THREE.Group();

  const concreteMap = concreteTex();
  const wallMap = wallTex();
  const roofMap = roofTex();
  const steelMap = steelTex();
  const doorMap = hangarDoorTex();
  const logoMap = logoTex();

  // ---------- Floor ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    makeTexturedMat({ tex: concreteMap, repeat: [width / 10, depth / 10], color: 0xd2d7df, roughness: 0.58, metalness: 0.04 }),
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // Yellow parking circle + cross
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(13, 13.8, 64),
    new THREE.MeshBasicMaterial({ color: 0xf0c040, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);
  [0, Math.PI / 2].forEach((rot) => {
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xf0c040 }),
    );
    bar.rotation.x = -Math.PI / 2;
    bar.rotation.z = rot;
    bar.position.y = 0.025;
    group.add(bar);
  });

  // Hazard strips along each side of the parking spot
  const hazardMat = makeHazardMat();
  hazardMat.map.repeat.set(20, 1);
  [-1, 1].forEach((side) => {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(60, 1.4), hazardMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.03, side * 22);
    group.add(strip);
  });

  // Taxi / tow lane markings (subtle, no center trench obstruction).
  const laneMarkMat = new THREE.MeshBasicMaterial({ color: 0xe8eef7, transparent: true, opacity: 0.72 });
  [-1, 1].forEach((side) => {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, depth * 0.85), laneMarkMat);
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(side * 11.5, 0.032, -4);
    group.add(lane);
  });

  // ---------- Back wall ----------
  const rearDoorOpeningW = width * 0.62;
  const rearDoorOpeningH = height * 0.76;
  const rearPanelW = (width - rearDoorOpeningW) / 2;
  const rearTopBandH = height - rearDoorOpeningH;

  const rearHeader = new THREE.Mesh(
    new THREE.PlaneGeometry(width, rearTopBandH),
    makeTexturedMat({ tex: wallMap, repeat: [width / 8, rearTopBandH / 6], color: 0x9aa0aa, roughness: 0.75, metalness: 0.45 }),
  );
  rearHeader.position.set(0, height - rearTopBandH / 2, -depth / 2);
  group.add(rearHeader);

  [-1, 1].forEach((side) => {
    const rearPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(rearPanelW, rearDoorOpeningH),
      makeTexturedMat({ tex: wallMap, repeat: [rearPanelW / 6, rearDoorOpeningH / 6], color: 0x9aa0aa, roughness: 0.75, metalness: 0.45 }),
    );
    rearPanel.position.set(side * (rearDoorOpeningW / 2 + rearPanelW / 2), rearDoorOpeningH / 2, -depth / 2);
    group.add(rearPanel);
  });

  // ---------- Side walls ----------
  [-1, 1].forEach((side) => {
    const sideWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height),
      makeTexturedMat({
        tex: wallMap,
        repeat: [depth / 6, height / 6],
        color: 0xaab2bf,
        roughness: 0.86,
        metalness: 0.2,
      }),
    );
    sideWall.rotation.y = side * Math.PI / 2;
    sideWall.position.set(side * width / 2, height / 2, 0);
    group.add(sideWall);
  });

  // ---------- Side wall logos ----------
  [-1, 1].forEach((side) => {
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(depth * 0.18, height * 0.14),
      new THREE.MeshStandardMaterial({
        map: logoMap.clone(),
        transparent: true,
        alphaTest: 0.08,
        roughness: 0.6,
        metalness: 0.1,
        emissive: 0x101f33,
        emissiveIntensity: 0.15,
      }),
    );
    logo.position.set(side * (width / 2 - 0.16), height * 0.64, 0);
    logo.rotation.y = -side * Math.PI / 2;
    group.add(logo);
  });

  // ---------- Front wall with OPEN DOORWAY ----------
  const doorOpeningW = width * 0.78;
  const doorOpeningH = height * 0.9;
  const sidePanelW = (width - doorOpeningW) / 2;
  const topBandH = height - doorOpeningH;

  // Top band (header) above the door
  const headerBand = new THREE.Mesh(
    new THREE.PlaneGeometry(width, topBandH),
    makeTexturedMat({ tex: wallMap, repeat: [width / 8, topBandH / 6], color: 0x9aa0aa, roughness: 0.75, metalness: 0.45 }),
  );
  headerBand.position.set(0, height - topBandH / 2, depth / 2);
  headerBand.rotation.y = Math.PI;
  group.add(headerBand);

  // Side panels flanking the door
  [-1, 1].forEach((side) => {
    const sp = new THREE.Mesh(
      new THREE.PlaneGeometry(sidePanelW, doorOpeningH),
      makeTexturedMat({ tex: wallMap, repeat: [sidePanelW / 6, doorOpeningH / 6], color: 0x9aa0aa, roughness: 0.75, metalness: 0.45 }),
    );
    sp.position.set(side * (doorOpeningW / 2 + sidePanelW / 2), doorOpeningH / 2, depth / 2);
    sp.rotation.y = Math.PI;
    group.add(sp);
  });

  // Keep the doorway genuinely open: no backdrop plane behind it.
  // This prevents a dark "wall" feeling and lets the camera look through.

  // ---------- HANGAR ROLL-UP DOOR ----------
  // Keep door fully open so the outside view is never blocked by shutter slats.

  // Door tracks/frame around the opening (I-beams)
  const frameMat = new THREE.MeshStandardMaterial({
    map: steelMap, roughness: 0.5, metalness: 0.65,
  });
  // Top track
  const topTrack = new THREE.Mesh(new THREE.BoxGeometry(doorOpeningW + 3, 2, 1.5), frameMat);
  topTrack.position.set(0, doorOpeningH + 0.5, depth / 2 - 0.3);
  group.add(topTrack);
  // Side tracks (proper I-beam pillars)
  [-1, 1].forEach((side) => {
    const track = new THREE.Mesh(new THREE.BoxGeometry(1.8, doorOpeningH + 2, 1.8), frameMat);
    track.position.set(side * doorOpeningW / 2, doorOpeningH / 2, depth / 2 - 0.3);
    group.add(track);
    // Concrete plinth at base
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.5, 3),
      makeTexturedMat({ tex: concreteMap, repeat: [1, 1], color: 0xa0a4ac, roughness: 0.9 }),
    );
    plinth.position.set(side * doorOpeningW / 2, 0.75, depth / 2 - 0.3);
    group.add(plinth);
  });

  // Hazard stripe at the bottom of the door frame
  const frameHazard = new THREE.Mesh(new THREE.BoxGeometry(doorOpeningW + 3, 0.25, 1.1), makeHazardMat());
  frameHazard.material.map.repeat.set(30, 1);
  frameHazard.position.set(0, 0.125, depth / 2 - 0.2);
  group.add(frameHazard);

  // Extra inner cladding strips so the entire front wall reads textured.
  const claddingMat = makeTexturedMat({
    tex: wallMap, repeat: [6, 1], color: 0x8f98a5, roughness: 0.74, metalness: 0.42,
  });
  for (let i = 0; i < 4; i += 1) {
    const y = 3 + i * ((doorOpeningH - 6) / 3);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(sidePanelW * 0.9, 0.45, 0.8), claddingMat);
    lintel.position.set(-(doorOpeningW / 2 + sidePanelW / 2), y, depth / 2 - 0.35);
    group.add(lintel);
    const lintelR = lintel.clone();
    lintelR.position.x *= -1;
    group.add(lintelR);
  }

  // ---------- Ceiling ----------
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    makeTexturedMat({ tex: roofMap, repeat: [width / 12, depth / 12], color: 0x4a5460, roughness: 0.9, metalness: 0.3 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  group.add(ceiling);

  // ---------- Steel trusses ----------
  const trussMat = new THREE.MeshStandardMaterial({
    map: steelMap, roughness: 0.6, metalness: 0.65, color: 0x8a8890,
  });
  for (let i = 0; i < 6; i += 1) {
    const z = -depth / 2 + (i + 0.5) * (depth / 6);
    const truss = new THREE.Mesh(new THREE.BoxGeometry(width - 2, 1, 1.2), trussMat);
    truss.position.set(0, height - 3, z);
    group.add(truss);
    // Vertical supports for truss
    for (let j = 0; j < 6; j += 1) {
      const x = -width / 2 + 6 + j * ((width - 12) / 5);
      const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 6, 6), trussMat);
      sup.position.set(x, height - 6, z);
      group.add(sup);
    }
  }

  // ---------- Ceiling lights ----------
  for (let i = 0; i < 4; i += 1) {
    const z = -depth / 2 + 15 + i * ((depth - 30) / 3);
    [-1, 1].forEach((side) => {
      const x = side * width * 0.3;
      const housing = new THREE.Mesh(
        new THREE.ConeGeometry(2.5, 2, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }),
      );
      housing.position.set(x, height - 5, z);
      group.add(housing);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff4d8 }),
      );
      bulb.position.set(x, height - 6, z);
      group.add(bulb);
      const pl = new THREE.PointLight(0xfff0d0, 1.6, 85, 1.8);
      pl.position.set(x, height - 7, z);
      group.add(pl);
    });
  }

  // ---------- Side windows (with daylight) ----------
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xaec8e0, emissive: 0xc8deee, emissiveIntensity: 0.5,
    roughness: 0.15, metalness: 0.5, transparent: true, opacity: 0.85,
  });
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 5; i += 1) {
      const z = -depth / 2 + 15 + i * ((depth - 30) / 4);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), windowMat);
      win.position.set(side * (width / 2 - 0.05), height - 7, z);
      win.rotation.y = -side * Math.PI / 2;
      group.add(win);
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.25, 9.5),
        new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.6 }),
      );
      frame.position.set(side * (width / 2 - 0.04), height - 7, z);
      group.add(frame);
    }
  });

  // ---------- Workbenches and toolboxes ----------
  const benchMat = new THREE.MeshStandardMaterial({ map: steelMap, roughness: 0.55, metalness: 0.5, color: 0x888c94 });
  const toolboxColors = [0xc03030, 0x2050a0, 0x30a060, 0xe0a020];
  for (let i = 0; i < 5; i += 1) {
    const z = -depth / 2 + 15 + i * 18;
    [-1, 1].forEach((side) => {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 5.5), benchMat);
      bench.position.set(side * (width / 2 - 2), 0.7, z);
      group.add(bench);
      const drawers = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 1.2, 5.5),
        new THREE.MeshStandardMaterial({ color: 0x404550, roughness: 0.75 }),
      );
      drawers.position.set(side * (width / 2 - 2), 0, z);
      group.add(drawers);
      // Toolbox
      const tb = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.8, 1.5),
        new THREE.MeshStandardMaterial({
          color: toolboxColors[(i + (side > 0 ? 0 : 2)) % toolboxColors.length],
          roughness: 0.55, metalness: 0.4,
        }),
      );
      tb.position.set(side * (width / 2 - 2), 2.3, z);
      group.add(tb);
    });
  }

  // ---------- Shipping containers along back wall ----------
  const containerColors = [0x2060a0, 0xc06020, 0x208050, 0x8a2020, 0xa05080];
  for (let i = 0; i < 4; i += 1) {
    const color = containerColors[i % containerColors.length];
    const cMat = new THREE.MeshStandardMaterial({
      map: wallMap, roughness: 0.65, metalness: 0.4, color,
    });
    const container = new THREE.Mesh(new THREE.BoxGeometry(14, 6.5, 5.5), cMat);
    container.position.set(-width / 2 + 10 + i * 16, 3.25, -depth / 2 + 5);
    group.add(container);
  }

  // ---------- Oil drums ----------
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x2070b0, roughness: 0.55, metalness: 0.6 });
  const drumPositions = [[-42, -35], [42, -35], [-38, 38], [40, 36]];
  drumPositions.forEach(([cx, cz]) => {
    for (let i = 0; i < 4; i += 1) {
      const ox = (Math.random() - 0.5) * 3.5;
      const oz = (Math.random() - 0.5) * 3.5;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.5, 18), drumMat);
      drum.position.set(cx + ox, 0.75, cz + oz);
      group.add(drum);
    }
  });

  // ---------- Fire extinguishers ----------
  const extMat = new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.5, metalness: 0.45 });
  for (let i = 0; i < 3; i += 1) {
    const z = -depth / 2 + 25 + i * 28;
    [-1, 1].forEach((side) => {
      const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.3, 14), extMat);
      ext.position.set(side * (width / 2 - 0.4), 1.3, z);
      group.add(ext);
    });
  }

  // ---------- Warm sunlight from the open door ----------
  const doorSun = new THREE.DirectionalLight(0xffd0a0, 2.0);
  doorSun.position.set(20, height * 0.45, depth / 2 + 60);
  doorSun.target.position.set(-5, 2, -depth / 4);
  group.add(doorSun);
  group.add(doorSun.target);

  // Warm orange bounce light just inside the doorway (pool of light on floor)
  const doorBounce = new THREE.PointLight(0xffb070, 1.2, 70, 2);
  doorBounce.position.set(0, 6, depth / 2 - 12);
  group.add(doorBounce);

  // Warm floor patch where sun hits the concrete (flat additive glow)
  const sunPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 35),
    new THREE.MeshBasicMaterial({
      color: 0xffc080, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  sunPatch.rotation.x = -Math.PI / 2;
  sunPatch.position.set(0, 0.04, depth / 4);
  group.add(sunPatch);

  return { group };
}
