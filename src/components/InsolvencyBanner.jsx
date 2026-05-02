import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { AlertTriangle, Skull } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLanguage } from "@/components/LanguageContext";

export function getOverdraftLimit(company) {
  return (company?.level || 1) * 5000;
}

export function isAtOverdraftLimit(company) {
  if (!company) return false;
  const balance = company.balance || 0;
  const overdraftEnabled = company.overdraft_enabled !== false;
  if (!overdraftEnabled) return balance < 0;
  const limit = getOverdraftLimit(company);
  return balance <= -limit;
}

export default function InsolvencyBanner() {
  const [showDialog, setShowDialog] = useState(false);
  const queryClient = useQueryClient();
  const { lang } = useLanguage();

  const { data: company } = useQuery({
    queryKey: ['company-insolvency'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      if (cid) {
        const companies = await base44.entities.Company.filter({ id: cid });
        if (companies[0]) return companies[0];
      }
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      return companies[0] || null;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const atLimit = isAtOverdraftLimit(company);

  const insolvencyMutation = useMutation({
    mutationFn: async () => {
      if (!company) return;

      // Delete all aircraft
      const aircraft = await base44.entities.Aircraft.filter({ company_id: company.id });
      for (const ac of aircraft) {
        if (ac.status !== 'sold') {
          await base44.entities.Aircraft.update(ac.id, { status: 'sold' });
        }
      }

      // Cancel all active contracts
      const contracts = await base44.entities.Contract.filter({ company_id: company.id });
      for (const c of contracts) {
        if (c.status === 'accepted' || c.status === 'in_progress') {
          await base44.entities.Contract.update(c.id, { status: 'failed' });
        }
      }

      // Reset company
      await base44.entities.Company.update(company.id, {
        balance: 500000,
        reputation: 0,
        active_loan: null,
      });

      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'income',
        category: 'other',
        amount: 500000,
        description: lang === 'de' ? 'Insolvenz – Neustart mit $500.000' : 'Insolvency – Restart with $500,000',
        date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowDialog(false);
    }
  });

  if (!atLimit) return null;

  const de = lang === 'de';

  return (
    <>
      <div className="p-3 bg-red-950/60 border-2 border-red-600/80 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]">
        <div className="flex items-center gap-3">
          <Skull className="w-6 h-6 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-300">
              {de ? '⚠️ Dispo-Limit erreicht!' : '⚠️ Overdraft Limit Reached!'}
            </p>
            <p className="text-xs text-red-400/80">
              {de
                ? 'Du kannst keine Wartung mehr durchführen und keine Ausgaben tätigen. Melde Insolvenz an um mit $500K neu zu starten.'
                : 'You cannot perform maintenance or make expenses. File for insolvency to restart with $500K.'}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowDialog(true)}
          className="bg-red-700 hover:bg-red-600 text-white font-bold text-xs uppercase shrink-0 shadow-lg"
        >
          <AlertTriangle className="w-4 h-4 mr-1" />
          {de ? 'Insolvenz anmelden' : 'File Insolvency'}
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-slate-900 border-red-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <Skull className="w-5 h-5" />
              {de ? 'Insolvenz anmelden' : 'File for Insolvency'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              {de
                ? 'Mit der Insolvenz wird dein Unternehmen komplett zurückgesetzt:'
                : 'Filing for insolvency will completely reset your company:'}
            </p>
            <ul className="list-disc ml-4 space-y-1 text-red-300">
              <li>{de ? 'Reputation wird auf 0 gesetzt' : 'Reputation reset to 0'}</li>
              <li>{de ? 'Kreditwürdigkeit wird auf 0 gesetzt' : 'Credit score reset to 0'}</li>
              <li>{de ? 'Alle Flugzeuge werden entfernt' : 'All aircraft removed'}</li>
              <li>{de ? 'Aktive Aufträge werden storniert' : 'Active contracts cancelled'}</li>
              <li>{de ? 'Aktiver Kredit wird gelöscht' : 'Active loan cleared'}</li>
            </ul>
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded">
              <p className="text-emerald-400 font-semibold">
                {de ? '✅ Du erhältst $500.000 Startkapital' : '✅ You receive $500,000 starting capital'}
              </p>
              <p className="text-xs text-emerald-300/70 mt-1">
                {de
                  ? 'Level und Erfahrung bleiben erhalten. Du startest mit dem Wissen, es diesmal besser zu machen!'
                  : 'Level and experience are preserved. You start over with the knowledge to do better this time!'}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)} className="border-slate-700 text-slate-400">
              {de ? 'Abbrechen' : 'Cancel'}
            </Button>
            <Button
              onClick={() => insolvencyMutation.mutate()}
              disabled={insolvencyMutation.isPending}
              className="bg-red-700 hover:bg-red-600 text-white font-bold"
            >
              {insolvencyMutation.isPending
                ? (de ? 'Wird verarbeitet...' : 'Processing...')
                : (de ? 'Insolvenz bestätigen' : 'Confirm Insolvency')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}