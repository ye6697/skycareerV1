import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/LanguageContext';
import ConquestTargetCard from '@/components/gates/conquest/ConquestTargetCard';
import ConquestChallengeCard from '@/components/gates/conquest/ConquestChallengeCard';
import { Swords, Search, Bot, Shield, Info } from 'lucide-react';

const HUBS = ['EDDF', 'EDDM', 'EDDB', 'EDDH', 'EDDL', 'EDDS', 'LOWW', 'LSZH', 'EHAM', 'LFPG', 'EGLL', 'KJFK', 'OMDB'];
const fmt = (n) => `$${Math.round(Number(n || 0)).toLocaleString('de-DE')}`;
const fortifyCost = (g) => Math.round(Math.max(40000, Number(g.purchase_price || 120000) * 0.15 * (Number(g.defense_level || 0) + 1)));

export default function Conquest() {
  const { lang } = useLanguage();
  const de = lang === 'de';
  const queryClient = useQueryClient();
  const [icao, setIcao] = useState('EDDF');
  const [icaoInput, setIcaoInput] = useState('EDDF');
  const [result, setResult] = useState(null);

  const { data: overview, isLoading } = useQuery({
    queryKey: ['conquestOverview', icao],
    queryFn: async () => (await base44.functions.invoke('gateConquest', { action: 'overview', icao })).data,
    enabled: icao.length >= 3,
  });

  const { data: challengesData } = useQuery({
    queryKey: ['conquestChallenges'],
    queryFn: async () => (await base44.functions.invoke('gateConquest', { action: 'myChallenges' })).data,
    refetchInterval: 60000,
  });

  const { data: myGatesData } = useQuery({
    queryKey: ['myGates'],
    queryFn: async () => (await base44.functions.invoke('gateMarket', { action: 'myGates' })).data,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['conquestOverview'] });
    queryClient.invalidateQueries({ queryKey: ['conquestChallenges'] });
    queryClient.invalidateQueries({ queryKey: ['myGates'] });
    queryClient.invalidateQueries({ queryKey: ['gateCatalog'] });
  };

  const attackMutation = useMutation({
    mutationFn: async (gate) =>
      (await base44.functions.invoke('gateConquest', { action: 'attack', icao, gateCode: gate.gate_code })).data,
    onSuccess: (data) => { setResult(data?.error ? { error: data.error } : data); refresh(); },
    onError: (error) => setResult({ error: error?.response?.data?.error || error.message }),
  });

  const fortifyMutation = useMutation({
    mutationFn: async (gate) =>
      (await base44.functions.invoke('gateConquest', { action: 'fortify', recordId: gate.id })).data,
    onSuccess: (data) => { setResult(data?.error ? { error: data.error } : null); refresh(); },
    onError: (error) => setResult({ error: error?.response?.data?.error || error.message }),
  });

  const gates = overview?.gates || [];
  const myPower = overview?.my_power || 0;
  const aiTargets = useMemo(() => gates.filter((g) => g.conquest?.type === 'ai'), [gates]);
  const playerTargets = useMemo(() => gates.filter((g) => g.conquest?.type === 'player'), [gates]);
  const challenges = challengesData?.challenges || [];
  const myCompanyId = challengesData?.company_id;
  const myGates = myGatesData?.gates || [];
  const busy = attackMutation.isPending || fortifyMutation.isPending;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Card className="border-rose-900/40 bg-slate-950/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-rose-400" />
            <h1 className="text-lg font-bold font-mono uppercase tracking-widest text-rose-200">
              {de ? 'Gate-Eroberung' : 'Gate Conquest'}
            </h1>
          </div>
          <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 font-mono text-[10px]">
            {de ? 'Deine Kampfstärke' : 'Your battle power'}: {myPower}
          </Badge>
        </div>
        <p className="text-xs text-slate-400 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-rose-500" />
          {de
            ? 'Erobere Gates von KI-Airlines (Sofort-Kampf, Stärke aus Level, Reputation und deinen letzten Flug-Wertungen) oder fordere andere Spieler zum 24h-Duell heraus: Wer im Zeitfenster die beste Flug-Wertung erzielt, gewinnt das Gate. Verlierst du gegen die KI, gilt 24h Abklingzeit. Baue deine eigenen Gates zu Festungen aus, um sie zu verteidigen.'
            : 'Conquer gates from AI airlines (instant battle, power from level, reputation and your recent flight scores) or challenge other players to a 24h duel: whoever flies the best-rated flight in the window wins the gate. Losing against AI triggers a 24h cooldown. Fortify your own gates to defend them.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <Input value={icaoInput} onChange={(e) => setIcaoInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && setIcao(icaoInput.trim())} placeholder="ICAO"
              className="h-8 w-24 font-mono bg-slate-950 border-rose-900/50 text-rose-100" />
            <Button size="sm" className="h-8 bg-rose-900/60 border border-rose-700 text-rose-200 hover:bg-rose-800"
              onClick={() => setIcao(icaoInput.trim())}>
              <Search className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {HUBS.map((hub) => (
              <button key={hub} onClick={() => { setIcao(hub); setIcaoInput(hub); }}
                className={`px-2 py-1 rounded text-[10px] font-mono border ${icao === hub ? 'border-rose-500 text-rose-200 bg-rose-950/60' : 'border-slate-700 text-slate-400 hover:border-rose-700'}`}>
                {hub}
              </button>
            ))}
          </div>
        </div>
        {result?.error && (
          <p className="text-xs font-mono text-rose-300 border border-rose-800/50 bg-rose-950/40 rounded px-2 py-1.5">{result.error}</p>
        )}
        {result && !result.error && result.mode === 'pve' && (
          <p className={`text-xs font-mono rounded px-2 py-1.5 border ${result.won ? 'text-emerald-300 border-emerald-800/50 bg-emerald-950/40' : 'text-amber-300 border-amber-800/50 bg-amber-950/40'}`}>
            {result.won
              ? (de ? `Eroberung erfolgreich! Angriff ${result.attack} vs. Verteidigung ${result.defense} gegen ${result.ai_name}. +${result.xp} XP` : `Conquest successful! Attack ${result.attack} vs. defense ${result.defense} against ${result.ai_name}. +${result.xp} XP`)
              : (de ? `Angriff abgewehrt: ${result.attack} vs. ${result.defense}. ${result.ai_name} hält die Position – 24h Abklingzeit.` : `Attack repelled: ${result.attack} vs. ${result.defense}. ${result.ai_name} holds the position – 24h cooldown.`)}
          </p>
        )}
        {result && !result.error && result.mode === 'pvp' && (
          <p className="text-xs font-mono text-cyan-300 border border-cyan-800/50 bg-cyan-950/40 rounded px-2 py-1.5">
            {de
              ? `Duell gestartet! Einsatz ${fmt(result.stake)}. Entscheidung in 24h – fliege jetzt deine beste Wertung!`
              : `Duel started! Stake ${fmt(result.stake)}. Decision in 24h – fly your best-rated flight now!`}
          </p>
        )}
      </Card>

      {challenges.length > 0 && (
        <Card className="border-amber-900/40 bg-slate-950/70 p-4">
          <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-amber-300 mb-2 flex items-center gap-2">
            <Swords className="w-4 h-4" />{de ? 'Meine Kämpfe & Duelle' : 'My battles & duels'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {challenges.slice(0, 12).map((ch) => (
              <ConquestChallengeCard key={ch.id} challenge={ch} myCompanyId={myCompanyId} de={de} />
            ))}
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-rose-900 border-t-rose-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <Card className="border-purple-900/40 bg-slate-950/70 p-4">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-purple-300 mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4" />{icao} · {de ? 'KI-kontrollierte Positionen' : 'AI-controlled positions'} ({aiTargets.length})
            </h2>
            {aiTargets.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">{de ? 'Keine KI-Positionen an diesem Flughafen.' : 'No AI positions at this airport.'}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {aiTargets.map((gate) => (
                  <ConquestTargetCard key={gate.gate_code} gate={gate} de={de} busy={busy} myPower={myPower}
                    onAttack={(g) => { setResult(null); attackMutation.mutate(g); }} />
                ))}
              </div>
            )}
          </Card>

          <Card className="border-rose-900/40 bg-slate-950/70 p-4">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-rose-300 mb-3 flex items-center gap-2">
              <Swords className="w-4 h-4" />{icao} · {de ? 'Spieler-Positionen (24h-Duell)' : 'Player positions (24h duel)'} ({playerTargets.length})
            </h2>
            {playerTargets.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">{de ? 'Keine gegnerischen Spieler-Positionen an diesem Flughafen.' : 'No rival player positions at this airport.'}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {playerTargets.map((gate) => (
                  <ConquestTargetCard key={gate.gate_code} gate={gate} de={de} busy={busy} myPower={myPower}
                    onAttack={(g) => { setResult(null); attackMutation.mutate(g); }} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {myGates.length > 0 && (
        <Card className="border-emerald-900/40 bg-slate-950/70 p-4">
          <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-emerald-300 mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" />{de ? 'Meine Verteidigung' : 'My defense'}
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mb-2">
            {de ? 'Jede Festungsstufe gibt +6 Verteidigungsbonus im Duell (max. Stufe 5).' : 'Each fortress level grants +6 defense bonus in duels (max level 5).'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {myGates.map((g) => (
              <div key={g.id} className="rounded-lg border border-emerald-900/40 bg-slate-900/70 p-2.5 flex items-center justify-between gap-2 font-mono">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-100">{g.airport_icao} {g.gate_code}</p>
                  <p className="text-[10px] text-slate-500">{de ? 'Festung' : 'Fortress'} {Number(g.defense_level || 0)}/5</p>
                </div>
                <Button size="sm" disabled={busy || Number(g.defense_level || 0) >= 5}
                  onClick={() => { setResult(null); fortifyMutation.mutate(g); }}
                  className="h-7 text-[10px] font-mono bg-emerald-900/60 border border-emerald-700 text-emerald-200 hover:bg-emerald-800 disabled:opacity-50">
                  {Number(g.defense_level || 0) >= 5 ? (de ? 'Max' : 'Max') : `${de ? 'Ausbauen' : 'Fortify'} ${fmt(fortifyCost(g))}`}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}