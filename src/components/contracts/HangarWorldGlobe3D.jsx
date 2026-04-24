import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, ShoppingCart, ArrowUpCircle, Route as RouteIcon, MapPin, List, Store, X, Building2 } from "lucide-react";
import ContractWorldMap from "@/components/contracts/ContractWorldMap";
import HangarModelPreview3D from "@/components/contracts/HangarModelPreview3D";
import { getVariantSizeSpec } from "@/components/contracts/hangarModelCatalog";

function normIcao(value) {
  return String(value || "").trim().toUpperCase();
}

function normHangarId(value) {
  return String(value || "").trim().toLowerCase();
}

function getLegacyAirportFromHangarId(hangarId) {
  const raw = String(hangarId || "").trim();
  if (!raw.toLowerCase().startsWith("legacy_hangar_")) return "";
  return normIcao(raw.slice("legacy_hangar_".length).replace(/_\d+$/, ""));
}

function resolveAircraftAirport(aircraft, hangars = []) {
  const aircraftHangarId = normHangarId(aircraft?.hangar_id);
  if (aircraftHangarId) {
    const matchedHangar = hangars.find((hangar) => {
      const hangarCandidates = [
        hangar?.id,
        hangar?.hangar_id,
        hangar?._id,
        getHangarId(hangar),
      ].map(normHangarId);
      return hangarCandidates.includes(aircraftHangarId);
    });

    const matchedAirport = normIcao(matchedHangar?.airport_icao);
    if (matchedAirport) return matchedAirport;

    const legacyAirport = getLegacyAirportFromHangarId(aircraft?.hangar_id);
    if (legacyAirport) return legacyAirport;
  }

  return normIcao(aircraft?.hangar_airport);
}

function formatAirportDisplay(icao, label) {
  const normCode = normIcao(icao);
  const cleanLabel = String(label || "").trim();
  if (!cleanLabel || normIcao(cleanLabel) === normCode) return normCode;
  return `${normCode} - ${cleanLabel}`;
}

function getHangarId(hangar) {
  return String(hangar?.id || hangar?.hangar_id || hangar?._id || "").trim();
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
  const [showMarketPanel, setShowMarketPanel] = useState(false);
  const [showOwnedHangarsList, setShowOwnedHangarsList] = useState(false);
  const [airportViewFilter, setAirportViewFilter] = useState("all");
  const [pendingAirportOverrides, setPendingAirportOverrides] = useState({});
  const fullscreenRootRef = useRef(null);

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
  const selectedVariantSpec = useMemo(
    () => getVariantSizeSpec(selectedVariant?.id) || null,
    [selectedVariant?.id]
  );

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

  const getAircraftHangarId = useMemo(() => {
    const hangarsById = new Map(
      normalizedHangars
        .map((hangar) => [getHangarId(hangar), hangar])
        .filter(([id]) => Boolean(id))
    );
    const hangarsByAirport = new Map();
    normalizedHangars.forEach((hangar) => {
      const airport = normIcao(hangar.airport_icao);
      if (!airport) return;
      const list = hangarsByAirport.get(airport) || [];
      list.push(hangar);
      hangarsByAirport.set(airport, list);
    });

    return (aircraft) => {
      const directId = String(aircraft?.hangar_id || "").trim();
      if (directId && hangarsById.has(directId)) return directId;
      const airport = normIcao(aircraft?.hangar_airport);
      const airportHangars = hangarsByAirport.get(airport) || [];
      if (airportHangars.length === 1) return getHangarId(airportHangars[0]);
      return "";
    };
  }, [normalizedHangars]);

  const getAircraftHangarAirport = useMemo(() => {
    const hangarsById = new Map(
      normalizedHangars
        .map((hangar) => [getHangarId(hangar), hangar])
        .filter(([id]) => Boolean(id))
    );

    return (aircraft) => {
      const directId = String(aircraft?.hangar_id || "").trim();
      if (directId && hangarsById.has(directId)) {
        return normIcao(hangarsById.get(directId)?.airport_icao);
      }
      return normIcao(aircraft?.hangar_airport);
    };
  }, [normalizedHangars]);

  const airportAircraft = useMemo(() => {
    const selectedIcao = normIcao(selectedAirportIcao);
    if (!selectedIcao) return [];
    return ownedAircraft.filter(
      (aircraft) =>
        String(aircraft?.status || "").toLowerCase() !== "sold" &&
        getAircraftHangarAirport(aircraft) === selectedIcao
    );
  }, [getAircraftHangarAirport, ownedAircraft, selectedAirportIcao]);

  const assignableAircraft = useMemo(() => {
    return ownedAircraft.filter(
      (aircraft) => String(aircraft?.status || "").toLowerCase() !== "sold"
    );
  }, [ownedAircraft]);

  const visibleContracts = useMemo(() => normalizedContracts.slice(0, 120), [normalizedContracts]);

  const ownedAirportCount = useMemo(() => {
    const ownedSet = new Set(normalizedHangars.map((hangar) => normIcao(hangar.airport_icao)));
    return marketAirports.reduce((count, airport) => {
      if (ownedSet.has(normIcao(airport.airport_icao))) return count + 1;
      return count;
    }, 0);
  }, [marketAirports, normalizedHangars]);
  const contractsPanelMaxHeight = isFullscreen ? "calc(100vh - 5.2rem)" : "calc(100% - 5.2rem)";
  const marketPanelMaxHeight = isFullscreen ? "calc(100vh - 5.2rem)" : "calc(100% - 5.2rem)";
  const selectedIcao = normIcao(selectedAirportIcao);
  const preventMapScrollCapture = {
    onPointerDown: (event) => {
      event.stopPropagation();
    },
    onMouseDown: (event) => {
      event.stopPropagation();
    },
    onTouchStart: (event) => {
      event.stopPropagation();
    },
    onClick: (event) => {
      event.stopPropagation();
    },
    onWheelCapture: (event) => {
      event.stopPropagation();
    },
    onWheel: (event) => {
      event.stopPropagation();
    },
    onTouchMoveCapture: (event) => {
      event.stopPropagation();
    },
    onTouchMove: (event) => {
      event.stopPropagation();
    },
  };

  useEffect(() => {
    if (!isFullscreen || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleFullscreenChange = () => {
      const activeElement = document.fullscreenElement;
      setIsFullscreen(Boolean(activeElement && activeElement === fullscreenRootRef.current));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const now = Date.now();
    setPendingAirportOverrides((previous) => {
      let changed = false;
      const next = { ...previous };
      Object.entries(previous).forEach(([aircraftId, override]) => {
        const entry = ownedAircraft.find((aircraft) => String(aircraft?.id) === aircraftId);
        if (!entry) {
          delete next[aircraftId];
          changed = true;
          return;
        }
        const resolvedAirport = resolveAircraftAirport(entry, normalizedHangars);
        const overrideAirport = normIcao(override?.airport);
        const overrideAge = now - Number(override?.createdAt || 0);
        if (resolvedAirport === overrideAirport || overrideAge > 20000) {
          delete next[aircraftId];
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [ownedAircraft, normalizedHangars]);

  const toggleFullscreen = async () => {
    if (typeof document === "undefined") return;
    const node = fullscreenRootRef.current;
    if (!node) return;

    try {
      if (document.fullscreenElement === node) {
        await document.exitFullscreen();
        setIsFullscreen(false);
        return;
      }

      if (document.fullscreenElement && document.fullscreenElement !== node) {
        await document.exitFullscreen();
      }

      if (typeof node.requestFullscreen === "function") {
        await node.requestFullscreen();
      } else {
        setIsFullscreen((value) => !value);
      }
      window.scrollTo({ top: 0, behavior: "auto" });
      setIsFullscreen(true);
    } catch {
      setIsFullscreen((value) => !value);
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  const content = (
    <div
      ref={fullscreenRootRef}
      className={`relative overflow-hidden border border-cyan-900/50 bg-slate-950/95 ${isFullscreen ? "fixed inset-0 z-[9999] h-[100dvh] w-[100vw] rounded-none" : "rounded-xl"}`}
    >
      <div className="absolute left-3 top-3 z-[1400] flex items-center gap-2">
        <Badge className="border-cyan-700/50 bg-slate-950/90 text-[10px] font-mono uppercase text-cyan-100">
          <RouteIcon className="mr-1 h-3 w-3" />
          {visibleContracts.length} {lang === "de" ? "Routen" : "Routes"}
        </Badge>
        <Badge className="border-emerald-700/50 bg-slate-950/90 text-[10px] font-mono uppercase text-emerald-200">
          {ownedAirportCount}/{marketAirports.length} Owned
        </Badge>
      </div>

      <div className="absolute right-3 top-3 z-[1400] flex gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setShowOwnedHangarsList((value) => !value)}
          className="h-8 w-8 border-emerald-700/50 bg-slate-950/90 text-emerald-200 hover:bg-emerald-950/40"
        >
          <Building2 className="h-4 w-4" />
        </Button>
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
          onClick={toggleFullscreen}
          className="h-8 w-8 border-cyan-700/50 bg-slate-950/90 text-cyan-200 hover:bg-cyan-950/40"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      <div className={`relative z-0 w-full ${isFullscreen ? "h-screen" : "h-[650px]"}`}>
        <div className="absolute left-3 top-12 z-[1450] flex items-center gap-1 rounded-md border border-cyan-900/50 bg-slate-950/85 p-1">
          <button
            type="button"
            onClick={() => setAirportViewFilter("all")}
            className={`rounded px-2 py-1 text-[10px] font-mono uppercase transition ${
              airportViewFilter === "all"
                ? "bg-cyan-700/45 text-cyan-100"
                : "text-slate-300 hover:bg-slate-800/80"
            }`}
          >
            {lang === "de" ? "Alle" : "All"}
          </button>
          <button
            type="button"
            onClick={() => setAirportViewFilter("owned")}
            className={`rounded px-2 py-1 text-[10px] font-mono uppercase transition ${
              airportViewFilter === "owned"
                ? "bg-emerald-700/45 text-emerald-100"
                : "text-slate-300 hover:bg-slate-800/80"
            }`}
          >
            {lang === "de" ? "Owned" : "Owned"}
          </button>
        </div>
        <ContractWorldMap
          embedded
          contracts={visibleContracts}
          hangars={normalizedHangars}
          marketAirports={marketAirports}
          airportViewFilter={airportViewFilter}
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
            setShowOwnedHangarsList(false);
            onSelectContract?.(null);
            onSelectAirport?.("");
          }}
          onOwnedHangarHubClick={() => {
            setShowOwnedHangarsList((value) => !value);
          }}
          lang={lang}
        />
      </div>

      {showOwnedHangarsList && normalizedHangars.length > 0 && (
        <div
          {...preventMapScrollCapture}
          className="absolute right-3 bottom-3 z-[1450] w-[min(94vw,300px)] rounded-xl border border-cyan-900/50 bg-slate-950/92 p-2 backdrop-blur"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">
              <Building2 className="mr-1 inline h-3.5 w-3.5" />
              {lang === "de" ? "Eigene Hangars" : "Owned hangars"}
            </div>
            <span className="text-[10px] text-slate-400">{normalizedHangars.length}</span>
          </div>
          <div className="max-h-[230px] space-y-1 overflow-y-auto pr-1">
            {normalizedHangars.map((hangar) => {
              const icao = normIcao(hangar.airport_icao);
              const stationed = ownedAircraft.filter((aircraft) => getAircraftHangarAirport(aircraft) === icao && String(aircraft?.status || "").toLowerCase() !== "sold").length;
              const airportLabel = marketByIcao.get(icao)?.label || icao;
              const airportContractsCount = Array.isArray(normalizedContractsByAirport[icao])
                ? normalizedContractsByAirport[icao].length
                : normalizedContracts.filter((contract) => normIcao(contract.departure_airport) === icao).length;
              return (
                <button
                  key={hangar.id || icao}
                  type="button"
                  onClick={() => {
                    onSelectAirport?.(icao);
                    setShowMarketPanel(true);
                    setShowOwnedHangarsList(false);
                  }}
                  className="w-full rounded-md border border-slate-700/80 bg-slate-900/75 px-2 py-1.5 text-left hover:border-cyan-700/70"
                >
                  <p className="text-[11px] font-semibold text-cyan-100">{formatAirportDisplay(icao, airportLabel)}</p>
                  <p className="text-[10px] text-slate-300">
                    {String(hangar.size || "-").toUpperCase()} | {stationed}/{Number(hangar.slots || 0)} | {airportContractsCount} {lang === "de" ? "Auftr." : "jobs"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showContractsPanel && (
        <div
          {...preventMapScrollCapture}
          className="absolute left-1/2 top-14 z-[1450] flex w-[min(94vw,300px)] -translate-x-1/2 flex-col rounded-xl border border-cyan-900/50 bg-slate-950/90 p-2.5 backdrop-blur sm:left-auto sm:right-3 sm:translate-x-0"
          style={{ height: contractsPanelMaxHeight, maxHeight: contractsPanelMaxHeight }}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">
              {lang === "de" ? "Auftragsliste" : "Contract list"}
            </div>
            <div className="text-[10px] text-slate-400">{visibleContracts.length}</div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1 touch-pan-y">
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
        <div
          {...preventMapScrollCapture}
          className="absolute bottom-3 left-1/2 z-[1450] flex w-[min(94vw,380px)] -translate-x-1/2 flex-col rounded-xl border border-cyan-900/50 bg-slate-950/92 p-3 backdrop-blur sm:left-3 sm:translate-x-0"
          style={{ maxHeight: marketPanelMaxHeight }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 touch-pan-y">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-wide text-cyan-300">
              {lang === "de" ? "Hangar Popup" : "Hangar popup"}
            </div>
            <div className="text-[10px] text-slate-400">{selectedAirportData.airport_icao}</div>
          </div>

          <div className="mb-2 rounded-md border border-slate-700/80 bg-slate-900/75 p-2">
            <p className="text-[11px] font-semibold text-cyan-100">
              <MapPin className="mr-1 inline h-3.5 w-3.5" />
              {formatAirportDisplay(selectedAirportData.airport_icao, selectedAirportData.label)}
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

          <HangarModelPreview3D
            modelPath={selectedVariant?.path || ""}
            sizeKey={selectedVariantSpec?.key || selectedAirportHangar?.size || "small"}
            modelVariantId={selectedVariant?.id || selectedAirportHangar?.model_variant || ""}
            owned={Boolean(selectedAirportHangar)}
            lang={lang}
          />

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
                {assignableAircraft.length > 0 ? (
                  assignableAircraft.map((aircraft) => {
                    const pendingOverride = pendingAirportOverrides[String(aircraft?.id)];
                    const fallbackAirport = getAircraftHangarAirport(aircraft) || resolveAircraftAirport(aircraft, normalizedHangars);
                    const currentAirport = pendingOverride?.airport
                      ? normIcao(pendingOverride.airport)
                      : fallbackAirport;
                    const currentHangarId = getAircraftHangarId(aircraft);
                    const selectedTarget = selectedIcao;
                    const selectedTargetHangarId = getHangarId(selectedAirportHangar);
                    const moveInfo = getMoveValidation?.(aircraft, selectedTarget, selectedTargetHangarId) || { valid: false, reason: "" };
                    const sameHangar = Boolean(currentHangarId && selectedTargetHangarId && currentHangarId === selectedTargetHangarId);
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
                          <div className="h-7 flex-1 rounded border border-cyan-900/60 bg-slate-950/90 px-2 text-[10px] leading-7 text-cyan-100">
                            {lang === "de" ? "Ziel" : "Target"}: {selectedTarget || "-"}
                          </div>
                          <Button
                            type="button"
                            disabled={sameHangar || !moveInfo.valid || isMovingAircraft}
                            onClick={() => {
                              setPendingAirportOverrides((previous) => ({
                                ...previous,
                                [String(aircraft?.id || "")]: {
                                  airport: selectedTarget,
                                  createdAt: Date.now(),
                                },
                              }));
                              onMoveAircraft?.({
                                aircraft,
                                targetAirportIcao: selectedTarget,
                                targetHangarId: selectedTargetHangarId,
                              });
                            }}
                            className="h-7 bg-emerald-600 px-2 text-[10px] font-mono uppercase text-slate-950 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-300"
                          >
                            {isMovingAircraft
                              ? (lang === "de" ? "..." : "...")
                              : sameHangar
                                ? (lang === "de" ? "Zugewiesen" : "Assigned")
                                : (lang === "de" ? "Hier zuweisen" : "Assign here")}
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
        </div>
      )}

      <div className="pointer-events-none absolute left-3 top-14 z-[1400] rounded-md border border-cyan-900/50 bg-slate-950/85 px-2 py-1 text-[10px] text-cyan-200">
        {lang === "de"
          ? "Alles in Leaflet: Klick auf Airport fuer Hangar Popup, Klick auf Route fuer Fokus"
          : "All in Leaflet: click airport for hangar popup, click route to focus"}
      </div>
    </div>
  );

  return content;
}
