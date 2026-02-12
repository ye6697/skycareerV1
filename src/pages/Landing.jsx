import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Plane, DollarSign, Users, TrendingUp, Award, Activity,
  ArrowRight, CheckCircle2, Wrench, Shield, BarChart3, Zap, Globe,
  Star, ChevronDown, Gauge, CreditCard, FileText, Fuel, AlertTriangle,
  Target, Timer, Sparkles, Download, Copy, Monitor, Cloud, RefreshCw,
  MessageSquare, Navigation, Calculator, Route
} from 'lucide-react';

import LangToggle from '@/components/landing/LangToggle';
import AppScreenshot from '@/components/landing/AppScreenshot';
import ComparisonSection from '@/components/landing/ComparisonSection';
import PricingSection from '@/components/landing/PricingSection';
import { t } from '@/components/landing/translations';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.08 } })
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

function FeatureCard({ icon: Icon, title, description, color }) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="bg-slate-800/60 backdrop-blur-sm border-slate-700/50 p-5 h-full hover:bg-slate-800 transition-all duration-500 hover:border-blue-500/40 hover:-translate-y-1 group">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${color} transition-transform group-hover:scale-110`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
      </Card>
    </motion.div>
  );
}

export default function Landing() {
  const [lang, setLang] = useState('en');
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const L = t[lang];
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.12], [1, 0.96]);

  useEffect(() => { base44.auth.isAuthenticated().then(setIsAuthenticated); }, []);
  const handleLogin = () => base44.auth.redirectToLogin('/Dashboard');

  const features = [
    { icon: Plane, title: L.f1_title, description: L.f1_desc, color: "bg-blue-600" },
    { icon: FileText, title: L.f2_title, description: L.f2_desc, color: "bg-indigo-600" },
    { icon: Users, title: L.f3_title, description: L.f3_desc, color: "bg-purple-600" },
    { icon: Activity, title: L.f4_title, description: L.f4_desc, color: "bg-emerald-600" },
    { icon: DollarSign, title: L.f5_title, description: L.f5_desc, color: "bg-green-600" },
    { icon: Wrench, title: L.f6_title, description: L.f6_desc, color: "bg-orange-600" },
    { icon: TrendingUp, title: L.f7_title, description: L.f7_desc, color: "bg-amber-600" },
    { icon: Gauge, title: L.f8_title, description: L.f8_desc, color: "bg-cyan-600" },
    { icon: Shield, title: L.f9_title, description: L.f9_desc, color: "bg-red-600" },
    { icon: AlertTriangle, title: L.f10_title, description: L.f10_desc, color: "bg-rose-600" },
    { icon: CreditCard, title: L.f11_title, description: L.f11_desc, color: "bg-teal-600" },
    { icon: Monitor, title: L.f12_title, description: L.f12_desc, color: "bg-violet-600" },
    { icon: Route, title: L.f13_title, description: L.f13_desc, color: "bg-sky-600" },
    { icon: Navigation, title: L.f14_title, description: L.f14_desc, color: "bg-indigo-600" },
    { icon: Calculator, title: L.f15_title, description: L.f15_desc, color: "bg-cyan-600" },
    { icon: MessageSquare, title: L.f16_title, description: L.f16_desc, color: "bg-pink-600" },
  ];

  const installSteps = [
    { icon: Download, title: L.step1_title, desc: L.step1_desc },
    { icon: Copy, title: L.step2_title, desc: lang === 'en' ? "Copy the downloaded file into the correct X-Plane 12 plugin folder and restart X-Plane." : "Kopiere die heruntergeladene Datei in den richtigen X-Plane 12 Plugin-Ordner und starte X-Plane neu." },
    { icon: Globe, title: L.step3_title, desc: L.step3_desc },
    { icon: Target, title: L.step4_title, desc: L.step4_desc },
    { icon: Sparkles, title: L.step5_title, desc: L.step5_desc },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6983dde00291b5dfd85079e6/af6bde179_IMG_8197.jpg" alt="SkyCareer" className="w-9 h-9 rounded-xl object-cover" />
            <span className="font-bold text-xl text-white hidden sm:block">SkyCareer</span>
            <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 text-xs hidden sm:flex">X-Plane 12</Badge>
          </div>
          <div className="flex items-center gap-3">
            <LangToggle lang={lang} setLang={setLang} />
            <Button onClick={handleLogin} className="bg-blue-600 hover:bg-blue-700 text-sm">
              {isAuthenticated ? L.nav_cta_auth : L.nav_cta} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <motion.section style={{ opacity: heroOpacity, scale: heroScale }} className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920&q=80')] bg-cover bg-center opacity-[0.06]" />
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 via-transparent to-slate-950" />
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-96 h-96 bg-purple-600/8 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 sm:pt-32 pb-16 sm:pb-24">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center">
            <motion.div variants={fadeUp}><Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 px-4 py-1.5 text-sm mb-6"><Zap className="w-3.5 h-3.5 mr-1.5" />{L.hero_badge}</Badge></motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="text-4xl sm:text-6xl lg:text-8xl font-black tracking-tight mb-6 leading-[0.9]">
              <span className="bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">{L.hero_h1_1}</span><br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">{L.hero_h1_2}</span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="text-base sm:text-lg text-slate-400 max-w-3xl mx-auto mb-3 leading-relaxed">{L.hero_sub}</motion.p>
            <motion.p variants={fadeUp} custom={3} className="text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto mb-10">{L.hero_tags}</motion.p>
            <motion.div variants={fadeUp} custom={4} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={handleLogin} size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-10 py-7 rounded-xl shadow-2xl shadow-blue-600/20">{L.hero_cta} <ArrowRight className="w-5 h-5 ml-2" /></Button>
              <Button size="lg" variant="outline" className="border-slate-700 text-white hover:bg-slate-800 text-lg px-10 py-7 rounded-xl" onClick={() => document.getElementById('screens').scrollIntoView({ behavior: 'smooth' })}>{L.hero_cta2} <ChevronDown className="w-5 h-5 ml-2" /></Button>
            </motion.div>
          </motion.div>
          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-16 sm:mt-24">
            {[
              { value: "50+", label: L.stat_aircraft, icon: Plane },
              { value: "100", label: L.stat_levels, icon: TrendingUp },
              { value: "∞", label: L.stat_routes, icon: Globe },
              { value: "30s", label: L.stat_setup, icon: Zap },
            ].map((s, i) => (
              <Card key={i} className="bg-slate-900/80 backdrop-blur border-slate-800 p-4 sm:p-5 text-center hover:border-slate-700 transition-colors">
                <s.icon className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                <div className="text-2xl sm:text-3xl font-black text-white">{s.value}</div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">{s.label}</div>
              </Card>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ═══════ PREMIUM GAME POSITIONING ═══════ */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Badge className="bg-amber-600/20 text-amber-400 border-amber-500/30 mb-4">{lang === 'en' ? 'Architecture' : 'Architektur'}</Badge>
              <h2 className="text-3xl sm:text-4xl font-black mb-6">{L.premium_title}</h2>
              <p className="text-slate-400 mb-6">{L.premium_sub}</p>
              <div className="space-y-3">
                {[L.premium_p1, L.premium_p2, L.premium_p3, L.premium_p4, L.premium_p5].map((txt, i) => {
                  const icons = [Monitor, Gauge, Zap, Cloud, RefreshCw];
                  const Ic = icons[i];
                  return <div key={i} className="flex items-start gap-3"><Ic className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" /><span className="text-slate-300 text-sm">{txt}</span></div>;
                })}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Card className="bg-slate-900 border-slate-800 p-6 rounded-2xl">
                <div className="text-center mb-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'How it works' : 'So funktioniert es'}</div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0"><Monitor className="w-5 h-5 text-white" /></div>
                    <div><div className="text-sm font-bold text-white">SkyCareer Web App</div><div className="text-xs text-slate-400">{lang === 'en' ? 'Full game runs in browser / AviTab' : 'Vollständiges Spiel im Browser / AviTab'}</div></div>
                  </div>
                  <div className="flex justify-center"><div className="w-px h-6 bg-slate-700 relative"><div className="absolute -top-1 left-1/2 -translate-x-1/2 text-xs text-slate-500">↕</div></div></div>
                  <div className="flex items-center gap-4 p-3 bg-slate-800 rounded-xl border border-slate-700">
                    <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0"><Zap className="w-5 h-5 text-amber-400" /></div>
                    <div><div className="text-sm font-bold text-white">{lang === 'en' ? 'Tiny Data Bridge' : 'Winzige Datenbrücke'}</div><div className="text-xs text-slate-400">{lang === 'en' ? '~1KB every few seconds • Zero FPS impact' : '~1KB alle paar Sekunden • Null FPS-Verlust'}</div></div>
                  </div>
                  <div className="flex justify-center"><div className="w-px h-6 bg-slate-700 relative"><div className="absolute -top-1 left-1/2 -translate-x-1/2 text-xs text-slate-500">↕</div></div></div>
                  <div className="flex items-center gap-4 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0"><Plane className="w-5 h-5 text-white" /></div>
                    <div><div className="text-sm font-bold text-white">X-Plane 12</div><div className="text-xs text-slate-400">{lang === 'en' ? 'Your simulator • Untouched performance' : 'Dein Simulator • Unveränderte Performance'}</div></div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════ COMPARISON TABLE ═══════ */}
      <ComparisonSection L={L} lang={lang} />

      {/* ═══════ APP SCREENSHOTS ═══════ */}
      <section id="screens" className="py-16 sm:py-28 px-4 sm:px-6 bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
            <motion.div variants={fadeUp}><Badge className="bg-purple-600/20 text-purple-400 border-purple-500/30 mb-4">{lang === 'en' ? 'App Preview' : 'App Vorschau'}</Badge></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-3">{L.screens_title}</motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400 max-w-2xl mx-auto">{L.screens_sub}</motion.p>
          </motion.div>

          <div className="space-y-8">
            {/* Dashboard */}
            <AppScreenshot title={L.screen_dashboard}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: lang === 'en' ? "Balance" : "Kontostand", value: "$2,450,000", color: "text-emerald-400", bg: "bg-emerald-500/10" },
                  { label: "Level 23", value: lang === 'en' ? "Charter Expert" : "Charter-Experte", color: "text-amber-400", bg: "bg-amber-500/10" },
                  { label: "Reputation", value: "87%", color: "text-blue-400", bg: "bg-blue-500/10" },
                  { label: lang === 'en' ? "Fleet" : "Flotte", value: "12 Aircraft", color: "text-purple-400", bg: "bg-purple-500/10" },
                ].map((item, i) => (
                  <div key={i} className={`${item.bg} rounded-xl p-3`}><div className="text-xs text-slate-500 mb-1">{item.label}</div><div className={`text-sm sm:text-lg font-bold ${item.color}`}>{item.value}</div></div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 bg-slate-900/50 rounded-xl p-4">
                  <div className="text-sm text-slate-400 mb-2 font-medium">{lang === 'en' ? 'Active Flight – EDDF → KJFK' : 'Aktiver Flug – EDDF → KJFK'}</div>
                  <div className="flex items-center gap-4 text-xs text-slate-500"><span>✈️ B777-300ER</span><span>🎯 FL380</span><span>⏱️ 07:42</span><span className="text-emerald-400">● LIVE</span></div>
                  <div className="mt-3 w-full bg-slate-800 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full w-[67%]" /></div>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4"><div className="text-sm text-slate-400 mb-2 font-medium">{lang === 'en' ? 'Credit Score' : 'Kredit-Score'}</div><div className="text-3xl font-black text-emerald-400">AA+</div><div className="text-xs text-slate-500 mt-1">Score: 78/100</div></div>
              </div>
            </AppScreenshot>

            {/* Contract Detail + Aircraft Market */}
            <div className="grid md:grid-cols-2 gap-6">
              <AppScreenshot title={L.screen_contract_detail}>
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-base font-bold text-white">{lang === 'en' ? 'Emergency Medical Supply' : 'Medizinischer Notfalltransport'}</div>
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">{lang === 'en' ? 'Emergency' : 'Notfall'}</Badge>
                  </div>
                  <div className="text-xs text-slate-500 mb-3">EDDF → LIMC • 420 NM • 2,800 kg Cargo</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                  <div className="text-xs text-slate-400 mb-2">{lang === 'en' ? 'Mission Briefing' : 'Missions-Briefing'}</div>
                  <div className="text-xs text-slate-300">{lang === 'en' ? 'Urgent medical supplies needed in Milan. Time-critical delivery with bonus for early arrival.' : 'Dringende medizinische Versorgung in Mailand benötigt. Zeitkritische Lieferung mit Bonus bei frühzeitiger Ankunft.'}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-emerald-500/10 rounded-lg p-2 text-center"><div className="text-xs text-slate-500">{lang === 'en' ? 'Payout' : 'Auszahlung'}</div><div className="text-sm font-bold text-emerald-400">$48,500</div></div>
                  <div className="bg-amber-500/10 rounded-lg p-2 text-center"><div className="text-xs text-slate-500">Deadline</div><div className="text-sm font-bold text-amber-400">95 min</div></div>
                  <div className="bg-blue-500/10 rounded-lg p-2 text-center"><div className="text-xs text-slate-500">Level</div><div className="text-sm font-bold text-blue-400">≥ 8</div></div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-2">{lang === 'en' ? 'Scoring' : 'Bewertung'}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-slate-500">{lang === 'en' ? 'Butter landing' : 'Butterweiche Landung'}: <span className="text-emerald-400">+40 pts</span></div>
                    <div className="text-slate-500">{lang === 'en' ? 'On time' : 'Pünktlich'}: <span className="text-emerald-400">+20 pts</span></div>
                    <div className="text-slate-500">{lang === 'en' ? 'Hard landing' : 'Harte Landung'}: <span className="text-red-400">-30 pts</span></div>
                    <div className="text-slate-500">Stall: <span className="text-red-400">-50 pts</span></div>
                  </div>
                </div>
              </AppScreenshot>

              <AppScreenshot title={L.screen_market}>
                <div className="space-y-3">
                  {[
                    { name: "Cessna 172", type: "Small Prop", price: "$425K", level: "1", range: "640 NM", pax: "3" },
                    { name: "Airbus A320neo", type: "Narrow-Body", price: "$100M", level: "17", range: "3,500 NM", pax: "180" },
                    { name: "Boeing 777-300ER", type: "Wide-Body", price: "$285M", level: "26", range: "7,370 NM", pax: "396" },
                    { name: "Boeing 747-8F", type: "Cargo", price: "$400M", level: "30", range: "4,120 NM", pax: "134t" },
                  ].map((a, i) => (
                    <div key={i} className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-semibold text-white">{a.name}</div>
                        <div className="text-emerald-400 font-bold text-sm">{a.price}</div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="text-blue-400">{a.type}</span>
                        <span>Lvl ≥{a.level}</span>
                        <span>{a.range}</span>
                        <span>{a.pax} {parseInt(a.pax) ? 'PAX' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </AppScreenshot>
            </div>

            {/* Fleet with Maintenance + Tracker */}
            <div className="grid md:grid-cols-2 gap-6">
              <AppScreenshot title={L.screen_fleet}>
                <div className="space-y-3">
                  {[
                    { name: "Boeing 737 MAX 8", reg: "SC018", cats: { engine: 12, hydraulics: 8, avionics: 5, landing_gear: 22 }, status: lang === 'en' ? "Available" : "Verfügbar", statusColor: "text-emerald-400" },
                    { name: "Airbus A320neo", reg: "SC012", cats: { engine: 67, hydraulics: 45, avionics: 32, landing_gear: 78 }, status: lang === 'en' ? "Maintenance!" : "Wartung!", statusColor: "text-amber-400" },
                  ].map((a, i) => (
                    <div key={i} className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div><div className="text-sm font-semibold text-white">{a.name}</div><div className="text-xs text-slate-500">{a.reg} • <span className={a.statusColor}>{a.status}</span></div></div>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {Object.entries(a.cats).map(([cat, val]) => (
                          <div key={cat}>
                            <div className="flex justify-between text-[10px] mb-0.5"><span className="text-slate-500 capitalize">{cat.replace('_', ' ')}</span><span className={val > 50 ? 'text-red-400' : val > 30 ? 'text-amber-400' : 'text-emerald-400'}>{val}%</span></div>
                            <div className="w-full bg-slate-800 rounded-full h-1"><div className={`h-1 rounded-full ${val > 50 ? 'bg-red-500' : val > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${val}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </AppScreenshot>

              <AppScreenshot title={L.screen_tracker}>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: lang === 'en' ? "Altitude" : "Höhe", val: "37,420", unit: "ft", color: "text-blue-400" },
                    { label: lang === 'en' ? "Speed" : "Geschw.", val: "482", unit: "kts", color: "text-emerald-400" },
                    { label: "V/S", val: "-1,240", unit: "fpm", color: "text-amber-400" },
                    { label: "G-Force", val: "1.02", unit: "G", color: "text-white" },
                  ].map((d, i) => (
                    <div key={i} className="bg-slate-900/50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500">{d.label}</div>
                      <div className={`text-base font-mono font-bold ${d.color}`}>{d.val}</div>
                      <div className="text-[10px] text-slate-600">{d.unit}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1"><span>EDDM</span><span>LIRF</span></div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full w-[73%]" /></div>
                  <div className="text-xs text-blue-400 text-center mt-1 font-mono">248 NM remaining</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-xs text-red-300">{lang === 'en' ? 'Event: Flaps Overspeed detected (-15 pts)' : 'Event: Klappen-Overspeed erkannt (-15 Pkt.)'}</span>
                </div>
              </AppScreenshot>
            </div>

            {/* Finances + Employees */}
            <div className="grid md:grid-cols-2 gap-6">
              <AppScreenshot title={L.screen_finances}>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-emerald-500/10 rounded-lg p-2"><div className="text-[10px] text-slate-500">{lang === 'en' ? 'Revenue' : 'Einnahmen'}</div><div className="text-base font-bold text-emerald-400">$4,284,000</div></div>
                  <div className="bg-red-500/10 rounded-lg p-2"><div className="text-[10px] text-slate-500">{lang === 'en' ? 'Expenses' : 'Ausgaben'}</div><div className="text-base font-bold text-red-400">$1,892,000</div></div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-2">{lang === 'en' ? 'Credit Score' : 'Kreditwürdigkeit'}</div>
                  <div className="flex items-center gap-3"><div className="text-2xl font-black text-emerald-400">AA</div><div className="flex-1 bg-slate-800 rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full w-[72%]" /></div><div className="text-xs text-slate-400">72/100</div></div>
                </div>
              </AppScreenshot>

              <AppScreenshot title={L.screen_employees}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: "Hans Weber", role: lang === 'en' ? "Captain" : "Kapitän", exp: "Senior", skill: 80, salary: "$6,500", color: "bg-amber-500/10" },
                    { name: "Julia Klein", role: lang === 'en' ? "First Officer" : "Erste Offizierin", exp: lang === 'en' ? "Intermediate" : "Fortgeschritten", skill: 62, salary: "$3,500", color: "bg-blue-500/10" },
                    { name: "Lisa Müller", role: lang === 'en' ? "Flight Attendant" : "Flugbegleiterin", exp: "Senior", skill: 85, salary: "$2,800", color: "bg-pink-500/10" },
                    { name: "Peter Keller", role: "Loadmaster", exp: lang === 'en' ? "Expert" : "Experte", skill: 90, salary: "$3,200", color: "bg-orange-500/10" },
                  ].map((e, i) => (
                    <div key={i} className={`${e.color} rounded-lg p-3`}>
                      <div className="text-sm font-semibold text-white">{e.name}</div>
                      <div className="text-xs text-slate-400">{e.role}</div>
                      <div className="text-xs text-slate-500 mt-1">{e.exp} • Skill: {e.skill}</div>
                      <div className="text-xs text-emerald-400 mt-1">{e.salary}/mo</div>
                    </div>
                  ))}
                </div>
              </AppScreenshot>
            </div>

            {/* NEW: Passenger Comments */}
            <div className="grid md:grid-cols-2 gap-6">
              <AppScreenshot title={L.screen_comments}>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-white">{lang === 'en' ? 'Passenger Feedback' : 'Passagier-Feedback'}</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs ml-auto">Score: 94</Badge>
                  </div>
                  {[
                    { text: lang === 'en' ? "Butter-smooth landing! That was professional!" : "Butterweiche Landung! Das war professionell!", sentiment: "positive" },
                    { text: lang === 'en' ? "I barely noticed we landed – perfect!" : "Ich habe kaum bemerkt, dass wir gelandet sind - perfekt!", sentiment: "positive" },
                    { text: lang === 'en' ? "Very pleasant, smooth flight. Like flying on clouds!" : "Sehr angenehmer, sanfter Flug. Wie auf Wolken!", sentiment: "positive" },
                    { text: lang === 'en' ? "5 stars! Can't get better than this." : "5 Sterne! Besser geht es nicht.", sentiment: "positive" },
                    { text: lang === 'en' ? "Will definitely recommend this airline!" : "Werde diese Airline weiterempfehlen!", sentiment: "positive" },
                  ].map((c, i) => (
                    <div key={i} className="bg-slate-900/50 rounded-lg p-2.5 flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Star className="w-3 h-3 text-emerald-400" />
                      </div>
                      <p className="text-xs text-slate-300 italic">"{c.text}"</p>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-600 text-center mt-2">{lang === 'en' ? '150+ unique comments based on landing, G-force, events & score' : '150+ einzigartige Kommentare basierend auf Landung, G-Kraft, Events & Score'}</p>
                </div>
              </AppScreenshot>

              {/* NEW: SimBrief Integration */}
              <AppScreenshot title={L.screen_simbrief}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Route className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-bold text-white">SimBrief</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs ml-auto">{lang === 'en' ? 'Auto-loaded' : 'Automatisch geladen'}</Badge>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><div className="text-[10px] text-slate-500">{lang === 'en' ? 'Departure' : 'Abflug'}</div><div className="text-sm font-bold text-emerald-400">EDDF / RWY 07C</div></div>
                      <div><div className="text-[10px] text-slate-500">{lang === 'en' ? 'Arrival' : 'Ankunft'}</div><div className="text-sm font-bold text-amber-400">LIRF / RWY 16R</div></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-slate-800 rounded p-2 text-center"><div className="text-[10px] text-slate-500">FL</div><div className="text-xs font-mono font-bold text-blue-400">380</div></div>
                      <div className="bg-slate-800 rounded p-2 text-center"><div className="text-[10px] text-slate-500">{lang === 'en' ? 'Distance' : 'Distanz'}</div><div className="text-xs font-mono font-bold text-white">520 NM</div></div>
                      <div className="bg-slate-800 rounded p-2 text-center"><div className="text-[10px] text-slate-500">ZFW</div><div className="text-xs font-mono font-bold text-white">62.4t</div></div>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-[10px] text-slate-500 mb-1.5">Route</div>
                    <p className="text-xs font-mono text-purple-400 break-all">ANEKI Y163 ASKIK T161 ROTAR UL608 RIVRA</p>
                  </div>
                  <p className="text-[10px] text-slate-600 text-center">{lang === 'en' ? 'Credentials saved at signup – flight plans auto-load per contract' : 'Zugangsdaten bei Registrierung gespeichert – Flugpläne laden automatisch pro Auftrag'}</p>
                </div>
              </AppScreenshot>
            </div>

            {/* NEW: Live Map + Performance Calculator */}
            <div className="grid md:grid-cols-2 gap-6">
              <AppScreenshot title={L.screen_livemap}>
                <div className="space-y-3">
                  <div className="bg-slate-950 rounded-lg p-3 relative overflow-hidden" style={{ minHeight: 180 }}>
                    {/* Simulated dark map */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 opacity-90" />
                    <div className="relative">
                      {/* Route line simulation */}
                      <svg viewBox="0 0 300 140" className="w-full h-auto">
                        <line x1="40" y1="100" x2="260" y2="30" stroke="#818cf8" strokeWidth="2" strokeDasharray="6,4" opacity="0.7" />
                        <line x1="40" y1="100" x2="160" y2="65" stroke="#3b82f6" strokeWidth="2.5" />
                        {/* Dep */}
                        <circle cx="40" cy="100" r="6" fill="#10b981" stroke="#064e3b" strokeWidth="2" />
                        <text x="40" y="120" textAnchor="middle" fill="#10b981" fontSize="9" fontFamily="monospace" fontWeight="bold">EDDF</text>
                        {/* Arr */}
                        <circle cx="260" cy="30" r="6" fill="#f59e0b" stroke="#78350f" strokeWidth="2" />
                        <text x="260" y="22" textAnchor="middle" fill="#f59e0b" fontSize="9" fontFamily="monospace" fontWeight="bold">LIRF</text>
                        {/* Aircraft */}
                        <polygon points="160,57 155,68 165,68" fill="#3b82f6" stroke="#1e40af" strokeWidth="1" />
                        {/* Waypoints */}
                        <rect x="96" y="78" width="6" height="6" fill="#a78bfa" stroke="#6d28d9" strokeWidth="1" transform="rotate(45,99,81)" />
                        <text x="99" y="95" textAnchor="middle" fill="#a78bfa" fontSize="7" fontFamily="monospace">ASKIK</text>
                        <rect x="197" y="48" width="6" height="6" fill="#a78bfa" stroke="#6d28d9" strokeWidth="1" transform="rotate(45,200,51)" />
                        <text x="200" y="45" textAnchor="middle" fill="#a78bfa" fontSize="7" fontFamily="monospace">RIVRA</text>
                        {/* Runway centerline */}
                        <line x1="260" y1="5" x2="260" y2="42" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
                      </svg>
                    </div>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-2 grid grid-cols-3 gap-2 text-center font-mono text-xs">
                    <div><span className="text-slate-500">HDG</span> <span className="text-white">142°</span></div>
                    <div><span className="text-slate-500">ALT</span> <span className="text-white">38,000 ft</span></div>
                    <div><span className="text-slate-500">GS</span> <span className="text-white">478 kts</span></div>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-2 flex justify-between text-xs font-mono">
                    <span className="text-purple-400">▸ ASKIK: 48 NM</span>
                    <span className="text-amber-400">ARR: 248 NM</span>
                  </div>
                  <p className="text-[10px] text-slate-600 text-center">{lang === 'en' ? 'FMS waypoints from X-Plane + SimBrief route + runway centerlines' : 'FMS-Wegpunkte aus X-Plane + SimBrief-Route + Runway-Centerlines'}</p>
                </div>
              </AppScreenshot>

              <AppScreenshot title={L.screen_perf}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calculator className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-bold text-white">{lang === 'en' ? 'Takeoff & Landing Calc' : 'Takeoff & Landing Kalkulator'}</span>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-emerald-400 font-semibold mb-2">{lang === 'en' ? 'Takeoff Performance' : 'Takeoff Performance'} – RWY 07C</div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="bg-blue-500/10 rounded p-2 text-center"><div className="text-[10px] text-slate-500">V1</div><div className="text-sm font-mono font-bold text-blue-400">142</div></div>
                      <div className="bg-blue-500/10 rounded p-2 text-center"><div className="text-[10px] text-slate-500">VR</div><div className="text-sm font-mono font-bold text-blue-400">148</div></div>
                      <div className="bg-blue-500/10 rounded p-2 text-center"><div className="text-[10px] text-slate-500">V2</div><div className="text-sm font-mono font-bold text-blue-400">155</div></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-800 rounded p-1.5"><div className="flex justify-between text-[10px]"><span className="text-slate-500">{lang === 'en' ? 'Rwy Required' : 'Bahn benötigt'}</span><span className="text-white">2,140 m</span></div></div>
                      <div className="bg-slate-800 rounded p-1.5"><div className="flex justify-between text-[10px]"><span className="text-slate-500">{lang === 'en' ? 'Density Alt' : 'Dichtehöhe'}</span><span className="text-white">1,240 ft</span></div></div>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-amber-400 font-semibold mb-2">{lang === 'en' ? 'Landing Performance' : 'Landing Performance'} – RWY 16R</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-amber-500/10 rounded p-2 text-center"><div className="text-[10px] text-slate-500">Vref</div><div className="text-sm font-mono font-bold text-amber-400">138</div></div>
                      <div className="bg-amber-500/10 rounded p-2 text-center"><div className="text-[10px] text-slate-500">Vapp</div><div className="text-sm font-mono font-bold text-amber-400">143</div></div>
                      <div className="bg-amber-500/10 rounded p-2 text-center"><div className="text-[10px] text-slate-500">{lang === 'en' ? 'Dist' : 'Dist'}</div><div className="text-sm font-mono font-bold text-amber-400">1,820m</div></div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 text-center">{lang === 'en' ? 'AI-powered V-speeds per aircraft type • Weather & weight adjustments' : 'KI-basierte V-Speeds pro Flugzeugtyp • Wetter- & Gewichtsanpassungen'}</p>
                </div>
              </AppScreenshot>
            </div>

            {/* AviTab Cockpit Screenshot */}
            <AppScreenshot title={L.screen_avitab}>
              <div className="relative">
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-600/20 px-3 py-1 rounded-lg border border-blue-500/30"><span className="text-xs text-blue-400 font-bold">AviTab Browser</span></div>
                    <div className="flex-1 bg-slate-800 rounded-lg px-3 py-1 text-xs text-slate-500 font-mono truncate">skycareer.app/dashboard</div>
                  </div>
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-4">
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { label: lang === 'en' ? "Alt" : "Höhe", val: "FL380", color: "text-blue-400" },
                        { label: "GS", val: "482 kts", color: "text-emerald-400" },
                        { label: "Score", val: "94/100", color: "text-amber-400" },
                        { label: "Fuel", val: "47%", color: "text-orange-400" },
                      ].map((d, i) => (
                        <div key={i} className="bg-slate-900 rounded p-2 text-center"><div className="text-[10px] text-slate-600">{d.label}</div><div className={`text-xs font-mono font-bold ${d.color}`}>{d.val}</div></div>
                      ))}
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">EDDF</span><span className="text-emerald-400 font-bold">● LIVE</span><span className="text-slate-500">KJFK</span></div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full w-[67%]" /></div>
                      <div className="text-[10px] text-slate-500 text-center mt-1">2,340 NM remaining • ETA 4h 52m</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-xs text-slate-500 italic">{L.avitab_sub}</p>
                </div>
              </div>
            </AppScreenshot>
          </div>
        </div>
      </section>

      {/* ═══════ MAINTENANCE DEEP DIVE ═══════ */}
      <section className="py-16 sm:py-28 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
            <motion.div variants={fadeUp}><Badge className="bg-orange-600/20 text-orange-400 border-orange-500/30 mb-4"><Wrench className="w-3.5 h-3.5 mr-1.5" />{lang === 'en' ? 'Core Feature' : 'Kern-Feature'}</Badge></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-3">{L.maint_title}</motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400 max-w-2xl mx-auto">{L.maint_sub}</motion.p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <Card className="bg-slate-800/60 border-slate-700/50 p-6 sm:p-8 mb-8">
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">{L.maint_desc}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {L.maint_cats.map((cat, i) => {
                  const values = [18, 45, 12, 72, 88, 34, 23, 56];
                  const v = values[i];
                  return (
                    <div key={i} className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{cat}</span><span className={v > 60 ? 'text-red-400 font-bold' : v > 40 ? 'text-amber-400' : 'text-emerald-400'}>{v}%</span></div>
                      <div className="w-full bg-slate-800 rounded-full h-2"><motion.div initial={{ width: 0 }} whileInView={{ width: `${v}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.1 }} className={`h-2 rounded-full ${v > 60 ? 'bg-red-500' : v > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} /></div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          {/* Consequences */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h3 variants={fadeUp} className="text-xl font-bold text-white mb-4">{L.maint_consequence_title}</motion.h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[L.maint_c1, L.maint_c2, L.maint_c3, L.maint_c4, L.maint_c5, L.maint_c6, L.maint_c7, L.maint_c8].map((txt, i) => (
                <motion.div key={i} variants={fadeUp}>
                  <Card className="bg-red-500/5 border-red-500/20 p-4 h-full">
                    <AlertTriangle className="w-4 h-4 text-red-400 mb-2" />
                    <p className="text-sm text-slate-300">{txt}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="py-16 sm:py-28 px-4 sm:px-6 bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
            <motion.div variants={fadeUp}><Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 mb-4">Features</Badge></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-3">{L.feat_title}</motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400 max-w-2xl mx-auto">{L.feat_sub}</motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {features.map((f, i) => <FeatureCard key={i} {...f} />)}
          </motion.div>
        </div>
      </section>

      {/* ═══════ INSTALLATION ═══════ */}
      <section className="py-16 sm:py-28 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
            <motion.div variants={fadeUp}><Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 mb-4">Installation</Badge></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-3">{L.install_title}</motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400">{L.install_sub}</motion.p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="grid md:grid-cols-2 gap-4 mb-8">
            <Card className="bg-emerald-900/20 border-emerald-700/40 p-5">
              <div className="flex items-center gap-2 mb-3"><Badge className="bg-emerald-600 text-white text-xs">{L.step1_lua_rec}</Badge><span className="text-white font-bold">{L.step1_lua}</span></div>
              <p className="text-sm text-slate-400 mb-3">{L.step1_lua_desc}</p>
              <div className="bg-slate-900/60 rounded-lg p-3 text-xs"><p className="text-slate-300 mb-1">{L.step2_lua_path}</p><code className="text-emerald-400 break-all">X-Plane 12/Resources/plugins/FlyWithLua/Scripts/SkyCareer.lua</code></div>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700/40 p-5">
              <span className="text-white font-bold mb-3 block">{L.step1_py}</span>
              <p className="text-sm text-slate-400 mb-3">{L.step1_py_desc}</p>
              <div className="bg-slate-900/60 rounded-lg p-3 text-xs"><p className="text-slate-300 mb-1">{L.step2_py_path}</p><code className="text-blue-400 break-all">X-Plane 12/Resources/plugins/PythonPlugins/SkyCareer/</code></div>
            </Card>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="space-y-3">
            {installSteps.map((step, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Card className="bg-slate-800/60 border-slate-700/50 p-4 sm:p-5 hover:bg-slate-800 transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform"><span className="text-base font-black text-white">{i + 1}</span></div>
                    <div><div className="flex items-center gap-2 mb-1"><step.icon className="w-4 h-4 text-blue-400" /><h3 className="text-base font-bold text-white">{step.title}</h3></div><p className="text-slate-400 text-sm">{step.desc}</p></div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════ X-PLANE INTEGRATION ═══════ */}
      <section className="py-16 sm:py-28 px-4 sm:px-6 bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Badge className="bg-purple-600/20 text-purple-400 border-purple-500/30 mb-4">X-Plane 12</Badge>
              <h2 className="text-3xl sm:text-4xl font-black mb-6">{L.xplane_title}<br /><span className="text-blue-400">{L.xplane_h2}</span></h2>
              <div className="space-y-3">
                {[L.xp1, L.xp2, L.xp3, L.xp4, L.xp5, L.xp6].map((txt, i) => {
                  const icons = [Activity, Gauge, AlertTriangle, Fuel, Timer, CheckCircle2];
                  const Ic = icons[i];
                  return <div key={i} className="flex items-start gap-3"><Ic className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" /><span className="text-slate-300 text-sm">{txt}</span></div>;
                })}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Card className="bg-slate-900 border-slate-800 p-6 rounded-2xl">
                <div className="text-center mb-5"><div className="text-5xl font-black text-white mb-1">94<span className="text-2xl text-slate-400">/100</span></div><div className="text-emerald-400 font-semibold">{L.xp_score}</div></div>
                <div className="space-y-3">
                  {[{ label: L.xp_takeoff, score: 96, color: "bg-emerald-500" }, { label: L.xp_cruise, score: 92, color: "bg-blue-500" }, { label: L.xp_landing, score: 98, color: "bg-amber-500" }].map((m, i) => (
                    <div key={i}><div className="flex justify-between text-sm mb-1"><span className="text-slate-400">{m.label}</span><span className="text-white font-bold">{m.score}</span></div><div className="w-full bg-slate-800 rounded-full h-2"><motion.div initial={{ width: 0 }} whileInView={{ width: `${m.score}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3 + i * 0.2 }} className={`${m.color} h-2 rounded-full`} /></div></div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-3 gap-3 text-center">
                  <div><div className="text-lg font-bold text-white">-87</div><div className="text-xs text-slate-500">{L.xp_vs}</div></div>
                  <div><div className="text-lg font-bold text-emerald-400">$24,800</div><div className="text-xs text-slate-500">{L.xp_profit}</div></div>
                  <div><div className="text-lg font-bold text-amber-400">+15 XP</div><div className="text-xs text-slate-500">{L.xp_xp}</div></div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <PricingSection L={L} lang={lang} onLogin={handleLogin} />

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section className="py-16 sm:py-28 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
            <motion.div variants={fadeUp}><Badge className="bg-amber-600/20 text-amber-400 border-amber-500/30 mb-4">Community</Badge></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-3">{L.community_title}</motion.h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[{ q: L.t1_quote, a: L.t1_author, r: L.t1_role }, { q: L.t2_quote, a: L.t2_author, r: L.t2_role }, { q: L.t3_quote, a: L.t3_author, r: L.t3_role }].map((item, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Card className="bg-slate-800/40 border-slate-700/50 p-6 h-full">
                  <div className="flex gap-1 mb-3">{[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />)}</div>
                  <p className="text-slate-300 text-sm italic mb-4">"{item.q}"</p>
                  <p className="text-white font-semibold text-sm">{item.a}</p>
                  <p className="text-slate-500 text-xs">{item.r}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section className="py-16 sm:py-28 px-4 sm:px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-600/5 to-transparent" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp}><Award className="w-16 h-16 text-amber-400 mx-auto mb-6" /></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-6">{L.cta_title}</motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">{L.cta_sub}</motion.p>
            <motion.div variants={fadeUp}><Button onClick={handleLogin} size="lg" className="bg-blue-600 hover:bg-blue-700 text-xl px-12 py-8 rounded-xl shadow-2xl shadow-blue-600/20">{L.cta_btn} <ArrowRight className="w-6 h-6 ml-2" /></Button></motion.div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-slate-800/50 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2"><img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6983dde00291b5dfd85079e6/af6bde179_IMG_8197.jpg" alt="SkyCareer" className="w-6 h-6 rounded-lg object-cover" /><span className="text-sm text-slate-500">{L.footer}</span></div>
          <div className="text-xs text-slate-600">{L.footer_tag}</div>
        </div>
      </footer>
    </div>
  );
}