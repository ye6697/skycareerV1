import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { AnimatePresence } from 'framer-motion';
import { buildCustomAircraftModel } from '@/components/flights/customAircraftModel';
import { buildHangar } from '@/components/fleet3d/hangarScene';
import { getHotspotColor, getHotspotLayoutForAircraft } from '@/components/fleet3d/maintenanceHotspots';
import { normalizeMaintenanceCategoryMap, resolvePermanentWearCategories, MAINTENANCE_CATEGORY_KEYS } from '@/lib/maintenance';
import { useLanguage } from '@/components/LanguageContext';
import { AlertTriangle, Loader2 } from 'lucide-react';
import HotspotInfoPopup from '@/components/fleet3d/HotspotInfoPopup';

function buildFrontAirportScenery() {
  const group = new THREE.Group();

  // Place airport scenery IN FRONT of the open hangar door (+Z), so it is
  // visible from the default hangar camera and does not appear like a flat
  // background card.
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

  const taxiway = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 210),
    new THREE.MeshStandardMaterial({ color: 0x2c3338, roughness: 0.9 }),
  );
  taxiway.rotation.x = -Math.PI / 2;
  taxiway.position.set(94, 0.018, 180);
  group.add(taxiway);

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x32422f, roughness: 1.0, metalness: 0.0 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.05, 220);
  group.add(grass);

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 140),
    new THREE.MeshStandardMaterial({ color: 0x788694, roughness: 0.86, metalness: 0.08 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(-120, 0.03, 170);
  group.add(apron);

  const terminalMat = new THREE.MeshStandardMaterial({ color: 0xb8c4d3, roughness: 0.8, metalness: 0.12 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x93b7d9,
    roughness: 0.2,
    metalness: 0.35,
    transparent: true,
    opacity: 0.85,
    emissive: 0x1e3248,
    emissiveIntensity: 0.18,
  });

  const terminalBase = new THREE.Mesh(new THREE.BoxGeometry(90, 16, 26), terminalMat);
  terminalBase.position.set(-120, 8, 210);
  group.add(terminalBase);

  const terminalGlass = new THREE.Mesh(new THREE.BoxGeometry(84, 9, 14), glassMat);
  terminalGlass.position.set(-120, 16, 210);
  group.add(terminalGlass);

  const towerBase = new THREE.Mesh(new THREE.BoxGeometry(14, 30, 14), terminalMat);
  towerBase.position.set(-60, 15, 182);
  group.add(towerBase);

  const towerCab = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 12), glassMat);
  towerCab.position.set(-60, 31, 182);
  group.add(towerCab);

  return group;
}

function disposeObject3D(root) {
  if (!root) return;
  root.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose?.();
    }
    if (node.material) {
      if (Array.isArray(node.material)) {
        node.material.forEach((material) => material.dispose?.());
      } else {
        node.material.dispose?.();
      }
    }
  });
}

function hasHotspotScreenChanged(previous, next) {
  const previousKeys = Object.keys(previous || {});
  const nextKeys = Object.keys(next || {});
  if (previousKeys.length !== nextKeys.length) return true;

  for (let i = 0; i < nextKeys.length; i += 1) {
    const key = nextKeys[i];
    const prev = previous?.[key];
    const curr = next?.[key];
    if (!prev || !curr) return true;
    if (prev.visible !== curr.visible) return true;
    if (Math.abs((prev.x || 0) - (curr.x || 0)) > 0.8) return true;
    if (Math.abs((prev.y || 0) - (curr.y || 0)) > 0.8) return true;
  }
  return false;
}

// Fully interactive 3D hangar:
// - Click hotspot sphere on the model → opens info popup (with repair action)
// - Drag to rotate camera, scroll to zoom
// - Auto-rotate toggle
export default function AircraftHangar3D({ aircraft }) {
  const { lang } = useLanguage();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rafRef = useRef(null);
  const hotspotScreenRef = useRef({});
  const lastOverlaySyncRef = useRef(0);
  const [hotspotScreen, setHotspotScreen] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  // Popup position is captured ONCE at open-time and stays fixed on screen
  // (doesn't follow the rotating aircraft / hotspot).
  const [popupAnchor, setPopupAnchor] = useState(null);
  // Default camera starts outside the open front gate (negative Z), looking
  // into the hangar. This avoids the impression that the gate is "closed" by
  // the rear wall.
  const camOrbitRef = useRef({ yaw: -0.6, pitch: 0.22, dist: 55 });
  const dragStateRef = useRef({ active: false });

  const wear = useMemo(() => {
    const cats = normalizeMaintenanceCategoryMap(aircraft?.maintenance_categories);
    const fallback = Math.max(0, Math.min(100, Number(aircraft?.used_permanent_avg || 0)));
    const perm = resolvePermanentWearCategories(aircraft?.permanent_wear_categories, fallback);
    const total = {};
    MAINTENANCE_CATEGORY_KEYS.forEach((k) => {
      total[k] = Math.min(100, (cats[k] || 0) + (perm[k] || 0));
    });
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

    // Procedural textured hangar (tall, with full PBR textures + props)
    const { group: hangar } = buildHangar({ width: 110, depth: 130, height: 55 });
    scene.add(hangar);
    scene.add(buildFrontAirportScenery());

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    scene.add(new THREE.HemisphereLight(0xb8d0ec, 0x404a3a, 0.55));
    const key = new THREE.DirectionalLight(0xffe8c0, 1.3);
    key.position.set(30, 50, 60);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ec0e8, 0.5);
    fill.position.set(-40, 30, -40);
    scene.add(fill);

    // Keep renderer/scene persistent and only swap aircraft model/hotspots.
    const aircraftGroup = new THREE.Group();
    scene.add(aircraftGroup);

    // Raycaster for clicking hotspots
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (e) => {
      const s = dragStateRef.current;
      if (s.moved > 5) return; // ignore if it was a drag
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const targets = Object.values(sceneRef.current?.hotspotMeshes || {}).map((h) => h.sphere);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        const key = hits[0].object.userData.key;
        setSelectedCategory(key);
        // Anchor popup at click location so it stays put.
        setPopupAnchor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setAutoRotate(false);
      }
    };
    renderer.domElement.addEventListener('click', onClick);

    sceneRef.current = { scene, camera, renderer, aircraftGroup, hotspotMeshes: {}, onClick };
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
      renderer.domElement.removeEventListener('click', onClick);
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

  // Swap aircraft model and hotspot positions without rebuilding the renderer.
  useEffect(() => {
    if (!sceneRef.current) return;
    const runtime = sceneRef.current;
    const { aircraftGroup } = runtime;

    // Reset selection while switching aircraft to avoid stale popup anchors.
    setSelectedCategory(null);
    setPopupAnchor(null);
    hotspotScreenRef.current = {};
    setHotspotScreen({});

    while (aircraftGroup.children.length > 0) {
      const child = aircraftGroup.children.pop();
      if (child) {
        aircraftGroup.remove(child);
        disposeObject3D(child);
      }
    }
    runtime.hotspotMeshes = {};

    const aircraftHint = aircraft?.name || aircraft?.model || aircraft?.type || '';
    const built = buildCustomAircraftModel(aircraftHint);
    aircraftGroup.add(built.group);

    // IMPORTANT: do NOT spawn hotspots before the model bounds are known.
    // The default bounds (used when bounds are missing) are -15..+15 in X
    // which is much larger than e.g. a Cessna model -> hotspots would float
    // far outside the visible aircraft until the model finishes loading.
    // Wait for `built.ready`, get the real bounds, then create the spheres
    // exactly once with the correct positions.
    runtime.hotspotMeshes = {};

    let cancelled = false;
    built.ready
      .then((meta) => {
        if (cancelled || !sceneRef.current || sceneRef.current !== runtime) return;
        const model = meta?.model || null;

        // CRITICAL: Measure bounds from BIG MESH GEOMETRY ONLY (the actual
        // fuselage/wings), explicitly excluding navigation lights, strobes,
        // beacons, and other tiny accessory meshes that artificially inflate
        // the bounding box and push the hotspots above the visible aircraft.
        //
        // Strategy: collect all mesh bounds, sort by volume, keep only the
        // top contributors (>= 5% of largest mesh volume). Lights are tiny
        // spheres (~0.2 radius) so they get filtered out automatically.
        const measureRealBounds = (root) => {
          if (!root) return null;
          root.updateMatrixWorld(true);
          const meshBoxes = [];
          root.traverse((node) => {
            if (!node.isMesh || !node.geometry) return;
            // Skip nodes flagged as navigation lights / strobes by name.
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
          // Keep only meshes that are at least 5% of the largest mesh volume.
          // This drops navigation-light spheres reliably without complex
          // name-matching, and works for both procedural and GLB models.
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

        // Bounds-relative hotspot anchors (0..1 inside the bounding box).
        // VERY conservative Y values – stay between 0.25 and 0.65 so spheres
        // sit ON the fuselage skin, not above the canopy.
        const HOTSPOTS = {
          engine:        { x: 0.70, y: 0.35, z: 0.55 },  // wing-mounted engine
          avionics:      { x: 0.88, y: 0.55, z: 0.00 },  // cockpit / nose
          airframe:      { x: 0.50, y: 0.55, z: 0.00 },  // upper fuselage center
          hydraulics:    { x: 0.45, y: 0.30, z: -0.35 }, // belly
          landing_gear:  { x: 0.55, y: 0.10, z: 0.00 },  // gear, bottom
          electrical:    { x: 0.40, y: 0.40, z: 0.30 },  // wing root
          flight_controls: { x: 0.12, y: 0.60, z: 0.00 },// tail
          pressurization:  { x: 0.28, y: 0.50, z: 0.00 },// fuselage upper
        };

        const { box, size } = measured;
        const worldPositions = {};
        Object.entries(HOTSPOTS).forEach(([key, anchor]) => {
          worldPositions[key] = new THREE.Vector3(
            box.min.x + size.x * anchor.x,
            box.min.y + size.y * anchor.y,
            box.min.z + size.z * 0.5 + (size.z * 0.5) * Math.max(-1, Math.min(1, anchor.z)),
          );
        });

        // Attach to the model (or aircraftGroup) in LOCAL coordinates.
        const parent = model || aircraftGroup;
        parent.updateMatrixWorld(true);
        const inverseMatrix = new THREE.Matrix4().copy(parent.matrixWorld).invert();

        // Scale hotspot spheres proportionally to the aircraft's diagonal
        // size so a Cessna and an A380 both get visually similar dot sizes.
        // Clamp to a sensible range so very tiny / very huge models still
        // produce readable markers.
        const diag = Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z);
        const sphereR = Math.max(0.35, Math.min(1.4, diag * 0.018));
        const haloR = sphereR * 1.85;

        const hotspotMeshes = {};
        Object.entries(worldPositions).forEach(([key, worldPos]) => {
          const localPos = worldPos.clone().applyMatrix4(inverseMatrix);
          const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(sphereR, 16, 12),
            new THREE.MeshBasicMaterial({ color: getHotspotColor(wear.total[key] || 0), depthTest: true })
          );
          sphere.position.copy(localPos);
          sphere.userData.key = key;
          parent.add(sphere);
          const halo = new THREE.Mesh(
            new THREE.SphereGeometry(haloR, 16, 12),
            new THREE.MeshBasicMaterial({
              color: getHotspotColor(wear.total[key] || 0),
              transparent: true,
              opacity: 0.3,
              depthWrite: false,
            })
          );
          halo.position.copy(localPos);
          parent.add(halo);
          hotspotMeshes[key] = { sphere, halo };
        });
        runtime.hotspotMeshes = hotspotMeshes;
      })
      .catch(() => {
        // Model loader already falls back internally.
      });

    return () => {
      cancelled = true;
    };
  }, [aircraft?.id, aircraft?.name, aircraft?.model, aircraft?.type]);

  // Update hotspot colors when wear changes
  useEffect(() => {
    if (!sceneRef.current) return;
    const { hotspotMeshes } = sceneRef.current;
    Object.entries(hotspotMeshes).forEach(([key, { sphere, halo }]) => {
      const c = new THREE.Color(getHotspotColor(wear.total[key] || 0));
      sphere.material.color.copy(c);
      halo.material.color.copy(c);
    });
  }, [wear]);

  // Drag camera (only on empty area, not on hotspot UI)
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const onDown = (e) => {
      if (e.target.closest('button, [data-popup]')) return;
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
      camOrbitRef.current.yaw -= dx * 0.008;
      // Clamp pitch: minimum 0.08 rad keeps the camera above the floor so
      // you can never look under the ground plane.
      camOrbitRef.current.pitch = Math.max(0.08, Math.min(1.2, camOrbitRef.current.pitch + dy * 0.006));
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
      const o = camOrbitRef.current;
      o.dist = Math.max(20, Math.min(100, o.dist + e.deltaY * 0.05));
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
      const { scene, camera, renderer, aircraftGroup, hotspotMeshes } = sceneRef.current;

      if (autoRotate) {
        aircraftGroup.rotation.y += dt * 0.12;
      }

      // Pulse hotspots
      const pulse = (Math.sin(now * 0.005) + 1) * 0.5;
      Object.entries(hotspotMeshes).forEach(([key, { sphere, halo }]) => {
        const w = wear.total[key] || 0;
        const baseScale = 1 + (w / 100) * 0.4;
        const pulseFactor = w > 75 ? 1 + pulse * 0.6 : 1;
        const isSelected = selectedCategory === key;
        const finalScale = baseScale * pulseFactor * (isSelected ? 1.6 : 1);
        sphere.scale.setScalar(finalScale);
        halo.scale.setScalar(finalScale * (1 + pulse * 0.3));
        halo.material.opacity = w > 50 ? 0.4 + pulse * 0.25 : 0.22;
      });

      // Camera
      const o = camOrbitRef.current;
      const cx = Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist;
      const cz = Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist;
      const cy = Math.sin(o.pitch) * o.dist + 7;
      camera.position.set(cx, cy, cz);
      camera.lookAt(0, 4, 0);

      // Project hotspots for HTML overlays at lower frequency to reduce React churn.
      if (now - lastOverlaySyncRef.current > 66) {
        const newScreen = {};
        const mount = mountRef.current;
        if (mount) {
          const rect = { w: mount.clientWidth, h: mount.clientHeight };
          const tmp = new THREE.Vector3();
          Object.entries(hotspotMeshes).forEach(([key, { sphere }]) => {
            tmp.setFromMatrixPosition(sphere.matrixWorld);
            tmp.project(camera);
            const visible = tmp.z < 1 && tmp.z > -1;
            newScreen[key] = {
              x: (tmp.x * 0.5 + 0.5) * rect.w,
              y: (-tmp.y * 0.5 + 0.5) * rect.h,
              visible,
            };
          });
        }
        if (hasHotspotScreenChanged(hotspotScreenRef.current, newScreen)) {
          hotspotScreenRef.current = newScreen;
          setHotspotScreen(newScreen);
        }
        lastOverlaySyncRef.current = now;
      }

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isReady, autoRotate, wear, selectedCategory]);

  return (
    <div ref={mountRef} className="relative w-full h-full bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing select-none" style={{ touchAction: 'none' }}>
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-cyan-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {/* Hotspot HTML markers (small badges above each sphere) */}
      {Object.entries(hotspotScreen).map(([key, scr]) => {
        if (!scr?.visible) return null;
        const w = wear.total[key] || 0;
        const color = getHotspotColor(w);
        const isCritical = w > 75;
        const isSelected = selectedCategory === key;
        return (
          <button
            key={key}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCategory(key);
              const rect = mountRef.current?.getBoundingClientRect();
              if (rect) setPopupAnchor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              setAutoRotate(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`absolute flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] uppercase font-bold transition-all -translate-x-1/2 -translate-y-1/2 ${isSelected ? 'z-30 scale-110' : 'z-20 hover:scale-110'}`}
            style={{
              left: scr.x, top: scr.y,
              color, borderColor: color, borderWidth: 1,
              background: 'rgba(10, 14, 24, 0.85)',
              boxShadow: isCritical ? `0 0 10px ${color}` : `0 0 4px ${color}50`,
            }}
          >
            {isCritical && <AlertTriangle className="w-2.5 h-2.5 animate-pulse" />}
            {Math.round(w)}%
          </button>
        );
      })}

      {/* Info popup - anchored to the click position, doesn't follow the hotspot */}
      <AnimatePresence>
        {selectedCategory && popupAnchor && (
          <div data-popup className="absolute inset-0 pointer-events-none">
            <div className="pointer-events-auto">
              <HotspotInfoPopup
                aircraft={aircraft}
                categoryKey={selectedCategory}
                screenPos={popupAnchor}
                onClose={() => { setSelectedCategory(null); setPopupAnchor(null); }}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Controls hint */}
      <div className="absolute bottom-3 left-3 text-[10px] font-mono text-cyan-600/80 uppercase tracking-wider pointer-events-none bg-slate-950/60 px-2 py-1 rounded">
        {lang === 'de' ? 'Punkte anklicken · Ziehen: rotieren · Scrollen: zoom' : 'Click dots · Drag: rotate · Scroll: zoom'}
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