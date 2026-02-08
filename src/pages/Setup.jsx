import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Plane,
  Building2,
  Radio,
  MapPin,
  ArrowRight,
  Sparkles
} from "lucide-react";

export default function Setup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    callsign: '',
    hub_airport: ''
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data) => {
      // Create company
      const company = await base44.entities.Company.create({
        ...data,
        balance: 500000,
        reputation: 50,
        level: 1,
        total_flights: 0,
        total_passengers: 0,
        total_cargo_kg: 0
      });

      // Get template image for Cessna 172 Skyhawk
      const templates = await base44.entities.AircraftTemplate.filter({ name: "Cessna 172 Skyhawk" });
      const template = templates[0];

      // Create starter aircraft
      await base44.entities.Aircraft.create({
        company_id: company.id,
        name: "Cessna 172 Skyhawk",
        registration: `${data.callsign?.slice(0, 2) || 'N'}001`,
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

      // Create starter employees
      await base44.entities.Employee.bulkCreate([
        {
          company_id: company.id,
          name: "Max Mustermann",
          role: "captain",
          experience_level: "intermediate",
          skill_rating: 65,
          salary_per_month: 4500,
          status: "available",
          hired_date: new Date().toISOString().split('T')[0],
          total_flight_hours: 850,
          licenses: ["small_prop", "turboprop"]
        },
        {
          company_id: company.id,
          name: "Anna Schmidt",
          role: "first_officer",
          experience_level: "junior",
          skill_rating: 55,
          salary_per_month: 3000,
          status: "available",
          hired_date: new Date().toISOString().split('T')[0],
          total_flight_hours: 320,
          licenses: ["small_prop"]
        }
      ]);

      // Create sample contracts
      await base44.entities.Contract.bulkCreate([
        {
          company_id: company.id,
          title: "Kurze Inselhopping-Tour",
          type: "passenger",
          departure_airport: data.hub_airport || "EDDF",
          departure_city: "Frankfurt",
          arrival_airport: "EDDM",
          arrival_city: "München",
          distance_nm: 150,
          passenger_count: 2,
          payout: 1200,
          difficulty: "easy",
          bonus_potential: 300,
          required_aircraft_type: ["small_prop", "turboprop"],
          required_crew: { captain: 1, first_officer: 0, flight_attendant: 0, loadmaster: 0 },
          status: "available"
        },
        {
          company_id: company.id,
          title: "Geschäftsreise Premium",
          type: "charter",
          departure_airport: "EDDM",
          departure_city: "München",
          arrival_airport: "LOWW",
          arrival_city: "Wien",
          distance_nm: 200,
          passenger_count: 3,
          payout: 2500,
          difficulty: "medium",
          bonus_potential: 600,
          required_aircraft_type: ["small_prop", "turboprop", "regional_jet"],
          required_crew: { captain: 1, first_officer: 1, flight_attendant: 0, loadmaster: 0 },
          status: "available"
        },
        {
          company_id: company.id,
          title: "Frachtlieferung Express",
          type: "cargo",
          departure_airport: data.hub_airport || "EDDF",
          departure_city: "Frankfurt",
          arrival_airport: "EDDB",
          arrival_city: "Berlin",
          distance_nm: 250,
          cargo_weight_kg: 80,
          payout: 1800,
          difficulty: "easy",
          bonus_potential: 400,
          required_aircraft_type: ["small_prop", "turboprop", "cargo"],
          required_crew: { captain: 1, first_officer: 0, flight_attendant: 0, loadmaster: 0 },
          status: "available"
        }
      ]);

      // Save company_id on the user
      await base44.auth.updateMe({ company_id: company.id });

      return company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      navigate(createPageUrl("Dashboard"));
    }
  });

  const handleSubmit = () => {
    createCompanyMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl shadow-2xl shadow-blue-500/30 mb-6"
          >
            <Plane className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">SkyCareer</h1>
          <p className="text-blue-200">Gründe deine virtuelle Airline</p>
        </div>

        <Card className="bg-white/10 backdrop-blur-xl border-white/20 text-white overflow-hidden">
          <div className="p-8">
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label className="text-blue-100 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Firmenname
                  </Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="z.B. Sky Airways"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-100 flex items-center gap-2">
                    <Radio className="w-4 h-4" />
                    Funk-Rufzeichen
                  </Label>
                  <Input
                    value={formData.callsign}
                    onChange={(e) => setFormData({ ...formData, callsign: e.target.value.toUpperCase() })}
                    placeholder="z.B. SKYAIR"
                    maxLength={10}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400 font-mono"
                  />
                </div>

                <Button
                  onClick={() => setStep(2)}
                  disabled={!formData.name || !formData.callsign}
                  className="w-full bg-blue-500 hover:bg-blue-600 mt-4"
                >
                  Weiter <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label className="text-blue-100 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Hub-Flughafen (ICAO-Code)
                  </Label>
                  <Input
                    value={formData.hub_airport}
                    onChange={(e) => setFormData({ ...formData, hub_airport: e.target.value.toUpperCase() })}
                    placeholder="z.B. EDDF (Frankfurt)"
                    maxLength={4}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400 font-mono"
                  />
                  <p className="text-xs text-blue-200/60">
                    Der ICAO-Code deines Heimatflughafens (4 Buchstaben)
                  </p>
                </div>

                <div className="p-4 bg-blue-500/20 rounded-xl border border-blue-400/30">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-300 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-100">Dein Startpaket</p>
                      <ul className="text-sm text-blue-200/80 mt-2 space-y-1">
                        <li>• $500.000 Startkapital</li>
                        <li>• 1x Cessna 172 Skyhawk</li>
                        <li>• 2 Piloten (Kapitän + Erster Offizier)</li>
                        <li>• 3 Starter-Aufträge</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10"
                  >
                    Zurück
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!formData.hub_airport || createCompanyMutation.isPending}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                  >
                    {createCompanyMutation.isPending ? "Erstelle..." : "Airline gründen"}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </Card>

        <p className="text-center text-blue-200/40 text-sm mt-6">
          X-Plane 12 Plugin erforderlich für Flugdaten
        </p>
      </motion.div>
    </div>
  );
}