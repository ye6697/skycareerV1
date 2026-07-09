import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plane, ChevronLeft, ChevronRight } from 'lucide-react';
import AircraftHangar3D from '@/components/fleet3d/AircraftHangar3D';
import MaintenanceCategoryList from '@/components/fleet3d/MaintenanceCategoryList';
import { useLanguage } from '@/components/LanguageContext';

export default function Fleet3DView({ aircraft, initialAircraftId = null }) {
  const { lang } = useLanguage();
  const visible = useMemo(() => aircraft.filter((a) => a.status !== 'sold'), [aircraft]);
  const initialIdx = useMemo(() => {
    if (!initialAircraftId) return 0;
    const idx = visible.findIndex((a) => a.id === initialAircraftId);
    return idx >= 0 ? idx : 0;
  }, [initialAircraftId, visible]);
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // When the initial aircraft changes (user clicks a different card), jump to it.
  React.useEffect(() => {
    setSelectedIdx(initialIdx);
    setSelectedCategory(null);
  }, [initialIdx]);

  const current = visible[selectedIdx] || null;

  if (visible.length === 0) {
    return (
      <Card className="p-8 text-center bg-slate-900/80 border border-cyan-900/30 flex flex-col items-center">
        <Plane className="w-10 h-10 text-cyan-900 mx-auto mb-2" />
        <h3 className="text-sm font-mono text-cyan-600 mb-1">{lang === 'de' ? 'KEINE FLUGZEUGE' : 'NO AIRCRAFT'}</h3>
      </Card>
    );
  }

  // Always fullscreen overlay covering the whole viewport.
  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col">
      {/* Top bar with aircraft selector */}
      <div className="flex items-center justify-between gap-2 bg-slate-900/95 border-b border-cyan-900/40 px-3 py-2 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            size="sm" variant="ghost"
            className="h-8 w-8 p-0 text-cyan-400 hover:bg-cyan-950 shrink-0"
            onClick={() => { setSelectedIdx((i) => (i - 1 + visible.length) % visible.length); setSelectedCategory(null); }}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <div className="text-cyan-300 font-mono font-bold text-sm tracking-wide truncate">
              {current?.registration} <span className="text-cyan-600 font-normal">· {current?.name}</span>
            </div>
            <div className="text-[9px] font-mono text-cyan-600 uppercase tracking-wider">
              {selectedIdx + 1} / {visible.length} · {lang === 'de' ? '3D Wartung' : '3D Maintenance'}
            </div>
          </div>
          <Button
            size="sm" variant="ghost"
            className="h-8 w-8 p-0 text-cyan-400 hover:bg-cyan-950 shrink-0"
            onClick={() => { setSelectedIdx((i) => (i + 1) % visible.length); setSelectedCategory(null); }}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Aircraft thumbnail strip */}
      <div className="bg-slate-900/80 border-b border-cyan-900/30 px-2 py-1.5 overflow-x-auto flex-shrink-0">
        <div className="flex gap-1.5 min-w-max">
          {visible.map((ac, i) => (
            <button
              key={ac.id}
              onClick={() => { setSelectedIdx(i); setSelectedCategory(null); }}
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

      {/* Split layout: 3D scene left, glass list right */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="flex-1 min-h-0 relative lg:order-1 order-2">
          <AircraftHangar3D
            aircraft={current}
            selectedCategory={selectedCategory}
          />
        </div>
        <div className="lg:w-[340px] w-full lg:h-auto h-[55%] lg:border-l border-t lg:border-t-0 border-cyan-900/40 bg-gradient-to-b from-slate-950/95 via-slate-950/90 to-slate-900/95 backdrop-blur-xl lg:order-2 order-1 flex-shrink-0 overflow-hidden">
          <MaintenanceCategoryList
            aircraft={current}
            selectedCategory={selectedCategory}
            onSelectCategory={(key) => setSelectedCategory(key === selectedCategory ? null : key)}
          />
        </div>
      </div>
    </div>
  );
}