import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Landmark, AlertTriangle, Info } from "lucide-react";

export default function CreditInfoCard({ company }) {
  const level = company?.level || 1;
  const balance = company?.balance || 0;

  // Fleet value would need aircraft data, passed as prop or calculated outside
  // For now, calculate limits based on level and balance
  
  // Overdraft (Dispo): Available to everyone, limit based on level
  const overdraftLimit = level * 5000; // $5,000 per level
  
  // Standard loan: Based on level + balance
  const maxLoan = level * 25000 + Math.max(0, balance) * 0.5; // $25k/level + 50% of balance
  
  // Current overdraft usage
  const overdraftUsed = balance < 0 ? Math.abs(balance) : 0;
  const overdraftAvailable = Math.max(0, overdraftLimit - overdraftUsed);
  
  // Interest rates
  const overdraftInterestDaily = 0.5; // 0.5% per day on negative balance
  const loanInterestMonthly = 2; // 2% per month

  return (
    <Card className="p-6 bg-slate-800 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Landmark className="w-5 h-5 text-blue-400" />
        Kredit & Dispo
      </h3>

      <div className="space-y-4">
        {/* Overdraft Info */}
        <div className="p-4 bg-slate-900 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-amber-400">Dispositionskredit</span>
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Auto</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Dein Konto kann automatisch bis zum Dispo-Limit ins Minus gehen.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Limit</p>
              <p className="text-sm font-mono font-bold text-white">-${overdraftLimit.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Verfügbar</p>
              <p className="text-sm font-mono font-bold text-amber-400">${overdraftAvailable.toLocaleString()}</p>
            </div>
          </div>
          {overdraftUsed > 0 && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-red-950/30 rounded border border-red-700/50">
              <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">
                Dispo genutzt: ${overdraftUsed.toLocaleString()} ({overdraftInterestDaily}%/Tag Zinsen)
              </p>
            </div>
          )}
        </div>

        {/* Loan Info */}
        <div className="p-4 bg-slate-900 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-400">Bankkredit</span>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Manuell</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Beantrage einen Kredit für größere Investitionen. Rückzahlung in monatlichen Raten.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Max. Kredit</p>
              <p className="text-sm font-mono font-bold text-white">${Math.round(maxLoan).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Zinsen</p>
              <p className="text-sm font-mono font-bold text-blue-400">{loanInterestMonthly}%/Monat</p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-blue-950/30 border border-blue-700/50 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-300 space-y-1">
            <p><strong>Dispo-Limit:</strong> Level × $5.000 = ${overdraftLimit.toLocaleString()}</p>
            <p><strong>Kredit-Limit:</strong> Level × $25.000 + 50% Kontostand</p>
            <p><strong>Tipp:</strong> Steige im Level, um höhere Kreditlimits freizuschalten!</p>
          </div>
        </div>
      </div>
    </Card>
  );
}