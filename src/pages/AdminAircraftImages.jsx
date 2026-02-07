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
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  // Static market data with default aircraft types for image assignment
  const AIRCRAFT_MARKET = [
    { name: "Cessna 172 Skyhawk", type: "small_prop" },
    { name: "Piper PA-28 Cherokee", type: "small_prop" },
    { name: "Piper PA-44 Seminole", type: "small_prop" },
    { name: "Socata Tobago", type: "small_prop" },
    { name: "Piper PA-46 Malibu", type: "turboprop" },
    { name: "Beechcraft King Air 350", type: "turboprop" },
    { name: "Cessna Caravan", type: "turboprop" },
    { name: "Bombardier Dash 8-100", type: "turboprop" },
    { name: "Bombardier Q400", type: "turboprop" },
    { name: "Bombardier CRJ-200", type: "regional_jet" },
    { name: "Embraer E170", type: "regional_jet" },
    { name: "Embraer E175", type: "regional_jet" },
    { name: "Airbus A220", type: "regional_jet" },
    { name: "Airbus A318", type: "narrow_body" },
    { name: "Airbus A319", type: "narrow_body" },
    { name: "Airbus A320neo", type: "narrow_body" },
    { name: "Boeing 737-700", type: "narrow_body" },
    { name: "Boeing 737 MAX 8", type: "narrow_body" },
    { name: "Boeing 787-8", type: "narrow_body" },
    { name: "Airbus A300", type: "wide_body" },
    { name: "Airbus A330-200", type: "wide_body" },
    { name: "Boeing 777-200ER", type: "wide_body" },
    { name: "Boeing 777-300ER", type: "wide_body" },
    { name: "Airbus A350-900", type: "wide_body" },
    { name: "Boeing 747-8", type: "wide_body" },
    { name: "Airbus A380", type: "wide_body" },
    { name: "ATR 72F", type: "cargo" },
    { name: "Airbus A330-200F", type: "cargo" },
    { name: "Boeing 777F", type: "cargo" },
    { name: "Boeing 747-8F", type: "cargo" }
  ];

  const { data: aircraft = [] } = useQuery({
    queryKey: ['aircraft', 'all'],
    queryFn: async () => {
      const companies = await base44.entities.Company.list();
      const companyId = companies[0]?.id;
      
      if (!companyId) {
        // If no company, show all market aircraft as templates
        return AIRCRAFT_MARKET.map((ac, idx) => ({
          id: `template_${idx}`,
          name: ac.name,
          type: ac.type,
          registration: 'N/A',
          isTemplate: true
        }));
      }
      
      // Get owned aircraft from database
      const ownedAircraft = await base44.entities.Aircraft.filter({ company_id: companyId });
      
      // Combine owned aircraft with market templates that don't have owned versions
      const ownedNames = new Set(ownedAircraft.map(ac => ac.name));
      const templates = AIRCRAFT_MARKET.filter(ac => !ownedNames.has(ac.name)).map((ac, idx) => ({
        id: `template_${idx}`,
        name: ac.name,
        type: ac.type,
        registration: 'Template',
        isTemplate: true
      }));
      
      return [...ownedAircraft, ...templates];
    },
    refetchInterval: 3000
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ aircraftId, file, isTemplate, aircraftName }) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      if (isTemplate) {
        // For template aircraft, create a new owned aircraft with the image
        const user = await base44.auth.me();
        const companies = await base44.entities.Company.filter({ created_by: user.email });
        const company = companies[0];
        
        if (company) {
          // Find the template data to get aircraft type and specs
          const templateData = AIRCRAFT_MARKET.find(ac => ac.name === aircraftName);
          if (templateData) {
            await base44.entities.Aircraft.create({
              company_id: company.id,
              name: aircraftName,
              type: templateData.type,
              registration: `${company.callsign || 'N'}${String(Date.now()).slice(-3)}`,
              image_url: file_url,
              passenger_capacity: templateData.passenger_capacity || 0,
              cargo_capacity_kg: templateData.cargo_capacity_kg || 0,
              fuel_consumption_per_hour: templateData.fuel_consumption_per_hour || 0,
              range_nm: templateData.range_nm || 0,
              purchase_price: templateData.purchase_price || 0,
              maintenance_cost_per_hour: templateData.maintenance_cost_per_hour || 0,
              status: 'available',
              total_flight_hours: 0,
              current_value: templateData.purchase_price || 0
            });
          }
        }
      } else {
        // For owned aircraft, just update the image
        await base44.entities.Aircraft.update(aircraftId, { image_url: file_url });
      }
      
      return file_url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      setUploadingId(null);
    }
  });

  const handleFileSelect = async (e, aircraftId, isTemplate = false, aircraftName = '') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(aircraftId);
    uploadImageMutation.mutate({ aircraftId, file, isTemplate, aircraftName });
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
            {aircraft.map((ac) => (
              <motion.div
                key={ac.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="overflow-hidden bg-slate-800 border-slate-700 flex flex-col h-full">
                  <div className="relative h-40 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center overflow-hidden group">
                    {ac.image_url ? (
                      <motion.img
                        src={ac.image_url}
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
                          onChange={(e) => handleFileSelect(e, ac.id)}
                          disabled={uploadingId === ac.id}
                          className="hidden"
                        />
                        <Button
                          asChild
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <span className="cursor-pointer">
                            {uploadingId === ac.id ? (
                              <>Lädt...</>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                Bild ändern
                              </>
                            )}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>

                  <div className="p-4 flex-grow bg-gradient-to-br from-slate-800 to-slate-900">
                    <p className="font-bold text-white text-sm line-clamp-1">{ac.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{ac.registration}</p>

                    <div className="mt-3 flex items-center gap-2">
                      {ac.image_url ? (
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
                        onChange={(e) => handleFileSelect(e, ac.id)}
                        disabled={uploadingId === ac.id}
                        className="hidden"
                      />
                      <Button
                        asChild
                        size="sm"
                        variant={ac.image_url ? "outline" : "default"}
                        className="w-full cursor-pointer"
                      >
                        <span className="cursor-pointer">
                          {uploadingId === ac.id ? (
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
            ))}
          </AnimatePresence>
        </div>

        {aircraft.length === 0 && (
          <Card className="p-12 text-center bg-slate-800 border-slate-700">
            <ImageIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Keine Flugzeuge</h3>
            <p className="text-slate-400">Sie haben noch keine Flugzeuge in Ihrer Flotte</p>
          </Card>
        )}
      </div>
    </div>
  );
}