// Maps each maintenance category to a 3D position on the aircraft, an icon
// and color hint. Positions are normalized to a generic aircraft shape that
// our customAircraftModel produces (length ≈ 30m along +X, wings span Z).
//
// The label is shown via HTML overlay aligned to the projected screen
// coordinate, so the map only needs world positions per category.

export const HOTSPOT_LAYOUT = {
  engine:          { x: 11, y: 0, z: 0,  label: { en: 'Engine', de: 'Triebwerk' } },
  hydraulics:      { x: -2, y: -1.5, z: 0, label: { en: 'Hydraulics', de: 'Hydraulik' } },
  avionics:        { x: 9,  y: 1, z: 0,  label: { en: 'Avionics', de: 'Avionik' } },
  airframe:        { x: 0,  y: 2.5, z: 0, label: { en: 'Airframe', de: 'Zelle' } },
  landing_gear:    { x: 2,  y: -2, z: 0, label: { en: 'Landing Gear', de: 'Fahrwerk' } },
  electrical:      { x: -8, y: 1, z: 0, label: { en: 'Electrical', de: 'Elektrik' } },
  flight_controls: { x: -12, y: 1.5, z: 0, label: { en: 'Flight Controls', de: 'Flugsteuerung' } },
  pressurization: { x: 4,  y: 1.5, z: 4, label: { en: 'Pressurization', de: 'Druckkabine' } },
};

export function getHotspotColor(wearPct) {
  if (wearPct <= 20) return '#10b981';   // emerald
  if (wearPct <= 50) return '#f59e0b';   // amber
  if (wearPct <= 75) return '#fb923c';   // orange
  return '#ef4444';                       // red
}