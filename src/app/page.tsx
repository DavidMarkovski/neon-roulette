'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';

export default function Lobby() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');

  function createTable() {
    const id = uuid();
    router.push(`/table/${id}`);
  }

  function joinTable(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim();
    if (code) router.push(`/table/${code}`);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen px-4 gap-12">
      <div className="text-center space-y-3">
        <h1
          className="text-6xl font-bold tracking-widest uppercase"
          style={{ color: '#a855f7', textShadow: '0 0 30px #a855f7, 0 0 60px #a855f7' }}
        >
          NEON
        </h1>
        <h2
          className="text-4xl font-bold tracking-widest uppercase"
          style={{ color: '#06b6d4', textShadow: '0 0 20px #06b6d4' }}
        >
          ROULETTE
        </h2>
        <p className="text-sm tracking-widest text-purple-400 uppercase opacity-70">
          Multiplayer · European · Cyberpunk
        </p>
      </div>

      <div className="flex flex-col gap-6 w-full max-w-sm">
        <button
          onClick={createTable}
          className="w-full py-4 text-lg font-bold tracking-widest uppercase rounded neon-border animate-pulse-glow transition-all hover:scale-105 active:scale-95"
          style={{ color: '#a855f7', background: 'rgba(168,85,247,0.08)' }}
        >
          Create Table
        </button>

        <div className="flex items-center gap-3 text-purple-600">
          <div className="flex-1 h-px bg-purple-900" />
          <span className="text-xs tracking-widest">OR JOIN</span>
          <div className="flex-1 h-px bg-purple-900" />
        </div>

        <form onSubmit={joinTable} className="flex gap-2">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="Paste table code..."
            className="flex-1 bg-transparent px-4 py-3 text-sm rounded neon-border outline-none placeholder-purple-800 text-purple-200 focus:shadow-[0_0_20px_rgba(168,85,247,0.4)]"
          />
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="px-5 py-3 text-sm font-bold tracking-widest uppercase rounded neon-border transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
            style={{ color: '#06b6d4', background: 'rgba(6,182,212,0.08)' }}
          >
            Join
          </button>
        </form>
      </div>
    </main>
  );
}
