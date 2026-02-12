import React, { useState, useEffect, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Download, Copy, Check, RefreshCw } from 'lucide-react';

export default function SimBriefImport({ onRouteLoaded, contract }) {
  const [username, setUsername] = useState('');
  const [pilotId, setPilotId] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importedData, setImportedData] = useState(null);
  const [copied, setCopied] = useState(false);
  const autoFetchedRef = useRef(false);

  // Load saved SimBrief credentials from user profile
  const { data: savedCredentials } = useQuery({
    queryKey: ['simbrief-credentials'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return {
        username: user?.simbrief_username || '',
        pilotId: user?.simbrief_pilot_id || ''
      };
    },
  });

  useEffect(() => {
    if (savedCredentials) {
      if (savedCredentials.username && !username) setUsername(savedCredentials.username);
      if (savedCredentials.pilotId && !pilotId) setPilotId(savedCredentials.pilotId);
    }
  }, [savedCredentials]);

  // Auto-fetch when saved credentials are loaded or after contract reset
  useEffect(() => {
    if (autoFetchedRef.current) return;
    if (!savedCredentials) return;
    const hasCredential = savedCredentials.username || savedCredentials.pilotId;
    if (hasCredential && !importedData && !loading) {
      autoFetchedRef.current = true;
      fetchPlanWithCredentials(savedCredentials.username, savedCredentials.pilotId);
    }
  }, [savedCredentials, importedData]);

  const fetchPlanWithCredentials = async (uname, pid) => {
    if (!uname && !pid) return;
    setLoading(true);
    setError(null);

    const response = await base44.functions.invoke('fetchSimBrief', {
      simbrief_username: uname || undefined,
      simbrief_userid: pid || undefined
    });

    setLoading(false);

    if (response.data?.error) {
      setError(response.data.error);
      return;
    }

    const data = response.data;
    setImportedData(data);
    if (onRouteLoaded) onRouteLoaded(data);
  };

  const fetchPlan = async () => {
    if (!username && !pilotId) {
      setError('Bitte SimBrief Username oder Pilot ID eingeben');
      return;
    }

    setLoading(true);
    setError(null);

    const response = await base44.functions.invoke('fetchSimBrief', {
      simbrief_username: username || undefined,
      simbrief_userid: pilotId || undefined
    });

    setLoading(false);

    if (response.data?.error) {
      setError(response.data.error);
      return;
    }

    const data = response.data;
    setImportedData(data);

    // Save credentials for future use
    const updateData = {};
    if (username) updateData.simbrief_username = username;
    if (pilotId) updateData.simbrief_pilot_id = pilotId;
    if (Object.keys(updateData).length > 0) {
      base44.auth.updateMe(updateData);
    }

    if (onRouteLoaded) onRouteLoaded(data);
  };

  const copyRoute = () => {
    if (importedData?.route_string) {
      navigator.clipboard.writeText(importedData.route_string);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="p-4 bg-slate-800/50 border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
          <img src="https://www.simbrief.com/images/simbrief_logo.png" alt="SimBrief" className="w-4 h-4 rounded" onError={(e) => e.target.style.display='none'} />
          SimBrief Flugplan
        </h3>
        {importedData && (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
            Geladen
          </Badge>
        )}
      </div>

      {!importedData ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 uppercase mb-1 block">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="SimBrief Username"
                className="h-8 text-xs bg-slate-900 border-slate-700"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase mb-1 block">oder Pilot ID</label>
              <Input
                value={pilotId}
                onChange={(e) => setPilotId(e.target.value)}
                placeholder="z.B. 123456"
                className="h-8 text-xs bg-slate-900 border-slate-700"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <Button
            onClick={fetchPlan}
            disabled={loading}
            className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Lade Flugplan...</>
            ) : (
              <><Download className="w-3 h-3 mr-1" /> Letzten Flugplan laden</>
            )}
          </Button>

          <p className="text-[10px] text-slate-500 text-center">
            Erstelle deinen Flugplan auf <a href="https://dispatch.simbrief.com" target="_blank" rel="noopener" className="text-blue-400 underline">dispatch.simbrief.com</a> und importiere ihn hier.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Flight info */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <span className="text-[10px] text-slate-500 uppercase">DEP</span>
              <p className="text-sm font-mono font-bold text-emerald-400">
                {importedData.departure_airport}{importedData.departure_runway ? ` / ${importedData.departure_runway}` : ''}
              </p>
            </div>
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <span className="text-[10px] text-slate-500 uppercase">ARR</span>
              <p className="text-sm font-mono font-bold text-amber-400">
                {importedData.arrival_airport}{importedData.arrival_runway ? ` / ${importedData.arrival_runway}` : ''}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-1.5 bg-slate-900 rounded">
              <span className="text-[10px] text-slate-500">FL</span>
              <p className="text-xs font-mono font-bold text-white">{Math.round((importedData.cruise_altitude || 0) / 100)}</p>
            </div>
            <div className="p-1.5 bg-slate-900 rounded">
              <span className="text-[10px] text-slate-500">Distanz</span>
              <p className="text-xs font-mono font-bold text-white">{importedData.distance_nm} NM</p>
            </div>
            <div className="p-1.5 bg-slate-900 rounded">
              <span className="text-[10px] text-slate-500">WPTs</span>
              <p className="text-xs font-mono font-bold text-white">{importedData.waypoints?.length || 0}</p>
            </div>
          </div>

          {/* Route string */}
          <div className="p-2 bg-slate-900 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">Route</span>
              <Button variant="ghost" size="sm" className="h-5 px-1 text-xs text-slate-400" onClick={copyRoute}>
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
            <p className="text-[10px] font-mono text-purple-300 leading-relaxed break-all">
              {importedData.route_string}
            </p>
          </div>

          <Button
            onClick={() => { setImportedData(null); setError(null); }}
            variant="outline"
            className="w-full h-7 text-xs border-slate-600"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Neuen Flugplan laden
          </Button>
        </div>
      )}
    </Card>
  );
}