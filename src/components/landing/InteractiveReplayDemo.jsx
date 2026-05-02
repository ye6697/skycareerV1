import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Camera } from 'lucide-react';
import { useSignupGate, GateIndicator } from './SignupGate';

const CAM_MODES = [
  { id: 'side', label_en: 'Side', label_de: 'Seite' },
  { id: 'chase', label_en: 'Chase', label_de: 'Verfolger' },
  { id: 'top', label_en: 'Top', label_de: 'Oben' },
];

function pathPoint(t) {
  const x = 50 + Math.sin(t * Math.PI * 1.4) * 1.5;
  const y = 8 + t * 74;
  return { x, y };
}

function pfdAt(t) {
  const alt = Math.round(2400 - t * 2380);
  const ias = Math.round(168 - t * 36);
  const vs = Math.round(-720 + Math.sin(t * Math.PI) * 60);
  const g = (1.05 + Math.sin(t * Math.PI) * 0.15).toFixed(2);
  return { alt, ias, vs, g };
}

export default function InteractiveReplayDemo({ lang = 'en' }) {
  const { requestInteraction } = useSignupGate();
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [cam, setCam] = useState('chase');
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const DURATION = 6000;

  useEffect(() => {
    if (!playing) {
      startRef.current = null;
      return undefined;
    }
    const step = (now) => {
      if (startRef.current === null) startRef.current = now - progress * DURATION;
      const elapsed = now - startRef.current;
      const next = Math.min(1, elapsed / DURATION);
      setProgress(next);
      if (next < 1) rafRef.current = requestAnimationFrame(step);
      else setPlaying(false);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const togglePlay = () => {
    if (!requestInteraction()) return;
    if (progress >= 1) { setProgress(0); startRef.current = null; }
    setPlaying((p) => !p);
  };

  const reset = () => {
    if (!requestInteraction()) return;
    setProgress(0);
    startRef.current = null;
    setPlaying(true);
  };

  const handleCam = (id) => {
    if (id === cam) return;
    if (!requestInteraction()) return;
    setCam(id);
  };

  const p = pathPoint(progress);
  const pfd = pfdAt(progress);
  const cameraStyle = (() => {
    if (cam === 'top') return { transform: 'rotateX(0deg) scale(1.05)' };
    if (cam === 'side') return { transform: 'rotateX(70deg) scale(0.95)' };
    return { transform: 'rotateX(55deg) scale(1)' };
  })();

  const dev = Math.abs(p.x - 50);
  const dotColor = dev < 1.0 ? '#10b981' : dev < 1.8 ? '#facc15' : '#f87171';

  return (
    <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/40 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
      <div className="absolute inset-0" style={{ perspective: '600px' }}>
        <div
          className="absolute inset-0 transition-transform duration-700 ease-out"
          style={{
            backgroundImage: 'linear-gradient(rgba(16,185,129,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,.18) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            transformOrigin: 'center bottom',
            ...cameraStyle,
          }}
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-slate-950 to-transparent" />

      <div
        className="absolute inset-0 transition-transform duration-700 ease-out"
        style={cam === 'top' ? { transform: 'scale(1)' } : cam === 'side' ? { transform: 'translateY(8%) scale(1.05)' } : { transform: 'translateY(0) scale(1)' }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <polygon points="45,8 55,8 65,90 35,90" fill="#1a1f2a" stroke="#e2e8f0" strokeOpacity="0.4" strokeWidth="0.3" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={49.7} y={12 + i * 13} width="0.6" height="5" fill="#f8fafc" opacity="0.7" />
          ))}
          {[-3, -1, 1, 3].map((i) => (
            <rect key={i} x={50 + i * 1.5} y={9} width="0.8" height="2" fill="#f8fafc" />
          ))}
          <path
            d="M50 8 Q51 25 49 42 Q48 55 50 68 Q51 78 50 90"
            fill="none"
            stroke="url(#replaygrad)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="replaygrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="40%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          <g transform={`translate(${p.x} ${p.y}) rotate(2)`}>
            <circle r="2" fill="#22d3ee" opacity="0.25" />
            <path d="M0 -2 L0.7 1 L2.5 1.5 L1 1.7 L1 3.5 L2 4 L0 4.5 L-2 4 L-1 3.5 L-1 1.7 L-2.5 1.5 L-0.7 1 Z" fill="#22d3ee" stroke="#0f172a" strokeWidth="0.2" />
          </g>

          {progress >= 0.95 && (
            <g>
              <circle cx="50" cy="82" r="2.5" fill="none" stroke={dotColor} strokeWidth="0.5" />
              <circle cx="50" cy="82" r="1" fill={dotColor} />
            </g>
          )}
        </svg>
      </div>

      <div className="absolute top-2 left-2 rounded-md border border-cyan-500/40 bg-slate-950/85 backdrop-blur-sm p-1.5 text-[9px] font-mono space-y-0.5 min-w-[90px]">
        <div className="flex items-center gap-1 text-cyan-400 uppercase tracking-widest text-[8px]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> PFD
        </div>
        <div className="flex justify-between gap-2"><span className="text-slate-500">ALT</span><span className="text-emerald-400 font-bold">{pfd.alt} FT</span></div>
        <div className="flex justify-between gap-2"><span className="text-slate-500">IAS</span><span className="text-sky-300 font-bold">{pfd.ias} KT</span></div>
        <div className="flex justify-between gap-2"><span className="text-slate-500">V/S</span><span className="text-amber-400 font-bold">{pfd.vs} FPM</span></div>
        <div className="flex justify-between gap-2"><span className="text-slate-500">G</span><span className="text-emerald-300 font-bold">{pfd.g} G</span></div>
      </div>

      <div className="absolute top-2 right-2 rounded-md border border-cyan-500/40 bg-slate-950/85 backdrop-blur-sm overflow-hidden">
        <div className="px-2 py-0.5 border-b border-cyan-900/50 flex items-center gap-1">
          <Camera className="w-3 h-3 text-cyan-400" />
          <span className="text-[8px] font-mono uppercase tracking-widest text-cyan-400">CAM</span>
        </div>
        <div className="flex flex-col p-0.5">
          {CAM_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleCam(m.id)}
              className={`px-2 py-0.5 rounded-sm text-[9px] font-mono uppercase text-left transition-colors ${
                cam === m.id
                  ? 'bg-cyan-500/20 text-cyan-300 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-l-2 border-transparent'
              }`}
            >
              {lang === 'de' ? m.label_de : m.label_en}
            </button>
          ))}
        </div>
      </div>

      {progress >= 0.95 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-emerald-500/50 bg-slate-950/95 backdrop-blur-sm px-3 py-2 text-center animate-[fadeIn_0.4s_ease-out]">
          <div className="text-[9px] font-mono uppercase tracking-widest text-emerald-400">Centerline · TDZ</div>
          <div className="text-lg font-mono font-black text-emerald-300">+18 pts · +$1,200</div>
        </div>
      )}

      <div className="absolute bottom-1 left-1 right-1 rounded-md border border-slate-700 bg-slate-950/90 backdrop-blur-sm p-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className="w-6 h-6 rounded border border-cyan-500/50 bg-cyan-950/60 text-cyan-300 flex items-center justify-center hover:bg-cyan-900/60"
        >
          {playing && progress < 1 ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-cyan-300" />}
        </button>
        <button
          type="button"
          onClick={reset}
          className="w-6 h-6 rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 flex items-center justify-center"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
        <div className="flex-1 relative h-1.5">
          <div className="absolute inset-0 rounded-full bg-slate-800 border border-slate-700" />
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest min-w-[28px] text-right">
          {Math.round(progress * 100)}%
        </span>
      </div>
      <div className="absolute bottom-9 left-2"><GateIndicator lang={lang} /></div>
    </div>
  );
}