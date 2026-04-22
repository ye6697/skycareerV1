import React, { useEffect, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Globe2, MountainSnow, Route, Satellite } from "lucide-react";
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Marker,
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
  html: `<div style="width:14px;height:14px;border-radius:999px;background:#00d4ff;border:2px solid #05323f;box-shadow:0 0 10px rgba(0,212,255,.75)"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const arrivalIcon = new L.DivIcon({
  html: `<div style="width:14px;height:14px;border-radius:999px;background:#ffb703;border:2px solid #4f2a00;box-shadow:0 0 10px rgba(255,183,3,.75)"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const TYPE_COLORS = {
  passenger: "#00d4ff",
  cargo: "#fb8500",
  charter: "#d946ef",
  emergency: "#ef4444",
};

function getRouteColor(type) {
  return TYPE_COLORS[type] || "#5eead4";
}

function mapContractRoute(contract) {
  const departure = getAirportCoords(contract.departure_airport);
  const arrival = getAirportCoords(contract.arrival_airport);
  if (!departure || !arrival) return null;

  return {
    ...contract,
    departure,
    arrival,
    points: [
      [departure.lat, departure.lon],
      [arrival.lat, arrival.lon],
    ],
  };
}

function FitToRoutes({ bounds, fitKey }) {
  const map = useMap();
  const lastFitKey = useRef(null);

  useEffect(() => {
    if (!bounds || !bounds.isValid()) return;
    if (lastFitKey.current === fitKey) return;

    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 6,
      animate: true,
      duration: 0.8,
    });
    lastFitKey.current = fitKey;
  }, [bounds, fitKey, map]);

  return null;
}

function MapClickCatcher({ onBackgroundClick }) {
  useMapEvents({
    click: () => {
      onBackgroundClick?.();
    },
  });
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
  embedded = false,
  lang = "de",
}) {
  const routes = useMemo(
    () => contracts.map(mapContractRoute).filter(Boolean).slice(0, 120),
    [contracts]
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
    if (!routes.length) return null;
    const sample = selectedRoute ? [selectedRoute] : routes.slice(0, 30);
    const points = [];
    sample.forEach((route) => {
      points.push([route.departure.lat, route.departure.lon]);
      points.push([route.arrival.lat, route.arrival.lon]);
    });
    return L.latLngBounds(points);
  }, [routes, selectedRoute]);

  const fitKey = selectedRoute
    ? `selected:${selectedRoute.id}:${routes.length}`
    : `all:${routes.length}`;

  const ownedSet = useMemo(
    () => new Set(hangars.map((hangar) => String(hangar?.airport_icao || "").toUpperCase())),
    [hangars]
  );

  const normalizedSelectedAirport = String(selectedAirportIcao || "").toUpperCase();

  if (!routes.length) {
    if (embedded) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-slate-900/95">
          <p className="text-sm text-slate-400">
            {lang === "de"
              ? "Keine Route mit bekannten Flughafenkoordinaten gefunden."
              : "No route with known airport coordinates found."}
          </p>
        </div>
      );
    }
    return (
      <Card className="h-full min-h-[420px] border border-cyan-900/40 bg-slate-950/90 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-cyan-300" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
            {lang === "de" ? "Globale Vertragskarte" : "Global Contract Map"}
          </h3>
        </div>
        <div className="flex h-[340px] items-center justify-center rounded-xl border border-cyan-900/40 bg-slate-900/70">
          <p className="text-sm text-slate-400">
            {lang === "de"
              ? "Keine Route mit bekannten Flughafenkoordinaten gefunden."
              : "No route with known airport coordinates found."}
          </p>
        </div>
      </Card>
    );
  }

  const mapContent = (
    <>
      <MapContainer
        center={selectedRoute ? selectedRoute.points[0] : [47.3, 10.6]}
        zoom={4}
        style={{ width: "100%", height: "100%" }}
        zoomControl
        attributionControl
      >
        <FitToRoutes bounds={bounds} fitKey={fitKey} />
        <MapClickCatcher onBackgroundClick={onBackgroundClick} />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Topographic">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution="Map data &copy; OpenStreetMap contributors, SRTM"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Dark">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay checked name="Labels">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
              opacity={0.75}
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            />
          </LayersControl.Overlay>
        </LayersControl>

        {marketAirports.map((airport) => {
          if (!Number.isFinite(airport?.lat) || !Number.isFinite(airport?.lon)) return null;
          const icao = String(airport.airport_icao || "").toUpperCase();
          const owned = ownedSet.has(icao);
          const selected = normalizedSelectedAirport === icao;
          return (
            <CircleMarker
              key={`airport_${icao}`}
              center={[airport.lat, airport.lon]}
              radius={selected ? 5.5 : owned ? 4 : 2.3}
              pathOptions={{
                color: selected ? "#e2e8f0" : owned ? "#22d3ee" : "#f59e0b",
                weight: selected ? 2 : 1,
                fillColor: selected ? "#0ea5e9" : owned ? "#22d3ee" : "#f59e0b",
                fillOpacity: selected ? 0.9 : owned ? 0.8 : 0.4,
                opacity: selected ? 1 : 0.8,
              }}
              eventHandlers={{
                click: (event) => {
                  event.originalEvent?.stopPropagation?.();
                  onSelectAirport?.(icao);
                },
              }}
            />
          );
        })}

        {routes.map((route) => {
          const selected = route.id === selectedContractId;
          const color = getRouteColor(route.type);

          return (
            <Polyline
              key={route.id}
              positions={route.points}
              pathOptions={{
                color,
                weight: selected ? 5 : 2,
                opacity: selected ? 0.95 : 0.34,
                dashArray: selected ? undefined : "8 11",
              }}
              eventHandlers={{
                click: (event) => {
                  event.originalEvent?.stopPropagation?.();
                  onSelectContract?.(route.id);
                },
              }}
            />
          );
        })}

        {selectedRoute && (
          <>
            <Polyline
              positions={selectedRoute.points}
              pathOptions={{
                color: "#ffffff",
                weight: 8,
                opacity: 0.18,
              }}
            />
            <Marker position={selectedRoute.points[0]} icon={departureIcon}>
              <Tooltip direction="right" offset={[12, 0]} opacity={1}>
                <span className="font-mono text-xs font-semibold">
                  {selectedRoute.departure_airport}
                </span>
              </Tooltip>
            </Marker>
            <Marker position={selectedRoute.points[1]} icon={arrivalIcon}>
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
    return <div className="h-full w-full">{mapContent}</div>;
  }

  return (
    <Card className="h-full min-h-[420px] overflow-hidden border border-cyan-900/40 bg-slate-950/90">
      <div className="relative border-b border-cyan-900/40 p-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(6,182,212,.25),transparent_35%),radial-gradient(circle_at_95%_100%,rgba(14,116,144,.18),transparent_45%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-cyan-300" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100">
              {lang === "de" ? "Earth Mission Deck" : "Earth Mission Deck"}
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
              {lang === "de" ? "Satellit" : "Satellite"}
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
              ? "Klicke eine Route fuer Fokus"
              : "Click any route to focus"}
          </span>
        </div>
      </div>
    </Card>
  );
}
