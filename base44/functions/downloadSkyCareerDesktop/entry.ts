import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import JSZip from 'npm:jszip@3.10.1';

const API_ENDPOINT_DEFAULT = 'https://aero-career-pilot.base44.app/api/functions/receiveXPlaneData';
const DEFAULT_SIMCONNECT_CFG = `[SimConnect]
Protocol=Ipv4
Address=localhost
Port=500
`;

const DESKTOP_ZIP_CANDIDATES = [
  new URL('./assets/SkyCareer_Desktop_AllInOne_Windows.zip', import.meta.url),
  new URL('./assets/SkyCareer_Desktop_AllInOne_Windows_20260311.zip', import.meta.url),
  new URL('../../../../public/downloads/SkyCareer_Desktop_AllInOne_Windows.zip', import.meta.url),
  new URL('../../../../public/downloads/SkyCareer_Desktop_AllInOne_Windows_20260311.zip', import.meta.url),
];

const BRIDGE_ZIP_CANDIDATES = [
  new URL('./assets/SkyCareer_MSFS_Bridge_Payload.zip', import.meta.url),
  new URL('../../../../public/downloads/SkyCareer_MSFS_Bridge_Payload.zip', import.meta.url),
  new URL('./assets/SkyCareer_MSFS_Bridge_Windows_20260311.zip', import.meta.url),
  new URL('./assets/SkyCareer_MSFS_Bridge_Windows.zip', import.meta.url),
  new URL('../../../../public/downloads/SkyCareer_MSFS_Bridge_Windows_20260311.zip', import.meta.url),
  new URL('../../../../public/downloads/SkyCareer_MSFS_Bridge_Windows.zip', import.meta.url),
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
      try {
        return await fetchFromGithubMedia(candidateFileName(candidate));
      } catch {
        // try next candidate
      }
    }
  }
  throw new Error('Download asset not found');
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
  patched = upsertAppSetting(patched, 'Simulator', 'auto');
  patched = upsertAppSetting(patched, 'AutoStartOnSimulator', 'true');
  patched = upsertAppSetting(patched, 'MonitorProcesses', 'FlightSimulator;FlightSimulator2024;X-Plane;X-Plane12;XPlane;XPlane12');
  return patched;
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

    const { apiKey } = await ensureCompanyApiKey(base44, user);
    const endpoint = API_ENDPOINT_DEFAULT;

    const desktopZipBytes = await readFirstAvailable(DESKTOP_ZIP_CANDIDATES);
    const bridgeZipBytes = await readFirstAvailable(BRIDGE_ZIP_CANDIDATES);

    const desktopZip = await JSZip.loadAsync(desktopZipBytes);
    const bridgeZip = await JSZip.loadAsync(bridgeZipBytes);
    const outputZip = new JSZip();

    for (const [name, file] of Object.entries(desktopZip.files)) {
      if (file.dir) continue;
      const targetName = name.split('/').pop() || name;
      const data = await file.async('uint8array');
      outputZip.file(targetName, data);
    }

    let hasSimConnectCfg = false;
    for (const [name, file] of Object.entries(bridgeZip.files)) {
      if (file.dir) continue;
      const targetName = normalizeZipPath(name);
      if (!targetName) continue;
      const fileName = basename(targetName).toLowerCase();

      if (fileName === 'simconnect.cfg') {
        hasSimConnectCfg = true;
      }

      if (fileName === 'skycareermsfsbridge.exe.config') {
        const configText = await file.async('string');
        const patchedConfig = patchBridgeConfig(configText, apiKey, endpoint);
        outputZip.file(targetName, patchedConfig);
      } else {
        const data = await file.async('uint8array');
        outputZip.file(targetName, data);
      }
    }

    if (!hasSimConnectCfg) {
      outputZip.file('SimConnect.cfg', DEFAULT_SIMCONNECT_CFG);
    }
    const finalZipBytes = await outputZip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return Response.json({
      filename: 'SkyCareer_Desktop_AllInOne_Windows.zip',
      mime_type: 'application/zip',
      base64: toBase64(finalZipBytes),
      byte_length: finalZipBytes.length,
      personalized: true,
    });
  } catch (error) {
    console.error('Error serving personalized SkyCareer desktop zip:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
