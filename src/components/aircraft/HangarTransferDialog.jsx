import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { getVariantMeta, getSizeSpec } from '@/components/contracts/hangarModelCatalog';
import { useLanguage } from '@/components/LanguageContext';

const allowedTypesOf = (h) =>
  Array.isArray(h?.allowed_types) && h.allowed_types.length > 0
    ? h.allowed_types.map((t) => String(t).toLowerCase())
    : getVariantMeta(h?.model_variant)?.allowedTypes || getSizeSpec(h?.size)?.allowedTypes || [];

const slotsOf = (h) =>
  Number(h?.slots) > 0
    ? Number(h.slots)
    : getVariantMeta(h?.model_variant)?.slots || getSizeSpec(h?.size)?.slots || 1;

const labelOf = (h) => getVariantMeta(h?.model_variant)?.label || String(h?.size || 'Hangar');

// Move an aircraft into another owned hangar (old hangar system).
export default function HangarTransferDialog({ aircraft, hangars = [], fleet = [], companyId, onClose }) {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  if (!aircraft) return null;

  const occupancy = {};
  fleet.filter((a) => String(a?.status || '').toLowerCase() !== 'sold').forEach((a) => {
    const hid = String(a?.hangar_id || '').trim();
    if (hid) occupancy[hid] = (occupancy[hid] || 0) + 1;
  });
  const acType = String(aircraft.type || '').toLowerCase();

  const move = async (hangar) => {
    setError('');
    setBusyId(hangar.id);
    try {
      const res = await base44.functions.invoke('moveAircraftToHangar', {
        aircraftId: aircraft.id,
        targetHangarId: String(hangar.id),
        companyId,
        knownHangars: hangars,
        transferCost: 0,
        lang,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      onClose();
    } catch (e) {
      setError(e?.message || 'Transfer failed');
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-lg border border-cyan-800/60 bg-slate-900 p-4 font-mono space-y-3">
        <div>
          <p className="text-[11px] uppercase text-cyan-300">
            {lang === 'de' ? 'Hangar wechseln' : 'Move to hangar'}
          </p>
          <p className="text-sm font-bold text-white uppercase">
            {aircraft.name} {aircraft.registration ? `(${aircraft.registration})` : ''}
          </p>
        </div>

        {hangars.length === 0 &&
        <p className="text-[10px] text-amber-300">
          {lang === 'de' ? 'Keine Hangars vorhanden.' : 'No hangars available.'}
        </p>
        }

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {hangars.map((h) => {
            const used = occupancy[String(h.id)] || 0;
            const slots = slotsOf(h);
            const isCurrent = String(aircraft.hangar_id || '') === String(h.id);
            const fits = allowedTypesOf(h).includes(acType);
            const hasSlot = used < slots || isCurrent;
            const disabled = isCurrent || !fits || !hasSlot || !!busyId;
            return (
              <div key={h.id} className="flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-950/70 p-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-cyan-100 truncate">
                    {String(h.airport_icao || '').toUpperCase()} · {labelOf(h)}
                  </p>
                  <p className="text-[9px] text-slate-400">
                    {used}/{slots} {lang === 'de' ? 'belegt' : 'used'}
                    {isCurrent ? (lang === 'de' ? ' · Aktuell' : ' · Current') : ''}
                    {!fits ? (lang === 'de' ? ' · Typ passt nicht' : ' · Type not allowed') : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={disabled}
                  onClick={() => move(h)}
                  className="h-7 text-[10px] uppercase bg-cyan-900/50 text-cyan-300 hover:bg-cyan-800 border border-cyan-700/50 disabled:bg-slate-800 disabled:text-slate-500 flex-shrink-0">
                  {busyId === h.id
                    ? (lang === 'de' ? 'Verlege...' : 'Moving...')
                    : (lang === 'de' ? 'Verlegen' : 'Move')}
                </Button>
              </div>
            );
          })}
        </div>

        {error && <p className="text-[10px] text-red-300">{error}</p>}

        <Button
          onClick={onClose}
          size="sm"
          className="h-8 w-full bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px] uppercase">
          {lang === 'de' ? 'Schliessen' : 'Close'}
        </Button>
      </div>
    </div>
  );
}