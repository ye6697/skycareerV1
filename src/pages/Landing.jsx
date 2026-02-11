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
  Target, Timer, Sparkles, Download, Copy, Check
} from 'lucide-react';

import LangToggle from '@/components/landing/LangToggle';
import AppScreenshot from '@/components/landing/AppScreenshot';
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

  useEffect(() => {
    base44.auth.isAuthenticated().then(setIsAuthenticated);
  }, []);

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
    { icon: BarChart3, title: L.f12_title, description: L.f12_desc, color: "bg-violet-600" },
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
            <motion.div variants={fadeUp}><Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 px-4 py-1.5 text-sm mb-6"><Zap className="w-3.5 h-3.5 mr-1.5" />{L.hero_badge}</Badge></motion.div>
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
              { value: "Live", label: L.stat_tracking, icon: Activity },
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

      {/* ═══════ APP SCREENSHOTS ═══════ */}
      <section id="screens" className="py-16 sm:py-28 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
            <motion.div variants={fadeUp}><Badge className="bg-purple-600/20 text-purple-400 border-purple-500/30 mb-4">{lang === 'en' ? 'App Preview' : 'App Vorschau'}</Badge></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-3">{L.screens_title}</motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400 max-w-2xl mx-auto">{L.screens_sub}</motion.p>
          </motion.div>

          {/* Dashboard Mock */}
          <div className="space-y-8">
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
                  <div className="flex items-center gap-4 text-xs text-slate-500"><span>✈️ Boeing 777-300ER</span><span>🎯 FL380</span><span>⏱️ 07:42:18</span><span className="text-emerald-400">● LIVE</span></div>
                  <div className="mt-3 w-full bg-slate-800 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full w-[67%]" /></div>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4"><div className="text-sm text-slate-400 mb-2 font-medium">{lang === 'en' ? 'Credit Score' : 'Kredit-Score'}</div><div className="text-3xl font-black text-emerald-400">AA+</div><div className="text-xs text-slate-500 mt-1">Score: 78/100</div></div>
              </div>
            </AppScreenshot>

            {/* 2-Column Screens */}
            <div className="grid md:grid-cols-2 gap-6">
              <AppScreenshot title={L.screen_contracts}>
                <div className="space-y-3">
                  {[
                    { route: "EDDM → LIRF", type: lang === 'en' ? "Passenger" : "Passagier", pax: "142 PAX", pay: "$38,200", diff: lang === 'en' ? "Medium" : "Mittel", diffColor: "text-amber-400" },
                    { route: "EGLL → KJFK", type: "Cargo", pax: "18,400 kg", pay: "$92,500", diff: "Hard", diffColor: "text-red-400" },
                    { route: "EDDF → LEMD", type: "Charter", pax: "68 PAX", pay: "$24,800", diff: "Easy", diffColor: "text-emerald-400" },
                  ].map((c, i) => (
                    <div key={i} className="bg-slate-900/50 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{c.route}</div>
                        <div className="text-xs text-slate-500">{c.type} • {c.pax} • <span className={c.diffColor}>{c.diff}</span></div>
                      </div>
                      <div className="text-emerald-400 font-bold text-sm">{c.pay}</div>
                    </div>
                  ))}
                </div>
              </AppScreenshot>

              <AppScreenshot title={L.screen_fleet}>
                <div className="space-y-3">
                  {[
                    { name: "Boeing 737 MAX 8", reg: "SC018", status: lang === 'en' ? "Available" : "Verfügbar", statusColor: "text-emerald-400", value: "$98.2M" },
                    { name: "Airbus A320neo", reg: "SC012", status: lang === 'en' ? "In Flight" : "Im Flug", statusColor: "text-blue-400", value: "$94.5M" },
                    { name: "Cessna Caravan", reg: "SC003", status: lang === 'en' ? "Maintenance" : "Wartung", statusColor: "text-amber-400", value: "$1.7M" },
                  ].map((a, i) => (
                    <div key={i} className="bg-slate-900/50 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{a.name}</div>
                        <div className="text-xs text-slate-500">{a.reg} • <span className={a.statusColor}>{a.status}</span></div>
                      </div>
                      <div className="text-slate-300 font-mono text-sm">{a.value}</div>
                    </div>
                  ))}
                </div>
              </AppScreenshot>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
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
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1"><span>EDDM</span><span>LIRF</span></div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full w-[73%]" /></div>
                  <div className="text-xs text-blue-400 text-center mt-1 font-mono">248 NM remaining</div>
                </div>
              </AppScreenshot>

              <AppScreenshot title={L.screen_finances}>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-emerald-500/10 rounded-lg p-2"><div className="text-[10px] text-slate-500">{lang === 'en' ? 'Revenue' : 'Einnahmen'}</div><div className="text-base font-bold text-emerald-400">$4,284,000</div></div>
                  <div className="bg-red-500/10 rounded-lg p-2"><div className="text-[10px] text-slate-500">{lang === 'en' ? 'Expenses' : 'Ausgaben'}</div><div className="text-base font-bold text-red-400">$1,892,000</div></div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-2">{lang === 'en' ? 'Credit Score' : 'Kreditwürdigkeit'}</div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-black text-emerald-400">AA</div>
                    <div className="flex-1 bg-slate-800 rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full w-[72%]" /></div>
                    <div className="text-xs text-slate-400">72/100</div>
                  </div>
                </div>
              </AppScreenshot>
            </div>

            <AppScreenshot title={L.screen_employees}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

      {/* ═══════ INSTALLATION GUIDE ═══════ */}
      <section className="py-16 sm:py-28 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
            <motion.div variants={fadeUp}><Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 mb-4">{lang === 'en' ? 'Installation' : 'Installation'}</Badge></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-3">{L.install_title}</motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400">{L.install_sub}</motion.p>
          </motion.div>

          {/* Plugin Options */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="grid md:grid-cols-2 gap-4 mb-8">
            <Card className="bg-emerald-900/20 border-emerald-700/40 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-emerald-600 text-white text-xs">{L.step1_lua_rec}</Badge>
                <span className="text-white font-bold">{L.step1_lua}</span>
              </div>
              <p className="text-sm text-slate-400 mb-3">{L.step1_lua_desc}</p>
              <div className="bg-slate-900/60 rounded-lg p-3 text-xs">
                <p className="text-slate-300 mb-1">{L.step2_lua_path}</p>
                <code className="text-emerald-400 break-all">X-Plane 12/Resources/plugins/FlyWithLua/Scripts/SkyCareer.lua</code>
              </div>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700/40 p-5">
              <span className="text-white font-bold mb-3 block">{L.step1_py}</span>
              <p className="text-sm text-slate-400 mb-3">{L.step1_py_desc}</p>
              <div className="bg-slate-900/60 rounded-lg p-3 text-xs">
                <p className="text-slate-300 mb-1">{L.step2_py_path}</p>
                <code className="text-blue-400 break-all">X-Plane 12/Resources/plugins/PythonPlugins/SkyCareer/</code>
              </div>
            </Card>
          </motion.div>

          {/* Steps */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="space-y-3">
            {installSteps.map((step, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Card className="bg-slate-800/60 border-slate-700/50 p-4 sm:p-5 hover:bg-slate-800 transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform">
                      <span className="text-base font-black text-white">{i + 1}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1"><step.icon className="w-4 h-4 text-blue-400" /><h3 className="text-base font-bold text-white">{step.title}</h3></div>
                      <p className="text-slate-400 text-sm">{step.desc}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════ X-PLANE INTEGRATION HIGHLIGHT ═══════ */}
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

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section className="py-16 sm:py-28 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
            <motion.div variants={fadeUp}><Badge className="bg-amber-600/20 text-amber-400 border-amber-500/30 mb-4">Community</Badge></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-3">{L.community_title}</motion.h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[{ q: L.t1_quote, a: L.t1_author, r: L.t1_role }, { q: L.t2_quote, a: L.t2_author, r: L.t2_role }, { q: L.t3_quote, a: L.t3_author, r: L.t3_role }].map((t, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Card className="bg-slate-800/40 border-slate-700/50 p-6 h-full">
                  <div className="flex gap-1 mb-3">{[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />)}</div>
                  <p className="text-slate-300 text-sm italic mb-4">"{t.q}"</p>
                  <p className="text-white font-semibold text-sm">{t.a}</p>
                  <p className="text-slate-500 text-xs">{t.r}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <section className="py-16 sm:py-28 px-4 sm:px-6 bg-slate-900/30">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp}><Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 mb-4">{L.price_badge}</Badge></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-3">{L.price_title}</motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400 mb-10">{L.price_sub}</motion.p>
            <motion.div variants={fadeUp}>
              <Card className="bg-slate-800/60 border-blue-500/30 p-8 rounded-2xl inline-block">
                <div className="text-5xl font-black text-white mb-2">$0</div>
                <div className="text-slate-400 mb-6">{L.price_free}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-left mb-8">
                  {L.price_features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />{f}</div>
                  ))}
                </div>
                <Button onClick={handleLogin} size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-10 py-6 w-full rounded-xl">{L.price_cta} <ArrowRight className="w-5 h-5 ml-2" /></Button>
              </Card>
            </motion.div>
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

      {/* Footer */}
      <footer className="border-t border-slate-800/50 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6983dde00291b5dfd85079e6/af6bde179_IMG_8197.jpg" alt="SkyCareer" className="w-6 h-6 rounded-lg object-cover" />
            <span className="text-sm text-slate-500">{L.footer}</span>
          </div>
          <div className="text-xs text-slate-600">{L.footer_tag}</div>
        </div>
      </footer>
    </div>
  );
}