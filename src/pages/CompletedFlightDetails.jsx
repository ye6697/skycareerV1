import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  MapPin,
  DollarSign,
  Plane,
  Star,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

import FlightRating from "@/components/flights/FlightRating";

export default function CompletedFlightDetails() {
  const navigate = useNavigate();
  const location = useLocation();

  const urlParams = new URLSearchParams(window.location.search);
  const contractId = urlParams.get('contractId');
  
  // Hole Daten aus State von FlightTracker
  const passedFlightData = location.state?.flightData;
  const passedFlight = location.state?.flight;
  const passedContract = location.state?.contract;

  const { data: contract } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      if (!contractId) return null;
      const contracts = await base44.entities.Contract.filter({ id: contractId });
      return contracts[0];
    },
    enabled: !!contractId && !passedContract
  });

  const { data: flights = [] } = useQuery({
    queryKey: ['flights', contractId],
    queryFn: async () => {
      if (!contractId) return [];
      const result = await base44.entities.Flight.filter({ contract_id: contractId });
      return result.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!contractId && !passedFlight
  });

  // Prefer passed flight from navigation state, fallback to latest from DB
  const flight = passedFlight || flights[0];
  const finalContract = passedContract || contract;

  if (!finalContract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-white mb-4">Auftrag nicht gefunden</p>
          <Button 
            onClick={() => navigate(createPageUrl("ActiveFlights"))}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Zurück zu Aktiven Flügen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex gap-3">
            <Button 
              variant="ghost"
              onClick={() => navigate(createPageUrl("ActiveFlights"))}
              className="mb-4 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
            {flight && (
              <Button 
                variant="ghost"
                onClick={() => navigate(createPageUrl("Fleet"), { 
                  state: { 
                    updatedAircraft: {
                      id: flight.aircraft_id,
                      status: flight.status === 'completed' ? 'available' : 'damaged',
                      accumulated_maintenance_cost: flight.xplane_data?.accumulated_maintenance_cost || 0,
                      total_flight_hours: flight.flight_duration_hours,
                      current_value: flight.xplane_data?.current_value
                    }
                  }
                })}
                className="mb-4 text-slate-400 hover:text-white"
              >
                Zur Flotte
              </Button>
            )}
          </div>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{finalContract.title}</h1>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  Abgeschlossen
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {finalContract.departure_airport}
                </span>
                <span>→</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {finalContract.arrival_airport}
                </span>
                <span className="text-slate-600">|</span>
                <span>{finalContract.distance_nm} NM</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-emerald-600">
                ${finalContract.payout?.toLocaleString()}
              </p>
            </div>
          </div>
        </motion.div>

        {flight ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Flight Rating */}
              <FlightRating flight={flight} />

              {/* Flight Details */}
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Plane className="w-5 h-5 text-blue-400" />
                  Flugdetails
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Max G-Kraft</p>
                    <p className={`text-2xl font-mono font-bold ${
                      flight.max_g_force < 1.5 ? 'text-emerald-400' :
                      flight.max_g_force < 2.0 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {flight.max_g_force?.toFixed(2)} G
                    </p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Landegeschwindigkeit</p>
                    <p className={`text-2xl font-mono font-bold ${
                      Math.abs(flight.landing_vs) < 150 ? 'text-emerald-400' :
                      Math.abs(flight.landing_vs) < 300 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {Math.abs(flight.landing_vs)} ft/min
                    </p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Treibstoff verbraucht</p>
                    <p className="text-2xl font-mono font-bold text-blue-400">
                      {flight.fuel_used_liters?.toLocaleString()} L
                    </p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Flugdauer</p>
                    <p className="text-2xl font-mono font-bold text-slate-300">
                      {flight.flight_duration_hours?.toFixed(1)} h
                    </p>
                  </div>
                </div>

                {/* Final Score */}
                {flight.xplane_data?.final_score !== undefined && (
                  <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Finaler Flug-Score</p>
                    <p className={`text-3xl font-mono font-bold ${
                      flight.xplane_data.final_score >= 95 ? 'text-emerald-400' :
                      flight.xplane_data.final_score >= 85 ? 'text-green-400' :
                      flight.xplane_data.final_score >= 70 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {Math.round(flight.xplane_data.final_score)} / 100
                    </p>
                  </div>
                )}

                {/* Flight Events */}
                {flight.xplane_data?.events && Object.entries(flight.xplane_data.events).some(([_, val]) => val) && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-300 mb-3">Vorfälle während des Fluges:</h4>
                    <div className="space-y-2">
                      {flight.xplane_data.events.tailstrike && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Heckaufsetzer
                        </div>
                      )}
                      {flight.xplane_data.events.stall && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Strömungsabriss
                        </div>
                      )}
                      {flight.xplane_data.events.overstress && (
                        <div className="flex items-center gap-2 text-orange-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Strukturbelastung
                        </div>
                      )}
                      {flight.xplane_data.events.flaps_overspeed && (
                        <div className="flex items-center gap-2 text-orange-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Klappen-Overspeed
                        </div>
                      )}
                      {flight.xplane_data.events.gear_up_landing && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Landung ohne Fahrwerk
                        </div>
                      )}
                      {flight.xplane_data.events.crash && (
                        <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
                          <AlertTriangle className="w-4 h-4" />
                          CRASH
                        </div>
                      )}
                      {flight.xplane_data.events.harsh_controls && (
                        <div className="flex items-center gap-2 text-orange-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Ruppige Steuerung
                        </div>
                      )}
                      {flight.xplane_data.events.high_g_force && (
                        <div className="flex items-center gap-2 text-orange-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Hohe G-Kräfte
                        </div>
                      )}
                      {flight.xplane_data.events.hard_landing && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Harte Landung
                        </div>
                      )}
                      {flight.xplane_data.events.fuel_emergency && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Treibstoff-Notstand
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Financial Summary */}
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                  Finanzübersicht
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">Einnahmen</span>
                    <span className="text-emerald-400 font-mono">${flight.revenue?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">Treibstoff ({flight.fuel_used_liters?.toLocaleString()} L)</span>
                    <span className="text-red-400 font-mono">-${flight.fuel_cost?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">Crew ({flight.flight_duration_hours?.toFixed(1)}h)</span>
                    <span className="text-red-400 font-mono">-${flight.crew_cost?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">Wartung ({flight.flight_duration_hours?.toFixed(1)}h)</span>
                    <span className="text-red-400 font-mono">-${flight.maintenance_cost?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">Flughafen-Gebühren</span>
                    <span className="text-red-400 font-mono">-$150</span>
                  </div>
                  <div className="flex justify-between items-center pt-3">
                    <span className="font-semibold">Gewinn/Verlust</span>
                    <span className={`text-xl font-bold font-mono ${
                      flight.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      ${flight.profit?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Passenger Comments */}
              {flight.passenger_comments && flight.passenger_comments.length > 0 && (
                <Card className="p-6 bg-slate-800/50 border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Passagier-Kommentare</h3>
                  <div className="space-y-2">
                    {flight.passenger_comments.map((comment, idx) => (
                      <p key={idx} className="text-slate-300 text-sm">
                        "{comment}"
                      </p>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <Card className="p-12 text-center bg-slate-800 border border-slate-700">
            <AlertTriangle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Keine Flugdaten</h3>
            <p className="text-slate-400">
              Für diesen Auftrag wurden keine Flugdaten gefunden
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}