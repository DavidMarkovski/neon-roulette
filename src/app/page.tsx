'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';

export default function Lobby() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');

  function createTable() {
    router.push(`/table/${uuid()}`);
  }

  function joinTable(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim();
    if (code) router.push(`/table/${code}`);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen px-4 gap-10">
      <div className="text-center space-y-2 select-none">
        <p className="text-xs tracking-[0.4em] uppercase" style={{ color: 'rgba(0,212,255,0.5)' }}>
          ✦ Welcome to ✦
        </p>
        <h1
          className="text-3xl sm:text-5xl font-black tracking-widest uppercase leading-tight neon-text-bright"
        >
          DAVID&apos;S
        </h1>
        <h2
          className="text-2xl sm:text-4xl font-black tracking-widest uppercase leading-tight neon-text"
        >
          GALACTIC CASINO
        </h2>
        <h3
          className="text-xl sm:text-3xl font-black tracking-widest uppercase"
          style={{ color: '#ec4899', textShadow: '0 0 20px #ec4899' }}
        >
          OF DOOM
        </h3>
        <p className="text-xs tracking-widest pt-2" style={{ color: 'rgba(0,212,255,0.4)' }}>
          No Refunds &nbsp;·&nbsp; No Mercy &nbsp;·&nbsp; No Gravity
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={createTable}
          className="w-full py-4 text-base font-bold tracking-widest uppercase rounded neon-border neon-glow animate-pulse-neon transition-all hover:scale-105 active:scale-95"
          style={{ color: 'var(--neon)', background: 'rgba(0,212,255,0.06)' }}
        >
          ▶ Create Table
        </button>

        <div className="flex items-center gap-3" style={{ color: 'rgba(0,212,255,0.3)' }}>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,212,255,0.15)' }} />
          <span className="text-[10px] tracking-widest">OR JOIN</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,212,255,0.15)' }} />
        </div>

        <form onSubmit={joinTable} className="flex gap-2">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="Paste table code..."
            className="flex-1 bg-transparent px-4 py-3 text-sm rounded neon-border-dim outline-none placeholder-sky-900 text-sky-200 focus:neon-border transition-all"
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
