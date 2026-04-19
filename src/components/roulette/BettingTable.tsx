'use client';

import type { Bet, BetType, Player } from '@/lib/types';
import { RED_NUMBERS } from '@/lib/game-logic';

interface Props {
  bets: Bet[];
  players: Player[];
  currentPlayerId: string;
  onBet: (bet: Bet) => void;
  disabled: boolean;
  selectedChip: number;
}

function getMyBetAmount(bets: Bet[], type: BetType, number?: number): number {
  return bets.filter(b => b.type === type && b.number === number).reduce((s, b) => s + b.amount, 0);
}

function getOtherColors(players: Player[], currentPlayerId: string, type: BetType, number?: number) {
  return players
    .filter(p => p.id !== currentPlayerId && p.bets.some(b => b.type === type && b.number === number))
    .map(p => p.color);
}

function Zone({
  label, type, number, bets, players, currentPlayerId, onBet, disabled, selectedChip,
  red, green, className = '',
}: {
  label: string; type: BetType; number?: number;
  bets: Bet[]; players: Player[]; currentPlayerId: string;
  onBet: (b: Bet) => void; disabled: boolean; selectedChip: number;
  red?: boolean; green?: boolean; className?: string;
}) {
  const amount = getMyBetAmount(bets, type, number);
  const others = getOtherColors(players, currentPlayerId, type, number);

  return (
    <div
      className={`bet-zone relative flex items-center justify-center text-xs font-bold tracking-wide border ${disabled ? 'disabled' : ''} ${className}`}
      style={{
        background: green
          ? 'rgba(6,78,59,0.7)'
          : red
          ? 'rgba(127,29,29,0.7)'
          : 'rgba(4,15,34,0.85)',
        borderColor: 'rgba(0,212,255,0.15)',
      }}
      onClick={() => !disabled && onBet({ type, number, amount: selectedChip })}
    >
      <span style={{
        color: green ? '#10b981' : red ? '#f87171' : '#e0f2fe',
        fontSize: type === 'straight' ? 13 : 11,
        fontFamily: type === 'straight' ? 'Courier New, monospace' : undefined,
        fontWeight: 700,
        letterSpacing: type === 'straight' ? undefined : '0.04em',
      }}>
        {label}
      </span>

      {/* My chip stack */}
      {amount > 0 && (
        <span
          className="absolute top-0.5 right-0.5 text-[10px] font-black px-1 rounded-sm"
          style={{ background: 'var(--neon)', color: '#020b18' }}
        >
          {amount >= 1000 ? `${amount / 1000}k` : `$${amount}`}
        </span>
      )}

      {/* Other players' dots */}
      {others.length > 0 && (
        <div className="absolute bottom-0.5 left-0.5 flex gap-0.5">
          {others.map((c, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 4px ${c}` }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BettingTable({ bets, players, currentPlayerId, onBet, disabled, selectedChip }: Props) {
  const zoneProps = { bets, players, currentPlayerId, onBet, disabled, selectedChip };

  return (
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at center, #0a2010 0%, #040c05 100%)',
        border: '1px solid rgba(0,212,255,0.15)',
      }}
    >
      <div className="p-2 sm:p-3 flex flex-col gap-1.5 overflow-x-auto">

        {/* Number grid */}
        <div className="flex gap-1 min-w-[360px]">
          {/* Zero */}
          <Zone label="0" type="straight" number={0} {...zoneProps} green
            className="w-9 flex-shrink-0 text-sm font-black"
            key="z0"
          />

          {/* 12 columns × 3 rows */}
          <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
            {[3, 2, 1].map(row =>
              Array.from({ length: 12 }, (_, col) => {
                const n = col * 3 + row;
                return (
                  <Zone key={n} label={String(n)} type="straight" number={n} {...zoneProps}
                    red={RED_NUMBERS.has(n)}
                  />
                );
              })
            )}
          </div>

          {/* Column 2:1 bets */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            {(['col3', 'col2', 'col1'] as BetType[]).map(t => (
              <Zone key={t} label="2:1" type={t} {...zoneProps}
                className="w-9 flex-1 text-[10px]"
              />
            ))}
          </div>
        </div>

        {/* Dozen bets */}
        <div className="flex gap-1 min-w-[360px]" style={{ marginLeft: 38, marginRight: 38 }}>
          {([
            { label: '1st 12', type: 'dozen1' as BetType },
            { label: '2nd 12', type: 'dozen2' as BetType },
            { label: '3rd 12', type: 'dozen3' as BetType },
          ]).map(({ label, type }) => (
            <Zone key={type} label={label} type={type} {...zoneProps} className="flex-1" />
          ))}
        </div>

        {/* Outside bets */}
        <div className="flex gap-1 min-w-[360px]" style={{ marginLeft: 38, marginRight: 38 }}>
          {([
            { label: '1–18',  type: 'low'   as BetType },
            { label: 'EVEN',  type: 'even'  as BetType },
            { label: '●',     type: 'red'   as BetType, red: true },
            { label: '●',     type: 'black' as BetType },
            { label: 'ODD',   type: 'odd'   as BetType },
            { label: '19–36', type: 'high'  as BetType },
          ]).map(({ label, type, red }) => (
            <Zone key={type} label={label} type={type} {...zoneProps} red={red} className="flex-1" />
          ))}
        </div>
      </div>
    </div>
  );
}
