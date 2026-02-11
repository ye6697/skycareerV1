import React, { useEffect, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const aircraftIcon = new L.DivIcon({
  html: `<div style="transform:rotate(var(--heading, 0deg));display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
    </svg>
  </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const depIcon = new L.DivIcon({
  html: `<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:3px solid #064e3b;box-shadow:0 0 8px #10b981;"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const arrIcon = new L.DivIcon({
  html: `<div style="background:#f59e0b;width:14px;height:14px;border-radius:50%;border:3px solid #78350f;box-shadow:0 0 8px #f59e0b;"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const waypointIcon = new L.DivIcon({
  html: `<div style="background:#8b5cf6;width:8px;height:8px;border-radius:50%;border:2px solid #4c1d95;"></div>`,
  className: '',
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

const routeWaypointIcon = new L.DivIcon({
  html: `<div style="background:#a78bfa;width:10px;height:10px;border-radius:2px;border:2px solid #6d28d9;transform:rotate(45deg);"></div>`,
  className: '',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

function MapUpdater({ center, zoom }) {
  const map = useMap();
  const prevCenter = useRef(center);
  useEffect(() => {
    if (center && (center[0] !== prevCenter.current?.[0] || center[1] !== prevCenter.current?.[1])) {
      map.panTo(center, { animate: true, duration: 1 });
      prevCenter.current = center;
    }
  }, [center, map]);
  return null;
}

function AircraftMarker({ position, heading }) {
  const markerRef = useRef(null);
  useEffect(() => {
    if (markerRef.current) {
      const el = markerRef.current.getElement();
      if (el) {
        const svg = el.querySelector('div');
        if (svg) svg.style.setProperty('--heading', `${heading || 0}deg`);
      }
    }
  }, [heading]);
  return <Marker ref={markerRef} position={position} icon={aircraftIcon} />;
}

export default function FlightMap({ flightData, contract, waypoints = [], routeWaypoints = [] }) {
  const hasPosition = flightData.latitude !== 0 || flightData.longitude !== 0;
  const hasDep = flightData.departure_lat !== 0 || flightData.departure_lon !== 0;
  const hasArr = flightData.arrival_lat !== 0 || flightData.arrival_lon !== 0;

  const depPos = hasDep ? [flightData.departure_lat, flightData.departure_lon] : null;
  const arrPos = hasArr ? [flightData.arrival_lat, flightData.arrival_lon] : null;
  const curPos = hasPosition ? [flightData.latitude, flightData.longitude] : null;

  // Determine which waypoints to use: live FMS waypoints take priority, then generated route waypoints
  const activeWaypoints = waypoints.length > 0 ? waypoints : routeWaypoints;

  // Build route line: departure -> waypoints -> arrival
  const routePoints = [];
  if (depPos) routePoints.push(depPos);
  if (activeWaypoints.length > 0) {
    activeWaypoints.forEach(wp => {
      if (wp.lat && wp.lon) routePoints.push([wp.lat, wp.lon]);
    });
  }
  if (arrPos) routePoints.push(arrPos);

  // Flown path: departure -> current pos
  const flownPoints = [];
  if (depPos) flownPoints.push(depPos);
  if (curPos) flownPoints.push(curPos);

  // Default center
  const center = curPos || depPos || [50, 10];

  if (!hasPosition && !hasDep && !hasArr) {
    return (
      <Card className="p-6 bg-slate-800/50 border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Navigation className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Live-Karte</h3>
        </div>
        <div className="h-48 bg-slate-900 rounded-lg flex items-center justify-center">
          <p className="text-slate-500 text-sm">Warte auf Positionsdaten von X-Plane...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-0 bg-slate-800/50 border-slate-700 overflow-hidden rounded-lg">
      <div className="p-3 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Live-Karte</h3>
        </div>
        <div className="flex items-center gap-2">
          {contract && (
            <Badge className="bg-slate-700 text-slate-300 text-xs">
              {contract.departure_airport} → {contract.arrival_airport}
            </Badge>
          )}
          {hasPosition && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
              {flightData.latitude.toFixed(3)}° / {flightData.longitude.toFixed(3)}°
            </Badge>
          )}
        </div>
      </div>
      <div className="h-[300px] sm:h-[350px] mt-2">
        <MapContainer
          center={center}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapUpdater center={center} />

          {/* Planned route (dashed) */}
          {routePoints.length >= 2 && (
            <Polyline
              positions={routePoints}
              pathOptions={{ color: '#6366f1', weight: 2, dashArray: '8, 8', opacity: 0.5 }}
            />
          )}

          {/* Flown path (solid) */}
          {flownPoints.length >= 2 && (
            <Polyline
              positions={flownPoints}
              pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.9 }}
            />
          )}

          {/* Departure */}
          {depPos && (
            <Marker position={depPos} icon={depIcon}>
              <Popup className="dark-popup">
                <span className="text-xs font-bold">{contract?.departure_airport || 'DEP'}</span>
              </Popup>
            </Marker>
          )}

          {/* Arrival */}
          {arrPos && (
            <Marker position={arrPos} icon={arrIcon}>
              <Popup className="dark-popup">
                <span className="text-xs font-bold">{contract?.arrival_airport || 'ARR'}</span>
              </Popup>
            </Marker>
          )}

          {/* Live FMS Waypoints */}
          {waypoints.filter(wp => wp.lat && wp.lon).map((wp, i) => (
            <Marker key={`fms-${i}`} position={[wp.lat, wp.lon]} icon={waypointIcon}>
              <Popup className="dark-popup">
                <span className="text-xs font-bold">{wp.name || `WPT ${i + 1}`}</span>
                {wp.alt > 0 && <span className="text-xs ml-1 text-slate-400">FL{Math.round(wp.alt / 100)}</span>}
              </Popup>
            </Marker>
          ))}

          {/* Generated Route Waypoints (shown only when no live FMS waypoints) */}
          {waypoints.length === 0 && routeWaypoints.filter(wp => wp.lat && wp.lon).map((wp, i) => (
            <Marker key={`route-${i}`} position={[wp.lat, wp.lon]} icon={routeWaypointIcon}>
              <Popup className="dark-popup">
                <div>
                  <span className="text-xs font-bold">{wp.name}</span>
                  {wp.alt > 0 && <span className="text-xs ml-1 text-slate-400"> FL{Math.round(wp.alt / 100)}</span>}
                  {wp.type && <div className="text-[10px] text-slate-400 mt-0.5">{wp.type.toUpperCase()}</div>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Aircraft position */}
          {curPos && (
            <AircraftMarker position={curPos} heading={flightData.heading} />
          )}
        </MapContainer>
      </div>

      {/* Info bar */}
      <div className="p-2 bg-slate-900/80 flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400">HDG {Math.round(flightData.heading || 0)}°</span>
        <span className="text-slate-400">ALT {Math.round(flightData.altitude || 0).toLocaleString()} ft</span>
        <span className="text-slate-400">GS {Math.round(flightData.speed || 0)} kts</span>
        {activeWaypoints.length > 0 && (
          <span className="text-purple-400">
            {activeWaypoints.length} WPTs
            {waypoints.length === 0 && routeWaypoints.length > 0 && ' (Route)'}
          </span>
        )}
      </div>
    </Card>
  );
}