import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildCustomAircraftModel } from '@/components/flights/customAircraftModel';
import { buildHangar } from '@/components/fleet3d/hangarScene';
import { normalizeMaintenanceCategoryMap, resolvePermanentWearCategories, MAINTENANCE_CATEGORY_KEYS } from '@/lib/maintenance';
import { useLanguage } from '@/components/LanguageContext';
import { Loader2 } from 'lucide-react';

function buildFrontAirportScenery() {
  const group = new THREE.Group();

  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 420),
    new THREE.MeshStandardMaterial({ color: 0x1f252d, roughness: 0.92, metalness: 0.08 }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, 0.02, 245);
  group.add(runway);

  const centerLineMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fb, roughness: 0.45, metalness: 0.1 });
  for (let i = 0; i < 13; i += 1) {
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 14), centerLineMat);
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(0, 0.03, 80 + i * 28);
    group.add(mark);
  }

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x32422f, roughness: 1.0, metalness: 0.0 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.05, 220);
  group.add(grass);

  return group;
}

function disposeObject3D(root) {
  if (!root) return;
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose?.();
    if (node.material) {
      if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose?.());
      else node.material.dispose?.();
    }
  });
}

// Camera framing per hotspot category. Defines yaw/pitch/distance to focus.
const CATEGORY_FRAMING = {
  engine:        { yaw: -1.2, pitch: 0.18, distFactor: 0.35 },
  avionics:      { yaw: -2.0, pitch: 0.22, distFactor: 0.30 },
  airframe:      { yaw: -0.7, pitch: 0.30, distFactor: 0.55 },
  hydraulics:    { yaw: -0.9, pitch: 0.05, distFactor: 0.40 },
  landing_gear:  { yaw: -0.8, pitch: 0.02, distFactor: 0.35 },
  electrical:    { yaw: -0.5, pitch: 0.20, distFactor: 0.40 },
  flight_controls:{ yaw: 1.4,  pitch: 0.25, distFactor: 0.40 },
  pressurization:{ yaw: 0.6,  pitch: 0.30, distFactor: 0.45 },
};

// Fully interactive 3D hangar with camera-zoom on category selection.
// Categories are clicked from the parent list panel via `selectedCategory` prop.
export default function AircraftHangar3D({ aircraft, selectedCategory, onAutoRotateChange }) {
  const { lang } = useLanguage();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rafRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);

  // Animated camera target (we lerp toward this each frame).
  const camOrbitRef = useRef({ yaw: -0.6, pitch: 0.22, dist: 55, focusY: 4 });
  const camTargetRef = useRef({ yaw: -0.6, pitch: 0.22, dist: 55, focusY: 4 });
  const dragStateRef = useRef({ active: false });
  const hotspotPosRef = useRef({}); // local positions per category
  const aircraftSizeRef = useRef(30);

  const wear = useMemo(() => {
    const cats = normalizeMaintenanceCategoryMap(aircraft?.maintenance_categories);
    const fallback = Math.max(0, Math.min(100, Number(aircraft?.used_permanent_avg || 0)));
    const perm = resolvePermanentWearCategories(aircraft?.permanent_wear_categories, fallback);
    const total = {};
    MAINTENANCE_CATEGORY_KEYS.forEach((k) => { total[k] = Math.min(100, (cats[k] || 0) + (perm[k] || 0)); });
    return { active: cats, permanent: perm, total };
  }, [aircraft]);

  // Build scene
  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    const w = mount.clientWidth;
    const h = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e14);
    scene.fog = new THREE.Fog(0x0a0e14, 120, 420);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 600);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    const { group: hangar } = buildHangar({ width: 110, depth: 130, height: 55 });
    scene.add(hangar);
    scene.add(buildFrontAirportScenery());

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    scene.add(new THREE.HemisphereLight(0xb8d0ec, 0x404a3a, 0.55));
    const key = new THREE.DirectionalLight(0xffe8c0, 1.3);
    key.position.set(30, 50, 60);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ec0e8, 0.5);
    fill.position.set(-40, 30, -40);
    scene.add(fill);

    const aircraftGroup = new THREE.Group();
    scene.add(aircraftGroup);

    sceneRef.current = { scene, camera, renderer, aircraftGroup };
    setIsReady(true);

    const onResize = () => {
      if (!mount) return;
      const ww = mount.clientWidth, hh = mount.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      camera.aspect = ww / hh;
      camera.updateProjectionMatrix();
      renderer.setSize(ww, hh);
    };
    window.addEventListener('resize', onResize);

    return () => {
      sceneRef.current = null;
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        disposeObject3D(scene);
        renderer.renderLists?.dispose?.();
        renderer.forceContextLoss?.();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
      } catch (_) { /* noop */ }
    };
  }, []);

  // Swap aircraft model and compute hotspot positions.
  useEffect(() => {
    if (!sceneRef.current) return;
    const runtime = sceneRef.current;
    const { aircraftGroup } = runtime;

    while (aircraftGroup.children.length > 0) {
      const child = aircraftGroup.children.pop();
      if (child) { aircraftGroup.remove(child); disposeObject3D(child); }
    }

    const aircraftHint = aircraft?.name || aircraft?.model || aircraft?.type || '';
    const built = buildCustomAircraftModel(aircraftHint);
    aircraftGroup.add(built.group);

    let cancelled = false;
    built.ready.then((meta) => {
      if (cancelled || !sceneRef.current || sceneRef.current !== runtime) return;
      const model = meta?.model || null;

      const measureRealBounds = (root) => {
        if (!root) return null;
        root.updateMatrixWorld(true);
        const meshBoxes = [];
        root.traverse((node) => {
          if (!node.isMesh || !node.geometry) return;
          const name = String(node.name || '').toLowerCase();
          if (name.includes('strobe') || name.includes('beacon') || name.includes('navlight')) return;
          const box = new THREE.Box3().setFromObject(node);
          if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return;
          const sz = new THREE.Vector3();
          box.getSize(sz);
          const volume = sz.x * sz.y * sz.z;
          if (volume <= 0) return;
          meshBoxes.push({ box, volume });
        });
        if (meshBoxes.length === 0) return null;
        const maxVolume = Math.max(...meshBoxes.map((b) => b.volume));
        const significant = meshBoxes.filter((b) => b.volume >= maxVolume * 0.05);
        const merged = new THREE.Box3();
        significant.forEach((b) => merged.union(b.box));
        if (!Number.isFinite(merged.min.x) || !Number.isFinite(merged.max.x)) return null;
        const size = new THREE.Vector3();
        merged.getSize(size);
        return { box: merged, size };
      };
      const measured = measureRealBounds(model || aircraftGroup);
      if (!measured) return;

      const HOTSPOTS = {
        engine:        { x: 0.70, y: 0.35, z: 0.55 },
        avionics:      { x: 0.88, y: 0.55, z: 0.00 },
        airframe:      { x: 0.50, y: 0.55, z: 0.00 },
        hydraulics:    { x: 0.45, y: 0.30, z: -0.35 },
        landing_gear:  { x: 0.55, y: 0.10, z: 0.00 },
        electrical:    { x: 0.40, y: 0.40, z: 0.30 },
        flight_controls: { x: 0.12, y: 0.60, z: 0.00 },
        pressurization:  { x: 0.28, y: 0.50, z: 0.00 },
      };

      const { box, size } = measured;
      const positions = {};
      Object.entries(HOTSPOTS).forEach(([key, anchor]) => {
        positions[key] = new THREE.Vector3(
          box.min.x + size.x * anchor.x,
          box.min.y + size.y * anchor.y,
          box.min.z + size.z * 0.5 + (size.z * 0.5) * Math.max(-1, Math.min(1, anchor.z)),
        );
      });
      hotspotPosRef.current = positions;
      aircraftSizeRef.current = Math.max(size.x, size.y, size.z);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [aircraft?.id, aircraft?.name, aircraft?.model, aircraft?.type]);

  // React to selectedCategory prop: update camera target.
  useEffect(() => {
    if (!selectedCategory) {
      // Reset to default overview
      camTargetRef.current = { yaw: -0.6, pitch: 0.22, dist: 55, focusY: 4 };
      setAutoRotate(true);
      return;
    }
    const framing = CATEGORY_FRAMING[selectedCategory];
    if (!framing) return;
    setAutoRotate(false);

    // Compute zoom distance based on aircraft size – smaller aircraft need closer cam.
    const aircraftSize = aircraftSizeRef.current || 30;
    const dist = Math.max(8, aircraftSize * framing.distFactor);
    const hotspotPos = hotspotPosRef.current[selectedCategory];
    const focusY = hotspotPos ? hotspotPos.y : 4;

    camTargetRef.current = { yaw: framing.yaw, pitch: framing.pitch, dist, focusY };
  }, [selectedCategory]);

  useEffect(() => {
    onAutoRotateChange?.(autoRotate);
  }, [autoRotate, onAutoRotateChange]);

  // Drag camera
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const onDown = (e) => {
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      dragStateRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, pid: e.pointerId, moved: 0 };
    };
    const onMove = (e) => {
      const s = dragStateRef.current;
      if (!s.active || s.pid !== e.pointerId) return;
      const dx = e.clientX - s.lastX;
      const dy = e.clientY - s.lastY;
      s.lastX = e.clientX; s.lastY = e.clientY;
      s.moved += Math.abs(dx) + Math.abs(dy);
      if (s.moved > 5) {
        setAutoRotate(false);
        const t = camTargetRef.current;
        t.yaw -= dx * 0.008;
        t.pitch = Math.max(0.05, Math.min(1.2, t.pitch + dy * 0.006));
        // Sync current position so manual drag is instant.
        camOrbitRef.current.yaw = t.yaw;
        camOrbitRef.current.pitch = t.pitch;
      }
    };
    const onUp = (e) => {
      const s = dragStateRef.current;
      if (s.pid === e.pointerId) {
        s.active = false;
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };
    const onWheel = (e) => {
      e.preventDefault();
      const t = camTargetRef.current;
      t.dist = Math.max(8, Math.min(120, t.dist + e.deltaY * 0.05));
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Animation loop
  useEffect(() => {
    if (!isReady || !sceneRef.current) return;
    let lastT = performance.now();
    const loop = (now) => {
      if (!sceneRef.current) return;
      const dt = (now - lastT) / 1000;
      lastT = now;
      const { scene, camera, renderer, aircraftGroup } = sceneRef.current;

      if (autoRotate) {
        aircraftGroup.rotation.y += dt * 0.12;
      }

      // Smooth camera lerp toward target.
      const o = camOrbitRef.current;
      const t = camTargetRef.current;
      const lerpFactor = Math.min(1, dt * 4); // ~250ms ease
      o.yaw += (t.yaw - o.yaw) * lerpFactor;
      o.pitch += (t.pitch - o.pitch) * lerpFactor;
      o.dist += (t.dist - o.dist) * lerpFactor;
      o.focusY += (t.focusY - o.focusY) * lerpFactor;

      const cx = Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist;
      const cz = Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist;
      const cy = Math.sin(o.pitch) * o.dist + o.focusY;
      camera.position.set(cx, cy, cz);
      camera.lookAt(0, o.focusY, 0);

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isReady, autoRotate]);

  return (
    <div ref={mountRef} className="relative w-full h-full bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing select-none" style={{ touchAction: 'none' }}>
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-cyan-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      <div className="absolute bottom-3 left-3 text-[10px] font-mono text-cyan-600/80 uppercase tracking-wider pointer-events-none bg-slate-950/60 px-2 py-1 rounded">
        {lang === 'de' ? 'Ziehen: rotieren · Scrollen: zoom' : 'Drag: rotate · Scroll: zoom'}
      </div>
      <button
        onClick={() => setAutoRotate(!autoRotate)}
        className="absolute top-3 right-3 px-3 py-1.5 text-[10px] font-mono uppercase border border-cyan-700 bg-cyan-950/70 text-cyan-300 rounded hover:bg-cyan-900 backdrop-blur-sm"
      >
        {autoRotate ? '⏸ Auto' : '▶ Auto'}
      </button>
    </div>
  );
}