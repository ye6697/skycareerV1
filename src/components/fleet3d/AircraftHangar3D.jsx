import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { buildCustomAircraftModel } from '@/components/flights/customAircraftModel';
import { buildHangar } from '@/components/fleet3d/hangarScene';
import { HOTSPOT_LAYOUT, getHotspotColor } from '@/components/fleet3d/maintenanceHotspots';
import { normalizeMaintenanceCategoryMap, resolvePermanentWearCategories, MAINTENANCE_CATEGORY_KEYS } from '@/lib/maintenance';
import { useLanguage } from '@/components/LanguageContext';
import { Wrench, AlertTriangle, Loader2 } from 'lucide-react';

// Interactive 3D hangar showing the selected aircraft with maintenance hotspots.
// - Auto-rotates the aircraft slowly
// - Click a hotspot to select a maintenance category (notifies parent)
// - Hotspots are colored by wear severity and pulse if wear > 75%
export default function AircraftHangar3D({ aircraft, selectedCategory, onSelectCategory }) {
  const { lang } = useLanguage();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rafRef = useRef(null);
  const [hotspotScreen, setHotspotScreen] = useState({}); // { key: {x, y, visible} }
  const [isReady, setIsReady] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const camOrbitRef = useRef({ yaw: 0.6, pitch: 0.25, dist: 50 });
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
    scene.background = new THREE.Color(0x14181f);
    scene.fog = new THREE.Fog(0x14181f, 60, 180);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);

    // Hangar
    const { group: hangar } = buildHangar({ width: 80, depth: 100, height: 28 });
    scene.add(hangar);

    // Lighting on top of hangar's point lights (ambient + key sun through door)
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    scene.add(new THREE.HemisphereLight(0xb8d0ec, 0x404a3a, 0.6));
    const key = new THREE.DirectionalLight(0xffe8c0, 1.2);
    key.position.set(20, 30, 40);
    scene.add(key);

    // Aircraft - placed on parking marks in center
    const aircraftGroup = new THREE.Group();
    const built = buildCustomAircraftModel(aircraft?.type || aircraft?.name || '');
    aircraftGroup.add(built.group);
    scene.add(aircraftGroup);

    // Hotspot meshes (small glowing spheres) — anchored to aircraft so they
    // rotate with it. We project them to screen each frame for HTML labels.
    const hotspotMeshes = {};
    Object.entries(HOTSPOT_LAYOUT).forEach(([key, pos]) => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 12),
        new THREE.MeshBasicMaterial({ color: getHotspotColor(wear.total[key] || 0) }),
      );
      sphere.position.set(pos.x, pos.y, pos.z);
      sphere.userData.key = key;
      aircraftGroup.add(sphere);
      // Glow halo
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 16, 12),
        new THREE.MeshBasicMaterial({
          color: getHotspotColor(wear.total[key] || 0),
          transparent: true, opacity: 0.25, depthWrite: false,
        }),
      );
      halo.position.copy(sphere.position);
      aircraftGroup.add(halo);
      hotspotMeshes[key] = { sphere, halo };
    });

    sceneRef.current = { scene, camera, renderer, aircraftGroup, hotspotMeshes };
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
      } catch (_) { /* noop */ }
    };
  }, [aircraft?.id, aircraft?.type]);

  // Update hotspot colors when wear changes (without rebuilding the scene).
  useEffect(() => {
    if (!sceneRef.current) return;
    const { hotspotMeshes } = sceneRef.current;
    Object.entries(hotspotMeshes).forEach(([key, { sphere, halo }]) => {
      const c = new THREE.Color(getHotspotColor(wear.total[key] || 0));
      sphere.material.color.copy(c);
      halo.material.color.copy(c);
    });
  }, [wear]);

  // Drag to rotate camera
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const onDown = (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      dragStateRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, pid: e.pointerId, moved: 0 };
      setAutoRotate(false);
    };
    const onMove = (e) => {
      const s = dragStateRef.current;
      if (!s.active || s.pid !== e.pointerId) return;
      e.preventDefault();
      const dx = e.clientX - s.lastX;
      const dy = e.clientY - s.lastY;
      s.lastX = e.clientX; s.lastY = e.clientY;
      s.moved += Math.abs(dx) + Math.abs(dy);
      camOrbitRef.current.yaw -= dx * 0.008;
      camOrbitRef.current.pitch = Math.max(-0.2, Math.min(1.2, camOrbitRef.current.pitch + dy * 0.006));
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
      o.dist = Math.max(20, Math.min(90, o.dist + e.deltaY * 0.05));
    };
    el.addEventListener('pointerdown', onDown, { passive: false });
    el.addEventListener('pointermove', onMove, { passive: false });
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
        aircraftGroup.rotation.y += dt * 0.15;
      }

      // Pulse high-wear hotspots
      const pulse = (Math.sin(now * 0.005) + 1) * 0.5;
      Object.entries(hotspotMeshes).forEach(([key, { sphere, halo }]) => {
        const w = wear.total[key] || 0;
        const baseScale = 1 + (w / 100) * 0.3;
        const pulseFactor = w > 75 ? 1 + pulse * 0.6 : 1;
        const isSelected = selectedCategory === key;
        const finalScale = baseScale * pulseFactor * (isSelected ? 1.5 : 1);
        sphere.scale.setScalar(finalScale);
        halo.scale.setScalar(finalScale * (1 + pulse * 0.3));
        halo.material.opacity = w > 50 ? 0.35 + pulse * 0.25 : 0.18;
      });

      // Position camera (orbit around aircraft center, slightly above)
      const o = camOrbitRef.current;
      const cx = Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist;
      const cz = Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist;
      const cy = Math.sin(o.pitch) * o.dist + 6;
      camera.position.set(cx, cy, cz);
      camera.lookAt(0, 4, 0);

      // Project hotspots to screen for HTML labels
      const newScreen = {};
      const mount = mountRef.current;
      if (mount) {
        const rect = { w: mount.clientWidth, h: mount.clientHeight };
        const tmp = new THREE.Vector3();
        Object.entries(hotspotMeshes).forEach(([key, { sphere }]) => {
          tmp.setFromMatrixPosition(sphere.matrixWorld);
          const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
          const distFromCam = tmp.distanceTo(camPos);
          tmp.project(camera);
          const visible = tmp.z < 1 && tmp.z > -1;
          newScreen[key] = {
            x: (tmp.x * 0.5 + 0.5) * rect.w,
            y: (-tmp.y * 0.5 + 0.5) * rect.h,
            visible,
            dist: distFromCam,
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
      {/* Hotspot HTML overlays */}
      {Object.entries(hotspotScreen).map(([key, scr]) => {
        if (!scr?.visible) return null;
        const w = wear.total[key] || 0;
        const color = getHotspotColor(w);
        const label = HOTSPOT_LAYOUT[key]?.label?.[lang] || HOTSPOT_LAYOUT[key]?.label?.en || key;
        const isSelected = selectedCategory === key;
        const isCritical = w > 75;
        return (
          <button
            key={key}
            onClick={(e) => { e.stopPropagation(); setAutoRotate(false); onSelectCategory?.(key); }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`absolute flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] uppercase font-bold transition-all -translate-x-1/2 -translate-y-1/2 backdrop-blur-sm shadow-lg ${
              isSelected ? 'ring-2 ring-cyan-300 z-30 scale-110' : 'z-20 hover:scale-105'
            }`}
            style={{
              left: scr.x, top: scr.y,
              color,
              borderColor: color,
              borderWidth: 1,
              background: 'rgba(10, 14, 24, 0.85)',
              boxShadow: isCritical ? `0 0 12px ${color}` : `0 0 4px ${color}50`,
            }}
          >
            {isCritical && <AlertTriangle className="w-3 h-3 animate-pulse" />}
            {label} {Math.round(w)}%
          </button>
        );
      })}
      {/* Controls hint */}
      <div className="absolute bottom-2 left-2 text-[9px] font-mono text-cyan-600/70 uppercase tracking-wider pointer-events-none">
        {lang === 'de' ? 'Ziehen: Rotieren · Scrollen: Zoom' : 'Drag: rotate · Scroll: zoom'}
      </div>
      <button
        onClick={() => setAutoRotate(!autoRotate)}
        className="absolute top-2 right-2 px-2 py-1 text-[9px] font-mono uppercase border border-cyan-700 bg-cyan-950/60 text-cyan-300 rounded hover:bg-cyan-900"
      >
        {autoRotate ? (lang === 'de' ? '⏸ Auto' : '⏸ Auto') : (lang === 'de' ? '▶ Auto' : '▶ Auto')}
      </button>
      {/* Aircraft info plate */}
      {aircraft && (
        <div className="absolute top-2 left-2 px-3 py-1.5 bg-slate-950/85 border border-cyan-700 rounded backdrop-blur-sm">
          <div className="text-cyan-300 font-mono text-xs font-bold tracking-wide">{aircraft.registration}</div>
          <div className="text-cyan-600 font-mono text-[9px] uppercase">{aircraft.name}</div>
        </div>
      )}
    </div>
  );
}