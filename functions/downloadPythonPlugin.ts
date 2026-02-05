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
    const companies = await base44.entities.Company.list();
    const company = companies[0];
    
    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    // Create plugin Python code
    const pluginCode = `"""
SkyCareer X-Plane 12 Plugin
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

class PythonInterface:
    def __init__(self):
        self.Name = "SkyCareer"
        self.Sig = "skycareer.xplane.plugin"
        self.Desc = "SkyCareer Career Mode Integration"
        
        # Configuration
        self.api_endpoint = "${apiEndpoint}"
        self.company_id = "${company.id}"
        self.update_interval = 1.0  # seconds
        self.last_update = 0
        self.last_on_ground = True
        self.flight_started = False
        
        # DataRefs
        self.datarefs = {}
        
    def XPluginStart(self):
        # Register datarefs
        self.datarefs['altitude'] = xp.findDataRef("sim/flightmodel/position/elevation")
        self.datarefs['speed'] = xp.findDataRef("sim/flightmodel/position/groundspeed")
        self.datarefs['vs'] = xp.findDataRef("sim/flightmodel/position/vh_ind")
        self.datarefs['heading'] = xp.findDataRef("sim/flightmodel/position/psi")
        self.datarefs['fuel_ratio'] = xp.findDataRef("sim/flightmodel/weight/m_fuel_total")
        self.datarefs['fuel_max'] = xp.findDataRef("sim/aircraft/weight/acf_m_fuel_tot")
        self.datarefs['g_load'] = xp.findDataRef("sim/flightmodel/forces/g_load")
        self.datarefs['latitude'] = xp.findDataRef("sim/flightmodel/position/latitude")
        self.datarefs['longitude'] = xp.findDataRef("sim/flightmodel/position/longitude")
        self.datarefs['on_ground'] = xp.findDataRef("sim/flightmodel/failures/onground_any")
        self.datarefs['parking_brake'] = xp.findDataRef("sim/flightmodel/controls/parkbrake")
        self.datarefs['engine_running'] = xp.findDataRef("sim/flightmodel/engine/ENGN_running")
        
        # Create flight loop
        xp.createFlightLoop(self.FlightLoopCallback, 1)
        
        return self.Name, self.Sig, self.Desc
    
    def XPluginStop(self):
        pass
    
    def XPluginEnable(self):
        return 1
    
    def XPluginDisable(self):
        pass
    
    def XPluginReceiveMessage(self, inFromWho, inMessage, inParam):
        pass
    
    def FlightLoopCallback(self, elapsedSinceLastCall, elapsedTimeSinceLastFlightLoop, counter, refcon):
        current_time = time.time()
        
        # Check if it's time to update
        if current_time - self.last_update < self.update_interval:
            return -1
        
        self.last_update = current_time
        
        try:
            # Read all datarefs
            altitude = xp.getDataf(self.datarefs['altitude']) * 3.28084
            speed = xp.getDataf(self.datarefs['speed']) * 1.94384
            vs = xp.getDataf(self.datarefs['vs']) * 196.85
            heading = xp.getDataf(self.datarefs['heading'])
            fuel_current = xp.getDataf(self.datarefs['fuel_ratio'])
            fuel_max = xp.getDataf(self.datarefs['fuel_max'])
            fuel_percentage = (fuel_current / fuel_max * 100) if fuel_max > 0 else 100
            g_force = xp.getDataf(self.datarefs['g_load'])
            latitude = xp.getDatad(self.datarefs['latitude'])
            longitude = xp.getDatad(self.datarefs['longitude'])
            on_ground = xp.getDatai(self.datarefs['on_ground']) == 1
            parking_brake = xp.getDataf(self.datarefs['parking_brake']) > 0.5
            
            # Check if any engine is running
            engines_running = False
            engine_array = []
            xp.getDatavi(self.datarefs['engine_running'], engine_array, 0, 8)
            for running in engine_array:
                if running == 1:
                    engines_running = True
                    break
            
            # Detect takeoff
            if self.last_on_ground and not on_ground:
                self.flight_started = True
            
            self.last_on_ground = on_ground
            
            # Only send data if flight has started
            if not self.flight_started and on_ground:
                return -1
            
            # Prepare payload
            payload = {
                'company_id': self.company_id,
                'altitude': round(altitude, 1),
                'speed': round(speed, 1),
                'vertical_speed': round(vs, 1),
                'heading': round(heading, 1),
                'fuel_percentage': round(fuel_percentage, 1),
                'g_force': round(g_force, 2),
                'latitude': latitude,
                'longitude': longitude,
                'on_ground': on_ground,
                'parking_brake': parking_brake,
                'engines_running': engines_running
            }
            
            # Send to API
            self.send_data(payload)
            
        except Exception as e:
            xp.log(f"SkyCareer Error: {str(e)}")
        
        return -1
    
    def send_data(self, data):
        try:
            json_data = json.dumps(data).encode('utf-8')
            request = urllib.request.Request(
                self.api_endpoint,
                data=json_data,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            
            response = urllib.request.urlopen(request, timeout=2)
            result = json.loads(response.read().decode('utf-8'))
            
            # If flight was completed, reset
            if result.get('status') == 'completed':
                xp.log(f"SkyCareer: Flight completed! Rating: {result.get('rating', 0):.1f}/5")
                self.flight_started = False
                
        except urllib.error.URLError:
            pass
        except Exception as e:
            xp.log(f"SkyCareer Send Error: {str(e)}")
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