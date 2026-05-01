import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from
"@/components/ui/dialog";
import {
  Plane, CreditCard, Calendar, ArrowUpRight, XCircle, User, Star, Shield,
  CheckCircle, AlertTriangle, Globe, RotateCcw, LogOut } from
"lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";
import DeleteAccountDialog from "@/components/account/DeleteAccountDialog";
import PricingCards from "@/components/subscription/PricingCards";
import SubscriptionStatus from "@/components/subscription/SubscriptionStatus";

export default function Account() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  const { data: company } = useQuery({
    queryKey: ['company', user?.company_id],
    queryFn: async () => {
      if (user?.company_id) {
        const companies = await base44.entities.Company.filter({ id: user.company_id });
        if (companies[0]) return companies[0];
      }
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      return companies[0];
    },
    enabled: !!user,
    staleTime: 120000,
    refetchOnWindowFocus: false
  });

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['subscription', user?.email],
    queryFn: async () => {
      const res = await base44.functions.invoke('lemonsqueezyGetSubscription', {});
      return res.data;
    },
    enabled: !!user,
    staleTime: 30000
  });

  const currentSub = subData?.subscription || null;
  const isPro = subData?.is_pro || false;

  const resetWord = "RESET";
  const canReset = resetConfirmText.trim().toUpperCase() === resetWord;

  const resetAccountMutation = useMutation({
    mutationFn: async () => {
      if (!company) return;

      const preservedName = company?.name || '';
      const preservedApiKey = company?.xplane_api_key || '';
      const preservedSimbriefUsername =
      company?.simbrief_username ?? user?.simbrief_username ?? null;
      const preservedSimbriefPilotId =
      company?.simbrief_pilot_id ?? user?.simbrief_pilot_id ?? null;

      const wipeEntity = async (entity, where) => {
        while (true) {
          const batch = await entity.filter(where, undefined, 200);
          if (!Array.isArray(batch) || batch.length === 0) break;
          for (const item of batch) {
            try {
              await entity.delete(item.id);
            } catch (_) {}
          }
          if (batch.length < 200) break;
        }
      };

      await wipeEntity(base44.entities.Flight, { company_id: company.id });
      await wipeEntity(base44.entities.Contract, { company_id: company.id });
      await wipeEntity(base44.entities.Transaction, { company_id: company.id });
      await wipeEntity(base44.entities.Employee, { company_id: company.id });
      await wipeEntity(base44.entities.Aircraft, { company_id: company.id });
      await wipeEntity(base44.entities.XPlaneLog, { company_id: company.id });

      await base44.entities.Company.update(company.id, {
        name: preservedName,
        xplane_api_key: preservedApiKey,
        simbrief_username: preservedSimbriefUsername,
        simbrief_pilot_id: preservedSimbriefPilotId,
        balance: 500000,
        reputation: 50,
        level: 1,
        total_flights: 0,
        total_passengers: 0,
        total_cargo_kg: 0,
        active_loan: null,
        overdraft_enabled: true,
        current_maintenance_ratio: 0,
        experience_points: 0,
        callsign: "",
        hub_airport: "",
        xplane_connection_status: "disconnected"
      });

      const templates = await base44.entities.AircraftTemplate.filter({ name: "Cessna 172 Skyhawk" });
      const template = templates[0];
      await base44.entities.Aircraft.create({
        company_id: company.id,
        name: "Cessna 172 Skyhawk",
        registration: "RESET-001",
        type: "small_prop",
        passenger_capacity: 3,
        cargo_capacity_kg: 100,
        fuel_consumption_per_hour: 35,
        range_nm: 640,
        purchase_price: 425000,
        maintenance_cost_per_hour: 25,
        status: "available",
        total_flight_hours: 0,
        current_value: 425000,
        image_url: template?.image_url
      });
    },
    onSuccess: () => {
      setShowResetDialog(false);
      setResetConfirmText('');
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['xplaneLogs'] });
      queryClient.invalidateQueries();
    }
  });

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Zibo Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-cyan-900/30 p-2 rounded-lg shadow-md">
        <div className="text-lg font-mono font-bold text-cyan-400 uppercase tracking-widest px-2">{t('account', lang)}</div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Profile */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6 bg-slate-800/80 border-slate-700 h-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-blue-500/20 rounded-lg"><User className="w-5 h-5 text-blue-400" /></div>
                <h3 className="text-lg font-semibold text-white">{lang === 'de' ? 'Profil' : 'Profile'}</h3>
              </div>
              <div className="space-y-2.5">
                {[
                { label: 'Name', value: user?.full_name },
                { label: 'Email', value: user?.email },
                { label: lang === 'de' ? 'Firma' : 'Company', value: company?.name },
                { label: 'Hub', value: company?.hub_airport },
                { label: 'Callsign', value: company?.callsign }].
                map((row, i) =>
                <div key={i} className="flex justify-between items-center p-3 bg-slate-900/60 rounded-lg">
                    <span className="text-slate-500 text-sm">{row.label}</span>
                    <span className="text-white font-medium text-sm">{row.value || '—'}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-amber-900/20 to-slate-900/60 rounded-lg border border-amber-700/20">
                  <span className="text-slate-500 text-sm">{t('level', lang)}</span>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-amber-400 font-bold">{company?.level || 1}</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Subscription */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <Card className="p-6 bg-gradient-to-br from-slate-800 to-blue-900/20 border-blue-700/40 h-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-emerald-500/20 rounded-lg"><Shield className="w-5 h-5 text-emerald-400" /></div>
                <h3 className="text-lg font-semibold text-white">{t('subscription_status', lang)}</h3>
                {isPro && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">PRO</Badge>}
              </div>
              {subLoading ?
              <div className="text-sm text-slate-500 font-mono">{lang === 'de' ? 'Lade...' : 'Loading...'}</div> :
              currentSub ?
              <SubscriptionStatus subscription={currentSub} /> :

              <div className="text-slate-300 text-sm">
                  {lang === 'de' ? 'Kein aktives Abo – wähle unten einen Plan.' : 'No active subscription – choose a plan below.'}
                </div>
              }
            </Card>
          </motion.div>
        </div>

        {/* Pricing Plans */}
        {!isPro &&
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-4">
            <h3 className="font-mono text-sm text-cyan-400 uppercase tracking-widest mb-3">
              {lang === 'de' ? 'SkyCareer Pro wählen' : 'Choose SkyCareer Pro'}
            </h3>
            <PricingCards currentSubscription={currentSub} />
          </motion.div>
        }

        {/* Logout */}
        <div className="mt-8">
          <Card className="p-4 bg-slate-800/60 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">
                  {lang === 'de' ? 'Abmelden' : 'Sign out'}
                </h4>
                <p className="text-xs text-slate-500">
                  {lang === 'de' ? 'Aus deinem Account ausloggen.' : 'Log out of your account.'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/20"
                onClick={() => base44.auth.logout()}>
                <LogOut className="w-4 h-4 mr-1" />
                {lang === 'de' ? 'Logout' : 'Logout'}
              </Button>
            </div>
          </Card>
        </div>

        {/* Danger Zone */}
        <div className="mt-12 pt-6 border-t border-red-900/20">
          <Card className="p-4 bg-amber-950/10 border border-amber-800/30 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-amber-400">
                  {lang === 'de' ? 'Account zurücksetzen' : 'Reset account data'}
                </h4>
                <p className="text-xs text-slate-500">
                  {lang === 'de' ?
                  'Setzt alle Daten zurück, behält aber Firmenname, API-Key und SimBrief-Daten.' :
                  'Resets all data but keeps company name, API key and SimBrief data.'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-700/50 text-amber-400 hover:bg-amber-900/20"
                onClick={() => setShowResetDialog(true)}>
                
                <RotateCcw className="w-4 h-4 mr-1" />
                {lang === 'de' ? 'Zurücksetzen' : 'Reset'}
              </Button>
            </div>
          </Card>

          <Card className="p-4 bg-red-950/10 border border-red-800/30">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-red-400">{lang === 'de' ? 'Gefahrenzone' : 'Danger Zone'}</h4>
                <p className="text-xs text-slate-500">{lang === 'de' ? 'Account und alle Daten unwiderruflich löschen' : 'Permanently delete account and all data'}</p>
              </div>
              <Button variant="outline" size="sm" className="border-red-700/50 text-red-400 hover:bg-red-900/20" onClick={() => setShowDeleteDialog(true)}>
                {t('delete_account', lang)}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <RotateCcw className="w-5 h-5" />
              {lang === 'de' ? 'Account-Daten zurücksetzen' : 'Reset account data'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {lang === 'de' ?
              'Dies löscht Flüge, Aufträge, Flugzeuge, Mitarbeiter, Transaktionen und Logs.' :
              'This deletes flights, contracts, aircraft, employees, transactions and logs.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-amber-950/20 border border-amber-700/40 rounded-lg text-sm text-amber-200">
              <p className="mb-2 font-semibold">{lang === 'de' ? 'Bleibt erhalten:' : 'Will be preserved:'}</p>
              <ul className="list-disc list-inside space-y-1 text-amber-300">
                <li>{lang === 'de' ? 'Firmenname' : 'Company name'}</li>
                <li>{lang === 'de' ? 'API-Key' : 'API key'}</li>
                <li>{lang === 'de' ? 'SimBrief Username & Pilot ID' : 'SimBrief username & pilot ID'}</li>
              </ul>
            </div>

            <div>
              <p className="text-sm text-slate-400 mb-2">
                {lang === 'de' ?
                `Zum Bestätigen "${resetWord}" eingeben:` :
                `Type "${resetWord}" to confirm:`}
              </p>
              <Input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder={resetWord}
                className="bg-slate-800 border-slate-600" />
              
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-slate-600 text-slate-300"
              onClick={() => setShowResetDialog(false)}>
              
              {lang === 'de' ? 'Abbrechen' : 'Cancel'}
            </Button>
            <Button
              variant="destructive"
              disabled={!canReset || resetAccountMutation.isPending}
              onClick={() => resetAccountMutation.mutate()}>
              
              {resetAccountMutation.isPending ?
              lang === 'de' ? 'Setze zurück...' : 'Resetting...' :
              lang === 'de' ? 'Jetzt zurücksetzen' : 'Reset now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteAccountDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} company={company} />
    </div>);

}