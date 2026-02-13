import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function XPlaneStatus({ status = "disconnected", isLoading }) {
  const { lang } = useLanguage();
  const statusConfig = {
    connected: {
      color: "bg-emerald-500",
      text: t('connected', lang),
      icon: Wifi,
      badge: "bg-emerald-100 text-emerald-700 border-emerald-200"
    },
    connecting: {
      color: "bg-amber-500",
      text: t('connecting', lang),
      icon: RefreshCw,
      badge: "bg-amber-100 text-amber-700 border-amber-200"
    },
    disconnected: {
      color: "bg-slate-400",
      text: t('disconnected', lang),
      icon: WifiOff,
      badge: "bg-slate-100 text-slate-600 border-slate-200"
    }
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold">{t('xplane_12', lang)}</h3>
            <p className="text-sm text-slate-400">{t('plugin_connection', lang)}</p>
          </div>
        </div>
        <Badge className={`${config.badge} border`}>
          <motion.div
            animate={status === "connecting" ? { rotate: 360 } : {}}
            transition={{ duration: 1, repeat: status === "connecting" ? Infinity : 0, ease: "linear" }}
            className="mr-1"
          >
            <StatusIcon className="w-3 h-3" />
          </motion.div>
          {config.text}
        </Badge>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full ${config.color}`}>
          <AnimatePresence>
            {status === "connected" && (
              <motion.div
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 1, repeat: Infinity }}
                className={`w-2 h-2 rounded-full ${config.color}`}
              />
            )}
          </AnimatePresence>
        </div>
        <span className="text-sm text-slate-300">
          {status === "connected" ? t('receiving_data', lang) : t('waiting_connection', lang)}
        </span>
      </div>

      <div className="p-3 bg-white/5 rounded-lg overflow-hidden">
        <p className="text-xs text-slate-300 mb-2">{t('plugin_endpoint', lang)}:</p>
        <code className="text-xs text-blue-400 break-all block overflow-wrap-anywhere">
          {window.location.origin}/api/receiveXPlaneData
        </code>
        <p className="text-xs text-slate-400 mt-2">
          {t('configure_endpoint', lang)}
        </p>
      </div>
    </Card>
  );
}