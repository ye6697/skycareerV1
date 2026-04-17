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
  projectToRunwayFrame,
} from '@/components/flights/approachGeometry';

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

  const [runway, setRunway] = useState(null); // normalized runway or null
  const [touchdownInfo, setTouchdownInfo] = useState(null); // { alongM, lateralM, ... }

  // Keep refs in sync with state.
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);

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
    // Dusk/sunset sky gradient feel. Fog pushed far enough that fast jets
    // during takeoff (which can travel 2+ km in the replay window) never
    // "hit" the horizon wall.
    scene.background = new THREE.Color(0x0a1528);
    scene.fog = new THREE.Fog(0x0a1528, 800, 6000);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 12000);

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

    // Terrain grid (subtle, tactical look) – expanded to match the larger sky
    // so jets travelling several km still see terrain below them.
    const gridHelper = new THREE.GridHelper(8000, 80, 0x1e3a5f, 0x142033);
    gridHelper.position.y = 0;
    gridHelper.material.opacity = 0.35;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Ground plane (dark, solid for depth)
    const groundGeo = new THREE.PlaneGeometry(10000, 10000);
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
      const markerColor = 0x22d3ee;

      // Inner ring (bright, thick) and outer pulsing halo.
      const ringGeo = new THREE.RingGeometry(6, 9, 40);
      const ringMat = new THREE.MeshBasicMaterial({ color: markerColor, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(td.x, 0.09, td.z);
      scene.add(ring);

      const haloGeo = new THREE.RingGeometry(12, 18, 48);
      const haloMat = new THREE.MeshBasicMaterial({ color: markerColor, side: THREE.DoubleSide, transparent: true, opacity: 0.45 });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(td.x, 0.08, td.z);
      scene.add(halo);

      // Four ground crosshair bars (N/S/E/W) stretching out from the ring so
      // the touchdown spot reads clearly even when the aircraft body covers
      // the center.
      [
        { w: 60, d: 1.2, dx: 0, dz: 0 },   // along-runway bar
        { w: 1.2, d: 60, dx: 0, dz: 0 },   // cross-runway bar
      ].forEach(({ w, d, dx, dz }) => {
        const barGeo = new THREE.PlaneGeometry(w, d);
        const barMat = new THREE.MeshBasicMaterial({ color: markerColor, side: THREE.DoubleSide, transparent: true, opacity: 0.55 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(td.x + dx, 0.07, td.z + dz);
        scene.add(bar);
      });

      // Tall glowing beacon so the marker is visible above the aircraft too.
      const pillarGeo = new THREE.CylinderGeometry(0.35, 0.35, 250, 10);
      const pillarMat = new THREE.MeshBasicMaterial({ color: markerColor, transparent: true, opacity: 0.55 });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(td.x, 125, td.z);
      scene.add(pillar);

      // Bright cap at the top of the beacon to draw the eye.
      const capGeo = new THREE.SphereGeometry(1.8, 12, 12);
      const capMat = new THREE.MeshBasicMaterial({ color: markerColor, transparent: true, opacity: 0.9 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(td.x, 250, td.z);
      scene.add(cap);

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

    // Playback duration scales with segment length so a 70-second takeoff
    // doesn't get crammed into 12 seconds (which looked way too fast and jumpy).
    // ~55% of real time, clamped so very short/long segments still feel good.
    const playbackDurationMs = Math.max(
      10000,
      Math.min(22000, Math.round(segment.totalSec * 1000 * 0.55))
    );

    // Reset progress/playback state for this freshly built scene.
    progressRef.current = 0;
    playbackStartRef.current = null;
    setProgress(0);
    setIsPlaying(true);
    isPlayingRef.current = true;

    // --- Unified render + playback loop (runs ONCE per scene build). ---
    // Reads progress/isPlaying/cameraMode from refs → no React-state-triggered
    // effect re-runs, no stale closures, no flickering.
    let lastUiSyncMs = 0;
    const animate = (now) => {
      if (!sceneRef.current) return;
      const s = sceneRef.current;

      // Advance playback
      if (isPlayingRef.current) {
        if (playbackStartRef.current === null) {
          playbackStartRef.current = now - progressRef.current * playbackDurationMs;
        }
        const elapsed = now - playbackStartRef.current;
        let p = elapsed / playbackDurationMs;
        if (p >= 1) {
          p = 1;
          isPlayingRef.current = false;
          playbackStartRef.current = null;
          setIsPlaying(false);
        }
        progressRef.current = p;
      }

      // Sync React state ~20 Hz for slider/HUD – never every frame.
      if (now - lastUiSyncMs > 50) {
        lastUiSyncMs = now;
        setProgress(progressRef.current);
      }

      const p3 = s.path3D;
      const idxFloat = progressRef.current * (p3.length - 1);
      const idx = Math.floor(idxFloat);
      const frac = idxFloat - idx;
      const cur = p3[idx];
      const next = p3[Math.min(p3.length - 1, idx + 1)];
      const pos = new THREE.Vector3().lerpVectors(cur, next, frac);
      const MIN_GROUND_CLEARANCE = 3;
      if (pos.y < MIN_GROUND_CLEARANCE) pos.y = MIN_GROUND_CLEARANCE;
      s.planeMesh.position.copy(pos);

      const altScale = Math.max(0.3, 1 - pos.y / 200);
      s.shadow.position.set(pos.x, 0.06, pos.z);
      s.shadow.scale.setScalar(altScale * 2);
      s.shadow.material.opacity = 0.4 * altScale;

      const dir = new THREE.Vector3().subVectors(next, cur);
      if (dir.length() > 0.001) {
        dir.normalize();
        const yaw = Math.atan2(-dir.z, dir.x);
        const segPoints = s.segment?.points || [];
        const pathProgressIdx = Math.min(segPoints.length - 1, Math.floor(progressRef.current * (segPoints.length - 1)));
        const realPitchDeg = segPoints[pathProgressIdx]?.pitch;
        let pitch;
        if (Number.isFinite(realPitchDeg)) pitch = (realPitchDeg * Math.PI) / 180;
        else pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));

        const lookBack = Math.max(0, idx - 3);
        const lookFwd = Math.min(p3.length - 1, idx + 3);
        const dxFwd = p3[lookFwd].x - p3[lookBack].x;
        const dzFwd = p3[lookFwd].z - p3[lookBack].z;
        const turnRate = Math.atan2(dxFwd, Math.max(0.1, Math.abs(dzFwd))) * 0.8;
        const bank = Math.max(-0.4, Math.min(0.4, turnRate));

        s.planeMesh.rotation.set(0, 0, 0);
        s.planeMesh.rotateY(yaw);
        s.planeMesh.rotateZ(pitch);
        s.planeMesh.rotateX(bank);
      }

      if (s.strobe) {
        const flashPhase = (now % 1200) / 1200;
        s.strobe.material.opacity = flashPhase < 0.05 ? 1 : flashPhase < 0.12 ? 0.8 : 0;
      }

      // Update active path + contrail. Reuse arrays where possible.
      const activePoints = p3.slice(0, idx + 1);
      activePoints.push(pos);
      s.activePathGeo.setFromPoints(activePoints);
      if (s.trailGeo) {
        s.trailGeo.setFromPoints(activePoints.slice(-25));
      }

      // Camera
      const mode = cameraModeRef.current;
      if (mode === 'top') {
        camera.up.set(0, 0, -1);
        camera.position.set(0, 220, pos.z);
        camera.lookAt(0, 0, pos.z);
      } else {
        camera.up.set(0, 1, 0);
        if (mode === 'chase') {
          const back = new THREE.Vector3().subVectors(cur, next).normalize().multiplyScalar(80);
          camera.position.set(pos.x + back.x, pos.y + 30, pos.z + back.z);
          camera.lookAt(pos.x, pos.y + 5, pos.z - 40);
        } else {
          camera.position.set(-140, Math.max(40, pos.y + 35), pos.z);
          camera.lookAt(pos);
        }
      }

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    sceneRef.current.playbackDurationMs = playbackDurationMs;

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

  // --- legacy animation loop removed – now merged into the scene-build effect above ---

  const handlePlayPause = () => {
    const dur = sceneRef.current?.playbackDurationMs || 12000;
    if (progressRef.current >= 1) {
      progressRef.current = 0;
      setProgress(0);
      playbackStartRef.current = null;
      isPlayingRef.current = true;
      setIsPlaying(true);
    } else if (isPlayingRef.current) {
      // Pause
      playbackStartRef.current = null;
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      // Resume from current progress
      playbackStartRef.current = performance.now() - progressRef.current * dur;
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    progressRef.current = 0;
    playbackStartRef.current = null;
    setProgress(0);
    isPlayingRef.current = true;
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

        {/* Touchdown / Liftoff Analysis HUD – compact single-line pill */}
        {touchdownInfo && (() => {
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
            <div className="absolute bottom-4 left-4 bg-slate-950/90 border border-cyan-500/40 rounded-md px-2.5 py-1.5 font-mono backdrop-blur-sm flex items-center gap-2.5 text-[10px]">
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
                  const p = Number(e.target.value) / 1000;
                  isPlayingRef.current = false;
                  playbackStartRef.current = null;
                  progressRef.current = p;
                  setIsPlaying(false);
                  setProgress(p);
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