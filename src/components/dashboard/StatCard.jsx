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
      <Card className={`relative overflow-hidden bg-slate-800 border-slate-700 backdrop-blur-sm p-3 sm:p-4 lg:p-6`}>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 sm:space-y-2 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wide truncate">{title}</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">{value}</p>
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
            <div className={`p-2 sm:p-3 rounded-xl ${iconColors[color]} flex-shrink-0`}>
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}