import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles, ArrowRight, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SignupGateContext = createContext(null);

export function useSignupGate() {
  const ctx = useContext(SignupGateContext);
  if (!ctx) throw new Error('useSignupGate must be used inside <SignupGateProvider>');
  return ctx;
}

/**
 * Wrap interactive demo elements with this provider. After `interactionLimit`
 * gated interactions across ALL demos, the next interaction triggers a paywall
 * popup that asks the user to sign in / sign up to continue.
 */
export function SignupGateProvider({ children, lang = 'en', onCta, interactionLimit = 5 }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(null);

  const requestInteraction = useCallback((opts = {}) => {
    const force = !!opts.force;
    if (force) {
      setReason(opts.reason || null);
      setOpen(true);
      return false;
    }
    if (count >= interactionLimit) {
      setReason(opts.reason || null);
      setOpen(true);
      return false;
    }
    setCount((c) => c + 1);
    return true;
  }, [count, interactionLimit]);

  const remaining = Math.max(0, interactionLimit - count);

  return (
    <SignupGateContext.Provider value={{ requestInteraction, remaining, interactionLimit, count }}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-slate-900 to-slate-950 shadow-[0_0_60px_rgba(34,211,238,0.35)] overflow-hidden"
            >
              <span className="pointer-events-none absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
              <span className="pointer-events-none absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
              <span className="pointer-events-none absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
              <span className="pointer-events-none absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 z-10 h-8 w-8 flex items-center justify-center rounded border border-slate-700 bg-slate-900/80 text-slate-400 hover:text-white hover:border-cyan-500/50"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="px-6 pt-6 pb-2 text-center">
                <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                  <Lock className="w-7 h-7 text-white" />
                </div>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-400 mb-1.5">
                  {lang === 'de' ? 'Demo-Limit erreicht' : 'Demo limit reached'}
                </p>
                <h3 className="text-xl sm:text-2xl font-black text-white mb-2 leading-tight">
                  {lang === 'de' ? 'Jetzt freischalten' : 'Unlock the full experience'}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {reason
                    || (lang === 'de'
                      ? 'Du hast die Vorschau-Interaktionen aufgebraucht. Erstelle einen Account, um SkyCareer voll zu nutzen.'
                      : 'You used up the preview interactions. Create an account to use the full SkyCareer career mode.')}
                </p>
              </div>

              <div className="px-6 pb-3">
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300">
                  {(lang === 'de'
                    ? [
                        'Volle 3D Replay-Aufzeichnung mit MP4-Export',
                        '50+ Flugzeuge, 24+ Hangar-Hubs, alle Aufträge',
                        'Echte Wartung, Versicherung & Karriere-Progression',
                      ]
                    : [
                        'Full 3D replay capture with MP4 export',
                        '50+ aircraft, 24+ hangar hubs, all contracts',
                        'Real maintenance, insurance & career progression',
                      ]
                  ).map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-6 pb-6 pt-2 space-y-2">
                <Button
                  onClick={() => {
                    setOpen(false);
                    onCta && onCta();
                  }}
                  className="w-full h-11 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-base shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {lang === 'de' ? 'Jetzt kostenlos starten' : 'Start free now'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {lang === 'de' ? 'Später vielleicht' : 'Maybe later'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SignupGateContext.Provider>
  );
}

export function GateIndicator({ lang = 'en' }) {
  const { remaining, interactionLimit } = useSignupGate();
  const used = interactionLimit - remaining;
  return (
    <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-slate-500 bg-slate-950/70 border border-slate-700/40 px-1.5 py-0.5 rounded">
      <Lock className="w-3 h-3" />
      <span>Demo · {used}/{interactionLimit}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: interactionLimit }).map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${i < used ? 'bg-cyan-400' : 'bg-slate-700'}`}
          />
        ))}
      </div>
    </div>
  );
}