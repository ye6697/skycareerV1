import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { buildHangar } from '@/components/fleet3d/hangarScene';
import { buildAircraftModel } from '@/components/flights/aircraftModels3D';
import { getHotspotLayoutForAircraft, getHotspotColor } from '@/components/fleet3d/maintenanceHotspots';
import HotspotInfoPopup from '@/components/fleet3d/HotspotInfoPopup';
import MaintenanceCategoryList from '@/components/fleet3d/MaintenanceCategoryList';
import { useLanguage } from '@/components/LanguageContext';

const clampPct = (v) => Math.max(0, Math.min(100, Number(v) || 0));

// Interactive 3D hangar: the owned aircraft parked inside a full hangar scene
// with clickable maintenance hotspots per category (as before the gate update).
export default function FleetHangar3D({ aircraft, onClose }) {
  const { lang } = useLanguage();
  const mountRef = useRef(null);
  const ctxRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [popup, setPopup] = useState(null); // { categoryKey, screenPos }

  // --- One-time scene setup ---
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f18);
    scene.fog = new THREE.Fog(0x0a0f18, 200, 480);

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 800);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xdfe8f5, 0x1a2230, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(30, 60, 50);
    scene.add(sun);

    const { group: hangar } = buildHangar({ width: 110, depth: 130, height: 55 });
    scene.add(hangar);

    const target = new THREE.Vector3(0, 6, 0);
    const spherical = { radius: 46, theta: Math.PI * 0.25, phi: Math.PI * 0.4 };
    const applyCamera = () => {
      camera.position.set(
        target.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta),
        target.y + spherical.radius * Math.cos(spherical.phi),
        target.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta),
      );
      camera.lookAt(target);
    };
    applyCamera();

    const ctx = { scene, camera, renderer, target, spherical, applyCamera, hotspotMeshes: [], modelGroup: null };
    ctxRef.current = ctx;

    let frame;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = performance.now() * 0.004;
      ctx.hotspotMeshes.forEach((m) => {
        m.scale.setScalar(m.userData.selected ? 1.4 + Math.sin(t) * 0.18 : 1);
      });
      renderer.render(scene, camera);
    };
    animate();

    // --- Orbit + hotspot picking ---
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    const el = renderer.domElement;
    el.style.touchAction = 'none';

    const onPointerDown = (e) => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; };
    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX;
      lastY = e.clientY;
      spherical.theta -= dx * 0.006;
      spherical.phi = Math.max(0.18, Math.min(Math.PI / 2 - 0.04, spherical.phi - dy * 0.005));
      applyCamera();
    };
    const onPointerUp = (e) => {
      const wasDragging = dragging;
      dragging = false;
      if (!wasDragging || moved > 8) return;
      // Click: raycast against hotspots
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(ctx.hotspotMeshes, false);
      if (hits.length > 0) {
        const key = hits[0].object.userData.categoryKey;
        setSelectedCategory(key);
        setPopup({ categoryKey: key, screenPos: { x: e.clientX - rect.left, y: e.clientY - rect.top } });
      } else {
        setPopup(null);
        setSelectedCategory(null);
      }
    };
    const onWheel = (e) => {
      e.preventDefault();
      spherical.radius = Math.max(16, Math.min(100, spherical.radius + e.deltaY * 0.05));
      applyCamera();
    };
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (el.parentNode === mount) mount.removeChild(el);
      ctxRef.current = null;
    };
  }, []);

  // --- Aircraft model + maintenance hotspots (rebuild on data change) ---
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx || !aircraft) return undefined;

    const disposeGroup = (group) => {
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
        }
      });
    };
    if (ctx.modelGroup) {
      ctx.scene.remove(ctx.modelGroup);
      disposeGroup(ctx.modelGroup);
      ctx.modelGroup = null;
    }
    ctx.hotspotMeshes.forEach((m) => {
      ctx.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    ctx.hotspotMeshes = [];

    const hint = `${aircraft.name || ''} ${aircraft.type || ''}`;
    const { group } = buildAircraftModel(hint);
    const box = new THREE.Box3().setFromObject(group);
    group.position.y -= box.min.y; // wheels on the floor
    ctx.scene.add(group);
    ctx.modelGroup = group;

    const worldBox = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    worldBox.getSize(size);
    const layout = getHotspotLayoutForAircraft({
      aircraftHint: hint,
      bounds: { min: worldBox.min, max: worldBox.max, size },
    });

    const cats = aircraft.maintenance_categories || {};
    const perm = aircraft.permanent_wear_categories || {};
    const radius = Math.max(0.55, size.length() / 42);
    ctx.hotspotMeshes = Object.entries(layout).map(([key, pos]) => {
      const wear = Math.min(100, clampPct(cats[key]) + clampPct(perm[key]));
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 12),
        new THREE.MeshBasicMaterial({ color: getHotspotColor(wear), transparent: true, opacity: 0.92 }),
      );
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData = { categoryKey: key, selected: false };
      ctx.scene.add(mesh);
      return mesh;
    });

    ctx.target.set(0, Math.max(4, size.y * 0.45), 0);
    ctx.applyCamera();
    return undefined;
  }, [aircraft]);

  // Keep hotspot highlight in sync with the selected category.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.hotspotMeshes.forEach((m) => {
      m.userData.selected = m.userData.categoryKey === selectedCategory;
      if (!m.userData.selected) m.scale.setScalar(1);
    });
  }, [selectedCategory, aircraft]);

  if (!aircraft) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-900/50 bg-slate-900/95">
        <span className="text-xs font-mono uppercase tracking-widest text-cyan-300 truncate">
          {lang === 'de' ? '3D Hangar' : '3D Hangar'} · {aircraft.name} {aircraft.registration ? `(${aircraft.registration})` : ''}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-white flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
        <div className="relative flex-1 min-h-[45vh] sm:min-h-0">
          <div ref={mountRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute left-2 bottom-2 rounded border border-cyan-900/50 bg-slate-950/80 px-2 py-1 text-[10px] font-mono text-cyan-300">
            {lang === 'de'
              ? 'Ziehen: drehen · Scrollen: zoomen · Punkt anklicken: Wartung'
              : 'Drag: rotate · Scroll: zoom · Click dot: maintenance'}
          </div>
          <AnimatePresence>
            {popup && (
              <HotspotInfoPopup
                aircraft={aircraft}
                categoryKey={popup.categoryKey}
                screenPos={popup.screenPos}
                onClose={() => { setPopup(null); setSelectedCategory(null); }}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="w-full sm:w-[320px] flex-shrink-0 border-t sm:border-t-0 sm:border-l border-cyan-900/40 bg-slate-950/95 overflow-y-auto max-h-[45vh] sm:max-h-none">
          <MaintenanceCategoryList
            aircraft={aircraft}
            selectedCategory={selectedCategory}
            onSelectCategory={(key) => setSelectedCategory((prev) => (prev === key ? null : key))}
          />
        </div>
      </div>
    </div>
  );
}