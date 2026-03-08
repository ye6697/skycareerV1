import React from 'react';
import { Card } from "@/components/ui/card";
import { Wind, Thermometer, Droplets, CloudLightning } from 'lucide-react';

function WindArrow({ dir }) {
  if (dir == null) return <span className="text-slate-500">—</span>;
  return (
    <span
      className="inline-block text-cyan-400 text-lg"
      style={{ transform: `rotate(${dir}deg)`, display: 'inline-block' }}
      title={`${Math.round(dir)}°`}
    >
      ↑
    </span>
  );
}

function WeatherBar({ value, max, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function WeatherDisplay({ raw }) {
  if (!raw) return null;

  // Wind
  const windDir = raw.wind_direction ?? raw.wind_dir ?? raw.wind_heading ?? raw.ambient_wind_direction ?? null;
  const windKts = raw.wind_speed_kts ?? raw.wind_speed ?? raw.ambient_wind_speed ?? null;

  // Temperature
  const oat = raw.oat_c ?? raw.oat ?? raw.outside_air_temp_c ?? raw.ambient_temperature ?? raw.temperature_c ?? null;

  // Rain/Precip (0-1 or 0-100 scale)
  const rawRain = raw.rain_intensity ?? raw.precipitation ?? raw.rain ?? raw.precip_rate ?? raw.sim_weather_precipitation_rate ?? null;
  const rainPct = rawRain != null ? Math.min(100, rawRain > 1 ? rawRain : rawRain * 100) : null;

  // Turbulence (0-1 or 0-100)
  const rawTurb = raw.turbulence ?? raw.turbulence_intensity ?? raw.sim_weather_turbulence ?? null;
  const turbPct = rawTurb != null ? Math.min(100, rawTurb > 1 ? rawTurb : rawTurb * 100) : null;

  const turbLabel = turbPct == null ? null :
    turbPct < 10 ? 'Smooth' :
    turbPct < 30 ? 'Light' :
    turbPct < 60 ? 'Moderate' :
    turbPct < 80 ? 'Severe' : 'Extreme';

  const turbColor = turbPct == null ? '' :
    turbPct < 10 ? 'bg-emerald-500' :
    turbPct < 30 ? 'bg-amber-400' :
    turbPct < 60 ? 'bg-orange-500' : 'bg-red-500';

  const rainLabel = rainPct == null ? null :
    rainPct < 5 ? 'None' :
    rainPct < 20 ? 'Light' :
    rainPct < 50 ? 'Moderate' : 'Heavy';

  const rainColor = rainPct == null ? '' :
    rainPct < 5 ? 'bg-slate-500' :
    rainPct < 20 ? 'bg-blue-400' :
    rainPct < 50 ? 'bg-blue-500' : 'bg-blue-600';

  const noData = windDir == null && windKts == null && oat == null && rainPct == null && turbPct == null;
  if (noData) return null;

  return (
    <Card className="p-4 bg-slate-800/50 border-slate-700">
      <h3 className="text-sm font-bold text-sky-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
        <Wind className="w-4 h-4" />
        Weather
      </h3>
      <div className="grid grid-cols-2 gap-3 text-xs font-mono">

        {/* Wind Direction + Speed */}
        <div className="col-span-2 flex items-center gap-3 p-2 bg-slate-900/60 rounded-lg">
          <div className="flex flex-col items-center gap-1 min-w-[40px]">
            <WindArrow dir={windDir} />
            <span className="text-[10px] text-slate-500">{windDir != null ? `${Math.round(windDir)}°` : '—'}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-cyan-300 tabular-nums">
                {windKts != null ? Math.round(windKts) : '—'}
              </span>
              <span className="text-slate-500 text-[10px]">kts</span>
            </div>
            <span className="text-slate-500 text-[10px] uppercase">Wind</span>
          </div>
          {windKts != null && (
            <div className={`text-[10px] font-bold px-2 py-1 rounded ${
              windKts < 10 ? 'bg-emerald-900/40 text-emerald-400' :
              windKts < 20 ? 'bg-amber-900/40 text-amber-400' :
              'bg-red-900/40 text-red-400'
            }`}>
              {windKts < 10 ? 'CALM' : windKts < 20 ? 'MOD' : 'STRONG'}
            </div>
          )}
        </div>

        {/* Temperature */}
        {oat != null && (
          <div className="p-2 bg-slate-900/60 rounded-lg flex items-center gap-2">
            <Thermometer className={`w-4 h-4 shrink-0 ${oat > 30 ? 'text-red-400' : oat > 15 ? 'text-amber-400' : oat > 0 ? 'text-sky-400' : 'text-blue-300'}`} />
            <div>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold tabular-nums ${oat > 30 ? 'text-red-400' : oat > 15 ? 'text-amber-400' : oat > 0 ? 'text-sky-400' : 'text-blue-300'}`}>
                  {Math.round(oat)}°
                </span>
                <span className="text-slate-500 text-[10px]">C</span>
              </div>
              <span className="text-slate-500 text-[10px] uppercase">OAT</span>
            </div>
          </div>
        )}

        {/* Precipitation */}
        {rainPct != null && (
          <div className="p-2 bg-slate-900/60 rounded-lg">
            <div className="flex items-center gap-2 mb-1.5">
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-500 text-[10px] uppercase">Rain</span>
              <span className={`ml-auto text-[10px] font-bold ${rainPct < 5 ? 'text-slate-500' : rainPct < 20 ? 'text-blue-400' : 'text-blue-300'}`}>
                {rainLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <WeatherBar value={rainPct} max={100} color={rainColor} />
              <span className="text-slate-400 text-[10px] tabular-nums w-8 text-right">{Math.round(rainPct)}%</span>
            </div>
          </div>
        )}

        {/* Turbulence */}
        {turbPct != null && (
          <div className="col-span-2 p-2 bg-slate-900/60 rounded-lg">
            <div className="flex items-center gap-2 mb-1.5">
              <CloudLightning className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-500 text-[10px] uppercase">Turbulence</span>
              <span className={`ml-auto text-[10px] font-bold ${
                turbPct < 10 ? 'text-emerald-400' :
                turbPct < 30 ? 'text-amber-400' :
                turbPct < 60 ? 'text-orange-400' : 'text-red-400'
              }`}>{turbLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <WeatherBar value={turbPct} max={100} color={turbColor} />
              <span className="text-slate-400 text-[10px] tabular-nums w-8 text-right">{Math.round(turbPct)}%</span>
            </div>
          </div>
        )}

      </div>
    </Card>
  );
}