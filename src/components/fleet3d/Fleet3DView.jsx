import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plane, ChevronLeft, ChevronRight, AlertTriangle, X, Maximize2, Minimize2 } from 'lucide-react';
import AircraftHangar3D from '@/components/fleet3d/AircraftHangar3D';
import { useLanguage } from '@/components/LanguageContext';
import { normalizeMaintenanceCategoryMap, resolvePermanentWearCategories, MAINTENANCE_CATEGORY_KEYS } from '@/lib/maintenance';

function getWearColor(p) {
  if (p <= 20) return 'text-emerald-400';
  if (p <= 50) return 'text-amber-400';
  if (p <= 75) return 'text-orange-400';
  return 'text-red-400';
}

function getProgressColor(p) {
  if (p <= 20) return 'bg-emerald-500';
  if (p <= 50) return 'bg-amber-500';
  if (p <= 75) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function Fleet3DView({ aircraft }) {
  const { lang } = useLanguage();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(true);

  const visible = useMemo(() => aircraft.filter((a) => a.status !== 'sold'), [aircraft]);
  const current = visible[selectedIdx] || null;

  const wearData = useMemo(() => {
    if (!current) return null;
    const cats = normalizeMaintenanceCategoryMap(current.maintenance_categories);
    const fallback = Math.max(0, Math.min(100, Number(current?.used_permanent_avg || 0)));
    const perm = resolvePermanentWearCategories(current?.permanent_wear_categories, fallback);
    const total = {};
    let sum = 0; let max = 0;
    MAINTENANCE_CATEGORY_KEYS.forEach((k) => {
      total[k] = Math.min(100, (cats[k] || 0) + (perm[k] || 0));
      sum += total[k];
      if (total[k] > max) max = total[k];
    });
    return { total, avg: sum / MAINTENANCE_CATEGORY_KEYS.length, max };
  }, [current]);

  if (visible.length === 0) {
    return (
      <Card className="p-8 text-center bg-slate-900/80 border border-cyan-900/30 flex flex-col items-center">
        <Plane className="w-10 h-10 text-cyan-900 mx-auto mb-2" />
        <h3 className="text-sm font-mono text-cyan-600 mb-1">{lang === 'de' ? 'KEINE FLUGZEUGE' : 'NO AIRCRAFT'}</h3>
      </Card>
    );
  }

  // Fullscreen overlay covers entire viewport.
  const containerClass = isFullscreen
    ? 'fixed inset-0 z-[200] bg-slate-950 flex flex-col'
    : 'relative flex flex-col gap-3 h-[600px]';

  return (
    <div className={containerClass}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 bg-slate-900/95 border-b border-cyan-900/40 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            size="sm" variant="ghost"
            className="h-8 w-8 p-0 text-cyan-400 hover:bg-cyan-950 shrink-0"
            onClick={() => setSelectedIdx((i) => (i - 1 + visible.length) % visible.length)}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <div className="text-cyan-300 font-mono font-bold text-sm tracking-wide truncate">
              {current?.registration} <span className="text-cyan-600 font-normal">· {current?.name}</span>
            </div>
            <div className="text-[9px] font-mono text-cyan-600 uppercase tracking-wider">
              {selectedIdx + 1} / {visible.length} · {lang === 'de' ? 'Flotte' : 'Fleet'}
            </div>
          </div>
          <Button
            size="sm" variant="ghost"
            className="h-8 w-8 p-0 text-cyan-400 hover:bg-cyan-950 shrink-0"
            onClick={() => setSelectedIdx((i) => (i + 1) % visible.length)}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {wearData && (
            <div className="hidden sm:flex items-center gap-3 bg-slate-950 border border-slate-800 rounded px-3 py-1 font-mono text-[10px]">
              <div>
                <span className="text-slate-500 uppercase mr-1">{lang === 'de' ? 'Ø' : 'Avg'}</span>
                <span className={`font-bold ${getWearColor(wearData.avg)}`}>{Math.round(wearData.avg)}%</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase mr-1">Max</span>
                <span className={`font-bold ${getWearColor(wearData.max)}`}>{Math.round(wearData.max)}%</span>
              </div>
              {wearData.max > 75 && (
                <span className="text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 animate-pulse" />
                  {lang === 'de' ? 'Wartung!' : 'Service!'}
                </span>
              )}
            </div>
          )}
          <Button
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 px-2 text-[10px] font-mono uppercase bg-slate-800 text-slate-300 hover:bg-slate-700"
            title={isFullscreen ? (lang === 'de' ? 'Verkleinern' : 'Minimize') : (lang === 'de' ? 'Vollbild' : 'Fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Aircraft thumbnail strip */}
      <div className="bg-slate-900/80 border-b border-cyan-900/30 px-2 py-1.5 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {visible.map((ac, i) => (
            <button
              key={ac.id}
              onClick={() => setSelectedIdx(i)}
              className={`px-2 py-1 rounded font-mono text-[10px] uppercase whitespace-nowrap border transition-colors ${
                i === selectedIdx
                  ? 'bg-cyan-900/70 border-cyan-400 text-cyan-200'
                  : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-cyan-700'
              }`}
            >
              {ac.registration}
            </button>
          ))}
        </div>
      </div>

      {/* 3D scene fills remaining space */}
      <div className="flex-1 min-h-0 relative">
        <AircraftHangar3D aircraft={current} />

        {/* Bottom wear summary bar (always visible) */}
        {wearData && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent px-3 pt-8 pb-2 pointer-events-none">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between text-[10px] font-mono mb-1 pointer-events-auto">
                <span className="text-cyan-500 uppercase tracking-wider">{lang === 'de' ? 'Wartungsstatus gesamt' : 'Overall Maintenance'}</span>
                <span className={`font-bold text-sm ${getWearColor(wearData.avg)}`}>{Math.round(wearData.avg)}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded h-2 overflow-hidden border border-slate-700">
                <motion.div
                  className={`h-full ${getProgressColor(wearData.avg)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${wearData.avg}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}