import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Plane,
  Download,
  Settings,
  CheckCircle,
  Code,
  ExternalLink,
  Wifi,
  Copy,
  Check,
  Loader2
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function XPlaneSetup() {
  const { lang } = useLanguage();
  const [copied, setCopied] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [apiKey, setApiKey] = React.useState(null);
  const endpoint = `${window.location.origin}/api/receiveXPlaneData`;

  React.useEffect(() => {
    const ensureApiKey = async () => {
      const response = await base44.functions.invoke('ensureApiKey', {});
      setApiKey(response.data.api_key);
    };
    ensureApiKey();
  }, []);

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey || '');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const copyEndpoint = () => {
    navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadLua = async () => {
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('downloadFlyWithLua', {
        endpoint
      });
      
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
      alert(t('xps_download_error', lang));
    } finally {
      setDownloading(false);
    }
  };

  const downloadPython = async () => {
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('downloadPythonPlugin', {
        endpoint
      });
      
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
      alert(t('xps_download_error', lang));
    } finally {
      setDownloading(false);
    }
  };

  const decodeBase64Zip = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const downloadStaticZip = async (file, fallbackFunction = null) => {
    setDownloading(true);
    try {
      const basePath = import.meta?.env?.BASE_URL || '/';
      const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
      const candidates = [
        new URL(`downloads/${file}`, window.location.href).toString(),
        new URL(`${normalizedBase}downloads/${file}`, window.location.origin).toString(),
        new URL(`/downloads/${file}`, window.location.origin).toString(),
      ];

      let bytes = null;
      let lastError = null;

      for (const fileUrl of candidates) {
        try {
          const res = await fetch(fileUrl, { cache: 'no-store' });
          if (!res.ok) {
            lastError = `HTTP ${res.status} @ ${fileUrl}`;
            continue;
          }
          const arr = new Uint8Array(await res.arrayBuffer());
          if (arr.length >= 4 && arr[0] === 0x50 && arr[1] === 0x4b) {
            bytes = arr;
            break;
          }
          lastError = `Invalid ZIP bytes @ ${fileUrl}`;
        } catch (e) {
          lastError = `${e?.message || e} @ ${fileUrl}`;
        }
      }

      if (!bytes && fallbackFunction) {
        try {
          const response = await base44.functions.invoke(fallbackFunction, {});
          const base64 = response?.data?.base64;
          if (base64) {
            bytes = decodeBase64Zip(base64);
          }
        } catch (invokeError) {
          lastError = `${lastError || ''} | invoke: ${invokeError?.message || invokeError}`;
        }
      }

      if (!bytes) {
        throw new Error(lastError || 'Download path and fallback not reachable');
      }

      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error(`Error downloading ${file}:`, error);
      alert(t('xps_download_error', lang));
    } finally {
      setDownloading(false);
    }
  };

  const downloadSkyCareerDesktop = async () => {
    await downloadStaticZip('SkyCareer_Desktop_AllInOne_Windows.zip', 'downloadSkyCareerDesktop');
  };

  const downloadMsfsTablet = async () => {
    await downloadStaticZip('SkyCareer_MSFS_Ingame_Tablet.zip', 'downloadMSFSTablet');
  };

  const downloadMsfsBridge = async () => {
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('downloadMSFSBridge', {
        endpoint
      });
      
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
      alert(t('xps_download_error', lang));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Zibo Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-cyan-900/30 p-2 rounded-lg shadow-md">
        <div className="text-lg font-mono font-bold text-cyan-400 uppercase tracking-widest px-2">{t('xps_title', lang)}</div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Setup Steps */}
        <div className="space-y-6">
          {/* Step 1 */}
          <Card className="p-4 sm:p-6 bg-slate-800 border border-slate-700">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold text-sm sm:text-base">1</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-2">{t('xps_step1', lang)}</h3>
                <p className="text-sm text-slate-400 mb-4 break-words">
                  {t('xps_step1_desc', lang)}
                </p>
                <div className="space-y-4">
                  {/* FlyWithLua Option - Empfohlen */}
                  <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded">
                        {t('xps_recommended', lang)}
                      </div>
                      <h4 className="text-white font-semibold">{t('xps_lua_title', lang)}</h4>
                    </div>
                    <p className="text-sm text-slate-400 mb-3 break-words">
                      {t('xps_lua_desc', lang)}
                    </p>
                    <Button 
                      className="bg-emerald-600 hover:bg-emerald-700 w-full whitespace-normal h-auto py-2"
                      onClick={downloadLua}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                          {t('xps_loading', lang)}
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2 flex-shrink-0" />
                          {t('xps_lua_download', lang)}
                        </>
                      )}
                    </Button>
                    <div className="mt-3 bg-slate-900 rounded-lg p-3 space-y-2 text-xs">
                      <p className="text-slate-300"><strong>{t('xps_lua_req', lang)}</strong></p>
                      <a 
                        href="https://forums.x-plane.org/index.php?/files/file/38445-flywithlua-ng-next-generation-edition-for-x-plane-11-win-lin-mac/"
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        {t('xps_lua_link', lang)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* OR Divider */}
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-slate-600" />
                    <span className="text-amber-400 font-bold text-sm tracking-widest uppercase px-3 py-1 bg-amber-400/10 border border-amber-400/30 rounded-full">{t('xps_or', lang)}</span>
                    <div className="flex-1 h-px bg-slate-600" />
                  </div>

                  {/* Python Option */}
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                    <h4 className="text-white font-semibold mb-2">{t('xps_py_title', lang)}</h4>
                    <p className="text-sm text-slate-400 mb-3 break-words">
                      {t('xps_py_desc', lang)}
                    </p>
                    <Button 
                      className="w-full bg-black hover:bg-black/80 text-white border border-slate-600 whitespace-normal h-auto py-2"
                      onClick={downloadPython}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                          {t('xps_loading', lang)}
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2 flex-shrink-0" />
                          {t('xps_py_download', lang)}
                        </>
                      )}
                    </Button>
                    <div className="mt-3 bg-slate-950 rounded-lg p-3 space-y-2 text-xs">
                      <p className="text-slate-300"><strong>{t('xps_py_req', lang)}</strong></p>
                      <a 
                        href="https://xppython3.readthedocs.io"
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        {t('xps_py_link', lang)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* OR Divider */}
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-slate-600" />
                    <span className="text-cyan-400 font-bold text-sm tracking-widest uppercase px-3 py-1 bg-cyan-400/10 border border-cyan-400/30 rounded-full">
                      {lang === 'de' ? 'oder MSFS' : 'or MSFS'}
                    </span>
                    <div className="flex-1 h-px bg-slate-600" />
                  </div>

                  {/* MSFS Option */}
                  <div className="bg-cyan-900/10 border border-cyan-700/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="px-2 py-0.5 bg-cyan-600 text-white text-xs font-bold rounded">
                        {lang === 'de' ? 'NEU' : 'NEW'}
                      </div>
                      <h4 className="text-white font-semibold">
                        {lang === 'de' ? 'SkyCareer Desktop (MSFS 2020/2024)' : 'SkyCareer Desktop (MSFS 2020/2024)'}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-400 mb-3 break-words">
                      {lang === 'de'
                        ? 'Native Windows App mit integriertem WebView + SimConnect-Bridge. Kein Python noetig. Funktioniert mit Microsoft Flight Simulator 2020 und 2024.'
                        : 'Native Windows app with integrated webview + SimConnect bridge. No Python required. Works with Microsoft Flight Simulator 2020 and 2024.'}
                    </p>
                    <Button
                      className="w-full bg-cyan-600 hover:bg-cyan-700 whitespace-normal h-auto py-2"
                      onClick={downloadSkyCareerDesktop}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                          {t('xps_loading', lang)}
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2 flex-shrink-0" />
                          {lang === 'de' ? 'SkyCareer Desktop (All-in-One) herunterladen' : 'Download SkyCareer Desktop (all-in-one)'}
                        </>
                      )}
                    </Button>
                    <Button
                      className="w-full mt-2 bg-slate-700 hover:bg-slate-600 whitespace-normal h-auto py-2"
                      onClick={downloadMsfsTablet}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                          {t('xps_loading', lang)}
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2 flex-shrink-0" />
                          {lang === 'de' ? 'MSFS Ingame Tablet (WebView) herunterladen' : 'Download MSFS ingame tablet (WebView)'}
                        </>
                      )}
                    </Button>
                    <div className="mt-3 bg-slate-950 rounded-lg p-3 space-y-2 text-xs">
                      <p className="text-slate-300">
                        <strong>{lang === 'de' ? 'Benoetigt:' : 'Requires:'}</strong> WebView2 Runtime (meist schon installiert)
                      </p>
                      <p className="text-slate-400">
                        {lang === 'de'
                          ? 'All-in-One ZIP: entpacken und SkyCareerDesktop.exe starten. Bridge startet automatisch.'
                          : 'All-in-one ZIP: unzip and start SkyCareerDesktop.exe. Bridge starts automatically.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 2 */}
          <Card className="p-4 sm:p-6 bg-slate-800 border border-slate-700">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold text-sm sm:text-base">2</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-2">{t('xps_step2', lang)}</h3>
                <p className="text-sm text-slate-400 mb-4 break-words">
                  {t('xps_step2_desc', lang)}
                </p>
                <div className="space-y-4">
                  {/* FlyWithLua Installation */}
                  <div className="bg-emerald-900/10 border border-emerald-700/30 rounded-lg p-4">
                    <h4 className="text-emerald-400 font-semibold mb-3">{t('xps_lua_title', lang)}</h4>
                    <div className="space-y-3 text-sm">
                      <div className="bg-slate-900 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">1. {lang === 'de' ? 'Installiere FlyWithLua (falls noch nicht vorhanden)' : 'Install FlyWithLua (if not already installed)'}</p>
                        <p className="text-xs text-slate-400">{lang === 'de' ? 'Nach' : 'To'}:</p>
                        <code className="text-xs text-emerald-400 block mt-1 break-all">X-Plane 12/Resources/plugins/FlyWithLua/</code>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">2. {lang === 'de' ? 'Kopiere SkyCareer.lua' : 'Copy SkyCareer.lua'}</p>
                        <p className="text-xs text-slate-400">{lang === 'de' ? 'Nach' : 'To'}:</p>
                        <code className="text-xs text-emerald-400 block mt-1 break-all">X-Plane 12/Resources/plugins/FlyWithLua/Scripts/</code>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">3. {lang === 'de' ? 'Starte X-Plane 12 neu' : 'Restart X-Plane 12'}</p>
                        <p className="text-xs text-slate-400">{lang === 'de' ? 'Das Script wird automatisch geladen' : 'The script will be loaded automatically'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Python Installation */}
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                    <h4 className="text-slate-400 font-semibold mb-3">{t('xps_py_title', lang)}</h4>
                    <div className="space-y-3 text-sm">
                      <div className="bg-slate-950 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">1. {lang === 'de' ? 'Installiere XPPython3' : 'Install XPPython3'}</p>
                        <code className="text-xs text-blue-400 block mt-1 break-all">X-Plane 12/Resources/plugins/XPPython3/</code>
                      </div>
                      <div className="bg-slate-950 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">2. {lang === 'de' ? 'Erstelle Ordner "SkyCareer"' : 'Create folder "SkyCareer"'}</p>
                        <code className="text-xs text-blue-400 block mt-1 break-all">X-Plane 12/Resources/plugins/PythonPlugins/SkyCareer/</code>
                      </div>
                      <div className="bg-slate-950 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">3. {lang === 'de' ? 'Kopiere die Dateien aus der .txt in den Ordner' : 'Copy the files from the .txt into the folder'}</p>
                        <p className="text-xs text-slate-400">PI_SkyCareer.py {lang === 'de' ? 'und' : 'and'} README.md</p>
                      </div>
                    </div>
                  </div>

                  {/* MSFS Installation */}
                  <div className="bg-cyan-900/10 border border-cyan-700/30 rounded-lg p-4">
                    <h4 className="text-cyan-300 font-semibold mb-3">
                      {lang === 'de' ? 'MSFS 2020/2024 Installation' : 'MSFS 2020/2024 installation'}
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="bg-slate-900 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">1. {lang === 'de' ? 'ZIP entpacken' : 'Extract the ZIP'}</p>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">2. {lang === 'de' ? 'MSFS starten' : 'Start MSFS'}</p>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">
                          3. {lang === 'de'
                            ? 'SkyCareerDesktop.exe starten (Bridge ist integriert und startet automatisch)'
                            : 'Start SkyCareerDesktop.exe (bridge is integrated and starts automatically)'}
                        </p>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">
                          4. {lang === 'de'
                            ? 'Optional: Ingame-Tablet ZIP entpacken und Ordner SkyCareer_MSFS_Ingame_Tablet in den Community-Ordner kopieren'
                            : 'Optional: Extract ingame tablet ZIP and copy SkyCareer_MSFS_Ingame_Tablet folder to Community'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {lang === 'de'
                            ? 'Im Simulator ueber Toolbar-Icon SkyCareer oeffnen. 3D-Template liegt im Paket unter html_ui/SkyCareerTablet3D.'
                            : 'Open it via toolbar icon SkyCareer. 3D template is inside the package at html_ui/SkyCareerTablet3D.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 3 */}
          <Card className="p-4 sm:p-6 bg-slate-800 border border-slate-700">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold text-sm sm:text-base">3</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-2">{t('xps_step3', lang)}</h3>
                <p className="text-sm text-slate-400 mb-4 break-words">
                  {t('xps_step3_desc', lang)}
                </p>
                <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                   <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                   <p className="text-emerald-300 font-medium text-sm break-words">{t('xps_auto_configured', lang)}</p>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    {t('xps_api_key_info', lang)}
                  </p>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-slate-400">{t('xps_your_api_key', lang)}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyApiKey}
                        className="h-6 px-2 text-xs"
                      >
                        {copiedKey ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            {t('xps_copied', lang)}
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            {t('xps_copy', lang)}
                          </>
                        )}
                      </Button>
                    </div>
                    <code className="text-emerald-400 text-sm font-mono break-all block">
                      {apiKey || t('xps_loading', lang)}
                    </code>
                    <p className="text-xs text-slate-500 mt-2">
                      {t('xps_key_note', lang)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 4 */}
          <Card className="p-4 sm:p-6 bg-slate-800 border border-slate-700">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold text-sm sm:text-base">4</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-2">{t('xps_step4', lang)}</h3>
                <p className="text-sm text-slate-400 mb-4 break-words">
                  {t('xps_step4_desc', lang)}
                </p>
                <div className="space-y-3 text-sm">
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-slate-300 mb-2">1. {t('xps_fly1', lang)}</p>
                    <p className="text-xs text-slate-400">{t('xps_fly1_sub', lang)}</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-slate-300 mb-2">2. {t('xps_fly2', lang)}</p>
                    <p className="text-xs text-slate-400">{t('xps_fly2_sub', lang)}</p>
                  </div>
                  <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
                    <p className="text-amber-300 font-medium mb-1">⏳ {t('xps_fly_wait', lang)}</p>
                    <p className="text-xs text-slate-400">
                      {t('xps_fly_wait_desc', lang)}
                    </p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-slate-300 mb-2">3. {t('xps_fly3', lang)}</p>
                    <p className="text-xs text-slate-400">{t('xps_fly3_sub', lang)}</p>
                  </div>
                  <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3">
                    <p className="text-emerald-300 font-medium mb-1">✈️ {t('xps_fly_auto', lang)}</p>
                    <p className="text-xs text-slate-400">
                      {t('xps_fly_auto_desc', lang)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Features */}
          <Card className="p-4 sm:p-6 bg-slate-800 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-blue-400" />
              {t('xps_data_title', lang)}
            </h3>
            <p className="text-sm text-slate-400 mb-4">{t('xps_data_desc', lang)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {(lang === 'de' ? [
                'Höhe (ft)', 'Geschwindigkeit (kts)', 'Vertikalgeschwindigkeit (ft/min)',
                'Kurs / Heading', 'Treibstoffstand (%)', 'Treibstoff (kg)',
                'G-Kräfte (aktuell)', 'Max G-Kräfte', 'Lande-G-Kraft',
                'Position (Lat/Lon)', 'Bodenkontakt', 'Parkbremse',
                'Triebwerksstatus', 'Tailstrike-Erkennung', 'Strömungsabriss (Stall)',
                'Strukturbelastung (Overstress)', 'Overspeed', 'Klappen-Overspeed',
                'Treibstoff-Notstand', 'Fahrwerk-Status', 'Crash-Erkennung',
                'Steuerinput-Intensität', 'Lande-Vertikalgeschw.', 'Abflug-Koordinaten',
                'Ziel-Koordinaten', 'Flug-Score (0-100)', 'Reputation',
                'Wartungskosten (live)', 'Landequalitäts-Typ', 'Lande-Bonus'
              ] : [
                'Altitude (ft)', 'Speed (kts)', 'Vertical Speed (ft/min)',
                'Heading', 'Fuel Level (%)', 'Fuel (kg)',
                'G-Forces (current)', 'Max G-Forces', 'Landing G-Force',
                'Position (Lat/Lon)', 'Ground Contact', 'Parking Brake',
                'Engine Status', 'Tailstrike Detection', 'Stall Detection',
                'Structural Stress', 'Overspeed', 'Flaps Overspeed',
                'Fuel Emergency', 'Gear Status', 'Crash Detection',
                'Control Input Intensity', 'Landing V/S', 'Departure Coordinates',
                'Destination Coordinates', 'Flight Score (0-100)', 'Reputation',
                'Maintenance Cost (live)', 'Landing Quality Type', 'Landing Bonus'
              ]).map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-slate-300 py-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Technical Details */}
          <Card className="p-4 sm:p-6 bg-slate-800 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-purple-400" />
              {t('xps_tech_title', lang)}
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-400">{t('xps_protocol', lang)}:</span>
                <span className="ml-2 text-white">HTTPS POST</span>
              </div>
              <div>
                <span className="text-slate-400">{t('xps_frequency', lang)}:</span>
                <span className="ml-2 text-white">1 Hz ({lang === 'de' ? 'jede Sekunde' : 'every second'})</span>
              </div>
              <div>
                <span className="text-slate-400">{t('xps_auto_complete', lang)}:</span>
                <span className="ml-2 text-white">{lang === 'de' ? 'Ja (bei Parkposition + Parkbremse + Triebwerke aus)' : 'Yes (at parking + parking brake + engines off)'}</span>
              </div>
              <div>
                <span className="text-slate-400">{t('xps_requirements', lang)}:</span>
                <span className="ml-2 text-white">X-Plane 12.0+, MSFS 2020, MSFS 2024</span>
              </div>
            </div>
          </Card>

          {/* Help */}
          <Card className="p-4 sm:p-6 bg-blue-900/20 border border-blue-700/50">
            <h3 className="text-lg font-semibold text-blue-300 mb-2">{t('xps_help_title', lang)}</h3>
            <p className="text-slate-300 text-sm mb-4">
              {t('xps_help_desc', lang)}
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              {lang === 'de' ? (
                <>
                  <li>• X-Plane 12 oder MSFS 2020/2024 ist geöffnet</li>
                  <li>• Das Plugin/Bridge-Skript ist korrekt installiert und gestartet</li>
                  <li>• Der API-Endpoint ist korrekt konfiguriert</li>
                  <li>• Du hast einen aktiven Flug in SkyCareer gestartet</li>
                  <li>• Deine Firewall blockiert keine Verbindungen</li>
                </>
              ) : (
                <>
                  <li>• X-Plane 12 or MSFS 2020/2024 is open</li>
                  <li>• The plugin/bridge script is correctly installed and running</li>
                  <li>• The API endpoint is correctly configured</li>
                  <li>• You have an active flight in SkyCareer</li>
                  <li>• Your firewall is not blocking connections</li>
                </>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}