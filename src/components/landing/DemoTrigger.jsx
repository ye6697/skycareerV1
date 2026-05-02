import React from 'react';
import { Play, Lock } from 'lucide-react';
import { useSignupGate, GateIndicator } from './SignupGate';

/**
 * Big inline trigger card that previews a real in-app component. When clicked
 * it counts as a gated interaction and either opens the real component
 * (passed via onOpen) or shows the paywall.
 *
 * Children renders the live preview (e.g. AircraftHangar3D inline).
 */
export default function DemoTrigger({ children, onOpen, openLabel, lang = 'en' }) {
  const { requestInteraction } = useSignupGate();

  const handleClick = () => {
    if (!requestInteraction()) return;
    onOpen?.();
  };

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-cyan-500/30 bg-slate-950 group">
      {children}
      <div className="absolute top-2 right-2 z-20"><GateIndicator lang={lang} /></div>

      <button
        type="button"
        onClick={handleClick}
        className="absolute inset-0 z-10 flex items-end justify-center bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent opacity-100 group-hover:from-slate-950/85 transition-colors p-4"
      >
        <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-[0_0_20px_rgba(34,211,238,0.4)] group-hover:scale-105 transition-transform">
          <Play className="w-4 h-4 fill-white" />
          {openLabel || (lang === 'de' ? 'Live öffnen' : 'Open Live Preview')}
        </span>
      </button>
    </div>
  );
}

export function PaywallTrigger({ children, lang = 'en', reason }) {
  const { requestInteraction } = useSignupGate();
  return (
    <button
      type="button"
      onClick={() => requestInteraction({ force: true, reason })}
      className="relative w-full h-full rounded-xl overflow-hidden border border-cyan-500/30 bg-slate-950 group block text-left"
    >
      {children}
      <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent p-4">
        <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-[0_0_20px_rgba(34,211,238,0.4)] group-hover:scale-105 transition-transform">
          <Lock className="w-4 h-4" />
          {lang === 'de' ? 'Account erstellen' : 'Create Account'}
        </span>
      </div>
      <div className="absolute top-2 right-2"><GateIndicator lang={lang} /></div>
    </button>
  );
}