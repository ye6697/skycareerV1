import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function DeleteAccountDialog({ open, onOpenChange, company }) {
  const { lang } = useLanguage();
  const [confirmText, setConfirmText] = useState('');

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!company) return;

      // Delete all company data
      const [aircraft, employees, flights, contracts, transactions, logs] = await Promise.all([
        base44.entities.Aircraft.filter({ company_id: company.id }),
        base44.entities.Employee.filter({ company_id: company.id }),
        base44.entities.Flight.filter({ company_id: company.id }),
        base44.entities.Contract.filter({ company_id: company.id }),
        base44.entities.Transaction.filter({ company_id: company.id }),
        base44.entities.XPlaneLog.filter({ company_id: company.id }),
      ]);

      const deleteAll = async (items, entity) => {
        for (const item of items) {
          await entity.delete(item.id);
        }
      };

      await Promise.all([
        deleteAll(aircraft, base44.entities.Aircraft),
        deleteAll(employees, base44.entities.Employee),
        deleteAll(flights, base44.entities.Flight),
        deleteAll(contracts, base44.entities.Contract),
        deleteAll(transactions, base44.entities.Transaction),
        deleteAll(logs, base44.entities.XPlaneLog),
      ]);

      // Delete company
      await base44.entities.Company.delete(company.id);

      // Logout the user completely (this removes their session)
      await base44.auth.logout();
    },
    onSuccess: () => {
      // logout already redirects
    }
  });

  const confirmWord = t('confirm_word', lang);
  const canDelete = confirmText === confirmWord;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="w-5 h-5" />
            {t('delete_account_title', lang)}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {t('cannot_undo', lang)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-red-950/30 border border-red-700 rounded-lg text-sm text-red-300 space-y-2">
            <p><strong>{t('will_be_deleted', lang)}</strong></p>
            <ul className="list-disc list-inside space-y-1 text-red-400">
              <li>{t('your_company', lang)} "{company?.name}"</li>
              <li>{t('all_aircraft_employees', lang)}</li>
              <li>{t('all_financial_data', lang)}</li>
              <li>{t('all_progress', lang)}</li>
              <li>{t('you_will_be_logged_out', lang)}</li>
            </ul>
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-2">
              {t('type_to_confirm', lang).replace('{0}', '')} <span className="font-bold text-white">{confirmWord}</span>
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmWord}
              className="bg-slate-900 border-slate-600"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:text-white"
              onClick={() => onOpenChange(false)}
            >
              {t('cancel', lang)}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={!canDelete || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleteMutation.isPending ? t('deleting', lang) : t('delete_permanently', lang)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}