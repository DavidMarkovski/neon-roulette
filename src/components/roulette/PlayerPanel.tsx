'use client';

import type { Player } from '@/lib/types';
import { totalBetAmount } from '@/lib/game-logic';

interface Props {
  players: Player[];
  currentPlayerId: string;
}

export default function PlayerPanel({ players, currentPlayerId }: Props) {
  return (
    <div className="rounded-lg neon-border p-3 flex flex-col gap-2" style={{ background: 'var(--bg-card)' }}>
      <p className="text-xs tracking-widest uppercase text-purple-700">
        Players <span className="text-purple-500">({players.length})</span>
      </p>
      {players.length === 0 && (
        <p className="text-xs text-purple-900">Waiting for players…</p>
      )}
      {players.map(p => {
        const isSelf = p.id === currentPlayerId;
        const bet = totalBetAmount(p.bets);
        return (
          <div key={p.id} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold truncate" style={{ color: p.color }}>
                  {p.name}
                </span>
                {p.isHost && (
                  <span className="text-[9px] px-1 rounded tracking-widest"
                    style={{ background: 'rgba(168,85,247,0.2)', color: '#a855f7' }}>
                    HOST
                  </span>
                )}
                {isSelf && (
                  <span className="text-[9px] px-1 rounded tracking-widest text-purple-700">
                    YOU
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-purple-700">
                <span>${p.balance.toLocaleString()}</span>
                {bet > 0 && <span style={{ color: '#a855f7' }}>bet ${bet.toLocaleString()}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
