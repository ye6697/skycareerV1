import * as THREE from 'three';
import { loadGLB, normalizeModel } from '@/components/flights/glbLoader';
import { buildAircraftModel } from '@/components/flights/aircraftModels3D';
import {
  getDefaultTargetSizeForProfile,
  resolveAircraftModelConfig,
  resolveAircraftProfile,
} from '@/components/flights/aircraftModelCatalog';

const GROUND_CLEARANCE = 1.2;
const VERTEX_SAMPLE_CAP = 5500;
const AIRCRAFT_LIGHT_NAME_PATTERNS = [
  'strobe',
  'beacon',
  'navlight',
  'nav_light',
  'navigationlight',
  'navigation_light',
  'positionlight',
  'position_light',
  'landinglight',
  'landing_light',
  'taxilight',
  'taxi_light',
];

function isAircraftLightArtifact(node) {
  const materials = Array.isArray(node?.material) ? node.material : [node?.material];
  const text = [
    node?.name,
    node?.userData?.name,
    node?.userData?.type,
    ...materials.flatMap((mat) => [mat?.name, mat?.userData?.name, mat?.userData?.type]),
  ].filter(Boolean).join(' ').toLowerCase().replace(/[\s.-]+/g, '_');
  return AIRCRAFT_LIGHT_NAME_PATTERNS.some((pattern) => text.includes(pattern));
}

function sanitizeLoadedModel(root) {
  root.traverse((node) => {
    const name = String(node?.name || '').toLowerCase();
    if (node?.isLight) {
      node.visible = false;
      return;
    }
    if (name.includes('collider') || name.includes('collision') || name.includes('helper')) {
      node.visible = false;
      return;
    }
    if (isAircraftLightArtifact(node)) {
      node.visible = false;
      return;
    }
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;
  });
}

function collectSampledVertices(root, maxSamples = VERTEX_SAMPLE_CAP) {
  const vertices = [];
  const worldPoint = new THREE.Vector3();
  root.updateMatrixWorld(true);

  root.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position || vertices.length >= maxSamples) return;
    const posAttr = node.geometry.attributes.position;
    const step = Math.max(1, Math.floor(posAttr.count / 1200));

    for (let i = 0; i < posAttr.count && vertices.length < maxSamples; i += step) {
      worldPoint.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(node.matrixWorld);
      vertices.push(worldPoint.clone());
    }
  });

  return vertices;
}

function estimateNoseDirection(root) {
  const points = collectSampledVertices(root);
  if (points.length < 50) return 1;

  let minX = Infinity;
  let maxX = -Infinity;
  let meanY = 0;
  let meanZ = 0;
  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    meanY += point.y;
    meanZ += point.z;
  });
  meanY /= points.length;
  meanZ /= points.length;

  const length = Math.max(0.001, maxX - minX);
  const slice = Math.max(0.2, length * 0.09);
  const front = points.filter((point) => point.x > maxX - slice);
  const back = points.filter((point) => point.x < minX + slice);
  if (front.length < 12 || back.length < 12) return 1;

  const radialSpread = (set) => {
    let sum = 0;
    set.forEach((point) => {
      const dy = point.y - meanY;
      const dz = point.z - meanZ;
      sum += Math.sqrt(dy * dy + dz * dz);
    });
    return sum / Math.max(1, set.length);
  };

  const frontSpread = radialSpread(front);
  const backSpread = radialSpread(back);
  return frontSpread <= backSpread ? 1 : -1;
}

function orientModelToForwardX(root) {
  root.updateMatrixWorld(true);
  const baseBox = new THREE.Box3().setFromObject(root);
  const baseSize = new THREE.Vector3();
  baseBox.getSize(baseSize);

  // Use the shape-based estimator first: it samples vertex spread at the X
  // and Z extremes to figure out which axis the nose actually points along.
  // For aircraft where wingspan > fuselage length (e.g. Cessna 172), the
  // simple "longer axis = forward" heuristic is wrong — a high-aspect-ratio
  // wing makes Z the longest axis even when the nose already points along X.
  const nose = estimateNoseAxis(root);
  if (nose.axis === 'z') {
    // Nose is along Z → rotate so it points along X.
    root.rotation.y += Math.PI / 2;
    root.updateMatrixWorld(true);
  } else if (nose.axis === null) {
    // Estimator inconclusive: fall back to the size heuristic.
    if (baseSize.z > baseSize.x * 1.05) {
      root.rotation.y += Math.PI / 2;
      root.updateMatrixWorld(true);
    }
  }

  if (estimateNoseDirection(root) < 0) {
    root.rotation.y += Math.PI;
    root.updateMatrixWorld(true);
  }
}

// Decide which horizontal axis the nose points along by comparing the radial
// spread of vertices at the X-extremes vs. the Z-extremes. The nose end has
// a much smaller cross-section than the tail end (and is much smaller than
// the wingtips), so the axis with the most asymmetric front/back spread is
// the longitudinal axis.
function estimateNoseAxis(root) {
  const points = collectSampledVertices(root);
  if (points.length < 50) return { axis: null };

  const computeAsymmetry = (axis) => {
    let min = Infinity;
    let max = -Infinity;
    let meanA = 0;
    let meanB = 0;
    points.forEach((p) => {
      const v = axis === 'x' ? p.x : p.z;
      min = Math.min(min, v);
      max = Math.max(max, v);
      meanA += axis === 'x' ? p.y : p.y;
      meanB += axis === 'x' ? p.z : p.x;
    });
    meanA /= points.length;
    meanB /= points.length;
    const length = Math.max(0.001, max - min);
    const slice = Math.max(0.2, length * 0.09);
    const front = points.filter((p) => (axis === 'x' ? p.x : p.z) > max - slice);
    const back = points.filter((p) => (axis === 'x' ? p.x : p.z) < min + slice);
    if (front.length < 12 || back.length < 12) return 0;

    const radialSpread = (set) => {
      let sum = 0;
      set.forEach((p) => {
        const dA = (axis === 'x' ? p.y : p.y) - meanA;
        const dB = (axis === 'x' ? p.z : p.x) - meanB;
        sum += Math.sqrt(dA * dA + dB * dB);
      });
      return sum / Math.max(1, set.length);
    };
    const fs = radialSpread(front);
    const bs = radialSpread(back);
    // Higher = more asymmetric (one end small, the other big) → longitudinal axis.
    return Math.abs(fs - bs) / Math.max(0.001, Math.max(fs, bs));
  };

  const asymX = computeAsymmetry('x');
  const asymZ = computeAsymmetry('z');
  if (asymX === 0 && asymZ === 0) return { axis: null };
  // Require a meaningful difference before picking; otherwise stay neutral.
  if (Math.abs(asymX - asymZ) < 0.05) return { axis: null };
  return { axis: asymX >= asymZ ? 'x' : 'z' };
}

function measureBounds(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
    size: { x: size.x, y: size.y, z: size.z },
    center: { x: center.x, y: center.y, z: center.z },
  };
}

function attachLightsToModel() {
  return null;
}

async function loadConfiguredAircraftModel(config) {
  const model = await loadGLB(config.path);
  sanitizeLoadedModel(model);
  orientModelToForwardX(model);
  normalizeModel(model, { targetSize: config.targetSize, yOffset: GROUND_CLEARANCE });
  return model;
}

function buildProceduralFallback(aircraftHint, profile) {
  const built = buildAircraftModel(aircraftHint || profile || 'narrow_body');
  normalizeModel(built.group, {
    targetSize: getDefaultTargetSizeForProfile(profile || 'narrow_body'),
    yOffset: GROUND_CLEARANCE,
  });
  sanitizeLoadedModel(built.group);
  return built.group;
}

export function buildCustomAircraftModel(aircraftHint) {
  const group = new THREE.Group();
  const strobe = null;
  const config = resolveAircraftModelConfig(aircraftHint);
  const profile = config?.profile || resolveAircraftProfile(aircraftHint);

  const ready = (config ? loadConfiguredAircraftModel(config) : Promise.reject(new Error('No config')))
    .then((model) => {
      group.add(model);
      attachLightsToModel(model, strobe);
      return {
        model,
        bounds: measureBounds(model),
        modelId: config.id,
        profile,
        source: 'glb',
      };
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('[customAircraftModel] GLB load failed, falling back to procedural model:', error?.message || error);
      const fallback = buildProceduralFallback(aircraftHint, profile);
      group.add(fallback);
      attachLightsToModel(fallback, strobe);
      return {
        model: fallback,
        bounds: measureBounds(fallback),
        modelId: 'procedural',
        profile,
        source: 'procedural',
      };
    });

  return {
    group,
    strobe,
    ready,
    profile,
    modelId: config?.id || 'procedural',
  };
}
