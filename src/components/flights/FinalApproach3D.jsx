import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { X, Play, Pause, RotateCcw, Eye, Compass } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import * as THREE from 'three';

// Visualizes the last N seconds of a flight as a 3D approach path with replay.
export default function FinalApproach3D({ flight, onClose, durationSeconds = 30 }) {
  const { lang } = useLanguage();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0..1
  const [cameraMode, setCameraMode] = useState('side'); // chase | side | top
  const playbackStartRef = useRef(null);
  const PLAYBACK_DURATION_MS = 12000; // 12s replay

  // Extract last N seconds from telemetry_history
  const segment = useMemo(() => {
    const xpd = flight?.xplane_data || {};
    const history = xpd.telemetry_history || xpd.telemetryHistory || [];
    if (!Array.isArray(history) || history.length < 2) return null;

    const lastTs = new Date(history[history.length - 1]?.t || Date.now()).getTime();
    if (!Number.isFinite(lastTs)) return null;
    const cutoffMs = lastTs - durationSeconds * 1000;

    const points = history
      .filter((p) => {
        const ts = new Date(p?.t || 0).getTime();
        return Number.isFinite(ts) && ts >= cutoffMs;
      })
      .map((p) => ({
        t: new Date(p.t).getTime(),
        alt: Number(p.alt ?? 0),
        spd: Number(p.spd ?? p.ias ?? 0),
        vs: Number(p.vs ?? 0),
        g: Number(p.g ?? 1),
      }));

    if (points.length < 2) return null;

    const t0 = points[0].t;
    const tEnd = points[points.length - 1].t;
    const totalSec = Math.max(1, (tEnd - t0) / 1000);
    const minAlt = Math.min(...points.map(p => p.alt));
    const maxAlt = Math.max(...points.map(p => p.alt));

    return { points, t0, tEnd, totalSec, minAlt, maxAlt };
  }, [flight, durationSeconds]);

  // Build 3D scene
  useEffect(() => {
    if (!segment || !mountRef.current) return;

    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 100, 800);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    // Ground / runway
    const groundGeo = new THREE.PlaneGeometry(2000, 2000, 40, 40);
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, wireframe: true, opacity: 0.3, transparent: true });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Runway strip
    const runwayGeo = new THREE.PlaneGeometry(40, 600);
    const runwayMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0.1, 0);
    scene.add(runway);

    // Runway center lines
    for (let i = -280; i <= 280; i += 40) {
      const stripeGeo = new THREE.PlaneGeometry(2, 20);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.2, i);
      scene.add(stripe);
    }

    // Map points to 3D positions
    // X = lateral drift (small), Y = altitude AGL, Z = distance along approach
    const altRange = Math.max(50, segment.maxAlt - segment.minAlt);
    const path3D = segment.points.map((p, i) => {
      const t = i / (segment.points.length - 1); // 0..1 along approach
      const z = -300 + t * 600; // start far -Z, end at +Z (touchdown ahead of runway end)
      const altAGL = Math.max(0, p.alt - segment.minAlt);
      const y = (altAGL / altRange) * 80; // scale altitude to ~0..80 units
      const x = Math.sin(t * Math.PI * 0.5) * 5; // slight S-curve drift
      return new THREE.Vector3(x, y, z);
    });

    // Path line (full)
    const pathGeo = new THREE.BufferGeometry().setFromPoints(path3D);
    const pathMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.4 });
    const pathLine = new THREE.Line(pathGeo, pathMat);
    scene.add(pathLine);

    // Active path (grows during replay)
    const activePathGeo = new THREE.BufferGeometry();
    const activePathMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, linewidth: 3 });
    const activePathLine = new THREE.Line(activePathGeo, activePathMat);
    scene.add(activePathLine);

    // Vertical drop lines from path to ground (every 5th point)
    path3D.forEach((pt, i) => {
      if (i % 5 !== 0) return;
      const dropGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pt.x, pt.y, pt.z),
        new THREE.Vector3(pt.x, 0, pt.z),
      ]);
      const dropMat = new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.3 });
      scene.add(new THREE.Line(dropGeo, dropMat));
    });

    // Aircraft marker (small triangle/cone)
    const planeGeo = new THREE.ConeGeometry(2, 6, 4);
    const planeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    planeMesh.rotation.x = Math.PI / 2;
    planeMesh.position.copy(path3D[0]);
    scene.add(planeMesh);

    // Glow ring around aircraft
    const ringGeo = new THREE.RingGeometry(3, 5, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    sceneRef.current = { scene, camera, renderer, path3D, planeMesh, ring, activePathGeo, activePathLine, segment };

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      renderer.dispose();
      pathGeo.dispose();
      pathMat.dispose();
      activePathGeo.dispose();
      activePathMat.dispose();
      planeGeo.dispose();
      planeMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      runwayGeo.dispose();
      runwayMat.dispose();
    };
  }, [segment]);

  // Animation loop
  useEffect(() => {
    if (!sceneRef.current) return;
    const { scene, camera, renderer, path3D, planeMesh, ring, activePathGeo } = sceneRef.current;

    const animate = (now) => {
      if (!sceneRef.current) return;

      if (isPlaying) {
        if (playbackStartRef.current === null) {
          playbackStartRef.current = now - progress * PLAYBACK_DURATION_MS;
        }
        const elapsed = now - playbackStartRef.current;
        let p = Math.min(1, elapsed / PLAYBACK_DURATION_MS);
        setProgress(p);
        if (p >= 1) {
          setIsPlaying(false);
          playbackStartRef.current = null;
        }
      }

      // Position aircraft along path
      const idxFloat = progress * (path3D.length - 1);
      const idx = Math.floor(idxFloat);
      const frac = idxFloat - idx;
      const cur = path3D[idx];
      const next = path3D[Math.min(path3D.length - 1, idx + 1)];
      const pos = new THREE.Vector3().lerpVectors(cur, next, frac);
      planeMesh.position.copy(pos);
      ring.position.set(pos.x, 0.3, pos.z);

      // Orient nose along path
      const dir = new THREE.Vector3().subVectors(next, cur).normalize();
      if (dir.length() > 0.001) {
        planeMesh.lookAt(pos.clone().add(dir));
        planeMesh.rotateX(Math.PI / 2);
      }

      // Update active path
      const activePoints = path3D.slice(0, idx + 1);
      activePoints.push(pos);
      activePathGeo.setFromPoints(activePoints);

      // Camera positioning
      if (cameraMode === 'chase') {
        const back = new THREE.Vector3().subVectors(cur, next).normalize().multiplyScalar(40);
        camera.position.set(pos.x + back.x, pos.y + 15, pos.z + back.z);
        camera.lookAt(pos.x, pos.y, pos.z + 20);
      } else if (cameraMode === 'side') {
        camera.position.set(150, 60, pos.z);
        camera.lookAt(pos);
      } else if (cameraMode === 'top') {
        camera.position.set(0, 200, pos.z + 50);
        camera.lookAt(0, 0, pos.z);
      }

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, progress, cameraMode]);

  const handlePlayPause = () => {
    if (progress >= 1) {
      setProgress(0);
      playbackStartRef.current = null;
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        playbackStartRef.current = null;
      } else {
        playbackStartRef.current = performance.now() - progress * PLAYBACK_DURATION_MS;
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleReset = () => {
    setProgress(0);
    playbackStartRef.current = null;
    setIsPlaying(true);
  };

  // Current telemetry readout
  const currentReadout = useMemo(() => {
    if (!segment) return null;
    const idx = Math.min(segment.points.length - 1, Math.floor(progress * (segment.points.length - 1)));
    const p = segment.points[idx];
    const elapsedSec = ((p.t - segment.t0) / 1000).toFixed(1);
    return { ...p, elapsedSec };
  }, [progress, segment]);

  if (!segment) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md text-center">
          <p className="text-slate-300 mb-4">
            {lang === 'de'
              ? 'Keine Telemetrie-Daten der letzten 30 Sekunden verfuegbar.'
              : 'No telemetry data available for the last 30 seconds.'}
          </p>
          <Button onClick={onClose}>OK</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900/80">
        <div>
          <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider">
            {lang === 'de' ? 'Final Approach 3D' : 'Final Approach 3D'}
          </h2>
          <p className="text-[10px] text-slate-400 font-mono">
            {lang === 'de' ? `Letzte ${Math.round(segment.totalSec)}s` : `Last ${Math.round(segment.totalSec)}s`} · {segment.points.length} {lang === 'de' ? 'Punkte' : 'points'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-300 hover:text-white">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* 3D Canvas */}
      <div ref={mountRef} className="flex-1 relative" style={{ minHeight: 0 }}>
        {/* HUD overlay */}
        {currentReadout && (
          <div className="absolute top-4 left-4 bg-slate-950/80 border border-cyan-900/50 rounded-lg p-3 font-mono text-xs space-y-1 backdrop-blur-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">T+</span>
              <span className="text-cyan-300">{currentReadout.elapsedSec}s</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">ALT</span>
              <span className="text-emerald-400">{Math.round(currentReadout.alt)} ft</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">SPD</span>
              <span className="text-blue-400">{Math.round(currentReadout.spd)} kts</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">V/S</span>
              <span className={currentReadout.vs < -1000 ? 'text-red-400' : currentReadout.vs < -500 ? 'text-amber-400' : 'text-pink-400'}>
                {Math.round(currentReadout.vs)} fpm
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">G</span>
              <span className={currentReadout.g > 2 ? 'text-red-400' : currentReadout.g > 1.5 ? 'text-amber-400' : 'text-orange-400'}>
                {currentReadout.g.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Camera mode selector */}
        <div className="absolute top-4 right-4 flex flex-col gap-1 bg-slate-950/80 border border-cyan-900/50 rounded-lg p-1 backdrop-blur-sm">
          {[
            { id: 'chase', label: lang === 'de' ? 'Verfolger' : 'Chase', icon: Eye },
            { id: 'side', label: lang === 'de' ? 'Seite' : 'Side', icon: Compass },
            { id: 'top', label: lang === 'de' ? 'Oben' : 'Top', icon: Compass },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setCameraMode(m.id)}
                className={`px-2 py-1 rounded text-[10px] font-mono uppercase flex items-center gap-1 transition-colors ${
                  cameraMode === m.id ? 'bg-cyan-900/60 text-cyan-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3 h-3" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-slate-800 bg-slate-900/80 p-3">
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handlePlayPause} className="bg-cyan-700 hover:bg-cyan-600 text-white">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset} className="border-slate-700 text-slate-300 hover:text-white">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <input
            type="range"
            min="0"
            max="1000"
            value={Math.round(progress * 1000)}
            onChange={(e) => {
              setIsPlaying(false);
              playbackStartRef.current = null;
              setProgress(Number(e.target.value) / 1000);
            }}
            className="flex-1 accent-cyan-500"
          />
          <span className="text-xs font-mono text-slate-400 w-12 text-right">
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}