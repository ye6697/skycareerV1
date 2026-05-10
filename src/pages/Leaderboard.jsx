import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  Clock3,
  Gauge,
  History,
  Landmark,
  Loader2,
  MapPin,
  Plane,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
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

const AIRCRAFT_TYPE_LABELS = {
  small_prop: 'Small Prop',
  turboprop: 'Turboprop',
  regional_jet: 'Regional Jet',
  narrow_body: 'Narrow Body',
  wide_body: 'Wide Body',
  cargo: 'Cargo',
  unknown: 'Unknown',
};

const getEntryDate = (entry) => {
  const raw = entry?.last_flight_date || entry?.updated_date || entry?.created_date || entry?.last_activity_at;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

const formatDate = (value, lang) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatMoney = (value) => `$${Math.round(Number(value || 0)).toLocaleString()}`;

function ProfileStat({ icon: Icon, label, value, detail, tone = 'cyan' }) {
  const toneClasses = {
    cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25',
    amber: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
    emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
    rose: 'text-rose-300 bg-rose-500/10 border-rose-500/25',
    indigo: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/25',
  };
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-md border ${toneClasses[tone] || toneClasses.cyan}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <p className="text-lg font-black text-white">{value}</p>
      {detail && <p className="mt-0.5 text-[11px] text-slate-400">{detail}</p>}
    </div>
  );
}

function PodiumCard({ entry, onClick }) {
  if (!entry) return null;
  const rankTone = entry.rank === 1 ? 'text-amber-300 border-amber-500/30 bg-amber-500/10' : entry.rank === 2 ? 'text-slate-200 border-slate-400/25 bg-slate-400/10' : 'text-orange-300 border-orange-500/30 bg-orange-500/10';
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-800 bg-slate-950/75 p-4 text-left transition hover:border-cyan-600/50"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className={`rounded-md border px-2 py-1 text-xs font-black ${rankTone}`}>#{entry.rank}</div>
        <Trophy className={`h-5 w-5 ${entry.rank === 1 ? 'text-amber-300' : 'text-slate-400'}`} />
      </div>
      <p className="truncate text-base font-black text-white">{entry.name}</p>
      <p className="mt-1 text-xs text-slate-500">{entry.callsign || entry.hub_airport || 'Global operator'}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[9px] uppercase text-slate-500">Rating</p>
          <p className="text-sm font-bold text-cyan-200">{entry.composite_score}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase text-slate-500">Rep</p>
          <p className="text-sm font-bold text-indigo-200">{entry.reputation}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase text-slate-500">Fleet</p>
          <p className="text-sm font-bold text-emerald-200">{entry.fleet_size || 0}</p>
        </div>
      </div>
    </button>
  );
}

function AirlineProfile({ entry, lang }) {
  const aircraftTypes = Object.entries(entry.aircraft_types || {}).sort((a, b) => b[1] - a[1]);
  const landing = Number(entry.avg_landing_vs || 0);
  const maintenancePct = Math.round(Number(entry.maintenance_ratio || 0) * 100);
  const primaryType = AIRCRAFT_TYPE_LABELS[entry.primary_aircraft_type] || entry.primary_aircraft_type || '-';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-cyan-900/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-xl font-black text-cyan-200">
              {String(entry.name || 'SC').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-200">Rank #{entry.rank}</Badge>
                <Badge className="border-cyan-500/30 bg-cyan-500/15 text-cyan-200">Rating {entry.composite_score}</Badge>
                {entry.is_me && <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-200">Your airline</Badge>}
              </div>
              <h3 className="text-2xl font-black text-white">{entry.name}</h3>
              <p className="text-sm text-slate-400">{entry.callsign || '-'} - {entry.hub_airport || 'N/A'} - {primaryType}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{lang === 'de' ? 'Letzter Flug' : 'Last flight'}</p>
            <p className="text-sm font-semibold text-slate-200">{formatDate(entry.last_flight_date, lang)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ProfileStat icon={Gauge} label="Avg Score" value={entry.avg_score || 0} detail={`Best ${entry.best_score || 0}`} tone="emerald" />
        <ProfileStat icon={Plane} label="Landing" value={`${landing || '-'} fpm`} detail={`Best ${entry.best_landing_vs ?? '-'} fpm`} tone={landing < 180 ? 'emerald' : landing < 320 ? 'amber' : 'rose'} />
        <ProfileStat icon={Users} label="Passengers" value={(entry.total_passengers || 0).toLocaleString()} detail={`${entry.total_flights || 0} flights`} tone="cyan" />
        <ProfileStat icon={ShieldCheck} label="Reputation" value={entry.reputation || 0} detail={`${entry.butter_pct || 0}% butter landings`} tone="indigo" />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-cyan-300" />
            <p className="text-sm font-bold text-white">{lang === 'de' ? 'Airline-Profil' : 'Airline profile'}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md bg-slate-900/70 p-3">
              <p className="text-[10px] uppercase text-slate-500">Level / XP</p>
              <p className="font-mono text-cyan-200">Lv.{entry.level} / {(entry.xp || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-md bg-slate-900/70 p-3">
              <p className="text-[10px] uppercase text-slate-500">Fleet value</p>
              <p className="font-mono text-emerald-200">{formatMoney(entry.fleet_value)}</p>
            </div>
            <div className="rounded-md bg-slate-900/70 p-3">
              <p className="text-[10px] uppercase text-slate-500">Cargo moved</p>
              <p className="font-mono text-amber-200">{Math.round(entry.total_cargo_kg || 0).toLocaleString()} kg</p>
            </div>
            <div className="rounded-md bg-slate-900/70 p-3">
              <p className="text-[10px] uppercase text-slate-500">Maintenance load</p>
              <p className="font-mono text-indigo-200">{maintenancePct}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Plane className="h-4 w-4 text-cyan-300" />
            <p className="text-sm font-bold text-white">{lang === 'de' ? 'Flottenmix' : 'Fleet mix'}</p>
          </div>
          {aircraftTypes.length === 0 ? (
            <p className="text-sm text-slate-500">{lang === 'de' ? 'Keine Flottendaten vorhanden.' : 'No fleet data available.'}</p>
          ) : (
            <div className="space-y-2">
              {aircraftTypes.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
                  <span className="text-xs text-slate-300">{AIRCRAFT_TYPE_LABELS[type] || type}</span>
                  <span className="font-mono text-sm font-bold text-cyan-200">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
        region,
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

  const podium = filteredLeaderboard.slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-4 p-3 sm:p-6">
        <div className="rounded-lg border border-cyan-900/40 bg-slate-900/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
                  <Trophy className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-cyan-300">
                    {lang === 'de' ? 'Globales Ranking' : 'Global Leaderboard'}
                  </p>
                  <h1 className="text-2xl font-black text-white sm:text-3xl">
                    {lang === 'de' ? 'Airline Performance Board' : 'Airline Performance Board'}
                  </h1>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-slate-400">
                {lang === 'de'
                  ? 'Vergleiche Airlines nach Score, Landungen, Reputation, Flotte und Aktivitaet. Profile zeigen jetzt deutlich mehr operative Details.'
                  : 'Compare airlines by score, landings, reputation, fleet, and activity. Profiles now show deeper operating detail.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {TIME_CATEGORIES.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTimeCategory(key)}
                  className={`flex h-8 items-center gap-1 rounded-md border px-2 text-xs ${
                    timeCategory === key
                      ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200'
                      : 'border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {lang === 'de' ? (key === 'all' ? 'Alle Zeit' : key === 'month' ? 'Monat' : 'Woche') : (key === 'all' ? 'All time' : key === 'month' ? 'Month' : 'Week')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <LeaderboardFilters
            aircraftType={aircraftType}
            region={region}
            onAircraftTypeChange={setAircraftType}
            onRegionChange={setRegion}
          />
        </div>

        <LeaderboardHeader
          myRank={myRank}
          totalAirlines={totalAirlines}
          leader={filteredLeaderboard[0]}
          scopedCount={filteredLeaderboard.length}
        />

        {podium.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-3">
            {podium.map((entry) => (
              <PodiumCard key={`podium-${entry.company_id}`} entry={entry} onClick={() => setSelectedEntry(entry)} />
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-slate-800 bg-slate-950/70 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
            <span className="ml-2 text-sm text-slate-400">
              {lang === 'de' ? 'Lade Ranking...' : 'Loading leaderboard...'}
            </span>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 py-12 text-center text-sm text-red-300">{error.message}</div>
        ) : filteredLeaderboard.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 py-16 text-center">
            <Trophy className="mx-auto mb-3 h-12 w-12 text-slate-700" />
            <p className="text-sm text-slate-500">
              {lang === 'de' ? 'Noch keine Airlines im Ranking.' : 'No airlines in the leaderboard yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLeaderboard.map((entry) => (
              <LeaderboardRow key={entry.company_id} entry={entry} onOpenProfile={setSelectedEntry} />
            ))}
          </div>
        )}

        <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
          <DialogContent className="max-w-5xl border-cyan-900/60 bg-slate-950 text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-cyan-300" />
                {selectedEntry?.name}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-slate-400">
                <MapPin className="h-3 w-3" />
                {selectedEntry?.callsign || '-'} - {selectedEntry?.hub_airport || 'N/A'}
                <Sparkles className="h-3 w-3 text-amber-300" />
                {selectedEntry ? `Rating ${selectedEntry.composite_score}` : ''}
                <Landmark className="h-3 w-3 text-cyan-300" />
                {selectedEntry ? `${selectedEntry.fleet_size || 0} aircraft` : ''}
              </DialogDescription>
            </DialogHeader>
            {selectedEntry && <AirlineProfile entry={selectedEntry} lang={lang} />}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
