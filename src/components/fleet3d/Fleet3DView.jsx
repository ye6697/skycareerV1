import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plane, ChevronLeft, ChevronRight, Wrench, Cog, Gauge, CircuitBoard, Shield, Zap, Wind, AlertTriangle } from 'lucide-react';
import AircraftHangar3D from '@/components/fleet3d/AircraftHangar3D';
import MaintenanceCategories from '@/components/aircraft/MaintenanceCategories';
import AircraftCard from '@/components/aircraft/AircraftCard';
import { useLanguage } from '@/components/LanguageContext';
import { normalizeMaintenanceCategoryMap, resolvePermanentWearCategories, MAINTENANCE_CATEGORY_KEYS } from '@/lib/maintenance';

const CATEGORY_ICONS = {
  engine: Cog,
  hydraulics: Gauge,
  avionics: CircuitBoard,
  airframe: Shield,
  landing_gear: Plane,
  electrical: Zap,
  flight_controls: Wind,
  pressurization: Shield,
};

const CATEGORY_LABELS = {
  engine: { en: 'Engine', de: 'Triebwerk' },
  hydraulics: { en: 'Hydraulics', de: 'Hydraulik' },
  avionics: { en: 'Avionics', de: 'Avionik' },
  airframe: { en: 'Airframe', de: 'Zelle' },
  landing_gear: { en: 'Landing Gear', de: 'Fahrwerk' },
  electrical: { en: 'Electrical', de: 'Elektrik' },
  flight_controls: { en: 'Flight Ctrl', de: 'Steuerung' },
  pressurization: { en: 'Pressure', de: 'Druck' },
};

function getWearColor(p) {
  if (p <= 20) return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40';
  if (p <= 50) return 'text-amber-400 border-amber-500/40 bg-amber-950/40';
  if (p <= 75) return 'text-orange-400 border-orange-500/40 bg-orange-950/40';
  return 'text-red-400 border-red-500/40 bg-red-950/40';
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
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showFullPanel, setShowFullPanel] = useState(false);

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
    return { active: cats, permanent: perm, total, avg: sum / MAINTENANCE_CATEGORY_KEYS.length, max };
  }, [current]);

  if (visible.length === 0) {
    return (
      <Card className="p-8 text-center bg-slate-900/80 border border-cyan-900/30 flex flex-col items-center">
        <Plane className="w-10 h-10 text-cyan-900 mx-auto mb-2" />
        <h3 className="text-sm font-mono text-cyan-600 mb-1">{lang === 'de' ? 'KEINE FLUGZEUGE' : 'NO AIRCRAFT'}</h3>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Aircraft selector strip */}
      <div className="flex items-center gap-2 bg-slate-900/80 border border-cyan-900/30 rounded-lg p-2 overflow-hidden">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-cyan-400 hover:bg-cyan-950"
          onClick={() => { setSelectedIdx((i) => (i - 1 + visible.length) % visible.length); setSelectedCategory(null); }}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {visible.map((ac, i) => (
              <button
                key={ac.id}
                onClick={() => { setSelectedIdx(i); setSelectedCategory(null); }}
                className={`px-2 py-1 rounded font-mono text-[10px] uppercase whitespace-nowrap border transition-colors ${
                  i === selectedIdx
                    ? 'bg-cyan-900/60 border-cyan-400 text-cyan-200'
                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-cyan-700'
                }`}
              >
                {ac.registration}
              </button>
            ))}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-cyan-400 hover:bg-cyan-950"
          onClick={() => { setSelectedIdx((i) => (i + 1) % visible.length); setSelectedCategory(null); }}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <span className="text-[10px] font-mono text-cyan-600 px-2 hidden sm:inline">
          {selectedIdx + 1} / {visible.length}
        </span>
      </div>

      {/* Main 3D area + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 flex-1 min-h-[500px]">
        {/* 3D Hangar */}
        <Card className="bg-slate-950 border-cyan-900/40 overflow-hidden relative h-[500px] lg:h-auto min-h-[500px]">
          <AircraftHangar3D
            aircraft={current}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </Card>

        {/* Stats sidebar */}
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-300px)] lg:max-h-[700px] pr-1">
          {/* Overview */}
          {current && wearData && (
            <Card className="bg-slate-900 border-cyan-900/40 p-3">
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-cyan-300 font-mono font-bold text-sm tracking-wide">{current.name}</h3>
                <span className="text-cyan-600 font-mono text-[10px]">{current.registration}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mb-2">
                <div className="bg-slate-950 rounded p-1.5 border border-slate-800">
                  <div className="text-slate-500">{lang === 'de' ? 'GESAMT' : 'OVERALL'}</div>
                  <div className={`font-bold text-lg ${getWearColor(wearData.avg).split(' ')[0]}`}>{Math.round(wearData.avg)}%</div>
                </div>
                <div className="bg-slate-950 rounded p-1.5 border border-slate-800">
                  <div className="text-slate-500">{lang === 'de' ? 'MAX' : 'MAX'}</div>
                  <div className={`font-bold text-lg ${getWearColor(wearData.max).split(' ')[0]}`}>{Math.round(wearData.max)}%</div>
                </div>
              </div>
              <div className="w-full bg-slate-800 rounded h-1.5 overflow-hidden mb-1">
                <motion.div
                  className={`h-full ${getProgressColor(wearData.avg)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${wearData.avg}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
              <div className="text-[9px] text-slate-500 font-mono uppercase">
                {wearData.max > 75
                  ? <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {lang === 'de' ? 'Wartung dringend!' : 'Maintenance urgent!'}</span>
                  : wearData.avg > 50
                  ? <span className="text-amber-400">{lang === 'de' ? 'Wartung empfohlen' : 'Maintenance recommended'}</span>
                  : <span className="text-emerald-400">{lang === 'de' ? 'Status OK' : 'Status OK'}</span>}
              </div>
            </Card>
          )}

          {/* Category list - clickable */}
          {wearData && (
            <Card className="bg-slate-900 border-cyan-900/40 p-2">
              <div className="text-[10px] font-mono text-cyan-500 uppercase tracking-wider px-1 pb-1.5 border-b border-cyan-900/30 mb-1.5 flex items-center gap-1">
                <Wrench className="w-3 h-3" />
                {lang === 'de' ? 'Wartungsbereiche' : 'Maintenance Areas'}
              </div>
              <div className="space-y-1">
                {MAINTENANCE_CATEGORY_KEYS.map((key) => {
                  const Icon = CATEGORY_ICONS[key];
                  const total = wearData.total[key] || 0;
                  const isSelected = selectedCategory === key;
                  const isCritical = total > 75;
                  return (
                    <motion.button
                      key={key}
                      onClick={() => setSelectedCategory(isSelected ? null : key)}
                      whileHover={{ x: 2 }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border font-mono text-[10px] transition-all ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/40'
                          : `${getWearColor(total)}`
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1 text-left uppercase truncate">{CATEGORY_LABELS[key][lang] || CATEGORY_LABELS[key].en}</span>
                      <span className="font-bold">{Math.round(total)}%</span>
                      {isCritical && <AlertTriangle className="w-3 h-3 text-red-400 animate-pulse" />}
                    </motion.button>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Open full maintenance panel */}
          {current && (
            <Button
              onClick={() => setShowFullPanel(true)}
              className="w-full bg-amber-900/40 hover:bg-amber-800 border border-amber-700 text-amber-300 font-mono text-[10px] uppercase tracking-wider"
            >
              <Wrench className="w-3.5 h-3.5 mr-1.5" />
              {lang === 'de' ? 'Volles Wartungspanel' : 'Full Maintenance Panel'}
            </Button>
          )}

          {/* Quick aircraft card actions */}
          {current && (
            <div className="pt-1">
              <AircraftCard aircraft={current} />
            </div>
          )}
        </div>
      </div>

      {/* Full maintenance panel as overlay */}
      <AnimatePresence>
        {showFullPanel && current && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/85 flex items-end sm:items-center justify-center p-2 sm:p-6"
            onClick={(e) => { if (e.target === e.currentTarget) setShowFullPanel(false); }}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="w-full max-w-2xl h-[92dvh] sm:h-auto sm:max-h-[88dvh] bg-slate-900 border border-cyan-700 rounded-lg overflow-hidden flex flex-col"
            >
              <div className="px-4 pt-4 pb-2 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-cyan-300 font-mono uppercase text-sm">
                  <Wrench className="w-4 h-4 inline mr-2" />
                  {current.registration} - {current.name}
                </h3>
                <button
                  onClick={() => setShowFullPanel(false)}
                  className="text-slate-400 hover:text-white text-xl leading-none px-2"
                >×</button>
              </div>
              <div
                className="px-4 py-3 min-h-0 flex-1 overflow-y-auto"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <MaintenanceCategories aircraft={current} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}