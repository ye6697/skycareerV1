import React, { useEffect, useState, useRef } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { base44 } from '@/api/base44Client';

function createRunwayAirportIcon() {
  return new L.DivIcon({
    html: `<div style="width:10px;height:10px;background:rgba(148,163,184,0.7);border-radius:50%;border:1.5px solid rgba(226,232,240,0.5);"></div>`,
    className: '',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

function createSmallRunwayIcon(heading) {
  const rot = heading || 0;
  return new L.DivIcon({
    html: `<div style="transform:rotate(${rot}deg);width:3px;height:20px;background:rgba(226,232,240,0.5);border-radius:1px;"></div>`,
    className: '',
    iconSize: [3, 20],
    iconAnchor: [1.5, 10],
  });
}

const airportIcon = createRunwayAirportIcon();

function distanceNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Calculate perpendicular distance from a point to a line (dep->arr) in NM
function perpendicularDistanceNm(pointLat, pointLon, depLat, depLon, arrLat, arrLon) {
  // Project point onto line dep->arr
  const dx = arrLon - depLon;
  const dy = arrLat - depLat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distanceNm(pointLat, pointLon, depLat, depLon);
  
  let t = ((pointLon - depLon) * dx + (pointLat - depLat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  
  const projLat = depLat + t * dy;
  const projLon = depLon + t * dx;
  
  return distanceNm(pointLat, pointLon, projLat, projLon);
}

export default function RouteCorridorAirports({ depLat, depLon, arrLat, arrLon, corridorWidthNm = 100, depIcao, arrIcao }) {
  const [airports, setAirports] = useState([]);
  const fetched = useRef(false);

  useEffect(() => {
    if (!depLat || !depLon || !arrLat || !arrLon) return;
    if (fetched.current) return;
    fetched.current = true;

    async function fetchAirports() {
      try {
        const midLat = (depLat + arrLat) / 2;
        const midLon = (depLon + arrLon) / 2;
        const routeDist = distanceNm(depLat, depLon, arrLat, arrLon);
        const searchRadius = Math.min(Math.max(routeDist / 2 + corridorWidthNm, 150), 500);

        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `List ALL airports with runways within a ${Math.round(searchRadius)}nm radius of coordinates ${midLat.toFixed(2)}, ${midLon.toFixed(2)}.
Include major international, regional, and military airports. For each provide: icao code, latitude, longitude, runway_heading (primary runway magnetic heading in degrees).
Return up to 30 airports. Focus on airports that have paved runways.`,
          response_json_schema: {
            type: "object",
            properties: {
              airports: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    icao: { type: "string" },
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

        if (result?.airports) {
          // Filter airports within corridor (perpendicular distance <= corridorWidthNm/2)
          const halfWidth = corridorWidthNm / 2;
          const filtered = result.airports.filter(ap => {
            // Exclude dep/arr airports
            if (ap.icao === depIcao || ap.icao === arrIcao) return false;
            const perpDist = perpendicularDistanceNm(ap.lat, ap.lon, depLat, depLon, arrLat, arrLon);
            return perpDist <= halfWidth;
          });
          setAirports(filtered);
        }
      } catch (e) {
        // Silently fail
      }
    }

    fetchAirports();
  }, [depLat, depLon, arrLat, arrLon, corridorWidthNm, depIcao, arrIcao]);

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
              icon={createSmallRunwayIcon(ap.runway_heading)}
              interactive={false}
            />
          )}
        </React.Fragment>
      ))}
    </>
  );
}