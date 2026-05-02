import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Wrench, Building2, Plane, Video, Sparkles, Globe2, ArrowRight, ChevronRight, MousePointerClick } from 'lucide-react';
import { SignupGateProvider } from './SignupGate';
import InteractiveMaintenanceDemo from './InteractiveMaintenanceDemo';
import InteractiveHangarDemo from './InteractiveHangarDemo';
import InteractiveGlobeDemo from './InteractiveGlobeDemo';
import InteractiveMarketDemo from './InteractiveMarketDemo';
import InteractiveReplayDemo from './InteractiveReplayDemo';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.08 } }),
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

const PREVIEWS = {
  maintenance: InteractiveMaintenanceDemo,
  hangar: InteractiveHangarDemo,
  globe: InteractiveGlobeDemo,
  market: InteractiveMarketDemo,
  replay: InteractiveReplayDemo,
};

export default function NewFeaturesShowcase({ lang, onCta }) {
  const items = [
    {
      key: 'replay',
      icon: Video,
      iconColor: 'bg-cyan-500',
      badge: lang === 'de' ? 'NEU · 3D Replay' : 'NEW · 3D Replay',
      title: lang === 'de' ? 'Takeoff & Landing 3D Replay mit Centerline-Score' : 'Takeoff & Landing 3D Replay with Centerline Score',
      desc: lang === 'de'
        ? 'Erlebe deine Starts und Landungen als cinematischen 3D-Replay – inklusive echter Bahn-Geometrie aus OurAirports, farbcodiertem Flugpfad nach seitlicher Abweichung, PFD-HUD, Touchdown-Marker und Centerline-Bewertung mit Score- & Cash-Bonus. Als MP4 exportierbar oder direkt teilen.'
        : 'Replay your takeoffs and landings as a cinematic 3D scene – with real OurAirports runway geometry, color-coded centerline deviation track, PFD HUD, touchdown marker and centerline score with score + cash bonus. Export as MP4 or share directly.',
      bullets: lang === 'de'
        ? ['Echte Runway-Daten aus OurAirports', 'Pfad-Farbe nach m-Abweichung von der Mittellinie', 'Touchdown / Liftoff-Marker mit RMS-Wert', '+/- Score & Cash je nach Präzision', 'MP4 Export & Native Share', 'Chase / Side / Top Cam mit manueller Orbit-Steuerung']
        : ['Real runway data from OurAirports', 'Path color = lateral deviation in meters', 'Touchdown / liftoff marker with RMS value', '+/- score & cash based on precision', 'MP4 export & native share', 'Chase / Side / Top cam with manual orbit'],
      featured: true,
    },
    {
      key: 'hangar',
      icon: Building2,
      iconColor: 'bg-emerald-500',
      badge: lang === 'de' ? 'NEU · 3D Hangar Markt' : 'NEW · 3D Hangar Market',
      title: lang === 'de' ? '3D Hangar Marketplace direkt im Globus' : '3D Hangar Marketplace right inside the globe',
      desc: lang === 'de'
        ? 'Klicke auf jeden Airport im Leaflet-Globus und kaufe, erweitere oder verkaufe Hangars in 3D. 4 Größen (Small → Mega), eigene Modell-Varianten, Slot-Limits pro Flugzeugtyp und 60 % Refund beim Verkauf.'
        : 'Click any airport on the Leaflet globe and buy, upgrade or sell hangars in 3D. 4 sizes (Small → Mega), unique model variants, slot limits per aircraft type and 60% refund on sale.',
      bullets: lang === 'de'
        ? ['4 Hangar-Größen mit Modell-Varianten', 'Slot-Limits pro Aircraft-Typ', 'Inline Kauf / Upgrade / Verkauf', 'Aircraft Transfer mit Live-Kosten', 'Synchronisiert mit Aufträgen']
        : ['4 hangar sizes with model variants', 'Slot limits per aircraft type', 'Inline buy / upgrade / sell', 'Aircraft transfer with live cost', 'Synced with contracts'],
    },
    {
      key: 'globe',
      icon: Globe2,
      iconColor: 'bg-blue-500',
      badge: lang === 'de' ? 'NEU · Interaktive Karte' : 'NEW · Interactive Map',
      title: lang === 'de' ? 'Interaktive Auftragskarte mit Routenfilter' : 'Interactive contract map with route filtering',
      desc: lang === 'de'
        ? 'Alle Aufträge live auf der Weltkarte. Filtere nach Hub, Distanz und Aircraft – inkompatible Verträge werden klar markiert, kompatible sind 1-Klick annehmbar. Hangar-Slots, Reichweite und Fracht werden geprüft, bevor du klickst.'
        : 'All contracts live on the world map. Filter by hub, distance and aircraft – incompatible contracts are clearly marked, compatible ones are one-click accept. Hangar slots, range and cargo are checked before you click.',
      bullets: lang === 'de'
        ? ['Klickbare Routen + Großkreise', 'Filter nach Hub & NM', 'Aircraft-Kompatibilität live', 'Sofort-Annahme aus der Karte']
        : ['Clickable great-circle routes', 'Filter by hub & NM', 'Live aircraft compatibility', 'Accept directly from the map'],
    },
    {
      key: 'market',
      icon: Plane,
      iconColor: 'bg-purple-500',
      badge: lang === 'de' ? 'NEU · 3D Flugzeugmarkt' : 'NEW · 3D Aircraft Market',
      title: lang === 'de' ? '3D Flugzeugmarkt mit Live-Specs' : '3D Aircraft market with live specs',
      desc: lang === 'de'
        ? '50+ Flugzeuge auf einer cineastischen 3D-Bühne mit Drehteller, neuwertigem Modell-Render und Spec-Panel. Used-Market mit Verschleißzustand, Versicherungsplan und Hangar-Zuordnung – alles in einem Flow.'
        : '50+ aircraft on a cinematic 3D turntable stage with brand-new model renders and spec panel. Used market with wear profile, insurance plan and hangar assignment – all in one flow.',
      bullets: lang === 'de'
        ? ['New & Used Markt', 'Versicherungsplan pro Aircraft', 'Hangar-Slot-Check beim Kauf', 'Permanenter Verschleiß für Used']
        : ['New & used market', 'Per-aircraft insurance plan', 'Hangar slot check on purchase', 'Permanent wear on used aircraft'],
    },
    {
      key: 'maintenance',
      icon: Wrench,
      iconColor: 'bg-orange-500',
      badge: lang === 'de' ? 'NEU · 3D Wartung' : 'NEW · 3D Maintenance',
      title: lang === 'de' ? '3D Wartungsansicht mit Hotspots' : '3D maintenance view with hotspots',
      desc: lang === 'de'
        ? 'Jedes Flugzeug als 3D-Modell – Hotspots zeigen Verschleiß je Kategorie direkt am Rumpf, Triebwerken, Fahrwerk und Avionik-Bay. Kritische Werte glühen rot. Wartung pro Kategorie oder als Komplett-Service direkt aus der Szene heraus buchbar.'
        : 'Every aircraft as a 3D model – hotspots show wear per category directly on fuselage, engines, gear and avionics bay. Critical values glow red. Book maintenance per category or as full service straight from the scene.',
      bullets: lang === 'de'
        ? ['8 Wartungs-Kategorien als Hotspots', 'Permanenter & reparabler Verschleiß', 'Live-Failure-Trigger im Sim', 'Versicherung deckt Wartungsschäden']
        : ['8 maintenance categories as hotspots', 'Permanent & repairable wear', 'Live failure triggers in sim', 'Insurance covers maintenance damage'],
    },
  ];

  return (
    <SignupGateProvider lang={lang} onCta={onCta} interactionLimit={5}>
      <section className="py-16 sm:py-28 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10">
            <motion.div variants={fadeUp}>
              <Badge className="bg-cyan-600/20 text-cyan-400 border-cyan-500/30 mb-4 px-4 py-1.5">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {lang === 'de' ? 'NEU IN V1' : 'NEW IN V1'}
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
                ? '3D-Wartung, 3D-Hangars, 3D-Flugzeugmarkt, interaktiver Auftrags-Globus und Cinematic 3D Replays für Takeoff & Landing inklusive Centerline-Bewertung.'
                : '3D maintenance, 3D hangars, 3D aircraft market, interactive contract globe and cinematic 3D replays for takeoff & landing with centerline scoring.'}
            </motion.p>
            <motion.div variants={fadeUp} className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-mono text-cyan-200">
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>
                {lang === 'de'
                  ? 'Probiere die Demos unten direkt aus – klicke, ziehe, wechsle Kameras.'
                  : 'Try the demos below right away – click, drag, switch cameras.'}
              </span>
            </motion.div>
          </motion.div>

          {/* Featured row (Replay) */}
          {items.filter((it) => it.featured).map((item) => {
            const Preview = PREVIEWS[item.key];
            const Icon = item.icon;
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-8"
              >
                <Card className="bg-slate-900/70 border-cyan-500/30 overflow-hidden rounded-2xl p-4 sm:p-6 grid lg:grid-cols-5 gap-5 items-center">
                  <div className="lg:col-span-3">
                    <Preview lang={lang} />
                  </div>
                  <div className="lg:col-span-2">
                    <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 mb-3">{item.badge}</Badge>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.iconColor}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">{item.title}</h3>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">{item.desc}</p>
                    <div className="space-y-1.5">
                      {item.bullets.map((b, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <ChevronRight className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                    {onCta && (
                      <button
                        onClick={onCta}
                        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                      >
                        {lang === 'de' ? 'Jetzt selbst erleben' : 'Try it yourself'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}

          {/* Grid of remaining */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-2 gap-5"
          >
            {items.filter((it) => !it.featured).map((item) => {
              const Preview = PREVIEWS[item.key];
              const Icon = item.icon;
              return (
                <motion.div key={item.key} variants={fadeUp}>
                  <Card className="bg-slate-800/60 border-slate-700/50 overflow-hidden rounded-2xl p-4 sm:p-5 h-full hover:border-cyan-500/40 transition-colors">
                    <Preview lang={lang} />
                    <div className="mt-4">
                      <Badge className="bg-slate-900/80 border-slate-700 text-slate-300 mb-2 text-[10px]">{item.badge}</Badge>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.iconColor}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="text-base sm:text-lg font-bold text-white leading-tight">{item.title}</h4>
                      </div>
                      <p className="text-slate-400 text-sm mb-3">{item.desc}</p>
                      <div className="space-y-1">
                        {item.bullets.map((b, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                            <ChevronRight className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>
    </SignupGateProvider>
  );
}