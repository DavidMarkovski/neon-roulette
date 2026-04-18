'use client';

import { CHIP_DENOMINATIONS } from '@/lib/game-logic';

interface Props {
  selected: number;
  onSelect: (amount: number) => void;
  balance: number;
}

const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  10:   { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  50:   { bg: '#3b1f5e', border: '#a855f7', text: '#d8b4fe' },
  100:  { bg: '#5e1f3b', border: '#ec4899', text: '#fbcfe8' },
  500:  { bg: '#5e3b1f', border: '#f59e0b', text: '#fde68a' },
  1000: { bg: '#1f5e3b', border: '#10b981', text: '#a7f3d0' },
};

export default function ChipSelector({ selected, onSelect, balance }: Props) {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      {CHIP_DENOMINATIONS.map(d => {
        const c = CHIP_COLORS[d];
        const isSelected = selected === d;
        const canAfford = balance >= d;
        return (
          <button
            key={d}
            onClick={() => canAfford && onSelect(d)}
            disabled={!canAfford}
            className={`chip w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold border-2 ${isSelected ? 'selected' : ''}`}
            style={{
              background: c.bg,
              borderColor: isSelected ? c.border : `${c.border}66`,
              color: c.text,
              boxShadow: isSelected ? `0 0 14px ${c.border}99, 0 0 28px ${c.border}44` : 'none',
              opacity: canAfford ? 1 : 0.3,
            }}
            title={`$${d.toLocaleString()}`}
          >
            {d >= 1000 ? `${d / 1000}k` : d}
          </button>
        );
      })}
    </div>
  );
}
