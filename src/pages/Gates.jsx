import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/LanguageContext';
import GateCard from '@/components/gates/GateCard';
import SellGateDialog from '@/components/gates/SellGateDialog';
import { DoorOpen, ParkingSquare, Search, Info } from 'lucide-react';

const HUBS = ['EDDF', 'EDDM', 'EDDB', 'EDDH', 'EDDL', 'EDDS', 'LOWW', 'LSZH', 'EHAM', 'LFPG', 'EGLL', 'KJFK', 'OMDB'];

export default function Gates() {
  const { lang } = useLanguage();
  const de = lang === 'de';
  const queryClient = useQueryClient();
  const [icao, setIcao] = useState('EDDF');
  const [icaoInput, setIcaoInput] = useState('EDDF');
  const [sellGate, setSellGate] = useState(null);
  const [message, setMessage] = useState(null);

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['gateCatalog', icao],
    queryFn: async () => (await base44.functions.invoke('gateMarket', { action: 'catalog', icao })).data,
    enabled: icao.length >= 3,
  });

  const { data: myGatesData } = useQuery({
    queryKey: ['myGates'],
    queryFn: async () => (await base44.functions.invoke('gateMarket', { action: 'myGates' })).data,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['gateCatalog'] });
    queryClient.invalidateQueries({ queryKey: ['myGates'] });
  };

  const runAction = useMutation({
    mutationFn: async (payload) => {
      const res = await base44.functions.invoke('gateMarket', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setMessage(data?.error ? { type: 'error', text: data.error } : null);
      setSellGate(null);
      refresh();
    },
    onError: (error) => {
      const text = error?.response?.data?.error || error.message;
      setMessage({ type: 'error', text });
    },
  });

  const gates = catalogData?.gates || [];
  const terminals = useMemo(() => {
    const map = new Map();
    for (const g of gates.filter((g) => g.position_type === 'gate')) {
      const list = map.get(g.terminal) || [];
      list.push(g);
      map.set(g.terminal, list);
    }
    return Array.from(map.entries());
  }, [gates]);
  const aprons = useMemo(() => gates.filter((g) => g.position_type === 'apron'), [gates]);
  const myGates = myGatesData?.gates || [];

  const handleBuy = (gate) => {
    setMessage(null);
    runAction.mutate({ action: 'buy', icao, gateCode: gate.gate_code });
  };
  const handleSellConfirm = (gate, price) => {
    setMessage(null);
    runAction.mutate({ action: 'setForSale', recordId: gate.record_id || gate.id, price });
  };
  const handleUnlist = (gate) => {
    setMessage(null);
    runAction.mutate({ action: 'unlist', recordId: gate.record_id || gate.id });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Card className="border-cyan-900/40 bg-slate-950/70 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <DoorOpen className="w-5 h-5 text-cyan-400" />
          <h1 className="text-lg font-bold font-mono uppercase tracking-widest text-cyan-200">
            {de ? 'Gates & Vorfeldpositionen' : 'Gates & Apron Stands'}
          </h1>
        </div>
        <p className="text-xs text-slate-400 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-cyan-500" />
          {de
            ? 'Aufträge erhältst du nur noch von Flughäfen, an denen du ein Gate oder eine Vorfeldposition besitzt. Jede Position ist online einmalig – gehört sie einer anderen Airline, ist sie ausverkauft (außer sie steht zum Verkauf). Größere Gates geben höhere Bonus-Payouts, Vorfeldpositionen ein Extra-Bonus.'
            : 'Contracts are now only generated from airports where you own a gate or apron stand. Every position is globally unique – if another airline owns it, it is sold out (unless listed for sale). Bigger gates grant higher payout bonuses; apron stands grant an extra bonus.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <Input
              value={icaoInput}
              onChange={(e) => setIcaoInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && setIcao(icaoInput.trim())}
              placeholder="ICAO"
              className="h-8 w-24 font-mono bg-slate-950 border-cyan-900/50 text-cyan-100"
            />
            <Button size="sm" className="h-8 bg-cyan-900/60 border border-cyan-700 text-cyan-200 hover:bg-cyan-800"
              onClick={() => setIcao(icaoInput.trim())}>
              <Search className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {HUBS.map((hub) => (
              <button key={hub} onClick={() => { setIcao(hub); setIcaoInput(hub); }}
                className={`px-2 py-1 rounded text-[10px] font-mono border ${icao === hub ? 'border-cyan-500 text-cyan-200 bg-cyan-950/60' : 'border-slate-700 text-slate-400 hover:border-cyan-700'}`}>
                {hub}
              </button>
            ))}
          </div>
        </div>
        {message && (
          <p className="text-xs font-mono text-rose-300 border border-rose-800/50 bg-rose-950/40 rounded px-2 py-1.5">{message.text}</p>
        )}
      </Card>

      {myGates.length > 0 && (
        <Card className="border-emerald-900/40 bg-slate-950/70 p-4">
          <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-emerald-300 mb-2">
            {de ? 'Meine Positionen' : 'My positions'} ({myGates.length})
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {myGates.map((g) => (
              <Badge key={g.id} variant="outline" className="border-emerald-600/50 text-emerald-200 font-mono text-[10px]">
                {g.airport_icao} {g.gate_code} · {g.size_category}{g.position_type === 'apron' ? (de ? ' · Vorfeld' : ' · Apron') : ''}{g.for_sale ? ' · 🏷' : ''}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-cyan-900 border-t-cyan-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {terminals.map(([terminal, list]) => (
            <Card key={terminal} className="border-cyan-900/40 bg-slate-950/70 p-4">
              <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-cyan-300 mb-3 flex items-center gap-2">
                <DoorOpen className="w-4 h-4" />{icao} · {terminal}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {list.map((gate) => (
                  <GateCard key={gate.gate_code} gate={gate} lang={lang} busy={runAction.isPending}
                    onBuy={handleBuy} onSell={setSellGate} onUnlist={handleUnlist} />
                ))}
              </div>
            </Card>
          ))}
          {aprons.length > 0 && (
            <Card className="border-amber-900/40 bg-slate-950/70 p-4">
              <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-amber-300 mb-3 flex items-center gap-2">
                <ParkingSquare className="w-4 h-4" />{icao} · {de ? 'Vorfeldpositionen (Extra-Bonus)' : 'Apron stands (extra bonus)'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {aprons.map((gate) => (
                  <GateCard key={gate.gate_code} gate={gate} lang={lang} busy={runAction.isPending}
                    onBuy={handleBuy} onSell={setSellGate} onUnlist={handleUnlist} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <SellGateDialog gate={sellGate ? { ...sellGate, airport_icao: icao } : null} lang={lang}
        onConfirm={handleSellConfirm} onClose={() => setSellGate(null)} busy={runAction.isPending} />
    </div>
  );
}