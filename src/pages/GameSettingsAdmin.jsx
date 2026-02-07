import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Save, AlertTriangle, Settings, RotateCcw } from "lucide-react";

export default function GameSettingsAdmin() {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const allSettings = await base44.entities.GameSettings.list();
      return allSettings[0] || null;
    }
  });

  const [formData, setFormData] = useState({});

  React.useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const defaultSettings = {
    tailstrike_score_penalty: 20,
    tailstrike_maintenance_percent: 2,
    stall_score_penalty: 50,
    overstress_score_penalty: 30,
    overstress_maintenance_percent: 4,
    flaps_overspeed_score_penalty: 15,
    flaps_overspeed_maintenance_percent: 2.5,
    g_force_threshold: 1.5,
    g_force_score_penalty: 25,
    g_force_maintenance_percent_per_g: 1,
    hard_landing_vs_threshold: 600,
    hard_landing_score_penalty: 15,
    hard_landing_maintenance_percent: 1,
    soft_landing_vs_threshold: 150,
    soft_landing_score_bonus: 5,
    butter_landing_vs_threshold: 100,
    butter_landing_score_bonus: 10,
    crash_vs_threshold: 1000,
    crash_score_penalty: 100,
    crash_maintenance_percent: 70,
    level_1_4_title: "Freizeit-Simmer",
    level_5_8_title: "Hobby-Pilot",
    level_9_12_title: "Regional-Kapitän",
    level_13_16_title: "Airline-Profi",
    level_17_20_title: "Flug-Veteran",
    level_21_30_title: "Charter-Experte",
    level_31_40_title: "Langstrecken-Ass",
    level_41_50_title: "Linien-Kapitän",
    level_51_60_title: "Flotten-Chef",
    level_61_70_title: "Luftfahrt-Mogul",
    level_71_80_title: "Aviation-Tycoon",
    level_81_90_title: "Sky-Emperor",
    level_91_100_title: "Luftfahrt-Legende"
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (settings) {
        await base44.entities.GameSettings.update(settings.id, data);
      } else {
        await base44.entities.GameSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
      alert('Einstellungen gespeichert!');
    }
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (settings) {
        await base44.entities.GameSettings.update(settings.id, defaultSettings);
      } else {
        await base44.entities.GameSettings.create(defaultSettings);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
      setFormData(defaultSettings);
      alert('Auf Standardwerte zurückgesetzt!');
    }
  });

  const handleChange = (field, value) => {
    // Check if it's a string field (level titles)
    if (field.includes('level_') && field.includes('_title')) {
      setFormData(prev => ({ ...prev, [field]: value }));
    } else {
      setFormData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <Card className="p-8 bg-slate-800 border-slate-700">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white text-center mb-2">Zugriff verweigert</h2>
          <p className="text-slate-400 text-center">Nur Administratoren können diese Seite sehen.</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
          <Settings className="w-12 h-12 text-blue-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-5xl mx-auto p-6">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white">Spiel-Einstellungen (Admin)</h1>
          <p className="text-slate-400">Konfiguriere Score- und Wartungskosten für alle Vorfälle</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tailstrike */}
          <Card className="p-6 bg-slate-800 border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Heckaufsetzer (Tailstrike)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Score-Abzug</Label>
                <Input
                  type="number"
                  value={formData.tailstrike_score_penalty || ''}
                  onChange={(e) => handleChange('tailstrike_score_penalty', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Wartungskosten (% des Neuwertes)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.tailstrike_maintenance_percent || ''}
                  onChange={(e) => handleChange('tailstrike_maintenance_percent', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
            </div>
          </Card>

          {/* Stall */}
          <Card className="p-6 bg-slate-800 border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Strömungsabriss (Stall)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Score-Abzug</Label>
                <Input
                  type="number"
                  value={formData.stall_score_penalty || ''}
                  onChange={(e) => handleChange('stall_score_penalty', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
            </div>
          </Card>

          {/* Overstress */}
          <Card className="p-6 bg-slate-800 border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Strukturbelastung (Overstress)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Score-Abzug</Label>
                <Input
                  type="number"
                  value={formData.overstress_score_penalty || ''}
                  onChange={(e) => handleChange('overstress_score_penalty', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Wartungskosten (% des Neuwertes)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.overstress_maintenance_percent || ''}
                  onChange={(e) => handleChange('overstress_maintenance_percent', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
            </div>
          </Card>

          {/* Flaps Overspeed */}
          <Card className="p-6 bg-slate-800 border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Klappen-Overspeed</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Score-Abzug</Label>
                <Input
                  type="number"
                  value={formData.flaps_overspeed_score_penalty || ''}
                  onChange={(e) => handleChange('flaps_overspeed_score_penalty', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Wartungskosten (% des Neuwertes)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.flaps_overspeed_maintenance_percent || ''}
                  onChange={(e) => handleChange('flaps_overspeed_maintenance_percent', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
            </div>
          </Card>

          {/* G-Force */}
          <Card className="p-6 bg-slate-800 border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">G-Kräfte</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-white">Schwellenwert (G)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.g_force_threshold || ''}
                  onChange={(e) => handleChange('g_force_threshold', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Score-Abzug pro Überschreitung</Label>
                <Input
                  type="number"
                  value={formData.g_force_score_penalty || ''}
                  onChange={(e) => handleChange('g_force_score_penalty', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Wartung (% des Neuwertes pro G)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.g_force_maintenance_percent_per_g || ''}
                  onChange={(e) => handleChange('g_force_maintenance_percent_per_g', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
            </div>
          </Card>

          {/* Hard Landing */}
          <Card className="p-6 bg-slate-800 border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Harte Landung</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-white">VS Schwellenwert (ft/min)</Label>
                <Input
                  type="number"
                  value={formData.hard_landing_vs_threshold || ''}
                  onChange={(e) => handleChange('hard_landing_vs_threshold', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Score-Abzug</Label>
                <Input
                  type="number"
                  value={formData.hard_landing_score_penalty || ''}
                  onChange={(e) => handleChange('hard_landing_score_penalty', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Wartung (% des Flugzeugwerts)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.hard_landing_maintenance_percent || ''}
                  onChange={(e) => handleChange('hard_landing_maintenance_percent', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
            </div>
          </Card>

          {/* Soft Landing */}
          <Card className="p-6 bg-slate-800 border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Weiche Landung</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">VS Schwellenwert (ft/min)</Label>
                <Input
                  type="number"
                  value={formData.soft_landing_vs_threshold || ''}
                  onChange={(e) => handleChange('soft_landing_vs_threshold', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Score-Bonus</Label>
                <Input
                  type="number"
                  value={formData.soft_landing_score_bonus || ''}
                  onChange={(e) => handleChange('soft_landing_score_bonus', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
            </div>
          </Card>

          {/* Butter Landing */}
          <Card className="p-6 bg-slate-800 border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Butterweiche Landung</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">VS Schwellenwert (ft/min)</Label>
                <Input
                  type="number"
                  value={formData.butter_landing_vs_threshold || ''}
                  onChange={(e) => handleChange('butter_landing_vs_threshold', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Score-Bonus</Label>
                <Input
                  type="number"
                  value={formData.butter_landing_score_bonus || ''}
                  onChange={(e) => handleChange('butter_landing_score_bonus', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
            </div>
          </Card>

          {/* Crash */}
          <Card className="p-6 bg-slate-800 border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Crash
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-white">VS Schwellenwert (ft/min)</Label>
                <Input
                  type="number"
                  value={formData.crash_vs_threshold || ''}
                  onChange={(e) => handleChange('crash_vs_threshold', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Score-Abzug</Label>
                <Input
                  type="number"
                  value={formData.crash_score_penalty || ''}
                  onChange={(e) => handleChange('crash_score_penalty', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Wartung (% des Neuwertes)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.crash_maintenance_percent || ''}
                  onChange={(e) => handleChange('crash_maintenance_percent', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
            </div>
          </Card>

          {/* Level Titles */}
          <Card className="p-6 bg-slate-800 border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-400" />
              Level-Bezeichnungen (bis Level 100)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-white">Level 1-4</Label>
                <Input
                  type="text"
                  value={formData.level_1_4_title || ''}
                  onChange={(e) => handleChange('level_1_4_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Level 5-8</Label>
                <Input
                  type="text"
                  value={formData.level_5_8_title || ''}
                  onChange={(e) => handleChange('level_5_8_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Level 9-12</Label>
                <Input
                  type="text"
                  value={formData.level_9_12_title || ''}
                  onChange={(e) => handleChange('level_9_12_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Level 13-16</Label>
                <Input
                  type="text"
                  value={formData.level_13_16_title || ''}
                  onChange={(e) => handleChange('level_13_16_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Level 17-20</Label>
                <Input
                  type="text"
                  value={formData.level_17_20_title || ''}
                  onChange={(e) => handleChange('level_17_20_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Level 21-30</Label>
                <Input
                  type="text"
                  value={formData.level_21_30_title || ''}
                  onChange={(e) => handleChange('level_21_30_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Level 31-40</Label>
                <Input
                  type="text"
                  value={formData.level_31_40_title || ''}
                  onChange={(e) => handleChange('level_31_40_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Level 41-50</Label>
                <Input
                  type="text"
                  value={formData.level_41_50_title || ''}
                  onChange={(e) => handleChange('level_41_50_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Level 51-60</Label>
                <Input
                  type="text"
                  value={formData.level_51_60_title || ''}
                  onChange={(e) => handleChange('level_51_60_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Level 61-70</Label>
                <Input
                  type="text"
                  value={formData.level_61_70_title || ''}
                  onChange={(e) => handleChange('level_61_70_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Level 71-80</Label>
                <Input
                  type="text"
                  value={formData.level_71_80_title || ''}
                  onChange={(e) => handleChange('level_71_80_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Level 81-90</Label>
                <Input
                  type="text"
                  value={formData.level_81_90_title || ''}
                  onChange={(e) => handleChange('level_81_90_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
              <div>
                <Label className="text-white">Level 91-100</Label>
                <Input
                  type="text"
                  value={formData.level_91_100_title || ''}
                  onChange={(e) => handleChange('level_91_100_title', e.target.value)}
                  className="bg-slate-900 text-white border-slate-700"
                />
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button 
              type="submit" 
              disabled={saveMutation.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Speichere...' : 'Einstellungen speichern'}
            </Button>
            <Button 
              type="button"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              variant="outline"
              className="border-slate-600 text-white hover:bg-slate-700"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {resetMutation.isPending ? 'Setze zurück...' : 'Standardwerte'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}