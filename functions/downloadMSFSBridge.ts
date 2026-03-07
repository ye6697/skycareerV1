import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const apiEndpoint = url.searchParams.get('endpoint') || 'https://aero-career-pilot.base44.app/functions/receiveXPlaneData';

    const companies = await base44.entities.Company.filter({ created_by: user.email });
    const company = companies[0];

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    let apiKey = company.xplane_api_key;
    if (!apiKey) {
      apiKey = crypto.randomUUID();
      await base44.entities.Company.update(company.id, { xplane_api_key: apiKey });
    }

    const script = `#!/usr/bin/env python3
# SkyCareer MSFS Bridge (MSFS 2020 + 2024 via SimConnect)
# Usage:
#   python SkyCareer_MSFS_Bridge.py --sim msfs2020
#   python SkyCareer_MSFS_Bridge.py --sim msfs2024

import argparse
import time
import traceback
import requests

from SimConnect import SimConnect, AircraftRequests

API_ENDPOINT = "${apiEndpoint}"
API_KEY = "${apiKey}"
POST_TIMEOUT = 2.0
LOOP_INTERVAL = 1.0

FUEL_KG_PER_GALLON = 3.039

def to_bool(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    if isinstance(v, str):
        s = v.strip().lower()
        return s in ("1", "true", "yes", "on")
    return False

def to_float(v, default=0.0):
    try:
        if v is None:
            return default
        return float(v)
    except Exception:
        return default

def safe_get(aq, name, unit=None, default=None):
    try:
        if unit:
            return aq.get(name, unit)
        return aq.get(name)
    except Exception:
        return default

def post_payload(payload):
    url = f"{API_ENDPOINT}?api_key={API_KEY}"
    return requests.post(url, json=payload, timeout=POST_TIMEOUT)

def connect_sim():
    sm = SimConnect()
    aq = AircraftRequests(sm, _time=250)
    return sm, aq

def main():
    parser = argparse.ArgumentParser(description="SkyCareer bridge for MSFS 2020/2024")
    parser.add_argument("--sim", default="msfs2020", choices=["msfs2020", "msfs2024"])
    args = parser.parse_args()

    max_g_force = 1.0

    print("[SkyCareer] Starting MSFS bridge ...")
    print(f"[SkyCareer] Endpoint: {API_ENDPOINT}")
    print(f"[SkyCareer] Simulator label: {args.sim}")

    sm = None
    aq = None

    while True:
        try:
            if sm is None or aq is None:
                print("[SkyCareer] Connecting to SimConnect ...")
                sm, aq = connect_sim()
                print("[SkyCareer] SimConnect connected.")

            altitude = to_float(safe_get(aq, "PLANE ALTITUDE", "feet"), 0.0)
            speed = to_float(safe_get(aq, "GROUND VELOCITY", "knots"), 0.0)
            ias = to_float(safe_get(aq, "AIRSPEED INDICATED", "knots"), 0.0)
            vertical_speed = to_float(safe_get(aq, "VERTICAL SPEED", "feet per minute"), 0.0)
            heading = to_float(safe_get(aq, "PLANE HEADING DEGREES MAGNETIC", "degrees"), 0.0)
            pitch = to_float(safe_get(aq, "PLANE PITCH DEGREES", "degrees"), 0.0)
            latitude = to_float(safe_get(aq, "PLANE LATITUDE", "degrees"), 0.0)
            longitude = to_float(safe_get(aq, "PLANE LONGITUDE", "degrees"), 0.0)

            g_force = to_float(safe_get(aq, "G FORCE", "GForce"), 1.0)
            if g_force > max_g_force:
                max_g_force = g_force

            on_ground = to_bool(safe_get(aq, "SIM ON GROUND", "bool"), True)
            parking_brake = to_bool(safe_get(aq, "BRAKE PARKING POSITION", "bool"), False)
            engine1_running = to_bool(safe_get(aq, "GENERAL ENG COMBUSTION:1", "bool"), False)
            engine2_running = to_bool(safe_get(aq, "GENERAL ENG COMBUSTION:2", "bool"), False)
            gear_down = to_bool(safe_get(aq, "GEAR HANDLE POSITION", "bool"), True)
            flap_ratio = to_float(safe_get(aq, "TRAILING EDGE FLAPS LEFT PERCENT", "percent"), 0.0) / 100.0

            fuel_gal = to_float(safe_get(aq, "FUEL TOTAL QUANTITY", "gallons"), 0.0)
            fuel_capacity_gal = to_float(safe_get(aq, "FUEL TOTAL CAPACITY", "gallons"), 0.0)
            fuel_percentage = (fuel_gal / fuel_capacity_gal * 100.0) if fuel_capacity_gal > 0 else 0.0
            fuel_kg = fuel_gal * FUEL_KG_PER_GALLON

            payload = {
                "simulator": args.sim,
                "altitude": altitude,
                "speed": speed,
                "ias": ias,
                "vertical_speed": vertical_speed,
                "heading": heading,
                "pitch": pitch,
                "g_force": g_force,
                "max_g_force": max_g_force,
                "latitude": latitude,
                "longitude": longitude,
                "on_ground": on_ground,
                "parking_brake": parking_brake,
                "engine1_running": engine1_running,
                "engine2_running": engine2_running,
                "engines_running": engine1_running or engine2_running,
                "gear_down": gear_down,
                "flap_ratio": flap_ratio,
                "fuel_percentage": fuel_percentage,
                "fuel_kg": fuel_kg,
                "touchdown_vspeed": 0,
                "landing_g_force": 0,
                "tailstrike": False,
                "stall": False,
                "is_in_stall": False,
                "stall_warning": False,
                "override_alpha": False,
                "overstress": False,
                "overspeed": False,
                "flaps_overspeed": False,
                "fuel_emergency": fuel_percentage < 3.0,
                "gear_up_landing": False,
                "crash": False,
                "has_crashed": False,
                "aircraft_icao": safe_get(aq, "ATC MODEL", "string", "") or "",
            }

            resp = post_payload(payload)
            if resp.status_code >= 400:
                print(f"[SkyCareer] API error {resp.status_code}: {resp.text[:200]}")

            time.sleep(LOOP_INTERVAL)

        except KeyboardInterrupt:
            print("\\n[SkyCareer] Stopped by user.")
            break
        except Exception as ex:
            print(f"[SkyCareer] Bridge error: {ex}")
            traceback.print_exc()
            sm = None
            aq = None
            time.sleep(3.0)

if __name__ == "__main__":
    main()
`;

    return new Response(script, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="SkyCareer_MSFS_Bridge.py"'
      }
    });
  } catch (error) {
    console.error('Error generating MSFS bridge:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

