import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Calendar, AlertCircle } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

const STATUS_LABELS = {
  de: {
    active: "Aktiv",
    cancelled: "Gekündigt",
    expired: "Abgelaufen",
    past_due: "Zahlung überfällig",
    paused: "Pausiert",
    unpaid: "Unbezahlt",
  },
  en: {
    active: "Active",
    cancelled: "Cancelled",
    expired: "Expired",
    past_due: "Past Due",
    paused: "Paused",
    unpaid: "Unpaid",
  },
};

const STATUS_COLORS = {
  active: "bg-emerald-900/50 text-emerald-400 border-emerald-700",
  cancelled: "bg-amber-900/50 text-amber-400 border-amber-700",
  expired: "bg-red-900/50 text-red-400 border-red-700",
  past_due: "bg-red-900/50 text-red-400 border-red-700",
  paused: "bg-slate-800 text-slate-400 border-slate-600",
  unpaid: "bg-red-900/50 text-red-400 border-red-700",
};

const PLAN_LABELS = {
  de: { monthly: "Monatlich", yearly: "Jährlich", lifetime: "Lifetime" },
  en: { monthly: "Monthly", yearly: "Yearly", lifetime: "Lifetime" },
};

export default function SubscriptionStatus({ subscription }) {
  const { lang } = useLanguage();
  const sl = STATUS_LABELS[lang] || STATUS_LABELS.en;
  const pl = PLAN_LABELS[lang] || PLAN_LABELS.en;
  const de = lang === 'de';

  if (!subscription) return null;

  const statusColor = STATUS_COLORS[subscription.status] || STATUS_COLORS.expired;
  const isCancelled = subscription.status === 'cancelled' && subscription.ends_at;
  const endsAt = subscription.ends_at ? new Date(subscription.ends_at) : null;
  const renewsAt = subscription.renews_at ? new Date(subscription.renews_at) : null;

  return (
    <Card className="bg-slate-900/80 border border-cyan-900/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-400" />
          <span className="font-mono font-bold text-sm text-white uppercase">
            SkyCareer Pro – {pl[subscription.plan_type]}
          </span>
        </div>
        <Badge className={statusColor}>
          {sl[subscription.status]}
        </Badge>
      </div>

      {isCancelled && endsAt && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded p-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {de
              ? `Abo läuft noch bis ${endsAt.toLocaleDateString('de-DE')}`
              : `Subscription active until ${endsAt.toLocaleDateString('en-US')}`}
          </span>
        </div>
      )}

      {subscription.status === 'active' && renewsAt && subscription.plan_type !== 'lifetime' && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Calendar className="w-3 h-3" />
          <span>
            {de
              ? `Nächste Verlängerung: ${renewsAt.toLocaleDateString('de-DE')}`
              : `Next renewal: ${renewsAt.toLocaleDateString('en-US')}`}
          </span>
        </div>
      )}

      {subscription.plan_type === 'lifetime' && subscription.status === 'active' && (
        <div className="text-xs text-emerald-400">
          {de ? '✅ Lebenslanger Zugang – keine Verlängerung nötig' : '✅ Lifetime access – no renewal needed'}
        </div>
      )}
    </Card>
  );
}