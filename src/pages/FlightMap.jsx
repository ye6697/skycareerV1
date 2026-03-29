import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createPageUrl } from '@/utils';
import { Map, ArrowLeft } from 'lucide-react';
import FlightMapComponent from '@/components/flights/FlightMap';
import WeatherDisplay from '@/components/flights/WeatherDisplay';

export default function FlightMap() {
  const navigate = useNavigate();
  const [xplaneLog, setXplaneLog] = useState(null);
  const lastDataRef = useRef(null);

  const { data: company } = useQuery({
    queryKey: ['company-flightmap'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      if (cid) {
        const cos = await base44.entities.Company.filter({ id: cid });
        if (cos[0]) return cos[0];
      }
      const u2 = await base44.auth.me();
      const cos = await base44.entities.Company.filter({ created_by: u2.email });
      return cos[0] || null;
    },
    staleTime: 60000,
  });

  // Fetch latest XPlaneLog for standalone position + sim weather
  useEffect(() => {
    if (!company?.id) return;
    const fetchLatest = async () => {
      const logs = await base44.entities.XPlaneLog.filter({ company_id: company.id }, '-created_date', 1);
      if (logs[0]) { setXplaneLog(logs[0]); lastDataRef.current = Date.now(); }
    };
    fetchLatest();
  }, [company?.id]);

  useEffect(() => {
    if (!company?.id) return;
    const unsub = base44.entities.XPlaneLog.subscribe((event) => {
      if ((event.type === 'create' || event.type === 'update') && event.data?.company_id === company.id) {
        setXplaneLog(event.data);
        lastDataRef.current = Date.now();
      }
    });
    const poll = setInterval(async () => {
      if (lastDataRef.current && Date.now() - lastDataRef.current < 1500) return;
      const logs = await base44.entities.XPlaneLog.filter({ company_id: company.id }, '-created_date', 1);
      if (logs[0]) { setXplaneLog(logs[0]); lastDataRef.current = Date.now(); }
    }, 2000);
    return () => { unsub(); clearInterval(poll); };
  }, [company?.id]);

  const raw = xplaneLog?.raw_data || {};
  const hasPosition = raw.latitude && raw.longitude && !(raw.latitude === 0 && raw.longitude === 0);
  const isConnected = company?.xplane_connection_status === 'connected';

  const flightDataForMap = hasPosition ? {
    latitude: raw.latitude,
    longitude: raw.longitude,
    heading: raw.heading || 0,
    altitude: raw.altitude || 0,
    speed: raw.speed || 0,
    departure_lat: 0,
    departure_lon: 0,
    arrival_lat: 0,
    arrival_lon: 0,
  } : null;

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 bg-slate-900/80 border border-cyan-900/30 p-3 rounded-lg shadow-lg flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl('Dashboard'))}
            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/50 h-8 px-2 font-mono text-xs"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Zurück
          </Button>
          <h1 className="text-lg font-mono font-bold text-cyan-400 flex items-center gap-2">
            <Map className="w-5 h-5" />
            Live Flight Map
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasPosition && (
            <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] font-mono">
              {raw.latitude.toFixed(4)}° / {raw.longitude.toFixed(4)}°
            </Badge>
          )}
          {isConnected ? (
            <Badge className="bg-emerald-900/40 text-emerald-400 border-emerald-700/50 flex items-center gap-1 text-[10px] font-mono uppercase h-7">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              {raw.simulator === 'msfs' || raw.simulator === 'msfs2020' ? 'MSFS 2020 Live' :
               raw.simulator === 'msfs2024' ? 'MSFS 2024 Live' :
               raw.simulator === 'xplane12' ? 'X-Plane 12 Live' :
               raw.simulator ? `${raw.simulator} Live` : 'Sim Live'}
            </Badge>
          ) : (
            <Badge className="bg-slate-800 text-slate-500 border-slate-700 text-[10px] font-mono uppercase h-7">
              Sim offline
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        <div className="lg:col-span-3 min-h-[400px]">
          <FlightMapComponent
            title="Global Flight Map"
            flightData={flightDataForMap}
            staticMode={!hasPosition}
          />
        </div>

        {/* Sidebar: coordinates + weather from sim */}
        <div className="space-y-3">
          {/* Coordinates panel */}
          <div className="bg-slate-900/80 border border-cyan-900/30 rounded-lg p-3 space-y-1">
            <h3 className="text-[10px] font-mono uppercase text-cyan-600 mb-2">Position</h3>
            {[
              { label: 'LAT', value: `${(raw.latitude || 0).toFixed(5)}°` },
              { label: 'LON', value: `${(raw.longitude || 0).toFixed(5)}°` },
              { label: 'ALT', value: `${Math.round(raw.altitude || 0).toLocaleString()} ft` },
              { label: 'GS', value: `${Math.round(raw.speed || 0)} kts` },
              { label: 'HDG', value: `${Math.round(raw.heading || 0)}°` },
              { label: 'V/S', value: `${Math.round(raw.vertical_speed || 0)} ft/min` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs font-mono">
                <span className="text-slate-500">{label}</span>
                <span className="text-cyan-300">{value}</span>
              </div>
            ))}
          </div>

          {/* Weather from simulator */}
          <WeatherDisplay raw={raw} />
        </div>
      </div>
    </div>
  );
}
