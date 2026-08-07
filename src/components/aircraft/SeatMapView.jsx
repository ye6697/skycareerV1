import React from 'react';
import { getSeatCounts } from '@/lib/cabinConfig';

// Top-down seat map: first (amber), business (purple), economy (cyan).
// occupied = { first, business, economy } booked-seat counts (optional).

const ABREAST_BY_TYPE = {
  small_prop: 2, turboprop: 4, regional_jet: 4, narrow_body: 6, wide_body: 8, cargo: 0,
};

const CLASS_STYLES = {
  first: { fill: '#f59e0b', stroke: '#b45309', pitch: 15, size: 10, abreastCap: 4 },
  business: { fill: '#a855f7', stroke: '#7e22ce', pitch: 12, size: 8.5, abreastCap: 4 },
  economy: { fill: '#22d3ee', stroke: '#0e7490', pitch: 9, size: 6.5, abreastCap: 10 },
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
  const W = 190;
  const bodyLeft = 45;
  const bodyRight = W - 45;
  const bodyWidth = bodyRight - bodyLeft;

  let cursorY = 62;
  const sections = [];
  ['first', 'business', 'economy'].forEach((cls) => {
    const count = cls === 'first' ? seats.first : cls === 'business' ? seats.business : seats.economy;
    if (count <= 0) return;
    const built = buildRows(count, cls === 'economy' ? abreast : abreast - (abreast > 4 ? 2 : 0), cls, cursorY);
    sections.push({ cls, ...built, count });
    cursorY = built.endY + 8;
  });

  const totalH = cursorY + 70;
  const occ = occupied || {};

  return (
    <svg viewBox={`0 0 ${W} ${totalH}`} style={{ height, maxWidth: '100%' }} className="mx-auto block">
      {/* Fuselage */}
      <path
        d={`M ${W / 2} 4 C ${bodyLeft} 18, ${bodyLeft} 40, ${bodyLeft} 55 L ${bodyLeft} ${cursorY + 12} C ${bodyLeft} ${cursorY + 45}, ${W / 2 - 12} ${cursorY + 62}, ${W / 2} ${cursorY + 62} C ${W / 2 + 12} ${cursorY + 62}, ${bodyRight} ${cursorY + 45}, ${bodyRight} ${cursorY + 12} L ${bodyRight} 55 C ${bodyRight} 40, ${bodyRight} 18, ${W / 2} 4 Z`}
        fill="#0f172a" stroke="#155e75" strokeWidth="1.5"
      />
      {/* Wings */}
      <path d={`M ${bodyLeft} ${cursorY * 0.45} L 2 ${cursorY * 0.62} L 2 ${cursorY * 0.66} L ${bodyLeft} ${cursorY * 0.56} Z`} fill="#1e293b" stroke="#155e75" strokeWidth="1" />
      <path d={`M ${bodyRight} ${cursorY * 0.45} L ${W - 2} ${cursorY * 0.62} L ${W - 2} ${cursorY * 0.66} L ${bodyRight} ${cursorY * 0.56} Z`} fill="#1e293b" stroke="#155e75" strokeWidth="1" />
      {/* Cockpit */}
      <ellipse cx={W / 2} cy={26} rx={14} ry={9} fill="#164e63" opacity="0.7" />

      {sections.map((section) =>
        section.rows.map((row, ri) => {
          const style = CLASS_STYLES[row.styleKey];
          const half = Math.ceil(row.cols / 2);
          const aisle = 10;
          const seatGap = 1.5;
          const sideWidth = (bodyWidth - aisle - 8) / 2;
          const seatW = Math.min(style.size, sideWidth / half - seatGap);
          const bookedCount = Number(occ[row.styleKey === 'first' ? 'first' : row.styleKey === 'business' ? 'business' : 'economy']) || 0;
          return Array.from({ length: row.inRow }).map((_, si) => {
            const globalIndex = row.startIndex + si;
            const isOccupied = occupied ? globalIndex < bookedCount : true;
            const sideIdx = si < half ? si : si - half;
            const isLeft = si < half;
            const x = isLeft
              ? bodyLeft + 5 + sideIdx * (seatW + seatGap)
              : W / 2 + aisle / 2 + sideIdx * (seatW + seatGap);
            return (
              <rect
                key={`${section.cls}-${ri}-${si}`}
                x={x} y={row.y} width={seatW} height={style.size} rx={1.8}
                fill={isOccupied ? style.fill : 'transparent'}
                stroke={style.stroke}
                strokeWidth="0.8"
                opacity={isOccupied ? 0.95 : 0.55}
              />
            );
          });
        })
      )}
    </svg>
  );
}