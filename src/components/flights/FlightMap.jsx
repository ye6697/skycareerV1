import React, { useEffect, useRef, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import RouteCorridorAirports from './RouteCorridorAirports';

// Fix leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createAircraftIcon(heading) {
  const rotation = heading || 0;
  return new L.DivIcon({
    html: `<div style="transform:rotate(${rotation}deg);display:flex;align-items:center;justify-content:center;width:44px;height:44px;filter:drop-shadow(0 2px 6px rgba(59,130,246,0.6));">
      <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 8 L54 35 L80 55 L80 60 L54 48 L54 72 L65 80 L65 84 L50 78 L35 84 L35 80 L46 72 L46 48 L20 60 L20 55 L46 35 Z" fill="#3b82f6" stroke="#1e40af" stroke-width="1.5"/>
        <circle cx="50" cy="20" r="3" fill="#60a5fa"/>
      </svg>
    </div>`,
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

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

function MapController({ center, bounds }) {
  const map = useMap();
  const prevCenter = useRef(center);
  const hasSetBounds = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 50);
    const t2 = setTimeout(() => map.invalidateSize(), 200);
    const t3 = setTimeout(() => map.invalidateSize(), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [map]);

  useEffect(() => {
    if (bounds && !hasSetBounds.current) {
      hasSetBounds.current = true;
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    }
  }, [bounds, map]);

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
  const icon = React.useMemo(() => createAircraftIcon(heading), [heading]);
  
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setIcon(icon);
    }
  }, [icon]);

  return <Marker ref={markerRef} position={position} icon={icon} />;
}

// Haversine distance in NM
function distanceNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function FlightMap({ flightData, contract, waypoints = [], routeWaypoints = [], staticMode = false, title, flightPath = [], departureRunway = null, arrivalRunway = null }) {
  const fd = flightData || {};
  const hasPosition = fd.latitude !== 0 || fd.longitude !== 0;
  const hasDep = fd.departure_lat !== 0 || fd.departure_lon !== 0;
  const hasArr = fd.arrival_lat !== 0 || fd.arrival_lon !== 0;

  // Derive departure position: prefer X-Plane data, fallback to first routeWaypoint
  let depPos = hasDep ? [fd.departure_lat, fd.departure_lon] : null;
  if (!depPos && routeWaypoints.length > 0 && routeWaypoints[0].lat && routeWaypoints[0].lon) {
    depPos = [routeWaypoints[0].lat, routeWaypoints[0].lon];
  }

  // Derive arrival position: prefer X-Plane data, fallback to last routeWaypoint
  let arrPos = hasArr ? [fd.arrival_lat, fd.arrival_lon] : null;
  if (!arrPos && routeWaypoints.length > 0) {
    const lastWp = routeWaypoints[routeWaypoints.length - 1];
    if (lastWp.lat && lastWp.lon) {
      arrPos = [lastWp.lat, lastWp.lon];
    }
  }

  const curPos = hasPosition ? [fd.latitude, fd.longitude] : null;

  // Use FMS waypoints from X-Plane only if they have valid coordinates
  const validWaypoints = waypoints.filter(wp => wp.lat && wp.lon);
  const validRouteWaypoints = routeWaypoints.filter(wp => wp.lat && wp.lon);
  const activeWaypoints = validWaypoints.length > 0 ? validWaypoints : validRouteWaypoints;

  // Planned route (dashed line) - ALWAYS connect dep -> waypoints -> arrival
  const routePoints = [];
  if (depPos) routePoints.push(depPos);
  activeWaypoints.forEach(wp => {
    routePoints.push([wp.lat, wp.lon]);
  });
  if (arrPos) routePoints.push(arrPos);

  // Actual flown path (solid line) - prefer recorded flight_path
  let flownPoints = [];
  if (flightPath && flightPath.length > 1) {
    flownPoints = flightPath;
  } else if (staticMode) {
    // In static mode without flight_path, use route as fallback
    flownPoints = routePoints;
  } else {
    // Live mode: dep -> current position
    if (depPos) flownPoints.push(depPos);
    if (curPos) flownPoints.push(curPos);
  }

  const center = curPos || depPos || [50, 10];

  let bounds = null;
  const allPoints = [...routePoints, ...flownPoints];
  if (curPos) allPoints.push(curPos);
  if (allPoints.length >= 2) {
    bounds = L.latLngBounds(allPoints);
  }

  // Calculate distance to next waypoint and to arrival (live mode)
  let distToNextWp = null;
  let nextWpName = null;
  let distToArrival = null;
  if (!staticMode && curPos) {
    // Find the next waypoint ahead by picking the closest unvisited one
    if (activeWaypoints.length > 0) {
      // Find the next waypoint: the one closest to current position that is roughly ahead
      let minDist = Infinity;
      for (const wp of activeWaypoints) {
        if (!wp.lat || !wp.lon) continue;
        const d = distanceNm(curPos[0], curPos[1], wp.lat, wp.lon);
        if (d < minDist) {
          minDist = d;
          nextWpName = wp.name || 'WPT';
          distToNextWp = d;
        }
      }
      // If closest wp is very close (<2nm), try the next further one
      if (distToNextWp < 2 && activeWaypoints.length > 1) {
        let secondMin = Infinity;
        for (const wp of activeWaypoints) {
          if (!wp.lat || !wp.lon) continue;
          const d = distanceNm(curPos[0], curPos[1], wp.lat, wp.lon);
          if (d > distToNextWp && d < secondMin) {
            secondMin = d;
            nextWpName = wp.name || 'WPT';
            distToNextWp = d;
          }
        }
      }
    }
    if (arrPos) {
      distToArrival = distanceNm(curPos[0], curPos[1], arrPos[0], arrPos[1]);
    }
  }

  if (!hasPosition && !depPos && !arrPos && routeWaypoints.length === 0) {
    return (
      <Card className="p-6 bg-slate-800/50 border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Navigation className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">{title || 'Karte'}</h3>
        </div>
        <div className="h-48 bg-slate-900 rounded-lg flex items-center justify-center">
          <p className="text-slate-500 text-sm">Keine Positionsdaten verfügbar</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 overflow-hidden rounded-lg">
      <div className="p-3 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">{title || (staticMode ? 'Flugroute' : 'Live-Karte')}</h3>
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

      <div className="mt-2" style={{ height: 350 }}>
        <MapContainer
          key="flight-map"
          center={center}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <MapController center={staticMode ? null : (curPos || null)} bounds={bounds} />

          {/* Planned route - dashed */}
          {routePoints.length >= 2 && (
            <Polyline positions={routePoints} pathOptions={{ color: '#6366f1', weight: 2, dashArray: '8, 8', opacity: 0.4 }} />
          )}
          
          {/* Actually flown path - solid */}
          {flownPoints.length >= 2 && (
            <Polyline positions={flownPoints} pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.9 }} />
          )}

          {depPos && (
            <Marker position={depPos} icon={depIcon}>
              <Tooltip permanent direction="bottom" offset={[0, 8]} className="waypoint-label">
                <span style={{fontSize:'11px',fontFamily:'monospace',fontWeight:'bold',color:'#10b981',background:'rgba(15,23,42,0.9)',padding:'2px 5px',borderRadius:'3px',border:'1px solid #064e3b'}}>
                  {contract?.departure_airport || 'DEP'}
                  {departureRunway ? ` RWY ${departureRunway}` : ''}
                </span>
              </Tooltip>
            </Marker>
          )}

          {arrPos && (
            <Marker position={arrPos} icon={arrIcon}>
              <Tooltip permanent direction="bottom" offset={[0, 8]} className="waypoint-label">
                <span style={{fontSize:'11px',fontFamily:'monospace',fontWeight:'bold',color:'#f59e0b',background:'rgba(15,23,42,0.9)',padding:'2px 5px',borderRadius:'3px',border:'1px solid #78350f'}}>
                  {contract?.arrival_airport || 'ARR'}
                  {arrivalRunway ? ` RWY ${arrivalRunway}` : ''}
                </span>
              </Tooltip>
            </Marker>
          )}

          {validWaypoints.map((wp, i) => (
            <Marker key={`fms-${i}`} position={[wp.lat, wp.lon]} icon={waypointIcon}>
              <Tooltip permanent direction="top" offset={[0, -8]} className="waypoint-label">
                <span style={{fontSize:'10px',fontFamily:'monospace',color:'#a78bfa',background:'rgba(15,23,42,0.85)',padding:'1px 4px',borderRadius:'3px',border:'1px solid #4c1d95'}}>
                  {wp.name || `WPT ${i+1}`}
                  {wp.alt > 0 && ` FL${Math.round(wp.alt/100)}`}
                </span>
              </Tooltip>
            </Marker>
          ))}

          {validWaypoints.length === 0 && validRouteWaypoints.map((wp, i) => (
            <Marker key={`route-${i}`} position={[wp.lat, wp.lon]} icon={routeWaypointIcon}>
              <Tooltip permanent direction="top" offset={[0, -8]} className="waypoint-label">
                <span style={{fontSize:'10px',fontFamily:'monospace',color:'#c4b5fd',background:'rgba(15,23,42,0.85)',padding:'1px 4px',borderRadius:'3px',border:'1px solid #6d28d9'}}>
                  {wp.name}
                  {wp.alt > 0 && ` FL${Math.round(wp.alt/100)}`}
                </span>
              </Tooltip>
            </Marker>
          ))}

          {/* Nearby airports along route corridor (100nm wide) */}
          {depPos && arrPos && (
            <RouteCorridorAirports
              depLat={depPos[0]} depLon={depPos[1]}
              arrLat={arrPos[0]} arrLon={arrPos[1]}
              corridorWidthNm={100}
              depIcao={contract?.departure_airport}
              arrIcao={contract?.arrival_airport}
            />
          )}

          {/* Nearby airports around aircraft - live mode only */}
          {!staticMode && hasPosition && (
            <NearbyAirports latitude={fd.latitude} longitude={fd.longitude} radiusNm={100} />
          )}

          {curPos && !staticMode && <AircraftMarker position={curPos} heading={fd.heading} />}
        </MapContainer>
      </div>

      {!staticMode && (
        <div className="p-2 bg-slate-900/80 text-xs font-mono space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">HDG {Math.round(fd.heading || 0)}°</span>
            <span className="text-slate-400">ALT {Math.round(fd.altitude || 0).toLocaleString()} ft</span>
            <span className="text-slate-400">GS {Math.round(fd.speed || 0)} kts</span>
            {activeWaypoints.length > 0 && (
              <span className="text-slate-500">
                {activeWaypoints.length} WPTs
              </span>
            )}
          </div>
          {(distToNextWp !== null || distToArrival !== null) && (
            <div className="flex items-center justify-between border-t border-slate-700/50 pt-1">
              {distToNextWp !== null && (
                <span className="text-purple-400">
                  → {nextWpName}: <span className="font-bold">{Math.round(distToNextWp)} NM</span>
                </span>
              )}
              {distToArrival !== null && (
                <span className="text-amber-400 font-bold ml-auto">
                  {contract?.arrival_airport || 'ARR'}: <span className="font-bold">{Math.round(distToArrival)} NM</span> <span className="text-slate-500 font-normal">Luftlinie</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {staticMode && activeWaypoints.length > 0 && (
        <div className="p-2 bg-slate-900/80 flex items-center justify-center text-xs font-mono">
          <span className="text-purple-400">{activeWaypoints.length} Wegpunkte</span>
          {flightPath && flightPath.length > 1 && (
            <span className="text-blue-400 ml-4">{flightPath.length} GPS-Punkte</span>
          )}
        </div>
      )}
    </Card>
  );
}