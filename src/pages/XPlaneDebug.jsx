import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function XPlaneDebug() {
  const [lastUpdate, setLastUpdate] = useState(null);

  const { data: company, refetch: refetchCompany } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const companies = await base44.entities.Company.list();
      return companies[0];
    },
    refetchInterval: 2000
  });

  const { data: flights = [], refetch: refetchFlights } = useQuery({
    queryKey: ['all-flights'],
    queryFn: async () => {
      return await base44.entities.Flight.list('-updated_date', 5);
    },
    refetchInterval: 2000
  });

  useEffect(() => {
    setLastUpdate(new Date().toLocaleTimeString());
  }, [company, flights]);

  const activeFlight = flights.find(f => f.status === 'in_flight');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">X-Plane Debug</h1>
              <p className="text-slate-400">Live-Datenüberwachung für Entwicklung</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                Letztes Update: {lastUpdate}
              </span>
              <Button 
                variant="outline"
                size="icon"
                onClick={() => {
                  refetchCompany();
                  refetchFlights();
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Connection Status */}
        <Card className="p-6 bg-slate-800/50 border-slate-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Verbindungsstatus
            </h2>
            <Badge className={`${
              company?.xplane_connection_status === 'connected' 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : company?.xplane_connection_status === 'connecting'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
            }`}>
              {company?.xplane_connection_status === 'connected' && (
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse mr-2" />
              )}
              {company?.xplane_connection_status || 'disconnected'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 mb-1">Company ID</p>
              <code className="text-blue-400 font-mono text-xs">{company?.id}</code>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Status</p>
              <p className="text-white">{company?.xplane_connection_status || 'Nicht verbunden'}</p>
            </div>
          </div>
        </Card>

        {/* Active Flight Data */}
        {activeFlight ? (
          <Card className="p-6 bg-slate-800/50 border-slate-700 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Aktiver Flug</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
              <div>
                <p className="text-slate-500 mb-1">Flight ID</p>
                <code className="text-blue-400 font-mono text-xs">{activeFlight.id}</code>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Status</p>
                <Badge variant="outline">{activeFlight.status}</Badge>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Contract ID</p>
                <code className="text-blue-400 font-mono text-xs">{activeFlight.contract_id}</code>
              </div>
            </div>

            {activeFlight.xplane_data && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Live X-Plane Daten
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-900 rounded-lg">
                    <p className="text-slate-500 text-xs mb-1">Höhe</p>
                    <p className="text-white font-mono">{Math.round(activeFlight.xplane_data.altitude || 0)} ft</p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg">
                    <p className="text-slate-500 text-xs mb-1">Geschwindigkeit</p>
                    <p className="text-white font-mono">{Math.round(activeFlight.xplane_data.speed || 0)} kts</p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg">
                    <p className="text-slate-500 text-xs mb-1">V/S</p>
                    <p className={`font-mono ${
                      (activeFlight.xplane_data.vertical_speed || 0) > 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {Math.round(activeFlight.xplane_data.vertical_speed || 0)} fpm
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg">
                    <p className="text-slate-500 text-xs mb-1">Treibstoff</p>
                    <p className="text-white font-mono">{Math.round(activeFlight.xplane_data.fuel_percentage || 0)}%</p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg">
                    <p className="text-slate-500 text-xs mb-1">G-Kraft</p>
                    <p className={`font-mono ${
                      (activeFlight.xplane_data.g_force || 0) < 1.3 ? 'text-emerald-400' :
                      (activeFlight.xplane_data.g_force || 0) < 1.8 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {(activeFlight.xplane_data.g_force || 0).toFixed(2)} G
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg">
                    <p className="text-slate-500 text-xs mb-1">Max G</p>
                    <p className="text-white font-mono">{(activeFlight.xplane_data.max_g_force || 0).toFixed(2)} G</p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg">
                    <p className="text-slate-500 text-xs mb-1">Score</p>
                    <p className={`font-mono ${
                      (activeFlight.xplane_data.flight_score || 100) >= 95 ? 'text-emerald-400' :
                      (activeFlight.xplane_data.flight_score || 100) >= 70 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {Math.round(activeFlight.xplane_data.flight_score || 100)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg">
                    <p className="text-slate-500 text-xs mb-1">Reputation</p>
                    <Badge className="bg-blue-500/20 text-blue-400 text-xs">
                      {activeFlight.xplane_data.reputation || 'N/A'}
                    </Badge>
                  </div>
                </div>

                {/* Events */}
                {(activeFlight.xplane_data.tailstrike || 
                  activeFlight.xplane_data.stall || 
                  activeFlight.xplane_data.overstress ||
                  activeFlight.xplane_data.crash) && (
                  <div className="mt-4 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
                    <h4 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Vorfälle erkannt
                    </h4>
                    <div className="space-y-1 text-sm">
                      {activeFlight.xplane_data.tailstrike && (
                        <p className="text-red-300">• Tailstrike</p>
                      )}
                      {activeFlight.xplane_data.stall && (
                        <p className="text-red-300">• Strömungsabriss</p>
                      )}
                      {activeFlight.xplane_data.overstress && (
                        <p className="text-orange-300">• Überlastung</p>
                      )}
                      {activeFlight.xplane_data.flaps_overspeed && (
                        <p className="text-orange-300">• Klappen zu schnell</p>
                      )}
                      {activeFlight.xplane_data.fuel_emergency && (
                        <p className="text-red-300">• Treibstoff-Notstand</p>
                      )}
                      {activeFlight.xplane_data.gear_up_landing && (
                        <p className="text-red-300">• Landung ohne Fahrwerk!</p>
                      )}
                      {activeFlight.xplane_data.crash && (
                        <p className="text-red-300 font-bold">• CRASH ERKANNT!</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Raw JSON */}
                <div className="mt-4">
                  <p className="text-slate-500 text-xs mb-2">Rohdaten (letzter Update):</p>
                  <pre className="text-xs bg-slate-900 p-4 rounded-lg overflow-auto max-h-96 text-slate-300 font-mono">
                    {JSON.stringify(activeFlight.xplane_data, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-12 text-center bg-slate-800/50 border-slate-700">
            <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Kein aktiver Flug</h3>
            <p className="text-slate-400">
              Starte einen Flug über "Aktive Flüge", um Live-Daten zu sehen.
            </p>
          </Card>
        )}

        {/* Recent Flights */}
        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">Letzte 5 Flüge</h2>
          <div className="space-y-2">
            {flights.map((flight) => (
              <div key={flight.id} className="p-3 bg-slate-900 rounded-lg flex items-center justify-between">
                <div>
                  <code className="text-xs text-blue-400">{flight.id}</code>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{flight.status}</Badge>
                    {flight.xplane_data && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                        X-Plane Daten vorhanden
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="text-slate-500 text-xs">
                  {new Date(flight.updated_date).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}