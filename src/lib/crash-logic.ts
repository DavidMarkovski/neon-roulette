export const CRASH_K = 0.00012; // ~2× at 5.8s, ~10× at 19s, ~100× at 38s
export const BETTING_TIME = 8;

export function computeMultiplier(elapsedMs: number): number {
  return Math.round(100 * Math.exp(CRASH_K * elapsedMs)) / 100;
}

export function generateCrashPoint(): number {
  const r = Math.random();
  if (r < 0.01) return 1.00; // 1% instant bust
  return Math.floor(100 * 0.99 / (1 - r)) / 100;
}
