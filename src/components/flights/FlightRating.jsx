import React from 'react';
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { 
  Star, 
  Plane, 
  PlaneTakeoff, 
  PlaneLanding,
  MessageCircle
} from "lucide-react";

export default function FlightRating({ flight }) {
  const getRatingColor = (rating) => {
    if (rating >= 4.5) return "text-emerald-500";
    if (rating >= 3.5) return "text-blue-500";
    if (rating >= 2.5) return "text-amber-500";
    return "text-red-500";
  };

  const getRatingLabel = (rating) => {
    if (rating >= 4.5) return "Ausgezeichnet";
    if (rating >= 3.5) return "Gut";
    if (rating >= 2.5) return "Akzeptabel";
    if (rating >= 1.5) return "Schlecht";
    return "Katastrophal";
  };

  const RatingStars = ({ rating, label, icon: Icon }) => (
    <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'text-amber-400 fill-amber-400'
                : star - 0.5 <= rating
                ? 'text-amber-400 fill-amber-400/50'
                : 'text-slate-200'
            }`}
          />
        ))}
        <span className={`ml-2 font-semibold ${getRatingColor(rating)}`}>
          {rating?.toFixed(1) || "-"}
        </span>
      </div>
    </div>
  );

  return (
    <Card className="p-6 bg-slate-800 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Passagier-Bewertung</h3>
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          <span className={`text-2xl font-bold ${getRatingColor(flight?.overall_rating)}`}>
            {flight?.overall_rating?.toFixed(1) || "-"}
          </span>
          <span className="text-sm text-slate-400">/ 5.0</span>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <RatingStars 
          rating={flight?.takeoff_rating} 
          label="Start" 
          icon={PlaneTakeoff} 
        />
        <RatingStars 
          rating={flight?.flight_rating} 
          label="Flug" 
          icon={Plane} 
        />
        <RatingStars 
          rating={flight?.landing_rating} 
          label="Landung" 
          icon={PlaneLanding} 
        />
      </div>

      {flight?.landing_vs && (
        <div className="p-4 bg-slate-900 rounded-lg mb-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Landegeschw.</p>
              <p className={`text-xl font-mono font-bold ${
                Math.abs(flight.landing_vs) < 150 ? 'text-emerald-400' :
                Math.abs(flight.landing_vs) < 300 ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {flight.landing_vs} ft/min
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Max G-Kraft</p>
              <p className={`text-xl font-mono font-bold ${
                flight.max_g_force < 1.5 ? 'text-emerald-400' :
                flight.max_g_force < 2.0 ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {flight.max_g_force?.toFixed(2) || "-"} G
              </p>
            </div>
          </div>
        </div>
      )}

      {flight?.passenger_comments?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-4 h-4 text-slate-400" />
            <h4 className="font-medium text-white">Passagier-Kommentare</h4>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {flight.passenger_comments.map((comment, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-3 bg-slate-900 rounded-lg text-sm text-slate-300 italic"
              >
                "{comment}"
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-300">
          <strong>Status:</strong> {getRatingLabel(flight?.overall_rating)}
        </p>
      </div>
    </Card>
  );
}