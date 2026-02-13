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
    { name: "Piper PA-18 Super Cub", type: "small_prop", level_requirement: 1 },
    { name: "Vans RV-10", type: "small_prop", level_requirement: 1 },
    { name: "Cessna 172 Skyhawk", type: "small_prop", level_requirement: 1 },
    { name: "Beechcraft Baron 58", type: "small_prop", level_requirement: 1 },
    { name: "Cirrus SR22", type: "small_prop", level_requirement: 1 },
    { name: "Piper PA-28 Cherokee", type: "small_prop", level_requirement: 1 },
    { name: "Piper PA-44 Seminole", type: "small_prop", level_requirement: 2 },
    { name: "Lancair Evolution", type: "turboprop", level_requirement: 2 },
    { name: "Socata Tobago", type: "small_prop", level_requirement: 2 },
    { name: "Cirrus Vision SF50", type: "regional_jet", level_requirement: 2 },
    { name: "Piper PA-46 Malibu", type: "turboprop", level_requirement: 3 },
    { name: "Beechcraft King Air C90B", type: "turboprop", level_requirement: 3 },
    { name: "Cessna Caravan", type: "turboprop", level_requirement: 4 },
    { name: "Cessna Citation X", type: "regional_jet", level_requirement: 6 },
    { name: "Beechcraft King Air 350", type: "turboprop", level_requirement: 8 },
    { name: "Bombardier Dash 8-100", type: "turboprop", level_requirement: 9 },
    { name: "Bombardier Q400", type: "turboprop", level_requirement: 10 },
    { name: "ATR 72F", type: "cargo", level_requirement: 10 },
    { name: "Bombardier CRJ-200", type: "regional_jet", level_requirement: 11 },
    { name: "Embraer E170", type: "regional_jet", level_requirement: 12 },
    { name: "Embraer E175", type: "regional_jet", level_requirement: 13 },
    { name: "Airbus A220", type: "regional_jet", level_requirement: 14 },
    { name: "Airbus A318", type: "narrow_body", level_requirement: 15 },
    { name: "Airbus A319", type: "narrow_body", level_requirement: 16 },
    { name: "Boeing 737-700", type: "narrow_body", level_requirement: 16 },
    { name: "Airbus A320neo", type: "narrow_body", level_requirement: 17 },
    { name: "Boeing 737 MAX 8", type: "narrow_body", level_requirement: 18 },
    { name: "Boeing 787-8", type: "narrow_body", level_requirement: 20 },
    { name: "Airbus A300", type: "wide_body", level_requirement: 21 },
    { name: "Airbus A330-200F", type: "cargo", level_requirement: 22 },
    { name: "Airbus A330-200", type: "wide_body", level_requirement: 23 },
    { name: "Boeing 777-200ER", type: "wide_body", level_requirement: 25 },
    { name: "Boeing 777-300ER", type: "wide_body", level_requirement: 26 },
    { name: "Airbus A350-900", type: "wide_body", level_requirement: 27 },
    { name: "Boeing 777F", type: "cargo", level_requirement: 28 },
    { name: "Boeing 747-8", type: "wide_body", level_requirement: 29 },
    { name: "Boeing 747-8F", type: "cargo", level_requirement: 30 },
    { name: "Airbus A380", type: "wide_body", level_requirement: 31 }
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
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-white">Flugzeug-Bilder verwalten</h1>
            <p className="text-slate-400">Laden Sie benutzerdefinierte Bilder für Ihre Flugzeuge hoch</p>
          </div>
          <Button 
            onClick={() => updateAllAircraftMutation.mutate()}
            disabled={updateAllAircraftMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {updateAllAircraftMutation.isPending ? 'Aktualisiere...' : 'Alle Flugzeuge aktualisieren'}
          </Button>
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