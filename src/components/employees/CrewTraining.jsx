import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  GraduationCap, Brain, Heart, Target, Zap, Clock, CheckCircle2
} from "lucide-react";

const TRAINING_OPTIONS = [
  { key: 'nerve', label: 'Nervenstärke', icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10', desc: 'Weniger Score-Abzug bei Events', boost: 5, cost: 2000, hours: 12 },
  { key: 'passenger_handling', label: 'Passagier-Umgang', icon: Heart, color: 'text-pink-400', bg: 'bg-pink-500/10', desc: 'Höherer Crew-Bonus auf Payout', boost: 5, cost: 1500, hours: 8 },
  { key: 'precision', label: 'Präzision', icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10', desc: 'Bessere Landebewertung', boost: 5, cost: 2500, hours: 16 },
  { key: 'efficiency', label: 'Effizienz', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10', desc: 'Weniger Treibstoffkosten-Bonus', boost: 5, cost: 1800, hours: 10 },
];

export default function CrewTraining({ employee, company }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const attrs = employee.attributes || {};
  const training = employee.training || {};

  useEffect(() => {
    if (!training.active) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [training.active]);

  // Check if training is complete
  const trainingComplete = training.active && training.started_at
    ? (Date.now() - new Date(training.started_at).getTime()) >= (training.duration_hours || 1) * 3600000
    : false;

  const trainingProgress = training.active && training.started_at
    ? Math.min(100, ((Date.now() - new Date(training.started_at).getTime()) / ((training.duration_hours || 1) * 3600000)) * 100)
    : 0;

  const trainingRemaining = training.active && training.started_at
    ? Math.max(0, ((training.duration_hours || 1) * 3600000) - (Date.now() - new Date(training.started_at).getTime()))
    : 0;

  const startTraining = useMutation({
    mutationFn: async (option) => {
      await base44.entities.Employee.update(employee.id, {
        training: {
          active: true,
          type: option.key,
          started_at: new Date().toISOString(),
          duration_hours: option.hours,
          cost: option.cost,
        }
      });
      if (company) {
        await base44.entities.Company.update(company.id, {
          balance: (company.balance || 0) - option.cost
        });
        await base44.entities.Transaction.create({
          company_id: company.id,
          type: 'expense',
          category: 'other',
          amount: option.cost,
          description: `Training: ${option.label} für ${employee.name}`,
          date: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    }
  });

  const completeTraining = useMutation({
    mutationFn: async () => {
      const option = TRAINING_OPTIONS.find(o => o.key === training.type);
      const boost = option?.boost || 5;
      const currentVal = attrs[training.type] || 50;
      const newVal = Math.min(100, currentVal + boost);
      const updatedAttrs = { ...attrs, [training.type]: newVal };
      // Also boost skill_rating slightly (+1)
      const newSkill = Math.min(100, (employee.skill_rating || 50) + 1);
      await base44.entities.Employee.update(employee.id, {
        attributes: updatedAttrs,
        skill_rating: newSkill,
        training: { active: false, type: null, started_at: null, duration_hours: 0, cost: 0 }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee'] });
    }
  });

  const fmtTime = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  return (
    <Card className="p-6 bg-slate-800 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <GraduationCap className="w-5 h-5 text-blue-400" />
        Training
      </h3>

      {training.active ? (
        <div className="space-y-4">
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-blue-300">
                {TRAINING_OPTIONS.find(o => o.key === training.type)?.label || training.type}
              </span>
              <Badge className={trainingComplete ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}>
                {trainingComplete ? 'Abgeschlossen!' : `${fmtTime(trainingRemaining)} verbleibend`}
              </Badge>
            </div>
            <Progress value={trainingProgress} className="h-2 bg-slate-700" />
          </div>
          {trainingComplete && (
            <Button
              onClick={() => completeTraining.mutate()}
              disabled={completeTraining.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Training abschließen (+{TRAINING_OPTIONS.find(o => o.key === training.type)?.boost || 5} Punkte)
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TRAINING_OPTIONS.map(option => {
            const Icon = option.icon;
            const currentVal = attrs[option.key] || 50;
            const atMax = currentVal >= 100;
            const canAfford = (company?.balance || 0) >= option.cost;
            const isAvailable = employee.status === 'available';
            return (
              <div key={option.key} className={`${option.bg} rounded-lg p-3 border border-slate-700/50`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${option.color}`} />
                  <span className="text-sm font-semibold text-white">{option.label}</span>
                  <span className={`text-xs font-mono ml-auto ${option.color}`}>{Math.round(currentVal)}/100</span>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">{option.desc}</p>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span><Clock className="w-3 h-3 inline mr-1" />{option.hours}h</span>
                  <span>+{option.boost} Punkte</span>
                  <span className="text-emerald-400">${option.cost.toLocaleString()}</span>
                </div>
                <Button
                  size="sm"
                  className="w-full bg-slate-700 hover:bg-slate-600 text-xs h-7"
                  disabled={atMax || !canAfford || !isAvailable || startTraining.isPending}
                  onClick={() => startTraining.mutate(option)}
                >
                  {atMax ? 'Maximum' : !canAfford ? 'Zu teuer' : !isAvailable ? 'Nicht verfügbar' : 'Training starten'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}