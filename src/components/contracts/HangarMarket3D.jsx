import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building2, Loader2, MapPin } from "lucide-react";
import { getVariantSizeSpec } from "@/components/contracts/hangarModelCatalog";

const SIZE_STYLE = {
  small: { width: 2.8, height: 2.3, depth: 2.2, color: 0x4b5563 },
  medium: { width: 3.6, height: 3.0, depth: 2.9, color: 0x0f766e },
  large: { width: 4.5, height: 3.6, depth: 3.6, color: 0x334155 },
  mega: { width: 5.6, height: 4.4, depth: 4.4, color: 0x1f2937 },
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
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xb8c4d4, metalness: 0.58, roughness: 0.25 });

  if (sizeKey === "small") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height * 0.62, spec.depth), hangarBodyMaterial);
    body.position.y = spec.height * 0.33;
    group.add(body);

    const roofLeft = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.56, spec.height * 0.1, spec.depth * 1.04), roofMaterial);
    roofLeft.position.set(-spec.width * 0.16, spec.height * 0.76, 0);
    roofLeft.rotation.z = 0.32;
    group.add(roofLeft);

    const roofRight = roofLeft.clone();
    roofRight.position.x = spec.width * 0.16;
    roofRight.rotation.z = -0.32;
    group.add(roofRight);
  } else if (sizeKey === "medium") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height * 0.64, spec.depth), hangarBodyMaterial);
    body.position.y = spec.height * 0.33;
    group.add(body);

    for (let i = 0; i < 4; i += 1) {
      const segment = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.28, spec.height * 0.11, spec.depth * 1.05), roofMaterial);
      segment.position.set(-spec.width * 0.42 + i * spec.width * 0.28, spec.height * (0.73 + (i % 2 === 0 ? 0.03 : -0.01)), 0);
      segment.rotation.z = i % 2 === 0 ? 0.22 : -0.1;
      group.add(segment);
    }

    const annex = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.24, spec.height * 0.36, spec.depth * 0.58),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.36, roughness: 0.45 })
    );
    annex.position.set(spec.width * 0.57, spec.height * 0.21, -spec.depth * 0.08);
    group.add(annex);
  } else if (sizeKey === "large") {
    for (let i = 0; i < 3; i += 1) {
      const bay = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.29, spec.height * 0.63, spec.depth * 0.86), hangarBodyMaterial);
      bay.position.set(-spec.width * 0.31 + i * spec.width * 0.31, spec.height * 0.33, 0);
      group.add(bay);
    }

    const roofLeft = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.52, spec.height * 0.11, spec.depth * 0.94), roofMaterial);
    roofLeft.position.set(-spec.width * 0.22, spec.height * 0.77, 0);
    roofLeft.rotation.z = -0.2;
    group.add(roofLeft);

    const roofRight = roofLeft.clone();
    roofRight.position.x = spec.width * 0.22;
    roofRight.rotation.z = 0.2;
    group.add(roofRight);

    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.08, spec.height * 0.18, spec.depth * 0.9),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.62, roughness: 0.22 })
    );
    spine.position.set(0, spec.height * 0.76, 0);
    group.add(spine);
  } else {
    const core = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.86, spec.height * 0.66, spec.depth * 0.84), hangarBodyMaterial);
    core.position.y = spec.height * 0.35;
    group.add(core);

    const sideL = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.26, spec.height * 0.48, spec.depth * 0.56),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.38, roughness: 0.44 })
    );
    sideL.position.set(-spec.width * 0.62, spec.height * 0.25, -spec.depth * 0.09);
    group.add(sideL);

    const sideR = sideL.clone();
    sideR.position.x = spec.width * 0.62;
    group.add(sideR);

    const roofA = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.44, spec.height * 0.11, spec.depth * 0.9), roofMaterial);
    roofA.position.set(-spec.width * 0.21, spec.height * 0.82, 0);
    roofA.rotation.z = 0.2;
    group.add(roofA);

    const roofB = roofA.clone();
    roofB.position.x = spec.width * 0.21;
    roofB.rotation.z = -0.2;
    group.add(roofB);

    const gantry = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.09, spec.height * 0.38, spec.depth * 0.1),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.62, roughness: 0.2 })
    );
    gantry.position.set(0, spec.height * 0.95, spec.depth * 0.18);
    group.add(gantry);
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
  selectedMarketSize = "small",
  hangarVariants = [],
  selectedMarketVariantId = "",
  onSelectMarketVariantId,
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
  const [modelLoadError, setModelLoadError] = useState("");
  const [isModelLoading, setIsModelLoading] = useState(false);

  const selectedAirport = useMemo(() => {
    const selected = normIcao(selectedAirportIcao);
    return marketAirports.find((airport) => normIcao(airport.airport_icao) === selected) || null;
  }, [marketAirports, selectedAirportIcao]);

  const selectedVariant = useMemo(() => {
    if (!Array.isArray(hangarVariants) || hangarVariants.length === 0) return null;
    return (
      hangarVariants.find((variant) => variant.id === selectedMarketVariantId) || hangarVariants[0] || null
    );
  }, [hangarVariants, selectedMarketVariantId]);
  const selectedVariantSizeSpec = useMemo(
    () => getVariantSizeSpec(selectedVariant?.id) || null,
    [selectedVariant?.id]
  );

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return undefined;

    let frameId = null;
    let renderer = null;
    let resizeObserver = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712);
    scene.fog = new THREE.Fog(0x030712, 11, 33);

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

    const ambient = new THREE.AmbientLight(0x93a4b6, 0.4);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.12);
    keyLight.position.set(8, 11, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x60a5fa, 0.85, 26);
    rimLight.position.set(-5, 4, -7);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 34),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.12,
        roughness: 0.86,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(34, 34, 0x334155, 0x111827);
    grid.position.y = 0.01;
    scene.add(grid);

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(35, 11, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x111827,
        metalness: 0.2,
        roughness: 0.78,
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

    const previewRoot = new THREE.Group();
    previewRoot.position.set(0, 0, 0.2);
    scene.add(previewRoot);

    let activeModel = null;
    const disposeObject = (object3d) => {
      object3d.traverse((node) => {
        if (node.geometry) node.geometry.dispose?.();
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((material) => material.dispose?.());
          } else {
            node.material.dispose?.();
          }
        }
      });
    };

    const applyModelTransform = (object) => {
      const sizePreset = SIZE_STYLE[selectedVariantSizeSpec?.key || selectedMarketSize] || SIZE_STYLE.small;
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x || 1, size.y || 1, size.z || 1);
      const targetDim = Math.max(3.6, sizePreset.width * 1.35);
      const scale = targetDim / maxDim;
      object.scale.setScalar(scale);

      const centeredBox = new THREE.Box3().setFromObject(object);
      const center = new THREE.Vector3();
      centeredBox.getCenter(center);
      object.position.sub(center);

      const groundedBox = new THREE.Box3().setFromObject(object);
      object.position.y -= groundedBox.min.y;
      object.position.z += 0.2;
    };

    const addPreviewModel = (object3d) => {
      if (activeModel) {
        previewRoot.remove(activeModel);
        disposeObject(activeModel);
      }
      applyModelTransform(object3d);
      object3d.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          node.frustumCulled = false;
        }
      });
      previewRoot.add(object3d);
      activeModel = object3d;
    };

    const fallbackModel = buildHangarModel(selectedVariantSizeSpec?.key || selectedMarketSize, Boolean(selectedHangar));
    addPreviewModel(fallbackModel);

    let cancelled = false;
    if (selectedVariant?.path) {
      setIsModelLoading(true);
      setModelLoadError("");
      const loader = new GLTFLoader();
      loader.load(
        selectedVariant.path,
        (gltf) => {
          if (cancelled) return;
          const modelRoot = gltf?.scene;
          if (!modelRoot) {
            setModelLoadError("Model scene is empty.");
            setIsModelLoading(false);
            return;
          }
          addPreviewModel(modelRoot);
          setIsModelLoading(false);
        },
        undefined,
        () => {
          if (cancelled) return;
          setModelLoadError(
            lang === "de"
              ? "GLB konnte nicht geladen werden, Fallback-Modell aktiv."
              : "Could not load GLB, fallback model active."
          );
          setIsModelLoading(false);
        }
      );
    } else {
      setIsModelLoading(false);
      setModelLoadError("");
    }

    const clock = new THREE.Clock();
    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      if (controls.autoRotate && activeModel) {
        activeModel.rotation.y = Math.sin(elapsed * 0.35) * 0.08;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelled = true;
      if (activeModel) {
        previewRoot.remove(activeModel);
        disposeObject(activeModel);
      }
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
  }, [lang, selectedHangar, selectedMarketSize, selectedVariant?.path, selectedVariantSizeSpec?.key]);

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
          <div className="relative overflow-hidden rounded-xl border border-cyan-900/40 bg-slate-900/80">
            <div ref={viewportRef} className="h-[280px] w-full" />
            {isModelLoading && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/35">
                <div className="rounded-md border border-cyan-800/50 bg-slate-950/80 px-3 py-1.5 text-[11px] font-mono text-cyan-100">
                  <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
                  {lang === "de" ? "GLB wird geladen..." : "Loading GLB..."}
                </div>
              </div>
            )}
            {renderFailed && (
              <div className="flex h-[280px] items-center justify-center px-4 text-center text-sm text-slate-400">
                {lang === "de"
                  ? "3D Vorschau konnte auf diesem Geraet nicht initialisiert werden."
                  : "3D preview could not be initialized on this device."}
              </div>
            )}
          </div>
          {modelLoadError && !renderFailed && (
            <p className="mt-1.5 text-[11px] text-amber-300">{modelLoadError}</p>
          )}
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

          {hangarVariants.length > 0 && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5">
              <p className="mb-1 text-[10px] font-mono uppercase text-slate-400">
                {lang === "de" ? "Hangar Modell" : "Hangar model"}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {hangarVariants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => onSelectMarketVariantId?.(variant.id)}
                    className={`rounded-md border px-2 py-1.5 text-left text-[10px] font-mono uppercase transition ${
                      selectedMarketVariantId === variant.id
                        ? "border-cyan-500/70 bg-cyan-900/35 text-cyan-100"
                        : "border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-cyan-800/70"
                    }`}
                  >
                    <div>{variant.label}</div>
                    <div className="text-[9px] text-slate-400">
                      {(() => {
                        const spec = getVariantSizeSpec(variant.id);
                        if (!spec) return "-";
                        return `${spec.key.toUpperCase()} | ${spec.slots} slots | $${Math.round(spec.price).toLocaleString()}`;
                      })()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5">
            <p className="text-[11px] text-slate-300">{actionHelper}</p>
            <p className="mt-1 text-sm font-mono text-emerald-300">${Math.round(actionCost || 0).toLocaleString()}</p>
          </div>

          <Button
            type="button"
            disabled={!canSubmit || isProcessing}
            onClick={() =>
              onBuyOrUpgrade?.({
                airportIcao: normIcao(selectedAirportIcao),
                modelVariant: selectedMarketVariantId,
              })
            }
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
