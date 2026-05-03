import React from "react";
import {
  Feather, Sparkles, Award, Cloud, Target, CloudRain, ShieldCheck, Shield, Trophy,
  Minus, Crosshair, Rocket, Route, MapPin, TrendingDown, Activity,
  Star, Medal, Crown, TrendingUp, BarChart3, Zap, Flame,
  Plane, Clock, Map, PlaneTakeoff, Globe, Timer,
  Users, Package, Wind, Truck, Grid3x3,
  DollarSign, Coins, Wallet, Banknote, Building2,
  ThumbsUp, Heart, Leaf, Waves, Calendar,
  Moon, Sunrise, Repeat, RotateCcw, CheckCircle2,
} from "lucide-react";
import { TIER_STYLES } from "./achievementDefinitions";
import { getRewardForAchievement } from "./achievementRewards";

// Explicit icon map (Base44 doesn't allow `* as LucideIcons` imports).
const ICONS = {
  Feather, Sparkles, Award, Cloud, Target, CloudRain, ShieldCheck, Shield, Trophy,
  Minus, Crosshair, Rocket, Route, MapPin, TrendingDown, Activity,
  Star, Medal, Crown, TrendingUp, BarChart3, Zap, Flame,
  Plane, Clock, Map, PlaneTakeoff, Globe, Timer,
  Users, Package, Wind, Truck, Grid3x3,
  DollarSign, Coins, Wallet, Banknote, Building2,
  ThumbsUp, Heart, Leaf, Waves, Calendar,
  Moon, Sunrise, Repeat, RotateCcw,
};

// Format big numbers compactly (1234 → 1.2k, 1500000 → 1.5M).
function fmtNum(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(v)}`;
}

function fmtCash(n) {
  return `$${fmtNum(n)}`;
}

// progress: optional { current, target, percent }
export default function AchievementBadge({ achievement, unlocked, lang = "en", size = "md", progress = null }) {
  const tierStyle = TIER_STYLES[achievement.tier] || TIER_STYLES.bronze;
  const Icon = ICONS[achievement.icon] || Trophy;
  const label = achievement[lang] || achievement.en;
  const reward = getRewardForAchievement(achievement);

  const sizes = {
    sm: { icon: "w-5 h-5", title: "text-[10px]", desc: "text-[9px]", tier: "text-[8px]", box: "w-9 h-9" },
    md: { icon: "w-6 h-6", title: "text-xs", desc: "text-[10px]", tier: "text-[9px]", box: "w-10 h-10" },
    lg: { icon: "w-7 h-7", title: "text-sm", desc: "text-xs", tier: "text-[10px]", box: "w-12 h-12" },
  };
  const s = sizes[size] || sizes.md;

  const showProgress = progress && Number.isFinite(progress.target) && progress.target > 0;
  const pct = showProgress ? Math.max(0, Math.min(100, progress.percent ?? 0)) : (unlocked ? 100 : 0);

  // Bar color uses the tier's text color so the progress bar matches the badge tier.
  const barColor = (
    achievement.tier === "platinum" ? "bg-cyan-300"
    : achievement.tier === "gold" ? "bg-amber-400"
    : achievement.tier === "silver" ? "bg-slate-300"
    : "bg-amber-600"
  );

  return (
    <div
      className={`relative rounded-lg border bg-gradient-to-br p-2.5 transition-all ${
        unlocked
          ? `${tierStyle.border} ${tierStyle.bg} ${tierStyle.glow}`
          : "border-slate-800 from-slate-900/40 to-slate-950/40 opacity-70"
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          className={`flex-shrink-0 rounded-md border flex items-center justify-center ${s.box} ${
            unlocked ? `${tierStyle.border} bg-slate-950/60` : "border-slate-800 bg-slate-950/60"
          }`}
        >
          <Icon className={`${s.icon} ${unlocked ? tierStyle.text : "text-slate-600"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span
              className={`${s.tier} font-mono uppercase tracking-widest font-bold ${
                unlocked ? tierStyle.text : "text-slate-600"
              }`}
            >
              {tierStyle.label[lang] || tierStyle.label.en}
            </span>
            {unlocked && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            {/* Reward chips */}
            <span className={`${s.tier} font-mono font-bold px-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30`}>
              +{reward.xp} XP
            </span>
            <span className={`${s.tier} font-mono font-bold px-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30`}>
              +{fmtCash(reward.cash)}
            </span>
          </div>
          <div className={`${s.title} font-bold text-slate-100 leading-tight mb-0.5 truncate`}>
            {label.title}
          </div>
          <div className={`${s.desc} text-slate-400 leading-snug`}>{label.desc}</div>

          {/* Progress bar */}
          {showProgress && (
            <div className="mt-1.5">
              <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
                <div
                  className={`h-full ${barColor} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-0.5 flex justify-between items-center">
                <span className={`${s.tier} font-mono text-slate-500 tabular-nums`}>
                  {fmtNum(progress.current)} / {fmtNum(progress.target)}
                </span>
                <span className={`${s.tier} font-mono text-slate-500 tabular-nums`}>
                  {pct}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}