import React, { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Gauge, Droplet, Wind } from 'lucide-react';

// Real-world runway lengths at major airports (in feet)
const RUNWAY_DATABASE = {
  'KJFK': 14572, 'KLAX': 14100, 'KORD': 13000, 'KDFW': 13401, 'KDEN': 12900,
  'KATL': 12390, 'KIAH': 12945, 'KLGA': 10000, 'KSFO': 11880, 'KBOS': 10000,
  'KMIA': 13444, 'KSEA': 9426, 'KMCO': 12000, 'KPHX': 12800, 'KPHL': 9500,
  'EGLL': 14100, 'LFPG': 14107, 'EDDF': 13615, 'LEMD': 13615, 'LIRF': 12992,
  'KSYD': 11000, 'RJTT': 14888, 'ZSSS': 13615, 'LOWW': 13635, 'UUDD': 13615
};

// Get runway length from airport code (or default 10000 ft)
const getRunwayLength = (airport) => {
  if (!airport) return 10000;
  return RUNWAY_DATABASE[airport] || 10000;
};

// Calculate V-speeds based on aircraft weight and runway length (real world calculations)
const calculateVSpeeds = (maxGrossWeight, runwayLength) => {
  // Rough approximations based on FAA requirements for different aircraft
  // V1 = Decision speed (knots) - typically 70-85% of VR
  // VR = Rotation speed (knots) - roughly 1.3 * Vstall
  // V2 = Takeoff safety speed (knots) - roughly 1.2 * Vstall
  
  // Estimate Vstall based on weight (rough approximation)
  const vstall = Math.sqrt(maxGrossWeight / 1000) * 1.8 + 20;
  
  // Calculate V-speeds
  const vr = Math.round(vstall * 1.3);
  const v2 = Math.round(vstall * 1.2);
  const v1 = Math.round(vr * 0.8);
  
  // Account for runway length - longer runways allow higher speeds
  const runwayFactor = Math.min(1.0, runwayLength / 10000);
  
  return {
    v1: Math.round(v1 * runwayFactor),
    vr: Math.round(vr * runwayFactor),
    v2: Math.round(v2 * runwayFactor)
  };
};

// Calculate fuel requirements based on distance, weight, and reserves
const calculateFuelRequirements = (distance, fuelConsumption, payload, mtow) => {
  // Estimate flight time at 450 knots average cruise
  const cruiseSpeed = 450;
  const flightTime = distance / cruiseSpeed;
  
  // Trip fuel consumption
  const tripFuel = fuelConsumption * flightTime;
  
  // Reserves: 5% of trip fuel for contingency + 30 min reserve at cruise burn
  const contingencyFuel = tripFuel * 0.05;
  const reserveFuel = (fuelConsumption * 0.5); // 30 min at cruise
  
  const totalFuelRequired = tripFuel + contingencyFuel + reserveFuel;
  const fuelMargin = ((totalFuelRequired / mtow) * 100).toFixed(1);
  
  return {
    trip: Math.round(tripFuel),
    contingency: Math.round(contingencyFuel),
    reserve: Math.round(reserveFuel),
    total: Math.round(totalFuelRequired),
    flightTime: (flightTime * 60).toFixed(0), // in minutes
    fuelMargin: parseFloat(fuelMargin)
  };
};

// Calculate takeoff distance needed
const calculateTakeoffDistance = (maxGrossWeight, runwayLength, altitude = 0) => {
  // Simplified calculation: typical takeoff distance at sea level is 35-50% of MTOW dependent
  // Distance increases with altitude and weight
  let baseDistance = (maxGrossWeight / 1000) * 400; // rough estimate
  
  // Altitude correction (rough): add 10% per 1000 ft altitude
  const altitudeCorrection = 1 + (altitude / 1000) * 0.1;
  
  const requiredDistance = baseDistance * altitudeCorrection;
  const available = runwayLength * 3.28084; // convert ft to approximate meters
  
  return {
    required: Math.round(requiredDistance),
    available: Math.round(available),
    adequate: requiredDistance < available
  };
};

export default function PreFlightCalculator({ aircraft, contract }) {
  const [customWeight, setCustomWeight] = useState(null);
  const [customFuel, setCustomFuel] = useState(null);
  const [departureAltitude, setDepartureAltitude] = useState('0');

  if (!aircraft || !contract) {
    return (
      <Card className="p-6 bg-slate-800 border border-slate-700">
        <p className="text-slate-400">Wähle ein Flugzeug und einen Auftrag</p>
      </Card>
    );
  }

  // Calculate payload and weight
  const payload = (contract.type === 'passenger' 
    ? (contract.passenger_count || 0) * 85 
    : (contract.cargo_weight_kg || 0));
  
  const customWeightValue = customWeight !== null 
    ? parseFloat(customWeight) 
    : (aircraft.purchase_price / 50000 + payload); // Rough estimate if not set

  const depAltitude = parseInt(departureAltitude) || 0;
  const depRunwayLength = getRunwayLength(contract.departure_airport);
  const arrRunwayLength = getRunwayLength(contract.arrival_airport);

  const vSpeeds = calculateVSpeeds(customWeightValue * 100, depRunwayLength);
  const fuelCalc = calculateFuelRequirements(
    contract.distance_nm,
    aircraft.fuel_consumption_per_hour,
    payload,
    customWeightValue * 100
  );
  const takeoffDist = calculateTakeoffDistance(customWeightValue * 100, depRunwayLength, depAltitude);

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <Card className="p-4 bg-slate-900 border border-slate-700">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm text-slate-300">Abflugflughafen</Label>
            <div className="mt-1 p-2 bg-slate-800 rounded text-white font-mono">
              {contract.departure_airport} ({depRunwayLength} ft)
            </div>
          </div>
          <div>
            <Label className="text-sm text-slate-300">Zielflughafen</Label>
            <div className="mt-1 p-2 bg-slate-800 rounded text-white font-mono">
              {contract.arrival_airport} ({arrRunwayLength} ft)
            </div>
          </div>
          <div>
            <Label htmlFor="weight" className="text-sm text-slate-300">Gewicht (t)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={customWeight !== null ? customWeight : ''}
              onChange={(e) => setCustomWeight(e.target.value)}
              placeholder={(customWeightValue).toFixed(1)}
              className="mt-1 bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div>
            <Label htmlFor="altitude" className="text-sm text-slate-300">Abflugflughöhe (ft)</Label>
            <Input
              id="altitude"
              type="number"
              value={departureAltitude}
              onChange={(e) => setDepartureAltitude(e.target.value)}
              className="mt-1 bg-slate-800 border-slate-600 text-white"
            />
          </div>
        </div>
      </Card>

      {/* V-Speeds */}
      <Card className="p-4 bg-gradient-to-br from-blue-900/30 to-slate-800 border border-blue-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-5 h-5 text-blue-400" />
          <h4 className="font-semibold text-white">V-Speeds (Startgeschwindigkeiten)</h4>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900 p-3 rounded-lg text-center border border-slate-700">
            <p className="text-xs text-slate-400">V1</p>
            <p className="text-2xl font-bold text-blue-400">{vSpeeds.v1} kt</p>
            <p className="text-xs text-slate-500">Entscheidungsgeschwindigkeit</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg text-center border border-slate-700">
            <p className="text-xs text-slate-400">VR</p>
            <p className="text-2xl font-bold text-sky-400">{vSpeeds.vr} kt</p>
            <p className="text-xs text-slate-500">Rotationsgeschwindigkeit</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg text-center border border-slate-700">
            <p className="text-xs text-slate-400">V2</p>
            <p className="text-2xl font-bold text-emerald-400">{vSpeeds.v2} kt</p>
            <p className="text-xs text-slate-500">Sicherheitsgeschwindigkeit</p>
          </div>
        </div>
      </Card>

      {/* Fuel Calculation */}
      <Card className="p-4 bg-gradient-to-br from-amber-900/30 to-slate-800 border border-amber-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Droplet className="w-5 h-5 text-amber-400" />
          <h4 className="font-semibold text-white">Treibstoffberechnung</h4>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400">Trip Fuel</p>
            <p className="text-xl font-bold text-amber-400">{fuelCalc.trip} L</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400">Contingency</p>
            <p className="text-xl font-bold text-orange-400">{fuelCalc.contingency} L</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400">Reserve</p>
            <p className="text-xl font-bold text-orange-300">{fuelCalc.reserve} L</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg border border-blue-700/50 bg-blue-900/20">
            <p className="text-xs text-slate-400">Gesamt erforderlich</p>
            <p className="text-xl font-bold text-yellow-400">{fuelCalc.total} L</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Flugzeit:</span>
          <span className="text-white font-medium">{fuelCalc.flightTime} Minuten</span>
        </div>
      </Card>

      {/* Takeoff Distance */}
      <Card className="p-4 bg-gradient-to-br from-purple-900/30 to-slate-800 border border-purple-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Wind className="w-5 h-5 text-purple-400" />
          <h4 className="font-semibold text-white">Startrecke</h4>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400">Erforderlich</p>
            <p className="text-2xl font-bold text-purple-400">{takeoffDist.required} m</p>
          </div>
          <div className={`bg-slate-900 p-3 rounded-lg border ${takeoffDist.adequate ? 'border-emerald-700/50 bg-emerald-900/20' : 'border-red-700/50 bg-red-900/20'}`}>
            <p className="text-xs text-slate-400">Verfügbar</p>
            <p className={`text-2xl font-bold ${takeoffDist.adequate ? 'text-emerald-400' : 'text-red-400'}`}>
              {takeoffDist.available} m
            </p>
          </div>
        </div>
        
        {takeoffDist.adequate ? (
          <div className="flex items-start gap-2 p-2 bg-emerald-500/10 border border-emerald-700/30 rounded">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-400">Start möglich</p>
              <p className="text-xs text-emerald-300">Genug Startrecke vorhanden ({(takeoffDist.available - takeoffDist.required).toLocaleString()} m Sicherheitsmarge)</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-700/30 rounded">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">Start nicht möglich!</p>
              <p className="text-xs text-red-300">Zu wenig Startrecke ({(takeoffDist.required - takeoffDist.available).toLocaleString()} m zu kurz)</p>
            </div>
          </div>
        )}
      </Card>

      {/* Warnings */}
      {fuelCalc.total > aircraft.fuel_consumption_per_hour * 8 && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-700/30 rounded">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">Treibstoff Warnung</p>
            <p className="text-xs text-amber-300">Großer Treibstoffbedarf - stelle sicher, dass das Flugzeug betankt ist</p>
          </div>
        </div>
      )}
    </div>
  );
}