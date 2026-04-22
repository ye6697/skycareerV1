import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, ShoppingCart, ArrowUpCircle, Route as RouteIcon, MapPin, List, Store, X } from "lucide-react";
import ContractWorldMap from "@/components/contracts/ContractWorldMap";
import { getVariantSizeSpec } from "@/components/contracts/hangarModelCatalog";

function normIcao(value) {
  return String(value || "").toUpperCase();
}

function getActionContext(hangars, airportIcao, selectedVariant, lang) {
  const selectedSpec = getVariantSizeSpec(selectedVariant?.id);
  if (!selectedVariant || !selectedSpec) {
    return {
      canSubmit: false,
      cost: 0,
      label: lang === "de" ? "Modell waehlen" : "Select model",
      helper: lang === "de" ? "Bitte ein gueltiges Hangar-Modell waehlen." : "Please choose a valid hangar model.",
    };
  }

  const selectedAirport = normIcao(airportIcao);
  if (!selectedAirport) {
    return {
      canSubmit: false,
      cost: 0,
      label: lang === "de" ? "Airport waehlen" : "Select airport",
      helper: lang === "de" ? "Bitte zuerst einen Airport waehlen." : "Please choose an airport first.",
    };
  }

  const existing = hangars.find((h) => normIcao(h.airport_icao) === selectedAirport);
  if (!existing) {
    return {
      canSubmit: true,
      cost: selectedSpec.price,
      label: lang === "de" ? "Hangar kaufen" : "Buy hangar",
      helper:
        lang === "de"
          ? `${selectedVariant.label} | ${selectedSpec.key.toUpperCase()} | ${selectedSpec.slots} Slots`
          : `${selectedVariant.label} | ${selectedSpec.key.toUpperCase()} | ${selectedSpec.slots} slots`,
    };
  }

  if (String(existing.model_variant || "") === String(selectedVariant.id || "")) {
    return {
      canSubmit: false,
      cost: 0,
      label: lang === "de" ? "Bereits gekauft" : "Already owned",
      helper: lang === "de" ? `Aktuell: ${selectedVariant.label}` : `Current: ${selectedVariant.label}`,
    };
  }

  const currentSpec = getVariantSizeSpec(existing.model_variant);
  const currentTier = Number(existing.upgrade_tier ?? currentSpec?.tier ?? 0);
  const targetTier = Number(selectedSpec.tier || 0);
  if (targetTier <= currentTier) {
    return {
      canSubmit: false,
      cost: 0,
      label: lang === "de" ? "Upgrade waehlen" : "Choose upgrade",
      helper: lang === "de" ? "Nur Upgrades auf groessere Hangars moeglich." : "Only upgrades to larger sizes are possible.",
    };
  }

  const baseCurrentPrice = Number(existing.purchase_price || 0) || Number(currentSpec?.price || 0);
  const diff = Math.max(0, Number(selectedSpec.price || 0) - baseCurrentPrice);

  return {
    canSubmit: true,
    cost: diff,
    label:
      lang === "de"
        ? `Upgrade auf ${selectedVariant.label}`
        : `Upgrade to ${selectedVariant.label}`,
    helper:
      lang === "de"
        ? `Aktuell: ${String(existing.model_variant || "-")} -> ${selectedVariant.label}`
        : `Current: ${String(existing.model_variant || "-")} -> ${selectedVariant.label}`,
  };
}

export default function HangarWorldGlobe3D({
  hangars = [],
  ownedAircraft = [],
  aircraftMoveTargets = {},
  onChangeAircraftMoveTarget,
  onMoveAircraft,
  isMovingAircraft = false,
  getMoveValidation,
  getTransferCost,
  getAircraftModelName,
  contracts = [],
  contractsByHangar = {},
  marketAirports = [],
  selectedContractId = null,
  onSelectContract,
  selectedAirportIcao = "",
  onSelectAirport,
  selectedMarketVariantId = "",
  onSelectMarketVariantId,
  hangarVariants = [],
  onBuyOrUpgrade,
  isBuyingOrUpgrading = false,
  lang = "de",
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showContractsPanel, setShowContractsPanel] = useState(true);
  const [showMarketPanel, setShowMarketPanel] = useState(true);

  const normalizedHangars = useMemo(
    () =>
      hangars.map((hangar) => ({
        ...hangar,
        airport_icao: normIcao(hangar.airport_icao),
      })),
    [hangars]
  );

  const normalizedContracts = useMemo(
    () =>
      contracts.map((contract) => ({
        ...contract,
        departure_airport: normIcao(contract.departure_airport),
        arrival_airport: normIcao(contract.arrival_airport),
      })),
    [contracts]
  );

  const normalizedContractsByAirport = useMemo(() => {
    const map = {};
    Object.entries(contractsByHangar || {}).forEach(([key, value]) => {
      map[normIcao(key)] = Array.isArray(value) ? value : [];
    });
    return map;
  }, [contractsByHangar]);

  const marketByIcao = useMemo(() => {
    const map = new Map();
    marketAirports.forEach((airport) => {
      const icao = normIcao(airport.airport_icao);
      if (!icao) return;
      map.set(icao, {
        ...airport,
        airport_icao: icao,
        label: airport.label || icao,
      });
    });
    return map;
  }, [marketAirports]);

  const selectedAirportData = useMemo(
    () => marketByIcao.get(normIcao(selectedAirportIcao)) || null,
    [marketByIcao, selectedAirportIcao]
  );

  const selectedVariant = useMemo(() => {
    if (!Array.isArray(hangarVariants) || hangarVariants.length === 0) return null;
    return (
      hangarVariants.find((variant) => variant.id === selectedMarketVariantId) || hangarVariants[0] || null
    );
  }, [hangarVariants, selectedMarketVariantId]);

  const actionContext = useMemo(
    () =>
      getActionContext(
        normalizedHangars,
        selectedAirportIcao,
        selectedVariant,
        lang
      ),
    [normalizedHangars, selectedAirportIcao, selectedVariant, lang]
  );

  const selectedAirportContracts = useMemo(() => {
    const selectedIcao = normIcao(selectedAirportIcao);
    if (!selectedIcao) return [];
    const airportContracts = normalizedContractsByAirport[selectedIcao];
    if (Array.isArray(airportContracts) && airportContracts.length > 0) return airportContracts;
    return normalizedContracts.filter((contract) => normIcao(contract.departure_airport) === selectedIcao);
  }, [normalizedContracts, normalizedContractsByAirport, selectedAirportIcao]);

  const selectedAirportHangar = useMemo(() => {
    const selectedIcao = normIcao(selectedAirportIcao);
    if (!selectedIcao) return null;
    return normalizedHangars.find((hangar) => normIcao(hangar.airport_icao) === selectedIcao) || null;
  }, [normalizedHangars, selectedAirportIcao]);

  const airportAircraft = useMemo(() => {
    const selectedIcao = normIcao(selectedAirportIcao);
    if (!selectedIcao) return [];
    return ownedAircraft.filter(
      (aircraft) =>
        String(aircraft?.status || "").toLowerCase() !== "sold" &&
        normIcao(aircraft?.hangar_airport) === selectedIcao
    );
  }, [ownedAircraft, selectedAirportIcao]);

  const visibleContracts = useMemo(() => normalizedContracts.slice(0, 120), [normalizedContracts]);

  const ownedAirportCount = useMemo(() => {
    const ownedSet = new Set(normalizedHangars.map((hangar) => normIcao(hangar.airport_icao)));
    return marketAirports.reduce((count, airport) => {
      if (ownedSet.has(normIcao(airport.airport_icao))) return count + 1;
      return count;
    }, 0);
  }, [marketAirports, normalizedHangars]);

  return (
    <div className={`relative overflow-hidden border border-cyan-900/50 bg-slate-950/95 ${isFullscreen ? "fixed inset-0 z-[220] rounded-none" : "rounded-xl"}`}>
      <div className="absolute left-3 top-3 z-30 flex items-center gap-2">
        <Badge className="border-cyan-700/50 bg-slate-950/90 text-[10px] font-mono uppercase text-cyan-100">
          <RouteIcon className="mr-1 h-3 w-3" />
          {visibleContracts.length} {lang === "de" ? "Routen" : "Routes"}
        </Badge>
        <Badge className="border-emerald-700/50 bg-slate-950/90 text-[10px] font-mono uppercase text-emerald-200">
          {ownedAirportCount}/{marketAirports.length} Owned
        </Badge>
      </div>

      <div className="absolute right-3 top-3 z-30 flex gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setShowContractsPanel((value) => !value)}
          className="h-8 w-8 border-cyan-700/50 bg-slate-950/90 text-cyan-200 hover:bg-cyan-950/40"
        >
          {showContractsPanel ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setShowMarketPanel((value) => !value)}
          className="h-8 w-8 border-cyan-700/50 bg-slate-950/90 text-cyan-200 hover:bg-cyan-950/40"
        >
          {showMarketPanel ? <X className="h-4 w-4" /> : <Store className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setIsFullscreen((value) => !value)}
          className="h-8 w-8 border-cyan-700/50 bg-slate-950/90 text-cyan-200 hover:bg-cyan-950/40"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      <div className={`w-full ${isFullscreen ? "h-screen" : "h-[650px]"}`}>
        <ContractWorldMap
          embedded
          contracts={visibleContracts}
          hangars={normalizedHangars}
          marketAirports={marketAirports}
          selectedAirportIcao={selectedAirportIcao}
          onSelectAirport={(icao) => {
            onSelectAirport?.(icao);
            setShowMarketPanel(true);
          }}
          selectedContractId={selectedContractId}
          onSelectContract={(id) => {
            onSelectContract?.(id);
            setShowContractsPanel(true);
          }}
          onBackgroundClick={() => {
            setShowContractsPanel(false);
            setShowMarketPanel(false);
            onSelectContract?.(null);
            onSelectAirport?.("");
          }}
          lang={lang}
        />
      </div>

      {showContractsPanel && (
        <div className={`absolute right-3 top-14 z-30 w-[300px] rounded-xl border border-cyan-900/50 bg-slate-950/90 p-2.5 backdrop-blur ${isFullscreen ? "max-h-[62vh]" : "max-h-[52vh]"}`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">
              {lang === "de" ? "Auftragsliste" : "Contract list"}
            </div>
            <div className="text-[10px] text-slate-400">{visibleContracts.length}</div>
          </div>
          <div className="space-y-1 overflow-y-auto pr-1" style={{ maxHeight: isFullscreen ? "54vh" : "44vh" }}>
            {visibleContracts.map((contract) => {
              const selected = contract.id === selectedContractId;
              return (
                <button
                  key={contract.id}
                  type="button"
                  onClick={() => {
                    onSelectContract?.(contract.id);
                    setShowContractsPanel(true);
                  }}
                  className={`w-full rounded-md border px-2 py-1.5 text-left transition ${
                    selected
                      ? "border-cyan-500/70 bg-cyan-900/30"
                      : "border-slate-700/80 bg-slate-900/75 hover:border-cyan-800/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-semibold text-cyan-100">{contract.title || "Contract"}</p>
                    <span className="text-[10px] text-emerald-300">${Math.round(contract.payout || 0).toLocaleString()}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] font-mono text-slate-300">
                    {contract.departure_airport} -&gt; {contract.arrival_airport}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showMarketPanel && selectedAirportData && (
        <div className={`absolute left-3 bottom-3 z-30 w-[380px] rounded-xl border border-cyan-900/50 bg-slate-950/92 p-3 backdrop-blur ${isFullscreen ? "max-h-[68vh]" : "max-h-[56vh]"} overflow-y-auto`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">
              {lang === "de" ? "Hangar Popup" : "Hangar popup"}
            </div>
            <div className="text-[10px] text-slate-400">{selectedAirportData.airport_icao}</div>
          </div>

          <div className="mb-2 rounded-md border border-slate-700/80 bg-slate-900/75 p-2">
            <p className="text-[11px] font-semibold text-cyan-100">
              <MapPin className="mr-1 inline h-3.5 w-3.5" />
              {selectedAirportData.airport_icao} - {selectedAirportData.label}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              {lang === "de" ? "Verfuegbare Auftraege ab hier" : "Available departures here"}: {selectedAirportContracts.length}
            </p>
            <p className={`mt-1 text-[10px] font-mono ${selectedAirportHangar ? "text-emerald-300" : "text-amber-300"}`}>
              {selectedAirportHangar
                ? (lang === "de" ? "Status: Owned" : "Status: Owned")
                : (lang === "de" ? "Status: Not owned" : "Status: Not owned")}
            </p>
          </div>

          {selectedAirportHangar && (
            <div className="mb-2 rounded-md border border-slate-700/80 bg-slate-900/75 p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">
                  {lang === "de" ? "Hangar Management" : "Hangar management"}
                </p>
                <span className="text-[10px] font-mono text-emerald-300">
                  {airportAircraft.length}/{Number(selectedAirportHangar?.slots || 0)}
                </span>
              </div>
              <div className="space-y-1.5">
                {airportAircraft.length > 0 ? (
                  airportAircraft.map((aircraft) => {
                    const currentAirport = normIcao(aircraft?.hangar_airport);
                    const selectedTarget = normIcao(aircraftMoveTargets?.[aircraft.id]) || currentAirport;
                    const moveInfo = getMoveValidation?.(aircraft, selectedTarget) || { valid: false, reason: "" };
                    const sameHangar = Boolean(currentAirport && selectedTarget && currentAirport === selectedTarget);
                    const transferCost = Number(getTransferCost?.(aircraft, selectedTarget) || 0);
                    return (
                      <div key={aircraft.id} className="rounded border border-slate-700/70 bg-slate-950/70 p-2">
                        <p className="truncate text-[11px] font-semibold text-cyan-100">
                          {getAircraftModelName?.(aircraft) || aircraft?.name || aircraft?.type || aircraft?.id}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(aircraft?.registration || aircraft?.id)} | {currentAirport || "-"}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <select
                            value={selectedTarget}
                            onChange={(event) => onChangeAircraftMoveTarget?.(aircraft.id, normIcao(event.target.value))}
                            className="h-7 flex-1 rounded border border-cyan-900/60 bg-slate-950/90 px-2 text-[10px] text-cyan-100"
                          >
                            {normalizedHangars.map((hangar) => {
                              const icao = normIcao(hangar.airport_icao);
                              return (
                                <option key={`${aircraft.id}_${icao}`} value={icao}>
                                  {icao}
                                </option>
                              );
                            })}
                          </select>
                          <Button
                            type="button"
                            disabled={sameHangar || !moveInfo.valid || isMovingAircraft}
                            onClick={() => onMoveAircraft?.({ aircraft, targetAirportIcao: selectedTarget })}
                            className="h-7 bg-emerald-600 px-2 text-[10px] font-mono uppercase text-slate-950 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-300"
                          >
                            {isMovingAircraft
                              ? (lang === "de" ? "..." : "...")
                              : sameHangar
                                ? (lang === "de" ? "Zugewiesen" : "Assigned")
                                : (lang === "de" ? "Verschieben" : "Move")}
                          </Button>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {lang === "de" ? "Transfer" : "Transfer"}: ${Math.round(transferCost).toLocaleString()}
                        </p>
                        {!sameHangar && !moveInfo.valid && (
                          <p className="text-[10px] text-amber-300">{moveInfo.reason}</p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[10px] text-slate-400">
                    {lang === "de" ? "Keine Flugzeuge in diesem Hangar." : "No aircraft in this hangar."}
                  </p>
                )}
              </div>
            </div>
          )}

          {hangarVariants.length > 0 && (
            <div className="mb-2">
              <div className="mb-1 text-[10px] font-mono uppercase tracking-wide text-cyan-300">
                {lang === "de" ? "Hangar Modell" : "Hangar model"}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {hangarVariants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => onSelectMarketVariantId?.(variant.id)}
                    className={`rounded-md border px-2 py-1 text-left text-[10px] font-mono uppercase transition ${
                      selectedMarketVariantId === variant.id
                        ? "border-cyan-500/70 bg-cyan-900/35 text-cyan-100"
                        : "border-slate-700/80 bg-slate-900/75 text-slate-300 hover:border-cyan-800/70"
                    }`}
                  >
                    <div>{variant.label}</div>
                    <div className="text-[9px] text-slate-400">
                      {(() => {
                        const spec = getVariantSizeSpec(variant.id);
                        if (!spec) return "-";
                        return `${spec.key.toUpperCase()} | ${spec.slots} slots | $${Math.round(spec.price).toLocaleString()}`;
                      })()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2 rounded-md border border-slate-700/80 bg-slate-900/75 p-2 text-[10px]">
            <p className="text-slate-300">{actionContext.helper}</p>
            <p className="mt-1 font-mono text-emerald-300">${Math.round(actionContext.cost || 0).toLocaleString()}</p>
          </div>

          <Button
            type="button"
            disabled={!actionContext.canSubmit || isBuyingOrUpgrading}
            onClick={() =>
              onBuyOrUpgrade?.({
                airportIcao: normIcao(selectedAirportIcao),
                modelVariant: selectedMarketVariantId,
              })
            }
            className="h-8 w-full bg-emerald-600 text-xs font-mono uppercase text-slate-950 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-300"
          >
            {isBuyingOrUpgrading ? (
              <>
                <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5 animate-pulse" />
                {lang === "de" ? "Wird verarbeitet" : "Processing"}
              </>
            ) : (
              <>
                <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                {actionContext.label}
              </>
            )}
          </Button>
        </div>
      )}

      <div className="pointer-events-none absolute left-3 top-14 z-30 rounded-md border border-cyan-900/50 bg-slate-950/85 px-2 py-1 text-[10px] text-cyan-200">
        {lang === "de"
          ? "Alles in Leaflet: Klick auf Airport fuer Hangar Popup, Klick auf Route fuer Fokus"
          : "All in Leaflet: click airport for hangar popup, click route to focus"}
      </div>
    </div>
  );
}
