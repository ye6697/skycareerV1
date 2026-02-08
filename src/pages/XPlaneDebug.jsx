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

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: company, refetch: refetchCompany } = useQuery({
    queryKey: ['company', currentUser?.company_id],
    queryFn: async () => {
      if (currentUser?.company_id) {
        const companies = await base44.entities.Company.filter({ id: currentUser.company_id });
        if (companies[0]) return companies[0];
      }
      const companies = await base44.entities.Company.filter({ created_by: currentUser.email });
      return companies[0];
    },
    enabled: !!currentUser,
    refetchInterval: 2000
  });

  const { data: flights = [], refetch: refetchFlights } = useQuery({
    queryKey: ['all-flights', company?.id],
    queryFn: async () => {
      return await base44.entities.Flight.filter({ company_id: company.id }, '-updated_date', 5);
    },
    enabled: !!company?.id,
    refetchInterval: 2000
  });

  const { data: xplaneLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['xplane-logs', company?.id],
    queryFn: async () => {
      return await base44.entities.XPlaneLog.filter({ company_id: company.id }, '-created_date', 20);
    },
    enabled: !!company?.id,
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
                  refetchLogs();
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

        {/* X-Plane Data Logs - ALL RECEIVED DATA */}
        <Card className="p-6 bg-slate-800/50 border-slate-700 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Alle empfangenen X-Plane Daten (letzte 20)
          </h2>
          {xplaneLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">Noch keine Daten empfangen</p>
              <p className="text-slate-500 text-sm mt-2">Starte X-Plane mit installiertem Plugin</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {xplaneLogs.map((log) => (
                <motion.div 
                  key={log.id} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-slate-900 rounded-lg border border-slate-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-blue-400">{log.id}</code>
                      {log.has_active_flight && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                          Mit aktivem Flug
                        </Badge>
                      )}
                      {!log.has_active_flight && (
                        <Badge className="bg-slate-500/20 text-slate-400 text-xs">
                          Ohne Flug
                        </Badge>
                      )}
                    </div>
                    <span className="text-slate-500 text-xs">
                      {new Date(log.created_date).toLocaleString('de-DE')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    <div className="text-sm">
                      <span className="text-slate-500">Höhe:</span>{' '}
                      <span className="text-white font-mono">{Math.round(log.altitude || 0)} ft</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-500">Speed:</span>{' '}
                      <span className="text-white font-mono">{Math.round(log.speed || 0)} kts</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-500">Score:</span>{' '}
                      <span className="text-white font-mono">{Math.round(log.flight_score || 100)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-500">Am Boden:</span>{' '}
                      <span className="text-white font-mono">{log.on_ground ? 'Ja' : 'Nein'}</span>
                    </div>
                  </div>

                  <details className="mt-2">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                      Rohdaten anzeigen
                    </summary>
                    <pre className="text-xs bg-black/30 p-3 rounded mt-2 overflow-auto max-h-48 text-slate-300 font-mono">
                      {JSON.stringify(log.raw_data, null, 2)}
                    </pre>
                  </details>
                </motion.div>
              ))}
            </div>
          )}
        </Card>

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