'use client';

import { CHIP_DENOMINATIONS } from '@/lib/game-logic';

interface Props {
  selected: number;
  onSelect: (amount: number) => void;
  balance: number;
}

const CHIP_STYLES: Record<number, { bg: string; border: string; text: string }> = {
  10:   { bg: '#0c2340', border: '#38bdf8', text: '#bae6fd' },
  50:   { bg: '#0c1f40', border: '#00d4ff', text: '#e0f9ff' },
  100:  { bg: '#3b0f5e', border: '#c084fc', text: '#f3e8ff' },
  500:  { bg: '#451a03', border: '#f59e0b', text: '#fef3c7' },
  1000: { bg: '#052e16', border: '#10b981', text: '#d1fae5' },
};

export default function ChipSelector({ selected, onSelect, balance }: Props) {
  return (
    <div className="flex gap-2 items-center flex-wrap justify-center">
      {CHIP_DENOMINATIONS.map(d => {
        const s = CHIP_STYLES[d];
        const active = selected === d;
        const canAfford = balance >= d;
        return (
          <button
            key={d}
            onClick={() => canAfford && onSelect(d)}
            disabled={!canAfford}
            className={`chip w-12 h-12 rounded-full flex items-center justify-center text-xs font-black border-2 ${active ? 'selected' : ''}`}
            style={{
              background: s.bg,
              borderColor: active ? s.border : `${s.border}55`,
              color: s.text,
              boxShadow: active ? `0 0 16px ${s.border}99, 0 0 32px ${s.border}44` : 'none',
              opacity: canAfford ? 1 : 0.25,
            }}
            title={`$${d.toLocaleString()}`}
          >
            {d >= 1000 ? '1k' : d}
          </button>
        );
      })}
    </div>
  );
}
