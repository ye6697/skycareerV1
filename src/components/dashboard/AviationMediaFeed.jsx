import React, { useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TrendingUp, TriangleAlert, Plane, Clock3, Users, Newspaper, BadgeCheck, Activity, PlaneTakeoff, CalendarRange } from 'lucide-react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getFlightDate = (flight) => {
  const raw = flight?.completed_at || flight?.arrival_time || flight?.updated_date || flight?.created_date;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const getAnchorDate = (flights) => {
  const firstFlightDate = (flights || []).map(getFlightDate).find(Boolean);
  return firstFlightDate || new Date();
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

const getMood = (impact, lang) => {
  if (impact > 2) return lang === 'de' ? 'Stimmung steigt' : 'Mood improving';
  if (impact < -2) return lang === 'de' ? 'Unter Beobachtung' : 'Under review';
  return lang === 'de' ? 'Abwartend' : 'Measured';
};

function createPosts(company, flights, acceptedContracts, lang) {
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
  const anchorDate = getAnchorDate(completedFlights);

  return [
    {
      source: 'SkyNews Aviation',
      handle: '@skynews.av',
      icon: Newspaper,
      tone: reputation >= 70 ? 'positive' : reputation <= 40 ? 'negative' : 'neutral',
      sharedAt: offsetMinutes(anchorDate, 18),
      headline:
        reputation >= 70
          ? lang === 'de'
            ? 'Luftfahrtredaktion sieht ruhigeres Bild im SkyCareer-Netz'
            : 'Aviation desk sees a calmer picture across the SkyCareer network'
          : reputation <= 40
            ? lang === 'de'
              ? 'Abendbericht: Marke steht nach unruhigen Umlaeufen unter Druck'
              : 'Evening report: brand faces pressure after unsettled rotations'
            : lang === 'de'
              ? 'Korrespondenten melden gemischte Reaktionen auf Regionalstrecken'
              : 'Correspondents report mixed reactions across regional routes',
      description:
        lang === 'de'
          ? 'Aus der Redaktion heisst es, dass Reisende weniger auf einzelne Kennzahlen schauen, sondern auf den Gesamteindruck: klare Kommunikation, saubere Ablaeufe und glaubwuerdige Reaktionen nach Stoerungen praegen aktuell das Bild.'
          : 'Our desk hears that travelers are judging the whole operation more than a single score: clear communication, tidy recovery work, and credible reactions after disruption are shaping the current story.',
      reputationImpact: repImpact,
    },
    {
      source: 'PaxPulse',
      handle: '@paxpulse',
      icon: Users,
      tone: avgRating >= 85 ? 'positive' : avgRating <= 65 ? 'negative' : 'neutral',
      sharedAt: offsetMinutes(anchorDate, 47),
      headline: lang === 'de' ? 'Passagierreporter fassen die Stimmung an Bord zusammen' : 'Passenger reporters summarize the mood on board',
      description:
        serviceLeaders.length > 0
          ? lang === 'de'
            ? 'Vielflieger loben vor allem die ruhige Kabinenroutine und das Gefuehl, dass die Crews den Ablauf im Griff haben. Das Feedback liest sich weniger euphorisch, aber deutlich vertrauensvoller.'
            : 'Frequent flyers are praising the calm cabin rhythm and the sense that crews have the operation in hand. The feedback reads less flashy, but noticeably more confident.'
          : lang === 'de'
            ? 'Die Stimmen aus den Terminals bleiben vorsichtig. Besonders Boarding, Ansagen und die letzten Minuten vor der Ankunft entscheiden darueber, ob der Flug als professionell wahrgenommen wird.'
            : 'Terminal voices remain cautious. Boarding flow, announcements, and the final minutes before arrival are deciding whether the flight feels professionally handled.',
      reputationImpact: clamp(Math.round((avgRating - 75) / 4), -8, 8),
    },
    {
      source: 'ATC Watch',
      handle: '@atc.watch',
      icon: TriangleAlert,
      tone: withIssues.length > 0 ? 'negative' : 'positive',
      sharedAt: offsetMinutes(anchorDate, 79),
      headline:
        withIssues.length > 0
          ? lang === 'de'
            ? 'Operationsdesk fordert Nacharbeit nach auffaelligen Fluegen'
            : 'Operations desk calls for follow-up after irregular flights'
          : lang === 'de'
            ? 'Ops-Bulletin: Betriebslage bleibt ruhig'
            : 'Ops bulletin: operating picture stays calm',
      description:
        withIssues.length > 0
          ? lang === 'de'
            ? 'Nach haerteren Anfluegen oder technischen Auffaelligkeiten geht der Blick nun auf die Reaktion der Airline. Entscheidend ist, ob die naechsten Umlaeufe wieder diszipliniert und nachvollziehbar laufen.'
            : 'After harder approaches or technical irregularities, attention is moving to the airline response. The next rotations now matter most: disciplined, explainable, and uneventful.'
          : lang === 'de'
            ? 'Die juengsten Umlaeufe liefern keinen Stoff fuer Alarmmeldungen. In der Branche wird das als leises, aber wichtiges Signal fuer stabile Standards gelesen.'
            : 'The latest rotations are giving monitors little to sound alarms about. Around the industry, that is being read as a quiet but useful signal of stable standards.',
      reputationImpact: withIssues.length > 0 ? -Math.min(12, withIssues.length * 3) : 4,
    },
    {
      source: 'Investor Radar',
      handle: '@investorradar',
      icon: TrendingUp,
      tone: reputation >= 65 && withIssues.length === 0 ? 'positive' : 'neutral',
      sharedAt: offsetMinutes(anchorDate, 121),
      headline: lang === 'de' ? 'Wirtschaftsdesk schaut auf Vertrauen statt Tempo' : 'Business desk watches trust more than pace',
      description:
        (acceptedContracts?.length || 0) > 0
          ? lang === 'de'
            ? 'Analysten sehen die offenen Auftraege als Chance, aber auch als Belastungstest. Der Markt reagiert vor allem darauf, ob Zusagen sauber abgeflogen werden und die Qualitaet im Alltag haelt.'
            : 'Analysts see the open contract book as both opportunity and stress test. The market is reacting most to whether promises are flown cleanly and quality holds in daily service.'
          : lang === 'de'
            ? 'Ohne grossen Auftragsdruck liegt der Fokus auf Konsolidierung. Reporter beschreiben die Lage als Moment, in dem ruhige, zuverlaessige Fluege mehr zaehlen als Schlagzeilen.'
            : 'With no heavy contract pressure, the focus shifts to consolidation. Reporters describe this as a moment where quiet, reliable flights matter more than headlines.',
      reputationImpact: clamp(Math.round((acceptedContracts?.length || 0) - withIssues.length * 2), -8, 8),
    },
  ];
}


const categoryDefs = [
  { key: 'all', icon: CalendarRange },
  { key: 'month', icon: Activity },
  { key: 'week', icon: Clock3 },
];

const filterFlightsByCategory = (flights, category) => {
  if (category === 'all') return flights;
  const now = new Date();
  const days = category === 'week' ? 7 : 30;
  return (flights || []).filter((f) => {
    const d = getFlightDate(f);
    if (!d) return false;
    return now.getTime() - d.getTime() <= days * 24 * 60 * 60 * 1000;
  });
};

const toneStyles = {
  positive: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  negative: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  neutral: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
};

export default function AviationMediaFeed({ company, recentFlights, acceptedContracts, lang = 'en' }) {
  const [category, setCategory] = useState('all');
  const [selectedPost, setSelectedPost] = useState(null);
  const scopedFlights = useMemo(() => filterFlightsByCategory(recentFlights, category), [recentFlights, category]);
  const posts = useMemo(
    () => createPosts(company, scopedFlights, acceptedContracts, lang),
    [company, scopedFlights, acceptedContracts, lang],
  );

  return (
    <Card className="border-cyan-900/40 bg-slate-950/70 p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-cyan-900/30 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-200">
            {lang === 'de' ? 'Airline Media Feed' : 'Airline Media Feed'}
          </h3>
          <p className="text-xs text-slate-400">
            {lang === 'de' ? 'Reporterberichte aus deinen letzten Betriebsdaten.' : 'Reporter-style coverage from your latest operational data.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {categoryDefs.map(({ key, icon: FilterIcon }) => (
            <button key={key} onClick={() => setCategory(key)} className={`px-2 py-1 rounded-md border text-xs flex items-center gap-1 ${category === key ? 'border-cyan-400 text-cyan-200 bg-cyan-500/10' : 'border-slate-700 text-slate-400'}`}>
              <FilterIcon className="w-3 h-3" />
              {lang === 'de' ? (key === 'all' ? 'Alle Zeit' : key === 'month' ? 'Monat' : 'Woche') : (key === 'all' ? 'All time' : key === 'month' ? 'Month' : 'Week')}
            </button>
          ))}
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
                  <button type="button" onClick={() => setSelectedPost(post)} className="rounded-full"><Avatar className="h-9 w-9 border border-cyan-900/50 hover:border-cyan-500">
                    <AvatarFallback className="bg-slate-800 text-cyan-200 text-xs font-bold">
                      {post.source.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar></button>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-100 font-semibold leading-none">{post.source}</p>
                    <p className="text-xs text-slate-400">
                      {post.handle} - {lang === 'de' ? 'geteilt' : 'shared'} {formatSharedAt(post.sharedAt, lang)}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Badge className="border-indigo-500/40 bg-indigo-500/10 text-indigo-200">
                      <BadgeCheck className="w-3 h-3 mr-1" />
                      {lang === 'de' ? 'Rep-Impact' : 'Rep Impact'} {post.reputationImpact > 0 ? '+' : ''}{post.reputationImpact}
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
                <div className="rounded border border-slate-700 p-2"><span className="text-slate-400 text-xs">{lang === 'de' ? 'Reputation Impact' : 'Reputation Impact'}</span><p className="text-cyan-300 font-mono">{selectedPost.reputationImpact > 0 ? '+' : ''}{selectedPost.reputationImpact}</p></div>
                <div className="rounded border border-slate-700 p-2"><span className="text-slate-400 text-xs">KOIs/KPIs</span><p className="text-cyan-300 font-mono">{scopedFlights.length} flights • {acceptedContracts?.length || 0} contracts</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
