import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from "@/components/LanguageContext";

const SERIES_CONFIG = {
  altitude: { label: 'Altitude', unit: 'ft', color: '#a3e635', yAxisId: 'left' },
  ias: { label: 'Air Speed', unit: 'kts', color: '#22d3ee', yAxisId: 'right' },
  speed: { label: 'Ground Speed', unit: 'kts', color: '#818cf8', yAxisId: 'right' },
  g_force: { label: 'G-Force', unit: 'G', color: '#f97316', yAxisId: 'right' },
  vertical_speed: { label: 'Vertical Speed (FPM)', unit: 'fpm', color: '#f472b6', yAxisId: 'right' },
};

const TOGGLE_KEYS = ['altitude', 'ias', 'speed', 'g_force', 'vertical_speed'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1 font-mono">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-mono font-bold text-white">{typeof p.value === 'number' ? p.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : p.value}</span>
          <span className="text-slate-500">{SERIES_CONFIG[p.dataKey]?.unit || ''}</span>
        </div>
      ))}
    </div>
  );
}

export default function FlightProfileChart({ flight }) {
  const { lang } = useLanguage();
  const [activeSeries, setActiveSeries] = useState(['altitude', 'ias']);
  
  // Zoom state: start/end indices into chartData
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState(null); // null = full length
  const [isPanning, setIsPanning] = useState(false);
  const panStartX = useRef(null);
  const panStartIndices = useRef(null);
  const containerRef = useRef(null);
  const touchRef = useRef({ startDist: null, startStart: 0, startEnd: 0, midX: 0, isPinching: false, panStartX: null });

  const chartData = useMemo(() => {
    const xpd = flight?.xplane_data || {};
    const history = xpd.telemetry_history || xpd.telemetryHistory || xpd.profile_history || xpd.flight_profile;
    if (!Array.isArray(history) || history.length < 2) return null;
    return history.map((pt) => {
      const ts = pt.t ? new Date(pt.t) : null;
      const timeLabel = ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
      return {
        time: timeLabel,
        altitude: Math.round(pt.alt ?? 0),
        ias: Math.round(pt.ias ?? pt.spd ?? 0),
        speed: Math.round(pt.spd ?? 0),
        g_force: Number((pt.g ?? 1).toFixed(2)),
        vertical_speed: Math.round(pt.vs ?? 0),
      };
    });
  }, [flight]);

  const totalLen = chartData?.length || 0;
  const effectiveEnd = viewEnd === null ? totalLen : viewEnd;
  const windowSize = effectiveEnd - viewStart;
  const isZoomed = totalLen > 0 && windowSize < totalLen;

  const displayData = useMemo(() => {
    if (!chartData) return null;
    return chartData.slice(viewStart, effectiveEnd);
  }, [chartData, viewStart, effectiveEnd]);

  const handleWheel = useCallback((e) => {
    if (!chartData || totalLen < 4) return;
    e.preventDefault();

    const zoomFactor = 0.15;
    const delta = e.deltaY > 0 ? 1 : -1; // 1 = zoom out, -1 = zoom in

    // Get mouse position as fraction of chart width
    const rect = containerRef.current?.getBoundingClientRect();
    const mouseXFrac = rect ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) : 0.5;

    const curStart = viewStart;
    const curEnd = effectiveEnd;
    const curSize = curEnd - curStart;

    if (delta < 0) {
      // Zoom in
      const shrink = Math.max(2, Math.round(curSize * zoomFactor));
      const leftShrink = Math.round(shrink * mouseXFrac);
      const rightShrink = shrink - leftShrink;
      const newStart = Math.min(curStart + leftShrink, curEnd - 4);
      const newEnd = Math.max(curEnd - rightShrink, newStart + 4);
      setViewStart(Math.max(0, newStart));
      setViewEnd(Math.min(totalLen, newEnd));
    } else {
      // Zoom out
      const grow = Math.max(2, Math.round(curSize * zoomFactor));
      const leftGrow = Math.round(grow * mouseXFrac);
      const rightGrow = grow - leftGrow;
      let newStart = curStart - leftGrow;
      let newEnd = curEnd + rightGrow;
      // Clamp
      if (newStart < 0) { newEnd = Math.min(totalLen, newEnd - newStart); newStart = 0; }
      if (newEnd > totalLen) { newStart = Math.max(0, newStart - (newEnd - totalLen)); newEnd = totalLen; }
      if (newEnd - newStart >= totalLen) {
        setViewStart(0);
        setViewEnd(null);
      } else {
        setViewStart(newStart);
        setViewEnd(newEnd);
      }
    }
  }, [chartData, totalLen, viewStart, effectiveEnd]);

  const handlePointerDown = useCallback((e) => {
    if (!isZoomed) return;
    setIsPanning(true);
    panStartX.current = e.clientX;
    panStartIndices.current = { start: viewStart, end: effectiveEnd };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [isZoomed, viewStart, effectiveEnd]);

  const handlePointerMove = useCallback((e) => {
    if (!isPanning || !panStartX.current || !panStartIndices.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pxDelta = e.clientX - panStartX.current;
    const curSize = panStartIndices.current.end - panStartIndices.current.start;
    const indexDelta = Math.round((-pxDelta / rect.width) * curSize);

    let newStart = panStartIndices.current.start + indexDelta;
    let newEnd = panStartIndices.current.end + indexDelta;
    if (newStart < 0) { newEnd -= newStart; newStart = 0; }
    if (newEnd > totalLen) { newStart -= (newEnd - totalLen); newEnd = totalLen; }
    newStart = Math.max(0, newStart);
    setViewStart(newStart);
    setViewEnd(newEnd);
  }, [isPanning, totalLen]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
    panStartX.current = null;
    panStartIndices.current = null;
  }, []);

  const handleReset = () => {
    setViewStart(0);
    setViewEnd(null);
  };

  // --- Touch pinch-to-zoom + one-finger pan ---
  const getTouchDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  const getTouchMidX = (t1, t2) => (t1.clientX + t2.clientX) / 2;

  const handleTouchStart = useCallback((e) => {
    if (!chartData || totalLen < 4) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const midX = getTouchMidX(e.touches[0], e.touches[1]);
      touchRef.current = {
        startDist: dist,
        startStart: viewStart,
        startEnd: effectiveEnd,
        midX,
        isPinching: true,
        panStartX: null,
      };
    } else if (e.touches.length === 1 && isZoomed) {
      touchRef.current = {
        ...touchRef.current,
        isPinching: false,
        panStartX: e.touches[0].clientX,
        startStart: viewStart,
        startEnd: effectiveEnd,
      };
    }
  }, [chartData, totalLen, viewStart, effectiveEnd, isZoomed]);

  const handleTouchMove = useCallback((e) => {
    if (!chartData || totalLen < 4) return;

    // Pinch zoom (2 fingers)
    if (e.touches.length === 2 && touchRef.current.isPinching && touchRef.current.startDist) {
      e.preventDefault();
      const newDist = getTouchDist(e.touches[0], e.touches[1]);
      const scale = newDist / touchRef.current.startDist;
      const { startStart, startEnd } = touchRef.current;
      const origSize = startEnd - startStart;
      const newSize = Math.max(4, Math.min(totalLen, Math.round(origSize / scale)));

      // Zoom centered on midpoint
      const rect = containerRef.current?.getBoundingClientRect();
      const midFrac = rect ? Math.max(0, Math.min(1, (touchRef.current.midX - rect.left) / rect.width)) : 0.5;
      const origMidIndex = startStart + Math.round(origSize * midFrac);
      let newStart = origMidIndex - Math.round(newSize * midFrac);
      let newEnd = newStart + newSize;
      if (newStart < 0) { newEnd -= newStart; newStart = 0; }
      if (newEnd > totalLen) { newStart -= (newEnd - totalLen); newEnd = totalLen; }
      newStart = Math.max(0, newStart);
      if (newEnd - newStart >= totalLen) {
        setViewStart(0);
        setViewEnd(null);
      } else {
        setViewStart(newStart);
        setViewEnd(newEnd);
      }
      return;
    }

    // One-finger pan (when zoomed)
    if (e.touches.length === 1 && !touchRef.current.isPinching && touchRef.current.panStartX !== null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pxDelta = e.touches[0].clientX - touchRef.current.panStartX;
      const curSize = touchRef.current.startEnd - touchRef.current.startStart;
      const indexDelta = Math.round((-pxDelta / rect.width) * curSize);
      let newStart = touchRef.current.startStart + indexDelta;
      let newEnd = touchRef.current.startEnd + indexDelta;
      if (newStart < 0) { newEnd -= newStart; newStart = 0; }
      if (newEnd > totalLen) { newStart -= (newEnd - totalLen); newEnd = totalLen; }
      newStart = Math.max(0, newStart);
      setViewStart(newStart);
      setViewEnd(newEnd);
    }
  }, [chartData, totalLen]);

  const handleTouchEnd = useCallback(() => {
    touchRef.current.isPinching = false;
    touchRef.current.startDist = null;
    touchRef.current.panStartX = null;
  }, []);

  if (!chartData) {
    return (
      <Card className="bg-slate-900/80 border-slate-800 overflow-hidden p-4">
        <div className="text-sm font-semibold text-slate-300 mb-1">
          {lang === 'de' ? 'Flugprofil' : 'Flight Profile'}
        </div>
        <div className="text-xs text-slate-500">
          {lang === 'de' ? 'Keine Telemetrie-History für diesen Flug gespeichert.' : 'No telemetry history stored for this flight.'}
        </div>
      </Card>
    );
  }

  const toggle = (key) => {
    setActiveSeries(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const hasLeft = activeSeries.includes('altitude');
  const hasRight = activeSeries.some(k => k !== 'altitude');

  // Zoom percentage for indicator
  const zoomPct = totalLen > 0 ? Math.round((windowSize / totalLen) * 100) : 100;

  return (
    <Card className="bg-slate-900/80 border-slate-800 overflow-hidden">
      <div className="px-4 pt-3 pb-1">
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {TOGGLE_KEYS.map((key) => {
            const cfg = SERIES_CONFIG[key];
            const active = activeSeries.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`px-3 py-1 rounded-md text-xs font-bold border transition-all ${
                  active
                    ? 'bg-slate-700 border-slate-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            {isZoomed && (
              <>
                <span className="text-[10px] font-mono text-cyan-400">{zoomPct}%</span>
                <button
                  onClick={handleReset}
                  className="px-3 py-1 rounded-md text-xs font-bold border border-cyan-700 bg-cyan-900/40 text-cyan-300 hover:bg-cyan-800/50 transition-all"
                >
                  {lang === 'de' ? 'Reset' : 'Reset'}
                </button>
              </>
            )}
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mb-1">
          {isZoomed
            ? (lang === 'de' ? '🔍 Scrollen/Pinch = Zoom · Ziehen = Verschieben' : '🔍 Scroll/Pinch = Zoom · Drag = Pan')
            : (lang === 'de' ? '🔍 Scrollen oder Pinch zum Zoomen' : '🔍 Scroll or pinch to zoom')}
        </p>
      </div>

      {/* Minimap / overview bar */}
      {isZoomed && (
        <div className="mx-4 mb-1 h-2 bg-slate-800 rounded-full relative overflow-hidden border border-slate-700">
          <div
            className="absolute top-0 h-full bg-cyan-500/30 border border-cyan-500/50 rounded-full"
            style={{
              left: `${(viewStart / totalLen) * 100}%`,
              width: `${(windowSize / totalLen) * 100}%`,
            }}
          />
        </div>
      )}

      <div
        ref={containerRef}
        className="px-2 pb-3 select-none"
        style={{ height: 260, cursor: isZoomed ? (isPanning ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={displayData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <XAxis
              dataKey="time"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            {hasLeft && (
              <YAxis
                yAxisId="left"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                domain={['auto', 'auto']}
              />
            )}
            {hasRight && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={40}
                domain={['auto', 'auto']}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            {activeSeries.map((key) => {
              const cfg = SERIES_CONFIG[key];
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  yAxisId={cfg.yAxisId}
                  stroke={cfg.color}
                  strokeWidth={1.5}
                  dot={false}
                  name={cfg.label}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap justify-center gap-3 px-4 pb-3 text-[10px]">
        {activeSeries.map((key) => {
          const cfg = SERIES_CONFIG[key];
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: cfg.color }} />
              <span className="text-slate-400">{cfg.label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}