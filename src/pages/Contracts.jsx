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
  Star,
  Users,
  Warehouse,
} from "lucide-react";

import ContractCard from "@/components/contracts/ContractCard";
import HangarWorldGlobe3D from "@/components/contracts/HangarWorldGlobe3D";
import HangarMarket3D from "@/components/contracts/HangarMarket3D";
import {
  HANGAR_SIZES,
  getDefaultVariantId,
  getDefaultVariantBySize,
  getVariantMeta,
  getVariantSizeSpec,
  HANGAR_MODEL_VARIANTS,
} from "@/components/contracts/hangarModelCatalog";
import InsolvencyBanner from "@/components/InsolvencyBanner";
import { useLanguage } from "@/components/LanguageContext";
import { getAirportCoords, getAllAirportCoords, isRealAirportIcao } from "@/utils/airportCoordinates";
import { useToast } from "@/components/ui/use-toast";

const HANGAR_MARKET = [
  { airport_icao: "EDDF", label: "Frankfurt" },
  { airport_icao: "EGLL", label: "London Heathrow" },
  { airport_icao: "LFPG", label: "Paris CDG" },
  { airport_icao: "LEMD", label: "Madrid" },
  { airport_icao: "LIRF", label: "Rome Fiumicino" },
  { airport_icao: "KJFK", label: "New York JFK" },
  { airport_icao: "KLAX", label: "Los Angeles" },
  { airport_icao: "KORD", label: "Chicago OHare" },
  { airport_icao: "KATL", label: "Atlanta" },
  { airport_icao: "CYYZ", label: "Toronto" },
  { airport_icao: "MMMX", label: "Mexico City" },
  { airport_icao: "SBGR", label: "Sao Paulo" },
  { airport_icao: "OMDB", label: "Dubai" },
  { airport_icao: "OTHH", label: "Doha" },
  { airport_icao: "FAOR", label: "Johannesburg" },
  { airport_icao: "HECA", label: "Cairo" },
  { airport_icao: "VTBS", label: "Bangkok" },
  { airport_icao: "WSSS", label: "Singapore" },
  { airport_icao: "RJTT", label: "Tokyo Haneda" },
  { airport_icao: "RKSI", label: "Seoul Incheon" },
  { airport_icao: "ZSPD", label: "Shanghai Pudong" },
  { airport_icao: "YSSY", label: "Sydney" },
  { airport_icao: "YMML", label: "Melbourne" },
  { airport_icao: "NZAA", label: "Auckland" },
];

const MARKET_LABELS = Object.fromEntries(
  HANGAR_MARKET.map((airport) => [airport.airport_icao, airport.label])
);

const INITIAL_AIRPORT = "EDDF";
const HANGAR_STORAGE_KEY_PREFIX = "contracts_hangars";

function normIcao(value) {
  return String(value || "").toUpperCase();
}

function parseDateValue(value) {
  if (!value) return 0;
  const millis = Date.parse(String(value));
  return Number.isFinite(millis) ? millis : 0;
}

function getHangarTimestamp(hangar) {
  return Math.max(
    parseDateValue(hangar?.upgraded_at),
    parseDateValue(hangar?.purchased_at),
    parseDateValue(hangar?.updated_date),
    parseDateValue(hangar?.created_date)
  );
}

function normalizeHangarEntry(hangar, sizeMap) {
  if (!hangar) return null;
  const airport_icao = normIcao(hangar.airport_icao);
  if (!isRealAirportIcao(airport_icao)) return null;

  const variantIdRaw = String(hangar.model_variant || "").trim();
  const variantMeta = getVariantMeta(variantIdRaw);
  const rawSize = String(hangar.size || "small").toLowerCase();
  const fallbackSize = Object.prototype.hasOwnProperty.call(sizeMap, rawSize) ? rawSize : "small";
  const modelVariant = variantMeta?.id || getDefaultVariantBySize(fallbackSize);
  const variantSizeSpec = getVariantSizeSpec(modelVariant);
  const size = variantSizeSpec?.key || fallbackSize;
  const sizeSpec = HANGAR_SIZES.find((entry) => entry.key === size) || HANGAR_SIZES[0];
  const tier = Number(
    hangar.upgrade_tier ??
      variantSizeSpec?.tier ??
      0
  );

  return {
    ...hangar,
    airport_icao,
    size,
    model_variant: modelVariant,
    upgrade_tier: tier,
    slots: hangar.slots ?? variantSizeSpec?.slots ?? sizeSpec.slots,
    allowed_types: Array.isArray(hangar.allowed_types)
      ? hangar.allowed_types
      : variantSizeSpec?.allowedTypes ?? sizeSpec.allowedTypes,
  };
}

function mergeHangarLists(preferred = [], fallback = [], sizeMap = {}) {
  const byAirport = new Map();
  [...fallback, ...preferred].forEach((raw) => {
    const hangar = normalizeHangarEntry(raw, sizeMap);
    if (!hangar) return;

    const prev = byAirport.get(hangar.airport_icao);
    if (!prev) {
      byAirport.set(hangar.airport_icao, hangar);
      return;
    }

    const prevSizeRank = sizeMap[String(prev.size || "small").toLowerCase()] ?? 0;
    const nextSizeRank = sizeMap[String(hangar.size || "small").toLowerCase()] ?? 0;
    const prevTimestamp = getHangarTimestamp(prev);
    const nextTimestamp = getHangarTimestamp(hangar);
    if (nextTimestamp > prevTimestamp || (nextTimestamp === prevTimestamp && nextSizeRank >= prevSizeRank)) {
      byAirport.set(hangar.airport_icao, hangar);
    }
  });

  return Array.from(byAirport.values()).sort((a, b) => a.airport_icao.localeCompare(b.airport_icao));
}

function getHangarStorageKey(companyId) {
  if (!companyId) return "";
  return `${HANGAR_STORAGE_KEY_PREFIX}_${companyId}`;
}

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

  const aircraftHangarAirport = normIcao(selectedAircraft.hangar_airport);
  const contractDeparture = normIcao(contract.departure_airport);
  if (!aircraftHangarAirport || aircraftHangarAirport !== contractDeparture) {
    return lang === "de"
      ? `Flugzeug ist Hangar ${aircraftHangarAirport || "-"} zugeordnet, Auftrag startet in ${contractDeparture}.`
      : `Aircraft is assigned to hangar ${aircraftHangarAirport || "-"}, contract departs from ${contractDeparture}.`;
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
      ? `Zu wenig Zuladung (${selectedAircraft.cargo_capacity_kg || 0} kg / ${contract.cargo_weight_kg} kg)`
      : `Insufficient cargo (${selectedAircraft.cargo_capacity_kg || 0} kg / ${contract.cargo_weight_kg} kg)`;
  }

  if (contract.distance_nm && Number(selectedAircraft.range_nm || 0) < Number(contract.distance_nm)) {
    return lang === "de"
      ? `Reichweite zu kurz (${selectedAircraft.range_nm || 0} NM / ${contract.distance_nm} NM)`
      : `Range too short (${selectedAircraft.range_nm || 0} NM / ${contract.distance_nm} NM)`;
  }

  return lang === "de"
    ? "Flugzeug ist aktuell nicht verfuegbar."
    : "Aircraft is currently unavailable.";
}

export default function Contracts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedAircraftId, setSelectedAircraftId] = useState("all");
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [selectedDepartureAirport, setSelectedDepartureAirport] = useState("all");
  const [selectedMarketAirportIcao, setSelectedMarketAirportIcao] = useState(INITIAL_AIRPORT);
  const [selectedMarketSize, setSelectedMarketSize] = useState("small");
  const [selectedMarketVariantId, setSelectedMarketVariantId] = useState(getDefaultVariantId());
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
  const hangarSizeRankMap = useMemo(
    () => Object.fromEntries(HANGAR_SIZES.map((size, index) => [size.key, index])),
    []
  );
  const [localHangars, setLocalHangars] = useState([]);
  const hangarStorageKey = useMemo(() => getHangarStorageKey(company?.id), [company?.id]);

  useEffect(() => {
    if (!hangarStorageKey) {
      setLocalHangars([]);
      return;
    }

    const serverHangars = Array.isArray(company?.hangars) ? company.hangars : [];
    let persistedHangars = [];
    try {
      const raw = localStorage.getItem(hangarStorageKey);
      persistedHangars = raw ? JSON.parse(raw) : [];
    } catch {
      persistedHangars = [];
    }

    setLocalHangars((previous) =>
      mergeHangarLists(
        serverHangars,
        mergeHangarLists(previous, persistedHangars, hangarSizeRankMap),
        hangarSizeRankMap
      )
    );
  }, [company?.hangars, hangarSizeRankMap, hangarStorageKey]);

  useEffect(() => {
    if (!hangarStorageKey) return;
    try {
      localStorage.setItem(hangarStorageKey, JSON.stringify(localHangars));
    } catch {
      // ignore storage write errors
    }
  }, [hangarStorageKey, localHangars]);

  const ownedHangars = localHangars;

  const allContracts = useMemo(() => {
    return (pageData?.contracts || []).slice().sort((a, b) => {
      return new Date(b.created_date) - new Date(a.created_date);
    });
  }, [pageData]);

  const availableAircraft = useMemo(() => {
    return ownedAircraft.filter((aircraft) => aircraft.status === "available");
  }, [ownedAircraft]);

  const marketAirports = useMemo(() => {
    const airportsByIcao = new Map();
    const addAirport = (airportIcao) => {
      const normalized = normIcao(airportIcao);
      if (!isRealAirportIcao(normalized)) return;
      const coords = getAirportCoords(normalized);
      if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) return;
      airportsByIcao.set(normalized, {
        airport_icao: normalized,
        label: MARKET_LABELS[normalized] || normalized,
        lat: coords.lat,
        lon: coords.lon,
      });
    };

    getAllAirportCoords({ realOnly: true }).forEach((airport) => addAirport(airport.airport_icao));
    (pageData?.contracts || []).forEach((contract) => {
      addAirport(contract.departure_airport);
      addAirport(contract.arrival_airport);
    });
    localHangars.forEach((hangar) => addAirport(hangar.airport_icao));

    const airports = Array.from(airportsByIcao.values());

    airports.sort((a, b) => a.airport_icao.localeCompare(b.airport_icao));
    return airports;
  }, [localHangars, pageData?.contracts]);

  useEffect(() => {
    if (selectedAircraftId === "all") return;
    if (!availableAircraft.some((aircraft) => aircraft.id === selectedAircraftId)) {
      setSelectedAircraftId("all");
    }
  }, [availableAircraft, selectedAircraftId]);

  useEffect(() => {
    if (!marketAirports.length) {
      setSelectedMarketAirportIcao("");
      return;
    }
    if (!selectedMarketAirportIcao) return;
    if (!marketAirports.some((airport) => airport.airport_icao === normIcao(selectedMarketAirportIcao))) {
      setSelectedMarketAirportIcao(marketAirports[0].airport_icao);
    }
  }, [marketAirports, selectedMarketAirportIcao]);

  const selectedAircraft =
    selectedAircraftId !== "all"
      ? availableAircraft.find((aircraft) => aircraft.id === selectedAircraftId) || null
      : null;

  const aircraftPool = useMemo(() => {
    if (selectedAircraft) return [selectedAircraft];
    return availableAircraft;
  }, [availableAircraft, selectedAircraft]);

  const ownedHangarAirportSet = useMemo(
    () => new Set(ownedHangars.map((hangar) => normIcao(hangar.airport_icao)).filter(Boolean)),
    [ownedHangars]
  );

  const compatibleContracts = useMemo(() => {
    return allContracts.filter((contract) => {
      const departureIcao = normIcao(contract.departure_airport);
      return aircraftPool.some((aircraft) => {
        if (!isContractCompatibleWithAircraft(contract, aircraft)) return false;
        const assignedIcao = normIcao(aircraft.hangar_airport);
        if (!assignedIcao) return false;
        return assignedIcao === departureIcao;
      });
    });
  }, [aircraftPool, allContracts]);

  const incompatibleContracts = useMemo(() => {
    return allContracts.filter((contract) => {
      const departureIcao = normIcao(contract.departure_airport);
      return !aircraftPool.some((aircraft) => {
        if (!isContractCompatibleWithAircraft(contract, aircraft)) return false;
        const assignedIcao = normIcao(aircraft.hangar_airport);
        if (!assignedIcao) return false;
        return assignedIcao === departureIcao;
      });
    });
  }, [aircraftPool, allContracts]);

  const filteredCompatibleContracts = useMemo(() => {
    return compatibleContracts.filter((contract) => {
      const departureMatch =
        selectedDepartureAirport === "all" || normIcao(contract.departure_airport) === normIcao(selectedDepartureAirport);
      const ownedDepartureMatch =
        ownedHangarAirportSet.size === 0 || ownedHangarAirportSet.has(normIcao(contract.departure_airport));
      return (
        tabMatches(contract, activeTab) &&
        searchMatches(contract, searchTerm) &&
        departureMatch &&
        ownedDepartureMatch
      );
    });
  }, [activeTab, compatibleContracts, ownedHangarAirportSet, searchTerm, selectedDepartureAirport]);

  const visibleIncompatibleContracts = useMemo(() => {
    if (activeTab === "accepted") return [];
    return incompatibleContracts.filter((contract) => {
      const departureMatch =
        selectedDepartureAirport === "all" || normIcao(contract.departure_airport) === normIcao(selectedDepartureAirport);
      const ownedDepartureMatch =
        ownedHangarAirportSet.size === 0 || ownedHangarAirportSet.has(normIcao(contract.departure_airport));
      return (
        tabMatches(contract, activeTab) &&
        searchMatches(contract, searchTerm) &&
        departureMatch &&
        ownedDepartureMatch
      );
    });
  }, [activeTab, incompatibleContracts, ownedHangarAirportSet, searchTerm, selectedDepartureAirport]);

  const mapContracts = useMemo(() => {
    const merged = new Map();
    [...filteredCompatibleContracts, ...visibleIncompatibleContracts].forEach((contract) => {
      merged.set(contract.id, contract);
    });

    return Array.from(merged.values())
      .map((contract) => {
        const dep = getAirportCoords(normIcao(contract.departure_airport));
        const arr = getAirportCoords(normIcao(contract.arrival_airport));
        if (!dep || !arr) return null;
        return {
          ...contract,
          departure_airport: normIcao(contract.departure_airport),
          arrival_airport: normIcao(contract.arrival_airport),
          dep_lat: dep.lat,
          dep_lon: dep.lon,
          arr_lat: arr.lat,
          arr_lon: arr.lon,
        };
      })
      .filter(Boolean);
  }, [filteredCompatibleContracts, visibleIncompatibleContracts]);

  useEffect(() => {
    if (!mapContracts.length) {
      setSelectedContractId(null);
      return;
    }
    if (selectedContractId && !mapContracts.some((contract) => contract.id === selectedContractId)) {
      setSelectedContractId(null);
    }
  }, [mapContracts, selectedContractId]);

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

  const upsertHangarMutation = useMutation({
    mutationFn: async ({ airportIcao, modelVariantId }) => {
      if (!company?.id) throw new Error("Company not found.");
      const targetAirport = normIcao(airportIcao);
      if (!targetAirport) throw new Error("Select an airport first.");
      const targetVariant = getVariantMeta(modelVariantId) || getVariantMeta(getDefaultVariantId());
      if (!targetVariant) throw new Error("Invalid hangar model.");
      const targetSize = getVariantSizeSpec(targetVariant.id);
      if (!targetSize) throw new Error("Invalid hangar model size.");

      const companyRows = await base44.entities.Company.filter({ id: company.id });
      const latestCompany = companyRows?.[0] || company;
      const currentHangars = mergeHangarLists(
        Array.isArray(localHangars) ? localHangars : [],
        Array.isArray(latestCompany?.hangars) ? latestCompany.hangars : [],
        hangarSizeRankMap
      );
      const existing = currentHangars.find((hangar) => normIcao(hangar.airport_icao) === targetAirport);

      let balanceChange = 0;
      let nextHangars = currentHangars;

      if (!existing) {
        balanceChange = targetSize.price;
        nextHangars = [
          ...currentHangars,
          {
            id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `hangar_${Date.now()}`,
            airport_icao: targetAirport,
            size: targetSize.key,
            model_variant: targetVariant.id,
            upgrade_tier: Number(targetSize.tier || 0),
            purchase_price: targetSize.price,
            slots: targetSize.slots,
            allowed_types: targetSize.allowedTypes,
            purchased_at: new Date().toISOString(),
          },
        ];
      } else {
        const existingVariant = getVariantMeta(existing.model_variant);
        const existingVariantSpec = getVariantSizeSpec(existingVariant?.id);
        const currentTier = Number(
          existing.upgrade_tier ??
            existingVariantSpec?.tier ??
            0
        );
        const targetTier = Number(targetSize.tier || 0);
        if (targetTier <= currentTier) {
          throw new Error("Choose a higher hangar model.");
        }

        const baseCurrentPrice =
          Number(existing.purchase_price || 0) ||
          Number(existingVariantSpec?.price || 0);
        balanceChange = Math.max(0, targetSize.price - baseCurrentPrice);

        nextHangars = currentHangars.map((hangar) => {
          if (normIcao(hangar.airport_icao) !== targetAirport) return hangar;
          return {
            ...hangar,
            airport_icao: targetAirport,
            size: targetSize.key,
            model_variant: targetVariant.id,
            upgrade_tier: targetTier,
            purchase_price: targetSize.price,
            slots: targetSize.slots,
            allowed_types: targetSize.allowedTypes,
            upgraded_at: new Date().toISOString(),
          };
        });
      }

      const currentBalance = Number(latestCompany?.balance || 0);
      if (currentBalance < balanceChange) {
        throw new Error("Insufficient balance.");
      }

      await base44.entities.Company.update(latestCompany.id, {
        hangars: nextHangars,
        balance: currentBalance - balanceChange,
      });

      const verifyRows = await base44.entities.Company.filter({ id: latestCompany.id });
      const verifiedCompany = verifyRows?.[0] || null;
      const persistedHangars = mergeHangarLists(
        Array.isArray(verifiedCompany?.hangars) ? verifiedCompany.hangars : [],
        nextHangars,
        hangarSizeRankMap
      );
      const persistedTarget = persistedHangars.find(
        (hangar) => normIcao(hangar.airport_icao) === targetAirport
      );
      if (
        !persistedTarget ||
        persistedTarget.size !== targetSize.key ||
        String(persistedTarget.model_variant || "") !== String(targetVariant.id || "")
      ) {
        throw new Error("Hangar save verification failed.");
      }

      return {
        airport: targetAirport,
        size: targetSize.key,
        modelVariant: targetVariant.id,
        cost: balanceChange,
        upgraded: Boolean(existing),
        nextHangars: persistedHangars,
        nextBalance: Number(verifiedCompany?.balance ?? currentBalance - balanceChange),
      };
    },
    onSuccess: (result) => {
      if (Array.isArray(result?.nextHangars)) {
        setLocalHangars(result.nextHangars);
      }
      queryClient.setQueryData(["contractsPageData"], (previous) => {
        if (!previous?.company) return previous;
        return {
          ...previous,
          company: {
            ...previous.company,
            hangars: Array.isArray(result?.nextHangars) ? result.nextHangars : previous.company.hangars,
            balance:
              typeof result?.nextBalance === "number" ? result.nextBalance : previous.company.balance,
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: ["contractsPageData"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast({
        title: lang === "de" ? "Hangar aktualisiert" : "Hangar updated",
        description:
          lang === "de"
            ? `${result.upgraded ? "Upgrade" : "Kauf"} ${result.airport} (${result.size.toUpperCase()} / ${String(result.modelVariant || "").toUpperCase()}) erfolgreich.`
            : `${result.upgraded ? "Upgrade" : "Purchase"} ${result.airport} (${result.size.toUpperCase()} / ${String(result.modelVariant || "").toUpperCase()}) completed.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: lang === "de" ? "Hangar Kauf fehlgeschlagen" : "Hangar purchase failed",
        description: error?.message || (lang === "de" ? "Unbekannter Fehler." : "Unknown error."),
      });
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

  const activeOwnedAircraft = useMemo(
    () => ownedAircraft.filter((aircraft) => aircraft.status !== "sold"),
    [ownedAircraft]
  );
  const [aircraftMoveTargets, setAircraftMoveTargets] = useState({});

  useEffect(() => {
    setAircraftMoveTargets((previous) => {
      const next = { ...previous };
      const validIds = new Set(activeOwnedAircraft.map((aircraft) => aircraft.id));
      Object.keys(next).forEach((aircraftId) => {
        if (!validIds.has(aircraftId)) delete next[aircraftId];
      });

      activeOwnedAircraft.forEach((aircraft) => {
        const currentAirport = normIcao(aircraft.hangar_airport);
        const fallbackAirport = normIcao(ownedHangars[0]?.airport_icao);
        if (!next[aircraft.id]) {
          next[aircraft.id] = currentAirport || fallbackAirport || "";
        }
      });

      return next;
    });
  }, [activeOwnedAircraft, ownedHangars]);

  const occupancyByAirport = useMemo(() => {
    const map = new Map();
    activeOwnedAircraft.forEach((aircraft) => {
      const airport = normIcao(aircraft.hangar_airport);
      if (!airport) return;
      map.set(airport, (map.get(airport) || 0) + 1);
    });
    return map;
  }, [activeOwnedAircraft]);

  function getAircraftNewValue(aircraft) {
    return Number(
      aircraft?.original_purchase_price ||
        aircraft?.purchase_price ||
        aircraft?.current_value ||
        0
    );
  }

  function getTransferCost(aircraft, targetAirportIcao) {
    const currentAirport = normIcao(aircraft?.hangar_airport);
    const targetAirport = normIcao(targetAirportIcao);
    if (!targetAirport || !currentAirport || currentAirport === targetAirport) return 0;
    const baseValue = getAircraftNewValue(aircraft);
    if (baseValue <= 0) return 0;
    return Math.round(baseValue * 0.1);
  }

  function getMoveValidation(aircraft, targetAirportIcao) {
    const targetAirport = normIcao(targetAirportIcao);
    const currentAirport = normIcao(aircraft?.hangar_airport);
    const targetHangar = ownedHangars.find(
      (hangar) => normIcao(hangar.airport_icao) === targetAirport
    );

    if (!targetAirport || !targetHangar) {
      return { valid: false, reason: lang === "de" ? "Hangar waehlen." : "Select hangar." };
    }
    if (currentAirport === targetAirport) {
      return { valid: false, reason: lang === "de" ? "Bereits in diesem Hangar." : "Already in this hangar." };
    }

    const allowedTypes = Array.isArray(targetHangar.allowed_types) ? targetHangar.allowed_types : [];
    if (allowedTypes.length > 0 && !allowedTypes.includes(aircraft.type)) {
      return {
        valid: false,
        reason:
          lang === "de"
            ? `Typ ${aircraft.type} nicht erlaubt.`
            : `Type ${aircraft.type} not allowed.`,
      };
    }

    const usedSlotsExcludingAircraft = activeOwnedAircraft.filter(
      (entry) =>
        entry.id !== aircraft.id &&
        normIcao(entry.hangar_airport) === targetAirport
    ).length;
    const totalSlots = Number(targetHangar.slots || 0);
    if (totalSlots > 0 && usedSlotsExcludingAircraft >= totalSlots) {
      return {
        valid: false,
        reason: lang === "de" ? "Keine freien Slots." : "No free slots.",
      };
    }

    const transferCost = getTransferCost(aircraft, targetAirport);
    if (Number(company?.balance || 0) < transferCost) {
      return {
        valid: false,
        reason: lang === "de" ? "Nicht genug Guthaben." : "Insufficient balance.",
      };
    }

    return { valid: true, reason: "", transferCost, targetHangar };
  }

  const moveAircraftMutation = useMutation({
    mutationFn: async ({ aircraft, targetAirportIcao }) => {
      if (!company?.id) throw new Error("Company not found.");
      const validation = getMoveValidation(aircraft, targetAirportIcao);
      if (!validation.valid || !validation.targetHangar) {
        throw new Error(validation.reason || "Invalid transfer.");
      }

      const targetAirport = normIcao(targetAirportIcao);
      const transferCost = Number(validation.transferCost || 0);
      const latestCompanyRows = await base44.entities.Company.filter({ id: company.id });
      const latestCompany = latestCompanyRows?.[0] || company;
      const currentBalance = Number(latestCompany.balance || 0);
      if (currentBalance < transferCost) throw new Error("Insufficient balance.");

      await base44.entities.Aircraft.update(aircraft.id, {
        hangar_id: validation.targetHangar.id,
        hangar_airport: targetAirport,
      });

      if (transferCost > 0) {
        await base44.entities.Company.update(latestCompany.id, {
          balance: currentBalance - transferCost,
        });
        await base44.entities.Transaction.create({
          company_id: latestCompany.id,
          type: "expense",
          category: "hangar_transfer",
          amount: transferCost,
          description:
            lang === "de"
              ? `Hangar-Transfer ${aircraft.registration || aircraft.name || aircraft.id} -> ${targetAirport}`
              : `Hangar transfer ${aircraft.registration || aircraft.name || aircraft.id} -> ${targetAirport}`,
          date: new Date().toISOString(),
        });
      }

      return { transferCost, targetAirport, aircraft };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contractsPageData"] });
      queryClient.invalidateQueries({ queryKey: ["aircraft"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast({
        title: lang === "de" ? "Flugzeug verschoben" : "Aircraft moved",
        description:
          lang === "de"
            ? `${result.aircraft.registration || result.aircraft.name || "Aircraft"} -> ${result.targetAirport} (${result.transferCost > 0 ? `$${Math.round(result.transferCost).toLocaleString()}` : "ohne Kosten"})`
            : `${result.aircraft.registration || result.aircraft.name || "Aircraft"} -> ${result.targetAirport} (${result.transferCost > 0 ? `$${Math.round(result.transferCost).toLocaleString()}` : "no cost"})`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: lang === "de" ? "Transfer fehlgeschlagen" : "Transfer failed",
        description: error?.message || (lang === "de" ? "Unbekannter Fehler." : "Unknown error."),
      });
    },
  });

  const ownedHangarsWithCoords = useMemo(() => {
    return ownedHangars
      .map((hangar) => {
        const airportIcao = normIcao(hangar.airport_icao);
        const coords = getAirportCoords(airportIcao);
        if (!coords) return null;
        const meta = marketAirports.find((airport) => airport.airport_icao === airportIcao);
        return { ...hangar, airport_icao: airportIcao, ...coords, label: meta?.label || airportIcao };
      })
      .filter(Boolean);
  }, [ownedHangars, marketAirports]);

  const contractsByHangar = useMemo(() => {
    const map = {};
    ownedHangars.forEach((hangar) => {
      const airportIcao = normIcao(hangar.airport_icao);
      map[airportIcao] = mapContracts.filter(
        (contract) => normIcao(contract.departure_airport) === airportIcao
      );
    });
    return map;
  }, [ownedHangars, mapContracts]);

  const selectedMarketHangar =
    ownedHangars.find((hangar) => normIcao(hangar.airport_icao) === normIcao(selectedMarketAirportIcao)) || null;
  const selectedVariantMeta = useMemo(
    () => getVariantMeta(selectedMarketVariantId) || HANGAR_MODEL_VARIANTS[0] || null,
    [selectedMarketVariantId]
  );
  const selectedSizeSpec = useMemo(
    () => getVariantSizeSpec(selectedVariantMeta?.id) || HANGAR_SIZES[0],
    [selectedVariantMeta?.id]
  );

  useEffect(() => {
    if (selectedMarketHangar?.model_variant) {
      if (selectedMarketHangar.model_variant !== selectedMarketVariantId) {
        setSelectedMarketVariantId(selectedMarketHangar.model_variant);
      }
      const ownedSize = String(selectedMarketHangar.size || "").toLowerCase();
      if (ownedSize && ownedSize !== selectedMarketSize) {
        setSelectedMarketSize(ownedSize);
      }
      return;
    }

    if (!getVariantMeta(selectedMarketVariantId)) {
      const fallback = getDefaultVariantId();
      setSelectedMarketVariantId(fallback);
      return;
    }

    const variantSize = String(selectedSizeSpec?.key || "small").toLowerCase();
    if (variantSize !== selectedMarketSize) {
      setSelectedMarketSize(variantSize);
    }
  }, [selectedMarketHangar?.model_variant, selectedMarketHangar?.size, selectedMarketSize, selectedMarketVariantId, selectedSizeSpec?.key]);

  const marketActionInfo = useMemo(() => {
    if (!selectedMarketAirportIcao) {
      return {
        label: lang === "de" ? "Airport waehlen" : "Select airport",
        cost: 0,
        canSubmit: false,
        helper: lang === "de" ? "Bitte zuerst einen Airport waehlen." : "Please choose an airport first.",
      };
    }

    if (!selectedMarketHangar) {
      return {
        label: lang === "de" ? "Hangar kaufen" : "Buy hangar",
        cost: selectedSizeSpec.price,
        canSubmit: true,
        helper:
          lang === "de"
            ? `${selectedVariantMeta?.label || "-"} | ${selectedSizeSpec.key.toUpperCase()} | ${selectedSizeSpec.slots} Slots`
            : `${selectedVariantMeta?.label || "-"} | ${selectedSizeSpec.key.toUpperCase()} | ${selectedSizeSpec.slots} slots`,
      };
    }

    if (String(selectedMarketHangar.model_variant || "") === String(selectedVariantMeta?.id || "")) {
      return {
        label: lang === "de" ? "Bereits gekauft" : "Already owned",
        cost: 0,
        canSubmit: false,
        helper:
          lang === "de"
            ? `Aktuell: ${selectedVariantMeta?.label || "-"}`
            : `Current: ${selectedVariantMeta?.label || "-"}`,
      };
    }

    const currentVariant = getVariantMeta(selectedMarketHangar.model_variant);
    const currentVariantSpec = getVariantSizeSpec(currentVariant?.id);
    const currentTier = Number(
      selectedMarketHangar.upgrade_tier ??
        currentVariantSpec?.tier ??
        0
    );
    const targetTier = Number(selectedSizeSpec.tier || 0);
    if (targetTier <= currentTier) {
      return {
        label: lang === "de" ? "Upgrade waehlen" : "Choose upgrade",
        cost: 0,
        canSubmit: false,
        helper: lang === "de" ? "Nur Upgrades auf groessere Hangars moeglich." : "Only upgrades to larger sizes are possible.",
      };
    }
    const baseCurrentPrice =
      Number(selectedMarketHangar.purchase_price || 0) ||
      Number(currentVariantSpec?.price || 0);
    return {
      label:
        lang === "de"
          ? `Upgrade auf ${selectedSizeSpec.key.toUpperCase()}`
          : `Upgrade to ${selectedSizeSpec.key.toUpperCase()}`,
      cost: Math.max(0, selectedSizeSpec.price - baseCurrentPrice),
      canSubmit: true,
      helper:
        lang === "de"
          ? `Aktuell: ${String(selectedMarketHangar.size || "small").toUpperCase()} / ${String(selectedMarketHangar.model_variant || "-")} -> ${selectedVariantMeta?.label || "-"}`
          : `Current: ${String(selectedMarketHangar.size || "small").toUpperCase()} / ${String(selectedMarketHangar.model_variant || "-")} -> ${selectedVariantMeta?.label || "-"}`,
    };
  }, [lang, selectedMarketAirportIcao, selectedMarketHangar, selectedMarketSize, selectedSizeSpec, selectedVariantMeta?.id, selectedVariantMeta?.label]);

  const selectedContract =
    mapContracts.find((contract) => contract.id === selectedContractId) || null;

  const availableCount = compatibleContracts.filter((contract) => contract.status === "available").length;
  const acceptedCount = compatibleContracts.filter((contract) => contract.status === "accepted").length;

  return (
    <div className="h-full flex flex-col gap-3">
      <InsolvencyBanner />

      <section className="relative overflow-hidden rounded-xl border border-cyan-900/40 bg-slate-950/95 p-3 sm:p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(14,165,233,.2),transparent_42%),radial-gradient(circle_at_90%_100%,rgba(249,115,22,.18),transparent_44%)]" />

        <div className="relative flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.24em] text-cyan-300/80">Contract Seite 4</p>
              <h1 className="text-lg font-bold text-cyan-100 sm:text-xl">
                {lang === "de" ? "Globe Mission & Hangar Marketplace" : "Globe Mission & Hangar Marketplace"}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className="border-cyan-700/40 bg-cyan-950/50 text-[10px] font-mono text-cyan-100">{availableCount} {lang === "de" ? "verfuegbar" : "available"}</Badge>
              <Badge className="border-amber-700/40 bg-amber-900/30 text-[10px] font-mono text-amber-100">{acceptedCount} {lang === "de" ? "angenommen" : "accepted"}</Badge>
              <Badge className="border-emerald-700/40 bg-emerald-900/30 text-[10px] font-mono text-emerald-100">${Math.round(company?.balance || 0).toLocaleString()}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-12">
            <div className="relative lg:col-span-4">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-700" />
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={lang === "de" ? "Route, Airport oder Auftrag" : "Route, airport or contract"} className="h-8 border-cyan-900/60 bg-slate-950/90 pl-8 text-xs text-cyan-100 placeholder:text-cyan-900" />
            </div>

            <div className="flex items-center gap-1 rounded-md border border-cyan-900/50 bg-slate-950/90 px-2 py-1 lg:col-span-3">
              <Filter className="h-3.5 w-3.5 text-cyan-500" />
              <Input type="number" value={minNm} onChange={(event) => setMinNm(event.target.value)} placeholder="0" className="h-6 w-16 border-none bg-transparent p-0 text-center text-xs text-cyan-100 focus-visible:ring-0" />
              <span className="text-xs text-cyan-700">-</span>
              <Input type="number" value={maxNm} onChange={(event) => setMaxNm(event.target.value)} placeholder="MAX" className="h-6 w-16 border-none bg-transparent p-0 text-center text-xs text-cyan-100 focus-visible:ring-0" />
              <span className="text-xs font-mono text-cyan-700">NM</span>
            </div>

            <select value={selectedDepartureAirport} onChange={(event) => setSelectedDepartureAirport(event.target.value)} className="h-8 rounded-md border border-cyan-900/60 bg-slate-950/90 px-2 text-xs text-cyan-100 lg:col-span-3">
              <option value="all">{lang === "de" ? "Alle Departure-Airports" : "All departure airports"}</option>
              {marketAirports.map((airport) => (
                <option key={airport.airport_icao} value={airport.airport_icao}>
                  {airport.airport_icao} - {airport.label}
                </option>
              ))}
            </select>

            <Button type="button" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="h-8 bg-cyan-600 px-3 text-xs font-mono uppercase text-slate-950 hover:bg-cyan-500 lg:col-span-2">
              {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              {lang === "de" ? "Neu generieren" : "Regenerate"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-900/40 bg-slate-950/70 p-2">
            <div className="inline-flex items-center gap-1 text-[11px] text-cyan-200"><Warehouse className="h-3.5 w-3.5" />{lang === "de" ? "Marketplace Airport" : "Marketplace airport"}</div>
            <select value={selectedMarketAirportIcao} onChange={(event) => { const nextAirport = normIcao(event.target.value); setSelectedMarketAirportIcao(nextAirport); setSelectedDepartureAirport(nextAirport || "all"); }} className="h-7 rounded border border-cyan-900/60 bg-slate-950/90 px-2 text-xs text-cyan-100">
              <option value="">{lang === "de" ? "Airport waehlen" : "Select airport"}</option>
              {marketAirports.map((airport) => (
                <option key={airport.airport_icao} value={airport.airport_icao}>{airport.airport_icao} - {airport.label}</option>
              ))}
            </select>
            <Badge className="border-emerald-700/40 bg-emerald-900/20 text-[10px] font-mono text-emerald-200">
              {marketActionInfo.label}: ${Math.round(marketActionInfo.cost || 0).toLocaleString()}
            </Badge>
            <Badge className="border-cyan-700/40 bg-cyan-900/20 text-[10px] font-mono text-cyan-200">
              {selectedVariantMeta?.label || "-"} | {selectedSizeSpec.key.toUpperCase()} | {selectedSizeSpec.slots} Slots
            </Badge>
            <span className="text-[11px] text-slate-400">
              {lang === "de" ? "Nur Modell waehlen, Preis/Infos kommen aus dem Modell." : "Model-only selection, price/details come from the model."}
            </span>
          </div>
        </div>
      </section>

      {isLoading ? (
        <Card className="h-[620px] animate-pulse border border-slate-800 bg-slate-900/70" />
      ) : (
        <HangarWorldGlobe3D
          hangars={ownedHangarsWithCoords}
          contracts={mapContracts}
          contractsByHangar={contractsByHangar}
          marketAirports={marketAirports}
          selectedContractId={selectedContractId}
          onSelectContract={setSelectedContractId}
          selectedAirportIcao={selectedMarketAirportIcao}
          onSelectAirport={(airportIcao) => {
            const nextAirport = normIcao(airportIcao);
            setSelectedMarketAirportIcao(nextAirport);
            setSelectedDepartureAirport(nextAirport || "all");
          }}
          selectedMarketSize={selectedMarketSize}
          selectedMarketVariantId={selectedMarketVariantId}
          onSelectMarketVariantId={setSelectedMarketVariantId}
          hangarVariants={HANGAR_MODEL_VARIANTS}
          onBuyOrUpgrade={({ airportIcao, modelVariant }) =>
            upsertHangarMutation.mutate({
              airportIcao,
              modelVariantId: modelVariant || selectedMarketVariantId,
            })
          }
          isBuyingOrUpgrading={upsertHangarMutation.isPending}
          lang={lang}
        />
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <Card className="xl:col-span-4 border border-cyan-900/40 bg-slate-950/90 p-3">
            <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-300/80">
              {lang === "de" ? "Hangar Management" : "Hangar management"}
            </div>
            <div className="space-y-2">
              {ownedHangarsWithCoords.length > 0 ? (
                <>
                  <div className="space-y-1.5">
                    {ownedHangarsWithCoords.map((hangar) => {
                      const airportIcao = normIcao(hangar.airport_icao);
                      const occupied = Number(occupancyByAirport.get(airportIcao) || 0);
                      const total = Number(hangar.slots || 0);
                      const variant = getVariantMeta(hangar.model_variant);
                      return (
                        <div key={`${hangar.airport_icao}_${hangar.size}`} className="rounded-md border border-slate-700/70 bg-slate-900/70 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-mono text-cyan-100">{hangar.airport_icao}</p>
                            <Badge className="border-emerald-700/40 bg-emerald-900/25 text-[10px] font-mono text-emerald-200">
                              {occupied}/{total}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-300">{variant?.label || String(hangar.model_variant || "-")}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-md border border-slate-700/70 bg-slate-900/70 p-2">
                    <p className="mb-2 text-[10px] font-mono uppercase tracking-wide text-cyan-300">
                      {lang === "de" ? "Flugzeuge zuweisen / verlegen" : "Assign / move aircraft"}
                    </p>
                    <div className="space-y-1.5">
                      {activeOwnedAircraft.map((aircraft) => {
                        const currentAirport = normIcao(aircraft.hangar_airport);
                        const selectedTarget = normIcao(aircraftMoveTargets[aircraft.id]);
                        const moveInfo = getMoveValidation(aircraft, selectedTarget);
                        const transferCost = getTransferCost(aircraft, selectedTarget);
                        return (
                          <div key={aircraft.id} className="rounded-md border border-slate-700/70 bg-slate-950/70 p-2">
                            <p className="truncate text-[11px] font-semibold text-cyan-100">
                              {aircraft.registration || aircraft.name || aircraft.id}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {lang === "de" ? "Aktueller Hangar" : "Current hangar"}: {currentAirport || "-"}
                            </p>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <select
                                value={selectedTarget}
                                onChange={(event) =>
                                  setAircraftMoveTargets((previous) => ({
                                    ...previous,
                                    [aircraft.id]: normIcao(event.target.value),
                                  }))
                                }
                                className="h-7 flex-1 rounded border border-cyan-900/60 bg-slate-950/90 px-2 text-[10px] text-cyan-100"
                              >
                                {ownedHangarsWithCoords.map((hangar) => (
                                  <option key={`${aircraft.id}_${hangar.airport_icao}`} value={hangar.airport_icao}>
                                    {hangar.airport_icao}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="button"
                                disabled={!moveInfo.valid || moveAircraftMutation.isPending}
                                onClick={() =>
                                  moveAircraftMutation.mutate({
                                    aircraft,
                                    targetAirportIcao: selectedTarget,
                                  })
                                }
                                className="h-7 bg-emerald-600 px-2 text-[10px] font-mono uppercase text-slate-950 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-300"
                              >
                                {moveAircraftMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : lang === "de" ? (
                                  "Move"
                                ) : (
                                  "Move"
                                )}
                              </Button>
                            </div>
                            <p className="mt-1 text-[10px] text-slate-400">
                              {lang === "de" ? "Transferkosten" : "Transfer cost"}: ${Math.round(transferCost || 0).toLocaleString()}
                            </p>
                            {!moveInfo.valid && (
                              <p className="mt-0.5 text-[10px] text-amber-300">{moveInfo.reason}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">
                      {lang === "de"
                        ? "Hinweis: Verlegung in einen anderen Hangar kostet 10% des Flugzeug-Neuwerts."
                        : "Note: Moving to another hangar costs 10% of aircraft new value."}
                    </p>
                  </div>
                </>
              ) : (
                <p className="rounded-md border border-slate-700/70 bg-slate-900/70 p-2 text-[11px] text-slate-400">
                  {lang === "de"
                    ? "Noch keine eigenen Hangars vorhanden."
                    : "No owned hangars available yet."}
                </p>
              )}
            </div>
          </Card>

          <div className="xl:col-span-8">
            <HangarMarket3D
              marketAirports={marketAirports}
              selectedAirportIcao={selectedMarketAirportIcao}
              onSelectAirport={(airportIcao) => {
                const nextAirport = normIcao(airportIcao);
                setSelectedMarketAirportIcao(nextAirport);
                setSelectedDepartureAirport(nextAirport || "all");
              }}
              selectedMarketSize={selectedMarketSize}
              hangarVariants={HANGAR_MODEL_VARIANTS}
              selectedMarketVariantId={selectedMarketVariantId}
              onSelectMarketVariantId={setSelectedMarketVariantId}
              selectedHangar={selectedMarketHangar}
              actionLabel={marketActionInfo.label}
              actionCost={marketActionInfo.cost}
              actionHelper={`${marketActionInfo.helper} ${selectedVariantMeta ? `| ${selectedVariantMeta.label}` : ""}`}
              canSubmit={marketActionInfo.canSubmit}
              onBuyOrUpgrade={({ airportIcao, modelVariant } = {}) =>
                upsertHangarMutation.mutate({
                  airportIcao: airportIcao || selectedMarketAirportIcao,
                  modelVariantId: modelVariant || selectedMarketVariantId,
                })
              }
              isProcessing={upsertHangarMutation.isPending}
              departureCount={mapContracts.filter((contract) => normIcao(contract.departure_airport) === normIcao(selectedMarketAirportIcao)).length}
              lang={lang}
            />
          </div>
        </div>
      )}

      {availableAircraft.length > 0 && (
        <div className="rounded-xl border border-cyan-900/40 bg-slate-950/90 p-2">
          <div className="mb-1 text-[10px] font-mono uppercase text-cyan-300/80">{lang === "de" ? "Aircraft Filter" : "Aircraft filter"}</div>
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => setSelectedAircraftId("all")} className={`rounded-md border px-2.5 py-1 text-[10px] font-mono uppercase transition ${selectedAircraftId === "all" ? "border-cyan-600 bg-cyan-900/40 text-cyan-100" : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-cyan-700"}`}>{lang === "de" ? "Alle Flugzeuge" : "All aircraft"}</button>
            {availableAircraft.map((aircraft) => (
              <button key={aircraft.id} type="button" onClick={() => setSelectedAircraftId(aircraft.id)} className={`rounded-md border px-2.5 py-1 text-[10px] font-mono uppercase transition ${selectedAircraftId === aircraft.id ? "border-cyan-600 bg-cyan-900/40 text-cyan-100" : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-cyan-700"}`}>
                {aircraft.name || aircraft.registration}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-cyan-900/40 bg-slate-950/90 p-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="all" className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-[10px] font-mono uppercase data-[state=active]:border-cyan-600 data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-100"><Plane className="mr-1.5 h-3.5 w-3.5" />{lang === "de" ? "Alle" : "All"}</TabsTrigger>
            <TabsTrigger value="accepted" className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-[10px] font-mono uppercase data-[state=active]:border-cyan-600 data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-100"><Clock3 className="mr-1.5 h-3.5 w-3.5" />{lang === "de" ? "Angenommen" : "Accepted"}</TabsTrigger>
            <TabsTrigger value="passenger" className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-[10px] font-mono uppercase data-[state=active]:border-cyan-600 data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-100"><Users className="mr-1.5 h-3.5 w-3.5" />{lang === "de" ? "Passagier" : "Passenger"}</TabsTrigger>
            <TabsTrigger value="cargo" className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-[10px] font-mono uppercase data-[state=active]:border-cyan-600 data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-100"><Package className="mr-1.5 h-3.5 w-3.5" />{lang === "de" ? "Fracht" : "Cargo"}</TabsTrigger>
            <TabsTrigger value="charter" className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-[10px] font-mono uppercase data-[state=active]:border-cyan-600 data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-100"><Star className="mr-1.5 h-3.5 w-3.5" />{lang === "de" ? "Charter" : "Charter"}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pr-0.5">
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-cyan-900/40 bg-cyan-950/25 p-2.5 text-xs text-cyan-100">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-300" />
          <p>{lang === "de" ? "Globe koppelt Route-Fokus, Auftragsliste und Hangar-Market. Klick auf Route zoomt rein. Klick auf Airport oeffnet Kauf/Upgrade direkt im Globe." : "Globe now couples route focus, contract list and hangar market. Click route to zoom. Click airport to buy or upgrade directly from globe."}</p>
        </div>

        {filteredCompatibleContracts.length > 0 ? (
          <>
            <h2 className="mb-2 text-sm font-mono uppercase tracking-[0.18em] text-cyan-200">{lang === "de" ? "Kompatible Vertraege" : "Compatible Contracts"} ({filteredCompatibleContracts.length})</h2>
            <motion.div layout className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              <AnimatePresence>
                {filteredCompatibleContracts.map((contract) => (
                  <ContractCard key={contract.id} contract={contract} onAccept={(selected) => acceptContractMutation.mutate(selected)} onView={(selected) => navigate(createPageUrl(`ContractDetails?id=${selected.id}`))} onSelect={(selected) => setSelectedContractId(selected.id)} selected={contract.id === selectedContractId} isAccepting={acceptContractMutation.isPending} />
                ))}
              </AnimatePresence>
            </motion.div>

            {visibleIncompatibleContracts.length > 0 && (
              <>
                <h2 className="mb-2 text-sm font-mono uppercase tracking-[0.18em] text-amber-200">{lang === "de" ? "Inkompatibel" : "Incompatible"} ({visibleIncompatibleContracts.length})</h2>
                <motion.div layout className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  <AnimatePresence>
                    {visibleIncompatibleContracts.map((contract) => (
                      <div key={contract.id} className="relative">
                        <ContractCard contract={contract} onView={(selected) => navigate(createPageUrl(`ContractDetails?id=${selected.id}`))} onSelect={(selected) => setSelectedContractId(selected.id)} selected={contract.id === selectedContractId} isAccepting={false} disabled />
                        <div className="pointer-events-none absolute inset-0 flex items-end rounded-xl border border-amber-700/40 bg-slate-950/65 p-2.5">
                          <p className="text-[11px] font-mono text-amber-200">{getCompatibilityReason(contract, selectedAircraft, lang)}</p>
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
            <h3 className="mb-2 text-lg font-semibold text-slate-100">{lang === "de" ? "Keine passenden Contracts" : "No matching contracts"}</h3>
            <p className="mx-auto mb-5 max-w-xl text-sm text-slate-400">{lang === "de" ? "Passe Departure, Suche oder Distanzfilter an und generiere anschliessend neue Auftraege." : "Adjust departure, search, or distance filter and generate new contracts."}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" variant="outline" onClick={() => { setSearchTerm(""); setMinNm(""); setMaxNm(""); setActiveTab("all"); setSelectedDepartureAirport("all"); }} className="border-slate-700 bg-slate-900 text-xs font-mono uppercase text-slate-200">{lang === "de" ? "Filter reset" : "Reset filters"}</Button>
              <Button type="button" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="bg-cyan-600 text-xs font-mono uppercase text-slate-950 hover:bg-cyan-500">
                {generateMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                {lang === "de" ? "Contracts erzeugen" : "Generate contracts"}
              </Button>
            </div>
          </Card>
        )}
      </div>

      {selectedContract && (
        <div className="rounded-xl border border-cyan-900/40 bg-slate-950/80 p-2.5 text-xs font-mono text-cyan-100">
          <span className="text-cyan-300">{lang === "de" ? "Aktiver Globe-Fokus:" : "Active globe focus:"}</span>{" "}
          {selectedContract.departure_airport} -> {selectedContract.arrival_airport} ({Math.round(selectedContract.distance_nm || 0)} NM)
        </div>
      )}
    </div>
  );
}
