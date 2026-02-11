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
  CheckCircle2,
  Loader,
  Timer
} from "lucide-react";

import FlightRating from "@/components/flights/FlightRating";
import LandingQualityVisual from "@/components/flights/LandingQualityVisual";
import ActiveFailuresDisplay from "@/components/flights/ActiveFailuresDisplay";
import FlightMap from "@/components/flights/FlightMap";
import RouteWaypoints from "@/components/flights/RouteWaypoints";

export default function CompletedFlightDetails() {
  const navigate = useNavigate();
  const location = useLocation();

  const urlParams = new URLSearchParams(window.location.search);
  const contractId = urlParams.get('contractId');
  
  // Hole Daten aus State von FlightTracker
  const passedFlight = location.state?.flight;
  const passedContract = location.state?.contract;

  const { data: gameSettings } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const settings = await base44.entities.GameSettings.list();
      return settings[0] || null;
    }
  });

  const { data: contract } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      if (!contractId) return null;
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      if (!companies[0]) return null;
      const contracts = await base44.entities.Contract.filter({ id: contractId, company_id: companies[0].id });
      return contracts[0];
    },
    enabled: !!contractId && !passedContract
  });

  const { data: flights = [] } = useQuery({
    queryKey: ['flights', contractId],
    queryFn: async () => {
      if (!contractId) return [];
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      if (!companies[0]) return [];
      const result = await base44.entities.Flight.filter({ contract_id: contractId, company_id: companies[0].id });
      return result.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!contractId && !passedFlight
  });

  // Prefer passed flight from navigation state, fallback to latest from DB
  const flight = passedFlight || flights[0];
  const finalContract = passedContract || contract;

  // Fetch route waypoints for the map
  const { data: routeData } = useQuery({
    queryKey: ['completed-route', finalContract?.departure_airport, finalContract?.arrival_airport],
    queryFn: async () => {
      const response = await base44.functions.invoke('generateRouteWaypoints', {
        departure_icao: finalContract.departure_airport,
        arrival_icao: finalContract.arrival_airport,
        aircraft_type: 'narrow_body',
        distance_nm: finalContract.distance_nm || 300
      });
      return response.data;
    },
    enabled: !!finalContract?.departure_airport && !!finalContract?.arrival_airport,
    staleTime: Infinity,
  });

  // If we don't have all required data, auto-refresh
  React.useEffect(() => {
    if (!flight || !finalContract) {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [flight, finalContract]);

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

  // Show loading if no flight data
  if (!flight) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Plane className="w-12 h-12 text-blue-400 mx-auto" />
          </div>
          <p className="text-white mb-4">Flugdaten werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button 
            variant="ghost"
            onClick={() => navigate(createPageUrl("ActiveFlights"))}
            className="mb-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold">{finalContract.title}</h1>
                {(flight?.xplane_data?.events?.crash || flight?.status === 'failed') ? (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    CRASH - Fehlgeschlagen
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Abgeschlossen
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-slate-400 text-sm sm:text-base">
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
            <div className="sm:text-right">
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400">
                ${Math.round(finalContract.payout || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </motion.div>

        {flight ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Flight Route Map */}
              {finalContract && (
                <FlightMap
                  flightData={{
                    latitude: 0,
                    longitude: 0,
                    departure_lat: flight?.xplane_data?.departure_lat || routeData?.waypoints?.[0]?.lat || 0,
                    departure_lon: flight?.xplane_data?.departure_lon || routeData?.waypoints?.[0]?.lon || 0,
                    arrival_lat: flight?.xplane_data?.arrival_lat || routeData?.waypoints?.[routeData?.waypoints?.length - 1]?.lat || 0,
                    arrival_lon: flight?.xplane_data?.arrival_lon || routeData?.waypoints?.[routeData?.waypoints?.length - 1]?.lon || 0,
                    heading: 0,
                    altitude: 0,
                    speed: 0,
                  }}
                  contract={finalContract}
                  routeWaypoints={routeData?.waypoints || []}
                  staticMode={true}
                  title="Flugroute"
                />
              )}

              {/* Flight Rating */}
              <FlightRating flight={flight} />

              {/* Landing Quality Visual */}
              <LandingQualityVisual flight={flight} gameSettings={gameSettings} />

              {/* Flight Details */}
              <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Plane className="w-5 h-5 text-blue-400" />
                  Flugdetails
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {(() => {
                    const isCrash = flight?.xplane_data?.events?.crash || flight?.status === 'failed';
                    // Use actual landing G-force, NOT max_g_force from the entire flight
                    const landingG = flight?.xplane_data?.landingGForce ?? flight?.xplane_data?.landing_g_force ?? 0;
                    return (
                      <div className="p-4 bg-slate-900 rounded-lg">
                        <p className="text-slate-400 text-sm mb-1">G-Kraft beim Aufsetzen</p>
                        {isCrash ? (
                          <p className="text-2xl font-mono font-bold text-red-500">CRASH</p>
                        ) : (
                          <p className={`text-2xl font-mono font-bold ${
                            landingG < 1.5 ? 'text-emerald-400' :
                            landingG < 2.0 ? 'text-amber-400' :
                            'text-red-400'
                          }`}>
                            {landingG?.toFixed(2)} G
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Sinkrate beim Landen</p>
                    <p className={`text-2xl font-mono font-bold ${
                      Math.abs(flight.landing_vs || 0) < 150 ? 'text-emerald-400' :
                      Math.abs(flight.landing_vs || 0) < 300 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {Math.abs(flight.landing_vs || 0)} ft/min
                    </p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Landegeschwindigkeit</p>
                    <p className="text-2xl font-mono font-bold text-blue-400">
                      {Math.round(flight?.xplane_data?.speed || passedFlightData?.speed || 0)} kts
                    </p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Treibstoff verbraucht</p>
                    <p className="text-2xl font-mono font-bold text-blue-400">
                      {Math.round(flight.fuel_used_liters || 0).toLocaleString()} L
                    </p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Flugdauer</p>
                    <p className="text-2xl font-mono font-bold text-slate-300">
                      {flight.flight_duration_hours?.toFixed(1)} h
                    </p>
                  </div>
                </div>

                {/* Deadline Result */}
                {flight.xplane_data?.deadlineMinutes && (
                  <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">Deadline</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">
                          Vorgabe: {flight.xplane_data.deadlineMinutes} min | Geflogen: {Math.round(flight.flight_duration_hours * 60)} min
                        </p>
                      </div>
                      {flight.xplane_data.madeDeadline ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">+20 Punkte</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                          <span className="text-red-400 font-bold">-20 Punkte</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Final Score */}
                <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                  <p className="text-slate-400 text-sm mb-1">Finaler Flug-Score</p>
                  {(() => {
                    const score = flight?.xplane_data?.final_score ?? flight?.flight_score ?? 0;
                    return (
                      <p className={`text-3xl font-mono font-bold ${
                        score >= 95 ? 'text-emerald-400' :
                        score >= 85 ? 'text-green-400' :
                        score >= 70 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {Math.round(score)} / 100
                      </p>
                    );
                  })()}
                </div>
                
                {/* Landing Quality Details */}
                {(() => {
                  // Determine landing type: prefer stored, then compute from G-force
                  let lt = flight.xplane_data?.landingType;
                  const landingG = flight.xplane_data?.landingGForce ?? flight.xplane_data?.landing_g_force ?? flight.max_g_force ?? 0;
                  if (!lt && landingG > 0 && !flight.xplane_data?.events?.crash) {
                    if (landingG < 0.5) lt = 'butter';
                    else if (landingG < 1.0) lt = 'soft';
                    else if (landingG < 1.6) lt = 'acceptable';
                    else if (landingG < 2.0) lt = 'hard';
                    else lt = 'very_hard';
                  }
                  if (!lt) return null;

                  // Compute score/financial impact from landing type
                  const totalRev = flight.revenue || flight.xplane_data?.totalRevenue || 0;
                  let scoreChange = 0;
                  let financialImpact = 0;
                  
                  if (lt === 'butter') { scoreChange = 40; financialImpact = totalRev * 4; }
                  else if (lt === 'soft') { scoreChange = 20; financialImpact = totalRev * 2; }
                  else if (lt === 'acceptable') { scoreChange = 5; financialImpact = 0; }
                  else if (lt === 'hard') { scoreChange = -30; financialImpact = -(totalRev * 0.25); }
                  else if (lt === 'very_hard') { scoreChange = -50; financialImpact = -(totalRev * 0.5); }
                  const vs = Math.abs(flight.landing_vs || 0);

                  return (
                  <div className="mt-4 p-4 bg-slate-900 rounded-lg space-y-3">
                    <div>
                      <p className="text-slate-400 text-sm mb-2 font-semibold">Landungsqualitäts-Analyse</p>
                      <p className="text-xs text-slate-400 mb-3">Basierend auf G-Kraft beim Landen ({landingG.toFixed(2)} G)</p>
                    </div>

                    {/* Landing Type */}
                    <div className="flex items-center gap-2">
                      {lt === 'crash' && (
                        <>
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <span className="text-red-500 font-bold">CRASH</span>
                          <span className="text-slate-400 ml-2">({vs} ft/min)</span>
                        </>
                      )}
                      {lt === 'very_hard' && (
                        <>
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <span className="text-red-500 font-bold">Sehr Harte Landung</span>
                          <span className="text-slate-400 ml-2">({landingG.toFixed(2)} G)</span>
                        </>
                      )}
                      {lt === 'hard' && (
                        <>
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                          <span className="text-red-400 font-bold">Harte Landung</span>
                          <span className="text-slate-400 ml-2">({landingG.toFixed(2)} G)</span>
                        </>
                      )}
                      {lt === 'acceptable' && (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-blue-400" />
                          <span className="text-blue-400 font-semibold">Akzeptable Landung</span>
                          <span className="text-slate-400 ml-2">({landingG.toFixed(2)} G)</span>
                        </>
                      )}
                      {lt === 'soft' && (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Weiche Landung</span>
                          <span className="text-slate-400 ml-2">({landingG.toFixed(2)} G)</span>
                        </>
                      )}
                      {lt === 'butter' && (
                        <>
                          <Star className="w-5 h-5 text-amber-400" />
                          <span className="text-amber-400 font-bold">BUTTERWEICHE LANDUNG!</span>
                          <span className="text-slate-400 ml-2">({landingG.toFixed(2)} G)</span>
                        </>
                      )}
                      </div>

                      {/* Score and Cost Impact */}
                      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Score-Auswirkung</p>
                        <p className={`font-mono font-bold ${
                          scoreChange > 0 ? 'text-emerald-400' :
                          scoreChange < 0 ? 'text-red-400' :
                          'text-slate-400'
                        }`}>
                          {scoreChange > 0 ? '+' : ''}{scoreChange} Punkte
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Finanzielle Auswirkung</p>
                        {financialImpact > 0 ? (
                          <p className="font-mono font-bold text-emerald-400">
                           +${Math.round(financialImpact).toLocaleString()}
                          </p>
                        ) : financialImpact < 0 ? (
                          <p className="font-mono font-bold text-red-400">
                           -${Math.round(Math.abs(financialImpact)).toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-slate-400">$0</p>
                        )}
                      </div>
                      </div>
                      </div>
                  );
                })()}

                      {/* Live Maintenance Costs */}
                  {flight.xplane_data?.maintenanceCost > 0 && (
                    <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg">
                      <p className="text-sm text-red-300 mb-2">Wartungskosten im Flug:</p>
                      <p className="text-2xl font-bold text-red-400">${Math.round(flight.xplane_data.maintenanceCost || 0).toLocaleString()}</p>
                    </div>
                  )}

                  {/* Total Maintenance Breakdown */}
                  {(flight.xplane_data?.maintenanceCost > 0 || flight.xplane_data?.crashMaintenanceCost > 0 || flight.xplane_data?.events?.crash) && (
                    <div className="mt-4 p-4 bg-slate-900 rounded-lg space-y-2">
                      <h4 className="text-sm font-semibold text-white mb-3">Wartungskosten-Aufschlüsselung:</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-slate-300">
                          <span>Reguläre Wartung ({flight.flight_duration_hours?.toFixed(1)}h × $400/h)</span>
                          <span className="text-amber-400">${Math.round((flight.flight_duration_hours || 0) * 400).toLocaleString()}</span>
                        </div>
                        {flight.xplane_data?.maintenanceCost > 0 && (
                          <div className="flex justify-between text-slate-300">
                            <span>Event-Schäden im Flug</span>
                            <span className="text-red-400">${Math.round(flight.xplane_data.maintenanceCost || 0).toLocaleString()}</span>
                          </div>
                        )}
                        {flight.xplane_data?.crashMaintenanceCost > 0 && (
                          <div className="flex justify-between text-slate-300">
                            <span>Crash-Reparatur (70% des Neuwertes)</span>
                            <span className="text-red-500 font-bold">${Math.round(flight.xplane_data.crashMaintenanceCost || 0).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-slate-700 font-bold">
                          <span className="text-white">Gesamt Wartungskosten</span>
                          <span className="text-red-400">${Math.round(flight.maintenance_cost || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Active Failures during flight */}
                  {flight?.active_failures && flight.active_failures.length > 0 && (
                    <div className="mt-4 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
                      <ActiveFailuresDisplay failures={flight.active_failures} />
                    </div>
                  )}

                  {/* Maintenance Damage Breakdown */}
                  {flight?.maintenance_damage && Object.values(flight.maintenance_damage).some(v => v > 0) && (
                    <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                      <h4 className="text-sm font-semibold text-white mb-3">Wartungsschäden durch diesen Flug:</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(flight.maintenance_damage).filter(([_, v]) => v > 0).map(([cat, dmg]) => {
                          const labels = {
                            engine: "Triebwerk", hydraulics: "Hydraulik", avionics: "Avionik",
                            airframe: "Struktur", landing_gear: "Fahrwerk", electrical: "Elektrik",
                            flight_controls: "Steuerung", pressurization: "Druckkabine"
                          };
                          return (
                            <div key={cat} className="flex justify-between p-2 bg-slate-800 rounded">
                              <span className="text-slate-400">{labels[cat] || cat}</span>
                              <span className="text-red-400 font-mono">+{dmg.toFixed(0)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Flight Events */}
                  {(() => {
                    const events = flight?.xplane_data?.events;
                    if (!events) return null;
                    // Filter out falsy values AND numeric 0 values (the "schwarze Null" bug)
                    const activeEvents = Object.entries(events).filter(([key, val]) => val === true);
                    if (activeEvents.length === 0 && !(events.fuel_emergency === true && (flight?.xplane_data?.fuel_percentage || flight?.xplane_data?.fuel || 100) < 3)) return null;
                    return (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">Vorfälle während des Fluges:</h4>
                        <div className="space-y-2">
                        {events.tailstrike === true && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Heckaufsetzer
                        </div>
                      )}
                      {events.stall === true && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Strömungsabriss
                        </div>
                      )}
                      {events.overstress === true && (
                        <div className="flex items-center gap-2 text-orange-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Strukturbelastung
                        </div>
                      )}
                      {events.overspeed === true && (
                        <div className="flex items-center gap-2 text-orange-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Overspeed
                        </div>
                      )}
                      {events.flaps_overspeed === true && (
                        <div className="flex items-center gap-2 text-orange-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Klappen-Overspeed
                        </div>
                      )}
                      {events.gear_up_landing === true && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Landung ohne Fahrwerk
                        </div>
                      )}
                      {events.crash === true && (
                       <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
                         <AlertTriangle className="w-4 h-4" />
                         CRASH (-100 Punkte, Wartung: 70% Neuwert)
                       </div>
                      )}
                      {events.harsh_controls === true && (
                        <div className="flex items-center gap-2 text-orange-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Ruppige Steuerung
                        </div>
                      )}
                      {events.high_g_force === true && (
                        <div className="flex items-center gap-2 text-orange-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Hohe G-Kräfte
                        </div>
                      )}
                      {events.hard_landing === true && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Harte Landung
                        </div>
                      )}
                      {events.fuel_emergency === true && (flight?.xplane_data?.fuel_percentage || flight?.xplane_data?.fuel || 100) < 3 && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Treibstoff-Notstand (unter 3%)
                        </div>
                      )}
                      </div>
                      </div>
                      );
                      })()}
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
                     <span className="text-slate-400">Auftrag-Payout</span>
                     <span className="text-emerald-400 font-mono">${Math.round(finalContract?.payout || 0).toLocaleString()}</span>
                   </div>
                   {flight?.xplane_data?.landingBonus > 0 && (
                   <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                     <span className="text-slate-400">Landequalitäts-Bonus</span>
                     <span className="text-emerald-400 font-mono">+${Math.round(flight.xplane_data.landingBonus).toLocaleString()}</span>
                   </div>
                   )}
                   {flight?.xplane_data?.landingPenalty > 0 && (
                   <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                     <span className="text-slate-400">Landequalitäts-Abzug</span>
                     <span className="text-red-400 font-mono">-${Math.round(flight.xplane_data.landingPenalty).toLocaleString()}</span>
                   </div>
                   )}
                   {flight?.xplane_data?.levelBonus > 0 && (
                   <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                     <span className="text-amber-400">Level-Bonus (Lv.{flight.xplane_data.companyLevel || 1} × {flight.xplane_data.levelBonusPercent?.toFixed(0) || 1}%)</span>
                     <span className="text-amber-400 font-mono">+${Math.round(flight.xplane_data.levelBonus).toLocaleString()}</span>
                   </div>
                   )}
                   <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                     <span className="text-slate-400">Treibstoff ({Math.round(flight.fuel_used_liters || 0).toLocaleString()} L)</span>
                    <span className="text-red-400 font-mono">-${Math.round(flight.fuel_cost || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">Crew ({flight.flight_duration_hours?.toFixed(1)}h)</span>
                    <span className="text-red-400 font-mono">-${Math.round(flight.crew_cost || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">Wartung ({flight.flight_duration_hours?.toFixed(1)}h + Events)</span>
                    <span className="text-red-400 font-mono">-${Math.round(flight.maintenance_cost || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">Flughafen-Gebühren</span>
                    <span className="text-red-400 font-mono">-$150</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                    <span className="font-semibold">Gesamt-Einnahmen</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      ${Math.round(flight.revenue || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3">
                    <span className="font-semibold">Gewinn/Verlust</span>
                    <span className={`text-xl font-bold font-mono ${
                      flight.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      ${Math.round(flight.profit || 0).toLocaleString()}
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