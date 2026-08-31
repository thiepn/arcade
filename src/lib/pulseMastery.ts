export const PULSE_WAGER_MAX_CHARGES = 2;
export const PULSE_WAGER_START_CHARGES = 1;
export const PULSE_WAGER_EARN_COMBO = 4;
export const PULSE_WAGER_WINDOW_PX = 10;

export function canArmPulseWager(
  charges: number,
  wagerArmed: boolean,
  isAlive = true,
): boolean {
  return isAlive && charges > 0 && !wagerArmed;
}

export function shouldEarnPulseWager(combo: number): boolean {
  return combo > 0 && combo % PULSE_WAGER_EARN_COMBO === 0;
}

export function isPulseWagerHit(absDiffPx: number): boolean {
  return Math.abs(absDiffPx) <= PULSE_WAGER_WINDOW_PX;
}

export function getPulseWagerReward(combo: number, wagerStreak: number): number {
  const comboBonus = Math.min(15, Math.max(0, combo)) * 35;
  const streakBonus = Math.min(5, Math.max(0, wagerStreak - 1)) * 120;
  return 300 + comboBonus + streakBonus;
}
