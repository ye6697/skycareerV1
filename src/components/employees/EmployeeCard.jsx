import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { 
  User, 
  Star,
  Clock,
  DollarSign,
  Plane,
  Brain,
  Heart,
  GraduationCap
} from "lucide-react";

export default function EmployeeCard({ employee, onAssign, onFire, onView }) {
  const roleConfig = {
    captain: { label: "Kapitän", color: "bg-amber-100 text-amber-700 border-amber-200" },
    first_officer: { label: "Erster Offizier", color: "bg-blue-100 text-blue-700 border-blue-200" },
    flight_attendant: { label: "Flugbegleiter/in", color: "bg-pink-100 text-pink-700 border-pink-200" },
    loadmaster: { label: "Lademeister", color: "bg-orange-100 text-orange-700 border-orange-200" }
  };

  const experienceConfig = {
    junior: { label: "Junior", stars: 1 },
    intermediate: { label: "Fortgeschritten", stars: 2 },
    senior: { label: "Senior", stars: 3 },
    expert: { label: "Experte", stars: 4 }
  };

  const statusConfig = {
    available: { label: "Verfügbar", color: "bg-emerald-500" },
    on_duty: { label: "Im Einsatz", color: "bg-blue-500" },
    on_leave: { label: "Urlaub", color: "bg-amber-500" },
    terminated: { label: "Gekündigt", color: "bg-red-500" }
  };

  const role = roleConfig[employee.role] || roleConfig.flight_attendant;
  const experience = experienceConfig[employee.experience_level] || experienceConfig.junior;
  const status = statusConfig[employee.status] || statusConfig.available;

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden bg-slate-800 border border-slate-700 hover:border-slate-600 hover:shadow-lg transition-all duration-300">
        <div className="p-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="relative">
              <Avatar className="w-14 h-14 border-2 border-white shadow-md">
                <AvatarImage src={employee.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-semibold">
                  {getInitials(employee.name)}
                </AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${status.color} rounded-full border-2 border-white`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{employee.name}</h3>
              <Badge className={`${role.color} border mt-1`}>{role.label}</Badge>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Erfahrung</span>
              <div className="flex items-center gap-1">
                {[...Array(4)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-3.5 h-3.5 ${i < experience.stars ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} 
                  />
                ))}
                <span className="ml-1 text-slate-300 font-medium">{experience.label}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Skill Rating</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                    style={{ width: `${employee.skill_rating || 50}%` }}
                  />
                </div>
                <span className="font-medium text-slate-300">{employee.skill_rating || 50}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Flugstunden</span>
              <div className="flex items-center gap-1 text-slate-700">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-300">{employee.total_flight_hours?.toLocaleString() || 0}h</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Gehalt/Monat</span>
              <div className="flex items-center gap-1 text-slate-300">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium">${employee.salary_per_month?.toLocaleString()}</span>
              </div>
            </div>

            {/* Mini Attributes */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 flex items-center gap-1"><Brain className="w-3 h-3 text-purple-400" />Nerv.</span>
              <span className="text-slate-300 font-mono text-xs">{Math.round(employee.attributes?.nerve || 50)}</span>
              <span className="text-slate-400 flex items-center gap-1"><Heart className="w-3 h-3 text-pink-400" />PAX</span>
              <span className="text-slate-300 font-mono text-xs">{Math.round(employee.attributes?.passenger_handling || 50)}</span>
            </div>

            {employee.training?.active && (
              <div className="flex items-center gap-1 text-xs text-blue-400">
                <GraduationCap className="w-3 h-3" />
                <span>Training läuft...</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-3 border-t border-slate-700">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => {
              if (onView) onView(employee);
              else window.location.href = `${window.location.pathname}?page=EmployeeDetails&id=${employee.id}`;
            }}>
              Details
            </Button>
            {employee.status === "available" && (
              <Button 
                size="sm" 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => onAssign?.(employee)}
              >
                Zuweisen
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}