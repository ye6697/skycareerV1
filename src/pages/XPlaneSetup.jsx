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
  const [downloading, setDownloading] = React.useState(false);
  const endpoint = `${window.location.origin}/api/receiveXPlaneData`;

  const copyEndpoint = () => {
    navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPlugin = async () => {
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('generateXPlanePlugin', {
        endpoint
      });
      
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SkyCareer-XPlane-Plugin.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error downloading plugin:', error);
      alert('Fehler beim Herunterladen des Plugins');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto p-6">
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
          <Card className="p-6 bg-slate-800 border border-slate-700">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold">1</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Plugin herunterladen</h3>
                <p className="text-slate-400 mb-4">
                  Lade das SkyCareer X-Plane Plugin herunter und installiere es in deinem X-Plane 12 Verzeichnis.
                </p>
                <div className="space-y-3">
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={downloadPlugin}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generiere Plugin...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Plugin herunterladen (.zip)
                      </>
                    )}
                  </Button>
                  <div className="bg-slate-900 rounded-lg p-3 space-y-2 text-xs text-slate-400">
                    <p><strong className="text-slate-300">Voraussetzung:</strong> XPPython3 Plugin</p>
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
          </Card>

          {/* Step 2 */}
          <Card className="p-6 bg-slate-800 border border-slate-700">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold">2</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Plugin installieren</h3>
                <p className="text-slate-400 mb-4">
                  Entpacke die ZIP-Datei und installiere das Plugin:
                </p>
                <div className="space-y-3 text-sm">
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-slate-300 mb-2">1. Installiere XPPython3 (falls noch nicht geschehen)</p>
                    <p className="text-xs text-slate-400">Entpacke XPPython3 nach:</p>
                    <code className="text-xs text-blue-400 block mt-1">X-Plane 12/Resources/plugins/XPPython3/</code>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-slate-300 mb-2">2. Installiere SkyCareer Plugin</p>
                    <p className="text-xs text-slate-400">Entpacke den SkyCareer Ordner nach:</p>
                    <code className="text-xs text-blue-400 block mt-1">X-Plane 12/Resources/plugins/PythonPlugins/</code>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-slate-300 mb-2">3. Starte X-Plane 12 neu</p>
                    <p className="text-xs text-slate-400">Das Plugin sollte automatisch geladen werden</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 3 */}
          <Card className="p-6 bg-slate-800 border border-slate-700">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold">3</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Flug konfigurieren</h3>
                <p className="text-slate-400 mb-4">
                  Erstelle die Konfigurationsdatei für deinen Flug:
                </p>
                <div className="bg-slate-900 rounded-lg p-4 mb-4">
                  <p className="text-xs text-slate-400 mb-2">Erstelle diese Datei:</p>
                  <code className="text-blue-400 text-xs block mb-3">
                    X-Plane 12/Output/preferences/SkyCareer_config.txt
                  </code>
                  <p className="text-xs text-slate-400 mb-2">Mit folgendem Inhalt:</p>
                  <pre className="text-blue-400 text-xs bg-slate-950 p-3 rounded overflow-x-auto">
{`{
  "flight_id": "DEINE_FLIGHT_ID",
  "api_endpoint": "${endpoint}"
}`}
                  </pre>
                </div>
                <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
                  <p className="text-xs text-amber-300">
                    💡 Die Flight ID findest du in der URL, wenn du einen Flug im Flight Tracker öffnest
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 4 */}
          <Card className="p-6 bg-slate-800 border border-slate-700">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold">4</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Flug durchführen</h3>
                <p className="text-slate-400 mb-4">
                  Starte deinen Flug in X-Plane 12:
                </p>
                <div className="space-y-2 text-sm text-slate-400">
                  <p>• Lade das richtige Flugzeug und den Startflughafen in X-Plane</p>
                  <p>• Das Plugin sendet automatisch Flugdaten, sobald du abhebst</p>
                  <p>• Der Flug wird in Echtzeit verfolgt</p>
                  <p>• <strong className="text-emerald-400">Automatischer Abschluss:</strong> Lande, parke, stelle die Triebwerke ab → Flug wird automatisch beendet und bewertet!</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Features */}
          <Card className="p-6 bg-slate-800 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-blue-400" />
              Übertragene Daten
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                'Höhe',
                'Geschwindigkeit',
                'Vertikalgeschwindigkeit',
                'Kurs',
                'Treibstoffstand',
                'G-Kräfte',
                'Position (GPS)',
                'Bodenkontakt',
                'Parkbremse',
                'Triebwerksstatus'
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-slate-300">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Technical Details */}
          <Card className="p-6 bg-slate-800 border border-slate-700">
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
          <Card className="p-6 bg-blue-900/20 border border-blue-700/50">
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