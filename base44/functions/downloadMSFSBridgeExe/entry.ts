import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import JSZip from 'npm:jszip@3.10.1';

const API_ENDPOINT_DEFAULT = 'https://sky-career.com/api/functions/receiveXPlaneData';
const LOCAL_RELAY_ENDPOINT = 'http://127.0.0.1:50080/bridge';
const BRIDGE_VERSION = 'bridge-2026-04-08-r1';
const BRIDGE_PACKAGE_DIR = 'SkyCareer_MSFS_Bridge';
const BRIDGE_PAYLOAD_FILE = 'SkyCareer_MSFS_Bridge_Payload.zip';
const DEFAULT_SIMCONNECT_CFG = `[SimConnect]
Protocol=Ipv4
Address=localhost
Port=500
`;
const ROOT_LEVEL_FILES = new Set([
  'sc installer.exe',
  'sc uninstaller.exe',
  'skycareerbridgeinstaller.exe',
  'skycareerbridgeuninstaller.exe',
]);
const BRIDGE_ROOT_README = `SkyCareer MSFS Bridge (${BRIDGE_VERSION})

1) Run: SC Installer.exe (recommended)
2) If needed, remove everything with: SC Uninstaller.exe
3) Bridge runtime files are inside the folder: ${BRIDGE_PACKAGE_DIR}
4) Direct start (without installer): run Start_SkyCareer_Bridge_Fixed.cmd
`;
const BRIDGE_ZIP_CANDIDATES = [
  new URL('../../../../public/downloads/SkyCareer_MSFS_Bridge_Windows.zip', import.meta.url),
  new URL('./assets/SkyCareer_MSFS_Bridge_Windows.zip', import.meta.url),
];
const BRIDGE_PAYLOAD_ZIP_CANDIDATES = [
  new URL('../../../../public/downloads/SkyCareer_MSFS_Bridge_Payload.zip', import.meta.url),
  new URL('./assets/SkyCareer_MSFS_Bridge_Payload.zip', import.meta.url),
];
const GITHUB_MEDIA_BASE = 'https://media.githubusercontent.com/media/ye6697/skycareerV1/main/public/downloads';

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function isLikelyLfsPointer(bytes: Uint8Array) {
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 120)));
  return head.includes('git-lfs.github.com/spec/v1');
}

function candidateFileName(candidate: URL) {
  return candidate.pathname.split('/').pop() || '';
}

async function fetchFromGithubMedia(fileName: string) {
  if (!fileName) {
    throw new Error('Missing download filename');
  }
  const res = await fetch(`${GITHUB_MEDIA_BASE}/${encodeURIComponent(fileName)}`);
  if (!res.ok) {
    throw new Error(`GitHub media download failed: HTTP ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function readFirstAvailable(candidates: URL[]) {
  for (const candidate of candidates) {
    try {
      const bytes = await Deno.readFile(candidate);
      if (isLikelyLfsPointer(bytes)) {
        return await fetchFromGithubMedia(candidateFileName(candidate));
      }
      return bytes;
    } catch {
      // try next
      try {
        return await fetchFromGithubMedia(candidateFileName(candidate));
      } catch {
        // keep trying candidates
      }
    }
  }
  throw new Error('Bridge zip asset not found');
}

function upsertAppSetting(configText: string, key: string, value: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keyRegex = new RegExp(`(<add\\s+key="${escapedKey}"\\s+value=")[^"]*(")`, 'i');
  if (keyRegex.test(configText)) {
    return configText.replace(keyRegex, `$1${value}$2`);
  }
  return configText.replace(
    /<\/appSettings>/i,
    `    <add key="${key}" value="${value}" />\n  </appSettings>`
  );
}

function buildRelayScript(forwardEndpoint: string) {
  return `#!/usr/bin/env python3
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

LISTEN_HOST = '127.0.0.1'
LISTEN_PORT = 50080
TARGET_ENDPOINT = ${JSON.stringify(forwardEndpoint)}
FORWARD_TIMEOUT_SEC = 12
LOG_PATH = r'C:\\Users\\Public\\SkyCareerBridgeRelay.log'
ALLOWED_FORWARD_KEYS = {
    'simulator', 'altitude', 'speed', 'ias', 'vertical_speed', 'heading',
    'pitch', 'g_force', 'max_g_force', 'latitude', 'longitude', 'on_ground',
    'was_airborne', 'parking_brake', 'engine1_running', 'aircraft_icao',
    'engine2_running', 'engines_running', 'engine_load_pct', 'engine1_load_pct',
    'engine2_load_pct', 'gear_down', 'flap_ratio', 'speedbrake', 'speed_brake',
    'spoiler', 'fuel_percentage', 'fuel_kg', 'fuel_total_kg',
    'fuel_flow_total_kgph', 'fuel_flow_total_lph', 'fuel_flow_total_pph',
    'engine1_fuel_flow_pph', 'engine2_fuel_flow_pph', 'fuel_flow_source',
    'total_weight_kg', 'tow_kg', 'oat_c', 'tat_c', 'tat',
    'total_air_temperature', 'total_air_temperature_c', 'ground_elevation_ft',
    'baro_setting', 'wind_speed_kts', 'wind_gust_kts', 'wind_direction',
    'rain_intensity', 'rain_detected', 'precipitation', 'precip_rate',
    'precip_state', 'ambient_precip_rate', 'ambient_precip_state',
    'turbulence', 'turbulence_intensity',
}

state_lock = threading.Lock()
request_count = 0
forward_count = 0
last_forward_status = None
last_forward_elapsed_ms = None
last_fuel_kg = None
last_fuel_ts = 0.0
fuel_flow_smoothed_kgph = 0.0

def log(msg):
    try:
        with open(LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\\n")
    except Exception:
        pass

def forward_payload(payload, api_key):
    global forward_count, last_forward_status, last_forward_elapsed_ms
    global last_fuel_kg, last_fuel_ts, fuel_flow_smoothed_kgph
    sep = '&' if '?' in TARGET_ENDPOINT else '?'
    target_url = f"{TARGET_ENDPOINT}{sep}api_key={api_key}"
    try:
        now_ts = time.time()
        fuel_kg = float(payload.get('fuel_kg') or payload.get('fuel_total_kg') or 0)
        has_flow = float(payload.get('fuel_flow_total_kgph') or 0) > 0
        if fuel_kg > 0 and last_fuel_kg is not None and last_fuel_ts > 0 and not has_flow:
            dt = now_ts - last_fuel_ts
            burned = last_fuel_kg - fuel_kg
            if dt >= 2 and burned > 0:
                instant_kgph = (burned * 3600.0) / dt
                if 1 <= instant_kgph <= 5000:
                    fuel_flow_smoothed_kgph = instant_kgph if fuel_flow_smoothed_kgph <= 0 else ((fuel_flow_smoothed_kgph * 0.7) + (instant_kgph * 0.3))
                    payload['fuel_flow_total_kgph'] = round(fuel_flow_smoothed_kgph, 1)
                    payload['fuel_flow_total_lph'] = round(fuel_flow_smoothed_kgph * 1.25, 1)
                    payload['fuel_flow_total_pph'] = round(fuel_flow_smoothed_kgph / 0.45359237, 1)
                    payload['fuel_flow_source'] = 'relay_delta'
        if fuel_kg > 0:
            last_fuel_kg = fuel_kg
            last_fuel_ts = now_ts
    except Exception:
        pass
    clean = {k: payload[k] for k in ALLOWED_FORWARD_KEYS if k in payload}
    data = json.dumps(clean, separators=(',', ':')).encode('utf-8')
    req = Request(target_url, data=data, method='POST')
    req.add_header('Content-Type', 'application/json')
    status = 0
    started = time.time()
    preview = ''
    try:
        with urlopen(req, timeout=FORWARD_TIMEOUT_SEC) as resp:
            status = getattr(resp, 'status', 200)
            preview = resp.read(256).decode('utf-8', errors='replace')
    except HTTPError as e:
        status = int(getattr(e, 'code', 0) or 0)
        try:
            preview = e.read(256).decode('utf-8', errors='replace')
        except Exception:
            preview = ''
    except (URLError, Exception) as e:
        preview = str(e)
    elapsed = int((time.time() - started) * 1000)
    with state_lock:
        forward_count += 1
        last_forward_status = status
        last_forward_elapsed_ms = elapsed
    if status >= 400 or status == 0:
        log(f"forward status={status} elapsed_ms={elapsed} response={preview[:180]}")

class Handler(BaseHTTPRequestHandler):
    server_version = 'SkyCareerBridgeRelay/1.1'
    def log_message(self, fmt, *args):
        return
    def do_POST(self):
        global request_count
        api_key = (parse_qs(urlparse(self.path).query or '').get('api_key') or [''])[0].strip()
        raw = self.rfile.read(int(self.headers.get('Content-Length', '0') or '0'))
        try:
            payload = json.loads(raw.decode('utf-8') or '{}')
            if not isinstance(payload, dict):
                raise ValueError('payload must be object')
        except Exception:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"error":"invalid_json"}')
            return
        if not api_key:
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b'{"error":"api_key_required"}')
            return
        with state_lock:
            request_count += 1
        threading.Thread(target=forward_payload, args=(payload, api_key), daemon=True).start()
        body = b'{"status":"queued"}'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        if urlparse(self.path).path != '/stats':
            self.send_response(404)
            self.end_headers()
            return
        with state_lock:
            body = json.dumps({
                'request_count': request_count,
                'forward_count': forward_count,
                'last_forward_status': last_forward_status,
                'last_forward_elapsed_ms': last_forward_elapsed_ms,
            }).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == '__main__':
    log('relay starting')
    ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Handler).serve_forever()
`;
}

function buildStartScript() {
  return `@echo off
setlocal
set "ROOT=%~dp0"
set "BRIDGE_DIR=%ROOT%${BRIDGE_PACKAGE_DIR}"
set "RELAY=%BRIDGE_DIR%\\SkyCareerBridgeRelay.py"
if not exist "%RELAY%" set "RELAY=%ROOT%SkyCareerBridgeRelay.py"
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (-not (Get-NetTCPConnection -LocalPort 50080 -State Listen -ErrorAction SilentlyContinue)) { Start-Process -FilePath 'python.exe' -ArgumentList @('%RELAY%') -WorkingDirectory '%BRIDGE_DIR%' -WindowStyle Hidden }"
timeout /t 2 /nobreak >nul
start "" "%BRIDGE_DIR%\\SkyCareerMsfsBridge.exe"
`;
}

function patchBridgeConfig(configText: string, apiKey: string, endpoint: string) {
  void endpoint;
  let patched = configText;
  patched = upsertAppSetting(patched, 'ApiEndpoint', LOCAL_RELAY_ENDPOINT);
  patched = upsertAppSetting(patched, 'ApiKey', apiKey);
  patched = upsertAppSetting(patched, 'LoopIntervalMs', '5000');
  patched = upsertAppSetting(patched, 'PollIntervalMs', '5000');
  patched = upsertAppSetting(patched, 'SendIntervalMs', '5000');
  patched = upsertAppSetting(patched, 'SampleIntervalMs', '200');
  patched = upsertAppSetting(patched, 'HttpTimeoutMs', '5000');
  patched = upsertAppSetting(patched, 'AutoRestartWorkerOnTimeout', 'true');
  patched = upsertAppSetting(patched, 'WorkerTimeoutMs', '15000');
  patched = upsertAppSetting(patched, 'WorkerRestartDelayMs', '2000');
  patched = upsertAppSetting(patched, 'MaxConsecutiveTimeouts', '3');
  patched = upsertAppSetting(patched, 'BridgeVersion', BRIDGE_VERSION);
  patched = upsertAppSetting(patched, 'NativeBridgeVersion', BRIDGE_VERSION);
  patched = upsertAppSetting(patched, 'Simulator', 'auto');
  patched = upsertAppSetting(patched, 'AutoStartOnSimulator', 'true');
  patched = upsertAppSetting(patched, 'MonitorProcesses', 'FlightSimulator;FlightSimulator2024;X-Plane;X-Plane12;XPlane;XPlane12');
  return patched;
}

function buildBridgeConfig(apiKey: string, endpoint: string) {
  void endpoint;
  return `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <appSettings>
    <add key="ApiEndpoint" value="${LOCAL_RELAY_ENDPOINT}" />
    <add key="ApiKey" value="${apiKey}" />
    <add key="Simulator" value="auto" />
    <add key="LoopIntervalMs" value="5000" />
    <add key="PollIntervalMs" value="5000" />
    <add key="SendIntervalMs" value="5000" />
    <add key="SampleIntervalMs" value="200" />
    <add key="HttpTimeoutMs" value="5000" />
    <add key="AutoRestartWorkerOnTimeout" value="true" />
    <add key="WorkerTimeoutMs" value="15000" />
    <add key="WorkerRestartDelayMs" value="2000" />
    <add key="MaxConsecutiveTimeouts" value="3" />
    <add key="BridgeVersion" value="${BRIDGE_VERSION}" />
    <add key="NativeBridgeVersion" value="${BRIDGE_VERSION}" />
    <add key="AutoStartOnSimulator" value="true" />
    <add key="MonitorProcesses" value="FlightSimulator;FlightSimulator2024;X-Plane;X-Plane12;XPlane;XPlane12" />
  </appSettings>
</configuration>
`;
}

function resolveEndpoint(req: Request, endpointFromBody?: string) {
  const fromBody = String(endpointFromBody || '').trim();
  if (fromBody.startsWith('http://') || fromBody.startsWith('https://')) {
    return fromBody;
  }

  const reqUrl = new URL(req.url);
  const originHeader = String(req.headers.get('origin') || '').trim();
  if (originHeader.startsWith('http://') || originHeader.startsWith('https://')) {
    return `${originHeader.replace(/\/+$/, '')}/api/functions/receiveXPlaneData`;
  }

  const forwardedHost = String(req.headers.get('x-forwarded-host') || '').trim();
  if (forwardedHost) {
    const forwardedProto = String(req.headers.get('x-forwarded-proto') || '').trim() || reqUrl.protocol.replace(':', '');
    return `${forwardedProto}://${forwardedHost}/api/functions/receiveXPlaneData`;
  }

  return `${reqUrl.origin}/api/functions/receiveXPlaneData`;
}

function normalizeZipPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function basename(path: string) {
  const normalized = normalizeZipPath(path);
  const parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}

async function ensureCompanyApiKey(base44: any, user: any) {
  const companies = await base44.entities.Company.filter({ created_by: user.email });
  const company = companies[0];
  if (!company) {
    throw new Error('Company not found');
  }
  let apiKey = company.xplane_api_key;
  if (!apiKey) {
    apiKey = crypto.randomUUID();
    await base44.entities.Company.update(company.id, { xplane_api_key: apiKey });
  }
  return { company, apiKey };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { apiKey } = await ensureCompanyApiKey(base44, user);
    const endpoint = resolveEndpoint(req, body?.endpoint) || API_ENDPOINT_DEFAULT;
    const sourceZipBytes = await readFirstAvailable(BRIDGE_ZIP_CANDIDATES);
    const payloadZipBytes = await readFirstAvailable(BRIDGE_PAYLOAD_ZIP_CANDIDATES);

    const sourceZip = await JSZip.loadAsync(sourceZipBytes);
    const outputZip = new JSZip();
    let hasBridgeRuntime = false;
    let bridgeExePath = '';
    let bridgeConfigPath = '';
    let hasSimConnectCfg = false;

    for (const [name, file] of Object.entries(sourceZip.files)) {
      if (file.dir) continue;
      const targetName = normalizeZipPath(name);
      if (!targetName) continue;
      if (targetName.toLowerCase() === 'readme_start_here.txt') {
        continue;
      }
      const relativeName = targetName.startsWith(`${BRIDGE_PACKAGE_DIR}/`)
        ? targetName.slice(BRIDGE_PACKAGE_DIR.length + 1)
        : targetName;
      if (!relativeName) continue;
      const fileName = basename(relativeName).toLowerCase();
      const packagedName = ROOT_LEVEL_FILES.has(fileName)
        ? basename(relativeName)
        : `${BRIDGE_PACKAGE_DIR}/${relativeName}`;

      if (fileName === 'skycareermsfsbridge.exe') {
        hasBridgeRuntime = true;
        bridgeExePath = packagedName;
      }
      if (fileName === 'simconnect.cfg') {
        hasSimConnectCfg = true;
      }
      if (fileName === 'skycareermsfsbridge.exe.config') {
        const configText = await file.async('string');
        outputZip.file(packagedName, patchBridgeConfig(configText, apiKey, endpoint));
        bridgeConfigPath = packagedName;
      } else {
        const data = await file.async('uint8array');
        outputZip.file(packagedName, data);
      }
    }

    if (!hasBridgeRuntime) {
      const payloadZip = await JSZip.loadAsync(payloadZipBytes);
      for (const [name, file] of Object.entries(payloadZip.files)) {
        if (file.dir) continue;
        const payloadPath = normalizeZipPath(name);
        if (!payloadPath) continue;
        const payloadRelative = payloadPath.startsWith(`${BRIDGE_PACKAGE_DIR}/`)
          ? payloadPath.slice(BRIDGE_PACKAGE_DIR.length + 1)
          : payloadPath;
        const fileName = basename(payloadRelative).toLowerCase();
        const packagedName = `${BRIDGE_PACKAGE_DIR}/${payloadRelative}`;

        if (fileName === 'skycareermsfsbridge.exe') {
          hasBridgeRuntime = true;
          bridgeExePath = packagedName;
        }
        if (fileName === 'simconnect.cfg') {
          hasSimConnectCfg = true;
        }

        if (fileName === 'skycareermsfsbridge.exe.config') {
          const configText = await file.async('string');
          outputZip.file(packagedName, patchBridgeConfig(configText, apiKey, endpoint));
          bridgeConfigPath = packagedName;
          continue;
        }

        const data = await file.async('uint8array');
        outputZip.file(packagedName, data);
      }
    }

    if (bridgeExePath && !bridgeConfigPath) {
      const slash = bridgeExePath.lastIndexOf('/');
      const dir = slash >= 0 ? bridgeExePath.slice(0, slash + 1) : '';
      bridgeConfigPath = `${dir}SkyCareerMsfsBridge.exe.config`;
      outputZip.file(bridgeConfigPath, buildBridgeConfig(apiKey, endpoint));
      outputZip.file(`${dir}BRIDGE_VERSION.txt`, `${BRIDGE_VERSION}\n`);
      outputZip.file(`${dir}SkyCareerBridgeRelay.py`, buildRelayScript(endpoint));
    } else if (bridgeExePath) {
      const slash = bridgeExePath.lastIndexOf('/');
      const dir = slash >= 0 ? bridgeExePath.slice(0, slash + 1) : '';
      outputZip.file(`${dir}BRIDGE_VERSION.txt`, `${BRIDGE_VERSION}\n`);
      outputZip.file(`${dir}SkyCareerBridgeRelay.py`, buildRelayScript(endpoint));
    }

    if (bridgeExePath && !hasSimConnectCfg) {
      const slash = bridgeExePath.lastIndexOf('/');
      const dir = slash >= 0 ? bridgeExePath.slice(0, slash + 1) : '';
      outputZip.file(`${dir}SimConnect.cfg`, DEFAULT_SIMCONNECT_CFG);
    }

    // Keep the latest runtime payload next to SC Installer so it cannot fall back to stale remote assets.
    outputZip.file(BRIDGE_PAYLOAD_FILE, payloadZipBytes);
    outputZip.file('Start_SkyCareer_Bridge_Fixed.cmd', buildStartScript());
    outputZip.file('README_START_HERE.txt', BRIDGE_ROOT_README);
    outputZip.file('BRIDGE_VERSION.txt', `${BRIDGE_VERSION}\n`);
    const finalZipBytes = await outputZip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return Response.json({
      filename: `SkyCareer_MSFS_Bridge_Windows_${BRIDGE_VERSION}.zip`,
      mime_type: 'application/zip',
      base64: toBase64(finalZipBytes),
      byte_length: finalZipBytes.length,
      bridge_version: BRIDGE_VERSION,
      personalized: true,
    });
  } catch (error) {
    console.error('Error serving personalized MSFS bridge exe zip:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
