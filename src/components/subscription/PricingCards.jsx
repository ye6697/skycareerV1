import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Star } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

const PLANS = [
  {
    key: "monthly",
    icon: Zap,
    color: "text-cyan-400",
    borderColor: "border-cyan-800/50",
    bgColor: "bg-cyan-950/20",
    features: 6,
  },
  {
    key: "yearly",
    icon: Star,
    color: "text-amber-400",
    borderColor: "border-amber-700/50",
    bgColor: "bg-amber-950/20",
    popular: true,
    features: 6,
  },
  {
    key: "lifetime",
    icon: Crown,
    color: "text-purple-400",
    borderColor: "border-purple-700/50",
    bgColor: "bg-purple-950/20",
    features: 6,
  },
];

const LABELS = {
  de: {
    monthly: { name: "Monatlich", price: "$6.99", period: "/Monat", desc: "Flexibel monatlich kündbar" },
    yearly: { name: "Jährlich", price: "$64.99", period: "/Jahr", desc: "Spare 22% gegenüber monatlich", badge: "BELIEBT" },
    lifetime: { name: "Lifetime", price: "$114.99", period: "einmalig", desc: "Einmal zahlen, für immer nutzen" },
    features: [
      "Alle Flugzeuge freigeschaltet",
      "Unbegrenzte Aufträge",
      "Erweiterte Statistiken",
      "Priority Support",
      "Exklusive Events",
      "Früher Zugang zu Updates",
    ],
    subscribe: "Jetzt abonnieren",
    buy: "Jetzt kaufen",
    processing: "Wird verarbeitet...",
    current: "Aktuell aktiv",
  },
  en: {
    monthly: { name: "Monthly", price: "$6.99", period: "/month", desc: "Flexible, cancel anytime" },
    yearly: { name: "Yearly", price: "$64.99", period: "/year", desc: "Save 22% vs monthly", badge: "POPULAR" },
    lifetime: { name: "Lifetime", price: "$114.99", period: "one-time", desc: "Pay once, use forever" },
    features: [
      "All aircraft unlocked",
      "Unlimited contracts",
      "Advanced statistics",
      "Priority support",
      "Exclusive events",
      "Early access to updates",
    ],
    subscribe: "Subscribe now",
    buy: "Buy now",
    processing: "Processing...",
    current: "Currently active",
  },
};

export default function PricingCards({ currentSubscription }) {
  const [loading, setLoading] = useState(null);
  const { lang } = useLanguage();
  const l = LABELS[lang] || LABELS.en;

  const handleCheckout = async (planType) => {
    setLoading(planType);
    const res = await base44.functions.invoke('lemonsqueezyCheckout', { plan_type: planType });
    const url = res.data.checkout_url;
    if (url) {
      window.open(url, '_blank');
    }
    setLoading(null);
  };

  const isCurrentPlan = (planKey) => {
    if (!currentSubscription) return false;
    return currentSubscription.plan_type === planKey && currentSubscription.status === 'active';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {PLANS.map((plan) => {
        const labels = l[plan.key];
        const isCurrent = isCurrentPlan(plan.key);
        const Icon = plan.icon;

        return (
          <Card
            key={plan.key}
            className={`relative overflow-hidden ${plan.bgColor} ${plan.borderColor} border-2 ${plan.popular ? 'ring-2 ring-amber-500/30' : ''}`}
          >
            {plan.popular && labels.badge && (
              <div className="absolute top-0 right-0 bg-amber-500 text-black text-[9px] font-mono font-bold px-2 py-0.5 rounded-bl">
                {labels.badge}
              </div>
            )}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon className={`w-5 h-5 ${plan.color}`} />
                <span className="font-mono font-bold text-sm text-white uppercase">{labels.name}</span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${plan.color}`}>{labels.price}</span>
                <span className="text-xs text-slate-500 font-mono">{labels.period}</span>
              </div>

              <p className="text-xs text-slate-400">{labels.desc}</p>

              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                {l.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                {isCurrent ? (
                  <Badge className="w-full justify-center py-1.5 bg-emerald-900/50 text-emerald-400 border-emerald-700">
                    {l.current}
                  </Badge>
                ) : (
                  <Button
                    onClick={() => handleCheckout(plan.key)}
                    disabled={loading !== null}
                    className={`w-full font-mono text-xs uppercase ${
                      plan.popular
                        ? 'bg-amber-600 hover:bg-amber-500 text-black'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                  >
                    {loading === plan.key
                      ? l.processing
                      : plan.key === 'lifetime' ? l.buy : l.subscribe}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}