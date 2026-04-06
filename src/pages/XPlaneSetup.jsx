import React from 'react';
import JSZip from "jszip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import {
  Download,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Sparkles,
  ShieldCheck,
  Radio,
  Wrench,
  Rocket,
  Gauge,
  Bug
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

const COPY = {
  en: {
    title: 'SkyCareer Setup Center',
    subtitle: 'Install and operate the official SkyCareer connectors for MSFS 2020/2024 and X-Plane 12 with a clear, production-ready workflow.',
    badge: 'Setup & Connectivity',
    downloadError: 'Download failed. Please try again.',
    loading: 'Loading...',
    copy: 'Copy',
    copied: 'Copied',

    step1Title: '1. Download Connector Packages',
    step1Desc: 'For MSFS, use the bootstrap package. It includes only SC Installer, SC Uninstaller, and README. The installer downloads the full runtime automatically during installation.',

    msfsTitle: 'MSFS 2020/2024 Bridge Suite (Windows)',
    msfsDesc: 'Recommended deployment path for MSFS. Includes SC Installer and SC Uninstaller as your official bridge lifecycle tools.',
    msfsBtn: 'Download MSFS Bridge Package',

    msfsPyTitle: 'MSFS Python Bridge (Advanced Fallback)',
    msfsPyDesc: 'Manual fallback path for advanced users. Requires Python 3 and python-simconnect.',
    msfsPyBtn: 'Download Python Bridge',
    msfsPyUsage: 'Usage: python SkyCareer_MSFS_Bridge.py --sim msfs2020 (or msfs2024)',

    xpTitle: 'X-Plane 12 Integration Options',
    luaTitle: 'FlyWithLua Script (Recommended)',
    luaDesc: 'Fastest setup path for X-Plane 12. Download the script and place it into the FlyWithLua Scripts folder.',
    luaBtn: 'Download SkyCareer.lua',
    luaReq: 'Requirement: FlyWithLua plugin',
    luaLink: 'Download FlyWithLua',

    pyTitle: 'XPPython3 Plugin (Alternative Path)',
    pyDesc: 'Alternative integration via XPPython3 when FlyWithLua is not preferred.',
    pyBtn: 'Download Python Plugin (.txt)',
    pyReq: 'Requirement: XPPython3',
    pyLink: 'Download XPPython3',

    step2Title: '2. Installation Workflow',
    step2Desc: 'Follow the platform-specific installation path below.',
    installMsfsTitle: 'MSFS 2020/2024',
    installMsfs1: 'Extract the ZIP and run SC Installer.exe.',
    installMsfs2: 'Click Install Bridge. The installer downloads and deploys the full bridge runtime.',
    installMsfs3: 'Start MSFS, then launch SkyCareerMsfsBridge.exe from the installation folder if needed.',
    installMsfs4: 'Optional: extract the tablet package and copy it to Community folder.',

    installXpTitle: 'X-Plane 12',
    installXpLua1: 'Install FlyWithLua (if missing).',
    installXpLua2: 'Copy SkyCareer.lua to X-Plane 12/Resources/plugins/FlyWithLua/Scripts/.',
    installXpLua3: 'Restart X-Plane 12.',
    installXpPy1: 'Install XPPython3.',
    installXpPy2: 'Create X-Plane 12/Resources/plugins/PythonPlugins/SkyCareer/.',
    installXpPy3: 'Copy PI_SkyCareer.py and README.md from the downloaded text package.',

    step3Title: '3. Validate Account Binding',
    step3Desc: 'Your connector package is personalized. API key and telemetry endpoint are mapped to your SkyCareer account.',
    apiKey: 'Personal API key',
    endpoint: 'Telemetry endpoint',
    keyNote: 'This API key remains stable for your company profile and is preconfigured in generated connector downloads.',

    step4Title: '4. Flight Operations Flow',
    step4Desc: 'Recommended operating sequence for reliable live tracking and automatic completion.',
    flow1: 'Open a contract in SkyCareer and click Start Flight.',
    flow2: 'Load the matching aircraft and departure airport in your simulator.',
    flow3: 'After takeoff, telemetry starts sending automatically.',
    flow4: 'After landing and shutdown, the flight result is finalized automatically.',

    techTitle: 'Telemetry Architecture',
    techDesc: 'Core datapoints and connector behavior monitored throughout each flight.',
    freq: 'Sampling interval: 200 ms, transmit loop: 2 s',
    protocol: 'Protocol: HTTPS function endpoint',
    simulators: 'Supported: X-Plane 12, MSFS 2020, MSFS 2024',

    helpTitle: 'Diagnostics Checklist',
    help1: 'Simulator is running before connector/plugin starts',
    help2: 'Active SkyCareer flight is started',
    help3: 'Firewall allows outbound HTTPS',
    help4: 'Installed files are in correct simulator folders',
    help5: 'Reset path: run SC Uninstaller, then reinstall via SC Installer'
  },
  de: {
    title: 'SkyCareer Setup Center',
    subtitle: 'Installiere die offiziellen SkyCareer-Connectoren fuer MSFS 2020/2024 und X-Plane 12 mit einem klaren, professionellen Ablauf.',
    badge: 'Setup & Verbindung',
    downloadError: 'Download fehlgeschlagen. Bitte erneut versuchen.',
    loading: 'Laedt...',
    copy: 'Kopieren',
    copied: 'Kopiert',

    step1Title: '1. Connector-Pakete herunterladen',
    step1Desc: 'Fuer MSFS nutzt du das Bootstrap-Paket. Es enthaelt nur SC Installer, SC Uninstaller und README. Der Installer laedt die komplette Runtime waehrend der Installation automatisch nach.',

    msfsTitle: 'MSFS 2020/2024 Bridge Suite (Windows)',
    msfsDesc: 'Empfohlener Deployment-Weg fuer MSFS. Enthalten sind SC Installer und SC Uninstaller als offizieller Lifecycle-Flow.',
    msfsBtn: 'MSFS Paket herunterladen',

    msfsPyTitle: 'MSFS Python Bridge (Advanced Fallback)',
    msfsPyDesc: 'Manueller Fallback fuer fortgeschrittene Nutzer. Benoetigt Python 3 und python-simconnect.',
    msfsPyBtn: 'Python Bridge herunterladen',
    msfsPyUsage: 'Nutzung: python SkyCareer_MSFS_Bridge.py --sim msfs2020 (oder msfs2024)',

    xpTitle: 'X-Plane 12 Integrationsoptionen',
    luaTitle: 'FlyWithLua Script (Empfohlen)',
    luaDesc: 'Schnellster Setup-Weg fuer X-Plane 12. Script herunterladen und in den FlyWithLua-Scripts-Ordner legen.',
    luaBtn: 'SkyCareer.lua herunterladen',
    luaReq: 'Voraussetzung: FlyWithLua Plugin',
    luaLink: 'FlyWithLua herunterladen',

    pyTitle: 'XPPython3 Plugin (Alternative)',
    pyDesc: 'Alternative Integration ueber XPPython3, wenn FlyWithLua nicht bevorzugt wird.',
    pyBtn: 'Python Plugin herunterladen (.txt)',
    pyReq: 'Voraussetzung: XPPython3',
    pyLink: 'XPPython3 herunterladen',

    step2Title: '2. Installationsablauf',
    step2Desc: 'Folge dem plattformspezifischen Installationsweg unten.',
    installMsfsTitle: 'MSFS 2020/2024',
    installMsfs1: 'ZIP entpacken und SC Installer.exe starten.',
    installMsfs2: 'Auf Install Bridge klicken. Der Installer laedt und deployt die komplette Bridge-Runtime.',
    installMsfs3: 'MSFS starten und bei Bedarf SkyCareerMsfsBridge.exe am Installationsort ausfuehren.',
    installMsfs4: 'Optional: Tablet-Paket entpacken und in den Community-Ordner kopieren.',

    installXpTitle: 'X-Plane 12',
    installXpLua1: 'FlyWithLua installieren (falls nicht vorhanden).',
    installXpLua2: 'SkyCareer.lua nach X-Plane 12/Resources/plugins/FlyWithLua/Scripts/ kopieren.',
    installXpLua3: 'X-Plane 12 neu starten.',
    installXpPy1: 'XPPython3 installieren.',
    installXpPy2: 'X-Plane 12/Resources/plugins/PythonPlugins/SkyCareer/ erstellen.',
    installXpPy3: 'PI_SkyCareer.py und README.md aus dem Textpaket uebernehmen.',

    step3Title: '3. Account-Bindung pruefen',
    step3Desc: 'Dein Connector-Paket ist personalisiert. API-Key und Telemetry-Endpoint sind mit deinem SkyCareer-Account verknuepft.',
    apiKey: 'Persoenlicher API-Key',
    endpoint: 'Telemetry Endpoint',
    keyNote: 'Dieser API-Key bleibt fuer dein Firmenprofil stabil und ist in generierten Connector-Downloads vorkonfiguriert.',

    step4Title: '4. Flugablauf im Betrieb',
    step4Desc: 'Empfohlene Reihenfolge fuer zuverlaessiges Live-Tracking und automatischen Abschluss.',
    flow1: 'In SkyCareer Auftrag starten und auf Start Flight klicken.',
    flow2: 'Im Simulator passendes Flugzeug und Startflughafen laden.',
    flow3: 'Nach dem Abheben startet die Telemetrieuebertragung automatisch.',
    flow4: 'Nach Landung und Shutdown wird das Flugergebnis automatisch abgeschlossen.',

    techTitle: 'Telemetry-Architektur',
    techDesc: 'Zentrale Datenpunkte und Connector-Verhalten waehrend des Flugbetriebs.',
    freq: 'Sampling-Intervall: 200 ms, Sende-Loop: 2 s',
    protocol: 'Protokoll: HTTPS Function Endpoint',
    simulators: 'Unterstuetzt: X-Plane 12, MSFS 2020, MSFS 2024',

    helpTitle: 'Diagnose-Checkliste',
    help1: 'Simulator laeuft bevor Connector/Plugin gestartet wird',
    help2: 'Aktiver SkyCareer-Flug wurde gestartet',
    help3: 'Firewall erlaubt ausgehendes HTTPS',
    help4: 'Installierte Dateien liegen in den korrekten Ordnern',
    help5: 'Reset-Weg: SC Uninstaller ausfuehren und danach per SC Installer neu installieren'
  }
};

export default function XPlaneSetup() {
  const { lang } = useLanguage();
  const text = COPY[lang] || COPY.en;
  const BRIDGE_VERSION = 'bridge-2026-04-06-r2';
  const DOWNLOAD_CACHE_BUST = '20260406-fix-download-fallback';
  const [copied, setCopied] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [apiKey, setApiKey] = React.useState(null);
  const endpoint = `${window.location.origin}/api/receiveXPlaneData`;

  React.useEffect(() => {
    const ensureApiKey = async () => {
      try {
        const response = await base44.functions.invoke('ensureApiKey', {});
        setApiKey(response.data.api_key);
      } catch {
        setApiKey(null);
      }
    };
    ensureApiKey();
  }, []);

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey || '');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1800);
  };

  const copyEndpoint = () => {
    navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const decodeBase64Zip = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const escapeXml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');

  const buildBridgeConfigXml = (personalApiKey, telemetryEndpoint) => `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <appSettings>
    <add key="ApiEndpoint" value="${escapeXml(telemetryEndpoint)}" />
    <add key="ApiKey" value="${escapeXml(personalApiKey)}" />
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
    <add key="BridgeVersion" value="${escapeXml(BRIDGE_VERSION)}" />
    <add key="AutoStartOnSimulator" value="true" />
    <add key="MonitorProcesses" value="FlightSimulator;FlightSimulator2024;X-Plane;X-Plane12;XPlane;XPlane12" />
  </appSettings>
</configuration>
`;

  const personalizeBridgePayloadZip = async (zipBytes, personalApiKey, telemetryEndpoint) => {
    const zip = await JSZip.loadAsync(zipBytes);
    const fileNames = Object.keys(zip.files).filter((name) => !zip.files[name]?.dir);
    const bridgeExePath = fileNames.find((name) => /skycareermsfsbridge\.exe$/i.test(name));
    if (!bridgeExePath) {
      throw new Error('Bridge executable missing in payload zip');
    }
    const slash = bridgeExePath.lastIndexOf('/');
    const dir = slash >= 0 ? bridgeExePath.slice(0, slash + 1) : '';
    const configPath = `${dir}SkyCareerMsfsBridge.exe.config`;
    const simConnectCfgPath = `${dir}SimConnect.cfg`;
    const bridgeVersionPath = `${dir}BRIDGE_VERSION.txt`;

    zip.file(configPath, buildBridgeConfigXml(personalApiKey, telemetryEndpoint));
    zip.file(bridgeVersionPath, `${BRIDGE_VERSION}\n`);
    const hasSimConnect = fileNames.some((name) => name.toLowerCase() === simConnectCfgPath.toLowerCase());
    if (!hasSimConnect) {
      zip.file(simConnectCfgPath, `[SimConnect]
Protocol=Ipv4
Address=localhost
Port=500
`);
    }

    return await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  };

  const mergeBootstrapToolsIntoZip = async (bridgeZipBytes, bootstrapZipBytes) => {
    const bridgeZip = await JSZip.loadAsync(bridgeZipBytes);
    const bootstrapZip = await JSZip.loadAsync(bootstrapZipBytes);
    const keepNames = new Set([
      'sc installer.exe',
      'sc uninstaller.exe',
      'readme_start_here.txt',
      'readme.txt',
    ]);

    const bootstrapEntries = Object.entries(bootstrapZip.files)
      .filter(([, file]) => !file?.dir);

    for (const [path, file] of bootstrapEntries) {
      const fileName = path.split('/').pop() || path;
      const lower = fileName.toLowerCase();
      if (!keepNames.has(lower)) continue;
      const data = await file.async('uint8array');
      bridgeZip.file(fileName, data);
    }
    bridgeZip.file('README_START_HERE.txt', `SkyCareer MSFS Bridge (${BRIDGE_VERSION})

1) Run: SC Installer.exe (recommended)
2) If needed, remove everything with: SC Uninstaller.exe
3) Bridge runtime files are inside the folder: SkyCareer_MSFS_Bridge
4) Direct start (without installer): open SkyCareer_MSFS_Bridge and run SkyCareerMsfsBridge.exe
`);
    bridgeZip.file('BRIDGE_VERSION.txt', `${BRIDGE_VERSION}\n`);

    return await bridgeZip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  };

  const triggerZipDownload = (bytes, fileName) => {
    const blob = new Blob([bytes], { type: 'application/zip' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const downloadLua = async () => {
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('downloadFlyWithLua', { endpoint });
      const blob = new Blob([response.data], { type: 'text/x-lua' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SkyCareer.lua';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error downloading Lua script:', error);
      alert(text.downloadError);
    } finally {
      setDownloading(false);
    }
  };

  const downloadPython = async () => {
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('downloadPythonPlugin', { endpoint });
      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SkyCareer-Python-Plugin.txt';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error downloading Python plugin:', error);
      alert(text.downloadError);
    } finally {
      setDownloading(false);
    }
  };

  const downloadSkyCareerDesktop = async () => {
    setDownloading(true);
    try {
      const targetFile = 'SkyCareer_MSFS_Bridge_Windows.zip';
      let bytes = null;
      let fileName = targetFile;
      let lastError = null;

      try {
        const response = await base44.functions.invoke('downloadMSFSBridgeExe', { endpoint });
        const base64 = response?.data?.base64;
        if (base64) {
          bytes = decodeBase64Zip(base64);
          fileName = response?.data?.filename || targetFile;
        } else {
          lastError = 'downloadMSFSBridgeExe returned no base64 payload';
        }
      } catch (fnError) {
        lastError = fnError?.message || String(fnError);
      }

      if (!bytes) {
        try {
          const response = await base44.functions.invoke('downloadSkyCareerDesktop', { endpoint });
          const base64 = response?.data?.base64;
          if (base64) {
            bytes = decodeBase64Zip(base64);
            fileName = response?.data?.filename || targetFile;
          } else {
            lastError = 'downloadSkyCareerDesktop returned no base64 payload';
          }
        } catch (fallbackFnError) {
          lastError = fallbackFnError?.message || String(fallbackFnError);
        }
      }

      if (!bytes) {
        const basePath = import.meta?.env?.BASE_URL || '/';
        const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
        const payloadFile = 'SkyCareer_MSFS_Bridge_Payload.zip';
        const payloadCandidates = [
          new URL(`downloads/${payloadFile}?v=${DOWNLOAD_CACHE_BUST}`, window.location.href).toString(),
          new URL(`${normalizedBase}downloads/${payloadFile}?v=${DOWNLOAD_CACHE_BUST}`, window.location.origin).toString(),
          new URL(`/downloads/${payloadFile}?v=${DOWNLOAD_CACHE_BUST}`, window.location.origin).toString(),
          `https://media.githubusercontent.com/media/ye6697/skycareerV1/main/public/downloads/${payloadFile}?v=${DOWNLOAD_CACHE_BUST}`,
        ];
        const bootstrapCandidates = [
          new URL(`downloads/${targetFile}?v=${DOWNLOAD_CACHE_BUST}`, window.location.href).toString(),
          new URL(`${normalizedBase}downloads/${targetFile}?v=${DOWNLOAD_CACHE_BUST}`, window.location.origin).toString(),
          new URL(`/downloads/${targetFile}?v=${DOWNLOAD_CACHE_BUST}`, window.location.origin).toString(),
          `https://media.githubusercontent.com/media/ye6697/skycareerV1/main/public/downloads/${targetFile}?v=${DOWNLOAD_CACHE_BUST}`,
        ];
        let bootstrapBytes = null;
        for (const bootUrl of bootstrapCandidates) {
          try {
            const res = await fetch(bootUrl, { cache: 'no-store' });
            if (!res.ok) {
              lastError = `HTTP ${res.status} @ ${bootUrl}`;
              continue;
            }
            const arr = new Uint8Array(await res.arrayBuffer());
            if (arr.length >= 4 && arr[0] === 0x50 && arr[1] === 0x4b) {
              bootstrapBytes = arr;
              break;
            }
            lastError = `Invalid ZIP bytes @ ${bootUrl}`;
          } catch (e) {
            lastError = `${e?.message || e} @ ${bootUrl}`;
          }
        }

        for (const payloadUrl of payloadCandidates) {
          try {
            const res = await fetch(payloadUrl, { cache: 'no-store' });
            if (!res.ok) {
              lastError = `HTTP ${res.status} @ ${payloadUrl}`;
              continue;
            }
            const arr = new Uint8Array(await res.arrayBuffer());
            if (arr.length < 4 || arr[0] !== 0x50 || arr[1] !== 0x4b) {
              lastError = `Invalid ZIP bytes @ ${payloadUrl}`;
              continue;
            }
            let patched = await personalizeBridgePayloadZip(arr, apiKey || '', endpoint);
            if (bootstrapBytes) {
              patched = await mergeBootstrapToolsIntoZip(patched, bootstrapBytes);
            }
            bytes = patched;
            fileName = 'SkyCareer_MSFS_Bridge_Windows_Fallback_Personalized.zip';
            break;
          } catch (e) {
            lastError = `${e?.message || e} @ ${payloadUrl}`;
          }
        }

        if (!bytes && bootstrapBytes) {
          bytes = bootstrapBytes;
          fileName = targetFile;
        }
      }

      if (!bytes) {
        throw new Error(lastError || 'Bridge download unavailable');
      }

      triggerZipDownload(bytes, fileName);
    } catch (error) {
      console.error('Error downloading SkyCareer MSFS bridge:', error);
      alert(text.downloadError);
    } finally {
      setDownloading(false);
    }
  };

  const downloadMsfsBridge = async () => {
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('downloadMSFSBridge', { endpoint });
      const blob = new Blob([response.data], { type: 'text/x-python' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SkyCareer_MSFS_Bridge.py';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error downloading MSFS Bridge:', error);
      alert(text.downloadError);
    } finally {
      setDownloading(false);
    }
  };

  const featureChips = lang === 'de'
    ? ['Position / Hoehe / Speed', 'G-Loads und Touchdown', 'Crash / Stall / Overspeed', 'Fuel und Engine-State', 'Auto Flight Completion', 'Live Event Tracking', 'Landing VS / Landing G', 'Maintenance und Reputation']
    : ['Position / Altitude / Speed', 'G-loads and Touchdown', 'Crash / Stall / Overspeed', 'Fuel and Engine State', 'Auto Flight Completion', 'Live Event Tracking', 'Landing VS / Landing G', 'Maintenance and Reputation'];

  const isBusy = downloading;

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_18%_0%,#17345f_0%,#0b1a32_44%,#060c17_100%)] p-3 sm:p-5">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <Card className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-[linear-gradient(135deg,#0e2b56_0%,#15427b_58%,#1d4f93_100%)] text-white shadow-[0_24px_72px_rgba(6,18,36,0.48)]">
          <div className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 sm:block">
            <img
              src="/skycareer-logo-clean.png"
              alt=""
              aria-hidden="true"
              className="h-44 w-44 opacity-[0.14] [filter:drop-shadow(0_0_24px_rgba(147,197,253,0.35))]"
            />
          </div>
          <div className="relative p-5 sm:p-7">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              {text.badge}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{text.title}</h1>
            <p className="mt-2 max-w-4xl text-sm sm:text-base text-cyan-100/90 leading-relaxed">{text.subtitle}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-1 text-xs font-medium text-cyan-100">MSFS 2020/2024</span>
              <span className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-1 text-xs font-medium text-cyan-100">X-Plane 12</span>
              <span className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-1 text-xs font-medium text-cyan-100">Account-bound API</span>
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-700/70 bg-slate-900/72 p-4 sm:p-5 text-slate-100 shadow-[0_14px_48px_rgba(0,0,0,0.4)] backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
            <Radio className="h-4 w-4 text-cyan-300" />
            {text.step1Title}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{text.step1Desc}</p>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-cyan-700/40 bg-gradient-to-b from-cyan-950/42 via-slate-900/75 to-slate-950/75 p-4 sm:p-5">
              <h3 className="text-lg font-semibold text-cyan-200 mb-2">{text.msfsTitle}</h3>
              <p className="text-sm text-slate-300 mb-4">{text.msfsDesc}</p>
              <div className="space-y-2.5">
                <Button className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/30" onClick={downloadSkyCareerDesktop} disabled={isBusy}>
                  {isBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  {isBusy ? text.loading : text.msfsBtn}
                </Button>
              </div>

              <div className="mt-4 rounded-xl border border-amber-700/45 bg-amber-900/18 p-3">
                <p className="text-sm font-semibold text-amber-200 mb-1">{text.msfsPyTitle}</p>
                <p className="text-xs text-slate-300 mb-2">{text.msfsPyDesc}</p>
                <Button className="w-full bg-amber-700 hover:bg-amber-600 text-white shadow-md shadow-amber-950/35" onClick={downloadMsfsBridge} disabled={isBusy}>
                  {isBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  {isBusy ? text.loading : text.msfsPyBtn}
                </Button>
                <p className="mt-2 text-[11px] text-slate-400">{text.msfsPyUsage}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-700/35 bg-gradient-to-b from-emerald-950/40 via-slate-900/75 to-slate-950/75 p-4 sm:p-5">
              <h3 className="text-lg font-semibold text-emerald-200 mb-2">{text.xpTitle}</h3>
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-700/30 bg-slate-950/60 p-3">
                  <p className="text-sm font-semibold text-emerald-200 mb-1">{text.luaTitle}</p>
                  <p className="text-xs text-slate-300 mb-2">{text.luaDesc}</p>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/35" onClick={downloadLua} disabled={isBusy}>
                    {isBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    {isBusy ? text.loading : text.luaBtn}
                  </Button>
                  <div className="mt-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">{text.luaReq}</span>
                    <a href="https://forums.x-plane.org/index.php?/files/file/38445-flywithlua-ng-next-generation-edition-for-x-plane-11-win-lin-mac/" target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200">
                      {text.luaLink}<ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-700/35 bg-slate-950/60 p-3">
                  <p className="text-sm font-semibold text-blue-200 mb-1">{text.pyTitle}</p>
                  <p className="text-xs text-slate-300 mb-2">{text.pyDesc}</p>
                  <Button className="w-full bg-blue-700 hover:bg-blue-600 text-white shadow-md shadow-blue-950/35" onClick={downloadPython} disabled={isBusy}>
                    {isBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    {isBusy ? text.loading : text.pyBtn}
                  </Button>
                  <div className="mt-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">{text.pyReq}</span>
                    <a href="https://xppython3.readthedocs.io" target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-blue-300 hover:text-blue-200">
                      {text.pyLink}<ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Card className="rounded-3xl border border-slate-700/70 bg-slate-900/72 p-4 sm:p-5 text-slate-100 shadow-[0_14px_48px_rgba(0,0,0,0.4)] backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
              <Wrench className="h-4 w-4 text-cyan-300" />
              {text.step2Title}
            </div>
            <p className="text-sm text-slate-300 mb-3">{text.step2Desc}</p>

            <div className="space-y-3">
              <div className="rounded-xl border border-cyan-800/45 bg-cyan-950/20 p-3">
                <p className="text-sm font-semibold text-cyan-200 mb-2">{text.installMsfsTitle}</p>
                <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                  <li>1. {text.installMsfs1}</li>
                  <li>2. {text.installMsfs2}</li>
                  <li>3. {text.installMsfs3}</li>
                  <li>4. {text.installMsfs4}</li>
                </ul>
              </div>

              <div className="rounded-xl border border-emerald-800/45 bg-emerald-950/20 p-3">
                <p className="text-sm font-semibold text-emerald-200 mb-2">{text.installXpTitle}</p>
                <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                  <li>{text.installXpLua1}</li>
                  <li>{text.installXpLua2}</li>
                  <li>{text.installXpLua3}</li>
                  <li className="pt-1">{text.installXpPy1}</li>
                  <li>{text.installXpPy2}</li>
                  <li>{text.installXpPy3}</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card className="rounded-3xl border border-slate-700/70 bg-slate-900/72 p-4 sm:p-5 text-slate-100 shadow-[0_14px_48px_rgba(0,0,0,0.4)] backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
              <ShieldCheck className="h-4 w-4 text-cyan-300" />
              {text.step3Title}
            </div>
            <p className="text-sm text-slate-300 mb-3">{text.step3Desc}</p>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs text-slate-400">{text.apiKey}</p>
                  <Button variant="ghost" size="sm" onClick={copyApiKey} className="h-7 px-2 text-xs text-slate-200 hover:text-white">
                    {copiedKey ? <><Check className="w-3 h-3 mr-1" />{text.copied}</> : <><Copy className="w-3 h-3 mr-1" />{text.copy}</>}
                  </Button>
                </div>
                <code className="block break-all text-sm text-emerald-300">{apiKey || text.loading}</code>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs text-slate-400">{text.endpoint}</p>
                  <Button variant="ghost" size="sm" onClick={copyEndpoint} className="h-7 px-2 text-xs text-slate-200 hover:text-white">
                    {copied ? <><Check className="w-3 h-3 mr-1" />{text.copied}</> : <><Copy className="w-3 h-3 mr-1" />{text.copy}</>}
                  </Button>
                </div>
                <code className="block break-all text-xs text-cyan-300">{endpoint}</code>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-400">{text.keyNote}</p>
          </Card>
        </div>

        <Card className="rounded-3xl border border-slate-700/70 bg-slate-900/72 p-4 sm:p-5 text-slate-100 shadow-[0_14px_48px_rgba(0,0,0,0.4)] backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
            <Rocket className="h-4 w-4 text-cyan-300" />
            {text.step4Title}
          </div>
          <p className="text-sm text-slate-300 mb-3">{text.step4Desc}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[text.flow1, text.flow2, text.flow3, text.flow4].map((item, idx) => (
              <div key={idx} className="rounded-xl border border-slate-700 bg-slate-950/65 p-3 text-slate-300">
                {idx + 1}. {item}
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Card className="rounded-3xl border border-slate-700/70 bg-slate-900/72 p-4 sm:p-5 text-slate-100 shadow-[0_14px_48px_rgba(0,0,0,0.4)] backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <Gauge className="h-5 w-5 text-cyan-300" />
              {text.techTitle}
            </h3>
            <p className="text-sm text-slate-300 mb-3">{text.techDesc}</p>
            <div className="mb-3 space-y-1 text-xs text-slate-300">
              <p>{text.freq}</p>
              <p>{text.protocol}</p>
              <p>{text.simulators}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {featureChips.map((feature, idx) => (
                <div key={idx} className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-2.5 py-1.5 text-xs text-emerald-200">
                  {feature}
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-3xl border border-blue-700/45 bg-gradient-to-b from-blue-950/28 to-slate-900/72 p-4 sm:p-5 text-slate-100 shadow-[0_14px_48px_rgba(0,0,0,0.4)] backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-blue-200 mb-2 flex items-center gap-2">
              <Bug className="h-5 w-5 text-blue-300" />
              {text.helpTitle}
            </h3>
            <ul className="space-y-2 text-sm text-slate-200 leading-relaxed">
              <li>- {text.help1}</li>
              <li>- {text.help2}</li>
              <li>- {text.help3}</li>
              <li>- {text.help4}</li>
              <li>- {text.help5}</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
