export type BetType =
  | 'straight'
  | 'red' | 'black'
  | 'odd' | 'even'
  | 'low' | 'high'
  | 'dozen1' | 'dozen2' | 'dozen3'
  | 'col1' | 'col2' | 'col3';

export interface Bet {
  type: BetType;
  number?: number;
  amount: number;
}

export interface Player {
  id: string;
  name: string;
  balance: number;
  bets: Bet[];
  isHost: boolean;
  color: string;
}

export type GamePhase = 'betting' | 'spinning' | 'result';

export interface GameState {
  phase: GamePhase;
  result: number | null;
  history: number[];
}

export interface RealtimePayload {
  type:
    | 'player_join'
    | 'player_leave'
    | 'bet_update'
    | 'spin_start'
    | 'spin_result'
    | 'round_new';
  playerId: string;
  data?: unknown;
}
