import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Trophy, CalendarDays, Clock3, History, Building2 } from 'lucide-react';
import { useLanguage } from "@/components/LanguageContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

import LeaderboardHeader from '@/components/leaderboard/LeaderboardHeader';
import LeaderboardFilters from '@/components/leaderboard/LeaderboardFilters';
import LeaderboardRow from '@/components/leaderboard/LeaderboardRow';

const TIME_CATEGORIES = [
  { key: 'all', icon: History },
  { key: 'month', icon: CalendarDays },
  { key: 'week', icon: Clock3 },
];

const getEntryDate = (entry) => {
  const raw = entry?.last_flight_date || entry?.updated_date || entry?.created_date || entry?.last_activity_at;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

export default function Leaderboard() {
  const { lang } = useLanguage();
  const [aircraftType, setAircraftType] = useState('all');
  const [region, setRegion] = useState('all');
  const [timeCategory, setTimeCategory] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard', aircraftType, region],
    queryFn: async () => {
      const res = await base44.functions.invoke('getLeaderboard', {
        aircraft_type: aircraftType,
        region: region,
      });
      return res.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const leaderboard = data?.leaderboard || [];
  const myRank = data?.my_rank || null;
  const totalAirlines = data?.total_airlines || 0;

  const filteredLeaderboard = useMemo(() => {
    if (timeCategory === 'all') return leaderboard;
    const days = timeCategory === 'week' ? 7 : 30;
    const now = Date.now();
    const scoped = leaderboard.filter((entry) => {
      const d = getEntryDate(entry);
      if (!d) return false;
      return now - d.getTime() <= days * 24 * 60 * 60 * 1000;
    });
    return scoped.length > 0 ? scoped : leaderboard;
  }, [leaderboard, timeCategory]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-cyan-900/30 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className="text-lg font-mono font-bold text-cyan-400 uppercase tracking-wider">
              {lang === 'de' ? 'Globales Ranking' : 'Global Leaderboard'}
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">
              {lang === 'de' ? 'Die besten Airlines im Vergleich' : 'Top airlines ranked by performance'}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2 flex-wrap'>
          {TIME_CATEGORIES.map(({ key, icon: Icon }) => (
            <button key={key} onClick={() => setTimeCategory(key)} className={`px-2 py-1 rounded-md border text-xs flex items-center gap-1 ${timeCategory === key ? 'border-cyan-400 text-cyan-200 bg-cyan-500/10' : 'border-slate-700 text-slate-400'}`}>
              <Icon className='w-3 h-3' />
              {lang === 'de' ? (key === 'all' ? 'Alle Zeit' : key === 'month' ? 'Monat' : 'Woche') : (key === 'all' ? 'All time' : key === 'month' ? 'Month' : 'Week')}
            </button>
          ))}
        </div>
        <LeaderboardFilters
          aircraftType={aircraftType}
          region={region}
          onAircraftTypeChange={setAircraftType}
          onRegionChange={setRegion}
        />
      </div>

      <LeaderboardHeader myRank={myRank} totalAirlines={totalAirlines} />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          <span className="ml-2 text-slate-400 text-sm font-mono">
            {lang === 'de' ? 'Lade Ranking...' : 'Loading leaderboard...'}
          </span>
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-400 text-sm">{error.message}</div>
      ) : filteredLeaderboard.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {lang === 'de' ? 'Noch keine Airlines im Ranking.' : 'No airlines in the leaderboard yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="hidden sm:flex items-center gap-3 px-3 py-1 text-[9px] text-slate-600 font-mono uppercase tracking-wider">
            <div className="w-8" />
            <div className="flex-1">Airline</div>
            <div className="w-16 text-center">Score</div>
            <div className="w-16 text-center">V/S (fpm)</div>
            <div className="w-16 text-center">Butter %</div>
            <div className="w-16 text-center">Reputation</div>
            <div className="w-[60px] text-right">Rating</div>
          </div>

          {filteredLeaderboard.map((entry) => (
            <LeaderboardRow key={entry.company_id} entry={entry} onOpenProfile={setSelectedEntry} />
          ))}
        </div>
      )}

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="bg-slate-900 border-cyan-900/60 text-slate-100">
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'><Building2 className='w-4 h-4 text-cyan-300' />{selectedEntry?.name}</DialogTitle>
            <DialogDescription className='text-slate-400'>{selectedEntry?.callsign || '—'} • {selectedEntry?.hub_airport || 'N/A'}</DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className='space-y-3 text-sm'>
              <div className='flex flex-wrap gap-2'>
                <Badge className='bg-cyan-500/15 text-cyan-300 border-cyan-500/30'>Rank #{selectedEntry.rank}</Badge>
                <Badge className='bg-amber-500/15 text-amber-300 border-amber-500/30'>Rating {selectedEntry.composite_score}</Badge>
                <Badge className='bg-purple-500/15 text-purple-300 border-purple-500/30'>Rep {selectedEntry.reputation}</Badge>
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <div className='rounded border border-slate-700 p-2'><p className='text-slate-400 text-xs'>KOI/KPI</p><p className='font-mono text-cyan-200'>Avg Score: {selectedEntry.avg_score}</p></div>
                <div className='rounded border border-slate-700 p-2'><p className='text-slate-400 text-xs'>Landing Avg</p><p className='font-mono text-cyan-200'>{selectedEntry.avg_landing_vs} fpm</p></div>
                <div className='rounded border border-slate-700 p-2'><p className='text-slate-400 text-xs'>Butter Rate</p><p className='font-mono text-cyan-200'>{selectedEntry.butter_pct}%</p></div>
                <div className='rounded border border-slate-700 p-2'><p className='text-slate-400 text-xs'>Flights / Pax</p><p className='font-mono text-cyan-200'>{selectedEntry.total_flights} / {(selectedEntry.total_passengers || 0).toLocaleString()}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
