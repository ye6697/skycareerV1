import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plane, GraduationCap, CheckCircle2, Clock, DollarSign, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/LanguageContext';
import {
  AIRCRAFT_TYPES,
  TYPE_RATING_CONFIG,
  getTypeLabel,
  hasTypeRating,
  getTrainingProgress,
  formatRemainingTime,
  isPilotRole,
} from '@/lib/typeRatings';

export default function TypeRatingPanel({ employee, company }) {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState('');
  const [tick, setTick] = useState(0);

  // Re-render every 30s to keep the timer fresh while the panel is open.
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(i);
  }, []);

  const licenses = Array.isArray(employee?.licenses) ? employee.licenses : [];
  const activeTraining = getTrainingProgress(employee);
  const trainableTypes = AIRCRAFT_TYPES.filter((t) => !hasTypeRating(employee, t));

  const startTraining = useMutation({
    mutationFn: async (aircraftType) => {
      const cfg = TYPE_RATING_CONFIG[aircraftType];
      if (!cfg) throw new Error('Unknown type');
      if (!company) throw new Error('No company');
      if ((company.balance || 0) < cfg.cost) {
        throw new Error(lang === 'de' ? 'Nicht genug Geld' : 'Not enough money');
      }
      await base44.entities.Employee.update(employee.id, {
        type_rating_training: {
          active: true,
          type: aircraftType,
          started_at: new Date().toISOString(),
          duration_hours: cfg.hours,
          cost: cfg.cost,
        },
      });
      await base44.entities.Company.update(company.id, {
        balance: (company.balance || 0) - cfg.cost,
      });
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'salary',
        amount: cfg.cost,
        description: `${lang === 'de' ? 'Type-Rating Training' : 'Type-rating training'}: ${employee.name} - ${getTypeLabel(aircraftType, lang)}`,
        date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setSelectedType('');
    },
  });

  const completeTraining = useMutation({
    mutationFn: async () => {
      const tr = employee?.type_rating_training;
      if (!tr?.type) return;
      const newLicenses = Array.from(new Set([...licenses, tr.type]));
      await base44.entities.Employee.update(employee.id, {
        licenses: newLicenses,
        type_rating_training: { active: false, type: '', started_at: '', duration_hours: 0, cost: 0 },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  if (!isPilotRole(employee?.role)) return null;

  const isTrainingDone = activeTraining && activeTraining.progress >= 1;
  const insufficientFunds = selectedType && (company?.balance || 0) < (TYPE_RATING_CONFIG[selectedType]?.cost || 0);

  return (
    <Card className="p-6 bg-slate-800 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <GraduationCap className="w-5 h-5 text-cyan-400" />
        {lang === 'de' ? 'Type-Ratings' : 'Type-Ratings'}
      </h3>

      {/* Owned licenses */}
      <div className="mb-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
          {lang === 'de' ? 'Berechtigungen' : 'Licenses'}
        </p>
        {licenses.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {licenses.map((lic) => (
              <Badge key={lic} className="bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 gap-1">
                <Plane className="w-3 h-3" />
                {getTypeLabel(lic, lang)}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">
            {lang === 'de' ? 'Noch keine Type-Ratings' : 'No type-ratings yet'}
          </p>
        )}
      </div>

      {/* Active training */}
      {activeTraining && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-mono text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" />
              {lang === 'de' ? 'Training läuft' : 'Training running'}
            </span>
            <span className="text-xs font-mono text-cyan-400">
              {getTypeLabel(activeTraining.type, lang)}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mb-2 border border-cyan-900/40">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500"
              style={{ width: `${Math.round(activeTraining.progress * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {isTrainingDone
                ? (lang === 'de' ? 'Abgeschlossen' : 'Completed')
                : formatRemainingTime(activeTraining.remainingMs, lang)}
            </span>
            <span>{Math.round(activeTraining.progress * 100)}%</span>
          </div>
          {isTrainingDone && (
            <Button
              onClick={() => completeTraining.mutate()}
              disabled={completeTraining.isPending}
              className="w-full mt-2 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              {completeTraining.isPending
                ? (lang === 'de' ? 'Lizenz wird ausgestellt...' : 'Issuing license...')
                : (lang === 'de' ? 'Lizenz erhalten' : 'Receive license')}
            </Button>
          )}
        </motion.div>
      )}

      {/* Start new training */}
      {!activeTraining && trainableTypes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
            {lang === 'de' ? 'Neues Training starten' : 'Start new training'}
          </p>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger>
              <SelectValue placeholder={lang === 'de' ? 'Aircraft-Typ wählen...' : 'Select aircraft type...'} />
            </SelectTrigger>
            <SelectContent>
              {trainableTypes.map((t) => {
                const cfg = TYPE_RATING_CONFIG[t];
                return (
                  <SelectItem key={t} value={t}>
                    {getTypeLabel(t, lang)} · ${cfg.cost.toLocaleString()} · {cfg.hours}h
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {selectedType && (
            <div className="p-3 bg-slate-900/60 border border-slate-700 rounded-lg">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  {lang === 'de' ? 'Kosten' : 'Cost'}
                </span>
                <span className="text-amber-300 font-bold">
                  ${TYPE_RATING_CONFIG[selectedType].cost.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {lang === 'de' ? 'Dauer' : 'Duration'}
                </span>
                <span className="text-cyan-300 font-bold">
                  {TYPE_RATING_CONFIG[selectedType].hours}h
                </span>
              </div>
              {insufficientFunds && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {lang === 'de' ? 'Nicht genug Geld' : 'Not enough money'}
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => startTraining.mutate(selectedType)}
            disabled={!selectedType || insufficientFunds || startTraining.isPending}
            className="w-full bg-cyan-600 hover:bg-cyan-700"
          >
            <GraduationCap className="w-4 h-4 mr-2" />
            {startTraining.isPending
              ? (lang === 'de' ? 'Wird gestartet...' : 'Starting...')
              : (lang === 'de' ? 'Training starten' : 'Start training')}
          </Button>
        </div>
      )}

      {!activeTraining && trainableTypes.length === 0 && (
        <p className="text-sm text-emerald-400 text-center py-2">
          ✓ {lang === 'de' ? 'Alle Type-Ratings vorhanden' : 'All type-ratings owned'}
        </p>
      )}
    </Card>
  );
}