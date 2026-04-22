import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, ShoppingCart, ArrowUpCircle, Route as RouteIcon, MapPin, List, Store, X } from "lucide-react";
import ContractWorldMap from "@/components/contracts/ContractWorldMap";

const ROUTE_COLORS = {
  passenger: 0x38bdf8,
  cargo: 0xf59e0b,
  charter: 0xa78bfa,
  emergency: 0xef4444,
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

function normIcao(value) {
  return String(value || "").toUpperCase();
}

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
  oceanGradient.addColorStop(0, "#050c1c");
  oceanGradient.addColorStop(0.55, "#0a1831");
  oceanGradient.addColorStop(1, "#030915");
  ctx.fillStyle = oceanGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const aurora = ctx.createRadialGradient(canvas.width * 0.7, canvas.height * 0.18, 40, canvas.width * 0.7, canvas.height * 0.18, 560);
  aurora.addColorStop(0, "rgba(56,189,248,0.20)");
  aurora.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = aurora;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(148,163,184,0.12)";
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
    const landFill = ["#3a4f45", "#40564b", "#455e52", "#4b6659"][idx % 4];
    const landStroke = "rgba(203,213,225,0.20)";
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

  for (let i = 0; i < 6000; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = Math.random() * 1.6;
    const alpha = Math.random() * 0.85;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createMaterial(owned, baseColor) {
  return new THREE.MeshStandardMaterial({
    color: owned ? baseColor : 0x475569,
    emissive: owned ? 0x082f49 : 0x111827,
    emissiveIntensity: owned ? 0.32 : 0.08,
    metalness: 0.35,
    roughness: 0.52,
  });
}

function buildSmallHangar(owned) {
  const group = new THREE.Group();
  const shellMaterial = createMaterial(owned, 0x60a5fa);
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.34 });

  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.62, 0.84), shellMaterial);
  shell.position.y = 0.34;
  group.add(shell);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.46, 4), roofMaterial);
  roof.position.y = 0.9;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  return { group, visualHeight: 1.18, ringRadius: 0.75 };
}

function buildMediumHangar(owned) {
  const group = new THREE.Group();
  const shellMaterial = createMaterial(owned, 0x38bdf8);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.06), shellMaterial);
  body.position.y = 0.42;
  group.add(body);

  const arch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 1.06, 18, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.54, roughness: 0.28 })
  );
  arch.rotation.z = Math.PI / 2;
  arch.position.y = 0.9;
  group.add(arch);

  return { group, visualHeight: 1.35, ringRadius: 0.9 };
}

function buildLargeHangar(owned) {
  const group = new THREE.Group();
  const shellMaterial = createMaterial(owned, 0x22c55e);

  const left = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.72, 0.96), shellMaterial);
  left.position.set(-0.58, 0.38, 0);
  group.add(left);

  const right = left.clone();
  right.position.x = 0.58;
  group.add(right);

  const connector = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.5, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.4, roughness: 0.45 })
  );
  connector.position.y = 0.26;
  group.add(connector);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 0.16, 1.03),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.56, roughness: 0.28 })
  );
  roof.position.y = 0.84;
  group.add(roof);

  return { group, visualHeight: 1.42, ringRadius: 1.15 };
}

function buildMegaHangar(owned) {
  const group = new THREE.Group();
  const shellMaterial = createMaterial(owned, 0x0ea5e9);

  const terminal = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.86, 1.35), shellMaterial);
  terminal.position.y = 0.44;
  group.add(terminal);

  const sideWingL = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.56, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.36, roughness: 0.44 })
  );
  sideWingL.position.set(-1.45, 0.29, -0.08);
  group.add(sideWingL);

  const sideWingR = sideWingL.clone();
  sideWingR.position.x = 1.45;
  group.add(sideWingR);

  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 1.15, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.2 })
  );
  tower.position.set(0, 1.1, 0.3);
  group.add(tower);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(2.55, 0.2, 1.42),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.62, roughness: 0.24 })
  );
  roof.position.y = 0.94;
  group.add(roof);

  return { group, visualHeight: 1.8, ringRadius: 1.36 };
}

function buildHangarMesh(sizeKey, owned) {
  if (sizeKey === "mega") return buildMegaHangar(owned);
  if (sizeKey === "large") return buildLargeHangar(owned);
  if (sizeKey === "medium") return buildMediumHangar(owned);
  return buildSmallHangar(owned);
}

function getRouteColor(type) {
  return ROUTE_COLORS[type] || 0x93c5fd;
}

function createRouteCurve(start, end, globeRadius) {
  const angle = start.angleTo(end);
  const lift = THREE.MathUtils.clamp(globeRadius * (0.2 + angle * 0.35), globeRadius * 0.2, globeRadius * 0.82);
  const mid = start.clone().add(end).normalize().multiplyScalar(globeRadius + lift);
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

function buildRouteMeshes(contract, curve, isSelected) {
  const color = getRouteColor(contract.type);
  const baseOpacity = isSelected ? 0.76 : 0.42;
  const coreOpacity = isSelected ? 0.95 : 0.7;
  const baseRadius = isSelected ? 0.15 : 0.1;
  const coreRadius = isSelected ? 0.08 : 0.05;

  const outer = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 90, baseRadius, 10, false),
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: baseOpacity,
      emissive: color,
      emissiveIntensity: isSelected ? 0.6 : 0.24,
      metalness: 0.15,
      roughness: 0.4,
    })
  );

  const inner = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 90, coreRadius, 10, false),
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: coreOpacity,
      emissive: color,
      emissiveIntensity: isSelected ? 0.8 : 0.38,
      metalness: 0.08,
      roughness: 0.28,
    })
  );

  const hitbox = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, Math.max(baseRadius * 2.0, 0.22), 8, false),
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

  const selectedAirport = normIcao(airportIcao);
  if (!selectedAirport) {
    return {
      canSubmit: false,
      cost: 0,
      label: lang === "de" ? "Airport waehlen" : "Select airport",
      helper: lang === "de" ? "Bitte zuerst einen Airport waehlen." : "Please choose an airport first.",
    };
  }

  const existing = hangars.find((h) => normIcao(h.airport_icao) === selectedAirport);
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

  if (currentIndex < 0 || nextIndex <= currentIndex) {
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
  selectedAirportIcao = "",
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
  const manualControlRef = useRef(false);
  const clickStartRef = useRef(null);
  const leafletModeRef = useRef(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [leafletMode, setLeafletMode] = useState(false);
  const [globeResetKey, setGlobeResetKey] = useState(0);
  const [showContractsPanel, setShowContractsPanel] = useState(true);
  const [showMarketPanel, setShowMarketPanel] = useState(true);

  const normalizedHangars = useMemo(
    () =>
      hangars.map((hangar) => ({
        ...hangar,
        airport_icao: normIcao(hangar.airport_icao),
      })),
    [hangars]
  );

  const normalizedContracts = useMemo(
    () =>
      contracts.map((contract) => ({
        ...contract,
        departure_airport: normIcao(contract.departure_airport),
        arrival_airport: normIcao(contract.arrival_airport),
      })),
    [contracts]
  );

  const normalizedContractsByAirport = useMemo(() => {
    const map = {};
    Object.entries(contractsByHangar || {}).forEach(([key, value]) => {
      map[normIcao(key)] = Array.isArray(value) ? value : [];
    });
    return map;
  }, [contractsByHangar]);

  const marketByIcao = useMemo(() => {
    const map = new Map();
    marketAirports.forEach((airport) => {
      const icao = normIcao(airport.airport_icao);
      if (!icao) return;
      map.set(icao, {
        ...airport,
        airport_icao: icao,
        label: airport.label || icao,
      });
    });
    return map;
  }, [marketAirports]);

  const selectedAirportData = useMemo(
    () => marketByIcao.get(normIcao(selectedAirportIcao)) || null,
    [marketByIcao, selectedAirportIcao]
  );

  const actionContext = useMemo(
    () =>
      getActionContext(
        normalizedHangars,
        hangarSizes,
        selectedAirportIcao,
        selectedMarketSize,
        lang
      ),
    [normalizedHangars, hangarSizes, selectedAirportIcao, selectedMarketSize, lang]
  );

  const selectedAirportContracts = useMemo(() => {
    const selectedIcao = normIcao(selectedAirportIcao);
    if (!selectedIcao) return [];
    const airportContracts = normalizedContractsByAirport[selectedIcao];
    if (Array.isArray(airportContracts) && airportContracts.length > 0) return airportContracts;
    return normalizedContracts.filter((contract) => normIcao(contract.departure_airport) === selectedIcao);
  }, [normalizedContracts, normalizedContractsByAirport, selectedAirportIcao]);

  const visibleContracts = useMemo(() => normalizedContracts.slice(0, 80), [normalizedContracts]);

  useEffect(() => {
    leafletModeRef.current = leafletMode;
  }, [leafletMode]);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const width = mount.clientWidth || 980;
    const height = mount.clientHeight || 600;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2800);
    camera.position.set(0, 42, 110);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.95;
    controls.panSpeed = 0.42;
    controls.minDistance = 38;
    controls.maxDistance = 190;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI - 0.18;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.autoRotate = !selectedContractId;
    controls.autoRotateSpeed = 0.4;

    const onControlStart = () => {
      manualControlRef.current = true;
      focusRef.current = null;
      controls.autoRotate = false;
    };
    const onControlEnd = () => {
      manualControlRef.current = false;
    };
    controls.addEventListener("start", onControlStart);
    controls.addEventListener("end", onControlEnd);

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
        roughness: 0.84,
        emissive: 0x020617,
        emissiveIntensity: 0.33,
      })
    );
    scene.add(earth);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius + 0.46, 96, 96),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.055 })
    );
    scene.add(clouds);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius + 1.22, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.13,
        side: THREE.BackSide,
      })
    );
    scene.add(atmosphere);

    scene.add(new THREE.AmbientLight(0x94a3b8, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(120, 60, 80);
    scene.add(sun);

    const rim = new THREE.PointLight(0x0ea5e9, 0.58, 420);
    rim.position.set(-120, -40, -120);
    scene.add(rim);

    const ownedByAirport = new Map(normalizedHangars.map((hangar) => [normIcao(hangar.airport_icao), hangar]));
    const clickableObjects = [];
    const airportFocusMap = new Map();

    const marketMarkerMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x451a03,
      emissiveIntensity: 0.2,
      metalness: 0.2,
      roughness: 0.6,
    });

    marketAirports.forEach((airport) => {
      if (!Number.isFinite(airport.lat) || !Number.isFinite(airport.lon)) return;
      const airportIcao = normIcao(airport.airport_icao);
      const owned = ownedByAirport.get(airportIcao);
      const selectedAirport = normIcao(selectedAirportIcao) === airportIcao;
      const renderHangarModel = Boolean(owned || selectedAirport);
      const markerPos = latLonToVector3(airport.lat, airport.lon, globeRadius + 1.3);
      const normal = markerPos.clone().normalize();

      if (renderHangarModel) {
        const sizeKey = owned?.size || selectedMarketSize || "small";
        const { group, visualHeight, ringRadius } = buildHangarMesh(sizeKey, Boolean(owned));
        const elevated = latLonToVector3(airport.lat, airport.lon, globeRadius + 1.25 + visualHeight * 0.22);
        const n = elevated.clone().normalize();

        group.position.copy(elevated);
        group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);

        group.traverse((child) => {
          if (child.isMesh) {
            child.userData = { markerType: "airport", airportIcao };
            clickableObjects.push(child);
          }
        });

        scene.add(group);

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(ringRadius * 0.72, ringRadius, 24),
          new THREE.MeshBasicMaterial({
            color: owned ? 0x22d3ee : 0xf59e0b,
            transparent: true,
            opacity: selectedAirport ? 0.82 : owned ? 0.6 : 0.35,
            side: THREE.DoubleSide,
          })
        );
        ring.position.copy(elevated.clone().add(n.clone().multiplyScalar(0.02)));
        ring.lookAt(elevated.clone().add(n));
        scene.add(ring);
      } else {
        const pin = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.56, 8),
          marketMarkerMaterial
        );
        pin.position.copy(markerPos.clone().add(normal.clone().multiplyScalar(0.45)));
        pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        pin.userData = { markerType: "airport", airportIcao };
        scene.add(pin);
        clickableObjects.push(pin);
      }

      airportFocusMap.set(airportIcao, markerPos.clone());
    });

    const routePulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.0,
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
      routeFocusMap.set(contract.id, {
        position: mid.clone().normalize().multiplyScalar(globeRadius + 52),
        target: mid.clone().normalize().multiplyScalar(globeRadius * 0.96),
      });

      if (isSelected) {
        selectedCurve = curve;
        const focus = routeFocusMap.get(contract.id);
        if (focus) focusRef.current = { position: focus.position.clone(), target: focus.target.clone() };
      }
    });

    if (!focusRef.current) {
      const selectedAirport = normIcao(selectedAirportIcao);
      if (selectedAirport && airportFocusMap.has(selectedAirport)) {
        const base = airportFocusMap.get(selectedAirport);
        focusRef.current = {
          position: base.clone().normalize().multiplyScalar(globeRadius + 40),
          target: base.clone().normalize().multiplyScalar(globeRadius * 0.95),
        };
      }
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (event) => {
      clickStartRef.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = (event) => {
      const start = clickStartRef.current;
      if (!start) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      clickStartRef.current = null;
      if (moved > 5) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hit = raycaster.intersectObjects(clickableObjects, false)[0];
      if (!hit?.object?.userData) {
        setShowContractsPanel(false);
        setShowMarketPanel(false);
        onSelectContract?.(null);
        onSelectAirport?.("");
        focusRef.current = null;
        return;
      }

      const data = hit.object.userData;
      if (data.markerType === "route") {
        onSelectContract?.(data.contractId);
        setShowContractsPanel(true);
        const focus = routeFocusMap.get(data.contractId);
        if (focus) {
          manualControlRef.current = false;
          focusRef.current = { position: focus.position.clone(), target: focus.target.clone() };
        }
        return;
      }

      if (data.markerType === "airport") {
        onSelectAirport?.(data.airportIcao);
        setShowMarketPanel(true);
        const base = airportFocusMap.get(data.airportIcao);
        if (base) {
          manualControlRef.current = false;
          focusRef.current = {
            position: base.clone().normalize().multiplyScalar(globeRadius + 40),
            target: base.clone().normalize().multiplyScalar(globeRadius * 0.95),
          };
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

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
      clouds.rotation.y += 0.00035;
      earth.rotation.y += 0.00016;
      stars.rotation.y += 0.00004;

      if (selectedCurve) {
        const t = (elapsed * 0.09) % 1;
        routePulse.visible = true;
        routePulse.position.copy(selectedCurve.getPoint(t));
      } else {
        routePulse.visible = false;
      }

      if (focusRef.current && !manualControlRef.current) {
        controls.autoRotate = false;
        camera.position.lerp(focusRef.current.position, 0.06);
        controls.target.lerp(focusRef.current.target, 0.08);
        if (camera.position.distanceTo(focusRef.current.position) < 0.35) {
          focusRef.current = null;
        }
      }

      const distance = camera.position.distanceTo(controls.target);
      const shouldLeaflet = distance <= 58;
      if (shouldLeaflet !== leafletModeRef.current) {
        leafletModeRef.current = shouldLeaflet;
        setLeafletMode(shouldLeaflet);
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
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.removeEventListener("start", onControlStart);
      controls.removeEventListener("end", onControlEnd);
      controls.dispose();

      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();

      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((material) => material.dispose?.());
          else obj.material.dispose?.();
        }
      });
    };
  }, [
    normalizedHangars,
    visibleContracts,
    marketAirports,
    selectedContractId,
    selectedAirportIcao,
    selectedMarketSize,
    onSelectContract,
    onSelectAirport,
    isFullscreen,
    globeResetKey,
  ]);

  const ownedAirportCount = useMemo(() => {
    const ownedSet = new Set(normalizedHangars.map((hangar) => normIcao(hangar.airport_icao)));
    return marketAirports.reduce((count, airport) => {
      if (ownedSet.has(normIcao(airport.airport_icao))) return count + 1;
      return count;
    }, 0);
  }, [marketAirports, normalizedHangars]);

  return (
    <div className={`relative overflow-hidden border border-cyan-900/40 bg-slate-950/95 ${isFullscreen ? "fixed inset-0 z-[220] rounded-none" : "rounded-xl"}`}>
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
        <Badge className="border-cyan-700/50 bg-slate-950/85 text-[10px] font-mono uppercase text-cyan-100">
          <RouteIcon className="mr-1 h-3 w-3" />
          {visibleContracts.length} {lang === "de" ? "Routen" : "Routes"}
        </Badge>
        <Badge className="border-emerald-700/50 bg-slate-950/85 text-[10px] font-mono uppercase text-emerald-200">
          {ownedAirportCount}/{marketAirports.length} {lang === "de" ? "Owned" : "Owned"}
        </Badge>
      </div>

      <div className="absolute right-3 top-3 z-20 flex gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setShowContractsPanel((value) => !value)}
          className="h-8 w-8 border-cyan-700/50 bg-slate-950/85 text-cyan-200 hover:bg-cyan-950/40"
        >
          {showContractsPanel ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setShowMarketPanel((value) => !value)}
          className="h-8 w-8 border-cyan-700/50 bg-slate-950/85 text-cyan-200 hover:bg-cyan-950/40"
        >
          {showMarketPanel ? <X className="h-4 w-4" /> : <Store className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setIsFullscreen((value) => !value)}
          className="h-8 w-8 border-cyan-700/50 bg-slate-950/85 text-cyan-200 hover:bg-cyan-950/40"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      <div
        ref={mountRef}
        className={`w-full ${isFullscreen ? "h-screen" : "h-[620px]"}`}
        style={{ opacity: leafletMode ? 0 : 1, pointerEvents: leafletMode ? "none" : "auto" }}
      />

      {leafletMode && (
        <div className="absolute inset-0 z-30">
          <ContractWorldMap
            embedded
            contracts={visibleContracts}
            hangars={normalizedHangars}
            marketAirports={marketAirports}
            selectedAirportIcao={selectedAirportIcao}
            onSelectAirport={(icao) => {
              onSelectAirport?.(icao);
              setShowMarketPanel(true);
            }}
            selectedContractId={selectedContractId}
            onSelectContract={(id) => {
              onSelectContract?.(id);
              setShowContractsPanel(true);
            }}
            onBackgroundClick={() => {
              setShowContractsPanel(false);
              setShowMarketPanel(false);
              onSelectContract?.(null);
              onSelectAirport?.("");
            }}
            lang={lang}
          />
          <div className="absolute left-1/2 top-3 z-40 -translate-x-1/2">
            <div className="flex items-center gap-2">
              <Badge className="border-cyan-700/50 bg-slate-950/90 text-[10px] font-mono uppercase text-cyan-100">
                {lang === "de" ? "Leaflet Modus aktiv" : "Leaflet mode active"}
              </Badge>
              <Button
                type="button"
                size="sm"
                className="h-7 bg-cyan-600 px-2 text-[10px] font-mono uppercase text-slate-950 hover:bg-cyan-500"
                onClick={() => {
                  setLeafletMode(false);
                  setGlobeResetKey((value) => value + 1);
                }}
              >
                {lang === "de" ? "Zurueck zum Globus" : "Back to globe"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showContractsPanel && !leafletMode && (
        <div className={`absolute right-3 top-14 z-20 w-[280px] rounded-xl border border-cyan-900/50 bg-slate-950/86 p-2.5 backdrop-blur ${isFullscreen ? "max-h-[54vh]" : "max-h-[44vh]"}`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">
              {lang === "de" ? "Auftragsliste" : "Contract list"}
            </div>
            <div className="text-[10px] text-slate-400">{visibleContracts.length}</div>
          </div>
          <div className="space-y-1 overflow-y-auto pr-1" style={{ maxHeight: isFullscreen ? "46vh" : "36vh" }}>
            {visibleContracts.map((contract) => {
              const selected = contract.id === selectedContractId;
              return (
                <button
                  key={contract.id}
                  type="button"
                  onClick={() => onSelectContract?.(contract.id)}
                  className={`w-full rounded-md border px-2 py-1.5 text-left transition ${
                    selected
                      ? "border-cyan-500/70 bg-cyan-900/30"
                      : "border-slate-700/80 bg-slate-900/70 hover:border-cyan-800/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-semibold text-cyan-100">{contract.title || "Contract"}</p>
                    <span className="text-[10px] text-emerald-300">${Math.round(contract.payout || 0).toLocaleString()}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] font-mono text-slate-300">
                    {contract.departure_airport} -&gt; {contract.arrival_airport}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showMarketPanel && selectedAirportData && !leafletMode && (
        <div className={`absolute left-3 bottom-3 z-20 w-[320px] rounded-xl border border-cyan-900/50 bg-slate-950/90 p-3 backdrop-blur ${isFullscreen ? "max-h-[48vh]" : ""}`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">
              {lang === "de" ? "Hangar Marketplace" : "Hangar marketplace"}
            </div>
            <div className="text-[10px] text-slate-400">{selectedAirportData.airport_icao}</div>
          </div>

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
            onClick={() => onBuyOrUpgrade?.({ airportIcao: normIcao(selectedAirportIcao), size: selectedMarketSize })}
            className="h-8 w-full bg-emerald-600 text-xs font-mono uppercase text-slate-950 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-300"
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
        </div>
      )}

      {!leafletMode && (
        <div className="absolute left-3 top-14 z-20 rounded-md border border-cyan-900/50 bg-slate-950/80 px-2 py-1 text-[10px] text-cyan-200">
          {lang === "de"
            ? "Linksklick ziehen = drehen | Rechtsklick ziehen = pan | Scroll = zoom | weit reinzoomen = Leaflet"
            : "Left drag = rotate | right drag = pan | scroll = zoom | deep zoom = Leaflet"}
        </div>
      )}
    </div>
  );
}
