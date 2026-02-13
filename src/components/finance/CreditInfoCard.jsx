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

export function calculateCreditScore(company, fleetValue) {
  const level = company?.level || 1;
  const reputation = company?.reputation || 50;
  const totalFlights = company?.total_flights || 0;
  const balance = company?.balance || 0;
  const fleet = fleetValue || 0;

  return Math.min(100, Math.round(
    (level * 2) + 
    (reputation * 0.3) + 
    (Math.min(fleet, 5000000) / 100000) + 
    (Math.min(Math.max(0, balance), 1000000) / 20000) +
    (Math.min(totalFlights, 50) * 0.4)
  ));
}

export function getCreditRating(score) {
  if (score >= 80) return 'AAA';
  if (score >= 65) return 'AA';
  if (score >= 50) return 'A';
  if (score >= 35) return 'BBB';
  if (score >= 20) return 'BB';
  return 'B';
}

export function getCreditColor(score) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export default function CreditInfoCard({ company, fleetValue }) {
  const queryClient = useQueryClient();
  const [showLoanDialog, setShowLoanDialog] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanFlights, setLoanFlights] = useState(6);

  const level = company?.level || 1;
  const balance = company?.balance || 0;
  const overdraftEnabled = company?.overdraft_enabled !== false;
  const activeLoan = company?.active_loan;

  const fleet = fleetValue || 0;
  const creditScore = calculateCreditScore(company, fleetValue);
  const creditRating = getCreditRating(creditScore);
  const creditColor = getCreditColor(creditScore);

  const canTakeLoan = creditScore >= 29;

  // Overdraft
  const overdraftLimit = level * 5000;
  const overdraftUsed = balance < 0 ? Math.abs(balance) : 0;
  const overdraftAvailable = overdraftEnabled ? Math.max(0, overdraftLimit - overdraftUsed) : 0;
  const overdraftInterestDaily = 0.5;

  // Loan
  const maxLoan = level * 25000 + Math.max(0, balance) * 0.5 + fleet * 0.1;
  const loanInterestPerFlight = 1.5; // 1.5% per flight
  const hasActiveLoan = activeLoan && activeLoan.remaining > 0;

  // Toggle overdraft
  const toggleOverdraftMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Company.update(company.id, {
        overdraft_enabled: !overdraftEnabled
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company'] })
  });

  // Take loan
  const takeLoanMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(loanAmount);
      if (!amount || amount <= 0 || amount > maxLoan || !canTakeLoan) return;
      if (hasActiveLoan) return;

      const totalInterest = amount * (loanInterestPerFlight / 100) * loanFlights;
      const totalRepay = Math.round(amount + totalInterest);
      const perFlightPayment = Math.round(totalRepay / loanFlights);

      await base44.entities.Company.update(company.id, {
        balance: (company.balance || 0) + amount,
        active_loan: {
          amount: amount,
          remaining: totalRepay,
          monthly_payment: perFlightPayment, // reuse field as "per flight payment"
          interest_rate: loanInterestPerFlight,
          taken_date: new Date().toISOString()
        }
      });

      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'income',
        category: 'other',
        amount: amount,
        description: `Bankkredit aufgenommen (${loanFlights} Flüge, ${loanInterestPerFlight}%/Flug)`,
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
      const repayAmount = activeLoan.remaining;
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
  const totalInterest = parsedLoanAmount * (loanInterestPerFlight / 100) * loanFlights;
  const totalRepay = Math.round(parsedLoanAmount + totalInterest);
  const perFlightPayment = loanFlights > 0 ? Math.round(totalRepay / loanFlights) : 0;

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
                <span className="text-[10px] text-slate-400">{overdraftEnabled ? 'Aktiv' : 'Aus'}</span>
                <Switch
                  checked={overdraftEnabled}
                  onCheckedChange={() => toggleOverdraftMutation.mutate()}
                  disabled={toggleOverdraftMutation.isPending || (balance < 0 && overdraftEnabled)}
                />
              </div>
            </div>
            {overdraftEnabled ? (
              <>
                <p className="text-xs text-slate-400">Konto kann automatisch bis zum Dispo-Limit ins Minus gehen.</p>
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
                {balance < 0 && (
                  <p className="text-[10px] text-slate-500 mt-1">Kann nicht deaktiviert werden solange Konto im Minus.</p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">Dispo deaktiviert. Konto kann nicht ins Minus gehen.</p>
            )}
          </div>

          {/* Active Loan */}
          {hasActiveLoan && (
            <div className="p-4 bg-blue-950/30 border border-blue-700/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-400 flex items-center gap-2">
                  <Banknote className="w-4 h-4" /> Aktiver Kredit
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
                  <p className="text-[10px] text-slate-500 uppercase">Rate/Flug</p>
                  <p className="text-sm font-mono font-bold text-amber-400">${activeLoan.monthly_payment?.toLocaleString()}</p>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700"
                disabled={repayLoanMutation.isPending}
                onClick={() => repayLoanMutation.mutate()}
              >
                {repayLoanMutation.isPending ? 'Zahle...' : `Kredit vollständig tilgen ($${activeLoan.remaining?.toLocaleString()})`}
              </Button>
            </div>
          )}

          {/* Loan Button */}
          {!hasActiveLoan && (
            <div className="p-4 bg-slate-900 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-400">Bankkredit</span>
                <Badge className={`${canTakeLoan ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                  {canTakeLoan ? 'Verfügbar' : 'Gesperrt'}
                </Badge>
              </div>
              {canTakeLoan ? (
                <>
                  <p className="text-xs text-slate-400">Max. ${Math.round(maxLoan).toLocaleString()} • {loanInterestPerFlight}%/Flug Zinsen</p>
                  <Button
                    size="sm"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => setShowLoanDialog(true)}
                  >
                    <CreditCard className="w-4 h-4 mr-2" /> Kredit beantragen
                  </Button>
                </>
              ) : (
                <p className="text-xs text-red-400">Kreditwürdigkeit unter 29 – kein Kredit möglich. Verbessere dein Level und deine Reputation!</p>
              )}
            </div>
          )}

          {/* Info */}
          <div className="p-3 bg-blue-950/30 border border-blue-700/50 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-300 space-y-1">
              <p><strong>Dispo:</strong> Level × $5.000 = ${overdraftLimit.toLocaleString()}</p>
              <p><strong>Kredit:</strong> Level × $25k + 50% Kontostand + 10% Flottenwert</p>
              <p><strong>Mindest-Score:</strong> 29 für Bankkredit</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Loan Dialog – Dark Mode */}
      <Dialog open={showLoanDialog} onOpenChange={setShowLoanDialog}>
        <DialogContent className="max-w-md bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Bankkredit beantragen
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Wähle Betrag und Rückzahlung nach Anzahl Flüge.
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
                className="bg-slate-900 border-slate-600"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">Rückzahlung über: {loanFlights} Flüge</label>
              <div className="flex gap-2">
                {[3, 6, 12, 24].map(f => (
                  <button
                    key={f}
                    onClick={() => setLoanFlights(f)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      loanFlights === f ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-600'
                    }`}
                  >
                    {f} Flüge
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
                  <span className="text-slate-400">Zinsen ({loanInterestPerFlight}% × {loanFlights} Flüge)</span>
                  <span className="text-red-400 font-mono">${Math.round(totalInterest).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-700 font-bold">
                  <span className="text-white">Gesamt zurückzahlen</span>
                  <span className="text-red-400 font-mono">${totalRepay.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pro Flug abgezogen</span>
                  <span className="text-amber-400 font-mono">${perFlightPayment.toLocaleString()}/Flug</span>
                </div>
              </div>
            )}

            {parsedLoanAmount > maxLoan && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Betrag übersteigt Limit von ${Math.round(maxLoan).toLocaleString()}
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:text-white" onClick={() => setShowLoanDialog(false)}>
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