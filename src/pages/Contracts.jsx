import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  AlertCircle,
  Clock3,
  Filter,
  Loader2,
  Package,
  Plane,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import ContractCard from "@/components/contracts/ContractCard";
import ContractWorldMap from "@/components/contracts/ContractWorldMap";
import HangarMarket3D from "@/components/contracts/HangarMarket3D";
import InsolvencyBanner from "@/components/InsolvencyBanner";
import { useLanguage } from "@/components/LanguageContext";

function isContractCompatibleWithAircraft(contract, aircraft) {
  if (!contract || !aircraft) return false;

  const requiredTypes = contract.required_aircraft_type || [];
  const typeMatch = !requiredTypes.length || requiredTypes.includes(aircraft.type);
  const cargoMatch =
    !contract.cargo_weight_kg ||
    Number(aircraft.cargo_capacity_kg || 0) >= Number(contract.cargo_weight_kg);
  const rangeMatch =
    !contract.distance_nm ||
    Number(aircraft.range_nm || 0) >= Number(contract.distance_nm);

  return typeMatch && cargoMatch && rangeMatch;
}

function tabMatches(contract, activeTab) {
  if (activeTab === "all") return contract.status === "available";
  if (activeTab === "accepted") return contract.status === "accepted";
  if (activeTab === "passenger") {
    return contract.type === "passenger" && contract.status === "available";
  }
  if (activeTab === "cargo") {
    return contract.type === "cargo" && contract.status === "available";
  }
  if (activeTab === "charter") {
    return contract.type === "charter" && contract.status === "available";
  }
  return true;
}

function searchMatches(contract, term) {
  if (!term) return true;
  const query = term.toLowerCase();
  const haystack = [
    contract.title,
    contract.departure_airport,
    contract.arrival_airport,
    contract.departure_city,
    contract.arrival_city,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function getCompatibilityReason(contract, selectedAircraft, lang) {
  if (!selectedAircraft) {
    return lang === "de"
      ? "Kein verfuegbares Flugzeug fuer diesen Auftrag."
      : "No available aircraft for this contract.";
  }

  const requiredTypes = contract.required_aircraft_type || [];
  if (requiredTypes.length && !requiredTypes.includes(selectedAircraft.type)) {
    return lang === "de"
      ? `Typ nicht passend: benoetigt ${requiredTypes.join(", ")}`
      : `Type mismatch: requires ${requiredTypes.join(", ")}`;
  }

  if (
    contract.cargo_weight_kg &&
    Number(selectedAircraft.cargo_capacity_kg || 0) < Number(contract.cargo_weight_kg)
  ) {
    return lang === "de"
      ? `Zu wenig Zuladung (${selectedAircraft.cargo_capacity_kg || 0} kg / ${
          contract.cargo_weight_kg
        } kg)`
      : `Insufficient cargo (${selectedAircraft.cargo_capacity_kg || 0} kg / ${
          contract.cargo_weight_kg
        } kg)`;
  }

  if (contract.distance_nm && Number(selectedAircraft.range_nm || 0) < Number(contract.distance_nm)) {
    return lang === "de"
      ? `Reichweite zu kurz (${selectedAircraft.range_nm || 0} NM / ${
          contract.distance_nm
        } NM)`
      : `Range too short (${selectedAircraft.range_nm || 0} NM / ${
          contract.distance_nm
        } NM)`;
  }

  return lang === "de"
    ? "Flugzeug ist aktuell nicht verfuegbar."
    : "Aircraft is currently unavailable.";
}

export default function Contracts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedAircraftId, setSelectedAircraftId] = useState("all");
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [minNm, setMinNm] = useState("");
  const [maxNm, setMaxNm] = useState("");

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["contractsPageData"],
    queryFn: async () => {
      const response = await base44.functions.invoke("getContractsPageData", {});
      return response.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const company = pageData?.company || null;
  const ownedAircraft = pageData?.aircraft || [];
  const allContracts = useMemo(
    () =>
      (pageData?.contracts || []).slice().sort((a, b) => {
        return new Date(b.created_date) - new Date(a.created_date);
      }),
    [pageData]
  );

  const availableAircraft = useMemo(
    () => ownedAircraft.filter((aircraft) => aircraft.status === "available"),
    [ownedAircraft]
  );

  useEffect(() => {
    if (selectedAircraftId === "all") return;
    if (!availableAircraft.some((aircraft) => aircraft.id === selectedAircraftId)) {
      setSelectedAircraftId("all");
    }
  }, [availableAircraft, selectedAircraftId]);

  const selectedAircraft =
    selectedAircraftId !== "all"
      ? availableAircraft.find((aircraft) => aircraft.id === selectedAircraftId) || null
      : null;

  const aircraftPool = useMemo(() => {
    if (selectedAircraft) return [selectedAircraft];
    return availableAircraft;
  }, [availableAircraft, selectedAircraft]);

  const compatibleContracts = useMemo(() => {
    return allContracts.filter((contract) => {
      return aircraftPool.some((aircraft) =>
        isContractCompatibleWithAircraft(contract, aircraft)
      );
    });
  }, [aircraftPool, allContracts]);

  const incompatibleContracts = useMemo(() => {
    return allContracts.filter((contract) => {
      return !aircraftPool.some((aircraft) =>
        isContractCompatibleWithAircraft(contract, aircraft)
      );
    });
  }, [aircraftPool, allContracts]);

  const filteredCompatibleContracts = useMemo(() => {
    return compatibleContracts.filter((contract) => {
      return tabMatches(contract, activeTab) && searchMatches(contract, searchTerm);
    });
  }, [activeTab, compatibleContracts, searchTerm]);

  const visibleIncompatibleContracts = useMemo(() => {
    if (activeTab === "accepted") return [];
    return incompatibleContracts.filter((contract) => {
      return tabMatches(contract, activeTab) && searchMatches(contract, searchTerm);
    });
  }, [activeTab, incompatibleContracts, searchTerm]);

  const mapContracts = useMemo(() => {
    const merged = new Map();
    [...filteredCompatibleContracts, ...visibleIncompatibleContracts].forEach((contract) => {
      merged.set(contract.id, contract);
    });
    return Array.from(merged.values());
  }, [filteredCompatibleContracts, visibleIncompatibleContracts]);

  useEffect(() => {
    if (!filteredCompatibleContracts.length) {
      setSelectedContractId(null);
      return;
    }

    const stillVisible = filteredCompatibleContracts.some(
      (contract) => contract.id === selectedContractId
    );

    if (!stillVisible) {
      setSelectedContractId(filteredCompatibleContracts[0].id);
    }
  }, [filteredCompatibleContracts, selectedContractId]);

  const selectedContract =
    mapContracts.find((contract) => contract.id === selectedContractId) || null;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const params = {};

      if (minNm) params.minNm = parseInt(minNm, 10);
      if (maxNm) params.maxNm = parseInt(maxNm, 10);

      if (activeTab && activeTab !== "all" && activeTab !== "accepted") {
        params.contractType = activeTab;
      }

      if (selectedAircraftId && selectedAircraftId !== "all") {
        params.aircraftId = selectedAircraftId;
      }

      const response = await base44.functions.invoke("generateContracts", params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractsPageData"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });

  useEffect(() => {
    if (isLoading) return;
    if (!pageData) return;
    if (allContracts.length > 0) return;
    if (generateMutation.isPending) return;

    generateMutation.mutate();
  }, [allContracts.length, generateMutation, isLoading, pageData]);

  const acceptContractMutation = useMutation({
    mutationFn: async (contract) => {
      await base44.functions.invoke("acceptContract", { contractId: contract.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractsPageData"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      navigate(createPageUrl("ActiveFlights"));
    },
  });

  const handleAccept = (contract) => {
    acceptContractMutation.mutate(contract);
  };

  const handleView = (contract) => {
    navigate(createPageUrl(`ContractDetails?id=${contract.id}`));
  };

  const availableCount = compatibleContracts.filter(
    (contract) => contract.status === "available"
  ).length;
  const acceptedCount = compatibleContracts.filter(
    (contract) => contract.status === "accepted"
  ).length;

  return (
    <div className="h-full flex flex-col gap-3">
      <InsolvencyBanner />

      <section className="relative overflow-hidden rounded-xl border border-cyan-900/40 bg-slate-950/95 p-3 sm:p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(34,211,238,.22),transparent_42%),radial-gradient(circle_at_90%_100%,rgba(251,146,60,.2),transparent_44%)]" />

        <div className="relative flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.24em] text-cyan-300/80">
                {lang === "de" ? "Contract Command" : "Contract Command"}
              </p>
              <h1 className="text-lg font-bold text-cyan-100 sm:text-xl">
                {lang === "de" ? "Seite 4 - Mission Hub" : "Page 4 - Mission Hub"}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className="border-cyan-700/40 bg-cyan-950/50 text-[10px] font-mono text-cyan-100">
                <Sparkles className="mr-1 h-3 w-3" />
                {availableCount} {lang === "de" ? "Verfuegbar" : "Available"}
              </Badge>
              <Badge className="border-amber-700/40 bg-amber-900/30 text-[10px] font-mono text-amber-100">
                {acceptedCount} {lang === "de" ? "Angenommen" : "Accepted"}
              </Badge>
              <Badge className="border-emerald-700/40 bg-emerald-900/30 text-[10px] font-mono text-emerald-100">
                ${Math.round(company?.balance || 0).toLocaleString()}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-700" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={lang === "de" ? "Route, Airport oder Contract suchen" : "Search route, airport or contract"}
                className="h-8 border-cyan-900/60 bg-slate-950/90 pl-8 text-xs text-cyan-100 placeholder:text-cyan-900"
              />
            </div>

            <div className="flex items-center gap-1 rounded-md border border-cyan-900/50 bg-slate-950/90 px-2 py-1">
              <Filter className="h-3.5 w-3.5 text-cyan-500" />
              <Input
                type="number"
                value={minNm}
                onChange={(event) => setMinNm(event.target.value)}
                placeholder="0"
                className="h-6 w-16 border-none bg-transparent p-0 text-center text-xs text-cyan-100 focus-visible:ring-0"
              />
              <span className="text-xs text-cyan-700">-</span>
              <Input
                type="number"
                value={maxNm}
                onChange={(event) => setMaxNm(event.target.value)}
                placeholder="MAX"
                className="h-6 w-16 border-none bg-transparent p-0 text-center text-xs text-cyan-100 focus-visible:ring-0"
              />
              <span className="text-xs font-mono text-cyan-700">NM</span>
            </div>

            <Button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="h-8 bg-cyan-600 px-3 text-xs font-mono uppercase text-slate-950 hover:bg-cyan-500"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              {lang === "de" ? "Neu generieren" : "Regenerate"}
            </Button>
          </div>

          {availableAircraft.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedAircraftId("all")}
                className={`rounded-md border px-2.5 py-1 text-[10px] font-mono uppercase transition ${
                  selectedAircraftId === "all"
                    ? "border-cyan-600 bg-cyan-900/40 text-cyan-100"
                    : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-cyan-700"
                }`}
              >
                {lang === "de" ? "Alle Flugzeuge" : "All Aircraft"}
              </button>

              {availableAircraft.map((aircraft) => (
                <button
                  key={aircraft.id}
                  type="button"
                  onClick={() => setSelectedAircraftId(aircraft.id)}
                  className={`rounded-md border px-2.5 py-1 text-[10px] font-mono uppercase transition ${
                    selectedAircraftId === aircraft.id
                      ? "border-cyan-600 bg-cyan-900/40 text-cyan-100"
                      : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-cyan-700"
                  }`}
                >
                  {aircraft.name || aircraft.registration}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {isLoading ? (
        <div className="grid flex-1 grid-cols-1 gap-3 xl:grid-cols-3">
          <Card className="h-[420px] animate-pulse border border-slate-800 bg-slate-900/70 xl:col-span-2" />
          <Card className="h-[420px] animate-pulse border border-slate-800 bg-slate-900/70" />
          <Card className="h-[220px] animate-pulse border border-slate-800 bg-slate-900/70 xl:col-span-3" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ContractWorldMap
                contracts={mapContracts}
                selectedContractId={selectedContractId}
                onSelectContract={setSelectedContractId}
                lang={lang}
              />
            </div>
            <HangarMarket3D
              aircraft={availableAircraft}
              contracts={compatibleContracts}
              selectedAircraftId={selectedAircraftId}
              onSelectAircraft={setSelectedAircraftId}
              lang={lang}
            />
          </div>

          <div className="rounded-xl border border-cyan-900/40 bg-slate-950/90 p-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
                <TabsTrigger
                  value="all"
                  className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-[10px] font-mono uppercase data-[state=active]:border-cyan-600 data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-100"
                >
                  <Plane className="mr-1.5 h-3.5 w-3.5" />
                  {lang === "de" ? "Alle" : "All"}
                </TabsTrigger>
                <TabsTrigger
                  value="accepted"
                  className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-[10px] font-mono uppercase data-[state=active]:border-cyan-600 data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-100"
                >
                  <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                  {lang === "de" ? "Angenommen" : "Accepted"}
                </TabsTrigger>
                <TabsTrigger
                  value="passenger"
                  className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-[10px] font-mono uppercase data-[state=active]:border-cyan-600 data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-100"
                >
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  {lang === "de" ? "Passagier" : "Passenger"}
                </TabsTrigger>
                <TabsTrigger
                  value="cargo"
                  className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-[10px] font-mono uppercase data-[state=active]:border-cyan-600 data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-100"
                >
                  <Package className="mr-1.5 h-3.5 w-3.5" />
                  {lang === "de" ? "Fracht" : "Cargo"}
                </TabsTrigger>
                <TabsTrigger
                  value="charter"
                  className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-[10px] font-mono uppercase data-[state=active]:border-cyan-600 data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-100"
                >
                  <Star className="mr-1.5 h-3.5 w-3.5" />
                  {lang === "de" ? "Charter" : "Charter"}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 pr-0.5">
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-cyan-900/40 bg-cyan-950/25 p-2.5 text-xs text-cyan-100">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-300" />
              <p>
                {lang === "de"
                  ? "Neue Architektur: echte Earth-Map fuer Route-Fokus, 3D Hangar Market fuer Flugzeug-Wahl und ein schneller Contract-Flow ohne Kontextverlust."
                  : "New architecture: real earth map for route focus, 3D hangar market for aircraft selection, and a faster contract flow without context loss."}
              </p>
            </div>

            {availableAircraft.length === 0 && ownedAircraft.length > 0 ? (
              <Card className="border border-slate-700 bg-slate-900/80 p-8 text-center">
                <Plane className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <h3 className="mb-2 text-lg font-semibold text-slate-100">
                  {lang === "de" ? "Kein Flugzeug verfuegbar" : "No aircraft available"}
                </h3>
                <p className="text-sm text-slate-400">
                  {lang === "de"
                    ? "Alle Flugzeuge sind aktuell in Wartung, beschaedigt oder in einem aktiven Flug."
                    : "All aircraft are currently in maintenance, damaged, or in an active flight."}
                </p>
              </Card>
            ) : filteredCompatibleContracts.length > 0 ? (
              <>
                <h2 className="mb-2 text-sm font-mono uppercase tracking-[0.18em] text-cyan-200">
                  {lang === "de" ? "Kompatible Vertraege" : "Compatible Contracts"} ({filteredCompatibleContracts.length})
                </h2>

                <motion.div layout className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  <AnimatePresence>
                    {filteredCompatibleContracts.map((contract) => (
                      <ContractCard
                        key={contract.id}
                        contract={contract}
                        onAccept={handleAccept}
                        onView={handleView}
                        onSelect={(selected) => setSelectedContractId(selected.id)}
                        selected={contract.id === selectedContractId}
                        isAccepting={acceptContractMutation.isPending}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>

                {visibleIncompatibleContracts.length > 0 && (
                  <>
                    <h2 className="mb-2 text-sm font-mono uppercase tracking-[0.18em] text-amber-200">
                      {lang === "de" ? "Inkompatibel" : "Incompatible"} ({visibleIncompatibleContracts.length})
                    </h2>

                    <motion.div layout className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                      <AnimatePresence>
                        {visibleIncompatibleContracts.map((contract) => (
                          <div key={contract.id} className="relative">
                            <ContractCard
                              contract={contract}
                              onView={handleView}
                              onSelect={(selected) => setSelectedContractId(selected.id)}
                              selected={contract.id === selectedContractId}
                              isAccepting={false}
                              disabled
                            />

                            <div className="pointer-events-none absolute inset-0 flex items-end rounded-xl border border-amber-700/40 bg-slate-950/65 p-2.5">
                              <p className="text-[11px] font-mono text-amber-200">
                                {getCompatibilityReason(contract, selectedAircraft, lang)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </>
                )}
              </>
            ) : (
              <Card className="border border-slate-700 bg-slate-900/80 p-8 text-center">
                <Plane className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <h3 className="mb-2 text-lg font-semibold text-slate-100">
                  {lang === "de" ? "Keine passenden Contracts" : "No matching contracts"}
                </h3>
                <p className="mx-auto mb-5 max-w-xl text-sm text-slate-400">
                  {lang === "de"
                    ? "Passe Suchtext, Distanzfilter oder Flugzeugauswahl an und generiere anschliessend neue Auftraege."
                    : "Adjust search, distance filter, or aircraft selection and then generate new contracts."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setMinNm("");
                      setMaxNm("");
                      setActiveTab("all");
                    }}
                    className="border-slate-700 bg-slate-900 text-xs font-mono uppercase text-slate-200"
                  >
                    {lang === "de" ? "Filter reset" : "Reset Filters"}
                  </Button>

                  <Button
                    type="button"
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    className="bg-cyan-600 text-xs font-mono uppercase text-slate-950 hover:bg-cyan-500"
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {lang === "de" ? "Contracts erzeugen" : "Generate Contracts"}
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {selectedContract && (
            <div className="rounded-xl border border-cyan-900/40 bg-slate-950/80 p-2.5 text-xs font-mono text-cyan-100">
              <span className="text-cyan-300">{lang === "de" ? "Aktiver Kartenfokus:" : "Active map focus:"}</span>{" "}
              {selectedContract.departure_airport} - {selectedContract.arrival_airport} ({Math.round(selectedContract.distance_nm || 0)} NM)
            </div>
          )}
        </>
      )}
    </div>
  );
}
