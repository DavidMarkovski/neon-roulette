'use client';

import { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { WHEEL_ORDER, RED_NUMBERS, getNumberColor, computeWheelSpin, computeBallSpin } from '@/lib/game-logic';

const CX = 200;
const CY = 200;
const OUTER_R = 188;
const NUMBER_R = 155;
const INNER_R = 82;
const BALL_R = OUTER_R - 10; // orbit radius for the ball
const SLOT_DEG = 360 / 37;

const SPIN_DURATION = 6;
const SPIN_EASE: [number, number, number, number] = [0.05, 0.3, 0.8, 1.0];

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

const COLORS = {
  green: { fill: '#064e3b', glow: '#10b981' },
  red:   { fill: '#7f1d1d', glow: '#ef4444' },
  black: { fill: '#0f172a', glow: '#334155' },
};

interface Props {
  result: number | null;
  isSpinning: boolean;
  onSpinComplete: (result: number) => void;
}

export default function RouletteWheel({ result, isSpinning, onSpinComplete }: Props) {
  const wheelControls = useAnimation();
  const ballControls  = useAnimation();
  const wheelRot = useRef(0);
  const ballRot  = useRef(0);
  const fired    = useRef(false);
  // Keep a stable ref so the animation effect doesn't re-run when the parent
  // re-renders (countdown ticks, presence updates) and creates a new function reference.
  const onSpinCompleteRef = useRef(onSpinComplete);
  useEffect(() => { onSpinCompleteRef.current = onSpinComplete; });

  useEffect(() => {
    if (!isSpinning || result === null) return;
    fired.current = false;

    const wheelDelta = computeWheelSpin(result, wheelRot.current);
    const ballDelta  = computeBallSpin();

    wheelRot.current += wheelDelta;
    ballRot.current  += ballDelta;

    const transition = { duration: SPIN_DURATION, ease: SPIN_EASE };

    Promise.all([
      wheelControls.start({ rotate: wheelRot.current, transition }),
      ballControls.start({ rotate: ballRot.current,   transition }),
    ]).then(() => {
      if (!fired.current) {
        fired.current = true;
        onSpinCompleteRef.current(result);
      }
    });
  // onSpinComplete intentionally excluded — we use the ref above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning, result, wheelControls, ballControls]);

  const resultColor = result !== null ? getNumberColor(result) : null;

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: 400, height: 400 }}>
      {/* Outer ambient glow */}
      <div className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: '0 0 60px rgba(0,212,255,0.2), 0 0 120px rgba(0,212,255,0.08)' }} />

      {/* ── Rotating wheel ── */}
      <motion.svg
        width={400} height={400} viewBox="0 0 400 400"
        animate={wheelControls}
        style={{ originX: '50%', originY: '50%', position: 'absolute', inset: 0 }}
      >
        {/* Rim */}
        <circle cx={CX} cy={CY} r={OUTER_R + 5} fill="#050e1f" stroke="rgba(0,212,255,0.6)" strokeWidth={2} />

        {/* Sectors */}
        {WHEEL_ORDER.map((num, i) => {
          const col = num === 0 ? 'green' : RED_NUMBERS.has(num) ? 'red' : 'black';
          const { fill, glow } = COLORS[col];
          const midAngle = (i + 0.5) * SLOT_DEG - 90;
          const lp = polarToXY(NUMBER_R, (i + 0.5) * SLOT_DEG);
          return (
            <g key={num}>
              <path d={sectorPath(i)} fill={fill} stroke="rgba(0,212,255,0.15)" strokeWidth={0.5} />
              {/* subtle highlight */}
              <path d={sectorPath(i)} fill={`${glow}12`} stroke="none" />
              {/* number */}
              <text
                x={lp.x} y={lp.y}
                fill="white"
                fontSize="13"
                fontWeight="800"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${midAngle + 90}, ${lp.x}, ${lp.y})`}
                style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'Courier New, monospace' }}
              >
                {num}
              </text>
            </g>
          );
        })}

        {/* Inner hub */}
        <circle cx={CX} cy={CY} r={INNER_R} fill="#020b18" stroke="rgba(0,212,255,0.5)" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={INNER_R - 10} fill="none" stroke="rgba(0,212,255,0.15)" strokeWidth={1} />
        {/* Hub spokes */}
        {[0,60,120,180,240,300].map(a => {
          const inner = polarToXY(20, a);
          const outer = polarToXY(INNER_R - 12, a);
          return <line key={a} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="rgba(0,212,255,0.2)" strokeWidth={1} />;
        })}
        <circle cx={CX} cy={CY} r={10} fill="rgba(0,212,255,0.3)" />
        <circle cx={CX} cy={CY} r={4} fill="#00d4ff" />
      </motion.svg>

      {/* ── Ball (orbits independently, counter-clockwise) ── */}
      <motion.svg
        width={400} height={400} viewBox="0 0 400 400"
        animate={ballControls}
        style={{ originX: '50%', originY: '50%', position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {/* Ball sits at 12 o'clock on the outer rim track */}
        <circle cx={CX} cy={CY - BALL_R} r={9}
          fill="white"
          style={{ filter: 'drop-shadow(0 0 8px white) drop-shadow(0 0 16px rgba(0,212,255,0.8))' }}
        />
        <circle cx={CX} cy={CY - BALL_R} r={4} fill="#c0e8ff" />
      </motion.svg>

      {/* Result overlay (shown after spin) */}
      {result !== null && !isSpinning && (
        <div className="absolute flex flex-col items-center justify-center animate-float-in pointer-events-none"
          style={{ width: 160, height: 160, borderRadius: '50%' }}>
          <span
            className="text-6xl font-black"
            style={{
              color: resultColor === 'green' ? '#10b981' : resultColor === 'red' ? '#ef4444' : '#e2e8f0',
              textShadow: `0 0 30px ${resultColor === 'green' ? '#10b981' : resultColor === 'red' ? '#ef4444' : '#94a3b8'}`,
              fontFamily: 'Courier New, monospace',
            }}
          >
            {result}
          </span>
          <span
            className="text-[10px] tracking-[0.3em] uppercase font-bold mt-1"
            style={{ color: resultColor === 'green' ? '#10b981' : resultColor === 'red' ? '#ef4444' : '#64748b' }}
          >
            {resultColor}
          </span>
        </div>
      )}
    </div>
  );
}
