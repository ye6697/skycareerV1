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
        viewMode, liveFlightData, lang, weatherOn
      }
    }, '*');
  }, [iframeReady, flightData, contract, waypoints, routeWaypoints, staticMode, flightPath, departureRunway, arrivalRunway, departureCoords, arrivalCoords, viewMode, liveFlightData, lang, weatherOn]);

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
</style>
</head><body>
<div id="map"></div>
<div id="hud-top" style="display:none;"></div>
<div id="events-overlay" style="display:none;"></div>
<script>
var map = L.map('map', { zoomControl: false, attributionControl: false, tap: true, center: [50, 10], zoom: 5, fadeAnimation: false, markerZoomAnimation: false, zoomAnimation: false });
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
setTimeout(function(){ map.invalidateSize(); }, 100);

var layers = { route: null, routeGlow: null, flown: null, dep: null, arr: null, aircraft: null, wpGroup: L.layerGroup().addTo(map), depRwyLine: null, arrRwyLine: null, weather: null };
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
  var prevMode = currentViewMode;
  currentViewMode = d.viewMode || 'fplan';
  var live = d.liveFlightData;
  if (d.lang) currentLang = d.lang;

  // Weather layer toggle
  if (d.weatherOn && !layers.weather) {
    layers.weather = L.tileLayer('https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2', { maxZoom: 18, opacity: 0.5 });
    layers.weather.addTo(map);
  } else if (!d.weatherOn && layers.weather) {
    map.removeLayer(layers.weather);
    layers.weather = null;
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
      var cls = passed ? 'wpl wpl-fms-passed' : (wp.is_active ? 'wpl wpl-fms-active' : 'wpl wpl-fms');
      var txt = (wp.is_active ? '▸ ' : '') + (wp.name || 'WPT '+(i+1)) + (wp.alt > 0 ? ' FL'+Math.round(wp.alt/100) : '');
      m.bindTooltip('<span class="'+cls+'">'+txt+'</span>', { permanent:true, direction:'top', offset:[0,-6], className:'clean-tooltip' });
    });
  }
  if (routeWaypoints.length > 0) {
    routeWaypoints.forEach(function(wp) {
      var m = L.marker([wp.lat, wp.lon], { icon: routeWpIcon }).addTo(layers.wpGroup);
      m.bindTooltip('<span class="wpl wpl-route">'+wp.name+(wp.alt>0?' FL'+Math.round(wp.alt/100):'')+'</span>', { permanent:true, direction:'top', offset:[0,-6], className:'clean-tooltip' });
    });
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