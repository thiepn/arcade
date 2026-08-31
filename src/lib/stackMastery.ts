export const STACK_FOCUS_MAX_CHARGES = 2;
export const STACK_FOCUS_START_CHARGES = 1;
export const STACK_FOCUS_EARN_STREAK = 3;
export const STACK_STANDARD_PERFECT_WINDOW_PX = 4;
export const STACK_FOCUS_PERFECT_WINDOW_PX = 2;

export function getStackPerfectWindow(focusArmed: boolean): number {
  return focusArmed ? STACK_FOCUS_PERFECT_WINDOW_PX : STACK_STANDARD_PERFECT_WINDOW_PX;
}

export function canArmStackFocus(
  charges: number,
  focusArmed: boolean,
  isAlive = true,
): boolean {
  return isAlive && charges > 0 && !focusArmed;
}

export function shouldEarnStackFocus(perfectStreak: number): boolean {
  return perfectStreak > 0 && perfectStreak % STACK_FOCUS_EARN_STREAK === 0;
}

export function getStackFocusReward(towerBlocks: number, focusChain: number): number {
  const altitudeBonus = Math.min(3, Math.floor(Math.max(0, towerBlocks - 1) / 12));
  const chainBonus = Math.min(3, Math.max(0, focusChain - 1));
  return 2 + altitudeBonus + chainBonus;
}
