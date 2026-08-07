import React from 'react';
import { getSeatCounts } from '@/lib/cabinConfig';

// Modern top-down cabin plan: slim swept-wing airliner silhouette with
// under-wing engines, winglets, galleys/doors and per-class seat rows.
// occupied = { first, business, economy } booked-seat counts (optional).

const ABREAST_BY_TYPE = {
  small_prop: 2, turboprop: 4, regional_jet: 4, narrow_body: 6, wide_body: 8, cargo: 0,
};

const CLASS_STYLES = {
  first: {
    fill: '#f59e0b', hi: '#fde68a', back: '#78350f', stroke: '#a16207',
    pitch: 16, size: 11, abreastCap: 4, label: 'FIRST', labelColor: '#fcd34d',
  },
  business: {
    fill: '#a855f7', hi: '#e9d5ff', back: '#581c87', stroke: '#7e22ce',
    pitch: 13, size: 9.5, abreastCap: 4, label: 'BUSINESS', labelColor: '#d8b4fe',
  },
  economy: {
    fill: '#22d3ee', hi: '#cffafe', back: '#0e4f5e', stroke: '#0e7490',
    pitch: 9.6, size: 7, abreastCap: 10, label: 'ECONOMY', labelColor: '#67e8f9',
  },
};

function buildRows(count, abreast, styleKey, startY) {
  const style = CLASS_STYLES[styleKey];
  const cols = Math.max(2, Math.min(style.abreastCap, abreast));
  const rows = [];
  let y = startY;
  let remaining = count;
  let seatIndex = 0;
  while (remaining > 0) {
    const inRow = Math.min(cols, remaining);
    rows.push({ y, cols, inRow, styleKey, startIndex: seatIndex });
    seatIndex += inRow;
    remaining -= inRow;
    y += style.pitch;
  }
  return { rows, endY: y };
}

export default function SeatMapView({ aircraft, cabin = null, occupied = null, height = 340 }) {
  const seats = getSeatCounts(aircraft, cabin);
  const abreast = ABREAST_BY_TYPE[aircraft?.type] || 4;
  const W = 220;
  const bodyLeft = 62;
  const bodyRight = W - 62;
  const bodyWidth = bodyRight - bodyLeft;
  const cx = W / 2;

  let y = 70;
  const galleys = [y];
  y += 9;
  const sections = [];
  ['first', 'business', 'economy'].forEach((cls) => {
    const count = cls === 'first' ? seats.first : cls === 'business' ? seats.business : seats.economy;
    if (count <= 0) return;
    const labelY = y;
    y += 11;
    const built = buildRows(count, cls === 'economy' ? abreast : abreast - (abreast > 4 ? 2 : 0), cls, y);
    sections.push({ cls, labelY, ...built, count });
    y = built.endY + 2;
    galleys.push(y);
    y += 9;
  });
  const cabinEnd = y + 2;
  const tailTip = cabinEnd + 66;
  const totalH = tailTip + 10;

  const wingY = 70 + (cabinEnd - 70) * 0.46;
  const span = 58;
  const occ = occupied || {};

  return (
    <svg viewBox={`0 0 ${W} ${totalH}`} style={{ height, maxWidth: '100%' }} className="mx-auto block">
      <defs>
        <linearGradient id="smv-skin" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0a1220" />
          <stop offset="16%" stopColor="#152740" />
          <stop offset="46%" stopColor="#1d3358" />
          <stop offset="50%" stopColor="#20385c" />
          <stop offset="84%" stopColor="#152740" />
          <stop offset="100%" stopColor="#0a1220" />
        </linearGradient>
        <linearGradient id="smv-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2b4767" />
          <stop offset="55%" stopColor="#1b2c45" />
          <stop offset="100%" stopColor="#101a29" />
        </linearGradient>
        <linearGradient id="smv-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <filter id="smv-shadow" x="-30%" y="-10%" width="160%" height="130%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.4" floodColor="#000000" floodOpacity="0.55" />
        </filter>
      </defs>

      <g filter="url(#smv-shadow)">
        {/* Tailplane + fin */}
        <path d={`M ${cx - 2.5} ${tailTip - 40} C ${cx - 20} ${tailTip - 20}, ${cx - 34} ${tailTip - 12}, ${cx - 44} ${tailTip - 9} L ${cx - 44} ${tailTip - 4} C ${cx - 26} ${tailTip - 8}, ${cx - 10} ${tailTip - 15}, ${cx - 2.5} ${tailTip - 22} Z`} fill="url(#smv-metal)" stroke="#0e7490" strokeWidth="0.7" />
        <path d={`M ${cx + 2.5} ${tailTip - 40} C ${cx + 20} ${tailTip - 20}, ${cx + 34} ${tailTip - 12}, ${cx + 44} ${tailTip - 9} L ${cx + 44} ${tailTip - 4} C ${cx + 26} ${tailTip - 8}, ${cx + 10} ${tailTip - 15}, ${cx + 2.5} ${tailTip - 22} Z`} fill="url(#smv-metal)" stroke="#0e7490" strokeWidth="0.7" />
        <path d={`M ${cx} ${tailTip - 46} C ${cx + 2.4} ${tailTip - 34}, ${cx + 2.4} ${tailTip - 24}, ${cx + 1.6} ${tailTip - 14} L ${cx - 1.6} ${tailTip - 14} C ${cx - 2.4} ${tailTip - 24}, ${cx - 2.4} ${tailTip - 34}, ${cx} ${tailTip - 46} Z`} fill="#24405f" stroke="#0e7490" strokeWidth="0.6" />

        {/* Swept wings + winglets + engines */}
        <path d={`M ${bodyLeft + 3} ${wingY - 10} C ${bodyLeft - 14} ${wingY + 6}, ${bodyLeft - 38} ${wingY + 24}, ${bodyLeft - span} ${wingY + 38} L ${bodyLeft - span + 5} ${wingY + 46} C ${bodyLeft - 30} ${wingY + 38}, ${bodyLeft - 8} ${wingY + 28}, ${bodyLeft + 3} ${wingY + 20} Z`} fill="url(#smv-metal)" stroke="#0e7490" strokeWidth="0.8" />
        <path d={`M ${bodyRight - 3} ${wingY - 10} C ${bodyRight + 14} ${wingY + 6}, ${bodyRight + 38} ${wingY + 24}, ${bodyRight + span} ${wingY + 38} L ${bodyRight + span - 5} ${wingY + 46} C ${bodyRight + 30} ${wingY + 38}, ${bodyRight + 8} ${wingY + 28}, ${bodyRight - 3} ${wingY + 20} Z`} fill="url(#smv-metal)" stroke="#0e7490" strokeWidth="0.8" />
        <path d={`M ${bodyLeft - span} ${wingY + 38} L ${bodyLeft - span - 3} ${wingY + 30} L ${bodyLeft - span + 3} ${wingY + 44} Z`} fill="#2dd4bf" opacity="0.75" />
        <path d={`M ${bodyRight + span} ${wingY + 38} L ${bodyRight + span + 3} ${wingY + 30} L ${bodyRight + span - 3} ${wingY + 44} Z`} fill="#2dd4bf" opacity="0.75" />
        <g>
          <rect x={bodyLeft - 32} y={wingY + 10} width={10} height={20} rx={5} fill="#0b1220" stroke="#38bdf8" strokeWidth="0.8" />
          <rect x={bodyLeft - 30} y={wingY + 12} width={6} height={4} rx={3} fill="#1e3a5f" />
          <rect x={bodyRight + 22} y={wingY + 10} width={10} height={20} rx={5} fill="#0b1220" stroke="#38bdf8" strokeWidth="0.8" />
          <rect x={bodyRight + 24} y={wingY + 12} width={6} height={4} rx={3} fill="#1e3a5f" />
        </g>

        {/* Fuselage */}
        <path
          d={`M ${cx} 4
              C ${cx - 16} 9, ${bodyLeft + 3} 26, ${bodyLeft} 56
              L ${bodyLeft} ${cabinEnd}
              C ${bodyLeft + 1} ${cabinEnd + 30}, ${cx - 12} ${tailTip - 12}, ${cx} ${tailTip}
              C ${cx + 12} ${tailTip - 12}, ${bodyRight - 1} ${cabinEnd + 30}, ${bodyRight} ${cabinEnd}
              L ${bodyRight} 56
              C ${bodyRight - 3} 26, ${cx + 16} 9, ${cx} 4 Z`}
          fill="url(#smv-skin)" stroke="#22d3ee" strokeWidth="1.1" strokeOpacity="0.55"
        />
        {/* Skin highlight along the crown */}
        <path d={`M ${cx - 3} 20 L ${cx - 3} ${cabinEnd + 6}`} stroke="#38bdf8" strokeWidth="0.7" strokeOpacity="0.18" />
        <path d={`M ${cx + 3} 20 L ${cx + 3} ${cabinEnd + 6}`} stroke="#38bdf8" strokeWidth="0.7" strokeOpacity="0.18" />
      </g>

      {/* Cockpit */}
      <path d={`M ${cx - 13} 30 C ${cx - 10} 22, ${cx - 5} 18, ${cx} 17 C ${cx + 5} 18, ${cx + 10} 22, ${cx + 13} 30 C ${cx + 6} 26, ${cx - 6} 26, ${cx - 13} 30 Z`} fill="url(#smv-glass)" opacity="0.7" />
      <rect x={cx - 9} y={31} width={18} height={7} rx={2} fill="#0f1e33" stroke="#1e3a5f" strokeWidth="0.5" />

      {/* Aisle */}
      <line x1={cx} y1={64} x2={cx} y2={cabinEnd} stroke="#1e3a5f" strokeWidth="0.8" strokeDasharray="2.5 3.5" />

      {/* Galleys + doors */}
      {galleys.map((gy, gi) => (
        <g key={`galley-${gi}`}>
          <rect x={bodyLeft + 4} y={gy} width={bodyWidth - 8} height={5.5} rx={1.6} fill="#111f33" stroke="#22364f" strokeWidth="0.5" />
          <rect x={bodyLeft + 7} y={gy + 1.4} width={10} height={2.6} rx={0.8} fill="#37506d" />
          <rect x={bodyRight - 17} y={gy + 1.4} width={10} height={2.6} rx={0.8} fill="#37506d" />
          <rect x={bodyLeft - 1.3} y={gy - 0.6} width={2.6} height={7} rx={1.1} fill="#e2e8f0" opacity="0.85" />
          <rect x={bodyRight - 1.3} y={gy - 0.6} width={2.6} height={7} rx={1.1} fill="#e2e8f0" opacity="0.85" />
        </g>
      ))}

      {/* Seats */}
      {sections.map((section) => {
        const style = CLASS_STYLES[section.cls];
        return (
          <g key={section.cls}>
            <text
              x={cx} y={section.labelY + 7} textAnchor="middle"
              fontSize="5" fontFamily="monospace" letterSpacing="2"
              fill={style.labelColor} opacity="0.85"
            >
              {style.label}
            </text>
            {section.rows.map((row, ri) => {
              const half = Math.ceil(row.cols / 2);
              const aisle = 12;
              const seatGap = 1.6;
              const sideWidth = (bodyWidth - aisle - 12) / 2;
              const seatW = Math.min(style.size, sideWidth / half - seatGap);
              const bookedCount = Number(occ[section.cls]) || 0;
              return Array.from({ length: row.inRow }).map((_, si) => {
                const globalIndex = row.startIndex + si;
                const isOccupied = occupied ? globalIndex < bookedCount : true;
                const sideIdx = si < half ? si : si - half;
                const isLeft = si < half;
                const x = isLeft
                  ? bodyLeft + 7 + sideIdx * (seatW + seatGap)
                  : cx + aisle / 2 + sideIdx * (seatW + seatGap);
                return (
                  <g key={`${section.cls}-${ri}-${si}`}>
                    <rect
                      x={x} y={row.y} width={seatW} height={style.size} rx={2.2}
                      fill={isOccupied ? style.fill : '#0a1524'}
                      stroke={isOccupied ? style.hi : style.stroke}
                      strokeWidth={isOccupied ? 0.5 : 0.6}
                      opacity={isOccupied ? 1 : 0.45}
                    />
                    <rect
                      x={x + 0.9} y={row.y + 0.8} width={Math.max(0.5, seatW - 1.8)} height={style.size * 0.28} rx={1.2}
                      fill={isOccupied ? style.back : '#16233a'}
                      opacity={isOccupied ? 0.9 : 0.5}
                    />
                  </g>
                );
              });
            })}
          </g>
        );
      })}
    </svg>
  );
}