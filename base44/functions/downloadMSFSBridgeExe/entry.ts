import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import JSZip from 'npm:jszip@3.10.1';

const API_ENDPOINT_DEFAULT = 'https://aero-career-pilot.base44.app/api/functions/receiveXPlaneData';
const BRIDGE_PACKAGE_DIR = 'SkyCareer_MSFS_Bridge';
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
const BRIDGE_ROOT_README = `SkyCareer MSFS Bridge

1) Run: SC Installer.exe (recommended)
2) If needed, remove everything with: SC Uninstaller.exe
3) Bridge runtime files are inside the folder: ${BRIDGE_PACKAGE_DIR}
4) Direct start (without installer): open ${BRIDGE_PACKAGE_DIR} and run SkyCareerMsfsBridge.exe
`;
const BRIDGE_ZIP_CANDIDATES = [
  new URL('../../../../public/downloads/SkyCareer_MSFS_Bridge_Windows.zip', import.meta.url),
  new URL('../../../../public/downloads/SkyCareer_MSFS_Bridge_Windows_20260311.zip', import.meta.url),
  new URL('./assets/SkyCareer_MSFS_Bridge_Windows.zip', import.meta.url),
  new URL('./assets/SkyCareer_MSFS_Bridge_Windows_20260311.zip', import.meta.url),
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

function patchBridgeConfig(configText: string, apiKey: string, endpoint: string) {
  let patched = configText;
  patched = upsertAppSetting(patched, 'ApiEndpoint', endpoint);
  patched = upsertAppSetting(patched, 'ApiKey', apiKey);
  patched = upsertAppSetting(patched, 'LoopIntervalMs', '2000');
  patched = upsertAppSetting(patched, 'PollIntervalMs', '2000');
  patched = upsertAppSetting(patched, 'SendIntervalMs', '2000');
  patched = upsertAppSetting(patched, 'SampleIntervalMs', '200');
  patched = upsertAppSetting(patched, 'HttpTimeoutMs', '10000');
  patched = upsertAppSetting(patched, 'AutoRestartWorkerOnTimeout', 'true');
  patched = upsertAppSetting(patched, 'WorkerTimeoutMs', '15000');
  patched = upsertAppSetting(patched, 'WorkerRestartDelayMs', '2000');
  patched = upsertAppSetting(patched, 'MaxConsecutiveTimeouts', '3');
  patched = upsertAppSetting(patched, 'Simulator', 'auto');
  patched = upsertAppSetting(patched, 'AutoStartOnSimulator', 'true');
  patched = upsertAppSetting(patched, 'MonitorProcesses', 'FlightSimulator;FlightSimulator2024;X-Plane;X-Plane12;XPlane;XPlane12');
  return patched;
}

function buildBridgeConfig(apiKey: string, endpoint: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <appSettings>
    <add key="ApiEndpoint" value="${endpoint}" />
    <add key="ApiKey" value="${apiKey}" />
    <add key="Simulator" value="auto" />
    <add key="LoopIntervalMs" value="2000" />
    <add key="PollIntervalMs" value="2000" />
    <add key="SendIntervalMs" value="2000" />
    <add key="SampleIntervalMs" value="200" />
    <add key="HttpTimeoutMs" value="10000" />
    <add key="AutoRestartWorkerOnTimeout" value="true" />
    <add key="WorkerTimeoutMs" value="15000" />
    <add key="WorkerRestartDelayMs" value="2000" />
    <add key="MaxConsecutiveTimeouts" value="3" />
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
      const payloadZipBytes = await readFirstAvailable(BRIDGE_PAYLOAD_ZIP_CANDIDATES);
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
    }

    if (bridgeExePath && !hasSimConnectCfg) {
      const slash = bridgeExePath.lastIndexOf('/');
      const dir = slash >= 0 ? bridgeExePath.slice(0, slash + 1) : '';
      outputZip.file(`${dir}SimConnect.cfg`, DEFAULT_SIMCONNECT_CFG);
    }

    outputZip.file('README_START_HERE.txt', BRIDGE_ROOT_README);
    const finalZipBytes = await outputZip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return Response.json({
      filename: 'SkyCareer_MSFS_Bridge_Windows_v1.zip',
      mime_type: 'application/zip',
      base64: toBase64(finalZipBytes),
      byte_length: finalZipBytes.length,
      personalized: true,
    });
  } catch (error) {
    console.error('Error serving personalized MSFS bridge exe zip:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
