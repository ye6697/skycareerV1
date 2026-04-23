import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter } from
"@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plane } from
"lucide-react";

import AircraftCard from "@/components/aircraft/AircraftCard";
import Fleet3DView from "@/components/fleet3d/Fleet3DView";
import MarketHangar3DView from "@/components/fleet3d/MarketHangar3DView";
import InsolvencyBanner from "@/components/InsolvencyBanner";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";
import { useToast } from "@/components/ui/use-toast";
import { DEFAULT_INSURANCE_PLAN, getInsurancePlanConfig } from '@/lib/insurance';
const FAILURE_TOGGLE_UI_VERSION = 'ft-2026-04-07-e';

const AIRCRAFT_MARKET_SPECS = [
// === SMALL PROPS (Level 1) ===
{ name: "Icon A5", type: "small_prop", passenger_capacity: 1, cargo_capacity_kg: 60, fuel_consumption_per_hour: 23, range_nm: 300, purchase_price: 120000, maintenance_cost_per_hour: 20, level_requirement: 1 },
{ name: "Piper PA-18 Super Cub", type: "small_prop", passenger_capacity: 1, cargo_capacity_kg: 100, fuel_consumption_per_hour: 35, range_nm: 400, purchase_price: 180000, maintenance_cost_per_hour: 30, level_requirement: 1 },
{ name: "Robin DR400", type: "small_prop", passenger_capacity: 3, cargo_capacity_kg: 120, fuel_consumption_per_hour: 38, range_nm: 550, purchase_price: 200000, maintenance_cost_per_hour: 25, level_requirement: 1 },
{ name: "Cessna 152", type: "small_prop", passenger_capacity: 1, cargo_capacity_kg: 55, fuel_consumption_per_hour: 25, range_nm: 415, purchase_price: 210000, maintenance_cost_per_hour: 20, level_requirement: 1 },
{ name: "Vans RV-10", type: "small_prop", passenger_capacity: 3, cargo_capacity_kg: 180, fuel_consumption_per_hour: 48, range_nm: 900, purchase_price: 250000, maintenance_cost_per_hour: 35, level_requirement: 1 },
{ name: "Diamond DA40 NG", type: "small_prop", passenger_capacity: 3, cargo_capacity_kg: 110, fuel_consumption_per_hour: 30, range_nm: 720, purchase_price: 300000, maintenance_cost_per_hour: 28, level_requirement: 1 },
{ name: "Cessna 172 Skyhawk", type: "small_prop", passenger_capacity: 3, cargo_capacity_kg: 100, fuel_consumption_per_hour: 45, range_nm: 640, purchase_price: 425000, maintenance_cost_per_hour: 25, level_requirement: 1 },
{ name: "Beechcraft Bonanza G36", type: "small_prop", passenger_capacity: 4, cargo_capacity_kg: 250, fuel_consumption_per_hour: 75, range_nm: 920, purchase_price: 430000, maintenance_cost_per_hour: 55, level_requirement: 1 },
{ name: "Beechcraft Baron 58", type: "small_prop", passenger_capacity: 4, cargo_capacity_kg: 340, fuel_consumption_per_hour: 130, range_nm: 1480, purchase_price: 450000, maintenance_cost_per_hour: 80, level_requirement: 1 },
{ name: "Diamond DA62", type: "small_prop", passenger_capacity: 6, cargo_capacity_kg: 280, fuel_consumption_per_hour: 55, range_nm: 1300, purchase_price: 550000, maintenance_cost_per_hour: 45, level_requirement: 1 },
{ name: "Cessna 208B Grand Caravan", type: "small_prop", passenger_capacity: 9, cargo_capacity_kg: 1100, fuel_consumption_per_hour: 180, range_nm: 900, purchase_price: 580000, maintenance_cost_per_hour: 60, level_requirement: 1 },
{ name: "Cirrus SR22", type: "small_prop", passenger_capacity: 3, cargo_capacity_kg: 180, fuel_consumption_per_hour: 60, range_nm: 1050, purchase_price: 650000, maintenance_cost_per_hour: 50, level_requirement: 1 },

// === TURBOPROPS (Level 2-4) ===
{ name: "Daher Kodiak 100", type: "turboprop", passenger_capacity: 9, cargo_capacity_kg: 1400, fuel_consumption_per_hour: 200, range_nm: 1132, purchase_price: 750000, maintenance_cost_per_hour: 90, level_requirement: 2 },
{ name: "Lancair Evolution", type: "turboprop", passenger_capacity: 3, cargo_capacity_kg: 200, fuel_consumption_per_hour: 120, range_nm: 1400, purchase_price: 800000, maintenance_cost_per_hour: 100, level_requirement: 2 },
{ name: "Daher TBM 930", type: "turboprop", passenger_capacity: 5, cargo_capacity_kg: 300, fuel_consumption_per_hour: 190, range_nm: 1650, purchase_price: 1200000, maintenance_cost_per_hour: 150, level_requirement: 2 },
{ name: "Beechcraft King Air C90B", type: "turboprop", passenger_capacity: 7, cargo_capacity_kg: 600, fuel_consumption_per_hour: 250, range_nm: 1260, purchase_price: 1800000, maintenance_cost_per_hour: 250, level_requirement: 3 },
{ name: "Pilatus PC-12 NGX", type: "turboprop", passenger_capacity: 9, cargo_capacity_kg: 1100, fuel_consumption_per_hour: 280, range_nm: 1800, purchase_price: 2500000, maintenance_cost_per_hour: 200, level_requirement: 3 },
{ name: "Beechcraft King Air 350i", type: "turboprop", passenger_capacity: 11, cargo_capacity_kg: 800, fuel_consumption_per_hour: 310, range_nm: 1800, purchase_price: 3200000, maintenance_cost_per_hour: 320, level_requirement: 4 },

// === LIGHT JETS (Level 2-6) ===
{ name: "Cirrus Vision SF50", type: "regional_jet", passenger_capacity: 4, cargo_capacity_kg: 225, fuel_consumption_per_hour: 200, range_nm: 1200, purchase_price: 2900000, maintenance_cost_per_hour: 300, level_requirement: 2 },
{ name: "Honda HA-420 HondaJet", type: "regional_jet", passenger_capacity: 5, cargo_capacity_kg: 280, fuel_consumption_per_hour: 280, range_nm: 1220, purchase_price: 3800000, maintenance_cost_per_hour: 350, level_requirement: 3 },
{ name: "Cessna Citation CJ4", type: "regional_jet", passenger_capacity: 7, cargo_capacity_kg: 350, fuel_consumption_per_hour: 550, range_nm: 2165, purchase_price: 6500000, maintenance_cost_per_hour: 550, level_requirement: 4 },
{ name: "Cessna Citation Longitude", type: "regional_jet", passenger_capacity: 8, cargo_capacity_kg: 500, fuel_consumption_per_hour: 700, range_nm: 3500, purchase_price: 9500000, maintenance_cost_per_hour: 750, level_requirement: 5 },
{ name: "Cessna Citation X", type: "regional_jet", passenger_capacity: 8, cargo_capacity_kg: 450, fuel_consumption_per_hour: 900, range_nm: 3070, purchase_price: 12000000, maintenance_cost_per_hour: 900, level_requirement: 6 },

// === REGIONAL AIRLINERS (Level 7-14) ===
{ name: "Pilatus PC-24", type: "regional_jet", passenger_capacity: 8, cargo_capacity_kg: 600, fuel_consumption_per_hour: 750, range_nm: 2000, purchase_price: 15000000, maintenance_cost_per_hour: 600, level_requirement: 7 },
{ name: "Bombardier Dash 8-400", type: "turboprop", passenger_capacity: 78, cargo_capacity_kg: 2500, fuel_consumption_per_hour: 700, range_nm: 1550, purchase_price: 25000000, maintenance_cost_per_hour: 250, level_requirement: 9 },
{ name: "ATR 72F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 6000, fuel_consumption_per_hour: 350, range_nm: 2400, purchase_price: 28000000, maintenance_cost_per_hour: 600, level_requirement: 10 },
{ name: "Bombardier CRJ-200", type: "regional_jet", passenger_capacity: 50, cargo_capacity_kg: 1500, fuel_consumption_per_hour: 1600, range_nm: 2000, purchase_price: 35000000, maintenance_cost_per_hour: 350, level_requirement: 11 },
{ name: "Bombardier CRJ-700", type: "regional_jet", passenger_capacity: 66, cargo_capacity_kg: 1800, fuel_consumption_per_hour: 1900, range_nm: 2350, purchase_price: 42000000, maintenance_cost_per_hour: 400, level_requirement: 12 },
{ name: "Embraer E175", type: "regional_jet", passenger_capacity: 76, cargo_capacity_kg: 2000, fuel_consumption_per_hour: 2400, range_nm: 2200, purchase_price: 50000000, maintenance_cost_per_hour: 450, level_requirement: 13 },
{ name: "Airbus A220-300", type: "regional_jet", passenger_capacity: 145, cargo_capacity_kg: 3400, fuel_consumption_per_hour: 2800, range_nm: 3350, purchase_price: 65000000, maintenance_cost_per_hour: 650, level_requirement: 14 },
{ name: "McDonnell Douglas MD-82", type: "narrow_body", passenger_capacity: 155, cargo_capacity_kg: 4500, fuel_consumption_per_hour: 3000, range_nm: 2050, purchase_price: 55000000, maintenance_cost_per_hour: 950, level_requirement: 14 },

// === NARROW BODY (Level 15-20) ===
{ name: "Airbus A310-300", type: "narrow_body", passenger_capacity: 220, cargo_capacity_kg: 6000, fuel_consumption_per_hour: 4500, range_nm: 4800, purchase_price: 70000000, maintenance_cost_per_hour: 1000, level_requirement: 15 },
{ name: "Airbus A318", type: "narrow_body", passenger_capacity: 108, cargo_capacity_kg: 3200, fuel_consumption_per_hour: 2200, range_nm: 3100, purchase_price: 75000000, maintenance_cost_per_hour: 800, level_requirement: 15 },
{ name: "Boeing 737-700", type: "narrow_body", passenger_capacity: 148, cargo_capacity_kg: 4200, fuel_consumption_per_hour: 2900, range_nm: 3250, purchase_price: 82000000, maintenance_cost_per_hour: 1000, level_requirement: 15 },
{ name: "Airbus A319", type: "narrow_body", passenger_capacity: 140, cargo_capacity_kg: 3850, fuel_consumption_per_hour: 2600, range_nm: 3300, purchase_price: 85000000, maintenance_cost_per_hour: 950, level_requirement: 16 },
{ name: "Boeing 737-800", type: "narrow_body", passenger_capacity: 189, cargo_capacity_kg: 5200, fuel_consumption_per_hour: 3200, range_nm: 3195, purchase_price: 98000000, maintenance_cost_per_hour: 1100, level_requirement: 16 },
{ name: "Airbus A320neo", type: "narrow_body", passenger_capacity: 180, cargo_capacity_kg: 5000, fuel_consumption_per_hour: 3200, range_nm: 3500, purchase_price: 100000000, maintenance_cost_per_hour: 1200, level_requirement: 17 },
{ name: "Boeing 737 MAX 8", type: "narrow_body", passenger_capacity: 210, cargo_capacity_kg: 5300, fuel_consumption_per_hour: 3500, range_nm: 3500, purchase_price: 105000000, maintenance_cost_per_hour: 1350, level_requirement: 18 },
{ name: "Boeing 757-200", type: "narrow_body", passenger_capacity: 228, cargo_capacity_kg: 5800, fuel_consumption_per_hour: 3800, range_nm: 3900, purchase_price: 115000000, maintenance_cost_per_hour: 1400, level_requirement: 18 },
{ name: "Airbus A321neo", type: "narrow_body", passenger_capacity: 220, cargo_capacity_kg: 5800, fuel_consumption_per_hour: 3600, range_nm: 4000, purchase_price: 120000000, maintenance_cost_per_hour: 1450, level_requirement: 19 },
{ name: "Boeing 787-8", type: "narrow_body", passenger_capacity: 242, cargo_capacity_kg: 4500, fuel_consumption_per_hour: 3800, range_nm: 5000, purchase_price: 140000000, maintenance_cost_per_hour: 1600, level_requirement: 20 },
{ name: "Boeing 787-10", type: "narrow_body", passenger_capacity: 330, cargo_capacity_kg: 5500, fuel_consumption_per_hour: 4200, range_nm: 6430, purchase_price: 155000000, maintenance_cost_per_hour: 1800, level_requirement: 20 },

// === WIDE BODY (Level 21-31) ===
{ name: "Airbus A300", type: "wide_body", passenger_capacity: 266, cargo_capacity_kg: 11000, fuel_consumption_per_hour: 6500, range_nm: 4800, purchase_price: 150000000, maintenance_cost_per_hour: 2400, level_requirement: 21 },
{ name: "Boeing 767-300ER", type: "wide_body", passenger_capacity: 290, cargo_capacity_kg: 13000, fuel_consumption_per_hour: 7000, range_nm: 5990, purchase_price: 170000000, maintenance_cost_per_hour: 2500, level_requirement: 21 },
{ name: "Airbus A330-200F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 70000, fuel_consumption_per_hour: 7000, range_nm: 5550, purchase_price: 185000000, maintenance_cost_per_hour: 2600, level_requirement: 22 },
{ name: "Airbus A330-900neo", type: "wide_body", passenger_capacity: 440, cargo_capacity_kg: 15500, fuel_consumption_per_hour: 7200, range_nm: 6550, purchase_price: 210000000, maintenance_cost_per_hour: 2800, level_requirement: 22 },
{ name: "Airbus A330-300", type: "wide_body", passenger_capacity: 440, cargo_capacity_kg: 15200, fuel_consumption_per_hour: 7500, range_nm: 6350, purchase_price: 220000000, maintenance_cost_per_hour: 3000, level_requirement: 23 },
{ name: "Boeing 747-400", type: "wide_body", passenger_capacity: 416, cargo_capacity_kg: 20000, fuel_consumption_per_hour: 11000, range_nm: 7260, purchase_price: 240000000, maintenance_cost_per_hour: 3800, level_requirement: 24 },
{ name: "Boeing 777-200ER", type: "wide_body", passenger_capacity: 350, cargo_capacity_kg: 20000, fuel_consumption_per_hour: 9200, range_nm: 7065, purchase_price: 260000000, maintenance_cost_per_hour: 3200, level_requirement: 25 },
{ name: "Boeing 777-300ER", type: "wide_body", passenger_capacity: 396, cargo_capacity_kg: 22000, fuel_consumption_per_hour: 10000, range_nm: 7370, purchase_price: 285000000, maintenance_cost_per_hour: 3500, level_requirement: 26 },
{ name: "Airbus A350-900", type: "wide_body", passenger_capacity: 325, cargo_capacity_kg: 16600, fuel_consumption_per_hour: 8200, range_nm: 8000, purchase_price: 300000000, maintenance_cost_per_hour: 3800, level_requirement: 27 },
{ name: "Boeing 777F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 102000, fuel_consumption_per_hour: 9500, range_nm: 4435, purchase_price: 330000000, maintenance_cost_per_hour: 3600, level_requirement: 28 },
{ name: "Boeing 747-8", type: "wide_body", passenger_capacity: 467, cargo_capacity_kg: 21870, fuel_consumption_per_hour: 11200, range_nm: 8000, purchase_price: 360000000, maintenance_cost_per_hour: 4200, level_requirement: 29 },
{ name: "Boeing 747-8F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 134000, fuel_consumption_per_hour: 14500, range_nm: 4120, purchase_price: 400000000, maintenance_cost_per_hour: 4500, level_requirement: 30 },
{ name: "Aérospatiale/BAC Concorde", type: "wide_body", passenger_capacity: 120, cargo_capacity_kg: 2500, fuel_consumption_per_hour: 15000, range_nm: 3900, purchase_price: 395000000, maintenance_cost_per_hour: 5200, level_requirement: 28 },
{ name: "Airbus A380", type: "wide_body", passenger_capacity: 555, cargo_capacity_kg: 18600, fuel_consumption_per_hour: 12500, range_nm: 8000, purchase_price: 440000000, maintenance_cost_per_hour: 5000, level_requirement: 31 }];

const HANGAR_SIZE_RULES = {
  small: { slots: 2, allowed_types: ['small_prop', 'turboprop'] },
  medium: { slots: 4, allowed_types: ['small_prop', 'turboprop', 'regional_jet'] },
  large: { slots: 6, allowed_types: ['small_prop', 'turboprop', 'regional_jet', 'narrow_body', 'cargo'] },
  mega: { slots: 10, allowed_types: ['small_prop', 'turboprop', 'regional_jet', 'narrow_body', 'wide_body', 'cargo'] }
};

const resolveHangarRule = (hangar) => {
  const fallback = HANGAR_SIZE_RULES[hangar?.size] || HANGAR_SIZE_RULES.small;
  const customSlots = Number(hangar?.slots);
  const allowedTypes = Array.isArray(hangar?.allowed_types) && hangar.allowed_types.length > 0
    ? hangar.allowed_types
    : fallback.allowed_types;
  return {
    slots: Number.isFinite(customSlots) && customSlots > 0 ? customSlots : fallback.slots,
    allowed_types: allowedTypes,
  };
};

const getAssignableHangarsForType = (hangars = [], aircraft = [], aircraftType) => {
  return hangars
    .map((hangar) => {
      const rule = resolveHangarRule(hangar);
      const used = aircraft.filter((entry) => entry.status !== 'sold' && normIcao(entry.hangar_airport) === normIcao(hangar.airport_icao)).length;
      return {
        ...hangar,
        rule,
        usedSlots: used,
        freeSlots: Math.max(0, rule.slots - used),
      };
    })
    .filter((entry) => entry.rule.allowed_types.includes(aircraftType) && entry.freeSlots > 0)
    .sort((a, b) => b.freeSlots - a.freeSlots);
};


const MAINTENANCE_CATEGORY_KEYS = ['engine', 'hydraulics', 'avionics', 'airframe', 'landing_gear', 'electrical', 'flight_controls', 'pressurization'];
const makeCategoryMap = (source, fallbackValue = 0) =>
MAINTENANCE_CATEGORY_KEYS.reduce((acc, key) => {
  const raw = source?.[key];
  const value = Number.isFinite(Number(raw)) ? Number(raw) : Number(fallbackValue);
  acc[key] = Math.max(0, value);
  return acc;
}, {});
const MAINTENANCE_CATEGORY_LABELS = {
  engine: { en: 'Engine', de: 'Triebwerk' },
  hydraulics: { en: 'Hydraulics', de: 'Hydraulik' },
  avionics: { en: 'Avionics', de: 'Avionik' },
  airframe: { en: 'Airframe', de: 'Zelle' },
  landing_gear: { en: 'Landing gear', de: 'Fahrwerk' },
  electrical: { en: 'Electrical', de: 'Elektrik' },
  flight_controls: { en: 'Flight controls', de: 'Flugsteuerung' },
  pressurization: { en: 'Pressurization', de: 'Drucksystem' }
};

const USED_CONDITION_PROFILES = [
{
  key: 'ready',
  label: { en: 'Ready to fly', de: 'Sofort einsatzbereit' },
  minDiscount: 0.72,
  maxDiscount: 0.9,
  minLiveWear: 3,
  maxLiveWear: 18,
  minPermanentWear: 2.5,
  maxPermanentWear: 6,
  minAccumulatedCostPct: 0.002,
  maxAccumulatedCostPct: 0.01,
  minAgeYears: 2,
  maxAgeYears: 9
},
{
  key: 'service_due',
  label: { en: 'Service due soon', de: 'Service bald faellig' },
  minDiscount: 0.55,
  maxDiscount: 0.74,
  minLiveWear: 18,
  maxLiveWear: 48,
  minPermanentWear: 6,
  maxPermanentWear: 14,
  minAccumulatedCostPct: 0.01,
  maxAccumulatedCostPct: 0.03,
  minAgeYears: 6,
  maxAgeYears: 16
},
{
  key: 'project',
  label: { en: 'Project aircraft', de: 'Projektflugzeug' },
  minDiscount: 0.34,
  maxDiscount: 0.58,
  minLiveWear: 45,
  maxLiveWear: 85,
  minPermanentWear: 14,
  maxPermanentWear: 32,
  minAccumulatedCostPct: 0.03,
  maxAccumulatedCostPct: 0.08,
  minAgeYears: 10,
  maxAgeYears: 28
}];


const usedMarketLerp = (min, max, t) => min + (max - min) * t;

const seededValue = (seed) => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0) / 4294967295;
};

const pickUsedProfile = (value) => {
  if (value < 0.45) return USED_CONDITION_PROFILES[0];
  if (value < 0.8) return USED_CONDITION_PROFILES[1];
  return USED_CONDITION_PROFILES[2];
};

const buildUsedMarketInventory = ({ companyLevel = 1, marketSeed = '' } = {}) => {
  const maxLevel = Math.min(31, Math.max(4, companyLevel + 6));
  const minLevel = Math.max(1, companyLevel - 6);
  const candidatePool = AIRCRAFT_MARKET_SPECS.filter((ac) => ac.level_requirement >= minLevel && ac.level_requirement <= maxLevel);
  const poolByType = candidatePool.reduce((acc, ac) => {
    if (!acc[ac.type]) acc[ac.type] = [];
    acc[ac.type].push(ac);
    return acc;
  }, {});

  const selectedModels = [];
  Object.entries(poolByType).forEach(([typeKey, typeModels]) => {
    const ranked = [...typeModels].
    map((ac) => ({
      aircraft: ac,
      score: Math.abs((ac.level_requirement || 1) - companyLevel) + seededValue(`${marketSeed}-${typeKey}-${ac.name}`)
    })).
    sort((a, b) => a.score - b.score);

    const typeSlots = Math.min(3, ranked.length);
    selectedModels.push(...ranked.slice(0, typeSlots).map((entry) => entry.aircraft));
  });

  const listings = [];
  selectedModels.forEach((ac) => {
    const variantCount = 1 + Math.floor(seededValue(`${marketSeed}-${ac.name}-variants`) * 3);
    for (let variant = 0; variant < variantCount; variant += 1) {
      const profile = pickUsedProfile(seededValue(`${marketSeed}-${ac.name}-${variant}-profile`));
      const discountFactor = usedMarketLerp(
        profile.minDiscount,
        profile.maxDiscount,
        seededValue(`${marketSeed}-${ac.name}-${variant}-discount`)
      );
      const usedPrice = Math.round(ac.purchase_price * Math.max(0.28, Math.min(0.93, discountFactor)));

      const accumulatedMaintenanceCost = Math.round(
        Math.max(
          1500,
          ac.purchase_price * usedMarketLerp(
            profile.minAccumulatedCostPct,
            profile.maxAccumulatedCostPct,
            seededValue(`${marketSeed}-${ac.name}-${variant}-acc`)
          )
        )
      );
      const lifetimeMaintenanceCost = Math.round(
        accumulatedMaintenanceCost + ac.purchase_price * usedMarketLerp(0.04, 0.22, seededValue(`${marketSeed}-${ac.name}-${variant}-life`))
      );

      const maintenance_categories = {};
      const permanent_wear_categories = {};
      MAINTENANCE_CATEGORY_KEYS.forEach((key, catIndex) => {
        const liveWear = usedMarketLerp(
          profile.minLiveWear,
          profile.maxLiveWear,
          seededValue(`${marketSeed}-${ac.name}-${variant}-${key}-live-${catIndex}`)
        );
        const permanentWear = usedMarketLerp(
          profile.minPermanentWear,
          profile.maxPermanentWear,
          seededValue(`${marketSeed}-${ac.name}-${variant}-${key}-perm-${catIndex}`)
        );
        maintenance_categories[key] = Number(liveWear.toFixed(1));
        permanent_wear_categories[key] = Number(permanentWear.toFixed(2));
      });

      const liveWearValues = Object.values(maintenance_categories);
      const permanentWearValues = Object.values(permanent_wear_categories);
      const avgLiveWear = liveWearValues.reduce((sum, value) => sum + Number(value), 0) / liveWearValues.length;
      const maxLiveWear = Math.max(...liveWearValues.map((value) => Number(value)));
      const avgPermanentWear = permanentWearValues.reduce((sum, value) => sum + Number(value), 0) / permanentWearValues.length;
      const ageYears = Math.round(
        usedMarketLerp(
          profile.minAgeYears,
          profile.maxAgeYears,
          seededValue(`${marketSeed}-${ac.name}-${variant}-age`)
        )
      );
      const totalHours = Math.round(
        usedMarketLerp(400, 12000, seededValue(`${marketSeed}-${ac.name}-${variant}-hours`)) * (1 + (ac.level_requirement || 1) * 0.03)
      );

      listings.push({
        ...ac,
        purchase_price: usedPrice,
        marketType: 'used',
        original_price: ac.purchase_price,
        accumulated_maintenance_cost: accumulatedMaintenanceCost,
        lifetime_maintenance_cost: lifetimeMaintenanceCost,
        maintenance_categories,
        permanent_wear_categories,
        used_condition_key: profile.key,
        used_condition_label: profile.label,
        used_wear_avg: Number(avgLiveWear.toFixed(1)),
        used_wear_peak: Number(maxLiveWear.toFixed(1)),
        used_permanent_avg: Number(avgPermanentWear.toFixed(2)),
        used_age_years: ageYears,
        total_flight_hours: totalHours,
        market_listing_id: `${ac.name}-${profile.key}-${variant}-${Math.round(usedPrice / 1000)}`
      });
    }
  });

  return listings.
  sort((a, b) => {
    const levelDiff = Math.abs((a.level_requirement || 1) - companyLevel) - Math.abs((b.level_requirement || 1) - companyLevel);
    if (levelDiff !== 0) return levelDiff;
    return a.purchase_price - b.purchase_price;
  }).
  slice(0, 24);
};

function normIcao(value) {
  return String(value || '').toUpperCase();
}

export default function Fleet() {
  const { state } = useLocation();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState('3d'); // '3d' | 'grid'
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [selectedPurchaseHangarIcao, setSelectedPurchaseHangarIcao] = useState('');
  const [marketSection, setMarketSection] = useState('new');
  const [marketViewMode, setMarketViewMode] = useState('3d');
  const [usedConditionFilter, setUsedConditionFilter] = useState('all');
  const [maintenancePreviewListing, setMaintenancePreviewListing] = useState(null);
  const [failureToggleError, setFailureToggleError] = useState('');
  const usedMarketSeed = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const resolveUserCompanyId = React.useCallback((user) =>
  user?.company_id ||
  user?.data?.company_id ||
  user?.company?.id ||
  user?.data?.company?.id ||
  null,
  []);

  const { data: templates = [] } = useQuery({
    queryKey: ['aircraftTemplates'],
    queryFn: async () => {
      return await base44.entities.AircraftTemplate.list();
    },
    staleTime: 300000,
    refetchOnWindowFocus: false
  });


  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  const { data: company } = useQuery({
    queryKey: ['company', resolveUserCompanyId(currentUser)],
    queryFn: async () => {
      const companyId = resolveUserCompanyId(currentUser);
      if (companyId) {
        const companies = await base44.entities.Company.filter({ id: companyId });
        if (companies[0]) return companies[0];
      }
      const companies = await base44.entities.Company.filter({ created_by: currentUser.email });
      return companies[0];
    },
    enabled: !!currentUser,
    staleTime: 120000,
    refetchOnWindowFocus: false
  });

  const loadCurrentCompany = React.useCallback(async () => {
    if (company?.id) return company;
    const user = currentUser || (await base44.auth.me());
    const companyId = resolveUserCompanyId(user);
    if (companyId) {
      const companies = await base44.entities.Company.filter({ id: companyId });
      if (companies[0]) return companies[0];
    }
    if (user?.email) {
      const byOwner = await base44.entities.Company.filter({ created_by: user.email });
      if (byOwner[0]) return byOwner[0];
    }
    return null;
  }, [company, currentUser, resolveUserCompanyId]);

  const failureTriggerStateKey = React.useMemo(
    () => ['failure-trigger-state', company?.id || 'unknown'],
    [company?.id]
  );

  const { data: failureTriggerState } = useQuery({
    queryKey: failureTriggerStateKey,
    queryFn: async () => {
      const currentCompany = await loadCurrentCompany();
      const response = await base44.functions.invoke('toggleFailureTriggers', {
        companyId: currentCompany?.id || null
      });
      if (typeof response?.data?.enabled === 'boolean') return response.data.enabled;
      return null;
    },
    enabled: !!currentUser,
    staleTime: 30000,
    refetchOnWindowFocus: false
  });

  const failureTriggersEnabled = typeof failureTriggerState === 'boolean' ?
  failureTriggerState :
  true;
  const effectiveFailureEnabled = failureTriggersEnabled;

  const toggleFailureTriggersMutation = useMutation({
    onMutate: async (_enabled) => {
      const previous = queryClient.getQueryData(failureTriggerStateKey);
      return { previous };
    },
    mutationFn: async (enabled) => {
      setFailureToggleError('');
      const currentCompany = await loadCurrentCompany();
      const targetEnabled = !!enabled;
      const targetCompanyId = currentCompany?.id || null;

      const response = await Promise.race([
        base44.functions.invoke('toggleFailureTriggers', {
          enabled: targetEnabled,
          companyId: targetCompanyId
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('toggle_timeout')), 12000))]
      );
      const invokeError = response?.error || response?.data?.error;
      if (invokeError) {
        throw new Error(
          typeof invokeError === 'string' ?
          invokeError :
          invokeError?.message || 'toggle_invoke_failed'
        );
      }

      if (typeof response?.data?.enabled === 'boolean') return response.data.enabled;

      const verify = await base44.functions.invoke('toggleFailureTriggers', {
        companyId: targetCompanyId
      });
      if (typeof verify?.data?.enabled === 'boolean') return verify.data.enabled;
      throw new Error('toggle_unconfirmed');
    },
    onSuccess: (resolvedEnabled) => {
      const enabled = !!resolvedEnabled;
      queryClient.setQueryData(failureTriggerStateKey, enabled);
      queryClient.setQueryData(['company'], (prev) =>
      prev ? { ...prev, failure_triggers_enabled: enabled } : prev
      );
      queryClient.setQueryData(['company', resolveUserCompanyId(currentUser)], (prev) =>
      prev ? { ...prev, failure_triggers_enabled: enabled } : prev
      );
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['company-maint-limit'] });
      queryClient.invalidateQueries({ queryKey: failureTriggerStateKey });
    },
    onError: (_error, _enabled, context) => {
      if (context && Object.prototype.hasOwnProperty.call(context, 'previous')) {
        queryClient.setQueryData(failureTriggerStateKey, context.previous);
      }
      setFailureToggleError(
        lang === 'de' ?
        'Konnte den Failure-Trigger nicht umschalten.' :
        'Could not toggle failure trigger.'
      );
      queryClient.invalidateQueries({ queryKey: failureTriggerStateKey });
    }
  });

  const usedMarketInventory = React.useMemo(
    () => buildUsedMarketInventory({ companyLevel: company?.level || 1, marketSeed: usedMarketSeed }),
    [company?.level, usedMarketSeed]
  );

  const { data: aircraft = [], isLoading } = useQuery({
    queryKey: ['aircraft', company?.id],
    queryFn: async () => {
      return await base44.entities.Aircraft.filter({ company_id: company.id }, '-created_date');
    },
    enabled: !!company?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false
  });

  const purchaseMutation = useMutation({
    mutationFn: async (aircraftData) => {
      const callsignPrefix = company?.callsign || 'N';
      const aircraftCount = aircraft.filter((a) => a.status !== 'sold').length;
      const registration = `${callsignPrefix}-${String(aircraftCount + 1).padStart(3, '0')}`;

      const specs = AIRCRAFT_MARKET_SPECS.find((a) => a.name === aircraftData.name) || aircraftData;
      const template = templates.find((t) => t.name === aircraftData.name);
      const defaultInsurance = getInsurancePlanConfig(DEFAULT_INSURANCE_PLAN);
      const finalPurchasePrice = Number(aircraftData.purchase_price || specs.purchase_price || 0);
      const companyHangars = Array.isArray(company?.hangars) ? company.hangars : [];
      const selectedHangarIcao = normIcao(aircraftData?.selected_hangar_airport);
      const assignableHangars = getAssignableHangarsForType(companyHangars, aircraft, specs.type);
      const assignedHangar = assignableHangars.find((hangar) => normIcao(hangar.airport_icao) === selectedHangarIcao) || null;
      if (!assignedHangar) {
        throw new Error(
          lang === 'de'
            ? `Bitte waehle einen kompatiblen Hangar mit freiem Slot fuer ${specs.type}.`
            : `Please select a compatible hangar with free slot for ${specs.type}.`
        );
      }
      const maintenanceCategories = makeCategoryMap(aircraftData.maintenance_categories, 0);
      const dynamicWearValues = Object.values(maintenanceCategories).map((value) => Math.max(0, Number(value || 0)));
      const avgDynamicWearPct = dynamicWearValues.length > 0
        ? dynamicWearValues.reduce((sum, value) => sum + value, 0) / dynamicWearValues.length
        : 0;
      const dynamicWearRatio = Math.max(0, Math.min(1, avgDynamicWearPct / 100));
      const permanentFromListing = makeCategoryMap(aircraftData.permanent_wear_categories, 0);
      const hasPermanentFromListing = Object.values(permanentFromListing).some((value) => value > 0);
      const defaultPermanentByCondition = {
        ready: 4,
        service_due: 9,
        project: 18
      };
      const permanentFallbackValue = Math.max(
        0,
        Number(
          aircraftData.used_permanent_avg ||
          defaultPermanentByCondition[aircraftData.used_condition_key] ||
          0
        )
      );
      const permanentCategories = hasPermanentFromListing ?
      permanentFromListing :
      makeCategoryMap(null, permanentFallbackValue);
      const permanentValues = Object.values(permanentCategories).map((value) => Math.max(0, Number(value || 0)));
      const persistedPermanentAvg = permanentValues.length > 0
        ? Number((permanentValues.reduce((sum, value) => sum + value, 0) / permanentValues.length).toFixed(2))
        : 0;
      const rawAccumulatedMaintenanceCost = Math.max(0, Number(aircraftData.accumulated_maintenance_cost || 0));
      const maxAccumulatedForAircraftValue = Math.max(0, finalPurchasePrice);
      const maxAccumulatedFromDynamicWear = Math.round(maxAccumulatedForAircraftValue * dynamicWearRatio);
      const initialAccumulatedMaintenanceCost = Math.min(
        rawAccumulatedMaintenanceCost,
        maxAccumulatedForAircraftValue,
        maxAccumulatedFromDynamicWear
      );
      const initialLifetimeMaintenanceCost = Math.max(
        initialAccumulatedMaintenanceCost,
        Math.max(0, Number(aircraftData.lifetime_maintenance_cost || 0))
      );
      await base44.entities.Aircraft.create({
        ...specs,
        purchase_price: finalPurchasePrice,
        original_purchase_price: Number(aircraftData.original_price || specs.purchase_price || finalPurchasePrice),
        company_id: company.id,
        registration,
        status: 'available',
        total_flight_hours: Number(aircraftData.total_flight_hours || 0),
        current_value: finalPurchasePrice,
        image_url: template?.image_url,
        insurance_plan: defaultInsurance.key,
        insurance_hourly_rate_pct: defaultInsurance.hourlyRatePctOfNewValue,
        insurance_maintenance_coverage_pct: defaultInsurance.maintenanceCoveragePct,
        insurance_score_bonus_pct: defaultInsurance.scoreBonusPct,
        maintenance_categories: maintenanceCategories,
        permanent_wear_categories: permanentCategories,
        used_listing_permanent_wear_categories: permanentCategories,
        lifetime_maintenance_cost: initialLifetimeMaintenanceCost,
        accumulated_maintenance_cost: initialAccumulatedMaintenanceCost,
        market_origin: aircraftData.marketType || 'new',
        used_condition_key: aircraftData.used_condition_key || null,
        used_age_years: Number(aircraftData.used_age_years || 0),
        source_market_listing_id: aircraftData.market_listing_id || null,
        used_wear_avg: Number(aircraftData.used_wear_avg || 0),
        used_wear_peak: Number(aircraftData.used_wear_peak || 0),
        used_permanent_avg: Number(aircraftData.used_permanent_avg || persistedPermanentAvg || 0),
        hangar_id: assignedHangar.id,
        hangar_airport: assignedHangar.airport_icao
      });

      if (company) {
        await base44.entities.Company.update(company.id, {
          balance: (company.balance || 0) - aircraftData.purchase_price
        });
        await base44.entities.Transaction.create({
          company_id: company.id,
          type: 'expense',
          category: 'aircraft_purchase',
          amount: aircraftData.purchase_price,
          description: `${lang === 'de' ? 'Kauf' : 'Purchase'}: ${aircraftData.name}`,
          date: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setIsPurchaseDialogOpen(false);
      setSelectedAircraft(null);
      setSelectedPurchaseHangarIcao('');
    }
  });

  // Fleet wird jetzt direkt von DB geladen mit refetchInterval, state wird nicht mehr benoetigt
  const displayAircraft = aircraft;

  const filteredAircraft = displayAircraft.filter((ac) => {
    if (ac.status === 'sold') return false;
    if (ac.status === 'total_loss') return true; // Show total loss so user can scrap
    const matchesSearch = ac.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ac.registration?.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && ac.type === activeTab;
  });

  const typeLabels = {
    small_prop: t('propeller', lang),
    turboprop: t('turboprop', lang),
    regional_jet: t('regional', lang),
    narrow_body: t('narrow_body', lang),
    wide_body: t('wide_body', lang),
    cargo: t('cargo_type', lang)
  };

  const ownedHangars = React.useMemo(() => Array.isArray(company?.hangars) ? company.hangars : [], [company?.hangars]);
  const purchaseHangarOptions = React.useMemo(() => {
    if (!selectedAircraft) return [];
    return getAssignableHangarsForType(ownedHangars, aircraft, selectedAircraft.type);
  }, [aircraft, ownedHangars, selectedAircraft]);
  const selectedPurchaseHangar = React.useMemo(
    () => purchaseHangarOptions.find((hangar) => normIcao(hangar.airport_icao) === normIcao(selectedPurchaseHangarIcao)) || null,
    [purchaseHangarOptions, selectedPurchaseHangarIcao]
  );

  const beginPurchaseFlow = React.useCallback((aircraftListing) => {
    setSelectedAircraft(aircraftListing);
    setSelectedPurchaseHangarIcao('');
  }, []);
  const movableAircraft = React.useMemo(
    () => aircraft.filter((entry) => String(entry?.status || '').toLowerCase() !== 'sold'),
    [aircraft]
  );
  const [fleetMoveTargets, setFleetMoveTargets] = useState({});

  React.useEffect(() => {
    setFleetMoveTargets((previous) => {
      const next = { ...previous };
      const validIds = new Set(movableAircraft.map((entry) => entry.id));
      Object.keys(next).forEach((aircraftId) => {
        if (!validIds.has(aircraftId)) delete next[aircraftId];
      });
      movableAircraft.forEach((entry) => {
        const currentAirport = normIcao(entry?.hangar_airport);
        const alternativeAirport = normIcao(
          ownedHangars.find((hangar) => normIcao(hangar.airport_icao) !== currentAirport)?.airport_icao
        );
        if (!next[entry.id]) {
          next[entry.id] = alternativeAirport || currentAirport || normIcao(ownedHangars[0]?.airport_icao);
        }
      });
      return next;
    });
  }, [movableAircraft, ownedHangars]);

  const getAircraftTransferCost = React.useCallback((aircraftEntry, targetAirportIcao) => {
    const currentAirport = normIcao(aircraftEntry?.hangar_airport);
    const targetAirport = normIcao(targetAirportIcao);
    if (!targetAirport || !currentAirport || targetAirport === currentAirport) return 0;
    const newValue = Number(
      aircraftEntry?.original_purchase_price ||
      aircraftEntry?.purchase_price ||
      aircraftEntry?.current_value ||
      0
    );
    if (newValue <= 0) return 0;
    return Math.round(newValue * 0.1);
  }, []);

  const getFleetMoveValidation = React.useCallback((aircraftEntry, targetAirportIcao) => {
    const targetAirport = normIcao(targetAirportIcao);
    const currentAirport = normIcao(aircraftEntry?.hangar_airport);
    const targetHangar = ownedHangars.find((hangar) => normIcao(hangar.airport_icao) === targetAirport);
    if (!targetAirport || !targetHangar) {
      return { valid: false, reason: lang === 'de' ? 'Hangar waehlen.' : 'Select hangar.' };
    }
    if (targetAirport === currentAirport) {
      return { valid: false, reason: lang === 'de' ? 'Bereits in diesem Hangar.' : 'Already in this hangar.' };
    }
    const rule = resolveHangarRule(targetHangar);
    if (Array.isArray(rule.allowed_types) && rule.allowed_types.length > 0 && !rule.allowed_types.includes(aircraftEntry.type)) {
      return {
        valid: false,
        reason: lang === 'de' ? `Typ ${aircraftEntry.type} nicht erlaubt.` : `Type ${aircraftEntry.type} not allowed.`
      };
    }
    const usedSlots = movableAircraft.filter((entry) => entry.id !== aircraftEntry.id && normIcao(entry.hangar_airport) === targetAirport).length;
    if (Number(rule.slots || 0) > 0 && usedSlots >= Number(rule.slots || 0)) {
      return { valid: false, reason: lang === 'de' ? 'Keine freien Slots.' : 'No free slots.' };
    }
    const transferCost = getAircraftTransferCost(aircraftEntry, targetAirport);
    if (Number(company?.balance || 0) < transferCost) {
      return { valid: false, reason: lang === 'de' ? 'Nicht genug Guthaben.' : 'Insufficient balance.' };
    }
    return { valid: true, reason: '', transferCost, targetHangar };
  }, [ownedHangars, lang, movableAircraft, getAircraftTransferCost, company?.balance]);

  const moveAircraftMutation = useMutation({
    mutationFn: async ({ aircraftEntry, targetAirportIcao }) => {
      if (!company?.id) throw new Error('Company not found.');
      const validation = getFleetMoveValidation(aircraftEntry, targetAirportIcao);
      if (!validation.valid || !validation.targetHangar) {
        throw new Error(validation.reason || 'Invalid transfer.');
      }
      const targetAirport = normIcao(targetAirportIcao);
      const transferCost = Number(validation.transferCost || 0);
      const currentBalance = Number(company?.balance || 0);
      if (currentBalance < transferCost) throw new Error('Insufficient balance.');

      await base44.entities.Aircraft.update(aircraftEntry.id, {
        hangar_id: validation.targetHangar.id,
        hangar_airport: targetAirport,
      });

      if (transferCost > 0) {
        await base44.entities.Company.update(company.id, {
          balance: currentBalance - transferCost,
        });
        await base44.entities.Transaction.create({
          company_id: company.id,
          type: 'expense',
          category: 'hangar_transfer',
          amount: transferCost,
          description:
            lang === 'de'
              ? `Hangar-Transfer ${aircraftEntry.registration || aircraftEntry.name || aircraftEntry.id} -> ${targetAirport}`
              : `Hangar transfer ${aircraftEntry.registration || aircraftEntry.name || aircraftEntry.id} -> ${targetAirport}`,
          date: new Date().toISOString(),
        });
      }

      return { aircraftEntry, targetAirport, transferCost };
    },
    onSuccess: (result) => {
      setFleetMoveTargets((previous) => ({
        ...previous,
        [result.aircraftEntry.id]: result.targetAirport,
      }));
      queryClient.setQueryData(['aircraft', company?.id], (previous) =>
        Array.isArray(previous)
          ? previous.map((entry) =>
              entry.id === result.aircraftEntry.id
                ? {
                    ...entry,
                    hangar_airport: result.targetAirport,
                  }
                : entry
            )
          : previous
      );
      queryClient.setQueryData(['company', resolveUserCompanyId(currentUser)], (previous) =>
        previous
          ? {
              ...previous,
              balance: Math.max(0, Number(previous.balance || 0) - Number(result.transferCost || 0)),
            }
          : previous
      );
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      toast({
        title: lang === 'de' ? 'Flugzeug verschoben' : 'Aircraft moved',
        description:
          lang === 'de'
            ? `${result.aircraftEntry.registration || result.aircraftEntry.name || 'Aircraft'} -> ${result.targetAirport}`
            : `${result.aircraftEntry.registration || result.aircraftEntry.name || 'Aircraft'} -> ${result.targetAirport}`,
        duration: 3500,
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: lang === 'de' ? 'Transfer fehlgeschlagen' : 'Transfer failed',
        description: error?.message || (lang === 'de' ? 'Unbekannter Fehler.' : 'Unknown error.'),
        duration: 3500,
      });
    },
  });

  const getHangarCapacityByType = React.useCallback((aircraftType) => {
    return ownedHangars.reduce((acc, hangar) => {
      const rule = resolveHangarRule(hangar);
      if (rule.allowed_types.includes(aircraftType)) {
        return acc + rule.slots;
      }
      return acc;
    }, 0);
  }, [ownedHangars]);

  const getOwnedAircraftCountByType = React.useCallback((aircraftType) => {
    return aircraft.filter((entry) => entry.status !== 'sold' && entry.type === aircraftType).length;
  }, [aircraft]);

  const canAfford = (price) => (company?.balance || 0) >= price;
  const canPurchase = (ac) => {
    const hasLevel = (company?.level || 1) >= (ac.level_requirement || 1);
    const hasBalance = canAfford(ac.purchase_price);
    const totalCapacity = getHangarCapacityByType(ac.type);
    const occupiedSlots = getOwnedAircraftCountByType(ac.type);
    const hasHangarCapacity = occupiedSlots < totalCapacity;
    return hasLevel && hasBalance && hasHangarCapacity;
  };

  const marketAircraft = (marketSection === 'used' ? usedMarketInventory : AIRCRAFT_MARKET_SPECS).
  filter((ac) => {
    if (marketSection !== 'used' || usedConditionFilter === 'all') return true;
    return ac.used_condition_key === usedConditionFilter;
  });

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="rounded-xl border border-cyan-900/40 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-3 shadow-lg shadow-cyan-950/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-lg font-mono font-bold text-cyan-300 uppercase tracking-widest">{t('fleet', lang)}</div>
            <div className="text-cyan-600 uppercase">{lang === 'de' ? 'Flottenmanagement & Flugzeugmaerkte' : 'Fleet management & aircraft markets'}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <Card className="p-2 bg-slate-900/80 border-cyan-900/50">
              <div className="text-cyan-700">{lang === 'de' ? 'Flugzeuge' : 'Aircraft'}</div>
              <div className="text-cyan-300 font-bold text-sm">{filteredAircraft.length}</div>
            </Card>
            <Card className="p-2 bg-slate-900/80 border-emerald-900/50">
              <div className="text-emerald-700">{lang === 'de' ? 'Budget' : 'Budget'}</div>
              <div className="text-emerald-300 font-bold text-sm">${Math.round(company?.balance || 0).toLocaleString()}</div>
            </Card>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 border border-cyan-900/30 p-2 rounded-lg shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-cyan-600" />
            <Input
              placeholder={t('search_aircraft', lang).toUpperCase()}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-[10px] font-mono w-32 sm:w-48 bg-slate-950 border-cyan-900/50 text-cyan-100 placeholder:text-cyan-900" />
            
          </div>
          <Dialog
            open={isPurchaseDialogOpen}
            onOpenChange={(open) => {
              setIsPurchaseDialogOpen(open);
              if (!open) {
                setMaintenancePreviewListing(null);
                setSelectedAircraft(null);
                setSelectedPurchaseHangarIcao('');
              }
            }}>
            
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 text-[10px] font-mono uppercase bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 hover:bg-emerald-800/60">
                + {t('buy_aircraft', lang)}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-cyan-800 shadow-2xl">
               <DialogHeader>
                 <DialogTitle className="text-xl font-mono text-cyan-400 uppercase">{t('aircraft_market', lang)}</DialogTitle>
                 <p className="text-[10px] font-mono text-cyan-600/70 uppercase">{t('choose_next_aircraft', lang)}</p>
               </DialogHeader>
               <div className="flex items-center gap-2 mb-2">
                 <Button
                  size="sm"
                  className={`h-7 text-[10px] ${marketSection === 'new' ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'}`}
                  onClick={() => {
                    setMarketSection('new');
                    setUsedConditionFilter('all');
                  }}>
                  
                  {lang === 'de' ? 'Neumarkt' : 'New market'}
                 </Button>
                 <Button
                  size="sm"
                  className={`h-7 text-[10px] ${marketSection === 'used' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                  onClick={() => setMarketSection('used')}>
                  
                  {lang === 'de' ? 'Gebrauchtmarkt' : 'Used market'}
                 </Button>
                 <div className="ml-auto flex items-center gap-1">
                   <Button
                    size="sm"
                    className={`h-7 text-[10px] ${marketViewMode === '3d' ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'}`}
                    onClick={() => setMarketViewMode('3d')}>
                    
                    🛩 3D
                   </Button>
                   <Button
                    size="sm"
                    className={`h-7 text-[10px] ${marketViewMode === 'grid' ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'}`}
                    onClick={() => setMarketViewMode('grid')}>
                    
                    ▦ GRID
                   </Button>
                 </div>
                </div>
               {marketSection === 'used' &&
              <div className="mb-3 p-2 bg-amber-950/20 border border-amber-900/40 rounded">
                   <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                     <p className="text-[10px] text-amber-300 font-mono uppercase">
                       {lang === 'de' ?
                    'Realistischer Markt: begrenztes Angebot, mehrere Zustaende pro Modell' :
                    'Realistic market: limited listings, multiple conditions per model'}
                     </p>
                     <p className="text-[10px] text-slate-400 font-mono">
                       {lang === 'de' ? 'Marktstand' : 'Market snapshot'}: {usedMarketSeed}
                     </p>
                   </div>
                   <div className="flex flex-wrap gap-2">
                     <Button
                    size="sm"
                    className={`h-6 text-[10px] ${usedConditionFilter === 'all' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                    onClick={() => setUsedConditionFilter('all')}>
                    
                       {lang === 'de' ? 'Alle' : 'All'}
                     </Button>
                     {USED_CONDITION_PROFILES.map((profile) =>
                  <Button
                    key={profile.key}
                    size="sm"
                    className={`h-6 text-[10px] ${usedConditionFilter === profile.key ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                    onClick={() => setUsedConditionFilter(profile.key)}>
                    
                         {profile.label[lang] || profile.label.en}
                       </Button>
                  )}
                   </div>
                 </div>
              }
              {selectedAircraft &&
              <div className="mb-3 rounded border border-emerald-800/50 bg-emerald-950/20 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-mono uppercase text-emerald-300">
                      {lang === 'de' ? 'Kauf bestaetigen' : 'Confirm purchase'}: {selectedAircraft.name}
                    </p>
                    <p className="text-[10px] font-mono text-emerald-200">
                      ${Math.round(selectedAircraft.purchase_price || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                    <select
                    value={selectedPurchaseHangarIcao}
                    onChange={(event) => setSelectedPurchaseHangarIcao(event.target.value)}
                    className="h-8 w-full rounded border border-emerald-900/60 bg-slate-950/90 px-2 text-xs text-emerald-100">
                    
                      <option value="">{lang === 'de' ? 'Hangar zuweisen (Pflicht)' : 'Assign hangar (required)'}</option>
                      {purchaseHangarOptions.map((hangar) =>
                    <option key={hangar.id || hangar.airport_icao} value={hangar.airport_icao}>
                          {normIcao(hangar.airport_icao)} ({hangar.usedSlots}/{hangar.rule?.slots || hangar.slots})
                        </option>
                    )}
                    </select>
                    <Button
                    onClick={() => purchaseMutation.mutate({ ...selectedAircraft, selected_hangar_airport: selectedPurchaseHangar?.airport_icao || '' })}
                    disabled={!selectedPurchaseHangar || purchaseMutation.isPending}
                    size="sm"
                    className="h-8 bg-emerald-700 text-white hover:bg-emerald-600 disabled:bg-slate-700">
                    
                      {purchaseMutation.isPending ? t('buying', lang) : t('buy', lang)}
                    </Button>
                  </div>
                  {purchaseHangarOptions.length === 0 &&
                <p className="mt-1 text-[10px] text-amber-300">
                      {lang === 'de' ? 'Kein kompatibler Hangar mit freiem Slot vorhanden.' : 'No compatible hangar with a free slot is available.'}
                    </p>
                }
                </div>
              }

              {marketViewMode === '3d' ?
              <MarketHangar3DView
                listings={marketAircraft}
                lang={lang}
                company={company}
                canAfford={canAfford}
                canPurchase={canPurchase}
                onBuy={(ac) => {beginPurchaseFlow(ac);}}
                isBuying={purchaseMutation.isPending}
                selectedListingId={selectedAircraft?.market_listing_id || selectedAircraft?.name} /> :
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {company &&
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="col-span-full p-2 bg-emerald-950/40 border border-emerald-900/50 rounded flex items-center justify-between sticky top-0 z-10 font-mono">
                  
                    <span className="text-[10px] text-emerald-600 uppercase">{t('available_budget', lang)}:</span>
                    <span className="font-bold text-sm text-emerald-400">${company.balance?.toLocaleString()}</span>
                  </motion.div>
                }

                {marketAircraft.map((ac, index) => {
                  const hasLevel = (company?.level || 1) >= (ac.level_requirement || 1);
                  const hasBalance = canAfford(ac.purchase_price);
                  const isPurchasable = hasLevel && hasBalance;
                  const isBuyingThis = purchaseMutation.isPending && (
                  ac.market_listing_id && selectedAircraft?.market_listing_id === ac.market_listing_id ||
                  !ac.market_listing_id && selectedAircraft?.name === ac.name);

                  const usedConditionLabel = ac.used_condition_label?.[lang] || ac.used_condition_label?.en;
                  const usedWearAvgPct = Math.max(0, Math.min(100, Number(ac.used_wear_avg || 0)));
                  const usedWearPeakPct = Math.max(0, Math.min(100, Number(ac.used_wear_peak || 0)));
                  const usedPermanentAvgPct = Math.max(0, Math.min(100, Number(ac.used_permanent_avg || 0)));

                  return (
                    <motion.div
                      key={ac.market_listing_id || `${ac.name}-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}>
                      
                      <Card className={`overflow-hidden flex flex-col h-full bg-slate-900 border ${isPurchasable ? 'border-cyan-900/50 hover:border-cyan-500/50 cursor-pointer' : 'border-slate-800 opacity-50'}`}>
                        <div className="p-3 flex flex-col flex-grow">
                          <div className="mb-2 border-b border-cyan-900/30 pb-2">
                            <p className="font-bold text-xs text-white uppercase truncate flex items-center gap-1 flex-wrap">
                              {ac.name}
                              {ac.marketType === 'used' && <span className="text-[9px] text-amber-400">USED</span>}
                              {ac.marketType === 'used' && usedConditionLabel &&
                              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-900/40 text-amber-300 normal-case">
                                  {usedConditionLabel}
                                </span>
                              }
                            </p>
                            <p className="text-[10px] text-cyan-600">{typeLabels[ac.type]?.toUpperCase()}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[10px] font-mono mb-3">
                            <div className="flex justify-between"><span className="text-slate-500">PAX</span><span className="text-cyan-100">{ac.passenger_capacity}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">CGO</span><span className="text-cyan-100">{ac.cargo_capacity_kg}kg</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">BURN</span><span className="text-cyan-100">{ac.fuel_consumption_per_hour}L/h</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">RNG</span><span className="text-cyan-100">{ac.range_nm}NM</span></div>
                            <div className="flex justify-between col-span-2"><span className="text-slate-500">MIN LVL</span><span className={hasLevel ? 'text-emerald-400' : 'text-amber-400'}>{ac.level_requirement || 1}</span></div>
                            {ac.marketType === 'used' &&
                            <div className="flex justify-between col-span-2">
                                <span className="text-slate-500">{lang === 'de' ? 'ALTER / HRS' : 'AGE / HRS'}</span>
                                <span className="text-cyan-100">{ac.used_age_years || '-'}y / {(ac.total_flight_hours || 0).toLocaleString()}</span>
                              </div>
                            }
                          </div>
                          <div className="mt-auto space-y-2">
                            <div className="flex justify-between items-center bg-slate-950 p-1.5 rounded border border-slate-800">
                              <span className="text-[10px] text-slate-500">PRICE</span>
                              <span className={`text-sm font-bold ${isPurchasable ? 'text-emerald-400' : 'text-red-400'}`}>${(ac.purchase_price / 1000000).toFixed(1)}M</span>
                            </div>
                            {ac.marketType === 'used' &&
                            <div className="space-y-1">
                                <button
                                type="button"
                                onClick={() => setMaintenancePreviewListing(ac)}
                                className="w-full text-left text-[10px] text-amber-200 bg-amber-950/30 border border-amber-700/40 rounded p-1 hover:bg-amber-900/30">
                                
                                  <div className="flex items-center justify-between">
                                    <span>{lang === 'de' ? 'Wartungsstand' : 'Maintenance state'}</span>
                                    <span className="text-amber-300">{Math.round(usedWearAvgPct)}% / {Math.round(usedWearPeakPct)}%</span>
                                  </div>
                                  <div className="mt-1 space-y-1">
                                    <div className="flex items-center justify-between text-[9px] text-amber-300/90">
                                      <span>{lang === 'de' ? 'Aktiver Verschleiss' : 'Active wear'}</span>
                                      <span>{Math.round(usedWearAvgPct)}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                      className="h-1.5 rounded-full bg-amber-500"
                                      style={{ width: `${usedWearAvgPct}%` }} />
                                    
                                    </div>
                                    <div className="flex items-center justify-between text-[9px] text-red-300/90">
                                      <span>{lang === 'de' ? 'Permanenter Verschleiss' : 'Permanent wear'}</span>
                                      <span>{Math.round(usedPermanentAvgPct)}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                      className="h-1.5 rounded-full bg-red-500"
                                      style={{ width: `${usedPermanentAvgPct}%` }} />
                                    
                                    </div>
                                  </div>
                                  <div className="text-[9px] text-amber-400/90">
                                    {lang === 'de' ? 'Klicken fuer Kategorien und Details' : 'Click for category details'}
                                  </div>
                                </button>
                                <div className="text-[10px] text-amber-300 bg-amber-950/20 border border-amber-800/30 rounded p-1">
                                  {lang === 'de' ? 'Neupreis' : 'New price'} ${Math.round(ac.original_price || 0).toLocaleString()} | {lang === 'de' ? 'Angebot' : 'Listing'} ${Math.round(ac.purchase_price).toLocaleString()}
                                </div>
                              </div>
                            }
                            {!hasLevel && <p className="text-[9px] text-amber-500 text-center">{t('level_required', lang).replace('{0}', ac.level_requirement)}</p>}
                            <Button
                              onClick={() => {beginPurchaseFlow(ac);}}
                              disabled={!isPurchasable}
                              size="sm"
                              className={`w-full h-7 text-[10px] font-mono uppercase ${isPurchasable ? 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800 border border-emerald-800' : 'bg-slate-800 text-slate-500'}`}>
                              
                              {isBuyingThis ? t('buying', lang) : t('buy', lang)}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>);

                })}
              </div>
              }

              {maintenancePreviewListing &&
              <div
                className="fixed inset-0 z-[120] bg-black/80 flex items-end sm:items-center justify-center p-2 sm:p-6"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setMaintenancePreviewListing(null);
                  }
                }}>
                
                  <div
                  className="w-full max-w-3xl h-[92dvh] sm:h-auto bg-slate-900 border border-amber-700/50 text-slate-200 rounded-lg overflow-hidden flex flex-col sm:max-h-[88dvh]"
                  onClick={(e) => e.stopPropagation()}>
                  
                    <div className="px-4 pt-4 pb-2 border-b border-slate-800">
                      <h3 className="text-amber-300 uppercase font-semibold">
                        {lang === 'de' ? 'Wartungsstand im Detail' : 'Maintenance details'}
                      </h3>
                    </div>
                    <div
                    className="space-y-3 px-4 py-3 min-h-0 flex-1 overflow-y-scroll overscroll-contain touch-pan-y"
                    style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y' }}>
                    
                      <div className="p-2 rounded border border-slate-700 bg-slate-950/60 text-[11px] font-mono space-y-2">
                        <div className="min-w-0">
                          <div className="text-slate-200 font-semibold">
                            {lang === 'de' ? 'Failure Trigger (Bridge)' : 'Failure trigger (bridge)'}
                          </div>
                          <div className="text-[10px] text-cyan-300">Version {FAILURE_TOGGLE_UI_VERSION}</div>
                          <div className="text-slate-400 mt-0.5">
                            {effectiveFailureEnabled ?
                          lang === 'de' ? 'Aktiv: Bridge kann Ausfaelle ausloesen.' : 'On: bridge may trigger failures.' :
                          lang === 'de' ? 'Aus: Bridge loest keine neuen Ausfaelle aus.' : 'Off: bridge will not trigger new failures.'}
                          </div>
                        </div>
                        <Button
                        type="button"
                        onClick={() => toggleFailureTriggersMutation.mutate(!effectiveFailureEnabled)}
                        disabled={toggleFailureTriggersMutation.isPending}
                        className={`h-9 w-full text-[11px] font-semibold touch-manipulation pointer-events-auto ${
                        effectiveFailureEnabled ?
                        'bg-red-600 text-white hover:bg-red-500' :
                        'bg-emerald-600 text-white hover:bg-emerald-500'}`
                        }
                        onPointerDown={(e) => e.stopPropagation()}>
                        
                          {toggleFailureTriggersMutation.isPending ?
                        lang === 'de' ? 'Speichere...' : 'Saving...' :
                        effectiveFailureEnabled ?
                        lang === 'de' ? 'FAILURE TRIGGER: EIN - TIPPE ZUM AUSSCHALTEN' : 'FAILURE TRIGGER: ON - TAP TO TURN OFF' :
                        lang === 'de' ? 'FAILURE TRIGGER: AUS - TIPPE ZUM EINSCHALTEN' : 'FAILURE TRIGGER: OFF - TAP TO TURN ON'}
                        </Button>
                        {failureToggleError &&
                      <div className="text-[11px] text-red-300">{failureToggleError}</div>
                      }
                      </div>
                      <div className="p-2 rounded border border-amber-900/50 bg-amber-950/20 text-[11px] font-mono">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-amber-200">{maintenancePreviewListing.name}</span>
                          <span className="text-amber-300">
                            {maintenancePreviewListing.used_condition_label?.[lang] || maintenancePreviewListing.used_condition_label?.en}
                          </span>
                        </div>
                        <div className="text-slate-300 mt-1">
                          {lang === 'de' ? 'Wartungsrueckstand' : 'Maintenance backlog'}: ${Math.round(maintenancePreviewListing.accumulated_maintenance_cost || 0).toLocaleString()}
                          {' '}|{' '}
                          {lang === 'de' ? 'Durchschnitts-Verschleiss' : 'Avg wear'}: {Math.round(maintenancePreviewListing.used_wear_avg || 0)}%
                          {' '}|{' '}
                          {lang === 'de' ? 'Max Verschleiss' : 'Max wear'}: {Math.round(maintenancePreviewListing.used_wear_peak || 0)}%
                        </div>
                      </div>
                      <div className="overflow-x-auto border border-slate-700 rounded">
                        <table className="w-full text-[11px] font-mono">
                          <thead className="bg-slate-800/80 text-slate-300">
                            <tr>
                              <th className="text-left p-2">{lang === 'de' ? 'Kategorie' : 'Category'}</th>
                              <th className="text-right p-2">{lang === 'de' ? 'Aktiver Verschleiss' : 'Active wear'}</th>
                              <th className="text-right p-2">{lang === 'de' ? 'Permanenter Verschleiss' : 'Permanent wear'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {MAINTENANCE_CATEGORY_KEYS.map((key) =>
                          <tr key={key} className="border-t border-slate-800">
                                <td className="p-2 text-slate-200">{MAINTENANCE_CATEGORY_LABELS[key]?.[lang] || MAINTENANCE_CATEGORY_LABELS[key]?.en || key}</td>
                                <td className="p-2 text-right text-amber-300">{Number(maintenancePreviewListing.maintenance_categories?.[key] || 0).toFixed(1)}%</td>
                                <td className="p-2 text-right text-cyan-300">{Number(maintenancePreviewListing.permanent_wear_categories?.[key] || 0).toFixed(2)}%</td>
                              </tr>
                          )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="px-4 pb-4 pt-2 border-t border-slate-800">
                      <Button
                      onClick={() => setMaintenancePreviewListing(null)}
                      className="bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono h-8">
                      
                        {t('close', lang).toUpperCase()}
                      </Button>
                    </div>
                  </div>
                </div>
              }

              <DialogFooter>
                <Button onClick={() => setIsPurchaseDialogOpen(false)} className="bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono h-8">
                  {t('close', lang).toUpperCase()}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <InsolvencyBanner />

      <div className="flex-1 overflow-y-auto min-h-0">
        {ownedHangars.length > 0 && movableAircraft.length > 0 && (
          <Card className="mb-2 border border-cyan-900/40 bg-slate-950/90 p-2">
            <div className="mb-1 text-[10px] font-mono uppercase tracking-wide text-cyan-300">
              {lang === 'de' ? 'Hangar Transfer' : 'Hangar transfer'}
            </div>
            {ownedHangars.length < 2 ? (
              <p className="text-[11px] text-amber-300">
                {lang === 'de'
                  ? 'Du brauchst mindestens 2 Hangars, um Flugzeuge zu verschieben.'
                  : 'You need at least 2 hangars to move aircraft.'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {movableAircraft.map((aircraftEntry) => {
                  const currentAirport = normIcao(aircraftEntry.hangar_airport);
                  const selectedTarget = normIcao(fleetMoveTargets[aircraftEntry.id]) || currentAirport;
                  const moveInfo = getFleetMoveValidation(aircraftEntry, selectedTarget);
                  const sameHangar = Boolean(currentAirport && selectedTarget && currentAirport === selectedTarget);
                  const transferCost = getAircraftTransferCost(aircraftEntry, selectedTarget);
                  return (
                    <div key={aircraftEntry.id} className="rounded border border-slate-700/70 bg-slate-900/70 p-2">
                      <p className="truncate text-[11px] font-semibold text-cyan-100">
                        {aircraftEntry.name || aircraftEntry.model || aircraftEntry.type}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {(aircraftEntry.registration || aircraftEntry.id)} | {lang === 'de' ? 'Aktuell' : 'Current'}: {currentAirport || '-'}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <select
                          value={selectedTarget}
                          onChange={(event) =>
                            setFleetMoveTargets((previous) => ({
                              ...previous,
                              [aircraftEntry.id]: normIcao(event.target.value),
                            }))
                          }
                          className="h-7 flex-1 rounded border border-cyan-900/60 bg-slate-950/90 px-2 text-[10px] text-cyan-100"
                        >
                          {ownedHangars.map((hangar) => {
                            const icao = normIcao(hangar.airport_icao);
                            return (
                              <option key={`${aircraftEntry.id}_${icao}`} value={icao}>
                                {icao}
                              </option>
                            );
                          })}
                        </select>
                        <Button
                          type="button"
                          disabled={sameHangar || !moveInfo.valid || moveAircraftMutation.isPending}
                          onClick={() => moveAircraftMutation.mutate({ aircraftEntry, targetAirportIcao: selectedTarget })}
                          className="h-7 bg-emerald-600 px-2 text-[10px] font-mono uppercase text-slate-950 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-300"
                        >
                          {moveAircraftMutation.isPending
                            ? '...'
                            : sameHangar
                              ? (lang === 'de' ? 'Zugewiesen' : 'Assigned')
                              : (lang === 'de' ? 'Verschieben' : 'Move')}
                        </Button>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {lang === 'de' ? 'Transferkosten' : 'Transfer cost'}: ${Math.round(transferCost).toLocaleString()}
                      </p>
                      {!sameHangar && !moveInfo.valid && (
                        <p className="text-[10px] text-amber-300">{moveInfo.reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-2">
          <TabsList className="bg-slate-900/80 border border-cyan-900/30 flex-wrap h-auto p-0.5 rounded-lg w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" className="text-[10px] font-mono uppercase data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-400 data-[state=active]:shadow-none rounded px-3 py-1">ALL</TabsTrigger>
            {Object.entries(typeLabels).map(([type, label]) =>
            <TabsTrigger key={type} value={type} className="text-[10px] font-mono uppercase data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-400 data-[state=active]:shadow-none rounded px-3 py-1">{label}</TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 mb-2">
          <Button
            size="sm"
            onClick={() => setViewMode('3d')}
            className={`h-7 text-[10px] font-mono uppercase ${viewMode === '3d' ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            🛩 {lang === 'de' ? '3D Hangar' : '3D Hangar'}
          </Button>
          <Button
            size="sm"
            onClick={() => setViewMode('grid')}
            className={`h-7 text-[10px] font-mono uppercase ${viewMode === 'grid' ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            ▦ {lang === 'de' ? 'Liste' : 'Grid'}
          </Button>
        </div>

        {/* Aircraft view */}
        {isLoading ?
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {[1, 2, 3, 4].map((i) => <Card key={i} className="h-32 animate-pulse bg-slate-900 border-cyan-900/30" />)}
          </div> :
        filteredAircraft.length > 0 ?
          (viewMode === '3d' ?
            <Fleet3DView aircraft={filteredAircraft} /> :
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2" layout>
              <AnimatePresence>
                {filteredAircraft.map((ac) =>
              <AircraftCard key={ac.id} aircraft={ac} />
              )}
              </AnimatePresence>
            </motion.div>
          ) :
        <Card className="p-8 text-center bg-slate-900/80 border border-cyan-900/30 flex flex-col items-center">
            <Plane className="w-10 h-10 text-cyan-900 mx-auto mb-2" />
            <h3 className="text-sm font-mono text-cyan-600 mb-1">{t('no_aircraft', lang).toUpperCase()}</h3>
          </Card>
        }
      </div>
    </div>);

}
