'use client';

import type { Player } from '@/lib/types';
import { totalBetAmount } from '@/lib/game-logic';

interface Reaction {
  emoji: string;
  ts: number;
}

interface Props {
  players: Player[];
  currentPlayerId: string;
  reactions?: Record<string, Reaction>;
}

export default function PlayerPanel({ players, currentPlayerId, reactions }: Props) {
  return (
    <div className="rounded-lg neon-border-dim p-3 flex flex-col gap-2.5" style={{ background: 'var(--bg-card)' }}>
      <p className="text-xs tracking-widest uppercase font-bold" style={{ color: 'var(--neon)' }}>
        Players <span style={{ color: 'rgba(0,212,255,0.5)' }}>({players.length})</span>
      </p>

      {players.length === 0 && (
        <p className="text-xs" style={{ color: 'rgba(0,212,255,0.3)' }}>Waiting for players…</p>
      )}

      {players.map(p => {
        const isSelf = p.id === currentPlayerId;
        const bet = totalBetAmount(p.bets);
        const rxn = reactions?.[p.id];
        return (
          <div key={p.id} className="flex items-start gap-2 relative">
            {/* Floating reaction */}
            {rxn && (
              <span
                key={rxn.ts}
                className="reaction-float absolute -top-1 left-0 text-lg pointer-events-none select-none z-10"
              >
                {rxn.emoji}
              </span>
            )}

            {/* Colour dot */}
            <div
              className="mt-1 w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }}
            />

            <div className="flex-1 min-w-0">
              {/* Name + badges */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-sm font-bold truncate max-w-[90px]" style={{ color: p.color }}>
                  {p.name}
                </span>
                {isSelf && (
                  <span className="text-[10px] px-1.5 py-px rounded font-bold"
                    style={{ background: 'rgba(0,212,255,0.15)', color: 'var(--neon)', border: '1px solid rgba(0,212,255,0.3)' }}>
                    YOU
                  </span>
                )}
                {p.confirmed && (
                  <span className="text-[10px] px-1.5 py-px rounded font-bold"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                    ✓ READY
                  </span>
                )}
              </div>

              {/* Balance + bet */}
              <div className="flex items-center gap-2 mt-0.5 text-xs flex-wrap">
                <span style={{ color: 'rgba(0,212,255,0.7)', fontFamily: 'Courier New, monospace', fontWeight: 700 }}>
                  ${p.balance.toLocaleString()}
                </span>
                {bet > 0 && (
                  <span style={{ color: '#f59e0b', fontFamily: 'Courier New, monospace', fontWeight: 700 }}>
                    bet ${bet.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
