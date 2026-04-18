'use client';

import { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { WHEEL_ORDER, RED_NUMBERS, spinWheelDegrees, getNumberColor } from '@/lib/game-logic';

const CX = 200;
const CY = 200;
const OUTER_R = 190;
const POCKET_R = 155;
const INNER_R = 85;
const SLOT_DEG = 360 / 37;

function polarToXY(r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function sectorPath(i: number): string {
  const s = i * SLOT_DEG;
  const e = (i + 1) * SLOT_DEG;
  const p1 = polarToXY(OUTER_R, s);
  const p2 = polarToXY(OUTER_R, e);
  const p3 = polarToXY(INNER_R, e);
  const p4 = polarToXY(INNER_R, s);
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${OUTER_R} ${OUTER_R} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} A ${INNER_R} ${INNER_R} 0 0 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`;
}

const SECTOR_COLORS = {
  green: '#065f46',
  red: '#7f1d1d',
  black: '#111',
};
const SECTOR_GLOW = {
  green: '#10b981',
  red: '#ef4444',
  black: '#555',
};

interface Props {
  result: number | null;
  isSpinning: boolean;
  onSpinComplete: (result: number) => void;
}

export default function RouletteWheel({ result, isSpinning, onSpinComplete }: Props) {
  const controls = useAnimation();
  const currentRotation = useRef(0);
  const callbackFired = useRef(false);

  useEffect(() => {
    if (isSpinning && result !== null) {
      callbackFired.current = false;
      const totalDeg = spinWheelDegrees(result);
      const target = currentRotation.current + totalDeg;
      currentRotation.current = target;

      controls
        .start({
          rotate: target,
          transition: {
            duration: 6,
            ease: [0.1, 0.4, 0.6, 1.0],
          },
        })
        .then(() => {
          if (!callbackFired.current) {
            callbackFired.current = true;
            onSpinComplete(result);
          }
        });
    }
  }, [isSpinning, result, controls, onSpinComplete]);

  const color = result !== null ? getNumberColor(result) : null;

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 420,
          height: 420,
          background: 'transparent',
          boxShadow: '0 0 40px rgba(168,85,247,0.4), 0 0 80px rgba(168,85,247,0.15)',
        }}
      />

      <motion.svg
        width={400}
        height={400}
        viewBox="0 0 400 400"
        animate={controls}
        style={{ originX: '50%', originY: '50%' }}
      >
        {/* Outer rim */}
        <circle cx={CX} cy={CY} r={OUTER_R + 4} fill="#1a0030" stroke="#a855f7" strokeWidth={2} />

        {/* Sectors */}
        {WHEEL_ORDER.map((num, i) => {
          const col = num === 0 ? 'green' : RED_NUMBERS.has(num) ? 'red' : 'black';
          const midAngle = (i + 0.5) * SLOT_DEG - 90;
          const labelPos = polarToXY(POCKET_R, (i + 0.5) * SLOT_DEG);
          return (
            <g key={num}>
              <path
                d={sectorPath(i)}
                fill={SECTOR_COLORS[col]}
                stroke="#2d1b4e"
                strokeWidth={0.5}
              />
              {/* Pocket highlight */}
              <path
                d={sectorPath(i)}
                fill={`${SECTOR_GLOW[col]}18`}
                stroke="none"
              />
              <text
                x={labelPos.x}
                y={labelPos.y}
                fill="white"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${midAngle + 90}, ${labelPos.x}, ${labelPos.y})`}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {num}
              </text>
            </g>
          );
        })}

        {/* Inner circle (center hub) */}
        <circle cx={CX} cy={CY} r={INNER_R} fill="#0a0014" stroke="#a855f7" strokeWidth={1.5} />
        <circle cx={CX} cy={CY} r={INNER_R - 8} fill="none" stroke="#3b0070" strokeWidth={1} />

        {/* Center decoration */}
        <circle cx={CX} cy={CY} r={12} fill="#a855f7" opacity={0.3} />
        <circle cx={CX} cy={CY} r={5} fill="#a855f7" />

        {/* Fixed ball indicator (12 o'clock, on the rim) */}
        <circle
          cx={CX}
          cy={CY - OUTER_R + 12}
          r={7}
          fill="white"
          style={{ filter: 'drop-shadow(0 0 6px white)' }}
        />
        <circle cx={CX} cy={CY - OUTER_R + 12} r={3} fill="#ccc" />
      </motion.svg>

      {/* Result overlay */}
      {result !== null && !isSpinning && (
        <div
          className="absolute flex flex-col items-center justify-center animate-float-in"
          style={{ width: 170, height: 170, borderRadius: '50%' }}
        >
          <span
            className="text-5xl font-bold"
            style={{
              color: color === 'green' ? '#10b981' : color === 'red' ? '#ef4444' : '#e2e8f0',
              textShadow: `0 0 30px ${color === 'green' ? '#10b981' : color === 'red' ? '#ef4444' : '#888'}`,
            }}
          >
            {result}
          </span>
          <span
            className="text-xs tracking-widest uppercase mt-1"
            style={{ color: color === 'green' ? '#10b981' : color === 'red' ? '#ef4444' : '#888' }}
          >
            {color}
          </span>
        </div>
      )}
    </div>
  );
}
