import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { X, Play, Pause, RotateCcw, Eye, Compass, Download, Share2, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import * as THREE from 'three';
import { buildAircraftModel } from '@/components/flights/aircraftModels3D';
import { base44 } from '@/api/base44Client';
import useMp4Exporter from '@/components/flights/useMp4Exporter';
import { lateralDeviationColor, buildPathColors } from '@/components/flights/centerlineColor';
import {
  buildRunwayScene,
  makeRunwayLabelTexture,
  normalizeRunway,
  buildGeoPath,
  buildSyntheticPath,
  projectToRunwayFrame,
} from '@/components/flights/approachGeometry';
import { buildAirportEnvironment } from '@/components/flights/airportScene';

// Visualizes a slice of telemetry (final approach OR initial takeoff) as a 3D replay.
// phase: 'landing' (last N seconds, default) | 'takeoff' (first N seconds after motion)
export default function FinalApproach3D({ flight, onClose, durationSeconds = 30, phase = 'landing' }) {
  const { lang } = useLanguage();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0..1 – only used for React rendering (HUD + slider)
  const [cameraMode, setCameraMode] = useState('chase'); // chase | side | top
  const playbackStartRef = useRef(null);

  // Refs mirror state so the animation loop can read them WITHOUT re-creating the RAF loop.
  // Reading React state inside a RAF loop via useEffect deps causes the loop to be torn down
  // and rebuilt on every frame → stuttering, flicker, camera jumps. Refs fix that.
  const progressRef = useRef(0);
  const isPlayingRef = useRef(true);
  const cameraModeRef = useRef('chase');

  // User-controlled camera orbit around the aircraft. Yaw (horizontal swipe)
  // rotates around the vertical axis; pitch (vertical swipe) tilts up/down.
  // Reset whenever the user switches camera mode so each view starts neutral.
  const camOrbitRef = useRef({ yaw: 0, pitch: 0 });
  // Drag tracking via a ref (using dataset on the div was unreliable on touch).
  const dragStateRef = useRef({ active: false, lastX: 0, lastY: 0 });

  const [runway, setRunway] = useState(null); // normalized runway or null
  const [touchdownInfo, setTouchdownInfo] = useState(null); // { alongM, lateralM, ... }
  const exporter = useMp4Exporter();

  const PLAYBACK_DURATION_MS = 22000;
  const filenameBase = `skycareer-${phase}-${flight?.id || 'replay'}`;
  const filename = `${filenameBase}.mp4`;

  const runExport = (action) => {
    if (exporter.isExporting) return;
    exporter.exportAndHandle({
      action,
      getCanvas: () => mountRef.current?.querySelector('canvas') || null,
      resetPlayback: () => {
        setProgress(0);
        playbackStartRef.current = null;
        setIsPlaying(true);
      },
      durationMs: PLAYBACK_DURATION_MS,
      filename,
      title: lang === 'de' ? 'Flug-Replay' : 'Flight Replay',
    });
  };

  const statusText = (() => {
    if (!exporter.isExporting) return null;
    if (exporter.status === 'recording') return lang === 'de' ? 'Nehme Replay auf …' : 'Capturing replay …';
    if (exporter.status === 'loading_ffmpeg') return lang === 'de' ? 'Lade Encoder …' : 'Loading encoder …';
    if (exporter.status === 'converting') return lang === 'de' ? 'Konvertiere zu MP4 …' : 'Converting to MP4 …';
    return lang === 'de' ? 'Bitte warten …' : 'Please wait …';
  })();

  // Keep refs in sync with state.
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => {
    cameraModeRef.current = cameraMode;
    // Reset orbit when switching camera mode so the new view starts neutral.
    camOrbitRef.current = { yaw: 0, pitch: 0 };
  }, [cameraMode]);

  // Attach drag handlers directly to the DOM node so React re-renders (which
  // happen ~10x/sec as playback progresses) cannot tear them off mid-drag.
  // Using native listeners with { passive: false } lets us reliably prevent
  // the default touch scroll/zoom and keep the drag going for the whole gesture.
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target;
      if (target && target.closest && target.closest('button,input,a,[role="button"]')) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      dragStateRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, pointerId: e.pointerId };
    };
    const onMove = (e) => {
      const s = dragStateRef.current;
      if (!s.active || s.pointerId !== e.pointerId) return;
      e.preventDefault();
      const dx = e.clientX - s.lastX;
      const dy = e.clientY - s.lastY;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      camOrbitRef.current.yaw -= dx * 0.008;
      camOrbitRef.current.pitch += dy * 0.006;
    };
    const endDrag = (e) => {
      const s = dragStateRef.current;
      if (s.pointerId === e.pointerId || e.type === 'pointercancel') {
        s.active = false;
        try { el.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
      }
    };
    el.addEventListener('pointerdown', onDown, { passive: false });
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
    };
  }, []);

  // Extract the relevant window from telemetry history (first N sec for takeoff, last N sec for landing).
  const segment = useMemo(() => {
    const xpd = flight?.xplane_data || {};
    const history = xpd.telemetry_history || xpd.telemetryHistory || [];
    if (!Array.isArray(history) || history.length < 2) return null;

    const mapPoint = (p) => ({
      t: new Date(p?.t || 0).getTime(),
      alt: Number(p?.alt ?? p?.altitude ?? 0),
      // Cover all common speed field names: indicated, ground, true airspeed.
      spd: Number(p?.spd ?? p?.ias ?? p?.speed ?? p?.gs ?? p?.ground_speed ?? p?.tas ?? 0),
      vs: Number(p?.vs ?? p?.vertical_speed ?? 0),
      g: Number(p?.g ?? p?.g_force ?? 1),
      lat: Number(p?.lat ?? p?.latitude ?? 0),
      lon: Number(p?.lon ?? p?.lng ?? p?.longitude ?? 0),
      pitch: Number.isFinite(Number(p?.pitch)) ? Number(p.pitch) : null,
      on_ground: p?.on_ground ?? p?.onGround ?? p?.og ?? null,
    });

    let points;
    if (phase === 'takeoff') {
      // Map the entire history once so we can reason over it consistently.
      const mapped = history.map(mapPoint);

      // STEP 1: Find takeoff-roll START = the sample where ground speed transitions
      // from near-zero (< 20 kn, i.e. still standing or taxi start) into acceleration
      // reaching > 50 kn while still on the ground. This excludes taxi-out.
      let rollStartIdx = -1;
      for (let i = 0; i < mapped.length; i += 1) {
        const og = mapped[i].on_ground;
        const spd = mapped[i].spd;
        if ((og === true || og === 1 || og === null) && Number.isFinite(spd) && spd > 50) {
          // Walk backwards to the moment we were below 20 kn (start of acceleration).
          let j = i;
          while (j > 0 && Number.isFinite(mapped[j - 1].spd) && mapped[j - 1].spd > 20) {
            const ogBack = mapped[j - 1].on_ground;
            if (ogBack === false || ogBack === 0) break;
            j -= 1;
          }
          rollStartIdx = j;
          break;
        }
      }

      // STEP 2: Find the sample where we are >= 1000 ft above the takeoff-roll altitude.
      let climbEndIdx = -1;
      if (rollStartIdx >= 0) {
        const groundAlt = Number(mapped[rollStartIdx].alt) || 0;
        for (let i = rollStartIdx + 1; i < mapped.length; i += 1) {
          const a = Number(mapped[i].alt);
          if (Number.isFinite(a) && a - groundAlt >= 1000) { climbEndIdx = i; break; }
        }
        // If telemetry doesn't reach 1000 ft AGL within the window, use whatever we have.
        if (climbEndIdx < 0) climbEndIdx = mapped.length - 1;
      }

      if (rollStartIdx >= 0 && climbEndIdx > rollStartIdx) {
        points = mapped.slice(rollStartIdx, climbEndIdx + 1);
      } else {
        // Last-resort fallback: first airborne transition or first 70s.
        let liftoffIdx = -1;
        let groundSeen = false;
        for (let i = 0; i < mapped.length; i += 1) {
          const og = mapped[i].on_ground;
          if (og === true || og === 1) groundSeen = true;
          if (groundSeen && (og === false || og === 0)) { liftoffIdx = i; break; }
        }
        if (liftoffIdx > 0) {
          points = mapped.slice(Math.max(0, liftoffIdx - 10), Math.min(mapped.length, liftoffIdx + 60));
        } else {
          points = mapped.slice(0, Math.min(mapped.length, 70));
        }
      }
    } else {
      const lastTs = new Date(history[history.length - 1]?.t || Date.now()).getTime();
      if (!Number.isFinite(lastTs)) return null;
      const cutoffMs = lastTs - durationSeconds * 1000;
      points = history
        .filter((p) => {
          const ts = new Date(p?.t || 0).getTime();
          return Number.isFinite(ts) && ts >= cutoffMs;
        })
        .map(mapPoint);
    }

    if (points.length < 2) return null;

    const t0 = points[0].t;
    const tEnd = points[points.length - 1].t;
    const totalSec = Math.max(1, (tEnd - t0) / 1000);
    const minAlt = Math.min(...points.map(p => p.alt));
    const maxAlt = Math.max(...points.map(p => p.alt));

    return { points, t0, tEnd, totalSec, minAlt, maxAlt };
  }, [flight, durationSeconds, phase]);

  // Fetch real runway data from OurAirports.
  // Landing: use arrival ICAO + touchdown hint (first on-ground sample after airborne).
  // Takeoff: use departure ICAO + liftoff hint (first airborne sample) – this is
  //   always ON the runway, whereas the first-moving sample could still be on a taxiway
  //   near a parallel runway and would mis-pick the wrong runway.
  useEffect(() => {
    if (!segment) return;
    const xpd = flight?.xplane_data || {};
    const icao = phase === 'takeoff'
      ? (xpd.departure_icao || xpd.departure_airport || xpd.contract_departure_airport || flight?.departure_airport || '')
      : (xpd.arrival_icao || xpd.arrival_airport || xpd.contract_arrival_airport || flight?.arrival_airport || '');
    if (!icao) return;

    // Find the liftoff sample for takeoff, touchdown sample for landing.
    // Fall back to first/last sample if detection fails.
    let hintIdx = phase === 'takeoff' ? 0 : segment.points.length - 1;
    if (phase === 'takeoff') {
      let groundSeen = false;
      for (let i = 0; i < segment.points.length; i += 1) {
        const og = segment.points[i].on_ground;
        if (og === true || og === 1) groundSeen = true;
        if (groundSeen && (og === false || og === 0)) { hintIdx = i; break; }
      }
    } else {
      let airborneSeen = false;
      for (let i = 0; i < segment.points.length; i += 1) {
        const og = segment.points[i].on_ground;
        if (og === false || og === 0) airborneSeen = true;
        if (airborneSeen && (og === true || og === 1)) { hintIdx = i; break; }
      }
    }
    const hintPoint = segment.points[hintIdx] || {};
    const hintLat = Number.isFinite(hintPoint.lat) && Math.abs(hintPoint.lat) > 0.001
      ? hintPoint.lat
      : Number((phase === 'takeoff' ? xpd.departure_lat : xpd.arrival_lat) || 0);
    const hintLon = Number.isFinite(hintPoint.lon) && Math.abs(hintPoint.lon) > 0.001
      ? hintPoint.lon
      : Number((phase === 'takeoff' ? xpd.departure_lon : xpd.arrival_lon) || 0);

    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('getRunwayInfo', {
          icao, touchdown_lat: hintLat, touchdown_lon: hintLon,
        });
        if (cancelled) return;
        const picked = res?.data?.landing_runway;
        if (picked) setRunway(normalizeRunway(picked));
      } catch (_) {
        // leave runway as null – scene will render without designator label
      }
    })();
    return () => { cancelled = true; };
  }, [segment, flight, phase]);

  // Build 3D scene
  useEffect(() => {
    if (!segment || !mountRef.current) return;

    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    // Dusk sky – deep blue but bright enough to see the whole scene clearly.
    scene.background = new THREE.Color(0x1e2e4a);
    scene.fog = new THREE.Fog(0x1e2e4a, 1500, 8500);

    // Near=2 (instead of 0.1) dramatically increases depth-buffer precision,
    // which fixes the runway/shadow z-fighting flicker on large scenes.
    const camera = new THREE.PerspectiveCamera(55, width / height, 2, 12000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    // Sky dome with gradient (horizon glow). Radius > camera.far / 2 so the
    // camera never flies through the dome even during long takeoff replays.
    const skyGeo = new THREE.SphereGeometry(8000, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x162440) },
        horizonColor: { value: new THREE.Color(0x4a5a7a) },
        glowColor: { value: new THREE.Color(0xff9a5a) },
      },
      vertexShader: `varying vec3 vWorldPos; void main(){ vWorldPos = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 glowColor;
        varying vec3 vWorldPos;
        void main(){
          float h = normalize(vWorldPos).y;
          float horizon = smoothstep(-0.05, 0.55, h);
          vec3 base = mix(horizonColor, topColor, horizon);
          // Warm sunset glow band at the horizon.
          float glow = smoothstep(0.25, -0.02, h) * smoothstep(-0.25, -0.02, h);
          base += glowColor * glow * 0.55;
          gl_FragColor = vec4(base, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Dusk lighting: bright enough to read the scene but keeping the evening mood.
    scene.add(new THREE.HemisphereLight(0x8ea4c8, 0x2a3020, 1.1));
    scene.add(new THREE.AmbientLight(0xc8d4e8, 0.6));
    const sunLight = new THREE.DirectionalLight(0xffb070, 1.4);
    sunLight.position.set(-400, 120, -200);
    scene.add(sunLight);
    const fillLight = new THREE.DirectionalLight(0x7aa0d4, 0.7);
    fillLight.position.set(180, 150, 120);
    scene.add(fillLight);

    // Ground – dusk-lit grass, visible but not daylight-bright.
    const groundGeo = new THREE.PlaneGeometry(12000, 12000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x384a2e, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    scene.add(ground);

    // Darker grass patches (variation) scattered around the airfield to break
    // up the uniform ground and give depth cues when flying over.
    const patchMat = new THREE.MeshStandardMaterial({ color: 0x2a3a22, roughness: 1, metalness: 0 });
    for (let i = 0; i < 40; i += 1) {
      const w = 80 + Math.random() * 220;
      const d = 80 + Math.random() * 220;
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(w, d), patchMat);
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = Math.random() * Math.PI;
      const angle = Math.random() * Math.PI * 2;
      const radius = 300 + Math.random() * 2500;
      patch.position.set(Math.cos(angle) * radius, -1.4, Math.sin(angle) * radius);
      scene.add(patch);
    }

    // =================================================================
    // Dense natural + built environment around the airfield.
    // Uses InstancedMesh for trees & shrubs so we can place thousands of
    // objects cheaply (one draw call each). Small houses and field patches
    // add variety so the scene doesn't feel empty.
    // =================================================================

    // Runway corridor approximation (real length resolved later via buildRunwayScene).
    // The corridor is now wide enough to also protect the parallel taxiway,
    // apron, terminal, hangars and tower on BOTH sides of the runway so trees
    // and houses don't sprout through airport infrastructure.
    const approxRwyLen = Math.max(800, runway?.lengthM || 2500);
    const insideRunwayCorridor = (x, z) =>
      Math.abs(x) < 450 && z < 250 && z > -approxRwyLen - 250;

    // ---- Trees (3 instanced variants: conifers, broadleaf, tall pines) ----
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 1 });
    const leafMatA = new THREE.MeshStandardMaterial({ color: 0x2a4a28, roughness: 0.95 });
    const leafMatB = new THREE.MeshStandardMaterial({ color: 0x1f3a20, roughness: 0.95 });
    const leafMatC = new THREE.MeshStandardMaterial({ color: 0x355a30, roughness: 0.95 });

    const TREE_COUNT = 4500;
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.45, 3, 5);
    const coneLeavesGeo = new THREE.ConeGeometry(2.2, 6, 6);
    const sphereLeavesGeo = new THREE.SphereGeometry(2.4, 6, 5);

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_COUNT);
    const coneInst = new THREE.InstancedMesh(coneLeavesGeo, leafMatA, Math.floor(TREE_COUNT * 0.6));
    const broadInst = new THREE.InstancedMesh(sphereLeavesGeo, leafMatC, TREE_COUNT - Math.floor(TREE_COUNT * 0.6));

    const dummy = new THREE.Object3D();
    let coneIdx = 0;
    let broadIdx = 0;
    for (let i = 0; i < TREE_COUNT; i += 1) {
      // Bias placement toward clusters (forests) by squaring uniform rand.
      const angle = Math.random() * Math.PI * 2;
      const radius = 160 + Math.pow(Math.random(), 0.6) * 3400;
      const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 40;
      const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 40;
      if (insideRunwayCorridor(x, z)) { // skip runway corridor
        // Re-randomize to a guaranteed safe spot far off-axis.
        const altAngle = (Math.random() * Math.PI) + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
        const altR = 400 + Math.random() * 2800;
        dummy.position.set(Math.cos(altAngle) * altR, 0, Math.sin(altAngle) * altR);
      } else {
        dummy.position.set(x, 0, z);
      }
      const scale = 0.7 + Math.random() * 1.8;
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = Math.random() * Math.PI * 2;

      // Trunk
      dummy.position.y = 1.5 * scale - 1.5;
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);

      // Leaves (either conifer cone or broadleaf sphere)
      const isConifer = Math.random() < 0.6;
      dummy.position.y = (isConifer ? 6 : 5) * scale - 1.5;
      dummy.updateMatrix();
      if (isConifer && coneIdx < coneInst.count) {
        coneInst.setMatrixAt(coneIdx, dummy.matrix);
        coneIdx += 1;
      } else if (!isConifer && broadIdx < broadInst.count) {
        broadInst.setMatrixAt(broadIdx, dummy.matrix);
        broadIdx += 1;
      }
    }
    trunkInst.instanceMatrix.needsUpdate = true;
    coneInst.instanceMatrix.needsUpdate = true;
    broadInst.instanceMatrix.needsUpdate = true;
    // Randomize conifer color variation via a second instanced mesh.
    const darkConeInst = new THREE.InstancedMesh(coneLeavesGeo, leafMatB, 800);
    for (let i = 0; i < 800; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 250 + Math.random() * 3200;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (insideRunwayCorridor(x, z)) { i -= 1; continue; }
      const s = 0.8 + Math.random() * 1.6;
      dummy.position.set(x, 6 * s - 1.5, z);
      dummy.scale.set(s, s, s);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      darkConeInst.setMatrixAt(i, dummy.matrix);
    }
    darkConeInst.instanceMatrix.needsUpdate = true;
    scene.add(trunkInst, coneInst, broadInst, darkConeInst);

    // ---- Shrubs / bushes (small low spheres) ----
    const shrubMat = new THREE.MeshStandardMaterial({ color: 0x2f4a2a, roughness: 1 });
    const shrubGeo = new THREE.SphereGeometry(1.1, 5, 4);
    const shrubInst = new THREE.InstancedMesh(shrubGeo, shrubMat, 2000);
    for (let i = 0; i < 2000; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 160 + Math.random() * 3400;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (insideRunwayCorridor(x, z)) { i -= 1; continue; }
      const s = 0.6 + Math.random() * 1.4;
      dummy.position.set(x, 0.5 * s - 1.2, z);
      dummy.scale.set(s, s * 0.7, s);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      shrubInst.setMatrixAt(i, dummy.matrix);
    }
    shrubInst.instanceMatrix.needsUpdate = true;
    scene.add(shrubInst);

    // ---- Farmland patches (brown and yellow rectangles scattered in the distance) ----
    const farmColors = [0x6b5a2e, 0x8a7a3e, 0x9a8a4a, 0x4a5a2a, 0x7a6a2a, 0x3a4a22];
    for (let i = 0; i < 140; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1200 + Math.random() * 2400;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (insideRunwayCorridor(x, z)) continue;
      const w = 60 + Math.random() * 200;
      const d = 60 + Math.random() * 200;
      const field = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({
          color: farmColors[Math.floor(Math.random() * farmColors.length)],
          roughness: 1,
          metalness: 0,
        }),
      );
      field.rotation.x = -Math.PI / 2;
      field.rotation.z = Math.random() * Math.PI;
      field.position.set(x, -1.35, z);
      scene.add(field);
    }

    // ---- Small houses (suburban style, scattered off the runway axis) ----
    const houseWallMat = new THREE.MeshStandardMaterial({ color: 0xbdaa8a, roughness: 0.9 });
    const houseWallMatB = new THREE.MeshStandardMaterial({ color: 0xd4c4a0, roughness: 0.9 });
    const houseWallMatC = new THREE.MeshStandardMaterial({ color: 0x9a8060, roughness: 0.9 });
    const houseRoofMat = new THREE.MeshStandardMaterial({ color: 0x6a2a1e, roughness: 0.95 });
    const houseRoofMatB = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.95 });
    const houseWallMats = [houseWallMat, houseWallMatB, houseWallMatC];
    const houseRoofMats = [houseRoofMat, houseRoofMatB];
    for (let i = 0; i < 260; i += 1) {
      const side = Math.random() > 0.5 ? -1 : 1;
      const lateral = side * (250 + Math.random() * 2400);
      const along = (Math.random() - 0.5) * 4000;
      if (insideRunwayCorridor(lateral, along)) continue;
      const w = 4 + Math.random() * 4;
      const d = 5 + Math.random() * 6;
      const h = 3 + Math.random() * 3;
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        houseWallMats[Math.floor(Math.random() * houseWallMats.length)],
      );
      wall.position.set(lateral, h / 2 - 1.5, along);
      wall.rotation.y = Math.random() * Math.PI;
      scene.add(wall);
      // Pitched roof (triangular prism via scaled box rotated)
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.75, 2.2, 4),
        houseRoofMats[Math.floor(Math.random() * houseRoofMats.length)],
      );
      roof.rotation.y = wall.rotation.y + Math.PI / 4;
      roof.position.set(lateral, h - 1.5 + 1.0, along);
      scene.add(roof);
    }

    // ---- Roads: a few long dark strips crossing the landscape ----
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 1 });
    for (let i = 0; i < 6; i += 1) {
      const length = 2500 + Math.random() * 2000;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(8, length), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = Math.random() * Math.PI;
      const r = 600 + Math.random() * 2200;
      const a = Math.random() * Math.PI * 2;
      road.position.set(Math.cos(a) * r, -1.3, Math.sin(a) * r);
      scene.add(road);
    }

    // Canvas-based window texture: dark facade with randomly lit windows so
    // buildings read as a night skyline. Each call produces a unique pattern.
    const makeWindowTexture = (cols, rows, litChance = 0.55) => {
      const c = document.createElement('canvas');
      c.width = cols * 16;
      c.height = rows * 20;
      const ctx = c.getContext('2d');
      // Dark facade base.
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, c.width, c.height);
      const warmColors = ['#ffd68a', '#ffc062', '#ffe3a8', '#f7b45c', '#d9e9ff', '#c9d8ff'];
      for (let r = 0; r < rows; r += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (Math.random() > litChance) continue;
          const x = col * 16 + 3;
          const y = r * 20 + 4;
          ctx.fillStyle = warmColors[Math.floor(Math.random() * warmColors.length)];
          ctx.globalAlpha = 0.7 + Math.random() * 0.3;
          ctx.fillRect(x, y, 10, 12);
        }
      }
      ctx.globalAlpha = 1;
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    };

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.9 });

    // Airport / hangar + skyline buildings: tall blocks with emissive window
    // textures so they glow like a night skyline. Scattered around the runway.
    for (let i = 0; i < 48; i += 1) {
      const side = Math.random() > 0.5 ? -1 : 1;
      const lateral = side * (180 + Math.random() * 900);
      const along = -Math.random() * 3000 + 400;
      const w = 22 + Math.random() * 50;
      // Mix of short hangars (~10m) and taller skyline blocks (up to 90m).
      const tall = Math.random() > 0.5;
      const h = tall ? 30 + Math.random() * 70 : 8 + Math.random() * 14;
      const d = 25 + Math.random() * 55;
      const cols = Math.max(3, Math.round(w / 5));
      const rows = Math.max(2, Math.round(h / 4));
      const tex = makeWindowTexture(cols, rows, tall ? 0.6 : 0.35);
      const bodyMat = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: 0xffd68a,
        emissiveIntensity: 1.1,
        color: 0x0a0d14,
        roughness: 0.85,
        metalness: 0.1,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
      body.position.set(lateral, h / 2 - 1.5, along);
      scene.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.6, d * 1.02), roofMat);
      roof.position.set(lateral, h - 1.5 + 0.3, along);
      scene.add(roof);
    }

    // Realistic mountain range: a ring of rugged heightfield meshes wrapped
    // around the horizon. Each mountain is a displaced grid with multi-octave
    // pseudo-noise, giving ridges, saddles, and valleys instead of smooth cones.
    // Vertex colors shade by altitude: dark rock at the base → lighter rock mid
    // → white snow on peaks, so the shape reads as real terrain.
    const mountainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true,
      metalness: 0,
    });
    // Simple hash-based value noise (deterministic, no external lib).
    const hash2 = (x, y) => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const smoothstep = (t) => t * t * (3 - 2 * t);
    const valueNoise = (x, y) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const a = hash2(xi, yi);
      const b = hash2(xi + 1, yi);
      const c = hash2(xi, yi + 1);
      const d = hash2(xi + 1, yi + 1);
      const u = smoothstep(xf);
      const v = smoothstep(yf);
      return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    };
    const fbm = (x, y) => {
      let sum = 0;
      let amp = 1;
      let freq = 1;
      let norm = 0;
      for (let o = 0; o < 4; o += 1) {
        sum += valueNoise(x * freq, y * freq) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2.05;
      }
      return sum / norm;
    };

    const ringCount = 28;
    const rockLow = new THREE.Color(0x2a3848);
    const rockHigh = new THREE.Color(0x6a7486);
    const snowColor = new THREE.Color(0xe8ecf2);
    for (let i = 0; i < ringCount; i += 1) {
      const angle = (i / ringCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.05;
      const radius = 4000 + Math.random() * 1200;
      const chunkWidth = 1400 + Math.random() * 500;
      const chunkDepth = 700 + Math.random() * 300;
      const peakHeight = 500 + Math.random() * 500;
      const seedX = Math.random() * 100;
      const seedY = Math.random() * 100;
      // Segmented plane, bent into a ridge and displaced with fbm noise.
      const segW = 28;
      const segD = 12;
      const geo = new THREE.PlaneGeometry(chunkWidth, chunkDepth, segW, segD);
      geo.rotateX(-Math.PI / 2); // lay flat
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let v = 0; v < pos.count; v += 1) {
        const px = pos.getX(v);
        const pz = pos.getZ(v);
        // Ridge shape: height falls off toward edges in both axes.
        const ridgeX = 1 - Math.pow(Math.abs(px / (chunkWidth / 2)), 1.6);
        const ridgeZ = 1 - Math.pow(Math.abs(pz / (chunkDepth / 2)), 1.4);
        const ridge = Math.max(0, ridgeX) * Math.max(0, ridgeZ);
        // Multi-octave noise for rugged variation.
        const n = fbm(px * 0.003 + seedX, pz * 0.004 + seedY);
        const sharpness = Math.pow(ridge, 1.3);
        const h = peakHeight * sharpness * (0.55 + n * 0.85);
        pos.setY(v, h);
        // Altitude-based color: rock gradient + snow on top.
        const t = Math.min(1, h / peakHeight);
        const c = new THREE.Color();
        if (t > 0.72) {
          const snowT = Math.min(1, (t - 0.72) / 0.2);
          c.copy(rockHigh).lerp(snowColor, snowT);
        } else {
          c.copy(rockLow).lerp(rockHigh, t / 0.72);
        }
        // Slight random darkening per vertex for texture.
        const shade = 0.85 + Math.random() * 0.15;
        colors[v * 3] = c.r * shade;
        colors[v * 3 + 1] = c.g * shade;
        colors[v * 3 + 2] = c.b * shade;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mountain = new THREE.Mesh(geo, mountainMat);
      // Orient the ridge to face the scene center.
      mountain.position.set(Math.cos(angle) * radius, -1.5, Math.sin(angle) * radius);
      mountain.rotation.y = -angle + Math.PI / 2;
      scene.add(mountain);
    }

    // Runway - built from real OurAirports data when available, else generic.
    const { group: runwayGroup, runwayLenM, runwayWidthM } = buildRunwayScene(runway, makeRunwayLabelTexture);
    scene.add(runwayGroup);

    // Airport environment around the runway: parallel taxiway, connecting
    // stubs, apron, terminal with jet bridges, tower, hangars, fuel farm,
    // parking lot, and GA apron on the other side.
    const airportGroup = buildAirportEnvironment({ runwayLenM, runwayWidthM });
    scene.add(airportGroup);

    // Build 3D path referenced to the runway frame (georeferenced when possible).
    const geoPath = runway ? buildGeoPath(segment.points, runway) : null;
    const rawPath = (geoPath && geoPath.length >= 2)
      ? geoPath
      : buildSyntheticPath(segment.points, runway, phase);

    // Smooth the path with a Catmull-Rom spline and use getSpacedPoints to
    // distribute samples by arc-length (constant speed), not by parameter t
    // (which produces speed-up/slow-down artifacts between control points).
    const curve = new THREE.CatmullRomCurve3(rawPath, false, 'catmullrom', 0.25);
    const smoothCount = Math.max(rawPath.length * 8, 200);
    const path3D = curve.getSpacedPoints(smoothCount);

    // Identify the REAL touchdown / liftoff telemetry sample (not spline).
    // Landing: first on_ground=true after airborne. Takeoff: first on_ground=false after ground.
    // Fallback uses altitude transitions in the actual telemetry.
    let realTdPointIdx = -1;
    if (phase === 'takeoff') {
      let groundSeen = false;
      for (let i = 0; i < segment.points.length; i += 1) {
        const og = segment.points[i].on_ground;
        if (og === true || og === 1) groundSeen = true;
        if (groundSeen && (og === false || og === 0)) { realTdPointIdx = i; break; }
      }
      if (realTdPointIdx < 0) {
        // Altitude fallback: first sample significantly above minimum.
        const minA = Math.min(...segment.points.map(p => p.alt));
        for (let i = 0; i < segment.points.length; i += 1) {
          if (segment.points[i].alt > minA + 50) { realTdPointIdx = i; break; }
        }
      }
    } else {
      let airborneSeen = false;
      for (let i = 0; i < segment.points.length; i += 1) {
        const og = segment.points[i].on_ground;
        if (og === false || og === 0) airborneSeen = true;
        if (airborneSeen && (og === true || og === 1)) { realTdPointIdx = i; break; }
      }
      if (realTdPointIdx < 0) {
        // Altitude fallback: lowest altitude sample in the second half.
        const half = Math.floor(segment.points.length / 2);
        let minA = Infinity;
        for (let i = half; i < segment.points.length; i += 1) {
          if (segment.points[i].alt < minA) { minA = segment.points[i].alt; realTdPointIdx = i; }
        }
      }
    }

    // Pick the spline index closest in time to the real touchdown for 3D visualization.
    let touchdownIdx = -1;
    if (realTdPointIdx >= 0) {
      const targetT = segment.points[realTdPointIdx].t;
      const tNorm = (targetT - segment.t0) / Math.max(1, segment.tEnd - segment.t0);
      touchdownIdx = Math.round(tNorm * (path3D.length - 1));
    }
    if (touchdownIdx < 0) touchdownIdx = Math.floor(path3D.length / 2);

    // Visualize the touchdown point – large ground crosshair + tall glowing
    // beacon so it remains visible from the chase camera (which sits behind
    // and above the aircraft and would otherwise let the plane occlude a
    // small ground ring).
    if (touchdownIdx >= 0 && path3D[touchdownIdx]) {
      const td = path3D[touchdownIdx];
      // Color the touchdown / liftoff marker by lateral deviation from the
      // centerline. Prefer the REAL telemetry lateral (projected from lat/lon)
      // when available; otherwise fall back to the spline x-coordinate.
      let markerLateralM = Math.abs(td.x);
      if (runway && realTdPointIdx >= 0) {
        const rp = segment.points[realTdPointIdx];
        if (Number.isFinite(rp.lat) && Number.isFinite(rp.lon) &&
            Math.abs(rp.lat) + Math.abs(rp.lon) > 0.001) {
          const proj = projectToRunwayFrame(rp.lat, rp.lon, runway);
          markerLateralM = Math.abs(proj.lateralM);
        }
      }
      const markerColor = lateralDeviationColor(markerLateralM);

      // Compact ring marker – thin but bright. depthTest off so it stays
      // visible when the aircraft is directly above.
      const ringGeo = new THREE.RingGeometry(4, 5, 40);
      const ringMat = new THREE.MeshBasicMaterial({ color: markerColor, side: THREE.DoubleSide, transparent: true, opacity: 1, depthTest: false });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(td.x, 0.3, td.z);
      ring.renderOrder = 10;
      scene.add(ring);

      // Slim vertical beacon so the spot is findable from far away without
      // dominating the scene like before.
      const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 200, 8);
      const pillarMat = new THREE.MeshBasicMaterial({ color: markerColor, transparent: true, opacity: 0.6, depthTest: false });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(td.x, 100, td.z);
      pillar.renderOrder = 8;
      scene.add(pillar);

      // For the HUD readout, project the REAL telemetry coordinate (lat/lon)
      // into the runway frame → true meters, no spline interpolation.
      if (runway && realTdPointIdx >= 0) {
        const realPt = segment.points[realTdPointIdx];
        if (Number.isFinite(realPt.lat) && Number.isFinite(realPt.lon) &&
            Math.abs(realPt.lat) + Math.abs(realPt.lon) > 0.001) {
          const { alongM, lateralM } = projectToRunwayFrame(realPt.lat, realPt.lon, runway);
          setTouchdownInfo({
            alongM,         // >0 short of threshold, <0 past threshold
            lateralM,       // >0 right of centerline, <0 left
            shortOfThreshold: alongM > 0,
            runwayLenM,
            runwayWidthM: runway.widthM,
          });
        } else {
          setTouchdownInfo(null);
        }
      } else {
        setTouchdownInfo(null);
      }
    }

    // Pre-compute vertex colors for the path: each vertex is colored based on
    // its lateral distance from the runway centerline (only meaningful when we
    // have a georeferenced path; otherwise all vertices end up emerald).
    const pathColors = buildPathColors(path3D);

    // Path line (full) – backdrop showing the entire trajectory. Kept at
    // high opacity so the color grading is clearly readable.
    const pathGeo = new THREE.BufferGeometry().setFromPoints(path3D);
    pathGeo.setAttribute('color', new THREE.BufferAttribute(pathColors, 3));
    const pathMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });
    const pathLine = new THREE.Line(pathGeo, pathMat);
    scene.add(pathLine);

    // Active path (grows during replay) – fully opaque, same per-vertex colors.
    const activePathGeo = new THREE.BufferGeometry();
    const activePathMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: false });
    const activePathLine = new THREE.Line(activePathGeo, activePathMat);
    scene.add(activePathLine);

    // Glow halo: a second, thicker line underneath the main path with the
    // same vertex colors but lower opacity – makes the colored path pop
    // against the dark ground from any camera angle.
    const pathHaloGeo = new THREE.BufferGeometry().setFromPoints(path3D);
    pathHaloGeo.setAttribute('color', new THREE.BufferAttribute(pathColors, 3));
    const pathHaloMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false });
    const pathHalo = new THREE.Line(pathHaloGeo, pathHaloMat);
    pathHalo.renderOrder = 1;
    scene.add(pathHalo);

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

    sceneRef.current = { scene, camera, renderer, path3D, pathColors, planeMesh, ring, shadow, strobe, trailGeo, activePathGeo, activePathLine, segment };

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
        trailGeo.dispose(); trailMat.dispose();
        skyGeo.dispose(); skyMat.dispose();
      } catch (_) { /* ignore cleanup errors */ }
    };
  }, [segment, runway]);

  // Keep progress ref in sync for the animation loop.
  useEffect(() => { progressRef.current = progress; }, [progress]);

  // Animation loop – depends ONLY on segment/runway (via sceneRef).
  // Reads all playback state through refs so the RAF loop is never torn
  // down mid-animation (which caused the stuttering).
  useEffect(() => {
    if (!sceneRef.current) return;
    const sceneData = sceneRef.current;
    const { path3D } = sceneData;
    const PLAYBACK_DURATION_MS = 22000;
    // Smooth rotation state (low-pass filter) so Yaw/Pitch/Bank transitions
    // across sparse telemetry samples don't look jittery.
    const rotState = { yaw: null, pitch: null, bank: null, lastTime: performance.now() };
    // Smooth chase-camera direction vector so it doesn't snap between samples.
    const camState = { backDir: null };
    let lastStateSyncAt = 0;

    const animate = (now) => {
      if (!sceneRef.current) return;
      const { scene, camera, renderer, planeMesh, shadow, strobe, trailGeo, activePathGeo } = sceneRef.current;

      let currentProgress = progressRef.current;
      if (isPlayingRef.current) {
        if (playbackStartRef.current === null) {
          playbackStartRef.current = now - currentProgress * PLAYBACK_DURATION_MS;
        }
        const elapsed = now - playbackStartRef.current;
        currentProgress = Math.min(1, elapsed / PLAYBACK_DURATION_MS);
        progressRef.current = currentProgress;
        // Only sync to React state ~10x/sec (HUD + slider) – every-frame
        // setState caused re-renders that made the whole loop hitch.
        if (now - lastStateSyncAt > 100) {
          lastStateSyncAt = now;
          setProgress(currentProgress);
        }
        if (currentProgress >= 1) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          playbackStartRef.current = null;
          setProgress(1);
        }
      }

      const idxFloat = currentProgress * (path3D.length - 1);
      const idx = Math.floor(idxFloat);
      const frac = idxFloat - idx;
      const cur = path3D[idx];
      const next = path3D[Math.min(path3D.length - 1, idx + 1)];
      const pos = new THREE.Vector3().lerpVectors(cur, next, frac);
      const MIN_GROUND_CLEARANCE = 3;
      if (pos.y < MIN_GROUND_CLEARANCE) pos.y = MIN_GROUND_CLEARANCE;
      planeMesh.position.copy(pos);

      const altScale = Math.max(0.3, 1 - pos.y / 200);
      shadow.position.set(pos.x, 0.06, pos.z);
      shadow.scale.setScalar(altScale * 2);
      shadow.material.opacity = 0.4 * altScale;

      // Use a wider look-ahead window for yaw so the direction vector doesn't
      // snap between adjacent sparse samples.
      const lookBackIdx = Math.max(0, idx - 2);
      const lookFwdIdx = Math.min(path3D.length - 1, idx + 3);
      const dirSmooth = new THREE.Vector3().subVectors(path3D[lookFwdIdx], path3D[lookBackIdx]);
      if (dirSmooth.length() > 0.001) {
        dirSmooth.normalize();
        const targetYaw = Math.atan2(-dirSmooth.z, dirSmooth.x);
        const segPoints = sceneRef.current?.segment?.points || [];
        const pathProgressIdx = Math.min(segPoints.length - 1, Math.floor(currentProgress * (segPoints.length - 1)));
        const realPitchDeg = segPoints[pathProgressIdx]?.pitch;
        let targetPitch;
        if (Number.isFinite(realPitchDeg)) targetPitch = (realPitchDeg * Math.PI) / 180;
        else targetPitch = Math.asin(Math.max(-1, Math.min(1, dirSmooth.y)));

        const dxFwd = path3D[lookFwdIdx].x - path3D[lookBackIdx].x;
        const dzFwd = path3D[lookFwdIdx].z - path3D[lookBackIdx].z;
        const turnRate = Math.atan2(dxFwd, Math.max(0.1, Math.abs(dzFwd))) * 0.8;
        const targetBank = Math.max(-0.4, Math.min(0.4, turnRate));

        // Low-pass filter (exponential smoothing) for all three axes. dt-based
        // so it behaves the same regardless of framerate.
        const dt = Math.max(0.001, Math.min(0.1, (now - rotState.lastTime) / 1000));
        rotState.lastTime = now;
        const smoothFactor = 1 - Math.exp(-dt * 6); // ~160ms time constant
        const shortestAngle = (a, b) => {
          let d = b - a;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          return d;
        };
        if (rotState.yaw === null) {
          rotState.yaw = targetYaw;
          rotState.pitch = targetPitch;
          rotState.bank = targetBank;
        } else {
          rotState.yaw += shortestAngle(rotState.yaw, targetYaw) * smoothFactor;
          rotState.pitch += (targetPitch - rotState.pitch) * smoothFactor;
          rotState.bank += (targetBank - rotState.bank) * smoothFactor;
        }

        planeMesh.rotation.set(0, 0, 0);
        planeMesh.rotateY(rotState.yaw);
        // Pitch axis is inverted for our aircraft model (nose points +X):
        // positive pitch must lift the nose, so rotate by -pitch around Z.
        planeMesh.rotateZ(-rotState.pitch);
        planeMesh.rotateX(rotState.bank);
      }

      if (strobe) {
        const flashPhase = (now % 1200) / 1200;
        strobe.material.opacity = flashPhase < 0.05 ? 1 : flashPhase < 0.12 ? 0.8 : 0;
      }

      const activePoints = path3D.slice(0, idx + 1);
      activePoints.push(pos);
      activePathGeo.setFromPoints(activePoints);
      // Carry over per-vertex colors for the active path so each segment is
      // colored by its centerline deviation. Last vertex (current position)
      // reuses the color of the previous sample.
      const colorsSrc = sceneRef.current?.pathColors;
      if (colorsSrc) {
        const subColors = new Float32Array(activePoints.length * 3);
        const copyLen = Math.min(idx + 1, path3D.length) * 3;
        subColors.set(colorsSrc.subarray(0, copyLen));
        const lastBase = (Math.min(idx, path3D.length - 1)) * 3;
        const tail = (activePoints.length - 1) * 3;
        subColors[tail] = colorsSrc[lastBase];
        subColors[tail + 1] = colorsSrc[lastBase + 1];
        subColors[tail + 2] = colorsSrc[lastBase + 2];
        activePathGeo.setAttribute('color', new THREE.BufferAttribute(subColors, 3));
      }
      if (trailGeo) {
        const trailPts = activePoints.slice(-25);
        trailGeo.setFromPoints(trailPts);
      }

      const camMode = cameraModeRef.current;
      const orbit = camOrbitRef.current;
      if (camMode === 'top') {
        // Top-down view: horizontal swipe rotates, vertical swipe zooms via pitch.
        camera.up.set(0, 0, -1);
        const zoom = 1 + orbit.pitch * 1.5; // pitch drag moves closer / farther
        const radius = 220 * Math.max(0.4, Math.min(3, zoom));
        const cos = Math.cos(orbit.yaw);
        const sin = Math.sin(orbit.yaw);
        camera.position.set(sin * radius * 0.2, radius, pos.z + cos * radius * 0.2);
        camera.lookAt(0, 0, pos.z);
      } else {
        camera.up.set(0, 1, 0);
        // Shared orbit parameters: horizontal swipe rotates around the plane,
        // vertical swipe tilts the view up/down. Pitch is clamped so the
        // camera can't flip upside down or go below the ground.
        const orbitPitch = Math.max(-0.4, Math.min(1.0, orbit.pitch));
        if (camMode === 'chase') {
          // Base "behind the aircraft" direction, smoothed so it doesn't snap.
          const rawBack = new THREE.Vector3().subVectors(cur, next);
          if (rawBack.length() < 0.001) rawBack.set(0, 0, 1);
          rawBack.normalize();
          if (!camState.backDir) {
            camState.backDir = rawBack.clone();
          } else {
            const dt = Math.max(0.001, Math.min(0.1, (now - rotState.lastTime) / 1000));
            const camSmooth = 1 - Math.exp(-dt * 5);
            camState.backDir.lerp(rawBack, camSmooth).normalize();
          }
          // Rotate the back-direction around Y by user yaw, then tilt by pitch.
          const baseAngle = Math.atan2(camState.backDir.x, camState.backDir.z);
          const angle = baseAngle + orbit.yaw;
          const radius = 80;
          const height = 30 + orbitPitch * 60;
          const horiz = Math.cos(orbitPitch) * radius;
          camera.position.set(
            pos.x + Math.sin(angle) * horiz,
            pos.y + height,
            pos.z + Math.cos(angle) * horiz,
          );
          camera.lookAt(pos.x, pos.y + 5, pos.z);
        } else {
          // TRUE side view: camera sits perpendicular to the aircraft's
          // heading so you see the plane's profile (wing-on). We derive a
          // perpendicular vector from the smoothed flight direction and let
          // the user orbit around the plane from that baseline.
          const radius = 140;
          const height = Math.max(40, pos.y + 35) + orbitPitch * 60;
          // Flight direction on the horizontal plane.
          const fwd = new THREE.Vector3().subVectors(next, cur);
          fwd.y = 0;
          if (fwd.lengthSq() < 0.0001) fwd.set(1, 0, 0);
          fwd.normalize();
          // Perpendicular vector (left side of aircraft by default).
          const perp = new THREE.Vector3(-fwd.z, 0, fwd.x);
          // Start angle points along 'perp'; user yaw drag rotates around plane.
          const baseAngle = Math.atan2(perp.x, perp.z);
          const angle = baseAngle + orbit.yaw;
          const horiz = Math.cos(orbitPitch) * radius;
          camera.position.set(
            pos.x + Math.sin(angle) * horiz,
            height,
            pos.z + Math.cos(angle) * horiz,
          );
          camera.lookAt(pos);
        }
      }

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [segment, runway]);

  const handlePlayPause = () => {
    const PLAYBACK_DURATION_MS = 22000;
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
                {phase === 'takeoff' ? 'TAKEOFF REPLAY' : 'LANDING REPLAY'}
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => runExport('download')}
            disabled={exporter.isExporting}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded border border-emerald-700 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-60 disabled:cursor-not-allowed text-[10px] font-mono uppercase tracking-wider transition-colors"
            title={lang === 'de' ? 'Als MP4 speichern' : 'Save as MP4'}
          >
            {exporter.isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{lang === 'de' ? 'MP4 speichern' : 'Save MP4'}</span>
          </button>
          <button
            onClick={() => runExport('share')}
            disabled={exporter.isExporting}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded border border-cyan-700 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/50 disabled:opacity-60 disabled:cursor-not-allowed text-[10px] font-mono uppercase tracking-wider transition-colors"
            title={lang === 'de' ? 'MP4 teilen' : 'Share MP4'}
          >
            {exporter.isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{lang === 'de' ? 'Teilen' : 'Share'}</span>
          </button>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-red-300 hover:border-red-500/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {exporter.error && (
        <div className="px-4 py-1.5 bg-red-950/60 border-b border-red-800/50 text-[10px] font-mono text-red-300">
          {exporter.error}
        </div>
      )}
      {exporter.isExporting && statusText && (
        <div className="px-4 py-1.5 bg-cyan-950/40 border-b border-cyan-800/50 flex items-center gap-2 text-[10px] font-mono text-cyan-300">
          <Loader2 className="w-3 h-3 animate-spin" />
          {statusText}
        </div>
      )}

      {/* 3D Canvas */}
      <div
        ref={mountRef}
        className="flex-1 relative cursor-grab active:cursor-grabbing"
        style={{ minHeight: 0, touchAction: 'none' }}
      >
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
          <div className="pointer-events-none absolute top-4 left-4 bg-slate-950/90 border border-cyan-500/40 rounded-md p-3 font-mono backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.15)] min-w-[200px]">
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

        {/* Touchdown / Liftoff Analysis HUD – compact single-line pill */}
        {touchdownInfo && (() => {
          // Phase-specific centerline impact from the flight record.
          const rwAcc = flight?.xplane_data?.runway_accuracy || null;
          const phaseAcc = phase === 'takeoff' ? rwAcc?.takeoff : rwAcc?.landing;
          const scoreDelta = Number(phaseAcc?.scoreDelta || 0);
          const cashDelta = Number(phaseAcc?.cashDelta || 0);
          const rmsM = Number(phaseAcc?.rmsMeters || 0);
          const scoreColor = scoreDelta > 0 ? 'text-emerald-400' : scoreDelta < 0 ? 'text-red-400' : 'text-slate-400';
          const cashColor = cashDelta > 0 ? 'text-emerald-400' : cashDelta < 0 ? 'text-red-400' : 'text-slate-400';
          const alongM = touchdownInfo.alongM;
          const lateralM = touchdownInfo.lateralM;
          // Include 6m shoulders on each side (matches rendered paved area and
          // accounts for ~5m GPS offsets vs OurAirports centerline data).
          const halfWidth = (touchdownInfo.runwayWidthM || 45) / 2 + 6;
          const runwayLen = touchdownInfo.runwayLenM || 2500;
          const distFromThreshold = -alongM;
          let labelText;
          let labelColor;
          if (phase === 'takeoff') {
            if (alongM > 0) { labelText = lang === 'de' ? 'FRUEH' : 'EARLY'; labelColor = 'text-amber-400'; }
            else if (distFromThreshold > runwayLen) { labelText = lang === 'de' ? 'UEBER ENDE' : 'PAST END'; labelColor = 'text-red-400'; }
            else if (distFromThreshold < 600) { labelText = lang === 'de' ? 'KURZ' : 'SHORT'; labelColor = 'text-emerald-400'; }
            else if (distFromThreshold < 1800) { labelText = lang === 'de' ? 'NORMAL' : 'NORMAL'; labelColor = 'text-emerald-400'; }
            else { labelText = lang === 'de' ? 'LANG' : 'LONG'; labelColor = 'text-amber-400'; }
          } else if (alongM > 0) { labelText = lang === 'de' ? 'VOR SCHWELLE' : 'SHORT'; labelColor = 'text-red-400'; }
          else if (distFromThreshold > runwayLen) { labelText = lang === 'de' ? 'UEBER ENDE' : 'OVERSHOOT'; labelColor = 'text-red-400'; }
          else if (distFromThreshold < 600) { labelText = lang === 'de' ? 'TDZ' : 'TDZ'; labelColor = 'text-emerald-400'; }
          else { labelText = lang === 'de' ? 'SPAET' : 'LATE'; labelColor = 'text-amber-400'; }
          const onRwy = Math.abs(lateralM) < halfWidth;
          const latColor = Math.abs(lateralM) < 5 ? 'text-emerald-300' : Math.abs(lateralM) < halfWidth ? 'text-amber-400' : 'text-red-400';
          return (
            <div className="pointer-events-none absolute bottom-4 left-4 bg-slate-950/90 border border-cyan-500/40 rounded-md px-2.5 py-1 font-mono backdrop-blur-sm text-[10px] space-y-0.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[8px] uppercase tracking-[0.2em] text-cyan-500">
                  {phase === 'takeoff' ? (lang === 'de' ? 'LIFTOFF' : 'LIFTOFF') : (lang === 'de' ? 'TD' : 'TD')}
                </span>
                {runway?.landingIdent && (
                  <span className="text-[8px] text-slate-400 uppercase border-l border-slate-700 pl-2">RWY {runway.landingIdent}</span>
                )}
                <span className={`font-bold uppercase ${labelColor}`}>{labelText}</span>
                <span className="text-cyan-300 font-bold border-l border-slate-700 pl-2">
                  {Math.round(distFromThreshold)}m
                </span>
                <span className={`font-bold border-l border-slate-700 pl-2 ${latColor}`}>
                  {lateralM >= 0 ? 'R' : 'L'}{Math.abs(lateralM).toFixed(1)}m
                </span>
                <span className={`text-[9px] uppercase ${onRwy ? 'text-emerald-400' : 'text-red-400'}`}>
                  {onRwy ? '●' : '✕'}
                </span>
              </div>
              {phaseAcc && (
                <div className="flex items-center gap-2 text-[9px] pt-0.5 border-t border-slate-800/80">
                  <span className="text-[8px] uppercase tracking-[0.2em] text-cyan-500">CL</span>
                  <span className="text-slate-300">Ø{rmsM.toFixed(1)}m</span>
                  <span className={`font-bold border-l border-slate-700 pl-2 ${scoreColor}`}>
                    {scoreDelta > 0 ? '+' : ''}{scoreDelta} pts
                  </span>
                  <span className={`font-bold border-l border-slate-700 pl-2 ${cashColor}`}>
                    {cashDelta > 0 ? '+' : cashDelta < 0 ? '-' : ''}${Math.abs(cashDelta).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          );
        })()}

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