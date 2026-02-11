import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Landmark, AlertTriangle, Info, ShieldCheck, CreditCard, Banknote } from "lucide-react";

export default function CreditInfoCard({ company, fleetValue }) {
  const queryClient = useQueryClient();
  const [showLoanDialog, setShowLoanDialog] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanMonths, setLoanMonths] = useState(6);

  const level = company?.level || 1;
  const balance = company?.balance || 0;
  const reputation = company?.reputation || 50;
  const totalFlights = company?.total_flights || 0;
  const overdraftEnabled = company?.overdraft_enabled !== false; // default true
  const activeLoan = company?.active_loan;

  // Fleet value from props (sum of aircraft current_value)
  const fleet = fleetValue || 0;

  // Credit score (0-100) based on level, reputation, fleet, balance, flights
  const creditScore = Math.min(100, Math.round(
    (level * 2) + 
    (reputation * 0.3) + 
    (Math.min(fleet, 5000000) / 100000) + 
    (Math.min(Math.max(0, balance), 1000000) / 20000) +
    (Math.min(totalFlights, 50) * 0.4)
  ));

  const creditRating = creditScore >= 80 ? 'AAA' : creditScore >= 65 ? 'AA' : creditScore >= 50 ? 'A' : creditScore >= 35 ? 'BBB' : creditScore >= 20 ? 'BB' : 'B';
  const creditColor = creditScore >= 80 ? 'text-emerald-400' : creditScore >= 50 ? 'text-amber-400' : 'text-red-400';

  // Overdraft limit
  const overdraftLimit = level * 5000;
  const overdraftUsed = balance < 0 ? Math.abs(balance) : 0;
  const overdraftAvailable = overdraftEnabled ? Math.max(0, overdraftLimit - overdraftUsed) : 0;
  const overdraftInterestDaily = 0.5;

  // Loan limits
  const maxLoan = level * 25000 + Math.max(0, balance) * 0.5 + fleet * 0.1;
  const loanInterestMonthly = 2;
  const hasActiveLoan = activeLoan && activeLoan.remaining > 0;

  // Toggle overdraft
  const toggleOverdraftMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Company.update(company.id, {
        overdraft_enabled: !overdraftEnabled
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
    }
  });

  // Take loan
  const takeLoanMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(loanAmount);
      if (!amount || amount <= 0 || amount > maxLoan) return;
      if (hasActiveLoan) return;

      const monthlyPayment = Math.round((amount * (1 + (loanInterestMonthly / 100) * loanMonths)) / loanMonths);

      await base44.entities.Company.update(company.id, {
        balance: (company.balance || 0) + amount,
        active_loan: {
          amount: amount,
          remaining: Math.round(amount * (1 + (loanInterestMonthly / 100) * loanMonths)),
          monthly_payment: monthlyPayment,
          interest_rate: loanInterestMonthly,
          taken_date: new Date().toISOString()
        }
      });

      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'income',
        category: 'other',
        amount: amount,
        description: `Bankkredit aufgenommen (${loanMonths} Monate, ${loanInterestMonthly}%/Monat)`,
        date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowLoanDialog(false);
      setLoanAmount('');
    }
  });

  // Repay loan
  const repayLoanMutation = useMutation({
    mutationFn: async () => {
      if (!hasActiveLoan) return;
      const repayAmount = Math.min(activeLoan.remaining, balance);
      if (repayAmount <= 0) return;

      const newRemaining = activeLoan.remaining - repayAmount;

      await base44.entities.Company.update(company.id, {
        balance: balance - repayAmount,
        active_loan: newRemaining <= 0 ? null : {
          ...activeLoan,
          remaining: newRemaining
        }
      });

      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'other',
        amount: repayAmount,
        description: `Kreditrückzahlung${newRemaining <= 0 ? ' (vollständig getilgt)' : ''}`,
        date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
  });

  const parsedLoanAmount = parseFloat(loanAmount) || 0;
  const totalRepay = Math.round(parsedLoanAmount * (1 + (loanInterestMonthly / 100) * loanMonths));
  const monthlyPaymentPreview = loanMonths > 0 ? Math.round(totalRepay / loanMonths) : 0;

  return (
    <>
      <Card className="p-6 bg-slate-800 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Landmark className="w-5 h-5 text-blue-400" />
          Kredit & Dispo
        </h3>

        <div className="space-y-4">
          {/* Credit Score */}
          <div className="p-4 bg-slate-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                Kreditwürdigkeit
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-mono font-bold ${creditColor}`}>{creditScore}</span>
                <Badge className={`${creditScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' : creditScore >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                  {creditRating}
                </Badge>
              </div>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all ${creditScore >= 80 ? 'bg-emerald-400' : creditScore >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${creditScore}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500">Basiert auf Level, Reputation, Flottenwert, Kontostand & Flugerfahrung</p>
          </div>

          {/* Overdraft */}
          <div className="p-4 bg-slate-900 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-400">Dispositionskredit</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400">{overdraftEnabled ? 'Aktiv' : 'Deaktiviert'}</span>
                <Switch
                  checked={overdraftEnabled}
                  onCheckedChange={() => toggleOverdraftMutation.mutate()}
                  disabled={toggleOverdraftMutation.isPending || (balance < 0 && overdraftEnabled)}
                />
              </div>
            </div>
            {overdraftEnabled ? (
              <>
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
                {balance < 0 && overdraftEnabled && (
                  <p className="text-[10px] text-slate-500 mt-1">Dispo kann nicht deaktiviert werden solange dein Konto im Minus ist.</p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">
                Dispo ist deaktiviert. Dein Konto kann nicht ins Minus gehen. Aktiviere den Dispo um bei Engpässen flexibel zu bleiben.
              </p>
            )}
          </div>

          {/* Active Loan */}
          {hasActiveLoan && (
            <div className="p-4 bg-blue-950/30 border border-blue-700/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-400 flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  Aktiver Kredit
                </span>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Läuft</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Aufgenommen</p>
                  <p className="text-sm font-mono font-bold text-white">${activeLoan.amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Restschuld</p>
                  <p className="text-sm font-mono font-bold text-red-400">${activeLoan.remaining?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Rate/Monat</p>
                  <p className="text-sm font-mono font-bold text-amber-400">${activeLoan.monthly_payment?.toLocaleString()}</p>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700"
                disabled={balance <= 0 || repayLoanMutation.isPending}
                onClick={() => repayLoanMutation.mutate()}
              >
                {repayLoanMutation.isPending ? 'Zahle...' : `Kredit tilgen (max $${Math.min(activeLoan.remaining, Math.max(0, balance)).toLocaleString()})`}
              </Button>
            </div>
          )}

          {/* Loan Button */}
          {!hasActiveLoan && (
            <div className="p-4 bg-slate-900 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-400">Bankkredit</span>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Verfügbar</Badge>
              </div>
              <p className="text-xs text-slate-400">Max. ${Math.round(maxLoan).toLocaleString()} • {loanInterestMonthly}%/Monat Zinsen</p>
              <Button
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowLoanDialog(true)}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Kredit beantragen
              </Button>
            </div>
          )}

          {/* Info Box */}
          <div className="p-3 bg-blue-950/30 border border-blue-700/50 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-300 space-y-1">
              <p><strong>Dispo:</strong> Level × $5.000 = ${overdraftLimit.toLocaleString()}</p>
              <p><strong>Kredit:</strong> Level × $25k + 50% Kontostand + 10% Flottenwert</p>
              <p><strong>Kreditwürdigkeit:</strong> Höheres Level & Reputation = besserer Score</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Loan Dialog */}
      <Dialog open={showLoanDialog} onOpenChange={setShowLoanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Bankkredit beantragen
            </DialogTitle>
            <DialogDescription>
              Wähle Betrag und Laufzeit für deinen Kredit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-slate-900 rounded-lg flex items-center justify-between">
              <span className="text-sm text-slate-400">Kreditwürdigkeit</span>
              <div className="flex items-center gap-2">
                <span className={`font-mono font-bold ${creditColor}`}>{creditScore}</span>
                <Badge className={`${creditScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' : creditScore >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{creditRating}</Badge>
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-1 block">Kreditbetrag (max ${Math.round(maxLoan).toLocaleString()})</label>
              <Input
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="z.B. 100000"
                max={Math.round(maxLoan)}
                className="bg-slate-800 border-slate-700"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">Laufzeit: {loanMonths} Monate</label>
              <div className="flex gap-2">
                {[3, 6, 12, 24].map(m => (
                  <button
                    key={m}
                    onClick={() => setLoanMonths(m)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      loanMonths === m ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {m} Mon.
                  </button>
                ))}
              </div>
            </div>

            {parsedLoanAmount > 0 && (
              <div className="p-4 bg-slate-900 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Kreditbetrag</span>
                  <span className="text-white font-mono">${parsedLoanAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Zinsen ({loanInterestMonthly}% × {loanMonths} Mon.)</span>
                  <span className="text-red-400 font-mono">${(totalRepay - parsedLoanAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-700 font-bold">
                  <span className="text-white">Gesamt zurückzahlen</span>
                  <span className="text-red-400 font-mono">${totalRepay.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Monatliche Rate</span>
                  <span className="text-amber-400 font-mono">${monthlyPaymentPreview.toLocaleString()}/Mon.</span>
                </div>
              </div>
            )}

            {parsedLoanAmount > maxLoan && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Betrag übersteigt dein Kreditlimit von ${Math.round(maxLoan).toLocaleString()}
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowLoanDialog(false)}>
                Abbrechen
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={!parsedLoanAmount || parsedLoanAmount <= 0 || parsedLoanAmount > maxLoan || takeLoanMutation.isPending}
                onClick={() => takeLoanMutation.mutate()}
              >
                {takeLoanMutation.isPending ? 'Bearbeite...' : 'Kredit aufnehmen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}