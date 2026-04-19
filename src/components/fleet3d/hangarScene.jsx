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

    // Sparse modern saw-cut seams (no tile grid look).
    g.strokeStyle = 'rgba(72,78,90,0.35)';
    g.lineWidth = 1.5;
    [w * 0.33, w * 0.68].forEach((x) => {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    });
    [h * 0.42].forEach((y) => {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    });
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
    // Rust streaks
    for (let i = 0; i < 6; i += 1) {
      const x = Math.random() * w;
      const grd2 = g.createLinearGradient(x, 0, x + 8, 0);
      grd2.addColorStop(0, 'rgba(110,55,30,0)');
      grd2.addColorStop(0.5, 'rgba(110,55,30,0.45)');
      grd2.addColorStop(1, 'rgba(110,55,30,0)');
      g.fillStyle = grd2;
      g.fillRect(x, Math.random() * h, 10, 40 + Math.random() * 80);
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

// --- Outside view: sunset sky + airport scene painted onto a backdrop ---
function outsideViewTex() {
  return makeCanvasTex('outsideview', 1024, 512, (g, w, h) => {
    // Sky gradient (dusk)
    const sky = g.createLinearGradient(0, 0, 0, h * 0.75);
    sky.addColorStop(0, '#1a2a4a');
    sky.addColorStop(0.35, '#4a5a82');
    sky.addColorStop(0.6, '#d88050');
    sky.addColorStop(0.85, '#f0b070');
    sky.addColorStop(1, '#fdd090');
    g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.75);

    // Sun
    const sunX = w * 0.72, sunY = h * 0.5;
    const sunGrd = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, 120);
    sunGrd.addColorStop(0, 'rgba(255,245,220,1)');
    sunGrd.addColorStop(0.3, 'rgba(255,200,130,0.8)');
    sunGrd.addColorStop(1, 'rgba(255,150,80,0)');
    g.fillStyle = sunGrd;
    g.fillRect(sunX - 120, sunY - 120, 240, 240);
    g.fillStyle = '#fff6d8';
    g.beginPath(); g.arc(sunX, sunY, 35, 0, Math.PI * 2); g.fill();

    // Distant mountains
    g.fillStyle = '#2a3550';
    g.beginPath(); g.moveTo(0, h * 0.7);
    const peaks = [0.05, 0.12, 0.2, 0.28, 0.38, 0.48, 0.58, 0.68, 0.78, 0.88, 1.0];
    peaks.forEach((p) => g.lineTo(p * w, h * (0.55 + Math.random() * 0.1)));
    g.lineTo(w, h * 0.7); g.closePath(); g.fill();

    // Ground / apron
    const ground = g.createLinearGradient(0, h * 0.75, 0, h);
    ground.addColorStop(0, '#3a3f48');
    ground.addColorStop(1, '#2a2d34');
    g.fillStyle = ground; g.fillRect(0, h * 0.75, w, h * 0.25);

    // Runway (horizontal strip)
    g.fillStyle = '#1a1d22'; g.fillRect(0, h * 0.78, w, h * 0.04);
    // Runway centerline dashes
    g.fillStyle = '#f0e8c0';
    for (let x = 0; x < w; x += 40) g.fillRect(x, h * 0.80, 20, 2);
    // Runway edge lights
    g.fillStyle = '#ffe080';
    for (let x = 0; x < w; x += 25) {
      g.beginPath(); g.arc(x, h * 0.78, 2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x, h * 0.82, 2, 0, Math.PI * 2); g.fill();
    }

    // Terminal building
    g.fillStyle = '#3a4454';
    g.fillRect(w * 0.08, h * 0.62, w * 0.3, h * 0.16);
    // Glass windows (lit)
    for (let x = 0; x < w * 0.3; x += 12) {
      for (let y = 0; y < h * 0.14; y += 8) {
        g.fillStyle = Math.random() > 0.3 ? `rgba(255,${220 + Math.random() * 35},${100 + Math.random() * 80},0.9)` : 'rgba(60,70,85,0.9)';
        g.fillRect(w * 0.08 + 3 + x, h * 0.63 + y, 7, 4);
      }
    }
    // Terminal roof
    g.fillStyle = '#2a313c';
    g.fillRect(w * 0.075, h * 0.61, w * 0.31, h * 0.012);

    // Control tower
    g.fillStyle = '#4a5462';
    g.fillRect(w * 0.42, h * 0.48, w * 0.025, h * 0.27);
    g.fillStyle = '#1a2230';
    g.fillRect(w * 0.41, h * 0.45, w * 0.045, h * 0.04);
    // Tower lit windows
    g.fillStyle = '#ffd580';
    g.fillRect(w * 0.415, h * 0.455, w * 0.035, h * 0.02);
    // Beacon
    g.fillStyle = '#ff3030';
    g.beginPath(); g.arc(w * 0.4325, h * 0.44, 3, 0, Math.PI * 2); g.fill();

    // Parked airliner
    g.fillStyle = '#e8ecf2';
    g.fillRect(w * 0.5, h * 0.73, w * 0.18, h * 0.025);
    // Tail fin
    g.fillStyle = '#2a4a8a';
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.73);
    g.lineTo(w * 0.505, h * 0.69);
    g.lineTo(w * 0.515, h * 0.73);
    g.closePath(); g.fill();
    // Wings
    g.fillStyle = '#d0d4dc';
    g.fillRect(w * 0.56, h * 0.745, w * 0.06, h * 0.01);
    // Windows strip
    g.fillStyle = '#0a0f1a';
    g.fillRect(w * 0.52, h * 0.737, w * 0.14, h * 0.003);

    // Distant hangars
    g.fillStyle = '#3a4250';
    g.fillRect(w * 0.75, h * 0.66, w * 0.15, h * 0.1);
    g.fillStyle = '#2a313c';
    g.beginPath();
    g.moveTo(w * 0.745, h * 0.66);
    g.lineTo(w * 0.825, h * 0.63);
    g.lineTo(w * 0.905, h * 0.66);
    g.closePath(); g.fill();

    // Ground markings (taxiway line)
    g.strokeStyle = '#e8c040'; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, h * 0.92);
    g.bezierCurveTo(w * 0.4, h * 0.86, w * 0.6, h * 0.95, w, h * 0.9);
    g.stroke();
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

export function buildHangar({ width = 110, depth = 130, height = 55 } = {}) {
  const group = new THREE.Group();

  const concreteMap = concreteTex();
  const wallMap = wallTex();
  const roofMap = roofTex();
  const steelMap = steelTex();
  const doorMap = hangarDoorTex();
  const outsideMap = outsideViewTex();

  // ---------- Floor ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    makeTexturedMat({ tex: concreteMap, repeat: [width / 14, depth / 14], color: 0xd2d7df, roughness: 0.58, metalness: 0.04 }),
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

  // ---------- Back wall ----------
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    makeTexturedMat({ tex: wallMap, repeat: [width / 8, height / 8], color: 0x9aa0aa, roughness: 0.75, metalness: 0.45 }),
  );
  backWall.position.set(0, height / 2, -depth / 2);
  group.add(backWall);

  // ---------- Side walls ----------
  [-1, 1].forEach((side) => {
    const sideWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height),
      makeTexturedMat({ tex: wallMap, repeat: [depth / 8, height / 8], color: 0x9aa0aa, roughness: 0.75, metalness: 0.45 }),
    );
    sideWall.rotation.y = side * Math.PI / 2;
    sideWall.position.set(side * width / 2, height / 2, 0);
    group.add(sideWall);
  });

  // ---------- Front wall with OPEN DOORWAY ----------
  const doorOpeningW = width * 0.78;
  const doorOpeningH = height * 0.82;
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

  // ---------- OUTSIDE VIEW BACKDROP (airport scene) ----------
  // A big textured plane positioned behind the door opening so the painted
  // airport scene reads as what's outside the hangar.
  const outsideBackdropW = doorOpeningW * 2.5;
  const outsideBackdropH = doorOpeningH * 1.8;
  const outsideBackdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(outsideBackdropW, outsideBackdropH),
    new THREE.MeshBasicMaterial({ map: outsideMap.clone() }),
  );
  outsideBackdrop.position.set(0, outsideBackdropH / 2 - 1, depth / 2 + 80);
  group.add(outsideBackdrop);

  // ---------- HANGAR ROLL-UP DOOR (partially open, showing texture clearly) ----------
  // Door is rolled up ~70% so the opening reveals the outside view, but the
  // remaining door panel at the top is fully visible with texture.
  const doorPanelH = doorOpeningH * 0.25; // visible portion at the top
  const hangarDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(doorOpeningW, doorPanelH),
    new THREE.MeshStandardMaterial({
      map: doorMap, roughness: 0.55, metalness: 0.6,
    }),
  );
  hangarDoor.position.set(0, doorOpeningH - doorPanelH / 2, depth / 2 - 0.2);
  hangarDoor.rotation.y = Math.PI;
  group.add(hangarDoor);

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
  const frameHazard = new THREE.Mesh(new THREE.BoxGeometry(doorOpeningW + 3, 0.8, 1.6), makeHazardMat());
  frameHazard.material.map.repeat.set(30, 1);
  frameHazard.position.set(0, 0.4, depth / 2 - 0.2);
  group.add(frameHazard);

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
