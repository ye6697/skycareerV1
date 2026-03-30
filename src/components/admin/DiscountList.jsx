import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageContext";
import { Trash2, Copy, Check, Percent, DollarSign, Ticket } from "lucide-react";

export default function DiscountList({ discounts, onDelete, deleting }) {
  const { lang } = useLanguage();
  const de = lang === 'de';
  const [copied, setCopied] = useState(null);

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!discounts.length) {
    return (
      <div className="text-center py-16">
        <Ticket className="w-12 h-12 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-500 font-mono text-sm">
          {de ? 'Noch keine Gutscheincodes erstellt' : 'No discount codes created yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {discounts.map((d) => (
        <Card key={d.id} className="p-3 bg-slate-800/80 border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-cyan-300 text-sm tracking-wider">{d.code}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-500 hover:text-cyan-400"
                onClick={() => copyCode(d.code)}
              >
                {copied === d.code ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
              <Badge className={`text-[10px] ${
                d.amount_type === 'percent'
                  ? 'bg-purple-900/50 text-purple-300 border-purple-700/50'
                  : 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50'
              }`}>
                {d.amount_type === 'percent' ? <Percent className="w-3 h-3 mr-0.5" /> : <DollarSign className="w-3 h-3 mr-0.5" />}
                {d.amount}{d.amount_type === 'percent' ? '%' : '$'} {de ? 'Rabatt' : 'off'}
              </Badge>
              {d.status && (
                <Badge className={`text-[10px] ${
                  d.status === 'active' || !d.status
                    ? 'bg-emerald-900/50 text-emerald-400 border-emerald-700/50'
                    : 'bg-red-900/50 text-red-400 border-red-700/50'
                }`}>
                  {d.status || 'active'}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-mono">
              <span>{d.name}</span>
              <span>
                {de ? 'Eingelöst' : 'Redeemed'}: {d.redemptions || 0}
                {d.max_redemptions > 0 ? `/${d.max_redemptions}` : ` (${de ? 'unbegrenzt' : '∞'})`}
              </span>
              {d.expires_at && (
                <span>{de ? 'Läuft ab' : 'Expires'}: {new Date(d.expires_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500/60 hover:text-red-400 hover:bg-red-950/30 shrink-0"
            onClick={() => onDelete(d.id)}
            disabled={deleting}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </Card>
      ))}
    </div>
  );
}