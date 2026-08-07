import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SeatMapView from '@/components/aircraft/SeatMapView';
import { computeBooking } from '@/lib/cabinConfig';
import { useLanguage } from '@/components/LanguageContext';
import { Loader2, Ticket } from 'lucide-react';

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
  const lfPct = Math.round((booked / Math.max(1, booking.seats.total)) * 100);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && done) onClose?.(); }}>
      <DialogContent className="max-w-lg border border-cyan-800 bg-slate-950 text-slate-200 [&>button]:hidden">
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-500">
            {contract.departure_airport} → {contract.arrival_airport}
          </p>
          <h2 className="mt-1 flex items-center justify-center gap-2 font-mono text-sm uppercase tracking-wider text-cyan-300">
            {done ? <Ticket className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            {done
              ? (de ? 'Buchung abgeschlossen' : 'Booking closed')
              : (de ? 'Ticketverkauf läuft…' : 'Selling tickets…')}
          </h2>
        </div>

        <SeatMapView aircraft={aircraft} occupied={{ first, business, economy }} height={300} />

        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center font-mono">
          <div className="rounded-lg border border-cyan-900/50 bg-slate-900/70 p-2">
            <p className="text-[9px] uppercase text-slate-500">Economy</p>
            <p className="text-sm font-bold text-cyan-300">{economy}/{booking.seats.economy}</p>
          </div>
          <div className="rounded-lg border border-purple-900/50 bg-slate-900/70 p-2">
            <p className="text-[9px] uppercase text-slate-500">Business</p>
            <p className="text-sm font-bold text-purple-300">{business}/{booking.seats.business}</p>
          </div>
          <div className="rounded-lg border border-amber-900/50 bg-slate-900/70 p-2">
            <p className="text-[9px] uppercase text-slate-500">First</p>
            <p className="text-sm font-bold text-amber-300">{first}/{booking.seats.first}</p>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/25 p-3 text-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400/80">
            {done ? (de ? 'Tatsächlicher Payout' : 'Actual payout') : (de ? 'Ticketerlös' : 'Ticket revenue')}
          </p>
          <p className="font-mono text-2xl font-bold text-emerald-300">${revenue.toLocaleString()}</p>
          <p className="font-mono text-[10px] text-slate-500">
            {de ? 'Auslastung' : 'Load factor'} {lfPct}% · {booked}/{booking.seats.total} {de ? 'Sitze' : 'seats'}
          </p>
        </div>

        <Button
          onClick={() => onClose?.()}
          disabled={!done}
          className="h-9 w-full bg-cyan-600 font-mono text-xs font-bold uppercase text-slate-950 hover:bg-cyan-500 disabled:opacity-50"
        >
          {done ? (de ? 'Zu den aktiven Flügen' : 'Go to active flights') : (de ? 'Bitte warten…' : 'Please wait…')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}