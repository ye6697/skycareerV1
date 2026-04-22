import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, ShoppingCart, ArrowUpCircle, Route as RouteIcon, MapPin } from "lucide-react";

const ROUTE_COLORS = {
  passenger: 0x22d3ee,
  cargo: 0xfb923c,
  charter: 0xc084fc,
  emergency: 0xf43f5e,
};

const HANGAR_VISUAL_SCALE = {
  small: { width: 0.8, height: 0.95, depth: 0.8, color: 0x22d3ee },
  medium: { width: 1.05, height: 1.18, depth: 1.0, color: 0x38bdf8 },
  large: { width: 1.35, height: 1.4, depth: 1.2, color: 0x22c55e },
  mega: { width: 1.7, height: 1.8, depth: 1.45, color: 0xeab308 },
};

const CONTINENTS = [
  [[-168, 72], [-140, 70], [-110, 70], [-82, 55], [-96, 35], [-117, 30], [-96, 14], [-83, 9], [-74, 18], [-54, 48], [-60, 63], [-95, 74]],
  [[-81, 12], [-66, 10], [-51, 2], [-38, -14], [-54, -33], [-70, -52], [-81, -41], [-74, -18]],
  [[-11, 35], [2, 44], [20, 56], [48, 66], [90, 60], [130, 52], [146, 45], [122, 20], [92, 10], [60, 20], [35, 32], [12, 35]],
  [[-17, 37], [10, 35], [34, 28], [52, 12], [44, -8], [28, -35], [10, -34], [-12, 5]],
  [[112, -11], [154, -11], [153, -38], [134, -43], [114, -27]],
  [[50, 30], [77, 27], [90, 22], [84, 9], [72, 7], [60, 18]],
  [[-52, 80], [-35, 82], [-23, 74], [-45, 60], [-60, 70]],
  [[-180, -62], [180, -62], [180, -84], [-180, -84]],
];

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function lonLatToUv(lon, lat, width, height) {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return [x, y];
}

function createEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 3072;
  canvas.height = 1536;
  const ctx = canvas.getContext("2d");

  const oceanGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  oceanGradient.addColorStop(0, "#061023");
  oceanGradient.addColorStop(0.55, "#0b1a37");
  oceanGradient.addColorStop(1, "#040c1b");
  ctx.fillStyle = oceanGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const aurora = ctx.createRadialGradient(canvas.width * 0.72, canvas.height * 0.2, 40, canvas.width * 0.72, canvas.height * 0.2, 580);
  aurora.addColorStop(0, "rgba(34,211,238,0.2)");
  aurora.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = aurora;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(124,158,212,0.15)";
  ctx.lineWidth = 1;
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * canvas.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  for (let lon = -180; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * canvas.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  CONTINENTS.forEach((poly, idx) => {
    const landFill = ["#29573f", "#2f6246", "#3b7a57", "#457f62"][idx % 4];
    const landStroke = "rgba(174,255,208,0.25)";
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const [x, y] = lonLatToUv(lon, lat, canvas.width, canvas.height);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = landFill;
    ctx.fill();
    ctx.strokeStyle = landStroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#01030d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 7000; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = Math.random() * 1.8;
    const alpha = Math.random() * 0.95;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildHangarMesh(sizeKey, isOwned) {
  const visual = HANGAR_VISUAL_SCALE[sizeKey] || HANGAR_VISUAL_SCALE.small;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: isOwned ? visual.color : 0xf97316,
    emissive: isOwned ? 0x082f35 : 0x5a1f0a,
    emissiveIntensity: isOwned ? 0.45 : 0.28,
    metalness: 0.2,
    roughness: 0.6,
  });

  const roofMaterial = new THREE.MeshStandardMaterial({
    color: isOwned ? 0x94a3b8 : 0xfbbf24,
    metalness: 0.35,
    roughness: 0.4,
  });

  const doorMaterial = new THREE.MeshStandardMaterial({
    color: isOwned ? 0x0f172a : 0x111827,
    emissive: isOwned ? 0x22d3ee : 0x000000,
    emissiveIntensity: isOwned ? 0.2 : 0,
    metalness: 0.45,
    roughness: 0.35,
  });

  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(visual.width, visual.height, visual.depth),
    bodyMaterial
  );
  body.position.y = visual.height * 0.5;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(visual.width * 0.68, visual.height * 0.55, 4),
    roofMaterial
  );
  roof.rotation.y = Math.PI * 0.25;
  roof.position.y = visual.height + visual.height * 0.24;
  group.add(roof);

  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(visual.width * 0.48, visual.height * 0.55),
    doorMaterial
  );
  door.position.set(0, visual.height * 0.45, visual.depth * 0.5 + 0.01);
  group.add(door);

  return { group, visualHeight: visual.height + visual.height * 0.45 };
}

function getRouteColor(type) {
  return ROUTE_COLORS[type] || 0x60a5fa;
}

function createRouteCurve(start, end, globeRadius) {
  const angle = start.angleTo(end);
  const lift = THREE.MathUtils.clamp(globeRadius * (0.2 + angle * 0.35), globeRadius * 0.2, globeRadius * 0.82);
  const mid = start.clone().add(end).normalize().multiplyScalar(globeRadius + lift);
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

function buildRouteMeshes(contract, curve, isSelected) {
  const color = getRouteColor(contract.type);
  const baseOpacity = isSelected ? 0.7 : 0.42;
  const coreOpacity = isSelected ? 0.96 : 0.72;
  const baseRadius = isSelected ? 0.16 : 0.11;
  const coreRadius = isSelected ? 0.08 : 0.055;

  const outer = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 90, baseRadius, 10, false),
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: baseOpacity,
      emissive: color,
      emissiveIntensity: isSelected ? 0.68 : 0.32,
      metalness: 0.15,
      roughness: 0.35,
    })
  );

  const inner = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 90, coreRadius, 10, false),
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: coreOpacity,
      emissive: color,
      emissiveIntensity: isSelected ? 0.9 : 0.5,
      metalness: 0.08,
      roughness: 0.25,
    })
  );

  const hitbox = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, Math.max(baseRadius * 1.9, 0.22), 8, false),
    new THREE.MeshBasicMaterial({ visible: false })
  );

  return { outer, inner, hitbox };
}

function getActionContext(hangars, hangarSizes, airportIcao, sizeKey, lang) {
  const sizeSpec = hangarSizes.find((s) => s.key === sizeKey);
  if (!sizeSpec) {
    return {
      canSubmit: false,
      cost: 0,
      label: lang === "de" ? "Groesse auswaehlen" : "Select size",
      helper: lang === "de" ? "Bitte eine gueltige Hangargroesse waehlen." : "Please choose a valid hangar size.",
    };
  }

  const existing = hangars.find((h) => h.airport_icao === airportIcao);
  if (!existing) {
    return {
      canSubmit: true,
      cost: sizeSpec.price,
      label: lang === "de" ? "Hangar kaufen" : "Buy hangar",
      helper: lang === "de" ? "Neuen Standort erwerben." : "Acquire a new base.",
    };
  }

  const currentIndex = hangarSizes.findIndex((s) => s.key === existing.size);
  const nextIndex = hangarSizes.findIndex((s) => s.key === sizeKey);

  if (nextIndex <= currentIndex) {
    return {
      canSubmit: false,
      cost: 0,
      label: lang === "de" ? "Upgrade waehlen" : "Choose upgrade",
      helper: lang === "de" ? "Nur Upgrades auf groessere Hangars moeglich." : "Only upgrades to larger sizes are possible.",
    };
  }

  const currentSize = hangarSizes[currentIndex];
  const baseCurrentPrice = currentSize?.price || existing.purchase_price || 0;
  const diff = Math.max(0, sizeSpec.price - baseCurrentPrice);

  return {
    canSubmit: true,
    cost: diff,
    label: lang === "de" ? `Upgrade auf ${sizeSpec.key.toUpperCase()}` : `Upgrade to ${sizeSpec.key.toUpperCase()}`,
    helper: lang === "de" ? `Aktuell: ${existing.size.toUpperCase()}` : `Current: ${existing.size.toUpperCase()}`,
  };
}

export default function HangarWorldGlobe3D({
  hangars = [],
  contracts = [],
  contractsByHangar = {},
  marketAirports = [],
  selectedContractId = null,
  onSelectContract,
  selectedAirportIcao = null,
  onSelectAirport,
  selectedMarketSize = "small",
  onSelectMarketSize,
  hangarSizes = [],
  onBuyOrUpgrade,
  isBuyingOrUpgrading = false,
  lang = "de",
}) {
  const mountRef = useRef(null);
  const focusRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const marketByIcao = useMemo(() => {
    const map = new Map();
    marketAirports.forEach((airport) => map.set(airport.airport_icao, airport));
    return map;
  }, [marketAirports]);

  const selectedAirportData = useMemo(() => {
    if (!selectedAirportIcao) return null;
    return marketByIcao.get(selectedAirportIcao) || null;
  }, [marketByIcao, selectedAirportIcao]);

  const actionContext = useMemo(
    () =>
      getActionContext(
        hangars,
        hangarSizes,
        selectedAirportIcao,
        selectedMarketSize,
        lang
      ),
    [hangars, hangarSizes, selectedAirportIcao, selectedMarketSize, lang]
  );

  const selectedAirportContracts = useMemo(() => {
    if (!selectedAirportIcao) return [];
    const ownedHangar = hangars.find((h) => h.airport_icao === selectedAirportIcao);
    if (ownedHangar && contractsByHangar[ownedHangar.id]) {
      return contractsByHangar[ownedHangar.id];
    }
    return contracts.filter((contract) => contract.departure_airport === selectedAirportIcao);
  }, [contracts, contractsByHangar, hangars, selectedAirportIcao]);

  const visibleContracts = useMemo(() => contracts.slice(0, 80), [contracts]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const width = mount.clientWidth || 980;
    const height = mount.clientHeight || 600;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2800);
    camera.position.set(0, 44, 112);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 40;
    controls.maxDistance = 190;
    controls.autoRotate = !selectedContractId;
    controls.autoRotateSpeed = 0.45;

    const globeRadius = 29;

    const stars = new THREE.Mesh(
      new THREE.SphereGeometry(1000, 64, 64),
      new THREE.MeshBasicMaterial({ map: createStarTexture(), side: THREE.BackSide })
    );
    scene.add(stars);

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius, 128, 128),
      new THREE.MeshStandardMaterial({
        map: createEarthTexture(),
        metalness: 0.1,
        roughness: 0.82,
        emissive: 0x020617,
        emissiveIntensity: 0.35,
      })
    );
    scene.add(earth);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius + 0.46, 96, 96),
      new THREE.MeshStandardMaterial({
        color: 0xa5f3fc,
        transparent: true,
        opacity: 0.075,
      })
    );
    scene.add(clouds);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius + 1.22, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.14,
        side: THREE.BackSide,
      })
    );
    scene.add(atmosphere);

    scene.add(new THREE.AmbientLight(0xa5b4fc, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.42);
    sun.position.set(120, 65, 90);
    scene.add(sun);

    const rim = new THREE.PointLight(0x0ea5e9, 0.7, 420);
    rim.position.set(-120, -40, -120);
    scene.add(rim);

    const ownedByAirport = new Map(hangars.map((h) => [h.airport_icao, h]));

    const clickableObjects = [];
    const airportFocusMap = new Map();

    marketAirports.forEach((airport) => {
      if (!Number.isFinite(airport.lat) || !Number.isFinite(airport.lon)) return;
      const owned = ownedByAirport.get(airport.airport_icao);
      const sizeKey = owned?.size || selectedMarketSize;
      const { group, visualHeight } = buildHangarMesh(sizeKey, Boolean(owned));
      const markerPos = latLonToVector3(airport.lat, airport.lon, globeRadius + visualHeight * 0.55);
      const normal = markerPos.clone().normalize();
      group.position.copy(markerPos);
      group.lookAt(markerPos.clone().add(normal));
      group.rotateX(Math.PI / 2);

      group.traverse((child) => {
        if (child.isMesh) {
          child.userData = {
            markerType: "airport",
            airportIcao: airport.airport_icao,
            pointPos: markerPos,
            isOwned: Boolean(owned),
          };
          clickableObjects.push(child);
        }
      });

      scene.add(group);
      airportFocusMap.set(airport.airport_icao, markerPos.clone());
    });

    const routePulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.1,
        metalness: 0.15,
        roughness: 0.2,
      })
    );
    routePulse.visible = false;
    scene.add(routePulse);

    let selectedCurve = null;
    const routeFocusMap = new Map();

    visibleContracts.forEach((contract) => {
      if (!Number.isFinite(contract.dep_lat) || !Number.isFinite(contract.dep_lon)) return;
      if (!Number.isFinite(contract.arr_lat) || !Number.isFinite(contract.arr_lon)) return;

      const start = latLonToVector3(contract.dep_lat, contract.dep_lon, globeRadius + 1.35);
      const end = latLonToVector3(contract.arr_lat, contract.arr_lon, globeRadius + 1.35);
      const curve = createRouteCurve(start, end, globeRadius);

      const isSelected = contract.id === selectedContractId;
      const { outer, inner, hitbox } = buildRouteMeshes(contract, curve, isSelected);

      outer.userData = { markerType: "route", contractId: contract.id };
      inner.userData = { markerType: "route", contractId: contract.id };
      hitbox.userData = { markerType: "route", contractId: contract.id };

      scene.add(outer);
      scene.add(inner);
      scene.add(hitbox);
      clickableObjects.push(hitbox);

      const mid = curve.getPoint(0.5);
      const focusPos = mid.clone().normalize().multiplyScalar(globeRadius + 52);
      routeFocusMap.set(contract.id, {
        cameraPos: focusPos,
        target: mid.clone().normalize().multiplyScalar(globeRadius * 0.96),
      });

      if (isSelected) {
        selectedCurve = curve;
        const focus = routeFocusMap.get(contract.id);
        if (focus) {
          focusRef.current = {
            position: focus.cameraPos.clone(),
            target: focus.target.clone(),
          };
        }
      }
    });

    if (!focusRef.current && selectedAirportIcao && airportFocusMap.has(selectedAirportIcao)) {
      const base = airportFocusMap.get(selectedAirportIcao);
      focusRef.current = {
        position: base.clone().normalize().multiplyScalar(globeRadius + 40),
        target: base.clone().normalize().multiplyScalar(globeRadius * 0.95),
      };
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hit = raycaster.intersectObjects(clickableObjects, false)[0];
      if (!hit?.object?.userData) return;

      const data = hit.object.userData;
      if (data.markerType === "route") {
        onSelectContract?.(data.contractId);
        const focus = routeFocusMap.get(data.contractId);
        if (focus) {
          focusRef.current = {
            position: focus.cameraPos.clone(),
            target: focus.target.clone(),
          };
        }
        return;
      }

      if (data.markerType === "airport") {
        onSelectAirport?.(data.airportIcao);
        const base = airportFocusMap.get(data.airportIcao);
        if (base) {
          focusRef.current = {
            position: base.clone().normalize().multiplyScalar(globeRadius + 40),
            target: base.clone().normalize().multiplyScalar(globeRadius * 0.95),
          };
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    const onResize = () => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    let disposed = false;
    const clock = new THREE.Clock();
    const animate = () => {
      if (disposed) return;

      const elapsed = clock.getElapsedTime();
      clouds.rotation.y += 0.00045;
      earth.rotation.y += 0.0002;
      stars.rotation.y += 0.00005;

      if (selectedCurve) {
        const t = (elapsed * 0.09) % 1;
        const pulsePos = selectedCurve.getPoint(t);
        routePulse.visible = true;
        routePulse.position.copy(pulsePos);
      } else {
        routePulse.visible = false;
      }

      if (focusRef.current) {
        controls.autoRotate = false;
        camera.position.lerp(focusRef.current.position, 0.06);
        controls.target.lerp(focusRef.current.target, 0.08);
      }

      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      controls.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((material) => material.dispose?.());
          } else {
            obj.material.dispose?.();
          }
        }
      });
    };
  }, [
    hangars,
    visibleContracts,
    marketAirports,
    selectedContractId,
    selectedAirportIcao,
    selectedMarketSize,
    onSelectContract,
    onSelectAirport,
    isFullscreen,
  ]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-cyan-900/40 bg-slate-950/95 ${isFullscreen ? "fixed inset-2 z-[120]" : ""}`}>
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
        <Badge className="border-cyan-700/50 bg-slate-950/80 text-[10px] font-mono uppercase text-cyan-100">
          <RouteIcon className="mr-1 h-3 w-3" />
          {visibleContracts.length} {lang === "de" ? "Routen" : "Routes"}
        </Badge>
        <Badge className="border-cyan-700/50 bg-slate-950/80 text-[10px] font-mono uppercase text-cyan-100">
          {lang === "de" ? "Globe Deck" : "Globe Deck"}
        </Badge>
      </div>

      <div className="absolute right-3 top-3 z-20">
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setIsFullscreen((value) => !value)}
          className="h-8 w-8 border-cyan-700/50 bg-slate-950/80 text-cyan-200 hover:bg-cyan-950/40"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      <div ref={mountRef} className={`w-full ${isFullscreen ? "h-[calc(100vh-16px)]" : "h-[620px]"}`} />

      <div className={`absolute right-3 top-14 z-20 w-[320px] rounded-xl border border-cyan-900/50 bg-slate-950/86 p-2.5 backdrop-blur ${isFullscreen ? "max-h-[72vh]" : "max-h-[52vh]"}`}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">
            {lang === "de" ? "Auftragsliste" : "Contract list"}
          </div>
          <div className="text-[10px] text-slate-400">{visibleContracts.length}</div>
        </div>

        <div className="space-y-1 overflow-y-auto pr-1" style={{ maxHeight: isFullscreen ? "66vh" : "44vh" }}>
          {visibleContracts.map((contract) => {
            const selected = contract.id === selectedContractId;
            return (
              <button
                key={contract.id}
                type="button"
                onClick={() => onSelectContract?.(contract.id)}
                className={`w-full rounded-md border px-2 py-1.5 text-left transition ${
                  selected
                    ? "border-cyan-500/70 bg-cyan-900/35"
                    : "border-slate-700/80 bg-slate-900/70 hover:border-cyan-800/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-semibold text-cyan-100">{contract.title || "Contract"}</p>
                  <span className="text-[10px] text-emerald-300">${Math.round(contract.payout || 0).toLocaleString()}</span>
                </div>
                <p className="mt-0.5 text-[10px] font-mono text-slate-300">
                  {contract.departure_airport} -> {contract.arrival_airport}
                </p>
              </button>
            );
          })}
          {!visibleContracts.length && (
            <p className="rounded-md border border-slate-700/80 bg-slate-900/70 p-2 text-[11px] text-slate-400">
              {lang === "de" ? "Keine Contracts fuer aktuelle Filter." : "No contracts for current filters."}
            </p>
          )}
        </div>
      </div>

      <div className="absolute left-3 bottom-3 z-20 w-[360px] rounded-xl border border-cyan-900/50 bg-slate-950/90 p-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">
            {lang === "de" ? "Hangar Marketplace" : "Hangar marketplace"}
          </div>
          <div className="text-[10px] text-slate-400">
            {selectedAirportIcao || (lang === "de" ? "Kein Airport" : "No airport")}
          </div>
        </div>

        {selectedAirportData ? (
          <>
            <div className="mb-2 rounded-md border border-slate-700/80 bg-slate-900/70 p-2">
              <p className="text-[11px] font-semibold text-cyan-100">
                <MapPin className="mr-1 inline h-3.5 w-3.5" />
                {selectedAirportData.airport_icao} - {selectedAirportData.label}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                {lang === "de" ? "Verfuegbare Auftraege ab hier" : "Available departures here"}: {selectedAirportContracts.length}
              </p>
            </div>

            <div className="mb-2 grid grid-cols-2 gap-1.5">
              {hangarSizes.map((size) => (
                <button
                  key={size.key}
                  type="button"
                  onClick={() => onSelectMarketSize?.(size.key)}
                  className={`rounded-md border px-2 py-1 text-left text-[10px] font-mono uppercase transition ${
                    selectedMarketSize === size.key
                      ? "border-cyan-500/70 bg-cyan-900/35 text-cyan-100"
                      : "border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-cyan-800/70"
                  }`}
                >
                  <div>{size.key}</div>
                  <div className="text-[9px] text-slate-400">{size.slots} slots</div>
                </button>
              ))}
            </div>

            <div className="mb-2 rounded-md border border-slate-700/80 bg-slate-900/70 p-2 text-[10px]">
              <p className="text-slate-300">{actionContext.helper}</p>
              <p className="mt-1 font-mono text-emerald-300">${Math.round(actionContext.cost || 0).toLocaleString()}</p>
            </div>

            <Button
              type="button"
              disabled={!actionContext.canSubmit || isBuyingOrUpgrading}
              onClick={() => onBuyOrUpgrade?.({ airportIcao: selectedAirportIcao, size: selectedMarketSize })}
              className="h-8 w-full bg-cyan-600 text-xs font-mono uppercase text-slate-950 hover:bg-cyan-500"
            >
              {isBuyingOrUpgrading ? (
                <>
                  <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5 animate-pulse" />
                  {lang === "de" ? "Wird verarbeitet" : "Processing"}
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                  {actionContext.label}
                </>
              )}
            </Button>
          </>
        ) : (
          <p className="rounded-md border border-slate-700/80 bg-slate-900/70 p-2 text-[11px] text-slate-400">
            {lang === "de"
              ? "Klicke auf einen Airport-Marker am Globus, um Hangar kaufen oder upgraden zu koennen."
              : "Click an airport marker on the globe to buy or upgrade a hangar."}
          </p>
        )}
      </div>

      <div className="absolute left-3 top-14 z-20 rounded-md border border-cyan-900/50 bg-slate-950/80 px-2 py-1 text-[10px] text-cyan-200">
        {lang === "de"
          ? "Ziehen = drehen | Scroll = Zoom | Klick auf Route/Airport = Fokus"
          : "Drag = rotate | Scroll = zoom | Click route/airport = focus"}
      </div>
    </div>
  );
}
