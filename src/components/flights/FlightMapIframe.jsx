import React, { useRef, useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigation, Maximize2, Minimize2, Map, LocateFixed, CloudSun } from 'lucide-react';
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function FlightMapIframe({ 
  flightData, contract, waypoints = [], routeWaypoints = [], 
  staticMode = false, title, flightPath = [], 
  departureRunway = null, arrivalRunway = null, 
  departureCoords = null, arrivalCoords = null,
  liveFlightData = null,
  onViewModeChange = null,
  flightEventsLog = [],
}) {
  const { lang } = useLanguage();
  const iframeRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [mapDistances, setMapDistances] = useState({ nextWpDist: null, nextWpName: null, arrDist: null });
  const [viewMode, setViewMode] = useState('fplan');
  const [weatherOn, setWeatherOn] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'flightmap-ready') setIframeReady(true);
      if (e.data?.type === 'flightmap-distances') setMapDistances(e.data.payload);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (!iframeReady || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({
      type: 'flightmap-update',
      payload: {
        flightData, contract, waypoints, routeWaypoints, staticMode,
        flightPath, departureRunway, arrivalRunway, departureCoords, arrivalCoords,
        viewMode, liveFlightData, lang, weatherOn, flightEventsLog
      }
    }, '*');
  }, [iframeReady, flightData, contract, waypoints, routeWaypoints, staticMode, flightPath, departureRunway, arrivalRunway, departureCoords, arrivalCoords, viewMode, liveFlightData, lang, weatherOn, flightEventsLog]);

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

  // Bottom bar height for padding the events overlay
  const bottomBarHeight = 72;

  return (
    <Card className={`bg-slate-800/50 border-slate-700 overflow-hidden rounded-lg ${isFullscreen ? 'fixed inset-0 z-[9999] bg-slate-900 flex flex-col' : ''}`} style={isFullscreen ? { borderRadius: 0 } : {}}>
      <div className="p-3 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">{title || (staticMode ? 'Flight Route' : 'Live Map')}</h3>
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
            <>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 text-xs font-mono ${weatherOn ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-white border border-slate-600'}`}
                onClick={() => setWeatherOn(prev => !prev)}
              >
                <CloudSun className="w-3.5 h-3.5 mr-1" />
                {weatherOn ? t('weather_on', lang) : t('weather_off', lang)}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 text-xs font-mono ${viewMode === 'follow' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white border border-slate-600'}`}
                onClick={() => {
                  const next = viewMode === 'fplan' ? 'follow' : 'fplan';
                  setViewMode(next);
                }}
              >
                {viewMode === 'follow' ? <LocateFixed className="w-3.5 h-3.5 mr-1" /> : <Map className="w-3.5 h-3.5 mr-1" />}
                {viewMode === 'follow' ? 'FOLLOW' : 'F-PLN'}
              </Button>
            </>
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

      {!staticMode && (
        <div className={`px-3 py-2 bg-slate-900/90 font-mono space-y-1.5 ${isFullscreen ? 'fixed bottom-0 left-0 right-0 z-[10000]' : ''}`}>
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
  #map { width: 100%; height: 100%; }
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
  .evt-marker { display:flex; align-items:center; justify-content:center; border-radius:50%; font-size:11px; font-weight:bold; font-family:'Courier New',monospace; cursor:pointer; }
  .leaflet-div-icon { background:transparent !important; border:none !important; }
  .evt-marker-wrap { pointer-events:auto !important; cursor:pointer !important; }
  .evt-label { font-size:10px; font-family:'Courier New',monospace; padding:1px 5px; border-radius:3px; background:rgba(15,23,42,0.92); white-space:nowrap; letter-spacing:0.3px; }
  .dark-popup .leaflet-popup-content-wrapper { background:transparent; border:none; box-shadow:none; padding:0; border-radius:6px; }
  .dark-popup .leaflet-popup-content { margin:0; }
  .dark-popup .leaflet-popup-tip { background:#0f172a; }

  /* HUD overlay - top center, enlarged in fullscreen */
  #hud-top { position:absolute; top:8px; left:50%; transform:translateX(-50%); z-index:1000; display:flex; gap:6px; pointer-events:none; }
  #hud-top .hud-cell { background:rgba(10,20,40,0.85); backdrop-filter:blur(8px); border:1px solid rgba(34,211,238,0.25); border-radius:6px; padding:4px 10px; display:flex; align-items:center; gap:6px; font-family:'Courier New',monospace; }
  #hud-top .hud-label { font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:1px; }
  #hud-top .hud-val { font-size:13px; font-weight:bold; }
  #hud-top.fs .hud-cell { padding:8px 16px; gap:8px; border-radius:8px; }
  #hud-top.fs .hud-label { font-size:11px; }
  #hud-top.fs .hud-val { font-size:18px; }
  .hud-cyan { color:#22d3ee; }
  .hud-green { color:#34d399; }
  .hud-amber { color:#fbbf24; }
  .hud-red { color:#f87171; }

  /* Events overlay - bottom left, pushed up when bottom bar visible */
  #events-overlay { position:absolute; bottom:12px; left:12px; z-index:1000; pointer-events:none; max-width:320px; transition:bottom 0.2s; }
  #events-overlay .ev-card { background:rgba(10,20,40,0.88); backdrop-filter:blur(12px); border:1px solid rgba(248,113,113,0.35); border-radius:8px; padding:10px 14px; font-family:'Courier New',monospace; }
  #events-overlay .ev-title { font-size:12px; color:#f87171; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:6px; display:flex; align-items:center; gap:5px; font-weight:bold; }
  #events-overlay .ev-item { font-size:13px; color:#fca5a5; padding:2px 0; display:flex; align-items:center; gap:6px; }
  #events-overlay .ev-detail { font-size:11px; color:#94a3b8; margin-left:11px; padding:1px 0; }
  #events-overlay .ev-dot { width:6px; height:6px; border-radius:50%; background:#f87171; flex-shrink:0; }
  #weather-overlay { position:absolute; top:12px; right:12px; z-index:1000; pointer-events:none; display:none; }
  #weather-overlay .wx-card { background:rgba(10,20,40,0.88); backdrop-filter:blur(10px); border:1px solid rgba(56,189,248,0.35); border-radius:8px; padding:8px 10px; font-family:'Courier New',monospace; min-width:220px; }
  #weather-overlay .wx-title { color:#7dd3fc; font-size:10px; letter-spacing:1.2px; text-transform:uppercase; margin-bottom:6px; font-weight:bold; }
  #weather-overlay .wx-row { display:flex; justify-content:space-between; gap:8px; font-size:11px; color:#cbd5e1; line-height:1.35; }
  #weather-overlay .wx-val { color:#f8fafc; font-weight:bold; }
  #weather-overlay .wx-wind-arrow { display:inline-block; transition:transform 0.3s ease; }
  #weather-overlay .wx-precip-bar { height:4px; border-radius:2px; margin-top:3px; transition:width 0.3s, background 0.3s; }

  /* Rain drops overlay */
  #rain-overlay { position:absolute; top:0; left:0; width:100%; height:100%; z-index:800; pointer-events:none; overflow:hidden; display:none; }
  .rain-drop { position:absolute; width:2px; border-radius:1px; opacity:0.7; animation:rain-fall linear infinite; }
  @keyframes rain-fall { 0% { transform:translateY(-20px); opacity:0.7; } 100% { transform:translateY(100vh); opacity:0; } }

  /* Wind overlay */
  #wind-overlay { position:absolute; bottom:60px; right:12px; z-index:1000; pointer-events:none; display:none; }
  #wind-overlay .wind-card { background:rgba(10,20,40,0.85); backdrop-filter:blur(10px); border:1px solid rgba(56,189,248,0.3); border-radius:50%; width:80px; height:80px; display:flex; align-items:center; justify-content:center; position:relative; }
  #wind-overlay .wind-label { position:absolute; bottom:-18px; left:50%; transform:translateX(-50%); font-size:10px; color:#94a3b8; font-family:'Courier New',monospace; white-space:nowrap; }
</style>
</head><body>
<div id="map"></div>
<div id="hud-top" style="display:none;"></div>
<div id="events-overlay" style="display:none;"></div>
<div id="weather-overlay" style="display:none;"></div>
<div id="rain-overlay" style="display:none;"></div>
<div id="wind-overlay" style="display:none;"></div>
<script>
var map = L.map('map', { zoomControl: false, attributionControl: false, tap: true, center: [50, 10], zoom: 5, fadeAnimation: false, markerZoomAnimation: false, zoomAnimation: false });
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
setTimeout(function(){ map.invalidateSize(); }, 100);

var layers = {
  route: null,
  routeGlow: null,
  flown: null,
  dep: null,
  arr: null,
  aircraft: null,
  wpGroup: L.layerGroup().addTo(map),
  evtGroup: L.layerGroup().addTo(map),
  depRwyLine: null,
  arrRwyLine: null,
  weatherClouds: null,
  weatherPrecip: null,
  weatherRainRing: null,
  weatherTurbRing: null,
  rainCellsGroup: L.layerGroup().addTo(map)
};
var boundsSet = false;
var userInteracting = false;
var interactionTimeout = null;
var INTERACTION_COOLDOWN = 15000;
var currentViewMode = 'fplan';
var isFullscreen = false;
var lastFd = {};
var followZoom = 14;
var currentLang = 'en';

map.on('dragstart', function() {
  if (currentViewMode === 'follow') return;
  userInteracting = true;
  if (interactionTimeout) clearTimeout(interactionTimeout);
  interactionTimeout = setTimeout(function() { userInteracting = false; }, INTERACTION_COOLDOWN);
});

function makeIcon(bg, size, border, glow) {
  var shadow = glow ? 'box-shadow:0 0 10px '+bg+';' : '';
  return L.divIcon({ html: '<div style="background:'+bg+';width:'+size+'px;height:'+size+'px;border-radius:50%;border:2px solid '+border+';'+shadow+'"></div>', className: '', iconSize: [size, size], iconAnchor: [size/2, size/2] });
}
function makeAircraftIcon(hdg) {
  var rot = hdg||0;
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

function updateHUD(fd, live) {
  var el = document.getElementById('hud-top');
  if (!el || !isFullscreen || !live) { if(el) el.style.display='none'; return; }
  el.style.display = 'flex';
  el.className = isFullscreen ? 'fs' : '';
  el.id = 'hud-top';
  
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

function updateEvents(evts) {
  var el = document.getElementById('events-overlay');
  if (!el) return;
  if (!evts) { el.style.display = 'none'; return; }
  
  // Push events overlay up when fullscreen to avoid bottom bar overlap (bar ~72px)
  el.style.bottom = isFullscreen ? '80px' : '12px';
  
  var de = currentLang === 'de';
  var nv = de ? 'Neuwert' : 'new value';
  var rv = de ? 'Einnahmen' : 'revenue';
  var costLabel = de ? 'Kosten' : 'Cost';
  
  var items = [];
  if (evts.crash)           items.push({name:'CRASH',                                    score:'-100', cost:'70% '+nv});
  if (evts.tailstrike)      items.push({name:de?'Heckaufsetzer':'Tailstrike',            score:'-20',  cost:'2% '+nv});
  if (evts.stall)           items.push({name:de?'Strömungsabriss':'Stall',               score:'-50',  cost:null});
  if (evts.overstress)      items.push({name:de?'Strukturschaden':'Structural damage',   score:'-30',  cost:'4% '+nv});
  if (evts.overspeed)       items.push({name:'Overspeed',                                score:'-15',  cost:null});
  if (evts.flaps_overspeed) items.push({name:de?'Klappen-Overspeed':'Flaps overspeed',  score:'-15', cost:'2.5% '+nv});
  if (evts.gear_up_landing) items.push({name:de?'Fahrwerk eingef.':'Gear retracted',    score:'-35', cost:'15% '+nv});
  if (evts.high_g_force)    items.push({name:de?'Hohe G-Kräfte':'High G-forces',        score:'-10+', cost:'1%+ '+nv});
  if (evts.hard_landing)    items.push({name:de?'Harte Landung':'Hard landing',          score:'-30',  cost:'25% '+rv});
  if (evts.harsh_controls)  items.push({name:de?'Ruppige Steuerung':'Harsh controls',   score:'—',  cost:null});
  if (evts.fuel_emergency)  items.push({name:de?'Treibstoff-Not':'Fuel emergency',      score:'—',    cost:null});
  
  if (items.length === 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  var ttl = de ? 'VORFÄLLE' : 'INCIDENTS';
  var html = '<div class="ev-card"><div class="ev-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'+ttl+'</div>';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    html += '<div class="ev-item"><div class="ev-dot"></div>' + it.name + '</div>';
    var details = '';
    if (it.score && it.score !== '—') details += '<span style="color:#f87171;">Score: ' + it.score + '</span>';
    if (it.cost) details += (details ? ' · ' : '') + '<span style="color:#fbbf24;">'+costLabel+': ' + it.cost + '</span>';
    if (details) html += '<div class="ev-detail">' + details + '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function pickFinite() {
  for (var i = 0; i < arguments.length; i++) {
    var n = Number(arguments[i]);
    if (isFinite(n)) return n;
  }
  return null;
}

function norm01(v) {
  if (v === null || v === undefined) return null;
  var n = Number(v);
  if (!isFinite(n)) return null;
  if (n > 1) n = n / 100;
  if (n < 0) n = 0;
  if (n > 1) n = 1;
  return n;
}

function turbColor(t) {
  if (t < 0.2) return '#34d399';
  if (t < 0.4) return '#facc15';
  if (t < 0.7) return '#f97316';
  return '#ef4444';
}

function rainColor(intensity) {
  if (intensity < 0.2) return '#60a5fa'; // light blue
  if (intensity < 0.5) return '#3b82f6'; // medium blue
  if (intensity < 0.75) return '#f59e0b'; // amber (heavy)
  return '#ef4444'; // red (extreme)
}

function precipLabel(rain) {
  if (rain < 0.1) return 'Light';
  if (rain < 0.3) return 'Moderate';
  if (rain < 0.6) return 'Heavy';
  return 'Extreme';
}

function updateRainOverlay(weatherOn, rain) {
  var el = document.getElementById('rain-overlay');
  if (!el) return;
  if (!weatherOn || rain === null || rain < 0.02) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  el.style.display = 'block';
  // Number of drops scales with intensity
  var dropCount = Math.round(20 + rain * 180);
  var color = rainColor(rain);
  var html = '';
  for (var i = 0; i < dropCount; i++) {
    var left = Math.random() * 100;
    var delay = Math.random() * 2;
    var dur = 0.6 + Math.random() * 0.8 - (rain * 0.3); // faster in heavy rain
    var h = 8 + Math.random() * 12 + rain * 10;
    var opacity = 0.3 + rain * 0.5;
    html += '<div class="rain-drop" style="left:'+left.toFixed(1)+'%;height:'+h.toFixed(0)+'px;background:'+color+';opacity:'+opacity.toFixed(2)+';animation-duration:'+dur.toFixed(2)+'s;animation-delay:'+delay.toFixed(2)+'s;"></div>';
  }
  el.innerHTML = html;
}

function updateWindOverlay(weatherOn, fd) {
  var el = document.getElementById('wind-overlay');
  if (!el) return;
  var windSpd = pickFinite(fd.wind_speed_kts, fd.wind_speed, fd.ambient_wind_velocity);
  var windDir = pickFinite(fd.wind_direction, fd.ambient_wind_direction);
  if (!weatherOn || windSpd === null || windSpd < 1) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  // Color based on wind strength
  var wCol = windSpd < 15 ? '#34d399' : windSpd < 30 ? '#fbbf24' : windSpd < 50 ? '#f97316' : '#ef4444';
  // Arrow length scales with wind speed
  var arrowLen = Math.min(30, 12 + windSpd * 0.4);
  var rot = windDir !== null ? windDir : 0;
  // SVG arrow pointing up (north), rotated by wind direction (FROM direction, so arrow points the way wind blows)
  var svg = '<svg width="60" height="60" viewBox="0 0 60 60" style="transform:rotate('+(rot+180)+'deg);transition:transform 0.5s;">' +
    '<line x1="30" y1="'+(30+arrowLen)+'" x2="30" y2="'+(30-arrowLen)+'" stroke="'+wCol+'" stroke-width="3" stroke-linecap="round"/>' +
    '<polygon points="30,'+(30-arrowLen-4)+' '+(30-6)+','+(30-arrowLen+6)+' '+(30+6)+','+(30-arrowLen+6)+'" fill="'+wCol+'"/>' +
    '</svg>';
  el.innerHTML = '<div class="wind-card" style="border-color:'+wCol+'44;">' + svg + '</div>' +
    '<div class="wind-label" style="color:'+wCol+'">' + Math.round(windSpd) + ' kts' + (windDir !== null ? ' / ' + Math.round(windDir) + '°' : '') + '</div>';
}

function updateWeatherOverlay(weatherOn, fd, curPos) {
  var panel = document.getElementById('weather-overlay');
  if (!panel) return;

  if (!weatherOn || !curPos) {
    panel.style.display = 'none';
    if (layers.weatherTurbRing) { map.removeLayer(layers.weatherTurbRing); layers.weatherTurbRing = null; }
    updateRainCells(false, null, null);
    updateRainOverlay(false, null);
    updateWindOverlay(false, fd);
    return;
  }

  var tat = pickFinite(fd.tat_c, fd.tat, fd.total_air_temp_c, fd.total_air_temperature);
  var oat = pickFinite(fd.oat_c, fd.ambient_temperature);
  var precipState = pickFinite(fd.precip_state, fd.ambient_precip_state, fd.precipitation_state);
  var hasRainMask = precipState !== null && ((Math.round(precipState) & 4) === 4);
  var hasConvectiveMask = precipState !== null && (((Math.round(precipState) & 8) === 8) || ((Math.round(precipState) & 16) === 16));
  var rainDetectedFlag = !!fd.rain_detected;
  var rain = norm01(pickFinite(fd.rain_intensity, fd.precipitation, fd.rain, fd.precip_rate));
  var turb = norm01(pickFinite(fd.turbulence, fd.turbulence_intensity, fd.sim_weather_turbulence));
  var windSpd = pickFinite(fd.wind_speed_kts, fd.wind_speed, fd.ambient_wind_velocity);
  var windDir = pickFinite(fd.wind_direction, fd.ambient_wind_direction);
  var baro = pickFinite(fd.baro_setting, fd.kohlsman_setting_mb);
  if ((rain === null || rain < 0.01) && (rainDetectedFlag || hasRainMask || hasConvectiveMask)) {
    var windHint = windSpd !== null ? Math.min(1, Math.max(0.1, windSpd / 85)) : 0.1;
    var turbHint = turb !== null ? Math.min(1, Math.max(0.1, turb * 0.65)) : 0.1;
    rain = Math.max(0.1, windHint, turbHint);
  }

  // Rain visual effects
  updateRainOverlay(weatherOn, rain);
  updateWindOverlay(weatherOn, fd);

  panel.style.display = 'block';
  var rCol = rain !== null ? rainColor(rain) : '#64748b';
  var rLabel = rain !== null ? precipLabel(rain) : '--';
  var wCol = windSpd !== null ? (windSpd < 15 ? '#34d399' : windSpd < 30 ? '#fbbf24' : '#f97316') : '#64748b';
  var windArrow = windDir !== null ? '<span class="wx-wind-arrow" style="transform:rotate('+(windDir+180)+'deg);color:'+wCol+';">↑</span> ' : '';

  panel.innerHTML =
    '<div class="wx-card">' +
      '<div class="wx-title">☁ WEATHER</div>' +
      (oat !== null ? '<div class="wx-row"><span>OAT</span><span class="wx-val">' + Math.round(oat) + '°C</span></div>' : '') +
      (tat !== null ? '<div class="wx-row"><span>TAT</span><span class="wx-val">' + Math.round(tat) + '°C</span></div>' : '') +
      (baro !== null ? '<div class="wx-row"><span>QNH</span><span class="wx-val">' + Math.round(baro) + ' mb</span></div>' : '') +
      '<div class="wx-row"><span>Wind</span><span class="wx-val" style="color:'+wCol+'">' + windArrow + (windSpd !== null ? Math.round(windSpd) + ' kts' : '--') + (windDir !== null ? ' / ' + Math.round(windDir) + '°' : '') + '</span></div>' +
      '<div class="wx-row"><span>Precip</span><span class="wx-val" style="color:'+rCol+'">' + rLabel + (rain !== null && rain > 0 ? ' (' + Math.round(rain*100) + '%)' : '') + '</span></div>' +
      (rain !== null && rain > 0 ? '<div class="wx-precip-bar" style="width:'+Math.round(rain*100)+'%;background:'+rCol+';"></div>' : '') +
      '<div class="wx-row"><span>Turb</span><span class="wx-val" style="color:'+turbColor(turb || 0)+'">' + (turb !== null ? Math.round(turb*100)+'%' : '--') + '</span></div>' +
    '</div>';

  // Realistic rain cells within 60 NM radius
  updateRainCells(
    weatherOn && ((rain !== null && rain > 0.01) || (turb !== null && turb > 0.45) || hasConvectiveMask),
    rain,
    curPos,
    turb,
    hasConvectiveMask
  );

  if (turb !== null && turb > 0.01) {
    var turbRadius = 1200 + (turb * 7000);
    var tColor = turbColor(turb);
    if (!layers.weatherTurbRing) {
      layers.weatherTurbRing = L.circle(curPos, {
        radius: turbRadius,
        color: tColor,
        weight: 2,
        fillColor: tColor,
        fillOpacity: 0.02 + (turb * 0.08),
        dashArray: '8,4'
      }).addTo(map);
    } else {
      layers.weatherTurbRing.setLatLng(curPos);
      layers.weatherTurbRing.setRadius(turbRadius);
      layers.weatherTurbRing.setStyle({
        color: tColor,
        fillColor: tColor,
        fillOpacity: 0.02 + (turb * 0.08)
      });
    }
  } else if (layers.weatherTurbRing) {
    map.removeLayer(layers.weatherTurbRing);
    layers.weatherTurbRing = null;
  }
}

// Seeded PRNG for deterministic rain cell positions (changes every ~10s)
var rainSeedEpoch = 0;
var rainCellCache = [];
function seededRandom(seed) { var x = Math.sin(seed) * 10000; return x - Math.floor(x); }
function generateRainCellPositions(lat, lon, rain, epoch) {
  // Number of cells scales with rain intensity: 4-18 cells
  var cellCount = Math.round(4 + rain * 14);
  var cells = [];
  var NM60_DEG = 60 / 60; // 60 NM in degrees latitude (~1 degree)
  for (var i = 0; i < cellCount; i++) {
    var s = epoch * 100 + i;
    // Random angle and distance within 60 NM
    var angle = seededRandom(s) * 2 * Math.PI;
    var dist = (0.15 + seededRandom(s + 1) * 0.85) * NM60_DEG; // 15%-100% of 60NM
    var cLat = lat + dist * Math.cos(angle);
    var cLon = lon + dist * Math.sin(angle) / Math.cos(lat * Math.PI / 180);
    // Cell size: 3-15 NM radius, heavier rain = bigger cells
    var cellRadiusNm = 3 + seededRandom(s + 2) * 12 * rain;
    var cellRadiusM = cellRadiusNm * 1852;
    // Cell intensity varies: 40%-120% of base rain
    var cellIntensity = Math.min(1, rain * (0.4 + seededRandom(s + 3) * 0.8));
    cells.push({ lat: cLat, lon: cLon, radius: cellRadiusM, intensity: cellIntensity });
  }
  return cells;
}

function updateRainCells(active, rain, curPos, turb, hasConvectiveMask) {
  var rainLevel = rain;
  if ((rainLevel === null || rainLevel < 0.01) && hasConvectiveMask) {
    rainLevel = 0.22;
  }
  if ((rainLevel === null || rainLevel < 0.01) && turb !== null && turb > 0.45) {
    rainLevel = Math.min(0.55, 0.10 + (turb * 0.6));
  }
  if (!active || !curPos || rainLevel === null || rainLevel < 0.01) {
    layers.rainCellsGroup.clearLayers();
    rainCellCache = [];
    rainSeedEpoch = 0;
    return;
  }
  // Regenerate cell positions every ~10 seconds (slow drift)
  var newEpoch = Math.floor(Date.now() / 10000);
  if (newEpoch !== rainSeedEpoch || rainCellCache.length === 0) {
    rainSeedEpoch = newEpoch;
    rainCellCache = generateRainCellPositions(curPos[0], curPos[1], rainLevel, newEpoch);
  }
  layers.rainCellsGroup.clearLayers();
  for (var i = 0; i < rainCellCache.length; i++) {
    var c = rainCellCache[i];
    var col = rainColor(c.intensity);
    var fillOp = 0.08 + c.intensity * 0.22;
    // Each rain cell is an irregular shape approximated by an ellipse (circle with slight offset)
    L.circle([c.lat, c.lon], {
      radius: c.radius,
      color: col,
      weight: 1,
      fillColor: col,
      fillOpacity: fillOp,
      dashArray: null,
      interactive: false
    }).addTo(layers.rainCellsGroup);
    // Add a smaller core for heavier cells
    if (c.intensity > 0.3) {
      L.circle([c.lat, c.lon], {
        radius: c.radius * 0.4,
        color: col,
        weight: 0,
        fillColor: col,
        fillOpacity: fillOp * 1.5,
        interactive: false
      }).addTo(layers.rainCellsGroup);
    }
  }
}

function update(d) {
  var fd = d.flightData || {};
  lastFd = fd;
  var contract = d.contract;
  var waypoints = (d.waypoints || []).filter(function(w){return w.lat && w.lon;});
  var routeWaypoints = (d.routeWaypoints || []).filter(function(w){return w.lat && w.lon;});
  var rawFlightPath = d.flightPath || [];
  var flightPath = (Array.isArray(rawFlightPath) ? rawFlightPath : [])
    .map(function(p){
      if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])];
      if (p && typeof p === 'object') {
        var la = Number(p.lat ?? p.latitude);
        var lo = Number(p.lon ?? p.lng ?? p.longitude);
        return [la, lo];
      }
      return null;
    })
    .filter(function(p){
      return p && isFinite(p[0]) && isFinite(p[1]) && !(p[0] === 0 && p[1] === 0);
    });
  var staticMode = d.staticMode;
  var depCoords = d.departureCoords;
  var arrCoords = d.arrivalCoords;
  var depRwy = d.departureRunway;
  var arrRwy = d.arrivalRunway;
  var prevMode = currentViewMode;
  currentViewMode = d.viewMode || 'fplan';
  var live = d.liveFlightData;
  if (d.lang) currentLang = d.lang;

  // Weather layer toggle
  if (d.weatherOn) {
    if (!layers.weatherClouds) {
      layers.weatherClouds = L.tileLayer('https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2', { maxZoom: 18, opacity: 0.45 });
    }
    if (!layers.weatherPrecip) {
      layers.weatherPrecip = L.tileLayer('https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2', { maxZoom: 18, opacity: 0.55 });
    }
    if (!map.hasLayer(layers.weatherClouds)) layers.weatherClouds.addTo(map);
    if (!map.hasLayer(layers.weatherPrecip)) layers.weatherPrecip.addTo(map);
  } else {
    if (layers.weatherClouds && map.hasLayer(layers.weatherClouds)) map.removeLayer(layers.weatherClouds);
    if (layers.weatherPrecip && map.hasLayer(layers.weatherPrecip)) map.removeLayer(layers.weatherPrecip);
  }

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
  // Merge weather data from liveFlightData into fd for weather overlay
  var wxFd = Object.assign({}, fd);
  if (live && live.weather) { Object.assign(wxFd, live.weather); }
  updateWeatherOverlay(d.weatherOn, wxFd, curPos);

  var routeSource = routeWaypoints.length > 0 ? routeWaypoints : waypoints;

  var rp = [];
  if (depPos) rp.push(depPos);
  routeSource.forEach(function(w){ rp.push([w.lat, w.lon]); });
  if (arrPos) rp.push(arrPos);
  if (rp.length < 2 && depPos && arrPos) rp = [depPos, arrPos];

  if (layers.routeGlow) map.removeLayer(layers.routeGlow);
  if (layers.route) map.removeLayer(layers.route);
  if (rp.length >= 2) {
    layers.routeGlow = L.polyline(rp, { color:'#818cf8', weight:8, dashArray:'8,8', opacity:0.18 }).addTo(map);
    layers.route = L.polyline(rp, { color:'#818cf8', weight:3.5, dashArray:'10,8', opacity:0.75 }).addTo(map);
  }

  var fp = [];
  if (flightPath && flightPath.length > 1) fp = flightPath;
  else if (!staticMode) { if(depPos) fp.push(depPos); if(curPos) fp.push(curPos); }

  if (layers.flown) map.removeLayer(layers.flown);
  if (fp.length >= 2) {
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

  var showWpLabels = map.getZoom() >= 10;
  layers.wpGroup.clearLayers();
  if (waypoints.length > 0) {
    waypoints.forEach(function(wp, i) {
      var passed = false;
      if (curPos && rp.length >= 2) {
        var wbs=0,wbd=Infinity;for(var s=0;s<rp.length-1;s++){var r=ptSeg(wp.lat,wp.lon,rp[s][0],rp[s][1],rp[s+1][0],rp[s+1][1]);if(r.dist<wbd){wbd=r.dist;wbs=s;}}
        if(wbs<closestSegIdx) passed=true;
        else if(wbs===closestSegIdx&&haversineNm(rp[wbs][0],rp[wbs][1],wp.lat,wp.lon)<haversineNm(rp[wbs][0],rp[wbs][1],curPos[0],curPos[1])) passed=true;
      }
      var m = L.marker([wp.lat, wp.lon], { icon: wpIcon(wp.is_active, passed) }).addTo(layers.wpGroup);
      if (showWpLabels) {
        var cls = passed ? 'wpl wpl-fms-passed' : (wp.is_active ? 'wpl wpl-fms-active' : 'wpl wpl-fms');
        var txt = (wp.is_active ? '▸ ' : '') + (wp.name || 'WPT '+(i+1)) + (wp.alt > 0 ? ' FL'+Math.round(wp.alt/100) : '');
        m.bindTooltip('<span class="'+cls+'">'+txt+'</span>', { permanent:true, direction:'top', offset:[0,-6], className:'clean-tooltip' });
      }
    });
  }
  if (routeWaypoints.length > 0) {
    routeWaypoints.forEach(function(wp) {
      var m = L.marker([wp.lat, wp.lon], { icon: routeWpIcon }).addTo(layers.wpGroup);
      if (showWpLabels) {
        m.bindTooltip('<span class="wpl wpl-route">'+wp.name+(wp.alt>0?' FL'+Math.round(wp.alt/100):'')+'</span>', { permanent:true, direction:'top', offset:[0,-6], className:'clean-tooltip' });
      }
    });
  }

  // Flight events log markers.
  // Live mode: derive marker points from trusted live event flags (same source as side panels).
  // Static mode: use stored historical event log from backend.
  var evtLogRaw = [];
  if (!staticMode) {
    layers._liveIncidentLog = Array.isArray(layers._liveIncidentLog) ? layers._liveIncidentLog : [];
    layers._liveIncidentState = layers._liveIncidentState || {};
    var liveIncidentTypes = ['crash', 'tailstrike', 'stall', 'overstress', 'high_g_force', 'overspeed', 'flaps_overspeed', 'gear_up_landing', 'harsh_controls', 'touchdown'];
    if (!live || !live.wasAirborne) {
      layers._liveIncidentLog = [];
      layers._liveIncidentState = {};
    } else if (curPos && live.events) {
      for (var li = 0; li < liveIncidentTypes.length; li++) {
        var lType = liveIncidentTypes[li];
        var isNowOn = !!live.events[lType];
        var wasOn = !!layers._liveIncidentState[lType];
        if (isNowOn && !wasOn) {
          layers._liveIncidentLog.push({
            type: lType,
            lat: Number(curPos[0]),
            lon: Number(curPos[1]),
            alt: Number(fd.altitude || 0),
            spd: Number(fd.speed || 0),
            vs: Number(fd.verticalSpeed || 0),
            g: Number((live.gForce || fd.gForce || 1).toFixed ? (live.gForce || fd.gForce || 1).toFixed(2) : (live.gForce || fd.gForce || 1)),
            t: new Date().toISOString()
          });
        }
        layers._liveIncidentState[lType] = isNowOn;
      }
      if (layers._liveIncidentLog.length > 180) {
        layers._liveIncidentLog = layers._liveIncidentLog.slice(-180);
      }
    }
    // Prefer backend log in live mode (contains control-surface events like flaps/gear).
    // Fall back to incident-only local log if backend log is temporarily empty.
    var liveBackendEvtLog = Array.isArray(d.flightEventsLog) ? d.flightEventsLog : [];
    evtLogRaw = liveBackendEvtLog.length > 0 ? liveBackendEvtLog : layers._liveIncidentLog;
  } else {
    evtLogRaw = Array.isArray(d.flightEventsLog) ? d.flightEventsLog : [];
  }
  var normalizeEvtType = function(v) {
    var tp = String(v || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!tp) return '';
    if (tp === 'crashed' || tp === 'has_crashed') return 'crash';
    if (tp === 'spoiler' || tp === 'speedbrake_on') return 'spoiler_on';
    if (tp === 'speedbrake_off') return 'spoiler_off';
    return tp;
  };
  var dedupeCfg = {
    crash: { cooldownSec: 10, minNm: 0.02 },
    tailstrike: { cooldownSec: 10, minNm: 0.02 },
    stall: { cooldownSec: 10, minNm: 0.02 },
    gear_up_landing: { cooldownSec: 10, minNm: 0.02 },
    overstress: { cooldownSec: 10, minNm: 0.02 },
    high_g_force: { cooldownSec: 10, minNm: 0.02 },
    overspeed: { cooldownSec: 10, minNm: 0.02 },
    flaps_overspeed: { cooldownSec: 10, minNm: 0.02 },
    harsh_controls: { cooldownSec: 10, minNm: 0.02 },
    touchdown: { cooldownSec: 10, minNm: 0.02 },
    flaps: { cooldownSec: 3, minNm: 0.005 },
    gear_up: { cooldownSec: 3, minNm: 0.005 },
    gear_down: { cooldownSec: 3, minNm: 0.005 },
    spoiler_on: { cooldownSec: 3, minNm: 0.005 },
    spoiler_off: { cooldownSec: 3, minNm: 0.005 },
    _default: { cooldownSec: 60, minNm: 0.5 }
  };
  // Map markers: include incidents + control-surface transitions for full flight timeline.
  var markerAllowedTypes = {
    crash: true,
    tailstrike: true,
    stall: true,
    overstress: true,
    high_g_force: true,
    overspeed: true,
    flaps_overspeed: true,
    gear_up_landing: true,
    harsh_controls: true,
    touchdown: true,
    flaps: true,
    gear_up: true,
    gear_down: true,
    spoiler_on: true,
    spoiler_off: true
  };
  var incidentTypes = {
    crash: true,
    tailstrike: true,
    stall: true,
    overstress: true,
    high_g_force: true,
    overspeed: true,
    flaps_overspeed: true,
    gear_up_landing: true,
    harsh_controls: true,
    touchdown: true
  };
  // Anti-spam limits for map markers only. This does not change scoring/events elsewhere.
  var incidentMarkerCapByType = {
    crash: 1,
    tailstrike: 1,
    gear_up_landing: 1,
    flaps_overspeed: 2,
    overstress: 2,
    stall: 3,
    overspeed: 3,
    high_g_force: 4,
    harsh_controls: 4,
    touchdown: 2
  };
  var dedupeEventsForMap = function(list) {
    if (staticMode) {
      // Results page: keep historical timeline dense.
      // Only remove true duplicates, do not apply aggressive cooldown filtering.
      var staticSeen = new Set();
      var staticCountByType = {};
      var staticLastByType = {};
      var staticOut = [];
      for (var si = 0; si < list.length; si++) {
        var s = list[si] || {};
        var slat = Number(s.lat);
        var slon = Number(s.lon);
        if (!Number.isFinite(slat) || !Number.isFinite(slon)) continue;
        var stp = normalizeEvtType(s.type || s.event || s.name);
        if (!stp || !markerAllowedTypes[stp]) continue;
        var stsRaw = Date.parse(String(s.t || s.timestamp || ''));
        var sts = Number.isFinite(stsRaw) ? stsRaw : (si * 1000);
        var isIncident = !!incidentTypes[stp];
        if (isIncident) {
          var cap = Number(incidentMarkerCapByType[stp] || 0);
          staticCountByType[stp] = Number(staticCountByType[stp] || 0);
          if (cap > 0 && staticCountByType[stp] >= cap) continue;
          var slast = staticLastByType[stp];
          if (slast) {
            var sdtSec = Math.abs(sts - slast.ts) / 1000;
            var smovedNm = haversineNm(slast.lat, slast.lon, slat, slon);
            // Collapse persistent/latching incidents on results map.
            if (sdtSec < 90 || (sdtSec < 300 && smovedNm < 1.2)) continue;
          }
          staticLastByType[stp] = { ts: sts, lat: slat, lon: slon };
        }
        var sval = (s.val !== undefined && s.val !== null) ? String(s.val) : '';
        var ssig = stp + '|' + slat.toFixed(5) + '|' + slon.toFixed(5) + '|' + Math.floor(sts / 1000) + '|' + sval;
        if (staticSeen.has(ssig)) continue;
        staticSeen.add(ssig);
        if (isIncident) staticCountByType[stp] = Number(staticCountByType[stp] || 0) + 1;
        staticOut.push({
          ...s,
          type: stp,
          lat: slat,
          lon: slon,
          t: Number.isFinite(stsRaw) ? new Date(stsRaw).toISOString() : (s.t || s.timestamp || null)
        });
      }
      return staticOut.length > 360 ? staticOut.slice(-360) : staticOut;
    }

    var byType = {};
    var lastTypeTs = {};
    var seen = new Set();
    var countByType = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var src = list[i] || {};
      var lat = Number(src.lat);
      var lon = Number(src.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      var tp = normalizeEvtType(src.type || src.event || src.name);
      if (!tp) continue;
      if (!markerAllowedTypes[tp]) continue;

      var tsRaw = Date.parse(String(src.t || src.timestamp || ''));
      var ts = Number.isFinite(tsRaw) ? tsRaw : (i * 1000);
      var isIncidentLive = !!incidentTypes[tp];
      if (isIncidentLive) {
        var liveCap = Number(incidentMarkerCapByType[tp] || 0);
        countByType[tp] = Number(countByType[tp] || 0);
        if (liveCap > 0 && countByType[tp] >= liveCap) continue;
      }
      var bucketSig = tp + '|' + lat.toFixed(5) + '|' + lon.toFixed(5) + '|' + Math.floor(ts / 1000);
      if (seen.has(bucketSig)) continue;
      if (tp !== 'flaps') {
        var prevTypeTs = Number(lastTypeTs[tp] || 0);
        if (prevTypeTs > 0 && (ts - prevTypeTs) < 10000) continue;
      }

      var cfg = dedupeCfg[tp] || dedupeCfg._default;
      var prev = byType[tp];
      if (prev) {
        if (cfg.single) continue;
        var dtSec = Math.abs(ts - prev.ts) / 1000;
        var movedNm = haversineNm(prev.lat, prev.lon, lat, lon);
        if (tp === 'flaps' && dtSec < cfg.cooldownSec && movedNm < cfg.minNm) {
          continue;
        }
        if (isIncidentLive && (dtSec < 90 || (dtSec < 300 && movedNm < 1.2))) {
          continue;
        }
      }

      seen.add(bucketSig);
      lastTypeTs[tp] = ts;
      byType[tp] = { ts: ts, lat: lat, lon: lon };
      if (isIncidentLive) countByType[tp] = Number(countByType[tp] || 0) + 1;
      out.push({
        ...src,
        type: tp,
        lat: lat,
        lon: lon,
        t: Number.isFinite(tsRaw) ? new Date(tsRaw).toISOString() : (src.t || src.timestamp || null)
      });
    }
    return out.length > 180 ? out.slice(-180) : out;
  };
  var evtLog = dedupeEventsForMap(evtLogRaw);
  var lastEvt = evtLog.length ? evtLog[evtLog.length - 1] : null;
  var evtSignature = evtLog.length + '|' + (lastEvt ? ((lastEvt.type||'') + '|' + (lastEvt.t||'') + '|' + (lastEvt.lat||'') + '|' + (lastEvt.lon||'')) : '');
  if (evtLog.length !== layers._lastEvtCount || evtSignature !== layers._lastEvtSignature) {
    layers._lastEvtCount = evtLog.length;
    layers._lastEvtSignature = evtSignature;
    layers.evtGroup.clearLayers();
    var evtCfg = {
      gear_down: {icon:'▼',color:'#22d3ee',bg:'rgba(6,78,107,0.85)',label:'GEAR DN'},
      gear_up: {icon:'▲',color:'#22d3ee',bg:'rgba(6,78,107,0.85)',label:'GEAR UP'},
      flaps: {icon:'F',color:'#a78bfa',bg:'rgba(76,29,149,0.85)',label:'FLAPS'},
      spoiler_on: {icon:'S',color:'#fbbf24',bg:'rgba(120,53,15,0.85)',label:'SPD BRK'},
      spoiler_off: {icon:'S',color:'#64748b',bg:'rgba(30,41,59,0.85)',label:'SPD BRK OFF'},
      tailstrike: {icon:'!',color:'#f87171',bg:'rgba(127,29,29,0.85)',label:'TAILSTRIKE'},
      stall: {icon:'!',color:'#f87171',bg:'rgba(127,29,29,0.85)',label:'STALL'},
      overstress: {icon:'!',color:'#fb923c',bg:'rgba(124,45,18,0.85)',label:'OVERSTRESS'},
      high_g_force: {icon:'G',color:'#f59e0b',bg:'rgba(120,53,15,0.85)',label:'HIGH G'},
      overspeed: {icon:'!',color:'#fb923c',bg:'rgba(124,45,18,0.85)',label:'OVERSPEED'},
      flaps_overspeed: {icon:'!',color:'#fb923c',bg:'rgba(124,45,18,0.85)',label:'FLAP OVSPD'},
      gear_up_landing: {icon:'!',color:'#f43f5e',bg:'rgba(131,24,67,0.90)',label:'GEAR-UP LDG'},
      harsh_controls: {icon:'!',color:'#f59e0b',bg:'rgba(120,53,15,0.85)',label:'HARSH CTRL'},
      crash: {icon:'✕',color:'#ef4444',bg:'rgba(127,29,29,0.95)',label:'CRASH'}
    };
    for (var ei = 0; ei < evtLog.length; ei++) {
      var ev = evtLog[ei];
      var evLat = Number(ev.lat), evLon = Number(ev.lon);
      if (!Number.isFinite(evLat) || !Number.isFinite(evLon)) continue;
      var cfg = evtCfg[ev.type] || {icon:'•',color:'#94a3b8',bg:'rgba(30,41,59,0.85)',label:ev.type};
      var lbl = cfg.label;
      if (ev.type === 'flaps' && ev.val !== undefined) lbl = 'FLAPS ' + ev.val + '%';
      var sz = (ev.type === 'crash' || ev.type === 'tailstrike' || ev.type === 'stall') ? 20 : 16;
      var evIcon = L.divIcon({
        html: '<div class="evt-marker evt-marker-wrap" style="width:'+sz+'px;height:'+sz+'px;background:'+cfg.bg+';border:1.5px solid '+cfg.color+';color:'+cfg.color+';box-shadow:0 0 6px '+cfg.color+'44;">'+cfg.icon+'</div>',
        className:'evt-marker-wrap', iconSize:[sz,sz], iconAnchor:[sz/2,sz/2]
      });
      var evM = L.marker([evLat, evLon], { icon: evIcon, zIndexOffset: 500, interactive: true, bubblingMouseEvents: false }).addTo(layers.evtGroup);
      var popupHtml = '<div style="background:#0f172a;color:#e2e8f0;padding:8px 12px;border-radius:6px;border:1px solid '+cfg.color+'66;font-family:Courier New,monospace;font-size:12px;min-width:140px;">' +
        '<div style="color:'+cfg.color+';font-weight:bold;font-size:13px;margin-bottom:4px;">'+cfg.icon+' '+lbl+'</div>' +
        (ev.alt ? '<div style="color:#94a3b8;font-size:11px;">ALT: '+Math.round(ev.alt).toLocaleString()+' ft</div>' : '') +
        (ev.spd ? '<div style="color:#94a3b8;font-size:11px;">SPD: '+Math.round(ev.spd)+' kts</div>' : '') +
        (ev.gs ? '<div style="color:#94a3b8;font-size:11px;">GS: '+Math.round(ev.gs)+' kts</div>' : '') +
        (ev.vs ? '<div style="color:#94a3b8;font-size:11px;">V/S: '+Math.round(ev.vs)+' ft/min</div>' : '') +
        (ev.g ? '<div style="color:#94a3b8;font-size:11px;">G: '+Number(ev.g).toFixed(2)+'</div>' : '') +
        '</div>';
      evM.bindPopup(popupHtml, { className: 'dark-popup', closeButton: false, offset: [0, -sz/2], autoClose: false, closeOnClick: false });
    }
  }

  // Aircraft marker
  if (layers.aircraft) map.removeLayer(layers.aircraft);
  layers.aircraft = null;
  if (curPos && !staticMode) {
    layers.aircraft = L.marker(curPos, { icon: makeAircraftIcon(fd.heading), zIndexOffset: 1000 }).addTo(map);
  }

  // Camera behavior
  if (currentViewMode === 'follow' && curPos && !staticMode) {
    // Follow mode: center on aircraft, offset slightly behind heading direction, zoom in close
    map.dragging.disable();
    map.scrollWheelZoom.enable();
    
    // Calculate a point slightly behind the aircraft (opposite of heading)
    // This gives a "navi from behind" perspective
    var hdgRad = (fd.heading || 0) * Math.PI / 180;
    var offsetNm = 2; // offset 2NM behind aircraft
    var behindLat = curPos[0] - (offsetNm / 60) * Math.cos(hdgRad);
    var behindLon = curPos[1] - (offsetNm / 60) * Math.sin(hdgRad) / Math.cos(curPos[0] * Math.PI / 180);
    // Center between aircraft and behind point (so aircraft is in upper part of view)
    var centerLat = (curPos[0] + behindLat) / 2;
    var centerLon = (curPos[1] + behindLon) / 2;
    
    // When switching to follow mode, zoom in close; allow user to adjust afterwards
    if (prevMode !== 'follow') followZoom = 14;
    map.setView([centerLat, centerLon], followZoom, { animate: true, duration: 0.8 });
    
    if (prevMode !== 'follow') boundsSet = false;
  } else {
    // F-PLN mode: normal overview behavior
    map.dragging.enable();
    
    if (prevMode === 'follow') {
      boundsSet = false;
    }
    
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
  updateHUD(fd, live);
  updateEvents(live?.events);

  parent.postMessage({ type: 'flightmap-distances', payload: distInfo }, '*');
}

map.on('zoomend', function() {
  if (currentViewMode === 'follow') {
    followZoom = map.getZoom();
  }
});

window.addEventListener('message', function(e) {
  if (e.data?.type === 'flightmap-update') update(e.data.payload);
  if (e.data?.type === 'flightmap-resize') {
    isFullscreen = e.data.isFullscreen || false;
    setTimeout(function(){ map.invalidateSize(); }, 150);
  }
});
parent.postMessage({ type: 'flightmap-ready' }, '*');
<\/script>
</body></html>`;
}
