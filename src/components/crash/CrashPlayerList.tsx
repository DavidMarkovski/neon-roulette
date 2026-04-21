'use client';

export interface CrashPlayer {
  id: string;
  name: string;
  color: string;
  balance: number;
  bet: number;
  autoCashOut: number | null;
  confirmed: boolean;
  cashedOut: boolean;
  cashOutMultiplier: number | null;
}

interface Props {
  players: CrashPlayer[];
  currentPlayerId: string;
  phase: 'betting' | 'flying' | 'crashed';
  history: number[];
}

export default function CrashPlayerList({ players, currentPlayerId, phase, history }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* Players */}
      <div className="rounded-lg neon-border-dim p-3 flex flex-col gap-2.5" style={{ background: 'var(--bg-card)' }}>
        <p className="text-xs tracking-widest uppercase font-bold" style={{ color: 'var(--neon)' }}>
          Players <span style={{ color: 'rgba(0,212,255,0.5)' }}>({players.length})</span>
        </p>

        {players.length === 0 && (
          <p className="text-xs" style={{ color: 'rgba(0,212,255,0.3)' }}>Waiting for players…</p>
        )}

        {players.map(p => {
          const isSelf = p.id === currentPlayerId;
          const profit = p.cashedOut && p.cashOutMultiplier != null
            ? Math.floor(p.bet * p.cashOutMultiplier) - p.bet
            : null;

          let statusEl: React.ReactNode = null;
          if (phase === 'betting') {
            if (p.confirmed && p.bet > 0) {
              statusEl = (
                <span style={{ color: '#f59e0b', fontFamily: 'Courier New, monospace', fontWeight: 700 }}>
                  ${p.bet.toLocaleString()}
                  {p.autoCashOut ? <span style={{ color: 'rgba(245,158,11,0.6)', fontSize: 10 }}> @{p.autoCashOut}×</span> : null}
                </span>
              );
            } else if (p.confirmed && p.bet === 0) {
              statusEl = <span style={{ color: 'rgba(0,212,255,0.3)', fontSize: 11 }}>sitting out</span>;
            } else {
              statusEl = <span style={{ color: 'rgba(0,212,255,0.3)', fontSize: 11 }}>deciding…</span>;
            }
          } else if (phase === 'flying') {
            if (p.cashedOut && p.cashOutMultiplier != null) {
              statusEl = (
                <span style={{ color: '#10b981', fontFamily: 'Courier New, monospace', fontWeight: 700 }}>
                  +{p.cashOutMultiplier.toFixed(2)}×
                </span>
              );
            } else if (p.bet > 0) {
              statusEl = <span className="animate-spin-pulse" style={{ color: '#f59e0b', fontSize: 11 }}>flying…</span>;
            } else {
              statusEl = <span style={{ color: 'rgba(0,212,255,0.25)', fontSize: 11 }}>—</span>;
            }
          } else {
            // crashed
            if (p.cashedOut && p.cashOutMultiplier != null) {
              statusEl = (
                <span style={{ color: '#10b981', fontFamily: 'Courier New, monospace', fontWeight: 700 }}>
                  +{p.cashOutMultiplier.toFixed(2)}×{profit != null ? ` ($${profit.toLocaleString()})` : ''}
                </span>
              );
            } else if (p.bet > 0) {
              statusEl = (
                <span style={{ color: '#ef4444', fontFamily: 'Courier New, monospace', fontWeight: 700 }}>
                  -${p.bet.toLocaleString()}
                </span>
              );
            } else {
              statusEl = <span style={{ color: 'rgba(0,212,255,0.25)', fontSize: 11 }}>—</span>;
            }
          }

          return (
            <div key={p.id} className="flex items-start gap-2">
              <div className="mt-1 w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-sm font-bold truncate max-w-[80px]" style={{ color: p.color }}>
                    {p.name}
                  </span>
                  {isSelf && (
                    <span className="text-[10px] px-1.5 py-px rounded font-bold"
                      style={{ background: 'rgba(0,212,255,0.15)', color: 'var(--neon)', border: '1px solid rgba(0,212,255,0.3)' }}>
                      YOU
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs flex-wrap">
                  <span style={{ color: 'rgba(0,212,255,0.6)', fontFamily: 'Courier New, monospace', fontWeight: 700 }}>
                    ${p.balance.toLocaleString()}
                  </span>
                  {statusEl}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-lg neon-border-dim p-3" style={{ background: 'var(--bg-card)' }}>
          <p className="text-xs tracking-widest uppercase mb-2 font-bold" style={{ color: 'var(--neon)' }}>
            History
          </p>
          <div className="flex flex-wrap gap-1.5">
            {history.map((cp, i) => {
              const high = cp >= 2;
              return (
                <div
                  key={i}
                  className="px-2 py-0.5 rounded text-[11px] font-black"
                  style={{
                    background: high ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    color: high ? '#10b981' : '#f87171',
                    border: `1px solid ${high ? '#10b98140' : '#ef444440'}`,
                    fontFamily: 'Courier New, monospace',
                  }}
                >
                  {cp.toFixed(2)}×
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
