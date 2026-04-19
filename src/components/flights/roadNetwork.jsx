import * as THREE from 'three';

// Builds a realistic road network around the airport: several highways and
// secondary roads with lane markings, street lights, and light-vehicle blobs
// moving along them visually. All geometry is added to the provided `group`.
//
// Coordinate system matches customAirportModel: runway lies along -Z from
// 0 at the threshold to -runwayLenM at the far end.

function makeDashedLineTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 8);
  g.fillStyle = '#ffffff'; g.fillRect(4, 3, 24, 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildRoadSegment(group, { x1, z1, x2, z2, width = 10, lanes = 2 }) {
  const dx = x2 - x1; const dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 1) return;
  const cx = (x1 + x2) / 2; const cz = (z1 + z2) / 2;
  const angle = Math.atan2(dx, dz);

  // Asphalt surface
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0x22262c, roughness: 0.95, metalness: 0.02,
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(width, len), asphaltMat);
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = -angle;
  road.position.set(cx, 0.015, cz);
  group.add(road);

  // Dashed center line
  const dashTex = makeDashedLineTexture();
  dashTex.repeat.set(1, Math.max(2, len / 4));
  const centerMat = new THREE.MeshBasicMaterial({ map: dashTex, transparent: true, alphaTest: 0.5 });
  const center = new THREE.Mesh(new THREE.PlaneGeometry(0.25, len), centerMat);
  center.rotation.x = -Math.PI / 2;
  center.rotation.z = -angle;
  center.position.set(cx, 0.022, cz);
  group.add(center);

  // Solid edge lines
  [-1, 1].forEach((side) => {
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, len),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    edge.rotation.x = -Math.PI / 2;
    edge.rotation.z = -angle;
    // Offset perpendicular to the road direction
    const perpX = Math.cos(angle) * (width / 2 - 0.2) * side;
    const perpZ = -Math.sin(angle) * (width / 2 - 0.2) * side;
    edge.position.set(cx + perpX, 0.022, cz + perpZ);
    group.add(edge);
  });

  // Street lights every ~40m
  const lightSpacing = 40;
  const lightCount = Math.max(2, Math.floor(len / lightSpacing));
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.7, metalness: 0.5 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe080 });
  for (let i = 0; i < lightCount; i += 1) {
    const t = (i + 0.5) / lightCount;
    const lx = x1 + dx * t;
    const lz = z1 + dz * t;
    // Alternate sides
    const side = i % 2 === 0 ? 1 : -1;
    const perpX = Math.cos(angle) * (width / 2 + 1.5) * side;
    const perpZ = -Math.sin(angle) * (width / 2 + 1.5) * side;
    // Pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
    pole.position.set(lx + perpX, 3 - 1.4, lz + perpZ);
    group.add(pole);
    // Arm
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), poleMat);
    arm.position.set(lx + perpX - side * 0.75, 5.6 - 1.4, lz + perpZ);
    arm.rotation.y = angle;
    group.add(arm);
    // Bulb
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), bulbMat);
    bulb.position.set(lx + perpX - side * 1.3, 5.5 - 1.4, lz + perpZ);
    group.add(bulb);
  }

  // Static "vehicles" scattered along the road as small colored blocks
  const carColors = [0xdd3030, 0x2060a0, 0xe0e0e0, 0x1a1a1a, 0x80a020, 0xd0a030];
  const vehicleCount = Math.max(1, Math.floor(len / 35));
  for (let i = 0; i < vehicleCount; i += 1) {
    const t = (i + Math.random() * 0.8) / vehicleCount;
    const vx = x1 + dx * t;
    const vz = z1 + dz * t;
    const laneOffset = (Math.random() > 0.5 ? 1 : -1) * (width * 0.25);
    const perpX = Math.cos(angle) * laneOffset;
    const perpZ = -Math.sin(angle) * laneOffset;
    const color = carColors[Math.floor(Math.random() * carColors.length)];
    const car = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.2, 4.2),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.5 }),
    );
    car.rotation.y = angle;
    car.position.set(vx + perpX, 0.6, vz + perpZ);
    group.add(car);
    // Cabin windows (dark top)
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.4, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.3, metalness: 0.7 }),
    );
    cabin.rotation.y = angle;
    cabin.position.set(vx + perpX, 1.35, vz + perpZ);
    group.add(cabin);
  }
}

// Curved ring road using many straight segments
function buildRingRoad(group, { centerX, centerZ, radius, width = 10, segments = 48 }) {
  for (let i = 0; i < segments; i += 1) {
    const a1 = (i / segments) * Math.PI * 2;
    const a2 = ((i + 1) / segments) * Math.PI * 2;
    buildRoadSegment(group, {
      x1: centerX + Math.cos(a1) * radius,
      z1: centerZ + Math.sin(a1) * radius,
      x2: centerX + Math.cos(a2) * radius,
      z2: centerZ + Math.sin(a2) * radius,
      width,
    });
  }
}

export function addRoadNetwork(group, { runwayLenM }) {
  const airportCenterZ = -runwayLenM / 2;

  // Highway 1: wide, runs parallel to the runway far to the east
  buildRoadSegment(group, {
    x1: 500, z1: -runwayLenM - 1200,
    x2: 500, z2: 1500,
    width: 14,
  });
  // Highway 2: parallel to the runway on the west side
  buildRoadSegment(group, {
    x1: -600, z1: -runwayLenM - 1000,
    x2: -600, z2: 1800,
    width: 14,
  });
  // Perpendicular highway crossing in front of the airport
  buildRoadSegment(group, {
    x1: -2500, z1: 600,
    x2: 2500, z2: 600,
    width: 14,
  });
  // Second cross road behind departure end
  buildRoadSegment(group, {
    x1: -2200, z1: -runwayLenM - 700,
    x2: 2200, z2: -runwayLenM - 700,
    width: 12,
  });

  // Airport access road: connects perpendicular highway to terminal apron area
  buildRoadSegment(group, {
    x1: 500, z1: 600,
    x2: 260, z2: airportCenterZ + 400,
    width: 10,
  });

  // Suburban grid streets east of the airport
  for (let i = 0; i < 6; i += 1) {
    const x = 900 + i * 90;
    buildRoadSegment(group, {
      x1: x, z1: -runwayLenM - 300,
      x2: x, z2: 500,
      width: 6,
    });
  }
  for (let i = 0; i < 6; i += 1) {
    const z = -runwayLenM + i * 450;
    buildRoadSegment(group, {
      x1: 900, z1: z,
      x2: 1450, z2: z,
      width: 6,
    });
  }
  // Same grid on the west side
  for (let i = 0; i < 6; i += 1) {
    const x = -900 - i * 90;
    buildRoadSegment(group, {
      x1: x, z1: -runwayLenM - 300,
      x2: x, z2: 500,
      width: 6,
    });
  }
  for (let i = 0; i < 6; i += 1) {
    const z = -runwayLenM + i * 450;
    buildRoadSegment(group, {
      x1: -1450, z1: z,
      x2: -900, z2: z,
      width: 6,
    });
  }

  // Ring road encircling the distant city (skyline area)
  buildRingRoad(group, {
    centerX: 0, centerZ: airportCenterZ,
    radius: 2300, width: 14, segments: 64,
  });

  // Diagonal motorway out to the mountains
  buildRoadSegment(group, {
    x1: 1500, z1: 1400,
    x2: 3200, z2: 2600,
    width: 12,
  });
  buildRoadSegment(group, {
    x1: -1500, z1: 1400,
    x2: -3200, z2: 2600,
    width: 12,
  });
}