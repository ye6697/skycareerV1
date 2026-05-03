import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Trophy, Filter } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { useAchievements } from "@/components/achievements/useAchievements";
import AchievementBadge from "@/components/achievements/AchievementBadge";
import { ACHIEVEMENT_CATEGORIES, TIER_STYLES } from "@/components/achievements/achievementDefinitions";
import { getAchievementProgress } from "@/components/achievements/achievementProgress";

export default function Achievements() {
  const { lang } = useLanguage();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showLocked, setShowLocked] = useState(true);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) return null;
      return base44.auth.me();
    },
    staleTime: Infinity,
  });

  const userCompanyId = user?.company_id;

  const { data: company } = useQuery({
    queryKey: ["company", userCompanyId],
    queryFn: async () => {
      if (userCompanyId) {
        const companies = await base44.entities.Company.filter({ id: userCompanyId });
        if (companies[0]) return companies[0];
      }
      const companies = await base44.entities.Company.filter({ created_by: user?.email });
      return companies[0] || null;
    },
    enabled: !!user,
    staleTime: 120000,
  });

  const { achievements, unlocked, total, ctx, isLoading } = useAchievements(company?.id, company);

  const unlockedCount = unlocked.size;
  const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  const filtered = useMemo(() => {
    let list = achievements;
    if (categoryFilter !== "all") list = list.filter((a) => a.category === categoryFilter);
    if (!showLocked) list = list.filter((a) => unlocked.has(a.id));
    // Unlocked first, then by tier (platinum → bronze)
    const tierOrder = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
    return [...list].sort((a, b) => {
      const aU = unlocked.has(a.id) ? 0 : 1;
      const bU = unlocked.has(b.id) ? 0 : 1;
      if (aU !== bU) return aU - bU;
      return (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99);
    });
  }, [achievements, categoryFilter, showLocked, unlocked]);

  // Stats per tier
  const tierStats = useMemo(() => {
    const stats = { bronze: { total: 0, unlocked: 0 }, silver: { total: 0, unlocked: 0 }, gold: { total: 0, unlocked: 0 }, platinum: { total: 0, unlocked: 0 } };
    for (const a of achievements) {
      if (stats[a.tier]) {
        stats[a.tier].total += 1;
        if (unlocked.has(a.id)) stats[a.tier].unlocked += 1;
      }
    }
    return stats;
  }, [achievements, unlocked]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-slate-950/90 border border-cyan-900/40 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/40 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white font-mono uppercase tracking-wider">
                {lang === "de" ? "Errungenschaften" : "Achievements"}
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">
                {lang === "de" ? "100 Abzeichen – basierend auf deiner Flug-Performance" : "100 badges – based on your flight performance"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black font-mono text-amber-400 tabular-nums">
              {unlockedCount} <span className="text-slate-500 text-lg">/ {total}</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{pct}% {lang === "de" ? "freigeschaltet" : "unlocked"}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-400" style={{ width: `${pct}%` }} />
        </div>

        {/* Tier stats */}
        <div className="grid grid-cols-4 gap-2">
          {["bronze","silver","gold","platinum"].map((t) => {
            const ts = TIER_STYLES[t];
            const st = tierStats[t];
            return (
              <div key={t} className={`rounded border ${ts.border} bg-gradient-to-br ${ts.bg} p-2 text-center`}>
                <div className={`text-[9px] font-mono uppercase tracking-widest font-bold ${ts.text}`}>
                  {ts.label[lang] || ts.label.en}
                </div>
                <div className="text-lg font-black font-mono text-white tabular-nums">
                  {st.unlocked}<span className="text-slate-500 text-xs">/{st.total}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-950/90 border border-cyan-900/40 rounded-lg p-3 flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-cyan-500" />
        <button
          onClick={() => setCategoryFilter("all")}
          className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-colors ${
            categoryFilter === "all" ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-200" : "border-slate-700 text-slate-400 hover:text-slate-200"
          }`}
        >
          {lang === "de" ? "Alle" : "All"}
        </button>
        {ACHIEVEMENT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(cat.id)}
            className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-colors ${
              categoryFilter === cat.id ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-200" : "border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            {cat[lang] || cat.en}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => setShowLocked(!showLocked)}
            className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-colors ${
              showLocked ? "border-slate-700 text-slate-400 hover:text-slate-200" : "bg-emerald-500/20 border-emerald-400/60 text-emerald-200"
            }`}
          >
            {showLocked
              ? (lang === "de" ? "Nur freigeschaltet" : "Unlocked only")
              : (lang === "de" ? "Alle anzeigen" : "Show all")}
          </button>
        </div>
      </div>

      {/* Badge grid */}
      {isLoading ? (
        <div className="text-center py-10 text-slate-500 font-mono text-sm">
          {lang === "de" ? "Lade Statistiken..." : "Loading stats..."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((a) => {
            const isUnlocked = unlocked.has(a.id);
            const progress = ctx ? getAchievementProgress(a, ctx, isUnlocked) : null;
            return (
              <AchievementBadge
                key={a.id}
                achievement={a}
                unlocked={isUnlocked}
                lang={lang}
                size="md"
                progress={progress}
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-10 text-slate-500 font-mono text-sm">
              {lang === "de" ? "Keine Einträge" : "No entries"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}