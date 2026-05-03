import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Loader2, Zap } from 'lucide-react';

// Generic real-money buy button. Opens a Lemon Squeezy checkout for the
// given SKU and starts polling for webhook delivery; calls onDelivered
// when the order is confirmed.
export default function RealMoneyBuyButton({
  sku,
  metadata = {},
  priceCents,
  label,
  className = '',
  size = 'sm',
  icon = true,
  onDelivered,
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(''); // '', 'opened', 'delivered', 'error'
  const [error, setError] = useState('');

  const priceLabel = `$${(priceCents / 100).toFixed(2)}`;

  async function handleClick() {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const since = new Date().toISOString();
      const res = await base44.functions.invoke('lemonsqueezyPurchaseItem', { sku, metadata });
      const url = res?.data?.checkout_url;
      if (!url) throw new Error(res?.data?.error || 'No checkout URL');
      window.open(url, '_blank', 'noopener,noreferrer');
      setStatus('opened');

      // Poll for delivery (max 5 min)
      const startedAt = Date.now();
      const poll = async () => {
        if (Date.now() - startedAt > 5 * 60 * 1000) {
          setBusy(false);
          return;
        }
        try {
          const r = await base44.functions.invoke(
            `lemonsqueezyCheckDelivery?sku=${encodeURIComponent(sku)}&since=${encodeURIComponent(since)}`,
            {}
          );
          const delivered = r?.data?.delivered || [];
          if (delivered.length > 0) {
            setStatus('delivered');
            setBusy(false);
            onDelivered?.(delivered[0]);
            return;
          }
        } catch (_) { /* keep polling */ }
        setTimeout(poll, 4000);
      };
      setTimeout(poll, 4000);
    } catch (e) {
      setError(String(e?.message || e));
      setStatus('error');
      setBusy(false);
    }
  }

  const isFullWidth = String(className || '').includes('w-full');
  return (
    <div className={`${isFullWidth ? 'flex' : 'inline-flex'} flex-col gap-1 ${className}`}>
      <Button
        size={size}
        onClick={handleClick}
        disabled={busy}
        className={`bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold border-0 ${isFullWidth ? 'w-full' : ''}`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : (icon && <Zap className="w-3.5 h-3.5 mr-1.5" />)}
        {label || `Sofort: ${priceLabel}`}
      </Button>
      {status === 'opened' && (
        <span className="text-[10px] text-amber-300 text-center">Warte auf Zahlung…</span>
      )}
      {status === 'delivered' && (
        <span className="text-[10px] text-emerald-300 text-center">✓ Freigeschaltet</span>
      )}
      {error && (
        <span className="text-[10px] text-red-400 text-center">{error}</span>
      )}
    </div>
  );
}