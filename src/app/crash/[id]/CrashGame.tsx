'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { supabase, supabaseReady } from '@/lib/supabase';
import { PLAYER_COLORS, CHIP_DENOMINATIONS } from '@/lib/game-logic';
import { generateCrashPoint, computeMultiplier, BETTING_TIME } from '@/lib/crash-logic';
import { playChipClick, playWin, playLoss } from '@/lib/sounds';
import CrashChart from '@/components/crash/CrashChart';
import CrashPlayerList, { type CrashPlayer } from '@/components/crash/CrashPlayerList';

const STARTING_BALANCE = 10000;

type CrashPhase = 'betting' | 'flying' | 'crashed';

function upsertPlayer(prev: CrashPlayer[], incoming: Partial<CrashPlayer> & { id: string }): CrashPlayer[] {
  if (prev.find(p => p.id === incoming.id)) {
    return prev.map(p => p.id === incoming.id ? { ...p, ...incoming } : p);
  }
  return [
    ...prev,
    {
      name: '', color: '#00d4ff', balance: STARTING_BALANCE,
      bet: 0, autoCashOut: null, confirmed: false,
      cashedOut: false, cashOutMultiplier: null,
      ...incoming,
    } as CrashPlayer,
  ].sort((a, b) => a.id.localeCompare(b.id));
}

function ChipSelector({ balance, onChip, onClear, bet }: {
  balance: number; bet: number; onChip: (v: number) => void; onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2 flex-wrap justify-center">
        {CHIP_DENOMINATIONS.map(v => (
          <button
            key={v}
            onClick={() => onChip(v)}
            disabled={v > balance - bet}
            className="chip px-3 py-1.5 rounded text-xs font-black tracking-wide uppercase transition-all hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              color: '#020b18',
              background: v === 10 ? '#00d4ff' : v === 50 ? '#10b981' : v === 100 ? '#f59e0b' : v === 500 ? '#ec4899' : '#a855f7',
              boxShadow: `0 0 10px ${v === 10 ? '#00d4ff' : v === 50 ? '#10b981' : v === 100 ? '#f59e0b' : v === 500 ? '#ec4899' : '#a855f7'}50`,
            }}
          >
            ${v >= 1000 ? `${v / 1000}k` : v}
          </button>
        ))}
      </div>
      {bet > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'rgba(0,212,255,0.5)' }}>Bet:</span>
          <span className="text-base font-black neon-text" style={{ fontFamily: 'Courier New, monospace' }}>
            ${bet.toLocaleString()}
          </span>
          <button
            onClick={onClear}
            className="text-xs px-2 py-0.5 rounded"
            style={{ color: '#94a3b8', border: '1px solid #334155' }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

export default function CrashGame({ tableId }: { tableId: string }) {
  const [nameInput, setNameInput]   = useState('');
  const [joined, setJoined]         = useState(false);
  const playerName = useRef('');

  const playerIdRef = useRef<string>(uuid());
  const colorRef    = useRef<string>(PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]);

  const [phase, setPhase]               = useState<CrashPhase>('betting');
  const [countdown, setCountdown]       = useState<number | null>(null);
  const [startTime, setStartTime]       = useState<number | null>(null);
  const [crashPoint, setCrashPoint]     = useState<number | null>(null);
  const [players, setPlayers]           = useState<CrashPlayer[]>([]);
  const [balance, setBalance]           = useState(STARTING_BALANCE);
  const [myBet, setMyBet]               = useState(0);
  const [autoCashOutInput, setAutoCashOutInput] = useState('');
  const [confirmed, setConfirmed]       = useState(false);
  const [cashedOut, setCashedOut]       = useState(false);
  const [cashOutMultiplier, setCashOutMultiplier] = useState<number | null>(null);
  const [history, setHistory]           = useState<number[]>([]);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [copied, setCopied]             = useState(false);
  const [crashed, setCrashed]           = useState(false);
  const [resultFlash, setResultFlash]   = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef       = useRef<any>(null);
  const phaseRef         = useRef<CrashPhase>('betting');
  const balanceRef       = useRef(STARTING_BALANCE);
  const startTimeRef     = useRef<number | null>(null);
  const crashPointRef    = useRef<number | null>(null);
  const cashedOutRef     = useRef(false);
  const confirmedRef     = useRef(false);
  const myBetRef         = useRef(0);
  const autoCashOutRef   = useRef<number | null>(null);
  const currentMultRef   = useRef(1.00);
  const crashFiredRef    = useRef(false);
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const playersRef       = useRef<CrashPlayer[]>([]);
  const hadMultiRef      = useRef(false);

  phaseRef.current     = phase;
  balanceRef.current   = balance;
  playersRef.current   = players;
  myBetRef.current     = myBet;
  confirmedRef.current = confirmed;
  cashedOutRef.current = cashedOut;

  const isLead = useCallback(() => {
    const all = playersRef.current;
    if (!all.length) return true;
    return [...all].sort((a, b) => a.id.localeCompare(b.id))[0].id === playerIdRef.current;
  }, []);

  // ── Round state helpers ─────────────────────────────────────────────────────

  function resetRound(keepPlayers = false) {
    setPhase('betting');   phaseRef.current = 'betting';
    setCrashPoint(null);   crashPointRef.current = null;
    setStartTime(null);    startTimeRef.current = null;
    setCrashed(false);
    setMyBet(0);           myBetRef.current = 0;
    setConfirmed(false);   confirmedRef.current = false;
    setCashedOut(false);   cashedOutRef.current = false;
    setCashOutMultiplier(null);
    currentMultRef.current = 1.00;
    crashFiredRef.current  = false;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (!keepPlayers) {
      setPlayers(prev => prev.map(p => ({
        ...p, bet: 0, confirmed: false, cashedOut: false, cashOutMultiplier: null,
      })));
    }
  }

  // ── Multiplier interval — auto-cashout + lead crash detection ──────────────

  useEffect(() => {
    if (phase !== 'flying' || !startTimeRef.current) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current!;
      const m = computeMultiplier(elapsed);
      currentMultRef.current = m;

      // Auto cash-out
      if (autoCashOutRef.current && m >= autoCashOutRef.current && !cashedOutRef.current) {
        handleCashOut();
      }

      // Lead crash detection
      if (isLead() && crashPointRef.current !== null && m >= crashPointRef.current && !crashFiredRef.current) {
        crashFiredRef.current = true;
        clearInterval(id);
        triggerCrash(crashPointRef.current);
      }
    }, 50);
    intervalRef.current = id;
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Countdown timer ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!joined || phase !== 'betting') { setCountdown(null); return; }
    setCountdown(BETTING_TIME);
  }, [joined, phase]);

  useEffect(() => {
    if (countdown === null || countdown <= 0 || phase !== 'betting') return;
    const t = setTimeout(() => setCountdown(c => c !== null ? c - 1 : null), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  useEffect(() => {
    if (countdown === 0 && phase === 'betting' && isLead()) triggerRoundStart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, phase]);

  // Auto-start when all confirmed
  useEffect(() => {
    if (phase !== 'betting' || !confirmed) return;
    const others = players.filter(p => p.id !== playerIdRef.current);
    if (hadMultiRef.current && others.length === 0) return;
    if (others.every(p => p.confirmed)) {
      setCountdown(0);
      if (isLead()) triggerRoundStart();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, phase, confirmed]);

  useEffect(() => {
    if (players.length > 1) hadMultiRef.current = true;
  }, [players]);

  // ── Heartbeat ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!joined) return;
    const id = setInterval(() => {
      channelRef.current?.send({
        type: 'broadcast', event: 'crash_heartbeat',
        payload: {
          playerId: playerIdRef.current, playerName: playerName.current,
          color: colorRef.current, balance: balanceRef.current,
          bet: myBetRef.current, confirmed: confirmedRef.current,
          cashedOut: cashedOutRef.current, cashOutMultiplier: cashOutMultiplier,
          autoCashOut: autoCashOutRef.current,
        },
      });
    }, 4000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);

  // ── Game actions ─────────────────────────────────────────────────────────────

  const triggerRoundStart = useCallback(async () => {
    if (phaseRef.current !== 'betting') return;
    const cp = generateCrashPoint();
    crashPointRef.current = cp;
    crashFiredRef.current = false;
    const st = Date.now();
    startTimeRef.current = st;
    setStartTime(st);
    setPhase('flying'); phaseRef.current = 'flying';
    await channelRef.current?.send({
      type: 'broadcast', event: 'crash_round_start', payload: { startTime: st },
    });
  }, []);

  function handleCashOut() {
    if (cashedOutRef.current || phaseRef.current !== 'flying' || myBetRef.current === 0) return;
    const m = currentMultRef.current;
    cashedOutRef.current = true;
    setCashedOut(true);
    setCashOutMultiplier(m);

    const winnings = Math.floor(myBetRef.current * m);
    const newBal = balanceRef.current - myBetRef.current + winnings;
    setBalance(newBal); balanceRef.current = newBal;

    const profit = winnings - myBetRef.current;
    if (profit >= 0) playWin(); else playLoss();

    setPlayers(prev => prev.map(p =>
      p.id === playerIdRef.current
        ? { ...p, cashedOut: true, cashOutMultiplier: m, balance: newBal }
        : p
    ));
    channelRef.current?.send({
      type: 'broadcast', event: 'crash_cashout',
      payload: { playerId: playerIdRef.current, multiplier: m, newBalance: newBal },
    });
  }

  async function triggerCrash(cp: number) {
    if (phaseRef.current !== 'flying') return;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setPhase('crashed');  phaseRef.current = 'crashed';
    setCrashPoint(cp);    crashPointRef.current = cp;
    setCrashed(true);
    setResultFlash(true); setTimeout(() => setResultFlash(false), 600);
    setHistory(h => [cp, ...h].slice(0, 20));

    // Lead handles own bust
    if (!cashedOutRef.current && myBetRef.current > 0) {
      const newBal = balanceRef.current - myBetRef.current;
      setBalance(newBal); balanceRef.current = newBal;
      playLoss();
      setPlayers(prev => prev.map(p =>
        p.id === playerIdRef.current ? { ...p, balance: newBal } : p
      ));
      await channelRef.current?.send({
        type: 'broadcast', event: 'crash_balance_update',
        payload: { playerId: playerIdRef.current, balance: newBal },
      });
    }
    await channelRef.current?.send({
      type: 'broadcast', event: 'crash_result', payload: { crashPoint: cp },
    });
  }

  async function handleNewRound() {
    resetRound();
    await channelRef.current?.send({ type: 'broadcast', event: 'crash_round_new', payload: {} });
  }

  // ── Supabase channel ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!joined) return;
    const channel = supabase.channel(`crash:${tableId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: Array<{ playerId: string }> }) => {
        const ids = leftPresences.map(p => p.playerId);
        setPlayers(prev => prev.filter(p => !ids.includes(p.id)));
      })
      .on('broadcast', { event: 'crash_join_announce' }, ({ payload }: {
        payload: { playerId: string; playerName: string; color: string; balance: number }
      }) => {
        setPlayers(prev => upsertPlayer(prev, {
          id: payload.playerId, name: payload.playerName,
          color: payload.color, balance: payload.balance,
        }));
        channelRef.current?.send({
          type: 'broadcast', event: 'crash_join_ack',
          payload: {
            playerId: playerIdRef.current, playerName: playerName.current,
            color: colorRef.current, balance: balanceRef.current,
            bet: myBetRef.current, confirmed: confirmedRef.current,
            cashedOut: cashedOutRef.current, cashOutMultiplier: cashOutMultiplier,
            autoCashOut: autoCashOutRef.current,
            phase: phaseRef.current,
            startTime: startTimeRef.current,
            crashPoint: phaseRef.current === 'crashed' ? crashPointRef.current : null,
          },
        });
      })
      .on('broadcast', { event: 'crash_join_ack' }, ({ payload }: {
        payload: {
          playerId: string; playerName: string; color: string; balance: number;
          bet: number; confirmed: boolean; cashedOut: boolean;
          cashOutMultiplier: number | null; autoCashOut: number | null;
          phase?: CrashPhase; startTime?: number | null; crashPoint?: number | null;
        }
      }) => {
        setPlayers(prev => upsertPlayer(prev, {
          id: payload.playerId, name: payload.playerName, color: payload.color,
          balance: payload.balance, bet: payload.bet, confirmed: payload.confirmed,
          cashedOut: payload.cashedOut, cashOutMultiplier: payload.cashOutMultiplier,
          autoCashOut: payload.autoCashOut,
        }));
        // Desync recovery
        if (phaseRef.current === 'betting') {
          if (payload.phase === 'flying' && payload.startTime != null) {
            startTimeRef.current = payload.startTime;
            setStartTime(payload.startTime);
            setPhase('flying'); phaseRef.current = 'flying';
          } else if (payload.phase === 'crashed') {
            setPhase('crashed'); phaseRef.current = 'crashed';
            setCrashed(true);
            if (payload.crashPoint != null) {
              setCrashPoint(payload.crashPoint);
              crashPointRef.current = payload.crashPoint;
            }
          }
        }
      })
      .on('broadcast', { event: 'crash_heartbeat' }, ({ payload }: {
        payload: { playerId: string; playerName: string; color: string; balance: number;
          bet: number; confirmed: boolean; cashedOut: boolean;
          cashOutMultiplier: number | null; autoCashOut: number | null; }
      }) => {
        setPlayers(prev => upsertPlayer(prev, {
          id: payload.playerId, name: payload.playerName, color: payload.color,
          balance: payload.balance, bet: payload.bet, confirmed: payload.confirmed,
          cashedOut: payload.cashedOut, cashOutMultiplier: payload.cashOutMultiplier,
          autoCashOut: payload.autoCashOut,
        }));
      })
      .on('broadcast', { event: 'crash_confirmed' }, ({ payload }: {
        payload: { playerId: string; bet: number; autoCashOut: number | null }
      }) => {
        setPlayers(prev => prev.map(p =>
          p.id === payload.playerId
            ? { ...p, bet: payload.bet, autoCashOut: payload.autoCashOut, confirmed: true }
            : p
        ));
      })
      .on('broadcast', { event: 'crash_round_start' }, ({ payload }: { payload: { startTime: number } }) => {
        startTimeRef.current = payload.startTime;
        setStartTime(payload.startTime);
        setPhase('flying'); phaseRef.current = 'flying';
      })
      .on('broadcast', { event: 'crash_cashout' }, ({ payload }: {
        payload: { playerId: string; multiplier: number; newBalance: number }
      }) => {
        setPlayers(prev => prev.map(p =>
          p.id === payload.playerId
            ? { ...p, cashedOut: true, cashOutMultiplier: payload.multiplier, balance: payload.newBalance }
            : p
        ));
      })
      .on('broadcast', { event: 'crash_balance_update' }, ({ payload }: {
        payload: { playerId: string; balance: number }
      }) => {
        setPlayers(prev => prev.map(p =>
          p.id === payload.playerId ? { ...p, balance: payload.balance } : p
        ));
      })
      .on('broadcast', { event: 'crash_result' }, ({ payload }: { payload: { crashPoint: number } }) => {
        const cp = payload.crashPoint;
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        setPhase('crashed');  phaseRef.current = 'crashed';
        setCrashPoint(cp);    crashPointRef.current = cp;
        setCrashed(true);
        setResultFlash(true); setTimeout(() => setResultFlash(false), 600);
        setHistory(h => [cp, ...h].slice(0, 20));

        if (!cashedOutRef.current && myBetRef.current > 0) {
          const newBal = balanceRef.current - myBetRef.current;
          setBalance(newBal); balanceRef.current = newBal;
          playLoss();
          setPlayers(prev => prev.map(p =>
            p.id === playerIdRef.current ? { ...p, balance: newBal } : p
          ));
          channelRef.current?.send({
            type: 'broadcast', event: 'crash_balance_update',
            payload: { playerId: playerIdRef.current, balance: newBal },
          });
        }
      })
      .on('broadcast', { event: 'crash_round_new' }, () => { resetRound(); })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ playerId: playerIdRef.current, playerName: playerName.current });
          await channel.send({
            type: 'broadcast', event: 'crash_join_announce',
            payload: {
              playerId: playerIdRef.current, playerName: playerName.current,
              color: colorRef.current, balance: balanceRef.current,
            },
          });
          setPlayers(prev => upsertPlayer(prev, {
            id: playerIdRef.current, name: playerName.current,
            color: colorRef.current, balance: balanceRef.current,
          }));
        }
      });

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, tableId]);

  // ── UI helpers ────────────────────────────────────────────────────────────────

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    playerName.current = nameInput.trim();
    setJoined(true);
  }

  function addChip(v: number) {
    if (confirmed || phase !== 'betting') return;
    if (v > balanceRef.current - myBet) return;
    playChipClick();
    setMyBet(b => b + v);
  }

  function clearBet() {
    if (confirmed) return;
    setMyBet(0);
  }

  function handleConfirm() {
    if (confirmed || phase !== 'betting') return;
    const ac = parseFloat(autoCashOutInput);
    const autoCashOut = !isNaN(ac) && ac > 1.01 ? ac : null;
    autoCashOutRef.current = autoCashOut;
    setConfirmed(true); confirmedRef.current = true;
    setPlayers(prev => prev.map(p =>
      p.id === playerIdRef.current
        ? { ...p, bet: myBet, autoCashOut, confirmed: true }
        : p
    ));
    channelRef.current?.send({
      type: 'broadcast', event: 'crash_confirmed',
      payload: { playerId: playerIdRef.current, bet: myBet, autoCashOut },
    });
  }

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/crash/${tableId}` : '';

  function copyShareUrl() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const waitingOn = players.filter(p => p.id !== playerIdRef.current && !p.confirmed);
  const profit = cashedOut && cashOutMultiplier != null
    ? Math.floor(myBet * cashOutMultiplier) - myBet : null;

  // ── Supabase guard ────────────────────────────────────────────────────────────

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

  // ── Join form ─────────────────────────────────────────────────────────────────

  if (!joined) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen px-4">
        <form
          onSubmit={handleJoin}
          className="flex flex-col gap-5 w-full max-w-xs p-8 rounded-xl neon-border"
          style={{ background: 'var(--bg-card)' }}
        >
          <div className="text-center">
            <h1 className="text-lg font-black tracking-widest uppercase"
              style={{ color: '#ec4899', textShadow: '0 0 20px #ec4899' }}>
              Crash
            </h1>
            <p className="text-[10px] mt-1 tracking-widest" style={{ color: 'rgba(236,72,153,0.4)' }}>
              David&apos;s Galactic Casino of Fortune
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
            className="py-3 font-black tracking-widest uppercase rounded transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
            style={{ color: '#ec4899', border: '1px solid rgba(236,72,153,0.5)', background: 'rgba(236,72,153,0.06)', textShadow: '0 0 10px #ec4899' }}
          >
            Sit Down ▶
          </button>
        </form>
      </div>
    );
  }

  // ── Game UI ───────────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col min-h-screen ${resultFlash ? 'crash-flash' : ''}`}
      style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid rgba(236,72,153,0.15)', background: 'var(--bg-card)' }}>
        <button
          className="lg:hidden text-xs px-2 py-1 rounded"
          style={{ color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)' }}
          onClick={() => setSidebarOpen(o => !o)}
        >
          Players
        </button>
        <h1 className="text-sm sm:text-base font-black tracking-widest uppercase text-center flex-1 px-2"
          style={{ color: '#ec4899', textShadow: '0 0 15px #ec4899' }}>
          Crash — David&apos;s Galactic Casino
        </h1>
        <button
          onClick={copyShareUrl}
          className="text-[10px] px-3 py-1.5 rounded shrink-0 transition-all hover:scale-105"
          style={{
            color: copied ? '#10b981' : '#ec4899',
            border: `1px solid ${copied ? '#10b981' : 'rgba(236,72,153,0.3)'}`,
            background: copied ? 'rgba(16,185,129,0.08)' : 'rgba(236,72,153,0.04)',
          }}
        >
          {copied ? '✓ Copied!' : 'Invite'}
        </button>
      </header>

      {/* Countdown bar */}
      {phase === 'betting' && countdown !== null && (
        <div className="w-full h-1 shrink-0" style={{ background: 'rgba(236,72,153,0.1)' }}>
          <div className="h-full transition-all"
            style={{
              width: `${(countdown / BETTING_TIME) * 100}%`,
              background: countdown <= 3 ? '#ef4444' : '#ec4899',
              boxShadow: `0 0 8px ${countdown <= 3 ? '#ef4444' : '#ec4899'}`,
            }}
          />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside
          className={`${sidebarOpen ? 'flex' : 'hidden'} lg:flex flex-col gap-3 p-3 w-56 shrink-0 overflow-y-auto absolute lg:relative inset-y-0 left-0 z-50 lg:z-auto`}
          style={{ background: 'var(--bg-card)', borderRight: '1px solid rgba(236,72,153,0.1)' }}
        >
          {sidebarOpen && (
            <button className="lg:hidden text-xs self-end mb-1" style={{ color: '#ec4899' }} onClick={() => setSidebarOpen(false)}>
              ✕ Close
            </button>
          )}
          <div className="rounded-lg p-2.5 flex flex-col gap-1.5"
            style={{ background: 'rgba(236,72,153,0.04)', border: '1px solid rgba(236,72,153,0.15)' }}>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#ec4899' }}>Invite Link</p>
            <p className="text-[10px] break-all leading-relaxed" style={{ color: 'rgba(236,72,153,0.55)', fontFamily: 'Courier New, monospace' }}>
              {shareUrl}
            </p>
            <button onClick={copyShareUrl}
              className="mt-0.5 py-1.5 text-xs font-bold tracking-widest uppercase rounded transition-all hover:scale-105"
              style={{ color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)', background: 'rgba(236,72,153,0.06)' }}>
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>
          <CrashPlayerList players={players} currentPlayerId={playerIdRef.current} phase={phase} history={history} />
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main */}
        <main className="flex-1 flex flex-col items-center gap-4 p-3 overflow-y-auto overflow-x-hidden">

          {/* Chart */}
          <div className="w-full max-w-2xl shrink-0">
            <CrashChart
              startTime={startTime}
              crashed={crashed}
              crashPoint={crashPoint}
              phase={phase}
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center gap-4 w-full max-w-2xl pb-4 shrink-0">
            {/* Balance */}
            <div className="flex items-center gap-3">
              <span className="text-xs tracking-widest uppercase font-semibold" style={{ color: 'rgba(0,212,255,0.5)' }}>
                Balance
              </span>
              <span className="text-lg font-black neon-text" style={{ fontFamily: 'Courier New, monospace' }}>
                ${balance.toLocaleString()}
              </span>
              {countdown !== null && phase === 'betting' && (
                <span className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{
                    color: countdown <= 3 ? '#ef4444' : 'rgba(236,72,153,0.8)',
                    border: `1px solid ${countdown <= 3 ? '#ef4444' : 'rgba(236,72,153,0.3)'}`,
                    fontFamily: 'Courier New, monospace',
                  }}>
                  {countdown}s
                </span>
              )}
            </div>

            {/* Betting phase */}
            {phase === 'betting' && (
              <div className="flex flex-col items-center gap-3 w-full">
                {!confirmed ? (
                  <>
                    <ChipSelector balance={balance} bet={myBet} onChip={addChip} onClear={clearBet} />

                    {/* Auto cash-out input */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(0,212,255,0.4)' }}>
                        Auto Cash-Out
                      </span>
                      <input
                        type="number"
                        min="1.1"
                        step="0.1"
                        placeholder="e.g. 2.0"
                        value={autoCashOutInput}
                        onChange={e => setAutoCashOutInput(e.target.value)}
                        className="w-24 bg-transparent px-3 py-1.5 rounded text-sm text-center neon-border-dim outline-none text-sky-200 placeholder-sky-900"
                        style={{ background: 'var(--bg-card)' }}
                      />
                      <span className="text-sm font-bold" style={{ color: 'rgba(0,212,255,0.5)' }}>×</span>
                    </div>

                    <button
                      onClick={handleConfirm}
                      className="px-8 py-3 text-base font-black tracking-widest uppercase rounded transition-all hover:scale-105 active:scale-95"
                      style={{
                        color: '#ec4899',
                        border: '1px solid rgba(236,72,153,0.5)',
                        background: 'rgba(236,72,153,0.06)',
                        boxShadow: myBet > 0 ? '0 0 20px rgba(236,72,153,0.3)' : undefined,
                      }}
                    >
                      {myBet > 0 ? `Place Bet $${myBet.toLocaleString()} ▶` : 'Sit Out ▶'}
                    </button>
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-bold tracking-widest" style={{ color: '#10b981' }}>
                      {myBet > 0 ? `✓ Bet $${myBet.toLocaleString()} confirmed` : '✓ Sitting Out'}
                    </p>
                    {waitingOn.length > 0 ? (
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(0,212,255,0.5)' }}>
                        Waiting for: {waitingOn.map(p => p.name).join(', ')}
                      </p>
                    ) : players.length > 1 ? (
                      <p className="text-xs mt-0.5 animate-spin-pulse" style={{ color: '#ec4899' }}>
                        All ready — launching…
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Flying phase */}
            {phase === 'flying' && (
              <div className="flex flex-col items-center gap-3">
                {myBet > 0 && !cashedOut ? (
                  <button
                    onClick={handleCashOut}
                    className="px-10 py-4 text-lg font-black tracking-widest uppercase rounded transition-all hover:scale-105 active:scale-95 animate-pulse-pink"
                    style={{
                      color: '#ec4899',
                      border: '1px solid rgba(236,72,153,0.6)',
                      background: 'rgba(236,72,153,0.08)',
                    }}
                  >
                    CASH OUT
                  </button>
                ) : cashedOut && cashOutMultiplier !== null ? (
                  <div className="text-center animate-float-in">
                    <p className="text-xl font-black tracking-widest"
                      style={{ color: '#10b981', textShadow: '0 0 20px #10b981', fontFamily: 'Courier New, monospace' }}>
                      ✓ Cashed out {cashOutMultiplier.toFixed(2)}×
                    </p>
                    {profit !== null && (
                      <p className="text-sm mt-1 font-bold" style={{ color: profit >= 0 ? '#10b981' : '#ef4444' }}>
                        {profit >= 0 ? `+$${profit.toLocaleString()}` : `-$${Math.abs(profit).toLocaleString()}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm tracking-widest uppercase" style={{ color: 'rgba(0,212,255,0.35)' }}>
                    Watching this round…
                  </p>
                )}
              </div>
            )}

            {/* Crashed phase */}
            {phase === 'crashed' && (
              <div className="flex flex-col items-center gap-3">
                {myBet > 0 && (
                  <div className="text-center animate-float-in">
                    {cashedOut && cashOutMultiplier !== null ? (
                      <>
                        <p className="text-xl font-black tracking-widest"
                          style={{ color: '#10b981', textShadow: '0 0 20px #10b981', fontFamily: 'Courier New, monospace' }}>
                          ✓ {cashOutMultiplier.toFixed(2)}×
                        </p>
                        {profit !== null && (
                          <p className="text-sm font-bold mt-0.5" style={{ color: '#10b981' }}>
                            +${profit.toLocaleString()}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xl font-black tracking-widest"
                        style={{ color: '#ef4444', textShadow: '0 0 20px #ef4444', fontFamily: 'Courier New, monospace' }}>
                        ✗ −${myBet.toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
                <button
                  onClick={handleNewRound}
                  className="px-10 py-3 text-base font-black tracking-widest uppercase rounded transition-all hover:scale-105 active:scale-95"
                  style={{ color: '#ec4899', border: '1px solid rgba(236,72,153,0.4)', background: 'rgba(236,72,153,0.06)' }}
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
