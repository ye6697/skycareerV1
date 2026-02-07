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
} from "lucide-react";

import FlightRating from "@/components/flights/FlightRating";

export default function FlightTracker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [flightPhase, setFlightPhase] = useState('preflight');
  const [flight, setFlight] = useState(null);
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
    landingVs: 0,
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
    previousSpeed: 0
  });

  const generateComments = (score, data) => {
    const comments = [];
    
    if (data.events.crash) {
      comments.push("Flugzeug zerstört! Nie wieder!");
      comments.push("Das war die schlimmste Erfahrung meines Lebens.");
      return comments;
    }

    // Landing-based comments
    const landingVs = Math.abs(data.landingVs);
    if (landingVs < 100) {
      comments.push("Butterweiche Landung! Professionell!");
    } else if (landingVs < 150) {
      comments.push("Sehr sanfte Landung, gut gemacht.");
    } else if (landingVs < 250) {
      comments.push("Normale Landung.");
    } else if (landingVs < 400) {
      comments.push("Die Landung war etwas hart...");
    } else {
      comments.push("Das war eine sehr harte Landung!");
    }

    // G-force based comments
    if (data.maxGForce > 2.0) {
      comments.push("Mir wurde bei den extremen Manövern übel.");
    } else if (data.maxGForce > 1.8) {
      comments.push("Es war ziemlich wackelig während des Fluges.");
    } else if (data.maxGForce < 1.3) {
      comments.push("Sehr angenehmer, sanfter Flug.");
    }

    // Score-based overall comments
    if (score >= 95) {
      comments.push("Perfekter Flug! Werde diese Airline weiterempfehlen!");
    } else if (score >= 85) {
      comments.push("Sehr guter Service, gerne wieder.");
    } else if (score >= 70) {
      comments.push("Solider Flug, nichts zu beanstanden.");
    } else if (score >= 50) {
      comments.push("Es war okay, aber es gibt Verbesserungspotenzial.");
    } else {
      comments.push("Ich buche nie wieder hier.");
    }

    // Event-based comments
    if (data.events.hard_landing) {
      comments.push("Die Landung war erschreckend hart!");
    }
    if (data.events.tailstrike) {
      comments.push("Ich habe gehört, wie das Heck aufgesetzt hat...");
    }
    if (data.events.stall) {
      comments.push("Das Flugzeug ist ins Trudeln geraten!");
    }

    return comments;
  };

  // Get latest X-Plane data directly
  const { data: xplaneLog } = useQuery({
    queryKey: ['xplane-log'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      if (!companies[0]) return null;
      const logs = await base44.entities.XPlaneLog.filter({ company_id: companies[0].id }, '-created_date', 1);
      return logs[0] || null;
    },
    refetchInterval: 2000,
    enabled: flightPhase !== 'preflight'
  });

  const { data: contract } = useQuery({
    queryKey: ['contract', contractIdFromUrl],
    queryFn: async () => {
      if (!contractIdFromUrl) return null;
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      if (!companies[0]) return null;
      const contracts = await base44.entities.Contract.filter({ company_id: companies[0].id, id: contractIdFromUrl });
      return contracts[0];
    },
    enabled: !!contractIdFromUrl
  });

  // Load existing flight if any
  const { data: existingFlight } = useQuery({
    queryKey: ['active-flight', contractIdFromUrl],
    queryFn: async () => {
      if (!contractIdFromUrl) return null;
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      if (!companies[0]) return null;
      const flights = await base44.entities.Flight.filter({ 
        company_id: companies[0].id,
        contract_id: contractIdFromUrl,
        status: 'in_flight'
      });
      return flights[0] || null;
    },
    enabled: !!contractIdFromUrl
  });

  // Restore flight data and phase from existing flight
  useEffect(() => {
    if (existingFlight && !flight) {
      setFlight(existingFlight);
      setFlightPhase('takeoff'); // Setze direkt auf takeoff wenn Flight existiert
    }
  }, [existingFlight, flight]);

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      return companies[0];
    }
  });

  const { data: aircraft } = useQuery({
    queryKey: ['aircraft'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      if (!companies[0]) return [];
      return await base44.entities.Aircraft.filter({ company_id: companies[0].id });
    }
  });

  const { data: settings } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const allSettings = await base44.entities.GameSettings.list();
      return allSettings[0] || null;
    }
  });

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
    onSuccess: (flightData) => {
      setFlight(flightData);
      setFlightPhase('takeoff');
      
      // Reset flight data for new flight
      setFlightData({
        altitude: 0,
        speed: 0,
        verticalSpeed: 0,
        heading: 0,
        fuel: 100,
        fuelKg: 0,
        gForce: 1.0,
        maxGForce: 1.0,
        landingVs: 0,
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
        previousSpeed: 0
      });
      
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
     if (!flight) {
       throw new Error('Flugdaten nicht geladen');
     }
     if (!aircraft || aircraft.length === 0) {
       throw new Error('Flugzeugdaten nicht geladen');
     }
     
     // Use the latest flightData from ref to ensure all events are captured
     const finalFlightData = flightDataRef.current || flightData;
     
     // Realistic cost calculations based on aviation industry
     const fuelUsed = (100 - finalFlightData.fuel) * 10; // kg -> convert to liters (1kg ≈ 1.3L for Jet-A)
     const fuelCostPerLiter = 1.2; // $1.20 per liter for Jet-A fuel
     const fuelCost = fuelUsed * fuelCostPerLiter;

     // Crew costs based on flight hours
     const flightHours = contract?.distance_nm ? contract.distance_nm / 450 : 2; // Average cruise speed 450 knots
     const crewCostPerHour = 250; // $250 per flight hour (captain + first officer)
     const crewCost = flightHours * crewCostPerHour;

     // Maintenance cost per flight hour + event-based costs
     const maintenanceCostPerHour = 400; // $400 per flight hour
     const maintenanceCost = (flightHours * maintenanceCostPerHour) + finalFlightData.maintenanceCost;

     // Landing and airport fees
     const airportFee = 150;

     let revenue = contract?.payout || 0;

     // Bonus based on score
     const score = finalFlightData.flightScore;
     if (score >= 95 && contract?.bonus_potential) {
       revenue += contract.bonus_potential;
     } else if (score >= 85 && contract?.bonus_potential) {
       revenue += contract.bonus_potential * 0.5;
     }

     // Only direct costs (fuel, crew, airport) - maintenance goes to accumulated_maintenance_cost
     const directCosts = fuelCost + crewCost + airportFee;
     const profit = revenue - directCosts;

      // Check for crash
            const hasCrashed = finalFlightData.events.crash;

            // Calculate depreciation based on flight hours
            const airplaneToUpdate = aircraft.find(a => a.id === flight.aircraft_id);
            const newFlightHours = (airplaneToUpdate?.total_flight_hours || 0) + flightHours;
            const depreciationPerHour = airplaneToUpdate?.depreciation_rate || 0.001;
            const newAircraftValue = Math.max(0, (airplaneToUpdate?.current_value || airplaneToUpdate?.purchase_price || 0) - (depreciationPerHour * flightHours * airplaneToUpdate?.purchase_price || 0));
            
            // Crash: -100 Punkte einmalig + 70% des Neuwertes Wartungskosten
             let crashMaintenanceCost = 0;
             let finalScore = finalFlightData.flightScore;
             if (hasCrashed) {
               crashMaintenanceCost = (airplaneToUpdate?.purchase_price || 0) * 0.7;
               // finalScore wurde bereits in useEffect abgezogen, nicht nochmal abziehen
             }

            // Calculate ratings based on score for database (for compatibility)
            const scoreToRating = (s) => (s / 100) * 5;
            
            // Update flight record with events and final score
            const totalEventMaintenanceCost = finalFlightData.maintenanceCost;
            const totalMaintenanceCostWithCrash = totalEventMaintenanceCost + crashMaintenanceCost;
            
            console.log('🔍 SPEICHERE FINALE FLUGDATEN:', {
              finalScore,
              events: finalFlightData.events,
              maintenanceCost: finalFlightData.maintenanceCost,
              crashMaintenanceCost,
              totalMaintenanceCostWithCrash
            });
            
            await base44.entities.Flight.update(flight.id, {
              status: hasCrashed ? 'failed' : 'completed',
              arrival_time: new Date().toISOString(),
              takeoff_rating: scoreToRating(finalScore),
              flight_rating: scoreToRating(finalScore),
              landing_rating: scoreToRating(finalScore),
              overall_rating: scoreToRating(finalScore),
              landing_vs: finalFlightData.landingVs,
              max_g_force: finalFlightData.maxGForce,
              fuel_used_liters: fuelUsed,
              fuel_cost: fuelCost,
              crew_cost: crewCost,
              maintenance_cost: (flightHours * maintenanceCostPerHour) + totalMaintenanceCostWithCrash,
              flight_duration_hours: flightHours,
              revenue,
              profit,
              passenger_comments: generateComments(finalScore, finalFlightData),
              xplane_data: {
                ...finalFlightData,
                final_score: finalScore,
                events: finalFlightData.events,
                crashMaintenanceCost: crashMaintenanceCost
              }
            });

            // Update contract
            console.log('Aktualisiere Contract Status:', flight.contract_id, hasCrashed ? 'failed' : 'completed');
            await base44.entities.Contract.update(flight.contract_id, { status: hasCrashed ? 'failed' : 'completed' });

            // Alle Event-Wartungskosten zu accumulated_maintenance_cost hinzufügen
            const currentAccumulatedCost = airplaneToUpdate?.accumulated_maintenance_cost || 0;
            const newAccumulatedCost = currentAccumulatedCost + totalMaintenanceCostWithCrash;
            const requiresMaintenance = newAccumulatedCost > (newAircraftValue * 0.1);
            
            console.log('Wartungskosten Update:', {
              currentAccumulatedCost,
              flightMaintenanceCost: flightData.maintenanceCost,
              crashMaintenanceCost,
              totalMaintenanceCostWithCrash,
              newAccumulatedCost
            });

            // Update aircraft with depreciation, crash status, and maintenance costs
             if (flight?.aircraft_id) {
               try {
                 const aircraftUpdate = {
                   status: hasCrashed ? 'damaged' : 'available',
                   total_flight_hours: newFlightHours,
                   current_value: hasCrashed ? 0 : Math.max(0, newAircraftValue),
                   accumulated_maintenance_cost: newAccumulatedCost
                 };

                console.log('🛩️ AKTUALISIERE FLUGZEUG JETZT:', flight.aircraft_id, aircraftUpdate);
                await base44.entities.Aircraft.update(flight.aircraft_id, aircraftUpdate);
                console.log('✅ FLUGZEUG AKTUALISIERT');
               } catch (error) {
                 console.error('❌ FEHLER BEI FLUGZEUG UPDATE:', error);
                 throw error;
               }
            } else {
              console.error('❌ KEIN FLUGZEUG GEFUNDEN FÜR UPDATE:', flight);
            }

            // Free up crew - SOFORT Status auf available setzen
            if (flight?.crew && Array.isArray(flight.crew)) {
              console.log('🔄 Aktualisiere Crew Status:', flight.crew);
              for (const member of flight.crew) {
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

            // Calculate level bonus (10% per level)
            const levelBonus = (company?.level || 1) > 1 ? revenue * ((company.level - 1) * 0.1) : 0;
            const totalRevenue = profit + levelBonus;

            // Update company - only deduct direct costs (fuel, crew, airport)
            if (company) {
              // Reputation based on score (0-100)
              const reputationChange = hasCrashed ? -10 : Math.round((finalScore - 85) / 5);
              
              // XP and Level system with increasing XP requirements (10% per level)
              const calculateXPForLevel = (level) => {
                return Math.round(100 * Math.pow(1.1, level - 1));
              };

              const earnedXP = Math.round(finalScore);
              let currentLevel = company.level || 1;
              let currentXP = (company.experience_points || 0) + earnedXP;

              // Level up as many times as possible
              while (currentXP >= calculateXPForLevel(currentLevel)) {
                currentXP -= calculateXPForLevel(currentLevel);
                currentLevel++;
              }

              const newLevel = currentLevel;
              const remainingXP = currentXP;
              
              // Calculate actual balance change (revenue - direct costs only)
              const actualProfit = revenue + levelBonus - directCosts;
              
              await base44.entities.Company.update(company.id, {
                balance: (company.balance || 0) + actualProfit,
                reputation: Math.min(100, Math.max(0, (company.reputation || 50) + reputationChange)),
                level: newLevel,
                experience_points: remainingXP,
                total_flights: (company.total_flights || 0) + 1,
                total_passengers: (company.total_passengers || 0) + (contract?.passenger_count || 0),
                total_cargo_kg: (company.total_cargo_kg || 0) + (contract?.cargo_weight_kg || 0)
              });
            }

            // Create transaction - only for direct costs
            await base44.entities.Transaction.create({
            company_id: company.id,
            type: 'income',
            category: 'flight_revenue',
            amount: revenue + levelBonus - directCosts,
            description: `Flug: ${contract?.title}${levelBonus > 0 ? ` (Levelbonus +${Math.round(levelBonus)})` : ''}`,
            reference_id: flight?.id,
            date: new Date().toISOString()
            });

            // WARTE bis Aircraft wirklich gespeichert ist und lade es neu
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Hole das aktualisierte Aircraft direkt aus der DB
            const updatedAircraft = await base44.entities.Aircraft.filter({ id: flight.aircraft_id });
            console.log('✅ Aircraft nach Update:', updatedAircraft[0]);

            // Invalidiere aircraft query um sicherzustellen, dass Fleet aktualisiert wird
            await queryClient.invalidateQueries({ queryKey: ['aircraft'] });

            // Hole den aktualisierten Flight aus DB
            const updatedFlightFromDB = await base44.entities.Flight.filter({ id: flight.id });
            return updatedFlightFromDB[0];
    },
    onSuccess: async (updatedFlight) => {
       console.log('✅ Flug erfolgreich abgeschlossen:', updatedFlight);

       // WARTE nochmal um sicherzustellen dass alles committed ist
       await new Promise(resolve => setTimeout(resolve, 1000));

       // FORCE refetch der Aircraft Query damit Fleet aktualisiert wird
       await queryClient.refetchQueries({ queryKey: ['aircraft'] });

       // Direkt navigieren mit dem neuesten Flight von der DB
       navigate(createPageUrl(`CompletedFlightDetails?contractId=${contractIdFromUrl}`), {
         state: { 
           flightData: flightDataRef.current || flightData,
           flight: updatedFlight,
           contract
         }
       });
     }
  });

  // Update flight data from X-Plane log (freeze data after landing)
  useEffect(() => {
    if (!xplaneLog?.raw_data || flightPhase === 'preflight') return;
    
    // Don't update data if flight is completed
    if (flightPhase === 'completed') return;

    const xp = xplaneLog.raw_data;

    setFlightData(prev => {
      const currentGForce = xp.g_force || 1.0;
      const newMaxGForce = Math.max(prev.maxGForce, currentGForce);
      const newMaxControlInput = Math.max(prev.maxControlInput, xp.control_input || 0);

      // Track if aircraft was airborne
      const newWasAirborne = prev.wasAirborne || (!xp.on_ground && xp.altitude > 10);

      // Landing detection based on vertical speed
      const currentSpeed = xp.speed || 0;
      const touchdownVs = xp.touchdown_vspeed || 0;
      
      // Landing categories based on vertical speed
      let landingType = null;
      let landingScoreChange = 0;
      let landingMaintenanceCost = 0;
      
      if (touchdownVs !== 0 && xp.on_ground && newWasAirborne && !prev.events.hard_landing && !prev.events.crash) {
        const absVs = Math.abs(touchdownVs);
        if (absVs > 1000) {
          landingType = 'crash'; // Sehr harte Landung = Crash
        } else if (absVs > 600) {
          landingType = 'hard'; // Harte Landung
          landingScoreChange = -15; // 15 Punkte Abzug
          landingMaintenanceCost = aircraftPurchasePrice * 0.01; // 1% des Flugzeugwerts
        } else if (absVs > 300) {
          landingType = 'acceptable'; // Akzeptable Landung
          landingScoreChange = 0; // Keine Änderung
        } else if (absVs > 150) {
          landingType = 'soft'; // Weiche Landung
          landingScoreChange = 5; // 5 Bonuspunkte
        } else {
          landingType = 'butter'; // Butterweiche Landung
          landingScoreChange = 10; // 10 Bonuspunkte
        }
      }
      
      const isCrash = landingType === 'crash' || prev.events.crash;
      
      // Calculate score penalties - only deduct when NEW event occurs
      let baseScore = prev.flightScore;
      
      // Landungs-Score hinzufügen/abziehen
      baseScore = Math.max(0, Math.min(100, baseScore + landingScoreChange));
      
      // Track if high G-force event already happened
      const hadHighGEvent = prev.events.high_g_force || false;
      
      // Calculate maintenance cost increase based on NEW events only
       let maintenanceCostIncrease = landingMaintenanceCost;

       // Get aircraft for maintenance cost calculations (purchase price is neuwert)
       // Use flight.aircraft_id if available, otherwise try to find from aircraft list
       const aircraftId = flight?.aircraft_id;
       const currentAircraft = aircraft?.find(a => a.id === aircraftId);
       const aircraftPurchasePrice = currentAircraft?.purchase_price || 1000000; // fallback price if not found
      
      // Heckaufsetzer (Tailstrike): -20 Punkte + 2% des Neuwertes
      if (xp.tailstrike && !prev.events.tailstrike) {
        baseScore = Math.max(0, baseScore - 20);
        maintenanceCostIncrease += aircraftPurchasePrice * 0.02;
      }
      
      // Stall: -50 Punkte (keine Wartungskosten)
      if (xp.stall && !prev.events.stall) {
        baseScore = Math.max(0, baseScore - 50);
      }
      
      // G-Kräfte ab 1.5: Kosten entsprechend maxGForce in %, nur wenn neuer Max überschritten wird
      if (newMaxGForce > prev.maxGForce && newMaxGForce >= 1.5) {
        const gForceMaintenanceCost = newMaxGForce * aircraftPurchasePrice * 0.01;
        maintenanceCostIncrease += gForceMaintenanceCost;
        // 25 Punkte Abzug pro Überschreitung der max G-Kraft
        baseScore = Math.max(0, baseScore - 25);
      }
      
      // Strukturschaden (overstress): -30 Punkte + 4% des Neuwertes, einmalig
      if (xp.overstress && !prev.events.overstress) {
        baseScore = Math.max(0, baseScore - 30);
        maintenanceCostIncrease += aircraftPurchasePrice * 0.04;
      }
      
      // Flaps Overspeed: Score-Abzug + Wartungskosten basierend auf Settings
      if (xp.flaps_overspeed && !prev.events.flaps_overspeed) {
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
        landingVs: xp.touchdown_vspeed || prev.landingVs,
        flightScore: baseScore,
        maintenanceCost: prev.maintenanceCost + maintenanceCostIncrease,
        reputation: xp.reputation || prev.reputation,
        latitude: xp.latitude || prev.latitude,
        longitude: xp.longitude || prev.longitude,
        departure_lat: depLat,
        departure_lon: depLon,
        arrival_lat: arrLat,
        arrival_lon: arrLon,
        events: {
          tailstrike: xp.tailstrike || prev.events.tailstrike,
          stall: xp.stall || prev.events.stall,
          overstress: xp.overstress || prev.events.overstress,
          flaps_overspeed: xp.flaps_overspeed || prev.events.flaps_overspeed,
          fuel_emergency: xp.fuel_emergency || prev.events.fuel_emergency,
          gear_up_landing: xp.gear_up_landing || prev.events.gear_up_landing,
          crash: isCrash,
          harsh_controls: xp.harsh_controls || prev.events.harsh_controls,
          high_g_force: newMaxGForce >= 1.5 || prev.events.high_g_force,
          hard_landing: landingType === 'hard' || prev.events.hard_landing
        },
        maxControlInput: newMaxControlInput,
        wasAirborne: newWasAirborne,
        previousSpeed: currentSpeed
      };
      


      // Update ref with latest data
      flightDataRef.current = newData;

      return newData;
      });

      // Auto-detect phase - start if in air
    if (flightPhase === 'takeoff' && xp.altitude > 10 && !xp.on_ground) {
      setFlightPhase('cruise');
    } else if (flightPhase === 'cruise') {
      if (xp.vertical_speed < -200) {
        setFlightPhase('landing');
      }
    }

    // Landung erkannt: Flugzeug war in der Luft und ist jetzt auf dem Boden
    if (flightData.wasAirborne && xp.on_ground && flightPhase === 'landing') {
      setFlightPhase('completed');
      // Warte kurz, damit alle State-Updates abgeschlossen sind
      setTimeout(() => {
        if (!completeFlightMutation.isPending && !completeFlightMutation.isSuccess) {
          completeFlightMutation.mutate();
        }
      }, 500);
    }

    // Auto-complete flight on crash
    if (flightData.events.crash && flightPhase !== 'preflight' && flightPhase !== 'completed') {
      setFlightPhase('completed');
      // Warte kurz, damit alle State-Updates abgeschlossen sind
      setTimeout(() => {
        if (!completeFlightMutation.isPending && !completeFlightMutation.isSuccess) {
          completeFlightMutation.mutate();
        }
      }, 500);
    }
  }, [xplaneLog, flight, flightPhase, completeFlightMutation, flightData.altitude, flightData.wasAirborne, flightData.events.crash]);

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

  const calculateDistance = () => {
    if (!contract || flightPhase === 'preflight') return 0;
    
    // Use real coordinates from X-Plane
    if (flightData.departure_lat && flightData.arrival_lat && flightData.latitude) {
      // Only calculate if we have moved from departure
      const distanceFromDeparture = calculateHaversineDistance(
        flightData.departure_lat, flightData.departure_lon,
        flightData.latitude, flightData.longitude
      );
      
      if (distanceFromDeparture < 5) return 0;
      
      const totalDistance = calculateHaversineDistance(
        flightData.departure_lat, flightData.departure_lon,
        flightData.arrival_lat, flightData.arrival_lon
      );
      const remainingDistance = calculateHaversineDistance(
        flightData.latitude, flightData.longitude,
        flightData.arrival_lat, flightData.arrival_lon
      );
      const progress = ((totalDistance - remainingDistance) / totalDistance) * 100;
      return Math.max(0, Math.min(100, progress));
    }
    
    return 0;
  };

  const distanceProgress = calculateDistance();

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
      <div className="max-w-6xl mx-auto p-6">
        {/* Flight Header */}
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
            <div className="mt-2 text-xs text-slate-400 text-center">
              {Math.round(distanceProgress)}% des Fluges absolviert
              {flightData.departure_lat && flightData.arrival_lat && flightData.latitude && (
                <span className="ml-2">
                  ({Math.round(calculateHaversineDistance(
                    flightData.latitude, flightData.longitude,
                    flightData.arrival_lat, flightData.arrival_lon
                  ))} nm verbleibend)
                </span>
              )}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Flight Instruments */}
            <div className="lg:col-span-2 space-y-6">
              {/* Main Instruments */}
              <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-blue-400" />
                Flugdaten
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <p className="text-xs text-slate-500">kts</p>
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

            {/* Fuel & Status */}
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Fuel className="w-5 h-5 text-amber-400" />
                  Treibstoff
                </h3>
                <span className="text-amber-400 font-mono">{Math.round(flightData.fuel)}%</span>
              </div>
              <div className="p-2 bg-slate-900 rounded text-center">
                <p className="text-xs text-slate-400">Treibstoff</p>
                <p className="text-lg font-mono font-bold text-amber-400">
                  {Math.round(flightData.fuel)}%
                </p>
              </div>
              {flightData.events.fuel_emergency && (
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
                    <span className="text-slate-400">Reputation</span>
                    <Badge className={`${
                      flightData.reputation === 'EXCELLENT' ? 'bg-emerald-500/20 text-emerald-400' :
                      flightData.reputation === 'VERY_GOOD' ? 'bg-green-500/20 text-green-400' :
                      flightData.reputation === 'ACCEPTABLE' ? 'bg-amber-500/20 text-amber-400' :
                      flightData.reputation === 'POOR' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {flightData.reputation}
                    </Badge>
                  </div>
                  {flightData.maintenanceCost > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700">
                      <span className="text-slate-400">Wartungskosten</span>
                      <span className="text-red-400 font-mono">${flightData.maintenanceCost.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* Events */}
                  {Object.entries(flightData.events).some(([_, val]) => val) && (
                    <div className="pt-3 border-t border-slate-700">
                      <p className="text-xs text-slate-500 mb-2">Vorfälle:</p>
                      <div className="space-y-1">
                        {flightData.events.tailstrike && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Heckaufsetzer (-20 Punkte)
                          </div>
                        )}
                        {flightData.events.stall && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Strömungsabriss (-50 Punkte)
                          </div>
                        )}
                        {flightData.events.overstress && (
                          <div className="text-xs text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Strukturbelastung (-30 Punkte)
                          </div>
                        )}
                        {flightData.events.flaps_overspeed && (
                         <div className="text-xs text-orange-400 flex items-center gap-1">
                           <AlertTriangle className="w-3 h-3" />
                           Klappen-Overspeed (-{settings?.flaps_overspeed_score_penalty || 15} Punkte)
                         </div>
                        )}
                        {flightData.events.gear_up_landing && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Landung ohne Fahrwerk!
                          </div>
                        )}
                        {flightData.events.crash && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            CRASH ERKANNT! (-100 Punkte)
                          </div>
                        )}
                        {flightData.events.harsh_controls && (
                          <div className="text-xs text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Ruppige Steuerung
                          </div>
                        )}
                        {flightData.events.high_g_force && (
                          <div className="text-xs text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Hohe G-Kräfte (Wartung: {(flightData.maxGForce * 100).toFixed(1)}% Neuwert)
                          </div>
                        )}
                        {flightData.events.hard_landing && (
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
                
                {flightPhase !== 'preflight' && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400">
                      {flightPhase === 'takeoff' && "Steige auf Reiseflughöhe..."}
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
                  flight={{
                    flight_score: flightData.flightScore,
                    landing_vs: flightData.landingVs,
                    max_g_force: flightData.maxGForce,
                    fuel_used_liters: (100 - flightData.fuel) * 10,
                    flight_duration_hours: contract?.distance_nm ? contract.distance_nm / 450 : 2,
                    passenger_comments: generateComments(flightData.flightScore, flightData),
                    revenue: (() => {
                      const flightHours = contract?.distance_nm ? contract.distance_nm / 450 : 2;
                      const score = flightData.flightScore;
                      let revenue = contract?.payout || 0;
                      if (score >= 95 && contract?.bonus_potential) {
                        revenue += contract.bonus_potential;
                      } else if (score >= 85 && contract?.bonus_potential) {
                        revenue += contract.bonus_potential * 0.5;
                      }
                      const levelBonus = (company?.level || 1) > 1 ? revenue * ((company.level - 1) * 0.1) : 0;
                      return revenue + levelBonus;
                    })(),
                    fuel_cost: (() => {
                      const fuelUsed = (100 - flightData.fuel) * 10;
                      const fuelCostPerLiter = 1.2;
                      return fuelUsed * fuelCostPerLiter;
                    })(),
                    crew_cost: (() => {
                      const flightHours = contract?.distance_nm ? contract.distance_nm / 450 : 2;
                      const crewCostPerHour = 250;
                      return flightHours * crewCostPerHour;
                    })(),
                    maintenance_cost: (() => {
                      const flightHours = contract?.distance_nm ? contract.distance_nm / 450 : 2;
                      const maintenanceCostPerHour = 400;
                      return (flightHours * maintenanceCostPerHour) + flightData.maintenanceCost;
                    })(),
                    profit: (() => {
                      const flightHours = contract?.distance_nm ? contract.distance_nm / 450 : 2;
                      const fuelUsed = (100 - flightData.fuel) * 10;
                      const fuelCost = fuelUsed * 1.2;
                      const crewCost = flightHours * 250;
                      const maintenanceCost = (flightHours * 400) + flightData.maintenanceCost;
                      const airportFee = 150;
                      const score = flightData.flightScore;
                      let revenue = contract?.payout || 0;
                      if (score >= 95 && contract?.bonus_potential) {
                        revenue += contract.bonus_potential;
                      } else if (score >= 85 && contract?.bonus_potential) {
                        revenue += contract.bonus_potential * 0.5;
                      }
                      const levelBonus = (company?.level || 1) > 1 ? revenue * ((company.level - 1) * 0.1) : 0;
                      return (revenue + levelBonus) - fuelCost - crewCost - maintenanceCost - airportFee;
                    })()
                  }} 
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
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}