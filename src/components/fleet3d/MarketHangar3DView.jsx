import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Plane, GraduationCap, CheckCircle2 } from 'lucide-react';

const TYPE_LABELS_BY_TYPE = {
  small_prop: { en: 'Propeller', de: 'Propeller' },
  turboprop: { en: 'Turboprop', de: 'Turboprop' },
  regional_jet: { en: 'Regional Jet', de: 'Regionaljet' },
  narrow_body: { en: 'Narrow-Body', de: 'Narrow-Body' },
  wide_body: { en: 'Wide-Body', de: 'Wide-Body' },
  cargo: { en: 'Cargo', de: 'Fracht' },
};
import AircraftHangar3D from '@/components/fleet3d/AircraftHangar3D';
import { userHasTypeRating } from '@/lib/typeRatings';
import { getCruiseSpeedForModel } from '@/components/flights/aircraftSpeedLookup';

function toListingKey(listing) {
  if (!listing) return '';
  return String(listing.market_listing_id || listing.id || listing.name || '');
}

function toIcao(value) {
  return String(value || '').toUpperCase();
}

function toHangarId(hangar) {
  return String(hangar?.id || hangar?.hangar_id || hangar?._id || '').trim();
}

export default function MarketHangar3DView({
  listings = [],
  lang = 'en',
  company = null,
  marketSection = 'new',
  usedConditionFilter = 'all',
  usedConditionProfiles = [],
  onSetMarketSection,
  onSetMarketViewMode,
  onSetUsedConditionFilter,
  onClose,
  canAfford,
  canPurchase,
  onBuy,
  onConfirmBuy,
  getPurchaseHangarOptions,
  isBuying,
  selectedListingId,
  currentUser = null,
  onRequestTypeRating,
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [hangarSelectionByListing, setHangarSelectionByListing] = useState({});

  const visibleListings = useMemo(() => listings, [listings]);
  const clampedIdx = Math.min(Math.max(0, selectedIdx), Math.max(0, visibleListings.length - 1));
  const current = visibleListings[clampedIdx] || null;
  const currentKey = toListingKey(current);

  if (!current) {
    return (
      <Card className="p-8 text-center bg-slate-900/80 border border-cyan-900/30 flex flex-col items-center">
        <Plane className="w-10 h-10 text-cyan-900 mx-auto mb-2" />
        <h3 className="text-sm font-mono text-cyan-600 mb-1">
          {lang === 'de' ? 'KEINE ANGEBOTE' : 'NO LISTINGS'}
        </h3>
      </Card>
    );
  }

  const hasLevel = (company?.level || 1) >= (current.level_requirement || 1);
  const hasBalance = canAfford(current.purchase_price);
  const hasRating = userHasTypeRating(currentUser, current.name);
  const purchasable = canPurchase(current);
  const isBuyingThis = isBuying && String(selectedListingId || '') === currentKey;

  const hangarOptions = Array.isArray(getPurchaseHangarOptions?.(current))
    ? getPurchaseHangarOptions(current)
    : [];
  const selectedHangarId = String(hangarSelectionByListing[currentKey] || '').trim();
  const fallbackHangarId = toHangarId(hangarOptions[0]);
  const effectiveHangarId = selectedHangarId || fallbackHangarId;
  const canDirectBuy = Boolean(purchasable && effectiveHangarId && hangarOptions.length > 0 && hasRating);

  const typeLabel = TYPE_LABELS_BY_TYPE[current.type]?.[lang] || TYPE_LABELS_BY_TYPE[current.type]?.en || String(current.type || '').replace(/_/g, ' ').toUpperCase();

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-slate-950">
      <AircraftHangar3D aircraft={current} />

      {/* Big prominent left/right arrows for switching aircraft */}
      {visibleListings.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setSelectedIdx((idx) => (idx - 1 + visibleListings.length) % visibleListings.length)}
            className="group absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-40 h-16 w-12 sm:h-20 sm:w-14 rounded-r-2xl rounded-l-md border border-cyan-500/60 bg-slate-950/80 hover:bg-cyan-950/80 hover:border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.25)] backdrop-blur-sm flex items-center justify-center transition-all"
            aria-label="Previous aircraft"
          >
            <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-300 group-hover:text-cyan-100 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedIdx((idx) => (idx + 1) % visibleListings.length)}
            className="group absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-40 h-16 w-12 sm:h-20 sm:w-14 rounded-l-2xl rounded-r-md border border-cyan-500/60 bg-slate-950/80 hover:bg-cyan-950/80 hover:border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.25)] backdrop-blur-sm flex items-center justify-center transition-all"
            aria-label="Next aircraft"
          >
            <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-300 group-hover:text-cyan-100 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </>
      )}

      <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-slate-950/95 via-slate-900/85 to-transparent px-3 pt-2 pb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <div className="text-cyan-300 font-mono font-bold text-sm truncate flex items-center gap-1.5">
                <span className="truncate">{current.name}</span>
                {hasRating ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    {lang === 'de' ? 'Rating ✓' : 'Rating ✓'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/50 shrink-0">
                    <GraduationCap className="w-2.5 h-2.5" />
                    {lang === 'de' ? 'Rating fehlt' : 'No rating'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase">
                <span className="text-cyan-600">{clampedIdx + 1} / {visibleListings.length}</span>
                <span className="text-slate-600">|</span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
                  {typeLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              onClick={() => onSetMarketSection?.('new')}
              className={`h-7 px-2 text-[10px] font-mono uppercase ${
                marketSection === 'new' ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {lang === 'de' ? 'Neu' : 'New'}
            </Button>
            <Button
              size="sm"
              onClick={() => onSetMarketSection?.('used')}
              className={`h-7 px-2 text-[10px] font-mono uppercase ${
                marketSection === 'used' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {lang === 'de' ? 'Used' : 'Used'}
            </Button>
            <Button
              size="sm"
              onClick={() => onSetMarketViewMode?.('grid')}
              className="h-7 px-2 text-[10px] font-mono uppercase bg-slate-800 text-slate-300"
            >
              Grid
            </Button>
            <Button
              size="sm"
              onClick={() => onClose?.()}
              className="h-7 px-2 text-[10px] font-mono uppercase bg-slate-800 text-slate-200"
            >
              {lang === 'de' ? 'Schliessen' : 'Close'}
            </Button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto">
            {visibleListings.map((listing, idx) => (
              <button
                key={toListingKey(listing) || `${listing.name}-${idx}`}
                onClick={() => setSelectedIdx(idx)}
                className={`px-2 py-1 rounded font-mono text-[10px] uppercase whitespace-nowrap border transition-colors ${
                  idx === clampedIdx
                    ? 'bg-cyan-900/70 border-cyan-400 text-cyan-200'
                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-cyan-700'
                }`}
              >
                {listing.name}
              </button>
            ))}
          </div>
          <div className="text-right font-mono shrink-0">
            <div className={`text-sm font-bold ${purchasable ? 'text-emerald-400' : 'text-amber-400'}`}>
              ${Math.round(current.purchase_price).toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500">
              {lang === 'de' ? 'Level' : 'Level'} {current.level_requirement || 1}
            </div>
          </div>
        </div>

        {marketSection === 'used' && usedConditionProfiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              onClick={() => onSetUsedConditionFilter?.('all')}
              className={`h-6 px-2 text-[10px] font-mono ${
                usedConditionFilter === 'all' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {lang === 'de' ? 'Alle' : 'All'}
            </Button>
            {usedConditionProfiles.map((profile) => (
              <Button
                key={profile.key}
                size="sm"
                onClick={() => onSetUsedConditionFilter?.(profile.key)}
                className={`h-6 px-2 text-[10px] font-mono ${
                  usedConditionFilter === profile.key ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {profile.label?.[lang] || profile.label?.en || profile.key}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent px-3 pt-8 pb-3">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-7 gap-2 text-[10px] font-mono">
            <div className="rounded border border-slate-800 bg-slate-950/85 p-2">
              <div className="text-slate-500">PAX</div>
              <div className="text-cyan-100">{current.passenger_capacity}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/85 p-2">
              <div className="text-slate-500">CGO</div>
              <div className="text-cyan-100">{current.cargo_capacity_kg}kg</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/85 p-2">
              <div className="text-slate-500">BURN</div>
              <div className="text-cyan-100">{current.fuel_consumption_per_hour}L/h</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/85 p-2">
              <div className="text-slate-500">RNG</div>
              <div className="text-cyan-100">{current.range_nm}NM</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/85 p-2">
              <div className="text-slate-500">SPD</div>
              <div className="text-cyan-100">{getCruiseSpeedForModel(current.name, current.type)}kt</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/85 p-2 md:col-span-2">
              <div className="text-slate-500 mb-1">
                {lang === 'de' ? 'Ziel-Hangar' : 'Target hangar'}
              </div>
              <select
                value={effectiveHangarId}
                onChange={(event) => {
                  const next = String(event.target.value || '').trim();
                  setHangarSelectionByListing((prev) => ({ ...prev, [currentKey]: next }));
                }}
                className="h-7 w-full rounded border border-cyan-900/60 bg-slate-950/90 px-2 text-[10px] text-cyan-100"
              >
                {hangarOptions.length === 0 && (
                  <option value="">{lang === 'de' ? 'Kein kompatibler Hangar' : 'No compatible hangar'}</option>
                )}
                {hangarOptions.map((hangar) => {
                  const icao = toIcao(hangar.airport_icao);
                  const hangarId = toHangarId(hangar);
                  return (
                    <option key={`${currentKey}-${hangarId || icao}`} value={hangarId}>
                      {icao} ({hangar.usedSlots}/{hangar.rule?.slots || hangar.slots})
                    </option>
                  );
                })}
              </select>
              {!hasLevel && (
                <div className="mt-1 text-[9px] text-amber-500">
                  {lang === 'de' ? `Level ${current.level_requirement} benoetigt` : `Requires level ${current.level_requirement}`}
                </div>
              )}
              {hasLevel && !hasBalance && (
                <div className="mt-1 text-[9px] text-red-400">
                  {lang === 'de' ? 'Nicht genug Budget' : 'Insufficient budget'}
                </div>
              )}
              {!hasRating && (
                <div className="mt-1 text-[9px] text-amber-300">
                  {lang === 'de' ? 'Type-Rating für dieses Modell erforderlich.' : 'Type-rating required for this model.'}
                </div>
              )}
              {hangarOptions.length === 0 && (
                <div className="mt-1 text-[9px] text-amber-300">
                  {lang === 'de' ? 'Kein kompatibler Hangar mit freiem Slot.' : 'No compatible hangar with a free slot.'}
                </div>
              )}
            </div>
          </div>

          <div className="max-w-6xl mx-auto mt-2 flex items-center justify-end gap-2">
            {!hasRating && onRequestTypeRating && (
              <Button
                type="button"
                onClick={() => onRequestTypeRating(current)}
                size="sm"
                className="h-7 bg-cyan-900/60 text-cyan-200 hover:bg-cyan-800 border border-cyan-700 text-[10px] font-mono uppercase"
              >
                <GraduationCap className="w-3 h-3 mr-1" />
                {lang === 'de' ? 'Type-Rating' : 'Type-rating'}
              </Button>
            )}
            <Button
              type="button"
              onClick={() => onBuy?.(current)}
              size="sm"
              className="h-7 bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 text-[10px] font-mono uppercase"
            >
              {lang === 'de' ? 'Auswaehlen' : 'Select'}
            </Button>
            <Button
              type="button"
              onClick={() => onConfirmBuy?.(current, effectiveHangarId)}
              disabled={!canDirectBuy || isBuying}
              size="sm"
              className={`h-7 text-[10px] font-mono uppercase ${
                canDirectBuy
                  ? 'bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800 border border-emerald-700'
                  : 'bg-slate-800 text-slate-500 border border-slate-700'
              }`}
            >
              {isBuyingThis ? (lang === 'de' ? 'Kaufe...' : 'Buying...') : (lang === 'de' ? 'Jetzt kaufen' : 'Buy now')}
            </Button>
          </div>
      </div>
    </div>
  );
}