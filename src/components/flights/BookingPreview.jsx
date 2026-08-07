import React from 'react';
import SeatMapView from '@/components/aircraft/SeatMapView';
import { computeBooking, ECONOMY_TIERS } from '@/lib/cabinConfig';
import { useLanguage } from '@/components/LanguageContext';
import { TrendingUp, Route } from 'lucide-react';

function ClassRow({ label, booked, total, ticket, revenue, barClass, textClass, borderClass }) {
  const pct = total > 0 ? Math.round((booked / total) * 100) : 0;
  return (
    <div className={`rounded border ${borderClass} bg-slate-900/70 px-2 py-1.5`}>
      <div className="flex items-center justify-between mb-1">
        <span className={textClass}>{label} <span className="text-slate-500">{booked}/{total}</span></span>
        <span className={`${textClass} font-bold`}>${revenue.toLocaleString()}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-0.5 text-[9px] text-slate-500">
        <span>{pct}%</span>
        <span>${ticket.toLocaleString()} / Ticket</span>
      </div>
    </div>
  );
}

// Visual booking preview: top-down seat map with occupied seats + revenue per class.
export default function BookingPreview({ contract, aircraft, company }) {
  const { lang } = useLanguage();
  const de = lang === 'de';
  if (!contract || !aircraft) return null;

  const booking = computeBooking({ contract, aircraft, company });
  const { seats, revenue, tickets, factors } = booking;
  const ecoLabel = ECONOMY_TIERS[seats.economy_tier]?.label?.[de ? 'de' : 'en'] || 'Economy';
  const lfPct = Math.round(booking.load_factor * 100);
  const premiumDemandPct = Math.round((0.55 + 0.45 * factors.long_haul) * 100);

  return (
    <div className="rounded-lg border border-cyan-900/50 bg-slate-950/70 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-mono uppercase tracking-wider text-cyan-300">
          {de ? 'Buchungslage' : 'Booking status'}
        </p>
        <span className={`text-xs font-mono font-bold ${lfPct >= 75 ? 'text-emerald-300' : lfPct >= 50 ? 'text-amber-300' : 'text-red-300'}`}>
          {lfPct}% ({booking.total_booked}/{seats.total})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <SeatMapView
          aircraft={aircraft}
          occupied={{ first: booking.first_booked, business: booking.business_booked, economy: booking.economy_booked }}
          height={280}
        />
        <div className="space-y-1.5 text-[11px] font-mono">
          {seats.first > 0 && (
            <ClassRow
              label="First" booked={booking.first_booked} total={seats.first}
              ticket={tickets.first} revenue={revenue.first}
              barClass="bg-amber-400" textClass="text-amber-200" borderClass="border-amber-900/40"
            />
          )}
          {seats.business > 0 && (
            <ClassRow
              label="Business" booked={booking.business_booked} total={seats.business}
              ticket={tickets.business} revenue={revenue.business}
              barClass="bg-purple-400" textClass="text-purple-200" borderClass="border-purple-900/40"
            />
          )}
          <ClassRow
            label={ecoLabel} booked={booking.economy_booked} total={seats.economy}
            ticket={tickets.economy} revenue={revenue.economy}
            barClass="bg-cyan-400" textClass="text-cyan-200" borderClass="border-cyan-900/40"
          />

          <div className="flex justify-between rounded border border-emerald-800/50 bg-emerald-950/30 px-2 py-2">
            <span className="text-emerald-200 font-bold">{de ? 'Ticket-Umsatz' : 'Ticket revenue'}</span>
            <span className="text-emerald-300 font-bold text-sm">${revenue.total.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[9px]">
            <div className="rounded border border-slate-800 bg-slate-900/60 px-1.5 py-1 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-cyan-500 flex-shrink-0" />
              <span className="text-slate-400">
                {de ? 'Reputation' : 'Reputation'} <span className="text-slate-200">{Math.round(factors.reputation)}/100</span>
              </span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/60 px-1.5 py-1 flex items-center gap-1.5">
              <Route className="w-3 h-3 text-cyan-500 flex-shrink-0" />
              <span className="text-slate-400">
                {de ? 'Premium-Nachfrage' : 'Premium demand'} <span className="text-slate-200">{premiumDemandPct}%</span>
              </span>
            </div>
          </div>

          <p className="text-[9px] text-slate-500 leading-relaxed">
            {de
              ? 'Gebuchte Sitze werden beim Flugstart fixiert. Bessere Reputation füllt die Kabine, Langstrecken steigern Premium-Nachfrage und -Preise.'
              : 'Booked seats are locked in at flight start. Better reputation fills the cabin; long-haul routes boost premium demand and fares.'}
          </p>
        </div>
      </div>
    </div>
  );
}