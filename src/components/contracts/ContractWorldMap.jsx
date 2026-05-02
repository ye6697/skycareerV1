import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Globe2, MountainSnow, Route, Satellite } from "lucide-react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getAirportCoords } from "@/utils/airportCoordinates";

const departureIcon = new L.DivIcon({
  html: `<div style="width:14px;height:14px;border-radius:999px;background:#22d3ee;border:2px solid #082f49;box-shadow:0 0 10px rgba(34,211,238,.8)"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const arrivalIcon = new L.DivIcon({
  html: `<div style="width:14px;height:14px;border-radius:999px;background:#f59e0b;border:2px solid #451a03;box-shadow:0 0 10px rgba(245,158,11,.75)"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const DIFFICULTY_COLORS = {
  easy: "#22d3ee",
  medium: "#22d3ee",
  hard: "#f59e0b",
  extreme: "#f87171",
};

function getRouteColor(contract) {
  const diff = String(contract?.difficulty || "medium").toLowerCase();
  return DIFFICULTY_COLORS[diff] || "#22d3ee";
}

// Build a "LIVE MAP" style ICAO bubble icon with pulse ring.
// Large pill with the ICAO code text, glowing border and animated halo.
function buildIcaoBubbleIcon({ icao, owned, selected }) {
  const ringColor = selected ? "#e2e8f0" : owned ? "#22c55e" : "#22d3ee";
  const textColor = selected ? "#ffffff" : owned ? "#bbf7d0" : "#cffafe";
  const borderColor = selected ? "rgba(226,232,240,0.95)" : owned ? "rgba(34,197,94,0.85)" : "rgba(34,211,238,0.85)";
  const bg = selected ? "rgba(8,47,73,0.9)" : "rgba(2,6,23,0.78)";
  const glow = selected ? "0 0 18px rgba(56,189,248,0.7)" : owned ? "0 0 14px rgba(34,197,94,0.55)" : "0 0 14px rgba(34,211,238,0.45)";
  const html = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;pointer-events:auto;">
      <div style="position:absolute;inset:-10px;border-radius:999px;border:1.5px solid ${ringColor};opacity:0.55;animation:icaoPulse 2.2s ease-out infinite;"></div>
      <div style="position:relative;padding:4px 10px;border-radius:999px;background:${bg};border:1.5px solid ${borderColor};color:${textColor};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;font-weight:700;letter-spacing:0.06em;box-shadow:${glow};white-space:nowrap;">
        ${icao}
      </div>
    </div>
  `;
  return new L.DivIcon({
    html,
    className: "icao-bubble-icon",
    iconSize: [60, 28],
    iconAnchor: [30, 14],
  });
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toDegrees(value) {
  return (value * 180) / Math.PI;
}

function interpolateGreatCircle(departure, arrival, segments = 56) {
  const lat1 = toRadians(departure.lat);
  const lon1 = toRadians(departure.lon);
  const lat2 = toRadians(arrival.lat);
  const lon2 = toRadians(arrival.lon);

  const start = [
    Math.cos(lat1) * Math.cos(lon1),
    Math.cos(lat1) * Math.sin(lon1),
    Math.sin(lat1),
  ];
  const end = [
    Math.cos(lat2) * Math.cos(lon2),
    Math.cos(lat2) * Math.sin(lon2),
    Math.sin(lat2),
  ];

  const dot = Math.min(1, Math.max(-1, start[0] * end[0] + start[1] * end[1] + start[2] * end[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) {
    return [
      [departure.lat, departure.lon],
      [arrival.lat, arrival.lon],
    ];
  }

  const sinOmega = Math.sin(omega);
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const a = Math.sin((1 - t) * omega) / sinOmega;
    const b = Math.sin(t * omega) / sinOmega;
    const x = a * start[0] + b * end[0];
    const y = a * start[1] + b * end[1];
    const z = a * start[2] + b * end[2];
    const lat = toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lon = toDegrees(Math.atan2(y, x));
    points.push([lat, lon]);
  }

  return points;
}

function resolvePoint(contract, prefix, airportByIcao) {
  const latKey = `${prefix}_lat`;
  const lonKey = `${prefix}_lon`;
  const directLat = Number(contract?.[latKey]);
  const directLon = Number(contract?.[lonKey]);
  if (Number.isFinite(directLat) && Number.isFinite(directLon)) {
    return { lat: directLat, lon: directLon };
  }

  const icaoKey = prefix === "dep" ? "departure_airport" : "arrival_airport";
  const icao = String(contract?.[icaoKey] || "").toUpperCase();
  const known = getAirportCoords(icao);
  if (known) return known;
  return airportByIcao.get(icao) || null;
}

function mapContractRoute(contract, airportByIcao) {
  const departure = resolvePoint(contract, "dep", airportByIcao);
  const arrival = resolvePoint(contract, "arr", airportByIcao);
  if (!departure || !arrival) return null;

  return {
    ...contract,
    departure,
    arrival,
    points: interpolateGreatCircle(departure, arrival),
  };
}

function FitToRoutes({ bounds, fitKey }) {
  const map = useMap();
  const lastFitKey = useRef(null);

  useEffect(() => {
    if (!bounds || !bounds.isValid()) return;
    if (lastFitKey.current === fitKey) return;

    map.fitBounds(bounds, {
      padding: [56, 56],
      maxZoom: 8,
      animate: true,
      duration: 0.75,
    });
    lastFitKey.current = fitKey;
  }, [bounds, fitKey, map]);

  return null;
}

function FocusAirport({ selectedAirportIcao, airportByIcao }) {
  const map = useMap();
  const lastIcaoRef = useRef("");

  useEffect(() => {
    const icao = String(selectedAirportIcao || "").toUpperCase();
    if (!icao || lastIcaoRef.current === icao) return;
    const point = airportByIcao.get(icao);
    if (!point) return;
    map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 6), {
      animate: true,
      duration: 0.7,
    });
    lastIcaoRef.current = icao;
  }, [airportByIcao, map, selectedAirportIcao]);

  return null;
}

function MapClickCatcher({ onBackgroundClick, suppressBackgroundClickUntilRef }) {
  useMapEvents({
    click: () => {
      if ((suppressBackgroundClickUntilRef?.current || 0) > Date.now()) {
        return;
      }
      onBackgroundClick?.();
    },
  });
  return null;
}

function MapZoomTracker({ onZoomChange }) {
  const map = useMap();

  useEffect(() => {
    const syncZoom = () => onZoomChange?.(map.getZoom());
    syncZoom();
    map.on("zoom zoomend", syncZoom);
    return () => {
      map.off("zoom zoomend", syncZoom);
    };
  }, [map, onZoomChange]);

  return null;
}

export default function ContractWorldMap({
  contracts = [],
  hangars = [],
  marketAirports = [],
  selectedContractId = null,
  onSelectContract,
  selectedAirportIcao = "",
  onSelectAirport,
  onBackgroundClick,
  onOwnedHangarHubClick,
  airportViewFilter = "all",
  embedded = false,
  lang = "de",
}) {
  const airportByIcao = useMemo(() => {
    const map = new Map();
    marketAirports.forEach((airport) => {
      const icao = String(airport?.airport_icao || "").toUpperCase();
      const lat = Number(airport?.lat);
      const lon = Number(airport?.lon);
      if (!icao || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
      map.set(icao, { lat, lon });
    });
    return map;
  }, [marketAirports]);

  const routes = useMemo(
    () => contracts.map((contract) => mapContractRoute(contract, airportByIcao)).filter(Boolean).slice(0, 140),
    [airportByIcao, contracts]
  );

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedContractId) || null,
    [routes, selectedContractId]
  );

  const avgDistanceNm = useMemo(() => {
    if (!routes.length) return 0;
    const total = routes.reduce((sum, route) => sum + (route.distance_nm || 0), 0);
    return Math.round(total / routes.length);
  }, [routes]);

  const bounds = useMemo(() => {
    if (selectedRoute) {
      const points = selectedRoute.points.map(([lat, lon]) => [lat, lon]);
      return L.latLngBounds(points);
    }

    if (routes.length) {
      const sample = routes.slice(0, 36);
      const points = [];
      sample.forEach((route) => {
        points.push([route.departure.lat, route.departure.lon]);
        points.push([route.arrival.lat, route.arrival.lon]);
      });
      return L.latLngBounds(points);
    }

    if (marketAirports.length) {
      const points = marketAirports
        .filter((airport) => Number.isFinite(airport?.lat) && Number.isFinite(airport?.lon))
        .map((airport) => [airport.lat, airport.lon]);
      if (points.length >= 2) return L.latLngBounds(points);
    }

    return null;
  }, [marketAirports, routes, selectedRoute]);

  const fitKey = selectedRoute
    ? `selected:${selectedRoute.id}:${routes.length}`
    : routes.length
      ? `all:${routes.length}`
      : `airports:${marketAirports.length}`;

  const ownedSet = useMemo(
    () => new Set(hangars.map((hangar) => String(hangar?.airport_icao || "").toUpperCase())),
    [hangars]
  );

  const normalizedSelectedAirport = String(selectedAirportIcao || "").toUpperCase();
  const filteredAirports = useMemo(() => {
    if (airportViewFilter === "owned") {
      return marketAirports.filter((airport) => ownedSet.has(String(airport?.airport_icao || "").toUpperCase()));
    }
    return marketAirports;
  }, [airportViewFilter, marketAirports, ownedSet]);
  const suppressBackgroundClickUntilRef = useRef(0);
  const [mapZoom, setMapZoom] = useState(3);
  const markForegroundInteraction = () => {
    suppressBackgroundClickUntilRef.current = Date.now() + 320;
  };

  const mapContent = (
    <>
      <style>{`
        @keyframes icaoPulse {
          0% { transform: scale(0.85); opacity: 0.7; }
          70% { transform: scale(1.45); opacity: 0; }
          100% { transform: scale(1.45); opacity: 0; }
        }
        .icao-bubble-icon { background: transparent !important; border: none !important; }
        .contract-globe-leaflet {
          background: #020617;
        }
        .contract-globe-leaflet .leaflet-container {
          background: radial-gradient(circle at 20% 15%, rgba(14,116,144,.2), transparent 35%), #020617;
        }
        .contract-globe-leaflet .leaflet-tile {
          filter: saturate(0.85) contrast(1.15) brightness(0.55) hue-rotate(-4deg);
        }
        .contract-globe-leaflet .leaflet-control-zoom {
          border: 1px solid rgba(14, 116, 144, .55);
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 0 0 1px rgba(2,6,23,.55), 0 10px 24px rgba(2,6,23,.45);
        }
        .contract-globe-leaflet .leaflet-control-zoom a {
          background: rgba(2, 6, 23, 0.92);
          color: #cbd5e1;
          border-color: rgba(14, 116, 144, .55);
        }
        .contract-globe-leaflet .leaflet-control-attribution {
          background: rgba(2, 6, 23, 0.78);
          color: #94a3b8;
          border: 1px solid rgba(14,116,144,.32);
          border-radius: 8px;
          margin: 0 8px 8px 0;
          padding: 2px 6px;
        }
      `}</style>
      <MapContainer
        center={[25, 8]}
        zoom={3}
        minZoom={2}
        dragging
        scrollWheelZoom
        doubleClickZoom
        touchZoom
        boxZoom
        keyboard
        inertia
        style={{ width: "100%", height: "100%" }}
        className="contract-globe-leaflet"
        zoomControl
        attributionControl
        worldCopyJump
      >
        <FitToRoutes bounds={bounds} fitKey={fitKey} />
        <MapZoomTracker onZoomChange={(zoom) => setMapZoom(Number(zoom) || 3)} />
        <FocusAirport selectedAirportIcao={selectedAirportIcao} airportByIcao={airportByIcao} />
        <MapClickCatcher
          onBackgroundClick={onBackgroundClick}
          suppressBackgroundClickUntilRef={suppressBackgroundClickUntilRef}
        />

        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          opacity={0.58}
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          opacity={0.26}
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        />

        <Pane name="routeGlow" style={{ zIndex: 510 }} />
        <Pane name="airportDots" style={{ zIndex: 560 }} />

        {routes.map((route) => {
          const selected = route.id === selectedContractId;
          const color = getRouteColor(route);
          return (
            <React.Fragment key={route.id}>
              <Polyline
                pane="routeGlow"
                positions={route.points}
                bubblingMouseEvents={false}
                pathOptions={{
                  color,
                  weight: selected ? 10 : 6,
                  opacity: selected ? 0.22 : 0.1,
                }}
                eventHandlers={{
                  mousedown: markForegroundInteraction,
                  touchstart: markForegroundInteraction,
                }}
              />
              <Polyline
                positions={route.points}
                bubblingMouseEvents={false}
                pathOptions={{
                  color,
                  weight: selected ? 4.8 : 2.1,
                  opacity: selected ? 0.98 : 0.42,
                  dashArray: selected ? undefined : "7 10",
                }}
                eventHandlers={{
                  mousedown: markForegroundInteraction,
                  touchstart: markForegroundInteraction,
                  click: (event) => {
                    event.originalEvent?.stopPropagation?.();
                    markForegroundInteraction();
                    onSelectContract?.(route.id);
                  },
                }}
              />
            </React.Fragment>
          );
        })}

        <Pane name="airports" style={{ zIndex: 580 }}>
          {filteredAirports.map((airport) => {
            if (!Number.isFinite(airport?.lat) || !Number.isFinite(airport?.lon)) return null;
            const icao = String(airport.airport_icao || "").toUpperCase();
            const owned = ownedSet.has(icao);
            const selected = normalizedSelectedAirport === icao;
            return (
              <Marker
                key={`airport_${icao}`}
                position={[airport.lat, airport.lon]}
                icon={buildIcaoBubbleIcon({ icao, owned, selected })}
                bubblingMouseEvents={false}
                eventHandlers={{
                  mousedown: markForegroundInteraction,
                  touchstart: markForegroundInteraction,
                  click: (event) => {
                    event.originalEvent?.stopPropagation?.();
                    markForegroundInteraction();
                    onSelectAirport?.(icao);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -16]} opacity={1}>
                  <span className="font-mono text-[11px] font-semibold">
                    {icao} {owned ? "· Owned" : "· Market"}
                  </span>
                </Tooltip>
              </Marker>
            );
          })}
        </Pane>

        <Pane name="hangarHub" style={{ zIndex: 900 }}>
          <Marker
            position={[80, -170]}
            interactive
            icon={new L.DivIcon({
              html: `<button type="button" style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:rgba(2,6,23,.9);border:1px solid rgba(34,211,238,.7);color:#67e8f9;font-size:16px;cursor:pointer;box-shadow:0 8px 18px rgba(2,6,23,.45)">⌂</button>`,
              className: "",
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            })}
            eventHandlers={{
              mousedown: markForegroundInteraction,
              touchstart: markForegroundInteraction,
              click: (event) => {
                event.originalEvent?.stopPropagation?.();
                markForegroundInteraction();
                onOwnedHangarHubClick?.();
              },
            }}
          />
        </Pane>

        {selectedRoute && (
          <>
            <Polyline
              positions={selectedRoute.points}
              pathOptions={{
                color: "#ffffff",
                weight: 7,
                opacity: 0.14,
              }}
            />
            <Marker position={selectedRoute.points[0]} icon={departureIcon}>
              <Tooltip direction="right" offset={[12, 0]} opacity={1}>
                <span className="font-mono text-xs font-semibold">
                  {selectedRoute.departure_airport}
                </span>
              </Tooltip>
            </Marker>
            <Marker position={selectedRoute.points[selectedRoute.points.length - 1]} icon={arrivalIcon}>
              <Tooltip direction="right" offset={[12, 0]} opacity={1}>
                <span className="font-mono text-xs font-semibold">
                  {selectedRoute.arrival_airport}
                </span>
              </Tooltip>
            </Marker>
          </>
        )}
      </MapContainer>
    </>
  );

  if (embedded) {
    return (
      <div className="relative h-full w-full">
        {mapContent}
        <div className="pointer-events-none absolute left-3 top-3 z-[600]">
          <div className="flex items-center gap-1.5 rounded-md border-2 border-cyan-400/70 bg-slate-950/85 px-3 py-1.5 shadow-[0_0_18px_rgba(34,211,238,0.35)]">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200">
              {lang === "de" ? "LIVE MAP" : "LIVE MAP"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="h-full min-h-[420px] overflow-hidden border border-cyan-900/40 bg-slate-950/90">
      <div className="relative border-b border-cyan-900/40 p-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(6,182,212,.20),transparent_35%),radial-gradient(circle_at_95%_100%,rgba(14,116,144,.18),transparent_45%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-cyan-300" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100">
              {lang === "de" ? "Leaflet Mission Deck" : "Leaflet Mission Deck"}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="border-cyan-700/40 bg-cyan-950/60 text-[10px] font-mono text-cyan-100">
              <Route className="mr-1 h-3 w-3" />
              {routes.length} {lang === "de" ? "Routen" : "Routes"}
            </Badge>
            <Badge className="border-cyan-700/40 bg-cyan-950/60 text-[10px] font-mono text-cyan-100">
              AVG {avgDistanceNm} NM
            </Badge>
            <Badge className="border-cyan-700/40 bg-cyan-950/60 text-[10px] font-mono text-cyan-100">
              <Satellite className="mr-1 h-3 w-3" />
              {lang === "de" ? "Dunkles Satellite Theme" : "Dark satellite theme"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="h-[380px] lg:h-[470px]">
        {mapContent}
      </div>

      <div className="border-t border-cyan-900/40 bg-slate-950/80 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="inline-flex items-center gap-1 text-cyan-300">
            <Satellite className="h-3.5 w-3.5" />
            {lang === "de" ? "Echte Kartenbasis aktiv" : "Real map tiles active"}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-400">
            <MountainSnow className="h-3.5 w-3.5" />
            {lang === "de"
              ? "Klicke Airport oder Route"
              : "Click airport or route"}
          </span>
        </div>
      </div>
    </Card>
  );
}