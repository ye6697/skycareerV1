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

    // Create complete FlyWithLua script with CORRECT XP12 DataRefs
    const luaScript = `-- =========================================================
-- SkyCareer V1 - Complete Flight Monitoring System
-- X-Plane 12 / FlyWithLua (Mac + Windows)
-- =========================================================

----------------------------
-- CONFIG
----------------------------
local API_ENDPOINT = "${apiEndpoint}"
local API_KEY = "${apiKey}"

----------------------------
-- STATE VARIABLES
----------------------------
local flight_started = false
local flight_landed = false
local last_on_ground = true

local max_g_force = 0
local touchdown_vspeed = 0
local landing_g_force = 0
local landing_quality = "NONE"

-- Event flags (set once, never accumulate)
local tailstrike_detected = false
local stall_detected = false
local overstress_detected = false
local overspeed_detected = false
local flaps_overspeed_detected = false
local fuel_emergency_detected = false
local gear_up_landing_detected = false
local crash_detected = false

----------------------------
-- FAILURE SYSTEM
----------------------------
local maintenance_ratio = 0.0
local last_failure_check = 0
local failure_check_interval = 30.0
local active_failures = {}

-- Failure definitions: {dataref, name, category}
local light_failures = {
    {"sim/operation/failures/rel_lites_nav", "Navigationslichter", "electrical"},
    {"sim/operation/failures/rel_lites_land", "Landelichter", "electrical"},
    {"sim/operation/failures/rel_lites_taxi", "Taxilichter", "electrical"},
    {"sim/operation/failures/rel_lites_strobe", "Blitzlichter", "electrical"},
    {"sim/operation/failures/rel_lites_beac", "Beacon-Lichter", "electrical"},
    {"sim/operation/failures/rel_lites_ins", "Instrumentenbeleuchtung", "avionics"},
    {"sim/operation/failures/rel_pitot", "Pitotrohr", "avionics"},
    {"sim/operation/failures/rel_static", "Statikport", "avionics"},
    {"sim/operation/failures/rel_apts0", "Transponder", "avionics"},
}
local medium_failures = {
    {"sim/operation/failures/rel_genera0", "Generator 1", "electrical"},
    {"sim/operation/failures/rel_genera1", "Generator 2", "electrical"},
    {"sim/operation/failures/rel_hydpmp", "Hydraulikpumpe 1", "hydraulics"},
    {"sim/operation/failures/rel_hydpmp2", "Hydraulikpumpe 2", "hydraulics"},
    {"sim/operation/failures/rel_batter0", "Batterie 1", "electrical"},
    {"sim/operation/failures/rel_fc_rud_L", "Seitenruder links", "flight_controls"},
    {"sim/operation/failures/rel_fc_ail_L", "Querruder links", "flight_controls"},
    {"sim/operation/failures/rel_otto", "Autopilot Computer", "avionics"},
    {"sim/operation/failures/rel_auto_servos", "Autopilot Servos", "avionics"},
    {"sim/operation/failures/rel_smoke_cpit", "Rauch im Cockpit", "pressurization"},
    {"sim/operation/failures/rel_vacpmp", "Vakuumpumpe", "engine"},
    {"sim/operation/failures/rel_stbaug", "Stabilisierung", "flight_controls"},
}
local severe_failures = {
    {"sim/operation/failures/rel_engfai0", "Triebwerk 1 Ausfall", "engine"},
    {"sim/operation/failures/rel_engfai1", "Triebwerk 2 Ausfall", "engine"},
    {"sim/operation/failures/rel_engfir0", "Triebwerk 1 Feuer", "engine"},
    {"sim/operation/failures/rel_esys", "Elektrisches System", "electrical"},
    {"sim/operation/failures/rel_depres_fast", "Schnelle Dekompression", "pressurization"},
}

------------------------------------------------------------
-- FAILURE SYSTEM FUNCTIONS
------------------------------------------------------------
function check_failures()
    local current_time = os.clock()
    if current_time - last_failure_check < failure_check_interval then return end
    last_failure_check = current_time
    
    if maintenance_ratio <= 0 then return end
    
    local base_chance = maintenance_ratio * maintenance_ratio * 0.20
    if math.random() > base_chance then return end
    
    local severity_roll = math.random()
    local failure_pool
    local severity
    
    if maintenance_ratio < 0.3 then
        failure_pool = light_failures
        severity = "leicht"
    elseif maintenance_ratio < 0.6 then
        if severity_roll < 0.7 then failure_pool = light_failures; severity = "leicht"
        else failure_pool = medium_failures; severity = "mittel" end
    elseif maintenance_ratio < 0.85 then
        if severity_roll < 0.4 then failure_pool = light_failures; severity = "leicht"
        elseif severity_roll < 0.85 then failure_pool = medium_failures; severity = "mittel"
        else failure_pool = severe_failures; severity = "schwer" end
    else
        if severity_roll < 0.2 then failure_pool = light_failures; severity = "leicht"
        elseif severity_roll < 0.55 then failure_pool = medium_failures; severity = "mittel"
        else failure_pool = severe_failures; severity = "schwer" end
    end
    
    -- Pick random failure not already active
    local available = {}
    for _, f in ipairs(failure_pool) do
        local already_active = false
        for _, af in ipairs(active_failures) do
            if af[1] == f[1] then already_active = true; break end
        end
        if not already_active then table.insert(available, f) end
    end
    if #available == 0 then return end
    
    local chosen = available[math.random(#available)]
    set(chosen[1], 6)  -- 6 = inoperative
    table.insert(active_failures, chosen)
end

function reset_all_failures()
    for _, f in ipairs(active_failures) do
        set(f[1], 0)  -- 0 = working
    end
    active_failures = {}
end

function get_active_failures_json()
    if #active_failures == 0 then return "[]" end
    local parts = {}
    for _, f in ipairs(active_failures) do
        local severity = "leicht"
        for _, sf in ipairs(severe_failures) do if sf[1] == f[1] then severity = "schwer"; break end end
        if severity == "leicht" then
            for _, mf in ipairs(medium_failures) do if mf[1] == f[1] then severity = "mittel"; break end end
        end
        table.insert(parts, '{"name":"' .. f[2] .. '","severity":"' .. severity .. '","category":"' .. f[3] .. '"}')
    end
    return "[" .. table.concat(parts, ",") .. "]"
end

------------------------------------------------------------
-- HTTP SEND (ULTRA SAFE with pcall)
------------------------------------------------------------
function send_flight_data(json_payload)
    local success, error_msg = pcall(function()
        -- Write response to temp file to read maintenance_ratio
        local tmpfile
        if SYSTEM == "IBM" then
            tmpfile = os.getenv("TEMP") .. "\\\\skycareer_resp.txt"
            os.execute('start /MIN cmd /c curl -X POST "' .. API_ENDPOINT .. '?api_key=' .. API_KEY .. '" -H "Content-Type: application/json" -d "' .. json_payload:gsub('"', '\\\\"') .. '" -m 2 --silent -o "' .. tmpfile .. '" 2>nul')
        else
            tmpfile = "/tmp/skycareer_resp.txt"
            os.execute("curl -X POST '" .. API_ENDPOINT .. "?api_key=" .. API_KEY .. "' -H 'Content-Type: application/json' -d '" .. json_payload .. "' -m 2 --silent -o '" .. tmpfile .. "' 2>/dev/null &")
        end
        
        -- Try to read response and extract maintenance_ratio
        local f = io.open(tmpfile, "r")
        if f then
            local resp = f:read("*all")
            f:close()
            if resp then
                local mr = resp:match('"maintenance_ratio":([%d%.]+)')
                if mr then
                    maintenance_ratio = tonumber(mr) or 0
                end
                -- Check if flight completed -> reset failures
                if resp:match('"status":"completed"') or resp:match('"status":"ready_to_complete"') then
                    reset_all_failures()
                    maintenance_ratio = 0
                    flight_started = false
                end
            end
        end
    end)
end

------------------------------------------------------------
-- MAIN MONITOR
------------------------------------------------------------
function monitor_flight()
    -- Core flight data
    local altitude = (get("sim/flightmodel/position/elevation") or 0) * 3.28084
    local speed = (get("sim/flightmodel/position/groundspeed") or 0) * 1.94384
    local ias = get("sim/flightmodel/position/indicated_airspeed") or 0
    local vs = (get("sim/flightmodel/position/vh_ind") or 0) * 196.85
    local heading = get("sim/flightmodel/position/psi") or 0
    local g_force = get("sim/flightmodel2/misc/gforce_normal") or 1.0
    local latitude = get("sim/flightmodel/position/latitude") or 0
    local longitude = get("sim/flightmodel/position/longitude") or 0

    -- Fuel
    local total_fuel_kg = get("sim/flightmodel/weight/m_fuel_total") or 0
    local fuel_max = get("sim/aircraft/weight/acf_m_fuel_tot") or 1000
    local fuel_percentage = 100
    if fuel_max > 0 and total_fuel_kg > 0 then
        fuel_percentage = (total_fuel_kg / fuel_max) * 100
    end

    -- On ground
    local on_ground_raw = get("sim/flightmodel/failures/onground_any")
    local on_ground = false
    if on_ground_raw ~= nil then
        if type(on_ground_raw) == "number" then on_ground = (on_ground_raw == 1)
        elseif type(on_ground_raw) == "boolean" then on_ground = on_ground_raw end
    end

    -- Parking brake
    local park_brake_raw = get("sim/flightmodel/controls/parkbrake") or 0
    local park_brake = false
    if type(park_brake_raw) == "number" then park_brake = (park_brake_raw > 0.5)
    elseif type(park_brake_raw) == "boolean" then park_brake = park_brake_raw end

    -- Engine status
    local throttle_1 = get("sim/cockpit2/engine/actuators/throttle_ratio_all") or 0
    local engine1_running = (throttle_1 > 0.01)
    local engine2_running = engine1_running

    -- Gear status
    local gear_handle = get("sim/cockpit2/controls/gear_handle_down")
    local gear_down = true
    if gear_handle ~= nil then
        if type(gear_handle) == "number" then gear_down = (gear_handle > 0.5) end
    end

    -- Flap ratio
    local flap_ratio = get("sim/flightmodel/controls/flaprat") or 0

    -- Pitch for tailstrike
    local pitch = get("sim/flightmodel/position/theta") or 0

    -- Crash detection
    local has_crashed_raw = get("sim/flightmodel2/misc/has_crashed")
    local has_crashed = false
    if has_crashed_raw ~= nil then
        if type(has_crashed_raw) == "number" then has_crashed = (has_crashed_raw == 1)
        elseif type(has_crashed_raw) == "boolean" then has_crashed = has_crashed_raw end
    end

    -- Overspeed
    local vne = get("sim/aircraft/view/acf_Vne") or 999
    local is_overspeed = (ias > vne * 0.95)

    -- Track max G
    if g_force > max_g_force then max_g_force = g_force end

    ---------------- TAKEOFF ----------------
    if last_on_ground and not on_ground then
        flight_started = true
        flight_landed = false
        max_g_force = g_force
        touchdown_vspeed = 0
        landing_g_force = 0
        landing_quality = "NONE"
        tailstrike_detected = false
        stall_detected = false
        overstress_detected = false
        overspeed_detected = false
        flaps_overspeed_detected = false
        fuel_emergency_detected = false
        gear_up_landing_detected = false
        crash_detected = false
        reset_all_failures()
        maintenance_ratio = 0.0
    end

    ---------------- LANDING ----------------
    if not last_on_ground and on_ground and flight_started and not flight_landed then
        touchdown_vspeed = vs
        landing_g_force = g_force
        flight_landed = true

        if not gear_down then
            gear_up_landing_detected = true
        end
    end

    last_on_ground = on_ground

    ---------------- EVENT DETECTION (flags only, no score calc) ----------------
    if pitch > 10 and on_ground and flight_started then tailstrike_detected = true end
    if altitude > 500 and ias < 80 and not on_ground and flight_started then stall_detected = true end
    if (g_force > 2.5 or g_force < -1.0) and flight_started then overstress_detected = true end
    if is_overspeed and flight_started then overspeed_detected = true end
    if flap_ratio > 0 and speed > 200 and flight_started then flaps_overspeed_detected = true end
    if total_fuel_kg < 300 and flight_started then fuel_emergency_detected = true end
    if has_crashed and flight_started then crash_detected = true end

    ---------------- CONSTRUCT JSON ----------------
    -- NOTE: Score calculation is done entirely on the frontend (FlightTracker).
    -- The plugin only sends raw data and boolean event flags.
    local json_payload =
        "{"
        .. '"altitude":' .. string.format("%.1f", altitude) .. ","
        .. '"speed":' .. string.format("%.1f", speed) .. ","
        .. '"vertical_speed":' .. string.format("%.1f", vs) .. ","
        .. '"heading":' .. string.format("%.1f", heading) .. ","
        .. '"fuel_percentage":' .. string.format("%.1f", fuel_percentage) .. ","
        .. '"fuel_kg":' .. string.format("%.1f", total_fuel_kg) .. ","
        .. '"g_force":' .. string.format("%.2f", g_force) .. ","
        .. '"max_g_force":' .. string.format("%.2f", max_g_force) .. ","
        .. '"touchdown_vspeed":' .. string.format("%.1f", touchdown_vspeed) .. ","
        .. '"landing_g_force":' .. string.format("%.2f", landing_g_force) .. ","
        .. '"latitude":' .. string.format("%.6f", latitude) .. ","
        .. '"longitude":' .. string.format("%.6f", longitude) .. ","
        .. '"on_ground":' .. tostring(on_ground) .. ","
        .. '"park_brake":' .. tostring(park_brake) .. ","
        .. '"engine1_running":' .. tostring(engine1_running) .. ","
        .. '"engine2_running":' .. tostring(engine2_running) .. ","
        .. '"gear_down":' .. tostring(gear_down) .. ","
        .. '"flap_ratio":' .. string.format("%.2f", flap_ratio) .. ","
        .. '"pitch":' .. string.format("%.1f", pitch) .. ","
        .. '"ias":' .. string.format("%.1f", ias) .. ","
        .. '"tailstrike":' .. tostring(tailstrike_detected) .. ","
        .. '"stall":' .. tostring(stall_detected) .. ","
        .. '"overstress":' .. tostring(overstress_detected) .. ","
        .. '"overspeed":' .. tostring(overspeed_detected) .. ","
        .. '"flaps_overspeed":' .. tostring(flaps_overspeed_detected) .. ","
        .. '"fuel_emergency":' .. tostring(fuel_emergency_detected) .. ","
        .. '"gear_up_landing":' .. tostring(gear_up_landing_detected) .. ","
        .. '"crash":' .. tostring(crash_detected) .. ","
        .. '"has_crashed":' .. tostring(has_crashed) .. ","
        .. '"active_failures":' .. get_active_failures_json()
        .. "}"

    send_flight_data(json_payload)
    
    -- Check for failures during flight
    if flight_started and not on_ground then
        check_failures()
    end
end

-- Send data every 2 seconds
local last_send_time = 0
function flight_loop_callback()
    local current_time = os.clock()
    if current_time - last_send_time >= 2.0 then
        last_send_time = current_time
        monitor_flight()
    end
end

do_every_frame("flight_loop_callback()")
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