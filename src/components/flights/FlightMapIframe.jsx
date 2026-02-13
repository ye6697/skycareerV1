import React, { useRef, useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigation, Maximize2, Minimize2, Compass, Map } from 'lucide-react';

export default function FlightMapIframe({ 
  flightData, contract, waypoints = [], routeWaypoints = [], 
  staticMode = false, title, flightPath = [], 
  departureRunway = null, arrivalRunway = null, 
  departureCoords = null, arrivalCoords = null,
  liveFlightData = null,
  onViewModeChange = null,
}) {
  const iframeRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [mapDistances, setMapDistances] = useState({ nextWpDist: null, nextWpName: null, arrDist: null });
  const [viewMode, setViewMode] = useState('fplan');
  const viewModeRef = useRef('fplan');

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'flightmap-ready') setIframeReady(true);
      if (e.data?.type === 'flightmap-distances') setMapDistances(e.data.payload);
      if (e.data?.type === 'flightmap-viewmode' && onViewModeChange) onViewModeChange(e.data.viewMode);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onViewModeChange]);

  // Full data update - in ARC mode, throttle layer rebuilds but ALWAYS send on mode switch
  const lastFullUpdateRef = useRef(0);
  const prevViewModeRef = useRef('fplan');
  useEffect(() => {
    if (!iframeReady || !iframeRef.current?.contentWindow) return;
    
    const modeJustSwitched = viewMode !== prevViewModeRef.current;
    prevViewModeRef.current = viewMode;
    
    // In ARC mode, throttle full updates to max 1 every 5 seconds
    // BUT always send immediately on mode switch so layers get built
    if (viewModeRef.current === 'arc' && !modeJustSwitched) {
      const now = Date.now();
      if (now - lastFullUpdateRef.current < 5000) return;
      lastFullUpdateRef.current = now;
    }
    
    iframeRef.current.contentWindow.postMessage({
      type: 'flightmap-update',
      payload: {
        flightData, contract, waypoints, routeWaypoints, staticMode,
        flightPath, departureRunway, arrivalRunway, departureCoords, arrivalCoords,
        viewMode, liveFlightData
      }
    }, '*');
  }, [iframeReady, flightData, contract, waypoints, routeWaypoints, staticMode, flightPath, departureRunway, arrivalRunway, departureCoords, arrivalCoords, viewMode, liveFlightData]);

  // Fast ARC position stream - sends lat/lon/heading immediately on any change
  useEffect(() => {
    if (!iframeReady || !iframeRef.current?.contentWindow) return;
    if (viewModeRef.current !== 'arc') return;
    if (!flightData.latitude && !flightData.longitude) return;
    
    iframeRef.current.contentWindow.postMessage({
      type: 'flightmap-arc-position',
      payload: {
        latitude: flightData.latitude,
        longitude: flightData.longitude,
        heading: flightData.heading,
        altitude: flightData.altitude,
        speed: flightData.speed,
        isFullscreen,
        timestamp: Date.now()
      }
    }, '*');
  }, [iframeReady, flightData.latitude, flightData.longitude, flightData.heading, flightData.altitude, flightData.speed, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen]);

  useEffect(() => {
    if (!iframeReady || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({ type: 'flightmap-resize', isFullscreen }, '*');
  }, [isFullscreen, iframeReady]);

  const fd = flightData || {};
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
              FMS ({validWaypoints.length} WPTs)
            </Badge>
          )}
          {!staticMode && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs font-mono ${viewMode === 'arc' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white border border-slate-600'}`}
              onClick={() => {
                const next = viewMode === 'fplan' ? 'arc' : 'fplan';
                setViewMode(next);
                viewModeRef.current = next;
              }}
            >
              {viewMode === 'arc' ? <Compass className="w-3.5 h-3.5 mr-1" /> : <Map className="w-3.5 h-3.5 mr-1" />}
              {viewMode === 'arc' ? 'ARC' : 'F-PLN'}
            </Button>
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

      <div className="mt-2 relative" style={{ height: isFullscreen ? 'calc(100vh - 50px)' : 350 }}>
        <iframe
          ref={iframeRef}
          srcDoc={iframeSrc}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title="Flight Map"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      {!staticMode && isFullscreen && (
        <div className="px-3 py-2 bg-slate-900/90 font-mono space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-cyan-400 font-semibold">HDG <span className="text-white">{String(Math.round(fd.heading || 0)).padStart(3, '0')}°</span></span>
            <span className="text-emerald-400 font-semibold">ALT <span className="text-white">{Math.round(fd.altitude || 0).toLocaleString()}</span> <span className="text-slate-500 text-xs">ft</span></span>
            <span className="text-emerald-400 font-semibold">GS <span className="text-white">{Math.round(fd.speed || 0)}</span> <span className="text-slate-500 text-xs">kts</span></span>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-slate-700/60 pt-1.5">
            <span className="text-purple-400 font-semibold">
              {mapDistances.nextWpDist !== null 
                ? `▸ ${mapDistances.nextWpName}: ${mapDistances.nextWpDist} NM` 
                : '—'}
            </span>
            <span className="text-amber-400 font-semibold">
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
  #map-wrapper { width: 100%; height: 100%; overflow: hidden; position: relative; }
  #map { width: 100%; height: 100%; position: relative; }
  #map.arc-mode { width: 300%; height: 300%; position: absolute; top: -100%; left: -100%; will-change: transform; }
  .leaflet-container { background: #0f172a !important; }
  .wpl { font-size:13px; font-family:'Courier New',monospace; padding:2px 6px; border-radius:4px; background:rgba(15,23,42,0.9); white-space:nowrap; letter-spacing:0.5px; }
  .wpl-dep { font-size:14px; font-weight:bold; color:#10b981; border:1px solid #064e3b; }
  .wpl-arr { font-size:14px; font-weight:bold; color:#f59e0b; border:1px solid #78350f; }
  .wpl-fms { color:#a78bfa; border:1px solid #4c1d95; }
  .wpl-fms-active { color:#22d3ee; border:1px solid #0891b2; box-shadow:0 0 8px rgba(34,211,238,0.5); font-weight:bold; }
  .wpl-fms-passed { color:#64748b; border:1px solid #334155; opacity:0.5; }
  .wpl-route { color:#c4b5fd; border:1px solid #6d28d9; }
  .leaflet-tooltip.clean-tooltip { background:transparent !important; border:none !important; box-shadow:none !important; padding:0 !important; }
  .leaflet-tooltip.clean-tooltip::before { display:none !important; }

  /* PFD-style HUD overlay */
  #hud-top { position:absolute; top:8px; left:50%; transform:translateX(-50%); z-index:1000; display:flex; gap:6px; pointer-events:none; }
  #hud-top .hud-cell { background:rgba(10,20,40,0.85); backdrop-filter:blur(8px); border:1px solid rgba(34,211,238,0.25); border-radius:6px; padding:4px 10px; display:flex; align-items:center; gap:6px; font-family:'Courier New',monospace; }
  #hud-top .hud-label { font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:1px; }
  #hud-top .hud-val { font-size:13px; font-weight:bold; }
  .hud-cyan { color:#22d3ee; }
  .hud-green { color:#34d399; }
  .hud-amber { color:#fbbf24; }
  .hud-red { color:#f87171; }

  /* Events overlay - bottom left inside map, moves to top-left in ARC mode */
  #events-overlay { position:absolute; bottom:12px; left:12px; z-index:1000; pointer-events:none; max-width:320px; }
  #events-overlay.arc-pos { bottom:auto; top:12px; }
  #events-overlay .ev-card { background:rgba(10,20,40,0.88); backdrop-filter:blur(12px); border:1px solid rgba(248,113,113,0.35); border-radius:8px; padding:10px 14px; font-family:'Courier New',monospace; }
  #events-overlay .ev-title { font-size:12px; color:#f87171; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:6px; display:flex; align-items:center; gap:5px; font-weight:bold; }
  #events-overlay .ev-item { font-size:13px; color:#fca5a5; padding:2px 0; display:flex; align-items:center; gap:6px; }
  #events-overlay .ev-detail { font-size:11px; color:#94a3b8; margin-left:11px; padding:1px 0; }
  #events-overlay .ev-dot { width:6px; height:6px; border-radius:50%; background:#f87171; flex-shrink:0; }

  /* ARC mode compass overlay */
  #arc-overlay { position:absolute; top:0; left:0; right:0; bottom:0; z-index:999; pointer-events:none; display:none; }
  #arc-overlay canvas { width:100%; height:100%; }
</style>
</head><body>
<div id="map-wrapper"><div id="map" class="normal-mode"></div></div>
<div id="hud-top" style="display:none;"></div>
<div id="events-overlay" style="display:none;"></div>
<div id="arc-overlay"><canvas id="arc-canvas"></canvas></div>
<script>
var map = L.map('map', { zoomControl: false, attributionControl: false, tap: true, center: [50, 10], zoom: 5, fadeAnimation: false, markerZoomAnimation: false, zoomAnimation: false });
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
// Force map to fill its container properly
setTimeout(function(){ map.invalidateSize(); }, 100);

var layers = { route: null, routeGlow: null, flown: null, dep: null, arr: null, aircraft: null, wpGroup: L.layerGroup().addTo(map), depRwyLine: null, arrRwyLine: null };
var boundsSet = false;
var userInteracting = false;
var interactionTimeout = null;
var INTERACTION_COOLDOWN = 15000;
var currentViewMode = 'fplan';
var prevViewMode = 'fplan';
var isFullscreen = false;
var arcAnimFrame = null;
var lastFd = {};
var lastCurPos = null;
var arcZoomLevel = 10;

map.on('dragstart', function() {
  if (currentViewMode === 'arc') return; // no drag interaction tracking in ARC
  userInteracting = true;
  if (interactionTimeout) clearTimeout(interactionTimeout);
  interactionTimeout = setTimeout(function() { userInteracting = false; }, INTERACTION_COOLDOWN);
});
map.on('zoomend', function() {
  if (currentViewMode === 'arc') {
    arcZoomLevel = map.getZoom();
    // Zoom changed – force recenter on next tick
    arcBaseLatLng = null;
    arcLastSetView = 0;
  }
});

function setArcDragLock(locked) {
  if (locked) {
    map.dragging.disable();
    map.touchZoom.enable();
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.disable();
    map.keyboard.disable();
  } else {
    map.dragging.enable();
    map.touchZoom.enable();
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
  }
}

// === ARC centering: CSS transform only, setView only on init/recenter ===
var arcCachedContainerSize = null;
var arcCachedShiftPx = 0;
var arcPxPerDegLat = 0;
var arcPxPerDegLon = 0;
var arcBaseLatLng = null;
var arcBasePx = null;
var arcMaxDriftPx = 250;
var arcTranslateX = 0;
var arcTranslateY = 0;
var arcOriginX = 50;
var arcOriginY = 50;

function arcRecalcProjection(curPos) {
  arcCachedContainerSize = map.getSize();
  var viewportH = arcCachedContainerSize.y / 3;
  arcCachedShiftPx = viewportH * (isFullscreen ? 0.45 : 0.40);
  arcBasePx = map.latLngToContainerPoint(L.latLng(curPos[0], curPos[1]));
  arcBaseLatLng = [curPos[0], curPos[1]];
  var testDeg = 0.01;
  var pxB = map.latLngToContainerPoint(L.latLng(curPos[0] + testDeg, curPos[1]));
  var pxC = map.latLngToContainerPoint(L.latLng(curPos[0], curPos[1] + testDeg));
  arcPxPerDegLat = (arcBasePx.y - pxB.y) / testDeg;
  arcPxPerDegLon = (pxC.x - arcBasePx.x) / testDeg;
  arcOriginX = (arcBasePx.x / arcCachedContainerSize.x) * 100;
  arcOriginY = (arcBasePx.y / arcCachedContainerSize.y) * 100;
  arcTranslateX = 0;
  arcTranslateY = 0;
}

function centerAircraftArc(curPos) {
  if (!arcBaseLatLng) {
    map.setView(curPos, map.getZoom(), { animate: false });
    arcCachedContainerSize = map.getSize();
    var viewportH = arcCachedContainerSize.y / 3;
    var shiftPx = viewportH * (isFullscreen ? 0.45 : 0.40);
    var centerPx = map.latLngToContainerPoint(map.getCenter());
    var newCenterPx = L.point(centerPx.x, centerPx.y - shiftPx);
    var newCenter = map.containerPointToLatLng(newCenterPx);
    map.setView(newCenter, map.getZoom(), { animate: false });
    arcRecalcProjection(curPos);
    return;
  }
  var dLat = curPos[0] - arcBaseLatLng[0];
  var dLon = curPos[1] - arcBaseLatLng[1];
  var dxPx = dLon * arcPxPerDegLon;
  var dyPx = -(dLat * arcPxPerDegLat);
  var driftSq = dxPx * dxPx + dyPx * dyPx;
  if (driftSq > arcMaxDriftPx * arcMaxDriftPx) {
    map.setView(curPos, map.getZoom(), { animate: false });
    var centerPx2 = map.latLngToContainerPoint(map.getCenter());
    var newCenterPx2 = L.point(centerPx2.x, centerPx2.y - arcCachedShiftPx);
    var newCenter2 = map.containerPointToLatLng(newCenterPx2);
    map.setView(newCenter2, map.getZoom(), { animate: false });
    arcRecalcProjection(curPos);
    return;
  }
  arcTranslateX = -dxPx;
  arcTranslateY = -dyPx;
}

function makeIcon(bg, size, border, glow) {
  var shadow = glow ? 'box-shadow:0 0 10px '+bg+';' : '';
  return L.divIcon({ html: '<div style="background:'+bg+';width:'+size+'px;height:'+size+'px;border-radius:50%;border:2px solid '+border+';'+shadow+'"></div>', className: '', iconSize: [size, size], iconAnchor: [size/2, size/2] });
}
function makeAircraftIcon(hdg) {
  var rot = hdg||0;
  if (currentViewMode === 'arc') {
    // ARC mode: larger icon (120px)
    return L.divIcon({
      html: '<div style="transform:rotate('+rot+'deg);display:flex;align-items:center;justify-content:center;width:120px;height:120px;filter:drop-shadow(0 0 18px rgba(34,211,238,0.8)) drop-shadow(0 0 40px rgba(34,211,238,0.35));"><svg width="108" height="108" viewBox="0 0 100 100" fill="none"><path d="M50 8 L54 35 L80 55 L80 60 L54 48 L54 72 L65 80 L65 84 L50 78 L35 84 L35 80 L46 72 L46 48 L20 60 L20 55 L46 35 Z" fill="#22d3ee" stroke="#67e8f9" stroke-width="1.5"/><circle cx="50" cy="20" r="4" fill="#a5f3fc"/></svg></div>',
      className: '', iconSize: [120, 120], iconAnchor: [60, 60]
    });
  }
  // F-PLN mode: normal size (52px)
  return L.divIcon({
    html: '<div style="transform:rotate('+rot+'deg);display:flex;align-items:center;justify-content:center;width:52px;height:52px;filter:drop-shadow(0 2px 8px rgba(34,211,238,0.5));"><svg width="46" height="46" viewBox="0 0 100 100" fill="none"><path d="M50 8 L54 35 L80 55 L80 60 L54 48 L54 72 L65 80 L65 84 L50 78 L35 84 L35 80 L46 72 L46 48 L20 60 L20 55 L46 35 Z" fill="#22d3ee" stroke="#0891b2" stroke-width="1.5"/><circle cx="50" cy="20" r="3" fill="#67e8f9"/></svg></div>',
    className: '', iconSize: [52, 52], iconAnchor: [26, 26]
  });
}
var depIcon = makeIcon('#10b981', 16, '#064e3b', true);
var arrIcon = makeIcon('#f59e0b', 16, '#78350f', true);

function wpIcon(active, passed) {
  if (passed) return L.divIcon({ html: '<div style="background:#475569;width:7px;height:7px;border-radius:50%;border:1px solid #334155;opacity:0.4;"></div>', className:'', iconSize:[7,7], iconAnchor:[3,3] });
  if (active) return L.divIcon({ html: '<div style="background:#22d3ee;width:10px;height:10px;border-radius:50%;border:2px solid #0891b2;box-shadow:0 0 8px #22d3ee;"></div>', className:'', iconSize:[10,10], iconAnchor:[5,5] });
  return L.divIcon({ html: '<div style="background:#8b5cf6;width:7px;height:7px;border-radius:50%;border:1px solid #4c1d95;"></div>', className:'', iconSize:[7,7], iconAnchor:[3,3] });
}
var routeWpIcon = L.divIcon({ html: '<div style="background:#a78bfa;width:8px;height:8px;border-radius:2px;border:1px solid #6d28d9;transform:rotate(45deg);"></div>', className:'', iconSize:[8,8], iconAnchor:[4,4] });

function rwyHeading(n){if(!n)return null;var v=parseInt(n.replace(/[^0-9]/g,''),10);if(isNaN(v)||v<1||v>36)return null;return v*10;}
function destPoint(lat,lon,hdg,d){var R=3440.065;var dr=d/R;var b=hdg*Math.PI/180;var la=lat*Math.PI/180;var lo=lon*Math.PI/180;var la2=Math.asin(Math.sin(la)*Math.cos(dr)+Math.cos(la)*Math.sin(dr)*Math.cos(b));var lo2=lo+Math.atan2(Math.sin(b)*Math.sin(dr)*Math.cos(la),Math.cos(dr)-Math.sin(la)*Math.sin(la2));return[la2*180/Math.PI,lo2*180/Math.PI];}
function haversineNm(a,b,c,d){var R=3440.065;var dL=(c-a)*Math.PI/180;var dO=(d-b)*Math.PI/180;var x=Math.sin(dL/2)*Math.sin(dL/2)+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dO/2)*Math.sin(dO/2);return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}

function distanceAlongRoute(rp,lat,lon){
  if(rp.length<2)return{totalRemaining:0,closestSegIdx:0,closestFraction:0};
  var minD=Infinity,csi=0,csf=0;
  for(var i=0;i<rp.length-1;i++){var r=ptSeg(lat,lon,rp[i][0],rp[i][1],rp[i+1][0],rp[i+1][1]);if(r.dist<minD){minD=r.dist;csi=i;csf=r.fraction;}}
  var sl=haversineNm(rp[csi][0],rp[csi][1],rp[csi+1][0],rp[csi+1][1]);
  var rem=sl*(1-csf);
  for(var j=csi+1;j<rp.length-1;j++) rem+=haversineNm(rp[j][0],rp[j][1],rp[j+1][0],rp[j+1][1]);
  return{totalRemaining:Math.round(rem),closestSegIdx:csi,closestFraction:csf};
}
function ptSeg(pL,pO,aL,aO,bL,bO){
  var sl=haversineNm(aL,aO,bL,bO);if(sl<0.1)return{dist:haversineNm(pL,pO,aL,aO),fraction:0};
  var dA=haversineNm(aL,aO,pL,pO),dB=haversineNm(bL,bO,pL,pO);
  var f=(dA*dA-dB*dB+sl*sl)/(2*sl*sl);f=Math.max(0,Math.min(1,f));
  var pjL=aL+f*(bL-aL),pjO=aO+f*(bO-aO);
  return{dist:haversineNm(pL,pO,pjL,pjO),fraction:f};
}
function findNextWp(rp,wps,lat,lon,csi){
  for(var i=0;i<wps.length;i++){var wp=wps[i];if(wp.is_active)return wp;var bs=0,bd=Infinity;for(var s=0;s<rp.length-1;s++){var r=ptSeg(wp.lat,wp.lon,rp[s][0],rp[s][1],rp[s+1][0],rp[s+1][1]);if(r.dist<bd){bd=r.dist;bs=s;}}if(bs>csi)return wp;if(bs===csi){if(haversineNm(rp[bs][0],rp[bs][1],wp.lat,wp.lon)>haversineNm(rp[bs][0],rp[bs][1],lat,lon))return wp;}}
  return null;
}

// Draw ARC overlay (Boeing ND style)
function drawArcOverlay(hdg, alt, spd, nextWpName, nextWpDist, arrDist) {
  var canvas = document.getElementById('arc-canvas');
  if (!canvas) return;
  var rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * (window.devicePixelRatio || 1);
  canvas.height = rect.height * (window.devicePixelRatio || 1);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  var cx = rect.width / 2;
  var cy = rect.height * (isFullscreen ? 0.93 : 0.90);
  var radius = Math.min(rect.width, rect.height) * 0.38;

  // ARC sector (120 degrees)
  ctx.strokeStyle = 'rgba(34,211,238,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI*2/3 - Math.PI/2, -Math.PI/3 - Math.PI/2, false);
  ctx.stroke();

  // Range rings
  for (var r = 1; r <= 2; r++) {
    var rr = radius * r / 3;
    ctx.strokeStyle = 'rgba(34,211,238,0.1)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, -Math.PI*2/3 - Math.PI/2, -Math.PI/3 - Math.PI/2, false);
    ctx.stroke();
  }

  // Compass ticks around arc
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '10px "Courier New", monospace';
  var heading = hdg || 0;
  for (var deg = 0; deg < 360; deg += 10) {
    var relDeg = ((deg - heading + 360) % 360);
    if (relDeg > 180) relDeg -= 360;
    if (relDeg < -60 || relDeg > 60) continue;
    var angle = (relDeg * Math.PI / 180) - Math.PI / 2;
    var isMajor = deg % 30 === 0;
    var innerR = radius - (isMajor ? 14 : 8);
    var outerR = radius;
    ctx.strokeStyle = isMajor ? 'rgba(34,211,238,0.6)' : 'rgba(34,211,238,0.2)';
    ctx.lineWidth = isMajor ? 1.5 : 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle));
    ctx.lineTo(cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle));
    ctx.stroke();
    if (isMajor) {
      var labelR = radius + 14;
      var label = String(Math.round(deg / 10)).padStart(2, '0');
      if (deg === 0) label = 'N';
      else if (deg === 90) label = 'E';
      else if (deg === 180) label = 'S';
      else if (deg === 270) label = 'W';
      ctx.fillStyle = (deg === 0) ? '#22d3ee' : 'rgba(148,163,184,0.8)';
      ctx.font = (deg % 90 === 0) ? 'bold 11px "Courier New", monospace' : '10px "Courier New", monospace';
      ctx.fillText(label, cx + labelR * Math.cos(angle), cy + labelR * Math.sin(angle));
    }
  }

  // Heading triangle at top
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  var topY = cy - radius - 2;
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx - 6, topY - 10);
  ctx.lineTo(cx + 6, topY - 10);
  ctx.closePath();
  ctx.fill();

  // Heading readout box
  ctx.fillStyle = 'rgba(10,20,40,0.9)';
  ctx.strokeStyle = 'rgba(34,211,238,0.4)';
  ctx.lineWidth = 1;
  var hboxW = 52, hboxH = 22;
  ctx.fillRect(cx - hboxW/2, topY - 10 - hboxH - 4, hboxW, hboxH);
  ctx.strokeRect(cx - hboxW/2, topY - 10 - hboxH - 4, hboxW, hboxH);
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(heading)).padStart(3, '0') + '°', cx, topY - 10 - hboxH/2 - 2);

  // Bottom info bar - larger text for fullscreen
  var barH = 44;
  var barY = rect.height - barH;
  ctx.fillStyle = 'rgba(10,20,40,0.9)';
  ctx.fillRect(0, barY, rect.width, barH);
  ctx.strokeStyle = 'rgba(34,211,238,0.2)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(0, barY); ctx.lineTo(rect.width, barY); ctx.stroke();

  var textY = barY + barH / 2 + 1;
  var labelFont = 'bold 12px "Courier New", monospace';
  var valueFont = 'bold 16px "Courier New", monospace';

  ctx.textAlign = 'left';
  ctx.font = labelFont;
  ctx.fillStyle = '#64748b';
  ctx.fillText('HDG', 16, textY);
  ctx.font = valueFont;
  ctx.fillStyle = '#22d3ee';
  ctx.fillText(String(Math.round(heading)).padStart(3,'0')+'°', 52, textY);

  ctx.font = labelFont;
  ctx.fillStyle = '#64748b';
  ctx.fillText('ALT', 120, textY);
  ctx.font = valueFont;
  ctx.fillStyle = '#34d399';
  ctx.fillText(Math.round(alt||0).toLocaleString()+' ft', 156, textY);

  ctx.font = labelFont;
  ctx.fillStyle = '#64748b';
  ctx.fillText('GS', 280, textY);
  ctx.font = valueFont;
  ctx.fillStyle = '#34d399';
  ctx.fillText(Math.round(spd||0)+' kts', 306, textY);

  ctx.textAlign = 'right';
  ctx.font = valueFont;
  if (nextWpDist !== null) {
    ctx.fillStyle = '#a78bfa';
    ctx.fillText('▸ ' + (nextWpName||'WPT') + ': ' + nextWpDist + ' NM', rect.width - 180, textY);
  }
  if (arrDist !== null) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('ARR: ' + arrDist + ' NM', rect.width - 16, textY);
  }
}

function updateHUD(fd, live, evts) {
  var el = document.getElementById('hud-top');
  if (!el || !isFullscreen || !live) { if(el) el.style.display='none'; return; }
  el.style.display = 'flex';
  
  var g = live.gForce || 1;
  var mg = live.maxGForce || 1;
  var fp = live.fuelPercent || 0;
  var fk = live.fuelKg || 0;
  var sc = live.flightScore != null ? live.flightScore : 100;
  
  var gCol = g < 1.3 ? 'hud-green' : g < 1.8 ? 'hud-amber' : 'hud-red';
  var mgCol = mg < 1.5 ? 'hud-green' : mg < 2.0 ? 'hud-amber' : 'hud-red';
  var fCol = fp > 20 ? 'hud-amber' : 'hud-red';
  var sCol = sc >= 85 ? 'hud-green' : sc >= 70 ? 'hud-amber' : 'hud-red';

  el.innerHTML = 
    '<div class="hud-cell"><span class="hud-label">G</span><span class="hud-val '+gCol+'">'+g.toFixed(2)+'</span></div>' +
    '<div class="hud-cell"><span class="hud-label">MAX G</span><span class="hud-val '+mgCol+'">'+mg.toFixed(2)+'</span></div>' +
    '<div class="hud-cell"><span class="hud-label">FUEL</span><span class="hud-val '+fCol+'">'+Math.round(fp)+'%</span><span style="font-size:9px;color:#64748b;font-family:monospace;">'+Math.round(fk).toLocaleString()+'kg</span></div>' +
    '<div class="hud-cell"><span class="hud-label">SCORE</span><span class="hud-val '+sCol+'">'+Math.round(sc)+'</span></div>';
}

function updateEvents(evts, live) {
  var el = document.getElementById('events-overlay');
  if (!el) return;
  if (!evts) { el.style.display = 'none'; return; }
  
  // Position: top-left in ARC mode, bottom-left in F-PLN mode
  if (currentViewMode === 'arc') { el.classList.add('arc-pos'); } else { el.classList.remove('arc-pos'); }
  
  var items = [];
  if (evts.crash)           items.push({name:'CRASH',           score:'-100', cost:'70% Neuwert'});
  if (evts.tailstrike)      items.push({name:'Heckaufsetzer',   score:'-20',  cost:'2% Neuwert'});
  if (evts.stall)           items.push({name:'Strömungsabriss', score:'-50',  cost:null});
  if (evts.overstress)      items.push({name:'Strukturschaden', score:'-30',  cost:'4% Neuwert'});
  if (evts.overspeed)       items.push({name:'Overspeed',       score:'-15',  cost:null});
  if (evts.flaps_overspeed) items.push({name:'Klappen-Overspeed', score:'-15', cost:'2.5% Neuwert'});
  if (evts.gear_up_landing) items.push({name:'Fahrwerk eingef.', score:'-35', cost:'15% Neuwert'});
  if (evts.high_g_force)    items.push({name:'Hohe G-Kräfte',   score:'-10+', cost:'1%+ Neuwert'});
  if (evts.hard_landing)    items.push({name:'Harte Landung',   score:'-30',  cost:'25% Einnahmen'});
  if (evts.harsh_controls)  items.push({name:'Ruppige Steuerung', score:'—',  cost:null});
  if (evts.fuel_emergency)  items.push({name:'Treibstoff-Not',  score:'—',    cost:null});
  
  if (items.length === 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  var html = '<div class="ev-card"><div class="ev-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>VORFÄLLE</div>';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    html += '<div class="ev-item"><div class="ev-dot"></div>' + it.name + '</div>';
    var details = '';
    if (it.score && it.score !== '—') details += '<span style="color:#f87171;">Score: ' + it.score + '</span>';
    if (it.cost) details += (details ? ' · ' : '') + '<span style="color:#fbbf24;">Kosten: ' + it.cost + '</span>';
    if (details) html += '<div class="ev-detail">' + details + '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

var arcLayersBuilt = false; // track if layers were already set up for ARC mode

function update(d) {
  var fd = d.flightData || {};
  lastFd = fd;
  var contract = d.contract;
  var waypoints = (d.waypoints || []).filter(function(w){return w.lat && w.lon;});
  var routeWaypoints = (d.routeWaypoints || []).filter(function(w){return w.lat && w.lon;});
  var flightPath = d.flightPath || [];
  var staticMode = d.staticMode;
  var depCoords = d.departureCoords;
  var arrCoords = d.arrivalCoords;
  var depRwy = d.departureRunway;
  var arrRwy = d.arrivalRunway;
  currentViewMode = d.viewMode || 'fplan';
  var live = d.liveFlightData;

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

  // Build route points: PREFER routeWaypoints (SimBrief) for the route line
  // because they define the full planned route. FMS waypoints from X-Plane
  // may only have a few entries and would make the route incomplete.
  var routeSource = routeWaypoints.length > 0 ? routeWaypoints : waypoints;
  var activeWps = waypoints.length > 0 ? waypoints : routeWaypoints;

  var rp = [];
  if (depPos) rp.push(depPos);
  routeSource.forEach(function(w){ rp.push([w.lat, w.lon]); });
  if (arrPos) rp.push(arrPos);
  if (rp.length < 2 && depPos && arrPos) rp = [depPos, arrPos];

  if (layers.routeGlow) map.removeLayer(layers.routeGlow);
  if (layers.route) map.removeLayer(layers.route);
  if (rp.length >= 2) {
    layers.routeGlow = L.polyline(rp, { color:'#818cf8', weight:8, dashArray:'8,8', opacity:0.18 }).addTo(map);
    layers.route = L.polyline(rp, { color: currentViewMode==='arc' ? '#22d3ee' : '#818cf8', weight: currentViewMode==='arc' ? 3.5 : 3.5, dashArray: currentViewMode==='arc' ? '6,6' : '10,8', opacity: currentViewMode==='arc' ? 0.7 : 0.75 }).addTo(map);
  }

  var fp = [];
  if (flightPath && flightPath.length > 1) fp = flightPath;
  else if (!staticMode) { if(depPos) fp.push(depPos); if(curPos) fp.push(curPos); }

  if (layers.flown) map.removeLayer(layers.flown);
  if (fp.length >= 2 && currentViewMode !== 'arc') {
    layers.flown = L.polyline(fp, { color: '#3b82f6', weight:3.5, opacity:0.9 }).addTo(map);
  }

  if (layers.dep) map.removeLayer(layers.dep);
  if (depPos) {
    layers.dep = L.marker(depPos, { icon: depIcon }).addTo(map);
    layers.dep.bindTooltip('<span class="wpl wpl-dep">'+(contract?.departure_airport||'DEP')+(depRwy?' / '+depRwy:'')+'</span>', { permanent:true, direction:'bottom', offset:[0,8], className:'clean-tooltip' });
  }
  if (layers.arr) map.removeLayer(layers.arr);
  if (arrPos) {
    layers.arr = L.marker(arrPos, { icon: arrIcon }).addTo(map);
    layers.arr.bindTooltip('<span class="wpl wpl-arr">'+(contract?.arrival_airport||'ARR')+(arrRwy?' / '+arrRwy:'')+'</span>', { permanent:true, direction:'bottom', offset:[0,8], className:'clean-tooltip' });
  }

  if (layers.depRwyLine) { map.removeLayer(layers.depRwyLine); layers.depRwyLine = null; }
  if (layers.arrRwyLine) { map.removeLayer(layers.arrRwyLine); layers.arrRwyLine = null; }
  if (depPos && depRwy) { var dh=rwyHeading(depRwy); if(dh!==null){var bh=destPoint(depPos[0],depPos[1],(dh+180)%360,1);var ah=destPoint(depPos[0],depPos[1],dh,5);layers.depRwyLine=L.polyline([bh,depPos,ah],{color:'#10b981',weight:2.5,opacity:0.7,dashArray:'6,4'}).addTo(map);}}
  if (arrPos && arrRwy) { var arh=rwyHeading(arrRwy); if(arh!==null){var as=destPoint(arrPos[0],arrPos[1],(arh+180)%360,10);var ap=destPoint(arrPos[0],arrPos[1],arh,1);layers.arrRwyLine=L.polyline([as,arrPos,ap],{color:'#f59e0b',weight:2.5,opacity:0.7,dashArray:'6,4'}).addTo(map);}}

  var distInfo = { nextWpDist: null, nextWpName: null, arrDist: null };
  var closestSegIdx = 0;
  if (curPos && rp.length >= 2) {
    var ri = distanceAlongRoute(rp, curPos[0], curPos[1]);
    closestSegIdx = ri.closestSegIdx;
    distInfo.arrDist = ri.totalRemaining;
    var wps2 = waypoints.length > 0 ? waypoints : routeWaypoints;
    if (wps2.length > 0) {
      var nw = findNextWp(rp, wps2, curPos[0], curPos[1], closestSegIdx);
      if (nw) { distInfo.nextWpDist = Math.round(haversineNm(curPos[0],curPos[1],nw.lat,nw.lon)); distInfo.nextWpName = nw.name||'WPT'; }
    }
  }

  layers.wpGroup.clearLayers();
  // Show FMS waypoints if available
  if (waypoints.length > 0) {
    waypoints.forEach(function(wp, i) {
      var passed = false;
      if (curPos && rp.length >= 2) {
        var wbs=0,wbd=Infinity;for(var s=0;s<rp.length-1;s++){var r=ptSeg(wp.lat,wp.lon,rp[s][0],rp[s][1],rp[s+1][0],rp[s+1][1]);if(r.dist<wbd){wbd=r.dist;wbs=s;}}
        if(wbs<closestSegIdx) passed=true;
        else if(wbs===closestSegIdx&&haversineNm(rp[wbs][0],rp[wbs][1],wp.lat,wp.lon)<haversineNm(rp[wbs][0],rp[wbs][1],curPos[0],curPos[1])) passed=true;
      }
      var m = L.marker([wp.lat, wp.lon], { icon: wpIcon(wp.is_active, passed) }).addTo(layers.wpGroup);
      var cls = passed ? 'wpl wpl-fms-passed' : (wp.is_active ? 'wpl wpl-fms-active' : 'wpl wpl-fms');
      var txt = (wp.is_active ? '▸ ' : '') + (wp.name || 'WPT '+(i+1)) + (wp.alt > 0 ? ' FL'+Math.round(wp.alt/100) : '');
      m.bindTooltip('<span class="'+cls+'">'+txt+'</span>', { permanent:true, direction:'top', offset:[0,-6], className:'clean-tooltip' });
    });
  }
  // ALWAYS show SimBrief route waypoints (even if FMS waypoints exist)
  if (routeWaypoints.length > 0) {
    routeWaypoints.forEach(function(wp, i) {
      var m = L.marker([wp.lat, wp.lon], { icon: routeWpIcon }).addTo(layers.wpGroup);
      m.bindTooltip('<span class="wpl wpl-route">'+wp.name+(wp.alt>0?' FL'+Math.round(wp.alt/100):'')+'</span>', { permanent:true, direction:'top', offset:[0,-6], className:'clean-tooltip' });
    });
  }

  if (layers.aircraft) map.removeLayer(layers.aircraft);
  if (curPos && !staticMode) {
    layers.aircraft = L.marker(curPos, { icon: makeAircraftIcon(fd.heading), zIndexOffset: 1000 }).addTo(map);
  }

  // ARC overlay + map rotation for Boeing ND style
  var arcEl = document.getElementById('arc-overlay');
  var mapEl = document.getElementById('map');
  lastCurPos = curPos;
  
  // Detect mode switch
  var switchedToArc = (currentViewMode === 'arc' && prevViewMode !== 'arc');
  var switchedFromArc = (currentViewMode !== 'arc' && prevViewMode === 'arc');
  prevViewMode = currentViewMode;
  
  if (currentViewMode === 'arc' && curPos && !staticMode) {
    arcEl.style.display = 'block';
    setArcDragLock(true);
    
    // Switch to oversized 300% map to prevent tile gaps on rotation
    if (switchedToArc) {
      mapEl.style.transform = 'none';
      mapEl.className = 'arc-mode';
      map.invalidateSize();
      map.setZoom(arcZoomLevel, { animate: false });
      // Initialize – snap instantly to current position
      arcTarget.lat = curPos[0];
      arcTarget.lon = curPos[1];
      arcTarget.hdg = fd.heading || 0;
      arcTarget.alt = fd.altitude || 0;
      arcTarget.spd = fd.speed || 0;
      arcCurrent.lat = curPos[0];
      arcCurrent.lon = curPos[1];
      arcCurrent.hdg = fd.heading || 0;
      arcCurrent.alt = fd.altitude || 0;
      arcCurrent.spd = fd.speed || 0;
      arcVelocity = { lat: 0, lon: 0, hdg: 0, alt: 0 };
      arcCorrectionRemaining = 0;
      arcPrevTarget.lat = curPos[0];
      arcPrevTarget.lon = curPos[1];
      arcPrevTarget.hdg = fd.heading || 0;
      arcPrevTarget.alt = fd.altitude || 0;
      arcLastTargetTime = performance.now();
      // Reset projection cache so first frame does a setView
      arcBaseLatLng = null;
      arcInitialized = true;
      parent.postMessage({ type: 'flightmap-viewmode', viewMode: 'arc' }, '*');
    }
    
    // Update targets from full data update (don't override velocity/correction)
    if (!switchedToArc) {
      arcTarget.lat = curPos[0];
      arcTarget.lon = curPos[1];
      arcTarget.hdg = fd.heading || 0;
      arcTarget.alt = fd.altitude || 0;
      arcTarget.spd = fd.speed || 0;
    }
    if (!arcInitialized) {
      arcCurrent.lat = curPos[0]; arcCurrent.lon = curPos[1];
      arcCurrent.hdg = fd.heading || 0; arcCurrent.alt = fd.altitude || 0;
      arcCurrent.spd = fd.speed || 0;
      arcVelocity = { lat: 0, lon: 0, hdg: 0, alt: 0 };
      arcCorrectionRemaining = 0;
      arcBaseLatLng = null;
      arcInitialized = true;
    }
    
    arcLastDistInfo = distInfo;
    drawArcOverlay(arcCurrent.hdg, arcCurrent.alt, arcCurrent.spd, distInfo.nextWpName, distInfo.nextWpDist, distInfo.arrDist);
    
    boundsSet = false;
  } else {
    arcEl.style.display = 'none';
    setArcDragLock(false);
    
    // Switch back to normal map
    if (switchedFromArc) {
      mapEl.className = '';
      mapEl.style.transform = 'none';
      mapEl.style.transformOrigin = '';
      map.invalidateSize();
      boundsSet = false;
      arcInitialized = false;
      parent.postMessage({ type: 'flightmap-viewmode', viewMode: 'fplan' }, '*');
    }
    mapEl.style.transform = 'none';
    mapEl.style.transformOrigin = '';
    
    var allPts = rp.concat(fp);
    if (curPos) allPts.push(curPos);
    if (!boundsSet && allPts.length >= 2) {
      boundsSet = true;
      setTimeout(function(){ map.fitBounds(L.latLngBounds(allPts), { padding:[40,40], maxZoom:10 }); }, 50);
    } else if (curPos && !staticMode && !userInteracting) {
      map.panTo(curPos, { animate:true, duration:1 });
    }
  }

  // HUD + Events
  updateHUD(fd, live, live?.events);
  updateEvents(live?.events, live);

  parent.postMessage({ type: 'flightmap-distances', payload: distInfo }, '*');
}

// Smooth ARC interpolation – constant-speed movement between server updates.
// The key insight: we DON'T use spring/exponential pull (that causes fast-snap-then-stop).
// Instead we do pure dead-reckoning at the measured velocity, with a gentle
// linear correction that spreads the error over ~1 second evenly.
var arcTarget = { lat: 0, lon: 0, hdg: 0, alt: 0, spd: 0 };
var arcCurrent = { lat: 0, lon: 0, hdg: 0, alt: 0, spd: 0 };
var arcInitialized = false;
var arcLastTargetTime = 0;
var arcLastFrameTime = 0;
var arcPrevTarget = { lat: 0, lon: 0, hdg: 0, alt: 0, spd: 0 };
var arcVelocity = { lat: 0, lon: 0, hdg: 0, alt: 0 }; // per second (smoothed)
var arcLastIconHdg = -999;
var arcLastOverlayDraw = 0;
var arcLastDistInfo = { nextWpDist: null, nextWpName: null, arrDist: null };

// Error correction: when a new target arrives, we compute the position error
// and spread it linearly over CORRECTION_DURATION seconds.
var arcCorrectionDuration = 1.5; // seconds to absorb a position error (longer = smoother)
var arcCorrectionRemaining = 0;  // seconds left in current correction
var arcCorrectionTotal = 0;      // total duration of current correction (for easing)
var arcCorrectionRate = { lat: 0, lon: 0, hdg: 0, alt: 0 }; // per second

function lerpAngle(a, b, t) {
  var diff = ((b - a + 540) % 360) - 180;
  return a + diff * t;
}
function angleDiff(a, b) {
  return ((b - a + 540) % 360) - 180;
}

var arcMapEl = null;
var arcLastMarkerUpdate = 0;

function arcSmoothTick(now) {
  if (currentViewMode !== 'arc' || !arcInitialized) {
    arcLastFrameTime = 0;
    arcAnimFrame = requestAnimationFrame(arcSmoothTick);
    return;
  }
  
  if (!now) now = performance.now();
  var dt = arcLastFrameTime ? (now - arcLastFrameTime) / 1000 : 0.016;
  if (dt > 0.25) dt = 0.016;
  arcLastFrameTime = now;
  
  // --- Dead-reckoning: constant velocity movement ---
  arcCurrent.lat += arcVelocity.lat * dt;
  arcCurrent.lon += arcVelocity.lon * dt;
  arcCurrent.hdg += arcVelocity.hdg * dt;
  arcCurrent.alt += arcVelocity.alt * dt;
  
  // --- Smooth error correction with ease-in-out curve ---
  // Uses a cosine blend so correction starts and ends gently
  if (arcCorrectionRemaining > 0 && arcCorrectionTotal > 0) {
    var corrDt = Math.min(dt, arcCorrectionRemaining);
    // Progress through correction: 0 = start, 1 = end
    var progressBefore = 1 - (arcCorrectionRemaining / arcCorrectionTotal);
    var progressAfter = 1 - ((arcCorrectionRemaining - corrDt) / arcCorrectionTotal);
    // Smooth step using cosine: maps [0,1] -> [0,1] with ease-in-out
    var sBefore = 0.5 - 0.5 * Math.cos(progressBefore * Math.PI);
    var sAfter = 0.5 - 0.5 * Math.cos(progressAfter * Math.PI);
    var blend = sAfter - sBefore; // fraction of total error to apply this frame
    arcCurrent.lat += arcCorrectionRate.lat * arcCorrectionTotal * blend;
    arcCurrent.lon += arcCorrectionRate.lon * arcCorrectionTotal * blend;
    arcCurrent.hdg += arcCorrectionRate.hdg * arcCorrectionTotal * blend;
    arcCurrent.alt += arcCorrectionRate.alt * arcCorrectionTotal * blend;
    arcCorrectionRemaining -= corrDt;
  }
  
  // Speed is display-only, simple lerp is fine
  arcCurrent.spd += (arcTarget.spd - arcCurrent.spd) * Math.min(1, dt * 3);
  
  // Normalize heading to 0-360
  arcCurrent.hdg = ((arcCurrent.hdg % 360) + 360) % 360;
  
  var curPos = [arcCurrent.lat, arcCurrent.lon];
  
  // Update Leaflet marker at ~10fps
  if (layers.aircraft && (now - arcLastMarkerUpdate > 100)) {
    arcLastMarkerUpdate = now;
    layers.aircraft.setLatLng(curPos);
    var hdgRounded = Math.round(arcCurrent.hdg);
    if (Math.abs(hdgRounded - arcLastIconHdg) >= 2) {
      layers.aircraft.setIcon(makeAircraftIcon(arcCurrent.hdg));
      arcLastIconHdg = hdgRounded;
    }
  }
  
  // Redraw compass overlay at ~10fps
  if (now - arcLastOverlayDraw > 100) {
    arcLastOverlayDraw = now;
    drawArcOverlay(arcCurrent.hdg, arcCurrent.alt, arcCurrent.spd, arcLastDistInfo.nextWpName, arcLastDistInfo.nextWpDist, arcLastDistInfo.arrDist);
  }
  
  // --- CSS transform: translate + rotate (no Leaflet calls per frame) ---
  if (!arcMapEl) arcMapEl = document.getElementById('map');
  
  centerAircraftArc(curPos);
  
  arcMapEl.style.transformOrigin = arcOriginX + '% ' + arcOriginY + '%';
  arcMapEl.style.transform = 'translate(' + arcTranslateX + 'px,' + arcTranslateY + 'px) rotate(' + (-arcCurrent.hdg) + 'deg)';
  
  arcAnimFrame = requestAnimationFrame(arcSmoothTick);
}
// Start the animation loop
arcAnimFrame = requestAnimationFrame(arcSmoothTick);

window.addEventListener('message', function(e) {
  if (e.data?.type === 'flightmap-update') update(e.data.payload);
  if (e.data?.type === 'flightmap-arc-position') {
    var p = e.data.payload;
    var now = performance.now();

    if (!arcInitialized && p.latitude) {
      // First position ever – snap instantly, no correction needed
      arcCurrent.lat = p.latitude;
      arcCurrent.lon = p.longitude;
      arcCurrent.hdg = p.heading || 0;
      arcCurrent.alt = p.altitude || 0;
      arcCurrent.spd = p.speed || 0;
      arcTarget.lat = p.latitude;
      arcTarget.lon = p.longitude;
      arcTarget.hdg = p.heading || 0;
      arcTarget.alt = p.altitude || 0;
      arcTarget.spd = p.speed || 0;
      arcPrevTarget.lat = p.latitude;
      arcPrevTarget.lon = p.longitude;
      arcPrevTarget.hdg = p.heading || 0;
      arcPrevTarget.alt = p.altitude || 0;
      arcVelocity = { lat: 0, lon: 0, hdg: 0, alt: 0 };
      arcCorrectionRemaining = 0;
      arcLastTargetTime = now;
      arcInitialized = true;
      isFullscreen = p.isFullscreen || false;
      return;
    }

    // Compute new velocity from consecutive target positions
    if (arcLastTargetTime > 0 && arcInitialized) {
      var elapsed = (now - arcLastTargetTime) / 1000;
      if (elapsed > 0.05 && elapsed < 5) {
        var vLat = (p.latitude - arcPrevTarget.lat) / elapsed;
        var vLon = (p.longitude - arcPrevTarget.lon) / elapsed;
        var vHdg = angleDiff(arcPrevTarget.hdg, p.heading || 0) / elapsed;
        var vAlt = ((p.altitude || 0) - (arcPrevTarget.alt || 0)) / elapsed;
        // Ultra-heavy EMA smoothing (0.1 new, 0.9 old) for butter-smooth velocity
        arcVelocity.lat = arcVelocity.lat * 0.9 + vLat * 0.1;
        arcVelocity.lon = arcVelocity.lon * 0.9 + vLon * 0.1;
        arcVelocity.hdg = arcVelocity.hdg * 0.9 + vHdg * 0.1;
        arcVelocity.alt = arcVelocity.alt * 0.9 + vAlt * 0.1;
      }
    }
    
    // Compute position error = where we currently are vs where we should be
    // Then spread this error over arcCorrectionDuration as a constant rate
    var errLat = p.latitude - arcCurrent.lat;
    var errLon = p.longitude - arcCurrent.lon;
    var errHdg = angleDiff(arcCurrent.hdg, p.heading || 0);
    var errAlt = (p.altitude || 0) - arcCurrent.alt;
    
    arcCorrectionRate.lat = errLat / arcCorrectionDuration;
    arcCorrectionRate.lon = errLon / arcCorrectionDuration;
    arcCorrectionRate.hdg = errHdg / arcCorrectionDuration;
    arcCorrectionRate.alt = errAlt / arcCorrectionDuration;
    arcCorrectionRemaining = arcCorrectionDuration;
    arcCorrectionTotal = arcCorrectionDuration;

    arcPrevTarget.lat = p.latitude;
    arcPrevTarget.lon = p.longitude;
    arcPrevTarget.hdg = p.heading || 0;
    arcPrevTarget.alt = p.altitude || 0;
    arcLastTargetTime = now;

    arcTarget.lat = p.latitude;
    arcTarget.lon = p.longitude;
    arcTarget.hdg = p.heading || 0;
    arcTarget.alt = p.altitude || 0;
    arcTarget.spd = p.speed || 0;
    isFullscreen = p.isFullscreen || false;
  }
  if (e.data?.type === 'flightmap-resize') {
    var wasFullscreen = isFullscreen;
    isFullscreen = e.data.isFullscreen || false;
    // Reset ARC projection cache so it recenters on the new viewport size
    arcBaseLatLng = null;
    arcMapEl = null;
    setTimeout(function(){ 
      map.invalidateSize();
      // Force immediate recenter if in ARC mode
      if (currentViewMode === 'arc' && arcInitialized) {
        arcBaseLatLng = null;
      }
    }, 150);
  }
});
parent.postMessage({ type: 'flightmap-ready' }, '*');
parent.postMessage({ type: 'flightmap-viewmode', viewMode: currentViewMode }, '*');
<\/script>
</body></html>`;
}