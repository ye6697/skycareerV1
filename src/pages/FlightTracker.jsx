import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Plane,
  PlaneTakeoff,
  PlaneLanding,
  MapPin,
  Clock,
  Fuel,
  Gauge,
  ArrowUp,
  Star,
  DollarSign,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

import FlightRating from "@/components/flights/FlightRating";

export default function FlightTracker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const contractId = urlParams.get('contractId');

  const [flightPhase, setFlightPhase] = useState('preflight'); // preflight, takeoff, cruise, landing, completed
  const [flightData, setFlightData] = useState({
    altitude: 0,
    speed: 0,
    verticalSpeed: 0,
    heading: 0,
    fuel: 100,
    gForce: 1.0,
    maxGForce: 1.0,
    landingVs: 0
  });

  const { data: contract } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      const contracts = await base44.entities.Contract.filter({ id: contractId });
      return contracts[0];
    },
    enabled: !!contractId
  });

  const { data: flight } = useQuery({
    queryKey: ['flight', contractId],
    queryFn: async () => {
      const flights = await base44.entities.Flight.filter({ contract_id: contractId });
      return flights[0];
    },
    enabled: !!contractId
  });

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const companies = await base44.entities.Company.list();
      return companies[0];
    }
  });

  // Simulate flight data (in real implementation, this would come from X-Plane plugin)
  useEffect(() => {
    if (flightPhase === 'completed') return;

    const interval = setInterval(() => {
      setFlightData(prev => {
        let newData = { ...prev };
        
        // Simulate based on phase
        if (flightPhase === 'takeoff') {
          newData.altitude = Math.min(prev.altitude + Math.random() * 500, 35000);
          newData.speed = Math.min(prev.speed + Math.random() * 20, 450);
          newData.verticalSpeed = 1500 + Math.random() * 500;
          newData.gForce = 1.0 + Math.random() * 0.3;
          newData.maxGForce = Math.max(prev.maxGForce, newData.gForce);
          
          if (newData.altitude >= 10000) {
            setFlightPhase('cruise');
          }
        } else if (flightPhase === 'cruise') {
          newData.altitude = 35000 + (Math.random() - 0.5) * 100;
          newData.speed = 450 + (Math.random() - 0.5) * 20;
          newData.verticalSpeed = (Math.random() - 0.5) * 200;
          newData.gForce = 1.0 + (Math.random() - 0.5) * 0.1;
          newData.maxGForce = Math.max(prev.maxGForce, newData.gForce);
          newData.fuel = Math.max(prev.fuel - 0.1, 0);
        } else if (flightPhase === 'landing') {
          newData.altitude = Math.max(prev.altitude - Math.random() * 300, 0);
          newData.speed = Math.max(prev.speed - Math.random() * 10, 0);
          newData.verticalSpeed = -800 - Math.random() * 400;
          newData.gForce = 1.0 + Math.random() * 0.4;
          newData.maxGForce = Math.max(prev.maxGForce, newData.gForce);
          
          if (newData.altitude <= 0) {
            newData.landingVs = newData.verticalSpeed;
            setFlightPhase('completed');
          }
        }
        
        return newData;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [flightPhase]);

  const completeFlightMutation = useMutation({
    mutationFn: async () => {
      // Calculate ratings based on flight data
      const landingRating = Math.abs(flightData.landingVs) < 100 ? 5 :
                          Math.abs(flightData.landingVs) < 200 ? 4 :
                          Math.abs(flightData.landingVs) < 300 ? 3 :
                          Math.abs(flightData.landingVs) < 500 ? 2 : 1;

      const gForceRating = flightData.maxGForce < 1.3 ? 5 :
                          flightData.maxGForce < 1.5 ? 4 :
                          flightData.maxGForce < 1.8 ? 3 :
                          flightData.maxGForce < 2.0 ? 2 : 1;

      const takeoffRating = 3 + Math.random() * 2; // Simulate
      const flightRating = gForceRating;
      const overallRating = (takeoffRating + flightRating + landingRating) / 3;

      // Generate passenger comments
      const comments = [];
      if (landingRating >= 4) comments.push("Butterweiche Landung! Professionell!");
      else if (landingRating <= 2) comments.push("Die Landung war etwas ruppig...");
      
      if (gForceRating >= 4) comments.push("Sehr angenehmer, sanfter Flug.");
      else if (gForceRating <= 2) comments.push("Mir wurde bei den Turbulenzen übel.");

      if (overallRating >= 4) comments.push("Werde diese Airline weiterempfehlen!");
      else if (overallRating <= 2) comments.push("Ich buche nie wieder hier.");

      // Calculate costs and profit
      const fuelUsed = (100 - flightData.fuel) * 10; // Simplified
      const fuelCost = fuelUsed * 1.5; // $1.50 per liter
      const crewCost = 500; // Simplified
      const maintenanceCost = 200; // Simplified
      
      let revenue = contract?.payout || 0;
      
      // Bonus based on rating
      if (overallRating >= 4.5 && contract?.bonus_potential) {
        revenue += contract.bonus_potential;
      } else if (overallRating >= 4) {
        revenue += (contract?.bonus_potential || 0) * 0.5;
      }

      const profit = revenue - fuelCost - crewCost - maintenanceCost;

      // Update flight record
      await base44.entities.Flight.update(flight.id, {
        status: 'completed',
        arrival_time: new Date().toISOString(),
        takeoff_rating: takeoffRating,
        flight_rating: flightRating,
        landing_rating: landingRating,
        overall_rating: overallRating,
        landing_vs: flightData.landingVs,
        max_g_force: flightData.maxGForce,
        fuel_used_liters: fuelUsed,
        fuel_cost: fuelCost,
        crew_cost: crewCost,
        maintenance_cost: maintenanceCost,
        revenue,
        profit,
        passenger_comments: comments
      });

      // Update contract
      await base44.entities.Contract.update(contractId, { status: 'completed' });

      // Update company
      if (company) {
        await base44.entities.Company.update(company.id, {
          balance: (company.balance || 0) + profit,
          reputation: Math.min(100, Math.max(0, (company.reputation || 50) + (overallRating - 3) * 2)),
          total_flights: (company.total_flights || 0) + 1,
          total_passengers: (company.total_passengers || 0) + (contract?.passenger_count || 0),
          total_cargo_kg: (company.total_cargo_kg || 0) + (contract?.cargo_weight_kg || 0)
        });
      }

      // Create transaction
      await base44.entities.Transaction.create({
        type: 'income',
        category: 'flight_revenue',
        amount: profit,
        description: `Flug: ${contract?.title}`,
        reference_id: flight.id,
        date: new Date().toISOString()
      });

      // Release aircraft and crew
      if (flight?.aircraft_id) {
        await base44.entities.Aircraft.update(flight.aircraft_id, { status: 'available' });
      }
      if (flight?.crew) {
        for (const member of flight.crew) {
          await base44.entities.Employee.update(member.employee_id, { status: 'available' });
        }
      }

      return { overallRating, profit, revenue, fuelCost };
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });

  const phaseLabels = {
    preflight: 'Vorbereitung',
    takeoff: 'Start',
    cruise: 'Reiseflug',
    landing: 'Landeanflug',
    completed: 'Abgeschlossen'
  };

  const getPhaseProgress = () => {
    switch (flightPhase) {
      case 'preflight': return 0;
      case 'takeoff': return 25;
      case 'cruise': return 50;
      case 'landing': return 75;
      case 'completed': return 100;
      default: return 0;
    }
  };

  if (!contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
          <Plane className="w-12 h-12 text-blue-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto p-6">
        {/* Flight Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{contract.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-slate-400">
                <span className="flex items-center gap-1 font-mono">
                  <MapPin className="w-4 h-4" />
                  {contract.departure_airport}
                </span>
                <span>→</span>
                <span className="flex items-center gap-1 font-mono">
                  <MapPin className="w-4 h-4" />
                  {contract.arrival_airport}
                </span>
              </div>
            </div>
            <Badge className={`px-4 py-2 text-lg ${
              flightPhase === 'completed' 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            }`}>
              {phaseLabels[flightPhase]}
            </Badge>
          </div>

          {/* Progress */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="flex items-center gap-2">
                <PlaneTakeoff className="w-4 h-4 text-blue-400" />
                {contract.departure_airport}
              </span>
              <span className="flex items-center gap-2">
                <PlaneLanding className="w-4 h-4 text-emerald-400" />
                {contract.arrival_airport}
              </span>
            </div>
            <Progress value={getPhaseProgress()} className="h-2 bg-slate-700" />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Flight Instruments */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Instruments */}
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-blue-400" />
                Flugdaten
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">Höhe</p>
                  <p className="text-2xl font-mono font-bold text-blue-400">
                    {Math.round(flightData.altitude).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">ft</p>
                </div>
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">Geschwindigkeit</p>
                  <p className="text-2xl font-mono font-bold text-emerald-400">
                    {Math.round(flightData.speed)}
                  </p>
                  <p className="text-xs text-slate-500">kts</p>
                </div>
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">Vertikalgeschw.</p>
                  <p className={`text-2xl font-mono font-bold ${
                    flightData.verticalSpeed > 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {Math.round(flightData.verticalSpeed) > 0 ? '+' : ''}
                    {Math.round(flightData.verticalSpeed)}
                  </p>
                  <p className="text-xs text-slate-500">ft/min</p>
                </div>
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">G-Kraft</p>
                  <p className={`text-2xl font-mono font-bold ${
                    flightData.gForce < 1.3 ? 'text-emerald-400' :
                    flightData.gForce < 1.8 ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    {flightData.gForce.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">G</p>
                </div>
              </div>
            </Card>

            {/* Fuel & Status */}
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Fuel className="w-5 h-5 text-amber-400" />
                  Treibstoff
                </h3>
                <span className="text-amber-400 font-mono">{Math.round(flightData.fuel)}%</span>
              </div>
              <Progress value={flightData.fuel} className="h-3 bg-slate-700" />
            </Card>

            {/* Controls */}
            {flightPhase !== 'completed' && (
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4">Flugsteuerung</h3>
                <div className="flex flex-wrap gap-3">
                  {flightPhase === 'preflight' && (
                    <Button 
                      onClick={() => setFlightPhase('takeoff')}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <PlaneTakeoff className="w-4 h-4 mr-2" />
                      Start beginnen
                    </Button>
                  )}
                  {flightPhase === 'cruise' && (
                    <Button 
                      onClick={() => setFlightPhase('landing')}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      <PlaneLanding className="w-4 h-4 mr-2" />
                      Landeanflug einleiten
                    </Button>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-3">
                  {flightPhase === 'preflight' && "Starte den Flug, wenn du in X-Plane bereit bist."}
                  {flightPhase === 'takeoff' && "Steige auf Reiseflughöhe..."}
                  {flightPhase === 'cruise' && "Du befindest dich im Reiseflug. Leite den Landeanflug ein, wenn du bereit bist."}
                  {flightPhase === 'landing' && "Sinkflug zum Zielflughafen..."}
                </p>
              </Card>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {flightPhase === 'completed' ? (
              <>
                <FlightRating 
                  flight={{
                    takeoff_rating: 3 + Math.random() * 2,
                    flight_rating: flightData.maxGForce < 1.5 ? 4 : 3,
                    landing_rating: Math.abs(flightData.landingVs) < 200 ? 5 : 3,
                    overall_rating: 3.5,
                    landing_vs: flightData.landingVs,
                    max_g_force: flightData.maxGForce,
                    passenger_comments: [
                      Math.abs(flightData.landingVs) < 200 ? "Tolle Landung!" : "Landung war etwas hart.",
                      flightData.maxGForce < 1.5 ? "Angenehmer Flug!" : "Etwas turbulent."
                    ]
                  }} 
                />

                <Button 
                  onClick={() => completeFlightMutation.mutate()}
                  disabled={completeFlightMutation.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 h-12"
                >
                  {completeFlightMutation.isPending ? 'Speichere...' : 'Flug abschließen'}
                </Button>

                {completeFlightMutation.isSuccess && (
                  <Button 
                    variant="outline"
                    onClick={() => navigate(createPageUrl("Dashboard"))}
                    className="w-full border-slate-600 text-white hover:bg-slate-700"
                  >
                    Zurück zum Dashboard
                  </Button>
                )}
              </>
            ) : (
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400" />
                  Passagier-Zufriedenheit
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Max G-Kraft bisher</span>
                    <span className={`font-mono ${
                      flightData.maxGForce < 1.3 ? 'text-emerald-400' :
                      flightData.maxGForce < 1.8 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {flightData.maxGForce.toFixed(2)} G
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Halte die G-Kräfte unter 1.5 für zufriedene Passagiere.
                    Eine sanfte Landung unter 150 ft/min bringt Bonuspunkte!
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}