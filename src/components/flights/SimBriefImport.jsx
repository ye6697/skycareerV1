import React, { useState, useEffect, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Download, Copy, Check, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';

export default function SimBriefImport({ onRouteLoaded, contract }) {
  const [username, setUsername] = useState('');
  const [pilotId, setPilotId] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importedData, setImportedData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [waitingForPlan, setWaitingForPlan] = useState(false);
  const autoFetchedRef = useRef(false);
  const pollIntervalRef = useRef(null);

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

  // Auto-fetch when credentials are loaded
  useEffect(() => {
    if (autoFetchedRef.current) return;
    if (!savedCredentials) return;
    const hasCredential = savedCredentials.username || savedCredentials.pilotId;
    if (hasCredential && !importedData && !loading) {
      autoFetchedRef.current = true;
      fetchAndCheckPlan(savedCredentials.username, savedCredentials.pilotId);
    }
  }, [savedCredentials, importedData]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const checkPlanMatchesContract = (data) => {
    if (!contract || !data) return true;
    const depMatch = !contract.departure_airport ||
      data.departure_airport?.toUpperCase() === contract.departure_airport?.toUpperCase();
    const arrMatch = !contract.arrival_airport ||
      data.arrival_airport?.toUpperCase() === contract.arrival_airport?.toUpperCase();
    return depMatch && arrMatch;
  };

  const fetchAndCheckPlan = async (uname, pid) => {
    if (!uname && !pid) return;
    setLoading(true);
    setError(null);
    setMismatch(false);

    try {
      const response = await base44.functions.invoke('fetchSimBrief', {
        simbrief_username: uname || undefined,
        simbrief_userid: pid || undefined
      });

      setLoading(false);

      if (response.data?.error) {
        // If API returned an error, treat as "no plan found" instead of showing raw error
        setMismatch(true);
        setImportedData(null);
        return;
      }

      const data = response.data;

      if (checkPlanMatchesContract(data)) {
        setImportedData(data);
        setMismatch(false);
        if (onRouteLoaded) onRouteLoaded(data);
      } else {
        setMismatch(true);
        setImportedData(null);
      }
    } catch (e) {
      setLoading(false);
      // Network/server errors also just show the "create plan" UI
      setMismatch(true);
      setImportedData(null);
    }
  };

  const fetchPlan = async () => {
    if (!username && !pilotId) {
      setError('Bitte SimBrief Username oder Pilot ID eingeben');
      return;
    }

    // Save credentials
    const updateData = {};
    if (username) updateData.simbrief_username = username;
    if (pilotId) updateData.simbrief_pilot_id = pilotId;
    if (Object.keys(updateData).length > 0) {
      base44.auth.updateMe(updateData);
    }

    await fetchAndCheckPlan(username, pilotId);
  };

  // Open SimBrief dispatch with contract data pre-filled
  const openSimBriefDispatch = () => {
    if (!contract) return;
    const params = new URLSearchParams();
    params.set('orig', contract.departure_airport || '');
    params.set('dest', contract.arrival_airport || '');
    if (contract.passenger_count) params.set('pax', String(contract.passenger_count));
    
    const url = `https://dispatch.simbrief.com/options/custom?${params.toString()}`;
    window.open(url, '_blank');

    // Start polling for the new plan
    setWaitingForPlan(true);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    let attempts = 0;
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 60) { // Stop after 5 minutes
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setWaitingForPlan(false);
        return;
      }

      const uname = username || savedCredentials?.username;
      const pid = pilotId || savedCredentials?.pilotId;
      if (!uname && !pid) return;

      const response = await base44.functions.invoke('fetchSimBrief', {
        simbrief_username: uname || undefined,
        simbrief_userid: pid || undefined
      });

      if (response.data?.error) return;
      const data = response.data;

      if (checkPlanMatchesContract(data)) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setWaitingForPlan(false);
        setMismatch(false);
        setImportedData(data);
        if (onRouteLoaded) onRouteLoaded(data);
      }
    }, 5000); // Poll every 5 seconds
  };

  const copyRoute = () => {
    if (importedData?.route_string) {
      navigator.clipboard.writeText(importedData.route_string);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Show: credentials needed
  const hasCredentials = username || pilotId || savedCredentials?.username || savedCredentials?.pilotId;

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
        {waitingForPlan && (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Warte auf Plan...
          </Badge>
        )}
      </div>

      {/* No credentials yet */}
      {!hasCredentials && !importedData && (
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

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            onClick={fetchPlan}
            disabled={loading}
            className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Lade Flugplan...</>
            ) : (
              <><Download className="w-3 h-3 mr-1" /> Verbinden</>
            )}
          </Button>
        </div>
      )}

      {/* Loading state */}
      {hasCredentials && !importedData && loading && !mismatch && !error && (
        <div className="flex items-center justify-center gap-2 py-4 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Lade Flugplan...
        </div>
      )}

      {/* No plan / mismatch / error - offer to create new one */}
      {hasCredentials && !importedData && !loading && (
        <div className="space-y-3">
          <div className="p-3 bg-amber-900/20 border border-amber-700/40 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-300 font-medium mb-1">
                  {mismatch 
                    ? `Dein letzter SimBrief-Plan passt nicht zu diesem Auftrag (${contract?.departure_airport} → ${contract?.arrival_airport}).`
                    : `Kein passender Flugplan gefunden.`
                  }
                </p>
                <p className="text-[10px] text-amber-300/70">
                  Erstelle einen neuen Flugplan – die Route wird automatisch vorausgefüllt.
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={openSimBriefDispatch}
            disabled={waitingForPlan}
            className="w-full h-9 text-xs bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {waitingForPlan ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Warte auf neuen Flugplan...</>
            ) : (
              <><ExternalLink className="w-3 h-3" /> Flugplan auf SimBrief erstellen</>
            )}
          </Button>

          {waitingForPlan && (
            <p className="text-[10px] text-blue-400 text-center">
              SimBrief wurde geöffnet. Erstelle dort den Flugplan und klicke auf "Generate OFP". 
              Der Plan wird automatisch hier geladen.
            </p>
          )}

          <Button
            onClick={() => fetchAndCheckPlan(username || savedCredentials?.username, pilotId || savedCredentials?.pilotId)}
            variant="outline"
            className="w-full h-7 text-xs border-slate-600"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Manuell neu laden
          </Button>
        </div>
      )}

      {/* Plan loaded and matches */}
      {importedData && (
        <div className="space-y-3">
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
            onClick={() => { 
              setImportedData(null); 
              setError(null); 
              setMismatch(true);
              autoFetchedRef.current = true; // Don't auto-fetch old plan again
            }}
            variant="outline"
            className="w-full h-7 text-xs border-slate-600"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Neuen Flugplan erstellen
          </Button>
        </div>
      )}
    </Card>
  );
}