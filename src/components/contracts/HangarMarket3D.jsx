import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Gauge, Plane, Sparkles, TrendingUp } from "lucide-react";

const TYPE_THEME = {
  small_prop: {
    color: 0x38bdf8,
    emissive: 0x0c4a6e,
    fuselageLength: 4.2,
    wingSpan: 6.2,
    hasPropeller: true,
  },
  turboprop: {
    color: 0xf59e0b,
    emissive: 0x7c2d12,
    fuselageLength: 5.2,
    wingSpan: 7.4,
    hasPropeller: true,
  },
  regional_jet: {
    color: 0x14b8a6,
    emissive: 0x134e4a,
    fuselageLength: 6.8,
    wingSpan: 8.8,
    hasPropeller: false,
  },
  narrow_body: {
    color: 0x8b5cf6,
    emissive: 0x581c87,
    fuselageLength: 7.6,
    wingSpan: 9.8,
    hasPropeller: false,
  },
  wide_body: {
    color: 0xf43f5e,
    emissive: 0x7f1d1d,
    fuselageLength: 8.8,
    wingSpan: 11.8,
    hasPropeller: false,
  },
  cargo: {
    color: 0x06b6d4,
    emissive: 0x164e63,
    fuselageLength: 8.1,
    wingSpan: 10.4,
    hasPropeller: false,
  },
  fallback: {
    color: 0x22d3ee,
    emissive: 0x134e4a,
    fuselageLength: 5.4,
    wingSpan: 7.8,
    hasPropeller: false,
  },
};

function isContractCompatible(contract, aircraft) {
  if (!contract || !aircraft) return false;

  const requiredTypes = contract.required_aircraft_type || [];
  const typeMatch =
    !requiredTypes.length || requiredTypes.includes(aircraft.type);
  const cargoMatch =
    !contract.cargo_weight_kg ||
    Number(aircraft.cargo_capacity_kg || 0) >= Number(contract.cargo_weight_kg);
  const rangeMatch =
    !contract.distance_nm ||
    Number(aircraft.range_nm || 0) >= Number(contract.distance_nm);

  return typeMatch && cargoMatch && rangeMatch;
}

function getAircraftTypeLabel(type, lang) {
  const de = lang === "de";
  const labels = {
    small_prop: de ? "Kleinprop" : "Small Prop",
    turboprop: de ? "Turboprop" : "Turboprop",
    regional_jet: de ? "Regionaljet" : "Regional Jet",
    narrow_body: de ? "Narrow Body" : "Narrow Body",
    wide_body: de ? "Wide Body" : "Wide Body",
    cargo: de ? "Frachter" : "Cargo",
  };
  return labels[type] || type || (de ? "Unbekannt" : "Unknown");
}

function buildShowcaseAircraft(theme) {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: theme.color,
    emissive: theme.emissive,
    metalness: 0.72,
    roughness: 0.34,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.58,
    roughness: 0.28,
  });

  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.52, theme.fuselageLength, 24),
    bodyMaterial
  );
  fuselage.rotation.z = Math.PI / 2;
  fuselage.position.y = 1.5;
  group.add(fuselage);

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.47, 24, 24),
    accentMaterial
  );
  cockpit.scale.set(1.28, 0.68, 0.72);
  cockpit.position.set(theme.fuselageLength / 2 - 0.2, 1.53, 0);
  group.add(cockpit);

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(theme.wingSpan, 0.14, 1.3),
    accentMaterial
  );
  wing.position.set(0.1, 1.48, 0);
  group.add(wing);

  const tailWing = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.1, 0.7),
    accentMaterial
  );
  tailWing.position.set(-(theme.fuselageLength / 2) + 0.6, 2.12, 0);
  group.add(tailWing);

  const tailFin = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.1, 0.68),
    accentMaterial
  );
  tailFin.position.set(-(theme.fuselageLength / 2) + 0.55, 2.16, 0);
  group.add(tailFin);

  const engineLeft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.64, 18),
    bodyMaterial
  );
  engineLeft.rotation.z = Math.PI / 2;
  engineLeft.position.set(0.46, 1.3, -1.08);
  group.add(engineLeft);

  const engineRight = engineLeft.clone();
  engineRight.position.z = 1.08;
  group.add(engineRight);

  let propeller = null;
  if (theme.hasPropeller) {
    const propGroup = new THREE.Group();
    const hub = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 16),
      accentMaterial
    );
    propGroup.add(hub);

    for (let i = 0; i < 4; i += 1) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.72, 0.16),
        accentMaterial
      );
      blade.position.y = 0.36;
      blade.rotation.z = (i * Math.PI) / 2;
      propGroup.add(blade);
    }

    propGroup.position.set(theme.fuselageLength / 2 + 0.2, 1.52, 0);
    group.add(propGroup);
    propeller = propGroup;
  }

  group.userData.propeller = propeller;
  return group;
}

export default function HangarMarket3D({
  aircraft = [],
  contracts = [],
  selectedAircraftId = "all",
  onSelectAircraft,
  lang = "de",
}) {
  const viewportRef = useRef(null);
  const [renderFailed, setRenderFailed] = useState(false);

  const aircraftMarketRows = useMemo(() => {
    if (!aircraft.length) return [];
    return aircraft
      .map((plane) => {
        const compatible = contracts.filter((contract) =>
          isContractCompatible(contract, plane)
        );
        const avgPayout = compatible.length
          ? Math.round(
              compatible.reduce((sum, contract) => sum + (contract.payout || 0), 0) /
                compatible.length
            )
          : 0;

        const demand = contracts.length
          ? Math.min(100, Math.round((compatible.length / contracts.length) * 100))
          : 0;

        return {
          ...plane,
          compatibleCount: compatible.length,
          avgPayout,
          demand,
        };
      })
      .sort((a, b) => {
        if (b.compatibleCount !== a.compatibleCount) {
          return b.compatibleCount - a.compatibleCount;
        }
        return (b.avgPayout || 0) - (a.avgPayout || 0);
      });
  }, [aircraft, contracts]);

  const selectedAircraft = useMemo(() => {
    if (!aircraftMarketRows.length) return null;
    if (selectedAircraftId && selectedAircraftId !== "all") {
      const explicit = aircraftMarketRows.find(
        (plane) => plane.id === selectedAircraftId
      );
      if (explicit) return explicit;
    }
    return aircraftMarketRows[0];
  }, [aircraftMarketRows, selectedAircraftId]);

  useEffect(() => {
    const container = viewportRef.current;
    if (!container || !selectedAircraft) return undefined;

    let frameId = null;
    let renderer = null;
    let resizeObserver = null;

    const theme = TYPE_THEME[selectedAircraft.type] || TYPE_THEME.fallback;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.Fog(0x020617, 13, 37);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(7.5, 3.8, 7.5);
    camera.lookAt(0, 1.6, 0);

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (error) {
      setRenderFailed(true);
      return undefined;
    }

    setRenderFailed(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const setRendererSize = () => {
      const width = Math.max(320, container.clientWidth);
      const height = Math.max(220, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    setRendererSize();
    resizeObserver = new ResizeObserver(setRendererSize);
    resizeObserver.observe(container);

    const ambient = new THREE.AmbientLight(0x7dd3fc, 0.45);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(8, 13, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(theme.color, 2.4, 30);
    rimLight.position.set(-4, 4, -7);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 28),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.1,
        roughness: 0.75,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(36, 36, 0x0ea5e9, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    const rearWall = new THREE.Mesh(
      new THREE.BoxGeometry(36, 12, 0.5),
      new THREE.MeshStandardMaterial({
        color: 0x111827,
        metalness: 0.18,
        roughness: 0.72,
      })
    );
    rearWall.position.set(0, 6, -13);
    scene.add(rearWall);

    const sideWallLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 12, 24),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.22,
        roughness: 0.8,
      })
    );
    sideWallLeft.position.set(-17.8, 6, -1.5);
    scene.add(sideWallLeft);

    const sideWallRight = sideWallLeft.clone();
    sideWallRight.position.x = 17.8;
    scene.add(sideWallRight);

    const neonStrip = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.08, 0.2),
      new THREE.MeshStandardMaterial({
        color: theme.color,
        emissive: theme.color,
        emissiveIntensity: 0.82,
      })
    );
    neonStrip.position.set(0, 5.8, -12.7);
    scene.add(neonStrip);

    const aircraftMesh = buildShowcaseAircraft(theme);
    aircraftMesh.position.set(0, 0, 0.1);
    aircraftMesh.rotation.y = -0.35;
    aircraftMesh.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    scene.add(aircraftMesh);

    const clock = new THREE.Clock();
    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const turn = elapsed * 0.22;
      aircraftMesh.rotation.y = -0.4 + Math.sin(turn) * 0.26;
      aircraftMesh.position.y = 0.02 + Math.sin(elapsed * 1.2) * 0.04;

      const propeller = aircraftMesh.userData.propeller;
      if (propeller) {
        propeller.rotation.x += 0.62;
      }

      camera.position.x = 7.5 + Math.sin(elapsed * 0.28) * 0.7;
      camera.position.z = 7.5 + Math.cos(elapsed * 0.2) * 0.7;
      camera.lookAt(0, 1.55, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (resizeObserver) resizeObserver.disconnect();

      scene.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((material) => material.dispose());
          } else {
            node.material.dispose();
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
  }, [selectedAircraft]);

  return (
    <Card className="h-full min-h-[420px] overflow-hidden border border-cyan-900/40 bg-slate-950/90">
      <div className="relative border-b border-cyan-900/40 p-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(236,72,153,.18),transparent_35%),radial-gradient(circle_at_0%_100%,rgba(14,165,233,.2),transparent_45%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-cyan-300" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100">
              {lang === "de" ? "3D Hangar Market" : "3D Hangar Market"}
            </h3>
          </div>
          <Badge className="border-cyan-700/40 bg-cyan-950/50 text-[10px] font-mono text-cyan-100">
            <Sparkles className="mr-1 h-3 w-3" />
            {lang === "de" ? "Live Preview" : "Live Preview"}
          </Badge>
        </div>
      </div>

      <div className="p-3">
        <div className="mb-3 overflow-hidden rounded-xl border border-cyan-900/40 bg-slate-900/80">
          <div ref={viewportRef} className="h-[230px] w-full" />
          {renderFailed && (
            <div className="flex h-[230px] items-center justify-center px-4 text-center text-sm text-slate-400">
              {lang === "de"
                ? "3D Vorschau konnte auf diesem Geraet nicht initialisiert werden."
                : "3D preview could not be initialized on this device."}
            </div>
          )}
        </div>

        {selectedAircraft ? (
          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                {lang === "de" ? "Kompatible Jobs" : "Compatible Jobs"}
              </p>
              <p className="mt-1 text-lg font-bold text-cyan-200">
                {selectedAircraft.compatibleCount}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                {lang === "de" ? "Marktnachfrage" : "Demand"}
              </p>
              <p className="mt-1 text-lg font-bold text-emerald-300">
                {selectedAircraft.demand}%
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                {lang === "de" ? "Avg. Ertrag" : "Avg. Yield"}
              </p>
              <p className="mt-1 text-lg font-bold text-amber-300">
                ${selectedAircraft.avgPayout.toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-400">
            {lang === "de"
              ? "Keine verfuegbaren Flugzeuge fuer den Hangar-Market."
              : "No available aircraft for the hangar market."}
          </div>
        )}

        <div className="space-y-1.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onSelectAircraft?.("all")}
            className={`h-8 w-full justify-start border text-xs font-mono uppercase ${
              selectedAircraftId === "all"
                ? "border-cyan-600 bg-cyan-900/40 text-cyan-100"
                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-cyan-700 hover:text-cyan-200"
            }`}
          >
            <TrendingUp className="mr-2 h-3.5 w-3.5" />
            {lang === "de" ? "Automatische Marktwahl" : "Automatic market pick"}
          </Button>

          {aircraftMarketRows.slice(0, 5).map((plane) => {
            const selected = selectedAircraft?.id === plane.id;
            return (
              <button
                key={plane.id}
                type="button"
                onClick={() => onSelectAircraft?.(plane.id)}
                className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                  selected
                    ? "border-cyan-500/60 bg-cyan-900/30"
                    : "border-slate-700 bg-slate-900/60 hover:border-cyan-800/60 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                      {plane.name || plane.registration || "Aircraft"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {getAircraftTypeLabel(plane.type, lang)}
                      {plane.registration ? ` - ${plane.registration}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-emerald-300">
                      {plane.compatibleCount}{" "}
                      {lang === "de" ? "Treffer" : "Matches"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      ${plane.avgPayout.toLocaleString()}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedAircraft && (
          <div className="mt-3 rounded-xl border border-cyan-900/40 bg-slate-900/60 p-2.5 text-xs font-mono">
            <div className="flex items-center justify-between text-cyan-200">
              <span className="inline-flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5" />
                {selectedAircraft.name || selectedAircraft.registration}
              </span>
              <span className="text-slate-300">
                {getAircraftTypeLabel(selectedAircraft.type, lang)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
