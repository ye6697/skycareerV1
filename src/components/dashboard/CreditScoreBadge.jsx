import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { calculateCreditScore, getCreditRating, getCreditColor } from "@/components/finance/CreditInfoCard";

export default function CreditScoreBadge({ company, fleetValue }) {
  const score = calculateCreditScore(company, fleetValue);
  const rating = getCreditRating(score);
  const color = getCreditColor(score);

  return (
    <Card className="p-6 bg-slate-800 border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-blue-400" />
        <h3 className="font-semibold text-white">Kreditwürdigkeit</h3>
      </div>
      
      <div className="flex items-center justify-between mb-3">
        <span className={`text-3xl font-mono font-bold ${color}`}>{score}</span>
        <Badge className={`text-sm ${score >= 80 ? 'bg-emerald-500/20 text-emerald-400' : score >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
          {rating}
        </Badge>
      </div>

      <div className="w-full bg-slate-700 rounded-full h-2.5 mb-3">
        <div 
          className={`h-2.5 rounded-full transition-all ${score >= 80 ? 'bg-emerald-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${score}%` }}
        />
      </div>

      <p className="text-xs text-slate-500">
        {score >= 80 ? 'Ausgezeichnet – Beste Kreditkonditionen' :
         score >= 50 ? 'Gut – Kredit verfügbar' :
         score >= 29 ? 'Grenzwertig – Eingeschränkte Optionen' :
         'Zu niedrig – Kein Kredit möglich'}
      </p>
    </Card>
  );
}