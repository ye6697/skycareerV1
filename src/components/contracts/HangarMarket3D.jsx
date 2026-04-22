import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building2, Loader2, MapPin } from "lucide-react";

const SIZE_STYLE = {
  small: { width: 2.7, height: 2.3, depth: 2.2, color: 0x64748b },
  medium: { width: 3.4, height: 2.9, depth: 2.8, color: 0x475569 },
  large: { width: 4.2, height: 3.5, depth: 3.5, color: 0x334155 },
  mega: { width: 5.2, height: 4.2, depth: 4.3, color: 0x1e293b },
};

function normIcao(value) {
  return String(value || "").toUpperCase();
}

function buildHangarModel(sizeKey, owned) {
  const spec = SIZE_STYLE[sizeKey] || SIZE_STYLE.small;
  const group = new THREE.Group();

  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 2.5, 0.14, spec.depth * 2.4),
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.12,
      roughness: 0.88,
    })
  );
  apron.position.y = 0.07;
  group.add(apron);

  const hangarBodyMaterial = new THREE.MeshStandardMaterial({
    color: owned ? spec.color : 0x52525b,
    emissive: owned ? 0x082f49 : 0x0f172a,
    emissiveIntensity: owned ? 0.24 : 0.08,
    metalness: 0.34,
    roughness: 0.56,
  });
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.58,
    roughness: 0.26,
  });

  if (sizeKey === "small") {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height * 0.62, spec.depth), hangarBodyMaterial);
    shell.position.y = spec.height * 0.33;
    group.add(shell);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(spec.width * 0.5, spec.height * 0.42, 4), roofMaterial);
    roof.position.y = spec.height * 0.82;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
  } else if (sizeKey === "medium") {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height * 0.64, spec.depth), hangarBodyMaterial);
    shell.position.y = spec.height * 0.33;
    group.add(shell);

    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.depth * 0.52, spec.depth * 0.52, spec.width * 0.94, 22, 1, false, 0, Math.PI),
      roofMaterial
    );
    roof.rotation.z = Math.PI / 2;
    roof.position.y = spec.height * 0.72;
    group.add(roof);
  } else if (sizeKey === "large") {
    const left = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.45, spec.height * 0.62, spec.depth * 0.84), hangarBodyMaterial);
    left.position.set(-spec.width * 0.3, spec.height * 0.33, 0);
    group.add(left);

    const right = left.clone();
    right.position.x = spec.width * 0.3;
    group.add(right);

    const connector = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.2, spec.height * 0.4, spec.depth * 0.78),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.42, roughness: 0.4 })
    );
    connector.position.y = spec.height * 0.21;
    group.add(connector);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.96, spec.height * 0.12, spec.depth * 0.9),
      roofMaterial
    );
    roof.position.y = spec.height * 0.75;
    group.add(roof);
  } else {
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.88, spec.height * 0.66, spec.depth * 0.82), hangarBodyMaterial);
    terminal.position.y = spec.height * 0.35;
    group.add(terminal);

    const sideL = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.28, spec.height * 0.46, spec.depth * 0.56),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.35, roughness: 0.48 })
    );
    sideL.position.set(-spec.width * 0.6, spec.height * 0.24, -spec.depth * 0.06);
    group.add(sideL);

    const sideR = sideL.clone();
    sideR.position.x = spec.width * 0.6;
    group.add(sideR);

    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.12, spec.height * 0.42, spec.depth * 0.12),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.62, roughness: 0.2 })
    );
    tower.position.set(0, spec.height * 0.88, spec.depth * 0.18);
    group.add(tower);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.94, spec.height * 0.12, spec.depth * 0.86),
      roofMaterial
    );
    roof.position.y = spec.height * 0.75;
    group.add(roof);
  }

  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.width * 0.62, spec.height * 0.54),
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.55,
      roughness: 0.22,
    })
  );
  frame.position.set(0, spec.height * 0.34, spec.depth * 0.5 + 0.005);
  group.add(frame);

  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.width * 0.55, spec.height * 0.46),
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      emissive: owned ? 0x22d3ee : 0x000000,
      emissiveIntensity: owned ? 0.26 : 0,
      metalness: 0.42,
      roughness: 0.28,
    })
  );
  door.position.set(0, spec.height * 0.34, spec.depth * 0.5 + 0.015);
  group.add(door);

  const taxiCenter = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.width * 1.7, 0.06),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0x854d0e,
      emissiveIntensity: 0.35,
      metalness: 0.2,
      roughness: 0.45,
    })
  );
  taxiCenter.rotation.x = -Math.PI / 2;
  taxiCenter.position.set(0, 0.08, spec.depth * 1.04);
  group.add(taxiCenter);

  return group;
}

export default function HangarMarket3D({
  marketAirports = [],
  selectedAirportIcao = "",
  onSelectAirport,
  hangarSizes = [],
  selectedMarketSize = "small",
  onSelectMarketSize,
  selectedHangar = null,
  actionLabel = "Buy hangar",
  actionCost = 0,
  actionHelper = "",
  canSubmit = false,
  onBuyOrUpgrade,
  isProcessing = false,
  departureCount = 0,
  lang = "de",
}) {
  const viewportRef = useRef(null);
  const [renderFailed, setRenderFailed] = useState(false);

  const selectedAirport = useMemo(() => {
    const selected = normIcao(selectedAirportIcao);
    return marketAirports.find((airport) => normIcao(airport.airport_icao) === selected) || null;
  }, [marketAirports, selectedAirportIcao]);

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return undefined;

    let frameId = null;
    let renderer = null;
    let resizeObserver = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.Fog(0x020617, 12, 34);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(8.4, 4.1, 8.4);
    camera.lookAt(0, 1.8, 0);

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setRenderFailed(true);
      return undefined;
    }

    setRenderFailed(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const setRendererSize = () => {
      const width = Math.max(340, container.clientWidth);
      const height = Math.max(250, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    setRendererSize();
    resizeObserver = new ResizeObserver(setRendererSize);
    resizeObserver.observe(container);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5.2;
    controls.maxDistance = 20;
    controls.minPolarAngle = 0.36;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;

    const ambient = new THREE.AmbientLight(0x8ac5ff, 0.48);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.28);
    keyLight.position.set(8, 11, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x22d3ee, 1.7, 30);
    rimLight.position.set(-5, 4, -7);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 34),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.12,
        roughness: 0.83,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(34, 34, 0x0ea5e9, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(35, 11, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x111827,
        metalness: 0.2,
        roughness: 0.72,
      })
    );
    backWall.position.set(0, 5.5, -12.5);
    scene.add(backWall);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 11, 23),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.2,
        roughness: 0.8,
      })
    );
    leftWall.position.set(-17.4, 5.5, -1.1);
    scene.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.x = 17.4;
    scene.add(rightWall);

    const model = buildHangarModel(selectedMarketSize, Boolean(selectedHangar));
    model.position.set(0, 0, 0.2);
    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    scene.add(model);

    const clock = new THREE.Clock();
    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      if (controls.autoRotate) {
        model.rotation.y = Math.sin(elapsed * 0.35) * 0.08;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (resizeObserver) resizeObserver.disconnect();
      controls.dispose();

      scene.traverse((node) => {
        if (node.geometry) node.geometry.dispose?.();
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((material) => material.dispose?.());
          } else {
            node.material.dispose?.();
          }
        }
      });

      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }
    };
  }, [selectedMarketSize, selectedHangar]);

  return (
    <Card className="h-full min-h-[460px] overflow-hidden border border-cyan-900/40 bg-slate-950/90">
      <div className="border-b border-cyan-900/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-cyan-300" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100">
              {lang === "de" ? "3D Hangar Markt" : "3D Hangar Market"}
            </h3>
          </div>
          <Badge className="border-cyan-700/50 bg-cyan-950/40 text-[10px] font-mono text-cyan-100">
            {selectedHangar ? (lang === "de" ? "Owned" : "Owned") : (lang === "de" ? "Nicht gekauft" : "Not owned")}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <div className="overflow-hidden rounded-xl border border-cyan-900/40 bg-slate-900/80">
            <div ref={viewportRef} className="h-[280px] w-full" />
            {renderFailed && (
              <div className="flex h-[280px] items-center justify-center px-4 text-center text-sm text-slate-400">
                {lang === "de"
                  ? "3D Vorschau konnte auf diesem Geraet nicht initialisiert werden."
                  : "3D preview could not be initialized on this device."}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2.5 xl:col-span-5">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5">
            <p className="mb-1 text-[10px] font-mono uppercase text-slate-400">
              {lang === "de" ? "Departure Airport" : "Departure airport"}
            </p>
            <select
              value={selectedAirportIcao}
              onChange={(event) => onSelectAirport?.(event.target.value)}
              className="h-8 w-full rounded border border-cyan-900/60 bg-slate-950/90 px-2 text-xs text-cyan-100"
            >
              <option value="">{lang === "de" ? "Airport waehlen" : "Select airport"}</option>
              {marketAirports.map((airport) => (
                <option key={airport.airport_icao} value={airport.airport_icao}>
                  {airport.airport_icao} - {airport.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-slate-300">
              <MapPin className="mr-1 inline h-3.5 w-3.5 text-cyan-300" />
              {selectedAirport ? `${selectedAirport.airport_icao} - ${selectedAirport.label}` : (lang === "de" ? "Kein Airport" : "No airport")}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {lang === "de" ? "Auftraege ab diesem Airport" : "Contracts from this airport"}: {departureCount}
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5">
            <p className="mb-1 text-[10px] font-mono uppercase text-slate-400">
              {lang === "de" ? "Hangar Groesse" : "Hangar size"}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {hangarSizes.map((size) => (
                <button
                  key={size.key}
                  type="button"
                  onClick={() => onSelectMarketSize?.(size.key)}
                  className={`rounded-md border px-2 py-1.5 text-left text-[10px] font-mono uppercase transition ${
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
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5">
            <p className="text-[11px] text-slate-300">{actionHelper}</p>
            <p className="mt-1 text-sm font-mono text-emerald-300">${Math.round(actionCost || 0).toLocaleString()}</p>
          </div>

          <Button
            type="button"
            disabled={!canSubmit || isProcessing}
            onClick={() => onBuyOrUpgrade?.()}
            className="h-9 w-full bg-emerald-600 text-xs font-mono uppercase text-slate-950 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-300"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {lang === "de" ? "Wird verarbeitet" : "Processing"}
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
