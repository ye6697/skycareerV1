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

    // Create complete FlyWithLua script with CORRECT XP12 DataRefs
    const luaScript = `-- =========================================================
-- SkyCareer PRO Complete Monitoring System
-- X-Plane 12 / FlyWithLua (Mac + Windows)
-- =========================================================

----------------------------
-- CONFIG
----------------------------
local API_ENDPOINT = "${apiEndpoint}"
local API_KEY = "${apiKey}"
local UPDATE_INTERVAL = 1.0

----------------------------
-- STATE VARIABLES
----------------------------
local last_update = 0
local flight_started = false
local flight_landed = false
local last_on_ground = true

local max_g_force = 0
local touchdown_vspeed = 0
local landing_g_force = 0
local landing_quality = "NONE"

local flight_score = 100
local maintenance_cost = 0
local reputation = "EXCELLENT"

local tailstrike_detected = false
local stall_detected = false
local overstress_detected = false
local flaps_overspeed = false
local fuel_emergency = false
local gear_up_landing = false
local crash_detected = false

----------------------------
-- DATAREFS (XP12 CORRECTED)
----------------------------
dataref("onground", "sim/flightmodel/failures/onground_any")
dataref("park_brake", "sim/flightmodel/controls/parkbrake")
dataref("flap_ratio", "sim/flightmodel/controls/flaprat")
dataref("pitch", "sim/flightmodel/position/theta")
dataref("gear_handle", "sim/cockpit2/controls/gear_handle_down")

------------------------------------------------------------
-- LANDING CLASSIFICATION
------------------------------------------------------------
function classify_landing(g_force, vspeed)
    if g_force < 1.4 and vspeed > -200 then
        return "SOFT"
    elseif g_force < 1.8 then
        return "MEDIUM"
    else
        return "HARD"
    end
end

------------------------------------------------------------
-- HTTP SEND
------------------------------------------------------------
function send_flight_data(json_payload)
    -- Escape quotes in JSON payload
    local escaped_json = json_payload:gsub('"', '\\"')

    local command

    if SYSTEM == "IBM" then
        -- Windows
        command = 'curl -X POST "' .. API_ENDPOINT .. '?api_key=' .. API_KEY .. '" -H "Content-Type: application/json" -d "' .. escaped_json .. '" --max-time 3 --silent'
    else
        -- Mac/Linux
        command = "curl -X POST '" .. API_ENDPOINT .. "?api_key=" .. API_KEY .. "' -H 'Content-Type: application/json' -d '" .. json_payload .. "' --max-time 3 --silent"
    end

    logMsg("SkyCareer: Executing command: " .. command)
    local result = os.execute(command)
    logMsg("SkyCareer: Command result: " .. tostring(result))
end

------------------------------------------------------------
-- MAIN MONITOR
------------------------------------------------------------
function monitor_flight()
    local current_time = get("sim/time/total_running_time_sec")
    if not current_time then
        return
    end

    if current_time - last_update < UPDATE_INTERVAL then
        return
    end

    last_update = current_time

    -- Safe DataRef reads with fallbacks
    local altitude = (get("sim/flightmodel/position/elevation") or 0) * 3.28084
    local speed = (get("sim/flightmodel/position/groundspeed") or 0) * 1.94384
    local vs = (get("sim/flightmodel/position/vh_ind") or 0) * 196.85
    local heading = get("sim/flightmodel/position/psi") or 0
    local g_force = get("sim/flightmodel2/misc/gforce_normal") or 1.0
    local latitude = get("sim/flightmodel/position/latitude") or 0
    local longitude = get("sim/flightmodel/position/longitude") or 0
    local total_fuel_current = get("sim/flightmodel/weight/m_fuel_total") or 0
    local fuel_max = get("sim/aircraft/weight/acf_m_fuel_tot") or 1000
    
    local fuel_percentage = 100
    if fuel_max > 0 and total_fuel_current > 0 then
        fuel_percentage = (total_fuel_current / fuel_max * 100)
    end

    local on_ground = (onground == 1)

    -- Simplified engine detection using multiple methods
    local throttle1 = get("sim/cockpit2/engine/actuators/throttle_ratio[0]") or 0
    local throttle2 = get("sim/cockpit2/engine/actuators/throttle_ratio[1]") or 0
    local engine_running_1 = get("sim/flightmodel/engine/ENGN_running[0]") or 0
    local engine_running_2 = get("sim/flightmodel/engine/ENGN_running[1]") or 0
    
    local engine1_running = (throttle1 > 0.05 or engine_running_1 > 0)
    local engine2_running = (throttle2 > 0.05 or engine_running_2 > 0)

    if g_force > max_g_force then
        max_g_force = g_force
    end

    ---------------- TAKEOFF ----------------
    if last_on_ground and not on_ground then
        flight_started = true
        flight_landed = false
        max_g_force = 0
        flight_score = 100
        maintenance_cost = 0
        tailstrike_detected = false
        stall_detected = false
        overstress_detected = false
        flaps_overspeed = false
        fuel_emergency = false
        gear_up_landing = false
        crash_detected = false
    end

    ---------------- LANDING ----------------
    if not last_on_ground and on_ground and flight_started and not flight_landed then
        touchdown_vspeed = vs
        landing_g_force = g_force
        flight_landed = true

        landing_quality = classify_landing(landing_g_force, touchdown_vspeed)

        if landing_quality == "MEDIUM" then
            flight_score = flight_score - 5
        elseif landing_quality == "HARD" then
            flight_score = flight_score - 15
            maintenance_cost = maintenance_cost + 5000
        end

        if gear_handle == 0 then
            gear_up_landing = true
            flight_score = flight_score - 40
            maintenance_cost = maintenance_cost + 30000
        end
    end

    last_on_ground = on_ground

    ---------------- EVENT DETECTION ----------------
    if pitch and pitch > 10 and on_ground then
        tailstrike_detected = true
    end

    -- Stall detection via low airspeed at high altitude
    local ias = get("sim/flightmodel/position/indicated_airspeed") or 0
    if ias and altitude > 500 and ias < 80 and not on_ground then
        stall_detected = true
    end

    if g_force and (g_force > 2.5 or g_force < -1.0) then
        overstress_detected = true
    end

    if flap_ratio and flap_ratio > 0 and speed > 200 then
        flaps_overspeed = true
    end

    if total_fuel and total_fuel < 300 then
        fuel_emergency = true
    end

    if g_force and g_force > 3.5 then
        crash_detected = true
    end

    ---------------- SCORE PENALTIES ----------------
    if tailstrike_detected then
        flight_score = flight_score - 25
        maintenance_cost = maintenance_cost + 25000
    end

    if stall_detected then
        flight_score = flight_score - 20
    end

    if overstress_detected then
        flight_score = flight_score - 20
        maintenance_cost = maintenance_cost + 15000
    end

    if flaps_overspeed then
        flight_score = flight_score - 10
    end

    if fuel_emergency then
        flight_score = flight_score - 15
    end

    if crash_detected then
        flight_score = flight_score - 80
        maintenance_cost = maintenance_cost + 100000
    end

    if flight_score < 0 then
        flight_score = 0
    end

    ---------------- REPUTATION ----------------
    if flight_score >= 95 then
        reputation = "EXCELLENT"
    elseif flight_score >= 85 then
        reputation = "VERY_GOOD"
    elseif flight_score >= 70 then
        reputation = "ACCEPTABLE"
    elseif flight_score >= 50 then
        reputation = "POOR"
    else
        reputation = "UNSAFE"
    end

    ---------------- JSON ----------------
    local json_payload =
        "{"
        .. '"altitude":' .. string.format("%.1f", altitude) .. ","
        .. '"speed":' .. string.format("%.1f", speed) .. ","
        .. '"vertical_speed":' .. string.format("%.1f", vs) .. ","
        .. '"heading":' .. string.format("%.1f", heading) .. ","
        .. '"fuel_percentage":' .. string.format("%.1f", fuel_percentage) .. ","
        .. '"g_force":' .. string.format("%.2f", g_force) .. ","
        .. '"max_g_force":' .. string.format("%.2f", max_g_force) .. ","
        .. '"touchdown_vspeed":' .. string.format("%.1f", touchdown_vspeed) .. ","
        .. '"landing_g_force":' .. string.format("%.2f", landing_g_force) .. ","
        .. '"landing_quality":"' .. landing_quality .. '",'
        .. '"latitude":' .. latitude .. ","
        .. '"longitude":' .. longitude .. ","
        .. '"on_ground":' .. tostring(on_ground) .. ","
        .. '"park_brake":' .. tostring(park_brake > 0.5) .. ","
        .. '"engine1_running":' .. tostring(engine1_running) .. ","
        .. '"engine2_running":' .. tostring(engine2_running) .. ","
        .. '"tailstrike":' .. tostring(tailstrike_detected) .. ","
        .. '"stall":' .. tostring(stall_detected) .. ","
        .. '"overstress":' .. tostring(overstress_detected) .. ","
        .. '"flaps_overspeed":' .. tostring(flaps_overspeed) .. ","
        .. '"fuel_emergency":' .. tostring(fuel_emergency) .. ","
        .. '"gear_up_landing":' .. tostring(gear_up_landing) .. ","
        .. '"crash":' .. tostring(crash_detected) .. ","
        .. '"flight_score":' .. flight_score .. ","
        .. '"maintenance_cost":' .. maintenance_cost .. ","
        .. '"reputation":"' .. reputation .. '"'
        .. "}"

    -- Debug output to X-Plane log (shows what we're sending)
    logMsg("SkyCareer: Alt=" .. string.format("%.0f", altitude) .. "ft Speed=" .. string.format("%.0f", speed) .. "kts Ground=" .. tostring(on_ground))
    logMsg("SkyCareer: JSON=" .. json_payload)
    
    send_flight_data(json_payload)
end

do_every_frame("monitor_flight()")

logMsg("SkyCareer PRO Complete System Loaded (XP12)")
`;
    
    return new Response(luaScript, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="SkyCareer.lua"'
      }
    });

  } catch (error) {
    console.error('Error generating FlyWithLua script:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});