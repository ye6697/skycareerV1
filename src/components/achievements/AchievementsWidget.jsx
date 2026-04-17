import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Trophy, ChevronRight, Lock } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { useAchievements } from "./useAchievements";
import AchievementBadge from "./AchievementBadge";

// Compact achievements overview for the Dashboard.
// Shows progress + the 4 most recent unlocks and next 2 locked targets.
export default function AchievementsWidget({ companyId, company }) {
  const { lang } = useLanguage();
  const { achievements, unlocked, total, isLoading } = useAchievements(companyId, company);

  const unlockedCount = unlocked.size;
  const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  const unlockedList = achievements.filter((a) => unlocked.has(a.id));
  const lockedList = achievements.filter((a) => !unlocked.has(a.id));

  // Show the 4 "highest-tier" unlocked + the first 2 locked (to tease next goals).
  const tierOrder = { platinum: 4, gold: 3, silver: 2, bronze: 1 };
  const showcase = [
    ...unlockedList.sort((a, b) => (tierOrder[b.tier] || 0) - (tierOrder[a.tier] || 0)).slice(0, 4),
    ...lockedList.slice(0, 2),
  ];

  return (
    <Link to={createPageUrl("Achievements")} className="block">
      <div className="bg-slate-950/90 border border-cyan-900/40 rounded-lg p-3 hover:border-cyan-400/60 transition-colors shadow-[inset_0_1px_0_rgba(34,211,238,0.08)] group">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-500 font-bold">
              {lang === "de" ? "Errungenschaften" : "Achievements"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400">
              {isLoading ? "…" : `${unlockedCount} / ${total}`}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-cyan-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Showcase grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {showcase.map((a) => (
            <AchievementBadge
              key={a.id}
              achievement={a}
              unlocked={unlocked.has(a.id)}
              lang={lang}
              size="sm"
            />
          ))}
          {showcase.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-4 text-slate-500 text-xs font-mono">
              <Lock className="w-4 h-4 mx-auto mb-1 opacity-50" />
              {lang === "de" ? "Fliege los, um Abzeichen zu erhalten" : "Start flying to earn badges"}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}