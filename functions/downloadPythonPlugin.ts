import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const apiEndpoint = url.searchParams.get('endpoint') || 'http://localhost:5173/api/receiveXPlaneData';
    
    // Get company info
    const companies = await base44.entities.Company.filter({ created_by: user.email });
    const company = companies[0];
    
    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    // Generate API key if not exists
    let apiKey = company.xplane_api_key;
    if (!apiKey) {
      apiKey = crypto.randomUUID();
      await base44.entities.Company.update(company.id, { xplane_api_key: apiKey });
    }

    // Create plugin Python code
    const pluginCode = `"""
SkyCareer V1 - X-Plane 12 Python Plugin
Sends real-time flight data to SkyCareer career mode application
"""

from XPLMProcessing import *
from XPLMDataAccess import *
from XPLMUtilities import *
import xp
import json
import urllib.request
import urllib.error
import time
import threading

class PythonInterface:
    def __init__(self):
        self.Name = "SkyCareer"
        self.Sig = "skycareer.xplane.plugin"
        self.Desc = "SkyCareer V1 Career Mode Integration"
        
        # Configuration
        self.api_endpoint = "${apiEndpoint}"
        self.api_key = "${apiKey}"
        self.update_interval = 2.0
        self.last_update = 0
        self.last_on_ground = True
        self.flight_started = False
        self.flight_landed = False
        
        # Tracking
        self.max_g_force = 0
        self.touchdown_vspeed = 0
        self.landing_g_force = 0
        
        # Event flags
        self.tailstrike = False
        self.stall = False
        self.overstress = False
        self.overspeed = False
        self.flaps_overspeed = False
        self.fuel_emergency = False
        self.gear_up_landing = False
        self.crash = False
        
        self.datarefs = {}
        
    def XPluginStart(self):
        self.datarefs['altitude'] = xp.findDataRef("sim/flightmodel/position/elevation")
        self.datarefs['speed'] = xp.findDataRef("sim/flightmodel/position/groundspeed")
        self.datarefs['ias'] = xp.findDataRef("sim/flightmodel/position/indicated_airspeed")
        self.datarefs['vs'] = xp.findDataRef("sim/flightmodel/position/vh_ind")
        self.datarefs['heading'] = xp.findDataRef("sim/flightmodel/position/psi")
        self.datarefs['pitch'] = xp.findDataRef("sim/flightmodel/position/theta")
        self.datarefs['fuel_total'] = xp.findDataRef("sim/flightmodel/weight/m_fuel_total")
        self.datarefs['fuel_max'] = xp.findDataRef("sim/aircraft/weight/acf_m_fuel_tot")
        self.datarefs['g_load'] = xp.findDataRef("sim/flightmodel2/misc/gforce_normal")
        self.datarefs['latitude'] = xp.findDataRef("sim/flightmodel/position/latitude")
        self.datarefs['longitude'] = xp.findDataRef("sim/flightmodel/position/longitude")
        self.datarefs['on_ground'] = xp.findDataRef("sim/flightmodel/failures/onground_any")
        self.datarefs['parking_brake'] = xp.findDataRef("sim/flightmodel/controls/parkbrake")
        self.datarefs['engine_running'] = xp.findDataRef("sim/flightmodel/engine/ENGN_running")
        self.datarefs['gear_handle'] = xp.findDataRef("sim/cockpit2/controls/gear_handle_down")
        self.datarefs['flap_ratio'] = xp.findDataRef("sim/flightmodel/controls/flaprat")
        self.datarefs['has_crashed'] = xp.findDataRef("sim/flightmodel2/misc/has_crashed")
        self.datarefs['vne'] = xp.findDataRef("sim/aircraft/view/acf_Vne")
        
        xp.createFlightLoop(self.FlightLoopCallback, 1)
        return self.Name, self.Sig, self.Desc
    
    def XPluginStop(self): pass
    def XPluginEnable(self): return 1
    def XPluginDisable(self): pass
    def XPluginReceiveMessage(self, inFromWho, inMessage, inParam): pass
    
    def FlightLoopCallback(self, elapsedSinceLastCall, elapsedTimeSinceLastFlightLoop, counter, refcon):
        current_time = time.time()
        if current_time - self.last_update < self.update_interval:
            return -1
        self.last_update = current_time
        
        try:
            altitude = xp.getDataf(self.datarefs['altitude']) * 3.28084
            speed = xp.getDataf(self.datarefs['speed']) * 1.94384
            ias = xp.getDataf(self.datarefs['ias'])
            vs = xp.getDataf(self.datarefs['vs']) * 196.85
            heading = xp.getDataf(self.datarefs['heading'])
            pitch = xp.getDataf(self.datarefs['pitch'])
            fuel_kg = xp.getDataf(self.datarefs['fuel_total'])
            fuel_max = xp.getDataf(self.datarefs['fuel_max'])
            fuel_pct = (fuel_kg / fuel_max * 100) if fuel_max > 0 else 100
            g_force = xp.getDataf(self.datarefs['g_load'])
            lat = xp.getDatad(self.datarefs['latitude'])
            lon = xp.getDatad(self.datarefs['longitude'])
            on_ground = xp.getDatai(self.datarefs['on_ground']) == 1
            park_brake = xp.getDataf(self.datarefs['parking_brake']) > 0.5
            gear_down = xp.getDataf(self.datarefs['gear_handle']) > 0.5
            flap_ratio = xp.getDataf(self.datarefs['flap_ratio'])
            has_crashed = xp.getDatai(self.datarefs['has_crashed']) == 1
            vne = xp.getDataf(self.datarefs['vne']) or 999
            
            engines_running = False
            engine_array = []
            xp.getDatavi(self.datarefs['engine_running'], engine_array, 0, 8)
            for running in engine_array:
                if running == 1:
                    engines_running = True
                    break
            
            if g_force > self.max_g_force:
                self.max_g_force = g_force
            
            # Takeoff
            if self.last_on_ground and not on_ground:
                self.flight_started = True
                self.flight_landed = False
                self.max_g_force = g_force
                self.touchdown_vspeed = 0
                self.landing_g_force = 0
                self.tailstrike = False
                self.stall = False
                self.overstress = False
                self.overspeed = False
                self.flaps_overspeed = False
                self.fuel_emergency = False
                self.gear_up_landing = False
                self.crash = False
            
            # Landing
            if not self.last_on_ground and on_ground and self.flight_started and not self.flight_landed:
                self.touchdown_vspeed = vs
                self.landing_g_force = g_force
                self.flight_landed = True
                if not gear_down:
                    self.gear_up_landing = True
            
            self.last_on_ground = on_ground
            
            # Event detection
            if self.flight_started:
                if pitch > 10 and on_ground: self.tailstrike = True
                if altitude > 500 and ias < 80 and not on_ground: self.stall = True
                if g_force > 2.5 or g_force < -1.0: self.overstress = True
                if ias > vne * 0.95: self.overspeed = True
                if flap_ratio > 0 and speed > 200: self.flaps_overspeed = True
                if fuel_kg < 300: self.fuel_emergency = True
                if has_crashed: self.crash = True
            
            payload = {
                'altitude': round(altitude, 1),
                'speed': round(speed, 1),
                'vertical_speed': round(vs, 1),
                'heading': round(heading, 1),
                'fuel_percentage': round(fuel_pct, 1),
                'fuel_kg': round(fuel_kg, 1),
                'g_force': round(g_force, 2),
                'max_g_force': round(self.max_g_force, 2),
                'touchdown_vspeed': round(self.touchdown_vspeed, 1),
                'landing_g_force': round(self.landing_g_force, 2),
                'latitude': lat,
                'longitude': lon,
                'on_ground': on_ground,
                'park_brake': park_brake,
                'engine1_running': engines_running,
                'engine2_running': engines_running,
                'gear_down': gear_down,
                'flap_ratio': round(flap_ratio, 2),
                'pitch': round(pitch, 1),
                'ias': round(ias, 1),
                'tailstrike': self.tailstrike,
                'stall': self.stall,
                'overstress': self.overstress,
                'overspeed': self.overspeed,
                'flaps_overspeed': self.flaps_overspeed,
                'fuel_emergency': self.fuel_emergency,
                'gear_up_landing': self.gear_up_landing,
                'crash': self.crash,
                'has_crashed': has_crashed
            }
            
            self.send_data(payload)
            
        except Exception as e:
            xp.log(f"SkyCareer Error: {str(e)}")
        
        return -1
    
    def send_data(self, data):
        def _send():
            try:
                json_data = json.dumps(data).encode('utf-8')
                url = self.api_endpoint + '?api_key=' + self.api_key
                request = urllib.request.Request(url, data=json_data, headers={'Content-Type': 'application/json'}, method='POST')
                urllib.request.urlopen(request, timeout=2)
            except Exception:
                pass
        threading.Thread(target=_send, daemon=True).start()
`;

    const readmeContent = `# SkyCareer X-Plane 12 Python Plugin

## Installation

1. Installiere XPPython3:
   - Download: https://xppython3.readthedocs.io
   - Installiere in: X-Plane 12/Resources/plugins/XPPython3

2. Kopiere den SkyCareer Ordner nach:
   X-Plane 12/Resources/plugins/PythonPlugins/

3. Starte X-Plane 12 neu

## Company ID
Deine Company ID ist bereits im Plugin konfiguriert: ${company.id}

## Verwendung

1. Akzeptiere einen Auftrag in SkyCareer
2. Starte den Flug in der App
3. Lade in X-Plane 12 das richtige Flugzeug und den Startflughafen
4. Stelle das Payload-Gewicht ein
5. Starte deinen Flug!

Das Plugin sendet automatisch alle Flugdaten.
`;

    // Create simple text response with both files
    const combined = `=== PI_SkyCareer.py ===
${pluginCode}

=== README.md ===
${readmeContent}`;

    return new Response(combined, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="SkyCareer-Python-Plugin.txt"'
      }
    });

  } catch (error) {
    console.error('Error generating Python plugin:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});