'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';

function GameCard({
  title, subtitle, accent, onClick,
}: {
  title: string; subtitle: string; accent: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-3 p-6 rounded-xl transition-all hover:scale-105 active:scale-95 text-left"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${accent}40`,
        boxShadow: `0 0 20px ${accent}15`,
      }}
    >
      <p className="text-xl font-black tracking-widest uppercase w-full"
        style={{ color: accent, textShadow: `0 0 15px ${accent}` }}>
        {title}
      </p>
      <p className="text-[11px] tracking-widest w-full" style={{ color: `${accent}80` }}>
        {subtitle}
      </p>
      <div
        className="w-full py-2.5 text-xs font-black tracking-widest uppercase rounded text-center transition-all mt-1"
        style={{ color: accent, border: `1px solid ${accent}50`, background: `${accent}0d` }}
      >
        Create Table
      </div>
    </button>
  );
}

export default function Lobby() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');

  function createRoulette() { router.push(`/table/${uuid()}`); }
  function createCrash()    { router.push(`/crash/${uuid()}`); }

  function joinGame(e: React.FormEvent) {
    e.preventDefault();
    const raw = joinCode.trim();
    if (!raw) return;
    try {
      const url = new URL(raw);
      router.push(url.pathname);
    } catch {
      // Raw UUID — assume roulette for backward compatibility
      router.push(`/table/${raw}`);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen px-4 gap-10">
      {/* Title */}
      <div className="text-center space-y-2 select-none">
        <p className="text-xs tracking-[0.4em] uppercase" style={{ color: 'rgba(0,212,255,0.5)' }}>
          ✦ Welcome to ✦
        </p>
        <h1 className="text-3xl sm:text-5xl font-black tracking-widest uppercase leading-tight neon-text-bright">
          DAVID&apos;S
        </h1>
        <h2 className="text-2xl sm:text-4xl font-black tracking-widest uppercase leading-tight neon-text">
          GALACTIC CASINO
        </h2>
        <h3
          className="text-xl sm:text-3xl font-black tracking-widest uppercase"
          style={{ color: '#ec4899', textShadow: '0 0 20px #ec4899' }}
        >
          OF FORTUNE
        </h3>
        <p className="text-xs tracking-widest pt-2" style={{ color: 'rgba(0,212,255,0.4)' }}>
          No Refunds &nbsp;·&nbsp; No Mercy &nbsp;·&nbsp; No Gravity
        </p>
      </div>

      {/* Game select */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <GameCard
          title="Roulette"
          subtitle="European · 37 pockets · Multiplayer"
          accent="#00d4ff"
          onClick={createRoulette}
        />
        <GameCard
          title="Crash"
          subtitle="Multiplier climb · Cash out in time"
          accent="#ec4899"
          onClick={createCrash}
        />
      </div>

      {/* Join divider */}
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <div className="flex items-center gap-3" style={{ color: 'rgba(0,212,255,0.3)' }}>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,212,255,0.15)' }} />
          <span className="text-[10px] tracking-widest">OR JOIN</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,212,255,0.15)' }} />
        </div>

        <form onSubmit={joinGame} className="flex gap-2">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="Paste invite link..."
            className="flex-1 bg-transparent px-4 py-3 text-sm rounded neon-border-dim outline-none placeholder-sky-900 text-sky-200 transition-all"
            style={{ background: 'var(--bg-card)' }}
          />
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="px-5 py-3 text-sm font-bold tracking-widest uppercase rounded neon-border-dim transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
            style={{ color: 'var(--neon)', background: 'rgba(0,212,255,0.06)' }}
          >
            Join
          </button>
        </form>
      </div>
    </main>
  );
}
