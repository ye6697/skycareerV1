import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import JSZip from 'npm:jszip@3.10.1';

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

    // Generate API key if not exists
    let apiKey = company.xplane_api_key;
    if (!apiKey) {
      apiKey = crypto.randomUUID();
      await base44.entities.Company.update(company.id, { xplane_api_key: apiKey });
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
        self.api_key = "${apiKey}"
        self.update_interval = 2.0  # seconds
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
            return -1  # Continue
        
        self.last_update = current_time
        
        try:
            # Read all datarefs
            altitude = xp.getDataf(self.datarefs['altitude']) * 3.28084  # meters to feet
            speed = xp.getDataf(self.datarefs['speed']) * 1.94384  # m/s to knots
            vs = xp.getDataf(self.datarefs['vs']) * 196.85  # m/s to ft/min
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
            
            # Detect takeoff (was on ground, now airborne)
            if self.last_on_ground and not on_ground:
                self.flight_started = True
            
            self.last_on_ground = on_ground
            
            # Only send data if flight has started
            if not self.flight_started and on_ground:
                return -1
            
            # Prepare payload
            payload = {
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
        
        return -1  # Continue flight loop
    
    def send_data(self, data):
        try:
            json_data = json.dumps(data).encode('utf-8')
            api_url = f"{self.api_endpoint}?api_key={self.api_key}"
            request = urllib.request.Request(
                api_url,
                data=json_data,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            
            response = urllib.request.urlopen(request, timeout=2)
            result = json.loads(response.read().decode('utf-8'))
            
            # If flight was completed, reset
            if result.get('status') == 'completed':
                xp.log(f"SkyCareer: Flight completed! Rating: {result.get('rating', 0):.1f}/5")
                self.current_flight_id = None
                self.flight_started = False
                
        except urllib.error.URLError as e:
            # Network error - don't spam logs
            pass
        except Exception as e:
            xp.log(f"SkyCareer Send Error: {str(e)}")
`;

    const readmeContent = `# SkyCareer X-Plane 12 Plugin

## Installation

1. Stelle sicher, dass XPPython3 installiert ist:
   - Lade XPPython3 herunter von: https://xppython3.readthedocs.io
   - Installiere es in X-Plane 12/Resources/plugins/XPPython3

2. Kopiere den SkyCareer Ordner nach:
   X-Plane 12/Resources/plugins/PythonPlugins/

3. Starte X-Plane 12 neu

## Verwendung

1. Akzeptiere einen Auftrag in der SkyCareer Web-App
2. Starte den Flug in der App (weist Flugzeug und Crew zu)
3. Lade in X-Plane 12:
   - Das richtige Flugzeug
   - Den Startflughafen (ICAO Code aus dem Auftrag)
   - Stelle das Payload-Gewicht ein (aus dem Auftrag)
4. Starte deinen Flug in X-Plane!

Das Plugin erkennt automatisch deinen aktiven Flug und sendet die Daten.
Keine weitere Konfiguration nötig!

## Funktionen

- ✈️ Sendet automatisch Flugdaten jede Sekunde
- 📊 Überträgt: Höhe, Geschwindigkeit, Kurs, Treibstoff, G-Kräfte, Position
- 🎯 Erkennt automatisch Start (Abheben)
- 🏁 Beendet Flug automatisch bei Parkposition (am Boden + Parkbremse + Triebwerke aus)
- ⭐ Berechnet Bewertungen basierend auf Flugqualität

## Fehlerbehebung

- **Plugin lädt nicht**: Überprüfe, ob XPPython3 korrekt installiert ist
- **Keine Daten übertragen**: Überprüfe die SkyCareer_config.txt Datei
- **Verbindungsfehler**: Stelle sicher, dass die Web-App läuft und der Endpoint korrekt ist

## Logs

Plugin-Logs findest du in:
X-Plane 12/Log.txt
`;

    // Create ZIP file
    const zip = new JSZip();
    const skycareerFolder = zip.folder("SkyCareer");
    skycareerFolder.file("PI_SkyCareer.py", pluginCode);
    skycareerFolder.file("README.md", readmeContent);

    const zipBlob = await zip.generateAsync({ 
      type: 'base64'
    });

    // Convert base64 to Uint8Array
    const binaryString = atob(zipBlob);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="SkyCareer-XPlane-Plugin.zip"',
        'Content-Transfer-Encoding': 'binary'
      }
    });

  } catch (error) {
    console.error('Error generating plugin:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});