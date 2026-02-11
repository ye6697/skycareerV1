import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { CheckCircle2, X, Minus, Sparkles, Crown } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.08 } })
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

function CellIcon({ value }) {
  const lower = value.toLowerCase();
  if (lower === 'nein' || lower === 'no' || lower === 'none' || lower === 'keine') {
    return <X className="w-4 h-4 text-red-400 mx-auto" />;
  }
  if (lower.includes('partial') || lower.includes('teilweise') || lower.includes('limited') || lower.includes('eingeschränkt') || lower.includes('basic') || lower.includes('nur') || lower.includes('only') || lower.includes('begrenzt')) {
    return <Minus className="w-4 h-4 text-amber-400 mx-auto" />;
  }
  return null;
}

export default function ComparisonSection({ L, lang }) {
  return (
    <section className="py-16 sm:py-28 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
          <motion.div variants={fadeUp}>
            <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 mb-4">{lang === 'en' ? 'Comparison' : 'Vergleich'}</Badge>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-black mb-3">{L.compare_title}</motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-slate-400 max-w-2xl mx-auto">{L.compare_sub}</motion.p>
        </motion.div>

        {/* Desktop Table */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="hidden md:block">
          <Card className="bg-slate-800/30 border-slate-700/50 overflow-hidden rounded-2xl">
            {/* Header */}
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1.3fr] border-b border-slate-700/50">
              {L.compare_cols.map((col, i) => (
                <div key={i} className={`p-5 text-sm font-bold ${
                  i === 3 
                    ? 'bg-gradient-to-b from-blue-600/20 to-blue-600/5 text-blue-300 border-l-2 border-blue-500/40' 
                    : i === 0 ? 'text-slate-500' : 'text-slate-500 text-center'
                } ${i === 0 ? 'text-left' : i < 3 ? 'text-center' : 'text-center'}`}>
                  {i === 3 && <Crown className="w-4 h-4 inline mr-1.5 mb-0.5 text-amber-400" />}
                  {col}
                </div>
              ))}
            </div>
            {/* Rows */}
            {L.compare_rows.map((row, i) => (
              <div key={i} className={`grid grid-cols-[1.4fr_1fr_1fr_1.3fr] border-b border-slate-800/40 last:border-0 transition-colors hover:bg-slate-800/20`}>
                <div className="p-4 text-sm text-white font-medium flex items-center">{row.feature}</div>
                <div className="p-4 text-sm text-center flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <CellIcon value={row.basic} />
                    <span className="text-slate-500 text-xs">{row.basic}</span>
                  </div>
                </div>
                <div className="p-4 text-sm text-center flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <CellIcon value={row.advanced} />
                    <span className="text-slate-500 text-xs">{row.advanced}</span>
                  </div>
                </div>
                <div className="p-4 text-sm text-center border-l-2 border-blue-500/20 bg-blue-500/[0.03] flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-emerald-300 font-semibold text-xs">{row.sky}</span>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </motion.div>

        {/* Mobile: Card-based layout */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="md:hidden space-y-3">
          {L.compare_rows.map((row, i) => (
            <motion.div key={i} variants={fadeUp}>
              <Card className="bg-slate-800/40 border-slate-700/40 overflow-hidden">
                <div className="p-3 border-b border-slate-700/30">
                  <span className="text-sm font-bold text-white">{row.feature}</span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-700/30">
                  <div className="p-3 text-center">
                    <div className="text-[10px] text-slate-600 mb-1">{L.compare_cols[1]}</div>
                    <CellIcon value={row.basic} />
                    <div className="text-xs text-slate-500 mt-1">{row.basic}</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[10px] text-slate-600 mb-1">{L.compare_cols[2]}</div>
                    <CellIcon value={row.advanced} />
                    <div className="text-xs text-slate-500 mt-1">{row.advanced}</div>
                  </div>
                  <div className="p-3 text-center bg-blue-500/[0.06] border-l-2 border-blue-500/30">
                    <div className="text-[10px] text-blue-400 mb-1 font-bold">SkyCareer</div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                    <div className="text-xs text-emerald-400 font-semibold mt-1">{row.sky}</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}