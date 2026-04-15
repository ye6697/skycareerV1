import React, { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
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
  const [zoomLeft, setZoomLeft] = useState(null);
  const [zoomRight, setZoomRight] = useState(null);
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

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

  // Sliced data for zoom
  const displayData = zoomLeft !== null && zoomRight !== null
    ? chartData.slice(Math.min(zoomLeft, zoomRight), Math.max(zoomLeft, zoomRight) + 1)
    : chartData;

  const isZoomed = zoomLeft !== null && zoomRight !== null;

  const handleMouseDown = (e) => {
    if (!e || !e.activeLabel) return;
    const idx = chartData.findIndex(d => d.time === e.activeLabel);
    if (idx < 0) return;
    setRefAreaLeft(idx);
    setRefAreaRight(idx);
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !e || !e.activeLabel) return;
    const idx = chartData.findIndex(d => d.time === e.activeLabel);
    if (idx >= 0) setRefAreaRight(idx);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (refAreaLeft === null || refAreaRight === null) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    const left = Math.min(refAreaLeft, refAreaRight);
    const right = Math.max(refAreaLeft, refAreaRight);
    if (right - left < 2) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    setZoomLeft(left);
    setZoomRight(right);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const handleZoomReset = () => {
    setZoomLeft(null);
    setZoomRight(null);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const refLeftLabel = refAreaLeft !== null ? chartData[refAreaLeft]?.time : null;
  const refRightLabel = refAreaRight !== null ? chartData[refAreaRight]?.time : null;

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
          {isZoomed && (
            <button
              onClick={handleZoomReset}
              className="px-3 py-1 rounded-md text-xs font-bold border border-cyan-700 bg-cyan-900/40 text-cyan-300 hover:bg-cyan-800/50 transition-all ml-auto"
            >
              {lang === 'de' ? 'Zoom zurücksetzen' : 'Reset Zoom'}
            </button>
          )}
        </div>
        {!isZoomed && (
          <p className="text-[10px] text-slate-500 mb-1">
            {lang === 'de' ? '↔ Im Chart ziehen um reinzuzoomen' : '↔ Drag on chart to zoom in'}
          </p>
        )}
      </div>

      <div className="px-2 pb-3 select-none" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={displayData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
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
            {isDragging && refLeftLabel && refRightLabel && (
              <ReferenceArea
                x1={refLeftLabel}
                x2={refRightLabel}
                yAxisId={hasLeft ? 'left' : 'right'}
                strokeOpacity={0.3}
                fill="#22d3ee"
                fillOpacity={0.15}
              />
            )}
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