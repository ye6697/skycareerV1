import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe2 } from 'lucide-react';
import ContractWorldMap from '@/components/contracts/ContractWorldMap';

// Fullscreen overlay map. Renders via portal so it always sits above app chrome.
export default function FullscreenWorldMap({
  open,
  onClose,
  contracts,
  hangars,
  marketAirports,
  selectedContractId,
  onSelectContract,
  selectedAirportIcao,
  onSelectAirport,
  lang = 'en',
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="fullscreen-map"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[500] bg-slate-950"
      >
        {/* Header bar */}
        <div className="absolute top-0 left-0 right-0 z-[510] flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-cyan-900/50 bg-slate-950/95 backdrop-blur">
          <div className="flex items-center gap-2 min-w-0">
            <Globe2 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-300 flex-shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-white truncate">
              {lang === 'de' ? 'Welt-Karte' : 'World Map'}
            </h2>
            <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-wider text-cyan-400/70 ml-1">
              {(contracts?.length || 0)} {lang === 'de' ? 'Routen' : 'routes'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs font-mono uppercase tracking-wider"
          >
            <X className="w-3.5 h-3.5" />
            {lang === 'de' ? 'Schließen' : 'Close'}
          </button>
        </div>

        {/* Map fills the rest */}
        <div className="absolute inset-0 pt-[44px] sm:pt-[52px]">
          <ContractWorldMap
            contracts={contracts}
            hangars={hangars}
            marketAirports={marketAirports}
            selectedContractId={selectedContractId}
            onSelectContract={onSelectContract}
            selectedAirportIcao={selectedAirportIcao}
            onSelectAirport={onSelectAirport}
            embedded
            lang={lang}
          />
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}