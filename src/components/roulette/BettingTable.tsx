'use client';

import type { Bet, BetType, Player } from '@/lib/types';
import { RED_NUMBERS } from '@/lib/game-logic';

// Standard roulette table: 3 rows, columns of 3 numbers each
// Col 1: 1,4,7,10,13,16,19,22,25,28,31,34
// Col 2: 2,5,8,11,14,17,20,23,26,29,32,35
// Col 3: 3,6,9,12,15,18,21,24,27,30,33,36
// Row order on table (top to bottom): row3 (3,6,...), row2 (2,5,...), row1 (1,4,...)

interface Props {
  bets: Bet[];
  players: Player[];
  currentPlayerId: string;
  onBet: (bet: Bet) => void;
  disabled: boolean;
  selectedChip: number;
}

function getBetAmount(bets: Bet[], type: BetType, number?: number): number {
  return bets
    .filter(b => b.type === type && b.number === number)
    .reduce((s, b) => s + b.amount, 0);
}

function getPlayerBetsOnZone(players: Player[], type: BetType, number?: number) {
  return players
    .filter(p => p.bets.some(b => b.type === type && b.number === number))
    .map(p => p.color);
}

function Zone({
  label, type, number, bets, players, onBet, disabled, selectedChip, red, green, className = '',
}: {
  label: string;
  type: BetType;
  number?: number;
  bets: Bet[];
  players: Player[];
  onBet: (b: Bet) => void;
  disabled: boolean;
  selectedChip: number;
  red?: boolean;
  green?: boolean;
  className?: string;
}) {
  const amount = getBetAmount(bets, type, number);
  const colors = getPlayerBetsOnZone(players, type, number);

  return (
    <div
      className={`bet-zone relative flex items-center justify-center text-xs font-bold tracking-wider border border-purple-900 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      style={{
        background: green
          ? 'rgba(6,95,70,0.6)'
          : red
          ? 'rgba(127,29,29,0.6)'
          : 'rgba(13,13,31,0.8)',
        minHeight: 36,
      }}
      onClick={() => !disabled && onBet({ type, number, amount: selectedChip })}
    >
      <span>{label}</span>
      {amount > 0 && (
        <span
          className="absolute top-0.5 right-0.5 text-[9px] font-bold px-1 rounded"
          style={{ background: '#a855f7', color: 'white' }}
        >
          ${amount >= 1000 ? `${amount / 1000}k` : amount}
        </span>
      )}
      {colors.length > 0 && (
        <div className="absolute bottom-0.5 left-0.5 flex gap-0.5">
          {colors.map((c, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BettingTable({ bets, players, currentPlayerId, onBet, disabled, selectedChip }: Props) {
  const cols = 12; // 12 groups of 3 (columns 1-12 across)

  return (
    <div className="w-full rounded-lg border border-purple-900 overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, #0f2a0f 0%, #081508 100%)' }}>
      <div className="p-3 flex flex-col gap-1">

        {/* Number grid: 0 + 3 rows x 12 cols */}
        <div className="flex gap-1">
          {/* Zero */}
          <Zone
            label="0" type="straight" number={0}
            bets={bets} players={players} onBet={onBet} disabled={disabled}
            selectedChip={selectedChip} green
            className="w-10 row-span-3 text-sm"
            key="z0"
          />

          {/* 12 columns, each with 3 numbers stacked */}
          <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
            {/* Row 3 (top): 3, 6, 9, ... 36 */}
            {Array.from({ length: 12 }, (_, i) => {
              const n = (i + 1) * 3;
              return (
                <Zone key={`r3-${n}`} label={String(n)} type="straight" number={n}
                  bets={bets} players={players} onBet={onBet} disabled={disabled}
                  selectedChip={selectedChip}
                  red={RED_NUMBERS.has(n)}
                  className="text-xs"
                />
              );
            })}
            {/* Row 2: 2, 5, 8, ... 35 */}
            {Array.from({ length: 12 }, (_, i) => {
              const n = (i + 1) * 3 - 1;
              return (
                <Zone key={`r2-${n}`} label={String(n)} type="straight" number={n}
                  bets={bets} players={players} onBet={onBet} disabled={disabled}
                  selectedChip={selectedChip}
                  red={RED_NUMBERS.has(n)}
                  className="text-xs"
                />
              );
            })}
            {/* Row 1 (bottom): 1, 4, 7, ... 34 */}
            {Array.from({ length: 12 }, (_, i) => {
              const n = (i + 1) * 3 - 2;
              return (
                <Zone key={`r1-${n}`} label={String(n)} type="straight" number={n}
                  bets={bets} players={players} onBet={onBet} disabled={disabled}
                  selectedChip={selectedChip}
                  red={RED_NUMBERS.has(n)}
                  className="text-xs"
                />
              );
            })}
          </div>

          {/* 2:1 column bets */}
          <div className="flex flex-col gap-1">
            {(['col3', 'col2', 'col1'] as BetType[]).map(t => (
              <Zone key={t} label="2:1" type={t}
                bets={bets} players={players} onBet={onBet} disabled={disabled}
                selectedChip={selectedChip} className="w-10 text-[10px] flex-1"
              />
            ))}
          </div>
        </div>

        {/* Dozen bets */}
        <div className="flex gap-1 ml-11 mr-11">
          {(['dozen1', 'dozen2', 'dozen3'] as BetType[]).map((t, i) => (
            <Zone key={t} label={`${i * 12 + 1}–${(i + 1) * 12}`} type={t}
              bets={bets} players={players} onBet={onBet} disabled={disabled}
              selectedChip={selectedChip} className="flex-1"
            />
          ))}
        </div>

        {/* Outside bets */}
        <div className="flex gap-1 ml-11 mr-11">
          {[
            { label: '1–18', type: 'low' as BetType },
            { label: 'EVEN', type: 'even' as BetType },
            { label: '●', type: 'red' as BetType, red: true },
            { label: '●', type: 'black' as BetType },
            { label: 'ODD', type: 'odd' as BetType },
            { label: '19–36', type: 'high' as BetType },
          ].map(({ label, type, red }) => (
            <Zone key={type} label={label} type={type}
              bets={bets} players={players} onBet={onBet} disabled={disabled}
              selectedChip={selectedChip} red={red} className="flex-1"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
