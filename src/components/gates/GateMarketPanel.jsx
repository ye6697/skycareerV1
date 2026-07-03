import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import GateCard from '@/components/gates/GateCard';
import { DoorOpen, ParkingSquare, Loader2 } from 'lucide-react';

export default function GateMarketPanel({ icao, lang = 'de' }) {
  const de = lang === 'de';
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['gateCatalog', icao],
    queryFn: async () => (await base44.functions.invoke('gateMarket', { action: 'catalog', icao })).data,
    enabled: Boolean(icao && icao.length >= 3),
  });

  const runAction = useMutation({
    mutationFn: async (payload) => (await base44.functions.invoke('gateMarket', payload)).data,
    onSuccess: (res) => {
      setError(res?.error || null);
      queryClient.invalidateQueries({ queryKey: ['gateCatalog'] });
      queryClient.invalidateQueries({ queryKey: ['myGates'] });
      queryClient.invalidateQueries({ queryKey: ['contractsPageData'] });
    },
    onError: (e) => setError(e?.response?.data?.error || e.message),
  });

  const gates = data?.gates || [];
  const terminalGates = useMemo(() => gates.filter((g) => g.position_type === 'gate'), [gates]);
  const aprons = useMemo(() => gates.filter((g) => g.position_type === 'apron'), [gates]);

  const handleBuy = (gate) => {
    setError(null);
    runAction.mutate({ action: 'buy', icao, gateCode: gate.gate_code });
  };
  const handleSell = (gate) => {
    const input = typeof window !== 'undefined'
      ? window.prompt(de ? 'Verkaufspreis in $:' : 'Sale price in $:', String(gate.price || gate.purchase_price || 100000))
      : null;
    const price = Number(input);
    if (!input || !Number.isFinite(price) || price <= 0) return;
    setError(null);
    runAction.mutate({ action: 'setForSale', recordId: gate.record_id || gate.id, price });
  };
  const handleUnlist = (gate) => {
    setError(null);
    runAction.mutate({ action: 'unlist', recordId: gate.record_id || gate.id });
  };

  if (!icao) return null;

  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">
          <DoorOpen className="mr-1 inline h-3.5 w-3.5" />
          {de ? 'Gates & Vorfeld kaufen' : 'Buy gates & aprons'}
        </div>
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />}
      </div>
      <p className="mb-2 text-[10px] text-slate-400">
        {de
          ? 'Aufträge gibt es nur an Airports mit eigenem Gate oder Vorfeldposition.'
          : 'Contracts are only generated at airports where you own a gate or apron stand.'}
      </p>
      {error && (
        <p className="mb-2 rounded border border-rose-800/50 bg-rose-950/40 px-2 py-1 text-[10px] font-mono text-rose-300">{error}</p>
      )}
      {!isLoading && gates.length === 0 && (
        <p className="text-[10px] text-slate-400">
          {de ? 'Keine Positionen an diesem Airport verfügbar.' : 'No positions available at this airport.'}
        </p>
      )}
      {terminalGates.length > 0 && (
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          {terminalGates.map((gate) => (
            <GateCard key={gate.gate_code} gate={gate} lang={lang} busy={runAction.isPending}
              onBuy={handleBuy} onSell={handleSell} onUnlist={handleUnlist} />
          ))}
        </div>
      )}
      {aprons.length > 0 && (
        <>
          <div className="mb-1 text-[10px] font-mono uppercase tracking-wide text-amber-300">
            <ParkingSquare className="mr-1 inline h-3.5 w-3.5" />
            {de ? 'Vorfeldpositionen (Extra-Bonus)' : 'Apron stands (extra bonus)'}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {aprons.map((gate) => (
              <GateCard key={gate.gate_code} gate={gate} lang={lang} busy={runAction.isPending}
                onBuy={handleBuy} onSell={handleSell} onUnlist={handleUnlist} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}