import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from "@/components/LanguageContext";
import { Ticket, Plus, Trash2, Copy, Check, Percent, DollarSign, Package, RefreshCw } from "lucide-react";
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

  const [setupResult, setSetupResult] = useState(null);
  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('lemonsqueezySetupProducts', {});
      return res.data;
    },
    onSuccess: (data) => setSetupResult(data),
    onError: (err) => setSetupResult({ error: err?.message || String(err) }),
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

      {/* In-app purchase catalog setup */}
      <Card className="p-4 bg-slate-900/80 border border-amber-700/40">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-amber-300">
                {de ? 'In-App-Käufe (Lemon Squeezy)' : 'In-App Purchases (Lemon Squeezy)'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              {de
                ? 'Lege folgende Produkte im LS-Dashboard mit genau diesen Namen an (je 1 Variant, One-Time, kein Abo), dann klicke "Setup ausführen":'
                : 'Create these products in your LS dashboard with these exact names (one variant each, one-time, no subscription), then click "Run setup":'}
            </p>
            <ul className="text-[10px] font-mono text-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 mb-2">
              <li>• Type-Rating Instant Unlock — $0.99</li>
              <li>• Aircraft Instant Unlock — Tier 1 — $0.99</li>
              <li>• Aircraft Instant Unlock — Tier 2 — $2.99</li>
              <li>• Aircraft Instant Unlock — Tier 3 — $4.99</li>
              <li>• SC$ Pack S — $0.99</li>
              <li>• SC$ Pack M — $4.99</li>
              <li>• SC$ Pack L — $9.99</li>
              <li>• SC$ Pack XL — $14.99</li>
              <li>• SC$ Pack XXL — $19.99</li>
              <li>• SC$ Pack Ultimate — $29.99</li>
            </ul>
          </div>
          <Button
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending}
            className="bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${setupMutation.isPending ? 'animate-spin' : ''}`} />
            {de ? 'Setup ausführen' : 'Run setup'}
          </Button>
        </div>
        {setupResult && (
          <div className="mt-3 rounded-md bg-slate-950/70 border border-slate-700 p-3 text-[10px] font-mono">
            {setupResult.error ? (
              <div className="text-red-400">Error: {setupResult.error}</div>
            ) : (
              <>
                <div className="text-emerald-300 mb-1">
                  {(setupResult.results || []).filter(r => r.status === 'mapped').length} mapped
                  {(setupResult.missing || []).length > 0 && `, ${setupResult.missing.length} missing`}
                </div>
                {(setupResult.missing || []).length > 0 && (
                  <div className="text-amber-300">
                    Missing SKUs: {setupResult.missing.join(', ')}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>

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