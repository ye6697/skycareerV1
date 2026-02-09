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

export default function XPlaneSetup() {
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
      alert('Fehler beim Herunterladen');
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
      alert('Fehler beim Herunterladen');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link to={createPageUrl("Dashboard")} className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">
            ← Zurück zum Dashboard
          </Link>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">X-Plane 12 Integration</h1>
          <p className="text-sm lg:text-base text-slate-400">Verbinde SkyCareer mit X-Plane 12 für Echtzeit-Flugdaten</p>
        </motion.div>

        {/* Setup Steps */}
        <div className="space-y-6">
          {/* Step 1 */}
          <Card className="p-4 sm:p-6 bg-slate-800 border border-slate-700">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold text-sm sm:text-base">1</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-2">Plugin herunterladen</h3>
                <p className="text-sm text-slate-400 mb-4 break-words">
                  Wähle eine der beiden Methoden – FlyWithLua ist empfohlen für einfachere Installation:
                </p>
                <div className="space-y-4">
                  {/* FlyWithLua Option - Empfohlen */}
                  <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded">
                        EMPFOHLEN
                      </div>
                      <h4 className="text-white font-semibold">FlyWithLua Script</h4>
                    </div>
                    <p className="text-sm text-slate-400 mb-3 break-words">
                      Einfachste Methode – funktioniert mit dem beliebten FlyWithLua Plugin
                    </p>
                    <Button 
                      className="bg-emerald-600 hover:bg-emerald-700 w-full whitespace-normal h-auto py-2"
                      onClick={downloadLua}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                          Lädt...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2 flex-shrink-0" />
                          SkyCareer V1 herunterladen (.lua)
                        </>
                      )}
                    </Button>
                    <div className="mt-3 bg-slate-900 rounded-lg p-3 space-y-2 text-xs">
                      <p className="text-slate-300"><strong>Voraussetzung:</strong> FlyWithLua Plugin</p>
                      <a 
                        href="https://forums.x-plane.org/index.php?/files/file/38445-flywithlua-ng-next-generation-edition-for-x-plane-11-win-lin-mac/"
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        FlyWithLua herunterladen
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* OR Divider */}
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-slate-600" />
                    <span className="text-amber-400 font-bold text-sm tracking-widest uppercase px-3 py-1 bg-amber-400/10 border border-amber-400/30 rounded-full">ODER</span>
                    <div className="flex-1 h-px bg-slate-600" />
                  </div>

                  {/* Python Option */}
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                    <h4 className="text-white font-semibold mb-2">Python Plugin (XPPython3)</h4>
                    <p className="text-sm text-slate-400 mb-3 break-words">
                      Alternative Methode mit XPPython3
                    </p>
                    <Button 
                      className="w-full bg-black hover:bg-black/80 text-white border border-slate-600 whitespace-normal h-auto py-2"
                      onClick={downloadPython}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                          Lädt...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2 flex-shrink-0" />
                          Python Plugin herunterladen (.txt)
                        </>
                      )}
                    </Button>
                    <div className="mt-3 bg-slate-950 rounded-lg p-3 space-y-2 text-xs">
                      <p className="text-slate-300"><strong>Voraussetzung:</strong> XPPython3</p>
                      <a 
                        href="https://xppython3.readthedocs.io"
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        XPPython3 herunterladen
                        <ExternalLink className="w-3 h-3" />
                      </a>
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
                <h3 className="text-lg font-semibold text-white mb-2">Installation</h3>
                <p className="text-sm text-slate-400 mb-4 break-words">
                  Je nach gewählter Methode:
                </p>
                <div className="space-y-4">
                  {/* FlyWithLua Installation */}
                  <div className="bg-emerald-900/10 border border-emerald-700/30 rounded-lg p-4">
                    <h4 className="text-emerald-400 font-semibold mb-3">FlyWithLua Script</h4>
                    <div className="space-y-3 text-sm">
                      <div className="bg-slate-900 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">1. Installiere FlyWithLua (falls noch nicht vorhanden)</p>
                        <p className="text-xs text-slate-400">Nach:</p>
                        <code className="text-xs text-emerald-400 block mt-1 break-all">X-Plane 12/Resources/plugins/FlyWithLua/</code>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">2. Kopiere SkyCareer.lua</p>
                        <p className="text-xs text-slate-400">Nach:</p>
                        <code className="text-xs text-emerald-400 block mt-1 break-all">X-Plane 12/Resources/plugins/FlyWithLua/Scripts/</code>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">3. Starte X-Plane 12 neu</p>
                        <p className="text-xs text-slate-400">Das Script wird automatisch geladen</p>
                      </div>
                    </div>
                  </div>

                  {/* Python Installation */}
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                    <h4 className="text-slate-400 font-semibold mb-3">Python Plugin</h4>
                    <div className="space-y-3 text-sm">
                      <div className="bg-slate-950 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">1. Installiere XPPython3</p>
                        <code className="text-xs text-blue-400 block mt-1 break-all">X-Plane 12/Resources/plugins/XPPython3/</code>
                      </div>
                      <div className="bg-slate-950 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">2. Erstelle Ordner "SkyCareer"</p>
                        <code className="text-xs text-blue-400 block mt-1 break-all">X-Plane 12/Resources/plugins/PythonPlugins/SkyCareer/</code>
                      </div>
                      <div className="bg-slate-950 rounded-lg p-3">
                        <p className="text-slate-300 mb-2">3. Kopiere die Dateien aus der .txt in den Ordner</p>
                        <p className="text-xs text-slate-400">PI_SkyCareer.py und README.md</p>
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
                <h3 className="text-lg font-semibold text-white mb-2">Fertig - keine weitere Konfiguration nötig!</h3>
                <p className="text-sm text-slate-400 mb-4 break-words">
                  Das Plugin ist bereits mit deiner Company ID vorkonfiguriert:
                </p>
                <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                   <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                   <p className="text-emerald-300 font-medium text-sm break-words">Automatisch konfiguriert mit individuellem API-Key</p>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    Das Plugin enthält deinen persönlichen API-Key und sendet die Daten nur an deinen Account!
                  </p>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-slate-400">Dein persönlicher API-Key:</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyApiKey}
                        className="h-6 px-2 text-xs"
                      >
                        {copiedKey ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Kopiert
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            Kopieren
                          </>
                        )}
                      </Button>
                    </div>
                    <code className="text-emerald-400 text-sm font-mono break-all block">
                      {apiKey || 'Lädt...'}
                    </code>
                    <p className="text-xs text-slate-500 mt-2">
                      ⚠️ Dieser Key bleibt dauerhaft gleich und ist bereits im heruntergeladenen Script enthalten
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
                <h3 className="text-lg font-semibold text-white mb-2">Flug durchführen</h3>
                <p className="text-sm text-slate-400 mb-4 break-words">
                  So verwendest du das Plugin:
                </p>
                <div className="space-y-3 text-sm">
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-slate-300 mb-2">1. Auftrag in SkyCareer annehmen und Flug vorbereiten</p>
                    <p className="text-xs text-slate-400">Weise Flugzeug und Crew zu und klicke auf "Flug starten"</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-slate-300 mb-2">2. X-Plane 12 laden</p>
                    <p className="text-xs text-slate-400">Richtiges Flugzeug, Startflughafen (ICAO), Payload-Gewicht einstellen</p>
                  </div>
                  <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
                    <p className="text-amber-300 font-medium mb-1">⏳ Warte auf Abheben</p>
                    <p className="text-xs text-slate-400">
                      SkyCareer wartet geduldig, bis du in X-Plane tatsächlich abhebst.<br/>
                      Solange du am Boden bist, passiert nichts – keine Kosten, kein Scoring.<br/>
                      Du kannst dir so viel Zeit lassen wie du möchtest!
                    </p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-slate-300 mb-2">3. Flug durchführen</p>
                    <p className="text-xs text-slate-400">Das Plugin überträgt automatisch alle Daten sobald du abhebst</p>
                  </div>
                  <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3">
                    <p className="text-emerald-300 font-medium mb-1">✈️ Automatische Flugbeendigung</p>
                    <p className="text-xs text-slate-400">
                      Lande → Parke → Parkbremse setzen → Triebwerke abstellen<br/>
                      → Flug wird automatisch beendet und bewertet!
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
              Übertragene & verarbeitete Daten
            </h3>
            <p className="text-sm text-slate-400 mb-4">Alle Datenpunkte die jede Sekunde von X-Plane empfangen und ausgewertet werden:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {[
                'Höhe (ft)',
                'Geschwindigkeit (kts)',
                'Vertikalgeschwindigkeit (ft/min)',
                'Kurs / Heading',
                'Treibstoffstand (%)',
                'Treibstoff (kg)',
                'G-Kräfte (aktuell)',
                'Max G-Kräfte',
                'Lande-G-Kraft',
                'Position (Lat/Lon)',
                'Bodenkontakt (on_ground)',
                'Parkbremse',
                'Triebwerksstatus',
                'Tailstrike-Erkennung',
                'Strömungsabriss (Stall)',
                'Strukturbelastung (Overstress)',
                'Overspeed',
                'Klappen-Overspeed',
                'Treibstoff-Notstand',
                'Fahrwerk-Status',
                'Crash-Erkennung',
                'Steuerinput-Intensität',
                'Lande-Vertikalgeschw.',
                'Abflug-Koordinaten',
                'Ziel-Koordinaten',
                'Flug-Score (0-100)',
                'Reputation',
                'Wartungskosten (live)',
                'Landequalitäts-Typ',
                'Lande-Bonus'
              ].map((feature, index) => (
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
              Technische Details
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-400">Protokoll:</span>
                <span className="ml-2 text-white">HTTPS POST</span>
              </div>
              <div>
                <span className="text-slate-400">Update-Frequenz:</span>
                <span className="ml-2 text-white">1 Hz (jede Sekunde)</span>
              </div>
              <div>
                <span className="text-slate-400">Automatische Beendigung:</span>
                <span className="ml-2 text-white">Ja (bei Parkposition + Parkbremse + Triebwerke aus)</span>
              </div>
              <div>
                <span className="text-slate-400">Anforderungen:</span>
                <span className="ml-2 text-white">X-Plane 12.0 oder höher</span>
              </div>
            </div>
          </Card>

          {/* Help */}
          <Card className="p-4 sm:p-6 bg-blue-900/20 border border-blue-700/50">
            <h3 className="text-lg font-semibold text-blue-300 mb-2">Benötigst du Hilfe?</h3>
            <p className="text-slate-300 text-sm mb-4">
              Falls das Plugin nicht funktioniert, überprüfe:
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>• X-Plane 12 ist geöffnet</li>
              <li>• Das Plugin ist korrekt installiert</li>
              <li>• Der API-Endpoint ist korrekt konfiguriert</li>
              <li>• Du hast einen aktiven Flug in SkyCareer gestartet</li>
              <li>• Deine Firewall blockiert keine Verbindungen</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}