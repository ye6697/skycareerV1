import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Plane, DollarSign, Users, TrendingUp, MapPin, Award, Activity,
  ArrowRight, CheckCircle2, Wrench, Shield, BarChart3, Zap, Globe,
  Star, ChevronDown, Gauge, CreditCard, FileText, Fuel, AlertTriangle,
  Target, Timer, Sparkles
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1 } })
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } }
};

function FeatureShowcase({ icon: Icon, title, description, color, delay = 0 }) {
  return (
    <motion.div variants={fadeUp} custom={delay}>
      <Card className="bg-slate-800/60 backdrop-blur-sm border-slate-700/50 p-6 h-full hover:bg-slate-800 transition-all duration-500 hover:border-blue-500/40 hover:-translate-y-1 group">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color} transition-transform group-hover:scale-110`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
      </Card>
    </motion.div>
  );
}

function TestimonialCard({ quote, author, role }) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="bg-slate-800/40 backdrop-blur-sm border-slate-700/50 p-6 h-full">
        <div className="flex gap-1 mb-3">
          {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
        </div>
        <p className="text-slate-300 text-sm italic mb-4">"{quote}"</p>
        <div>
          <p className="text-white font-semibold text-sm">{author}</p>
          <p className="text-slate-500 text-xs">{role}</p>
        </div>
      </Card>
    </motion.div>
  );
}

export default function Landing() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);

  useEffect(() => {
    base44.auth.isAuthenticated().then(auth => {
      setIsAuthenticated(auth);
    });
  }, []);

  const handleLogin = () => {
    base44.auth.redirectToLogin('/Dashboard');
  };

  const features = [
    { icon: Plane, title: "Flotten-Management", description: "Von der Cessna bis zum A380 – kaufe, verkaufe und verwalte deine Flugzeuge. Jedes Aircraft hat eigene Verschleiß-Kategorien und Wartungsbedarf.", color: "bg-blue-600" },
    { icon: FileText, title: "Dynamische Aufträge", description: "Passagier-, Fracht-, Charter- und Notfall-Aufträge weltweit. KI-generiert basierend auf deiner Flotte und deinem Level.", color: "bg-indigo-600" },
    { icon: Users, title: "Crew-Management", description: "Stelle Kapitäne, Co-Piloten, Flugbegleiter und Lademeister ein. Verschiedene Erfahrungsstufen beeinflussen die Flugqualität.", color: "bg-purple-600" },
    { icon: Activity, title: "Live X-Plane Tracking", description: "Echtzeit-Verbindung zu X-Plane 12. Jede Landung, jedes G-Force-Event, jeder Stall wird erfasst und bewertet.", color: "bg-emerald-600" },
    { icon: DollarSign, title: "Finanzsystem", description: "Einnahmen, Ausgaben, Kredite, Dispo und Bankkredite. Kreditwürdigkeit basierend auf deiner Performance.", color: "bg-green-600" },
    { icon: Wrench, title: "Wartungssystem", description: "8 Wartungskategorien pro Flugzeug: Triebwerk, Hydraulik, Avionik, Zelle, Fahrwerk, Elektrik, Flugsteuerung, Druckkabine.", color: "bg-orange-600" },
    { icon: TrendingUp, title: "100 Level Karriere", description: "Vom Freizeit-Simmer zum Luftfahrt-Legende. Exponentielle Level-Up Boni und neue Flugzeug-Typen freischalten.", color: "bg-amber-600" },
    { icon: Gauge, title: "Performance-Bewertung", description: "Jeder Flug wird detailliert bewertet: Takeoff, Flug, Landung. Butterweiche Landungen bringen Bonuspunkte.", color: "bg-cyan-600" },
    { icon: Shield, title: "Reputationssystem", description: "Dein Ruf bestimmt die verfügbaren Aufträge. Perfekte Flüge steigern die Reputation, Unfälle senken sie.", color: "bg-red-600" },
    { icon: AlertTriangle, title: "Realistische Failures", description: "Echte System-Ausfälle basierend auf Wartungszustand. Tailstrikes, Stalls und Overstress haben Konsequenzen.", color: "bg-rose-600" },
    { icon: CreditCard, title: "Kredit & Banking", description: "AAA-Rating, Dispo-Kredit, Bankkredite mit Zinsen. Rückzahlung nach Fluganzahl – nicht nach Zeit.", color: "bg-teal-600" },
    { icon: BarChart3, title: "Statistiken & Charts", description: "Detaillierte Finanzcharts, Flughistorie, Gewinn/Verlust-Analyse und umfassende Karriere-Statistiken.", color: "bg-violet-600" },
  ];

  const steps = [
    { icon: Zap, title: "Plugin installieren", desc: "Lade das FlyWithLua oder Python Plugin herunter und starte X-Plane 12." },
    { icon: Globe, title: "Airline gründen", desc: "Wähle einen Namen, Callsign und Hub-Flughafen für deine Airline." },
    { icon: Plane, title: "Flotte aufbauen", desc: "Kaufe dein erstes Flugzeug und stelle deine erste Crew ein." },
    { icon: Target, title: "Aufträge fliegen", desc: "Akzeptiere Aufträge und fliege sie in X-Plane 12 – alles wird live getrackt." },
    { icon: Sparkles, title: "Imperium aufbauen", desc: "Reinvestiere Gewinne, schalte neue Level frei und werde zur Luftfahrt-Legende." },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6983dde00291b5dfd85079e6/af6bde179_IMG_8197.jpg" alt="SkyCareer" className="w-9 h-9 rounded-xl object-cover" />
            <span className="font-bold text-xl text-white">SkyCareer</span>
            <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 text-xs">X-Plane 12</Badge>
          </div>
          <Button onClick={handleLogin} className="bg-blue-600 hover:bg-blue-700">
            {isAuthenticated ? 'Zum Dashboard' : 'Jetzt starten'} <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.section style={{ opacity: heroOpacity, scale: heroScale }} className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920&q=80')] bg-cover bg-center opacity-[0.07]" />
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 via-transparent to-slate-950" />
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 sm:pt-32 pb-20 sm:pb-32">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center">
            <motion.div variants={fadeUp} className="mb-6">
              <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 px-4 py-1.5 text-sm">
                <Zap className="w-3.5 h-3.5 mr-1.5" /> Kostenlos • Keine Kreditkarte nötig
              </Badge>
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="text-4xl sm:text-6xl lg:text-8xl font-black tracking-tight mb-6 leading-[0.9]">
              <span className="bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">Deine Airline.</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">Dein Imperium.</span>
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-4 leading-relaxed">
              Der ultimative Career Mode für X-Plane 12. Gründe deine Airline, manage Flotte & Crew, fliege echte Aufträge und steige vom Hobby-Piloten zur Luftfahrt-Legende auf.
            </motion.p>

            <motion.p variants={fadeUp} custom={3} className="text-sm text-slate-500 max-w-2xl mx-auto mb-10">
              Echtzeit-Tracking • Realistisches Finanzsystem • 100 Karriere-Level • 8 Wartungskategorien • Dynamische Aufträge • Crew-Management
            </motion.p>

            <motion.div variants={fadeUp} custom={4} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={handleLogin} size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-10 py-7 rounded-xl shadow-2xl shadow-blue-600/20">
                Airline gründen <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="border-slate-700 text-white hover:bg-slate-800 text-lg px-10 py-7 rounded-xl" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
                Features entdecken <ChevronDown className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </motion.div>

          {/* Stats Bar */}
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }} className="mt-20 sm:mt-28">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { value: "50+", label: "Flugzeugtypen", icon: Plane },
                { value: "100", label: "Karriere-Level", icon: TrendingUp },
                { value: "∞", label: "Globale Routen", icon: Globe },
                { value: "Live", label: "X-Plane Tracking", icon: Activity },
              ].map((s, i) => (
                <Card key={i} className="bg-slate-900/80 backdrop-blur border-slate-800 p-5 text-center hover:border-slate-700 transition-colors">
                  <s.icon className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                  <div className="text-2xl sm:text-3xl font-black text-white">{s.value}</div>
                  <div className="text-xs sm:text-sm text-slate-500 mt-1">{s.label}</div>
                </Card>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Screenshot / Mockup */}
      <section className="relative py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
            <Card className="bg-slate-900 border-slate-800 overflow-hidden p-1 rounded-2xl shadow-2xl shadow-blue-600/5">
              <div className="bg-slate-800 rounded-xl p-4 sm:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-500 ml-2">SkyCareer Dashboard</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
                  {[
                    { label: "Kontostand", value: "$2.450.000", color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { label: "Level 23", value: "Charter-Experte", color: "text-amber-400", bg: "bg-amber-500/10" },
                    { label: "Reputation", value: "87%", color: "text-blue-400", bg: "bg-blue-500/10" },
                    { label: "Flotte", value: "12 Aircraft", color: "text-purple-400", bg: "bg-purple-500/10" },
                  ].map((item, i) => (
                    <div key={i} className={`${item.bg} rounded-xl p-3 sm:p-4`}>
                      <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                      <div className={`text-sm sm:text-lg font-bold ${item.color}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                  <div className="md:col-span-2 bg-slate-900/50 rounded-xl p-4">
                    <div className="text-sm text-slate-400 mb-3 font-medium">Aktiver Flug – EDDF → KJFK</div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>✈️ Boeing 777-300ER</span>
                      <span>🎯 FL380</span>
                      <span>⏱️ 07:42:18</span>
                      <span className="text-emerald-400">● LIVE</span>
                    </div>
                    <div className="mt-4 w-full bg-slate-800 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full w-[67%]" />
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl p-4">
                    <div className="text-sm text-slate-400 mb-3 font-medium">Kredit-Score</div>
                    <div className="text-3xl font-black text-emerald-400">AA+</div>
                    <div className="text-xs text-slate-500 mt-1">Score: 78/100</div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 sm:py-32 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp}>
              <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 mb-4">Features</Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-4">
              Alles was du brauchst
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400 max-w-2xl mx-auto">
              Ein vollständiges Airline-Management-System, nahtlos integriert in X-Plane 12
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {features.map((f, i) => (
              <FeatureShowcase key={i} {...f} delay={i} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 bg-slate-900/50">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp}>
              <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 mb-4">So funktioniert's</Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-4">
              In 5 Minuten startklar
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="space-y-4">
            {steps.map((step, i) => (
              <motion.div key={i} variants={fadeUp} custom={i}>
                <Card className="bg-slate-800/60 backdrop-blur-sm border-slate-700/50 p-5 sm:p-6 hover:bg-slate-800 transition-all group">
                  <div className="flex items-start gap-5">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform">
                      <span className="text-lg font-black text-white">{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <step.icon className="w-4 h-4 text-blue-400" />
                        <h3 className="text-lg font-bold text-white">{step.title}</h3>
                      </div>
                      <p className="text-slate-400 text-sm">{step.desc}</p>
                    </div>
                    {i < steps.length - 1 && (
                      <ChevronDown className="w-5 h-5 text-slate-600 flex-shrink-0 hidden sm:block mt-3" />
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* X-Plane Integration Highlight */}
      <section className="py-20 sm:py-32 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <Badge className="bg-purple-600/20 text-purple-400 border-purple-500/30 mb-4">X-Plane 12 Integration</Badge>
              <h2 className="text-3xl sm:text-4xl font-black mb-6">Jeder Flug zählt.<br /><span className="text-blue-400">Jede Landung wird bewertet.</span></h2>
              <div className="space-y-4">
                {[
                  { icon: Activity, text: "Echtzeit-Datenübertragung via FlyWithLua oder Python Plugin" },
                  { icon: Gauge, text: "Automatische Bewertung: Takeoff, Reiseflug & Landung" },
                  { icon: AlertTriangle, text: "Realistische Failures basierend auf Flugzeug-Wartungszustand" },
                  { icon: Fuel, text: "Kraftstoffverbrauch und Kostenberechnung in Echtzeit" },
                  { icon: Timer, text: "Deadline-System mit Zeitbonus für schnelle Auftragserfüllung" },
                  { icon: CheckCircle2, text: "Butter-Landungen unter 100 ft/min? Extra Bonus!" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <item.icon className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <Card className="bg-slate-900 border-slate-800 p-6 rounded-2xl">
                <div className="text-center mb-6">
                  <div className="text-6xl font-black text-white mb-1">94<span className="text-2xl text-slate-400">/100</span></div>
                  <div className="text-emerald-400 font-semibold">Exzellenter Flug</div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Takeoff", score: 96, color: "bg-emerald-500" },
                    { label: "Reiseflug", score: 92, color: "bg-blue-500" },
                    { label: "Landung", score: 98, color: "bg-amber-500" },
                  ].map((m, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-400">{m.label}</span>
                        <span className="text-white font-bold">{m.score}</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <motion.div initial={{ width: 0 }} whileInView={{ width: `${m.score}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3 + i * 0.2 }} className={`${m.color} h-2 rounded-full`} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-white">-87</div>
                    <div className="text-xs text-slate-500">ft/min VS</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-400">$24.800</div>
                    <div className="text-xs text-slate-500">Gewinn</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-amber-400">+15 XP</div>
                    <div className="text-xs text-slate-500">Erfahrung</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials / Social Proof */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp}>
              <Badge className="bg-amber-600/20 text-amber-400 border-amber-500/30 mb-4">Community</Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-4">
              Piloten lieben SkyCareer
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <TestimonialCard quote="Endlich hat X-Plane einen richtigen Career Mode! Die Wartungsmechanik allein ist schon genial." author="FlightSimmer92" role="Level 34 – Langstrecken-Ass" />
            <TestimonialCard quote="Das Finanzsystem mit Krediten und Kreditwürdigkeit gibt dem Ganzen eine unglaubliche Tiefe." author="AviationNerd_DE" role="Level 18 – Flug-Veteran" />
            <TestimonialCard quote="Jede Landung zählt wirklich. Seitdem fliege ich viel konzentrierter und die Butter-Landings fühlen sich doppelt gut an!" author="CaptainSchulz" role="Level 45 – Linien-Kapitän" />
          </motion.div>
        </div>
      </section>

      {/* Pricing / Free */}
      <section className="py-20 sm:py-32 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp}>
              <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 mb-4">Preis</Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-4">
              Komplett kostenlos.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400 mb-10">
              Kein Abo, keine versteckten Kosten, keine Kreditkarte. Alle Features, für immer.
            </motion.p>
            <motion.div variants={fadeUp}>
              <Card className="bg-slate-800/60 border-blue-500/30 p-8 rounded-2xl inline-block">
                <div className="text-5xl font-black text-white mb-2">$0</div>
                <div className="text-slate-400 mb-6">Für immer kostenlos</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-left mb-8">
                  {[
                    "Unbegrenzte Flüge",
                    "Alle Flugzeugtypen",
                    "Vollständiges Finanzsystem",
                    "100 Karriere-Level",
                    "Crew-Management",
                    "Echtzeit X-Plane Tracking",
                    "Wartungssystem",
                    "Globale Aufträge",
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
                <Button onClick={handleLogin} size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-10 py-6 w-full rounded-xl">
                  Jetzt kostenlos starten <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-600/5 to-transparent" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp}>
              <Award className="w-16 h-16 text-amber-400 mx-auto mb-6" />
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-6">
              Bereit zum Abheben?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
              Tausende Piloten bauen bereits ihr Luftfahrt-Imperium auf. Starte jetzt deine Karriere und zeige was in dir steckt.
            </motion.p>
            <motion.div variants={fadeUp}>
              <Button onClick={handleLogin} size="lg" className="bg-blue-600 hover:bg-blue-700 text-xl px-12 py-8 rounded-xl shadow-2xl shadow-blue-600/20">
                Airline gründen – kostenlos <ArrowRight className="w-6 h-6 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6983dde00291b5dfd85079e6/af6bde179_IMG_8197.jpg" alt="SkyCareer" className="w-6 h-6 rounded-lg object-cover" />
            <span className="text-sm text-slate-500">© 2026 SkyCareer – X-Plane 12 Career Mode</span>
          </div>
          <div className="text-xs text-slate-600">Made with ✈️ for Flight Sim Enthusiasts</div>
        </div>
      </footer>
    </div>
  );
}