import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getAirportCoords } from "@/utils/airportCoordinates";
import {
  Plane,
  PlaneTakeoff,
  PlaneLanding,
  MapPin,
  Clock,
  Fuel,
  Gauge,
  ArrowUp,
  Star,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Activity,
} from "lucide-react";

import FlightRating from "@/components/flights/FlightRating";
import FlightMapIframe from "@/components/flights/FlightMapIframe";
import FuelPrediction from "@/components/flights/FuelPrediction";
import TakeoffLandingCalculator from "@/components/flights/TakeoffLandingCalculator";
import SimBriefImport from "@/components/flights/SimBriefImport";
import WeatherDisplay from "@/components/flights/WeatherDisplay";
import { generatePassengerComments } from "@/components/flights/generatePassengerComments";
import { calculateDeadlineMinutes } from "@/components/flights/aircraftSpeedLookup";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function FlightTracker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();

  const [flightPhase, setFlightPhase] = useState('preflight');
  const [viewMode, setViewMode] = useState('fplan');
  const [flight, setFlight] = useState(null);
  const [flightStartTime, setFlightStartTime] = useState(null);
  const [flightDurationSeconds, setFlightDurationSeconds] = useState(0);
  const [processedGLevels, setProcessedGLevels] = useState(new Set());
  const [isCompletingFlight, setIsCompletingFlight] = useState(false);
  const [showAutoCompleteOverlay, setShowAutoCompleteOverlay] = useState(false);
  const [flightStartedAt, setFlightStartedAt] = useState(null);
  const [emergencyLanding, setEmergencyLanding] = useState(false);
  const flightDataRef = React.useRef(null);
  const autoCompleteTimeoutRef = useRef(null);

  const urlParams = new URLSearchParams(window.location.search);
  const contractIdFromUrl = urlParams.get('contractId');

  const [flightData, setFlightData] = useState({
    altitude: 0, speed: 0, verticalSpeed: 0, heading: 0,
    fuel: 100, fuelKg: 0, gForce: 1.0, maxGForce: 1.0,
    landingGForce: 0, landingVs: 0, landingType: null,
    landingScoreChange: 0, landingMaintenanceCost: 0, landingBonus: 0,
    flightScore: 100, maintenanceCost: 0, reputation: 'EXCELLENT',
    latitude: 0, longitude: 0,
    events: {
      tailstrike: false, stall: false, overstress: false, overspeed: false,
      flaps_overspeed: false, fuel_emergency: false, gear_up_landing: false,
      crash: false, harsh_controls: false, high_g_force: false, hard_landing: false, wrong_airport: false
    },
    maxControlInput: 0, departure_lat: 0, departure_lon: 0,
    arrival_lat: 0, arrival_lon: 0, wasAirborne: false, previousSpeed: 0
  });

  const { data: contract } = useQuery({
    queryKey: ['contract', contractIdFromUrl],
    queryFn: async () => {
      if (!contractIdFromUrl) return null;
      const contracts = await base44.entities.Contract.filter({ id: contractIdFromUrl });
      return contracts[0];
    },
    enabled: !!contractIdFromUrl,
    staleTime: 300000, // Contract doesn't change during flight
  });

  // Load existing flight if any
  const { data: existingFlight } = useQuery({
    queryKey: ['active-flight', contractIdFromUrl],
    queryFn: async () => {
      if (!contractIdFromUrl) return null;
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      let companyId = cid;
      if (!companyId) {
        const companies = await base44.entities.Company.filter({ created_by: user.email });
        companyId = companies[0]?.id;
      }
      if (!companyId) return null;
      const flights = await base44.entities.Flight.filter({ 
        company_id: companyId,
        contract_id: contractIdFromUrl,
        status: 'in_flight'
      });
      return flights[0] || null;
    },
    enabled: !!contractIdFromUrl,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Derive the active flight ID - either from state (after startFlight) or from existingFlight query
  // This avoids the async state update delay problem
  const activeFlightId = flight?.id || existingFlight?.id;

  // Live data - real-time subscription for instant updates from backend
  const [xplaneLog, setXplaneLog] = useState(null);
  const lastXplaneTimestampRef = React.useRef(null);
  const [dataLatency, setDataLatency] = useState(null); // ms between two received updates
  const [dataAge, setDataAge] = useState(null); // ms since last data received (live ticker)
  const lastDataReceivedRef = React.useRef(null);
  const [localMapPath, setLocalMapPath] = useState([]);
  const ingestLiveXplaneData = React.useCallback((xpData, sourceDate) => {
    if (!xpData) return;
    const ts = xpData.timestamp || sourceDate;
    const prevTs = lastXplaneTimestampRef.current;
    if (ts && prevTs && ts === prevTs) return;

    const nextMs = Date.parse(ts || '');
    const prevMs = Date.parse(prevTs || '');
    // Ignore stale packets so slower channels cannot overwrite fresher telemetry.
    if (Number.isFinite(nextMs) && Number.isFinite(prevMs) && nextMs <= prevMs) return;

    lastXplaneTimestampRef.current = ts || prevTs || new Date().toISOString();
    const now = Date.now();
    if (lastDataReceivedRef.current) {
      setDataLatency(now - lastDataReceivedRef.current);
    }
    lastDataReceivedRef.current = now;
    setXplaneLog({ raw_data: xpData, created_date: sourceDate || ts || new Date().toISOString() });
  }, []);
  
  // Live ticker: shows how long ago the last data arrived (updates every 200ms)
  useEffect(() => {
    if (flightPhase === 'completed') return;
    const ticker = setInterval(() => {
      if (lastDataReceivedRef.current) {
        setDataAge(Date.now() - lastDataReceivedRef.current);
      }
    }, 100);
    return () => clearInterval(ticker);
  }, [flightPhase]);

  // Initial fetch to get current flight data immediately
  useEffect(() => {
    if (flightPhase === 'completed') return;
    if (!activeFlightId) return;
    
    const fetchInitial = async () => {
      const flights = await base44.entities.Flight.filter({ id: activeFlightId });
      const currentFlight = flights[0];
      if (currentFlight?.xplane_data) {
        ingestLiveXplaneData(currentFlight.xplane_data, currentFlight.updated_date);
      }
    };
    fetchInitial();
  }, [activeFlightId, flightPhase, ingestLiveXplaneData]);

  useEffect(() => {
    setLocalMapPath([]);
  }, [activeFlightId]);

  useEffect(() => {
    const xp = xplaneLog?.raw_data;
    if (!xp) return;
    const lat = Number(xp.latitude);
    const lon = Number(xp.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (Math.abs(lat) < 0.5 && Math.abs(lon) < 0.5)) return;
    setLocalMapPath((prev) => {
      const last = prev.length > 0 ? prev[prev.length - 1] : null;
      const threshold = xp.on_ground ? 0.0002 : 0.0008;
      if (last && Math.abs(last[0] - lat) < threshold && Math.abs(last[1] - lon) < threshold) {
        return prev;
      }
      const next = [...prev, [lat, lon]];
      return next.length > 2600 ? next.slice(-2600) : next;
    });
  }, [xplaneLog?.raw_data?.latitude, xplaneLog?.raw_data?.longitude, xplaneLog?.raw_data?.on_ground]);

  // Real-time subscription – receives updates instantly when backend writes new xplane_data
  useEffect(() => {
    if (flightPhase === 'completed') return;
    if (!activeFlightId) return;
    
    let lastSubEventTime = 0;
    
    // Setup subscription with automatic reconnect
    let unsubscribe = null;
    const setupSubscription = () => {
      if (unsubscribe) {
        try { unsubscribe(); } catch (_) {}
      }
      unsubscribe = base44.entities.Flight.subscribe((event) => {
        if (event.type === 'update' && event.id === activeFlightId && event.data?.xplane_data) {
          lastSubEventTime = Date.now();
          ingestLiveXplaneData(event.data.xplane_data, event.data.updated_date);
        }
      });
    };
    
    setupSubscription();
    
    // Monitor subscription health: if no events for >3s despite active flight, reconnect quickly
    const healthCheck = setInterval(() => {
      if (lastSubEventTime > 0 && (Date.now() - lastSubEventTime) > 3000) {
        setupSubscription();
      }
    }, 2000);
    
    // Polling fallback: polls at 1.0s but only when subscription isn't delivering
    let pollInFlight = false;
    const pollInterval = setInterval(async () => {
      if (pollInFlight) return;
      // Skip poll if subscription delivered very recently (< 0.9s)
      if (lastDataReceivedRef.current && (Date.now() - lastDataReceivedRef.current) < 900) return;
      pollInFlight = true;
      try {
        const flights = await base44.entities.Flight.filter({ id: activeFlightId });
        const f = flights[0];
        if (f?.xplane_data) {
          ingestLiveXplaneData(f.xplane_data, f.updated_date);
        }
      } catch (_) {}
      pollInFlight = false;
    }, 1500);
    
    return () => {
      if (unsubscribe) try { unsubscribe(); } catch (_) {}
      clearInterval(pollInterval);
      clearInterval(healthCheck);
    };
  }, [activeFlightId, flightPhase, ingestLiveXplaneData]);

  // Restore flight data and phase from existing flight
  useEffect(() => {
    if (existingFlight && !flight) {
      setFlight(existingFlight);
      setFlightPhase('takeoff');
      // DO NOT set flightStartedAt here - we WANT to process the existing xplane_data on the Flight record
      // The timestamp filter was incorrectly blocking ALL existing data
      setFlightStartedAt(null);
      setIsCompletingFlight(false);
      // Reset flightData komplett für sauberen Start
      const cleanData = {
        altitude: 0, speed: 0, verticalSpeed: 0, heading: 0,
        fuel: 100, fuelKg: 0, gForce: 1.0, maxGForce: 1.0,
        landingGForce: 0, landingVs: 0, landingScoreChange: 0,
        landingMaintenanceCost: 0, landingBonus: 0, flightScore: 100,
        maintenanceCost: 0, reputation: 'EXCELLENT', latitude: 0, longitude: 0,
        events: {
          tailstrike: false, stall: false, overstress: false, overspeed: false,
          flaps_overspeed: false, fuel_emergency: false, gear_up_landing: false,
          crash: false, harsh_controls: false, high_g_force: false, hard_landing: false, wrong_airport: false
        },
        maxControlInput: 0, departure_lat: 0, departure_lon: 0,
        arrival_lat: 0, arrival_lon: 0, wasAirborne: false, previousSpeed: 0, landingType: null
      };
      setFlightData(cleanData);
      flightDataRef.current = cleanData;
    }
  }, [existingFlight, flight]);

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      if (cid) {
        const companies = await base44.entities.Company.filter({ id: cid });
        if (companies[0]) return companies[0];
      }
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      return companies[0];
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Faster live source: consume XPlaneLog stream directly (written every ~2s),
  // so UI does not wait for slower Flight record propagation.
  useEffect(() => {
    if (flightPhase === 'completed') return;
    if (!company?.id || !activeFlightId) return;
    const activeFl = flight || existingFlight;
    const sessionStartMs = Date.parse(String(activeFl?.departure_time || activeFl?.created_date || ""));

    const matchesActiveSession = (logEntry) => {
      const raw = logEntry?.raw_data || {};
      const logFlightId = raw?.flight_id || null;
      const logContractId = raw?.contract_id || null;

      if (logFlightId) {
        return String(logFlightId) === String(activeFlightId);
      }
      if (logContractId && contractIdFromUrl) {
        return String(logContractId) === String(contractIdFromUrl);
      }
      // Backward compatibility for older logs without IDs:
      // only accept logs from this flight session time window.
      const logTsMs = Date.parse(String(
        raw?.airborne_started_at ||
        raw?.completion_armed_at ||
        raw?.timestamp ||
        logEntry?.created_date ||
        ""
      ));
      if (Number.isFinite(sessionStartMs) && Number.isFinite(logTsMs)) {
        return logTsMs >= (sessionStartMs - 15000);
      }
      return false;
    };

    const applyLog = (logEntry) => {
      if (!logEntry?.raw_data) return;
      if (!matchesActiveSession(logEntry)) return;
      ingestLiveXplaneData(logEntry.raw_data, logEntry.created_date || logEntry.updated_date);
    };

    let unsub = null;
    let pollInFlight = false;

    const prime = async () => {
      try {
        const logs = await base44.entities.XPlaneLog.filter(
          { company_id: company.id, has_active_flight: true },
          '-created_date',
          10
        );
        const boundLog = logs.find(matchesActiveSession);
        if (boundLog) applyLog(boundLog);
      } catch (_) {}
    };
    prime();

    unsub = base44.entities.XPlaneLog.subscribe((event) => {
      if (event.type !== 'create' && event.type !== 'update') return;
      if (event.data?.company_id !== company.id) return;
      if (!event.data?.has_active_flight) return;
      applyLog(event.data);
    });

    const poll = setInterval(async () => {
      if (pollInFlight) return;
      if (lastDataReceivedRef.current && (Date.now() - lastDataReceivedRef.current) < 1200) return;
      pollInFlight = true;
      try {
        const logs = await base44.entities.XPlaneLog.filter(
          { company_id: company.id, has_active_flight: true },
          '-created_date',
          10
        );
        const boundLog = logs.find(matchesActiveSession);
        if (boundLog) applyLog(boundLog);
      } catch (_) {}
      pollInFlight = false;
    }, 1000);

    return () => {
      if (unsub) {
        try { unsub(); } catch (_) {}
      }
      clearInterval(poll);
    };
  }, [company?.id, activeFlightId, contractIdFromUrl, flightPhase, ingestLiveXplaneData, flight, existingFlight]);

  const { data: aircraft } = useQuery({
    queryKey: ['aircraft'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      let companyId = cid;
      if (!companyId) {
        const companies = await base44.entities.Company.filter({ created_by: user.email });
        companyId = companies[0]?.id;
      }
      if (!companyId) return [];
      return await base44.entities.Aircraft.filter({ company_id: companyId });
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: settings } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const allSettings = await base44.entities.GameSettings.list();
      return allSettings[0] || null;
    },
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  // Find the assigned aircraft for this flight
  const assignedAircraft = aircraft?.find(a => a.id === (flight?.aircraft_id || existingFlight?.aircraft_id));

  // SimBrief route data - reset when contractId changes
  const [simbriefRoute, setSimbriefRoute] = useState(null);
  const prevContractIdRef = React.useRef(contractIdFromUrl);
  useEffect(() => {
    if (contractIdFromUrl !== prevContractIdRef.current) {
      prevContractIdRef.current = contractIdFromUrl;
      setSimbriefRoute(null);
      setXplaneLog(null);
    }
  }, [contractIdFromUrl]);

  const pickFirstValidLatLon = (pairs = []) => {
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const lat = Number(pair[0]);
      const lon = Number(pair[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lat === 0 && lon === 0) continue;
      return { lat, lon, valid: true };
    }
    return { lat: 0, lon: 0, valid: false };
  };

  const startFlightMutation = useMutation({
    mutationFn: async () => {
      // Verwende den existierenden Flight oder erstelle einen neuen (sollte nicht passieren)
      if (existingFlight) {
        return existingFlight;
      }
      
      // Fallback: Sollte nicht verwendet werden, da Flights in ActiveFlights erstellt werden
      const newFlight = await base44.entities.Flight.create({
        company_id: company.id,
        contract_id: contractIdFromUrl,
        status: 'in_flight',
        departure_time: new Date().toISOString()
      });
      
      return newFlight;
    },
    onSuccess: (flightResult) => {
      setFlight(flightResult);
      setFlightPhase('takeoff');
      // flightStartTime wird NICHT hier gesetzt, sondern erst beim Abheben
      setFlightStartTime(null);
      setFlightDurationSeconds(0);
      setProcessedGLevels(new Set());
      setIsCompletingFlight(false);
      setShowAutoCompleteOverlay(false);
      // Merke Zeitpunkt des Flugstarts, um alte X-Plane Logs zu ignorieren
      setFlightStartedAt(Date.now());
      
      // Reset flight data for new flight - komplett sauber
      const cleanData = {
        altitude: 0,
        speed: 0,
        verticalSpeed: 0,
        heading: 0,
        fuel: 100,
        fuelKg: 0,
        gForce: 1.0,
        maxGForce: 1.0,
        landingGForce: 0,
        landingVs: 0,
        landingScoreChange: 0,
        landingMaintenanceCost: 0,
        landingBonus: 0,
        flightScore: 100,
        maintenanceCost: 0,
        reputation: 'EXCELLENT',
        latitude: 0,
        longitude: 0,
        events: {
          tailstrike: false,
          stall: false,
          overstress: false,
          overspeed: false,
          flaps_overspeed: false, fuel_emergency: false, gear_up_landing: false,
          crash: false, harsh_controls: false, high_g_force: false, hard_landing: false, wrong_airport: false
        },
        maxControlInput: 0,
        departure_lat: 0,
        departure_lon: 0,
        arrival_lat: 0,
        arrival_lon: 0,
        wasAirborne: false,
        previousSpeed: 0,
        landingType: null
      };
      setFlightData(cleanData);
      flightDataRef.current = cleanData;
      
      queryClient.invalidateQueries();
    }
  });

  const cancelFlightMutation = useMutation({
    mutationFn: async () => {
      // Calculate cancellation penalty
      const penalty = contract?.payout ? contract.payout * 0.3 : 5000;
      
      // Update flight status
      if (flight) {
        await base44.entities.Flight.update(flight.id, {
          status: 'cancelled'
        });
      }
      
      // Update contract status
      await base44.entities.Contract.update(contractIdFromUrl, {
        status: 'failed'
      });
      
      // Deduct penalty from company balance
      if (company) {
        await base44.entities.Company.update(company.id, {
          balance: (company.balance || 0) - penalty,
          reputation: Math.max(0, (company.reputation || 50) - 5)
        });
      }
      
      // Create transaction record
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'other',
        amount: penalty,
        description: `Stornierungsgebühr: ${contract?.title}`,
        reference_id: contractIdFromUrl,
        date: new Date().toISOString()
      });
      
      // Free up aircraft and crew
      if (flight?.aircraft_id) {
        await base44.entities.Aircraft.update(flight.aircraft_id, {
          status: 'available'
        });
      }
      
      if (flight?.crew) {
        for (const member of flight.crew) {
          await base44.entities.Employee.update(member.employee_id, {
            status: 'available'
          });
        }
      }
      
      return { penalty };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      navigate(createPageUrl("ActiveFlights"));
    }
  });

  const triggerEngineFailureMutation = useMutation({
    mutationFn: async () => {
      const activeFlight = flight || existingFlight;
      if (!activeFlight?.id) throw new Error('No active flight for failure test');

      const freshFlights = await base44.entities.Flight.filter({ id: activeFlight.id });
      const freshFlight = freshFlights?.[0] || activeFlight;
      const currentDamage = (freshFlight?.maintenance_damage && typeof freshFlight.maintenance_damage === 'object')
        ? freshFlight.maintenance_damage
        : {};
      const currentFailures = Array.isArray(freshFlight?.active_failures) ? freshFlight.active_failures : [];
      const currentBridgeCommands = Array.isArray(freshFlight?.bridge_command_queue) ? freshFlight.bridge_command_queue : [];
      const nowIso = new Date().toISOString();

      const nextDamage = {
        ...currentDamage,
        engine: 100,
      };

      const alreadyExists = currentFailures.some((f) => f?.source === 'manual_engine_failure_test');
      const nextFailures = alreadyExists
        ? currentFailures
        : [
            ...currentFailures,
            {
              name: lang === 'de' ? 'Triebwerksausfall (Test)' : 'Engine failure (test)',
              category: 'engine',
              severity: 'schwer',
              source: 'manual_engine_failure_test',
              timestamp: nowIso,
            },
          ];

      const currentXpd = freshFlight?.xplane_data || {};
      const currentEventsLog = Array.isArray(currentXpd.flight_events_log) ? currentXpd.flight_events_log : [];
      const currentBridgeLog = Array.isArray(currentXpd.bridge_event_log) ? currentXpd.bridge_event_log : [];
      const eventPayload = {
        type: 'engine_failure_test',
        category: 'failure',
        severity: 'severe',
        timestamp: nowIso,
        label: lang === 'de' ? 'Triebwerksausfall Test ausgelost' : 'Engine failure test triggered',
      };
      const nextFlightEventsLog = [...currentEventsLog, eventPayload].slice(-800);
      const nextBridgeEventLog = [...currentBridgeLog, eventPayload].slice(-800);
      const failureCommand = {
        id: `cmd-engine-fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'engine_failure_test',
        simulator: 'msfs',
        created_at: nowIso,
        source: 'flight_tracker_manual_test',
      };
      const nextBridgeCommands = [...currentBridgeCommands, failureCommand].slice(-25);

      await base44.entities.Flight.update(activeFlight.id, {
        maintenance_damage: nextDamage,
        active_failures: nextFailures,
        bridge_command_queue: nextBridgeCommands,
        xplane_data: {
          ...currentXpd,
          flight_events_log: nextFlightEventsLog,
          bridge_event_log: nextBridgeEventLog,
          manual_engine_failure_test: true,
        },
      });

      return { nextDamage, nextFailures, nextFlightEventsLog, nextBridgeEventLog, nextBridgeCommands };
    },
    onSuccess: ({ nextDamage, nextFailures, nextFlightEventsLog, nextBridgeEventLog, nextBridgeCommands }) => {
      setFlight((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          maintenance_damage: nextDamage,
          active_failures: nextFailures,
          bridge_command_queue: nextBridgeCommands,
          xplane_data: {
            ...(prev.xplane_data || {}),
            flight_events_log: nextFlightEventsLog,
            bridge_event_log: nextBridgeEventLog,
            manual_engine_failure_test: true,
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: ['active-flight', contractIdFromUrl] });
    },
  });

  const completeFlightMutation = useMutation({
   mutationFn: async () => {
     // Verhindere mehrfache Ausführung
     if (isCompletingFlight) {
       console.log('⚠️ FLUG WIRD BEREITS ABGESCHLOSSEN - ABBRUCH');
       return null;
     }
     console.log('🚀 STARTE FLUGABSCHLUSS');
     setIsCompletingFlight(true);
     
     // Use flight from state OR existingFlight from query
     const activeFlight = flight || existingFlight;
     if (!activeFlight) {
       throw new Error('Flugdaten nicht geladen');
     }
     if (!aircraft || aircraft.length === 0) {
       throw new Error('Flugzeugdaten nicht geladen');
     }

     // Pull latest flight snapshot first so completion uses freshest touchdown values.
     let latestFlight = activeFlight;
     try {
       const latestFlights = await base44.entities.Flight.filter({ id: activeFlight.id });
       if (latestFlights?.[0]) latestFlight = latestFlights[0];
     } catch (_) {
       // no-op: fallback to current activeFlight snapshot
     }
     
     // Use the latest flightData from ref to ensure all events are captured
     let finalFlightData = flightDataRef.current || flightData;
     
     // KRITISCH: Wenn Crash erkannt wurde (egal ob im State oder via has_crashed), 
     // stelle sicher dass das crash-Event gesetzt ist
    if (finalFlightData.events && !finalFlightData.events.crash) {
     const latestXPlane = latestFlight?.xplane_data || activeFlight?.xplane_data;
      const trustedCrash = !!latestXPlane?.crash;
      if (trustedCrash) {
        finalFlightData = {
          ...finalFlightData,
          events: { ...finalFlightData.events, crash: true }
        };
      }
    }
     
     // Realistic cost calculations based on aviation industry
     // Use actual X-Plane fuel data: initial_fuel_kg - current fuel_kg
     const liveData = xplaneLog?.raw_data || {};
     const nonZeroNumber = (...values) => {
       for (const value of values) {
         const num = Number(value);
         if (Number.isFinite(num) && Math.abs(num) > 0) return num;
       }
       return 0;
     };
     const positiveNumber = (...values) => {
       for (const value of values) {
         const num = Number(value);
         if (Number.isFinite(num) && num > 0) return num;
       }
       return 0;
     };
     let xpData = latestFlight?.xplane_data || activeFlight?.xplane_data || {};
     const hasAnyTouchdownValues = (packet = {}) => {
       const vs = nonZeroNumber(packet.touchdown_vspeed);
       const g = positiveNumber(packet.landing_g_force, packet.landingGForce);
       return Math.abs(vs) > 0 || g > 0;
     };
     const localHasTouchdownValues = Math.abs(nonZeroNumber(finalFlightData.landingVs, finalFlightData.landing_vs)) > 0
       || positiveNumber(finalFlightData.landingGForce, finalFlightData.landing_g_force) > 0;
     const shouldWaitForTouchdownData =
       !localHasTouchdownValues &&
       !hasAnyTouchdownValues(xpData) &&
       !!(finalFlightData.wasAirborne || xpData.was_airborne || liveData.was_airborne) &&
       !!(xpData.on_ground || liveData.on_ground);
     if (shouldWaitForTouchdownData) {
       for (let attempt = 0; attempt < 6; attempt++) {
         try {
           const polledFlights = await base44.entities.Flight.filter({ id: activeFlight.id });
           if (polledFlights?.[0]) {
             latestFlight = polledFlights[0];
             xpData = latestFlight?.xplane_data || xpData;
             if (hasAnyTouchdownValues(xpData)) {
               break;
             }
           }
         } catch (_) {
           // continue waiting with current snapshot
         }
         if (attempt < 5) {
           await new Promise((resolve) => setTimeout(resolve, 700));
         }
       }
     }
    const landingDataTrusted = !!(
      xpData.touchdown_detected ||
      xpData.landing_data_locked ||
      xpData.bridge_local_landing_locked ||
      xpData.landing_data_source === 'bridge_local' ||
      liveData.touchdown_detected ||
      liveData.landing_data_locked ||
      liveData.bridge_local_landing_locked ||
      liveData.landing_data_source === 'bridge_local'
    );
    const resolvedLandingVs = nonZeroNumber(
      ...(landingDataTrusted ? [
        xpData.touchdown_vspeed,
        liveData.touchdown_vspeed,
      ] : []),
      finalFlightData.landingVs,
      finalFlightData.landing_vs
    );
    const resolvedLandingG = positiveNumber(
      ...(landingDataTrusted ? [
        xpData.landing_g_force,
        xpData.landingGForce,
        liveData.landing_g_force,
        liveData.landingGForce,
      ] : []),
      finalFlightData.landingGForce,
      finalFlightData.landing_g_force
    );
     finalFlightData = {
       ...finalFlightData,
       landingVs: Math.max(0, Math.min(2500, Math.abs(Number(resolvedLandingVs || finalFlightData.landingVs || 0)))),
       landingGForce: Math.max(0, Math.min(6, Number(resolvedLandingG || finalFlightData.landingGForce || 0))),
     };
     const initialFuelKg = positiveNumber(
       xpData.initial_fuel_kg,
       liveData.initial_fuel_kg
     );
     let currentFuelKg = positiveNumber(
       finalFlightData.fuelKg,
       liveData.fuel_kg,
       liveData.last_valid_fuel_kg,
       xpData.fuel_kg,
       xpData.last_valid_fuel_kg
     );
     const fuelPct = Math.max(
       0,
       Math.min(100, Number(nonZeroNumber(finalFlightData.fuel, liveData.fuel_percentage, xpData.fuel_percentage) || 0))
     );
     const pctDerivedFuelKg = (initialFuelKg > 0 && fuelPct > 0)
       ? ((initialFuelKg * fuelPct) / 100)
       : 0;
     if (initialFuelKg > 0 && pctDerivedFuelKg > 0) {
       if (currentFuelKg <= 0) {
         currentFuelKg = pctDerivedFuelKg;
       } else {
         const maxDriftKg = initialFuelKg * 0.55;
         if (Math.abs(currentFuelKg - pctDerivedFuelKg) > maxDriftKg) {
           currentFuelKg = pctDerivedFuelKg;
         }
       }
     }
     if (initialFuelKg > 0) {
       currentFuelKg = Math.min(currentFuelKg, initialFuelKg);
     }
     const fuelUsedKg = Math.max(0, initialFuelKg - currentFuelKg);
     const fuelUsed = fuelUsedKg * 1.25; // kg -> liters (Jet-A density ~0.8 kg/L, so 1kg ≈ 1.25L)
     const fuelCostPerLiter = 1.2; // $1.20 per liter for Jet-A fuel
     const fuelCost = fuelUsed * fuelCostPerLiter;

     // Flight hours: Use real-world time from flightStartTime, or departure_time from flight record
     let flightHours;
     if (flightStartTime) {
       const realFlightSeconds = (Date.now() - flightStartTime) / 1000;
       flightHours = realFlightSeconds / 3600; // Convert to hours
     } else if (activeFlight.departure_time) {
       const realFlightSeconds = (Date.now() - new Date(activeFlight.departure_time).getTime()) / 1000;
       flightHours = Math.max(0.01, realFlightSeconds / 3600);
     } else {
       flightHours = contract?.distance_nm ? contract.distance_nm / 450 : 2; // Fallback: Average cruise speed 450 knots
     }

     // Time efficiency bonus/penalty based on contract deadline
     // Dynamic deadline: use X-Plane aircraft ICAO if available, fallback to fleet aircraft type
     const xplaneIcao = xpData.aircraft_icao || activeFlight?.xplane_data?.aircraft_icao || null;
     const fleetType = assignedAircraft?.type || null;
     const deadlineMinutes = (contract?.distance_nm)
       ? calculateDeadlineMinutes(contract.distance_nm, xplaneIcao, fleetType)
       : (contract?.deadline_minutes || 120);
     const deadlineHours = deadlineMinutes / 60;
     let timeBonus = 0;
     let timeScoreChange = 0;
     // 3-tier deadline: on time = +20, buffer (up to 5 min over) = 0, over buffer = -20
     const bufferHours = 5 / 60; // 5 minutes buffer
     const madeDeadline = flightHours <= deadlineHours;
     const inBuffer = !madeDeadline && flightHours <= (deadlineHours + bufferHours);
     const overBuffer = flightHours > (deadlineHours + bufferHours);

     if (madeDeadline) {
       timeScoreChange = 20; // +20 score for making the deadline
     } else if (inBuffer) {
       timeScoreChange = 0; // Within 5-min buffer: no bonus, no penalty
     } else {
       timeScoreChange = -20; // Over buffer: -20 score
     }

     const crewCostPerHour = 250; // $250 per flight hour (captain + first officer)
     const crewCost = flightHours * crewCostPerHour;

     // Maintenance cost per flight hour + event-based costs
     const maintenanceCostPerHour = 400; // $400 per flight hour
     const maintenanceCost = (flightHours * maintenanceCostPerHour) + finalFlightData.maintenanceCost;

     // Landing and airport fees
     const airportFee = 150;

     // Check for crash or off-airport landing (>=10 NM from arrival airport)
      const backendCrashAtCompletion = !!(xpData.simconnect_crash_event || xpData.simconnectCrashEvent);
      const hasCrashed = backendCrashAtCompletion;
      if (finalFlightData.events?.crash !== hasCrashed) {
        finalFlightData = {
          ...finalFlightData,
          events: { ...(finalFlightData.events || {}), crash: hasCrashed }
        };
      }
      const simbriefArrival = xpData.simbrief_arrival_coords || simbriefRoute?.arrival_coords || null;
      const contractArrival = getAirportCoords(contract?.arrival_airport);
      const lastPathPoint = Array.isArray(xpData.flight_path) && xpData.flight_path.length > 0
        ? xpData.flight_path[xpData.flight_path.length - 1]
        : null;
      const arrivalPos = pickFirstValidLatLon([
        [finalFlightData.arrival_lat, finalFlightData.arrival_lon],
        [xpData.arrival_lat, xpData.arrival_lon],
        [simbriefArrival?.lat, simbriefArrival?.lon],
        [simbriefArrival?.latitude, simbriefArrival?.longitude],
        [contractArrival?.lat, contractArrival?.lon],
      ]);
      const currentPos = pickFirstValidLatLon([
        [finalFlightData.latitude, finalFlightData.longitude],
        [xpData.latitude, xpData.longitude],
        [Array.isArray(lastPathPoint) ? lastPathPoint[0] : null, Array.isArray(lastPathPoint) ? lastPathPoint[1] : null],
      ]);
      const arrivalLat = arrivalPos.lat;
      const arrivalLon = arrivalPos.lon;
      const currentLat = currentPos.lat;
      const currentLon = currentPos.lon;
      const hasArrivalCoords = arrivalPos.valid;
      const hasCurrentCoords = currentPos.valid;
      const arrivalDistanceNm = (hasArrivalCoords && hasCurrentCoords)
        ? calculateHaversineDistance(currentLat, currentLon, arrivalLat, arrivalLon)
        : 0;
      const landedTooFarFromArrival = (hasArrivalCoords && hasCurrentCoords) && arrivalDistanceNm >= 10;
      const emergencyOffAirportCompletion = landedTooFarFromArrival && !!emergencyLanding && !hasCrashed;
      const wrongAirport = !!(finalFlightData.events.wrong_airport || (landedTooFarFromArrival && !emergencyLanding));
      if (wrongAirport && !finalFlightData.events.wrong_airport) {
        finalFlightData = {
          ...finalFlightData,
          events: { ...finalFlightData.events, wrong_airport: true }
        };
      }
      const emergencyScorePenalty = emergencyOffAirportCompletion ? 30 : 0;

     // Bei Crash: KEIN Payout und KEIN Bonus
     let revenue = 0;
     let landingBonusUsed = 0;
     let landingPenaltyUsed = 0;
     // Calculate crew bonus based on attributes
     let crewBonusAmount = 0;
     if (!hasCrashed && !wrongAirport) {
       if (emergencyOffAirportCompletion) {
         revenue = Math.round((contract?.payout || 0) * 0.30);
       } else {
       const activeFl = flight || existingFlight;
       if (activeFl?.crew && Array.isArray(activeFl.crew)) {
         // Fetch crew member details for attribute bonuses
         for (const member of activeFl.crew) {
           const emps = await base44.entities.Employee.filter({ id: member.employee_id });
           const emp = emps[0];
           if (emp?.attributes) {
             const passengerHandling = emp.attributes.passenger_handling || 50;
             const efficiency = emp.attributes.efficiency || 50;
             // Each crew member adds up to 2% of payout per attribute above 50
             const handlingBonus = ((passengerHandling - 50) / 50) * 0.02 * (contract?.payout || 0);
             const efficiencyBonus = ((efficiency - 50) / 50) * 0.01 * (contract?.payout || 0);
             crewBonusAmount += Math.max(0, handlingBonus + efficiencyBonus);
           }
         }
       }
       crewBonusAmount = Math.round(crewBonusAmount);

       revenue = contract?.payout || 0;
       // Bonus/Penalty based on landing quality (G-force based)
       const landingBonus = finalFlightData.landingBonus || 0;
       const landingMaintenanceCost = finalFlightData.landingMaintenanceCost || 0;
       if (landingBonus > 0) {
         landingBonusUsed = landingBonus;
         revenue += landingBonus;
       }
       if (landingMaintenanceCost > 0) {
         landingPenaltyUsed = landingMaintenanceCost;
         revenue -= landingMaintenanceCost;
       }
       // Add time bonus + crew bonus
       revenue += timeBonus + crewBonusAmount;
       }
     }

     // Only direct costs (fuel, crew, airport) - maintenance goes to accumulated_maintenance_cost
     const directCosts = fuelCost + crewCost + airportFee;
     const profit = revenue - directCosts;

            // Calculate level bonus (1% per level auf den Gewinn)
            const levelBonusPercent = (company?.level || 1) * 0.01; // 1% pro Level
            const levelBonus = profit > 0 ? profit * levelBonusPercent : 0;

            // Calculate depreciation based on flight hours
            const airplaneToUpdate = aircraft.find(a => a.id === activeFlight.aircraft_id);
            const newFlightHours = (airplaneToUpdate?.total_flight_hours || 0) + flightHours;
            const depreciationPerHour = airplaneToUpdate?.depreciation_rate || 0.001;
            const newAircraftValue = Math.max(0, (airplaneToUpdate?.current_value || airplaneToUpdate?.purchase_price || 0) - (depreciationPerHour * flightHours * airplaneToUpdate?.purchase_price || 0));
            
            // Crash: -100 Punkte einmalig + 70% des Neuwertes Wartungskosten
             let crashMaintenanceCost = 0;
             if (hasCrashed) {
               crashMaintenanceCost = (airplaneToUpdate?.purchase_price || 0) * 0.7;
             }

            // Apply time bonus/penalty to final score - use the LIVE score from flightData
            // Bei Crash: Score ist IMMER 0, egal was flightData sagt
            // WICHTIG: Prüfe ob der Landing-Score schon in flightScore enthalten ist.
            // Wenn landingScoreChange gesetzt ist aber der Score noch bei 100 steht (Race Condition),
            // dann addiere den Landing-Score hier explizit.
            let adjustedFlightScore = finalFlightData.flightScore;
            const landingScoreChange = finalFlightData.landingScoreChange || 0;
            
            // Detect if landing score was NOT yet applied to flightScore
            // If flightScore is exactly 100 and we have a landing score change, it wasn't applied yet
            // Also check: if landingType is set but flightScore doesn't reflect the change
            if (landingScoreChange !== 0 && !finalFlightData._landingScoreApplied) {
              // Check if score seems like it hasn't been adjusted for landing yet
              // Simple heuristic: if no events reduced the score and it's still 100, landing wasn't applied
              const hasOtherPenalties = finalFlightData.events.tailstrike || finalFlightData.events.stall || 
                finalFlightData.events.overstress || finalFlightData.events.overspeed || 
                finalFlightData.events.flaps_overspeed || finalFlightData.events.high_g_force;
              
              if (adjustedFlightScore === 100 && !hasOtherPenalties) {
                adjustedFlightScore = Math.max(0, Math.min(100, adjustedFlightScore + landingScoreChange));
                console.log('🔧 Landing score was not applied yet, adding:', landingScoreChange, '-> new score:', adjustedFlightScore);
              }
            }
            
            const scoreWithTime = (hasCrashed || wrongAirport)
              ? 0
              : Math.max(0, Math.min(100, adjustedFlightScore + timeScoreChange - emergencyScorePenalty));

            console.log('🎯 SCORE:', { adj: adjustedFlightScore, time: timeScoreChange, final: scoreWithTime, crash: hasCrashed });

            // Calculate ratings based on score for database (for compatibility)
            const scoreToRating = (s) => (s / 100) * 5;

            // Update flight record with events and final score
            const totalEventMaintenanceCost = finalFlightData.maintenanceCost;
            const totalMaintenanceCostWithCrash = totalEventMaintenanceCost + crashMaintenanceCost;

            console.log('🔍 SPEICHERE FINALE FLUGDATEN:', {
              finalScore: scoreWithTime,
              flightHours,
              timeScoreChange,
              timeBonus,
              events: finalFlightData.events,
              maintenanceCost: finalFlightData.maintenanceCost,
              crashMaintenanceCost,
              totalMaintenanceCostWithCrash
            });
            
            // Fetch LATEST xplane_data from DB (local state may be stale, missing current flight_path)
            let existingXpData = activeFlight?.xplane_data || {};
            const freshFlights = await base44.entities.Flight.filter({ id: activeFlight.id });
            if (freshFlights[0]?.xplane_data) {
              existingXpData = freshFlights[0].xplane_data;
              xpData = freshFlights[0].xplane_data;
            }
            const liveXpData = xplaneLog?.raw_data || {};
            const preservedFlightPath = xpData.flight_path || finalFlightData.flight_path || existingXpData.flight_path || liveXpData.flight_path || [];
            const preservedFlightEventsLog = xpData.flight_events_log || finalFlightData.flight_events_log || existingXpData.flight_events_log || liveXpData.flight_events_log || [];
            const preservedBridgeEventLog = xpData.bridge_event_log || finalFlightData.bridge_event_log || existingXpData.bridge_event_log || liveXpData.bridge_event_log || [];
            const preservedTelemetryHistory = xpData.telemetry_history || existingXpData.telemetry_history || liveXpData.telemetry_history || [];
            const preservedFmsWaypoints = xpData.fms_waypoints || existingXpData.fms_waypoints || liveXpData.fms_waypoints || [];
            const preservedSimbriefWaypoints = xpData.simbrief_waypoints || existingXpData.simbrief_waypoints || liveXpData.simbrief_waypoints || [];
            const preservedSimbriefRouteString = xpData.simbrief_route_string || existingXpData.simbrief_route_string || liveXpData.simbrief_route_string || null;
            const preservedSimbriefDepCoords = xpData.simbrief_departure_coords || existingXpData.simbrief_departure_coords || liveXpData.simbrief_departure_coords || null;
            const preservedSimbriefArrCoords = xpData.simbrief_arrival_coords || existingXpData.simbrief_arrival_coords || liveXpData.simbrief_arrival_coords || null;
            const existingLandingTrusted = !!(
              existingXpData.touchdown_detected ||
              existingXpData.landing_data_locked ||
              existingXpData.bridge_local_landing_locked ||
              existingXpData.landing_data_source === 'bridge_local'
            );
            const localLandingVs = Number(finalFlightData.landingVs || 0);
            const localLandingG = Number(finalFlightData.landingGForce || 0);
            const saveLandingTrusted = landingDataTrusted || existingLandingTrusted || localLandingVs > 0 || localLandingG > 0;
            const resolvedTouchdownForSave = saveLandingTrusted
              ? (localLandingVs > 0
                  ? localLandingVs
                  : Number(xpData.touchdown_vspeed || liveData.touchdown_vspeed || existingXpData.touchdown_vspeed || 0))
              : 0;
            const resolvedLandingGForSave = saveLandingTrusted
              ? (localLandingG > 0
                  ? localLandingG
                  : Number(
                      xpData.landing_g_force ||
                      xpData.landingGForce ||
                      liveData.landing_g_force ||
                      liveData.landingGForce ||
                      existingXpData.landing_g_force ||
                      existingXpData.landingGForce ||
                      0
                    ))
              : 0;
            const storedTouchdownVs = Math.max(0, Math.min(2500, Math.abs(Number(resolvedTouchdownForSave || 0))));
            const storedLandingG = Math.max(0, Math.min(6, Number(resolvedLandingGForSave || 0)));
            const hasCrashedFinal = hasCrashed;

            await base44.entities.Flight.update(activeFlight.id, {
               status: (hasCrashedFinal || wrongAirport) ? 'failed' : 'completed',
               arrival_time: new Date().toISOString(),
               flight_score: scoreWithTime,
               takeoff_rating: scoreToRating(scoreWithTime),
               flight_rating: scoreToRating(scoreWithTime),
               landing_rating: scoreToRating(scoreWithTime),
               overall_rating: scoreToRating(scoreWithTime),
               landing_vs: storedTouchdownVs,
               max_g_force: finalFlightData.maxGForce,
               fuel_used_liters: fuelUsed,
               fuel_cost: fuelCost,
               crew_cost: crewCost,
               maintenance_cost: (flightHours * maintenanceCostPerHour) + totalMaintenanceCostWithCrash,
               flight_duration_hours: flightHours,
               revenue,
               profit,
               passenger_comments: generatePassengerComments(scoreWithTime, finalFlightData),
               xplane_data: {
                 ...finalFlightData,
                 landing_g_force: storedLandingG,
                 touchdown_vspeed: storedTouchdownVs,
                 touchdown_detected: saveLandingTrusted && (storedTouchdownVs > 0 || storedLandingG > 0),
                 flight_path: preservedFlightPath,
                 flight_events_log: preservedFlightEventsLog,
                 bridge_event_log: preservedBridgeEventLog,
                 telemetry_history: preservedTelemetryHistory,
                 fms_waypoints: preservedFmsWaypoints,
                 simbrief_waypoints: preservedSimbriefWaypoints,
                 simbrief_route_string: preservedSimbriefRouteString,
                 simbrief_departure_coords: preservedSimbriefDepCoords,
                 simbrief_arrival_coords: preservedSimbriefArrCoords,
                 departure_lat: existingXpData.departure_lat || finalFlightData.departure_lat || 0,
                 departure_lon: existingXpData.departure_lon || finalFlightData.departure_lon || 0,
                 arrival_lat: existingXpData.arrival_lat || finalFlightData.arrival_lat || 0,
                 arrival_lon: existingXpData.arrival_lon || finalFlightData.arrival_lon || 0,
                 // Completion metadata
                 final_score: scoreWithTime,
                 flightHours,
                 timeScoreChange,
                 timeBonus,
                 madeDeadline,
                 deadlineMinutes,
                 totalRevenue: contract?.payout || 0,
                 landingBonus: landingBonusUsed,
                 landingPenalty: landingPenaltyUsed,
                 levelBonus: levelBonus,
                 levelBonusPercent: levelBonusPercent * 100,
                 companyLevel: company?.level || 1,
                 crewBonus: crewBonusAmount,
                 arrival_distance_nm: hasArrivalCoords && hasCurrentCoords ? Math.round(arrivalDistanceNm * 10) / 10 : null,
                 landed_too_far_from_arrival: landedTooFarFromArrival,
                 emergency_landing_declared: !!emergencyLanding,
                 emergency_off_airport_completion: emergencyOffAirportCompletion,
                 emergency_score_penalty: emergencyScorePenalty,
                 emergency_payout_factor: emergencyOffAirportCompletion ? 0.3 : 1.0,
                 events: finalFlightData.events,
                 crashMaintenanceCost: crashMaintenanceCost
               }
             });

            // Update contract
            console.log('Aktualisiere Contract Status:', activeFlight.contract_id, (hasCrashedFinal || wrongAirport) ? 'failed' : 'completed');
            await base44.entities.Contract.update(activeFlight.contract_id, { status: (hasCrashedFinal || wrongAirport) ? 'failed' : 'completed' });

            // Nur tatsächliche Event-Wartungskosten hinzufügen, nicht die normalen Flugstunden-Kosten
            const currentAccumulatedCost = airplaneToUpdate?.accumulated_maintenance_cost || 0;
            const newAccumulatedCost = currentAccumulatedCost + totalMaintenanceCostWithCrash;

            console.log('Wartungskosten Update:', { currentAccumulatedCost, totalMaintenanceCostWithCrash, newAccumulatedCost });

            // Update aircraft with depreciation, crash status, and maintenance costs
            if (activeFlight?.aircraft_id) {
              try {
                // Wenn Wartungskosten > 10% des Wertes -> Status "maintenance"
                // Apply maintenance damage from failures to aircraft categories
                const activeFl = flight || existingFlight;
                const flightDamage = activeFl?.maintenance_damage || {};
                const existingCats = airplaneToUpdate?.maintenance_categories || {};
                const updatedCats = { ...existingCats };
                for (const [cat, dmg] of Object.entries(flightDamage)) {
                  updatedCats[cat] = Math.min(100, (updatedCats[cat] || 0) + dmg);
                }
                
                // Also add base wear from flight hours per category
                const baseWearPerHour = 0.5; // 0.5% per flight hour base wear
                for (const cat of ['engine', 'hydraulics', 'avionics', 'airframe', 'landing_gear', 'electrical', 'flight_controls', 'pressurization']) {
                  updatedCats[cat] = Math.min(100, (updatedCats[cat] || 0) + baseWearPerHour * flightHours);
                }
                
                // Add specific event-based damage to relevant categories
                if (finalFlightData.events.tailstrike) updatedCats.airframe = Math.min(100, (updatedCats.airframe || 0) + 10);
                if (finalFlightData.events.overstress) updatedCats.airframe = Math.min(100, (updatedCats.airframe || 0) + 15);
                if (finalFlightData.events.hard_landing) updatedCats.landing_gear = Math.min(100, (updatedCats.landing_gear || 0) + 12);
                if (finalFlightData.events.high_g_force) updatedCats.airframe = Math.min(100, (updatedCats.airframe || 0) + 8);
                if (finalFlightData.events.flaps_overspeed) updatedCats.flight_controls = Math.min(100, (updatedCats.flight_controls || 0) + 10);
                if (hasCrashed) {
                  for (const cat of Object.keys(updatedCats)) {
                    updatedCats[cat] = 100; // Everything maxed on crash
                  }
                }

                // Determine aircraft status based on updated categories
                let newAircraftStatus = 'available';
                if (hasCrashed) {
                  newAircraftStatus = 'damaged';
                } else {
                  const catVals = Object.values(updatedCats);
                  const maxCatWear = Math.max(...catVals);
                  const avgCatWear = catVals.reduce((a, b) => a + b, 0) / catVals.length;
                  if (maxCatWear > 75 || avgCatWear > 50) {
                    newAircraftStatus = 'maintenance';
                  }
                }

                const aircraftUpdate = {
                  status: newAircraftStatus,
                  total_flight_hours: newFlightHours,
                  current_value: hasCrashed ? 0 : Math.max(0, newAircraftValue),
                  accumulated_maintenance_cost: newAccumulatedCost,
                  maintenance_categories: updatedCats
                };

                console.log('🛩️ AKTUALISIERE FLUGZEUG JETZT:', activeFlight.aircraft_id, aircraftUpdate);
                await base44.entities.Aircraft.update(activeFlight.aircraft_id, aircraftUpdate);
                console.log('✅ FLUGZEUG AKTUALISIERT');
               } catch (error) {
                 console.error('❌ FEHLER BEI FLUGZEUG UPDATE:', error);
                 throw error;
               }
            } else {
              console.error('❌ KEIN FLUGZEUG GEFUNDEN FÜR UPDATE:', activeFlight);
            }

            // Free up crew - SOFORT Status auf available setzen
            if (activeFlight?.crew && Array.isArray(activeFlight.crew)) {
              console.log('🔄 Aktualisiere Crew Status:', activeFlight.crew);
              for (const member of activeFlight.crew) {
                // Hole aktuellen Employee um total_flight_hours zu bekommen
                const employees = await base44.entities.Employee.filter({ id: member.employee_id });
                const currentEmployee = employees[0];
                
                if (currentEmployee) {
                  // Slowly improve skill_rating based on flight hours (+0.1 per hour, max 100)
                  const newSkill = Math.min(100, (currentEmployee.skill_rating || 50) + flightHours * 0.1);
                  // Slowly improve attributes based on flight hours (+0.05 per hour)
                  const attrs = currentEmployee.attributes || {};
                  const improvedAttrs = {
                    nerve: Math.min(100, (attrs.nerve || 50) + flightHours * 0.05),
                    passenger_handling: Math.min(100, (attrs.passenger_handling || 50) + flightHours * 0.05),
                    precision: Math.min(100, (attrs.precision || 50) + flightHours * 0.05),
                    efficiency: Math.min(100, (attrs.efficiency || 50) + flightHours * 0.05),
                  };
                  const employeeUpdate = {
                    status: 'available',
                    total_flight_hours: (currentEmployee.total_flight_hours || 0) + flightHours,
                    skill_rating: Math.round(newSkill * 10) / 10,
                    attributes: improvedAttrs,
                  };
                  console.log('✅ Update Employee:', member.employee_id, employeeUpdate);
                  await base44.entities.Employee.update(member.employee_id, employeeUpdate);
                } else {
                  console.error('❌ Employee nicht gefunden:', member.employee_id);
                }
              }
              console.log('✅ Alle Crew-Mitglieder aktualisiert');
            }

            // Calculate actual balance change (revenue - direct costs + level bonus)
            const actualProfit = profit + levelBonus;

            // Update company - only deduct direct costs (fuel, crew, airport)
            if (company) {
              // Reputation based on score (0-100)
              const reputationChange = (hasCrashed || wrongAirport) ? -10 : Math.round((scoreWithTime - 85) / 5);
              
              // XP and Level system with level-up bonus
              const calculateXPForLevel = (level) => Math.round(100 * Math.pow(1.1, level - 1));
              const calculateLevelUpBonus = (lvl) => Math.round(1000 * Math.pow(1.5, lvl - 1));
              const earnedXP = Math.round(scoreWithTime);
              let currentLevel = company.level || 1;
              let currentXP = (company.experience_points || 0) + earnedXP;
              let totalLevelUpBonus = 0;
              while (currentXP >= calculateXPForLevel(currentLevel)) {
                currentXP -= calculateXPForLevel(currentLevel);
                currentLevel++;
                // One-time exponential bonus for leveling up
                const bonus = calculateLevelUpBonus(currentLevel);
                totalLevelUpBonus += bonus;
                console.log(`🎉 LEVEL UP! Level ${currentLevel} - Bonus: $${bonus.toLocaleString()}`);
              }

              await base44.entities.Company.update(company.id, {
                balance: (company.balance || 0) + actualProfit + totalLevelUpBonus,
                reputation: Math.min(100, Math.max(0, (company.reputation || 50) + reputationChange)),
                level: currentLevel,
                experience_points: currentXP,
                total_flights: (company.total_flights || 0) + 1,
                total_passengers: (company.total_passengers || 0) + (contract?.passenger_count || 0),
                total_cargo_kg: (company.total_cargo_kg || 0) + (contract?.cargo_weight_kg || 0)
              });

              // Create transaction for flight revenue
              await base44.entities.Transaction.create({
                company_id: company.id,
                type: 'income',
                category: 'flight_revenue',
                amount: actualProfit,
                description: `Flug: ${contract?.title}${levelBonus > 0 ? ` (Levelbonus +${Math.round(levelBonus)})` : ''}`,
                reference_id: activeFlight?.id,
                date: new Date().toISOString()
              });

              // Create separate transaction for level-up bonus
              if (totalLevelUpBonus > 0) {
                await base44.entities.Transaction.create({
                  company_id: company.id,
                  type: 'income',
                  category: 'bonus',
                  amount: totalLevelUpBonus,
                  description: `Level-Up Bonus! Neues Level: ${currentLevel} (+$${totalLevelUpBonus.toLocaleString()})`,
                  reference_id: activeFlight?.id,
                  date: new Date().toISOString()
                });
              }
            }

            // WARTE bis Aircraft wirklich gespeichert ist und lade es neu
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Hole das aktualisierte Aircraft direkt aus der DB
            const updatedAircraft = await base44.entities.Aircraft.filter({ id: activeFlight.aircraft_id });
            console.log('✅ Aircraft nach Update:', updatedAircraft[0]);

            // Invalidiere aircraft query um sicherzustellen, dass Fleet aktualisiert wird
            await queryClient.invalidateQueries({ queryKey: ['aircraft'] });

            // Hole den aktualisierten Flight aus DB
            const updatedFlightFromDB = await base44.entities.Flight.filter({ id: activeFlight.id });
            return updatedFlightFromDB[0];
    },
    onSuccess: async (updatedFlight) => {
      // Wenn null zurückgegeben wurde, war die Mutation bereits in Bearbeitung
      if (!updatedFlight) {
        console.log('⚠️ Keine Daten - Flug wurde bereits abgeschlossen');
        setShowAutoCompleteOverlay(false);
        return;
      }

      console.log('✅ Flug erfolgreich abgeschlossen:', updatedFlight);

      // FORCE refetch der Aircraft Query damit Fleet aktualisiert wird
      await queryClient.refetchQueries({ queryKey: ['aircraft'] });
      await queryClient.invalidateQueries({ queryKey: ['company'] });
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });

      // Direkt navigieren mit dem neuesten Flight von der DB
      // KRITISCH: Nutze die Daten vom gespeicherten Flight (aus DB), nicht den lokalen State
      // Der lokale State kann veraltet sein (z.B. crash-Event fehlt)
      navigate(createPageUrl(`CompletedFlightDetails?contractId=${contractIdFromUrl}`), {
        state: { 
          flight: updatedFlight,
          contract
        },
        replace: true
      });
    },
    onError: (error) => {
      console.error('❌ FEHLER BEIM FLUGABSCHLUSS:', error);
      setIsCompletingFlight(false);
      setShowAutoCompleteOverlay(false);
    }
  });

  useEffect(() => {
    return () => {
      if (autoCompleteTimeoutRef.current) {
        clearTimeout(autoCompleteTimeoutRef.current);
      }
    };
  }, []);

  // Update flight duration every second
  useEffect(() => {
    if (flightPhase === 'preflight' || flightPhase === 'completed' || !flightStartTime) return;
    
    const timer = setInterval(() => {
      setFlightDurationSeconds(Math.floor((Date.now() - flightStartTime) / 1000));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [flightPhase, flightStartTime]);

  // Update flight data from X-Plane log (freeze data after landing)
  useEffect(() => {
    if (!xplaneLog?.raw_data) return;
    // Only block in preflight AND completed
    if (flightPhase === 'preflight' || flightPhase === 'completed') return;

    // Only filter by timestamp if flightStartedAt is set (from startFlightMutation, not from existingFlight restore)
    // This prevents blocking data that's already on the Flight record when restoring an existing flight
    if (flightStartedAt && xplaneLog.created_date) {
      const logTime = new Date(xplaneLog.created_date).getTime();
      if (logTime < flightStartedAt) {
        return; // Altes Log ignorieren
      }
    }

    const xp = xplaneLog.raw_data;

    const crashSignal = !!(xp.simconnect_crash_event || xp.simconnectCrashEvent);

    setFlightData(prev => {
      const currentGForce = xp.g_force || 1.0;
      const newMaxControlInput = Math.max(prev.maxControlInput, xp.control_input || 0);

      // Track airborne state for THIS contract only; ignore stale payload flags.
      const airborneEvidence = !xp.on_ground && (
        Number(xp.speed || 0) > 35 ||
        Math.abs(Number(xp.vertical_speed || 0)) > 200
      );
      const activeFlight = flight || existingFlight;
      const parseMs = (v) => {
        const ms = Date.parse(String(v || ""));
        return Number.isFinite(ms) ? ms : NaN;
      };
      const sessionStartMs = parseMs(activeFlight?.departure_time || activeFlight?.created_date);
      const backendAirborneMs = parseMs(xp.airborne_started_at || xp.completion_armed_at);
      const backendAirborneFlags = !!(xp.completion_armed || xp.was_airborne);
      const backendAirborneInSession =
        backendAirborneFlags &&
        Number.isFinite(sessionStartMs) &&
        Number.isFinite(backendAirborneMs) &&
        backendAirborneMs >= (sessionStartMs - 5000);
      const backendAirborneArmed = backendAirborneInSession || (!xp.on_ground && !!xp.completion_armed);
      // Never arm airborne from backend flags while currently on ground.
      // This blocks stale session flags from instantly completing a new flight.
      const newWasAirborne = prev.wasAirborne || airborneEvidence || (!xp.on_ground && backendAirborneArmed);

      // KRITISCH: Solange nicht abgehoben, keine Events/Kosten/Scores verarbeiten
      if (!newWasAirborne) {
        // Use current position as departure if not set yet
        const curLat = (xp.latitude !== undefined && xp.latitude !== null) ? xp.latitude : prev.latitude;
        const curLon = (xp.longitude !== undefined && xp.longitude !== null) ? xp.longitude : prev.longitude;
        
        const groundData = {
          ...prev,
          altitude: xp.altitude || prev.altitude,
          speed: xp.speed || prev.speed,
          verticalSpeed: xp.vertical_speed || prev.verticalSpeed,
          heading: xp.heading || prev.heading,
          fuel: xp.fuel_percentage || prev.fuel,
          fuelKg: xp.fuel_kg || prev.fuelKg,
          gForce: currentGForce,
          latitude: curLat,
          longitude: curLon,
          departure_lat: prev.departure_lat || xp.departure_lat || curLat || 0,
          departure_lon: prev.departure_lon || xp.departure_lon || curLon || 0,
          arrival_lat: prev.arrival_lat || xp.arrival_lat || 0,
          arrival_lon: prev.arrival_lon || xp.arrival_lon || 0,
          events: {
            tailstrike: false, stall: false, overstress: false, overspeed: false,
            flaps_overspeed: false, fuel_emergency: false, gear_up_landing: false,
            crash: false, harsh_controls: false, high_g_force: false, hard_landing: false, wrong_airport: false
          },
          wasAirborne: false,
        };
        flightDataRef.current = groundData;
        return groundData;
      }

      // Ab hier: Flugzeug WAR in der Luft - normale Verarbeitung
      const newMaxGForce = Math.max(prev.maxGForce, currentGForce);

      // Landing detection based on vertical speed
      const currentSpeed = xp.speed || 0;
      const landingDataTrusted = !!(
        xp.touchdown_detected ||
        xp.landing_data_locked ||
        xp.bridge_local_landing_locked ||
        xp.landing_data_source === 'bridge_local'
      );
      // Ensure we capture landing VS properly - preserve after landing
      const touchdownVsRaw = prev.landingType
        ? prev.landingVs  // Already landed - keep the captured value
        : ((xp.on_ground && newWasAirborne && landingDataTrusted)
            ? (xp.touchdown_vspeed || 0)
            : 0);
      const touchdownVs = Math.max(0, Math.min(2500, Math.abs(Number(touchdownVsRaw || 0))));
      // Landing G-force: Capture the ACTUAL g-force at touchdown moment
      // NOT the peak g-force during the entire flight
      // Once landed (landingType set), preserve the captured value
      let landingGForceValue;
      if (prev.landingType) {
        landingGForceValue = prev.landingGForce; // Already landed - keep captured value
      } else if (xp.on_ground && newWasAirborne && landingDataTrusted) {
        // Use only measured touchdown G from backend/bridge and preserve once captured.
        const reportedLandingG = Number(xp.landing_g_force || 0);
        landingGForceValue = reportedLandingG > 0 ? Math.min(6, reportedLandingG) : Number(prev.landingGForce || 0);
      } else {
        // Still airborne (or false on_ground glitch) - do not synthesize landing G.
        landingGForceValue = 0;
      }
      const nextLandingVs = prev.landingType
        ? Number(prev.landingVs || 0)
        : ((xp.on_ground && newWasAirborne && landingDataTrusted && touchdownVs > 0)
            ? touchdownVs
            : Number(prev.landingVs || 0));

      // Landing categories based on G-force only
      let landingType = prev.landingType;
      let landingScoreChange = prev.landingScoreChange || 0;
      let landingMaintenanceCost = prev.landingMaintenanceCost || 0;
      let landingBonus = prev.landingBonus || 0;

       // Get aircraft for maintenance cost calculations (purchase price is neuwert)
       // Use flight.aircraft_id if available, otherwise try to find from aircraft list
       const aircraftId = flight?.aircraft_id;
       const currentAircraft = aircraft?.find(a => a.id === aircraftId);
       const aircraftPurchasePrice = currentAircraft?.purchase_price || 1000000; // fallback price if not found

      if (landingGForceValue > 0 && xp.on_ground && newWasAirborne && landingDataTrusted && !prev.events.crash && !prev.landingType) {
        const gForce = landingGForceValue;
        // Revenue = contract payout (Gesamteinnahmen)
        const totalRevenue = contract?.payout || 0;

        if (gForce < 0.5) {
          landingType = 'butter';
          landingScoreChange = 40;
          landingBonus = totalRevenue * 4; // 4x Gesamteinnahmen
        } else if (gForce < 1.0) {
          landingType = 'soft';
          landingScoreChange = 20;
          landingBonus = totalRevenue * 2; // 2x Gesamteinnahmen
        } else if (gForce < 1.6) {
          landingType = 'acceptable';
          landingScoreChange = 5;
          landingBonus = 0; // $0
        } else if (gForce < 2.0) {
          landingType = 'hard';
          landingScoreChange = -30;
          landingMaintenanceCost = totalRevenue * 0.25; // -25% der Gesamteinnahmen
        } else {
          landingType = 'very_hard';
          landingScoreChange = -50;
          landingMaintenanceCost = totalRevenue * 0.5; // -50% der Gesamteinnahmen
        }
      }
      
      // Gear-up landing: -35 Punkte + 15% Wartungskosten vom Neuwert
      if (xp.gear_up_landing && !prev.events.gear_up_landing) {
        landingScoreChange -= 35;
        landingMaintenanceCost += aircraftPurchasePrice * 0.15;
      }

      // Crash nur wenn tatsächlich abgehoben war
      const isCrashArmed = newWasAirborne;
      const isCrash = (landingType === 'crash' || prev.events.crash || (crashSignal && isCrashArmed)) && isCrashArmed;
      
      // Calculate score penalties - only deduct when NEW event occurs
      let baseScore = prev.flightScore;
      
      // Landungs-Score hinzufügen/abziehen (nur wenn sich landingType gerade geändert hat)
      if (landingType && !prev.landingType) {
        baseScore = Math.max(0, Math.min(100, baseScore + landingScoreChange));
      }

      // Track if high G-force event already happened
      const hadHighGEvent = prev.events.high_g_force || false;

      // Calculate maintenance cost increase based on NEW events only
      let maintenanceCostIncrease = landingMaintenanceCost;

      // Log landing quality calculations for debugging
      if (landingType && !prev.landingType) {
        console.log('🎯 LANDUNGSQUALITÄT ERKANNT:', {
          landingType,
          gForce: landingGForceValue,
          landingScoreChange,
          landingMaintenanceCost,
          landingBonus
        });
      }
      
      // Heckaufsetzer (Tailstrike): -20 Punkte + 2% des Neuwertes
      if (xp.tailstrike && !prev.events.tailstrike) {
        baseScore = Math.max(0, baseScore - 20);
        maintenanceCostIncrease += aircraftPurchasePrice * 0.02;
      }
      
      // Stall: -50 Punkte (keine Wartungskosten) - erkennen über mehrere Datarefs
      if ((xp.stall || xp.is_in_stall || xp.stall_warning || xp.override_alpha) && !prev.events.stall) {
        console.log('⚠️ STALL ERKANNT:', { stall: xp.stall, is_in_stall: xp.is_in_stall, stall_warning: xp.stall_warning, override_alpha: xp.override_alpha });
        baseScore = Math.max(0, baseScore - 50);
      }
      
      // G-Kräfte ab 1.5: -10 Punkte pro G-Stufe + Wartungskosten
      if (newMaxGForce >= 1.5) {
        // Erster Überschreitung bei 1.5G
        if (!hadHighGEvent && !prev.events.high_g_force) {
          baseScore = Math.max(0, baseScore - 10);
          maintenanceCostIncrease += aircraftPurchasePrice * 0.01;
        }
        
        const currentGLevel = Math.floor(newMaxGForce);
        const prevGLevel = Math.floor(prev.maxGForce);
        
        if (currentGLevel > prevGLevel && currentGLevel >= 2) {
          for (let gLevel = Math.max(2, prevGLevel + 1); gLevel <= currentGLevel; gLevel++) {
            if (!processedGLevels.has(gLevel)) {
              const gForceMaintenanceCost = aircraftPurchasePrice * (gLevel * 0.01);
              maintenanceCostIncrease += gForceMaintenanceCost;
              baseScore = Math.max(0, baseScore - 10);
            }
          }
        }
      }
      
      // Strukturschaden (overstress): -30 Punkte + 4% des Neuwertes, einmalig
      if (xp.overstress && !prev.events.overstress) {
        baseScore = Math.max(0, baseScore - 30);
        maintenanceCostIncrease += aircraftPurchasePrice * 0.04;
      }
      
      // Overspeed: -15 Punkte
      if (xp.overspeed && !prev.events.overspeed) {
        baseScore = Math.max(0, baseScore - 15);
      }
      
      // Flaps Overspeed: Score-Abzug + Wartungskosten basierend auf Settings
      // Also detect flaps overspeed from flap_ratio + speed if plugin doesn't send flaps_overspeed flag
      const flapsOverspeedDetected = xp.flaps_overspeed || false;
      if (flapsOverspeedDetected && !prev.events.flaps_overspeed) {
        const flapsScorePenalty = settings?.flaps_overspeed_score_penalty || 15;
        const flapsMaintenancePercent = settings?.flaps_overspeed_maintenance_percent || 2.5;
        baseScore = Math.max(0, baseScore - flapsScorePenalty);
        maintenanceCostIncrease += aircraftPurchasePrice * (flapsMaintenancePercent / 100);
      }
      
      // Crash: -100 Punkte einmalig + 70% des Neuwertes Wartungskosten werden vom Flug berechnet
      if (isCrash && !prev.events.crash) {
        baseScore = Math.max(0, baseScore - 100);
        // Crash-Wartungskosten werden in completeFlightMutation berechnet
      }
      
      // Store departure/arrival coordinates from first X-Plane data
      // Use current lat/lon properly (don't use || which treats 0 as falsy)
      const curLat = (xp.latitude !== undefined && xp.latitude !== null) ? xp.latitude : prev.latitude;
      const curLon = (xp.longitude !== undefined && xp.longitude !== null) ? xp.longitude : prev.longitude;
      const depLat = prev.departure_lat || xp.departure_lat || 0;
      const depLon = prev.departure_lon || xp.departure_lon || 0;
      const arrLat = prev.arrival_lat || xp.arrival_lat || 0;
      const arrLon = prev.arrival_lon || xp.arrival_lon || 0;
      
      // Merge events: backend xplane_data events are authoritative (once true, always true)
      // Local detection adds to them but never overrides true->false
      const mergedEvents = { tailstrike: !!(xp.tailstrike || prev.events.tailstrike), stall: !!(xp.stall || xp.is_in_stall || xp.stall_warning || xp.override_alpha || prev.events.stall), overstress: !!(xp.overstress || prev.events.overstress), overspeed: !!(xp.overspeed || prev.events.overspeed), flaps_overspeed: !!(flapsOverspeedDetected || xp.flaps_overspeed || prev.events.flaps_overspeed), fuel_emergency: !!(xp.fuel_emergency || prev.events.fuel_emergency), gear_up_landing: !!(xp.gear_up_landing || prev.events.gear_up_landing), crash: !!isCrash, harsh_controls: !!(xp.harsh_controls || prev.events.harsh_controls), high_g_force: !!(newMaxGForce >= 1.5 || prev.events.high_g_force), hard_landing: !!(landingType === 'hard' || landingType === 'very_hard' || prev.events.hard_landing), wrong_airport: !!(prev.events.wrong_airport) };

      const newData = {
        altitude: xp.altitude || prev.altitude,
        speed: xp.speed || prev.speed,
        verticalSpeed: xp.vertical_speed || prev.verticalSpeed,
        heading: xp.heading || prev.heading,
        fuel: xp.fuel_percentage || prev.fuel,
        fuelKg: xp.fuel_kg || prev.fuelKg,
        gForce: currentGForce,
        maxGForce: newMaxGForce,
        landingGForce: landingGForceValue,
        landingVs: nextLandingVs,
        landingType: landingType,
        landingScoreChange: landingScoreChange,
        landingMaintenanceCost: landingMaintenanceCost,
        landingBonus: landingBonus,
        flightScore: baseScore,
        maintenanceCost: prev.maintenanceCost + maintenanceCostIncrease,
        reputation: xp.reputation || prev.reputation,
        latitude: curLat,
        longitude: curLon,
        departure_lat: depLat,
        departure_lon: depLon,
        arrival_lat: arrLat,
        arrival_lon: arrLon,
        events: mergedEvents,
        maxControlInput: newMaxControlInput,
        wasAirborne: newWasAirborne,
        previousSpeed: currentSpeed
      };
      


      flightDataRef.current = newData;
      if (newMaxGForce >= 1.5) { const cl = Math.floor(newMaxGForce); setProcessedGLevels(p => { const u = new Set(p); for (let g = 2; g <= cl; g++) u.add(g); return u; }); }
      return newData;
      });

      // Auto-detect phase - ERST wenn tatsächlich abgehoben (!on_ground)
    if (flightPhase === 'takeoff' && !xp.on_ground && xp.altitude > 10) {
      setFlightPhase('cruise');
      // Setze Flugstart-Zeit erst beim tatsächlichen Abheben
      if (!flightStartTime) {
        setFlightStartTime(Date.now());
      }
    } else if (flightPhase === 'cruise') {
      if (xp.vertical_speed < -200) {
        setFlightPhase('landing');
      }
    }

    // Landung erkannt: Flugzeug war in der Luft und ist jetzt auf dem Boden
    // Erlaube Abschluss in ALLEN aktiven Flugphasen (takeoff, cruise, landing)
    const isActivePhase = flightPhase === 'takeoff' || flightPhase === 'cruise' || flightPhase === 'landing';
    
    // Use the freshest synchronized state (ref) to avoid stale React-state races.
    const latestFlightData = flightDataRef.current || flightData;

    // flightStartTime kann null sein wenn der Flug wiederhergestellt wurde - dann setze es jetzt
    if (latestFlightData.wasAirborne && !flightStartTime) {
      setFlightStartTime(Date.now());
    }
    
    // Auto-complete trigger: require backend arming to avoid stale on_ground completions right after takeoff.
    const isReadyToComplete = xp.on_ground && latestFlightData.wasAirborne && !!xp.completion_armed;
    if (isReadyToComplete && (flightPhase === 'takeoff' || flightPhase === 'cruise' || flightPhase === 'landing') && !completeFlightMutation.isPending && !isCompletingFlight) {
      // Check distance to arrival airport (>=10 NM without emergency = failed)
      const simbriefArr = xp.simbrief_arrival_coords || xplaneLog?.raw_data?.simbrief_arrival_coords || simbriefRoute?.arrival_coords || null;
      const contractArrival = getAirportCoords(contract?.arrival_airport);
      const arrivalPos = pickFirstValidLatLon([
            [latestFlightData.arrival_lat, latestFlightData.arrival_lon],
            [xp.arrival_lat, xp.arrival_lon],
            [simbriefArr?.lat, simbriefArr?.lon],
            [simbriefArr?.latitude, simbriefArr?.longitude],
            [contractArrival?.lat, contractArrival?.lon],
          ]);
          const currentPos = pickFirstValidLatLon([
            [xp.latitude, xp.longitude],
            [latestFlightData.latitude, latestFlightData.longitude],
          ]);
      const dArr = (arrivalPos.valid && currentPos.valid)
        ? calculateHaversineDistance(currentPos.lat, currentPos.lon, arrivalPos.lat, arrivalPos.lon)
        : 0;
      if (arrivalPos.valid && currentPos.valid && dArr >= 10 && !emergencyLanding) {
        console.log(`🚨 WRONG AIRPORT (${Math.round(dArr)} NM) - FAILED`);
        setFlightData(prev => { const u = { ...prev, events: { ...prev.events, wrong_airport: true }, flightScore: 0 }; flightDataRef.current = u; return u; });
      }
      setFlightPhase('completed');
      setShowAutoCompleteOverlay(true);
      // Keep a buffer >= bridge send interval so touchdown VS/G reaches backend before completion.
      if (autoCompleteTimeoutRef.current) {
        clearTimeout(autoCompleteTimeoutRef.current);
      }
      autoCompleteTimeoutRef.current = setTimeout(() => {
        autoCompleteTimeoutRef.current = null;
        completeFlightMutation.mutate();
      }, 3200);
    }

    // Auto-complete flight on crash - NUR wenn bereits abgehoben
    if (latestFlightData.events.crash && latestFlightData.wasAirborne && isActivePhase && !completeFlightMutation.isPending && !isCompletingFlight) {
      console.log('💥 CRASH ERKANNT - Starte Flugabschluss');
      setFlightPhase('completed');
      setShowAutoCompleteOverlay(true);
      if (autoCompleteTimeoutRef.current) {
        clearTimeout(autoCompleteTimeoutRef.current);
      }
      autoCompleteTimeoutRef.current = setTimeout(() => {
        autoCompleteTimeoutRef.current = null;
        completeFlightMutation.mutate();
      }, 200);
    }
  }, [xplaneLog, flight, existingFlight, flightPhase, completeFlightMutation, flightData.altitude, flightData.wasAirborne, flightData.events.crash, flightStartedAt, flightStartTime, emergencyLanding, simbriefRoute]);

  const phaseLabels = {
    preflight: t('preflight', lang),
    takeoff: t('takeoff', lang),
    cruise: t('cruise', lang),
    landing: t('approach', lang),
    completed: t('completed', lang)
  };

  // Haversine formula to calculate distance between two coordinates
  const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const calculateDistanceInfo = () => {
    if (!contract || flightPhase === 'preflight') return { progress: 0, remainingNm: contract?.distance_nm || 0, totalNm: contract?.distance_nm || 0 };
    const hasPos = flightData.latitude !== 0 || flightData.longitude !== 0;
    // Use SimBrief route if available
    const xpd = (flight || existingFlight)?.xplane_data || {};
    const sbWps = simbriefRoute?.waypoints || xpd.simbrief_waypoints || [];
    const sbDep = simbriefRoute?.departure_coords || xpd.simbrief_departure_coords;
    const sbArr = simbriefRoute?.arrival_coords || xpd.simbrief_arrival_coords;
    if (sbWps.length >= 2 && hasPos) {
      const pts = [];
      if (sbDep?.lat && sbDep?.lon) pts.push({ lat: +sbDep.lat, lon: +sbDep.lon });
      sbWps.forEach(wp => { const la = +wp?.lat, lo = +wp?.lon; if (Number.isFinite(la) && Number.isFinite(lo)) pts.push({ lat: la, lon: lo }); });
      if (sbArr?.lat && sbArr?.lon) pts.push({ lat: +sbArr.lat, lon: +sbArr.lon });
      if (pts.length >= 2) {
        let totalNm = 0;
        for (let i = 0; i < pts.length - 1; i++) totalNm += calculateHaversineDistance(pts[i].lat, pts[i].lon, pts[i+1].lat, pts[i+1].lon);
        let minD = Infinity, cIdx = 0, cFrac = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const sL = calculateHaversineDistance(pts[i].lat, pts[i].lon, pts[i+1].lat, pts[i+1].lon);
          if (sL < 0.1) continue;
          const dA = calculateHaversineDistance(pts[i].lat, pts[i].lon, flightData.latitude, flightData.longitude);
          const dB = calculateHaversineDistance(pts[i+1].lat, pts[i+1].lon, flightData.latitude, flightData.longitude);
          let f = (dA*dA - dB*dB + sL*sL) / (2*sL*sL); f = Math.max(0, Math.min(1, f));
          const pLat = pts[i].lat + f*(pts[i+1].lat-pts[i].lat), pLon = pts[i].lon + f*(pts[i+1].lon-pts[i].lon);
          const d = calculateHaversineDistance(flightData.latitude, flightData.longitude, pLat, pLon);
          if (d < minD) { minD = d; cIdx = i; cFrac = f; }
        }
        const cSL = calculateHaversineDistance(pts[cIdx].lat, pts[cIdx].lon, pts[cIdx+1].lat, pts[cIdx+1].lon);
        let rem = cSL * (1 - cFrac);
        for (let j = cIdx + 1; j < pts.length - 1; j++) rem += calculateHaversineDistance(pts[j].lat, pts[j].lon, pts[j+1].lat, pts[j+1].lon);
        const flown = Math.max(0, totalNm - rem);
        return { progress: Math.max(0, Math.min(100, totalNm > 0 ? (flown / totalNm) * 100 : 0)), remainingNm: Math.max(0, Math.round(rem)), totalNm: Math.round(totalNm) };
      }
    }
    // Fallback: direct line
    const hasArr = flightData.arrival_lat !== 0 || flightData.arrival_lon !== 0;
    const hasDep = flightData.departure_lat !== 0 || flightData.departure_lon !== 0;
    if (hasPos && hasArr) {
      const rem = calculateHaversineDistance(flightData.latitude, flightData.longitude, flightData.arrival_lat, flightData.arrival_lon);
      let tot = contract?.distance_nm || 0;
      if (hasDep) tot = calculateHaversineDistance(flightData.departure_lat, flightData.departure_lon, flightData.arrival_lat, flightData.arrival_lon);
      if (tot <= 0) tot = contract?.distance_nm || rem;
      return { progress: Math.max(0, Math.min(100, ((tot - rem) / tot) * 100)), remainingNm: Math.max(0, Math.round(rem)), totalNm: Math.round(tot) };
    }
    if (hasPos && hasDep && (contract?.distance_nm || 0) > 0) {
      const flown = calculateHaversineDistance(flightData.departure_lat, flightData.departure_lon, flightData.latitude, flightData.longitude);
      const tot = contract.distance_nm;
      return { progress: Math.max(0, Math.min(100, (flown / tot) * 100)), remainingNm: Math.max(0, Math.round(tot - flown)), totalNm: Math.round(tot) };
    }
    return { progress: 0, remainingNm: contract?.distance_nm || 0, totalNm: contract?.distance_nm || 0 };
  };

  const distanceInfo = calculateDistanceInfo();
  const distanceProgress = distanceInfo.progress;
  const liveXpd = (flight || existingFlight)?.xplane_data || {};
  const backendMapPath = (Array.isArray(xplaneLog?.raw_data?.flight_path) && xplaneLog.raw_data.flight_path.length > 0)
    ? xplaneLog.raw_data.flight_path
    : (Array.isArray(liveXpd.flight_path) ? liveXpd.flight_path : []);
  const mapFlightPath = (Array.isArray(backendMapPath) && backendMapPath.length >= localMapPath.length)
    ? backendMapPath
    : localMapPath;
  const mapFlightEventsLog = (() => {
    const rawLog = xplaneLog?.raw_data?.flight_events_log;
    if (Array.isArray(rawLog) && rawLog.length > 0) return rawLog;
    const xpdLog = liveXpd?.flight_events_log;
    if (Array.isArray(xpdLog) && xpdLog.length > 0) return xpdLog;
    const rawBridgeLog = xplaneLog?.raw_data?.bridge_event_log;
    if (Array.isArray(rawBridgeLog) && rawBridgeLog.length > 0) return rawBridgeLog;
    const xpdBridgeLog = liveXpd?.bridge_event_log;
    if (Array.isArray(xpdBridgeLog) && xpdBridgeLog.length > 0) return xpdBridgeLog;
    return [];
  })();

  if (flightPhase === 'preflight' && !contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-white mb-4">{t('contract_not_found', lang)}</p>
          <Button 
            onClick={() => navigate(createPageUrl("ActiveFlights"))}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {t('go_to_active_flights', lang)}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Zibo Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-cyan-900/30 p-2 rounded-lg shadow-md">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost"
            onClick={() => navigate(createPageUrl("ActiveFlights"))}
            className="h-7 px-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 font-mono text-[10px] uppercase border border-cyan-900/50"
          >
            ◀ {t('back', lang)}
          </Button>
          <div className="text-lg font-mono font-bold text-cyan-400 uppercase tracking-widest px-2">{contract ? contract.title : 'Flight Tracker'}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {contract && (
            <div className="flex items-center gap-2 sm:gap-4 text-slate-400 text-[10px] font-mono uppercase bg-slate-950 px-2 py-1 rounded border border-slate-800">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-600" />
                {contract.departure_airport}
              </span>
              <span>→</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-600" />
                {contract.arrival_airport}
              </span>
            </div>
          )}
          {company?.xplane_connection_status === 'connected' && (
            <Badge className="bg-emerald-900/40 text-emerald-400 border-emerald-700/50 flex items-center gap-1 text-[10px] font-mono uppercase h-7 rounded">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              {xplaneLog?.raw_data?.simulator === 'msfs' ? 'MSFS Live' :
               xplaneLog?.raw_data?.simulator === 'msfs2024' ? 'MSFS 2024 Live' :
               xplaneLog?.raw_data?.simulator === 'xplane' || xplaneLog?.raw_data?.simulator === 'xplane12' ? 'X-Plane Live' :
               xplaneLog?.raw_data?.simulator ? `${xplaneLog.raw_data.simulator} Live` : 'Sim Live'}
            </Badge>
          )}
          <Badge className={`h-7 rounded text-[10px] font-mono uppercase ${
            flightPhase === 'completed' 
              ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50'
              : 'bg-blue-900/40 text-blue-400 border-blue-700/50'
          }`}>
            {phaseLabels[flightPhase]}
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Tab Warning */}
        {flightPhase !== 'preflight' && flightPhase !== 'completed' && (
          <div className="mb-2 p-2 bg-amber-950/30 border border-amber-900/50 rounded flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
            <p className="text-[10px] font-mono text-amber-200">
              {t('tab_warning', lang)}
            </p>
          </div>
        )}

        {contract && (
          <div className="mb-6">
            {/* Progress */}
            <div className="flex items-center justify-between mb-2 text-sm font-mono uppercase text-cyan-500">
              <span className="flex items-center gap-2">
                <PlaneTakeoff className="w-4 h-4 text-cyan-400" />
                {contract.departure_airport}
              </span>
              <span className="flex items-center gap-2">
                <PlaneLanding className="w-4 h-4 text-emerald-400" />
                {contract.arrival_airport}
              </span>
            </div>
            <Progress value={distanceProgress} className="h-3 bg-slate-800" />
            <div className="mt-2 flex items-center justify-between text-xs font-mono text-slate-400 uppercase">
              <span>{Math.round(distanceInfo.totalNm - distanceInfo.remainingNm)} NM {t('flown', lang)}</span>
              <span className="font-bold text-cyan-400 text-sm">
                {distanceInfo.remainingNm} NM
              </span>
              <span>{distanceInfo.totalNm} NM {t('total', lang)}</span>
            </div>
          </div>
        )}

        {!contract && (
          <div className="text-center py-12">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
              <Plane className="w-12 h-12 text-blue-400 mx-auto" />
            </motion.div>
            <p className="text-slate-400 mt-4">{t('waiting_for_xplane', lang)}</p>
          </div>
        )}

        {contract && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Flight Instruments */}
            <div className="lg:col-span-2 space-y-6">
                {/* Main Instruments */}
              <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-400">
                <Gauge className="w-5 h-5 text-blue-400" />
                {t('flight_data', lang)}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 bg-slate-800 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">{t('altitude', lang)}</p>
                  <p className="text-2xl font-mono font-bold text-blue-400">
                    {Math.round(flightData.altitude).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">ft</p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">{t('speed', lang)}</p>
                  <p className="text-2xl font-mono font-bold text-emerald-400">
                    {Math.round(flightData.speed)}
                  </p>
                  <p className="text-xs text-slate-500">kts TAS</p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">{t('vertical_speed', lang)}</p>
                  <p className={`text-2xl font-mono font-bold ${
                    flightData.verticalSpeed > 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {Math.round(flightData.verticalSpeed) > 0 ? '+' : ''}
                    {Math.round(flightData.verticalSpeed)}
                  </p>
                  <p className="text-xs text-slate-500">ft/min</p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">{t('g_force', lang)}</p>
                  <p className={`text-2xl font-mono font-bold ${
                    flightData.gForce < 1.3 ? 'text-emerald-400' :
                    flightData.gForce < 1.8 ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    {flightData.gForce.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">G</p>
                </div>
              </div>
            </Card>

            {/* Deadline Timer */}
            {flightPhase !== 'preflight' && flightStartTime && (
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-400">
                  <Timer className="w-5 h-5 text-amber-400" />
                  Deadline
                </h3>
                {(() => {
                  // Dynamic deadline based on actual X-Plane aircraft, fallback to fleet type
                  const xpIcao = xplaneLog?.raw_data?.aircraft_icao || null;
                  const flType = assignedAircraft?.type || null;
                  const deadlineMin = (contract?.distance_nm)
                    ? calculateDeadlineMinutes(contract.distance_nm, xpIcao, flType)
                    : (contract?.deadline_minutes || 120);
                  const deadlineSec = deadlineMin * 60;
                  const bufferSec = 5 * 60; // 5 minutes buffer
                  const elapsed = flightDurationSeconds;
                  const remaining = deadlineSec - elapsed;
                  const isOver = remaining <= 0;
                  const inBuffer = isOver && elapsed <= (deadlineSec + bufferSec);
                  const overBuffer = elapsed > (deadlineSec + bufferSec);
                  const bufferRemaining = (deadlineSec + bufferSec) - elapsed;
                  
                  // Display: if in buffer, show buffer countdown; else show normal
                  const displayRemaining = isOver ? bufferRemaining : remaining;
                  const absRemaining = Math.abs(displayRemaining);
                  const mins = Math.floor(absRemaining / 60);
                  const secs = Math.floor(absRemaining % 60);
                  const progress = Math.min((elapsed / deadlineSec) * 100, 100);
                  const speedKts = Number(flightData.speed) || 0;
                  const hasEta = distanceInfo.remainingNm > 0 && speedKts >= 60;
                  const etaMinutes = hasEta ? Math.round((distanceInfo.remainingNm / speedKts) * 60) : null;
                  const etaDate = hasEta ? new Date(Date.now() + (etaMinutes * 60 * 1000)) : null;
                  const etaClock = etaDate
                    ? etaDate.toLocaleTimeString(lang === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                    : null;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">
                          {inBuffer ? t('deadline_buffer', lang) : overBuffer ? t('deadline_exceeded', lang) : t('deadline_remaining', lang)}
                        </span>
                        <span className={`text-2xl font-mono font-bold ${
                          overBuffer ? 'text-red-400' : inBuffer ? 'text-amber-400' : remaining < 300 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {overBuffer ? '-' : ''}{mins}:{secs.toString().padStart(2, '0')}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2 bg-slate-700" />
                      <div className="flex justify-between mt-2 text-xs text-slate-500">
                        <span>0 min</span>
                        <span>{deadlineMin} min {inBuffer ? '+ 5 min Puffer' : ''}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        <span className="text-slate-500">{t('eta', lang)}: </span>
                        {hasEta ? (
                          <span className="font-mono text-slate-300">
                            {etaClock}
                            {etaMinutes >= 60 ? ` (${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m)` : ` (${etaMinutes}m)`}
                          </span>
                        ) : (
                          <span>{t('eta_unavailable', lang)}</span>
                        )}
                      </p>
                      {inBuffer && (
                        <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {t('deadline_exceeded_buffer', lang)}
                        </p>
                      )}
                      {overBuffer && (
                        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {t('deadline_buffer_expired', lang)}
                        </p>
                      )}
                      {!isOver && remaining < 300 && (
                        <p className="text-xs text-amber-400 mt-2">{t('less_than_5_min', lang)}</p>
                      )}
                    </div>
                  );
                })()}
              </Card>
            )}

            {/* Fuel & Status with Arrival Prediction */}
            <FuelPrediction
              flightData={flightData}
              flightStartTime={flightStartTime}
              distanceInfo={distanceInfo}
              flight={flight}
              existingFlight={existingFlight}
              xplaneRawData={xplaneLog?.raw_data || null}
            />

            {/* Flight Score & Events */}
            {flightPhase !== 'preflight' && (
              <Card className="p-6 bg-slate-950/80 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-cyan-400">
                  <Star className="w-5 h-5 text-cyan-400" />
                  {t('flight_score', lang)}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{t('score', lang)}</span>
                    <span className={`text-2xl font-bold ${
                      flightData.flightScore >= 95 ? 'text-emerald-400' :
                      flightData.flightScore >= 85 ? 'text-green-400' :
                      flightData.flightScore >= 70 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {Math.round(flightData.flightScore)}
                    </span>
                  </div>
                  <Progress value={flightData.flightScore} className="h-2 bg-slate-700" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{t('status', lang)}</span>
                    <Badge className={`${
                      flightData.flightScore >= 95 ? 'bg-emerald-500/20 text-emerald-400' :
                      flightData.flightScore >= 85 ? 'bg-green-500/20 text-green-400' :
                      flightData.flightScore >= 70 ? 'bg-amber-500/20 text-amber-400' :
                      flightData.flightScore >= 50 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {flightData.flightScore >= 95 ? t('excellent_rating', lang) :
                      flightData.flightScore >= 85 ? t('very_good_rating', lang) :
                      flightData.flightScore >= 70 ? t('acceptable_rating', lang) :
                      flightData.flightScore >= 50 ? t('poor_rating', lang) :
                      t('poor_rating', lang)}
                    </Badge>
                  </div>
                  {flightData.maintenanceCost > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700">
                      <span className="text-slate-400">{t('maint_cost_label', lang)}</span>
                      <span className="text-red-400 font-mono">${Math.round(flightData.maintenanceCost).toLocaleString()}</span>
                    </div>
                  )}
                  {flightData.landingBonus > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700">
                      <span className="text-slate-400">{t('landing_bonus', lang)}</span>
                      <span className="text-emerald-400 font-mono">+${Math.round(flightData.landingBonus).toLocaleString()}</span>
                    </div>
                  )}

                  {/* Events */}
                  {Object.entries(flightData.events).some(([_, val]) => val === true) && (
                    <div className="pt-3 border-t border-slate-700">
                      <p className="text-xs text-slate-500 mb-2">{t('incidents', lang)}:</p>
                      <div className="space-y-1">
                        {flightData.events.tailstrike === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('tailstrike', lang)} (-20)
                          </div>
                        )}
                        {flightData.events.stall === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('stall', lang)} (-50)
                          </div>
                        )}
                        {flightData.events.overstress === true && (
                          <div className="text-xs text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('structural_stress', lang)} (-30)
                          </div>
                        )}
                        {flightData.events.overspeed === true && (
                         <div className="text-xs text-orange-400 flex items-center gap-1">
                           <AlertTriangle className="w-3 h-3" />
                           {t('overspeed', lang)} (-15)
                         </div>
                        )}
                        {flightData.events.flaps_overspeed === true && (
                         <div className="text-xs text-orange-400 flex items-center gap-1">
                           <AlertTriangle className="w-3 h-3" />
                           {t('flaps_overspeed', lang)} (-{settings?.flaps_overspeed_score_penalty || 15})
                         </div>
                        )}
                        {flightData.events.gear_up_landing === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('gear_up_landing', lang)} (-35)
                          </div>
                        )}
                        {flightData.events.crash === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('crash_detected', lang)} (-100)
                          </div>
                        )}
                        {flightData.events.harsh_controls === true && (
                          <div className="text-xs text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('harsh_controls', lang)}
                          </div>
                        )}
                        {flightData.events.high_g_force === true && (
                          <div className="text-xs text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('high_g_forces', lang)}
                          </div>
                        )}
                        {flightData.events.hard_landing === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{t('hard_landing', lang)}</div>
                        )}
                        {flightData.events.wrong_airport === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{lang === 'de' ? 'Falscher Flughafen! (>=10 NM)' : 'Wrong airport! (>=10 NM)'}</div>
                        )}
                        </div>
                        </div>
                        )}
                </div>
              </Card>
            )}

            {/* Controls */}
            {flightPhase !== 'completed' && (
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-emerald-400"><PlaneTakeoff className="w-5 h-5 text-emerald-400" />{t('flight_control', lang)}</h3>
                {flightPhase === 'preflight' && (
                  <div className="space-y-4">
                    <Button 
                      onClick={() => {
                        startFlightMutation.mutate();
                      }}
                      disabled={startFlightMutation.isPending}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 h-12"
                    >
                      <PlaneTakeoff className="w-5 h-5 mr-2" />
                      {startFlightMutation.isPending ? t('starting', lang) : t('start_flight', lang)}
                    </Button>
                    <p className="text-sm text-slate-400 text-center">
                      {t('click_start_then_xplane', lang)}
                    </p>
                  </div>
                )}
                
                {flightPhase === 'takeoff' && !flightData.wasAirborne && (
                  <div className="p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Plane className="w-6 h-6 text-amber-400" />
                        </motion.div>
                      </div>
                      <div>
                        <p className="font-medium text-amber-200 mb-1">{t('waiting_for_xplane', lang)}</p>
                        <p className="text-sm text-amber-300/70">
                          {t('start_in_xplane', lang)} <span className="font-mono font-bold text-amber-200">{contract?.departure_airport}</span>
                        </p>
                        {company?.xplane_connection_status !== 'connected' && (
                          <p className="text-sm text-red-400 mt-2 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            {t('xplane_not_connected', lang)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {flightPhase !== 'preflight' && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400">
                      {flightPhase === 'takeoff' && flightData.wasAirborne && t('climbing_to_cruise', lang)}
                      {flightPhase === 'cruise' && t('flight_controlled_xplane', lang)}
                      {flightPhase === 'landing' && t('land_and_park', lang)}
                    </p>
                    {/* Emergency Landing Button */}
                    {flightData.wasAirborne && !emergencyLanding && (
                      <Button onClick={() => { setEmergencyLanding(true); }} className="w-full bg-amber-700 hover:bg-amber-600 text-white">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        {lang === 'de' ? 'Notlandung erklären' : 'Declare Emergency Landing'}
                      </Button>
                    )}
                    {emergencyLanding && (
                      <div className="p-2 bg-amber-900/30 border border-amber-700/50 rounded text-xs text-amber-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {lang === 'de' ? 'Notlandung erklaert - Landung >=10 NM entfernt erlaubt, aber -30 Score und nur 30% Payout' : 'Emergency declared - off-airport landing >=10 NM allowed, but -30 score and only 30% payout'}
                      </div>
                    )}
                    <Button
                      onClick={() => {
                        if (confirm(lang === 'de'
                          ? 'Test-Fehler auslosen? Das setzt Triebwerksschaden auf 100% fur diesen Flug.'
                          : 'Trigger test failure? This sets engine damage to 100% for this flight.')) {
                          triggerEngineFailureMutation.mutate();
                        }
                      }}
                      disabled={triggerEngineFailureMutation.isPending}
                      className="w-full bg-red-900/70 hover:bg-red-800 text-red-100 border border-red-700/60"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      {triggerEngineFailureMutation.isPending
                        ? (lang === 'de' ? 'Test-Fehler wird gesetzt...' : 'Setting test failure...')
                        : (lang === 'de' ? 'Test: Triebwerksausfall auslosen' : 'Test: Trigger engine failure')}
                    </Button>
                    <Button onClick={() => { if (confirm(`${t('cancel_confirm', lang)} $${(contract?.payout * 0.3 || 5000).toLocaleString()}`)) cancelFlightMutation.mutate(); }} disabled={cancelFlightMutation.isPending} variant="destructive" className="w-full">
                      {cancelFlightMutation.isPending ? t('cancelling', lang) : t('cancel_flight', lang)}
                    </Button>
                  </div>
                )}
              </Card>
            )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
            {flightPhase === 'completed' ? (
              <>
                <FlightRating 
                  flight={(() => {
                    const xpd = (flight || existingFlight)?.xplane_data || {};
                    const initFuel = Number(xpd.initial_fuel_kg || 0);
                    let curFuel = Number(flightData.fuelKg || xpd.fuel_kg || xpd.last_valid_fuel_kg || 0);
                    const fuelPct = Number(flightData.fuel || xpd.fuel_percentage || 0);
                    if (initFuel > 0 && fuelPct > 0 && fuelPct <= 100) {
                      const pctDerived = (initFuel * fuelPct) / 100;
                      if (curFuel <= 0 || Math.abs(curFuel - pctDerived) > (initFuel * 0.55)) {
                        curFuel = pctDerived;
                      }
                    }
                    if (initFuel > 0) {
                      curFuel = Math.min(curFuel, initFuel);
                    }
                    const fuelUsedKg = Math.max(0, initFuel - curFuel);
                    const fuelUsed = fuelUsedKg * 1.25;
                    const fuelCost = fuelUsed * 1.2;
                    const flightHours = flightStartTime ? (Date.now() - flightStartTime) / 3600000 : (contract?.distance_nm ? contract.distance_nm / 450 : 2);
                    const crewCost = flightHours * 250;
                    const airportFee = 150;
                    const isCrashed = flightData.events.crash || flightData.events.wrong_airport;
                    let revenue = 0;
                    if (!isCrashed) {
                      revenue = contract?.payout || 0;
                      revenue += flightData.landingBonus || 0;
                    }
                    const directCosts = fuelCost + crewCost + airportFee;
                    const profit = revenue - directCosts;
                    const levelBonusPercent = (company?.level || 1) * 0.01;
                    const levelBonus = profit > 0 ? profit * levelBonusPercent : 0;
                    return {
                      flight_score: flightData.flightScore,
                      landing_vs: flightData.landingVs,
                      max_g_force: flightData.maxGForce,
                      fuel_used_liters: fuelUsed,
                      flight_duration_hours: flightHours,
                      passenger_comments: generatePassengerComments(flightData.flightScore, flightData),
                      xplane_data: {
                        final_score: flightData.flightScore,
                        landingGForce: flightData.landingGForce,
                        events: flightData.events,
                        levelBonus,
                        levelBonusPercent: levelBonusPercent * 100,
                        companyLevel: company?.level || 1,
                        landingScoreChange: flightData.landingScoreChange,
                        landingBonus: flightData.landingBonus,
                        landingMaintenanceCost: flightData.landingMaintenanceCost
                      },
                      revenue,
                      fuel_cost: fuelCost,
                      crew_cost: crewCost,
                      maintenance_cost: flightData.maintenanceCost,
                      profit: profit + levelBonus
                    };
                  })()} 
                />

                {!completeFlightMutation.isSuccess && (
                  <Button 
                    onClick={() => completeFlightMutation.mutate()}
                    disabled={completeFlightMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-12"
                  >
                    {completeFlightMutation.isPending ? t('saving', lang) : t('complete_flight', lang)}
                  </Button>
                )}

                {completeFlightMutation.isSuccess && (
                  <Button 
                    variant="outline"
                    onClick={() => navigate(createPageUrl("Dashboard"))}
                    className="w-full border-slate-600 text-white hover:bg-slate-700"
                  >
                    {t('back_to_dashboard', lang)}
                  </Button>
                )}
              </>
            ) : (
              <>
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-400">
                  <Star className="w-5 h-5 text-amber-400" />
                  {t('passenger_satisfaction', lang)}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{t('max_g_so_far', lang)}</span>
                    <span className={`font-mono ${
                      flightData.maxGForce < 1.3 ? 'text-emerald-400' :
                      flightData.maxGForce < 1.8 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {flightData.maxGForce.toFixed(2)} G
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {t('keep_g_low', lang)}
                  </p>
                </div>
              </Card>

              {/* Weather Display */}
              <WeatherDisplay raw={xplaneLog?.raw_data} />

              {/* Raw X-Plane Data - moved to XPlaneDebug page */}
              </>
            )}
          </div>
        </div>
        )}

        {contract && (
          <div className="space-y-6 mt-6">
            <FlightMapIframe
              key={`map-${contractIdFromUrl}`}
              flightData={flightData}
              contract={contract}
              waypoints={xplaneLog?.raw_data?.fms_waypoints || []}
              routeWaypoints={simbriefRoute?.waypoints || []}
              flightPath={mapFlightPath}
              flightEventsLog={mapFlightEventsLog}
              departureRunway={simbriefRoute?.departure_runway}
              arrivalRunway={simbriefRoute?.arrival_runway}
              departureCoords={simbriefRoute?.departure_coords}
              arrivalCoords={simbriefRoute?.arrival_coords}
              onViewModeChange={null}
              liveFlightData={{
                gForce: flightData.gForce, maxGForce: flightData.maxGForce,
                fuelPercent: flightData.fuel, fuelKg: flightData.fuelKg,
                flightScore: flightData.flightScore, events: flightData.events, wasAirborne: flightData.wasAirborne,
                weather: xplaneLog?.raw_data ? { wind_speed_kts: xplaneLog.raw_data.wind_speed_kts, wind_direction: xplaneLog.raw_data.wind_direction, rain_intensity: xplaneLog.raw_data.rain_intensity, precipitation: xplaneLog.raw_data.precipitation, precip_rate: xplaneLog.raw_data.precip_rate, oat_c: xplaneLog.raw_data.oat_c, tat_c: xplaneLog.raw_data.tat_c, baro_setting: xplaneLog.raw_data.baro_setting, turbulence: xplaneLog.raw_data.turbulence } : null
              }}
            />
            <SimBriefImport
              key={`simbrief-${contractIdFromUrl}`}
              contract={contract}
              onRouteLoaded={(data) => {
                const normalizedSimbrief = {
                  ...(data || {}),
                  aircraft_icao:
                    data?.aircraft_icao ||
                    data?.raw_general?.icao_aircraft ||
                    data?.raw_general?.aircraft_icao ||
                    data?.raw_general?.aircraft_type ||
                    null
                };
                setSimbriefRoute(normalizedSimbrief);
                if (activeFlightId && data?.waypoints?.length) {
                  // Persist SimBrief route on the active flight so backend/plugin can reuse it for HUD distance.
                  base44.entities.Flight.update(activeFlightId, {
                    xplane_data: {
                      ...((flight || existingFlight)?.xplane_data || {}),
                      simbrief_waypoints: data.waypoints || [],
                      simbrief_route_string: data.route_string || null,
                      simbrief_departure_coords: data.departure_coords || null,
                      simbrief_arrival_coords: data.arrival_coords || null
                    }
                  }).catch(() => {});
                }
              }}
            />
            <TakeoffLandingCalculator
              aircraft={aircraft?.find(a => a.id === (flight?.aircraft_id || existingFlight?.aircraft_id))}
              contract={contract}
              xplaneData={xplaneLog?.raw_data}
              simbriefData={simbriefRoute}
            />
          </div>
        )}
      </div>
      <AnimatePresence>
        {showAutoCompleteOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <div className="w-full max-w-xl text-center bg-slate-900/90 border border-cyan-800/50 rounded-2xl p-8 shadow-2xl">
              <motion.div
                className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-cyan-700/40 border-t-cyan-300"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <h2 className="text-2xl font-bold text-cyan-300 mb-3">
                {lang === 'de' ? 'Flug wird automatisch abgeschlossen' : 'Auto-completing flight'}
              </h2>
              <p className="text-slate-300 text-base">
                {lang === 'de'
                  ? 'Bitte warten. Du wirst automatisch zur Ergebnisseite weitergeleitet.'
                  : 'Please wait. You will be redirected to the results page automatically.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
