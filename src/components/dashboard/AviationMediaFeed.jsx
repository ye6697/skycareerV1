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
import {
  pickVariant,
  FLIGHT_VARIANTS,
  PURCHASE_VARIANTS,
  SALE_VARIANTS,
  LOAN_VARIANTS,
  LOAN_PAID_VARIANTS,
  NEWS_VARIANTS,
  PAX_VARIANTS,
  ATC_VARIANTS,
  INVESTOR_VARIANTS,
  LEDGER_VARIANTS,
} from '@/components/dashboard/mediaFeedVariants';

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
  const airlineName = compactText(company?.name || company?.company_name || company?.airline_name, lang === 'de' ? 'die Airline' : 'the airline');
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

  // Seed base rotates daily so the same events get retold from different angles.
  const dayKey = new Date().toISOString().slice(0, 10);
  const seedBase = `${company?.id || 'c'}|${dayKey}`;

  if (latestFlight) {
    const dep = latestFlight?.departure_airport || latestFlight?.xplane_data?.contract_departure_airport || 'DEP';
    const arr = latestFlight?.arrival_airport || latestFlight?.xplane_data?.contract_arrival_airport || 'ARR';
    const route = compactText(`${dep}-${arr}`);
    const score = Math.round(toNumber(latestFlight?.overall_rating ?? latestFlight?.flight_score, avgRating));
    const landingVs = Math.abs(toNumber(latestFlight?.landing_vs ?? latestFlight?.xplane_data?.landing_vs ?? latestFlight?.xplane_data?.touchdown_vspeed, 0));
    const landingLine = landingVs > 0
      ? (lang === 'de' ? `Die Landing V/S wurde mit -${Math.round(landingVs)} fpm gemeldet.` : `Landing V/S came in at -${Math.round(landingVs)} fpm.`)
      : '';
    const variant = pickVariant(`${seedBase}|flight|${latestFlight?.id || route}`, FLIGHT_VARIANTS)({ lang, airlineName, route, score, landingLine });
    posts.push({
      ...variant,
      icon: PlaneTakeoff,
      tone: score >= 85 ? 'positive' : score < 65 ? 'negative' : 'neutral',
      sharedAt: getFlightDate(latestFlight) || offsetMinutes(anchorDate, 18),
      reputationImpact: clamp(Math.round((score - 75) / 4), -8, 8),
    });
  }

  if (aircraftPurchase) {
    const variant = pickVariant(`${seedBase}|purchase|${aircraftPurchase?.id || ''}`, PURCHASE_VARIANTS)({
      lang, airlineName,
      amount: formatMoney(aircraftPurchase.amount, lang),
      detail: compactText(aircraftPurchase.description, lang === 'de' ? 'Neue Kapazität kommt in die Flotte.' : 'New capacity is entering the fleet.'),
    });
    posts.push({
      ...variant,
      icon: ShoppingCart,
      tone: 'positive',
      sharedAt: getTransactionDate(aircraftPurchase) || offsetMinutes(anchorDate, 38),
      reputationImpact: 3,
    });
  }

  if (aircraftSale) {
    const variant = pickVariant(`${seedBase}|sale|${aircraftSale?.id || ''}`, SALE_VARIANTS)({
      lang, airlineName,
      amount: formatMoney(aircraftSale.amount, lang),
      detail: compactText(aircraftSale.description, lang === 'de' ? 'Analysten achten darauf, ob die verbleibende Flotte die Aufträge abdecken kann.' : 'Analysts watch whether the remaining fleet can cover the schedule.'),
    });
    posts.push({
      ...variant,
      icon: HandCoins,
      tone: 'neutral',
      sharedAt: getTransactionDate(aircraftSale) || offsetMinutes(anchorDate, 54),
      reputationImpact: 0,
    });
  }

  if (loanTaken || company?.active_loan) {
    const loanAmount = loanTaken?.amount || company?.active_loan?.amount || company?.active_loan?.remaining || 0;
    const loanLine = loanTaken
      ? (lang === 'de' ? `Ein neuer Bankkredit über ${formatMoney(loanAmount, lang)} gibt Spielraum.` : `A new bank loan of ${formatMoney(loanAmount, lang)} creates breathing room.`)
      : (lang === 'de' ? `Die aktive Restschuld liegt bei ${formatMoney(company?.active_loan?.remaining, lang)}.` : `Active remaining debt sits at ${formatMoney(company?.active_loan?.remaining, lang)}.`);
    const variant = pickVariant(`${seedBase}|loan|${loanTaken?.id || 'active'}`, LOAN_VARIANTS)({ lang, airlineName, loanLine });
    posts.push({
      ...variant,
      icon: Banknote,
      tone: company?.active_loan ? 'neutral' : 'positive',
      sharedAt: getTransactionDate(loanTaken) || offsetMinutes(anchorDate, 71),
      reputationImpact: company?.active_loan ? -1 : 2,
    });
  }

  if (loanPaid) {
    const variant = pickVariant(`${seedBase}|loanpaid|${loanPaid?.id || ''}`, LOAN_PAID_VARIANTS)({ lang, airlineName });
    posts.push({
      ...variant,
      icon: BadgeCheck,
      tone: 'positive',
      sharedAt: getTransactionDate(loanPaid) || offsetMinutes(anchorDate, 86),
      reputationImpact: 5,
    });
  }

  const hasTopFlight = completedFlights.some((f) => toNumber(f?.overall_rating) >= 88);
  const newsCtx = {
    lang, airlineName, reputation: Math.round(reputation),
    hasTopFlight,
    hasIssues: withIssues.length > 0,
    openContracts: acceptedContracts?.length || 0,
    flightCount: completedFlights.length,
  };

  posts.push(
    {
      ...pickVariant(`${seedBase}|news`, NEWS_VARIANTS)(newsCtx),
      icon: Newspaper,
      tone: reputation >= 70 ? 'positive' : reputation <= 40 ? 'negative' : 'neutral',
      sharedAt: offsetMinutes(anchorDate, 96),
      reputationImpact: repImpact,
    },
    {
      ...pickVariant(`${seedBase}|pax`, PAX_VARIANTS)(newsCtx),
      icon: Users,
      tone: avgRating >= 85 ? 'positive' : avgRating <= 65 ? 'negative' : 'neutral',
      sharedAt: offsetMinutes(anchorDate, 112),
      reputationImpact: clamp(Math.round((avgRating - 75) / 4), -8, 8),
    },
    {
      ...pickVariant(`${seedBase}|atc`, ATC_VARIANTS)(newsCtx),
      icon: TriangleAlert,
      tone: withIssues.length > 0 ? 'negative' : 'positive',
      sharedAt: offsetMinutes(anchorDate, 128),
      reputationImpact: withIssues.length > 0 ? -Math.min(12, withIssues.length * 3) : 4,
    },
    {
      ...pickVariant(`${seedBase}|investor`, INVESTOR_VARIANTS)(newsCtx),
      icon: TrendingUp,
      tone: reputation >= 65 && withIssues.length === 0 ? 'positive' : 'neutral',
      sharedAt: offsetMinutes(anchorDate, 144),
      reputationImpact: clamp(Math.round((acceptedContracts?.length || 0) - withIssues.length * 2), -8, 8),
    },
  );

  if (recentTransactions.length > 0) {
    const latestTx = recentTransactions[0];
    const variant = pickVariant(`${seedBase}|ledger|${latestTx?.id || ''}`, LEDGER_VARIANTS)({
      lang, airlineName,
      detail: compactText(latestTx.description, lang === 'de' ? 'Neue Transaktion' : 'New transaction'),
      amount: formatMoney(latestTx.amount, lang),
      sign: latestTx.type === 'income' ? '+' : '-',
      isIncome: latestTx.type === 'income',
    });
    posts.push({
      ...variant,
      icon: ReceiptText,
      tone: latestTx.type === 'income' ? 'positive' : 'neutral',
      sharedAt: getTransactionDate(latestTx) || offsetMinutes(anchorDate, 160),
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
            {lang === 'de' ? 'Kleine Reporter-Stories aus Fluegen, Flotte und Finanzen.' : 'Short reporter stories from your flights, fleet, and finances.'}
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