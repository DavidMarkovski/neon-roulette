'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { supabase, supabaseReady } from '@/lib/supabase';
import {
  PLAYER_COLORS, randomResult, calculatePayout, totalBetAmount, getNumberColor,
} from '@/lib/game-logic';
import { playChipClick, playBallRattle, playWin, playLoss } from '@/lib/sounds';
import type { Bet, GamePhase, Player } from '@/lib/types';
import RouletteWheel from '@/components/roulette/RouletteWheel';
import BettingTable from '@/components/roulette/BettingTable';
import ChipSelector from '@/components/roulette/ChipSelector';
import GameHistory from '@/components/roulette/GameHistory';
import PlayerPanel from '@/components/roulette/PlayerPanel';

const STARTING_BALANCE = 10000;
const ROUND_TIMER = 30;
const REACTIONS = ['🎉', '💀', '🔥', '😤'] as const;

interface Reaction { emoji: string; ts: number; }

const CASINO_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">' +
  '<polygon points="40,2 78,40 40,78 2,40" fill="none" stroke="rgb(184,150,12)" stroke-width="0.7" opacity="0.5"/>' +
  '<polygon points="40,15 65,40 40,65 15,40" fill="none" stroke="rgb(184,150,12)" stroke-width="0.4" opacity="0.25"/>' +
  '<circle cx="40" cy="40" r="2.5" fill="none" stroke="rgb(184,150,12)" stroke-width="0.5" opacity="0.3"/>' +
  '<line x1="40" y1="2" x2="40" y2="78" stroke="rgb(184,150,12)" stroke-width="0.2" opacity="0.12"/>' +
  '<line x1="2" y1="40" x2="78" y2="40" stroke="rgb(184,150,12)" stroke-width="0.2" opacity="0.12"/>' +
  '</svg>'
);
const CASINO_BG = [
  `url("data:image/svg+xml,${CASINO_SVG}")`,
  'radial-gradient(ellipse 80% 45% at 50% 0%, rgba(212,170,60,0.08) 0%, transparent 68%)',
  'radial-gradient(ellipse 30% 70% at 2% 50%, rgba(0,212,255,0.04) 0%, transparent 100%)',
  'radial-gradient(ellipse 30% 70% at 98% 50%, rgba(0,212,255,0.04) 0%, transparent 100%)',
].join(', ');

function upsertPlayer(prev: Player[], incoming: Partial<Player> & { id: string }): Player[] {
  const exists = prev.find(p => p.id === incoming.id);
  if (exists) {
    return prev.map(p => p.id === incoming.id ? { ...p, ...incoming } : p);
  }
  const next = [
    ...prev,
    { isHost: false, bets: [], balance: STARTING_BALANCE, confirmed: false, ...incoming } as Player,
  ];
  return next
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p, i) => ({ ...p, isHost: i === 0 }));
}

function NumberDot({ n, glow }: { n: number; glow?: string }) {
  const col = getNumberColor(n);
  const baseGlow = col === 'green' ? '#10b981' : col === 'red' ? '#ef4444' : '#334155';
  const g = glow ?? baseGlow;
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center font-black"
      style={{
        background: col === 'green' ? '#064e3b' : col === 'red' ? '#7f1d1d' : '#0f172a',
        color: col === 'green' ? '#10b981' : col === 'red' ? '#f87171' : '#94a3b8',
        boxShadow: `0 0 8px ${g}60`,
        border: `1px solid ${g}40`,
        fontFamily: 'Courier New, monospace',
        fontSize: 11,
      }}
    >
      {n}
    </div>
  );
}

function HotColdNumbers({ history }: { history: number[] }) {
  if (history.length === 0) return null;

  if (history.length < 5) {
    return (
      <div className="flex items-center gap-1.5 justify-center flex-wrap">
        <span className="text-[11px] tracking-widest uppercase mr-1 font-semibold" style={{ color: 'rgba(0,212,255,0.4)' }}>
          Recent
        </span>
        {history.slice(0, 6).map((n, i) => <NumberDot key={i} n={n} />)}
      </div>
    );
  }

  const freq = new Map<number, number>();
  history.forEach(n => freq.set(n, (freq.get(n) ?? 0) + 1));
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const hot = sorted.slice(0, 3).map(([n]) => n);
  const cold = [...sorted].reverse().slice(0, 3).map(([n]) => n);

  return (
    <div className="flex items-center gap-4 justify-center flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] tracking-widest uppercase font-semibold" style={{ color: '#f87171' }}>HOT</span>
        {hot.map((n, i) => <NumberDot key={i} n={n} glow="#ef4444" />)}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] tracking-widest uppercase font-semibold" style={{ color: '#60a5fa' }}>COLD</span>
        {cold.map((n, i) => <NumberDot key={i} n={n} glow="#60a5fa" />)}
      </div>
    </div>
  );
}

export default function GameTable({ tableId }: { tableId: string }) {
  const [nameInput, setNameInput] = useState('');
  const [joined, setJoined] = useState(false);
  const playerName = useRef('');

  const playerIdRef = useRef<string>(uuid());
  const colorRef    = useRef<string>(PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]);

  const [balance, setBalance]           = useState(STARTING_BALANCE);
  const [bets, setBets]                 = useState<Bet[]>([]);
  const [lastBets, setLastBets]         = useState<Bet[]>([]);
  const [selectedChip, setSelectedChip] = useState(50);
  const [phase, setPhase]               = useState<GamePhase>('betting');
  const [result, setResult]             = useState<number | null>(null);
  const [history, setHistory]           = useState<number[]>([]);
  const [players, setPlayers]           = useState<Player[]>([]);
  const [winAmount, setWinAmount]       = useState<number | null>(null);
  const [resultKey, setResultKey]       = useState(0);
  const [myConfirmed, setMyConfirmed]   = useState(false);
  const [countdown, setCountdown]       = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [copied, setCopied]             = useState(false);
  const [reactions, setReactions]       = useState<Record<string, Reaction>>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef   = useRef<any>(null);
  const betsRef      = useRef<Bet[]>([]);
  const lastBetsRef  = useRef<Bet[]>([]);
  const balanceRef   = useRef(STARTING_BALANCE);
  const confirmedRef = useRef(false);
  const phaseRef     = useRef<GamePhase>('betting');
  const playersRef   = useRef<Player[]>([]);
  const resultRef    = useRef<number | null>(null);
  const rattleStopRef = useRef<(() => void) | null>(null);
  const hadMultiplePlayersRef = useRef(false);

  betsRef.current    = bets;
  balanceRef.current = balance;
  confirmedRef.current = myConfirmed;
  phaseRef.current   = phase;
  playersRef.current = players;
  resultRef.current  = result;

  const isLead = useCallback(() => {
    const all = playersRef.current;
    if (!all.length) return true;
    const sorted = [...all].sort((a, b) => a.id.localeCompare(b.id));
    return sorted[0].id === playerIdRef.current;
  }, []);

  const triggerSpin = useCallback(async () => {
    if (phaseRef.current !== 'betting') return;
    rattleStopRef.current?.();
    rattleStopRef.current = playBallRattle();
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
    rattleStopRef.current?.();
    rattleStopRef.current = playBallRattle();
    setResult(spinResult);
    setPhase('spinning');
    setResultKey(k => k + 1);
    phaseRef.current = 'spinning';
  }, []);

  useEffect(() => {
    if (players.length > 1) hadMultiplePlayersRef.current = true;
  }, [players]);

  useEffect(() => {
    if (phase !== 'betting' || !myConfirmed) return;
    const others = players.filter(p => p.id !== playerIdRef.current);
    if (hadMultiplePlayersRef.current && others.length === 0) return;
    const allOthersReady = others.every(p => p.confirmed);
    if (allOthersReady) {
      setCountdown(0);
      if (isLead()) triggerSpin();
    }
  }, [players, phase, myConfirmed, isLead, triggerSpin]);

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

  useEffect(() => {
    if (!joined) return;
    const id = setInterval(() => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'heartbeat',
        payload: {
          playerId: playerIdRef.current,
          playerName: playerName.current,
          color: colorRef.current,
          balance: balanceRef.current,
          bets: betsRef.current,
          confirmed: confirmedRef.current,
        },
      });
    }, 4000);
    return () => clearInterval(id);
  }, [joined]);

  useEffect(() => {
    if (!joined) return;

    const channel = supabase.channel(`roulette:${tableId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'join' }, () => {})
      .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: Array<{ playerId: string }> }) => {
        const leftIds = leftPresences.map(p => p.playerId);
        setPlayers(prev => prev.filter(p => !leftIds.includes(p.id)));
      })
      .on('broadcast', { event: 'join_announce' }, ({ payload }: { payload: { playerId: string; playerName: string; color: string; balance: number } }) => {
        setPlayers(prev => upsertPlayer(prev, {
          id: payload.playerId,
          name: payload.playerName,
          color: payload.color,
          balance: payload.balance,
          bets: [],
          confirmed: false,
        }));
        // Reply with full state including current phase for desync recovery
        channelRef.current?.send({
          type: 'broadcast',
          event: 'join_ack',
          payload: {
            playerId: playerIdRef.current,
            playerName: playerName.current,
            color: colorRef.current,
            balance: balanceRef.current,
            bets: betsRef.current,
            confirmed: confirmedRef.current,
            phase: phaseRef.current,
            spinResult: resultRef.current,
          },
        });
      })
      .on('broadcast', { event: 'join_ack' }, ({ payload }: {
        payload: {
          playerId: string; playerName: string; color: string; balance: number;
          bets: Bet[]; confirmed: boolean; phase?: GamePhase; spinResult?: number | null;
        }
      }) => {
        setPlayers(prev => upsertPlayer(prev, {
          id: payload.playerId,
          name: payload.playerName,
          color: payload.color,
          balance: payload.balance,
          bets: payload.bets,
          confirmed: payload.confirmed,
        }));
        // Desync recovery: catch up if peer is ahead in the round
        if (phaseRef.current === 'betting') {
          if (payload.phase === 'spinning' && payload.spinResult != null) {
            handleSpinBroadcast(payload.spinResult);
          } else if (payload.phase === 'result' && payload.spinResult != null) {
            setResult(payload.spinResult);
            setPhase('result');
            phaseRef.current = 'result';
          }
        }
      })
      .on('broadcast', { event: 'heartbeat' }, ({ payload }: { payload: { playerId: string; playerName: string; color: string; balance: number; bets: Bet[]; confirmed: boolean } }) => {
        setPlayers(prev => upsertPlayer(prev, {
          id: payload.playerId,
          name: payload.playerName,
          color: payload.color,
          balance: payload.balance,
          bets: payload.bets,
          confirmed: payload.confirmed,
        }));
      })
      .on('broadcast', { event: 'bet_update' }, ({ payload }: { payload: { playerId: string; bets: Bet[] } }) => {
        setPlayers(prev => prev.map(p =>
          p.id === payload.playerId ? { ...p, bets: payload.bets } : p
        ));
      })
      .on('broadcast', { event: 'player_confirmed' }, ({ payload }: { payload: { playerId: string } }) => {
        setPlayers(prev => prev.map(p =>
          p.id === payload.playerId ? { ...p, confirmed: true } : p
        ));
      })
      .on('broadcast', { event: 'balance_update' }, ({ payload }: { payload: { playerId: string; balance: number } }) => {
        setPlayers(prev => prev.map(p =>
          p.id === payload.playerId ? { ...p, balance: payload.balance } : p
        ));
      })
      .on('broadcast', { event: 'spin_result' }, ({ payload }: { payload: { result: number } }) => {
        handleSpinBroadcast(payload.result);
      })
      .on('broadcast', { event: 'round_new' }, () => {
        setBets([]);
        betsRef.current = [];
        setResult(null);
        setWinAmount(null);
        setMyConfirmed(false);
        confirmedRef.current = false;
        setPhase('betting');
        phaseRef.current = 'betting';
        setPlayers(prev => prev.map(p => ({ ...p, bets: [], confirmed: false })));
      })
      .on('broadcast', { event: 'player_reaction' }, ({ payload }: { payload: { playerId: string; emoji: string } }) => {
        const ts = Date.now();
        setReactions(prev => ({ ...prev, [payload.playerId]: { emoji: payload.emoji, ts } }));
        setTimeout(() => {
          setReactions(prev => {
            const r = prev[payload.playerId];
            if (r?.ts === ts) {
              const { [payload.playerId]: _, ...rest } = prev;
              return rest;
            }
            return prev;
          });
        }, 2000);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            playerId: playerIdRef.current,
            playerName: playerName.current,
            color: colorRef.current,
          });
          await channel.send({
            type: 'broadcast',
            event: 'join_announce',
            payload: {
              playerId: playerIdRef.current,
              playerName: playerName.current,
              color: colorRef.current,
              balance: balanceRef.current,
            },
          });
          setPlayers(prev => upsertPlayer(prev, {
            id: playerIdRef.current,
            name: playerName.current,
            color: colorRef.current,
            balance: balanceRef.current,
            bets: [],
            confirmed: false,
          }));
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [joined, tableId, handleSpinBroadcast]);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    playerName.current = nameInput.trim();
    setJoined(true);
  }

  function handleBet(bet: Bet) {
    if (phase !== 'betting' || myConfirmed) return;
    if (bet.amount > balanceRef.current) return;
    playChipClick();
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
    channelRef.current?.send({
      type: 'broadcast',
      event: 'bet_update',
      payload: { playerId: playerIdRef.current, bets: next },
    });
  }

  function clearBets() {
    if (myConfirmed) return;
    setBets([]);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'bet_update',
      payload: { playerId: playerIdRef.current, bets: [] },
    });
  }

  function handleConfirm() {
    setMyConfirmed(true);
    confirmedRef.current = true;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'player_confirmed',
      payload: { playerId: playerIdRef.current },
    });
  }

  function handleSpinComplete(spinResult: number) {
    rattleStopRef.current?.();
    rattleStopRef.current = null;

    const currentBets = betsRef.current;
    betsRef.current = [];
    setBets([]);

    // Save for Repeat / Double
    lastBetsRef.current = currentBets;
    setLastBets(currentBets);

    const won  = calculatePayout(currentBets, spinResult);
    const lost = totalBetAmount(currentBets);
    const newBal = balanceRef.current - lost + won;
    const winAmt = currentBets.length === 0 ? null : (won > 0 ? won - lost : -lost);

    if (currentBets.length > 0) {
      if (winAmt !== null && winAmt >= 0) playWin();
      else playLoss();
    }

    setBalance(newBal);
    balanceRef.current = newBal;
    setWinAmount(winAmt);
    setHistory(h => [spinResult, ...h].slice(0, 20));
    setPhase('result');
    phaseRef.current = 'result';
    setPlayers(prev => prev.map(p =>
      p.id === playerIdRef.current ? { ...p, balance: newBal, bets: [], confirmed: false } : p
    ));
    channelRef.current?.send({
      type: 'broadcast',
      event: 'balance_update',
      payload: { playerId: playerIdRef.current, balance: newBal },
    });
  }

  async function handleNewRound() {
    setBets([]);
    betsRef.current = [];
    setResult(null);
    setWinAmount(null);
    setMyConfirmed(false);
    confirmedRef.current = false;
    setPhase('betting');
    phaseRef.current = 'betting';
    setPlayers(prev => prev.map(p =>
      p.id === playerIdRef.current ? { ...p, bets: [], confirmed: false } : p
    ));
    await channelRef.current?.send({ type: 'broadcast', event: 'round_new', payload: {} });
  }

  async function handleRepeatBets(multiplier: 1 | 2) {
    const source = lastBetsRef.current;
    if (!source.length) return;
    const newBets = source.map(b => ({ ...b, amount: b.amount * multiplier }));
    if (totalBetAmount(newBets) > balanceRef.current) return;

    // Start new round
    setBets([]);
    betsRef.current = [];
    setResult(null);
    setWinAmount(null);
    setMyConfirmed(false);
    confirmedRef.current = false;
    setPhase('betting');
    phaseRef.current = 'betting';
    setPlayers(prev => prev.map(p =>
      p.id === playerIdRef.current ? { ...p, bets: [], confirmed: false } : p
    ));
    await channelRef.current?.send({ type: 'broadcast', event: 'round_new', payload: {} });

    // Pre-populate with last bets
    setBets(newBets);
    betsRef.current = newBets;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'bet_update',
      payload: { playerId: playerIdRef.current, bets: newBets },
    });
  }

  function sendReaction(emoji: string) {
    const ts = Date.now();
    setReactions(prev => ({ ...prev, [playerIdRef.current]: { emoji, ts } }));
    channelRef.current?.send({
      type: 'broadcast',
      event: 'player_reaction',
      payload: { playerId: playerIdRef.current, emoji },
    });
    setTimeout(() => {
      setReactions(prev => {
        const r = prev[playerIdRef.current];
        if (r?.ts === ts) {
          const { [playerIdRef.current]: _, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    }, 2000);
  }

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/table/${tableId}`
    : '';

  function copyShareUrl() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasBets = bets.length > 0;
  const otherPlayers = players.filter(p => p.id !== playerIdRef.current);
  const waitingOn = otherPlayers.filter(p => !p.confirmed);
  const canDouble = lastBets.length > 0 && totalBetAmount(lastBets) * 2 <= balance;

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
              David&apos;s Galactic<br />Casino of Fortune
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
          David&apos;s Galactic Casino of Fortune
        </h1>

        <button
          onClick={copyShareUrl}
          className="text-[10px] px-3 py-1.5 rounded shrink-0 transition-all hover:scale-105"
          style={{
            color: copied ? '#10b981' : 'var(--neon)',
            border: `1px solid ${copied ? '#10b981' : 'rgba(0,212,255,0.3)'}`,
            background: copied ? 'rgba(16,185,129,0.08)' : 'rgba(0,212,255,0.04)',
          }}
        >
          {copied ? '✓ Copied!' : 'Invite'}
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
        {/* Sidebar */}
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

          <div className="rounded-lg p-2.5 flex flex-col gap-1.5" style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)' }}>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--neon)' }}>
              Invite Link
            </p>
            <p className="text-[10px] break-all leading-relaxed" style={{ color: 'rgba(0,212,255,0.55)', fontFamily: 'Courier New, monospace' }}>
              {shareUrl}
            </p>
            <button
              onClick={copyShareUrl}
              className="mt-0.5 py-1.5 text-xs font-bold tracking-widest uppercase rounded transition-all hover:scale-105 active:scale-95"
              style={{
                color: copied ? '#10b981' : 'var(--neon)',
                border: `1px solid ${copied ? '#10b98160' : 'rgba(0,212,255,0.3)'}`,
                background: copied ? 'rgba(16,185,129,0.08)' : 'rgba(0,212,255,0.06)',
              }}
            >
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>

          <PlayerPanel players={players} currentPlayerId={playerIdRef.current} reactions={reactions} />
          <GameHistory history={history} />
        </aside>

        {/* Click-away overlay on mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col items-center gap-3 p-3 overflow-y-auto overflow-x-hidden" style={{ backgroundImage: CASINO_BG }}>
          {/* Hot/Cold numbers */}
          <HotColdNumbers history={history} />

          {/* Wheel */}
          <div className="wheel-container shrink-0">
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
              winResult={phase === 'result' ? result : null}
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center gap-3 w-full max-w-2xl pb-4 shrink-0">
            {/* Balance */}
            <div className="flex items-center gap-3">
              <span className="text-xs tracking-widest uppercase font-semibold" style={{ color: 'rgba(0,212,255,0.5)' }}>
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

            {/* Reaction buttons — always visible */}
            <div className="flex gap-2 justify-center">
              {REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-transform hover:scale-125 active:scale-110"
                  style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.12)' }}
                >
                  {emoji}
                </button>
              ))}
            </div>

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
                  hasBets ? (
                    <button
                      onClick={handleConfirm}
                      className="px-8 py-3 text-base font-black tracking-widest uppercase rounded transition-all hover:scale-105 active:scale-95 neon-border neon-glow animate-pulse-neon"
                      style={{ color: 'var(--neon)', background: 'rgba(0,212,255,0.06)' }}
                    >
                      ✓ CONFIRM BETS
                    </button>
                  ) : (
                    <button
                      onClick={handleConfirm}
                      className="px-6 py-2.5 text-sm font-bold tracking-widest uppercase rounded transition-all hover:scale-105 active:scale-95"
                      style={{ color: 'rgba(0,212,255,0.55)', border: '1px solid rgba(0,212,255,0.22)', background: 'rgba(0,212,255,0.04)' }}
                    >
                      Sit Out
                    </button>
                  )
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-bold tracking-widest" style={{ color: '#10b981' }}>
                      {bets.length === 0 ? '✓ Sitting Out' : '✓ Bets Confirmed'}
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
              <div className="flex flex-col items-center gap-3">
                {lastBets.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRepeatBets(1)}
                      className="px-5 py-2.5 text-sm font-black tracking-widest uppercase rounded transition-all hover:scale-105 active:scale-95"
                      style={{ color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.06)' }}
                    >
                      ↩ Repeat
                    </button>
                    <button
                      onClick={() => handleRepeatBets(2)}
                      disabled={!canDouble}
                      className="px-5 py-2.5 text-sm font-black tracking-widest uppercase rounded transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ color: '#ec4899', border: '1px solid rgba(236,72,153,0.4)', background: 'rgba(236,72,153,0.06)' }}
                    >
                      ×2 Double
                    </button>
                  </div>
                )}
                <button
                  onClick={handleNewRound}
                  className="px-10 py-3 text-base font-black tracking-widest uppercase rounded neon-border transition-all hover:scale-105 active:scale-95"
                  style={{ color: 'var(--neon)', background: 'rgba(0,212,255,0.06)' }}
                >
                  New Round ▶
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
