import React, { useState } from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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
        Star
      } from "lucide-react";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "Dashboard" },
  { name: "Aufträge", icon: FileText, path: "Contracts" },
  { name: "Aktive Flüge", icon: PlayCircle, path: "ActiveFlights" },
  { name: "Mitarbeiter", icon: Users, path: "Employees" },
  { name: "Flotte", icon: Plane, path: "Fleet" },
  { name: "Finanzen", icon: DollarSign, path: "Finances" },
  { name: "Flughistorie", icon: History, path: "FlightHistory" },
  { name: "X-Plane Setup", icon: Settings, path: "XPlaneSetup" },
  { name: "X-Plane Debug", icon: Activity, path: "XPlaneDebug" },
];

export default function Layout({ children, currentPageName }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const companies = await base44.entities.Company.list();
      return companies[0];
    },
    refetchInterval: 5000,
  });

  const xplaneStatus = company?.xplane_connection_status || 'disconnected';

  if (currentPageName === "Setup") {
    return children;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Plane className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white">SkyCareer</span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-50 bg-black/50"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[280px] bg-slate-800 border-r border-slate-700"
            >
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Plane className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-white">SkyCareer</span>
                    <p className="text-xs text-slate-400">X-Plane 12 Career</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <nav className="p-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = currentPageName === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={createPageUrl(item.path)}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        isActive 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}>
                        <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className="font-medium">{item.name}</span>
                        {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 z-40 w-64 bg-slate-800 border-r border-slate-700 flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Plane className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-white">SkyCareer</span>
              <p className="text-xs text-slate-400">X-Plane 12 Career Mode</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPageName === item.path;
            return (
              <Link key={item.path} to={createPageUrl(item.path)}>
                <motion.div 
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isActive 
                      ? 'bg-blue-500/20 text-blue-400' 
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span className="font-medium">{item.name}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="ml-auto w-1.5 h-1.5 bg-blue-400 rounded-full"
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-3">
                  <div className="p-3 bg-slate-900 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-400" />
                        <span className="text-xs text-slate-400 font-medium">Level {company?.level || 1}</span>
                      </div>
                      <span className="text-xs text-slate-400">{company?.experience_points || 0}/100 XP</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-amber-400 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${company?.experience_points || 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${
                        xplaneStatus === 'connected' ? 'bg-emerald-500' : 
                        xplaneStatus === 'connecting' ? 'bg-amber-500' : 
                        'bg-slate-500'
                      }`} />
                      <span className="text-xs text-slate-400 font-medium">X-Plane Status</span>
                    </div>
                    <p className="text-sm text-slate-300">
                      {xplaneStatus === 'connected' ? 'Verbunden' : 
                       xplaneStatus === 'connecting' ? 'Verbinde...' : 
                       'Getrennt'}
                    </p>
                  </div>
                </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}