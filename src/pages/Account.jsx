import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  Plane, CreditCard, Calendar, ArrowUpRight, XCircle, User, Star, Shield,
  CheckCircle, AlertTriangle, Globe
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";
import DeleteAccountDialog from "@/components/account/DeleteAccountDialog";

export default function Account() {
  const { lang } = useLanguage();
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
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
    refetchOnWindowFocus: false,
  });

  const subscription = {
    plan: 'SkyCareer Pro',
    status: 'active',
    nextPayment: '2026-03-14',
    price: '$8.99/mo'
  };

  const plans = [
    { id: 'monthly', name: lang === 'de' ? 'Monats-Pro' : 'Monthly Pro', price: '8.99', period: lang === 'de' ? '/Monat' : '/month', features: lang === 'de' ? ['Alle Pro-Features', 'Jederzeit kündbar', 'Volle Flexibilität'] : ['All Pro features', 'Cancel anytime', 'Full flexibility'] },
    { id: 'annual', name: lang === 'de' ? 'Jahres-Pro' : 'Annual Pro', price: '79', period: lang === 'de' ? '/Jahr' : '/year', badge: lang === 'de' ? 'AM BELIEBTESTEN' : 'MOST POPULAR', save: lang === 'de' ? '26% günstiger' : 'Save 26%', features: lang === 'de' ? ['Alle Pro-Features', '≈ 6,58 €/Monat', 'AviTab Unterstützung'] : ['All Pro features', '≈ $6.58/month', 'AviTab support'] },
    { id: 'lifetime', name: 'Lifetime Premium', price: '129', period: lang === 'de' ? 'Einmalzahlung' : 'one-time', badge: lang === 'de' ? 'BESTER DEAL' : 'BEST VALUE', features: lang === 'de' ? ['Alle Features, für immer', 'Alle zukünftigen Updates', 'Early Adopter Badge'] : ['All features, forever', 'All future updates', 'Early Adopter Badge'] },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600/20 via-cyan-600/10 to-blue-600/20 border border-blue-700/30 p-6">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-8 text-blue-300"><Plane className="w-24 h-24 rotate-12" /></div>
            </div>
            <div className="relative flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Plane className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{company?.name || 'SkyCareer'}</h1>
                <p className="text-slate-400">{user?.full_name} • {user?.email}</p>
              </div>
            </div>
          </div>
        </motion.div>

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
                  { label: 'Callsign', value: company?.callsign },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-900/60 rounded-lg">
                    <span className="text-slate-500 text-sm">{row.label}</span>
                    <span className="text-white font-medium text-sm">{row.value || '—'}</span>
                  </div>
                ))}
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
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg"><Shield className="w-5 h-5 text-emerald-400" /></div>
                  <h3 className="text-lg font-semibold text-white">{t('subscription_status', lang)}</h3>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{lang === 'de' ? 'Aktiv' : 'Active'}</Badge>
              </div>
              <div className="p-4 bg-slate-900/60 rounded-xl mb-3 border border-slate-700/50">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Plan</p>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">PRO</Badge>
                </div>
                <p className="text-xl font-bold text-white">{subscription.plan}</p>
                <p className="text-sm text-blue-400 font-medium">{subscription.price}</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-900/60 rounded-lg mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400 text-sm">{t('next_payment', lang)}</span>
                </div>
                <span className="text-white font-mono text-sm">{subscription.nextPayment}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white" onClick={() => setShowChangePlan(true)}>
                  <ArrowUpRight className="w-4 h-4 mr-1" /> {t('change_plan', lang)}
                </Button>
                <Button variant="outline" className="border-red-700/50 text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={() => setShowCancelDialog(true)}>
                  <XCircle className="w-4 h-4 mr-1" /> {t('cancel_subscription', lang)}
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Danger Zone */}
        <div className="mt-12 pt-6 border-t border-slate-800/50">
          <button onClick={() => setShowDeleteDialog(true)} className="text-xs text-slate-600 hover:text-red-400 transition-colors">
            {t('delete_account', lang)}
          </button>
        </div>
      </div>

      {/* Change Plan Dialog */}
      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <DialogContent className="max-w-xl bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white"><CreditCard className="w-5 h-5 text-blue-400" />{t('change_plan', lang)}</DialogTitle>
            <DialogDescription className="text-slate-400">{lang === 'de' ? 'Wähle deinen neuen Plan.' : 'Choose your new plan.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {plans.map(plan => (
              <div key={plan.id} className={`p-4 rounded-xl border transition-colors cursor-pointer hover:border-blue-500/50 ${plan.id === 'annual' ? 'border-blue-500/40 bg-blue-950/20' : 'border-slate-700 bg-slate-800/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white">{plan.name}</h4>
                    {plan.badge && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">{plan.badge}</Badge>}
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-white">${plan.price}</span>
                    <span className="text-xs text-slate-400 ml-1">{plan.period}</span>
                  </div>
                </div>
                {plan.save && <p className="text-xs text-emerald-400 mb-2">{plan.save}</p>}
                <div className="flex flex-wrap gap-2">
                  {plan.features.map((f, i) => (
                    <span key={i} className="text-[11px] text-slate-400 flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-400" /> {f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button className="w-full mt-2 bg-blue-600 hover:bg-blue-700" onClick={() => setShowChangePlan(false)}>
            {lang === 'de' ? 'Plan bestätigen' : 'Confirm Plan'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400"><AlertTriangle className="w-5 h-5" />{t('cancel_subscription', lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-red-950/20 border border-red-700/40 rounded-lg">
              <p className="text-sm text-red-300">{lang === 'de' ? 'Bei Kündigung bleibt dein Account bis Ende der Vertragslaufzeit nutzbar. Danach wird dein Account deaktiviert (nicht gelöscht). Du kannst jederzeit wieder ein Abo abschließen.' : 'Upon cancellation, your account remains usable until the end of the subscription period. After that, your account will be deactivated (not deleted). You can resubscribe at any time.'}</p>
            </div>
            <div className="p-3 bg-slate-800 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">{lang === 'de' ? 'Aktiver Plan' : 'Current Plan'}</span>
                <span className="text-white font-medium">{subscription.plan}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-slate-400">{lang === 'de' ? 'Nutzbar bis' : 'Usable until'}</span>
                <span className="text-white font-mono">{subscription.nextPayment}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-slate-600 text-slate-300" onClick={() => setShowCancelDialog(false)}>{t('back', lang)}</Button>
              <Button variant="destructive" className="flex-1" onClick={() => setShowCancelDialog(false)}>
                {lang === 'de' ? 'Jetzt kündigen' : 'Cancel Now'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteAccountDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} company={company} />
    </div>
  );
}