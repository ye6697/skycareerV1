import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { Map, ArrowLeft } from 'lucide-react';

export default function FlightMap() {
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
        <h1 className="text-xl font-mono font-bold text-cyan-400 flex items-center gap-2">
          <Map className="w-6 h-6" />
          Live Flight Map
        </h1>
      </div>

      <Card className="flex-1 bg-slate-900/80 border-cyan-900/30 flex items-center justify-center min-h-[500px]">
        <div className="text-center text-slate-500 font-mono">
          <Map className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">Global Flight Map</p>
          <p className="text-sm">Wird in einem zukünftigen Update implementiert.</p>
        </div>
      </Card>
    </div>
  );
}