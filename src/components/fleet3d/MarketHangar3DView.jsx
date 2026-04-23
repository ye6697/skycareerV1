import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Plane } from 'lucide-react';
import AircraftHangar3D from '@/components/fleet3d/AircraftHangar3D';

function toListingKey(listing) {
  if (!listing) return '';
  return String(listing.market_listing_id || listing.id || listing.name || '');
}

function toIcao(value) {
  return String(value || '').toUpperCase();
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
  const purchasable = canPurchase(current);
  const isBuyingThis = isBuying && String(selectedListingId || '') === currentKey;

  const hangarOptions = Array.isArray(getPurchaseHangarOptions?.(current))
    ? getPurchaseHangarOptions(current)
    : [];
  const selectedHangarIcao = toIcao(hangarSelectionByListing[currentKey]);
  const fallbackHangarIcao = toIcao(hangarOptions[0]?.airport_icao);
  const effectiveHangarIcao = selectedHangarIcao || fallbackHangarIcao;
  const canDirectBuy = Boolean(purchasable && effectiveHangarIcao && hangarOptions.length > 0);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-slate-950">
      <AircraftHangar3D aircraft={current} />

      <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-slate-950/95 via-slate-900/85 to-transparent px-3 pt-2 pb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-cyan-400 hover:bg-cyan-950 shrink-0"
              onClick={() => setSelectedIdx((idx) => (idx - 1 + visibleListings.length) % visibleListings.length)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <div className="text-cyan-300 font-mono font-bold text-sm truncate">{current.name}</div>
              <div className="text-[10px] font-mono text-cyan-600 uppercase">
                {clampedIdx + 1} / {visibleListings.length}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-cyan-400 hover:bg-cyan-950 shrink-0"
              onClick={() => setSelectedIdx((idx) => (idx + 1) % visibleListings.length)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
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
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-6 gap-2 text-[10px] font-mono">
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
            <div className="rounded border border-slate-800 bg-slate-950/85 p-2 md:col-span-2">
              <div className="text-slate-500 mb-1">
                {lang === 'de' ? 'Ziel-Hangar' : 'Target hangar'}
              </div>
              <select
                value={effectiveHangarIcao}
                onChange={(event) => {
                  const next = toIcao(event.target.value);
                  setHangarSelectionByListing((prev) => ({ ...prev, [currentKey]: next }));
                }}
                className="h-7 w-full rounded border border-cyan-900/60 bg-slate-950/90 px-2 text-[10px] text-cyan-100"
              >
                {hangarOptions.length === 0 && (
                  <option value="">{lang === 'de' ? 'Kein kompatibler Hangar' : 'No compatible hangar'}</option>
                )}
                {hangarOptions.map((hangar) => {
                  const icao = toIcao(hangar.airport_icao);
                  return (
                    <option key={`${currentKey}-${icao}`} value={icao}>
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
              {hangarOptions.length === 0 && (
                <div className="mt-1 text-[9px] text-amber-300">
                  {lang === 'de' ? 'Kein kompatibler Hangar mit freiem Slot.' : 'No compatible hangar with a free slot.'}
                </div>
              )}
            </div>
          </div>

          <div className="max-w-6xl mx-auto mt-2 flex items-center justify-end gap-2">
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
              onClick={() => onConfirmBuy?.(current, effectiveHangarIcao)}
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
