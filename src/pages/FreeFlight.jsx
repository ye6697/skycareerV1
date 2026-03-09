import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plane, Gauge, Fuel, AlertTriangle, Star, Activity } from "lucide-react";
import { motion } from "framer-motion";
import FlightMapIframe from "@/components/flights/FlightMapIframe";
import SimBriefImport from "@/components/flights/SimBriefImport";
import WeatherDisplay from "@/components/flights/WeatherDisplay";
import AdvancedLandingScore from "@/components/flights/AdvancedLandingScore";
import { calculateAdvancedLandingScore } from "@/components/flights/LandingScoreCalculator";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function FreeFlight() {
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const [xplaneLog, setXplaneLog] = useState(null);
  const [dataAge, setDataAge] = useState(null);
  const [simbriefRoute, setSimbriefRoute] = useState(null);
  const lastDataRef = useRef(null);
  const lastTimestampRef = useRef(null);

  // Live flight scoring state (display only, no consequences)
  const [flightData, setFlightData] = useState({
    altitude: 0, speed: 0, verticalSpeed: 0, heading: 0,
    fuel: 100, fuelKg: 0, gForce: 1.0, maxGForce: 1.0,
    landingGForce: 0, landingVs: 0, landingType: null,
    landingScoreChange: 0, flightScore: 100, latitude: 0, longitude: 0,
    departure_lat: 0, departure_lon: 0, arrival_lat: 0, arrival_lon: 0,
    wasAirborne: false, events: {
      tailstrike: false, stall: false, overstress: false, overspeed: false,
      flaps_overspeed: false, fuel_emergency: false, gear_up_landing: false,
      crash: false, harsh_controls: false, high_g_force: false, hard_landing: false
    }
  });

  // Approach data tracking for advanced landing score
  const vsHistoryRef = useRef([]);        // V/S readings before touchdown
  const speedAfterTDRef = useRef([]);     // Speed readings after touchdown
  const touchdownCapturedRef = useRef(false);
  const [advancedLandingResult, setAdvancedLandingResult] = useState(null);

  const { data: company } = useQuery({
    queryKey: ['company-ff'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      if (cid) {
        const cos = await base44.entities.Company.filter({ id: cid });
        if (cos[0]) return cos[0];
      }
      const u2 = await base44.auth.me();
      const cos = await base44.entities.Company.filter({ created_by: u2.email });
      return cos[0] || null;
    },
    staleTime: 60000,
  });

  // Initial fetch of latest XPlaneLog
  useEffect(() => {
    if (!company?.id) return;
    const fetchLatest = async () => {
      const logs = await base44.entities.XPlaneLog.filter({ company_id: company.id }, '-created_date', 1);
      if (logs[0]) {
        setXplaneLog(logs[0]);
        lastDataRef.current = Date.now();
        lastTimestampRef.current = logs[0].raw_data?.timestamp || logs[0].created_date;
      }
    };
    fetchLatest();
  }, [company?.id]);

  // Subscribe + poll for live data
  useEffect(() => {
    if (!company?.id) return;

    const updateLog = (data) => {
      const ts = data?.raw_data?.timestamp || data?.created_date;
      if (ts === lastTimestampRef.current) return;
      lastTimestampRef.current = ts;
      lastDataRef.current = Date.now();
      setXplaneLog(data);
    };

    const unsub = base44.entities.XPlaneLog.subscribe((event) => {
      if ((event.type === 'create' || event.type === 'update') && event.data?.company_id === company.id) {
        updateLog(event.data);
      }
    });

    const poll = setInterval(async () => {
      if (lastDataRef.current && Date.now() - lastDataRef.current < 1200) return;
      const logs = await base44.entities.XPlaneLog.filter({ company_id: company.id }, '-created_date', 1);
      if (logs[0]) updateLog(logs[0]);
    }, 2000);

    return () => { unsub(); clearInterval(poll); };
  }, [company?.id]);

  // Data age ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      if (lastDataRef.current) setDataAge(Date.now() - lastDataRef.current);
    }, 500);
    return () => clearInterval(ticker);
  }, []);

  // Process X-Plane data into flight state (display-only, no DB writes)
  useEffect(() => {
    if (!xplaneLog?.raw_data) return;
    const xp = xplaneLog.raw_data;

    setFlightData(prev => {
      const currentGForce = xp.g_force || 1.0;
      const newMaxGForce = Math.max(prev.maxGForce, currentGForce);
      const newWasAirborne = prev.wasAirborne || (!xp.on_ground && (xp.altitude || 0) > 10);

      if (!newWasAirborne) {
        return {
          ...prev,
          altitude: xp.altitude || prev.altitude,
          speed: xp.speed || prev.speed,
          verticalSpeed: xp.vertical_speed || prev.verticalSpeed,
          heading: xp.heading || prev.heading,
          fuel: xp.fuel_percentage || prev.fuel,
          fuelKg: xp.fuel_kg || prev.fuelKg,
          gForce: currentGForce,
          latitude: xp.latitude ?? prev.latitude,
          longitude: xp.longitude ?? prev.longitude,
          departure_lat: prev.departure_lat || xp.departure_lat || 0,
          departure_lon: prev.departure_lon || xp.departure_lon || 0,
          arrival_lat: prev.arrival_lat || xp.arrival_lat || 0,
          arrival_lon: prev.arrival_lon || xp.arrival_lon || 0,
          wasAirborne: false,
        };
      }

      // Landing detection
      let landingType = prev.landingType;
      let landingScoreChange = prev.landingScoreChange || 0;
      let landingGForceValue = prev.landingType ? prev.landingGForce : 0;

      if (!prev.landingType && xp.on_ground && newWasAirborne) {
        const lg = xp.landing_g_force || currentGForce;
        landingGForceValue = lg;
        if (lg < 0.5) { landingType = 'butter'; landingScoreChange = 40; }
        else if (lg < 1.0) { landingType = 'soft'; landingScoreChange = 20; }
        else if (lg < 1.6) { landingType = 'acceptable'; landingScoreChange = 5; }
        else if (lg < 2.0) { landingType = 'hard'; landingScoreChange = -30; }
        else { landingType = 'very_hard'; landingScoreChange = -50; }
      }

      let baseScore = prev.flightScore;
      if (landingType && !prev.landingType) {
        baseScore = Math.max(0, Math.min(100, baseScore + landingScoreChange));
      }
      if (xp.tailstrike && !prev.events.tailstrike) baseScore = Math.max(0, baseScore - 20);
      if ((xp.stall || xp.is_in_stall) && !prev.events.stall) baseScore = Math.max(0, baseScore - 50);
      if (xp.overstress && !prev.events.overstress) baseScore = Math.max(0, baseScore - 30);
      if (xp.overspeed && !prev.events.overspeed) baseScore = Math.max(0, baseScore - 15);
      if (newMaxGForce >= 1.5 && !prev.events.high_g_force) baseScore = Math.max(0, baseScore - 10);

      return {
        altitude: xp.altitude || prev.altitude,
        speed: xp.speed || prev.speed,
        verticalSpeed: xp.vertical_speed || prev.verticalSpeed,
        heading: xp.heading || prev.heading,
        fuel: xp.fuel_percentage || prev.fuel,
        fuelKg: xp.fuel_kg || prev.fuelKg,
        gForce: currentGForce,
        maxGForce: newMaxGForce,
        landingGForce: landingGForceValue,
        landingVs: xp.landing_vs || xp.touchdown_vspeed || prev.landingVs,
        landingType,
        landingScoreChange,
        flightScore: baseScore,
        latitude: xp.latitude ?? prev.latitude,
        longitude: xp.longitude ?? prev.longitude,
        departure_lat: prev.departure_lat || xp.departure_lat || 0,
        departure_lon: prev.departure_lon || xp.departure_lon || 0,
        arrival_lat: prev.arrival_lat || xp.arrival_lat || 0,
        arrival_lon: prev.arrival_lon || xp.arrival_lon || 0,
        wasAirborne: newWasAirborne,
        events: {
          tailstrike: xp.tailstrike || prev.events.tailstrike,
          stall: (xp.stall || xp.is_in_stall || xp.stall_warning) || prev.events.stall,
          overstress: xp.overstress || prev.events.overstress,
          overspeed: xp.overspeed || prev.events.overspeed,
          flaps_overspeed: xp.flaps_overspeed || prev.events.flaps_overspeed,
          fuel_emergency: xp.fuel_emergency || prev.events.fuel_emergency,
          gear_up_landing: xp.gear_up_landing || prev.events.gear_up_landing,
          crash: (xp.has_crashed && newWasAirborne) || prev.events.crash,
          harsh_controls: xp.harsh_controls || prev.events.harsh_controls,
          high_g_force: newMaxGForce >= 1.5 || prev.events.high_g_force,
          hard_landing: landingType === 'hard' || landingType === 'very_hard' || prev.events.hard_landing,
        }
      };
    });
  }, [xplaneLog]);

  // Track approach V/S history and post-touchdown speed for advanced scoring
  useEffect(() => {
    if (!xplaneLog?.raw_data) return;
    const xp = xplaneLog.raw_data;
    const isAirborne = !xp.on_ground && (xp.altitude || 0) > 10;
    const wasAirborne = flightData.wasAirborne;

    // While airborne and descending below 2000 AGL-ish, track V/S for flare analysis
    if (isAirborne && (xp.altitude || 0) < 2500 && (xp.vertical_speed || 0) < 0) {
      vsHistoryRef.current.push(xp.vertical_speed || 0);
      if (vsHistoryRef.current.length > 30) vsHistoryRef.current = vsHistoryRef.current.slice(-30);
    }

    // Touchdown just happened
    if (xp.on_ground && wasAirborne && !touchdownCapturedRef.current) {
      touchdownCapturedRef.current = true;
      speedAfterTDRef.current = [xp.speed || 0];
    }

    // After touchdown, track speed for braking analysis
    if (touchdownCapturedRef.current && xp.on_ground) {
      speedAfterTDRef.current.push(xp.speed || 0);
      if (speedAfterTDRef.current.length > 20) {
        // Enough data – calculate advanced score
        const result = calculateAdvancedLandingScore({
          touchdownVs: flightData.landingVs || xp.touchdown_vspeed || 0,
          landingGForce: flightData.landingGForce || xp.landing_g_force || xp.g_force || 1.0,
          vsHistory: vsHistoryRef.current,
          headingAtTouchdown: flightData.heading || xp.heading || 0,
          windDirection: xp.wind_direction || 0,
          windSpeed: xp.wind_speed_kts || 0,
          runwayHeading: null, // no runway data available
          speedAfterTouchdown: speedAfterTDRef.current,
        });
        setAdvancedLandingResult(result);
      }
    }

    // Calculate score as soon as we have a landing + at least 5 braking readings
    if (touchdownCapturedRef.current && !advancedLandingResult && speedAfterTDRef.current.length >= 5) {
      const result = calculateAdvancedLandingScore({
        touchdownVs: flightData.landingVs || xp.touchdown_vspeed || 0,
        landingGForce: flightData.landingGForce || xp.landing_g_force || xp.g_force || 1.0,
        vsHistory: vsHistoryRef.current,
        headingAtTouchdown: flightData.heading || xp.heading || 0,
        windDirection: xp.wind_direction || 0,
        windSpeed: xp.wind_speed_kts || 0,
        runwayHeading: null,
        speedAfterTouchdown: speedAfterTDRef.current,
      });
      setAdvancedLandingResult(result);
    }
  }, [xplaneLog, flightData.wasAirborne, flightData.landingVs, flightData.landingGForce]);

  const raw = xplaneLog?.raw_data || {};
  const isConnected = company?.xplane_connection_status === 'connected';

  const simLabel = raw.simulator === 'msfs' ? 'MSFS Live' :
    raw.simulator === 'msfs2024' ? 'MSFS 2024 Live' :
    raw.simulator === 'xplane12' ? 'X-Plane 12 Live' :
    raw.simulator === 'xplane' ? 'X-Plane Live' :
    raw.simulator ? `${raw.simulator} Live` : 'Sim Live';

  const landingLabels = {
    butter: { label: '🧈 Butter!', color: 'text-emerald-400' },
    soft: { label: '✅ Soft', color: 'text-green-400' },
    acceptable: { label: '👍 OK', color: 'text-amber-400' },
    hard: { label: '⚠️ Hard', color: 'text-orange-400' },
    very_hard: { label: '💥 Very Hard', color: 'text-red-400' },
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-cyan-900/30 p-2 rounded-lg shadow-md">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="h-7 px-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 font-mono text-[10px] uppercase border border-cyan-900/50"
          >
            ◀ {t('back', lang)}
          </Button>
          <span className="font-mono text-sm font-bold text-cyan-400 uppercase tracking-widest">FREE FLIGHT MODE</span>
          <Badge className="bg-violet-900/40 text-violet-400 border-violet-700/50 text-[10px] font-mono uppercase">
            NO SCORE IMPACT · NO DAMAGE
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge className="bg-emerald-900/40 text-emerald-400 border-emerald-700/50 flex items-center gap-1 text-[10px] font-mono uppercase h-7">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              {simLabel}
            </Badge>
          ) : (
            <Badge className="bg-slate-800 text-slate-500 border-slate-700 text-[10px] font-mono uppercase h-7">
              Sim nicht verbunden
            </Badge>
          )}
          {dataAge !== null && (
            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
              dataAge < 3000 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-700/50' :
              'bg-red-500/20 text-red-400 border-red-700/50'
            }`}>
              {(dataAge / 1000).toFixed(1)}s ago
            </span>
          )}
        </div>
      </div>

      {/* Instruments Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'ALTITUDE', value: `${Math.round(flightData.altitude).toLocaleString()} ft`, color: 'text-blue-400' },
          { label: 'SPEED', value: `${Math.round(flightData.speed)} kts`, color: 'text-emerald-400' },
          { label: 'V/S', value: `${flightData.verticalSpeed > 0 ? '+' : ''}${Math.round(flightData.verticalSpeed)} ft/min`, color: flightData.verticalSpeed > 0 ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'G-FORCE', value: `${flightData.gForce.toFixed(2)} G`, color: flightData.gForce > 1.8 ? 'text-red-400' : flightData.gForce > 1.3 ? 'text-amber-400' : 'text-emerald-400' },
        ].map((item) => (
          <Card key={item.label} className="p-3 bg-slate-900/80 border-slate-700 text-center">
            <p className="text-slate-500 text-[10px] font-mono uppercase mb-1">{item.label}</p>
            <p className={`text-lg font-mono font-bold ${item.color}`}>{item.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Score + Events */}
        <div className="space-y-3">
          {/* Flight Score (display only) */}
          <Card className="p-4 bg-slate-950/80 border-slate-700">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-cyan-400">
              <Star className="w-4 h-4" />
              Flight Score <span className="text-[10px] text-violet-400 ml-1">(kein Einfluss)</span>
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Score</span>
                <span className={`text-2xl font-bold font-mono ${
                  flightData.flightScore >= 90 ? 'text-emerald-400' :
                  flightData.flightScore >= 70 ? 'text-amber-400' : 'text-red-400'
                }`}>{Math.round(flightData.flightScore)}</span>
              </div>
              <Progress value={flightData.flightScore} className="h-2 bg-slate-700" />
              {flightData.landingType && (
                <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-700">
                  <span className="text-slate-400">Landing</span>
                  <span className={`font-bold ${landingLabels[flightData.landingType]?.color || 'text-slate-300'}`}>
                    {landingLabels[flightData.landingType]?.label}
                  </span>
                </div>
              )}
              {flightData.landingGForce > 0 && (
                <div className="flex justify-between text-xs font-mono text-slate-500">
                  <span>Landing G</span>
                  <span>{flightData.landingGForce.toFixed(2)} G</span>
                </div>
              )}
              {flightData.landingVs !== 0 && (
                <div className="flex justify-between text-xs font-mono text-slate-500">
                  <span>Touch V/S</span>
                  <span>{Math.round(flightData.landingVs)} ft/min</span>
                </div>
              )}
            </div>

            {/* Events */}
            {Object.entries(flightData.events).some(([_, v]) => v === true) && (
              <div className="pt-2 mt-2 border-t border-slate-700 space-y-1">
                <p className="text-[10px] text-slate-500 uppercase mb-1">Events (no penalty):</p>
                {flightData.events.tailstrike && <div className="text-xs text-orange-400 flex gap-1"><AlertTriangle className="w-3 h-3" /> Tailstrike</div>}
                {flightData.events.stall && <div className="text-xs text-red-400 flex gap-1"><AlertTriangle className="w-3 h-3" /> Stall</div>}
                {flightData.events.overstress && <div className="text-xs text-orange-400 flex gap-1"><AlertTriangle className="w-3 h-3" /> Overstress</div>}
                {flightData.events.overspeed && <div className="text-xs text-orange-400 flex gap-1"><AlertTriangle className="w-3 h-3" /> Overspeed</div>}
                {flightData.events.high_g_force && <div className="text-xs text-amber-400 flex gap-1"><AlertTriangle className="w-3 h-3" /> High G</div>}
                {flightData.events.hard_landing && <div className="text-xs text-orange-400 flex gap-1"><AlertTriangle className="w-3 h-3" /> Hard Landing</div>}
                {flightData.events.crash && <div className="text-xs text-red-400 flex gap-1"><AlertTriangle className="w-3 h-3" /> Crash</div>}
              </div>
            )}
          </Card>

          {/* Fuel */}
          <Card className="p-3 bg-slate-900/80 border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold flex items-center gap-2 text-amber-400">
                <Fuel className="w-3 h-3" /> {t('fuel_title', lang)}
              </h3>
              <span className="text-amber-400 font-mono text-xs">{Math.round(flightData.fuel)}%</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-800 rounded p-2 text-center">
                <p className="text-slate-500 text-[10px]">%</p>
                <p className="text-amber-400 font-bold">{Math.round(flightData.fuel)}%</p>
              </div>
              <div className="bg-slate-800 rounded p-2 text-center">
                <p className="text-slate-500 text-[10px]">KG</p>
                <p className="text-amber-400 font-bold">{Math.round(flightData.fuelKg).toLocaleString()}</p>
              </div>
            </div>
          </Card>

          {/* Position */}
          <Card className="p-3 bg-slate-900/80 border-slate-700">
            <h3 className="text-[10px] font-mono uppercase text-slate-400 mb-2 flex items-center gap-2">
              <Activity className="w-3 h-3 text-cyan-400" /> Position
            </h3>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between"><span className="text-slate-500">LAT</span><span className="text-cyan-300">{(flightData.latitude || 0).toFixed(5)}°</span></div>
              <div className="flex justify-between"><span className="text-slate-500">LON</span><span className="text-cyan-300">{(flightData.longitude || 0).toFixed(5)}°</span></div>
              <div className="flex justify-between"><span className="text-slate-500">HDG</span><span className="text-cyan-300">{Math.round(flightData.heading)}°</span></div>
            </div>
          </Card>

          {/* Weather */}
          <WeatherDisplay raw={raw} />
        </div>

        {/* Right: Map (2/3 width) */}
        <div className="lg:col-span-2 space-y-3">
          <FlightMapIframe
            flightData={flightData}
            contract={null}
            waypoints={raw.fms_waypoints || []}
            routeWaypoints={simbriefRoute?.waypoints || []}
            flightPath={raw.flight_path || []}
            departureRunway={simbriefRoute?.departure_runway}
            arrivalRunway={simbriefRoute?.arrival_runway}
            departureCoords={simbriefRoute?.departure_coords}
            arrivalCoords={simbriefRoute?.arrival_coords}
            onViewModeChange={null}
            liveFlightData={{
              gForce: flightData.gForce,
              maxGForce: flightData.maxGForce,
              fuelPercent: flightData.fuel,
              fuelKg: flightData.fuelKg,
              flightScore: flightData.flightScore,
              events: flightData.events
            }}
          />

          <SimBriefImport
            contract={null}
            onRouteLoaded={(data) => setSimbriefRoute(data)}
          />
        </div>
      </div>
    </div>
  );
}