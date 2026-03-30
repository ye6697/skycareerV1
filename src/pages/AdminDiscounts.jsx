import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from "@/components/LanguageContext";
import { Ticket, Plus, Trash2, Copy, Check, Percent, DollarSign } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import CreateDiscountForm from "@/components/admin/CreateDiscountForm";
import DiscountList from "@/components/admin/DiscountList";

export default function AdminDiscounts() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const de = lang === 'de';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-discounts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('lemonsqueezyDiscounts', { action: 'list' });
      return res.data.discounts || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (discountId) => {
      await base44.functions.invoke('lemonsqueezyDiscounts', { action: 'delete', discount_id: discountId });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-discounts'] }),
  });

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-cyan-900/30 p-2 rounded-lg shadow-md">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-cyan-400" />
          <span className="text-lg font-mono font-bold text-cyan-400 uppercase tracking-widest">
            {de ? 'Gutscheincodes' : 'Discount Codes'}
          </span>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-cyan-700 hover:bg-cyan-600 text-white font-mono text-xs uppercase"
        >
          <Plus className="w-4 h-4 mr-1" />
          {de ? 'Neuer Code' : 'New Code'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500 font-mono text-sm">
            {de ? 'Lade Gutscheincodes...' : 'Loading discount codes...'}
          </div>
        ) : (
          <DiscountList
            discounts={data || []}
            onDelete={(id) => deleteMutation.mutate(id)}
            deleting={deleteMutation.isPending}
          />
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-400">
              <Ticket className="w-5 h-5" />
              {de ? 'Gutscheincode erstellen' : 'Create Discount Code'}
            </DialogTitle>
          </DialogHeader>
          <CreateDiscountForm
            onSuccess={() => {
              setShowCreate(false);
              queryClient.invalidateQueries({ queryKey: ['admin-discounts'] });
            }}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}