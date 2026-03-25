import React from 'react';
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Fuel, PlaneLanding, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function FuelPrediction({ flightData, flightStartTime, distanceInfo, flight, existingFlight }) {
  const { lang } = useLanguage();
  const xpd = (flight || existingFlight)?.xplane_data || {};
  const initialFuelKg = xpd.initial_fuel_kg || 0;
  const fuelUsedSoFar = Math.max(0, initialFuelKg - flightData.fuelKg);
  const elapsedHours = flightStartTime ? (Date.now() - flightStartTime) / 3600000 : 0;
  const burnRateKgPerHour = elapsedHours > 0.01 ? fuelUsedSoFar / elapsedHours : 0;
  const groundSpeed = flightData.speed || 200;
  const remainingNm = distanceInfo.remainingNm;

  // Estimate: cruise burn for remaining distance + descent (lower burn ~60% for last 40NM)
  const descentNm = Math.min(40, remainingNm * 0.15);
  const cruiseNm = remainingNm - descentNm;
  const cruiseHours = groundSpeed > 50 ? cruiseNm / groundSpeed : 0;
  const descentHours = groundSpeed > 50 ? descentNm / (groundSpeed * 0.7) : 0;
  const fuelNeeded = (cruiseHours * burnRateKgPerHour) + (descentHours * burnRateKgPerHour * 0.6);
  const fuelAtArrival = flightData.fuelKg - fuelNeeded;
  const fuelAtArrivalPct = initialFuelKg > 0 ? (fuelAtArrival / initialFuelKg) * 100 : 0;

  const showPrediction = flightData.wasAirborne && flightStartTime && flightData.fuelKg > 0 && distanceInfo.remainingNm > 0 && burnRateKgPerHour >= 1 && initialFuelKg >= 1;

  const isLow = fuelAtArrival < initialFuelKg * 0.05;
  const isCritical = fuelAtArrival < 0;
  const color = isCritical ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400';
  const bgColor = isCritical ? 'bg-red-900/20 border-red-800/50' : isLow ? 'bg-amber-900/20 border-amber-800/50' : 'bg-emerald-900/20 border-emerald-800/50';

  return (
    <Card className="p-6 bg-slate-800/50 border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-400">
          <Fuel className="w-5 h-5 text-amber-400" />
          {t('fuel_title', lang)}
        </h3>
        <span className="text-amber-400 font-mono">{Math.round(flightData.fuel)}%</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-slate-800 rounded text-center">
          <p className="text-xs text-slate-400">{t('percent', lang)}</p>
          <p className="text-lg font-mono font-bold text-amber-400">
            {Math.round(flightData.fuel)}%
          </p>
        </div>
        <div className="p-2 bg-slate-800 rounded text-center">
          <p className="text-xs text-slate-400">{t('remaining', lang)}</p>
          <p className="text-lg font-mono font-bold text-amber-400">
            {Math.round(flightData.fuelKg).toLocaleString()} kg
          </p>
        </div>
      </div>

      {/* Fuel Prediction at Arrival */}
      {showPrediction && (
        <div className={`mt-3 p-3 rounded-lg border ${bgColor}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 font-mono uppercase">
              {lang === 'de' ? 'Prognose bei Ankunft' : 'Est. at Arrival'}
            </span>
            <PlaneLanding className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-xl font-mono font-bold ${color}`}>
              {isCritical ? '⚠ ' : ''}{Math.round(Math.max(0, fuelAtArrival)).toLocaleString()} kg
            </span>
            <span className={`text-sm font-mono ${color}`}>
              {Math.round(Math.max(0, fuelAtArrivalPct))}%
            </span>
          </div>
          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 font-mono">
            <span>BURN {Math.round(burnRateKgPerHour)} kg/h</span>
            <span>{lang === 'de' ? 'inkl. Descent' : 'incl. descent'}</span>
          </div>
          {isCritical && (
            <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {lang === 'de' ? 'Treibstoff reicht nicht bis zum Ziel!' : 'Fuel insufficient for destination!'}
            </div>
          )}
        </div>
      )}

      {flightData.fuel < 3 && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4" />
          {t('fuel_emergency', lang)}
        </div>
      )}
    </Card>
  );
}