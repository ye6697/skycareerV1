import React, { useState, lazy, Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Wrench, Plane, Video, Sparkles, Globe2, ArrowRight, ChevronRight, MousePointerClick, X, Loader2, Play } from 'lucide-react';
import { SignupGateProvider, useSignupGate, GateIndicator } from './SignupGate';
import { DEMO_AIRCRAFT_FLEET, DEMO_MARKET_LISTINGS, DEMO_COMPANY, DEMO_CONTRACTS, DEMO_MARKET_AIRPORTS, DEMO_FLIGHT } from './demoData';
import { HANGAR_MODEL_VARIANTS } from '@/components/contracts/hangarModelCatalog';

// LAZY-LOAD heavy 3D components – only mount when user opens the modal.
// This prevents the landing page from spawning multiple Three.js / Leaflet
// instances on initial render (which crashed mobile browsers).
const AircraftHangar3D = lazy(() => import('@/components/fleet3d/AircraftHangar3D'));
const Fleet3DView = lazy(() => import('@/components/fleet3d/Fleet3DView'));
const MarketHangar3DView = lazy(() => import('@/components/fleet3d/MarketHangar3DView'));
const FinalApproach3D = lazy(() => import('@/components/flights/FinalApproach3D'));
const HangarWorldGlobe3D = lazy(() => import('@/components/contracts/HangarWorldGlobe3D'));

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.08 } }),
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

// Real app screenshots / mockups that match the actual in-app views.
const PREVIEW_IMAGES = {
  replay: 'https://media.base44.com/images/public/6983dde00291b5dfd85079e6/e7b5fa01b_generated_image.png',
  globe: 'https://media.base44.com/images/public/6983dde00291b5dfd85079e6/47f1432af_generated_image.png',
  market: 'https://media.base44.com/images/public/6983dde00291b5dfd85079e6/c9ebac48c_generated_image.png',
  maintenance: 'https://media.base44.com/images/public/6983dde00291b5dfd85079e6/9cf9992f0_generated_image.png',
};

/* ------------------- Modal Wrappers ------------------- */

function LoadingScreen({ lang }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-3" />
        <p className="text-cyan-300 font-mono text-sm uppercase tracking-widest">
          {lang === 'de' ? 'Lade 3D Engine...' : 'Loading 3D Engine...'}
        </p>
      </div>
    </div>
  );
}

function ModalShell({ onClose, children, title, lang }) {
  return (
    <div className="fixed inset-0 z-[180] bg-slate-950/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-900/50 bg-slate-900/95">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-mono uppercase tracking-widest text-cyan-300">{title}</span>
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] ml-2">DEMO</Badge>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:border-cyan-500/50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0 relative">{children}</div>
    </div>
  );
}

function MaintenanceModal({ onClose, lang }) {
  return (
    <ModalShell onClose={onClose} title={lang === 'de' ? '3D Wartung & Flotte' : '3D Maintenance & Fleet'} lang={lang}>
      <Suspense fallback={<LoadingScreen lang={lang} />}>
        <Fleet3DView aircraft={DEMO_AIRCRAFT_FLEET} />
      </Suspense>
    </ModalShell>
  );
}

function MarketModal({ onClose, lang }) {
  const [marketSection, setMarketSection] = useState('new');
  return (
    <ModalShell onClose={onClose} title={lang === 'de' ? '3D Flugzeugmarkt' : '3D Aircraft Market'} lang={lang}>
      <Suspense fallback={<LoadingScreen lang={lang} />}>
        <MarketHangar3DView
          listings={DEMO_MARKET_LISTINGS}
          lang={lang}
          company={DEMO_COMPANY}
          marketSection={marketSection}
          usedConditionFilter="all"
          usedConditionProfiles={[]}
          onSetMarketSection={setMarketSection}
          onSetMarketViewMode={() => {}}
          onSetUsedConditionFilter={() => {}}
          onClose={onClose}
          canAfford={(price) => DEMO_COMPANY.balance >= price}
          canPurchase={(listing) =>
            DEMO_COMPANY.level >= (listing.level_requirement || 1) &&
            DEMO_COMPANY.balance >= listing.purchase_price
          }
          onBuy={() => {}}
          onConfirmBuy={() => {}}
          getPurchaseHangarOptions={() => [
            { id: 'demo-hangar-eddf', airport_icao: 'EDDF', usedSlots: 3, slots: 8, rule: { slots: 8 } },
          ]}
          isBuying={false}
          selectedListingId=""
        />
      </Suspense>
    </ModalShell>
  );
}

function ReplayModal({ onClose, lang }) {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 z-[180] bg-slate-950 flex items-center justify-center">
        <LoadingScreen lang={lang} />
        <button type="button" onClick={onClose} className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
    }>
      <FinalApproach3D flight={DEMO_FLIGHT} onClose={onClose} phase="landing" />
    </Suspense>
  );
}

function GlobeModal({ onClose, lang }) {
  const [selectedAirportIcao, setSelectedAirportIcao] = useState('EDDF');
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(HANGAR_MODEL_VARIANTS?.[0]?.id || '');

  return (
    <ModalShell onClose={onClose} title={lang === 'de' ? 'Auftrags-Globus' : 'Contract Globe'} lang={lang}>
      <Suspense fallback={<LoadingScreen lang={lang} />}>
        <div className="absolute inset-0 p-2 sm:p-4 overflow-auto">
          <HangarWorldGlobe3D
            hangars={DEMO_COMPANY.hangars}
            ownedAircraft={DEMO_AIRCRAFT_FLEET}
            contracts={DEMO_CONTRACTS}
            contractsByHangar={{
              EDDF: DEMO_CONTRACTS.filter((c) => c.departure_airport === 'EDDF'),
              EGLL: DEMO_CONTRACTS.filter((c) => c.departure_airport === 'EGLL'),
            }}
            marketAirports={DEMO_MARKET_AIRPORTS}
            selectedContractId={selectedContractId}
            onSelectContract={setSelectedContractId}
            selectedAirportIcao={selectedAirportIcao}
            onSelectAirport={setSelectedAirportIcao}
            selectedMarketVariantId={selectedVariantId}
            onSelectMarketVariantId={setSelectedVariantId}
            hangarVariants={HANGAR_MODEL_VARIANTS}
            onMoveAircraft={() => {}}
            isMovingAircraft={false}
            getMoveValidation={() => ({ valid: false, reason: lang === 'de' ? 'Demo – Account erstellen zum Aktivieren' : 'Demo – sign up to enable' })}
            getTransferCost={() => 0}
            getAircraftModelName={(a) => a?.name || ''}
            onBuyOrUpgrade={() => {}}
            isBuyingOrUpgrading={false}
            onSellHangar={() => {}}
            isSellingHangar={false}
            lang={lang}
          />
        </div>
      </Suspense>
    </ModalShell>
  );
}

/* ------------------- Static image preview (no Three.js inline) ------------------- */

function ImagePreview({ src, alt, badge }) {
  return (
    <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent pointer-events-none" />
      {badge && (
        <span className="absolute top-2 left-2 text-[9px] font-mono uppercase tracking-widest text-cyan-300 bg-slate-950/80 border border-cyan-700/40 px-1.5 py-0.5 rounded">
          {badge}
        </span>
      )}
    </div>
  );
}

/* ------------------- Card with gated open action ------------------- */

function FeatureCard({ item, openModal, lang }) {
  const Icon = item.icon;
  const { requestInteraction } = useSignupGate();

  const handleOpen = () => {
    if (!requestInteraction({
      reason: lang === 'de'
        ? 'Du hast die Demo-Interaktionen aufgebraucht. Erstelle einen Account, um SkyCareer voll zu nutzen.'
        : 'You used up the demo interactions. Create an account to use the full SkyCareer career mode.',
    })) return;
    openModal(item.key);
  };

  return (
    <motion.div variants={fadeUp} className={item.featured ? 'mb-6' : ''}>
      <Card className={`bg-slate-900/70 border ${item.featured ? 'border-cyan-500/30' : 'border-slate-700/50'} overflow-hidden rounded-2xl p-4 sm:p-5 ${item.featured ? 'grid lg:grid-cols-5 gap-5 items-center' : 'flex flex-col h-full'}`}>
        <div className={item.featured ? 'lg:col-span-3 relative' : 'relative'}>
          <ImagePreview src={item.image} alt={item.title} badge={item.previewBadge} />
          <button
            type="button"
            onClick={handleOpen}
            className="absolute inset-0 z-10 flex items-end justify-center p-4 group"
          >
            <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-[0_0_20px_rgba(34,211,238,0.4)] group-hover:scale-105 transition-transform">
              <Play className="w-4 h-4 fill-white" />
              {item.openLabel}
            </span>
          </button>
          <div className="absolute top-2 right-2 z-20"><GateIndicator lang={lang} /></div>
        </div>
        <div className={item.featured ? 'lg:col-span-2' : 'mt-3'}>
          <Badge className={`${item.featured ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-900/80 border-slate-700 text-slate-300'} mb-2 text-[10px]`}>{item.badge}</Badge>
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`${item.featured ? 'w-10 h-10' : 'w-9 h-9'} rounded-lg flex items-center justify-center ${item.iconColor}`}>
              <Icon className={`${item.featured ? 'w-5 h-5' : 'w-4 h-4'} text-white`} />
            </div>
            <h4 className={`${item.featured ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'} font-black text-white leading-tight`}>{item.title}</h4>
          </div>
          <p className={`text-slate-400 ${item.featured ? 'text-sm' : 'text-sm'} mb-3`}>{item.desc}</p>
          <div className="space-y-1">
            {item.bullets.map((b, i) => (
              <div key={i} className={`flex items-start gap-2 ${item.featured ? 'text-sm text-slate-300' : 'text-xs text-slate-400'}`}>
                <ChevronRight className={`${item.featured ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-cyan-400 mt-0.5 flex-shrink-0`} />
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/* ------------------- Main Section ------------------- */

function ShowcaseInner({ lang, onCta }) {
  const [openModal, setOpenModal] = useState(null);

  const items = [
    {
      key: 'replay',
      icon: Video,
      iconColor: 'bg-cyan-500',
      badge: lang === 'de' ? 'NEU · 3D Replay' : 'NEW · 3D Replay',
      previewBadge: lang === 'de' ? 'Landing Replay' : 'Landing Replay',
      title: lang === 'de' ? 'Takeoff & Landing 3D Replay mit Centerline-Score' : 'Takeoff & Landing 3D Replay with Centerline Score',
      desc: lang === 'de'
        ? 'Cinematischer 3D-Replay mit echter Bahn-Geometrie aus OurAirports, farbcodiertem Flugpfad nach seitlicher Abweichung, PFD-HUD, Touchdown-Marker und Centerline-Bewertung.'
        : 'Cinematic 3D replay with real OurAirports runway geometry, color-coded centerline deviation track, PFD HUD, touchdown marker and centerline scoring.',
      bullets: lang === 'de'
        ? ['Echte Runway-Daten aus OurAirports', 'Pfad-Farbe nach m-Abweichung', 'Touchdown-Marker mit RMS-Wert', 'Chase / Side / Top Cam']
        : ['Real OurAirports runway data', 'Path color = lateral deviation', 'Touchdown marker with RMS value', 'Chase / Side / Top cam'],
      featured: true,
      image: PREVIEW_IMAGES.replay,
      openLabel: lang === 'de' ? 'Replay starten' : 'Start Replay',
    },
    {
      key: 'globe',
      icon: Globe2,
      iconColor: 'bg-blue-500',
      badge: lang === 'de' ? 'NEU · Auftrags-Globus' : 'NEW · Contract Globe',
      previewBadge: lang === 'de' ? 'Live Karte' : 'Live Map',
      title: lang === 'de' ? 'Interaktive Auftragskarte mit Hangar-Markt' : 'Interactive contract map with hangar market',
      desc: lang === 'de'
        ? 'Alle Aufträge live auf der Weltkarte. Klick auf jeden Airport öffnet den Hangar-Markt – Kauf, Upgrade, Verkauf, Aircraft-Transfer direkt im Globus.'
        : 'All contracts live on the world map. Click any airport to open the hangar market – buy, upgrade, sell, aircraft transfer right inside the globe.',
      bullets: lang === 'de'
        ? ['Klickbare Routen + Großkreise', 'Filter nach Hub & NM', 'Hangar Markt im Popup', 'Aircraft Transfer mit Live-Kosten']
        : ['Clickable great-circle routes', 'Filter by hub & NM', 'Hangar market in popup', 'Aircraft transfer with live cost'],
      image: PREVIEW_IMAGES.globe,
      openLabel: lang === 'de' ? 'Globus öffnen' : 'Open Globe',
    },
    {
      key: 'market',
      icon: Plane,
      iconColor: 'bg-purple-500',
      badge: lang === 'de' ? 'NEU · 3D Flugzeugmarkt' : 'NEW · 3D Aircraft Market',
      previewBadge: lang === 'de' ? 'Showroom' : 'Showroom',
      title: lang === 'de' ? '3D Flugzeugmarkt mit Live-Specs' : '3D Aircraft market with live specs',
      desc: lang === 'de'
        ? '50+ Flugzeuge auf einer cineastischen 3D-Bühne mit Drehteller und Spec-Panel. New & Used Markt mit Versicherung und Hangar-Zuordnung.'
        : '50+ aircraft on a cinematic 3D turntable with spec panel. New & used market with insurance plan and hangar slot assignment.',
      bullets: lang === 'de'
        ? ['New & Used Markt', 'Versicherungsplan pro Aircraft', 'Hangar-Slot-Check beim Kauf', 'Permanenter Verschleiß für Used']
        : ['New & used market', 'Per-aircraft insurance plan', 'Hangar slot check on purchase', 'Permanent wear on used aircraft'],
      image: PREVIEW_IMAGES.market,
      openLabel: lang === 'de' ? 'Markt öffnen' : 'Open Market',
    },
    {
      key: 'maintenance',
      icon: Wrench,
      iconColor: 'bg-orange-500',
      badge: lang === 'de' ? 'NEU · 3D Wartung' : 'NEW · 3D Maintenance',
      previewBadge: lang === 'de' ? 'Hotspots' : 'Hotspots',
      title: lang === 'de' ? '3D Wartungsansicht mit Hotspots' : '3D maintenance view with hotspots',
      desc: lang === 'de'
        ? 'Jedes Flugzeug als 3D-Modell – Hotspots zeigen Verschleiß je Kategorie direkt am Rumpf, Triebwerken, Fahrwerk und Avionik. Klick auf Hotspot öffnet Reparatur.'
        : 'Every aircraft as a 3D model – hotspots show wear per category on fuselage, engines, gear and avionics. Click hotspot to open repair.',
      bullets: lang === 'de'
        ? ['8 Wartungs-Kategorien als Hotspots', 'Permanenter & reparabler Verschleiß', 'Live-Failure-Trigger im Sim', 'Versicherung deckt Wartungsschäden']
        : ['8 maintenance categories as hotspots', 'Permanent & repairable wear', 'Live failure triggers in sim', 'Insurance covers maintenance damage'],
      image: PREVIEW_IMAGES.maintenance,
      openLabel: lang === 'de' ? 'Flotte öffnen' : 'Open Fleet',
    },
  ];

  return (
    <section className="py-16 sm:py-28 px-4 sm:px-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="relative max-w-7xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10">
          <motion.div variants={fadeUp}>
            <Badge className="bg-cyan-600/20 text-cyan-400 border-cyan-500/30 mb-4 px-4 py-1.5">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              {lang === 'de' ? 'NEU IN V1 · LIVE DEMOS' : 'NEW IN V1 · LIVE DEMOS'}
            </Badge>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-3">
            {lang === 'de' ? 'Eine neue Generation' : 'A new generation'}{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              {lang === 'de' ? 'Career-Mode' : 'of career mode'}
            </span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-slate-400 max-w-3xl mx-auto">
            {lang === 'de'
              ? 'Klicke auf eine Vorschau – die echten In-App 3D-Komponenten öffnen sich live mit Beispieldaten.'
              : 'Click any preview – the real in-app 3D components launch live with sample data.'}
          </motion.p>
          <motion.div variants={fadeUp} className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-mono text-cyan-200">
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>
              {lang === 'de'
                ? '5 Demo-Klicks frei · danach Account erstellen'
                : '5 demo interactions free · then create account'}
            </span>
          </motion.div>
        </motion.div>

        {items.filter((it) => it.featured).map((item) => (
          <FeatureCard key={item.key} item={item} openModal={setOpenModal} lang={lang} />
        ))}

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {items.filter((it) => !it.featured).map((item) => (
            <FeatureCard key={item.key} item={item} openModal={setOpenModal} lang={lang} />
          ))}
        </motion.div>

        {onCta && (
          <div className="mt-10 text-center">
            <button
              onClick={onCta}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold shadow-[0_0_25px_rgba(34,211,238,0.4)] hover:scale-105 transition-transform"
            >
              {lang === 'de' ? 'Vollständige Karriere starten' : 'Start full career'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {openModal === 'replay' && <ReplayModal onClose={() => setOpenModal(null)} lang={lang} />}
      {openModal === 'globe' && <GlobeModal onClose={() => setOpenModal(null)} lang={lang} />}
      {openModal === 'market' && <MarketModal onClose={() => setOpenModal(null)} lang={lang} />}
      {openModal === 'maintenance' && <MaintenanceModal onClose={() => setOpenModal(null)} lang={lang} />}
    </section>
  );
}

export default function NewFeaturesShowcase({ lang, onCta }) {
  return (
    <SignupGateProvider lang={lang} onCta={onCta} interactionLimit={5}>
      <ShowcaseInner lang={lang} onCta={onCta} />
    </SignupGateProvider>
  );
}