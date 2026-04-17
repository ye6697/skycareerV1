import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { X, Play, Pause, RotateCcw, Eye, Compass } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import * as THREE from 'three';
import { buildAircraftModel } from '@/components/flights/aircraftModels3D';
import { base44 } from '@/api/base44Client';
import {
  buildRunwayScene,
  makeRunwayLabelTexture,
  normalizeRunway,
  buildGeoPath,
  buildSyntheticPath,
} from '@/components/flights/approachGeometry';

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

  const [runway, setRunway] = useState(null); // normalized runway or null
  const [touchdownInfo, setTouchdownInfo] = useState(null); // { alongM, lateralM, ... }

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
        lat: Number(p.lat ?? p.latitude ?? 0),
        lon: Number(p.lon ?? p.lng ?? p.longitude ?? 0),
      }));

    if (points.length < 2) return null;

    const t0 = points[0].t;
    const tEnd = points[points.length - 1].t;
    const totalSec = Math.max(1, (tEnd - t0) / 1000);
    const minAlt = Math.min(...points.map(p => p.alt));
    const maxAlt = Math.max(...points.map(p => p.alt));

    return { points, t0, tEnd, totalSec, minAlt, maxAlt };
  }, [flight, durationSeconds]);

  // Fetch real runway data from OurAirports based on arrival airport + touchdown coords.
  useEffect(() => {
    if (!segment) return;
    const xpd = flight?.xplane_data || {};
    const icao = xpd.arrival_icao || xpd.arrival_airport || flight?.arrival_airport || '';
    if (!icao) return;
    const last = segment.points[segment.points.length - 1] || {};
    const tdLat = Number.isFinite(last.lat) ? last.lat : Number(xpd.arrival_lat || 0);
    const tdLon = Number.isFinite(last.lon) ? last.lon : Number(xpd.arrival_lon || 0);
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('getRunwayInfo', {
          icao, touchdown_lat: tdLat, touchdown_lon: tdLon,
        });
        if (cancelled) return;
        const picked = res?.data?.landing_runway;
        if (picked) setRunway(normalizeRunway(picked));
      } catch (_) {
        // leave runway as null – scene will use generic runway fallback
      }
    })();
    return () => { cancelled = true; };
  }, [segment, flight]);

  // Build 3D scene
  useEffect(() => {
    if (!segment || !mountRef.current) return;

    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    // Dusk/sunset sky gradient feel
    scene.background = new THREE.Color(0x0a1528);
    scene.fog = new THREE.Fog(0x0a1528, 200, 1200);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 3000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    // Sky dome with gradient (horizon glow)
    const skyGeo = new THREE.SphereGeometry(1500, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x0a1528) },
        horizonColor: { value: new THREE.Color(0x1e3a5f) },
        glowColor: { value: new THREE.Color(0xff7a3d) },
      },
      vertexShader: `varying vec3 vWorldPos; void main(){ vWorldPos = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 glowColor;
        varying vec3 vWorldPos;
        void main(){
          float h = normalize(vWorldPos).y;
          float horizon = smoothstep(-0.05, 0.4, h);
          vec3 base = mix(horizonColor, topColor, horizon);
          float glow = smoothstep(0.15, -0.05, h) * smoothstep(-0.3, -0.05, h);
          base += glowColor * glow * 0.35;
          gl_FragColor = vec4(base, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Lights - brighter setup so aircraft reads clearly from all angles
    scene.add(new THREE.HemisphereLight(0xaac4e8, 0x1a2540, 1.1));
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const sunLight = new THREE.DirectionalLight(0xffd8b0, 1.6);
    sunLight.position.set(-150, 120, -80);
    scene.add(sunLight);
    const fillLight = new THREE.DirectionalLight(0xb8d4ff, 0.8);
    fillLight.position.set(180, 80, 120);
    scene.add(fillLight);
    const sideLight = new THREE.DirectionalLight(0xffffff, 0.6);
    sideLight.position.set(200, 40, 0);
    scene.add(sideLight);

    // Terrain grid (subtle, tactical look)
    const gridHelper = new THREE.GridHelper(2400, 60, 0x1e3a5f, 0x142033);
    gridHelper.position.y = 0;
    gridHelper.material.opacity = 0.35;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Ground plane (dark, solid for depth)
    const groundGeo = new THREE.PlaneGeometry(3000, 3000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0d1a2b, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    // Runway - built from real OurAirports data when available, else generic.
    const { group: runwayGroup, runwayLenM } = buildRunwayScene(runway, makeRunwayLabelTexture);
    scene.add(runwayGroup);

    // Build 3D path referenced to the runway frame (georeferenced when possible).
    const geoPath = runway ? buildGeoPath(segment.points, runway) : null;
    const path3D = (geoPath && geoPath.length >= 2)
      ? geoPath
      : buildSyntheticPath(segment.points, runway);

    // Identify touchdown point (first point where altitude ~ 0 AGL after approach).
    let touchdownIdx = -1;
    for (let i = 1; i < path3D.length; i += 1) {
      if (path3D[i].y < 2 && path3D[i - 1].y >= 2) { touchdownIdx = i; break; }
    }
    if (touchdownIdx < 0) {
      // Fallback: lowest altitude point
      let minY = Infinity;
      for (let i = 0; i < path3D.length; i += 1) {
        if (path3D[i].y < minY) { minY = path3D[i].y; touchdownIdx = i; }
      }
    }

    // Visualize the touchdown point (big cyan ring on the ground).
    if (touchdownIdx >= 0 && path3D[touchdownIdx]) {
      const td = path3D[touchdownIdx];
      const ringGeo = new THREE.RingGeometry(4, 6, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(td.x, 0.08, td.z);
      scene.add(ring);

      // Vertical pillar from touchdown point up, labeled in HUD overlay.
      const pillarGeo = new THREE.CylinderGeometry(0.15, 0.15, 80, 8);
      const pillarMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5 });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(td.x, 40, td.z);
      scene.add(pillar);

      // Store touchdown info for HUD (only if georeferenced)
      if (geoPath && runway) {
        const alongM = td.z;
        const lateralM = td.x;
        setTouchdownInfo({
          // Z=0 is the landing threshold. Z<0 = past threshold on runway. Z>0 = short of threshold.
          alongM,
          lateralM,
          shortOfThreshold: alongM > 0,
          runwayLenM,
          runwayWidthM: runway.widthM,
        });
      } else {
        setTouchdownInfo(null);
      }
    }

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

    // Aircraft - model picked based on the flight's actual aircraft type.
    const xpdForModel = flight?.xplane_data || {};
    const aircraftHint =
      xpdForModel.fleet_aircraft_type ||
      xpdForModel.aircraft_icao ||
      xpdForModel.aircraft_type ||
      xpdForModel.aircraft_name ||
      xpdForModel.aircraft ||
      flight?.aircraft_type ||
      '';
    const { group: planeMesh, strobe } = buildAircraftModel(aircraftHint);
    planeMesh.position.copy(path3D[0]);
    scene.add(planeMesh);

    // Contrail trail behind aircraft
    const trailGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    scene.add(trailLine);

    // Shadow blob beneath aircraft
    const shadowGeo = new THREE.CircleGeometry(5, 24);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    // Ring/reticle removed - use shadow for ground position instead
    const ring = shadow;

    sceneRef.current = { scene, camera, renderer, path3D, planeMesh, ring, shadow, strobe, trailGeo, activePathGeo, activePathLine, segment };

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
      // Clear sceneRef first so animation loop bails out immediately
      sceneRef.current = null;
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      try {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        pathGeo.dispose(); pathMat.dispose();
        activePathGeo.dispose(); activePathMat.dispose();
        groundGeo.dispose(); groundMat.dispose();
        runwayGeo.dispose(); runwayMat.dispose();
        trailGeo.dispose(); trailMat.dispose();
        skyGeo.dispose(); skyMat.dispose();
      } catch (_) { /* ignore cleanup errors */ }
    };
  }, [segment, runway]);

  // Animation loop
  useEffect(() => {
    if (!sceneRef.current) return;
    const sceneData = sceneRef.current;
    const { path3D } = sceneData;

    const animate = (now) => {
      // Bail out if scene was torn down during a pending frame
      if (!sceneRef.current) return;
      const { scene, camera, renderer, planeMesh, shadow, strobe, trailGeo, activePathGeo } = sceneRef.current;

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

      // Shadow on ground below aircraft (scale with altitude, now in meters)
      const altScale = Math.max(0.3, 1 - pos.y / 200);
      shadow.position.set(pos.x, 0.06, pos.z);
      shadow.scale.setScalar(altScale * 2);
      shadow.material.opacity = 0.4 * altScale;

      // Orient nose along path (model's nose points +X)
      const dir = new THREE.Vector3().subVectors(next, cur);
      if (dir.length() > 0.001) {
        dir.normalize();
        const yaw = Math.atan2(-dir.z, dir.x);
        const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
        // Compute bank based on lateral path change (simple heuristic)
        const lookBack = Math.max(0, idx - 3);
        const lookFwd = Math.min(path3D.length - 1, idx + 3);
        const dxFwd = path3D[lookFwd].x - path3D[lookBack].x;
        const dzFwd = path3D[lookFwd].z - path3D[lookBack].z;
        const turnRate = Math.atan2(dxFwd, Math.max(0.1, Math.abs(dzFwd))) * 0.8;
        const bank = Math.max(-0.4, Math.min(0.4, turnRate));

        planeMesh.rotation.set(0, 0, 0);
        planeMesh.rotateY(yaw);
        planeMesh.rotateZ(pitch);
        planeMesh.rotateX(bank);
      }

      // Strobe flash effect (roughly 1 Hz)
      if (strobe) {
        const flashPhase = (now % 1200) / 1200;
        strobe.material.opacity = flashPhase < 0.05 ? 1 : flashPhase < 0.12 ? 0.8 : 0;
      }

      // Update active path (glowing cyan trail)
      const activePoints = path3D.slice(0, idx + 1);
      activePoints.push(pos);
      activePathGeo.setFromPoints(activePoints);

      // Contrail: last few points with fading
      if (trailGeo) {
        const trailPts = activePoints.slice(-25);
        trailGeo.setFromPoints(trailPts);
      }

      // Camera positioning - scene units are meters now.
      if (cameraMode === 'chase') {
        const back = new THREE.Vector3().subVectors(cur, next).normalize().multiplyScalar(80);
        camera.position.set(pos.x + back.x, pos.y + 30, pos.z + back.z);
        camera.lookAt(pos.x, pos.y + 5, pos.z - 40);
      } else if (cameraMode === 'side') {
        camera.position.set(300, Math.max(80, pos.y + 60), pos.z);
        camera.lookAt(pos);
      } else if (cameraMode === 'top') {
        camera.position.set(0, 500, pos.z + 100);
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
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
      {/* Header - cockpit style */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-900/50 bg-gradient-to-b from-slate-900 to-slate-950 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-cyan-300 font-mono uppercase tracking-[0.25em]">
                FLIGHT DATA REPLAY
              </h2>
              <span className="text-[9px] font-mono text-slate-500 uppercase border border-slate-700 px-1.5 py-0.5 rounded">
                T-{Math.round(segment.totalSec)}s
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
              {segment.points.length} {lang === 'de' ? 'Samples · Seitenansicht aktiv' : 'samples · side view active'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-red-300 hover:border-red-500/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 3D Canvas */}
      <div ref={mountRef} className="flex-1 relative" style={{ minHeight: 0 }}>
        {/* HUD crosshair reticle in center */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-32 h-32 opacity-30">
            <div className="absolute top-1/2 left-0 w-6 h-px bg-cyan-400" />
            <div className="absolute top-1/2 right-0 w-6 h-px bg-cyan-400" />
            <div className="absolute left-1/2 top-0 w-px h-6 bg-cyan-400" />
            <div className="absolute left-1/2 bottom-0 w-px h-6 bg-cyan-400" />
          </div>
        </div>

        {/* HUD overlay - PFD style */}
        {currentReadout && (
          <div className="absolute top-4 left-4 bg-slate-950/90 border border-cyan-500/40 rounded-md p-3 font-mono backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.15)] min-w-[200px]">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-cyan-900/50">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[9px] uppercase tracking-[0.25em] text-cyan-400">Primary Flight Display</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-6">
                <span className="text-[9px] uppercase tracking-widest text-slate-500">Time</span>
                <span className="text-cyan-300 font-bold">T+{currentReadout.elapsedSec}s</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-[9px] uppercase tracking-widest text-slate-500">Altitude</span>
                <span className="text-emerald-400 font-bold">{Math.round(currentReadout.alt).toLocaleString()} FT</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-[9px] uppercase tracking-widest text-slate-500">Airspeed</span>
                <span className="text-sky-300 font-bold">{Math.round(currentReadout.spd)} KIAS</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-[9px] uppercase tracking-widest text-slate-500">Vert. Speed</span>
                <span className={`font-bold ${currentReadout.vs < -1000 ? 'text-red-400' : currentReadout.vs < -500 ? 'text-amber-400' : 'text-emerald-300'}`}>
                  {Math.round(currentReadout.vs) >= 0 ? '+' : ''}{Math.round(currentReadout.vs)} FPM
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-[9px] uppercase tracking-widest text-slate-500">G-Load</span>
                <span className={`font-bold ${currentReadout.g > 2 ? 'text-red-400' : currentReadout.g > 1.5 ? 'text-amber-400' : 'text-emerald-300'}`}>
                  {currentReadout.g.toFixed(2)} G
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Touchdown Analysis HUD */}
        {touchdownInfo && (
          <div className="absolute bottom-24 left-4 bg-slate-950/90 border border-cyan-500/40 rounded-md p-3 font-mono backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.15)] min-w-[220px] max-w-[260px]">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-cyan-900/50">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-[9px] uppercase tracking-[0.25em] text-cyan-400">Touchdown Analysis</span>
              {runway?.landingIdent && (
                <span className="ml-auto text-[9px] text-slate-500 uppercase">RWY {runway.landingIdent}</span>
              )}
            </div>
            <div className="space-y-1.5 text-xs">
              {(() => {
                const alongM = touchdownInfo.alongM;
                const lateralM = touchdownInfo.lateralM;
                const halfWidth = (touchdownInfo.runwayWidthM || 45) / 2;
                // alongM > 0 = short of threshold (undershoot, outside runway)
                // alongM < 0 = past threshold, on runway (distance from threshold = -alongM)
                // alongM < -runwayLen = overshoot
                const runwayLen = touchdownInfo.runwayLenM || 2500;
                const distFromThreshold = -alongM; // positive when on runway
                let landingLabel;
                let labelColor;
                if (alongM > 0) {
                  landingLabel = lang === 'de' ? 'VOR DER SCHWELLE' : 'SHORT OF THRESHOLD';
                  labelColor = 'text-red-400';
                } else if (distFromThreshold > runwayLen) {
                  landingLabel = lang === 'de' ? 'UEBER BAHNENDE' : 'OVERSHOOT';
                  labelColor = 'text-red-400';
                } else if (distFromThreshold < 150) {
                  landingLabel = lang === 'de' ? 'AN DER SCHWELLE' : 'AT THRESHOLD';
                  labelColor = 'text-emerald-400';
                } else if (distFromThreshold < 600) {
                  landingLabel = lang === 'de' ? 'TOUCHDOWN ZONE' : 'TOUCHDOWN ZONE';
                  labelColor = 'text-emerald-400';
                } else {
                  landingLabel = lang === 'de' ? 'SPAET AUFGESETZT' : 'LATE TOUCHDOWN';
                  labelColor = 'text-amber-400';
                }
                const centerlineStatus = Math.abs(lateralM) < halfWidth
                  ? (lang === 'de' ? 'auf Bahn' : 'on runway')
                  : (lang === 'de' ? 'NEBEN BAHN' : 'OFF RUNWAY');
                const centerlineColor = Math.abs(lateralM) < halfWidth ? 'text-emerald-300' : 'text-red-400';
                return (
                  <>
                    <div className={`font-bold text-sm ${labelColor}`}>{landingLabel}</div>
                    <div className="flex items-center justify-between gap-6">
                      <span className="text-[9px] uppercase tracking-widest text-slate-500">
                        {lang === 'de' ? 'Ab Schwelle' : 'From threshold'}
                      </span>
                      <span className="text-cyan-300 font-bold">
                        {distFromThreshold >= 0 ? '+' : ''}{Math.round(distFromThreshold)} m
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-6">
                      <span className="text-[9px] uppercase tracking-widest text-slate-500">
                        {lang === 'de' ? 'Quer-Abweichung' : 'Lateral offset'}
                      </span>
                      <span className={`font-bold ${Math.abs(lateralM) < 5 ? 'text-emerald-300' : Math.abs(lateralM) < 15 ? 'text-amber-400' : 'text-red-400'}`}>
                        {lateralM >= 0 ? 'R ' : 'L '}{Math.abs(lateralM).toFixed(1)} m
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-6">
                      <span className="text-[9px] uppercase tracking-widest text-slate-500">
                        {lang === 'de' ? 'Mittellinie' : 'Centerline'}
                      </span>
                      <span className={`font-bold ${centerlineColor}`}>{centerlineStatus}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Camera mode selector - MFD style */}
        <div className="absolute top-4 right-4 bg-slate-950/90 border border-cyan-500/40 rounded-md backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.15)] overflow-hidden">
          <div className="px-3 py-1.5 border-b border-cyan-900/50 bg-slate-900/60">
            <span className="text-[9px] uppercase tracking-[0.25em] text-cyan-400 font-mono">Camera</span>
          </div>
          <div className="flex flex-col p-1 gap-0.5">
            {[
              { id: 'side', label: lang === 'de' ? 'Seite' : 'Side' },
              { id: 'chase', label: lang === 'de' ? 'Verfolger' : 'Chase' },
              { id: 'top', label: lang === 'de' ? 'Oben' : 'Top' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setCameraMode(m.id)}
                className={`px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-wider text-left transition-colors min-w-[80px] ${
                  cameraMode === m.id
                    ? 'bg-cyan-500/20 text-cyan-300 border-l-2 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-l-2 border-transparent'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Compass tape bottom */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center">
          <div className="bg-gradient-to-t from-slate-950 to-transparent h-20 w-full" />
        </div>
      </div>

      {/* Controls - tactical/professional style */}
      <div className="border-t border-cyan-900/50 bg-gradient-to-t from-slate-950 to-slate-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlayPause}
            className="h-9 w-9 flex items-center justify-center rounded border border-cyan-500/50 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900/60 hover:border-cyan-400 transition-colors shadow-[0_0_10px_rgba(34,211,238,0.2)]"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-cyan-300" />}
          </button>
          <button
            onClick={handleReset}
            className="h-9 w-9 flex items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="flex-1 flex items-center gap-3">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest w-10 text-right">
              {((progress * segment.totalSec)).toFixed(1)}s
            </span>
            <div className="relative flex-1 h-2">
              <div className="absolute inset-0 rounded-full bg-slate-800 border border-slate-700" />
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                style={{ width: `${progress * 100}%` }}
              />
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
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest w-10">
              {segment.totalSec.toFixed(1)}s
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded border border-cyan-900/50 bg-slate-950 ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest">
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}