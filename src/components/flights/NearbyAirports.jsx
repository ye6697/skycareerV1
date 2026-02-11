import React, { useEffect, useState, useRef } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { base44 } from '@/api/base44Client';

// Airport icon - small circle with runway
function createAirportIcon() {
  return new L.DivIcon({
    html: `<div style="width:10px;height:10px;background:rgba(148,163,184,0.7);border-radius:50%;border:1.5px solid rgba(226,232,240,0.5);"></div>`,
    className: '',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

function createRunwayIcon(heading) {
  const rot = heading || 0;
  return new L.DivIcon({
    html: `<div style="transform:rotate(${rot}deg);width:3px;height:24px;background:rgba(226,232,240,0.6);border-radius:1px;"></div>`,
    className: '',
    iconSize: [3, 24],
    iconAnchor: [1.5, 12],
  });
}

const airportIcon = createAirportIcon();

// Haversine distance in NM
function distanceNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function NearbyAirports({ latitude, longitude, radiusNm = 100 }) {
  const [airports, setAirports] = useState([]);
  const lastFetch = useRef({ lat: 0, lon: 0 });

  useEffect(() => {
    if (!latitude || !longitude) return;
    // Only re-fetch if moved more than ~30nm from last fetch point
    const moved = distanceNm(lastFetch.current.lat, lastFetch.current.lon, latitude, longitude);
    if (airports.length > 0 && moved < 30) return;

    let cancelled = false;

    async function fetchAirports() {
      try {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `List airports within ${radiusNm} nautical miles of coordinates ${latitude.toFixed(3)}, ${longitude.toFixed(3)}.
For each airport provide: icao code, name, latitude, longitude, and primary runway heading (degrees magnetic).
Include major international airports AND smaller regional/GA airports.
Return 10-20 airports maximum, prioritize the closest ones.`,
          response_json_schema: {
            type: "object",
            properties: {
              airports: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    icao: { type: "string" },
                    name: { type: "string" },
                    lat: { type: "number" },
                    lon: { type: "number" },
                    runway_heading: { type: "number" }
                  },
                  required: ["icao", "lat", "lon"]
                }
              }
            }
          }
        });

        if (!cancelled && result?.airports) {
          // Filter to actual radius
          const filtered = result.airports.filter(ap =>
            distanceNm(latitude, longitude, ap.lat, ap.lon) <= radiusNm
          );
          setAirports(filtered);
          lastFetch.current = { lat: latitude, lon: longitude };
        }
      } catch (e) {
        // Silently fail - airports are decorative
      }
    }

    fetchAirports();
    return () => { cancelled = true; };
  }, [latitude, longitude, radiusNm]);

  if (airports.length === 0) return null;

  return (
    <>
      {airports.map((ap) => (
        <React.Fragment key={ap.icao}>
          <Marker position={[ap.lat, ap.lon]} icon={airportIcon}>
            <Tooltip direction="right" offset={[8, 0]} className="waypoint-label">
              <span style={{
                fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8',
                background: 'rgba(15,23,42,0.9)', padding: '1px 4px', borderRadius: '3px',
                border: '1px solid #334155'
              }}>
                {ap.icao}
              </span>
            </Tooltip>
          </Marker>
          {ap.runway_heading != null && (
            <Marker
              position={[ap.lat, ap.lon]}
              icon={createRunwayIcon(ap.runway_heading)}
              interactive={false}
            />
          )}
        </React.Fragment>
      ))}
    </>
  );
}