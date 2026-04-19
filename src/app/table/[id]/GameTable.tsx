'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { supabase, supabaseReady } from '@/lib/supabase';
import {
  PLAYER_COLORS, randomResult, calculatePayout, totalBetAmount, getNumberColor,
} from '@/lib/game-logic';
import type { Bet, GamePhase, Player } from '@/lib/types';
import RouletteWheel from '@/components/roulette/RouletteWheel';
import BettingTable from '@/components/roulette/BettingTable';
import ChipSelector from '@/components/roulette/ChipSelector';
import GameHistory from '@/components/roulette/GameHistory';
import PlayerPanel from '@/components/roulette/PlayerPanel';

const STARTING_BALANCE = 10000;
const ROUND_TIMER = 30;

interface PresenceEntry {
  playerId: string;
  playerName: string;
  color: string;
  bets: Bet[];
  balance: number;
  confirmed: boolean;
}

function HotNumbers({ history }: { history: number[] }) {
  const recent = history.slice(0, 6);
  if (!recent.length) return null;
  return (
    <div className="flex items-center gap-1.5 justify-center flex-wrap">
      <span className="text-[9px] tracking-widest uppercase mr-1" style={{ color: 'rgba(0,212,255,0.4)' }}>
        Recent
      </span>
      {recent.map((n, i) => {
        const col = getNumberColor(n);
        return (
          <div key={i}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
            style={{
              background: col === 'green' ? '#064e3b' : col === 'red' ? '#7f1d1d' : '#0f172a',
              color: col === 'green' ? '#10b981' : col === 'red' ? '#f87171' : '#94a3b8',
              boxShadow: `0 0 8px ${col === 'green' ? '#10b98150' : col === 'red' ? '#ef444450' : '#33415530'}`,
              border: `1px solid ${col === 'green' ? '#10b98130' : col === 'red' ? '#ef444430' : '#33415530'}`,
              fontFamily: 'Courier New, monospace',
              fontSize: 11,
            }}
          >
            {n}
          </div>
        );
      })}
    </div>
  );
}

export default function GameTable({ tableId }: { tableId: string }) {
  const [nameInput, setNameInput] = useState('');
  const [joined, setJoined] = useState(false);
  const playerName = useRef('');

  const playerIdRef = useRef<string>(uuid());
  const colorRef    = useRef<string>(PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]);

  const [balance, setBalance]       = useState(STARTING_BALANCE);
  const [bets, setBets]             = useState<Bet[]>([]);
  const [selectedChip, setSelectedChip] = useState(50);
  const [phase, setPhase]           = useState<GamePhase>('betting');
  const [result, setResult]         = useState<number | null>(null);
  const [history, setHistory]       = useState<number[]>([]);
  const [players, setPlayers]       = useState<Player[]>([]);
  const [winAmount, setWinAmount]   = useState<number | null>(null);
  const [resultKey, setResultKey]   = useState(0);
  const [myConfirmed, setMyConfirmed] = useState(false);
  const [countdown, setCountdown]   = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef  = useRef<any>(null);
  const betsRef     = useRef<Bet[]>([]);
  const balanceRef  = useRef(STARTING_BALANCE);
  const confirmedRef = useRef(false);
  const phaseRef    = useRef<GamePhase>('betting');
  const playersRef  = useRef<Player[]>([]);

  betsRef.current    = bets;
  balanceRef.current = balance;
  confirmedRef.current = myConfirmed;
  phaseRef.current   = phase;
  playersRef.current = players;

  // Smallest ID in the room is the "lead" who triggers spins
  const isLead = useCallback(() => {
    const all = playersRef.current;
    if (!all.length) return true;
    const sorted = [...all].sort((a, b) => a.id.localeCompare(b.id));
    return sorted[0].id === playerIdRef.current;
  }, []);

  const syncPresence = useCallback(async (patch: Partial<PresenceEntry> = {}) => {
    if (!channelRef.current) return;
    await channelRef.current.track({
      playerId: playerIdRef.current,
      playerName: playerName.current,
      color: colorRef.current,
      bets: betsRef.current,
      balance: balanceRef.current,
      confirmed: confirmedRef.current,
      ...patch,
    } satisfies PresenceEntry);
  }, []);

  const triggerSpin = useCallback(async () => {
    if (phaseRef.current !== 'betting') return;
    const spinResult = randomResult();
    await channelRef.current?.send({
      type: 'broadcast',
      event: 'spin_result',
      payload: { result: spinResult },
    });
    setResult(spinResult);
    setPhase('spinning');
    setResultKey(k => k + 1);
    phaseRef.current = 'spinning';
  }, []);

  const handleSpinBroadcast = useCallback((spinResult: number) => {
    setResult(spinResult);
    setPhase('spinning');
    setResultKey(k => k + 1);
    phaseRef.current = 'spinning';
  }, []);

  // Auto-spin when all players confirmed
  useEffect(() => {
    if (phase !== 'betting' || players.length === 0) return;
    const allReady = players.every(p => p.confirmed);
    if (allReady && isLead()) {
      triggerSpin();
    }
  }, [players, phase, isLead, triggerSpin]);

  // Countdown timer — resets each round
  useEffect(() => {
    if (!joined || phase !== 'betting') { setCountdown(null); return; }
    setCountdown(ROUND_TIMER);
  }, [joined, phase]);

  useEffect(() => {
    if (countdown === null || countdown <= 0 || phase !== 'betting') return;
    const t = setTimeout(() => setCountdown(c => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  useEffect(() => {
    if (countdown === 0 && phase === 'betting' && isLead()) {
      triggerSpin();
    }
  }, [countdown, phase, isLead, triggerSpin]);

  // Supabase channel
  useEffect(() => {
    if (!joined) return;

    const channel = supabase.channel(`roulette:${tableId}`, {
      config: { broadcast: { self: false }, presence: { key: playerIdRef.current } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceEntry>();
        const raw = Object.values(state).flat();

        // Deduplicate by playerId (take latest entry per player)
        const map = new Map<string, PresenceEntry>();
        for (const e of raw) map.set(e.playerId, e);
        const unique = [...map.values()].sort((a, b) => a.playerId.localeCompare(b.playerId));

        setPlayers(unique.map((e, i) => ({
          id: e.playerId,
          name: e.playerName,
          color: e.color,
          balance: e.balance,
          bets: e.bets,
          isHost: i === 0,
          confirmed: e.confirmed,
        })));
      })
      .on('broadcast', { event: 'spin_result' }, ({ payload }: { payload: { result: number } }) => {
        handleSpinBroadcast(payload.result);
      })
      .on('broadcast', { event: 'round_new' }, () => {
        setBets([]);
        setResult(null);
        setWinAmount(null);
        setMyConfirmed(false);
        confirmedRef.current = false;
        setPhase('betting');
        phaseRef.current = 'betting';
        syncPresence({ bets: [], confirmed: false });
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            playerId: playerIdRef.current,
            playerName: playerName.current,
            color: colorRef.current,
            bets: [],
            balance: STARTING_BALANCE,
            confirmed: false,
          } satisfies PresenceEntry);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [joined, tableId, syncPresence, handleSpinBroadcast]);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    playerName.current = nameInput.trim();
    setJoined(true);
  }

  function handleBet(bet: Bet) {
    if (phase !== 'betting' || myConfirmed) return;
    if (bet.amount > balanceRef.current) return;
    const existing = betsRef.current.findIndex(
      b => b.type === bet.type && b.number === bet.number,
    );
    let next: Bet[];
    if (existing >= 0) {
      next = betsRef.current.map((b, i) =>
        i === existing ? { ...b, amount: b.amount + bet.amount } : b,
      );
    } else {
      next = [...betsRef.current, bet];
    }
    if (totalBetAmount(next) > balanceRef.current) return;
    setBets(next);
    syncPresence({ bets: next });
  }

  function clearBets() {
    if (myConfirmed) return;
    setBets([]);
    syncPresence({ bets: [] });
  }

  function handleConfirm() {
    setMyConfirmed(true);
    confirmedRef.current = true;
    syncPresence({ confirmed: true });
  }

  function handleSpinComplete(spinResult: number) {
    const won  = calculatePayout(betsRef.current, spinResult);
    const lost = totalBetAmount(betsRef.current);
    const newBal = balanceRef.current - lost + won;
    setBalance(newBal);
    balanceRef.current = newBal;
    setWinAmount(won > 0 ? won - lost : -lost);
    setHistory(h => [spinResult, ...h].slice(0, 20));
    setPhase('result');
    phaseRef.current = 'result';
    syncPresence({ balance: newBal, bets: [], confirmed: false });
  }

  async function handleNewRound() {
    setBets([]);
    setResult(null);
    setWinAmount(null);
    setMyConfirmed(false);
    confirmedRef.current = false;
    setPhase('betting');
    phaseRef.current = 'betting';
    syncPresence({ bets: [], confirmed: false });
    await channelRef.current?.send({ type: 'broadcast', event: 'round_new', payload: {} });
  }

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/table/${tableId}`
    : '';

  const hasBets = bets.length > 0;
  const otherPlayers = players.filter(p => p.id !== playerIdRef.current);
  const waitingOn = otherPlayers.filter(p => !p.confirmed);

  if (!supabaseReady) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <p className="text-xl font-bold tracking-widest" style={{ color: '#ef4444' }}>
          ⚠ Supabase Not Configured
        </p>
        <p className="text-sm max-w-sm" style={{ color: 'rgba(0,212,255,0.5)' }}>
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to Vercel env vars, then redeploy.
        </p>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen px-4">
        <form
          onSubmit={handleJoin}
          className="flex flex-col gap-5 w-full max-w-xs p-8 rounded-xl neon-border"
          style={{ background: 'var(--bg-card)' }}
        >
          <div className="text-center">
            <h1 className="text-lg font-black tracking-widest uppercase neon-text">
              David&apos;s Galactic<br />Casino of Doom
            </h1>
            <p className="text-[10px] mt-1 tracking-widest" style={{ color: 'rgba(0,212,255,0.4)' }}>
              Enter the table
            </p>
          </div>
          <input
            autoFocus
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            placeholder="Your name..."
            maxLength={20}
            className="bg-transparent px-4 py-3 rounded neon-border-dim outline-none text-sky-200 placeholder-sky-900 text-sm"
          />
          <button
            type="submit"
            disabled={!nameInput.trim()}
            className="py-3 font-black tracking-widest uppercase rounded neon-border transition-all hover:scale-105 active:scale-95 disabled:opacity-30 neon-text"
            style={{ background: 'rgba(0,212,255,0.06)' }}
          >
            Sit Down ▶
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid rgba(0,212,255,0.12)', background: 'var(--bg-card)' }}>
        <button
          className="lg:hidden text-xs px-2 py-1 rounded"
          style={{ color: 'var(--neon)', border: '1px solid rgba(0,212,255,0.3)' }}
          onClick={() => setSidebarOpen(o => !o)}
        >
          Players
        </button>

        <h1 className="text-sm sm:text-base font-black tracking-widest uppercase neon-text text-center flex-1 px-2">
          David&apos;s Galactic Casino of Doom
        </h1>

        <button
          onClick={() => { navigator.clipboard.writeText(shareUrl); }}
          className="text-[10px] px-3 py-1.5 rounded shrink-0 transition-all hover:scale-105"
          style={{ color: 'var(--neon)', border: '1px solid rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.04)' }}
        >
          Share
        </button>
      </header>

      {/* Countdown bar */}
      {phase === 'betting' && countdown !== null && (
        <div className="w-full h-1 shrink-0" style={{ background: 'rgba(0,212,255,0.1)' }}>
          <div
            className="h-full transition-all"
            style={{
              width: `${(countdown / ROUND_TIMER) * 100}%`,
              background: countdown <= 5 ? '#ef4444' : 'var(--neon)',
              boxShadow: `0 0 8px ${countdown <= 5 ? '#ef4444' : 'var(--neon)'}`,
            }}
          />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar — desktop always visible, mobile overlay */}
        <aside
          className={`
            ${sidebarOpen ? 'flex' : 'hidden'} lg:flex
            flex-col gap-3 p-3 w-56 shrink-0 overflow-y-auto
            absolute lg:relative inset-y-0 left-0 z-50 lg:z-auto
          `}
          style={{ background: 'var(--bg-card)', borderRight: '1px solid rgba(0,212,255,0.1)' }}
        >
          {sidebarOpen && (
            <button className="lg:hidden text-xs self-end mb-1" style={{ color: 'var(--neon)' }} onClick={() => setSidebarOpen(false)}>
              ✕ Close
            </button>
          )}
          <PlayerPanel players={players} currentPlayerId={playerIdRef.current} />
          <GameHistory history={history} />
        </aside>

        {/* Click-away overlay on mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col items-center gap-3 p-3 overflow-y-auto">
          {/* Hot numbers */}
          <HotNumbers history={history} />

          {/* Wheel */}
          <div className="shrink-0" style={{ transform: 'scale(0.85)', transformOrigin: 'top center', marginBottom: -40 }}>
            <RouletteWheel
              key={resultKey}
              result={result}
              isSpinning={phase === 'spinning'}
              onSpinComplete={handleSpinComplete}
            />
          </div>

          {/* Win/Loss banner */}
          {phase === 'result' && winAmount !== null && (
            <div
              className="animate-float-in text-center py-2 px-8 rounded-lg text-xl font-black tracking-widest shrink-0"
              style={{
                color: winAmount >= 0 ? '#10b981' : '#ef4444',
                textShadow: `0 0 25px ${winAmount >= 0 ? '#10b981' : '#ef4444'}`,
                border: `1px solid ${winAmount >= 0 ? '#10b98160' : '#ef444460'}`,
                background: `${winAmount >= 0 ? '#10b98108' : '#ef444408'}`,
                fontFamily: 'Courier New, monospace',
              }}
            >
              {winAmount >= 0
                ? `+$${winAmount.toLocaleString()} 🎰`
                : `-$${Math.abs(winAmount).toLocaleString()}`}
            </div>
          )}

          {/* Spinning message */}
          {phase === 'spinning' && (
            <p className="text-sm tracking-widest uppercase animate-spin-pulse shrink-0" style={{ color: 'var(--neon)' }}>
              ⟳ Spinning…
            </p>
          )}

          {/* Betting table */}
          <div className="w-full max-w-2xl shrink-0">
            <BettingTable
              bets={bets}
              players={players}
              currentPlayerId={playerIdRef.current}
              onBet={handleBet}
              disabled={phase !== 'betting' || myConfirmed}
              selectedChip={selectedChip}
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center gap-3 w-full max-w-2xl pb-4 shrink-0">
            {/* Balance */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(0,212,255,0.5)' }}>
                Balance
              </span>
              <span className="text-lg font-black neon-text" style={{ fontFamily: 'Courier New, monospace' }}>
                ${balance.toLocaleString()}
              </span>
              {countdown !== null && phase === 'betting' && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{
                    color: countdown <= 5 ? '#ef4444' : 'rgba(0,212,255,0.7)',
                    border: `1px solid ${countdown <= 5 ? '#ef4444' : 'rgba(0,212,255,0.3)'}`,
                    fontFamily: 'Courier New, monospace',
                  }}
                >
                  {countdown}s
                </span>
              )}
            </div>

            {/* Chip selector */}
            <ChipSelector selected={selectedChip} onSelect={setSelectedChip} balance={balance} />

            {/* Betting-phase controls */}
            {phase === 'betting' && (
              <div className="flex items-center gap-3 flex-wrap justify-center">
                {hasBets && !myConfirmed && (
                  <button
                    onClick={clearBets}
                    className="px-4 py-2 text-sm font-bold tracking-widest uppercase rounded transition-all hover:scale-105"
                    style={{ color: '#94a3b8', border: '1px solid #334155', background: 'rgba(51,65,85,0.2)' }}
                  >
                    Clear
                  </button>
                )}

                {!myConfirmed ? (
                  <button
                    onClick={handleConfirm}
                    disabled={!hasBets}
                    className={`px-8 py-3 text-base font-black tracking-widest uppercase rounded transition-all hover:scale-105 active:scale-95 disabled:opacity-30 ${hasBets ? 'neon-border neon-glow animate-pulse-neon' : 'neon-border-dim'}`}
                    style={{ color: 'var(--neon)', background: 'rgba(0,212,255,0.06)' }}
                  >
                    {hasBets ? '✓ CONFIRM BETS' : 'Place a Bet'}
                  </button>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-bold tracking-widest" style={{ color: '#10b981' }}>
                      ✓ Bets Confirmed
                    </p>
                    {waitingOn.length > 0 ? (
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(0,212,255,0.5)' }}>
                        Waiting for: {waitingOn.map(p => p.name).join(', ')}
                      </p>
                    ) : players.length > 1 ? (
                      <p className="text-xs mt-0.5 animate-spin-pulse" style={{ color: 'var(--neon)' }}>
                        All ready — spinning…
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Result phase */}
            {phase === 'result' && (
              <button
                onClick={handleNewRound}
                className="px-10 py-3 text-base font-black tracking-widest uppercase rounded neon-border transition-all hover:scale-105 active:scale-95"
                style={{ color: 'var(--neon)', background: 'rgba(0,212,255,0.06)' }}
              >
                New Round ▶
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
