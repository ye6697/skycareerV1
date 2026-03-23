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
        if isinstance(v, bytes):
            if len(v) == 0:
                return default
            v = v.decode('utf-8', errors='ignore')
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
    prev_on_ground = True
    touchdown_vspeed = 0.0
    landing_g_force = 0.0
    prev_vs = 0.0
    was_airborne = False
    # Track events that persist across ticks (once triggered, stay True until reset)
    event_tailstrike = False
    event_overstress = False
    event_crash = False
    event_stall = False
    event_overspeed = False
    event_flaps_overspeed = False
    event_gear_up_landing = False
    event_harsh_controls = False

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

            # === EVENT DETECTION via SimConnect variables ===

            # Track if aircraft was airborne (for event detection - only count events after takeoff)
            if not on_ground and altitude > 50:
                was_airborne = True

            # === STALL DETECTION ===
            stall_warning = to_bool(safe_get(aq, "STALL WARNING", "bool", False))
            incidence_alpha = to_float(safe_get(aq, "INCIDENCE ALPHA", "degrees", 0.0), 0.0)
            is_stalling_now = stall_warning
            if incidence_alpha > 18.0 and not on_ground:
                is_stalling_now = True
            # Persist: once stalled, stays True
            if is_stalling_now and was_airborne:
                event_stall = True

            # === OVERSPEED DETECTION ===
            overspeed_warning = to_bool(safe_get(aq, "OVERSPEED WARNING", "bool", False))
            if overspeed_warning and was_airborne:
                event_overspeed = True

            # === CRASH DETECTION ===
            sim_disabled = to_bool(safe_get(aq, "SIM DISABLED", "bool", False))
            plane_bank = abs(to_float(safe_get(aq, "PLANE BANK DEGREES", "degrees"), 0.0))
            plane_pitch_abs = abs(pitch)
            if sim_disabled and was_airborne:
                event_crash = True

            # === OVERSTRESS DETECTION ===
            # G-force > 2.5 or extreme bank/pitch while airborne
            if abs(g_force) > 2.5 and not on_ground and was_airborne:
                event_overstress = True

            # === TAILSTRIKE DETECTION ===
            if on_ground and pitch > 11.0 and speed > 30:
                event_tailstrike = True

            # === FLAPS OVERSPEED DETECTION ===
            if was_airborne:
                if flap_ratio > 0.5 and ias > 200:
                    event_flaps_overspeed = True
                elif flap_ratio > 0.0 and ias > 250:
                    event_flaps_overspeed = True

            # === GEAR-UP LANDING DETECTION ===
            if on_ground and not gear_down and speed > 40 and was_airborne:
                event_gear_up_landing = True

            # === HARSH CONTROLS DETECTION ===
            # Detect aggressive control inputs via rapid pitch/bank changes
            if was_airborne and not on_ground:
                if plane_bank > 60 or plane_pitch_abs > 30:
                    event_harsh_controls = True

            # Touchdown detection: transition from airborne to ground
            just_landed = on_ground and not prev_on_ground
            if just_landed:
                # Capture the V/S and G at moment of touchdown
                touchdown_vspeed = abs(prev_vs)
                landing_g_force = g_force
                print(f"[SkyCareer] TOUCHDOWN: V/S={touchdown_vspeed:.0f} fpm, G={landing_g_force:.2f}")

            prev_on_ground = on_ground
            prev_vs = vertical_speed

            # Environment & performance data
            oat_c = to_float(safe_get(aq, "AMBIENT TEMPERATURE", "celsius"), None)
            baro_mb = to_float(safe_get(aq, "KOHLSMAN SETTING MB", "millibars"), None)
            wind_speed_kts = to_float(safe_get(aq, "AMBIENT WIND VELOCITY", "knots"), None)
            wind_direction = to_float(safe_get(aq, "AMBIENT WIND DIRECTION", "degrees"), None)
            ground_elev_m = to_float(safe_get(aq, "GROUND ALTITUDE", "meters"), None)
            ground_elev_ft = ground_elev_m * 3.28084 if ground_elev_m is not None else None
            total_weight_lbs = to_float(safe_get(aq, "TOTAL WEIGHT", "pounds"), None)
            total_weight_kg = total_weight_lbs * 0.453592 if total_weight_lbs is not None else None

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
                "touchdown_vspeed": touchdown_vspeed,
                "landing_g_force": landing_g_force,
                "tailstrike": event_tailstrike,
                "stall": is_stalling,
                "is_in_stall": is_stalling,
                "stall_warning": stall_warning,
                "override_alpha": False,
                "overstress": event_overstress,
                "overspeed": is_overspeed,
                "flaps_overspeed": flaps_overspeed,
                "fuel_emergency": fuel_percentage < 3.0,
                "gear_up_landing": gear_up_landing,
                "crash": event_crash,
                "has_crashed": event_crash,
                "aircraft_icao": safe_get(aq, "ATC MODEL", "string", "") or "",
                "oat_c": oat_c,
                "baro_setting": baro_mb,
                "wind_speed_kts": wind_speed_kts,
                "wind_direction": wind_direction,
                "ground_elevation_ft": ground_elev_ft,
                "total_weight_kg": total_weight_kg,
            }

            # Debug: show env data on first packet and every 30 seconds
            if not hasattr(main, '_last_debug') or (time.time() - main._last_debug) > 30:
                main._last_debug = time.time()
                events_str = []
                if is_stalling: events_str.append("STALL")
                if is_overspeed: events_str.append("OVERSPEED")
                if event_overstress: events_str.append("OVERSTRESS")
                if event_tailstrike: events_str.append("TAILSTRIKE")
                if flaps_overspeed: events_str.append("FLAPS_OVSPD")
                if gear_up_landing: events_str.append("GEAR_UP_LDG")
                if event_crash: events_str.append("CRASH")
                ev_display = ", ".join(events_str) if events_str else "NONE"
                print(f"[SkyCareer] ENV: OAT={oat_c}C QNH={baro_mb}mb WIND={wind_direction}/{wind_speed_kts}kt ELEV={ground_elev_ft}ft GWT={total_weight_kg}kg ICAO={payload['aircraft_icao']}")
                print(f"[SkyCareer] EVENTS: {ev_display} | G={g_force:.2f} MaxG={max_g_force:.2f} AoA={incidence_alpha:.1f} Pitch={pitch:.1f} IAS={ias:.0f}")

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