import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SellGateDialog({ gate, lang, onConfirm, onClose, busy }) {
  const [price, setPrice] = useState('');
  const de = lang === 'de';
  const parsed = Math.round(Number(price));
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <Dialog open={!!gate} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-900 border-cyan-900/60 text-slate-100 max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {de ? 'Position verkaufen' : 'Sell position'}: {gate?.airport_icao} {gate?.gate_code}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            {de
              ? 'Setze deinen Wunschpreis. Andere Airlines können die Position dann online kaufen.'
              : 'Set your asking price. Other airlines can then buy this position online.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="number"
            min="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={de ? 'Preis in $' : 'Price in $'}
            className="bg-slate-950 border-cyan-900/50 font-mono"
          />
          <Button
            disabled={!valid || busy}
            onClick={() => onConfirm(gate, parsed)}
            className="w-full bg-cyan-900/60 border border-cyan-700 text-cyan-200 hover:bg-cyan-800 font-mono text-xs"
          >
            {de ? `Zum Verkauf anbieten ($${valid ? parsed.toLocaleString('de-DE') : '…'})` : `List for sale ($${valid ? parsed.toLocaleString('en-US') : '…'})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}