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

export default function AchievementBadge({ achievement, unlocked, lang = "en", size = "md" }) {
  const tierStyle = TIER_STYLES[achievement.tier] || TIER_STYLES.bronze;
  const Icon = ICONS[achievement.icon] || Trophy;
  const label = achievement[lang] || achievement.en;

  const sizes = {
    sm: { icon: "w-5 h-5", title: "text-[10px]", desc: "text-[9px]", tier: "text-[8px]", box: "w-9 h-9" },
    md: { icon: "w-6 h-6", title: "text-xs", desc: "text-[10px]", tier: "text-[9px]", box: "w-10 h-10" },
    lg: { icon: "w-7 h-7", title: "text-sm", desc: "text-xs", tier: "text-[10px]", box: "w-12 h-12" },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div
      className={`relative rounded-lg border bg-gradient-to-br p-2.5 transition-all ${
        unlocked
          ? `${tierStyle.border} ${tierStyle.bg} ${tierStyle.glow}`
          : "border-slate-800 from-slate-900/40 to-slate-950/40 opacity-55 grayscale"
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
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`${s.tier} font-mono uppercase tracking-widest font-bold ${
                unlocked ? tierStyle.text : "text-slate-600"
              }`}
            >
              {tierStyle.label[lang] || tierStyle.label.en}
            </span>
            {unlocked && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
          </div>
          <div className={`${s.title} font-bold text-slate-100 leading-tight mb-0.5 truncate`}>
            {label.title}
          </div>
          <div className={`${s.desc} text-slate-400 leading-snug`}>{label.desc}</div>
        </div>
      </div>
    </div>
  );
}