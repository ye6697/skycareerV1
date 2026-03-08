import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plane, Gauge, Fuel, ArrowUp, Activity, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import FlightMap from "@/components/flights/FlightMap";
import WeatherDisplay from "@/components/flights/WeatherDisplay";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function FreeFlight() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [xplaneLog, setXplaneLog] = useState(null);
  const [dataAge, setDataAge] = useState(null);
  const lastDataRef = useRef(null);

  const { data: company } = useQuery({
    queryKey: ['company-ff'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      if (cid) {
        const cos = await base44.entities.Company.filter({ id: cid });
        if (cos[0]) return cos[0];
      }
      const user2 = await base44.auth.me();
      const cos = await base44.entities.Company.filter({ created_by: user2.email });
      return cos[0] || null;
    },
    staleTime: 60000,
  });

  // Fetch latest XPlaneLog
  useEffect(() => {
    if (!company?.id) return;
    const fetchLatest = async () => {
      const logs = await base44.entities.XPlaneLog.filter({ company_id: company.id }, '-created_date', 1);
      if (logs[0]) {
        setXplaneLog(logs[0]);
        lastDataRef.current = Date.now();
      }
    };
    fetchLatest();
  }, [company?.id]);

  // Subscribe to real-time XPlaneLog updates
  useEffect(() => {
    if (!company?.id) return;
    const unsub = base44.entities.XPlaneLog.subscribe((event) => {
      if ((event.type === 'create' || event.type === 'update') && event.data?.company_id === company.id) {
        setXplaneLog(event.data);
        lastDataRef.current = Date.now();
      }
    });

    // Polling fallback every 2s
    const poll = setInterval(async () => {
      if (lastDataRef.current && Date.now() - lastDataRef.current < 1500) return;
      const logs = await base44.entities.XPlaneLog.filter({ company_id: company.id }, '-created_date', 1);
      if (logs[0]) {
        setXplaneLog(logs[0]);
        lastDataRef.current = Date.now();
      }
    }, 2000);

    return () => { unsub(); clearInterval(poll); };
  }, [company?.id]);

  // Data age ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      if (lastDataRef.current) setDataAge(Date.now() - lastDataRef.current);
    }, 500);
    return () => clearInterval(ticker);
  }, []);

  const raw = xplaneLog?.raw_data || {};
  const isConnected = company?.xplane_connection_status === 'connected';

  const flightDataForMap = {
    latitude: raw.latitude || 0,
    longitude: raw.longitude || 0,
    heading: raw.heading || 0,
    altitude: raw.altitude || 0,
    speed: raw.speed || 0,
    departure_lat: 0,
    departure_lon: 0,
    arrival_lat: 0,
    arrival_lon: 0,
  };

  const hasPosition = raw.latitude && raw.longitude && !(raw.latitude === 0 && raw.longitude === 0);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-cyan-900/30 p-2 rounded-lg shadow-md">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="h-7 px-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 font-mono text-[10px] uppercase border border-cyan-900/50"
          >
            ◀ {t('back', lang)}
          </Button>
          <span className="font-mono text-sm font-bold text-cyan-400 uppercase tracking-widest">FREE FLIGHT MODE</span>
          <Badge className="bg-violet-900/40 text-violet-400 border-violet-700/50 text-[10px] font-mono uppercase">
            NO SCORE · NO DAMAGE
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge className="bg-emerald-900/40 text-emerald-400 border-emerald-700/50 flex items-center gap-1 text-[10px] font-mono uppercase h-7">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              {raw.simulator === 'msfs' ? 'MSFS Live' : raw.simulator === 'msfs2024' ? 'MSFS 2024 Live' : 'X-Plane Live'}
            </Badge>
          ) : (
            <Badge className="bg-slate-800 text-slate-500 border-slate-700 text-[10px] font-mono uppercase h-7">
              Sim nicht verbunden
            </Badge>
          )}
          {dataAge !== null && (
            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
              dataAge < 3000 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-700/50' :
              'bg-red-500/20 text-red-400 border-red-700/50'
            }`}>
              {(dataAge / 1000).toFixed(1)}s ago
            </span>
          )}
        </div>
      </div>

      {!isConnected && (
        <div className="p-3 bg-amber-950/30 border border-amber-900/50 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs font-mono text-amber-300">
            Verbinde deinen Simulator via X-Plane/MSFS Plugin. Gehe zu SETUP um die Verbindung einzurichten.
          </p>
        </div>
      )}

      {/* Instruments */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'ALTITUDE', value: `${Math.round(raw.altitude || 0).toLocaleString()} ft`, color: 'text-blue-400' },
          { label: 'SPEED', value: `${Math.round(raw.speed || 0)} kts`, color: 'text-emerald-400' },
          { label: 'HEADING', value: `${Math.round(raw.heading || 0)}°`, color: 'text-cyan-400' },
          { label: 'G-FORCE', value: `${(raw.g_force || 1.0).toFixed(2)} G`, color: raw.g_force > 1.8 ? 'text-red-400' : raw.g_force > 1.3 ? 'text-amber-400' : 'text-emerald-400' },
        ].map((item) => (
          <Card key={item.label} className="p-3 bg-slate-900/80 border-slate-700 text-center">
            <p className="text-slate-500 text-[10px] font-mono uppercase mb-1">{item.label}</p>
            <p className={`text-xl font-mono font-bold ${item.color}`}>{item.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1">
        {/* Map */}
        <div className="lg:col-span-2">
          {hasPosition ? (
            <FlightMap
              flightData={flightDataForMap}
              staticMode={false}
              title="Free Flight – Live Map"
            />
          ) : (
            <Card className="h-64 bg-slate-900/80 border-slate-700 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                  <Plane className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                </motion.div>
                <p className="text-sm font-mono">Warte auf GPS-Daten vom Simulator...</p>
              </div>
            </Card>
          )}
        </div>

        {/* Right column: coordinates + weather */}
        <div className="space-y-3">
          {/* Coordinates */}
          <Card className="p-3 bg-slate-900/80 border-slate-700">
            <h3 className="text-xs font-mono uppercase text-slate-400 mb-2 flex items-center gap-2">
              <Gauge className="w-3 h-3 text-cyan-400" /> Position
            </h3>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">LAT</span>
                <span className="text-cyan-300">{(raw.latitude || 0).toFixed(5)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">LON</span>
                <span className="text-cyan-300">{(raw.longitude || 0).toFixed(5)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">V/S</span>
                <span className={raw.vertical_speed > 0 ? 'text-emerald-400' : 'text-amber-400'}>
                  {raw.vertical_speed > 0 ? '+' : ''}{Math.round(raw.vertical_speed || 0)} ft/min
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">FUEL</span>
                <span className="text-amber-400">{Math.round(raw.fuel_percentage || 0)}% / {Math.round(raw.fuel_kg || 0)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ON GND</span>
                <span className={raw.on_ground ? 'text-emerald-400' : 'text-blue-400'}>{raw.on_ground ? 'YES' : 'NO'}</span>
              </div>
            </div>
          </Card>

          {/* Weather from simulator */}
          <WeatherDisplay raw={raw} />
        </div>
      </div>
    </div>
  );
}