import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import JSZip from 'npm:jszip@3.10.1';

const API_ENDPOINT_DEFAULT = 'https://aero-career-pilot.base44.app/api/functions/receiveXPlaneData';
const BRIDGE_PACKAGE_DIR = 'SkyCareer_MSFS_Bridge';
const BRIDGE_ROOT_README = `SkyCareer MSFS Bridge

1) Open folder: ${BRIDGE_PACKAGE_DIR}
2) Start: SkyCareerMsfsBridge.exe
`;
const BRIDGE_ZIP_CANDIDATES = [
  new URL('./assets/SkyCareer_MSFS_Bridge_Windows_20260311.zip', import.meta.url),
  new URL('./assets/SkyCareer_MSFS_Bridge_Windows.zip', import.meta.url),
  new URL('../../../../public/downloads/SkyCareer_MSFS_Bridge_Windows_20260311.zip', import.meta.url),
  new URL('../../../../public/downloads/SkyCareer_MSFS_Bridge_Windows.zip', import.meta.url),
];

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

async function readFirstAvailable(candidates: URL[]) {
  for (const candidate of candidates) {
    try {
      return await Deno.readFile(candidate);
    } catch {
      // try next
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
    const sourceZipBytes = await readFirstAvailable(BRIDGE_ZIP_CANDIDATES);

    const sourceZip = await JSZip.loadAsync(sourceZipBytes);
    const outputZip = new JSZip();

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
      const packagedName = `${BRIDGE_PACKAGE_DIR}/${relativeName}`;

      if (fileName === 'skycareermsfsbridge.exe.config') {
        const configText = await file.async('string');
        outputZip.file(packagedName, patchBridgeConfig(configText, apiKey, endpoint));
      } else {
        const data = await file.async('uint8array');
        outputZip.file(packagedName, data);
      }
    }
    outputZip.file('README_START_HERE.txt', BRIDGE_ROOT_README);
    const finalZipBytes = await outputZip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return Response.json({
      filename: 'SkyCareer_MSFS_Bridge_Windows.zip',
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
