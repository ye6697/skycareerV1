import React from 'react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';

export default function AppScreenshot({ title, description, children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      {description && (
        <p className="text-sm text-slate-400 mb-3 leading-relaxed">{description}</p>
      )}
      <Card className={`bg-slate-900 border-slate-800 overflow-hidden rounded-2xl shadow-2xl shadow-blue-600/5 ${className}`}>
        <div className="bg-slate-800 px-4 py-2.5 flex items-center gap-2 border-b border-slate-700">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <span className="text-xs text-slate-500 ml-2">{title}</span>
        </div>
        <div className="p-4 sm:p-6 bg-gradient-to-br from-slate-800 to-slate-900">
          {children}
        </div>
      </Card>
    </motion.div>
  );
}