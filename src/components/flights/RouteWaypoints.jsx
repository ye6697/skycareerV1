import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Navigation, Copy, Loader2, RefreshCw } from 'lucide-react';

export default function RouteWaypoints({ contract, aircraftType }) {
  const depIcao = contract?.departure_airport;
  const arrIcao = contract?.arrival_airport;

  const { data: routeData, isLoading, error, refetch } = useQuery({
    queryKey: ['route-waypoints', depIcao, arrIcao, aircraftType],
    queryFn: async () => {
      const response = await base44.functions.invoke('generateRouteWaypoints', {
        departure_icao: depIcao,
        arrival_icao: arrIcao,
        aircraft_type: aircraftType || 'narrow_body',
        distance_nm: contract?.distance_nm || 300
      });
      return response.data;
    },
    enabled: !!depIcao && !!arrIcao,
    staleTime: Infinity,
    retry: 1,
  });

  const copyRouteString = () => {
    if (routeData?.route_string) {
      navigator.clipboard.writeText(routeData.route_string);
    }
  };

  const copyWaypointList = () => {
    if (routeData?.waypoints) {
      const text = routeData.waypoints.map(wp => wp.name).join(' ');
      navigator.clipboard.writeText(text);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4 bg-slate-800/50 border-slate-700">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <div>
            <p className="text-sm font-medium text-white">Route wird generiert...</p>
            <p className="text-xs text-slate-400">{depIcao} → {arrIcao}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (error || !routeData?.waypoints) {
    return (
      <Card className="p-4 bg-slate-800/50 border-slate-700">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">Route konnte nicht generiert werden</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    );
  }

  const typeColors = {
    sid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    enroute: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    star: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  const typeLabels = { sid: 'SID', enroute: 'ENR', star: 'STAR' };

  return (
    <Card className="p-4 bg-slate-800/50 border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
          <Navigation className="w-4 h-4 text-purple-400" />
          Empfohlene Route
        </h3>
        <div className="flex items-center gap-1">
          {routeData.cruise_altitude && (
            <Badge className="bg-slate-700 text-slate-300 text-xs">
              FL{Math.round(routeData.cruise_altitude / 100)}
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Route String */}
      <div className="mb-3 p-2 bg-slate-900 rounded-lg">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">Route String</span>
          <Button variant="ghost" size="sm" className="h-5 px-1 text-xs text-slate-400 hover:text-white" onClick={copyRouteString}>
            <Copy className="w-3 h-3 mr-1" /> Kopieren
          </Button>
        </div>
        <p className="text-xs font-mono text-purple-300 leading-relaxed break-all">
          {routeData.route_string}
        </p>
      </div>

      {/* Waypoint List */}
      <div className="space-y-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">{routeData.waypoints.length} Wegpunkte</span>
          <Button variant="ghost" size="sm" className="h-5 px-1 text-xs text-slate-400 hover:text-white" onClick={copyWaypointList}>
            <Copy className="w-3 h-3 mr-1" /> Alle kopieren
          </Button>
        </div>
        {routeData.waypoints.map((wp, i) => (
          <div key={i} className="flex items-center justify-between py-1 px-2 bg-slate-900/50 rounded text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 w-4 text-right">{i + 1}</span>
              <Badge className={`text-[10px] px-1.5 py-0 ${typeColors[wp.type] || typeColors.enroute}`}>
                {typeLabels[wp.type] || 'ENR'}
              </Badge>
              <span className="font-mono font-bold text-white">{wp.name}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              {wp.alt > 0 && (
                <span>FL{Math.round(wp.alt / 100)}</span>
              )}
              <span className="text-[10px]">
                {wp.lat.toFixed(2)}° / {wp.lon.toFixed(2)}°
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}