import * as THREE from 'three';

// Procedurally generated realistic trees using:
// - Cone/cylinder trunks with bark material
// - Multiple overlapping icosahedron "leaf clusters" for organic canopy shape
// - Slight color variation per tree for natural variety
//
// Faster than GLB loading, consistent look, scales to thousands of instances.

// Foliage color palette - mix of greens for natural variety.
const FOLIAGE_COLORS = [
  0x3a6b2a, 0x4a7a3a, 0x5a8a3a, 0x3a5a2a, 0x6a9a4a,
  0x2a5a2a, 0x4a6a2a, 0x5a7a3a,
];
const TRUNK_COLORS = [0x4a3220, 0x5a3a28, 0x3e2818, 0x6a4a30];

function makeConiferTree(scale = 1) {
  const g = new THREE.Group();
  // Trunk
  const trunkColor = TRUNK_COLORS[Math.floor(Math.random() * TRUNK_COLORS.length)];
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.4, 3, 6),
    new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 1 }),
  );
  trunk.position.y = 1.5;
  g.add(trunk);
  // 3 stacked cones for layered pine look
  const foliageColor = FOLIAGE_COLORS[Math.floor(Math.random() * FOLIAGE_COLORS.length)];
  const foliageMat = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.95, flatShading: true });
  [
    { r: 2.2, h: 3.5, y: 3 },
    { r: 1.8, h: 3.2, y: 4.8 },
    { r: 1.3, h: 2.8, y: 6.4 },
  ].forEach((layer) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(layer.r, layer.h, 8), foliageMat);
    cone.position.y = layer.y;
    g.add(cone);
  });
  g.scale.setScalar(scale);
  return g;
}

function makeBroadleafTree(scale = 1) {
  const g = new THREE.Group();
  const trunkColor = TRUNK_COLORS[Math.floor(Math.random() * TRUNK_COLORS.length)];
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.5, 3.5, 6),
    new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 1 }),
  );
  trunk.position.y = 1.75;
  g.add(trunk);
  // Overlapping icosahedron clusters for organic canopy shape.
  const foliageColor = FOLIAGE_COLORS[Math.floor(Math.random() * FOLIAGE_COLORS.length)];
  const foliageMat = new THREE.MeshStandardMaterial({
    color: foliageColor, roughness: 0.9, flatShading: true,
  });
  const clusterCount = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < clusterCount; i += 1) {
    const r = 1.6 + Math.random() * 0.9;
    const cluster = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), foliageMat);
    cluster.position.set(
      (Math.random() - 0.5) * 1.8,
      3.5 + Math.random() * 1.8,
      (Math.random() - 0.5) * 1.8,
    );
    cluster.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    g.add(cluster);
  }
  g.scale.setScalar(scale);
  return g;
}

function makeBirchTree(scale = 1) {
  const g = new THREE.Group();
  // White/gray birch trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, 4, 6),
    new THREE.MeshStandardMaterial({ color: 0xe0dcd0, roughness: 0.85 }),
  );
  trunk.position.y = 2;
  g.add(trunk);
  const foliageColor = FOLIAGE_COLORS[Math.floor(Math.random() * FOLIAGE_COLORS.length)];
  const foliageMat = new THREE.MeshStandardMaterial({
    color: foliageColor, roughness: 0.9, flatShading: true,
  });
  // Taller, narrower canopy
  for (let i = 0; i < 3; i += 1) {
    const cluster = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.3 + Math.random() * 0.5, 0),
      foliageMat,
    );
    cluster.position.set(
      (Math.random() - 0.5) * 1.2,
      4 + i * 0.9,
      (Math.random() - 0.5) * 1.2,
    );
    g.add(cluster);
  }
  g.scale.setScalar(scale);
  return g;
}

// Scatter realistic trees across the scene, avoiding runway/apron corridors.
export function scatterRealisticTrees(parent, { runwayLenM, apronX, apronW, apronD, count = 1200 }) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 220 + Math.pow(Math.random(), 0.6) * 3200;
    const x = Math.cos(angle) * radius;
    const z = -runwayLenM / 2 + Math.sin(angle) * radius;
    // Skip runway corridor.
    if (Math.abs(x) < 200 && Math.abs(z + runwayLenM / 2) < runwayLenM / 2) continue;
    // Skip apron.
    if (x > apronX - apronW / 2 - 20 && x < apronX + apronW / 2 + 20 &&
        Math.abs(z + runwayLenM / 2) < apronD / 2 + 20) continue;

    const scale = 0.7 + Math.random() * 1.3;
    const pick = Math.random();
    let tree;
    if (pick < 0.5) tree = makeConiferTree(scale);
    else if (pick < 0.88) tree = makeBroadleafTree(scale);
    else tree = makeBirchTree(scale);
    tree.position.set(x, -1.4, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    parent.add(tree);
  }
}