import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Plane } from 'lucide-react';
import AircraftHangar3D from '@/components/fleet3d/AircraftHangar3D';

export default function MarketHangar3DView({
  listings = [],
  lang = 'en',
  company = null,
  canAfford,
  canPurchase,
  onBuy,
  isBuying,
  selectedListingId
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const visibleListings = useMemo(() => listings, [listings]);
  const current = visibleListings[selectedIdx] || null;

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
  const isBuyingThis = isBuying && (
    (current.market_listing_id && current.market_listing_id === selectedListingId) ||
    (!current.market_listing_id && current.name === selectedListingId)
  );

  return (
    <div className="flex flex-col h-[72vh] rounded-lg border border-cyan-900/40 overflow-hidden bg-slate-950">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-cyan-900/40 bg-slate-900/95">
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
              {selectedIdx + 1} / {visibleListings.length}
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

        <div className="text-right font-mono">
          <div className={`text-sm font-bold ${purchasable ? 'text-emerald-400' : 'text-amber-400'}`}>
            ${Math.round(current.purchase_price).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500">
            {lang === 'de' ? 'Level' : 'Level'} {current.level_requirement || 1}
          </div>
        </div>
      </div>

      <div className="bg-slate-900/80 border-b border-cyan-900/30 px-2 py-1.5 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {visibleListings.map((listing, idx) => (
            <button
              key={listing.market_listing_id || `${listing.name}-${idx}`}
              onClick={() => setSelectedIdx(idx)}
              className={`px-2 py-1 rounded font-mono text-[10px] uppercase whitespace-nowrap border transition-colors ${
                idx === selectedIdx
                  ? 'bg-cyan-900/70 border-cyan-400 text-cyan-200'
                  : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-cyan-700'
              }`}
            >
              {listing.name}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <AircraftHangar3D aircraft={current} />

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent px-3 pt-8 pb-2">
          <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] font-mono">
            <div className="rounded border border-slate-800 bg-slate-950/80 p-2">
              <div className="text-slate-500">PAX</div>
              <div className="text-cyan-100">{current.passenger_capacity}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/80 p-2">
              <div className="text-slate-500">CGO</div>
              <div className="text-cyan-100">{current.cargo_capacity_kg}kg</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/80 p-2">
              <div className="text-slate-500">BURN</div>
              <div className="text-cyan-100">{current.fuel_consumption_per_hour}L/h</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/80 p-2">
              <div className="text-slate-500">RNG</div>
              <div className="text-cyan-100">{current.range_nm}NM</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/80 p-2 col-span-2 sm:col-span-1">
              <Button
                onClick={() => onBuy(current)}
                disabled={!purchasable || isBuying}
                size="sm"
                className={`w-full h-7 text-[10px] font-mono uppercase ${purchasable ? 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800 border border-emerald-800' : 'bg-slate-800 text-slate-500'}`}
              >
                {isBuyingThis ? (lang === 'de' ? 'Kaufe...' : 'Buying...') : (lang === 'de' ? 'Kaufen' : 'Buy')}
              </Button>
              {!hasLevel && (
                <div className="mt-1 text-[9px] text-amber-500 text-center">
                  {lang === 'de' ? `Level ${current.level_requirement} benoetigt` : `Requires level ${current.level_requirement}`}
                </div>
              )}
              {hasLevel && !hasBalance && (
                <div className="mt-1 text-[9px] text-red-400 text-center">
                  {lang === 'de' ? 'Nicht genug Budget' : 'Insufficient budget'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
