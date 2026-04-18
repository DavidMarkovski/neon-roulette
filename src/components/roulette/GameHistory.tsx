'use client';

import { getNumberColor } from '@/lib/game-logic';

export default function GameHistory({ history }: { history: number[] }) {
  if (history.length === 0) {
    return (
      <div className="rounded-lg neon-border p-3" style={{ background: 'var(--bg-card)' }}>
        <p className="text-xs tracking-widest uppercase text-purple-700 mb-2">History</p>
        <p className="text-xs text-purple-900">No spins yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg neon-border p-3" style={{ background: 'var(--bg-card)' }}>
      <p className="text-xs tracking-widest uppercase text-purple-700 mb-2">History</p>
      <div className="flex flex-wrap gap-1">
        {history.map((n, i) => {
          const col = getNumberColor(n);
          return (
            <div
              key={i}
              className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
              style={{
                background:
                  col === 'green' ? '#065f46' : col === 'red' ? '#7f1d1d' : '#1a1a1a',
                color: col === 'green' ? '#10b981' : col === 'red' ? '#ef4444' : '#9ca3af',
                boxShadow: `0 0 6px ${col === 'green' ? '#10b98155' : col === 'red' ? '#ef444455' : '#33333355'}`,
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
