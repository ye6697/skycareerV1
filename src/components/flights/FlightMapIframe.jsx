import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigation, Maximize2, Minimize2 } from 'lucide-react';

export default function FlightMapIframe({ flightData, contract, waypoints = [], routeWaypoints = [], staticMode = false, title, flightPath = [], departureRunway = null, arrivalRunway = null, departureCoords = null, arrivalCoords = null }) {
  const iframeRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [mapDistances, setMapDistances] = useState({ nextWpDist: null, nextWpName: null, arrDist: null });

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'flightmap-ready') {
        setIframeReady(true);
      }
      if (e.data?.type === 'flightmap-distances') {
        setMapDistances(e.data.payload);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Send data to iframe whenever props change
  useEffect(() => {
    if (!iframeReady || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({
      type: 'flightmap-update',
      payload: {
        flightData, contract, waypoints, routeWaypoints, staticMode,
        flightPath, departureRunway, arrivalRunway, departureCoords, arrivalCoords
      }
    }, '*');
  }, [iframeReady, flightData, contract, waypoints, routeWaypoints, staticMode, flightPath, departureRunway, arrivalRunway, departureCoords, arrivalCoords]);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen]);

  // Notify iframe of size change
  useEffect(() => {
    if (!iframeReady || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({ type: 'flightmap-resize' }, '*');
  }, [isFullscreen, iframeReady]);

  const fd = flightData || {};
  const hasPosition = fd.latitude !== 0 || fd.longitude !== 0;
  const validWaypoints = (waypoints || []).filter(wp => wp.lat && wp.lon);

  const iframeSrc = buildIframeHtml();

  return (
    <Card className={`bg-slate-800/50 border-slate-700 overflow-hidden rounded-lg ${isFullscreen ? 'fixed inset-0 z-[9999] bg-slate-900 flex flex-col' : ''}`} style={isFullscreen ? { borderRadius: 0 } : {}}>
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
          {validWaypoints.length > 0 && (
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
              FMS Route ({validWaypoints.length} WPTs)
            </Badge>
          )}
          {hasPosition && !isFullscreen && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
              {fd.latitude.toFixed(3)}° / {fd.longitude.toFixed(3)}°
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-700"
            onClick={() => setIsFullscreen(prev => !prev)}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="mt-2" style={{ height: isFullscreen ? 'calc(100vh - 100px)' : 350 }}>
        <iframe
          ref={iframeRef}
          srcDoc={iframeSrc}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title="Flight Map"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      {!staticMode && (
        <div className="p-2 bg-slate-900/80 text-xs font-mono space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">HDG {Math.round(fd.heading || 0)}°</span>
            <span className="text-slate-400">ALT {Math.round(fd.altitude || 0).toLocaleString()} ft</span>
            <span className="text-slate-400">GS {Math.round(fd.speed || 0)} kts</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-800 pt-1">
            <span className="text-purple-400">
              {mapDistances.nextWpDist !== null 
                ? `▸ ${mapDistances.nextWpName}: ${mapDistances.nextWpDist} NM` 
                : '—'}
            </span>
            <span className="text-amber-400">
              {mapDistances.arrDist !== null 
                ? `ARR: ${mapDistances.arrDist} NM` 
                : '—'}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

function buildIframeHtml() {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #0f172a; }
  #map { width: 100%; height: 100%; }
  .leaflet-container { background: #0f172a !important; }
  .wpl { font-size:10px; font-family:monospace; padding:1px 4px; border-radius:3px; background:rgba(15,23,42,0.85); white-space:nowrap; }
  .wpl-dep { font-size:12px; font-weight:bold; color:#10b981; border:1px solid #064e3b; box-shadow:0 0 8px rgba(16,185,129,0.3); padding:3px 7px; border-radius:4px; }
  .wpl-arr { font-size:12px; font-weight:bold; color:#f59e0b; border:1px solid #78350f; box-shadow:0 0 8px rgba(245,158,11,0.3); padding:3px 7px; border-radius:4px; }
  .wpl-fms { color:#a78bfa; border:1px solid #4c1d95; }
  .wpl-fms-active { color:#f472b6; border:1px solid #be185d; box-shadow:0 0 6px rgba(244,114,182,0.4); }
  .wpl-route { color:#c4b5fd; border:1px solid #6d28d9; }
  .leaflet-tooltip.clean-tooltip { background:transparent !important; border:none !important; box-shadow:none !important; padding:0 !important; }
  .leaflet-tooltip.clean-tooltip::before { display:none !important; }
</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map', { zoomControl: false, attributionControl: false, tap: true }).setView([50, 10], 5);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);

var layers = { route: null, routeGlow: null, flown: null, dep: null, arr: null, aircraft: null, wpGroup: L.layerGroup().addTo(map), corridorGroup: L.layerGroup().addTo(map) };
var boundsSet = false;
var userInteracting = false;
var interactionTimeout = null;
var INTERACTION_COOLDOWN = 15000; // 15 seconds before auto-pan resumes

map.on('dragstart zoomstart', function() {
  userInteracting = true;
  if (interactionTimeout) clearTimeout(interactionTimeout);
  interactionTimeout = setTimeout(function() { userInteracting = false; }, INTERACTION_COOLDOWN);
});

function makeIcon(bg, size, border, glow) {
  var shadow = glow ? 'box-shadow:0 0 12px '+bg+', 0 0 4px '+bg+';' : '';
  return L.divIcon({ html: '<div style="background:'+bg+';width:'+size+'px;height:'+size+'px;border-radius:50%;border:3px solid '+border+';'+shadow+'"></div>', className: '', iconSize: [size, size], iconAnchor: [size/2, size/2] });
}

function makeAircraftIcon(hdg) {
  return L.divIcon({
    html: '<div style="transform:rotate('+(hdg||0)+'deg);display:flex;align-items:center;justify-content:center;width:44px;height:44px;filter:drop-shadow(0 2px 6px rgba(59,130,246,0.6));"><svg width="40" height="40" viewBox="0 0 100 100" fill="none"><path d="M50 8 L54 35 L80 55 L80 60 L54 48 L54 72 L65 80 L65 84 L50 78 L35 84 L35 80 L46 72 L46 48 L20 60 L20 55 L46 35 Z" fill="#3b82f6" stroke="#1e40af" stroke-width="1.5"/><circle cx="50" cy="20" r="3" fill="#60a5fa"/></svg></div>',
    className: '', iconSize: [44, 44], iconAnchor: [22, 22]
  });
}

var depIcon = makeIcon('#10b981', 18, '#064e3b', true);
var arrIcon = makeIcon('#f59e0b', 18, '#78350f', true);

function wpIcon(active) {
  if (active) return L.divIcon({ html: '<div style="background:#f472b6;width:12px;height:12px;border-radius:50%;border:2px solid #be185d;box-shadow:0 0 8px #f472b6;"></div>', className:'', iconSize:[12,12], iconAnchor:[6,6] });
  return L.divIcon({ html: '<div style="background:#8b5cf6;width:8px;height:8px;border-radius:50%;border:2px solid #4c1d95;"></div>', className:'', iconSize:[8,8], iconAnchor:[4,4] });
}

var routeWpIcon = L.divIcon({ html: '<div style="background:#a78bfa;width:10px;height:10px;border-radius:2px;border:2px solid #6d28d9;transform:rotate(45deg);"></div>', className:'', iconSize:[10,10], iconAnchor:[5,5] });

function update(d) {
  var fd = d.flightData || {};
  var contract = d.contract;
  var waypoints = (d.waypoints || []).filter(function(w){return w.lat && w.lon;});
  var routeWaypoints = (d.routeWaypoints || []).filter(function(w){return w.lat && w.lon;});
  var flightPath = d.flightPath || [];
  var staticMode = d.staticMode;
  var depCoords = d.departureCoords;
  var arrCoords = d.arrivalCoords;
  var depRwy = d.departureRunway;
  var arrRwy = d.arrivalRunway;

  var hasPos = fd.latitude !== 0 || fd.longitude !== 0;
  var hasDep = fd.departure_lat !== 0 || fd.departure_lon !== 0;
  var hasArr = fd.arrival_lat !== 0 || fd.arrival_lon !== 0;

  var depPos = null;
  if (depCoords && depCoords.lat && depCoords.lon) depPos = [depCoords.lat, depCoords.lon];
  else if (hasDep) depPos = [fd.departure_lat, fd.departure_lon];
  else if (routeWaypoints.length > 0) depPos = [routeWaypoints[0].lat, routeWaypoints[0].lon];

  var arrPos = null;
  if (arrCoords && arrCoords.lat && arrCoords.lon) arrPos = [arrCoords.lat, arrCoords.lon];
  else if (hasArr) arrPos = [fd.arrival_lat, fd.arrival_lon];
  else if (routeWaypoints.length > 0) { var lw = routeWaypoints[routeWaypoints.length-1]; if(lw.lat&&lw.lon) arrPos=[lw.lat,lw.lon]; }

  var curPos = hasPos ? [fd.latitude, fd.longitude] : null;
  var activeWps = waypoints.length > 0 ? waypoints : routeWaypoints;

  // Route line
  var rp = [];
  if (depPos) rp.push(depPos);
  activeWps.forEach(function(w){ rp.push([w.lat, w.lon]); });
  if (arrPos) rp.push(arrPos);

  if (layers.routeGlow) map.removeLayer(layers.routeGlow);
  if (layers.route) map.removeLayer(layers.route);
  if (rp.length >= 2) {
    layers.routeGlow = L.polyline(rp, { color:'#818cf8', weight:6, dashArray:'8,8', opacity:0.15 }).addTo(map);
    layers.route = L.polyline(rp, { color:'#818cf8', weight:3, dashArray:'10,8', opacity:0.7 }).addTo(map);
  }

  // Flown path
  var fp = [];
  if (flightPath && flightPath.length > 1) fp = flightPath;
  else if (staticMode) fp = rp;
  else { if(depPos) fp.push(depPos); if(curPos) fp.push(curPos); }

  if (layers.flown) map.removeLayer(layers.flown);
  if (fp.length >= 2) {
    layers.flown = L.polyline(fp, { color:'#3b82f6', weight:3, opacity:0.9 }).addTo(map);
  }

  // Departure marker
  if (layers.dep) map.removeLayer(layers.dep);
  if (depPos) {
    layers.dep = L.marker(depPos, { icon: depIcon }).addTo(map);
    var depLabel = (contract?.departure_airport||'DEP') + (depRwy ? ' / '+depRwy : '');
    layers.dep.bindTooltip('<span class="wpl wpl-dep">'+depLabel+'</span>', { permanent:true, direction:'bottom', offset:[0,10], className:'clean-tooltip' });
  }

  // Arrival marker
  if (layers.arr) map.removeLayer(layers.arr);
  if (arrPos) {
    layers.arr = L.marker(arrPos, { icon: arrIcon }).addTo(map);
    var arrLabel = (contract?.arrival_airport||'ARR') + (arrRwy ? ' / '+arrRwy : '');
    layers.arr.bindTooltip('<span class="wpl wpl-arr">'+arrLabel+'</span>', { permanent:true, direction:'bottom', offset:[0,10], className:'clean-tooltip' });
  }

  // Waypoints
  layers.wpGroup.clearLayers();
  if (waypoints.length > 0) {
    waypoints.forEach(function(wp, i) {
      var m = L.marker([wp.lat, wp.lon], { icon: wpIcon(wp.is_active) }).addTo(layers.wpGroup);
      var cls = wp.is_active ? 'wpl wpl-fms-active' : 'wpl wpl-fms';
      var txt = (wp.is_active ? '▸ ' : '') + (wp.name || 'WPT '+(i+1)) + (wp.alt > 0 ? ' FL'+Math.round(wp.alt/100) : '');
      m.bindTooltip('<span class="'+cls+'">'+txt+'</span>', { permanent:true, direction:'top', offset:[0,-8], className:'clean-tooltip' });
    });
  } else {
    routeWaypoints.forEach(function(wp, i) {
      var m = L.marker([wp.lat, wp.lon], { icon: routeWpIcon }).addTo(layers.wpGroup);
      var txt = wp.name + (wp.alt > 0 ? ' FL'+Math.round(wp.alt/100) : '');
      m.bindTooltip('<span class="wpl wpl-route">'+txt+'</span>', { permanent:true, direction:'top', offset:[0,-8], className:'clean-tooltip' });
    });
  }

  // Aircraft
  if (layers.aircraft) map.removeLayer(layers.aircraft);
  if (curPos && !staticMode) {
    layers.aircraft = L.marker(curPos, { icon: makeAircraftIcon(fd.heading) }).addTo(map);
  }

  // Fit bounds once
  var allPts = rp.concat(fp);
  if (curPos) allPts.push(curPos);
  if (!boundsSet && allPts.length >= 2) {
    boundsSet = true;
    map.fitBounds(L.latLngBounds(allPts), { padding:[40,40], maxZoom:10 });
  } else if (curPos && !staticMode && !userInteracting) {
    map.panTo(curPos, { animate:true, duration:1 });
  }

  // Calculate distances for bottom bar
  var distInfo = { nextWpDist: null, nextWpName: null, arrDist: null };
  if (curPos) {
    // Distance to arrival
    if (arrPos) {
      distInfo.arrDist = haversineNm(curPos[0], curPos[1], arrPos[0], arrPos[1]);
    }
    // Distance to next (active or nearest upcoming) waypoint
    var wps = waypoints.length > 0 ? waypoints : routeWaypoints;
    if (wps.length > 0) {
      // Find active waypoint or nearest ahead
      var activeWp = wps.find(function(w) { return w.is_active; });
      if (!activeWp) {
        // Find nearest waypoint ahead (closest that is further than 1nm)
        var minD = Infinity;
        wps.forEach(function(w) {
          var d = haversineNm(curPos[0], curPos[1], w.lat, w.lon);
          if (d < minD && d > 1) { minD = d; activeWp = w; }
        });
      }
      if (activeWp) {
        distInfo.nextWpDist = haversineNm(curPos[0], curPos[1], activeWp.lat, activeWp.lon);
        distInfo.nextWpName = activeWp.name || 'WPT';
      }
    }
  }
  // Send distance info back to parent
  parent.postMessage({ type: 'flightmap-distances', payload: distInfo }, '*');
}

function haversineNm(lat1, lon1, lat2, lon2) {
  var R = 3440.065;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}

window.addEventListener('message', function(e) {
  if (e.data?.type === 'flightmap-update') update(e.data.payload);
  if (e.data?.type === 'flightmap-resize') setTimeout(function(){ map.invalidateSize(); }, 100);
});

parent.postMessage({ type: 'flightmap-ready' }, '*');
<\/script>
</body></html>`;
}