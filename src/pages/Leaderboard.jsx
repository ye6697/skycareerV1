import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Trophy } from 'lucide-react';
import { useLanguage } from "@/components/LanguageContext";

import LeaderboardHeader from '@/components/leaderboard/LeaderboardHeader';
import LeaderboardFilters from '@/components/leaderboard/LeaderboardFilters';
import LeaderboardRow from '@/components/leaderboard/LeaderboardRow';

export default function Leaderboard() {
  const { lang } = useLanguage();
  const [aircraftType, setAircraftType] = useState('all');
  const [region, setRegion] = useState('all');

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

  return (
    <div className="space-y-4">
      {/* Page Header */}
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
        <LeaderboardFilters
          aircraftType={aircraftType}
          region={region}
          onAircraftTypeChange={setAircraftType}
          onRegionChange={setRegion}
        />
      </div>

      {/* Stats */}
      <LeaderboardHeader myRank={myRank} totalAirlines={totalAirlines} />

      {/* Leaderboard Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          <span className="ml-2 text-slate-400 text-sm font-mono">
            {lang === 'de' ? 'Lade Ranking...' : 'Loading leaderboard...'}
          </span>
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-400 text-sm">{error.message}</div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {lang === 'de' ? 'Noch keine Airlines im Ranking.' : 'No airlines in the leaderboard yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Column Headers (desktop) */}
          <div className="hidden sm:flex items-center gap-3 px-3 py-1 text-[9px] text-slate-600 font-mono uppercase tracking-wider">
            <div className="w-8" />
            <div className="flex-1">Airline</div>
            <div className="w-16 text-center">Score</div>
            <div className="w-16 text-center">V/S (fpm)</div>
            <div className="w-16 text-center">Butter %</div>
            <div className="w-16 text-center">Reputation</div>
            <div className="w-[60px] text-right">Rating</div>
          </div>

          {leaderboard.map((entry) => (
            <LeaderboardRow key={entry.company_id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}