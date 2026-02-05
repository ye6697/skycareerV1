import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  UserPlus,
  Users,
  Star,
  DollarSign,
  Briefcase
} from "lucide-react";

import EmployeeCard from "@/components/employees/EmployeeCard";

const HIRE_OPTIONS = {
  captain: [
    { name: "Hans Weber", experience: "senior", skill: 80, salary: 6500, hours: 2500 },
    { name: "Thomas Richter", experience: "intermediate", skill: 65, salary: 5000, hours: 1200 },
    { name: "Michael Bauer", experience: "junior", skill: 50, salary: 4000, hours: 450 },
  ],
  first_officer: [
    { name: "Julia Klein", experience: "intermediate", skill: 62, salary: 3500, hours: 800 },
    { name: "Stefan Hoffmann", experience: "junior", skill: 48, salary: 2800, hours: 300 },
    { name: "Maria Fischer", experience: "senior", skill: 75, salary: 4200, hours: 1800 },
  ],
  flight_attendant: [
    { name: "Lisa Müller", experience: "senior", skill: 85, salary: 2800, hours: 3000 },
    { name: "Sarah Schneider", experience: "intermediate", skill: 65, salary: 2200, hours: 1500 },
    { name: "Emma Wagner", experience: "junior", skill: 45, salary: 1800, hours: 400 },
  ],
  loadmaster: [
    { name: "Peter Keller", experience: "expert", skill: 90, salary: 3200, hours: 4000 },
    { name: "Markus Wolf", experience: "intermediate", skill: 60, salary: 2500, hours: 1000 },
  ]
};

export default function Employees() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isHireDialogOpen, setIsHireDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('captain');
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date')
  });

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const companies = await base44.entities.Company.list();
      return companies[0];
    }
  });

  const hireMutation = useMutation({
    mutationFn: async (candidate) => {
      await base44.entities.Employee.create({
        name: candidate.name,
        role: selectedRole,
        experience_level: candidate.experience,
        skill_rating: candidate.skill,
        salary_per_month: candidate.salary,
        status: 'available',
        hired_date: new Date().toISOString().split('T')[0],
        total_flight_hours: candidate.hours,
        licenses: selectedRole === 'captain' || selectedRole === 'first_officer' 
          ? ["small_prop", "turboprop"] 
          : []
      });

      // Deduct hiring bonus from balance
      const hiringBonus = candidate.salary;
      if (company) {
        await base44.entities.Company.update(company.id, {
          balance: (company.balance || 0) - hiringBonus
        });
        await base44.entities.Transaction.create({
          type: 'expense',
          category: 'salary',
          amount: hiringBonus,
          description: `Einstellungsbonus für ${candidate.name}`,
          date: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setIsHireDialogOpen(false);
      setSelectedCandidate(null);
    }
  });

  const fireEmployeeMutation = useMutation({
    mutationFn: async (employee) => {
      await base44.entities.Employee.update(employee.id, { status: 'terminated' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    }
  });

  const filteredEmployees = employees.filter(emp => {
    if (emp.status === 'terminated') return false;
    const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && emp.role === activeTab;
  });

  const roleLabels = {
    captain: 'Kapitäne',
    first_officer: 'Erste Offiziere',
    flight_attendant: 'Flugbegleiter',
    loadmaster: 'Lademeister'
  };

  const getEmployeeCount = (role) => {
    return employees.filter(e => e.role === role && e.status !== 'terminated').length;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Mitarbeiter</h1>
              <p className="text-slate-500">Verwalte dein Flugpersonal</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Mitarbeiter suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64 bg-white"
                />
              </div>
              <Dialog open={isHireDialogOpen} onOpenChange={setIsHireDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Einstellen
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Neuen Mitarbeiter einstellen</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="captain">Kapitän</SelectItem>
                          <SelectItem value="first_officer">Erster Offizier</SelectItem>
                          <SelectItem value="flight_attendant">Flugbegleiter/in</SelectItem>
                          <SelectItem value="loadmaster">Lademeister</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label>Verfügbare Kandidaten</Label>
                      {HIRE_OPTIONS[selectedRole]?.map((candidate, index) => (
                        <Card 
                          key={index}
                          className={`p-4 cursor-pointer transition-all ${
                            selectedCandidate?.name === candidate.name 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'hover:border-slate-300'
                          }`}
                          onClick={() => setSelectedCandidate(candidate)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{candidate.name}</p>
                              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Star className="w-3 h-3" />
                                  {candidate.experience === 'expert' ? 'Experte' :
                                   candidate.experience === 'senior' ? 'Senior' :
                                   candidate.experience === 'intermediate' ? 'Fortgeschritten' : 'Junior'}
                                </span>
                                <span>Skill: {candidate.skill}</span>
                                <span>{candidate.hours}h Flugerfahrung</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-600">${candidate.salary}/Monat</p>
                              <p className="text-xs text-slate-400">+ ${candidate.salary} Einstellungsbonus</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    {company && (
                      <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                        <span className="text-sm text-slate-600">Dein Kontostand:</span>
                        <span className="font-bold text-slate-900">${company.balance?.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsHireDialogOpen(false)}>
                      Abbrechen
                    </Button>
                    <Button
                      onClick={() => hireMutation.mutate(selectedCandidate)}
                      disabled={!selectedCandidate || hireMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {hireMutation.isPending ? 'Stelle ein...' : `Für $${selectedCandidate?.salary || 0} einstellen`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(roleLabels).map(([role, label]) => (
            <Card key={role} className="p-4 bg-white border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="text-2xl font-bold text-slate-900">{getEmployeeCount(role)}</p>
                </div>
                <div className={`p-2 rounded-lg ${
                  role === 'captain' ? 'bg-amber-100' :
                  role === 'first_officer' ? 'bg-blue-100' :
                  role === 'flight_attendant' ? 'bg-pink-100' :
                  'bg-orange-100'
                }`}>
                  <Users className={`w-5 h-5 ${
                    role === 'captain' ? 'text-amber-600' :
                    role === 'first_officer' ? 'text-blue-600' :
                    role === 'flight_attendant' ? 'text-pink-600' :
                    'text-orange-600'
                  }`} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="captain">Kapitäne</TabsTrigger>
            <TabsTrigger value="first_officer">Erste Offiziere</TabsTrigger>
            <TabsTrigger value="flight_attendant">Flugbegleiter</TabsTrigger>
            <TabsTrigger value="loadmaster">Lademeister</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Employee Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-64 animate-pulse bg-slate-100" />
            ))}
          </div>
        ) : filteredEmployees.length > 0 ? (
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" layout>
            <AnimatePresence>
              {filteredEmployees.map((employee) => (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  onFire={() => fireEmployeeMutation.mutate(employee)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <Card className="p-12 text-center bg-white border border-slate-200">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Keine Mitarbeiter gefunden</h3>
            <p className="text-slate-500 mb-4">Stelle neue Mitarbeiter ein, um Flüge durchführen zu können</p>
            <Button onClick={() => setIsHireDialogOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Ersten Mitarbeiter einstellen
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}