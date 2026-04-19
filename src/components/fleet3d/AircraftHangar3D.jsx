import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { AnimatePresence } from 'framer-motion';
import { buildCustomAircraftModel } from '@/components/flights/customAircraftModel';
import { buildHangar } from '@/components/fleet3d/hangarScene';
import { HOTSPOT_LAYOUT, getHotspotColor } from '@/components/fleet3d/maintenanceHotspots';
import { normalizeMaintenanceCategoryMap, resolvePermanentWearCategories, MAINTENANCE_CATEGORY_KEYS } from '@/lib/maintenance';
import { useLanguage } from '@/components/LanguageContext';
import { AlertTriangle, Loader2 } from 'lucide-react';
import HotspotInfoPopup from '@/components/fleet3d/HotspotInfoPopup';

// Fully interactive 3D hangar:
// - Click hotspot sphere on the model → opens info popup (with repair action)
// - Drag to rotate camera, scroll to zoom
// - Auto-rotate toggle
export default function AircraftHangar3D({ aircraft }) {
  const { lang } = useLanguage();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rafRef = useRef(null);
  const [hotspotScreen, setHotspotScreen] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const camOrbitRef = useRef({ yaw: 0.6, pitch: 0.18, dist: 55 });
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
    scene.fog = new THREE.Fog(0x0a0e14, 80, 220);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 600);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    // Hangar (much taller now: 55m)
    const { group: hangar } = buildHangar({ width: 110, depth: 130, height: 55 });
    scene.add(hangar);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    scene.add(new THREE.HemisphereLight(0xb8d0ec, 0x404a3a, 0.55));
    const key = new THREE.DirectionalLight(0xffe8c0, 1.3);
    key.position.set(30, 50, 60);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ec0e8, 0.5);
    fill.position.set(-40, 30, -40);
    scene.add(fill);

    // Aircraft on parking marks
    const aircraftGroup = new THREE.Group();
    const built = buildCustomAircraftModel(aircraft?.type || aircraft?.name || '');
    aircraftGroup.add(built.group);
    scene.add(aircraftGroup);

    // Hotspot meshes (clickable spheres anchored to aircraft)
    const hotspotMeshes = {};
    Object.entries(HOTSPOT_LAYOUT).forEach(([key, pos]) => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 16, 12),
        new THREE.MeshBasicMaterial({ color: getHotspotColor(wear.total[key] || 0) }),
      );
      sphere.position.set(pos.x, pos.y, pos.z);
      sphere.userData.key = key;
      aircraftGroup.add(sphere);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 16, 12),
        new THREE.MeshBasicMaterial({
          color: getHotspotColor(wear.total[key] || 0),
          transparent: true, opacity: 0.3, depthWrite: false,
        }),
      );
      halo.position.copy(sphere.position);
      aircraftGroup.add(halo);
      hotspotMeshes[key] = { sphere, halo };
    });

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
      const targets = Object.values(hotspotMeshes).map((h) => h.sphere);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        setSelectedCategory(hits[0].object.userData.key);
        setAutoRotate(false);
      }
    };
    renderer.domElement.addEventListener('click', onClick);

    sceneRef.current = { scene, camera, renderer, aircraftGroup, hotspotMeshes, onClick };
    setIsReady(true);

    const onResize = () => {
      if (!mount) return;
      const ww = mount.clientWidth, hh = mount.clientHeight;
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
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
      } catch (_) { /* noop */ }
    };
  }, [aircraft?.id, aircraft?.type]);

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
        camOrbitRef.current.pitch = Math.max(-0.15, Math.min(1.2, camOrbitRef.current.pitch + dy * 0.006));
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

      // Project hotspots for HTML overlays
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
      setHotspotScreen(newScreen);

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
            onClick={(e) => { e.stopPropagation(); setSelectedCategory(key); setAutoRotate(false); }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`absolute flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] uppercase font-bold transition-all -translate-x-1/2 -translate-y-[200%] ${isSelected ? 'z-30 scale-110' : 'z-20 hover:scale-110'}`}
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

      {/* Info popup */}
      <AnimatePresence>
        {selectedCategory && hotspotScreen[selectedCategory]?.visible && (
          <div data-popup className="absolute inset-0 pointer-events-none">
            <div className="pointer-events-auto">
              <HotspotInfoPopup
                aircraft={aircraft}
                categoryKey={selectedCategory}
                screenPos={hotspotScreen[selectedCategory]}
                onClose={() => setSelectedCategory(null)}
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