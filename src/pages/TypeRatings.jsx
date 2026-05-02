import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  GraduationCap,
  CheckCircle2,
  Lock,
  Sparkles,
  Search,
  Plane,
  Trophy,
  Loader2,
  Clock,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import {
  getTypeRatingCost,
  userHasTypeRating,
  getActiveTypeRating,
  TYPE_RATING_PASS_SCORE,
  TYPE_RATING_MAX_NM,
} from '@/lib/typeRatings';
import TypeRatingMissionPopup from '@/components/typerating/TypeRatingMissionPopup';

const TYPE_LABELS = {
  small_prop: { en: 'Small Prop', de: 'Propeller (klein)' },
  turboprop: { en: 'Turboprop', de: 'Turboprop' },
  regional_jet: { en: 'Regional Jet', de: 'Regionaljet' },
  narrow_body: { en: 'Narrow-Body', de: 'Narrow-Body' },
  wide_body: { en: 'Wide-Body', de: 'Wide-Body' },
  cargo: { en: 'Cargo', de: 'Fracht' },
};

const TYPE_COLOR = {
  small_prop: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
  turboprop: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
  regional_jet: 'from-sky-500/20 to-sky-500/5 border-sky-500/30',
  narrow_body: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
  wide_body: 'from-violet-500/20 to-violet-500/5 border-violet-500/30',
  cargo: 'from-orange-500/20 to-orange-500/5 border-orange-500/30',
};

function StatusBadge({ status, lang }) {
  if (status === 'earned') {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 gap-1">
        <CheckCircle2 className="w-3 h-3" />
        {lang === 'de' ? 'Erhalten' : 'Earned'}
      </Badge>
    );
  }
  if (status === 'training') {
    return (
      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 gap-1 animate-pulse">
        <Clock className="w-3 h-3" />
        {lang === 'de' ? 'Training läuft' : 'In training'}
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-700/40 text-slate-400 border-slate-600/40 gap-1">
      <Lock className="w-3 h-3" />
      {lang === 'de' ? 'Gesperrt' : 'Locked'}
    </Badge>
  );
}

export default function TypeRatings() {
  const { lang } = useLanguage();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 30000,
  });

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const u = await base44.auth.me();
      const cid = u?.company_id || u?.data?.company_id;
      if (cid) {
        const cs = await base44.entities.Company.filter({ id: cid });
        if (cs[0]) return cs[0];
      }
      const cs = await base44.entities.Company.filter({ created_by: u.email });
      return cs[0] || null;
    },
    staleTime: 30000,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['aircraftTemplates'],
    queryFn: () => base44.entities.AircraftTemplate.list(),
    staleTime: 5 * 60 * 1000,
  });

  // Build the list with status per model.
  const ratings = useMemo(() => {
    const earnedSet = new Set(Array.isArray(user?.type_ratings) ? user.type_ratings : []);
    const active = user?.active_type_rating || null;
    return (templates || [])
      .map((tpl) => {
        const status = earnedSet.has(tpl.name)
          ? 'earned'
          : active && active.model === tpl.name
            ? 'training'
            : 'locked';
        return {
          ...tpl,
          status,
          cost: getTypeRatingCost(tpl),
        };
      })
      .sort((a, b) => {
        // earned → training → locked, then by required level / name.
        const order = { earned: 0, training: 1, locked: 2 };
        const diff = order[a.status] - order[b.status];
        if (diff !== 0) return diff;
        return (a.level_requirement || 1) - (b.level_requirement || 1)
          || String(a.name).localeCompare(String(b.name));
      });
  }, [templates, user]);

  const filtered = useMemo(() => {
    return ratings.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!String(r.name || '').toLowerCase().includes(q)
          && !String(r.type || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [ratings, filter, search]);

  const stats = useMemo(() => {
    const earned = ratings.filter((r) => r.status === 'earned').length;
    const training = ratings.filter((r) => r.status === 'training').length;
    return { earned, training, total: ratings.length };
  }, [ratings]);

  return (
    <div className="min-h-screen p-2 sm:p-4 max-w-7xl mx-auto">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-6 overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-cyan-950/40 to-slate-900 p-5 sm:p-7"
      >
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-12 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <motion.div
              initial={{ rotate: -20, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center"
            >
              <GraduationCap className="w-6 h-6 text-cyan-300" />
            </motion.div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {lang === 'de' ? 'Type-Ratings' : 'Type Ratings'}
              </h1>
              <p className="text-sm text-cyan-300/80">
                {lang === 'de'
                  ? 'Erwerbe Berechtigungen, um neue Flugzeugmodelle fliegen zu dürfen.'
                  : 'Earn certifications to unlock and fly new aircraft models.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3"
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-300/80 mb-1">
                <CheckCircle2 className="w-3 h-3" />
                {lang === 'de' ? 'Erhalten' : 'Earned'}
              </div>
              <div className="text-2xl font-black text-emerald-300">{stats.earned}</div>
            </motion.div>
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3"
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-300/80 mb-1">
                <Clock className="w-3 h-3" />
                {lang === 'de' ? 'Im Training' : 'In Training'}
              </div>
              <div className="text-2xl font-black text-amber-300">{stats.training}</div>
            </motion.div>
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-3"
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                <Plane className="w-3 h-3" />
                {lang === 'de' ? 'Verfügbar' : 'Available'}
              </div>
              <div className="text-2xl font-black text-white">{stats.total}</div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'de' ? 'Modell oder Typ suchen…' : 'Search model or type…'}
            className="h-9 pl-8 bg-slate-900 border-slate-700 text-white"
          />
        </div>
        {[
          { key: 'all', label: lang === 'de' ? 'Alle' : 'All' },
          { key: 'earned', label: lang === 'de' ? 'Erhalten' : 'Earned' },
          { key: 'training', label: lang === 'de' ? 'Training' : 'Training' },
          { key: 'locked', label: lang === 'de' ? 'Gesperrt' : 'Locked' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase border transition ${
              filter === f.key
                ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-cyan-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-cyan-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center bg-slate-900 border-slate-700">
          <Plane className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-semibold">
            {lang === 'de' ? 'Keine Type-Ratings gefunden' : 'No type ratings found'}
          </p>
        </Card>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <AnimatePresence>
            {filtered.map((r, idx) => (
              <motion.button
                key={r.id || r.name}
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3), type: 'spring', stiffness: 220, damping: 22 }}
                whileHover={{ y: -4, transition: { duration: 0.18 } }}
                onClick={() => setSelected(r)}
                className={`relative text-left rounded-2xl border bg-gradient-to-br ${TYPE_COLOR[r.type] || TYPE_COLOR.small_prop} p-4 overflow-hidden group cursor-pointer transition-shadow hover:shadow-[0_0_30px_rgba(34,211,238,0.25)]`}
              >
                {/* Earned glow */}
                {r.status === 'earned' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 bg-emerald-400/5 pointer-events-none"
                  />
                )}
                {/* Sparkle for earned */}
                {r.status === 'earned' && (
                  <Sparkles className="absolute top-2 right-2 w-4 h-4 text-emerald-300 animate-pulse" />
                )}

                <div className="relative space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-mono mb-0.5">
                        {TYPE_LABELS[r.type]?.[lang] || r.type}
                      </p>
                      <h3 className="text-base font-bold text-white truncate">{r.name}</h3>
                    </div>
                    <StatusBadge status={r.status} lang={lang} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-700/40">
                      <p className="text-[9px] text-slate-500 uppercase">PAX</p>
                      <p className="font-mono font-bold text-cyan-200">{r.passenger_capacity || 0}</p>
                    </div>
                    <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-700/40">
                      <p className="text-[9px] text-slate-500 uppercase">{lang === 'de' ? 'Reichw.' : 'Range'}</p>
                      <p className="font-mono font-bold text-cyan-200">{(r.range_nm || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-700/40">
                      <p className="text-[9px] text-slate-500 uppercase">Lvl</p>
                      <p className="font-mono font-bold text-cyan-200">{r.level_requirement || 1}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/40">
                    <div className="text-[10px] text-slate-400 font-mono uppercase">
                      {lang === 'de' ? 'Schulungskosten' : 'Training cost'}
                    </div>
                    <div className="text-sm font-bold text-amber-300">${r.cost.toLocaleString()}</div>
                  </div>

                  {r.status === 'locked' && (
                    <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 group-hover:text-cyan-300 transition-colors pt-1">
                      <GraduationCap className="w-3 h-3" />
                      {lang === 'de' ? 'Klick zum Starten' : 'Click to start'}
                    </div>
                  )}
                  {r.status === 'training' && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-300 pt-1">
                      <Trophy className="w-3 h-3" />
                      {lang === 'de'
                        ? `≥${TYPE_RATING_PASS_SCORE}% bei Trainingsflug fliegen`
                        : `Fly ≥${TYPE_RATING_PASS_SCORE}% on training flight`}
                    </div>
                  )}
                  {r.status === 'earned' && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-300 pt-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {lang === 'de' ? 'Du darfst dieses Modell fliegen' : 'You may fly this model'}
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Footer info */}
      <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-xs text-cyan-200/80">
        <p className="flex items-start gap-2">
          <GraduationCap className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
          <span>
            {lang === 'de'
              ? `Ein Type-Rating wird durch eine bezahlte Schulung und einen Trainingsflug unter ${TYPE_RATING_MAX_NM} NM mit mindestens ${TYPE_RATING_PASS_SCORE}% Score erworben. Ohne gültiges Rating kannst du das Flugzeug weder kaufen noch fliegen.`
              : `A type rating is earned via a paid course plus a training flight under ${TYPE_RATING_MAX_NM} NM scored at ≥${TYPE_RATING_PASS_SCORE}%. Without a valid rating you cannot buy or fly the aircraft.`}
          </span>
        </p>
      </div>

      <TypeRatingMissionPopup
        open={!!selected}
        aircraft={selected}
        company={company}
        user={user}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}