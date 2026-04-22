import React from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const latLonToVector3 = (lat, lon, radius) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
};

const HANGAR_VISUAL_SCALE = {
  small: { width: 0.8, height: 1.1, color: 0x22d3ee },
  medium: { width: 1.1, height: 1.5, color: 0x38bdf8 },
  large: { width: 1.4, height: 2, color: 0x22c55e },
  mega: { width: 1.8, height: 2.5, color: 0xeab308 }
};

const CONTINENTS = [
  // Rough polygons in lon/lat, for a readable world texture without remote tile dependency.
  [[-168, 72], [-140, 70], [-110, 70], [-82, 55], [-96, 35], [-117, 30], [-96, 14], [-83, 9], [-74, 18], [-54, 48], [-60, 63], [-95, 74]],
  [[-81, 12], [-66, 10], [-51, 2], [-38, -14], [-54, -33], [-70, -52], [-81, -41], [-74, -18]],
  [[-11, 35], [2, 44], [20, 56], [48, 66], [90, 60], [130, 52], [146, 45], [122, 20], [92, 10], [60, 20], [35, 32], [12, 35]],
  [[-17, 37], [10, 35], [34, 28], [52, 12], [44, -8], [28, -35], [10, -34], [-12, 5]],
  [[112, -11], [154, -11], [153, -38], [134, -43], [114, -27]],
  [[50, 30], [77, 27], [90, 22], [84, 9], [72, 7], [60, 18]],
  [[-52, 80], [-35, 82], [-23, 74], [-45, 60], [-60, 70]],
  [[-180, -62], [180, -62], [180, -84], [-180, -84]]
];

function lonLatToUv(lon, lat, width, height) {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return [x, y];
}

function createEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  const oceanGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  oceanGradient.addColorStop(0, '#0b1b3e');
  oceanGradient.addColorStop(0.4, '#102c57');
  oceanGradient.addColorStop(1, '#0a1b35');
  ctx.fillStyle = oceanGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(120,170,220,0.18)';
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

  ctx.fillStyle = '#3a5d3f';
  ctx.strokeStyle = '#5f8a66';
  ctx.lineWidth = 2;
  CONTINENTS.forEach((poly) => {
    ctx.beginPath();
    poly.forEach(([lon, lat], idx) => {
      const [x, y] = lonLatToUv(lon, lat, canvas.width, canvas.height);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createStarTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#01030f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = Math.random() * 1.5;
    const alpha = Math.random() * 0.9;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function HangarWorldGlobe3D({
  hangars = [],
  contracts = [],
  contractsByHangar = {},
  marketAirports = [],
  onSelectHangar,
  onSelectMarketAirport,
  lang = 'en',
  selectedMarketSize = 'small'
}) {
  const mountRef = React.useRef(null);
  const zoomTargetRef = React.useRef(null);
  const [selectedHangar, setSelectedHangar] = React.useState(null);
  const [selectedMarketAirport, setSelectedMarketAirport] = React.useState(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 900;
    const height = mount.clientHeight || 460;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2600);
    camera.position.set(0, 40, 110);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 45;
    controls.maxDistance = 180;

    const globeRadius = 28;

    const stars = new THREE.Mesh(
      new THREE.SphereGeometry(900, 48, 48),
      new THREE.MeshBasicMaterial({ map: createStarTexture(), side: THREE.BackSide })
    );
    scene.add(stars);

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius, 128, 128),
      new THREE.MeshStandardMaterial({
        map: createEarthTexture(),
        metalness: 0.08,
        roughness: 0.88,
        emissive: 0x0a1422,
        emissiveIntensity: 0.2
      })
    );
    scene.add(earth);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius + 0.45, 96, 96),
      new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.08 })
    );
    scene.add(clouds);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius + 1.1, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.08, side: THREE.BackSide })
    );
    scene.add(atmosphere);

    scene.add(new THREE.AmbientLight(0x9ab9ff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.25);
    sun.position.set(100, 45, 85);
    scene.add(sun);

    const airportMap = new Map(hangars.map((h) => [h.airport_icao, h]));
    const hangarMeshes = [];

    hangars.forEach((hangar) => {
      if (!Number.isFinite(hangar.lat) || !Number.isFinite(hangar.lon)) return;
      const style = HANGAR_VISUAL_SCALE[hangar.size] || HANGAR_VISUAL_SCALE.small;
      const pointPos = latLonToVector3(hangar.lat, hangar.lon, globeRadius + style.height * 0.5);
      const normal = pointPos.clone().normalize();

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(style.width, style.height, style.width),
        new THREE.MeshStandardMaterial({ color: style.color, emissive: 0x052b33, emissiveIntensity: 0.35 })
      );
      body.position.copy(pointPos);
      body.lookAt(pointPos.clone().add(normal));
      body.rotateX(Math.PI / 2);
      body.userData = { hangar, pointPos, markerType: 'hangar' };
      scene.add(body);
      hangarMeshes.push(body);
    });

    const marketMeshes = [];
    marketAirports.forEach((airport) => {
      if (!Number.isFinite(airport.lat) || !Number.isFinite(airport.lon)) return;
      const hasOwned = hangars.some((h) => h.airport_icao === airport.airport_icao);
      const visualSize = hasOwned ? (HANGAR_VISUAL_SCALE[hangars.find((h) => h.airport_icao === airport.airport_icao)?.size] || HANGAR_VISUAL_SCALE.small) : (HANGAR_VISUAL_SCALE[selectedMarketSize] || HANGAR_VISUAL_SCALE.small);
      const pointPos = latLonToVector3(airport.lat, airport.lon, globeRadius + visualSize.height * 0.45);
      const normal = pointPos.clone().normalize();
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(visualSize.width * 0.45, visualSize.width * 0.45, visualSize.height, 6),
        new THREE.MeshStandardMaterial({ color: hasOwned ? 0x22c55e : 0xf59e0b, emissive: hasOwned ? 0x14532d : 0x78350f, emissiveIntensity: 0.2 })
      );
      mesh.position.copy(pointPos);
      mesh.lookAt(pointPos.clone().add(normal));
      mesh.rotateX(Math.PI / 2);
      mesh.userData = { airport, pointPos, markerType: 'market' };
      scene.add(mesh);
      marketMeshes.push(mesh);
    });

    const routeGroup = new THREE.Group();
    contracts.forEach((contract) => {
      const dep = airportMap.get(contract.departure_airport);
      const arr = contract.arrival;
      if (!dep || !arr || !Number.isFinite(arr.lat) || !Number.isFinite(arr.lon)) return;
      const start = latLonToVector3(dep.lat, dep.lon, globeRadius + 1.5);
      const end = latLonToVector3(arr.lat, arr.lon, globeRadius + 1.5);
      const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(globeRadius + 7.5);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(48);
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 })
      );
      routeGroup.add(line);
    });
    scene.add(routeGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hangarHit = raycaster.intersectObjects(hangarMeshes, false)[0];
      if (hangarHit?.object?.userData?.hangar) {
        const hangar = hangarHit.object.userData.hangar;
        setSelectedHangar(hangar);
        setSelectedMarketAirport(null);
        onSelectHangar?.(hangar);
        zoomTargetRef.current = hangarHit.object.userData.pointPos.clone().normalize().multiplyScalar(globeRadius + 18);
        return;
      }

      const marketHit = raycaster.intersectObjects(marketMeshes, false)[0];
      if (marketHit?.object?.userData?.airport) {
        const airport = marketHit.object.userData.airport;
        setSelectedMarketAirport(airport);
        setSelectedHangar(null);
        onSelectMarketAirport?.(airport);
        zoomTargetRef.current = marketHit.object.userData.pointPos.clone().normalize().multiplyScalar(globeRadius + 19);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    const onResize = () => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let disposed = false;
    const animate = () => {
      if (disposed) return;
      clouds.rotation.y += 0.0005;
      earth.rotation.y += 0.00025;
      stars.rotation.y += 0.00008;
      if (zoomTargetRef.current) {
        camera.position.lerp(zoomTargetRef.current, 0.045);
      }
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.dispose();
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
  }, [hangars, contracts, marketAirports, onSelectHangar, onSelectMarketAirport, selectedMarketSize]);

  return (
    <div className="relative">
      <div ref={mountRef} className="w-full h-[520px] rounded-xl border border-cyan-900/40 overflow-hidden" />

      <div className="absolute left-3 bottom-3 rounded-md border border-cyan-900/50 bg-slate-950/80 px-2 py-1 text-[10px] text-cyan-200">
        {lang === 'de' ? 'Ziehen = drehen · Scroll = Zoom · Klick = Hangar/Markt' : 'Drag = rotate · Scroll = zoom · Click = hangar/market'}
      </div>

      {selectedHangar && (
        <div className="absolute left-3 top-3 w-[360px] rounded-lg border border-cyan-700/50 bg-slate-950/95 p-3 text-xs text-cyan-100 shadow-xl">
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
            {lang === 'de' ? 'Verfügbare Tages-Aufträge' : 'Available daily contracts'}: {(contractsByHangar[selectedHangar.id] || []).length}
          </div>
          <div className="mt-1 max-h-44 overflow-y-auto space-y-1">
            {(contractsByHangar[selectedHangar.id] || []).slice(0, 8).map((contract) => (
              <div key={contract.id} className="rounded bg-slate-900/80 px-2 py-1">
                {contract.departure_airport} → {contract.arrival_airport} · ${Math.round(contract.payout || 0).toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedMarketAirport && (
        <div className="absolute right-3 top-3 w-[340px] rounded-lg border border-amber-700/50 bg-slate-950/95 p-3 text-xs text-amber-100 shadow-xl">
          <div className="font-mono text-amber-300 uppercase">
            {selectedMarketAirport.airport_icao} · {selectedMarketAirport.label}
          </div>
          <div className="mt-1 text-[11px] text-amber-200">
            {lang === 'de'
              ? 'Hier siehst du den 3D-Hangar-Markt. Wähle Größe unten und kaufe den Standort.'
              : 'This location is part of the 3D hangar market. Pick a size below and buy this base.'}
          </div>
        </div>
      )}
    </div>
  );
}
