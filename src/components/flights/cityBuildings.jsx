import * as THREE from 'three';

// Procedurally generated "lit window" texture for a building facade.
// Creates a grid of windows, most of them glowing warm yellow (home/office
// lights at dusk), some dark. Cached by (cols,rows,tint) so we reuse canvases.
const litTextureCache = new Map();

export function makeLitWindowTexture(cols = 12, rows = 24, tint = 'warm') {
  const key = `${cols}x${rows}-${tint}`;
  if (litTextureCache.has(key)) return litTextureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  // Dark concrete/stone wall background.
  ctx.fillStyle = '#1a1f2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Subtle vertical bands = concrete panels.
  for (let c = 0; c < cols + 1; c += 1) {
    ctx.fillStyle = '#0f131b';
    const x = (c / cols) * canvas.width;
    ctx.fillRect(x - 1, 0, 2, canvas.height);
  }
  // Window colors pool.
  const warmLit = ['#ffd688', '#ffc06a', '#ffe0a0', '#ffb860', '#ffd080'];
  const coolLit = ['#b8d8ff', '#9ac0ff', '#d0e4ff', '#88b0ff'];
  const offPool = ['#0a0d14', '#12161f', '#0c1018'];

  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = c * cellW + cellW * 0.2;
      const y = r * cellH + cellH * 0.25;
      const w = cellW * 0.6;
      const h = cellH * 0.5;
      // 72% of windows are lit for a "busy city" look.
      const lit = Math.random() < 0.72;
      let color;
      if (lit) {
        const pool = tint === 'cool' ? coolLit : warmLit;
        color = pool[Math.floor(Math.random() * pool.length)];
      } else {
        color = offPool[Math.floor(Math.random() * offPool.length)];
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      // Soft glow around lit windows.
      if (lit) {
        ctx.fillStyle = color + '30';
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  litTextureCache.set(key, tex);
  return tex;
}

// Build a single lit building with emissive windows. The emissive map is the
// same lit-window texture, so the glowing parts of the facade stay bright
// even in dusk lighting without lighting up the whole building.
export function makeLitBuildingMaterial({ cols, rows, tint, emissiveBoost = 1 }) {
  const tex = makeLitWindowTexture(cols, rows, tint);
  return new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: emissiveBoost,
    roughness: 0.6,
    metalness: 0.25,
  });
}

// Adds a dense city district of varied buildings to the scene group.
// Centered at (centerX, centerZ), buildings spread within `radius`.
// Skips anything inside the given runway corridor rectangle to avoid clipping.
export function addCityDistrict(group, {
  centerX, centerZ, radius,
  buildingCount = 80,
  avoidCorridor = null, // { x0, x1, z0, z1 }
  minHeight = 18, maxHeight = 90,
}) {
  const insideCorridor = (x, z) => {
    if (!avoidCorridor) return false;
    const { x0, x1, z0, z1 } = avoidCorridor;
    return x > x0 && x < x1 && z > z0 && z < z1;
  };

  // Pre-build a few material variants so we share textures/canvases.
  const materialVariants = [
    makeLitBuildingMaterial({ cols: 10, rows: 20, tint: 'warm', emissiveBoost: 1.2 }),
    makeLitBuildingMaterial({ cols: 14, rows: 28, tint: 'warm', emissiveBoost: 1.0 }),
    makeLitBuildingMaterial({ cols: 8, rows: 16, tint: 'cool', emissiveBoost: 1.1 }),
    makeLitBuildingMaterial({ cols: 12, rows: 24, tint: 'warm', emissiveBoost: 1.3 }),
    makeLitBuildingMaterial({ cols: 16, rows: 32, tint: 'cool', emissiveBoost: 0.9 }),
  ];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.85 });

  let placed = 0;
  let attempts = 0;
  while (placed < buildingCount && attempts < buildingCount * 5) {
    attempts += 1;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * radius;
    const x = centerX + Math.cos(angle) * dist;
    const z = centerZ + Math.sin(angle) * dist;
    if (insideCorridor(x, z)) continue;

    const w = 10 + Math.random() * 22;
    const d = 10 + Math.random() * 22;
    const h = minHeight + Math.random() * (maxHeight - minHeight);
    const mat = materialVariants[Math.floor(Math.random() * materialVariants.length)];

    const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    building.position.set(x, h / 2 - 1.4, z);
    building.rotation.y = Math.random() * Math.PI;
    group.add(building);

    // Dark flat roof with a small parapet so skylines read clearly.
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.8, d * 1.04), roofMat);
    roof.position.set(x, h - 1.4 + 0.4, z);
    roof.rotation.y = building.rotation.y;
    group.add(roof);

    // Red obstruction beacon on tall buildings.
    if (h > 60) {
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff3030 }),
      );
      beacon.position.set(x, h - 1.4 + 1.2, z);
      group.add(beacon);
    }
    placed += 1;
  }
}

// Warehouse / industrial building with a large low footprint and a few
// small glowing windows along the top. Good for filling the industrial zone
// around the airport without adding more skyscrapers.
export function addWarehouseCluster(group, { centerX, centerZ, radius, count = 20 }) {
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a5060, roughness: 0.9, metalness: 0.2 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 });
  const windowStripMat = new THREE.MeshStandardMaterial({
    color: 0x1a1f28,
    emissive: 0xffd080,
    emissiveIntensity: 1.1,
    roughness: 0.4,
  });
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * radius;
    const x = centerX + Math.cos(angle) * dist;
    const z = centerZ + Math.sin(angle) * dist;
    const w = 25 + Math.random() * 45;
    const d = 18 + Math.random() * 35;
    const h = 8 + Math.random() * 6;
    const wh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wh.position.set(x, h / 2 - 1.4, z);
    wh.rotation.y = Math.random() * Math.PI;
    group.add(wh);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.6, d * 1.02), roofMat);
    roof.position.set(x, h - 1.4 + 0.3, z);
    roof.rotation.y = wh.rotation.y;
    group.add(roof);
    // Narrow glowing window strip near the top (industrial skylight look).
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.8, 0.3), windowStripMat);
    strip.position.set(x, h - 1.4 - 1.2, z + d / 2 + 0.15);
    strip.rotation.y = wh.rotation.y;
    group.add(strip);
  }
}