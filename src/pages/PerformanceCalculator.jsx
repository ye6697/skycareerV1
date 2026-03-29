import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createPageUrl } from '@/utils';
import { Calculator, ArrowLeft, Loader2 } from 'lucide-react';
import TakeoffLandingCalculator from '@/components/flights/TakeoffLandingCalculator';
import { base44 } from '@/api/base44Client';

export default function PerformanceCalculator() {
  const navigate = useNavigate();
  const [simbriefData, setSimbriefData] = useState(null);
  const [simbriefLoading, setSimbriefLoading] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    (async () => {
      setSimbriefLoading(true);
      try {
        const user = await base44.auth.me();
        const uname = user?.simbrief_username;
        const pid = user?.simbrief_pilot_id;
        if (!uname && !pid) return;
        const res = await base44.functions.invoke('fetchSimBrief', {
          simbrief_username: uname || undefined,
          simbrief_userid: pid || undefined
        });
        if (res.data && !res.data.error) setSimbriefData(res.data);
      } catch (_) {}
      finally { setSimbriefLoading(false); }
    })();
  }, []);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-4 bg-slate-900/80 border border-cyan-900/30 p-4 rounded-lg shadow-lg">
        <Button 
          variant="ghost" 
          onClick={() => navigate(createPageUrl('Dashboard'))}
          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück
        </Button>
        <h1 className="text-xl font-mono font-bold text-amber-400 flex items-center gap-2">
          <Calculator className="w-6 h-6" />
          Performance Calculator
        </h1>
        {simbriefLoading && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> SimBrief...</Badge>}
        {simbriefData && !simbriefLoading && (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
            SimBrief: {simbriefData.departure_airport} → {simbriefData.arrival_airport}
          </Badge>
        )}
      </div>

      <div className="flex-1 min-h-[500px]">
        <TakeoffLandingCalculator simbriefData={simbriefData} />
      </div>
    </div>
  );
}