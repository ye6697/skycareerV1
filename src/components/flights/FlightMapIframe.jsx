import React, { useRef, useEffect, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation } from 'lucide-react';

// Haversine distance in NM (duplicated here since we need it outside iframe too)
function distanceNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildMapHTML() {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#0f172a;}
#map{width:100%;height:100%;}
.waypoint-label{background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important;white-space:nowrap;}
.waypoint-label::before{display:none!important;}
.leaflet-container{touch-action:manipulation!important;}
</style>
</head>
<body>
<div id="map"></div>
<script>
L.Browser.tap = false;
if(L.Map.Tap){L.Map.Tap=L.Handler.extend({addHooks:function(){},removeHooks:function(){}});}

var map = L.map('map',{
  zoomControl:false,
  attributionControl:false,
  tap:false,
  doubleClickZoom:false,
  touchZoom:'center'
}).setView([50,10],5);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

var layers = {
  routeGlow: null,
  routeLine: null,
  flownLine: null,
  depMarker: null,
  arrMarker: null,
  aircraftMarker: null,
  waypointMarkers: [],
  corridorMarkers: []
};
var boundsSet = false;

function clearWaypoints(){
  layers.waypointMarkers.forEach(function(m){map.removeLayer(m);});
  layers.waypointMarkers=[];
}
function clearCorridorAirports(){
  layers.corridorMarkers.forEach(function(m){map.removeLayer(m);});
  layers.corridorMarkers=[];
}

function createAircraftIcon(heading){
  return L.divIcon({
    html:'<div style="transform:rotate('+(heading||0)+'deg);display:flex;align-items:center;justify-content:center;width:44px;height:44px;filter:drop-shadow(0 2px 6px rgba(59,130,246,0.6));"><svg width=\\"40\\" height=\\"40\\" viewBox=\\"0 0 100 100\\" fill=\\"none\\"><path d=\\"M50 8 L54 35 L80 55 L80 60 L54 48 L54 72 L65 80 L65 84 L50 78 L35 84 L35 80 L46 72 L46 48 L20 60 L20 55 L46 35 Z\\" fill=\\"#3b82f6\\" stroke=\\"#1e40af\\" stroke-width=\\"1.5\\"/><circle cx=\\"50\\" cy=\\"20\\" r=\\"3\\" fill=\\"#60a5fa\\"/></svg></div>',
    className:'',iconSize:[44,44],iconAnchor:[22,22]
  });
}

var depIcon = L.divIcon({html:'<div style="background:#10b981;width:18px;height:18px;border-radius:50%;border:3px solid #064e3b;box-shadow:0 0 12px #10b981,0 0 4px #10b981;"></div>',className:'',iconSize:[18,18],iconAnchor:[9,9]});
var arrIcon = L.divIcon({html:'<div style="background:#f59e0b;width:18px;height:18px;border-radius:50%;border:3px solid #78350f;box-shadow:0 0 12px #f59e0b,0 0 4px #f59e0b;"></div>',className:'',iconSize:[18,18],iconAnchor:[9,9]});
var waypointIconDef = L.divIcon({html:'<div style="background:#8b5cf6;width:8px;height:8px;border-radius:50%;border:2px solid #4c1d95;"></div>',className:'',iconSize:[8,8],iconAnchor:[4,4]});
var activeWpIcon = L.divIcon({html:'<div style="background:#f472b6;width:12px;height:12px;border-radius:50%;border:2px solid #be185d;box-shadow:0 0 8px #f472b6,0 0 4px #f472b6;"></div>',className:'',iconSize:[12,12],iconAnchor:[6,6]});
var routeWpIcon = L.divIcon({html:'<div style="background:#a78bfa;width:10px;height:10px;border-radius:2px;border:2px solid #6d28d9;transform:rotate(45deg);"></div>',className:'',iconSize:[10,10],iconAnchor:[5,5]});
var corridorAirportIcon = L.divIcon({html:'<div style="width:10px;height:10px;background:rgba(148,163,184,0.7);border-radius:50%;border:1.5px solid rgba(226,232,240,0.5);"></div>',className:'',iconSize:[10,10],iconAnchor:[5,5]});

window.addEventListener('message', function(e){
  var d = e.data;
  if(!d || d.type !== 'mapUpdate') return;

  var routePoints = d.routePoints || [];
  var flownPoints = d.flownPoints || [];
  var depPos = d.depPos;
  var arrPos = d.arrPos;
  var curPos = d.curPos;
  var heading = d.heading || 0;
  var staticMode = d.staticMode;
  var contract = d.contract || {};
  var activeWaypoints = d.activeWaypoints || [];
  var validWaypoints = d.validWaypoints || [];
  var validRouteWaypoints = d.validRouteWaypoints || [];
  var departureRunway = d.departureRunway;
  var arrivalRunway = d.arrivalRunway;
  var corridorAirports = d.corridorAirports || [];

  // Route lines
  if(layers.routeGlow){map.removeLayer(layers.routeGlow);layers.routeGlow=null;}
  if(layers.routeLine){map.removeLayer(layers.routeLine);layers.routeLine=null;}
  if(layers.flownLine){map.removeLayer(layers.flownLine);layers.flownLine=null;}

  if(routePoints.length>=2){
    layers.routeGlow=L.polyline(routePoints,{color:'#818cf8',weight:6,dashArray:'8,8',opacity:0.15}).addTo(map);
    layers.routeLine=L.polyline(routePoints,{color:'#818cf8',weight:3,dashArray:'10,8',opacity:0.7}).addTo(map);
  }
  if(flownPoints.length>=2){
    layers.flownLine=L.polyline(flownPoints,{color:'#3b82f6',weight:3,opacity:0.9}).addTo(map);
  }

  // Departure marker
  if(layers.depMarker){map.removeLayer(layers.depMarker);layers.depMarker=null;}
  if(depPos){
    layers.depMarker=L.marker(depPos,{icon:depIcon}).addTo(map);
    var depLabel=(contract.departure_airport||'DEP')+(departureRunway?' / '+departureRunway:'');
    layers.depMarker.bindTooltip('<span style="font-size:12px;font-family:monospace;font-weight:bold;color:#10b981;background:rgba(15,23,42,0.95);padding:3px 7px;border-radius:4px;border:1px solid #064e3b;box-shadow:0 0 8px rgba(16,185,129,0.3)">'+depLabel+'</span>',{permanent:true,direction:'bottom',offset:[0,10],className:'waypoint-label'});
  }

  // Arrival marker
  if(layers.arrMarker){map.removeLayer(layers.arrMarker);layers.arrMarker=null;}
  if(arrPos){
    layers.arrMarker=L.marker(arrPos,{icon:arrIcon}).addTo(map);
    var arrLabel=(contract.arrival_airport||'ARR')+(arrivalRunway?' / '+arrivalRunway:'');
    layers.arrMarker.bindTooltip('<span style="font-size:12px;font-family:monospace;font-weight:bold;color:#f59e0b;background:rgba(15,23,42,0.95);padding:3px 7px;border-radius:4px;border:1px solid #78350f;box-shadow:0 0 8px rgba(245,158,11,0.3)">'+arrLabel+'</span>',{permanent:true,direction:'bottom',offset:[0,10],className:'waypoint-label'});
  }

  // Waypoints
  clearWaypoints();
  var wpList = validWaypoints.length > 0 ? validWaypoints : validRouteWaypoints;
  var isFms = validWaypoints.length > 0;
  wpList.forEach(function(wp,i){
    var icon = isFms ? (wp.is_active ? activeWpIcon : waypointIconDef) : routeWpIcon;
    var m = L.marker([wp.lat,wp.lon],{icon:icon}).addTo(map);
    var color = isFms ? (wp.is_active ? '#f472b6' : '#a78bfa') : '#c4b5fd';
    var border = isFms ? (wp.is_active ? '1px solid #be185d' : '1px solid #4c1d95') : '1px solid #6d28d9';
    var shadow = (isFms && wp.is_active) ? 'box-shadow:0 0 6px rgba(244,114,182,0.4)' : '';
    var prefix = (isFms && wp.is_active) ? '▸ ' : '';
    var altStr = (wp.alt > 0) ? ' FL'+Math.round(wp.alt/100) : '';
    m.bindTooltip('<span style="font-size:10px;font-family:monospace;color:'+color+';background:rgba(15,23,42,0.85);padding:1px 4px;border-radius:3px;border:'+border+';'+shadow+'">'+prefix+(wp.name||'WPT '+(i+1))+altStr+'</span>',{permanent:true,direction:'top',offset:[0,-8],className:'waypoint-label'});
    layers.waypointMarkers.push(m);
  });

  // Corridor airports
  clearCorridorAirports();
  corridorAirports.forEach(function(ap){
    var m = L.marker([ap.lat,ap.lon],{icon:corridorAirportIcon}).addTo(map);
    m.bindTooltip('<span style="font-size:10px;font-family:monospace;color:#94a3b8;background:rgba(15,23,42,0.9);padding:1px 4px;border-radius:3px;border:1px solid #334155">'+ap.icao+'</span>',{direction:'right',offset:[8,0],className:'waypoint-label'});
    layers.corridorMarkers.push(m);
    if(ap.runway_heading!=null){
      var rIcon = L.divIcon({html:'<div style="transform:rotate('+ap.runway_heading+'deg);width:3px;height:20px;background:rgba(226,232,240,0.5);border-radius:1px;"></div>',className:'',iconSize:[3,20],iconAnchor:[1.5,10]});
      var rm = L.marker([ap.lat,ap.lon],{icon:rIcon,interactive:false}).addTo(map);
      layers.corridorMarkers.push(rm);
    }
  });

  // Aircraft marker
  if(layers.aircraftMarker){map.removeLayer(layers.aircraftMarker);layers.aircraftMarker=null;}
  if(curPos && !staticMode){
    layers.aircraftMarker=L.marker(curPos,{icon:createAircraftIcon(heading)}).addTo(map);
  }

  // Fit bounds once
  if(!boundsSet){
    var allPts = routePoints.concat(flownPoints);
    if(curPos) allPts.push(curPos);
    if(allPts.length>=2){
      boundsSet=true;
      map.fitBounds(L.latLngBounds(allPts),{padding:[40,40],maxZoom:10});
    }
  }

  // Pan to aircraft
  if(curPos && !staticMode){
    map.panTo(curPos,{animate:true,duration:1});
  }
});

// Tell parent we're ready
window.parent.postMessage({type:'mapReady'},'*');
<\/script>
</body>
</html>`;
}

export default function FlightMapIframe({ flightData, contract, waypoints = [], routeWaypoints = [], staticMode = false, title, flightPath = [], departureRunway = null, arrivalRunway = null, departureCoords = null, arrivalCoords = null, corridorAirports = [] }) {
  const iframeRef = useRef(null);
  const readyRef = useRef(false);
  const pendingRef = useRef(null);

  const mapHTML = useMemo(() => buildMapHTML(), []);

  // Listen for ready message from iframe
  useEffect(() => {
    function onMsg(e) {
      if (e.data?.type === 'mapReady') {
        readyRef.current = true;
        if (pendingRef.current) {
          iframeRef.current?.contentWindow?.postMessage(pendingRef.current, '*');
          pendingRef.current = null;
        }
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Send data to iframe whenever props change
  useEffect(() => {
    const fd = flightData || {};
    const hasPosition = fd.latitude !== 0 || fd.longitude !== 0;
    const hasDep = fd.departure_lat !== 0 || fd.departure_lon !== 0;
    const hasArr = fd.arrival_lat !== 0 || fd.arrival_lon !== 0;

    let depPos = null;
    if (departureCoords?.lat && departureCoords?.lon) depPos = [departureCoords.lat, departureCoords.lon];
    else if (hasDep) depPos = [fd.departure_lat, fd.departure_lon];
    else if (routeWaypoints.length > 0 && routeWaypoints[0]?.lat) depPos = [routeWaypoints[0].lat, routeWaypoints[0].lon];

    let arrPos = null;
    if (arrivalCoords?.lat && arrivalCoords?.lon) arrPos = [arrivalCoords.lat, arrivalCoords.lon];
    else if (hasArr) arrPos = [fd.arrival_lat, fd.arrival_lon];
    else if (routeWaypoints.length > 0) {
      const last = routeWaypoints[routeWaypoints.length - 1];
      if (last?.lat) arrPos = [last.lat, last.lon];
    }

    const curPos = hasPosition ? [fd.latitude, fd.longitude] : null;
    const validWaypoints = waypoints.filter(wp => wp.lat && wp.lon);
    const validRouteWaypoints = routeWaypoints.filter(wp => wp.lat && wp.lon);
    const activeWaypoints = validWaypoints.length > 0 ? validWaypoints : validRouteWaypoints;

    const routePoints = [];
    if (depPos) routePoints.push(depPos);
    activeWaypoints.forEach(wp => routePoints.push([wp.lat, wp.lon]));
    if (arrPos) routePoints.push(arrPos);

    let flownPoints = [];
    if (flightPath?.length > 1) flownPoints = flightPath;
    else if (staticMode) flownPoints = routePoints;
    else {
      if (depPos) flownPoints.push(depPos);
      if (curPos) flownPoints.push(curPos);
    }

    const msg = {
      type: 'mapUpdate',
      routePoints,
      flownPoints,
      depPos,
      arrPos,
      curPos,
      heading: fd.heading || 0,
      staticMode,
      contract: contract ? { departure_airport: contract.departure_airport, arrival_airport: contract.arrival_airport } : {},
      activeWaypoints,
      validWaypoints,
      validRouteWaypoints,
      departureRunway,
      arrivalRunway,
      corridorAirports
    };

    if (readyRef.current && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, '*');
    } else {
      pendingRef.current = msg;
    }
  }, [flightData, contract, waypoints, routeWaypoints, staticMode, flightPath, departureRunway, arrivalRunway, departureCoords, arrivalCoords, corridorAirports]);

  const fd = flightData || {};
  const hasPosition = fd.latitude !== 0 || fd.longitude !== 0;
  const validWaypoints = waypoints.filter(wp => wp.lat && wp.lon);
  const validRouteWaypoints = routeWaypoints.filter(wp => wp.lat && wp.lon);
  const activeWaypoints = validWaypoints.length > 0 ? validWaypoints : validRouteWaypoints;
  const curPos = hasPosition ? [fd.latitude, fd.longitude] : null;

  // Distance calculations for bottom bar
  let distToNextWp = null, nextWpName = null, distToArrival = null;
  
  let arrPos = null;
  if (arrivalCoords?.lat && arrivalCoords?.lon) arrPos = [arrivalCoords.lat, arrivalCoords.lon];
  else if (fd.arrival_lat || fd.arrival_lon) arrPos = [fd.arrival_lat, fd.arrival_lon];
  else if (routeWaypoints.length > 0) {
    const last = routeWaypoints[routeWaypoints.length - 1];
    if (last?.lat) arrPos = [last.lat, last.lon];
  }

  if (!staticMode && curPos) {
    if (activeWaypoints.length > 0) {
      let minDist = Infinity;
      for (const wp of activeWaypoints) {
        if (!wp.lat || !wp.lon) continue;
        const d = distanceNm(curPos[0], curPos[1], wp.lat, wp.lon);
        if (d < minDist) { minDist = d; nextWpName = wp.name || 'WPT'; distToNextWp = d; }
      }
      if (distToNextWp < 2 && activeWaypoints.length > 1) {
        let secondMin = Infinity;
        for (const wp of activeWaypoints) {
          if (!wp.lat || !wp.lon) continue;
          const d = distanceNm(curPos[0], curPos[1], wp.lat, wp.lon);
          if (d > distToNextWp && d < secondMin) { secondMin = d; nextWpName = wp.name || 'WPT'; distToNextWp = d; }
        }
      }
    }
    if (arrPos) distToArrival = distanceNm(curPos[0], curPos[1], arrPos[0], arrPos[1]);
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
          {validWaypoints.length > 0 && (
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
              FMS Route ({validWaypoints.length} WPTs)
            </Badge>
          )}
          {hasPosition && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
              {fd.latitude.toFixed(3)}° / {fd.longitude.toFixed(3)}°
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-2" style={{ height: 350 }}>
        <iframe
          ref={iframeRef}
          srcDoc={mapHTML}
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts"
          title="Flight Map"
        />
      </div>

      {!staticMode && (
        <div className="p-2 bg-slate-900/80 text-xs font-mono space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">HDG {Math.round(fd.heading || 0)}°</span>
            <span className="text-slate-400">ALT {Math.round(fd.altitude || 0).toLocaleString()} ft</span>
            <span className="text-slate-400">GS {Math.round(fd.speed || 0)} kts</span>
            {activeWaypoints.length > 0 && (
              <span className="text-slate-500">{activeWaypoints.length} WPTs</span>
            )}
          </div>
          {(distToNextWp !== null || distToArrival !== null) && (
            <div className="flex items-center justify-between border-t border-slate-700/50 pt-1">
              {distToNextWp !== null && (
                <span className="text-purple-400">
                  → {nextWpName}: <span className="font-bold">{Math.round(distToNextWp)} NM</span>
                </span>
              )}
              {validWaypoints.length > 0 && (() => {
                const active = validWaypoints.find(wp => wp.is_active);
                if (active && curPos) {
                  const d = distanceNm(curPos[0], curPos[1], active.lat, active.lon);
                  return (
                    <span className="text-pink-400">
                      FMS▸ {active.name}: <span className="font-bold">{Math.round(d)} NM</span>
                    </span>
                  );
                }
                return null;
              })()}
              {distToArrival !== null && (
                <span className="text-amber-400 font-bold ml-auto">
                  {contract?.arrival_airport || 'ARR'}: {Math.round(distToArrival)} NM
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {staticMode && activeWaypoints.length > 0 && (
        <div className="p-2 bg-slate-900/80 flex items-center justify-center text-xs font-mono">
          <span className="text-purple-400">{activeWaypoints.length} Wegpunkte</span>
          {flightPath?.length > 1 && (
            <span className="text-blue-400 ml-4">{flightPath.length} GPS-Punkte</span>
          )}
        </div>
      )}
    </Card>
  );
}