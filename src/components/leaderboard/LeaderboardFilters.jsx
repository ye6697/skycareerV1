import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from 'lucide-react';
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

const AIRCRAFT_TYPES = [
  { value: 'all', label_en: 'All Aircraft', label_de: 'Alle Flugzeuge' },
  { value: 'small_prop', label_en: 'Propeller', label_de: 'Propeller' },
  { value: 'turboprop', label_en: 'Turboprop', label_de: 'Turboprop' },
  { value: 'regional_jet', label_en: 'Regional Jet', label_de: 'Regionaljet' },
  { value: 'narrow_body', label_en: 'Narrow-Body', label_de: 'Narrow-Body' },
  { value: 'wide_body', label_en: 'Wide-Body', label_de: 'Wide-Body' },
  { value: 'cargo', label_en: 'Cargo', label_de: 'Fracht' },
];

const REGIONS = [
  { value: 'all', label: 'Global' },
  { value: 'ED', label: 'Germany (ED)' },
  { value: 'EG', label: 'UK (EG)' },
  { value: 'LF', label: 'France (LF)' },
  { value: 'LI', label: 'Italy (LI)' },
  { value: 'LE', label: 'Spain (LE)' },
  { value: 'EH', label: 'Netherlands (EH)' },
  { value: 'LO', label: 'Austria (LO)' },
  { value: 'LS', label: 'Switzerland (LS)' },
  { value: 'EP', label: 'Poland (EP)' },
  { value: 'LT', label: 'Turkey (LT)' },
  { value: 'K', label: 'USA (K)' },
  { value: 'C', label: 'Canada (C)' },
  { value: 'Y', label: 'Australia (Y)' },
  { value: 'RJ', label: 'Japan (RJ)' },
  { value: 'Z', label: 'China (Z)' },
  { value: 'SB', label: 'Brazil (SB)' },
  { value: 'VT', label: 'India (VT)' },
  { value: 'WA', label: 'Indonesia (WA)' },
];

export default function LeaderboardFilters({ aircraftType, region, onAircraftTypeChange, onRegionChange }) {
  const { lang } = useLanguage();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Filter className="w-3.5 h-3.5" />
        <span className="text-[10px] font-mono uppercase tracking-wider">Filter</span>
      </div>
      <Select value={aircraftType} onValueChange={onAircraftTypeChange}>
        <SelectTrigger className="w-36 h-8 bg-slate-900 border-slate-700 text-xs font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AIRCRAFT_TYPES.map(at => (
            <SelectItem key={at.value} value={at.value}>
              {lang === 'de' ? at.label_de : at.label_en}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={region} onValueChange={onRegionChange}>
        <SelectTrigger className="w-40 h-8 bg-slate-900 border-slate-700 text-xs font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REGIONS.map(r => (
            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}