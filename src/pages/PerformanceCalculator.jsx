import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { Calculator, ArrowLeft } from 'lucide-react';
import TakeoffLandingCalculator from '@/components/flights/TakeoffLandingCalculator';

export default function PerformanceCalculator() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-4 bg-slate-900/80 border border-cyan-900/30 p-4 rounded-lg shadow-lg">
        <Button 
          variant="ghost" 
          onClick={() => navigate(createPageUrl('Dashboard'))}
          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück
        </Button>
        <h1 className="text-xl font-mono font-bold text-amber-400 flex items-center gap-2">
          <Calculator className="w-6 h-6" />
          Performance Calculator
        </h1>
      </div>

      <div className="flex-1 min-h-[500px]">
        <TakeoffLandingCalculator />
      </div>
    </div>
  );
}