import * as THREE from 'three';

// Real PBR textures from Poly Haven (CC0) so every surface is photographic
// instead of flat colored geometry.
const PH = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k';
const TEX_URLS = {
  // Floor: polished concrete with subtle cracks
  floorDiff: `${PH}/concrete_floor_worn_001/concrete_floor_worn_001_diff_2k.jpg`,
  floorNor: `${PH}/concrete_floor_worn_001/concrete_floor_worn_001_nor_gl_2k.jpg`,
  floorRough: `${PH}/concrete_floor_worn_001/concrete_floor_worn_001_rough_2k.jpg`,
  // Walls: corrugated iron (classic hangar cladding)
  wallDiff: `${PH}/corrugated_iron_03/corrugated_iron_03_diff_2k.jpg`,
  wallNor: `${PH}/corrugated_iron_03/corrugated_iron_03_nor_gl_2k.jpg`,
  wallRough: `${PH}/corrugated_iron_03/corrugated_iron_03_rough_2k.jpg`,
  // Ceiling: painted metal panels
  ceilDiff: `${PH}/metal_plate/metal_plate_diff_2k.jpg`,
  ceilNor: `${PH}/metal_plate/metal_plate_nor_gl_2k.jpg`,
  // Structural beams: rusty steel I-beams
  steelDiff: `${PH}/rust_coarse_01/rust_coarse_01_diff_2k.jpg`,
  steelNor: `${PH}/rust_coarse_01/rust_coarse_01_nor_gl_2k.jpg`,
  // Wood for pallets / crates
  woodDiff: `${PH}/plywood_diff_2k.jpg`,
  woodNor: `${PH}/plywood_nor_gl_2k.jpg`,
  // Painted red metal for fire extinguishers / tool carts
  paintedRedDiff: `${PH}/painted_metal_02/painted_metal_02_diff_2k.jpg`,
  paintedRedNor: `${PH}/painted_metal_02/painted_metal_02_nor_gl_2k.jpg`,
};

const texCache = new Map();
function loadTex(url, srgb = true) {
  const key = `${url}|${srgb}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = new THREE.TextureLoader().load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}

function pbrMat({ diff, nor, rough, repeat = [1, 1], color = 0xffffff, roughness = 0.8, metalness = 0.1 }) {
  const map = loadTex(diff, true).clone();
  map.needsUpdate = true;
  map.repeat.set(repeat[0], repeat[1]);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map, color, roughness, metalness });
  if (nor) {
    const normalMap = loadTex(nor, false).clone();
    normalMap.needsUpdate = true;
    normalMap.repeat.set(repeat[0], repeat[1]);
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    mat.normalMap = normalMap;
    mat.normalScale = new THREE.Vector2(1, 1);
  }
  if (rough) {
    const roughnessMap = loadTex(rough, false).clone();
    roughnessMap.needsUpdate = true;
    roughnessMap.repeat.set(repeat[0], repeat[1]);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    mat.roughnessMap = roughnessMap;
  }
  return mat;
}

// Procedural painted line texture for safety zones (fallback for details)
function makePaintedLineCanvas() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#f0c040'; g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#1a1a1a';
  for (let i = 0; i < 256; i += 32) g.fillRect(i, 0, 16, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildHangar({ width = 110, depth = 130, height = 55 } = {}) {
  const group = new THREE.Group();

  // ---------- Floor (real concrete PBR, large repeat for scale) ----------
  const floorMat = pbrMat({
    diff: TEX_URLS.floorDiff, nor: TEX_URLS.floorNor, rough: TEX_URLS.floorRough,
    repeat: [width / 6, depth / 6], color: 0xb5b8bd, roughness: 0.85, metalness: 0.1,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // Painted parking circle (yellow ring + cross)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(13, 13.6, 64),
    new THREE.MeshBasicMaterial({ color: 0xf0c040, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);
  [0, Math.PI / 2].forEach((rot) => {
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 0.45),
      new THREE.MeshBasicMaterial({ color: 0xf0c040 }),
    );
    bar.rotation.x = -Math.PI / 2;
    bar.rotation.z = rot;
    bar.position.y = 0.025;
    group.add(bar);
  });

  // Dashed red safety perimeter
  for (let i = 0; i < 4; i += 1) {
    const isLong = i % 2 === 0;
    const len = isLong ? width * 0.75 : depth * 0.65;
    const segments = Math.floor(len / 4);
    for (let s = 0; s < segments; s += 1) {
      if (s % 2 === 1) continue;
      const seg = new THREE.Mesh(
        new THREE.PlaneGeometry(2.5, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xc02020 }),
      );
      seg.rotation.x = -Math.PI / 2;
      const offset = -len / 2 + (s + 0.5) * 4;
      if (i === 0) seg.position.set(offset, 0.024, -depth * 0.32);
      if (i === 1) { seg.rotation.z = Math.PI / 2; seg.position.set(width * 0.37, 0.024, offset); }
      if (i === 2) seg.position.set(offset, 0.024, depth * 0.32);
      if (i === 3) { seg.rotation.z = Math.PI / 2; seg.position.set(-width * 0.37, 0.024, offset); }
      group.add(seg);
    }
  }

  // Painted yellow/black hatched hazard strips (safety zones)
  const hazardTex = makePaintedLineCanvas();
  hazardTex.repeat.set(10, 1);
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.9 });
  [-1, 1].forEach((side) => {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(60, 1.2), hazardMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(side * 25, 0.027, side * 30);
    group.add(strip);
  });

  // Tire skid marks
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0d, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 10; i += 1) {
    const skid = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 6 + Math.random() * 8), skidMat);
    skid.rotation.x = -Math.PI / 2;
    skid.rotation.z = (Math.random() - 0.5) * 0.4;
    skid.position.set((Math.random() - 0.5) * width * 0.4, 0.026, (Math.random() - 0.5) * depth * 0.5);
    group.add(skid);
  }

  // ---------- Walls (real corrugated iron PBR) ----------
  const wallMat = pbrMat({
    diff: TEX_URLS.wallDiff, nor: TEX_URLS.wallNor, rough: TEX_URLS.wallRough,
    repeat: [width / 8, height / 6], color: 0x8a9098, roughness: 0.7, metalness: 0.4,
  });
  const sideWallMat = pbrMat({
    diff: TEX_URLS.wallDiff, nor: TEX_URLS.wallNor, rough: TEX_URLS.wallRough,
    repeat: [depth / 8, height / 6], color: 0x8a9098, roughness: 0.7, metalness: 0.4,
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
  back.position.set(0, height / 2, -depth / 2);
  group.add(back);
  [-1, 1].forEach((side) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), sideWallMat);
    w.rotation.y = side * Math.PI / 2;
    w.position.set(side * width / 2, height / 2, 0);
    group.add(w);
  });

  // Front wall with open doorway
  const doorOpening = width * 0.7;
  const sidePanel = (width - doorOpening) / 2;
  [-1, 1].forEach((side) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(sidePanel, height), wallMat);
    panel.position.set(side * (doorOpening / 2 + sidePanel / 2), height / 2, depth / 2);
    panel.rotation.y = Math.PI;
    group.add(panel);
  });
  const headerHeight = height * 0.12;
  const headerPanel = new THREE.Mesh(new THREE.PlaneGeometry(doorOpening, headerHeight), wallMat);
  headerPanel.position.set(0, height - headerHeight / 2, depth / 2);
  headerPanel.rotation.y = Math.PI;
  group.add(headerPanel);

  // Door track frame (rusty steel)
  const steelMat = pbrMat({
    diff: TEX_URLS.steelDiff, nor: TEX_URLS.steelNor,
    repeat: [4, 1], color: 0x8a8278, roughness: 0.65, metalness: 0.55,
  });
  const header = new THREE.Mesh(new THREE.BoxGeometry(width, 1.5, 1.2), steelMat);
  header.position.set(0, height - headerHeight - 0.5, depth / 2 - 0.2);
  group.add(header);
  [-1, 1].forEach((side) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, height, 1.2), steelMat);
    p.position.set(side * doorOpening / 2, height / 2, depth / 2 - 0.2);
    group.add(p);
  });

  // ---------- Ceiling (metal plate PBR) ----------
  const ceilMat = pbrMat({
    diff: TEX_URLS.ceilDiff, nor: TEX_URLS.ceilNor,
    repeat: [width / 10, depth / 10], color: 0x3a4048, roughness: 0.9, metalness: 0.3,
  });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  group.add(ceiling);

  // Steel trusses (rusty I-beam look via PBR)
  const trussMat = pbrMat({
    diff: TEX_URLS.steelDiff, nor: TEX_URLS.steelNor,
    repeat: [3, 0.5], color: 0x5a5048, roughness: 0.65, metalness: 0.7,
  });
  for (let i = 0; i < 8; i += 1) {
    const z = -depth / 2 + (i + 0.5) * (depth / 8);
    const truss = new THREE.Mesh(new THREE.BoxGeometry(width - 2, 0.8, 1.0), trussMat);
    truss.position.set(0, height - 2.5, z);
    group.add(truss);
    for (let j = 0; j < 8; j += 1) {
      const x = -width / 2 + 5 + j * ((width - 10) / 7);
      const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5, 6), trussMat);
      sup.position.set(x, height - 5.5, z);
      group.add(sup);
      if (j < 7) {
        const diag = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), trussMat);
        const dx = (width - 10) / 7;
        diag.position.set(x + dx / 2, height - 5.5, z);
        diag.rotation.z = Math.atan2(5, dx);
        group.add(diag);
      }
    }
  }
  for (let i = 0; i < 4; i += 1) {
    const x = -width / 2 + 8 + i * ((width - 16) / 3);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, depth - 2), trussMat);
    t.position.set(x, height - 3.5, 0);
    group.add(t);
  }

  // ---------- Hangar lights (chained from ceiling) ----------
  for (let i = 0; i < 5; i += 1) {
    const z = -depth / 2 + 12 + i * ((depth - 24) / 4);
    [-1, 1].forEach((side) => {
      const x = side * width * 0.28;
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x1a1f28, roughness: 0.8 }),
      );
      chain.position.set(x, height - 6, z);
      group.add(chain);
      const housing = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 1.8, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }),
      );
      housing.position.set(x, height - 11, z);
      group.add(housing);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff4d8 }),
      );
      bulb.position.set(x, height - 11.5, z);
      group.add(bulb);
      const point = new THREE.PointLight(0xfff0d0, 1.8, 95, 1.6);
      point.position.set(x, height - 12, z);
      group.add(point);
    });
  }

  // ---------- Windows (emissive glass) ----------
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x4a6a90, emissive: 0x6a90c0, emissiveIntensity: 0.4,
    roughness: 0.2, metalness: 0.6, transparent: true, opacity: 0.85,
  });
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 6; i += 1) {
      const z = -depth / 2 + 10 + i * ((depth - 20) / 5);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), windowMat);
      win.position.set(side * (width / 2 - 0.05), height - 6, z);
      win.rotation.y = -side * Math.PI / 2;
      group.add(win);
      const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(8.4, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.6 }),
      );
      frame.position.set(side * (width / 2 - 0.04), height - 4, z);
      frame.rotation.y = -side * Math.PI / 2;
      group.add(frame);
    }
  });

  // ---------- Workbenches along walls (with toolboxes) ----------
  const benchMat = pbrMat({
    diff: TEX_URLS.steelDiff, nor: TEX_URLS.steelNor,
    repeat: [2, 0.8], color: 0x7a8088, roughness: 0.6, metalness: 0.45,
  });
  const drawerMat = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.75 });
  const toolboxRedMat = pbrMat({
    diff: TEX_URLS.paintedRedDiff, nor: TEX_URLS.paintedRedNor,
    repeat: [1.5, 1], color: 0xc04030, roughness: 0.55, metalness: 0.45,
  });
  const toolboxBlueMat = pbrMat({
    diff: TEX_URLS.paintedRedDiff, nor: TEX_URLS.paintedRedNor,
    repeat: [1.5, 1], color: 0x3050a0, roughness: 0.55, metalness: 0.45,
  });
  for (let i = 0; i < 6; i += 1) {
    const z = -depth / 2 + 10 + i * 12;
    [-1, 1].forEach((side) => {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 5), benchMat);
      bench.position.set(side * (width / 2 - 1.7), 0.6, z);
      group.add(bench);
      const drawers = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.0, 5), drawerMat);
      drawers.position.set(side * (width / 2 - 1.7), 0, z);
      group.add(drawers);
      if (i % 2 === 0) {
        const tb = new THREE.Mesh(
          new THREE.BoxGeometry(2.0, 1.6, 1.4),
          i % 4 === 0 ? toolboxRedMat : toolboxBlueMat,
        );
        tb.position.set(side * (width / 2 - 1.7), 2.0, z);
        group.add(tb);
      }
    });
  }

  // ---------- Rolling maintenance stairs ----------
  const stairsMat = new THREE.MeshStandardMaterial({ color: 0xf0c020, roughness: 0.55, metalness: 0.55 });
  const buildStairs = () => {
    const s = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 5), stairsMat);
    base.position.y = 0.15;
    s.add(base);
    for (let i = 0; i < 12; i += 1) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 0.7), stairsMat);
      step.position.set(0, 0.4 + i * 0.55, -2 + i * 0.4);
      s.add(step);
    }
    const platform = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.25, 2.5), stairsMat);
    platform.position.set(0, 6.9, 2.8);
    s.add(platform);
    [-1, 1].forEach((side) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 5), stairsMat);
      rail.position.set(side * 1.6, 7.6, 0.5);
      s.add(rail);
    });
    return s;
  };
  const stairs1 = buildStairs();
  stairs1.position.set(22, 0, 8);
  stairs1.rotation.y = -Math.PI / 4;
  group.add(stairs1);
  const stairs2 = buildStairs();
  stairs2.position.set(-22, 0, -8);
  stairs2.rotation.y = (Math.PI * 3) / 4;
  group.add(stairs2);

  // ---------- Shipping containers (blue/orange) along back wall ----------
  const containerColors = [0x2060a0, 0xc06020, 0x208050, 0x8a2020];
  for (let i = 0; i < 5; i += 1) {
    const color = containerColors[i % containerColors.length];
    const cMat = pbrMat({
      diff: TEX_URLS.wallDiff, nor: TEX_URLS.wallNor,
      repeat: [3, 1], color, roughness: 0.6, metalness: 0.4,
    });
    const container = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 5), cMat);
    container.position.set(-width / 2 + 8 + i * 13, 3, -depth / 2 + 6);
    group.add(container);
    // Stack some on top
    if (i % 2 === 0) {
      const cMat2 = pbrMat({
        diff: TEX_URLS.wallDiff, nor: TEX_URLS.wallNor,
        repeat: [3, 1], color: containerColors[(i + 1) % containerColors.length],
        roughness: 0.6, metalness: 0.4,
      });
      const stacked = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 5), cMat2);
      stacked.position.set(-width / 2 + 8 + i * 13, 9.1, -depth / 2 + 6);
      group.add(stacked);
    }
  }

  // ---------- Wooden pallets with crates ----------
  const woodMat = pbrMat({
    diff: TEX_URLS.woodDiff, nor: TEX_URLS.woodNor,
    repeat: [1, 1], color: 0xc49060, roughness: 0.85, metalness: 0.05,
  });
  const palletPositions = [
    [-30, -25], [-35, -22], [28, -30], [32, -28], [-40, 20], [38, 15],
    [-15, -38], [20, -40],
  ];
  palletPositions.forEach(([x, z]) => {
    // Pallet base
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 2.5), woodMat);
    pallet.position.set(x, 0.15, z);
    group.add(pallet);
    // Stacked crate
    if (Math.random() > 0.3) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 2.2), woodMat);
      crate.position.set(x, 1.2, z);
      crate.rotation.y = Math.random() * 0.4 - 0.2;
      group.add(crate);
    }
  });

  // ---------- Oil drums ----------
  const drumMat = pbrMat({
    diff: TEX_URLS.paintedRedDiff, nor: TEX_URLS.paintedRedNor,
    repeat: [1, 1], color: 0x206ba0, roughness: 0.6, metalness: 0.5,
  });
  const drumGroupPositions = [[-42, -35], [42, -38], [-38, 35], [40, 32]];
  drumGroupPositions.forEach(([cx, cz]) => {
    for (let i = 0; i < 5; i += 1) {
      const ox = (Math.random() - 0.5) * 4;
      const oz = (Math.random() - 0.5) * 4;
      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 1.4, 18),
        drumMat,
      );
      drum.position.set(cx + ox, 0.7, cz + oz);
      group.add(drum);
      // Top rim
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.6, 0.05, 6, 18),
        new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.6, metalness: 0.7 }),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(cx + ox, 1.4, cz + oz);
      group.add(rim);
    }
  });

  // ---------- Fuel truck silhouette parked in back ----------
  const truckBodyMat = new THREE.MeshStandardMaterial({ color: 0xd4d8dc, roughness: 0.5, metalness: 0.55 });
  const truckTankMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.6 });
  const truckTireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const truck = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.8, 2.8), truckBodyMat);
  cab.position.set(-3, 1.6, 0);
  truck.add(cab);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 7, 20), truckTankMat);
  tank.rotation.z = Math.PI / 2;
  tank.position.set(2.5, 2, 0);
  truck.add(tank);
  [-1.5, 1.5].forEach((xOff) => {
    [-1.4, 1.4].forEach((zOff) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 16), truckTireMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(xOff, 0.7, zOff);
      truck.add(wheel);
    });
  });
  // "FUEL" text plate
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xd43030, roughness: 0.5 }),
  );
  plate.position.set(2.5, 3.7, 1.7);
  truck.add(plate);
  truck.position.set(-35, 0, 25);
  truck.rotation.y = Math.PI / 6;
  group.add(truck);

  // ---------- Fire extinguisher stations ----------
  const extMat = pbrMat({
    diff: TEX_URLS.paintedRedDiff, nor: TEX_URLS.paintedRedNor,
    repeat: [1, 1], color: 0xc02020, roughness: 0.5, metalness: 0.4,
  });
  for (let i = 0; i < 4; i += 1) {
    const z = -depth / 2 + 16 + i * 20;
    [-1, 1].forEach((side) => {
      const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 14), extMat);
      ext.position.set(side * (width / 2 - 0.3), 1.2, z);
      group.add(ext);
      // Mount plate
      const mount = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 1.8, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 }),
      );
      mount.position.set(side * (width / 2 - 0.05), 1.2, z);
      group.add(mount);
    });
  }

  // ---------- Ceiling ventilation ducts ----------
  const ductMat = new THREE.MeshStandardMaterial({ color: 0xa0a5ad, roughness: 0.5, metalness: 0.7 });
  for (let i = 0; i < 3; i += 1) {
    const x = -20 + i * 20;
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, depth - 10, 12), ductMat);
    duct.rotation.x = Math.PI / 2;
    duct.position.set(x, height - 6, 0);
    group.add(duct);
  }

  // ---------- Hanging warning signs ----------
  const signs = [
    { color: 0xf0c040, text: 'CAUTION' },
    { color: 0xc02020, text: 'NO SMOKING' },
    { color: 0x20a0c0, text: 'HANGAR 3' },
  ];
  signs.forEach((s, i) => {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 1),
      new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.6, side: THREE.DoubleSide }),
    );
    sign.position.set(-20 + i * 20, height - 10, -depth / 2 + 8);
    group.add(sign);
    // Hang strings
    [-1.5, 1.5].forEach((xOff) => {
      const string = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 3, 6),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a }),
      );
      string.position.set(-20 + i * 20 + xOff, height - 8.5, -depth / 2 + 8);
      group.add(string);
    });
  });

  // ---------- Conveyor belt (baggage loader) ----------
  const conveyorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const conveyorFrame = new THREE.MeshStandardMaterial({ color: 0xf0c020, roughness: 0.6, metalness: 0.4 });
  const conveyor = new THREE.Group();
  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 10), conveyorMat);
  belt.position.y = 1.5;
  conveyor.add(belt);
  const frame1 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 10), conveyorFrame);
  frame1.position.y = 1.3;
  conveyor.add(frame1);
  // Legs
  [-4, 4].forEach((zOff) => {
    [-0.9, 0.9].forEach((xOff) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.5, 0.15), conveyorFrame);
      leg.position.set(xOff, 0.75, zOff);
      conveyor.add(leg);
    });
  });
  // Tilt it up
  conveyor.rotation.x = -0.15;
  conveyor.position.set(25, 0, -15);
  conveyor.rotation.y = Math.PI / 4;
  group.add(conveyor);

  // ---------- Tow tractor (tug) ----------
  const tugBodyMat = new THREE.MeshStandardMaterial({ color: 0xf04020, roughness: 0.5, metalness: 0.5 });
  const tug = new THREE.Group();
  const tugBody = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 2), tugBodyMat);
  tugBody.position.y = 1.0;
  tug.add(tugBody);
  const tugCab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.8), tugBodyMat);
  tugCab.position.set(-0.5, 2.3, 0);
  tug.add(tugCab);
  [-1, 1].forEach((xOff) => {
    [-0.8, 0.8].forEach((zOff) => {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.4, 12),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }),
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(xOff * 1.2, 0.45, zOff);
      tug.add(wheel);
    });
  });
  tug.position.set(30, 0, 25);
  tug.rotation.y = -Math.PI / 3;
  group.add(tug);

  // ---------- Distant view: sky gradient + tarmac ----------
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(0x6a90c0) },
      bottom: { value: new THREE.Color(0xc4d4e8) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec2 vUv; void main(){ gl_FragColor=vec4(mix(bottom,top,vUv.y),1.0); }',
    side: THREE.DoubleSide,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.5, height), skyMat);
  sky.position.set(0, height / 2, depth / 2 + 12);
  group.add(sky);
  const tarmac = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.5, 30),
    new THREE.MeshStandardMaterial({ color: 0x383d44, roughness: 0.85 }),
  );
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.set(0, 0.01, depth / 2 + 14);
  group.add(tarmac);

  return { group };
}