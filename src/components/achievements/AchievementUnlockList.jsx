import React from "react";
import { motion } from "framer-motion";
import { Trophy, Sparkles } from "lucide-react";
import { TIER_STYLES } from "./achievementDefinitions";
import { getRewardForAchievement } from "./achievementRewards";

// Renders the list of achievements unlocked on a single flight, plus the
// total XP + cash bonus they granted. Used by FlightCompletionAnimation and
// CompletedFlightDetails.
//
// achievements: [{ id, tier, icon, en, de }] — lightweight shape stored on
//               flight.xplane_data.achievements_unlocked.
// xpBonus, cashBonus: pre-summed numbers, optional (re-derived if missing).
// lang: 'de' | 'en'
// compact: tighter layout for the animation overlay.
export default function AchievementUnlockList({
  achievements,
  xpBonus,
  cashBonus,
  lang = "en",
  compact = false,
}) {
  const list = Array.isArray(achievements) ? achievements : [];
  if (list.length === 0) return null;

  // Re-sum if the caller didn't pass totals (e.g. older flights without bonus fields).
  let totalXp = Number(xpBonus || 0);
  let totalCash = Number(cashBonus || 0);
  if (!totalXp && !totalCash) {
    for (const a of list) {
      const r = getRewardForAchievement(a);
      totalXp += r.xp;
      totalCash += r.cash;
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded border border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-slate-900/60 to-slate-950 px-3 py-2.5"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
            {lang === "de"
              ? `${list.length} neue${list.length === 1 ? "s" : ""} Achievement${list.length === 1 ? "" : "s"}`
              : `${list.length} new achievement${list.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          {totalCash > 0 && (
            <span className="text-emerald-300">
              +${totalCash.toLocaleString()}
            </span>
          )}
          {totalXp > 0 && (
            <span className="text-cyan-300">+{totalXp.toLocaleString()} XP</span>
          )}
        </div>
      </div>
      <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "gap-2"}`}>
        {list.map((a, idx) => {
          const ts = TIER_STYLES[a.tier] || TIER_STYLES.bronze;
          const title = (a[lang] && a[lang].title) || a.en?.title || a.id;
          return (
            <motion.div
              key={a.id || idx}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.06 }}
              className={`flex items-center gap-1.5 rounded border ${ts.border} bg-gradient-to-br ${ts.bg} px-2 py-1 ${compact ? "text-[10px]" : "text-[11px]"}`}
            >
              <Sparkles className={`w-3 h-3 ${ts.text}`} />
              <span className={`${ts.text} font-mono uppercase tracking-wider`}>
                {title}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}