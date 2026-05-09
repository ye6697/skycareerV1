import React, { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Heart, MessageCircle, Repeat2, TrendingUp, TriangleAlert, Plane, Clock3, Users, Newspaper } from 'lucide-react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatDelta = (value) => {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}`;
};

function createPosts(company, flights, acceptedContracts) {
  const reputation = toNumber(company?.reputation, 50);
  const repImpact = clamp(Math.round((reputation - 50) / 5), -10, 10);
  const completedFlights = flights || [];
  const withIssues = completedFlights.filter(
    (f) => toNumber(f?.landing_vs) < -550 || (Array.isArray(f?.active_failures) && f.active_failures.length > 0),
  );
  const serviceLeaders = completedFlights.filter((f) => toNumber(f?.overall_rating) >= 88);
  const avgRating = completedFlights.length
    ? completedFlights.reduce((sum, f) => sum + toNumber(f?.overall_rating, 72), 0) / completedFlights.length
    : 75;

  const posts = [
    {
      source: 'SkyNews Aviation',
      handle: '@skynews.av',
      icon: Newspaper,
      tone: reputation >= 70 ? 'positive' : reputation <= 40 ? 'negative' : 'neutral',
      headline:
        reputation >= 70
          ? 'Network desk: carrier reports steady recovery with fewer disruption events.'
          : reputation <= 40
            ? 'Evening bulletin: reliability concerns pressure the brand in key markets.'
            : 'Correspondents report mixed passenger feedback across regional routes.',
      description: `Reputation index now at ${Math.round(reputation)} after stricter on-time reporting and disruption tracking across the last operating week. Reputational momentum is currently tied to recovery speed after delays and incident transparency.`,
      reputationImpact: repImpact,
      metrics: {
        likes: 1800 + Math.round(reputation * 21),
        comments: 250 + completedFlights.length * 24,
        reposts: 90 + Math.round(reputation * 4),
      },
    },
    {
      source: 'PaxPulse',
      handle: '@paxpulse',
      icon: Users,
      tone: avgRating >= 85 ? 'positive' : avgRating <= 65 ? 'negative' : 'neutral',
      headline: 'Airport correspondents summarize passenger sentiment',
      description: `Average onboard rating is ${Math.round(avgRating)}%, with frequent flyers highlighting cabin consistency, boarding flow, and crew communication. ${serviceLeaders.length} recent flights were explicitly praised in premium-traveler summaries.`,
      reputationImpact: clamp(Math.round((avgRating - 75) / 4), -8, 8),
      metrics: {
        likes: 900 + serviceLeaders.length * 250,
        comments: 120 + Math.round(avgRating * 2),
        reposts: 60 + serviceLeaders.length * 35,
      },
    },
    {
      source: 'ATC Watch',
      handle: '@atc.watch',
      icon: TriangleAlert,
      tone: withIssues.length > 0 ? 'negative' : 'positive',
      headline: withIssues.length > 0 ? 'Operations desk confirms incident review after irregular flights' : 'Ops bulletin: no critical incidents in latest operating cycle',
      description:
        withIssues.length > 0
          ? `${withIssues.length} recent flight(s) triggered attention due to hard touchdowns, emergency handling, or technical irregularities. Industry watchdog threads are now demanding stronger SOP disclosure and corrective action updates.`
          : 'No diversions, emergency declarations, or severe handling alerts were logged in the latest operations cycle. Reliability discourse remains constructive and confidence is stabilizing.',
      reputationImpact: withIssues.length > 0 ? -Math.min(12, withIssues.length * 3) : 4,
      metrics: {
        likes: 1100 + withIssues.length * 80,
        comments: 70 + withIssues.length * 180,
        reposts: 45 + withIssues.length * 95,
      },
    },
    {
      source: 'Investor Radar',
      handle: '@investorradar',
      icon: TrendingUp,
      tone: reputation >= 65 && withIssues.length === 0 ? 'positive' : 'neutral',
      headline: 'Business desk: investor confidence monitor',
      description: `Confidence score ${clamp(Math.round(reputation * 0.9 + (acceptedContracts?.length || 0) * 3 - withIssues.length * 8), 5, 99)} / 100, driven by ${(acceptedContracts?.length || 0)} active contract commitments and execution discipline across recent sectors.`,
      reputationImpact: clamp(Math.round((acceptedContracts?.length || 0) - withIssues.length * 2), -8, 8),
      metrics: {
        likes: 740 + (acceptedContracts?.length || 0) * 90,
        comments: 90 + withIssues.length * 50,
        reposts: 30 + (acceptedContracts?.length || 0) * 22,
      },
    },
  ];

  return posts;
}

const toneStyles = {
  positive: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  negative: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  neutral: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
};

export default function AviationMediaFeed({ company, recentFlights, acceptedContracts }) {
  const posts = useMemo(
    () => createPosts(company, recentFlights, acceptedContracts),
    [company, recentFlights, acceptedContracts],
  );

  return (
    <Card className="border-cyan-900/40 bg-slate-950/70 p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-cyan-900/30 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-200">Airline Media Feed</h3>
          <p className="text-xs text-slate-400">Reporter-style coverage based on your latest operational data.</p>
        </div>
        <Badge variant="outline" className="border-cyan-700 text-cyan-300"><Clock3 className="w-3 h-3 mr-1" /> Live</Badge>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="p-3 space-y-3">
          {posts.map((post, idx) => {
            const Icon = post.icon || Plane;
            return (
              <article key={`${post.source}-${idx}`} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-9 w-9 border border-cyan-900/50">
                    <AvatarFallback className="bg-slate-800 text-cyan-200 text-xs font-bold">
                      {post.source.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-100 font-semibold leading-none">{post.source}</p>
                    <p className="text-xs text-slate-400">{post.handle}</p>
                  </div>
                  <Badge className={`ml-auto ${toneStyles[post.tone]}`}>{post.tone}</Badge>
                </div>
                <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-3 mb-2">
                  <div className="flex items-center gap-2 mb-2 text-cyan-300">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider">Reporter bulletin</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100 mb-1">{post.headline}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{post.description}</p>
                  <p className={`mt-2 text-[11px] font-mono ${post.reputationImpact >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    REP Impact: {formatDelta(post.reputationImpact)}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 px-1">
                  <span className="inline-flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {formatDelta(post.metrics.likes)}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {formatDelta(post.metrics.comments)}</span>
                  <span className="inline-flex items-center gap-1"><Repeat2 className="w-3.5 h-3.5" /> {formatDelta(post.metrics.reposts)}</span>
                </div>
              </article>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
