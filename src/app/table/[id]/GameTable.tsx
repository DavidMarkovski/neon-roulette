'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { supabase, supabaseReady } from '@/lib/supabase';
import {
  PLAYER_COLORS, randomResult, calculatePayout, totalBetAmount,
} from '@/lib/game-logic';
import type { Bet, GamePhase, Player } from '@/lib/types';
import RouletteWheel from '@/components/roulette/RouletteWheel';
import BettingTable from '@/components/roulette/BettingTable';
import ChipSelector from '@/components/roulette/ChipSelector';
import GameHistory from '@/components/roulette/GameHistory';
import PlayerPanel from '@/components/roulette/PlayerPanel';

const STARTING_BALANCE = 10000;

interface PresenceEntry {
  playerId: string;
  playerName: string;
  color: string;
  bets: Bet[];
  balance: number;
}

export default function GameTable({ tableId }: { tableId: string }) {
  const [playerName, setPlayerName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [joined, setJoined] = useState(false);

  const playerIdRef = useRef<string>(uuid());
  const colorRef = useRef<string>(PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]);

  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [bets, setBets] = useState<Bet[]>([]);
  const [selectedChip, setSelectedChip] = useState(50);
  const [phase, setPhase] = useState<GamePhase>('betting');
  const [result, setResult] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [resultKey, setResultKey] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  const betsRef = useRef<Bet[]>([]);
  const balanceRef = useRef(STARTING_BALANCE);

  betsRef.current = bets;
  balanceRef.current = balance;

  const syncPresence = useCallback(async (currentBets?: Bet[]) => {
    if (!channelRef.current) return;
    await channelRef.current.track({
      playerId: playerIdRef.current,
      playerName,
      color: colorRef.current,
      bets: currentBets ?? betsRef.current,
      balance: balanceRef.current,
    } satisfies PresenceEntry);
  }, [playerName]);

  const handleSpinResult = useCallback((spinResult: number) => {
    setResult(spinResult);
    setPhase('spinning');
    setResultKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (!joined) return;

    const channel = supabase.channel(`roulette:${tableId}`, {
      config: { broadcast: { self: false }, presence: { key: playerIdRef.current } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceEntry>();
        const entries = Object.values(state).flat();
        const sorted = entries.sort((a, b) => a.playerId.localeCompare(b.playerId));
        setIsHost(sorted[0]?.playerId === playerIdRef.current);
        setPlayers(entries.map((e, i) => ({
          id: e.playerId,
          name: e.playerName,
          color: e.color,
          balance: e.balance,
          bets: e.bets,
          isHost: i === 0,
        })));
      })
      .on('broadcast', { event: 'spin_result' }, ({ payload }: { payload: { result: number } }) => {
        handleSpinResult(payload.result);
      })
      .on('broadcast', { event: 'round_new' }, () => {
        setBets([]);
        setResult(null);
        setWinAmount(null);
        setPhase('betting');
        syncPresence([]);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            playerId: playerIdRef.current,
            playerName,
            color: colorRef.current,
            bets: [],
            balance: STARTING_BALANCE,
          } satisfies PresenceEntry);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [joined, tableId, playerName, syncPresence, handleSpinResult]);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setPlayerName(nameInput.trim());
    setJoined(true);
  }

  function handleBet(bet: Bet) {
    if (phase !== 'betting') return;
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
    const total = totalBetAmount(next);
    if (total > STARTING_BALANCE) return;
    setBets(next);
    syncPresence(next);
  }

  function clearBets() {
    setBets([]);
    syncPresence([]);
  }

  async function handleSpin() {
    if (!isHost || phase !== 'betting') return;
    const spinResult = randomResult();
    await channelRef.current?.send({
      type: 'broadcast',
      event: 'spin_result',
      payload: { result: spinResult },
    });
    handleSpinResult(spinResult);
  }

  function handleSpinComplete(spinResult: number) {
    const won = calculatePayout(betsRef.current, spinResult);
    const lost = totalBetAmount(betsRef.current);
    const newBalance = balanceRef.current - lost + won;
    setBalance(newBalance);
    balanceRef.current = newBalance;
    setWinAmount(won > 0 ? won - lost : -lost);
    setHistory(h => [spinResult, ...h].slice(0, 20));
    setPhase('result');
    syncPresence([]);
  }

  async function handleNewRound() {
    setBets([]);
    setResult(null);
    setWinAmount(null);
    setPhase('betting');
    syncPresence([]);
    if (isHost) {
      await channelRef.current?.send({ type: 'broadcast', event: 'round_new', payload: {} });
    }
  }

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/table/${tableId}`
    : '';

  if (!supabaseReady) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <p className="text-2xl font-bold tracking-widest" style={{ color: '#ef4444' }}>⚠ Supabase Not Configured</p>
        <p className="text-sm text-purple-400 max-w-sm">
          Add <code className="text-purple-200">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code className="text-purple-200">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your Vercel environment variables, then redeploy.
        </p>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen">
        <form
          onSubmit={handleJoin}
          className="flex flex-col gap-6 w-full max-w-xs p-8 rounded-lg neon-border"
          style={{ background: 'rgba(13,13,31,0.95)' }}
        >
          <h2 className="text-center text-2xl font-bold tracking-widest uppercase"
            style={{ color: '#a855f7', textShadow: '0 0 15px #a855f7' }}>
            Enter Table
          </h2>
          <input
            autoFocus
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            placeholder="Your name..."
            maxLength={20}
            className="bg-transparent px-4 py-3 rounded neon-border outline-none placeholder-purple-800 text-purple-200"
          />
          <button
            type="submit"
            disabled={!nameInput.trim()}
            className="py-3 font-bold tracking-widest uppercase rounded neon-border transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
            style={{ color: '#a855f7', background: 'rgba(168,85,247,0.08)' }}
          >
            Sit Down
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-purple-900">
        <div>
          <span className="text-xs tracking-widest text-purple-500 uppercase">Table</span>
          <p className="text-xs text-purple-700 font-mono truncate max-w-[200px]">{tableId}</p>
        </div>
        <h1 className="text-xl font-bold tracking-widest uppercase"
          style={{ color: '#a855f7', textShadow: '0 0 15px #a855f7' }}>
          Neon Roulette
        </h1>
        <button
          onClick={() => navigator.clipboard.writeText(shareUrl)}
          className="text-xs px-3 py-1 rounded neon-border tracking-widest uppercase transition-all hover:scale-105"
          style={{ color: '#06b6d4' }}
        >
          Share Link
        </button>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row gap-4 p-4">
        {/* Left: Players + History */}
        <div className="flex flex-col gap-4 lg:w-56">
          <PlayerPanel players={players} currentPlayerId={playerIdRef.current} />
          <GameHistory history={history} />
        </div>

        {/* Center: Wheel + Table */}
        <div className="flex-1 flex flex-col items-center gap-4">
          <RouletteWheel
            key={resultKey}
            result={result}
            isSpinning={phase === 'spinning'}
            onSpinComplete={handleSpinComplete}
          />

          {/* Win/Loss banner */}
          {phase === 'result' && winAmount !== null && (
            <div
              className="animate-float-in text-center py-2 px-8 rounded neon-border text-lg font-bold tracking-widest"
              style={{
                color: winAmount >= 0 ? '#10b981' : '#ef4444',
                textShadow: `0 0 20px ${winAmount >= 0 ? '#10b981' : '#ef4444'}`,
                borderColor: winAmount >= 0 ? '#10b981' : '#ef4444',
              }}
            >
              {winAmount >= 0 ? `+$${winAmount.toLocaleString()}` : `-$${Math.abs(winAmount).toLocaleString()}`}
            </div>
          )}

          {/* Betting table */}
          <div className="w-full max-w-2xl">
            <BettingTable
              bets={bets}
              players={players}
              currentPlayerId={playerIdRef.current}
              onBet={handleBet}
              disabled={phase !== 'betting'}
              selectedChip={selectedChip}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-500 tracking-widest uppercase">Balance</span>
              <span className="text-lg font-bold" style={{ color: '#a855f7' }}>
                ${balance.toLocaleString()}
              </span>
            </div>
            <ChipSelector selected={selectedChip} onSelect={setSelectedChip} balance={balance} />

            {phase === 'betting' && (
              <>
                <button
                  onClick={clearBets}
                  disabled={bets.length === 0}
                  className="px-4 py-2 text-sm font-bold tracking-widest uppercase rounded border border-purple-900 text-purple-600 transition-all hover:border-purple-600 disabled:opacity-30"
                >
                  Clear Bets
                </button>
                {isHost && (
                  <button
                    onClick={handleSpin}
                    className="px-8 py-3 text-base font-bold tracking-widest uppercase rounded neon-glow-purple neon-border transition-all hover:scale-105 active:scale-95"
                    style={{ color: '#a855f7', background: 'rgba(168,85,247,0.12)' }}
                  >
                    SPIN
                  </button>
                )}
                {!isHost && (
                  <span className="text-xs text-purple-700 tracking-widest uppercase">
                    Waiting for host to spin…
                  </span>
                )}
              </>
            )}

            {phase === 'spinning' && (
              <span className="text-xs text-purple-400 tracking-widest uppercase animate-pulse">
                Spinning…
              </span>
            )}

            {phase === 'result' && (
              <button
                onClick={handleNewRound}
                className="px-8 py-3 text-base font-bold tracking-widest uppercase rounded neon-border transition-all hover:scale-105 active:scale-95"
                style={{ color: '#06b6d4', background: 'rgba(6,182,212,0.08)' }}
              >
                New Round
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
