import * as THREE from 'three';

// Build a realistic, atmospheric hangar interior. Returns a THREE.Group plus
// references to animated lights so the caller can flicker / pulse them.
export function buildHangar({ width = 80, depth = 100, height = 28 } = {}) {
  const group = new THREE.Group();

  // ---------- Floor: polished concrete with painted markings ----------
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f38, roughness: 0.55, metalness: 0.15,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Painted parking circle in the middle (yellow ring).
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(11, 11.5, 64),
    new THREE.MeshBasicMaterial({ color: 0xf0c040, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  group.add(ring);
  // Cross at center
  [0, Math.PI / 2].forEach((rot) => {
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xf0c040 }),
    );
    bar.rotation.x = -Math.PI / 2;
    bar.rotation.z = rot;
    bar.position.y = 0.011;
    group.add(bar);
  });

  // Red safety border around parking area
  for (let i = 0; i < 4; i += 1) {
    const len = i % 2 === 0 ? width * 0.7 : depth * 0.6;
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(len, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xc02020 }),
    );
    bar.rotation.x = -Math.PI / 2;
    bar.position.y = 0.012;
    if (i === 0) bar.position.set(0, 0.012, -depth * 0.3);
    if (i === 1) { bar.rotation.z = Math.PI / 2; bar.position.set(width * 0.35, 0.012, 0); }
    if (i === 2) bar.position.set(0, 0.012, depth * 0.3);
    if (i === 3) { bar.rotation.z = Math.PI / 2; bar.position.set(-width * 0.35, 0.012, 0); }
    group.add(bar);
  }

  // ---------- Walls: corrugated metal ----------
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x4a5260, roughness: 0.7, metalness: 0.45,
  });
  // Back wall
  const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
  back.position.set(0, height / 2, -depth / 2);
  group.add(back);
  // Side walls
  [-1, 1].forEach((side) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat);
    w.rotation.y = side * Math.PI / 2;
    w.position.set(side * width / 2, height / 2, 0);
    group.add(w);
  });

  // ---------- Hangar door (open, framing the back) ----------
  // Front opening with horizontal door tracks visible.
  const doorFrameMat = new THREE.MeshStandardMaterial({
    color: 0x6a7280, roughness: 0.5, metalness: 0.7,
  });
  // Top header beam
  const header = new THREE.Mesh(
    new THREE.BoxGeometry(width, 1.5, 1),
    doorFrameMat,
  );
  header.position.set(0, height - 0.75, depth / 2 - 0.5);
  group.add(header);
  // Side pillars
  [-1, 1].forEach((side) => {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(1, height, 1),
      doorFrameMat,
    );
    p.position.set(side * width / 2, height / 2, depth / 2 - 0.5);
    group.add(p);
  });

  // ---------- Ceiling with truss structure ----------
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x1a1f28, roughness: 0.85,
  });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  group.add(ceiling);

  // Steel trusses along the length
  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x3a4250, roughness: 0.6, metalness: 0.7,
  });
  for (let i = 0; i < 6; i += 1) {
    const z = -depth / 2 + (i + 0.5) * (depth / 6);
    const truss = new THREE.Mesh(
      new THREE.BoxGeometry(width - 2, 0.4, 0.6),
      trussMat,
    );
    truss.position.set(0, height - 1.5, z);
    group.add(truss);
    // Diagonal supports
    for (let j = 0; j < 4; j += 1) {
      const x = -width / 2 + 5 + j * ((width - 10) / 3);
      const sup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 4, 6),
        trussMat,
      );
      sup.position.set(x, height - 2.5, z);
      group.add(sup);
    }
  }

  // ---------- Hangar lights (mounted to trusses) ----------
  const lightMeshes = [];
  for (let i = 0; i < 6; i += 1) {
    const z = -depth / 2 + (i + 0.5) * (depth / 6);
    [-1, 1].forEach((side) => {
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 1.0, 0.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x202830, roughness: 0.6 }),
      );
      housing.position.set(side * width * 0.3, height - 1.7, z);
      group.add(housing);
      const bulb = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.85, 0.15, 12),
        new THREE.MeshBasicMaterial({ color: 0xfff4d8 }),
      );
      bulb.position.set(side * width * 0.3, height - 2.0, z);
      group.add(bulb);
      lightMeshes.push(bulb);

      const point = new THREE.PointLight(0xfff0d0, 1.4, 70, 1.5);
      point.position.set(side * width * 0.3, height - 3, z);
      group.add(point);
    });
  }

  // ---------- Toolboxes / workbenches along walls ----------
  const toolboxMat = new THREE.MeshStandardMaterial({ color: 0xc04030, roughness: 0.6, metalness: 0.4 });
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x6a7080, roughness: 0.55, metalness: 0.5 });
  for (let i = 0; i < 5; i += 1) {
    const z = -depth / 2 + 6 + i * 8;
    [-1, 1].forEach((side) => {
      // Workbench
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.0, 4.5),
        benchMat,
      );
      bench.position.set(side * (width / 2 - 1.5), 0.5, z);
      group.add(bench);
      // Toolbox on top
      if (i % 2 === 0) {
        const tb = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 1.4, 1.2),
          toolboxMat,
        );
        tb.position.set(side * (width / 2 - 1.5), 1.7, z);
        group.add(tb);
      }
      // Drawers
      const drawers = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.8, 4.5),
        new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.7 }),
      );
      drawers.position.set(side * (width / 2 - 1.5), 0.0, z);
      group.add(drawers);
    });
  }

  // ---------- Maintenance stands and rolling stairs (one set) ----------
  const stairsMat = new THREE.MeshStandardMaterial({ color: 0xf0c020, roughness: 0.6, metalness: 0.5 });
  const stairs = new THREE.Group();
  const stairBase = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 4), stairsMat);
  stairBase.position.y = 0.15;
  stairs.add(stairBase);
  for (let s = 0; s < 8; s += 1) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.15, 0.6),
      stairsMat,
    );
    step.position.set(0, 0.4 + s * 0.5, -1.5 + s * 0.5);
    stairs.add(step);
  }
  // Top platform
  const platform = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 2), stairsMat);
  platform.position.set(0, 4.4, 2.5);
  stairs.add(platform);
  // Railings
  [-1, 1].forEach((side) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.2, 4.5),
      stairsMat,
    );
    rail.position.set(side * 1.4, 5.0, 1);
    stairs.add(rail);
  });
  stairs.position.set(15, 0, 4);
  group.add(stairs);

  // ---------- Floor decals: oil stains, tire marks ----------
  const oilMat = new THREE.MeshBasicMaterial({ color: 0x0a0d12, transparent: true, opacity: 0.45 });
  for (let i = 0; i < 8; i += 1) {
    const stain = new THREE.Mesh(
      new THREE.CircleGeometry(0.5 + Math.random() * 0.8, 16),
      oilMat,
    );
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(
      (Math.random() - 0.5) * width * 0.7,
      0.013,
      (Math.random() - 0.5) * depth * 0.7,
    );
    group.add(stain);
  }

  // ---------- Distant view through open door (sky gradient) ----------
  const skyGeo = new THREE.PlaneGeometry(width * 1.5, height * 1.2);
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
  sky.position.set(0, height / 2, depth / 2 + 6);
  group.add(sky);

  return { group, lightMeshes };
}