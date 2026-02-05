import React from 'react';
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function StatCard({ title, value, subtitle, icon: Icon, trend, color = "blue" }) {
  const colorClasses = {
    blue: "from-blue-500/10 to-blue-600/5 border-blue-200/50",
    green: "from-emerald-500/10 to-emerald-600/5 border-emerald-200/50",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-200/50",
    orange: "from-orange-500/10 to-orange-600/5 border-orange-200/50",
    red: "from-red-500/10 to-red-600/5 border-red-200/50"
  };

  const iconColors = {
    blue: "text-blue-600 bg-blue-100",
    green: "text-emerald-600 bg-emerald-100",
    purple: "text-purple-600 bg-purple-100",
    orange: "text-orange-600 bg-orange-100",
    red: "text-red-600 bg-red-100"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={`relative overflow-hidden bg-slate-800 border-slate-700 backdrop-blur-sm p-6`}>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
            {subtitle && (
              <p className="text-sm text-slate-400">{subtitle}</p>
            )}
            {trend !== undefined && (
              <p className={`text-sm font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </p>
            )}
          </div>
          {Icon && (
            <div className={`p-3 rounded-xl ${iconColors[color]}`}>
              <Icon className="w-6 h-6" />
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}