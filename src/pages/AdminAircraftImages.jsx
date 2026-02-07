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

  const { data: aircraft = [] } = useQuery({
    queryKey: ['aircraft', 'all'],
    queryFn: async () => {
      const companies = await base44.entities.Company.list();
      const companyId = companies[0]?.id;
      return companyId ? base44.entities.Aircraft.filter({ company_id: companyId }) : [];
    }
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ aircraftId, file }) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Aircraft.update(aircraftId, { image_url: file_url });
      return file_url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      setUploadingId(null);
    }
  });

  const handleFileSelect = async (e, aircraftId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(aircraftId);
    uploadImageMutation.mutate({ aircraftId, file });
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