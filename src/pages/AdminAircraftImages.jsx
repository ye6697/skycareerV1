import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Image as ImageIcon, Check, AlertCircle } from "lucide-react";

export default function AdminAircraftImages() {
  const queryClient = useQueryClient();

  const updateAllAircraftMutation = useMutation({
    mutationFn: async () => {
      return await base44.functions.invoke('updateAircraftImages', {});
    },
    onSuccess: (response) => {
      alert(response.data.message || 'Alle Flugzeuge aktualisiert!');
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
    }
  });
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  // Static market data with all aircraft specs
  const AIRCRAFT_MARKET = [
    { name: "Cessna 172 Skyhawk", type: "small_prop", passenger_capacity: 3, cargo_capacity_kg: 100, fuel_consumption_per_hour: 45, range_nm: 640, purchase_price: 425000, maintenance_cost_per_hour: 25, level_requirement: 1 },
    { name: "Piper PA-28 Cherokee", type: "small_prop", passenger_capacity: 4, cargo_capacity_kg: 120, fuel_consumption_per_hour: 50, range_nm: 700, purchase_price: 650000, maintenance_cost_per_hour: 30, level_requirement: 1 },
    { name: "Piper PA-44 Seminole", type: "small_prop", passenger_capacity: 4, cargo_capacity_kg: 150, fuel_consumption_per_hour: 55, range_nm: 750, purchase_price: 750000, maintenance_cost_per_hour: 35, level_requirement: 2 },
    { name: "Socata Tobago", type: "small_prop", passenger_capacity: 4, cargo_capacity_kg: 140, fuel_consumption_per_hour: 52, range_nm: 720, purchase_price: 700000, maintenance_cost_per_hour: 32, level_requirement: 2 },
    { name: "Piper PA-46 Malibu", type: "turboprop", passenger_capacity: 6, cargo_capacity_kg: 300, fuel_consumption_per_hour: 150, range_nm: 1500, purchase_price: 1200000, maintenance_cost_per_hour: 85, level_requirement: 3 },
    { name: "Beechcraft King Air 350", type: "turboprop", passenger_capacity: 8, cargo_capacity_kg: 350, fuel_consumption_per_hour: 350, range_nm: 1800, purchase_price: 18000000, maintenance_cost_per_hour: 120, level_requirement: 8 },
    { name: "Cessna Caravan", type: "turboprop", passenger_capacity: 14, cargo_capacity_kg: 1500, fuel_consumption_per_hour: 280, range_nm: 1200, purchase_price: 1900000, maintenance_cost_per_hour: 90, level_requirement: 4 },
    { name: "Bombardier Dash 8-100", type: "turboprop", passenger_capacity: 50, cargo_capacity_kg: 2000, fuel_consumption_per_hour: 600, range_nm: 1550, purchase_price: 25000000, maintenance_cost_per_hour: 200, level_requirement: 9 },
    { name: "Bombardier Q400", type: "turboprop", passenger_capacity: 78, cargo_capacity_kg: 2700, fuel_consumption_per_hour: 850, range_nm: 1700, purchase_price: 30000000, maintenance_cost_per_hour: 280, level_requirement: 10 },
    { name: "Bombardier CRJ-200", type: "regional_jet", passenger_capacity: 50, cargo_capacity_kg: 1500, fuel_consumption_per_hour: 1600, range_nm: 2000, purchase_price: 35000000, maintenance_cost_per_hour: 350, level_requirement: 11 },
    { name: "Embraer E170", type: "regional_jet", passenger_capacity: 70, cargo_capacity_kg: 1850, fuel_consumption_per_hour: 2200, range_nm: 2100, purchase_price: 45000000, maintenance_cost_per_hour: 420, level_requirement: 12 },
    { name: "Embraer E175", type: "regional_jet", passenger_capacity: 76, cargo_capacity_kg: 2000, fuel_consumption_per_hour: 2400, range_nm: 2200, purchase_price: 50000000, maintenance_cost_per_hour: 450, level_requirement: 13 },
    { name: "Airbus A220", type: "regional_jet", passenger_capacity: 130, cargo_capacity_kg: 3400, fuel_consumption_per_hour: 2800, range_nm: 2800, purchase_price: 65000000, maintenance_cost_per_hour: 650, level_requirement: 14 },
    { name: "Airbus A318", type: "narrow_body", passenger_capacity: 108, cargo_capacity_kg: 3200, fuel_consumption_per_hour: 2200, range_nm: 3100, purchase_price: 75000000, maintenance_cost_per_hour: 800, level_requirement: 15 },
    { name: "Airbus A319", type: "narrow_body", passenger_capacity: 140, cargo_capacity_kg: 3850, fuel_consumption_per_hour: 2600, range_nm: 3300, purchase_price: 85000000, maintenance_cost_per_hour: 950, level_requirement: 16 },
    { name: "Airbus A320neo", type: "narrow_body", passenger_capacity: 180, cargo_capacity_kg: 5000, fuel_consumption_per_hour: 3200, range_nm: 3500, purchase_price: 100000000, maintenance_cost_per_hour: 1200, level_requirement: 17 },
    { name: "Boeing 737-700", type: "narrow_body", passenger_capacity: 155, cargo_capacity_kg: 4700, fuel_consumption_per_hour: 3000, range_nm: 3300, purchase_price: 95000000, maintenance_cost_per_hour: 1050, level_requirement: 16 },
    { name: "Boeing 737 MAX 8", type: "narrow_body", passenger_capacity: 210, cargo_capacity_kg: 5300, fuel_consumption_per_hour: 3500, range_nm: 3500, purchase_price: 105000000, maintenance_cost_per_hour: 1350, level_requirement: 18 },
    { name: "Boeing 787-8", type: "narrow_body", passenger_capacity: 242, cargo_capacity_kg: 4500, fuel_consumption_per_hour: 3800, range_nm: 5000, purchase_price: 140000000, maintenance_cost_per_hour: 1600, level_requirement: 20 },
    { name: "Airbus A300", type: "wide_body", passenger_capacity: 266, cargo_capacity_kg: 11000, fuel_consumption_per_hour: 6500, range_nm: 4800, purchase_price: 150000000, maintenance_cost_per_hour: 2400, level_requirement: 21 },
    { name: "Airbus A330-200", type: "wide_body", passenger_capacity: 295, cargo_capacity_kg: 13600, fuel_consumption_per_hour: 7200, range_nm: 5650, purchase_price: 200000000, maintenance_cost_per_hour: 2800, level_requirement: 23 },
    { name: "Boeing 777-200ER", type: "wide_body", passenger_capacity: 350, cargo_capacity_kg: 20000, fuel_consumption_per_hour: 9200, range_nm: 7065, purchase_price: 260000000, maintenance_cost_per_hour: 3200, level_requirement: 25 },
    { name: "Boeing 777-300ER", type: "wide_body", passenger_capacity: 396, cargo_capacity_kg: 22000, fuel_consumption_per_hour: 10000, range_nm: 7370, purchase_price: 285000000, maintenance_cost_per_hour: 3500, level_requirement: 26 },
    { name: "Airbus A350-900", type: "wide_body", passenger_capacity: 325, cargo_capacity_kg: 16600, fuel_consumption_per_hour: 8200, range_nm: 8000, purchase_price: 300000000, maintenance_cost_per_hour: 3800, level_requirement: 27 },
    { name: "Boeing 747-8", type: "wide_body", passenger_capacity: 467, cargo_capacity_kg: 21870, fuel_consumption_per_hour: 11200, range_nm: 8000, purchase_price: 360000000, maintenance_cost_per_hour: 4200, level_requirement: 29 },
    { name: "Airbus A380", type: "wide_body", passenger_capacity: 555, cargo_capacity_kg: 18600, fuel_consumption_per_hour: 12500, range_nm: 8000, purchase_price: 440000000, maintenance_cost_per_hour: 5000, level_requirement: 31 },
    { name: "ATR 72F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 6000, fuel_consumption_per_hour: 350, range_nm: 2400, purchase_price: 28000000, maintenance_cost_per_hour: 600, level_requirement: 10 },
    { name: "Airbus A330-200F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 70000, fuel_consumption_per_hour: 7000, range_nm: 5550, purchase_price: 185000000, maintenance_cost_per_hour: 2600, level_requirement: 22 },
    { name: "Boeing 777F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 102000, fuel_consumption_per_hour: 9500, range_nm: 4435, purchase_price: 330000000, maintenance_cost_per_hour: 3600, level_requirement: 28 },
    { name: "Boeing 747-8F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 134000, fuel_consumption_per_hour: 14500, range_nm: 4120, purchase_price: 400000000, maintenance_cost_per_hour: 4500, level_requirement: 30 }
  ];

  const { data: templates = [] } = useQuery({
    queryKey: ['aircraftTemplates'],
    queryFn: async () => {
      return await base44.entities.AircraftTemplate.list();
    },
    refetchInterval: 3000
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ aircraftName, file }) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Check if template exists
      const existing = templates.find(t => t.name === aircraftName);
      
      if (existing) {
        // Update existing template
        await base44.entities.AircraftTemplate.update(existing.id, { image_url: file_url });
      } else {
        // Create new template
        const specs = AIRCRAFT_MARKET.find(ac => ac.name === aircraftName);
        if (specs) {
          await base44.entities.AircraftTemplate.create({
            name: aircraftName,
            type: specs.type,
            image_url: file_url,
            passenger_capacity: specs.passenger_capacity,
            cargo_capacity_kg: specs.cargo_capacity_kg,
            fuel_consumption_per_hour: specs.fuel_consumption_per_hour,
            range_nm: specs.range_nm,
            purchase_price: specs.purchase_price,
            maintenance_cost_per_hour: specs.maintenance_cost_per_hour,
            level_requirement: specs.level_requirement
          });
        }
      }
      
      return file_url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraftTemplates'] });
      setUploadingId(null);
    }
  });

  const handleFileSelect = async (e, aircraftName) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(aircraftName);
    uploadImageMutation.mutate({ aircraftName, file });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white">Flugzeug-Bilder verwalten</h1>
          <p className="text-slate-400">Laden Sie benutzerdefinierte Bilder für Ihre Flugzeuge hoch</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {AIRCRAFT_MARKET.map((ac) => {
              const template = templates.find(t => t.name === ac.name);
              return (
                <motion.div
                  key={ac.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="overflow-hidden bg-slate-800 border-slate-700 flex flex-col h-full">
                    <div className="relative h-40 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center overflow-hidden group">
                      {template?.image_url ? (
                        <motion.img
                          src={template.image_url}
                          alt={ac.name}
                          className="w-full h-full object-cover"
                          whileHover={{ scale: 1.05 }}
                        />
                      ) : (
                        <ImageIcon className="w-16 h-16 text-slate-600" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileSelect(e, ac.name)}
                            disabled={uploadingId === ac.name}
                            className="hidden"
                          />
                          <Button
                            asChild
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <span className="cursor-pointer">
                              {uploadingId === ac.name ? (
                                <>Lädt...</>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 mr-2" />
                                  Bild hochladen
                                </>
                              )}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 flex-grow bg-gradient-to-br from-slate-800 to-slate-900">
                      <p className="font-bold text-white text-sm line-clamp-1">{ac.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{ac.type}</p>

                      <div className="mt-3 flex items-center gap-2">
                        {template?.image_url ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs text-emerald-400">Bild vorhanden</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                            <span className="text-xs text-amber-400">Kein Bild</span>
                          </>
                        )}
                      </div>

                      <label className="block mt-3 w-full">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileSelect(e, ac.name)}
                          disabled={uploadingId === ac.name}
                          className="hidden"
                        />
                        <Button
                          asChild
                          size="sm"
                          variant={template?.image_url ? "outline" : "default"}
                          className="w-full cursor-pointer"
                        >
                          <span className="cursor-pointer">
                            {uploadingId === ac.name ? (
                              'Lädt...'
                            ) : (
                              <>
                                <Upload className="w-3 h-3 mr-1" />
                                Bild hochladen
                              </>
                            )}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}