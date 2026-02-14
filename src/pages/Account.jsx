import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Plane, CreditCard, Calendar, RefreshCw, ArrowUpRight, XCircle, User, Star, Shield } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function Account() {
  const { lang } = useLanguage();

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

  // Mock subscription data (replace with real subscription logic)
  const subscription = {
    plan: 'SkyCareer Pro',
    status: 'active',
    nextPayment: '2026-03-14',
    price: '$9.99/mo'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Plane className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{t('account_management', lang)}</h1>
              <p className="text-slate-400">{user?.email}</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Profile Card */}
          <Card className="p-6 bg-slate-800/80 border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">{lang === 'de' ? 'Profil' : 'Profile'}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                <span className="text-slate-400 text-sm">{lang === 'de' ? 'Name' : 'Name'}</span>
                <span className="text-white font-medium">{user?.full_name || '—'}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                <span className="text-slate-400 text-sm">Email</span>
                <span className="text-white font-medium text-sm">{user?.email || '—'}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                <span className="text-slate-400 text-sm">{lang === 'de' ? 'Firma' : 'Company'}</span>
                <span className="text-white font-medium">{company?.name || '—'}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                <span className="text-slate-400 text-sm">{t('level', lang)}</span>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400 font-bold">{company?.level || 1}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Subscription Card */}
          <Card className="p-6 bg-gradient-to-br from-slate-800 to-blue-900/30 border-blue-700/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">{t('subscription_status', lang)}</h3>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                {lang === 'de' ? 'Aktiv' : 'Active'}
              </Badge>
            </div>
            <div className="space-y-3">
              <div className="p-4 bg-slate-900/60 rounded-lg">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Plan</p>
                <p className="text-xl font-bold text-white">{subscription.plan}</p>
                <p className="text-sm text-blue-400 font-medium">{subscription.price}</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-900/60 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400 text-sm">{t('next_payment', lang)}</span>
                </div>
                <span className="text-white font-mono text-sm">{subscription.nextPayment}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Subscription Actions */}
        <Card className="mt-6 p-6 bg-slate-800/80 border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            {lang === 'de' ? 'Abo verwalten' : 'Manage Subscription'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button className="bg-blue-600 hover:bg-blue-700 h-auto py-3 flex-col gap-1">
              <RefreshCw className="w-5 h-5" />
              <span className="text-sm">{t('extend_subscription', lang)}</span>
            </Button>
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white h-auto py-3 flex-col gap-1">
              <ArrowUpRight className="w-5 h-5" />
              <span className="text-sm">{t('change_plan', lang)}</span>
            </Button>
            <Button variant="outline" className="border-red-700/50 text-red-400 hover:text-red-300 hover:bg-red-900/20 h-auto py-3 flex-col gap-1">
              <XCircle className="w-5 h-5" />
              <span className="text-sm">{t('cancel_subscription', lang)}</span>
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            {lang === 'de'
              ? 'Bei Kündigung bleibt dein Account bis Ende der Vertragslaufzeit nutzbar und wird danach deaktiviert.'
              : 'Upon cancellation, your account remains usable until the end of the subscription period and is then deactivated.'}
          </p>
        </Card>
      </div>
    </div>
  );
}