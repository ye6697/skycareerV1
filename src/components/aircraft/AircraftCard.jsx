import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { 
  Plane, 
  Users, 
  Package, 
  Fuel,
  Clock,
  Wrench,
  DollarSign
} from "lucide-react";

export default function AircraftCard({ aircraft, onSelect, onMaintenance, onView }) {
  const typeConfig = {
    small_prop: { label: "Propeller (Klein)", icon: "🛩️" },
    turboprop: { label: "Turboprop", icon: "✈️" },
    regional_jet: { label: "Regionaljet", icon: "🛫" },
    narrow_body: { label: "Narrow-Body", icon: "✈️" },
    wide_body: { label: "Wide-Body", icon: "🛬" },
    cargo: { label: "Fracht", icon: "📦" }
  };

  const statusConfig = {
    available: { label: "Verfügbar", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    in_flight: { label: "Im Flug", color: "bg-blue-100 text-blue-700 border-blue-200" },
    maintenance: { label: "Wartung", color: "bg-amber-100 text-amber-700 border-amber-200" },
    sold: { label: "Verkauft", color: "bg-slate-100 text-slate-600 border-slate-200" }
  };

  const type = typeConfig[aircraft.type] || typeConfig.small_prop;
  const status = statusConfig[aircraft.status] || statusConfig.available;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden bg-slate-800 border border-slate-700 hover:border-slate-600 hover:shadow-lg transition-all duration-300">
        <div className="relative h-32 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
          {aircraft.image_url ? (
            <img 
              src={aircraft.image_url} 
              alt={aircraft.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-5xl">{type.icon}</span>
          )}
          <Badge className={`absolute top-3 right-3 ${status.color} border`}>
            {status.label}
          </Badge>
        </div>

        <div className="p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-lg text-white">{aircraft.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-sm text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {aircraft.registration}
              </span>
              <span className="text-sm text-slate-400">{type.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <Users className="w-4 h-4 text-slate-400" />
              <span>{aircraft.passenger_capacity || 0} Sitze</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Package className="w-4 h-4 text-slate-400" />
              <span>{aircraft.cargo_capacity_kg?.toLocaleString() || 0} kg</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Fuel className="w-4 h-4 text-slate-400" />
              <span>{aircraft.fuel_consumption_per_hour} L/h</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Plane className="w-4 h-4 text-slate-400" />
              <span>{aircraft.range_nm?.toLocaleString()} NM</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Flugstunden</span>
            </div>
            <span className="font-semibold text-white">
              {aircraft.total_flight_hours?.toLocaleString() || 0}h
            </span>
          </div>

          <div className="flex items-center justify-between text-sm mb-4">
            <div className="flex items-center gap-1 text-slate-400">
              <Wrench className="w-4 h-4" />
              <span>Wartung/h:</span>
            </div>
            <span className="font-medium text-slate-300">
              ${aircraft.maintenance_cost_per_hour?.toLocaleString()}
            </span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onView?.(aircraft)}>
              Details
            </Button>
            {aircraft.status === "available" && (
              <Button 
                size="sm" 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => onSelect?.(aircraft)}
              >
                Auswählen
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}