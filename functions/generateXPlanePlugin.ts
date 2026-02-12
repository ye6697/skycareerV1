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
        self.update_interval = 3.0  # seconds
        self.last_update = 0
        self.last_on_ground = True
        self.flight_started = False
        
        # Failure system
        self.maintenance_ratio = 0.0  # 0.0 = perfect, 1.0 = very worn
        self.last_failure_check = 0
        self.failure_check_interval = 30.0  # check every 30 seconds
        self.active_failures = []  # list of currently active failure datarefs
        self.failure_datarefs = {}  # cached failure dataref handles
        
        # Possible failures grouped by severity
        # Light failures: minor inconveniences
        self.light_failures = [
            ("sim/operation/failures/rel_lites_nav", "Navigationslichter"),
            ("sim/operation/failures/rel_lites_land", "Landelichter"),
            ("sim/operation/failures/rel_lites_taxi", "Taxilichter"),
            ("sim/operation/failures/rel_lites_strobe", "Blitzlichter"),
            ("sim/operation/failures/rel_lites_beac", "Beacon-Lichter"),
            ("sim/operation/failures/rel_lites_ins", "Instrumentenbeleuchtung"),
            ("sim/operation/failures/rel_pitot", "Pitotrohr"),
            ("sim/operation/failures/rel_static", "Statikport"),
            ("sim/operation/failures/rel_apts0", "Transponder"),
        ]
        # Medium failures: affect flight but manageable
        self.medium_failures = [
            ("sim/operation/failures/rel_genera0", "Generator 1"),
            ("sim/operation/failures/rel_genera1", "Generator 2"),
            ("sim/operation/failures/rel_hydpmp", "Hydraulikpumpe 1"),
            ("sim/operation/failures/rel_hydpmp2", "Hydraulikpumpe 2"),
            ("sim/operation/failures/rel_batter0", "Batterie 1"),
            ("sim/operation/failures/rel_fc_rud_L", "Seitenruder links"),
            ("sim/operation/failures/rel_fc_ail_L", "Querruder links"),
            ("sim/operation/failures/rel_otto", "Autopilot Computer"),
            ("sim/operation/failures/rel_auto_servos", "Autopilot Servos"),
            ("sim/operation/failures/rel_smoke_cpit", "Rauch im Cockpit"),
            ("sim/operation/failures/rel_vacpmp", "Vakuumpumpe"),
            ("sim/operation/failures/rel_stbaug", "Stabilisierung"),
        ]
        # Severe failures: serious problems
        self.severe_failures = [
            ("sim/operation/failures/rel_engfai0", "Triebwerk 1 Ausfall"),
            ("sim/operation/failures/rel_engfai1", "Triebwerk 2 Ausfall"),
            ("sim/operation/failures/rel_engfir0", "Triebwerk 1 Feuer"),
            ("sim/operation/failures/rel_esys", "Elektrisches System Bus 1"),
            ("sim/operation/failures/rel_depres_fast", "Schnelle Dekompression"),
        ]
        
        # DataRefs
        self.datarefs = {}
        # FMS waypoint cache (don't send every frame)
        self.last_fms_send = 0
        self.fms_send_interval = 30.0  # send FMS data every 30 sec
        self.cached_fms_waypoints = []
        
    def XPluginStart(self):
        # Cache failure dataref handles
        import random
        self.random = random
        all_failures = self.light_failures + self.medium_failures + self.severe_failures
        for dataref_path, name in all_failures:
            ref = xp.findDataRef(dataref_path)
            if ref:
                self.failure_datarefs[dataref_path] = ref
        
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
        self.datarefs['has_crashed'] = xp.findDataRef("sim/flightmodel2/misc/has_crashed")
        self.datarefs['touchdown_vspeed'] = xp.findDataRef("sim/flightmodel/forces/fsuipc_vert_accel")
        self.datarefs['indicated_airspeed'] = xp.findDataRef("sim/flightmodel/position/indicated_airspeed")
        self.datarefs['theta'] = xp.findDataRef("sim/flightmodel/position/theta")
        self.datarefs['stall_warning'] = xp.findDataRef("sim/cockpit2/annunciators/stall_warning")
        self.datarefs['override_alpha'] = xp.findDataRef("sim/flightmodel/failures/over_alpha")
        self.datarefs['overspeed'] = xp.findDataRef("sim/cockpit2/annunciators/overspeed")
        self.datarefs['flap_speed_overflow'] = xp.findDataRef("sim/flightmodel/failures/over_vfe")
        
        # Environment & weight datarefs for calculator auto-fill
        self.datarefs['total_weight'] = xp.findDataRef("sim/flightmodel/weight/m_total")
        self.datarefs['oat'] = xp.findDataRef("sim/cockpit2/temperature/outside_air_temp_degc")
        self.datarefs['ground_elevation'] = xp.findDataRef("sim/flightmodel/position/y_agl")  # meters AGL
        self.datarefs['elev_msl'] = xp.findDataRef("sim/flightmodel/position/elevation")  # meters MSL (same as altitude)
        self.datarefs['baro_setting'] = xp.findDataRef("sim/cockpit2/gauges/actuators/barometer_setting_in_hg_pilot")
        self.datarefs['wind_speed'] = xp.findDataRef("sim/cockpit2/gauges/indicators/wind_speed_kts")
        self.datarefs['wind_direction'] = xp.findDataRef("sim/cockpit2/gauges/indicators/wind_heading_deg_mag")
        self.datarefs['acf_icao'] = xp.findDataRef("sim/aircraft/view/acf_ICAO")
        
        # FMS/GPS datarefs - XPLMCountFMSEntries gives total waypoints in FMS
        # Individual waypoint access via xp.getFMSEntryInfo(index)
        # Returns: outType, outID, outRef, outAltitude, outLat, outLon
        
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
            has_crashed = xp.getDatai(self.datarefs['has_crashed']) == 1
            ias = xp.getDataf(self.datarefs['indicated_airspeed']) or 0
            pitch = xp.getDataf(self.datarefs['theta']) or 0

            stall_warning = xp.getDatai(self.datarefs['stall_warning']) == 1
            override_alpha = xp.getDatai(self.datarefs['override_alpha']) == 1
            overspeed = xp.getDatai(self.datarefs['overspeed']) == 1
            flaps_overspeed = xp.getDatai(self.datarefs['flap_speed_overflow']) == 1

            # Environment & weight data for calculator
            total_weight_kg = round(xp.getDataf(self.datarefs['total_weight']), 0)
            oat_c = round(xp.getDataf(self.datarefs['oat']), 1)
            # Ground elevation: altitude MSL - altitude AGL
            agl_m = xp.getDataf(self.datarefs['ground_elevation'])
            elev_msl_m = xp.getDataf(self.datarefs['elev_msl'])
            ground_elevation_ft = round((elev_msl_m - agl_m) * 3.28084, 0)
            baro_inhg = xp.getDataf(self.datarefs['baro_setting'])
            baro_hpa = round(baro_inhg * 33.8639, 1)
            wind_speed_kts = round(xp.getDataf(self.datarefs['wind_speed']), 0)
            wind_direction = round(xp.getDataf(self.datarefs['wind_direction']), 0)
            
            # Aircraft ICAO type
            acf_icao_bytes = []
            xp.getDatab(self.datarefs['acf_icao'], acf_icao_bytes, 0, 40)
            aircraft_icao = ''.join(chr(b) for b in acf_icao_bytes if b > 0).strip()

            # Event detection
            tailstrike = pitch > 10 and on_ground
            stall = stall_warning or override_alpha

            # Check if any engine is running
            engines_running = False
            engine_array = []
            xp.getDatavi(self.datarefs['engine_running'], engine_array, 0, 8)
            for running in engine_array:
                if running == 1:
                    engines_running = True
                    break
            
            # Read FMS/flight plan waypoints (only every N seconds to save CPU)
            # Uses XPLMCountFMSEntries + XPLMGetFMSEntryInfo from X-Plane SDK
            # getFMSEntryInfo returns: (outType, outID, outRef, outAltitude, outLat, outLon)
            send_fms = False
            if current_time - self.last_fms_send >= self.fms_send_interval:
                self.last_fms_send = current_time
                send_fms = True
                fms_waypoints = []
                try:
                    fms_count = xp.countFMSEntries()
                    dest_idx = xp.getDestinationFMSEntry()
                    for i in range(min(fms_count, 100)):
                        outType, outID, outRef, outAlt, outLat, outLon = xp.getFMSEntryInfo(i)
                        # Skip unknown/empty entries
                        if outLat == 0.0 and outLon == 0.0:
                            continue
                        wp_name = outID if outID else f'WPT{i}'
                        fms_waypoints.append({
                            'name': wp_name,
                            'lat': round(outLat, 5),
                            'lon': round(outLon, 5),
                            'alt': round(outAlt, 0),  # altitude already in feet
                            'is_active': i == dest_idx,
                            'type': outType  # 1=airport, 2=NDB, 4=VOR, 512=fix, 2048=latlon
                        })
                except Exception as e:
                    xp.log(f"SkyCareer FMS read error: {str(e)}")
                    fms_waypoints = []
                self.cached_fms_waypoints = fms_waypoints

            # Detect takeoff (was on ground, now airborne)
            if self.last_on_ground and not on_ground:
                self.flight_started = True
            
            self.last_on_ground = on_ground
            
            # Only send data if flight has started
            if not self.flight_started and on_ground:
                return -1
            
            # Prepare payload - lean, only include what's needed
            payload = {
                'altitude': round(altitude, 1),
                'speed': round(speed, 1),
                'vertical_speed': round(vs, 1),
                'heading': round(heading, 1),
                'fuel_percentage': round(fuel_percentage, 1),
                'fuel_kg': round(fuel_current, 1),
                'g_force': round(g_force, 2),
                'latitude': latitude,
                'longitude': longitude,
                'on_ground': on_ground,
                'parking_brake': parking_brake,
                'engines_running': engines_running,
                'has_crashed': has_crashed,
                'tailstrike': tailstrike,
                'stall': stall,
                'stall_warning': stall_warning,
                'override_alpha': override_alpha,
                'overspeed': overspeed,
                'flaps_overspeed': flaps_overspeed,
                'total_weight_kg': total_weight_kg,
                'oat_c': oat_c,
                'ground_elevation_ft': ground_elevation_ft,
                'baro_setting': baro_hpa,
                'wind_speed_kts': wind_speed_kts,
                'wind_direction': wind_direction,
                'aircraft_icao': aircraft_icao,
            }
            
            # Include FMS waypoints only when freshly read
            if send_fms and self.cached_fms_waypoints:
                payload['fms_waypoints'] = self.cached_fms_waypoints
            
            # Only include touchdown data when actually landing
            if not self.last_on_ground and on_ground:
                payload['touchdown_vspeed'] = round(vs, 1)
                payload['landing_g_force'] = round(g_force, 2)
            
            # Only include failures when count changes (avoid server overhead)
            if not hasattr(self, '_last_failure_count'):
                self._last_failure_count = 0
            if len(self.active_failures) != self._last_failure_count:
                failure_list = []
                for dataref_path in self.active_failures:
                    for pool, sev in [(self.light_failures, "leicht"), (self.medium_failures, "mittel"), (self.severe_failures, "schwer")]:
                        for dr, name in pool:
                            if dr == dataref_path:
                                cat = "airframe"
                                if "engine" in dr or "engfai" in dr or "engfir" in dr or "vacpmp" in dr:
                                    cat = "engine"
                                elif "hydpmp" in dr:
                                    cat = "hydraulics"
                                elif "lites" in dr or "genera" in dr or "batter" in dr or "esys" in dr:
                                    cat = "electrical"
                                elif "pitot" in dr or "static" in dr or "apts" in dr or "otto" in dr or "auto_servo" in dr or "ins" in dr:
                                    cat = "avionics"
                                elif "fc_" in dr or "stbaug" in dr:
                                    cat = "flight_controls"
                                elif "depres" in dr or "smoke" in dr:
                                    cat = "pressurization"
                                failure_list.append({"name": name, "severity": sev, "category": cat})
                payload['active_failures'] = failure_list
                self._last_failure_count = len(self.active_failures)
            
            # Send to API
            self.send_data(payload)
            
            # Failure system: check for random failures based on maintenance ratio
            if self.flight_started and not on_ground:
                self.check_failures(current_time)
            
        except Exception as e:
            xp.log(f"SkyCareer Error: {str(e)}")
        
        return -1  # Continue flight loop
    
    def check_failures(self, current_time):
        """Check and trigger random failures based on aircraft maintenance ratio"""
        if current_time - self.last_failure_check < self.failure_check_interval:
            return
        
        self.last_failure_check = current_time
        
        # No failures if maintenance_ratio is 0
        if self.maintenance_ratio <= 0.0:
            return
        
        # Base probability per check (per 30 sec): maintenance_ratio determines chance
        # At 10% maintenance cost: ~1% chance per check (rare)
        # At 50% maintenance cost: ~8% chance per check (occasional)
        # At 100% maintenance cost: ~20% chance per check (frequent)
        base_chance = self.maintenance_ratio * self.maintenance_ratio * 0.20
        
        roll = self.random.random()
        if roll > base_chance:
            return  # No failure this check
        
        # Determine severity based on maintenance ratio
        # Higher maintenance = higher chance of severe failures
        severity_roll = self.random.random()
        
        if self.maintenance_ratio < 0.3:
            # Low wear: only light failures
            failure_pool = self.light_failures
            severity = "leicht"
        elif self.maintenance_ratio < 0.6:
            # Medium wear: mostly light, some medium
            if severity_roll < 0.7:
                failure_pool = self.light_failures
                severity = "leicht"
            else:
                failure_pool = self.medium_failures
                severity = "mittel"
        elif self.maintenance_ratio < 0.85:
            # High wear: light, medium, rare severe
            if severity_roll < 0.4:
                failure_pool = self.light_failures
                severity = "leicht"
            elif severity_roll < 0.85:
                failure_pool = self.medium_failures
                severity = "mittel"
            else:
                failure_pool = self.severe_failures
                severity = "schwer"
        else:
            # Critical wear: all severities, weighted to severe
            if severity_roll < 0.2:
                failure_pool = self.light_failures
                severity = "leicht"
            elif severity_roll < 0.55:
                failure_pool = self.medium_failures
                severity = "mittel"
            else:
                failure_pool = self.severe_failures
                severity = "schwer"
        
        # Pick a random failure from the pool that is not already active
        available = [(dr, name) for dr, name in failure_pool if dr not in self.active_failures]
        if not available:
            return
        
        dataref_path, failure_name = self.random.choice(available)
        
        # Set the failure: 6 = inoperative
        ref = self.failure_datarefs.get(dataref_path)
        if ref:
            xp.setDatai(ref, 6)
            self.active_failures.append(dataref_path)
            xp.log(f"SkyCareer AUSFALL [{severity}]: {failure_name} (Wartung: {self.maintenance_ratio*100:.0f}%)")
    
    def reset_all_failures(self):
        """Reset all active failures to working state"""
        for dataref_path in self.active_failures:
            ref = self.failure_datarefs.get(dataref_path)
            if ref:
                xp.setDatai(ref, 0)  # 0 = always working
        if self.active_failures:
            xp.log(f"SkyCareer: {len(self.active_failures)} Ausfaelle zurueckgesetzt")
        self.active_failures = []
    
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
            
            # Update maintenance ratio from server (for failure system)
            if 'maintenance_ratio' in result:
                self.maintenance_ratio = float(result['maintenance_ratio'])
            
            # If flight was completed, reset failures and state
            if result.get('status') == 'completed' or result.get('status') == 'ready_to_complete':
                if result.get('status') == 'completed':
                    xp.log(f"SkyCareer: Flight completed! Rating: {result.get('rating', 0):.1f}/5")
                self.reset_all_failures()
                self.current_flight_id = None
                self.flight_started = False
                self.maintenance_ratio = 0.0
                
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
- ⚠️ Zufällige Ausfälle basierend auf Wartungszustand des Flugzeugs:
  - 0% Wartungskosten = keine Ausfälle
  - Niedrig (< 30%): nur leichte Ausfälle (Lichter, Pitot, etc.)
  - Mittel (30-60%): leichte + mittlere Ausfälle (Generator, Hydraulik, Autopilot)
  - Hoch (60-85%): alle Stufen, seltene schwere Ausfälle (Triebwerk, Feuer)
  - Kritisch (> 85%): häufige und schwere Ausfälle
- 🔧 Alle Ausfälle werden nach Flugabschluss automatisch zurückgesetzt

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