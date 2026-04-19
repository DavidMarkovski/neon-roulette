'use client';

import { getNumberColor } from '@/lib/game-logic';

export default function GameHistory({ history }: { history: number[] }) {
  if (history.length === 0) return null;

  return (
    <div className="rounded-lg neon-border-dim p-3" style={{ background: 'var(--bg-card)' }}>
      <p className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: 'var(--neon)' }}>
        History
      </p>
      <div className="flex flex-wrap gap-1.5">
        {history.map((n, i) => {
          const col = getNumberColor(n);
          return (
            <div
              key={i}
              className="w-7 h-7 rounded flex items-center justify-center text-xs font-black"
              style={{
                background: col === 'green' ? '#064e3b' : col === 'red' ? '#7f1d1d' : '#0f172a',
                color: col === 'green' ? '#10b981' : col === 'red' ? '#f87171' : '#94a3b8',
                border: `1px solid ${col === 'green' ? '#10b98140' : col === 'red' ? '#ef444440' : '#33415540'}`,
                fontFamily: 'Courier New, monospace',
              }}
            >
              {n}
            </div>
          );
        })}
      </div>
    </div>
  );
}
