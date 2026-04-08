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
# SkyCareer MSFS Bridge v2.4 (MSFS 2020 + 2024 via SimConnect)
# Fixes: ICAO type, gear position, flap unit, event reset, fuel type, tailstrike
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
LOOP_INTERVAL = 2.0
SAMPLE_INTERVAL = 0.2
SAMPLE_BUFFER_SECONDS = 2.0
TOUCHDOWN_CAPTURE_BEFORE_S = 0.6
TOUCHDOWN_CAPTURE_AFTER_S = 0.4
TOUCHDOWN_MAX_AGL_FT = 60.0
MAX_EVENT_QUEUE = 120
MAX_CONSECUTIVE_POST_TIMEOUTS = 3
WORKER_RESTART_BACKOFF_S = 2.0

# Fuel density constants (kg per gallon)
JETA_KG_PER_GALLON = 3.039   # Jet-A / Jet-A1
AVGAS_KG_PER_GALLON = 2.72   # 100LL Avgas

def to_bool(v, default=False):
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    if isinstance(v, str):
        s = v.strip().lower()
        return s in ("1", "true", "yes", "on")
    return default

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

def to_str(v, default=""):
    try:
        if v is None:
            return default
        if isinstance(v, bytes):
            return v.decode('utf-8', errors='ignore').strip()
        return str(v).strip()
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
    aq = AircraftRequests(sm, _time=100)
    return sm, aq

def reset_flight_state():
    """Returns a clean state dict for a new flight cycle."""
    return {
        "max_g_force": 1.0,
        "window_peak_g": 1.0,
        "window_min_vs": 0.0,
        "touchdown_vspeed": 0.0,
        "landing_g_force": 0.0,
        "landing_data_timestamp": None,
        "landing_locked_local": False,
        "touchdown_epoch": None,
        "touchdown_capture_until": None,
        "sample_buffer": [],
        "prev_g_force": 1.0,
        "was_airborne": False,
        "event_tailstrike": False,
        "event_overstress": False,
        "event_crash": False,
        "event_stall": False,
        "event_overspeed": False,
        "event_flaps_overspeed": False,
        "event_gear_up_landing": False,
        "event_harsh_controls": False,
        "event_queue": [],
        "event_last_emit": {},
        "prev_gear_down": True,
        "prev_flap_pct": 0,
        "prev_speedbrake_on": False,
        "prev_fuel_kg": None,
        "prev_fuel_ts": None,
        "fuel_flow_fallback_kgph": 0.0,
    }

def queue_event(state, event_type, lat, lon, altitude, speed, vertical_speed, g_force, val=None, cooldown=0.0):
    now_epoch = time.time()
    last_emit = float(state.get("event_last_emit", {}).get(event_type, 0.0) or 0.0)
    if cooldown > 0 and (now_epoch - last_emit) < cooldown:
        return
    evt = {
        "type": str(event_type),
        "lat": float(lat) if lat is not None else None,
        "lon": float(lon) if lon is not None else None,
        "alt": float(altitude) if altitude is not None else None,
        "spd": float(speed) if speed is not None else None,
        "vs": float(vertical_speed) if vertical_speed is not None else None,
        "g": float(g_force) if g_force is not None else None,
        "t": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    if val is not None:
        evt["val"] = val
    state["event_queue"].append(evt)
    if len(state["event_queue"]) > MAX_EVENT_QUEUE:
        state["event_queue"] = state["event_queue"][-MAX_EVENT_QUEUE:]
    state["event_last_emit"][event_type] = now_epoch

def should_restart_worker_on_timeouts(consecutive_timeouts, last_success_at, now_epoch):
    if consecutive_timeouts < MAX_CONSECUTIVE_POST_TIMEOUTS:
        return False
    max_gap = max(10.0, LOOP_INTERVAL * (MAX_CONSECUTIVE_POST_TIMEOUTS + 1))
    return (now_epoch - float(last_success_at or 0.0)) >= max_gap

def main():
    parser = argparse.ArgumentParser(description="SkyCareer bridge for MSFS 2020/2024")
    parser.add_argument("--sim", default="msfs2020", choices=["msfs2020", "msfs2024"])
    args = parser.parse_args()

    prev_on_ground = True
    prev_vs = 0.0
    state = reset_flight_state()
    next_post_at = 0.0
    worker_restart_count = 0
    consecutive_post_timeouts = 0
    last_successful_post_at = time.time()
    last_seen_flight_id = None

    print("[SkyCareer] Starting MSFS bridge v2.4 ...")
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

            # === BASIC FLIGHT DATA ===
            altitude = to_float(safe_get(aq, "PLANE ALTITUDE", "feet"), 0.0)
            speed = to_float(safe_get(aq, "GROUND VELOCITY", "knots"), 0.0)
            ias = to_float(safe_get(aq, "AIRSPEED INDICATED", "knots"), 0.0)
            vertical_speed = to_float(safe_get(aq, "VERTICAL SPEED", "feet per minute"), 0.0)
            heading = to_float(safe_get(aq, "PLANE HEADING DEGREES MAGNETIC", "degrees"), 0.0)
            pitch = to_float(safe_get(aq, "PLANE PITCH DEGREES", "degrees"), 0.0)
            latitude = to_float(safe_get(aq, "PLANE LATITUDE", "degrees"), 0.0)
            longitude = to_float(safe_get(aq, "PLANE LONGITUDE", "degrees"), 0.0)
            alt_agl = to_float(safe_get(aq, "PLANE ALT ABOVE GROUND", "feet"), 0.0)
            now_epoch = time.time()

            g_force = to_float(safe_get(aq, "G FORCE", "GForce"), 1.0)
            if g_force > state["max_g_force"]:
                state["max_g_force"] = g_force
            state["window_peak_g"] = max(state["window_peak_g"], g_force)
            if vertical_speed < state["window_min_vs"]:
                state["window_min_vs"] = vertical_speed

            on_ground = to_bool(safe_get(aq, "SIM ON GROUND", "bool", True))
            parking_brake = to_bool(safe_get(aq, "BRAKE PARKING POSITION", "bool", False))
            engine1_running = to_bool(safe_get(aq, "GENERAL ENG COMBUSTION:1", "bool", False))
            engine2_running = to_bool(safe_get(aq, "GENERAL ENG COMBUSTION:2", "bool", False))
            throttle1_pct = to_float(safe_get(aq, "GENERAL ENG THROTTLE LEVER POSITION:1", "percent"), 0.0)
            throttle2_pct = to_float(safe_get(aq, "GENERAL ENG THROTTLE LEVER POSITION:2", "percent"), throttle1_pct)
            avg_engine_load_pct = max(0.0, min(100.0, (throttle1_pct + throttle2_pct) / 2.0))

            # === FIX #2: GEAR - check actual gear positions, not just handle ===
            gear_handle = to_float(safe_get(aq, "GEAR HANDLE POSITION", "position"), 1.0)
            gear_left = to_float(safe_get(aq, "GEAR LEFT POSITION", "position"), 1.0)
            gear_center = to_float(safe_get(aq, "GEAR CENTER POSITION", "position"), 1.0)
            gear_right = to_float(safe_get(aq, "GEAR RIGHT POSITION", "position"), 1.0)
            # Gear is "down" only if handle is down AND all gear positions are > 0.95 (fully extended)
            gear_down = gear_handle > 0.5 and gear_left > 0.95 and gear_center > 0.95 and gear_right > 0.95

            # === FIX #3: FLAPS - use "Position" unit instead of "percent" ===
            flap_raw = to_float(safe_get(aq, "TRAILING EDGE FLAPS LEFT PERCENT", "Position"), 0.0)
            # Normalize: if value > 1.0, it's likely 0-100 range; otherwise 0-1
            flap_ratio = flap_raw / 100.0 if flap_raw > 1.5 else flap_raw
            speedbrake_pos = to_float(safe_get(aq, "SPOILERS HANDLE POSITION", "position"), 0.0)
            speedbrake_on = speedbrake_pos > 0.1

            # === FIX #6: FUEL - detect engine type for correct density ===
            engine_type = to_float(safe_get(aq, "ENGINE TYPE", "Enum"), 0.0)
            # Engine types: 0=Piston, 1=Jet, 2=None, 3=Helo(turbine), 4=Rocket, 5=Turboprop
            is_jet_engine = engine_type in (1.0, 3.0, 5.0)
            fuel_density = JETA_KG_PER_GALLON if is_jet_engine else AVGAS_KG_PER_GALLON

            fuel_gal = to_float(safe_get(aq, "FUEL TOTAL QUANTITY", "gallons"), 0.0)
            fuel_capacity_gal = to_float(safe_get(aq, "FUEL TOTAL CAPACITY", "gallons"), 0.0)
            fuel_percentage = (fuel_gal / fuel_capacity_gal * 100.0) if fuel_capacity_gal > 0 else 0.0
            fuel_kg = fuel_gal * fuel_density
            fuel_flow_eng1_pph = to_float(safe_get(aq, "TURB ENG FUEL FLOW PPH:1", "pounds per hour"), 0.0)
            fuel_flow_eng2_pph = to_float(safe_get(aq, "TURB ENG FUEL FLOW PPH:2", "pounds per hour"), 0.0)
            fuel_flow_eng1_gph = to_float(safe_get(aq, "ENG FUEL FLOW GPH:1", "gallons per hour"), 0.0)
            fuel_flow_eng2_gph = to_float(safe_get(aq, "ENG FUEL FLOW GPH:2", "gallons per hour"), 0.0)
            fuel_flow_total_pph = max(0.0, fuel_flow_eng1_pph) + max(0.0, fuel_flow_eng2_pph)
            fuel_flow_total_gph = max(0.0, fuel_flow_eng1_gph) + max(0.0, fuel_flow_eng2_gph)
            fuel_flow_source = ""
            fuel_flow_total_kgph = 0.0
            if fuel_flow_total_pph > 0.0:
                fuel_flow_total_kgph = fuel_flow_total_pph * 0.45359237
                fuel_flow_source = "simconnect_pph"
            elif fuel_flow_total_gph > 0.0:
                fuel_flow_total_kgph = fuel_flow_total_gph * fuel_density
                fuel_flow_source = "simconnect_gph"
            prev_fuel_kg = to_float(state.get("prev_fuel_kg"), 0.0)
            prev_fuel_ts = to_float(state.get("prev_fuel_ts"), 0.0)
            if fuel_flow_total_kgph <= 0.0 and prev_fuel_kg > 0.0 and prev_fuel_ts > 0.0 and fuel_kg <= prev_fuel_kg:
                dt = now_epoch - prev_fuel_ts
                if dt >= 0.5:
                    burned_kg = max(0.0, prev_fuel_kg - fuel_kg)
                    if burned_kg > 0.0:
                        instant_flow_kgph = (burned_kg * 3600.0) / dt
                        if 20.0 <= instant_flow_kgph <= 20000.0:
                            prev_flow = to_float(state.get("fuel_flow_fallback_kgph"), 0.0)
                            fuel_flow_total_kgph = instant_flow_kgph if prev_flow <= 0.0 else ((prev_flow * 0.65) + (instant_flow_kgph * 0.35))
                            state["fuel_flow_fallback_kgph"] = fuel_flow_total_kgph
                            fuel_flow_source = "derived_delta"
            state["prev_fuel_kg"] = fuel_kg
            state["prev_fuel_ts"] = now_epoch
            fuel_flow_total_lph = fuel_flow_total_kgph * 1.25 if fuel_flow_total_kgph > 0.0 else 0.0

            # === FIX #1: AIRCRAFT ICAO - use ATC TYPE instead of ATC MODEL ===
            aircraft_icao = to_str(safe_get(aq, "ATC TYPE", None, ""), "")
            # Fallback to ATC MODEL if ATC TYPE is empty
            if not aircraft_icao:
                aircraft_icao = to_str(safe_get(aq, "ATC MODEL", None, ""), "")

            # === EVENT DETECTION ===

            # Track if aircraft was airborne (only count events after takeoff)
            if not on_ground and (altitude > 50 or ias > 35 or abs(vertical_speed) > 200):
                state["was_airborne"] = True

            # Keep a short rolling sample window around touchdown for accurate landing G/VS capture
            state["sample_buffer"].append({
                "t": now_epoch,
                "g": g_force,
                "vs": vertical_speed,
                "on_ground": on_ground,
                "agl": alt_agl,
                "lat": latitude,
                "lon": longitude,
                "alt": altitude,
                "spd": speed,
            })
            sample_cutoff = now_epoch - SAMPLE_BUFFER_SECONDS
            state["sample_buffer"] = [s for s in state["sample_buffer"] if s.get("t", 0) >= sample_cutoff]

            # === FIX #5: Reset touchdown values when lifting off ===
            just_took_off = not on_ground and prev_on_ground
            if just_took_off:
                state["touchdown_vspeed"] = 0.0
                state["landing_g_force"] = 0.0
                state["window_peak_g"] = g_force
                state["window_min_vs"] = min(0.0, vertical_speed)
                state["landing_data_timestamp"] = None
                state["landing_locked_local"] = False
                state["touchdown_epoch"] = None
                state["touchdown_capture_until"] = None
                print("[SkyCareer] AIRBORNE - touchdown values reset")

            # === FIX #4: Reset ALL events when starting a new flight cycle ===
            # New flight cycle = on ground + parking brake + engines off + low speed
            engines_off = not engine1_running and not engine2_running
            if on_ground and parking_brake and engines_off and speed < 5 and state["was_airborne"]:
                print("[SkyCareer] FLIGHT CYCLE COMPLETE - resetting all events")
                state = reset_flight_state()

            # === CONTROL SURFACE/CONFIG TRANSITIONS (for map event markers) ===
            if state.get("was_airborne"):
                prev_gear_down = state.get("prev_gear_down", gear_down)
                if prev_gear_down != gear_down:
                    queue_event(
                        state,
                        "gear_down" if gear_down else "gear_up",
                        latitude,
                        longitude,
                        altitude,
                        speed,
                        vertical_speed,
                        g_force,
                        cooldown=0.2,
                    )
                prev_flap_pct = int(round(float(state.get("prev_flap_pct", 0))))
                cur_flap_pct = int(round(float(flap_ratio) * 100.0))
                if abs(cur_flap_pct - prev_flap_pct) >= 4:
                    queue_event(
                        state,
                        "flaps",
                        latitude,
                        longitude,
                        altitude,
                        speed,
                        vertical_speed,
                        g_force,
                        val=cur_flap_pct,
                        cooldown=0.5,
                    )
                prev_speedbrake_on = bool(state.get("prev_speedbrake_on", False))
                if prev_speedbrake_on != speedbrake_on:
                    queue_event(
                        state,
                        "spoiler_on" if speedbrake_on else "spoiler_off",
                        latitude,
                        longitude,
                        altitude,
                        speed,
                        vertical_speed,
                        g_force,
                        cooldown=0.5,
                    )
            state["prev_gear_down"] = gear_down
            state["prev_flap_pct"] = int(round(float(flap_ratio) * 100.0))
            state["prev_speedbrake_on"] = bool(speedbrake_on)

            # === STALL DETECTION ===
            stall_warning = to_bool(safe_get(aq, "STALL WARNING", "bool", False))
            incidence_alpha = to_float(safe_get(aq, "INCIDENCE ALPHA", "degrees", 0.0), 0.0)
            is_stalling_now = stall_warning
            if incidence_alpha > 18.0 and not on_ground:
                is_stalling_now = True
            if is_stalling_now and state["was_airborne"]:
                state["event_stall"] = True
                queue_event(state, "stall", latitude, longitude, altitude, speed, vertical_speed, g_force, cooldown=6.0)

            # === OVERSPEED DETECTION ===
            overspeed_warning = to_bool(safe_get(aq, "OVERSPEED WARNING", "bool", False))
            if overspeed_warning and state["was_airborne"]:
                state["event_overspeed"] = True
                queue_event(state, "overspeed", latitude, longitude, altitude, speed, vertical_speed, g_force, cooldown=6.0)

            # === CRASH DETECTION ===
            sim_disabled = to_bool(safe_get(aq, "SIM DISABLED", "bool", False))
            plane_bank = abs(to_float(safe_get(aq, "PLANE BANK DEGREES", "degrees"), 0.0))
            plane_pitch_abs = abs(pitch)
            if sim_disabled and state["was_airborne"]:
                state["event_crash"] = True
                queue_event(state, "crash", latitude, longitude, altitude, speed, vertical_speed, g_force, cooldown=30.0)

            # === OVERSTRESS DETECTION ===
            if abs(g_force) > 2.5 and not on_ground and state["was_airborne"]:
                state["event_overstress"] = True
                queue_event(state, "overstress", latitude, longitude, altitude, speed, vertical_speed, g_force, cooldown=6.0)

            # === FIX #7: TAILSTRIKE - SimConnect contact point detection + heuristic fallback ===
            # MSFS contact points: 0=nosewheel, 1=left main, 2=right main, 3+=tail/scrape/wingtip
            # CONTACT POINT IS ON GROUND:index returns true if that point touches ground
            # We check indices 3-6 which are typically tail bumper/scrape points
            tail_contact_detected = False
            for cp_idx in range(3, 7):
                cp_on_ground = to_bool(safe_get(aq, f"CONTACT POINT IS ON GROUND:{cp_idx}", "bool", False))
                if cp_on_ground and not on_ground:
                    # Contact point touching ground while aircraft is not "on ground" = scrape during flight
                    tail_contact_detected = True
                    break
                if cp_on_ground and on_ground and speed > 30:
                    # Contact point touching while on ground at speed = tail scrape during takeoff/landing
                    tail_contact_detected = True
                    break

            if tail_contact_detected and state["was_airborne"]:
                if not state["event_tailstrike"]:
                    print(f"[SkyCareer] TAILSTRIKE detected via contact point!")
                state["event_tailstrike"] = True
                queue_event(state, "tailstrike", latitude, longitude, altitude, speed, vertical_speed, g_force, cooldown=20.0)

            # Heuristic fallback: speed-dependent pitch thresholds (if contact points not available)
            if not state["event_tailstrike"] and on_ground and state["was_airborne"]:
                if speed > 120 and pitch > 9.0:
                    state["event_tailstrike"] = True
                elif speed > 60 and pitch > 12.0:
                    state["event_tailstrike"] = True
                elif speed > 30 and pitch > 15.0:
                    state["event_tailstrike"] = True
                if state["event_tailstrike"]:
                    queue_event(state, "tailstrike", latitude, longitude, altitude, speed, vertical_speed, g_force, cooldown=20.0)

            # === FLAPS OVERSPEED DETECTION ===
            if state["was_airborne"]:
                if flap_ratio > 0.5 and ias > 200:
                    state["event_flaps_overspeed"] = True
                elif flap_ratio > 0.0 and ias > 250:
                    state["event_flaps_overspeed"] = True
                if state["event_flaps_overspeed"]:
                    queue_event(state, "flaps_overspeed", latitude, longitude, altitude, speed, vertical_speed, g_force, cooldown=8.0)

            # === GEAR-UP LANDING DETECTION (using actual gear positions) ===
            if on_ground and not gear_down and speed > 40 and state["was_airborne"]:
                state["event_gear_up_landing"] = True
                queue_event(state, "gear_up_landing", latitude, longitude, altitude, speed, vertical_speed, g_force, cooldown=30.0)

            # === HARSH CONTROLS DETECTION ===
            if state["was_airborne"] and not on_ground:
                if plane_bank > 60 or plane_pitch_abs > 30:
                    state["event_harsh_controls"] = True
                    queue_event(state, "harsh_controls", latitude, longitude, altitude, speed, vertical_speed, g_force, cooldown=8.0)

            # === TOUCHDOWN DETECTION ===
            just_landed = state["was_airborne"] and on_ground and not prev_on_ground
            if just_landed:
                state["touchdown_epoch"] = now_epoch
                state["touchdown_capture_until"] = now_epoch + TOUCHDOWN_CAPTURE_AFTER_S
                window_start = now_epoch - TOUCHDOWN_CAPTURE_BEFORE_S
                raw_window = [s for s in state["sample_buffer"] if s.get("t", 0) >= window_start and s.get("t", 0) <= now_epoch + 0.001]
                landing_window = [
                    s for s in raw_window
                    if bool(s.get("on_ground")) or (s.get("agl") is not None and float(s.get("agl", 0.0)) <= TOUCHDOWN_MAX_AGL_FT)
                ]
                if not landing_window:
                    landing_window = raw_window

                g_candidates = [float(s.get("g", 1.0)) for s in landing_window]
                vs_candidates = [abs(float(s.get("vs", 0.0))) for s in landing_window if float(s.get("vs", 0.0)) < -40.0]
                touchdown_vs_local = max(abs(prev_vs), abs(vertical_speed), max(vs_candidates) if vs_candidates else 0.0)
                landing_g_local = max(1.0, g_force, state.get("prev_g_force", 1.0), max(g_candidates) if g_candidates else 1.0)
                state["touchdown_vspeed"] = max(state["touchdown_vspeed"], touchdown_vs_local)
                state["landing_g_force"] = max(state["landing_g_force"], landing_g_local)
                state["landing_data_timestamp"] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                state["landing_locked_local"] = True
                queue_event(
                    state,
                    "touchdown",
                    latitude,
                    longitude,
                    altitude,
                    speed,
                    -abs(state["touchdown_vspeed"]),
                    state["landing_g_force"],
                    cooldown=2.0,
                )
                print(f"[SkyCareer] TOUCHDOWN: V/S={state['touchdown_vspeed']:.0f} fpm, G={state['landing_g_force']:.2f}")

            # Keep capturing a brief post-touchdown window to catch the exact impact spike.
            if state.get("landing_locked_local") and state.get("touchdown_epoch") is not None:
                capture_until = state.get("touchdown_capture_until")
                if capture_until is not None and now_epoch <= capture_until:
                    window_start = float(state.get("touchdown_epoch", now_epoch)) - TOUCHDOWN_CAPTURE_BEFORE_S
                    raw_window = [s for s in state["sample_buffer"] if s.get("t", 0) >= window_start and s.get("t", 0) <= now_epoch + 0.001]
                    landing_window = [
                        s for s in raw_window
                        if bool(s.get("on_ground")) or (s.get("agl") is not None and float(s.get("agl", 0.0)) <= TOUCHDOWN_MAX_AGL_FT)
                    ]
                    if not landing_window:
                        landing_window = raw_window
                    g_candidates = [float(s.get("g", 1.0)) for s in landing_window]
                    vs_candidates = [abs(float(s.get("vs", 0.0))) for s in landing_window if float(s.get("vs", 0.0)) < -40.0]
                    if g_candidates:
                        state["landing_g_force"] = max(state["landing_g_force"], max(g_candidates))
                    if vs_candidates:
                        state["touchdown_vspeed"] = max(state["touchdown_vspeed"], max(vs_candidates))

            prev_on_ground = on_ground
            prev_vs = vertical_speed
            state["prev_g_force"] = g_force

            # === ENVIRONMENT DATA ===
            oat_c = to_float(safe_get(aq, "AMBIENT TEMPERATURE", "celsius"), None)
            tat_c = to_float(safe_get(aq, "TOTAL AIR TEMPERATURE", "celsius"), None)
            baro_mb = to_float(safe_get(aq, "KOHLSMAN SETTING MB", "millibars"), None)
            wind_speed_kts = to_float(safe_get(aq, "AMBIENT WIND VELOCITY", "knots"), None)
            wind_gust_kts = to_float(safe_get(aq, "AMBIENT WIND GUST", "knots"), None)
            wind_direction = to_float(safe_get(aq, "AMBIENT WIND DIRECTION", "degrees"), None)
            precip_state = to_float(safe_get(aq, "AMBIENT PRECIP STATE", "mask"), None)
            precip_rate = to_float(safe_get(aq, "AMBIENT PRECIP RATE", "millimeters of water"), None)
            ground_elev_m = to_float(safe_get(aq, "GROUND ALTITUDE", "meters"), None)
            ground_elev_ft = ground_elev_m * 3.28084 if ground_elev_m is not None else None
            total_weight_lbs = to_float(safe_get(aq, "TOTAL WEIGHT", "pounds"), None)
            total_weight_kg = total_weight_lbs * 0.453592 if total_weight_lbs is not None else None
            rain_intensity = None
            if precip_rate is not None and precip_rate > 0:
                rain_intensity = precip_rate if precip_rate <= 1.0 else min(1.0, max(0.0, precip_rate / 4.0))
            if rain_intensity is None and precip_state is not None:
                try:
                    if (int(precip_state) & 4) == 4:
                        gust_spread = 0.0
                        if wind_gust_kts is not None and wind_speed_kts is not None:
                            gust_spread = max(0.0, wind_gust_kts - wind_speed_kts)
                        wind_based = min(1.0, 0.08 + ((wind_speed_kts or 0.0) / 85.0))
                        gust_based = min(1.0, 0.10 + (gust_spread / 35.0))
                        rain_intensity = max(0.10, wind_based, gust_based)
                except Exception:
                    pass

            gust_spread = 0.0
            if wind_gust_kts is not None and wind_speed_kts is not None:
                gust_spread = max(0.0, wind_gust_kts - wind_speed_kts)
            turbulence = max(
                min(1.0, max(0.0, (abs(g_force - 1.0) - 0.03) * 3.5)),
                min(1.0, abs(vertical_speed) / 1600.0),
                min(1.0, gust_spread / 22.0),
                min(1.0, (wind_speed_kts or 0.0) / 90.0) * 0.45,
                min(1.0, (rain_intensity or 0.0) * 0.55)
            )
            rain_detected = (rain_intensity is not None and rain_intensity > 0.01)
            if not rain_detected and precip_state is not None:
                try:
                    rain_detected = (int(precip_state) & 4) == 4
                except Exception:
                    rain_detected = False

            bridge_position_samples = [
                {
                    "lat": float(s.get("lat")),
                    "lon": float(s.get("lon")),
                    "alt": float(s.get("alt", 0.0)),
                    "spd": float(s.get("spd", 0.0)),
                    "vs": float(s.get("vs", 0.0)),
                    "g": float(s.get("g", 1.0)),
                    "on_ground": bool(s.get("on_ground", False)),
                    "t": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(float(s.get("t", now_epoch)))),
                }
                for s in state["sample_buffer"]
                if s.get("lat") is not None and s.get("lon") is not None
            ][-60:]

            payload = {
                "simulator": args.sim,
                "altitude": altitude,
                "speed": speed,
                "ias": ias,
                "vertical_speed": vertical_speed,
                "heading": heading,
                "pitch": pitch,
                "g_force": g_force,
                "max_g_force": state["max_g_force"],
                "g_force_window_peak": state["window_peak_g"],
                "vertical_speed_window_min": state["window_min_vs"],
                "bridge_sample_interval_ms": int(SAMPLE_INTERVAL * 1000),
                "bridge_post_interval_ms": int(LOOP_INTERVAL * 1000),
                "latitude": latitude,
                "longitude": longitude,
                "on_ground": on_ground,
                "parking_brake": parking_brake,
                "engine1_running": engine1_running,
                "engine2_running": engine2_running,
                "engines_running": engine1_running or engine2_running,
                "engine_load_pct": avg_engine_load_pct,
                "engine1_load_pct": throttle1_pct,
                "engine2_load_pct": throttle2_pct,
                "gear_down": gear_down,
                "flap_ratio": flap_ratio,
                "speedbrake": speedbrake_pos,
                "fuel_percentage": fuel_percentage,
                "fuel_kg": fuel_kg,
                "fuel_flow_total_kgph": fuel_flow_total_kgph,
                "fuel_flow_total_lph": fuel_flow_total_lph,
                "fuel_flow_total_pph": fuel_flow_total_pph if fuel_flow_total_pph > 0.0 else (fuel_flow_total_kgph / 0.45359237 if fuel_flow_total_kgph > 0.0 else 0.0),
                "engine1_fuel_flow_pph": fuel_flow_eng1_pph,
                "engine2_fuel_flow_pph": fuel_flow_eng2_pph,
                "fuel_flow_source": fuel_flow_source,
                "touchdown_vspeed": state["touchdown_vspeed"],
                "landing_vs": state["touchdown_vspeed"],
                "landing_g_force": state["landing_g_force"],
                "bridge_local_landing_locked": state["landing_locked_local"],
                "landing_data_source": "bridge_local",
                "landing_data_timestamp": state["landing_data_timestamp"],
                "touchdown_detected": state["landing_locked_local"],
                "was_airborne": state["was_airborne"],
                "tailstrike": state["event_tailstrike"],
                "stall": state["event_stall"] or is_stalling_now,
                "is_in_stall": state["event_stall"] or is_stalling_now,
                "stall_warning": stall_warning or state["event_stall"],
                "override_alpha": False,
                "overstress": state["event_overstress"],
                "overspeed": state["event_overspeed"] or overspeed_warning,
                "flaps_overspeed": state["event_flaps_overspeed"],
                "fuel_emergency": fuel_percentage < 3.0,
                "gear_up_landing": state["event_gear_up_landing"],
                "crash": state["event_crash"],
                "has_crashed": state["event_crash"],
                "harsh_controls": state["event_harsh_controls"],
                "bridge_event_log": state["event_queue"][-MAX_EVENT_QUEUE:],
                "bridge_position_samples": bridge_position_samples,
                "aircraft_icao": aircraft_icao,
                "oat_c": oat_c,
                "tat_c": tat_c,
                "tat": tat_c,
                "baro_setting": baro_mb,
                "wind_speed_kts": wind_speed_kts,
                "wind_gust_kts": wind_gust_kts,
                "wind_direction": wind_direction,
                "precip_state": int(precip_state) if precip_state is not None else None,
                "ambient_precip_state": int(precip_state) if precip_state is not None else None,
                "precip_rate": precip_rate,
                "ambient_precip_rate": precip_rate,
                "rain_intensity": rain_intensity,
                "rain_detected": rain_detected,
                "precipitation": rain_intensity,
                "turbulence": turbulence,
                "turbulence_intensity": turbulence,
                "ground_elevation_ft": ground_elev_ft,
                "total_weight_kg": total_weight_kg,
            }

            # Debug output every 30 seconds
            if not hasattr(main, '_last_debug') or (time.time() - main._last_debug) > 30:
                main._last_debug = time.time()
                events_str = []
                if state["event_stall"]: events_str.append("STALL")
                if state["event_overspeed"]: events_str.append("OVERSPEED")
                if state["event_overstress"]: events_str.append("OVERSTRESS")
                if state["event_tailstrike"]: events_str.append("TAILSTRIKE")
                if state["event_flaps_overspeed"]: events_str.append("FLAPS_OVSPD")
                if state["event_gear_up_landing"]: events_str.append("GEAR_UP_LDG")
                if state["event_crash"]: events_str.append("CRASH")
                if state["event_harsh_controls"]: events_str.append("HARSH_CTRL")
                ev_display = ", ".join(events_str) if events_str else "NONE"
                eng_label = "JET" if is_jet_engine else "PISTON"
                gear_str = f"L={gear_left:.2f} C={gear_center:.2f} R={gear_right:.2f}"
                print(f"[SkyCareer] ICAO={aircraft_icao} ENG={eng_label} GEAR=[{gear_str}] FLAPS={flap_ratio:.2f}")
                print(f"[SkyCareer] ENV: OAT={oat_c}C QNH={baro_mb}mb WIND={wind_direction}/{wind_speed_kts}kt ELEV={ground_elev_ft}ft GWT={total_weight_kg}kg")
                print(f"[SkyCareer] EVENTS: {ev_display} | G={g_force:.2f} MaxG={state['max_g_force']:.2f} AoA={incidence_alpha:.1f} Pitch={pitch:.1f} IAS={ias:.0f}")

            now = time.time()
            if now >= next_post_at:
                try:
                    resp = post_payload(payload)
                    if resp.status_code >= 400:
                        print(f"[SkyCareer] API error {resp.status_code}: {resp.text[:200]}")
                    else:
                        resp_json = None
                        try:
                            resp_json = resp.json()
                        except Exception:
                            resp_json = None

                        current_flight_id = str((resp_json or {}).get("flight_id") or "").strip()
                        if current_flight_id:
                            if last_seen_flight_id is None:
                                last_seen_flight_id = current_flight_id
                            elif current_flight_id != last_seen_flight_id:
                                last_seen_flight_id = current_flight_id
                                raise RuntimeError(f"Active flight changed -> worker restart ({current_flight_id})")

                        # Reset per-post peak window only after a successful send.
                        state["window_peak_g"] = g_force
                        state["window_min_vs"] = min(0.0, vertical_speed)
                        state["event_queue"] = []
                        consecutive_post_timeouts = 0
                        last_successful_post_at = now
                except requests.exceptions.Timeout:
                    consecutive_post_timeouts += 1
                    print(f"[SkyCareer] POST timeout ({consecutive_post_timeouts}/{MAX_CONSECUTIVE_POST_TIMEOUTS})")
                    if should_restart_worker_on_timeouts(consecutive_post_timeouts, last_successful_post_at, now):
                        raise RuntimeError("Bridge POST timeout watchdog triggered")
                except requests.RequestException as req_err:
                    print(f"[SkyCareer] POST request error: {req_err}")
                next_post_at = now + LOOP_INTERVAL

            time.sleep(SAMPLE_INTERVAL)

        except KeyboardInterrupt:
            print("\\n[SkyCareer] Stopped by user.")
            break
        except Exception as ex:
            worker_restart_count += 1
            print(f"[SkyCareer] Bridge worker restart #{worker_restart_count}: {ex}")
            traceback.print_exc()
            sm = None
            aq = None
            state = reset_flight_state()
            prev_on_ground = True
            prev_vs = 0.0
            last_seen_flight_id = None
            consecutive_post_timeouts = 0
            last_successful_post_at = time.time()
            next_post_at = 0.0
            time.sleep(WORKER_RESTART_BACKOFF_S)

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
