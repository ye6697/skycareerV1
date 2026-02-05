import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Fuel, Calculator, Info } from "lucide-react";

export default function FuelCalculator({ aircraft, contract }) {
  const [fuelRequired, setFuelRequired] = useState(0);
  const [fuelWeight, setFuelWeight] = useState(0);
  const [flightTime, setFlightTime] = useState(0);

  useEffect(() => {
    if (!aircraft || !contract) return;

    // Flight parameters
    const distance = contract.distance_nm || 0;
    const payloadWeight = contract.type === 'passenger' 
      ? (contract.passenger_count || 0) * 85 // 85kg per passenger average
      : (contract.cargo_weight_kg || 0);

    // Aircraft parameters
    const cruiseSpeed = aircraft.type === 'small_prop' ? 140 :
                       aircraft.type === 'turboprop' ? 280 :
                       aircraft.type === 'regional_jet' ? 400 :
                       aircraft.type === 'narrow_body' ? 450 :
                       aircraft.type === 'wide_body' ? 490 : 300;

    const fuelConsumption = aircraft.fuel_consumption_per_hour || 100;

    // Calculate flight time (including taxi, climb, descent - add 0.5h)
    const timeEnRoute = (distance / cruiseSpeed) + 0.5;
    
    // Required fuel (including 30% reserve)
    const fuelNeeded = timeEnRoute * fuelConsumption * 1.3;
    
    // Fuel weight (Jet-A1: ~0.8 kg/L)
    const fuelWeightKg = fuelNeeded * 0.8;

    setFlightTime(timeEnRoute);
    setFuelRequired(Math.ceil(fuelNeeded));
    setFuelWeight(Math.ceil(fuelWeightKg));
  }, [aircraft, contract]);

  if (!aircraft || !contract) return null;

  const payloadWeight = contract.type === 'passenger' 
    ? (contract.passenger_count || 0) * 85
    : (contract.cargo_weight_kg || 0);

  const totalWeight = (aircraft.passenger_capacity || 0) * 20 + payloadWeight + fuelWeight; // Basic empty weight estimate

  return (
    <Card className="p-4 bg-slate-800 border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <Fuel className="w-5 h-5 text-amber-400" />
        <h3 className="font-semibold text-white">Treibstoffberechnung</h3>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-900 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-1">Benötigter Treibstoff</p>
            <p className="text-amber-400 font-mono font-bold">{fuelRequired.toLocaleString()} L</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-1">Treibstoffgewicht</p>
            <p className="text-amber-400 font-mono font-bold">{fuelWeight.toLocaleString()} kg</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-1">Flugzeit (geschätzt)</p>
            <p className="text-blue-400 font-mono font-bold">{flightTime.toFixed(1)} h</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-1">Payload-Gewicht</p>
            <p className="text-emerald-400 font-mono font-bold">{payloadWeight.toLocaleString()} kg</p>
          </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-300">
              <p className="font-medium mb-1">X-Plane Setup:</p>
              <p>• Treibstoff: {fuelRequired.toLocaleString()} L (inkl. 30% Reserve)</p>
              <p>• Payload: {payloadWeight.toLocaleString()} kg</p>
              <p>• Geschätztes Gesamtgewicht: ~{totalWeight.toLocaleString()} kg</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}