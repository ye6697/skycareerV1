import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import PricingCards from "./PricingCards";

export default function SubscriptionPaywall() {
  const { lang } = useLanguage();

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <Card className="max-w-3xl w-full bg-slate-900/90 border-slate-700 p-6 sm:p-10 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
          {lang === 'de' ? 'Abo erforderlich' : 'Subscription Required'}
        </h2>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          {lang === 'de'
            ? 'Um alle Features von SkyCareer nutzen zu können, benötigst du ein aktives Abonnement. Wähle einen Plan aus, um loszulegen.'
            : 'To access all SkyCareer features, you need an active subscription. Choose a plan below to get started.'}
        </p>
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-6">
          <Shield className="w-3 h-3 mr-1" />
          {lang === 'de' ? '7 Tage Geld-zurück-Garantie' : '7-day money-back guarantee'}
        </Badge>
        <PricingCards currentSubscription={null} />
      </Card>
    </div>
  );
}