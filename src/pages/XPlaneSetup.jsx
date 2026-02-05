import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Plane,
  Download,
  Settings,
  CheckCircle,
  Code,
  ExternalLink,
  Wifi,
  Copy,
  Check
} from "lucide-react";

export default function XPlaneSetup() {
  const [copied, setCopied] = React.useState(false);
  const endpoint = `${window.location.origin}/api/receiveXPlaneData`;

  const copyEndpoint = () => {
    navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <h1 className="text-3xl font-bold text-white">X-Plane 12 Integration</h1>
          <p className="text-slate-400">Verbinde SkyCareer mit X-Plane 12 für Echtzeit-Flugdaten</p>
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
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Download className="w-4 h-4 mr-2" />
                  Plugin herunterladen
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
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
                <h3 className="text-lg font-semibold text-white mb-2">Plugin konfigurieren</h3>
                <p className="text-slate-400 mb-4">
                  Öffne die Plugin-Einstellungen in X-Plane und konfiguriere den API-Endpoint:
                </p>
                <div className="bg-slate-900 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">API Endpoint:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyEndpoint}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Kopiert
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Kopieren
                        </>
                      )}
                    </Button>
                  </div>
                  <code className="text-blue-400 text-sm break-all">{endpoint}</code>
                </div>
                <div className="space-y-2 text-sm text-slate-400">
                  <p>• Öffne X-Plane 12</p>
                  <p>• Gehe zu Plugins → SkyCareer → Settings</p>
                  <p>• Füge den API-Endpoint ein</p>
                  <p>• Klicke auf "Connect"</p>
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
                <h3 className="text-lg font-semibold text-white mb-2">Flug starten</h3>
                <p className="text-slate-400 mb-4">
                  Akzeptiere einen Auftrag, weise Crew und Flugzeug zu, und starte den Flug in X-Plane.
                </p>
                <div className="space-y-2 text-sm text-slate-400">
                  <p>• Das Plugin sendet automatisch Flugdaten an SkyCareer</p>
                  <p>• Der Flug wird in Echtzeit verfolgt</p>
                  <p>• Beim Parken wird der Flug automatisch beendet und bewertet</p>
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