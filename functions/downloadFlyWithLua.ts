import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const apiEndpoint = url.searchParams.get('endpoint') || 'https://aero-career-pilot.base44.app/api/receiveXPlaneData';
    
    // Get company info
    const companies = await base44.entities.Company.list();
    const company = companies[0];
    
    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    // Create complete FlyWithLua script from pastebin
    const luaScript = `-- =========================================================
-- SkyCareer PRO Complete Monitoring System
-- X-Plane 12 / FlyWithLua (Mac + Windows)
-- =========================================================

----------------------------
-- CONFIG
----------------------------
local API_ENDPOINT = "${apiEndpoint}"
local COMPANY_ID = "${company.id}"
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
-- DATAREFS (XP12 kompatibel)
----------------------------
dataref("sim_time", "sim/time/total_running_time_sec")
dataref("gear_on_ground", "sim/aircraft/ground_collision")
dataref("park_brake", "sim/flightmodel/controls/parkbrake")
dataref("engine1_running", "sim/flightmodel/engine/ENGN_running[0]")
dataref("engine2_running", "sim/flightmodel/engine/ENGN_running[1]")
dataref("flap_ratio", "sim/flightmodel/controls/flaprat")
dataref("stall_warning", "sim/cockpit2/alerts/stall_warning")
dataref("total_fuel", "sim/aircraft/weight/acf_m_fuel_tot")
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

    local command

    if SYSTEM == "IBM" then
        command = 'curl -X POST "' .. API_ENDPOINT .. '" -H "Content-Type: application/json" -d "' .. json_payload .. '" --max-time 3 --silent'
    else
        command = 'curl -X POST "' .. API_ENDPOINT .. '" -H "Content-Type: application/json" -d \\'' .. json_payload .. '\\' --max-time 3 --silent'
    end

    os.execute(command)
end

------------------------------------------------------------
-- MAIN MONITOR
------------------------------------------------------------
function monitor_flight()

    if sim_time - last_update < UPDATE_INTERVAL then
        return
    end

    last_update = sim_time

    local altitude = get("sim/flightmodel/position/elevation") * 3.28084
    local speed = get("sim/flightmodel/position/groundspeed") * 1.94384
    local vs = get("sim/flightmodel/position/vh_ind") * 196.85
    local heading = get("sim/flightmodel/position/psi")
    local g_force = get("sim/flightmodel/forces/g_load")
    local latitude = get("sim/flightmodel/position/latitude")
    local longitude = get("sim/flightmodel/position/longitude")

    local fuel_max = get("sim/aircraft/weight/acf_m_fuel_tot")
    local fuel_percentage = (total_fuel / fuel_max * 100)

    local on_ground = (gear_on_ground == 1)

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

    if not flight_started then
        return
    end

    ---------------- EVENT DETECTION ----------------
    if pitch > 10 and on_ground then
        tailstrike_detected = true
    end

    if stall_warning == 1 then
        stall_detected = true
    end

    if g_force > 2.5 or g_force < -1.0 then
        overstress_detected = true
    end

    if flap_ratio > 0 and speed > 200 then
        flaps_overspeed = true
    end

    if total_fuel < 300 then
        fuel_emergency = true
    end

    if g_force > 3.5 then
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
        .. '"company_id":"' .. COMPANY_ID .. '",'
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
        .. '"engine1_running":' .. tostring(engine1_running == 1) .. ","
        .. '"engine2_running":' .. tostring(engine2_running == 1) .. ","
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