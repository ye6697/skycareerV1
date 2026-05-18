import React, { useState, useEffect, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Download, Copy, Check, RefreshCw, ExternalLink, AlertTriangle, FileText, Route } from 'lucide-react';
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function SimBriefImport({ onRouteLoaded, contract }) {
  const { lang } = useLanguage();
  const [username, setUsername] = useState('');
  const [pilotId, setPilotId] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importedData, setImportedData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [waitingForPlan, setWaitingForPlan] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [waypointsOpen, setWaypointsOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [mobilePdfReloadKey, setMobilePdfReloadKey] = useState(0);
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
    if (!contract || !data) return true; // No contract = free flight, always accept
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
      setError(t('enter_simbrief_creds', lang));
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
    const params = new URLSearchParams();
    if (contract) {
      params.set('orig', contract.departure_airport || '');
      params.set('dest', contract.arrival_airport || '');
      if (contract.passenger_count) params.set('pax', String(contract.passenger_count));
    }
    
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
  const simbriefPdfUrl = importedData?.ofp_pdf_url || importedData?.pdf_url || null;
  const simbriefPdfViewerUrl = simbriefPdfUrl
    ? `${simbriefPdfUrl}${simbriefPdfUrl.includes('#') ? '&' : '#'}page=1&zoom=page-width&view=FitH&toolbar=1&navpanes=0&pagemode=none`
    : null;
  const simbriefMobilePdfViewerUrl = simbriefPdfUrl
    ? `https://docs.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(simbriefPdfUrl.replace(/^http:\/\//i, 'https://'))}&rm=minimal`
    : null;
  const simbriefWaypoints = Array.isArray(importedData?.waypoints) ? importedData.waypoints : [];
  const formatWaypointFlightLevel = (altitude) => {
    const feet = Number(altitude);
    if (!Number.isFinite(feet) || feet <= 0) return '---';
    return `FL${String(Math.round(feet / 100)).padStart(3, '0')}`;
  };

  useEffect(() => {
    if (!pdfOpen) return;
    setPdfLoading(true);
    const reloadTimer = setTimeout(() => {
      setMobilePdfReloadKey((value) => value + 1);
    }, 1400);
    const fallbackTimer = setTimeout(() => setPdfLoading(false), 4200);
    return () => {
      clearTimeout(reloadTimer);
      clearTimeout(fallbackTimer);
    };
  }, [pdfOpen, simbriefPdfUrl]);

  return (
    <Card className="p-4 bg-slate-800/50 border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
          <img src="https://www.simbrief.com/images/simbrief_logo.png" alt="SimBrief" className="w-4 h-4 rounded" onError={(e) => e.target.style.display='none'} />
          {t('simbrief_flight_plan', lang)}
        </h3>
        {importedData && (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
            {t('loaded', lang)}
          </Badge>
        )}
        {waitingForPlan && (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            {t('waiting_for_plan', lang)}
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
              <><Loader2 className="w-3 h-3 animate-spin mr-1" /> {t('loading_flight_plan', lang)}</>
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
          {t('loading_flight_plan', lang)}
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
                  {mismatch && contract
                    ? `${t('plan_mismatch', lang)} (${contract.departure_airport} → ${contract.arrival_airport}).`
                    : t('no_matching_plan', lang)
                  }
                </p>
                <p className="text-[10px] text-amber-300/70">
                  {t('create_new_plan_hint', lang)}
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
              <><Loader2 className="w-3 h-3 animate-spin" /> {t('waiting_new_plan', lang)}</>
            ) : (
              <><ExternalLink className="w-3 h-3" /> {t('create_plan_simbrief', lang)}</>
            )}
          </Button>

          {waitingForPlan && (
            <p className="text-[10px] text-blue-400 text-center">
              {t('simbrief_opened', lang)}
            </p>
          )}

          <Button
            onClick={() => fetchAndCheckPlan(username || savedCredentials?.username, pilotId || savedCredentials?.pilotId)}
            variant="outline"
            className="w-full h-7 text-xs border-slate-600"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> {t('reload_manually', lang)}
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
            <div className="p-1.5 bg-slate-800/60 border border-slate-700/50 rounded">
              <span className="text-[10px] text-slate-500 uppercase">FL</span>
              <p className="text-xs font-mono font-bold text-amber-400">{Math.round((importedData.cruise_altitude || 0) / 100)}</p>
            </div>
            <div className="p-1.5 bg-slate-800/60 border border-slate-700/50 rounded">
              <span className="text-[10px] text-slate-500 uppercase">Distanz</span>
              <p className="text-xs font-mono font-bold text-amber-400">{importedData.distance_nm} NM</p>
            </div>
            <div className="p-1.5 bg-slate-800/60 border border-slate-700/50 rounded">
              <span className="text-[10px] text-slate-500 uppercase">WPTs</span>
              <p className="text-xs font-mono font-bold text-amber-400">{importedData.waypoints?.length || 0}</p>
            </div>
          </div>

          <div className="p-2 bg-slate-800/60 border border-slate-700/50 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">Route</span>
              <Button variant="ghost" size="sm" className="h-5 px-1 text-xs text-slate-400" onClick={copyRoute}>
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
            <p className="text-[10px] font-mono text-purple-400 leading-relaxed break-all">
              {importedData.route_string}
            </p>
          </div>

          {simbriefWaypoints.length > 0 && (
            <Dialog open={waypointsOpen} onOpenChange={setWaypointsOpen}>
              <Button
                type="button"
                onClick={() => setWaypointsOpen(true)}
                className="w-full h-8 text-xs bg-purple-700/90 hover:bg-purple-600 gap-2 text-purple-50 border border-purple-400/20"
              >
                <Route className="w-3 h-3" />
                {lang === 'de' ? 'SimBrief Waypoints anzeigen' : 'Show SimBrief waypoints'}
              </Button>
              <DialogContent className="h-[86dvh] w-[calc(100vw-0.75rem)] max-w-3xl bg-slate-950 border-purple-500/30 text-slate-100 p-0 overflow-hidden flex flex-col">
                <DialogHeader className="shrink-0 px-4 py-3 border-b border-purple-500/20 bg-purple-950/30">
                  <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-purple-200">
                    <Route className="w-4 h-4 text-purple-300" />
                    {lang === 'de' ? 'SimBrief Route Waypoints' : 'SimBrief route waypoints'}
                  </DialogTitle>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_top,rgba(88,28,135,0.28),transparent_34%),#020617] p-3 [-webkit-overflow-scrolling:touch]">
                  <div className="space-y-2 font-mono">
                    {simbriefWaypoints.map((wp, index) => {
                      const stage = String(wp.type || wp.stage || 'enroute').toUpperCase();
                      const airway = wp.airway ? String(wp.airway) : '';
                      return (
                        <div
                          key={`${wp.name || 'WPT'}-${index}`}
                          className="grid grid-cols-[2.4rem_1fr_auto] items-center gap-3 rounded-md border border-purple-500/20 bg-slate-950/75 px-3 py-2 shadow-[0_0_18px_rgba(126,34,206,0.12)]"
                        >
                          <div className="text-[10px] text-purple-500">#{String(index + 1).padStart(2, '0')}</div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold tracking-wide text-purple-200">{wp.name || `WPT${index + 1}`}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] uppercase text-purple-400/80">
                              <span>{stage}</span>
                              {airway && <span className="text-cyan-300/80">AWY {airway}</span>}
                            </div>
                          </div>
                          <div className="rounded border border-fuchsia-400/30 bg-purple-900/35 px-2 py-1 text-xs font-bold text-fuchsia-200">
                            {formatWaypointFlightLevel(wp.alt || wp.altitude || wp.altitude_feet)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {simbriefPdfUrl && (
            <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
              <Button
                type="button"
                onClick={() => setPdfOpen(true)}
                className="w-full h-8 text-xs bg-sky-600 hover:bg-sky-700 gap-2"
              >
                <FileText className="w-3 h-3" />
                {t('show_simbrief_pdf', lang)}
              </Button>
              <DialogContent className="h-[94dvh] w-[calc(100vw-0.5rem)] max-w-none bg-slate-950 border-slate-700 text-slate-100 p-0 overflow-hidden flex flex-col sm:h-[92dvh] sm:w-[min(92vw,1100px)]">
                <DialogHeader className="shrink-0 px-4 py-3 border-b border-slate-800">
                  <div className="flex flex-col gap-2 pr-8 sm:flex-row sm:items-center sm:justify-between">
                    <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sky-300" />
                      {t('simbrief_chart_pdf', lang)}
                    </DialogTitle>
                    <Button
                      asChild
                      variant="outline"
                      className="h-7 px-2 text-xs border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 self-start sm:self-auto"
                    >
                      <a href={simbriefPdfUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-3 h-3" />
                        {t('open_pdf_new_tab', lang)}
                      </a>
                    </Button>
                  </div>
                </DialogHeader>
                <div className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-slate-900 [-webkit-overflow-scrolling:touch]">
                  {pdfLoading && (
                    <div className="absolute inset-x-0 top-[76px] z-10 mx-auto flex w-fit items-center gap-2 rounded-full border border-sky-400/20 bg-slate-950/90 px-3 py-1.5 text-xs text-sky-200 shadow-lg">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {lang === 'de' ? 'PDF wird geladen...' : 'Loading PDF...'}
                    </div>
                  )}
                  <iframe
                    key={mobilePdfReloadKey}
                    title={`${t('simbrief_chart_pdf', lang)} mobile`}
                    src={simbriefMobilePdfViewerUrl}
                    scrolling="yes"
                    onLoad={() => setTimeout(() => setPdfLoading(false), 1800)}
                    className="block h-full min-h-[78dvh] w-full border-0 bg-white sm:hidden"
                  />
                  <object
                    title={t('simbrief_chart_pdf', lang)}
                    data={simbriefPdfViewerUrl}
                    type="application/pdf"
                    className="hidden h-full min-h-[78dvh] w-full sm:block"
                  >
                    <div className="flex h-full min-h-[78dvh] flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-300">
                      <p>{lang === 'de' ? 'Der eingebettete PDF-Viewer konnte das OFP nicht anzeigen.' : 'The embedded PDF viewer could not display the OFP.'}</p>
                      <Button asChild className="h-8 bg-sky-600 text-xs hover:bg-sky-700">
                        <a href={simbriefPdfUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-3 h-3" />
                          {t('open_pdf_new_tab', lang)}
                        </a>
                      </Button>
                    </div>
                  </object>
                </div>
              </DialogContent>
            </Dialog>
          )}

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
            <RefreshCw className="w-3 h-3 mr-1" /> {t('create_new_plan', lang)}
          </Button>
        </div>
      )}
    </Card>
  );
}
