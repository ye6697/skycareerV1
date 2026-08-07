import React from 'react';
import { getSeatCounts } from '@/lib/cabinConfig';

// Premium top-down cabin map: fuselage with nose/tail, wings + engines,
// galleys, exit doors, class dividers with labels, seats with backrests.
// occupied = { first, business, economy } booked-seat counts (optional).

const ABREAST_BY_TYPE = {
  small_prop: 2, turboprop: 4, regional_jet: 4, narrow_body: 6, wide_body: 8, cargo: 0,
};

const CLASS_STYLES = {
  first: {
    fill: '#f59e0b', hi: '#fcd34d', back: '#92400e', stroke: '#b45309',
    pitch: 17, size: 11.5, abreastCap: 4, label: 'FIRST CLASS', labelColor: '#fcd34d',
  },
  business: {
    fill: '#a855f7', hi: '#d8b4fe', back: '#6b21a8', stroke: '#7e22ce',
    pitch: 13.5, size: 9.5, abreastCap: 4, label: 'BUSINESS', labelColor: '#d8b4fe',
  },
  economy: {
    fill: '#22d3ee', hi: '#a5f3fc', back: '#155e75', stroke: '#0e7490',
    pitch: 10, size: 7.2, abreastCap: 10, label: 'ECONOMY', labelColor: '#67e8f9',
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
  const W = 210;
  const bodyLeft = 52;
  const bodyRight = W - 52;
  const bodyWidth = bodyRight - bodyLeft;
  const cx = W / 2;

  // Build cabin layout: front galley, per-class label + rows + divider galley.
  let y = 66;
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
  const tailTip = cabinEnd + 62;
  const totalH = tailTip + 8;

  const wingY = 66 + (cabinEnd - 66) * 0.42;
  const wingSpan = 46;
  const occ = occupied || {};

  return (
    <svg viewBox={`0 0 ${W} ${totalH}`} style={{ height, maxWidth: '100%' }} className="mx-auto block">
      <defs>
        <linearGradient id="smv-fuselage" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0b1526" />
          <stop offset="18%" stopColor="#12233d" />
          <stop offset="50%" stopColor="#16294a" />
          <stop offset="82%" stopColor="#12233d" />
          <stop offset="100%" stopColor="#0b1526" />
        </linearGradient>
        <linearGradient id="smv-wing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#243b55" />
          <stop offset="100%" stopColor="#141e30" />
        </linearGradient>
      </defs>

      {/* Horizontal stabilizers + fin */}
      <path d={`M ${cx - 4} ${tailTip - 34} L ${cx - 42} ${tailTip - 8} L ${cx - 42} ${tailTip - 2} L ${cx - 3} ${tailTip - 18} Z`} fill="url(#smv-wing)" stroke="#155e75" strokeWidth="0.8" />
      <path d={`M ${cx + 4} ${tailTip - 34} L ${cx + 42} ${tailTip - 8} L ${cx + 42} ${tailTip - 2} L ${cx + 3} ${tailTip - 18} Z`} fill="url(#smv-wing)" stroke="#155e75" strokeWidth="0.8" />
      <rect x={cx - 1.6} y={tailTip - 40} width={3.2} height={28} rx={1.6} fill="#1e3a5f" stroke="#155e75" strokeWidth="0.6" />

      {/* Wings + engines */}
      <path d={`M ${bodyLeft + 2} ${wingY - 6} L ${bodyLeft - wingSpan} ${wingY + 34} L ${bodyLeft - wingSpan} ${wingY + 42} L ${bodyLeft + 2} ${wingY + 16} Z`} fill="url(#smv-wing)" stroke="#155e75" strokeWidth="0.9" />
      <path d={`M ${bodyRight - 2} ${wingY - 6} L ${bodyRight + wingSpan} ${wingY + 34} L ${bodyRight + wingSpan} ${wingY + 42} L ${bodyRight - 2} ${wingY + 16} Z`} fill="url(#smv-wing)" stroke="#155e75" strokeWidth="0.9" />
      <rect x={bodyLeft - 26} y={wingY + 8} width={9} height={17} rx={4.5} fill="#0f172a" stroke="#2dd4bf" strokeWidth="0.7" />
      <rect x={bodyRight + 17} y={wingY + 8} width={9} height={17} rx={4.5} fill="#0f172a" stroke="#2dd4bf" strokeWidth="0.7" />

      {/* Fuselage */}
      <path
        d={`M ${cx} 3
            C ${cx - 20} 8, ${bodyLeft + 4} 24, ${bodyLeft} 52
            L ${bodyLeft} ${cabinEnd}
            C ${bodyLeft + 2} ${cabinEnd + 26}, ${cx - 14} ${tailTip - 10}, ${cx} ${tailTip}
            C ${cx + 14} ${tailTip - 10}, ${bodyRight - 2} ${cabinEnd + 26}, ${bodyRight} ${cabinEnd}
            L ${bodyRight} 52
            C ${bodyRight - 4} 24, ${cx + 20} 8, ${cx} 3 Z`}
        fill="url(#smv-fuselage)" stroke="#0e7490" strokeWidth="1.4"
      />

      {/* Cockpit windows */}
      <path d={`M ${cx - 14} 26 L ${cx - 6} 18 L ${cx - 4} 22 L ${cx - 11} 29 Z`} fill="#38bdf8" opacity="0.75" />
      <path d={`M ${cx + 14} 26 L ${cx + 6} 18 L ${cx + 4} 22 L ${cx + 11} 29 Z`} fill="#38bdf8" opacity="0.75" />
      <path d={`M ${cx - 4} 17.5 L ${cx + 4} 17.5 L ${cx + 3} 21.5 L ${cx - 3} 21.5 Z`} fill="#7dd3fc" opacity="0.85" />

      {/* Aisle centerline */}
      <line x1={cx} y1={62} x2={cx} y2={cabinEnd} stroke="#1e3a5f" strokeWidth="0.8" strokeDasharray="2.5 3" />

      {/* Galleys + exit doors */}
      {galleys.map((gy, gi) => (
        <g key={`galley-${gi}`}>
          <rect x={bodyLeft + 4} y={gy} width={bodyWidth - 8} height={5.5} rx={1.5} fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
          <rect x={bodyLeft + 7} y={gy + 1.4} width={10} height={2.6} rx={0.8} fill="#475569" />
          <rect x={bodyRight - 17} y={gy + 1.4} width={10} height={2.6} rx={0.8} fill="#475569" />
          <rect x={bodyLeft - 1.2} y={gy - 0.5} width={2.4} height={7} rx={1} fill="#e2e8f0" opacity="0.9" />
          <rect x={bodyRight - 1.2} y={gy - 0.5} width={2.4} height={7} rx={1} fill="#e2e8f0" opacity="0.9" />
        </g>
      ))}

      {/* Class sections */}
      {sections.map((section) => {
        const style = CLASS_STYLES[section.cls];
        return (
          <g key={section.cls}>
            <text
              x={cx} y={section.labelY + 7} textAnchor="middle"
              fontSize="5.2" fontFamily="monospace" letterSpacing="1.6"
              fill={style.labelColor} opacity="0.9"
            >
              {style.label}
            </text>
            {section.rows.map((row, ri) => {
              const half = Math.ceil(row.cols / 2);
              const aisle = 11;
              const seatGap = 1.6;
              const sideWidth = (bodyWidth - aisle - 10) / 2;
              const seatW = Math.min(style.size, sideWidth / half - seatGap);
              const bookedCount = Number(occ[section.cls]) || 0;
              return Array.from({ length: row.inRow }).map((_, si) => {
                const globalIndex = row.startIndex + si;
                const isOccupied = occupied ? globalIndex < bookedCount : true;
                const sideIdx = si < half ? si : si - half;
                const isLeft = si < half;
                const x = isLeft
                  ? bodyLeft + 6 + sideIdx * (seatW + seatGap)
                  : cx + aisle / 2 + sideIdx * (seatW + seatGap);
                return (
                  <g key={`${section.cls}-${ri}-${si}`}>
                    <rect
                      x={x} y={row.y} width={seatW} height={style.size} rx={2}
                      fill={isOccupied ? style.fill : '#0b1220'}
                      stroke={isOccupied ? style.hi : style.stroke}
                      strokeWidth={isOccupied ? 0.6 : 0.7}
                      opacity={isOccupied ? 1 : 0.5}
                    />
                    <rect
                      x={x + 0.8} y={row.y + 0.8} width={seatW - 1.6} height={style.size * 0.3} rx={1.2}
                      fill={isOccupied ? style.back : '#1e293b'}
                      opacity={isOccupied ? 0.85 : 0.5}
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