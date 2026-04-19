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
  confirmed: boolean;
}

export type GamePhase = 'betting' | 'spinning' | 'result';
