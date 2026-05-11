import React, { useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  TrendingUp,
  TriangleAlert,
  Plane,
  Clock3,
  Users,
  Newspaper,
  BadgeCheck,
  PlaneTakeoff,
  Banknote,
  ShoppingCart,
  HandCoins,
  ReceiptText,
} from 'lucide-react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const getFlightDate = (flight) => parseDate(flight?.completed_at || flight?.arrival_time || flight?.updated_date || flight?.created_date);
const getTransactionDate = (transaction) => parseDate(transaction?.date || transaction?.created_date || transaction?.updated_date);

const getAnchorDate = (flights, transactions) => {
  const firstFlightDate = (flights || []).map(getFlightDate).find(Boolean);
  const firstTransactionDate = (transactions || []).map(getTransactionDate).find(Boolean);
  return firstFlightDate || firstTransactionDate || new Date();
};

const offsetMinutes = (date, minutes) => new Date(date.getTime() - minutes * 60 * 1000);

const formatSharedAt = (date, lang) =>
  new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

const formatMoney = (amount, lang) => {
  const n = Math.abs(toNumber(amount, 0));
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US')}`;
};

const compactText = (value, fallback = '') => String(value || fallback).replace(/\s+/g, ' ').trim();

const getMood = (impact, lang) => {
  if (impact > 2) return lang === 'de' ? 'Stimmung steigt' : 'Mood improving';
  if (impact < -2) return lang === 'de' ? 'Unter Beobachtung' : 'Under review';
  return lang === 'de' ? 'Abwartend' : 'Measured';
};

function createPosts(company, flights, acceptedContracts, transactions, lang) {
  const reputation = toNumber(company?.reputation, 50);
  const repImpact = clamp(Math.round((reputation - 50) / 5), -10, 10);
  const completedFlights = [...(flights || [])].sort((a, b) => (getFlightDate(b)?.getTime() || 0) - (getFlightDate(a)?.getTime() || 0));
  const recentTransactions = [...(transactions || [])].sort((a, b) => (getTransactionDate(b)?.getTime() || 0) - (getTransactionDate(a)?.getTime() || 0));
  const withIssues = completedFlights.filter(
    (f) => toNumber(f?.landing_g_force ?? f?.xplane_data?.landing_g_force) >= 1.6 || (Array.isArray(f?.active_failures) && f.active_failures.length > 0),
  );
  const avgRating = completedFlights.length
    ? completedFlights.reduce((sum, f) => sum + toNumber(f?.overall_rating ?? f?.flight_score, 72), 0) / completedFlights.length
    : 75;
  const anchorDate = getAnchorDate(completedFlights, recentTransactions);
  const latestFlight = completedFlights[0];
  const aircraftPurchase = recentTransactions.find((tx) => tx?.category === 'aircraft_purchase' || /flugzeugkauf|aircraft purchase/i.test(tx?.description || ''));
  const aircraftSale = recentTransactions.find((tx) => tx?.category === 'aircraft_sale' || /verkauf|verschrottung|aircraft sold|aircraft sale/i.test(tx?.description || ''));
  const loanTaken = recentTransactions.find((tx) => /bankkredit aufgenommen|loan taken|kredit aufgenommen/i.test(tx?.description || ''));
  const loanPaid = recentTransactions.find((tx) => /vollst(?:a|\u00e4|ae)ndig getilgt|fully paid|paid off|kreditr/i.test(tx?.description || ''));
  const posts = [];

  if (latestFlight) {
    const dep = latestFlight?.departure_airport || latestFlight?.xplane_data?.contract_departure_airport || 'DEP';
    const arr = latestFlight?.arrival_airport || latestFlight?.xplane_data?.contract_arrival_airport || 'ARR';
    const route = compactText(`${dep}-${arr}`);
    const score = Math.round(toNumber(latestFlight?.overall_rating ?? latestFlight?.flight_score, avgRating));
    const landingVs = Math.abs(toNumber(latestFlight?.landing_vs ?? latestFlight?.xplane_data?.landing_vs ?? latestFlight?.xplane_data?.touchdown_vspeed, 0));
    posts.push({
      source: 'Ops Wire',
      handle: '@opswire',
      icon: PlaneTakeoff,
      tone: score >= 85 ? 'positive' : score < 65 ? 'negative' : 'neutral',
      sharedAt: getFlightDate(latestFlight) || offsetMinutes(anchorDate, 18),
      headline: lang === 'de' ? `Flug ${route} abgeschlossen: Score ${score}` : `Flight ${route} completed: score ${score}`,
      description: lang === 'de'
        ? `Der neueste Umlauf praegt die aktuelle Wahrnehmung: ${score >= 85 ? 'sauber abgeflogen, stabiler Service und ein gutes Signal fuer die Marke' : score < 65 ? 'sichtbare operative Nacharbeit noetig, besonders bei Ablauf und Anflug' : 'solide Leistung mit Raum fuer Feinschliff'}.${landingVs > 0 ? ` Gemeldete Landing V/S: -${Math.round(landingVs)} fpm.` : ''}`
        : `The latest rotation is shaping the current readout: ${score >= 85 ? 'cleanly flown, stable service, and a useful brand signal' : score < 65 ? 'visible operational follow-up needed, especially around flow and approach' : 'solid execution with room for polish'}.${landingVs > 0 ? ` Reported landing V/S: -${Math.round(landingVs)} fpm.` : ''}`,
      reputationImpact: clamp(Math.round((score - 75) / 4), -8, 8),
    });
  }

  if (aircraftPurchase) {
    posts.push({
      source: 'Fleet Desk',
      handle: '@fleetdesk',
      icon: ShoppingCart,
      tone: 'positive',
      sharedAt: getTransactionDate(aircraftPurchase) || offsetMinutes(anchorDate, 38),
      headline: lang === 'de' ? 'Flottenausbau registriert' : 'Fleet expansion registered',
      description: lang === 'de'
        ? `Der Markt hat einen Flugzeugkauf ueber ${formatMoney(aircraftPurchase.amount, lang)} registriert. ${compactText(aircraftPurchase.description, 'Neue Kapazitaet kommt in die Flotte.')}`
        : `The market registered an aircraft purchase worth ${formatMoney(aircraftPurchase.amount, lang)}. ${compactText(aircraftPurchase.description, 'New capacity is entering the fleet.')}`,
      reputationImpact: 3,
    });
  }

  if (aircraftSale) {
    posts.push({
      source: 'Fleet Desk',
      handle: '@fleetdesk',
      icon: HandCoins,
      tone: 'neutral',
      sharedAt: getTransactionDate(aircraftSale) || offsetMinutes(anchorDate, 54),
      headline: lang === 'de' ? 'Flottenverkauf veraendert Kapazitaet' : 'Aircraft sale reshapes capacity',
      description: lang === 'de'
        ? `Ein Verkauf oder Abgang brachte ${formatMoney(aircraftSale.amount, lang)} Liquiditaet. ${compactText(aircraftSale.description, 'Analysten achten nun darauf, ob die verbleibende Flotte die Auftraege abdecken kann.')}`
        : `A sale or retirement added ${formatMoney(aircraftSale.amount, lang)} in liquidity. ${compactText(aircraftSale.description, 'Analysts are watching whether the remaining fleet can cover the schedule.')}`,
      reputationImpact: 0,
    });
  }

  if (loanTaken || company?.active_loan) {
    const loanAmount = loanTaken?.amount || company?.active_loan?.amount || company?.active_loan?.remaining || 0;
    posts.push({
      source: 'Banking Monitor',
      handle: '@banking.monitor',
      icon: Banknote,
      tone: company?.active_loan ? 'neutral' : 'positive',
      sharedAt: getTransactionDate(loanTaken) || offsetMinutes(anchorDate, 71),
      headline: lang === 'de' ? 'Kreditlinie im Fokus' : 'Credit line in focus',
      description: lang === 'de'
        ? `${loanTaken ? `Neuer Bankkredit ueber ${formatMoney(loanAmount, lang)} aufgenommen.` : `Aktive Restschuld: ${formatMoney(company?.active_loan?.remaining, lang)}.`} Investoren achten darauf, ob die Rueckzahlung mit den naechsten Fluegen sauber bedient wird.`
        : `${loanTaken ? `New bank loan of ${formatMoney(loanAmount, lang)} taken.` : `Active remaining debt: ${formatMoney(company?.active_loan?.remaining, lang)}.`} Investors are watching whether upcoming flights service the repayment cleanly.`,
      reputationImpact: company?.active_loan ? -1 : 2,
    });
  }

  if (loanPaid) {
    posts.push({
      source: 'Banking Monitor',
      handle: '@banking.monitor',
      icon: BadgeCheck,
      tone: 'positive',
      sharedAt: getTransactionDate(loanPaid) || offsetMinutes(anchorDate, 86),
      headline: lang === 'de' ? 'Kredit vollstaendig abbezahlt' : 'Loan fully paid off',
      description: lang === 'de'
        ? `Die letzte Rate wurde verbucht. ${compactText(loanPaid.description, 'Die Bilanz wirkt dadurch belastbarer und die naechste Finanzierung duerfte leichter verhandelbar sein.')}`
        : `The final installment has been booked. ${compactText(loanPaid.description, 'The balance sheet now looks stronger and future financing should be easier to negotiate.')}`,
      reputationImpact: 5,
    });
  }

  posts.push(
    {
      source: 'SkyNews Aviation',
      handle: '@skynews.av',
      icon: Newspaper,
      tone: reputation >= 70 ? 'positive' : reputation <= 40 ? 'negative' : 'neutral',
      sharedAt: offsetMinutes(anchorDate, 96),
      headline: reputation >= 70
        ? (lang === 'de' ? 'Luftfahrtredaktion sieht Vertrauen im SkyCareer-Netz' : 'Aviation desk sees trust across the SkyCareer network')
        : reputation <= 40
          ? (lang === 'de' ? 'Abendbericht: Marke steht nach unruhigen Umlaeufen unter Druck' : 'Evening report: brand faces pressure after unsettled rotations')
          : (lang === 'de' ? 'Korrespondenten melden gemischte Reaktionen auf Regionalstrecken' : 'Correspondents report mixed reactions across regional routes'),
      description: lang === 'de'
        ? 'Die Redaktion bewertet aktuell Flugbetrieb, Flottenentscheidungen und Finanzdisziplin zusammen. Einzelne Kennzahlen zaehlen weniger als die Frage, ob die Airline nach jedem Ereignis kontrolliert weiterarbeitet.'
        : 'The desk is reading flight operations, fleet decisions, and financial discipline together. Individual metrics matter less than whether the airline keeps moving in a controlled way after each event.',
      reputationImpact: repImpact,
    },
    {
      source: 'PaxPulse',
      handle: '@paxpulse',
      icon: Users,
      tone: avgRating >= 85 ? 'positive' : avgRating <= 65 ? 'negative' : 'neutral',
      sharedAt: offsetMinutes(anchorDate, 112),
      headline: lang === 'de' ? 'Passagierreporter fassen die Stimmung an Bord zusammen' : 'Passenger reporters summarize the mood on board',
      description: completedFlights.some((f) => toNumber(f?.overall_rating) >= 88)
        ? (lang === 'de'
            ? 'Vielflieger loben die ruhige Kabinenroutine und das Gefuehl, dass die Crews den Ablauf im Griff haben.'
            : 'Frequent flyers are praising the calm cabin rhythm and the sense that crews have the operation in hand.')
        : (lang === 'de'
            ? 'Die Stimmen aus den Terminals bleiben vorsichtig. Boarding, Ansagen und die letzten Minuten vor der Ankunft entscheiden ueber den professionellen Eindruck.'
            : 'Terminal voices remain cautious. Boarding flow, announcements, and the final minutes before arrival are deciding whether the flight feels professionally handled.'),
      reputationImpact: clamp(Math.round((avgRating - 75) / 4), -8, 8),
    },
    {
      source: 'ATC Watch',
      handle: '@atc.watch',
      icon: TriangleAlert,
      tone: withIssues.length > 0 ? 'negative' : 'positive',
      sharedAt: offsetMinutes(anchorDate, 128),
      headline: withIssues.length > 0
        ? (lang === 'de' ? 'Operationsdesk fordert Nacharbeit nach auffaelligen Fluegen' : 'Operations desk calls for follow-up after irregular flights')
        : (lang === 'de' ? 'Ops-Bulletin: Betriebslage bleibt ruhig' : 'Ops bulletin: operating picture stays calm'),
      description: withIssues.length > 0
        ? (lang === 'de'
            ? 'Nach haerteren Anfluegen oder technischen Auffaelligkeiten geht der Blick auf die Reaktion der Airline.'
            : 'After harder approaches or technical irregularities, attention is moving to the airline response.')
        : (lang === 'de'
            ? 'Die juengsten Umlaeufe liefern keinen Stoff fuer Alarmmeldungen. Das gilt als leises Signal fuer stabile Standards.'
            : 'The latest rotations are giving monitors little to sound alarms about. That is being read as a quiet signal of stable standards.'),
      reputationImpact: withIssues.length > 0 ? -Math.min(12, withIssues.length * 3) : 4,
    },
    {
      source: 'Investor Radar',
      handle: '@investorradar',
      icon: TrendingUp,
      tone: reputation >= 65 && withIssues.length === 0 ? 'positive' : 'neutral',
      sharedAt: offsetMinutes(anchorDate, 144),
      headline: lang === 'de' ? 'Wirtschaftsdesk schaut auf Auftragsbuch und Kapital' : 'Business desk watches order book and capital',
      description: (acceptedContracts?.length || 0) > 0
        ? (lang === 'de'
            ? 'Offene Auftraege sind Chance und Belastungstest zugleich. Der Markt reagiert darauf, ob Zusagen sauber abgeflogen und finanziert werden.'
            : 'Open contracts are both opportunity and stress test. The market is reacting to whether commitments are flown and financed cleanly.')
        : (lang === 'de'
            ? 'Ohne grossen Auftragsdruck liegt der Fokus auf Konsolidierung, Liquiditaet und zuverlaessigen Fluegen.'
            : 'With no heavy contract pressure, the focus shifts to consolidation, liquidity, and reliable flights.'),
      reputationImpact: clamp(Math.round((acceptedContracts?.length || 0) - withIssues.length * 2), -8, 8),
    },
  );

  if (recentTransactions.length > 0) {
    const latestTx = recentTransactions[0];
    posts.push({
      source: 'Ledger Brief',
      handle: '@ledger.brief',
      icon: ReceiptText,
      tone: latestTx.type === 'income' ? 'positive' : 'neutral',
      sharedAt: getTransactionDate(latestTx) || offsetMinutes(anchorDate, 160),
      headline: lang === 'de' ? 'Letzte Buchung veraendert die Liquiditaet' : 'Latest booking moves liquidity',
      description: lang === 'de'
        ? `${compactText(latestTx.description, 'Neue Transaktion')} (${latestTx.type === 'income' ? '+' : '-'}${formatMoney(latestTx.amount, lang)}). Der Finanzfeed bewertet solche Bewegungen zusammen mit Flugbetrieb und Flottenstrategie.`
        : `${compactText(latestTx.description, 'New transaction')} (${latestTx.type === 'income' ? '+' : '-'}${formatMoney(latestTx.amount, lang)}). The finance feed reads these movements alongside flight operations and fleet strategy.`,
      reputationImpact: latestTx.type === 'income' ? 1 : 0,
    });
  }

  return posts
    .sort((a, b) => b.sharedAt.getTime() - a.sharedAt.getTime())
    .slice(0, 7);
}

const toneStyles = {
  positive: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  negative: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  neutral: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
};

export default function AviationMediaFeed({ company, recentFlights, acceptedContracts, transactions, lang = 'en' }) {
  const [selectedPost, setSelectedPost] = useState(null);
  const posts = useMemo(
    () => createPosts(company, recentFlights || [], acceptedContracts, transactions || [], lang),
    [company, recentFlights, acceptedContracts, transactions, lang],
  );

  return (
    <Card className="border-cyan-900/40 bg-slate-950/70 p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-cyan-900/30 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-200">
            {lang === 'de' ? 'Airline Media Feed' : 'Airline Media Feed'}
          </h3>
          <p className="text-xs text-slate-400">
            {lang === 'de' ? 'Reporterberichte aus deinen Fluegen, Flotten- und Finanzereignissen.' : 'Reporter-style coverage from your flights, fleet, and finance events.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-700 text-cyan-300"><Clock3 className="w-3 h-3 mr-1" /> Live</Badge>
        </div>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="p-3 space-y-3">
          {posts.map((post, idx) => {
            const Icon = post.icon || Plane;
            return (
              <article key={`${post.source}-${idx}`} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <button type="button" onClick={() => setSelectedPost(post)} className="rounded-full">
                    <Avatar className="h-9 w-9 border border-cyan-900/50 hover:border-cyan-500">
                      <AvatarFallback className="bg-slate-800 text-cyan-200 text-xs font-bold">
                        {post.source.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-100 font-semibold leading-none">{post.source}</p>
                    <p className="text-xs text-slate-400">
                      {post.handle} - {lang === 'de' ? 'geteilt' : 'shared'} {formatSharedAt(post.sharedAt, lang)}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Badge className="border-indigo-500/40 bg-indigo-500/10 text-indigo-200">
                      <BadgeCheck className="w-3 h-3 mr-1" />
                      REP {post.reputationImpact > 0 ? '+' : ''}{post.reputationImpact}
                    </Badge>
                    <Badge className={`${toneStyles[post.tone]}`}>{getMood(post.reputationImpact, lang)}</Badge>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center gap-2 mb-2 text-cyan-300">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider">
                      {lang === 'de' ? 'Reporterbericht' : 'Reporter bulletin'}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100 mb-1">{post.headline}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{post.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </ScrollArea>
      <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="bg-slate-900 border-cyan-900/60 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PlaneTakeoff className="w-4 h-4 text-cyan-300" />{selectedPost?.source}</DialogTitle>
            <DialogDescription className="text-slate-400">{selectedPost?.handle}</DialogDescription>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-3 text-sm">
              <p className="text-slate-200 font-semibold">{selectedPost.headline}</p>
              <p className="text-slate-300">{selectedPost.description}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-slate-700 p-2"><span className="text-slate-400 text-xs">REP</span><p className="text-cyan-300 font-mono">{selectedPost.reputationImpact > 0 ? '+' : ''}{selectedPost.reputationImpact}</p></div>
                <div className="rounded border border-slate-700 p-2"><span className="text-slate-400 text-xs">KPIs</span><p className="text-cyan-300 font-mono">{(recentFlights || []).length} flights - {acceptedContracts?.length || 0} contracts</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
