import React, { useState } from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { LanguageProvider, useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";
import SubscriptionPaywall from "@/components/subscription/SubscriptionPaywall";
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
        Globe,
        Trophy
      } from "lucide-react";

const APP_UI_VERSION = 'app-2026-04-06-e-usedperm';

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
    { name: lang === 'de' ? 'Ranking' : 'Leaderboard', icon: Trophy, path: "Leaderboard" },
    { name: t('account', lang), icon: Settings, path: "Account" },
    { name: t('nav_game_settings', lang), icon: Settings, path: "GameSettingsAdmin", adminOnly: true },
    { name: t('nav_aircraft_images', lang), icon: Plane, path: "AdminAircraftImages", adminOnly: true },
    { name: lang === 'de' ? 'Gutscheincodes' : 'Discount Codes', icon: Star, path: "AdminDiscounts", adminOnly: true },
  ];
}

const FREE_PAGES = ["Dashboard", "Account", "Setup", "Landing"];

function LayoutInner({ children, currentPageName }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { lang, setLang } = useLanguage();
  const navItems = getNavItems(lang);

  // Load all layout data ONCE and never refetch automatically
  const [layoutData, setLayoutData] = useState({ company: null, gameSettings: null, user: null, isPro: false, loaded: false });

  React.useEffect(() => {
    if (layoutData.loaded) return;
    let cancelled = false;
    (async () => {
      let u = null;
      let comp = null;
      let settings = [];
      let isPro = false;
      try {
        u = await base44.auth.me();
        const cid = u?.company_id || u?.data?.company_id;
        if (cid) {
          const companies = await base44.entities.Company.filter({ id: cid });
          comp = companies[0] || null;
        }
        if (!comp) {
          const companies = await base44.entities.Company.filter({ created_by: u.email });
          comp = companies[0] || null;
          if (comp) await base44.auth.updateMe({ company_id: comp.id });
        }
        settings = await base44.entities.GameSettings.list();
      } catch (_) {}
      // Check subscription status separately – always runs
      try {
        const subRes = await base44.functions.invoke('lemonsqueezyGetSubscription', {});
        isPro = subRes.data?.is_pro || false;
      } catch (_) {}
      if (!cancelled) {
        setLayoutData({ company: comp, gameSettings: settings[0] || null, user: u, isPro, loaded: true });
      }
    })();
    return () => { cancelled = true; };
  }, [layoutData.loaded]);

  const company = layoutData.company;
  const gameSettings = layoutData.gameSettings;
  const user = layoutData.user;
  const isPro = layoutData.isPro;

  const xplaneStatus = company?.xplane_connection_status || 'disconnected';

  if (currentPageName === "Setup" || currentPageName === "Landing") {
    return children;
  }

  // Show paywall for non-free pages if user has no active subscription
  const needsPaywall = layoutData.loaded && !isPro && !FREE_PAGES.includes(currentPageName);
  const isLoadingPaywall = !layoutData.loaded && !FREE_PAGES.includes(currentPageName);
  console.log('[LAYOUT PAYWALL]', { currentPageName, loaded: layoutData.loaded, isPro, needsPaywall, isLoadingPaywall, isFree: FREE_PAGES.includes(currentPageName) });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-cyan-900 flex flex-col">
      {/* Universal Zibo-style Top Bar */}
      <div className="h-12 sm:h-10 bg-slate-900 border-b border-cyan-900/50 flex items-center justify-between px-2 sm:px-3 sticky top-0 z-50 flex-shrink-0 shadow-md overflow-visible">
        <div className="flex items-center gap-2 sm:gap-3 relative z-[51]">
          {currentPageName !== "Dashboard" && (
            <Link to={createPageUrl("Dashboard")} className="relative z-[51] touch-manipulation">
              <button className="h-10 sm:h-7 px-3 sm:px-2 text-cyan-400 hover:text-cyan-300 active:bg-cyan-950/50 hover:bg-cyan-950/30 font-mono text-xs sm:text-[10px] uppercase border border-cyan-900/50 rounded-md bg-transparent touch-manipulation select-none">
                ◀ HOME
              </button>
            </Link>
          )}
          <span className="font-mono text-xs font-bold text-cyan-500 uppercase tracking-widest">{currentPageName}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 relative z-[51]">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            <div className={`w-2 h-2 rounded-full ${xplaneStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : xplaneStatus === 'connecting' ? 'bg-amber-500' : 'bg-slate-600'}`} />
            <span className="text-[9px] font-mono uppercase text-slate-400">{xplaneStatus}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline-block bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
             XP: {company?.experience_points || 0} | ${company?.balance?.toLocaleString() || 0}
          </span>
          <span className="text-[8px] sm:text-[9px] font-mono text-slate-600 inline-block select-none">
            v {APP_UI_VERSION}
          </span>
          <button onClick={() => setLang(lang === 'en' ? 'de' : 'en')} className="h-10 w-10 sm:h-auto sm:w-auto sm:px-1.5 sm:py-0.5 flex items-center justify-center text-xs sm:text-[10px] font-mono font-bold text-cyan-400 uppercase border border-cyan-800 rounded bg-cyan-950/30 hover:bg-cyan-900/50 active:bg-cyan-900/70 transition-colors touch-manipulation select-none relative z-[52]">
            {lang}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 max-w-6xl mx-auto w-full">
        {isLoadingPaywall ? (
          <div className="flex items-center justify-center h-full min-h-[50vh]">
            <div className="w-8 h-8 border-4 border-cyan-900 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        ) : needsPaywall ? (
          <SubscriptionPaywall />
        ) : (
          children
        )}
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
