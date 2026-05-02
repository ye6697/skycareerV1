import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Wrench, Building2, Map, Plane, Video, Target, Sparkles, Layers, Globe2, ArrowRight, ChevronRight } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.08 } }),
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

/* ───────────────────────── 3D Maintenance Mock ───────────────────────── */
function MaintenancePreview({ lang }) {
  const hotspots = [
    { x: '22%', y: '38%', label: lang === 'de' ? 'Triebwerk' : 'Engine', val: 72, color: 'bg-red-500' },
    { x: '50%', y: '25%', label: lang === 'de' ? 'Avionik' : 'Avionics', val: 18, color: 'bg-emerald-500' },
    { x: '78%', y: '42%', label: lang === 'de' ? 'Hydraulik' : 'Hydraulics', val: 45, color: 'bg-amber-500' },
    { x: '38%', y: '70%', label: lang === 'de' ? 'Fahrwerk' : 'Gear', val: 88, color: 'bg-red-500' },
    { x: '62%', y: '72%', label: lang === 'de' ? 'Zelle' : 'Airframe', val: 32, color: 'bg-amber-500' },
  ];
  return (
    <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/40 border border-slate-700/60">
      {/* tech grid floor */}
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(56,189,248,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.08) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-cyan-500/10 to-transparent" />
      {/* aircraft silhouette (top view) */}
      <svg viewBox="0 0 400 240" className="absolute inset-0 w-full h-full">
        <g fill="#0f172a" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="1.5">
          {/* fuselage */}
          <ellipse cx="200" cy="120" rx="160" ry="14" />
          {/* wing */}
          <path d="M40 120 L200 60 L360 120 L200 138 Z" />
          {/* tail */}
          <path d="M340 120 L385 90 L385 150 Z" />
          {/* h-stab */}
          <path d="M345 120 L365 105 L365 135 Z" fill="#0b1220" />
          {/* engines */}
          <ellipse cx="135" cy="135" rx="12" ry="6" fill="#1e293b" />
          <ellipse cx="265" cy="135" rx="12" ry="6" fill="#1e293b" />
        </g>
      </svg>
      {/* hotspots */}
      {hotspots.map((h, i) => (
        <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: h.x, top: h.y }}>
          <span className={`block w-3 h-3 rounded-full ${h.color} ring-4 ring-black/40 animate-pulse`} />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-slate-200">
            {h.label} <span className={h.val > 60 ? 'text-red-400' : h.val > 40 ? 'text-amber-400' : 'text-emerald-400'}>{h.val}%</span>
          </span>
        </div>
      ))}
      {/* hud chips */}
      <div className="absolute top-2 left-2 flex gap-1.5">
        <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-400 bg-slate-950/70 border border-cyan-700/40 px-1.5 py-0.5 rounded">3D MAINT</span>
        <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 bg-slate-950/70 border border-emerald-700/40 px-1.5 py-0.5 rounded">LIVE</span>
      </div>
      <div className="absolute bottom-2 right-2 text-[10px] font-mono text-slate-400">
        SC012 · A320neo
      </div>
    </div>
  );
}

/* ───────────────────────── Hangar Market 3D Mock ───────────────────────── */
function HangarMarketPreview({ lang }) {
  const tiers = [
    { name: 'Small', color: 'from-slate-700 to-slate-900', accent: 'bg-slate-500', height: 50, owned: true },
    { name: 'Medium', color: 'from-blue-700 to-blue-950', accent: 'bg-blue-500', height: 80 },
    { name: 'Large', color: 'from-amber-600 to-amber-900', accent: 'bg-amber-500', height: 110, badge: lang === 'de' ? 'EMPFOHLEN' : 'POPULAR' },
    { name: 'Mega', color: 'from-purple-700 to-purple-950', accent: 'bg-purple-500', height: 140 },
  ];
  return (
    <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-b from-sky-900/30 via-slate-950 to-slate-950 border border-slate-700/60">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.15) 1px, transparent 1px)', backgroundSize: '100% 24px' }} />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-emerald-900/30 to-transparent" />
      {/* tarmac */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-800 to-slate-900 border-t border-cyan-500/20" />
      {/* hangars */}
      <div className="absolute inset-x-0 bottom-12 flex items-end justify-around px-4 gap-2">
        {tiers.map((t, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            {t.badge && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 uppercase tracking-wider">{t.badge}</span>
            )}
            <div
              className={`relative w-full max-w-[80px] rounded-t-2xl bg-gradient-to-b ${t.color} border-x border-t border-slate-700 shadow-lg`}
              style={{ height: t.height }}
            >
              {/* roof line */}
              <div className={`absolute -top-1 left-2 right-2 h-1 rounded-full ${t.accent}/60`} />
              {/* door */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-1/2 bg-slate-950/70 border-t border-cyan-500/30 rounded-t-md" />
              {t.owned && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-300 uppercase">{t.name}</span>
          </div>
        ))}
      </div>
      {/* Mini cards floating */}
      <div className="absolute top-2 left-2 right-2 flex justify-between">
        <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-400 bg-slate-950/70 border border-cyan-700/40 px-1.5 py-0.5 rounded">3D HANGAR MARKET</span>
        <span className="text-[10px] font-mono text-emerald-300 bg-slate-950/70 border border-emerald-700/40 px-1.5 py-0.5 rounded">EDDF · OWNED</span>
      </div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-slate-400">
        {lang === 'de' ? 'Klick auf Airport öffnet Markt im Globus' : 'Click an airport to open market on the globe'}
      </div>
    </div>
  );
}

/* ───────────────────────── Interactive Contract Globe Mock ───────────────────────── */
function ContractGlobePreview({ lang }) {
  const routes = [
    { from: { x: 28, y: 42 }, to: { x: 70, y: 32 }, label: 'EDDF→KJFK', color: '#3b82f6' },
    { from: { x: 28, y: 42 }, to: { x: 50, y: 56 }, label: 'EDDF→OMDB', color: '#10b981' },
    { from: { x: 28, y: 42 }, to: { x: 78, y: 70 }, label: 'EDDF→YSSY', color: '#f59e0b' },
  ];
  return (
    <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-b from-slate-950 via-blue-950/40 to-slate-950 border border-slate-700/60">
      {/* grid + globe shading */}
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(56,189,248,.4), transparent 60%)' }} />
      <svg viewBox="0 0 100 60" className="absolute inset-0 w-full h-full">
        {/* simplified continents */}
        <g fill="#1e293b" stroke="#334155" strokeWidth="0.3">
          <path d="M10 40 Q15 30 25 32 L32 38 L28 48 L18 50 Z" />
          <path d="M40 28 L60 26 L62 38 L48 42 L42 36 Z" />
          <path d="M65 22 L82 20 L86 30 L78 36 L66 32 Z" />
          <path d="M70 50 L85 48 L88 58 L72 60 Z" />
          <path d="M48 50 L58 48 L60 58 L50 60 Z" />
        </g>
        {/* great-circle routes */}
        {routes.map((r, i) => (
          <g key={i}>
            <path
              d={`M${r.from.x} ${r.from.y} Q ${(r.from.x + r.to.x) / 2} ${Math.min(r.from.y, r.to.y) - 18} ${r.to.x} ${r.to.y}`}
              fill="none"
              stroke={r.color}
              strokeWidth="0.6"
              strokeDasharray="1.5 1.2"
              opacity="0.85"
            />
            <circle cx={r.from.x} cy={r.from.y} r="1.2" fill="#10b981" />
            <circle cx={r.to.x} cy={r.to.y} r="1.2" fill={r.color} />
          </g>
        ))}
        {/* glow ping at origin */}
        <circle cx="28" cy="42" r="2.5" fill="none" stroke="#10b981" strokeWidth="0.4" opacity="0.7">
          <animate attributeName="r" values="1.5;3.5;1.5" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0;0.7" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Floating contract cards */}
      <div className="absolute top-3 right-3 w-44 space-y-1.5">
        {[
          { route: 'EDDF → KJFK', payout: '$284K', diff: 'HARD', color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
          { route: 'EDDF → OMDB', payout: '$192K', diff: 'MED', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
        ].map((c, i) => (
          <div key={i} className="rounded-md border border-slate-700 bg-slate-950/85 backdrop-blur-sm p-1.5">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-white">{c.route}</span>
              <span className={`px-1 rounded border ${c.color}`}>{c.diff}</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-bold">{c.payout}</div>
          </div>
        ))}
      </div>

      <div className="absolute top-2 left-2 text-[9px] font-mono uppercase tracking-widest text-cyan-400 bg-slate-950/70 border border-cyan-700/40 px-1.5 py-0.5 rounded">
        {lang === 'de' ? 'INTERAKTIVE AUFTRAGSKARTE' : 'INTERACTIVE CONTRACT MAP'}
      </div>
      <div className="absolute bottom-2 left-2 text-[9px] font-mono text-slate-400">
        {lang === 'de' ? '24+ Hubs · klickbare Routen' : '24+ hubs · clickable routes'}
      </div>
    </div>
  );
}

/* ───────────────────────── 3D Aircraft Market Mock ───────────────────────── */
function AircraftMarketPreview({ lang }) {
  const fleet = [
    { name: 'Cessna 172', tier: 'PROP', price: '$425K', accent: 'from-emerald-500 to-emerald-700' },
    { name: 'A320neo', tier: 'NB', price: '$100M', accent: 'from-blue-500 to-blue-700', highlight: true },
    { name: 'B777-300ER', tier: 'WB', price: '$285M', accent: 'from-purple-500 to-purple-700' },
    { name: 'B747-8F', tier: 'CARGO', price: '$400M', accent: 'from-amber-500 to-amber-700' },
  ];
  return (
    <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-blue-950/30 border border-slate-700/60">
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(56,189,248,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-cyan-500/15 to-transparent" />

      {/* turntable / podium */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-10 w-[70%] aspect-[3/1] rounded-[50%] bg-gradient-to-r from-cyan-500/0 via-cyan-500/30 to-cyan-500/0 blur-md" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-12 w-[60%] aspect-[3/1] rounded-[50%] border-2 border-cyan-500/40" />

      {/* featured aircraft silhouette */}
      <div className="absolute left-1/2 bottom-16 -translate-x-1/2 w-[60%] max-w-[300px]">
        <svg viewBox="0 0 400 120" className="w-full">
          <g fill="#0f172a" stroke="#22d3ee" strokeOpacity="0.7" strokeWidth="2">
            <ellipse cx="200" cy="60" rx="170" ry="11" />
            <path d="M70 60 L210 14 L210 50 Z" />
            <path d="M70 60 L210 106 L210 70 Z" />
            <path d="M340 60 L385 35 L385 60 Z" />
            <path d="M340 60 L385 85 L385 60 Z" />
            <ellipse cx="155" cy="74" rx="14" ry="6" fill="#1e293b" />
            <ellipse cx="245" cy="74" rx="14" ry="6" fill="#1e293b" />
          </g>
        </svg>
      </div>

      {/* fleet picker */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1.5">
        {fleet.map((f, i) => (
          <div
            key={i}
            className={`px-2 py-1 rounded-md border backdrop-blur-sm text-[9px] font-mono uppercase ${
              f.highlight
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.4)]'
                : 'border-slate-700 bg-slate-900/70 text-slate-400'
            }`}
          >
            {f.name}
          </div>
        ))}
      </div>

      {/* Spec sidebar */}
      <div className="absolute top-2 right-2 w-32 rounded-md border border-slate-700 bg-slate-950/85 backdrop-blur-sm p-2 space-y-1">
        <div className="text-[9px] font-mono uppercase tracking-widest text-cyan-400">A320neo</div>
        {[
          { k: 'PAX', v: '180' },
          { k: 'RANGE', v: '3,500 NM' },
          { k: 'LVL', v: '≥17' },
          { k: 'PRICE', v: '$100M' },
        ].map((row, i) => (
          <div key={i} className="flex items-center justify-between text-[9px] font-mono">
            <span className="text-slate-500">{row.k}</span>
            <span className="text-white">{row.v}</span>
          </div>
        ))}
      </div>

      <div className="absolute top-2 left-2 text-[9px] font-mono uppercase tracking-widest text-cyan-400 bg-slate-950/70 border border-cyan-700/40 px-1.5 py-0.5 rounded">
        {lang === 'de' ? '3D FLUGZEUG-MARKT' : '3D AIRCRAFT MARKET'}
      </div>
    </div>
  );
}

/* ───────────────────────── Takeoff/Landing 3D Replay Mock ───────────────────────── */
function ReplayPreview({ lang }) {
  return (
    <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/40 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
      {/* tech grid floor */}
      <div className="absolute inset-x-0 bottom-0 h-3/5" style={{ perspective: '600px' }}>
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,.18) 1px, transparent 1px)', backgroundSize: '40px 40px', transform: 'rotateX(60deg)', transformOrigin: 'center bottom' }} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-slate-950 to-transparent" />

      {/* runway */}
      <svg viewBox="0 0 400 240" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {/* runway perspective */}
        <polygon points="180,90 220,90 320,240 80,240" fill="#1a1f2a" stroke="#e2e8f0" strokeOpacity="0.4" />
        {/* center dashes */}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={199 - i * 0.5} y={100 + i * 28} width={2 + i * 0.6} height={12} fill="#f8fafc" opacity="0.7" />
        ))}
        {/* threshold piano keys */}
        {[-3, -1, 1, 3].map((i) => (
          <rect key={i} x={200 + i * 6} y={94} width="3" height="6" fill="#f8fafc" />
        ))}

        {/* color-coded centerline path (trace of landing) */}
        <path
          d="M200 30 Q205 50 198 80 Q195 105 200 130 Q202 155 199 180 Q198 205 200 235"
          fill="none"
          stroke="url(#grad)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="40%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* aircraft icon descending */}
        <g transform="translate(196 80) rotate(8)">
          <path d="M0 -8 L3 4 L10 6 L4 7 L4 14 L8 16 L0 18 L-8 16 L-4 14 L-4 7 L-10 6 L-3 4 Z" fill="#22d3ee" stroke="#0f172a" strokeWidth="0.8" />
        </g>

        {/* touchdown ring */}
        <circle cx="199" cy="180" r="8" fill="none" stroke="#10b981" strokeWidth="2" />
        <circle cx="199" cy="180" r="3" fill="#10b981" />
      </svg>

      {/* HUD top-left */}
      <div className="absolute top-2 left-2 rounded-md border border-cyan-500/40 bg-slate-950/85 backdrop-blur-sm p-2 text-[9px] font-mono space-y-0.5">
        <div className="flex items-center gap-1 text-cyan-400 uppercase tracking-widest text-[8px]"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> PFD</div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">ALT</span><span className="text-emerald-400 font-bold">2,140 FT</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">IAS</span><span className="text-sky-300 font-bold">142 KT</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">V/S</span><span className="text-amber-400 font-bold">-680 FPM</span></div>
        <div className="flex justify-between gap-3"><span className="text-slate-500">G</span><span className="text-emerald-300 font-bold">1.18 G</span></div>
      </div>

      {/* Centerline score */}
      <div className="absolute bottom-2 left-2 right-2 rounded-md border border-emerald-500/40 bg-slate-950/85 backdrop-blur-sm p-2 flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 uppercase tracking-widest text-[8px]">Centerline</span>
          <span className="text-emerald-300">Ø 1.4m</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">+18 pts</span>
          <span className="text-emerald-400 font-bold">+$1,200</span>
          <span className="text-[8px] text-slate-500 uppercase">RWY 25L · TDZ</span>
        </div>
      </div>

      <div className="absolute top-2 right-2 text-[9px] font-mono uppercase tracking-widest text-cyan-400 bg-slate-950/70 border border-cyan-700/40 px-1.5 py-0.5 rounded">
        {lang === 'de' ? '3D REPLAY' : '3D REPLAY'}
      </div>
    </div>
  );
}

/* ───────────────────────── Section ───────────────────────── */
const PREVIEWS = {
  maintenance: MaintenancePreview,
  hangar: HangarMarketPreview,
  globe: ContractGlobePreview,
  market: AircraftMarketPreview,
  replay: ReplayPreview,
};

export default function NewFeaturesShowcase({ lang, onCta }) {
  const items = [
    {
      key: 'replay',
      icon: Video,
      iconColor: 'bg-cyan-500',
      badge: lang === 'de' ? 'NEU · 3D Replay' : 'NEW · 3D Replay',
      title: lang === 'de' ? 'Takeoff & Landing 3D Replay mit Centerline-Score' : 'Takeoff & Landing 3D Replay with Centerline Score',
      desc: lang === 'de'
        ? 'Erlebe deine Starts und Landungen als cinematischen 3D-Replay – inklusive echter Bahn-Geometrie aus OurAirports, farbcodiertem Flugpfad nach seitlicher Abweichung, PFD-HUD, Touchdown-Marker und Centerline-Bewertung mit Score- & Cash-Bonus. Als MP4 exportierbar oder direkt teilen.'
        : 'Replay your takeoffs and landings as a cinematic 3D scene – with real OurAirports runway geometry, color-coded centerline deviation track, PFD HUD, touchdown marker and centerline score with score + cash bonus. Export as MP4 or share directly.',
      bullets: lang === 'de'
        ? ['Echte Runway-Daten aus OurAirports', 'Pfad-Farbe nach m-Abweichung von der Mittellinie', 'Touchdown / Liftoff-Marker mit RMS-Wert', '+/- Score & Cash je nach Präzision', 'MP4 Export & Native Share', 'Chase / Side / Top Cam mit manueller Orbit-Steuerung']
        : ['Real runway data from OurAirports', 'Path color = lateral deviation in meters', 'Touchdown / liftoff marker with RMS value', '+/- score & cash based on precision', 'MP4 export & native share', 'Chase / Side / Top cam with manual orbit'],
      featured: true,
    },
    {
      key: 'hangar',
      icon: Building2,
      iconColor: 'bg-emerald-500',
      badge: lang === 'de' ? 'NEU · 3D Hangar Markt' : 'NEW · 3D Hangar Market',
      title: lang === 'de' ? '3D Hangar Marketplace direkt im Globus' : '3D Hangar Marketplace right inside the globe',
      desc: lang === 'de'
        ? 'Klicke auf jeden Airport im Leaflet-Globus und kaufe, erweitere oder verkaufe Hangars in 3D. 4 Größen (Small → Mega), eigene Modell-Varianten, Slot-Limits pro Flugzeugtyp und 60 % Refund beim Verkauf.'
        : 'Click any airport on the Leaflet globe and buy, upgrade or sell hangars in 3D. 4 sizes (Small → Mega), unique model variants, slot limits per aircraft type and 60% refund on sale.',
      bullets: lang === 'de'
        ? ['4 Hangar-Größen mit Modell-Varianten', 'Slot-Limits pro Aircraft-Typ', 'Inline Kauf / Upgrade / Verkauf', 'Aircraft Transfer mit Live-Kosten', 'Synchronisiert mit Aufträgen']
        : ['4 hangar sizes with model variants', 'Slot limits per aircraft type', 'Inline buy / upgrade / sell', 'Aircraft transfer with live cost', 'Synced with contracts'],
    },
    {
      key: 'globe',
      icon: Globe2,
      iconColor: 'bg-blue-500',
      badge: lang === 'de' ? 'NEU · Interaktive Karte' : 'NEW · Interactive Map',
      title: lang === 'de' ? 'Interaktive Auftragskarte mit Routenfilter' : 'Interactive contract map with route filtering',
      desc: lang === 'de'
        ? 'Alle Aufträge live auf der Weltkarte. Filtere nach Hub, Distanz und Aircraft – inkompatible Verträge werden klar markiert, kompatible sind 1-Klick annehmbar. Hangar-Slots, Reichweite und Fracht werden geprüft, bevor du klickst.'
        : 'All contracts live on the world map. Filter by hub, distance and aircraft – incompatible contracts are clearly marked, compatible ones are one-click accept. Hangar slots, range and cargo are checked before you click.',
      bullets: lang === 'de'
        ? ['Klickbare Routen + Großkreise', 'Filter nach Hub & NM', 'Aircraft-Kompatibilität live', 'Sofort-Annahme aus der Karte']
        : ['Clickable great-circle routes', 'Filter by hub & NM', 'Live aircraft compatibility', 'Accept directly from the map'],
    },
    {
      key: 'market',
      icon: Plane,
      iconColor: 'bg-purple-500',
      badge: lang === 'de' ? 'NEU · 3D Flugzeugmarkt' : 'NEW · 3D Aircraft Market',
      title: lang === 'de' ? '3D Flugzeugmarkt mit Live-Specs' : '3D Aircraft market with live specs',
      desc: lang === 'de'
        ? '50+ Flugzeuge auf einer cineastischen 3D-Bühne mit Drehteller, neuwertigem Modell-Render und Spec-Panel. Used-Market mit Verschleißzustand, Versicherungsplan und Hangar-Zuordnung – alles in einem Flow.'
        : '50+ aircraft on a cinematic 3D turntable stage with brand-new model renders and spec panel. Used market with wear profile, insurance plan and hangar assignment – all in one flow.',
      bullets: lang === 'de'
        ? ['New & Used Markt', 'Versicherungsplan pro Aircraft', 'Hangar-Slot-Check beim Kauf', 'Permanenter Verschleiß für Used']
        : ['New & used market', 'Per-aircraft insurance plan', 'Hangar slot check on purchase', 'Permanent wear on used aircraft'],
    },
    {
      key: 'maintenance',
      icon: Wrench,
      iconColor: 'bg-orange-500',
      badge: lang === 'de' ? 'NEU · 3D Wartung' : 'NEW · 3D Maintenance',
      title: lang === 'de' ? '3D Wartungsansicht mit Hotspots' : '3D maintenance view with hotspots',
      desc: lang === 'de'
        ? 'Jedes Flugzeug als 3D-Modell – Hotspots zeigen Verschleiß je Kategorie direkt am Rumpf, Triebwerken, Fahrwerk und Avionik-Bay. Kritische Werte glühen rot. Wartung pro Kategorie oder als Komplett-Service direkt aus der Szene heraus buchbar.'
        : 'Every aircraft as a 3D model – hotspots show wear per category directly on fuselage, engines, gear and avionics bay. Critical values glow red. Book maintenance per category or as full service straight from the scene.',
      bullets: lang === 'de'
        ? ['8 Wartungs-Kategorien als Hotspots', 'Permanenter & reparabler Verschleiß', 'Live-Failure-Trigger im Sim', 'Versicherung deckt Wartungsschäden']
        : ['8 maintenance categories as hotspots', 'Permanent & repairable wear', 'Live failure triggers in sim', 'Insurance covers maintenance damage'],
    },
  ];

  return (
    <section className="py-16 sm:py-28 px-4 sm:px-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="relative max-w-7xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10">
          <motion.div variants={fadeUp}>
            <Badge className="bg-cyan-600/20 text-cyan-400 border-cyan-500/30 mb-4 px-4 py-1.5">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              {lang === 'de' ? 'NEU IN V1' : 'NEW IN V1'}
            </Badge>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-3">
            {lang === 'de' ? 'Eine neue Generation' : 'A new generation'}{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              {lang === 'de' ? 'Career-Mode' : 'of career mode'}
            </span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-slate-400 max-w-3xl mx-auto">
            {lang === 'de'
              ? '3D-Wartung, 3D-Hangars, 3D-Flugzeugmarkt, interaktiver Auftrags-Globus und Cinematic 3D Replays für Takeoff & Landing inklusive Centerline-Bewertung.'
              : '3D maintenance, 3D hangars, 3D aircraft market, interactive contract globe and cinematic 3D replays for takeoff & landing with centerline scoring.'}
          </motion.p>
        </motion.div>

        {/* Featured row (Replay) */}
        {items.filter((it) => it.featured).map((item) => {
          const Preview = PREVIEWS[item.key];
          const Icon = item.icon;
          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-8"
            >
              <Card className="bg-slate-900/70 border-cyan-500/30 overflow-hidden rounded-2xl p-4 sm:p-6 grid lg:grid-cols-5 gap-5 items-center">
                <div className="lg:col-span-3">
                  <Preview lang={lang} />
                </div>
                <div className="lg:col-span-2">
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 mb-3">{item.badge}</Badge>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.iconColor}`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">{item.title}</h3>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">{item.desc}</p>
                  <div className="space-y-1.5">
                    {item.bullets.map((b, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <ChevronRight className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                  {onCta && (
                    <button
                      onClick={onCta}
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      {lang === 'de' ? 'Jetzt selbst erleben' : 'Try it yourself'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}

        {/* Grid of remaining */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="grid sm:grid-cols-2 lg:grid-cols-2 gap-5"
        >
          {items.filter((it) => !it.featured).map((item) => {
            const Preview = PREVIEWS[item.key];
            const Icon = item.icon;
            return (
              <motion.div key={item.key} variants={fadeUp}>
                <Card className="bg-slate-800/60 border-slate-700/50 overflow-hidden rounded-2xl p-4 sm:p-5 h-full hover:border-cyan-500/40 transition-colors">
                  <Preview lang={lang} />
                  <div className="mt-4">
                    <Badge className="bg-slate-900/80 border-slate-700 text-slate-300 mb-2 text-[10px]">{item.badge}</Badge>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.iconColor}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <h4 className="text-base sm:text-lg font-bold text-white leading-tight">{item.title}</h4>
                    </div>
                    <p className="text-slate-400 text-sm mb-3">{item.desc}</p>
                    <div className="space-y-1">
                      {item.bullets.map((b, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                          <ChevronRight className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}