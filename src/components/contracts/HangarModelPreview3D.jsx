import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Loader2, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function buildFallbackModel(sizeKey, owned) {
  const scaleMap = {
    small: 0.95,
    medium: 1.1,
    large: 1.28,
    mega: 1.55,
  };
  const s = scaleMap[sizeKey] || 1;

  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4.6 * s, 0.12, 3.8 * s),
    new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.12, roughness: 0.9 })
  );
  base.position.y = 0.06;
  group.add(base);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.4 * s, 1.4 * s, 2.0 * s),
    new THREE.MeshStandardMaterial({
      color: owned ? 0x334155 : 0x52525b,
      emissive: owned ? 0x082f49 : 0x0f172a,
      emissiveIntensity: owned ? 0.22 : 0.08,
      metalness: 0.35,
      roughness: 0.55,
    })
  );
  body.position.y = 0.72 * s;
  group.add(body);

  const roofL = new THREE.Mesh(
    new THREE.BoxGeometry(1.35 * s, 0.16 * s, 2.05 * s),
    new THREE.MeshStandardMaterial({ color: 0xb8c4d4, metalness: 0.6, roughness: 0.24 })
  );
  roofL.position.set(-0.4 * s, 1.55 * s, 0);
  roofL.rotation.z = 0.28;
  group.add(roofL);

  const roofR = roofL.clone();
  roofR.position.x = 0.4 * s;
  roofR.rotation.z = -0.28;
  group.add(roofR);

  const gate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4 * s, 0.9 * s),
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      emissive: owned ? 0x22d3ee : 0x000000,
      emissiveIntensity: owned ? 0.2 : 0,
      metalness: 0.4,
      roughness: 0.25,
    })
  );
  gate.position.set(0, 0.7 * s, 1.01 * s);
  group.add(gate);

  return group;
}

function normalizeAndGround(object3d, targetMax = 4.4) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x || 1, size.y || 1, size.z || 1);
  const scale = targetMax / maxDim;
  object3d.scale.setScalar(scale);

  const centered = new THREE.Box3().setFromObject(object3d);
  const center = new THREE.Vector3();
  centered.getCenter(center);
  object3d.position.sub(center);

  const grounded = new THREE.Box3().setFromObject(object3d);
  object3d.position.y -= grounded.min.y;
}

function disposeObject(object3d) {
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
}

function sanitizeLoadedModel(object3d, modelVariantId) {
  if (modelVariantId !== "mega_platform") return;

  object3d.traverse((node) => {
    const nodeName = String(node?.name || "").toLowerCase();
    if (nodeName.includes("collider") || nodeName.includes("collision")) {
      node.visible = false;
      return;
    }

    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const hasColliderMaterial = materials.some((material) => {
      const materialName = String(material?.name || "").toLowerCase();
      return materialName.includes("collider") || materialName.includes("collision");
    });

    if (hasColliderMaterial) {
      node.visible = false;
    }
  });
}

export default function HangarModelPreview3D({
  modelPath = "",
  sizeKey = "small",
  modelVariantId = "",
  owned = false,
  lang = "de",
}) {
  const viewportRef = useRef(null);
  const fullscreenViewportRef = useRef(null);
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoadError, setModelLoadError] = useState("");

  useEffect(() => {
    if (!showFullscreenModal || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showFullscreenModal]);

  useEffect(() => {
    const bootRenderer = (container, largeMode = false) => {
      if (!container) return null;

      let frameId = null;
      let renderer = null;
      let resizeObserver = null;
      let cancelled = false;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x030712);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(6.4, 3.35, 6.4);
      camera.lookAt(0, 1.2, 0);

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      } catch {
        setRenderFailed(true);
        return null;
      }

      setRenderFailed(false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      const setRendererSize = () => {
        const width = Math.max(300, container.clientWidth);
        const height = Math.max(largeMode ? 320 : 175, container.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      setRendererSize();
      resizeObserver = new ResizeObserver(setRendererSize);
      resizeObserver.observe(container);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 3.8;
      controls.maxDistance = 11.5;
      controls.minPolarAngle = 0.34;
      controls.maxPolarAngle = Math.PI / 2.06;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.78;

      scene.add(new THREE.AmbientLight(0x9aa9b8, 0.42));
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(8, 10, 6);
      key.castShadow = true;
      scene.add(key);

      const rim = new THREE.PointLight(0x38bdf8, 0.8, 24);
      rim.position.set(-5, 3.2, -6.5);
      scene.add(rim);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(36, 26),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.1, roughness: 0.88 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      const greenGrid = new THREE.GridHelper(28, 36, 0x072913, 0x04190c);
      greenGrid.position.y = 0.015;
      scene.add(greenGrid);

      const previewRoot = new THREE.Group();
      previewRoot.position.set(0, 0, 0.15);
      scene.add(previewRoot);

      let activeModel = null;
      const mountModel = (object3d) => {
        if (activeModel) {
          previewRoot.remove(activeModel);
          disposeObject(activeModel);
        }
        const targetMaxBySize = {
          small: 4.4,
          medium: 5.3,
          large: 6.2,
          mega: 7.2,
        };
        const compactBoost = modelVariantId === "compact_modular" ? 1.42 : 1;
        normalizeAndGround(object3d, (targetMaxBySize[sizeKey] || 4.4) * compactBoost);
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

      mountModel(buildFallbackModel(sizeKey, owned));

      if (modelPath) {
        setIsModelLoading(true);
        setModelLoadError("");
        const loader = new GLTFLoader();
        loader.load(
          modelPath,
          (gltf) => {
            if (cancelled) return;
            if (!gltf?.scene) {
              setModelLoadError(lang === "de" ? "Modell konnte nicht geladen werden." : "Model could not be loaded.");
              setIsModelLoading(false);
              return;
            }
            sanitizeLoadedModel(gltf.scene, modelVariantId);
            mountModel(gltf.scene);
            setIsModelLoading(false);
          },
          undefined,
          () => {
            if (cancelled) return;
            setModelLoadError(
              lang === "de" ? "3D-Modell konnte nicht geladen werden. Fallback aktiv." : "Could not load 3D model. Fallback active."
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
        if (activeModel) {
          activeModel.rotation.y = Math.sin(elapsed * 0.34) * 0.08;
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
            if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose?.());
            else node.material.dispose?.();
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
    };

    const cleanupInline = bootRenderer(viewportRef.current, false);
    const cleanupFullscreen = showFullscreenModal ? bootRenderer(fullscreenViewportRef.current, true) : null;

    return () => {
      cleanupInline?.();
      cleanupFullscreen?.();
    };
  }, [lang, modelPath, modelVariantId, owned, showFullscreenModal, sizeKey]);

  return (
    <>
      <div className="mb-2 rounded-md border border-slate-700/80 bg-slate-900/75 p-2">
        <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-wide text-cyan-300">
          <span>{lang === "de" ? "3D Hangar Vorschau" : "3D hangar preview"}</span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setShowFullscreenModal(true)}
            className="h-6 w-6 border-cyan-800/50 bg-slate-950/90 text-cyan-200 hover:bg-cyan-950/40"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="relative overflow-hidden rounded border border-cyan-900/40 bg-slate-950/90">
          <div ref={viewportRef} className="h-[clamp(130px,22vh,190px)] w-full" />
          {isModelLoading && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/45">
              <div className="rounded-md border border-cyan-800/50 bg-slate-950/85 px-2.5 py-1 text-[10px] font-mono text-cyan-100">
                <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
                {lang === "de" ? "3D-Modell wird geladen" : "Loading 3D model"}
              </div>
            </div>
          )}
          {renderFailed && (
            <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-[11px] text-slate-400">
              {lang === "de" ? "3D Vorschau konnte nicht gestartet werden." : "3D preview could not be initialized."}
            </div>
          )}
        </div>
        {modelLoadError && !renderFailed && (
          <p className="mt-1 text-[10px] text-amber-300">{modelLoadError}</p>
        )}
      </div>

      {showFullscreenModal && (
        <div className="fixed inset-0 z-[1700] bg-slate-950/92 backdrop-blur-sm">
          <div className="flex h-full w-full flex-col p-3 sm:p-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-mono uppercase tracking-wide text-cyan-200">
                {lang === "de" ? "3D Hangar Vorschau Vollbild" : "3D hangar preview fullscreen"}
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setShowFullscreenModal(false)}
                className="h-8 w-8 border-cyan-800/50 bg-slate-950/90 text-cyan-200 hover:bg-cyan-950/40"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-cyan-900/40 bg-slate-950/90">
              <div ref={fullscreenViewportRef} className="h-full w-full" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
