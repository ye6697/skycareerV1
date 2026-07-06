import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildCustomAircraftModel } from '@/components/flights/customAircraftModel';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';

// Cinematic 3D aircraft showroom for the market: turntable stage + spec panel.
export default function MarketShowroom3D({ listings = [], lang = 'de', getPurchaseState, onBuy, onClose }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const modelRef = useRef(null);
  const [index, setIndex] = useState(0);

  const safeIndex = listings.length > 0 ? Math.min(index, listings.length - 1) : 0;
  const listing = listings[safeIndex] || null;

  // One-time scene setup
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);
    scene.fog = new THREE.Fog(0x070b14, 40, 120);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 300);
    camera.position.set(0, 9, 30);
    camera.lookAt(0, 2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x0a0f1a, 0.75));
    const key = new THREE.SpotLight(0xffffff, 1.4, 90, Math.PI / 5, 0.4, 1);
    key.position.set(14, 24, 14);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x22d3ee, 0.5);
    rim.position.set(-18, 10, -14);
    scene.add(rim);

    // Stage floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(22, 48),
      new THREE.MeshStandardMaterial({ color: 0x0e1626, roughness: 0.85, metalness: 0.3 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(15.4, 15.9, 64),
      new THREE.MeshBasicMaterial({ color: 0x155e75, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);
    const grid = new THREE.GridHelper(44, 22, 0x1b2a44, 0x111a2e);
    grid.position.y = 0.01;
    scene.add(grid);

    sceneRef.current = { scene, camera, renderer };

    let frame;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (modelRef.current) modelRef.current.rotation.y += 0.004;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (renderer.domElement?.parentNode === mount) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // Swap aircraft model when the listing changes
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx || !listing) return;
    if (modelRef.current) {
      ctx.scene.remove(modelRef.current);
      modelRef.current.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
        }
      });
      modelRef.current = null;
    }
    // Real GLB aircraft model (with procedural fallback handled internally).
    const { group, ready } = buildCustomAircraftModel(`${listing.name} ${listing.type}`);
    group.position.y = 0.1;
    ctx.scene.add(group);
    modelRef.current = group;
    ready.then(({ bounds }) => {
      if (modelRef.current !== group) return;
      // Fit large aircraft onto the showroom stage.
      const longest = Math.max(bounds.size.x, bounds.size.z);
      if (longest > 24) group.scale.setScalar(24 / longest);
    });
  }, [listing?.name, listing?.type, listing?.market_listing_id]);

  if (!listing) return null;

  const state = getPurchaseState ? getPurchaseState(listing) : { ok: true, reason: '' };
  const usedLabel = listing.used_condition_label?.[lang] || listing.used_condition_label?.en;

  return (
    <div className="fixed inset-0 z-[125] bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-900/50 bg-slate-900/95">
        <span className="text-xs font-mono uppercase tracking-widest text-cyan-300">
          {lang === 'de' ? '3D Flugzeugmarkt' : '3D Aircraft Market'} · {safeIndex + 1}/{listings.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={mountRef} className="absolute inset-0" />

        {/* Prev / Next */}
        <button
          type="button"
          onClick={() => setIndex((i) => (i - 1 + listings.length) % listings.length)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-11 w-11 flex items-center justify-center rounded-full border border-cyan-800/60 bg-slate-950/80 text-cyan-300 hover:bg-cyan-950/60">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => (i + 1) % listings.length)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-11 w-11 flex items-center justify-center rounded-full border border-cyan-800/60 bg-slate-950/80 text-cyan-300 hover:bg-cyan-950/60">
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Spec panel */}
        <div className="absolute left-3 bottom-3 z-10 w-[min(92vw,340px)] rounded-xl border border-cyan-900/50 bg-slate-950/90 p-3 backdrop-blur font-mono">
          <p className="text-sm font-bold text-white uppercase flex items-center gap-2 flex-wrap">
            {listing.name}
            {listing.marketType === 'used' && <span className="text-[9px] text-amber-400">USED</span>}
            {listing.marketType === 'used' && usedLabel && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-900/40 text-amber-300 normal-case">{usedLabel}</span>
            )}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
            <div className="flex justify-between"><span className="text-slate-500">PAX</span><span className="text-cyan-100">{listing.passenger_capacity}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">CGO</span><span className="text-cyan-100">{listing.cargo_capacity_kg}kg</span></div>
            <div className="flex justify-between"><span className="text-slate-500">RNG</span><span className="text-cyan-100">{listing.range_nm}NM</span></div>
            <div className="flex justify-between"><span className="text-slate-500">BURN</span><span className="text-cyan-100">{listing.fuel_consumption_per_hour}L/h</span></div>
            <div className="flex justify-between"><span className="text-slate-500">MIN LVL</span><span className="text-cyan-100">{listing.level_requirement || 1}</span></div>
            {listing.marketType === 'used' && (
              <div className="flex justify-between"><span className="text-slate-500">AGE/HRS</span><span className="text-cyan-100">{listing.used_age_years || '-'}y / {(listing.total_flight_hours || 0).toLocaleString()}</span></div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between rounded border border-slate-800 bg-slate-950 p-1.5">
            <span className="text-[10px] text-slate-500">PRICE</span>
            <span className={`text-sm font-bold ${state.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              ${Math.round(listing.purchase_price || 0).toLocaleString()}
            </span>
          </div>
          {!state.ok && state.reason && (
            <p className="mt-1.5 text-[10px] text-amber-300">{state.reason}</p>
          )}
          <Button
            type="button"
            disabled={!state.ok}
            onClick={() => onBuy?.(listing)}
            className={`mt-2 h-9 w-full text-[11px] font-mono uppercase ${state.ok ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
            {lang === 'de' ? 'Kaufen' : 'Buy'}
          </Button>
        </div>
      </div>
    </div>
  );
}