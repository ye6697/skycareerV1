import React from 'react';
import SeatMapView from '@/components/aircraft/SeatMapView';
import { computeBooking, ECONOMY_TIERS } from '@/lib/cabinConfig';
import { useLanguage } from '@/components/LanguageContext';

// Visual booking preview: top-down seat map with occupied seats + revenue per class.
export default function BookingPreview({ contract, aircraft, company }) {
  const { lang } = useLanguage();
  const de = lang === 'de';
  if (!contract || !aircraft) return null;

  const booking = computeBooking({ contract, aircraft, company });
  const { seats, revenue } = booking;
  const ecoLabel = ECONOMY_TIERS[seats.economy_tier]?.label?.[de ? 'de' : 'en'] || 'Economy';

  return (
    <div className="rounded-lg border border-cyan-900/50 bg-slate-950/70 p-3">
      <p className="text-xs font-mono uppercase tracking-wider text-cyan-300 mb-2">
        {de ? 'Buchungslage (abhängig von Reputation)' : 'Booking status (based on reputation)'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <SeatMapView
          aircraft={aircraft}
          occupied={{ first: booking.first_booked, business: booking.business_booked, economy: booking.economy_booked }}
          height={260}
        />
        <div className="space-y-1.5 text-[11px] font-mono">
          <div className="flex justify-between rounded border border-slate-800 bg-slate-900/70 px-2 py-1.5">
            <span className="text-slate-300">{de ? 'Auslastung' : 'Load factor'}</span>
            <span className={`font-bold ${booking.load_factor >= 0.75 ? 'text-emerald-300' : booking.load_factor >= 0.5 ? 'text-amber-300' : 'text-red-300'}`}>
              {Math.round(booking.load_factor * 100)}% ({booking.total_booked}/{seats.total})
            </span>
          </div>
          {seats.first > 0 && (
            <div className="flex justify-between rounded border border-amber-900/40 bg-amber-950/20 px-2 py-1.5">
              <span className="text-amber-200">First {booking.first_booked}/{seats.first}</span>
              <span className="text-amber-300">${revenue.first.toLocaleString()}</span>
            </div>
          )}
          {seats.business > 0 && (
            <div className="flex justify-between rounded border border-purple-900/40 bg-purple-950/20 px-2 py-1.5">
              <span className="text-purple-200">Business {booking.business_booked}/{seats.business}</span>
              <span className="text-purple-300">${revenue.business.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between rounded border border-cyan-900/40 bg-cyan-950/20 px-2 py-1.5">
            <span className="text-cyan-200">{ecoLabel} {booking.economy_booked}/{seats.economy}</span>
            <span className="text-cyan-300">${revenue.economy.toLocaleString()}</span>
          </div>
          <div className="flex justify-between rounded border border-emerald-800/50 bg-emerald-950/30 px-2 py-2">
            <span className="text-emerald-200 font-bold">{de ? 'Ticket-Umsatz' : 'Ticket revenue'}</span>
            <span className="text-emerald-300 font-bold text-sm">${revenue.total.toLocaleString()}</span>
          </div>
          <p className="text-[9px] text-slate-500 leading-relaxed">
            {de
              ? 'Gebuchte Sitze werden beim Flugstart fixiert. Bessere Reputation = vollere Flüge und mehr Premium-Buchungen.'
              : 'Booked seats are locked in at flight start. Better reputation = fuller flights and more premium bookings.'}
          </p>
        </div>
      </div>
    </div>
  );
}