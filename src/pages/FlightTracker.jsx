import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
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
import TakeoffLandingCalculator from "@/components/flights/TakeoffLandingCalculator";
import SimBriefImport from "@/components/flights/SimBriefImport";
import { calculateDeadlineMinutes } from "@/components/flights/aircraftSpeedLookup";

export default function FlightTracker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [flightPhase, setFlightPhase] = useState('preflight');
  const [flight, setFlight] = useState(null);
  const [flightStartTime, setFlightStartTime] = useState(null);
  const [flightDurationSeconds, setFlightDurationSeconds] = useState(0);
  const [processedGLevels, setProcessedGLevels] = useState(new Set());
  const [isCompletingFlight, setIsCompletingFlight] = useState(false);
  const [flightStartedAt, setFlightStartedAt] = useState(null); // Timestamp when flight was started, to ignore old logs
  const flightDataRef = React.useRef(null);

  // Parse URL parameters for contractId
  const urlParams = new URLSearchParams(window.location.search);
  const contractIdFromUrl = urlParams.get('contractId');

  const [flightData, setFlightData] = useState({
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
    landingType: null,
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
      flaps_overspeed: false,
      fuel_emergency: false,
      gear_up_landing: false,
      crash: false,
      harsh_controls: false,
      high_g_force: false,
      hard_landing: false
      },
    maxControlInput: 0,
    departure_lat: 0,
    departure_lon: 0,
    arrival_lat: 0,
    arrival_lon: 0,
    wasAirborne: false,
    previousSpeed: 0
  });

  const generateComments = (score, data) => {
    // Helper: pick N random items from an array
    const pickRandom = (arr, n) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(n, arr.length));
    };

    const comments = [];
    
    if (data.events.crash) {
      const crashPool = [
        "Flugzeug zerstört! Nie wieder mit dieser Airline!",
        "Das war die schlimmste Erfahrung meines Lebens.",
        "Ich bin froh, dass ich überlebt habe...",
        "Meine Familie wird von meinem Anwalt hören!",
        "Ich zittere immer noch am ganzen Körper.",
        "Das war kein Flug, das war ein Albtraum!",
        "Ich habe mein Testament geschrieben während wir gefallen sind.",
        "Die Sauerstoffmasken sind runtergefallen - totale Panik!",
        "Mein Leben ist an mir vorbeigeflogen. Buchstäblich.",
        "Ich werde nie wieder ein Flugzeug betreten!",
        "Haben die überhaupt einen Pilotenschein?!",
        "Das war versuchter Mord mit einem Flugzeug!",
        "Meine Kinder haben geweint, meine Frau hat geschrien.",
        "Der Aufprall war so heftig, mein Handy ist zerbrochen.",
        "Ich brauche jetzt erstmal eine Therapie.",
      ];
      return pickRandom(crashPool, 4);
    }

    // Landing quality-based comments
    const butterPool = [
      "Butterweiche Landung! Das war professionell!",
      "Ich habe kaum bemerkt, dass wir gelandet sind - perfekt!",
      "So muss eine Landung sein! Chapeau, Kapitän!",
      "Mein Kaffee stand noch aufrecht - unglaublich sanft!",
      "Ich dachte, wir fliegen noch - erst als die Bremsen kamen, merkte ich es.",
      "Das war die sanfteste Landung meines Lebens!",
      "Wie auf einer Wolke gelandet. Meisterleistung!",
      "Der Pilot könnte auch eine Feder landen, ohne sie zu knicken.",
      "Standing Ovation in der Kabine! Alle haben geklatscht!",
      "Meine Oma hätte nicht gemerkt, dass wir gelandet sind.",
      "Wie Butter auf heißem Toast - perfekt!",
      "Die Landung war so sanft, mein Baby hat weitergeschlafen.",
      "Besser als jeder Langstreckenflug, den ich je hatte!",
      "Ich glaube, der Pilot hat ein Gefühl wie ein Chirurg.",
    ];

    const softPool = [
      "Sehr sanfte Landung, ausgezeichnet!",
      "Der Pilot weiß, wie man landen muss.",
      "Angenehme Landung, meine Kinder haben nicht mal aufgewacht.",
      "Gute Landung! Kaum Erschütterung.",
      "Sanftes Aufsetzen - genau so soll es sein.",
      "Professionelle Landung, ich bin beeindruckt.",
      "Man merkt, dass der Pilot Erfahrung hat.",
      "Angenehm sanft, wie auf einer Matratze gelandet.",
      "Schöne Landung, da kann man sich wohlfühlen.",
      "Nicht ganz Butter, aber sehr nah dran!",
      "Guter Pilot - die Landung war toll.",
    ];

    const acceptablePool = [
      "Ganz normale Landung, nichts besonderes.",
      "Alles in Ordnung, solide gelandet.",
      "Standard-Landung, kein Grund zur Beschwerde.",
      "Okay, hat funktioniert. Mehr gibt's nicht zu sagen.",
      "Normale Landung - nicht schlecht, nicht überragend.",
      "Bin heil angekommen, das zählt.",
      "Durchschnittliche Landung, alles im Rahmen.",
      "Passt schon, war jetzt nicht außergewöhnlich.",
      "Solide Arbeit, man hat den Boden gespürt.",
      "In Ordnung. Würde wieder fliegen.",
    ];

    const hardPool = [
      "Die Landung war ziemlich hart...",
      "Mein Getränk ist umgekippt!",
      "Mein Rücken tut weh nach dieser Landung.",
      "Das Fahrwerk hat laut geknallt - war das normal?!",
      "Autsch! Das hat ordentlich gerüttelt.",
      "Mein Gepäck ist im Fach verrutscht bei dem Aufprall.",
      "Ich hoffe, das Flugzeug hat das überlebt...",
      "Da hat wohl jemand den Boden verwechselt mit einer Landebahn.",
      "Mein Nacken tut weh - das war zu hart!",
      "Haben wir auf der Landebahn oder daneben aufgesetzt?",
      "Das war eher ein Aufprall als eine Landung.",
      "Meine Zähne haben geklickert bei dem Stoß!",
      "Der Steward hat seinen Trolley verloren bei der Landung.",
      "Ich glaube, mein Koffer ist jetzt flacher als vorher.",
    ];

    const veryHardPool = [
      "Das war eine brutale Landung!",
      "Ich bin mir nicht sicher, ob das sicher war.",
      "Mein Gepäck ist aus dem Fach gefallen!",
      "Sind die Reifen noch dran?!",
      "Das Flugzeug hat gezittert wie verrückt!",
      "Mein Sitz hat sich verschoben - das geht doch nicht!",
      "Ich habe mir den Kopf am Vordersitz gestoßen!",
      "Das war keine Landung, das war ein kontrollierter Absturz!",
      "Die Sauerstoffmasken sind fast runtergefallen!",
      "Meine Knie sind blau von dem Aufprall!",
      "Hat der Pilot die Landung in einer Simulation gelernt?!",
      "Ich brauche nach dieser Landung einen Chiropraktiker.",
      "Das Flugzeug braucht definitiv eine Inspektion nach dem...",
    ];

    if (data.landingType === 'butter') comments.push(...pickRandom(butterPool, 3));
    else if (data.landingType === 'soft') comments.push(...pickRandom(softPool, 2));
    else if (data.landingType === 'acceptable') comments.push(...pickRandom(acceptablePool, 2));
    else if (data.landingType === 'hard') comments.push(...pickRandom(hardPool, 3));
    else if (data.landingType === 'very_hard') comments.push(...pickRandom(veryHardPool, 3));

    // G-force based comments
    const gExtremePool = [
      "Mir wurde bei den extremen Manövern richtig schlecht.",
      "Ich dachte, ich bin in einer Achterbahn und nicht im Flugzeug!",
      "Mein Magen hat sich mehrfach umgedreht.",
      "Die Kinder neben mir haben alle geweint.",
      "Ich habe in die Tüte gegeben, kein Scherz.",
      "So viel G-Kraft habe ich nicht mal im Freizeitpark erlebt!",
    ];
    const gHighPool = [
      "Die Manöver waren viel zu heftig für einen normalen Flug.",
      "Bei den Kurven hat es mich ordentlich in den Sitz gedrückt.",
      "Die Turbulenz war heftig - oder war das der Pilot?",
      "Mein Getränk ist bei einem Manöver komplett ausgelaufen.",
    ];
    const gModeratePool = [
      "Es war ziemlich wackelig während des Fluges.",
      "Ein paar Turbulenzen, aber ging gerade so.",
      "Etwas unruhig zwischendurch, aber überlebbar.",
    ];
    const gSmoothPool = [
      "Sehr angenehmer, sanfter Flug. Wie auf Wolken!",
      "Ruhigster Flug, den ich je hatte!",
      "Null Turbulenzen, absolut genial!",
      "Ich konnte in Ruhe lesen, so ruhig war der Flug.",
      "Traumhaft ruhig - wie im Schlafwagen!",
    ];
    const gGoodPool = [
      "Ruhiger Flug, gut gemacht.",
      "Kaum Turbulenzen, angenehm.",
      "Entspannter Flug, gerne wieder.",
    ];

    if (data.maxGForce > 2.5) comments.push(...pickRandom(gExtremePool, 2));
    else if (data.maxGForce > 2.0) comments.push(...pickRandom(gHighPool, 1));
    else if (data.maxGForce > 1.8) comments.push(...pickRandom(gModeratePool, 1));
    else if (data.maxGForce < 1.2) comments.push(...pickRandom(gSmoothPool, 2));
    else if (data.maxGForce < 1.3) comments.push(...pickRandom(gGoodPool, 1));

    // Overall score-based comments
    const score95Pool = [
      "Perfekter Flug! Werde diese Airline weiterempfehlen!",
      "5 Sterne! Besser geht es nicht.",
      "Absolut erstklassig! Buche sofort den nächsten Flug!",
      "Das war Premium-Service - besser als manche Businessclass!",
      "Wow, diese Airline hat mich überzeugt!",
      "Von der Begrüßung bis zur Landung: makellos.",
      "Mein neuer Favorit unter den Airlines!",
      "Ich bin begeistert. Perfekt von Anfang bis Ende.",
    ];
    const score85Pool = [
      "Sehr guter Service, gerne wieder.",
      "Professionelle Crew, angenehmer Flug.",
      "Guter Flug, keine Beschwerden!",
      "Empfehlenswert! Gutes Preis-Leistungs-Verhältnis.",
      "Solider Service, kompetente Crew.",
      "War ein schöner Flug, vielen Dank!",
      "4 Sterne - fast perfekt!",
    ];
    const score70Pool = [
      "Solider Flug, nichts zu beanstanden.",
      "War in Ordnung, durchschnittlich halt.",
      "Ging so - weder gut noch schlecht.",
      "Mittelmaß, aber akzeptabel.",
      "Okay, aber ich habe schon bessere Flüge erlebt.",
    ];
    const score50Pool = [
      "Es war okay, aber es gibt Verbesserungspotenzial.",
      "Nicht der beste Flug, den ich je hatte...",
      "Naja, angekommen sind wir immerhin.",
      "Könnte definitiv besser sein.",
      "Bin nicht wirklich zufrieden mit dem Flug.",
      "Mal schauen, ob ich nächstes Mal eine andere Airline nehme.",
    ];
    const score30Pool = [
      "Ich buche nie wieder bei dieser Airline.",
      "Katastrophal. Ich habe Angst gehabt.",
      "Das war eine Zumutung für jeden Passagier.",
      "Unfassbar schlecht. Null Professionalität!",
      "Meine schlechteste Flugerfahrung überhaupt.",
      "Ich verlange eine Rückerstattung!",
    ];
    const scoreWorstPool = [
      "Nie wieder! Das war lebensgefährlich!",
      "Ich stelle eine Beschwerde bei der Luftfahrtbehörde!",
      "Die sollten den Pilotenschein abgeben!",
      "Dieser Airline gehört die Lizenz entzogen!",
      "Das war eine Gefährdung aller Passagiere!",
      "Ich kann nicht glauben, dass das legal war.",
    ];

    if (score >= 95) comments.push(...pickRandom(score95Pool, 2));
    else if (score >= 85) comments.push(...pickRandom(score85Pool, 2));
    else if (score >= 70) comments.push(...pickRandom(score70Pool, 1));
    else if (score >= 50) comments.push(...pickRandom(score50Pool, 2));
    else if (score >= 30) comments.push(...pickRandom(score30Pool, 2));
    else comments.push(...pickRandom(scoreWorstPool, 2));

    // Event-based comments
    const tailstrikePool = [
      "Ich habe gehört, wie das Heck aufgesetzt hat - furchtbar!",
      "Beim Start hat es laut gekracht am Heck...",
      "Was war das für ein Geräusch hinten?! Das klang nach Metall!",
      "Das Heck hat den Boden berührt - das ist doch gefährlich!",
      "Ein lauter Schlag am Heck - ich dachte, wir brechen auseinander!",
    ];
    const stallPool = [
      "Das Flugzeug ist plötzlich abgesackt! Panik an Bord!",
      "Strömungsabriss?! Das darf nicht passieren!",
      "Wir sind plötzlich gefallen wie ein Stein!",
      "Für einen Moment dachte ich, das war's...",
      "Alle haben geschrien, als das Flugzeug absackte!",
      "Mein Herz hat ausgesetzt, als wir plötzlich gefallen sind!",
    ];
    const overstressPool = [
      "Das Flugzeug hat beängstigende Geräusche gemacht...",
      "Es hat geknackt und geächzt - das kann nicht normal sein!",
      "Die Tragflächen haben sich so stark gebogen, ich hatte Angst!",
      "Das Flugzeug hat gezittert wie verrückt!",
    ];
    const flapsPool = [
      "Die Klappen haben komische Geräusche gemacht bei der Geschwindigkeit.",
      "Irgendwas an den Flügeln hat laut gerattert...",
      "Das klang, als würde etwas am Flügel abreißen!",
      "Warum waren die Klappen bei dieser Geschwindigkeit draußen?!",
    ];
    const hardLandingPool = [
      "Meine Knochen vibrieren noch von dieser Landung.",
      "Bei der Landung habe ich meinen Kaffee verloren.",
      "Das Fahrwerk hat laut gescheppert!",
      "Mein ganzer Körper tut weh nach dieser Landung.",
      "Hat der Pilot die Landebahn treffen wollen oder den Planeten?",
    ];
    const fuelPool = [
      "Wir hatten kaum noch Treibstoff?! Das ist unverantwortlich!",
      "Der Pilot hat es auf den letzten Tropfen ankommen lassen!",
      "Fast kein Sprit mehr?! Das ist doch wahnsinnig!",
      "Ich habe gehört, dass wir fast keinen Treibstoff mehr hatten!",
    ];
    const gearUpPool = [
      "Er ist OHNE Fahrwerk gelandet?! Unfassbar!",
      "Die Funken auf der Landebahn werde ich nie vergessen!",
      "Bauchlanden ist für mich ab heute kein Fremdwort mehr.",
      "Das Kreischen des Metalls auf dem Asphalt... schrecklich!",
    ];

    if (data.events.tailstrike) comments.push(...pickRandom(tailstrikePool, 2));
    if (data.events.stall) comments.push(...pickRandom(stallPool, 2));
    if (data.events.overstress) comments.push(...pickRandom(overstressPool, 1));
    if (data.events.flaps_overspeed) comments.push(...pickRandom(flapsPool, 1));
    if (data.events.hard_landing) comments.push(...pickRandom(hardLandingPool, 1));
    if (data.events.fuel_emergency && data.fuel < 3) comments.push(...pickRandom(fuelPool, 1));
    if (data.events.gear_up_landing) comments.push(...pickRandom(gearUpPool, 1));

    return comments;
  };

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
    enabled: !!contractIdFromUrl
  });

  // Derive the active flight ID - either from state (after startFlight) or from existingFlight query
  // This avoids the async state update delay problem
  const activeFlightId = flight?.id || existingFlight?.id;

  // Live data - direct polling only (subscriptions add overhead and latency)
  const [xplaneLog, setXplaneLog] = useState(null);
  const pollActiveRef = React.useRef(false);
  
  useEffect(() => {
    if (flightPhase === 'completed') return;
    if (!activeFlightId) return;
    
    let isMounted = true;
    
    const fetchData = async () => {
      if (pollActiveRef.current || !isMounted) return;
      pollActiveRef.current = true;
      try {
        const flights = await base44.entities.Flight.filter({ id: activeFlightId });
        const currentFlight = flights[0];
        if (currentFlight?.xplane_data && isMounted) {
          setXplaneLog({ raw_data: currentFlight.xplane_data, created_date: currentFlight.updated_date });
        }
      } catch (e) { /* ignore */ }
      pollActiveRef.current = false;
    };
    
    fetchData();
    const interval = setInterval(fetchData, 1500);
    
    return () => { isMounted = false; clearInterval(interval); };
  }, [activeFlightId, flightPhase]);

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
          tailstrike: false, stall: false, overstress: false,
          flaps_overspeed: false, fuel_emergency: false, gear_up_landing: false,
          crash: false, harsh_controls: false, high_g_force: false, hard_landing: false
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
    staleTime: 10000, // Moderate cache - company data needed for connection status
  });

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
    staleTime: 30000, // Aircraft data rarely changes during flight
  });

  const { data: settings } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const allSettings = await base44.entities.GameSettings.list();
      return allSettings[0] || null;
    },
    staleTime: 300000, // Settings rarely change
  });

  // Find the assigned aircraft for this flight
  const assignedAircraft = aircraft?.find(a => a.id === (flight?.aircraft_id || existingFlight?.aircraft_id));

  // SimBrief route data
  const [simbriefRoute, setSimbriefRoute] = useState(null);

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
          flaps_overspeed: false,
          fuel_emergency: false,
          gear_up_landing: false,
          crash: false,
          harsh_controls: false,
          high_g_force: false,
          hard_landing: false
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
     
     // Use the latest flightData from ref to ensure all events are captured
     let finalFlightData = flightDataRef.current || flightData;
     
     // KRITISCH: Wenn Crash erkannt wurde (egal ob im State oder via has_crashed), 
     // stelle sicher dass das crash-Event gesetzt ist
     if (finalFlightData.events && !finalFlightData.events.crash) {
       // Prüfe ob ein Crash über andere Wege erkannt wurde
       const latestXPlane = activeFlight?.xplane_data;
       if (latestXPlane?.has_crashed) {
         finalFlightData = {
           ...finalFlightData,
           events: { ...finalFlightData.events, crash: true }
         };
       }
     }
     
     // Realistic cost calculations based on aviation industry
     // Use actual X-Plane fuel data: initial_fuel_kg - current fuel_kg
     const xpData = activeFlight?.xplane_data || {};
     const initialFuelKg = xpData.initial_fuel_kg || 0;
     const currentFuelKg = finalFlightData.fuelKg || xpData.fuel_kg || 0;
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
     const madeDeadline = flightHours <= deadlineHours;

     if (madeDeadline) {
       timeScoreChange = 20; // +20 score for making the deadline
     } else {
       timeScoreChange = -20; // -20 score for missing the deadline
     }

     const crewCostPerHour = 250; // $250 per flight hour (captain + first officer)
     const crewCost = flightHours * crewCostPerHour;

     // Maintenance cost per flight hour + event-based costs
     const maintenanceCostPerHour = 400; // $400 per flight hour
     const maintenanceCost = (flightHours * maintenanceCostPerHour) + finalFlightData.maintenanceCost;

     // Landing and airport fees
     const airportFee = 150;

      // Check for crash
      const hasCrashed = finalFlightData.events.crash;

     // Bei Crash: KEIN Payout und KEIN Bonus
     let revenue = 0;
     let landingBonusUsed = 0;
     let landingPenaltyUsed = 0;
     if (!hasCrashed) {
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
       // Add time bonus
       revenue += timeBonus;
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
            
            const scoreWithTime = hasCrashed ? 0 : Math.max(0, Math.min(100, adjustedFlightScore + timeScoreChange));

            console.log('🎯 SCORE BERECHNUNG:', {
             baseScore: finalFlightData.flightScore,
             adjustedFlightScore,
             landingScoreChange,
             timeScoreChange,
             finalScoreWithTime: scoreWithTime,
             hasCrashed,
             events: finalFlightData.events,
             landingType: finalFlightData.landingType
            });

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
            
            await base44.entities.Flight.update(activeFlight.id, {
              status: hasCrashed ? 'failed' : 'completed',
              arrival_time: new Date().toISOString(),
              flight_score: scoreWithTime,
              takeoff_rating: scoreToRating(scoreWithTime),
              flight_rating: scoreToRating(scoreWithTime),
              landing_rating: scoreToRating(scoreWithTime),
              overall_rating: scoreToRating(scoreWithTime),
              landing_vs: finalFlightData.landingVs,
              max_g_force: finalFlightData.maxGForce,
              fuel_used_liters: fuelUsed,
              fuel_cost: fuelCost,
              crew_cost: crewCost,
              maintenance_cost: (flightHours * maintenanceCostPerHour) + totalMaintenanceCostWithCrash,
              flight_duration_hours: flightHours,
              revenue,
              profit,
              passenger_comments: generateComments(scoreWithTime, finalFlightData),
              xplane_data: {
                ...finalFlightData,
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
                events: finalFlightData.events,
                crashMaintenanceCost: crashMaintenanceCost
              }
            });

            // Update contract
            console.log('Aktualisiere Contract Status:', activeFlight.contract_id, hasCrashed ? 'failed' : 'completed');
            await base44.entities.Contract.update(activeFlight.contract_id, { status: hasCrashed ? 'failed' : 'completed' });

            // Nur tatsächliche Event-Wartungskosten hinzufügen, nicht die normalen Flugstunden-Kosten
            const currentAccumulatedCost = airplaneToUpdate?.accumulated_maintenance_cost || 0;
            const newAccumulatedCost = currentAccumulatedCost + totalMaintenanceCostWithCrash;

            console.log('Wartungskosten Update:', {
              currentAccumulatedCost,
              flightMaintenanceCost: finalFlightData.maintenanceCost,
              crashMaintenanceCost,
              totalMaintenanceCostWithCrash,
              newAccumulatedCost
            });

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
                  const employeeUpdate = {
                    status: 'available',
                    total_flight_hours: (currentEmployee.total_flight_hours || 0) + flightHours
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
              const reputationChange = hasCrashed ? -10 : Math.round((scoreWithTime - 85) / 5);
              
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
    }
  });

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

    // Check for crash via X-Plane dataref - NUR wenn wasAirborne
    if (xp.has_crashed && flightData.wasAirborne) {
    setFlightData(prev => ({
      ...prev,
      events: {
        ...prev.events,
        crash: true
      }
    }));
    }

    setFlightData(prev => {
      const currentGForce = xp.g_force || 1.0;
      const newMaxControlInput = Math.max(prev.maxControlInput, xp.control_input || 0);

      // Track if aircraft was airborne
      const newWasAirborne = prev.wasAirborne || (!xp.on_ground && xp.altitude > 10);

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
          wasAirborne: false,
        };
        flightDataRef.current = groundData;
        return groundData;
      }

      // Ab hier: Flugzeug WAR in der Luft - normale Verarbeitung
      const newMaxGForce = Math.max(prev.maxGForce, currentGForce);

      // Landing detection based on vertical speed
      const currentSpeed = xp.speed || 0;
      // Ensure we capture landing VS properly - preserve after landing
      const touchdownVs = prev.landingType 
        ? prev.landingVs  // Already landed - keep the captured value
        : (xp.landing_vs || xp.touchdown_vspeed || 0);
      // Landing G-force: Capture the ACTUAL g-force at touchdown moment
      // NOT the peak g-force during the entire flight
      // Once landed (landingType set), preserve the captured value
      let landingGForceValue;
      if (prev.landingType) {
        landingGForceValue = prev.landingGForce; // Already landed - keep captured value
      } else if (xp.on_ground && newWasAirborne) {
        // At the moment of touchdown: prefer landing_g_force from plugin (actual touchdown G),
        // then current g_force, but NOT previous peak g_force
        landingGForceValue = xp.landing_g_force || currentGForce;
      } else {
        // Still airborne - don't accumulate peak, just track current for display
        landingGForceValue = 0;
      }

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

      if (landingGForceValue > 0 && xp.on_ground && newWasAirborne && !prev.events.crash && !prev.landingType) {
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
      const isCrash = (landingType === 'crash' || prev.events.crash || (xp.has_crashed && newWasAirborne)) && newWasAirborne;
      
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
        landingVs: touchdownVs !== 0 ? touchdownVs : prev.landingVs,
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
        events: {
         tailstrike: xp.tailstrike || prev.events.tailstrike,
         stall: (xp.stall || xp.is_in_stall || xp.stall_warning || xp.override_alpha) || prev.events.stall,
         overstress: xp.overstress || prev.events.overstress,
          overspeed: xp.overspeed || prev.events.overspeed,
          flaps_overspeed: flapsOverspeedDetected || prev.events.flaps_overspeed,
          fuel_emergency: xp.fuel_emergency || prev.events.fuel_emergency,
          gear_up_landing: xp.gear_up_landing || prev.events.gear_up_landing,
          crash: isCrash,
          harsh_controls: xp.harsh_controls || prev.events.harsh_controls,
          high_g_force: newMaxGForce >= 1.5 || prev.events.high_g_force,
          hard_landing: landingType === 'hard' || landingType === 'very_hard' || prev.events.hard_landing
        },
        maxControlInput: newMaxControlInput,
        wasAirborne: newWasAirborne,
        previousSpeed: currentSpeed
      };
      


      // Update ref with latest data
      flightDataRef.current = newData;

      // Update processed G levels if we processed new ones
      if (newMaxGForce >= 1.5) {
       const currentGLevel = Math.floor(newMaxGForce);
       setProcessedGLevels(prev => {
         const updated = new Set(prev);
         for (let gLevel = 2; gLevel <= currentGLevel; gLevel++) {
           updated.add(gLevel);
         }
         return updated;
       });
      }

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
    
    // flightStartTime kann null sein wenn der Flug wiederhergestellt wurde - dann setze es jetzt
    if (flightData.wasAirborne && !flightStartTime) {
      setFlightStartTime(Date.now());
    }
    
    // Landing detection: aircraft was airborne, is now on ground, in any active flight phase
    // Also detect "ready_to_complete" status from backend (parked with engines off + parking brake)
    const isReadyToComplete = xp.on_ground && flightData.wasAirborne;
    if (isReadyToComplete && (flightPhase === 'takeoff' || flightPhase === 'cruise' || flightPhase === 'landing') && !completeFlightMutation.isPending && !isCompletingFlight) {
      console.log('🛬 LANDUNG ERKANNT (on_ground + ' + flightPhase + ' phase) - Warte auf Flugabschluss');
      setFlightPhase('completed');
      // Delay to ensure the landing score/bonus state update is committed via flightDataRef
      setTimeout(() => {
        completeFlightMutation.mutate();
      }, 500);
    }

    // Auto-complete flight on crash - NUR wenn bereits abgehoben
    if (flightData.events.crash && flightData.wasAirborne && isActivePhase && !completeFlightMutation.isPending && !isCompletingFlight) {
      console.log('💥 CRASH ERKANNT - Starte Flugabschluss');
      setFlightPhase('completed');
      setTimeout(() => {
        completeFlightMutation.mutate();
      }, 200);
    }
  }, [xplaneLog, flight, existingFlight, flightPhase, completeFlightMutation, flightData.altitude, flightData.wasAirborne, flightData.events.crash, flightStartedAt, flightStartTime]);

  // FailuresCard removed - failures are shown in the Events section above
  // No extra DB queries needed

  const phaseLabels = {
    preflight: 'Vorbereitung',
    takeoff: 'Start',
    cruise: 'Reiseflug',
    landing: 'Landeanflug',
    completed: 'Abgeschlossen'
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
    
    const hasCurrentPos = (flightData.latitude !== 0 || flightData.longitude !== 0);
    const hasArrivalCoords = flightData.arrival_lat !== 0 || flightData.arrival_lon !== 0;
    const hasDepartureCoords = flightData.departure_lat !== 0 || flightData.departure_lon !== 0;
    
    if (hasCurrentPos) {
      // Total route distance: prefer calculated from departure->arrival coords, fallback to contract distance_nm
      let totalDistance = contract?.distance_nm || 0;
      
      if (hasArrivalCoords) {
        // We have arrival coordinates - calculate remaining distance directly
        const remainingDistance = calculateHaversineDistance(
          flightData.latitude, flightData.longitude,
          flightData.arrival_lat, flightData.arrival_lon
        );
        
        if (hasDepartureCoords) {
          totalDistance = calculateHaversineDistance(
            flightData.departure_lat, flightData.departure_lon,
            flightData.arrival_lat, flightData.arrival_lon
          );
        }
        
        if (totalDistance <= 0) totalDistance = contract?.distance_nm || remainingDistance;
        
        const progress = ((totalDistance - remainingDistance) / totalDistance) * 100;
        return { 
          progress: Math.max(0, Math.min(100, progress)), 
          remainingNm: Math.max(0, Math.round(remainingDistance)),
          totalNm: Math.round(totalDistance)
        };
      }
      
      // No arrival coords but have current position and departure coords
      // Estimate progress based on distance from departure vs total contract distance
      if (hasDepartureCoords && totalDistance > 0) {
        const flownDistance = calculateHaversineDistance(
          flightData.departure_lat, flightData.departure_lon,
          flightData.latitude, flightData.longitude
        );
        const remainingDistance = Math.max(0, totalDistance - flownDistance);
        const progress = (flownDistance / totalDistance) * 100;
        return {
          progress: Math.max(0, Math.min(100, progress)),
          remainingNm: Math.max(0, Math.round(remainingDistance)),
          totalNm: Math.round(totalDistance)
        };
      }
    }
    
    return { progress: 0, remainingNm: contract?.distance_nm || 0, totalNm: contract?.distance_nm || 0 };
  };

  const distanceInfo = calculateDistanceInfo();
  const distanceProgress = distanceInfo.progress;

  if (flightPhase === 'preflight' && !contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-white mb-4">Vertrag nicht gefunden</p>
          <Button 
            onClick={() => navigate(createPageUrl("ActiveFlights"))}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Zu Aktiven Flügen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Flight Header */}
        {/* Tab Warning */}
        {flightPhase !== 'preflight' && flightPhase !== 'completed' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300">
              <strong>Wichtig:</strong> Schließe diesen Tab nicht während des Fluges! Die Flugdaten werden hier live verarbeitet und der Flug kann sonst nicht korrekt abgeschlossen werden.
            </p>
          </motion.div>
        )}

        {contract && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-2xl font-bold">{contract.title}</h1>
                <div className="flex items-center gap-4 mt-2 text-slate-400">
                  <span className="flex items-center gap-1 font-mono">
                    <MapPin className="w-4 h-4" />
                    {contract.departure_airport}
                  </span>
                  <span>→</span>
                  <span className="flex items-center gap-1 font-mono">
                    <MapPin className="w-4 h-4" />
                    {contract.arrival_airport}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
              {company?.xplane_connection_status === 'connected' && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  X-Plane Live
                </Badge>
              )}
              <Badge className={`px-4 py-2 text-lg ${
                flightPhase === 'completed' 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
              }`}>
                {phaseLabels[flightPhase]}
              </Badge>
            </div>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="flex items-center gap-2">
                <PlaneTakeoff className="w-4 h-4 text-blue-400" />
                {contract.departure_airport}
              </span>
              <span className="flex items-center gap-2">
                <PlaneLanding className="w-4 h-4 text-emerald-400" />
                {contract.arrival_airport}
              </span>
            </div>
            <Progress value={distanceProgress} className="h-2 bg-slate-700" />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>{Math.round(distanceInfo.totalNm - distanceInfo.remainingNm)} NM geflogen</span>
              <span className="font-mono font-semibold text-blue-400">
                {distanceInfo.remainingNm} NM
              </span>
              <span>{distanceInfo.totalNm} NM total</span>
            </div>
          </div>
        </motion.div>
        )}

        {!contract && (
          <div className="text-center py-12">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
              <Plane className="w-12 h-12 text-blue-400 mx-auto" />
            </motion.div>
            <p className="text-slate-400 mt-4">Verbinde mit X-Plane...</p>
          </div>
        )}

        {contract && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Flight Instruments */}
            <div className="lg:col-span-2 space-y-6">
                {/* Main Instruments */}
              <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-blue-400" />
                Flugdaten
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">Höhe</p>
                  <p className="text-2xl font-mono font-bold text-blue-400">
                    {Math.round(flightData.altitude).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">ft</p>
                </div>
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">Geschwindigkeit</p>
                  <p className="text-2xl font-mono font-bold text-emerald-400">
                    {Math.round(flightData.speed)}
                  </p>
                  <p className="text-xs text-slate-500">kts TAS</p>
                </div>
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">Vertikalgeschw.</p>
                  <p className={`text-2xl font-mono font-bold ${
                    flightData.verticalSpeed > 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {Math.round(flightData.verticalSpeed) > 0 ? '+' : ''}
                    {Math.round(flightData.verticalSpeed)}
                  </p>
                  <p className="text-xs text-slate-500">ft/min</p>
                </div>
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">G-Kraft</p>
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
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
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
                  const elapsed = flightDurationSeconds;
                  const remaining = deadlineSec - elapsed;
                  const isOver = remaining <= 0;
                  const absRemaining = Math.abs(remaining);
                  const mins = Math.floor(absRemaining / 60);
                  const secs = absRemaining % 60;
                  const progress = Math.min((elapsed / deadlineSec) * 100, 100);
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Verbleibend</span>
                        <span className={`text-2xl font-mono font-bold ${
                          isOver ? 'text-red-400' : remaining < 300 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {isOver ? '-' : ''}{mins}:{secs.toString().padStart(2, '0')}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2 bg-slate-700" />
                      <div className="flex justify-between mt-2 text-xs text-slate-500">
                        <span>0 min</span>
                        <span>{deadlineMin} min</span>
                      </div>
                      {isOver && (
                        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Deadline überschritten! (-20 Punkte)
                        </p>
                      )}
                      {!isOver && remaining < 300 && (
                        <p className="text-xs text-amber-400 mt-2">Weniger als 5 Minuten!</p>
                      )}
                    </div>
                  );
                })()}
              </Card>
            )}

            {/* Fuel & Status */}
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Fuel className="w-5 h-5 text-amber-400" />
                  Treibstoff
                </h3>
                <span className="text-amber-400 font-mono">{Math.round(flightData.fuel)}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-slate-900 rounded text-center">
                  <p className="text-xs text-slate-400">Prozent</p>
                  <p className="text-lg font-mono font-bold text-amber-400">
                    {Math.round(flightData.fuel)}%
                  </p>
                </div>
                <div className="p-2 bg-slate-900 rounded text-center">
                  <p className="text-xs text-slate-400">Verbleibend</p>
                  <p className="text-lg font-mono font-bold text-amber-400">
                    {Math.round(flightData.fuelKg).toLocaleString()} kg
                  </p>
                </div>
              </div>
              {flightData.fuel < 3 && (
                <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Treibstoff-Notstand!
                </div>
              )}
            </Card>

            {/* Flight Score & Events */}
            {flightPhase !== 'preflight' && (
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400" />
                  Flug-Score
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Score</span>
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
                    <span className="text-slate-400">Status</span>
                    <Badge className={`${
                      flightData.flightScore >= 95 ? 'bg-emerald-500/20 text-emerald-400' :
                      flightData.flightScore >= 85 ? 'bg-green-500/20 text-green-400' :
                      flightData.flightScore >= 70 ? 'bg-amber-500/20 text-amber-400' :
                      flightData.flightScore >= 50 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {flightData.flightScore >= 95 ? 'EXCELLENT' :
                       flightData.flightScore >= 85 ? 'VERY GOOD' :
                       flightData.flightScore >= 70 ? 'ACCEPTABLE' :
                       flightData.flightScore >= 50 ? 'POOR' :
                       'CRITICAL'}
                    </Badge>
                  </div>
                  {flightData.maintenanceCost > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700">
                      <span className="text-slate-400">Wartungskosten</span>
                      <span className="text-red-400 font-mono">${Math.round(flightData.maintenanceCost).toLocaleString()}</span>
                    </div>
                  )}
                  {flightData.landingBonus > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700">
                      <span className="text-slate-400">Landequalitäts-Bonus</span>
                      <span className="text-emerald-400 font-mono">+${Math.round(flightData.landingBonus).toLocaleString()}</span>
                    </div>
                  )}

                  {/* Events */}
                  {Object.entries(flightData.events).some(([_, val]) => val === true) && (
                    <div className="pt-3 border-t border-slate-700">
                      <p className="text-xs text-slate-500 mb-2">Vorfälle:</p>
                      <div className="space-y-1">
                        {flightData.events.tailstrike === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Heckaufsetzer (-20 Punkte)
                          </div>
                        )}
                        {flightData.events.stall === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Strömungsabriss (-50 Punkte)
                          </div>
                        )}
                        {flightData.events.overstress === true && (
                          <div className="text-xs text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Strukturbelastung (-30 Punkte)
                          </div>
                        )}
                        {flightData.events.overspeed === true && (
                         <div className="text-xs text-orange-400 flex items-center gap-1">
                           <AlertTriangle className="w-3 h-3" />
                           Overspeed (-15 Punkte)
                         </div>
                        )}
                        {flightData.events.flaps_overspeed === true && (
                         <div className="text-xs text-orange-400 flex items-center gap-1">
                           <AlertTriangle className="w-3 h-3" />
                           Klappen-Overspeed (-{settings?.flaps_overspeed_score_penalty || 15} Punkte)
                         </div>
                        )}
                        {flightData.events.gear_up_landing === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Landung ohne Fahrwerk! (-35 Punkte, 15% Wartung)
                          </div>
                        )}
                        {flightData.events.crash === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            CRASH ERKANNT! (-100 Punkte)
                          </div>
                        )}
                        {flightData.events.harsh_controls === true && (
                          <div className="text-xs text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Ruppige Steuerung
                          </div>
                        )}
                        {flightData.events.high_g_force === true && (
                          <div className="text-xs text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Hohe G-Kräfte (Wartung: {(flightData.maxGForce * 100).toFixed(1)}% Neuwert)
                          </div>
                        )}
                        {flightData.events.hard_landing === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Harte Landung (Wartung: 1% Flugzeugwert)
                          </div>
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
                <h3 className="text-lg font-semibold mb-4">Flugsteuerung</h3>
                
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
                      {startFlightMutation.isPending ? 'Starte...' : 'Flug starten'}
                    </Button>
                    <p className="text-sm text-slate-400 text-center">
                      Klicke auf "Flug starten" und starte dann in X-Plane
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
                        <p className="font-medium text-amber-200 mb-1">Warte auf X-Plane...</p>
                        <p className="text-sm text-amber-300/70">
                          Starte jetzt deinen Flug in X-Plane 12. Lade das richtige Flugzeug am Abflughafen 
                          <span className="font-mono font-bold text-amber-200"> {contract?.departure_airport}</span> und 
                          hebe ab. Der Flug wird automatisch erkannt, sobald du in der Luft bist.
                        </p>
                        {company?.xplane_connection_status !== 'connected' && (
                          <p className="text-sm text-red-400 mt-2 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            X-Plane ist nicht verbunden. Stelle sicher, dass das Plugin aktiv ist.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {flightPhase !== 'preflight' && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400">
                      {flightPhase === 'takeoff' && flightData.wasAirborne && "Steige auf Reiseflughöhe..."}
                      {flightPhase === 'cruise' && "Flug wird von X-Plane gesteuert. Der Flug endet automatisch, wenn du parkst und die Parkbremse aktiviert ist."}
                      {flightPhase === 'landing' && "Lande das Flugzeug und schalte die Parkbremse ein, um den Flug abzuschließen."}
                    </p>
                    <Button 
                      onClick={() => {
                        if (confirm(`Flug stornieren? Stornierungsgebühr: $${(contract?.payout * 0.3 || 5000).toLocaleString()}`)) {
                          cancelFlightMutation.mutate();
                        }
                      }}
                      disabled={cancelFlightMutation.isPending}
                      variant="destructive"
                      className="w-full"
                    >
                      {cancelFlightMutation.isPending ? 'Storniere...' : 'Flug stornieren'}
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
                    const initFuel = xpd.initial_fuel_kg || 0;
                    const curFuel = flightData.fuelKg || 0;
                    const fuelUsedKg = Math.max(0, initFuel - curFuel);
                    const fuelUsed = fuelUsedKg * 1.25;
                    const fuelCost = fuelUsed * 1.2;
                    const flightHours = flightStartTime ? (Date.now() - flightStartTime) / 3600000 : (contract?.distance_nm ? contract.distance_nm / 450 : 2);
                    const crewCost = flightHours * 250;
                    const airportFee = 150;
                    const isCrashed = flightData.events.crash;
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
                      passenger_comments: generateComments(flightData.flightScore, flightData),
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
                    {completeFlightMutation.isPending ? 'Speichere...' : 'Flug abschließen'}
                  </Button>
                )}

                {completeFlightMutation.isSuccess && (
                  <Button 
                    variant="outline"
                    onClick={() => navigate(createPageUrl("Dashboard"))}
                    className="w-full border-slate-600 text-white hover:bg-slate-700"
                  >
                    Zurück zum Dashboard
                  </Button>
                )}
              </>
            ) : (
              <>
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400" />
                  Passagier-Zufriedenheit
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Max G-Kraft bisher</span>
                    <span className={`font-mono ${
                      flightData.maxGForce < 1.3 ? 'text-emerald-400' :
                      flightData.maxGForce < 1.8 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {flightData.maxGForce.toFixed(2)} G
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Halte die G-Kräfte unter 1.5 G für zufriedene Passagiere.
                    Eine sanfte Landung unter 150 ft/min bringt Bonuspunkte!
                  </p>
                </div>
              </Card>

              {/* Active Failures removed - shown in Events section */}

              {/* Compact Raw X-Plane Data */}
              {xplaneLog?.raw_data && (
                <Card className="p-4 bg-slate-800/50 border-slate-700">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-400">
                    <Activity className="w-4 h-4 text-blue-400" />
                    X-Plane Rohdaten
                  </h3>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-mono">
                    {Object.entries(xplaneLog.raw_data)
                      .filter(([key]) => !['departure_lat','departure_lon','arrival_lat','arrival_lon'].includes(key))
                      .map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-1 py-0.5 border-b border-slate-700/50">
                        <span className="text-slate-500 truncate">{key}</span>
                        <span className="text-slate-300 shrink-0">
                          {typeof value === 'number' ? value.toFixed(2) : 
                           typeof value === 'boolean' ? (value ? '✓' : '✗') :
                           typeof value === 'object' ? '{}' :
                           String(value).substring(0, 12)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              </>
            )}
          </div>
        </div>
        )}

        {contract && (
          <div className="space-y-6 mt-6">
            <FlightMapIframe
              flightData={flightData}
              contract={contract}
              waypoints={xplaneLog?.raw_data?.fms_waypoints || []}
              routeWaypoints={simbriefRoute?.waypoints || []}
              flightPath={xplaneLog?.raw_data?.flight_path || []}
              departureRunway={simbriefRoute?.departure_runway}
              arrivalRunway={simbriefRoute?.arrival_runway}
              departureCoords={simbriefRoute?.departure_coords}
              arrivalCoords={simbriefRoute?.arrival_coords}
            />
            <SimBriefImport
              contract={contract}
              onRouteLoaded={(data) => setSimbriefRoute(data)}
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
    </div>
  );
}