import * as THREE from 'three';

// Procedural canvas textures so we don't depend on external assets.
function makeConcreteTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  // Base concrete
  g.fillStyle = '#5a5d62';
  g.fillRect(0, 0, 512, 512);
  // Stains and grain
  for (let i = 0; i < 4000; i += 1) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 60 + Math.random() * 80;
    g.fillStyle = `rgba(${v},${v},${v + 5},${0.15 + Math.random() * 0.2})`;
    g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  // Joint lines (concrete slab seams)
  g.strokeStyle = 'rgba(20,20,25,0.7)';
  g.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
  }
  // Oil splotches
  for (let i = 0; i < 12; i += 1) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 8 + Math.random() * 24;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(10,10,15,0.7)');
    grad.addColorStop(1, 'rgba(10,10,15,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeCorrugatedMetalTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  // Base metal
  g.fillStyle = '#5e6772';
  g.fillRect(0, 0, 512, 512);
  // Vertical corrugation pattern (light/dark stripes)
  for (let x = 0; x < 512; x += 16) {
    const grad = g.createLinearGradient(x, 0, x + 16, 0);
    grad.addColorStop(0, '#3a4048');
    grad.addColorStop(0.5, '#7a838f');
    grad.addColorStop(1, '#3a4048');
    g.fillStyle = grad;
    g.fillRect(x, 0, 16, 512);
  }
  // Rust streaks at the bottom
  for (let i = 0; i < 25; i += 1) {
    const x = Math.random() * 512;
    const grad = g.createLinearGradient(x, 380, x, 512);
    grad.addColorStop(0, 'rgba(120,60,30,0)');
    grad.addColorStop(1, `rgba(${100 + Math.random() * 60},${40 + Math.random() * 30},20,${0.3 + Math.random() * 0.4})`);
    g.fillStyle = grad;
    g.fillRect(x, 380, 1 + Math.random() * 3, 132);
  }
  // Bolts
  g.fillStyle = '#2a2f36';
  for (let y = 32; y < 512; y += 96) {
    for (let x = 8; x < 512; x += 32) {
      g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeMetalRoofTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2f38';
  g.fillRect(0, 0, 512, 512);
  // Panel seams
  g.strokeStyle = 'rgba(10,12,16,0.9)';
  g.lineWidth = 3;
  for (let i = 0; i <= 512; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
  }
  // Slight grain
  for (let i = 0; i < 3000; i += 1) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Build a realistic, atmospheric hangar interior. Returns a THREE.Group plus
// references to animated lights so the caller can flicker / pulse them.
export function buildHangar({ width = 110, depth = 130, height = 55 } = {}) {
  const group = new THREE.Group();

  const concreteTex = makeConcreteTexture();
  concreteTex.repeat.set(width / 8, depth / 8);
  const wallTex = makeCorrugatedMetalTexture();
  wallTex.repeat.set(width / 6, height / 6);
  const sideWallTex = makeCorrugatedMetalTexture();
  sideWallTex.repeat.set(depth / 6, height / 6);
  const roofTex = makeMetalRoofTexture();
  roofTex.repeat.set(width / 8, depth / 8);

  // ---------- Floor ----------
  const floorMat = new THREE.MeshStandardMaterial({
    map: concreteTex, roughness: 0.75, metalness: 0.05,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // Painted parking circle (yellow ring + cross at center)
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
  // Red safety border (dashed)
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
      if (i === 0) { seg.position.set(offset, 0.024, -depth * 0.32); }
      if (i === 1) { seg.rotation.z = Math.PI / 2; seg.position.set(width * 0.37, 0.024, offset); }
      if (i === 2) { seg.position.set(offset, 0.024, depth * 0.32); }
      if (i === 3) { seg.rotation.z = Math.PI / 2; seg.position.set(-width * 0.37, 0.024, offset); }
      group.add(seg);
    }
  }
  // Tire skid marks
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0d, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 6; i += 1) {
    const skid = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 6 + Math.random() * 8), skidMat);
    skid.rotation.x = -Math.PI / 2;
    skid.rotation.z = (Math.random() - 0.5) * 0.4;
    skid.position.set((Math.random() - 0.5) * width * 0.4, 0.026, (Math.random() - 0.5) * depth * 0.5);
    group.add(skid);
  }

  // ---------- Walls ----------
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex, roughness: 0.65, metalness: 0.55,
  });
  const sideWallMat = new THREE.MeshStandardMaterial({
    map: sideWallTex, roughness: 0.65, metalness: 0.55,
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

  // ---------- Front wall with open doorway ----------
  // Two side panels framing the open hangar door
  const doorOpening = width * 0.7;
  const sidePanel = (width - doorOpening) / 2;
  [-1, 1].forEach((side) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(sidePanel, height),
      wallMat,
    );
    panel.position.set(side * (doorOpening / 2 + sidePanel / 2), height / 2, depth / 2);
    panel.rotation.y = Math.PI;
    group.add(panel);
  });
  // Top header above doorway
  const headerHeight = height * 0.12;
  const headerPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(doorOpening, headerHeight),
    wallMat,
  );
  headerPanel.position.set(0, height - headerHeight / 2, depth / 2);
  headerPanel.rotation.y = Math.PI;
  group.add(headerPanel);

  // ---------- Hangar door tracks (industrial frame) ----------
  const doorFrameMat = new THREE.MeshStandardMaterial({
    color: 0x6a7280, roughness: 0.5, metalness: 0.7,
  });
  const header = new THREE.Mesh(
    new THREE.BoxGeometry(width, 1.5, 1.2),
    doorFrameMat,
  );
  header.position.set(0, height - headerHeight - 0.5, depth / 2 - 0.2);
  group.add(header);
  [-1, 1].forEach((side) => {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, height, 1.2),
      doorFrameMat,
    );
    p.position.set(side * doorOpening / 2, height / 2, depth / 2 - 0.2);
    group.add(p);
  });

  // ---------- Ceiling with truss structure ----------
  const ceilingMat = new THREE.MeshStandardMaterial({
    map: roofTex, roughness: 0.85, metalness: 0.3,
  });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  group.add(ceiling);

  // Steel trusses
  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x3a4250, roughness: 0.55, metalness: 0.75,
  });
  for (let i = 0; i < 8; i += 1) {
    const z = -depth / 2 + (i + 0.5) * (depth / 8);
    // Main beam
    const truss = new THREE.Mesh(
      new THREE.BoxGeometry(width - 2, 0.8, 1.0),
      trussMat,
    );
    truss.position.set(0, height - 2.5, z);
    group.add(truss);
    // Triangular bracing
    for (let j = 0; j < 8; j += 1) {
      const x = -width / 2 + 5 + j * ((width - 10) / 7);
      const sup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 5, 6),
        trussMat,
      );
      sup.position.set(x, height - 5.5, z);
      group.add(sup);
      // Diagonal X-bracing
      if (j < 7) {
        const diag = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 6, 6),
          trussMat,
        );
        const dx = (width - 10) / 7;
        diag.position.set(x + dx / 2, height - 5.5, z);
        diag.rotation.z = Math.atan2(5, dx);
        group.add(diag);
      }
    }
  }
  // Cross trusses (perpendicular)
  for (let i = 0; i < 4; i += 1) {
    const x = -width / 2 + 8 + i * ((width - 16) / 3);
    const t = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, depth - 2),
      trussMat,
    );
    t.position.set(x, height - 3.5, 0);
    group.add(t);
  }

  // ---------- Hangar lights (mounted from ceiling on chains) ----------
  const lightMeshes = [];
  for (let i = 0; i < 5; i += 1) {
    const z = -depth / 2 + 12 + i * ((depth - 24) / 4);
    [-1, 1].forEach((side) => {
      const x = side * width * 0.28;
      // Suspension chain
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x1a1f28, roughness: 0.8 }),
      );
      chain.position.set(x, height - 6, z);
      group.add(chain);
      // Reflector housing (cone)
      const housing = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 1.8, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }),
      );
      housing.position.set(x, height - 11, z);
      group.add(housing);
      // Bulb
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff4d8 }),
      );
      bulb.position.set(x, height - 11.5, z);
      group.add(bulb);
      lightMeshes.push(bulb);
      // Light source
      const point = new THREE.PointLight(0xfff0d0, 1.6, 90, 1.6);
      point.position.set(x, height - 12, z);
      group.add(point);
    });
  }

  // ---------- High windows along upper walls (let daylight in) ----------
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x4a6a90, emissive: 0x6a90c0, emissiveIntensity: 0.4,
    roughness: 0.2, metalness: 0.6, transparent: true, opacity: 0.85,
  });
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 6; i += 1) {
      const z = -depth / 2 + 10 + i * ((depth - 20) / 5);
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 4),
        windowMat,
      );
      win.position.set(side * (width / 2 - 0.05), height - 6, z);
      win.rotation.y = -side * Math.PI / 2;
      group.add(win);
      // Window frame
      const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(8.4, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.6 }),
      );
      frame.position.set(side * (width / 2 - 0.04), height - 4, z);
      frame.rotation.y = -side * Math.PI / 2;
      group.add(frame);
    }
  });

  // ---------- Workbenches with toolboxes along back/side walls ----------
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x6a7080, roughness: 0.55, metalness: 0.5 });
  const drawerMat = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.75 });
  const toolboxColors = [0xc04030, 0x3050a0, 0xc04030, 0x40a060, 0xc04030];
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
          new THREE.MeshStandardMaterial({ color: toolboxColors[i % toolboxColors.length], roughness: 0.55, metalness: 0.45 }),
        );
        tb.position.set(side * (width / 2 - 1.7), 2.0, z);
        group.add(tb);
      }
    });
  }

  // ---------- Maintenance stands (rolling stairs near aircraft) ----------
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
  stairs1.position.set(18, 0, 5);
  stairs1.rotation.y = -Math.PI / 4;
  group.add(stairs1);
  const stairs2 = buildStairs();
  stairs2.position.set(-18, 0, -5);
  stairs2.rotation.y = (Math.PI * 3) / 4;
  group.add(stairs2);

  // ---------- Fire extinguishers along walls (red boxes) ----------
  const extMat = new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.5, metalness: 0.4 });
  for (let i = 0; i < 4; i += 1) {
    const z = -depth / 2 + 16 + i * 20;
    [-1, 1].forEach((side) => {
      const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 12), extMat);
      ext.position.set(side * (width / 2 - 0.3), 1.2, z);
      group.add(ext);
    });
  }

  // ---------- Distant view through open door (sky gradient + ground) ----------
  const skyGeo = new THREE.PlaneGeometry(width * 1.5, height);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(0x6a90c0) },
      bottom: { value: new THREE.Color(0xc4d4e8) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec2 vUv; void main(){ gl_FragColor=vec4(mix(bottom,top,vUv.y),1.0); }',
    side: THREE.DoubleSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(0, height / 2, depth / 2 + 12);
  group.add(sky);
  // Tarmac visible through door
  const tarmac = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.5, 30),
    new THREE.MeshStandardMaterial({ color: 0x383d44, roughness: 0.85 }),
  );
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.set(0, 0.01, depth / 2 + 14);
  group.add(tarmac);

  return { group, lightMeshes };
}