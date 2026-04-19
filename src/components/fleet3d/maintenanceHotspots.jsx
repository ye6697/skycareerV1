// Maps each maintenance category to a 3D position on the aircraft.
// Coordinates are in the local frame of the aircraft model after centering:
// nose at +X, tail at -X, wings span Z, belly near y≈0, top of fuselage near y≈3-4.
// Model is scaled to ~30m length, so X range is roughly [-15, +15].

export const HOTSPOT_LAYOUT = {
  // Engines - under the wings, about 1/3 from nose
  engine:          { x: 2,   y: 1.5, z: 6,   label: { en: 'Engines', de: 'Triebwerke' } },
  // Avionics / Cockpit - nose area, top of fuselage
  avionics:        { x: 11,  y: 3.2, z: 0,   label: { en: 'Avionics / Cockpit', de: 'Avionik / Cockpit' } },
  // Airframe - top center of fuselage
  airframe:        { x: 0,   y: 4.2, z: 0,   label: { en: 'Airframe', de: 'Zelle' } },
  // Hydraulics - wing root, slightly below wing
  hydraulics:      { x: 0,   y: 2.0, z: -4,  label: { en: 'Hydraulics', de: 'Hydraulik' } },
  // Landing Gear - under fuselage, just behind nose
  landing_gear:    { x: 4,   y: 0.5, z: 0,   label: { en: 'Landing Gear', de: 'Fahrwerk' } },
  // Electrical - mid-fuselage side
  electrical:      { x: -3,  y: 2.5, z: 3,   label: { en: 'Electrical', de: 'Elektrik' } },
  // Flight Controls - tail area, top of fin
  flight_controls: { x: -12, y: 5,   z: 0,   label: { en: 'Flight Controls', de: 'Flugsteuerung' } },
  // Pressurization - rear fuselage, top
  pressurization:  { x: -7,  y: 3.5, z: 0,   label: { en: 'Pressurization', de: 'Druckkabine' } },
};

export function getHotspotColor(wearPct) {
  if (wearPct <= 20) return '#10b981';
  if (wearPct <= 50) return '#f59e0b';
  if (wearPct <= 75) return '#fb923c';
  return '#ef4444';
}