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

    // Create FlyWithLua script
    const luaScript = `-- SkyCareer X-Plane 12 Integration
-- FlyWithLua Script für automatische Flugdatenübertragung

-- Konfiguration
local API_ENDPOINT = "${apiEndpoint}"
local COMPANY_ID = "${company.id}"
local UPDATE_INTERVAL = 1.0  -- Sekunden
local last_update = 0
local flight_started = false
local last_on_ground = true

-- Hilfsfunktion zum JSON-Kodieren
function encode_json(t)
    local function escape_string(s)
        s = string.gsub(s, '\\\\', '\\\\\\\\')
        s = string.gsub(s, '"', '\\\\"')
        return s
    end

    local s = {}
    for k, v in pairs(t) do
        local key = escape_string(tostring(k))
        if type(v) == "string" then
            s[#s + 1] = '"' .. key .. '":"' .. escape_string(v) .. '"'
        elseif type(v) == "number" or type(v) == "boolean" then
            s[#s + 1] = '"' .. key .. '":' .. tostring(v)
        else
            s[#s + 1] = '"' .. key .. '":null'
        end
    end
    return '{' .. table.concat(s, ',') .. '}'
end

-- HTTP Request Funktion (FlyWithLua Native)
function send_flight_data(data)
    local json_data = encode_json(data)
    
    HTTP_REQUEST_ASYNC(
        API_ENDPOINT,
        "POST",
        "Content-Type: application/json",
        json_data,
        10,
        function(response_code, response_headers, response_body)
            if response_code ~= 200 then
                logMsg("SkyCareer: Fehler " .. response_code)
            end
        end
    )
end

-- DataRef Überwachung
function monitor_flight()
    local current_time = os.clock()
    
    if current_time - last_update < UPDATE_INTERVAL then
        return
    end
    
    last_update = current_time
    
    -- Lese DataRefs
    local altitude = get("sim/flightmodel/position/elevation") * 3.28084
    local speed = get("sim/flightmodel/position/groundspeed") * 1.94384
    local vs = get("sim/flightmodel/position/vh_ind") * 196.85
    local heading = get("sim/flightmodel/position/psi")
    local fuel_total = get("sim/flightmodel/weight/m_fuel_total")
    local fuel_capacity = get("sim/aircraft/weight/acf_m_fuel_tot")
    local fuel_percentage = (fuel_total / fuel_capacity * 100)
    local g_force = get("sim/flightmodel/forces/g_load")
    local latitude = get("sim/flightmodel/position/latitude")
    local longitude = get("sim/flightmodel/position/longitude")
    local on_ground = get("sim/flightmodel/failures/onground_any") == 1
    local parking_brake = get("sim/flightmodel/controls/parkbrake") > 0.5
    local eng1 = get("sim/flightmodel/engine/ENGN_running[0]") == 1
    local eng2 = get("sim/flightmodel/engine/ENGN_running[1]") == 1
    local engines_running = eng1 or eng2
    
    -- Erkenne Takeoff
    if last_on_ground and not on_ground then
        flight_started = true
        logMsg("SkyCareer: Flug gestartet!")
    end
    
    last_on_ground = on_ground
    
    -- Sende nur Daten wenn Flug gestartet
    if not flight_started and on_ground and not engines_running then
        return
    end
    
    -- Erstelle Payload
    local data = {
        company_id = COMPANY_ID,
        altitude = math.floor(altitude * 10) / 10,
        speed = math.floor(speed * 10) / 10,
        vertical_speed = math.floor(vs * 10) / 10,
        heading = math.floor(heading * 10) / 10,
        fuel_percentage = math.floor(fuel_percentage * 10) / 10,
        g_force = math.floor(g_force * 100) / 100,
        latitude = latitude,
        longitude = longitude,
        on_ground = on_ground,
        parking_brake = parking_brake,
        engines_running = engines_running
    }
    
    send_flight_data(data)
end

-- Registriere Flight Loop
do_every_frame("monitor_flight()")

logMsg("SkyCareer Plugin geladen! Company ID: " .. COMPANY_ID)
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