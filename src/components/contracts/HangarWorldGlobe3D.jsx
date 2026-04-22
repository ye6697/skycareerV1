import React from 'react';
import * as THREE from 'three';

const latLonToVector3 = (lat, lon, radius) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
};

export default function HangarWorldGlobe3D({ hangars = [], contracts = [], contractsByHangar = {}, onSelectHangar }) {
  const mountRef = React.useRef(null);
  const [selectedHangar, setSelectedHangar] = React.useState(null);
  const zoomTargetRef = React.useRef(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 900;
    const height = mount.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 35, 95);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const globeRadius = 28;
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x0f2942, emissive: 0x04101b, roughness: 0.9, metalness: 0.08 })
    );
    scene.add(globe);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius + 1.2, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.12 })
    );
    scene.add(atmosphere);

    scene.add(new THREE.AmbientLight(0x8ab4ff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(80, 40, 100);
    scene.add(dir);

    const airportMap = new Map(hangars.map((h) => [h.airport_icao, h]));

    const markerMeshes = [];
    hangars.forEach((hangar) => {
      if (!Number.isFinite(hangar.lat) || !Number.isFinite(hangar.lon)) return;
      const pointPos = latLonToVector3(hangar.lat, hangar.lon, globeRadius + 0.8);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x22c55e })
      );
      marker.position.copy(pointPos);
      marker.userData = { hangar, pointPos };
      scene.add(marker);
      markerMeshes.push(marker);
    });

    contracts.forEach((contract) => {
      const dep = airportMap.get(contract.departure_airport);
      const arr = contract.arrival;
      if (!dep || !arr || !Number.isFinite(arr.lat) || !Number.isFinite(arr.lon)) return;

      const start = latLonToVector3(dep.lat, dep.lon, globeRadius + 0.9);
      const end = latLonToVector3(arr.lat, arr.lon, globeRadius + 0.9);
      const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(globeRadius + 6);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(36);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
      );
      scene.add(line);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const cameraBase = new THREE.Vector3(0, 35, 95);
    const onPointerDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(markerMeshes, false)[0];
      if (!hit?.object?.userData?.hangar) return;
      const hangar = hit.object.userData.hangar;
      setSelectedHangar(hangar);
      if (onSelectHangar) onSelectHangar(hangar);
      zoomTargetRef.current = hit.object.userData.pointPos.clone().normalize().multiplyScalar(globeRadius + 20);
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    let frame = 0;
    let disposed = false;
    const animate = () => {
      if (disposed) return;
      frame += 0.003;
      globe.rotation.y = frame;
      atmosphere.rotation.y = frame * 1.1;
      if (zoomTargetRef.current) {
        camera.position.lerp(zoomTargetRef.current, 0.05);
        camera.lookAt(0, 0, 0);
      } else {
        camera.position.lerp(cameraBase, 0.05);
        camera.lookAt(0, 0, 0);
      }
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    };
  }, [hangars, contracts, onSelectHangar]);

  return (
    <div className="relative">
      <div ref={mountRef} className="w-full h-[420px] rounded-xl border border-cyan-900/40 overflow-hidden" />
      {selectedHangar && (
        <div className="absolute left-3 top-3 w-[320px] rounded-lg border border-cyan-700/50 bg-slate-950/95 p-3 text-xs text-cyan-100 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="font-mono text-cyan-300 uppercase">{selectedHangar.airport_icao} · {selectedHangar.size}</div>
            <button
              onClick={() => {
                setSelectedHangar(null);
                zoomTargetRef.current = null;
              }}
              className="rounded bg-slate-800 px-2 py-1 text-[10px] text-cyan-300"
            >
              Close
            </button>
          </div>
          <div className="mt-2 text-[11px] text-cyan-400">
            Verfügbare Aufträge: {(contractsByHangar[selectedHangar.id] || []).length}
          </div>
          <div className="mt-1 max-h-40 overflow-y-auto space-y-1">
            {(contractsByHangar[selectedHangar.id] || []).slice(0, 8).map((contract) => (
              <div key={contract.id} className="rounded bg-slate-900/80 px-2 py-1">
                {contract.departure_airport} → {contract.arrival_airport} · ${Math.round(contract.payout || 0).toLocaleString()}
              </div>
            ))}
            {(contractsByHangar[selectedHangar.id] || []).length === 0 && (
              <div className="text-cyan-700">Keine kompatiblen Aufträge für die stationierten Flugzeuge.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
