// Maps each maintenance category to a 3D position on the aircraft.
// Coordinates are in the local frame of the aircraft model: nose along +X,
// wings span Z, tail at -X. Hotspots sit slightly off the surface so the
// glowing sphere is clearly visible from any angle.

export const HOTSPOT_LAYOUT = {
  engine:          { x: 12,  y: 0.5, z: 0,    label: { en: 'Engines', de: 'Triebwerke' } },
  hydraulics:      { x: -3,  y: -1.8, z: 0,   label: { en: 'Hydraulics', de: 'Hydraulik' } },
  avionics:        { x: 9,   y: 1.5, z: 0,    label: { en: 'Avionics / Cockpit', de: 'Avionik / Cockpit' } },
  airframe:        { x: 0,   y: 3,   z: 0,    label: { en: 'Airframe', de: 'Zelle' } },
  landing_gear:    { x: 2,   y: -2.2, z: 0,   label: { en: 'Landing Gear', de: 'Fahrwerk' } },
  electrical:      { x: -8,  y: 1.2, z: 0,    label: { en: 'Electrical', de: 'Elektrik' } },
  flight_controls: { x: -13, y: 2,   z: 0,    label: { en: 'Flight Controls', de: 'Flugsteuerung' } },
  pressurization:  { x: 4,   y: 1.8, z: 4,    label: { en: 'Pressurization', de: 'Druckkabine' } },
};

export function getHotspotColor(wearPct) {
  if (wearPct <= 20) return '#10b981';
  if (wearPct <= 50) return '#f59e0b';
  if (wearPct <= 75) return '#fb923c';
  return '#ef4444';
}