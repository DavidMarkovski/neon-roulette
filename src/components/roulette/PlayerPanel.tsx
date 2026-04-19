'use client';

import type { Player } from '@/lib/types';
import { totalBetAmount } from '@/lib/game-logic';

interface Props {
  players: Player[];
  currentPlayerId: string;
}

export default function PlayerPanel({ players, currentPlayerId }: Props) {
  return (
    <div className="rounded-lg neon-border-dim p-3 flex flex-col gap-2.5" style={{ background: 'var(--bg-card)' }}>
      <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--neon)' }}>
        Players <span style={{ color: 'rgba(0,212,255,0.5)' }}>({players.length})</span>
      </p>

      {players.length === 0 && (
        <p className="text-xs" style={{ color: 'rgba(0,212,255,0.3)' }}>Waiting for players…</p>
      )}

      {players.map(p => {
        const isSelf = p.id === currentPlayerId;
        const bet = totalBetAmount(p.bets);
        return (
          <div key={p.id} className="flex items-start gap-2">
            {/* Colour dot */}
            <div
              className="mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }}
            />

            <div className="flex-1 min-w-0">
              {/* Name + badges */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs font-bold truncate max-w-[90px]" style={{ color: p.color }}>
                  {p.name}
                </span>
                {isSelf && (
                  <span className="text-[9px] px-1 rounded tracking-widest font-bold"
                    style={{ background: 'rgba(0,212,255,0.15)', color: 'var(--neon)', border: '1px solid rgba(0,212,255,0.3)' }}>
                    YOU
                  </span>
                )}
                {p.confirmed && (
                  <span className="text-[9px] px-1 rounded tracking-widest font-bold"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                    ✓ READY
                  </span>
                )}
              </div>

              {/* Balance + bet */}
              <div className="flex items-center gap-2 mt-0.5 text-[10px] flex-wrap">
                <span style={{ color: 'rgba(0,212,255,0.6)' }}>
                  ${p.balance.toLocaleString()}
                </span>
                {bet > 0 && (
                  <span style={{ color: '#f59e0b' }}>
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
