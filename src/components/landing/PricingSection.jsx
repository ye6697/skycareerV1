import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Crown, Shield, Zap, Clock, Sparkles, Timer } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.08 } })
};
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

function CountdownTimer({ lang }) {
  const [time, setTime] = useState({ h: 47, m: 59, s: 59 });
  useEffect(() => {
    const saved = sessionStorage.getItem('sc_pricing_end');
    let endTime;
    if (saved) {
      endTime = parseInt(saved);
    } else {
      endTime = Date.now() + 48 * 60 * 60 * 1000;
      sessionStorage.setItem('sc_pricing_end', endTime.toString());
    }
    const tick = () => {
      const diff = Math.max(0, endTime - Date.now());
      setTime({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="flex items-center justify-center gap-2">
      <Timer className="w-4 h-4 text-red-400" />
      <span className="text-sm text-slate-400">{lang === 'en' ? 'Early Access ends in' : 'Early Access endet in'}</span>
      <div className="flex gap-1 font-mono">
        {[
          { val: String(time.h).padStart(2, '0'), label: 'h' },
          { val: String(time.m).padStart(2, '0'), label: 'm' },
          { val: String(time.s).padStart(2, '0'), label: 's' },
        ].map((t, i) => (
          <span key={i}>
            <span className="bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded text-sm">{t.val}</span>
            {i < 2 && <span className="text-red-400 mx-0.5">:</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function EarlyAdopterBar({ count, lang, label }) {
  const pct = Math.min((count / 500) * 100, 100);
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-amber-400 font-semibold">{count}/500 {label}</span>
        <span className="text-red-400 font-bold">{500 - count} {lang === 'en' ? 'spots left' : 'Plätze übrig'}</span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-2.5">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, delay: 0.3 }}
          className="bg-gradient-to-r from-amber-500 to-red-500 h-2.5 rounded-full"
        />
      </div>
    </div>
  );
}

export default function PricingSection({ L, lang, onLogin }) {
  return (
    <section className="py-16 sm:py-28 px-4 sm:px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-6">
          <motion.div variants={fadeUp}>
            <Badge className="bg-red-600/20 text-red-400 border-red-500/30 mb-4 px-4 py-1.5">
              <Zap className="w-3.5 h-3.5 mr-1.5" />{L.pricing_badge}
            </Badge>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-1">{L.pricing_title}</motion.h2>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-4">
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{L.pricing_title2}</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-slate-400 max-w-2xl mx-auto mb-3">{L.pricing_sub}</motion.p>
          <motion.div variants={fadeUp}>
            <CountdownTimer lang={lang} />
          </motion.div>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center text-xs text-red-400/80 font-medium mb-10">{L.pricing_early_note}</motion.p>

        {/* Pricing Cards */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-3 gap-5 items-start">

          {/* ══ LIFETIME ══ */}
          <motion.div variants={fadeUp} className="md:order-2 md:-mt-4">
            <Card className="relative bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-blue-500/50 p-0 overflow-hidden rounded-2xl shadow-2xl shadow-blue-500/10">
              {/* Top banner */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <Crown className="w-4 h-4 text-amber-300" />
                  <span className="text-white font-black text-sm tracking-wide">{L.pricing_lifetime_tag}</span>
                  <Crown className="w-4 h-4 text-amber-300" />
                </div>
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-bold text-white mb-1">{L.pricing_lifetime_title}</h3>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs mb-4">{L.pricing_lifetime_badge}</Badge>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl sm:text-6xl font-black text-white">€{L.pricing_lifetime_price}</span>
                </div>
                <p className="text-slate-500 text-sm mb-1">{L.pricing_lifetime_period}</p>
                <p className="text-blue-400 text-sm font-semibold mb-5">{L.pricing_lifetime_save}</p>
                <div className="space-y-2.5 mb-6">
                  {L.pricing_lifetime_features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${i === L.pricing_lifetime_features.length - 1 ? 'text-amber-400' : 'text-emerald-400'}`} />
                      <span className={`text-sm ${i === L.pricing_lifetime_features.length - 1 ? 'text-amber-300 font-semibold' : 'text-slate-300'}`}>{f}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={onLogin} size="lg" className="w-full bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400 hover:from-cyan-300 hover:via-blue-300 hover:to-emerald-300 text-black text-base py-6 rounded-xl shadow-lg shadow-cyan-400/30 font-bold">
                  {L.pricing_lifetime_cta} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <EarlyAdopterBar count={127} lang={lang} label={L.pricing_lifetime_fomo} />
              </div>
            </Card>
          </motion.div>

          {/* ══ ANNUAL ══ */}
          <motion.div variants={fadeUp} className="md:order-1">
            <Card className="relative bg-slate-800/60 border-slate-700/50 p-0 overflow-hidden rounded-2xl">
              <div className="bg-emerald-600/20 p-2.5 text-center border-b border-emerald-500/20">
                <span className="text-emerald-400 font-bold text-xs tracking-wide">{L.pricing_annual_tag}</span>
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-bold text-white mb-4">{L.pricing_annual_title}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl sm:text-5xl font-black text-white">€{L.pricing_annual_price}</span>
                  <span className="text-slate-500 text-base">{L.pricing_annual_period}</span>
                </div>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-emerald-400 text-sm font-semibold">{L.pricing_annual_save}</span>
                  <span className="text-slate-500 text-xs">{L.pricing_annual_monthly}</span>
                </div>
                <div className="space-y-2.5 mb-6">
                  {L.pricing_annual_features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-300">{f}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={onLogin} size="lg" className="w-full bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black text-base py-6 rounded-xl shadow-lg shadow-emerald-400/20 font-bold">
                  {L.pricing_annual_cta} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* ══ MONTHLY ══ */}
          <motion.div variants={fadeUp} className="md:order-3">
            <Card className="relative bg-slate-800/60 border-slate-700/50 p-0 overflow-hidden rounded-2xl">
              <div className="bg-slate-700/30 p-2.5 text-center border-b border-slate-700/30">
                <span className="text-slate-400 font-bold text-xs tracking-wide">{L.pricing_monthly_save.toUpperCase()}</span>
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-bold text-white mb-4">{L.pricing_monthly_title}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl sm:text-5xl font-black text-white">€{L.pricing_monthly_price}</span>
                  <span className="text-slate-500 text-base">{L.pricing_monthly_period}</span>
                </div>
                <p className="text-slate-500 text-sm mb-5">{L.pricing_monthly_save}</p>
                <div className="space-y-2.5 mb-6">
                  {L.pricing_monthly_features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-300">{f}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={onLogin} size="lg" className="w-full bg-gradient-to-r from-blue-400 to-purple-400 hover:from-blue-300 hover:to-purple-300 text-black text-base py-6 rounded-xl shadow-lg shadow-blue-400/20 font-bold">
                  {L.pricing_monthly_cta} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>
          </motion.div>
        </motion.div>

        {/* Guarantee */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mt-8">
          <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-full px-5 py-2.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-400">{L.pricing_guarantee}</span>
          </div>
        </motion.div>

        {/* FOMO Banner */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-12">
          <Card className="bg-gradient-to-r from-red-500/10 via-orange-500/10 to-amber-500/10 border-red-500/20 p-6 sm:p-8 rounded-2xl text-center">
            <Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-3" />
            <h3 className="text-xl sm:text-2xl font-black text-white mb-2">{L.pricing_fomo_headline}</h3>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">{L.pricing_fomo_sub}</p>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}