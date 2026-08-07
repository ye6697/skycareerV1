import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SeatMapView from '@/components/aircraft/SeatMapView';
import { computeBooking } from '@/lib/cabinConfig';
import { useLanguage } from '@/components/LanguageContext';
import CargoHoldView from '@/components/flights/CargoHoldView';
import { Loader2, Ticket, Users } from 'lucide-react';

const DURATION_MS = 15000;

// Live seat-filling animation after a contract was accepted.
// Seats fill over 15s according to qualifications (reputation, cabin, route),
// then the ACTUAL payout is revealed and reported via onFinished.
export default function BookingAnimationDialog({ contract, aircraft, company, open, onFinished, onClose }) {
  const { lang } = useLanguage();
  const de = lang === 'de';
  const [progress, setProgress] = useState(0);
  const bookingRef = useRef(null);
  const finishedRef = useRef(false);

  if (open && contract && aircraft && !bookingRef.current) {
    bookingRef.current = computeBooking({ contract, aircraft, company });
  }

  useEffect(() => {
    if (!open) {
      bookingRef.current = null;
      finishedRef.current = false;
      setProgress(0);
      return undefined;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / DURATION_MS);
      setProgress(p);
      if (p >= 1) {
        clearInterval(id);
        if (!finishedRef.current && bookingRef.current) {
          finishedRef.current = true;
          onFinished?.(bookingRef.current);
        }
      }
    }, 120);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const booking = bookingRef.current;
  if (!open || !booking) return null;

  // Ease-out so the cabin fills fast first, then trickles in.
  const eased = 1 - Math.pow(1 - progress, 2.2);
  const economy = Math.round(booking.economy_booked * eased);
  const business = Math.round(booking.business_booked * Math.min(1, eased * 1.15));
  const first = Math.round(booking.first_booked * Math.min(1, eased * 1.3));
  const booked = economy + business + first;
  const revenue = Math.round(booking.revenue.total * eased);
  const done = progress >= 1;
  const cargo = booking.cargo || { demand_kg: 0, loaded_kg: 0, capacity_kg: 0, rate_per_kg: 0 };
  const cargoLoaded = Math.round(cargo.loaded_kg * Math.min(1, eased * 1.1));
  const cargoRevenue = Math.round((booking.revenue.cargo || 0) * Math.min(1, eased * 1.1));
  const hasSeats = booking.seats.total > 0;
  const lfPct = Math.round((booked / Math.max(1, booking.seats.total)) * 100);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && done) onClose?.(); }}>
      <DialogContent className="max-w-2xl border border-cyan-900/60 bg-slate-950 p-0 text-slate-200 max-h-[94vh] overflow-hidden flex flex-col [&>button]:hidden">
        <div className="shrink-0 border-b border-cyan-900/40 bg-gradient-to-r from-cyan-950/60 via-slate-950 to-slate-950 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500">
                {contract.departure_airport} → {contract.arrival_airport}
              </p>
              <h2 className="mt-0.5 flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-cyan-200">
                {done ? <Ticket className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                {done
                  ? (de ? 'Beladung abgeschlossen' : 'Loading complete')
                  : (de ? 'Verkauf & Beladung läuft…' : 'Selling & loading…')}
              </h2>
            </div>
            <span className="shrink-0 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-300">
              {aircraft.name}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400 transition-[width] duration-150"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-cyan-900/40 bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.18),transparent_50%),#020617] p-2">
              <SeatMapView aircraft={aircraft} occupied={{ first, business, economy }} height={300} />
            </div>

            <div className="space-y-2.5">
              {hasSeats && (
                <>
                  <div className="rounded-xl border border-cyan-900/40 bg-slate-950/80 p-3">
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
                      <span className="flex items-center gap-1.5 text-cyan-300">
                        <Users className="h-3.5 w-3.5" /> {de ? 'Kabine' : 'Cabin'}
                      </span>
                      <span className="text-slate-400">{booked}/{booking.seats.total} · {lfPct}%</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-center font-mono">
                      <div className="rounded-lg border border-cyan-900/50 bg-cyan-950/25 p-1.5">
                        <p className="text-[9px] uppercase text-cyan-500/80">Economy</p>
                        <p className="text-sm font-bold text-cyan-200">{economy}/{booking.seats.economy}</p>
                      </div>
                      <div className="rounded-lg border border-purple-900/50 bg-purple-950/25 p-1.5">
                        <p className="text-[9px] uppercase text-purple-400/80">Business</p>
                        <p className="text-sm font-bold text-purple-200">{business}/{booking.seats.business}</p>
                      </div>
                      <div className="rounded-lg border border-amber-900/50 bg-amber-950/25 p-1.5">
                        <p className="text-[9px] uppercase text-amber-500/80">First</p>
                        <p className="text-sm font-bold text-amber-200">{first}/{booking.seats.first}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <CargoHoldView
                loadedKg={cargoLoaded}
                demandKg={cargo.demand_kg}
                capacityKg={cargo.capacity_kg}
                revenue={cargoRevenue}
                ratePerKg={cargo.rate_per_kg}
                de={de}
              />

              <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/25 p-3 text-center">
                <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400/80">
                  {done ? (de ? 'Tatsächlicher Payout' : 'Actual payout') : (de ? 'Erlös bisher' : 'Revenue so far')}
                </p>
                <p className="font-mono text-2xl font-bold text-emerald-300">${revenue.toLocaleString()}</p>
                <p className="font-mono text-[10px] text-slate-500">
                  {de ? 'Tickets' : 'Tickets'} ${Math.round((booking.revenue.total - (booking.revenue.cargo || 0)) * eased).toLocaleString()}
                  {cargo.demand_kg > 0 && <> · {de ? 'Fracht' : 'Freight'} ${cargoRevenue.toLocaleString()}</>}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-800 bg-slate-950/95 p-3">
          <Button
            onClick={() => onClose?.()}
            disabled={!done}
            className="h-9 w-full bg-cyan-600 font-mono text-xs font-bold uppercase text-slate-950 hover:bg-cyan-500 disabled:opacity-50"
          >
            {done ? (de ? 'Zu den aktiven Flügen' : 'Go to active flights') : (de ? 'Bitte warten…' : 'Please wait…')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}