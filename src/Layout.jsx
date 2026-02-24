import React, { useState } from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { LanguageProvider, useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";
import {
        LayoutDashboard,
        FileText,
        Users,
        Plane,
        DollarSign,
        History,
        PlayCircle,
        Menu,
        X,
        Settings,
        ChevronRight,
        Activity,
        Star,
        Globe
      } from "lucide-react";

function getNavItems(lang) {
  return [
    { name: t('nav_dashboard', lang), icon: LayoutDashboard, path: "Dashboard" },
    { name: t('nav_contracts', lang), icon: FileText, path: "Contracts" },
    { name: t('nav_active_flights', lang), icon: PlayCircle, path: "ActiveFlights" },
    { name: t('nav_employees', lang), icon: Users, path: "Employees" },
    { name: t('nav_fleet', lang), icon: Plane, path: "Fleet" },
    { name: t('nav_finances', lang), icon: DollarSign, path: "Finances" },
    { name: t('nav_flight_history', lang), icon: History, path: "FlightHistory" },
    { name: t('nav_xplane_setup', lang), icon: Settings, path: "XPlaneSetup" },
    { name: t('nav_xplane_debug', lang), icon: Activity, path: "XPlaneDebug" },
    { name: t('account', lang), icon: Settings, path: "Account" },
    { name: t('nav_game_settings', lang), icon: Settings, path: "GameSettingsAdmin", adminOnly: true },
    { name: t('nav_aircraft_images', lang), icon: Plane, path: "AdminAircraftImages", adminOnly: true },
  ];
}

function LayoutInner({ children, currentPageName }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { lang, setLang } = useLanguage();
  const navItems = getNavItems(lang);

  // Load all layout data ONCE and never refetch automatically
  const [layoutData, setLayoutData] = useState({ company: null, gameSettings: null, user: null, loaded: false });

  React.useEffect(() => {
    if (layoutData.loaded) return;
    let cancelled = false;
    (async () => {
      try {
        const u = await base44.auth.me();
        const cid = u?.company_id || u?.data?.company_id;
        let comp = null;
        if (cid) {
          const companies = await base44.entities.Company.filter({ id: cid });
          comp = companies[0] || null;
        }
        if (!comp) {
          const companies = await base44.entities.Company.filter({ created_by: u.email });
          comp = companies[0] || null;
          if (comp) await base44.auth.updateMe({ company_id: comp.id });
        }
        const settings = await base44.entities.GameSettings.list();
        if (!cancelled) {
          setLayoutData({ company: comp, gameSettings: settings[0] || null, user: u, loaded: true });
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [layoutData.loaded]);

  const company = layoutData.company;
  const gameSettings = layoutData.gameSettings;
  const user = layoutData.user;

  const xplaneStatus = company?.xplane_connection_status || 'disconnected';

  if (currentPageName === "Setup" || currentPageName === "Landing") {
    return children;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-cyan-900 flex flex-col">
      {/* Universal Zibo-style Top Bar */}
      <div className="h-10 bg-slate-900 border-b border-cyan-900/50 flex items-center justify-between px-3 sticky top-0 z-50 flex-shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          {currentPageName !== "Dashboard" && (
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 font-mono text-[10px] uppercase border border-cyan-900/50">
                ◀ HOME
              </Button>
            </Link>
          )}
          <span className="font-mono text-xs font-bold text-cyan-500 uppercase tracking-widest">{currentPageName}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            <div className={`w-2 h-2 rounded-full ${xplaneStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : xplaneStatus === 'connecting' ? 'bg-amber-500' : 'bg-slate-600'}`} />
            <span className="text-[9px] font-mono uppercase text-slate-400">{xplaneStatus}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline-block bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
             XP: {company?.experience_points || 0} | ${company?.balance?.toLocaleString() || 0}
          </span>
          <button onClick={() => setLang(lang === 'en' ? 'de' : 'en')} className="text-[10px] font-mono font-bold text-cyan-400 uppercase border border-cyan-800 px-1.5 py-0.5 rounded bg-cyan-950/30 hover:bg-cyan-900/50 transition-colors">
            {lang}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 max-w-6xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
  }

  export default function Layout({ children, currentPageName }) {
                  return (
                  <LanguageProvider>
                  <LayoutInner currentPageName={currentPageName}>{children}</LayoutInner>
                  </LanguageProvider>
                  );
                  }