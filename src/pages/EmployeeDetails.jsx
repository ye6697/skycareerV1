import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  User,
  Briefcase,
  TrendingUp,
  DollarSign,
  Calendar,
  Award,
  Plane
} from "lucide-react";

export default function EmployeeDetails() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const employeeId = urlParams.get('id');

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const employees = await base44.entities.Employee.filter({ id: employeeId });
      return employees?.[0] || null;
    },
    enabled: !!employeeId,
    retry: false
  });

  if (isLoading || !employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
          <User className="w-12 h-12 text-blue-400" />
        </motion.div>
      </div>
    );
  }

  const roleConfig = {
    captain: { label: 'Kapitän', color: 'bg-purple-500', icon: '👨‍✈️' },
    first_officer: { label: 'Erster Offizier', color: 'bg-blue-500', icon: '👨‍✈️' },
    flight_attendant: { label: 'Flugbegleiter', color: 'bg-sky-500', icon: '🧑‍🦳' },
    loadmaster: { label: 'Ladeoffizier', color: 'bg-amber-500', icon: '📦' }
  };

  const experienceConfig = {
    junior: { label: 'Junior', color: 'text-blue-400 bg-blue-500/20 border-blue-500/30' },
    intermediate: { label: 'Mittel', color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' },
    senior: { label: 'Senior', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' },
    expert: { label: 'Experte', color: 'text-purple-400 bg-purple-500/20 border-purple-500/30' }
  };

  const statusConfig = {
    available: { label: 'Verfügbar', color: 'bg-emerald-100 text-emerald-700' },
    on_duty: { label: 'Im Dienst', color: 'bg-blue-100 text-blue-700' },
    on_leave: { label: 'Im Urlaub', color: 'bg-amber-100 text-amber-700' },
    terminated: { label: 'Entlassen', color: 'bg-red-100 text-red-700' }
  };

  const getRatingColor = (rating) => {
    if (rating >= 90) return 'text-emerald-400';
    if (rating >= 75) return 'text-blue-400';
    if (rating >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto p-4 lg:p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Employees"))}
            className="mb-4 text-blue-400 hover:text-blue-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zu Mitarbeitern
          </Button>

          <div className="flex items-start gap-4 mb-6">
            <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-3xl ${roleConfig[employee.role]?.color}`}>
              {roleConfig[employee.role]?.icon}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">{employee.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={roleConfig[employee.role]?.color}>
                  {roleConfig[employee.role]?.label}
                </Badge>
                <Badge className={experienceConfig[employee.experience_level]?.color}>
                  {experienceConfig[employee.experience_level]?.label}
                </Badge>
                <Badge className={statusConfig[employee.status]?.color}>
                  {statusConfig[employee.status]?.label}
                </Badge>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Skills & Performance */}
            <Card className="p-6 bg-slate-800 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Fähigkeiten & Leistung
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300">Skill Rating</span>
                    <span className={`text-xl font-bold ${getRatingColor(employee.skill_rating)}`}>
                      {employee.skill_rating || 0}/100
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2">
                    <div
                      className={`h-full rounded-full transition-all ${
                        employee.skill_rating >= 90 ? 'bg-emerald-500' :
                        employee.skill_rating >= 75 ? 'bg-blue-500' :
                        employee.skill_rating >= 60 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${employee.skill_rating || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Experience */}
            <Card className="p-6 bg-slate-800 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Erfahrung
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Plane className="w-4 h-4" />
                    Flugstunden insgesamt
                  </span>
                  <span className="text-white font-medium">{(employee.total_flight_hours || 0).toLocaleString()} Std.</span>
                </div>
              </div>
            </Card>

            {/* Licenses */}
            {employee.licenses && employee.licenses.length > 0 && (
              <Card className="p-6 bg-slate-800 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Lizenzen & Zertifikate</h3>
                <div className="flex flex-wrap gap-2">
                  {employee.licenses.map((license, index) => (
                    <Badge key={index} className="bg-blue-600 text-white">
                      {license}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Financial Info */}
            <Card className="p-6 bg-slate-800 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Finanzielle Informationen
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Monatliches Gehalt</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    ${(employee.salary_per_month || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>

            {/* Personal Info */}
            <Card className="p-6 bg-slate-800 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-slate-400" />
                Persönliche Informationen
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Anstellungsdatum</p>
                  <p className="text-white font-medium">
                    {employee.hired_date ? new Date(employee.hired_date).toLocaleDateString('de-DE') : 'N/A'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Status Card */}
            <Card className={`p-6 border ${
              employee.status === 'available' ? 'bg-emerald-500/10 border-emerald-500/30' :
              employee.status === 'on_duty' ? 'bg-blue-500/10 border-blue-500/30' :
              employee.status === 'on_leave' ? 'bg-amber-500/10 border-amber-500/30' :
              'bg-red-500/10 border-red-500/30'
            }`}>
              <p className={`text-sm font-medium ${
                employee.status === 'available' ? 'text-emerald-400' :
                employee.status === 'on_duty' ? 'text-blue-400' :
                employee.status === 'on_leave' ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {statusConfig[employee.status]?.label}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}