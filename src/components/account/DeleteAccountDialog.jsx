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

export default function DeleteAccountDialog({ open, onOpenChange, company }) {
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

      // Delete all in parallel batches
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

      // Clear user company_id
      await base44.auth.updateMe({ company_id: null });
    },
    onSuccess: () => {
      window.location.reload();
    }
  });

  const canDelete = confirmText === 'LÖSCHEN';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="w-5 h-5" />
            Account löschen
          </DialogTitle>
          <DialogDescription>
            Diese Aktion kann nicht rückgängig gemacht werden!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-red-950/30 border border-red-700 rounded-lg text-sm text-red-300 space-y-2">
            <p><strong>Folgendes wird unwiderruflich gelöscht:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-red-400">
              <li>Deine Firma "{company?.name}"</li>
              <li>Alle Flugzeuge und Mitarbeiter</li>
              <li>Alle Flüge und Aufträge</li>
              <li>Alle Finanzdaten und Transaktionen</li>
              <li>Dein gesamter Fortschritt</li>
            </ul>
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-2">
              Gib <span className="font-bold text-white">LÖSCHEN</span> ein, um zu bestätigen:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="LÖSCHEN"
              className="bg-slate-800 border-slate-700"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={!canDelete || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleteMutation.isPending ? 'Lösche...' : 'Endgültig löschen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}