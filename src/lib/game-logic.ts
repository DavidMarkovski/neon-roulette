import type { Bet, BetType } from './types';

export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export const CHIP_DENOMINATIONS = [10, 50, 100, 500, 1000];

export const PLAYER_COLORS = [
  '#00d4ff', '#f59e0b', '#ec4899', '#10b981', '#a855f7',
];

export const SLOT_DEG = 360 / 37;

export function getNumberColor(n: number): 'green' | 'red' | 'black' {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

/**
 * Returns degrees the wheel must rotate (clockwise, cumulative) so that the
 * result pocket lands at 12 o'clock, accounting for where the wheel currently is.
 */
export function computeWheelSpin(result: number, currentRotationDeg: number): number {
  const idx = WHEEL_ORDER.indexOf(result);
  // Use the CENTER of the sector so the ball lands in the middle of the pocket,
  // not at the edge. The number label is also drawn at (idx + 0.5) * SLOT_DEG.
  const sectorAngle = (idx + 0.5) * SLOT_DEG;
  const base = (360 - (sectorAngle + currentRotationDeg) % 360) % 360;
  const fullRotations = (5 + Math.floor(Math.random() * 3)) * 360;
  return fullRotations + (base === 0 ? 360 : base);
}

/** Degrees the ball orbits (counter-clockwise = negative) for the spin duration. */
export function computeBallSpin(): number {
  return -((4 + Math.floor(Math.random() * 3)) * 360);
}

export function randomResult(): number {
  return Math.floor(Math.random() * 37);
}

const PAYOUTS: Record<BetType, number> = {
  straight: 35,
  red: 1, black: 1,
  odd: 1, even: 1,
  low: 1, high: 1,
  dozen1: 2, dozen2: 2, dozen3: 2,
  col1: 2, col2: 2, col3: 2,
};

export function betWins(bet: Bet, result: number): boolean {
  const color = getNumberColor(result);
  switch (bet.type) {
    case 'straight': return bet.number === result;
    case 'red':    return color === 'red';
    case 'black':  return color === 'black';
    case 'odd':    return result !== 0 && result % 2 !== 0;
    case 'even':   return result !== 0 && result % 2 === 0;
    case 'low':    return result >= 1 && result <= 18;
    case 'high':   return result >= 19 && result <= 36;
    case 'dozen1': return result >= 1  && result <= 12;
    case 'dozen2': return result >= 13 && result <= 24;
    case 'dozen3': return result >= 25 && result <= 36;
    case 'col1':   return result !== 0 && result % 3 === 1;
    case 'col2':   return result !== 0 && result % 3 === 2;
    case 'col3':   return result !== 0 && result % 3 === 0;
    default: return false;
  }
}

export function calculatePayout(bets: Bet[], result: number): number {
  return bets.reduce((total, bet) => {
    if (betWins(bet, result)) {
      return total + bet.amount + bet.amount * PAYOUTS[bet.type];
    }
    return total;
  }, 0);
}

export function totalBetAmount(bets: Bet[]): number {
  return bets.reduce((sum, b) => sum + b.amount, 0);
}
