'use client';

import { useEffect, useRef } from 'react';
import { computeMultiplier } from '@/lib/crash-logic';

const SVG_W = 560;
const SVG_H = 220;
const MAX_T  = 30000; // 30s display window
const MAX_M  = 10;    // 10× display ceiling

function toSVG(elapsed: number, m: number): [number, number] {
  const x = Math.min(SVG_W, (elapsed / MAX_T) * SVG_W);
  const y = SVG_H - ((Math.min(m, MAX_M) - 1) / (MAX_M - 1)) * SVG_H;
  return [x, Math.max(0, y)];
}

interface Props {
  startTime: number | null;
  crashed: boolean;
  crashPoint: number | null;
  phase: 'betting' | 'flying' | 'crashed';
}

const GRID_LINES = [2, 3, 5, 7, 10];

export default function CrashChart({ startTime, crashed, crashPoint, phase }: Props) {
  const polylineRef  = useRef<SVGPolylineElement>(null);
  const multiplierRef = useRef<SVGTextElement>(null);
  const rafRef       = useRef<number | null>(null);

  // Set initial polyline attribute (not managed by React)
  useEffect(() => {
    polylineRef.current?.setAttribute('points', `0,${SVG_H}`);
  }, []);

  // Reset chart on new round
  useEffect(() => {
    if (startTime === null) {
      polylineRef.current?.setAttribute('points', `0,${SVG_H}`);
      polylineRef.current?.setAttribute('stroke', '#00d4ff');
      polylineRef.current?.style.setProperty('filter', 'drop-shadow(0 0 6px #00d4ff)');
      if (multiplierRef.current) {
        multiplierRef.current.textContent = '1.00×';
        multiplierRef.current.setAttribute('fill', '#00d4ff');
        multiplierRef.current.style.setProperty('filter', 'drop-shadow(0 0 20px #00d4ff)');
      }
    }
  }, [startTime]);

  // RAF loop — draws polyline and updates multiplier text
  useEffect(() => {
    if (!startTime || crashed) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const capturedStart = startTime;
    const pts: string[] = [`0,${SVG_H}`];

    function tick() {
      const elapsed = Date.now() - capturedStart;
      const m = computeMultiplier(elapsed);
      const [x, y] = toSVG(elapsed, m);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      polylineRef.current?.setAttribute('points', pts.join(' '));
      if (multiplierRef.current) multiplierRef.current.textContent = `${m.toFixed(2)}×`;
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [startTime, crashed]);

  // Crashed state — turn line red
  useEffect(() => {
    if (!crashed || crashPoint === null) return;
    polylineRef.current?.setAttribute('stroke', '#ef4444');
    polylineRef.current?.style.setProperty('filter', 'drop-shadow(0 0 6px #ef4444)');
    if (multiplierRef.current) {
      multiplierRef.current.textContent = `${crashPoint.toFixed(2)}×`;
      multiplierRef.current.setAttribute('fill', '#ef4444');
      multiplierRef.current.style.setProperty('filter', 'drop-shadow(0 0 20px #ef4444)');
    }
  }, [crashed, crashPoint]);

  const isBetting = phase === 'betting';

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden"
      style={{ background: 'rgba(2,11,24,0.95)', border: '1px solid rgba(0,212,255,0.15)' }}
    >
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ height: 240 }}>
        {/* Grid lines */}
        {GRID_LINES.map(m => {
          const y = SVG_H - ((m - 1) / (MAX_M - 1)) * SVG_H;
          if (y < 0 || y > SVG_H) return null;
          return (
            <g key={m}>
              <line x1={0} y1={y} x2={SVG_W} y2={y}
                stroke="rgba(0,212,255,0.07)" strokeWidth={1} strokeDasharray="4,8" />
              <text x={5} y={y - 4} fill="rgba(0,212,255,0.25)" fontSize={10}
                fontFamily="Courier New, monospace">{m}×</text>
            </g>
          );
        })}

        {/* Chart line — points managed via ref, not React */}
        <polyline
          ref={polylineRef}
          fill="none"
          stroke="#00d4ff"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Multiplier — managed via ref, no JSX children */}
        {!isBetting && (
          <text
            ref={multiplierRef}
            x={SVG_W / 2}
            y={SVG_H / 2 + 18}
            textAnchor="middle"
            fill="#00d4ff"
            fontSize={52}
            fontWeight={900}
            fontFamily="Courier New, monospace"
            style={{ userSelect: 'none' }}
          />
        )}

        {/* CRASHED label */}
        {crashed && (
          <text
            x={SVG_W / 2}
            y={SVG_H / 2 - 26}
            textAnchor="middle"
            fill="#ef4444"
            fontSize={16}
            fontWeight={900}
            fontFamily="Courier New, monospace"
            letterSpacing="0.25em"
            style={{ filter: 'drop-shadow(0 0 10px #ef4444)', userSelect: 'none' }}
          >
            CRASHED
          </text>
        )}

        {/* Waiting label during betting */}
        {isBetting && (
          <text
            x={SVG_W / 2}
            y={SVG_H / 2 + 8}
            textAnchor="middle"
            fill="rgba(0,212,255,0.25)"
            fontSize={13}
            fontFamily="Courier New, monospace"
            letterSpacing="0.18em"
            style={{ userSelect: 'none' }}
          >
            PLACE YOUR BETS
          </text>
        )}
      </svg>
    </div>
  );
}
