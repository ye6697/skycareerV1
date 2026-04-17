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

    // Runway - longer, proper proportions, asphalt color
    const RUNWAY_LEN = 900;
    const RUNWAY_WIDTH = 45;
    const runwayGeo = new THREE.PlaneGeometry(RUNWAY_WIDTH, RUNWAY_LEN);
    const runwayMat = new THREE.MeshStandardMaterial({ color: 0x1a1f2a, roughness: 0.95, metalness: 0 });
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0.02, 0);
    scene.add(runway);

    // Runway shoulders (lighter edges)
    [-1, 1].forEach((side) => {
      const shoulderGeo = new THREE.PlaneGeometry(3, RUNWAY_LEN);
      const shoulderMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
      const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
      shoulder.rotation.x = -Math.PI / 2;
      shoulder.position.set(side * (RUNWAY_WIDTH / 2 - 1), 0.04, 0);
      scene.add(shoulder);
    });

    // Runway centerline dashes (white, ICAO-style)
    for (let z = -RUNWAY_LEN / 2 + 40; z <= RUNWAY_LEN / 2 - 40; z += 60) {
      const stripeGeo = new THREE.PlaneGeometry(0.9, 30);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.05, z);
      scene.add(stripe);
    }

    // Threshold bars at landing end (piano keys)
    for (let i = -6; i <= 6; i++) {
      if (i === 0) continue;
      const barGeo = new THREE.PlaneGeometry(2.8, 10);
      const barMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(i * 3.2, 0.05, RUNWAY_LEN / 2 - 12);
      scene.add(bar);
    }

    // Touchdown zone markers (short parallel bars at landing zone)
    [80, 140, 200].forEach((offset) => {
      [-1, 1].forEach((side) => {
        const tdzGeo = new THREE.PlaneGeometry(3, 18);
        const tdzMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
        const tdz = new THREE.Mesh(tdzGeo, tdzMat);
        tdz.rotation.x = -Math.PI / 2;
        tdz.position.set(side * 8, 0.05, RUNWAY_LEN / 2 - offset);
        scene.add(tdz);
      });
    });

    // Approach lighting system (ALS) - line of lights leading to threshold
    const alsLightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    for (let i = 1; i <= 8; i++) {
      const lightGeo = new THREE.SphereGeometry(0.6, 6, 6);
      const light = new THREE.Mesh(lightGeo, alsLightMat);
      light.position.set(0, 0.6, RUNWAY_LEN / 2 + i * 12);
      scene.add(light);
    }

    // Edge lights along runway (white/amber)
    for (let z = -RUNWAY_LEN / 2; z <= RUNWAY_LEN / 2; z += 25) {
      [-1, 1].forEach((side) => {
        const edgeGeo = new THREE.SphereGeometry(0.35, 6, 6);
        const nearEnd = Math.abs(z - RUNWAY_LEN / 2) < 180;
        const edgeMat = new THREE.MeshBasicMaterial({ color: nearEnd ? 0xfef08a : 0xf8fafc });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(side * (RUNWAY_WIDTH / 2 + 1.5), 0.5, z);
        scene.add(edge);
      });
    }

    // PAPI lights (4-light visual approach indicator, left of threshold)
    [-3, -1, 1, 3].forEach((offset, idx) => {
      const papiGeo = new THREE.SphereGeometry(0.8, 8, 8);
      const papiMat = new THREE.MeshBasicMaterial({ color: idx < 2 ? 0xff4444 : 0xf8fafc });
      const papi = new THREE.Mesh(papiGeo, papiMat);
      papi.position.set(-RUNWAY_WIDTH / 2 - 6, 0.8, RUNWAY_LEN / 2 - 40 + offset * 2.5);
      scene.add(papi);
    });

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

    // Aircraft - simplified airliner model
    const planeMesh = new THREE.Group();

    const fuselageMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.25, metalness: 0.85,
      emissive: 0x8899aa, emissiveIntensity: 0.35,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xf5f7fa, roughness: 0.3, metalness: 0.8,
      emissive: 0x7788aa, emissiveIntensity: 0.3,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee, roughness: 0.3, metalness: 0.9,
      emissive: 0x0891b2, emissiveIntensity: 0.6,
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, roughness: 0.35, metalness: 0.75,
      emissive: 0x5a6a7a, emissiveIntensity: 0.25,
    });
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x0a1220, roughness: 0.1, metalness: 0.95,
      emissive: 0x1e3a5f, emissiveIntensity: 0.4,
    });

    // Fuselage (cylinder + nose cone)
    const fuselageGeo = new THREE.CylinderGeometry(1.1, 1.1, 10, 16);
    const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
    fuselage.rotation.z = Math.PI / 2;
    planeMesh.add(fuselage);

    const noseGeo = new THREE.ConeGeometry(1.1, 3, 16);
    const nose = new THREE.Mesh(noseGeo, fuselageMat);
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 6.5;
    planeMesh.add(nose);

    const tailConeGeo = new THREE.ConeGeometry(1.1, 2.5, 16);
    const tailCone = new THREE.Mesh(tailConeGeo, fuselageMat);
    tailCone.rotation.z = Math.PI / 2;
    tailCone.position.x = -6.2;
    planeMesh.add(tailCone);

    // Main wings (swept)
    const wingGeo = new THREE.BoxGeometry(3.5, 0.2, 14);
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.set(-0.5, -0.3, 0);
    planeMesh.add(wings);

    // Wing accent stripe
    const wingStripeGeo = new THREE.BoxGeometry(0.6, 0.22, 14);
    const wingStripe = new THREE.Mesh(wingStripeGeo, accentMat);
    wingStripe.position.set(0.8, -0.3, 0);
    planeMesh.add(wingStripe);

    // Horizontal stabilizer
    const hStabGeo = new THREE.BoxGeometry(1.8, 0.15, 5.5);
    const hStab = new THREE.Mesh(hStabGeo, wingMat);
    hStab.position.set(-5.2, 0.1, 0);
    planeMesh.add(hStab);

    // Vertical stabilizer (tail fin)
    const vStabGeo = new THREE.BoxGeometry(2.2, 2.5, 0.2);
    const vStab = new THREE.Mesh(vStabGeo, wingMat);
    vStab.position.set(-5.4, 1.3, 0);
    planeMesh.add(vStab);

    // Tail accent
    const tailAccentGeo = new THREE.BoxGeometry(2.2, 0.3, 0.22);
    const tailAccent = new THREE.Mesh(tailAccentGeo, accentMat);
    tailAccent.position.set(-5.4, 2.35, 0);
    planeMesh.add(tailAccent);

    // Belly accent (darker underside for silhouette)
    const bellyGeo = new THREE.CylinderGeometry(1.05, 1.05, 10, 16, 1, false, Math.PI * 0.15, Math.PI * 0.7);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.rotation.z = Math.PI / 2;
    belly.position.y = -0.02;
    planeMesh.add(belly);

    // Cockpit windows (dark band at nose)
    const cockpitGeo = new THREE.SphereGeometry(0.95, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.2);
    const cockpit = new THREE.Mesh(cockpitGeo, windowMat);
    cockpit.rotation.z = -Math.PI / 2;
    cockpit.position.set(5.2, 0.25, 0);
    planeMesh.add(cockpit);

    // Cabin window row (both sides, small dark rectangles)
    [-1, 1].forEach((side) => {
      const windowRowGeo = new THREE.BoxGeometry(7.5, 0.3, 0.04);
      const windowRow = new THREE.Mesh(windowRowGeo, windowMat);
      windowRow.position.set(-0.5, 0.35, side * 1.08);
      planeMesh.add(windowRow);
    });

    // Engines (under wings) - more detailed nacelles
    [-4.5, 4.5].forEach((zOffset) => {
      const engineGeo = new THREE.CylinderGeometry(0.75, 0.68, 2.6, 16);
      const engine = new THREE.Mesh(engineGeo, fuselageMat);
      engine.rotation.z = Math.PI / 2;
      engine.position.set(-0.3, -1.0, zOffset);
      planeMesh.add(engine);
      // Engine intake ring
      const intakeGeo = new THREE.TorusGeometry(0.78, 0.14, 8, 20);
      const intake = new THREE.Mesh(intakeGeo, accentMat);
      intake.rotation.y = Math.PI / 2;
      intake.position.set(0.95, -1.0, zOffset);
      planeMesh.add(intake);
      // Intake darkness (fan)
      const fanGeo = new THREE.CircleGeometry(0.62, 16);
      const fan = new THREE.Mesh(fanGeo, windowMat);
      fan.rotation.y = Math.PI / 2;
      fan.position.set(0.96, -1.0, zOffset);
      planeMesh.add(fan);
      // Pylon connecting engine to wing
      const pylonGeo = new THREE.BoxGeometry(1.6, 0.9, 0.25);
      const pylon = new THREE.Mesh(pylonGeo, wingMat);
      pylon.position.set(-0.3, -0.55, zOffset);
      planeMesh.add(pylon);
    });

    // Winglets (bent-up wingtips)
    [-7, 7].forEach((zOffset) => {
      const wingletGeo = new THREE.BoxGeometry(1.4, 1.1, 0.18);
      const winglet = new THREE.Mesh(wingletGeo, wingMat);
      winglet.position.set(-0.7, 0.25, zOffset);
      winglet.rotation.z = Math.sign(zOffset) * 0.1;
      planeMesh.add(winglet);
    });

    // Navigation lights (red left, green right, strobe white)
    const redNavGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const redNavMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const redNav = new THREE.Mesh(redNavGeo, redNavMat);
    redNav.position.set(-0.5, -0.3, -7);
    planeMesh.add(redNav);

    const greenNavGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const greenNavMat = new THREE.MeshBasicMaterial({ color: 0x22ff22 });
    const greenNav = new THREE.Mesh(greenNavGeo, greenNavMat);
    greenNav.position.set(-0.5, -0.3, 7);
    planeMesh.add(greenNav);

    const strobeGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const strobe = new THREE.Mesh(strobeGeo, strobeMat);
    strobe.position.set(-5.4, 2.5, 0);
    planeMesh.add(strobe);

    planeMesh.position.copy(path3D[0]);
    planeMesh.scale.setScalar(1.5); // bigger, more readable
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
  }, [segment]);

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

      // Shadow on ground below aircraft (scale with altitude)
      const altScale = Math.max(0.3, 1 - pos.y / 120);
      shadow.position.set(pos.x, 0.06, pos.z);
      shadow.scale.setScalar(altScale);
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

      // Camera positioning
      if (cameraMode === 'chase') {
        const back = new THREE.Vector3().subVectors(cur, next).normalize().multiplyScalar(55);
        camera.position.set(pos.x + back.x, pos.y + 18, pos.z + back.z);
        camera.lookAt(pos.x, pos.y + 2, pos.z + 20);
      } else if (cameraMode === 'side') {
        camera.position.set(140, Math.max(40, pos.y + 25), pos.z);
        camera.lookAt(pos);
      } else if (cameraMode === 'top') {
        camera.position.set(0, 220, pos.z + 60);
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