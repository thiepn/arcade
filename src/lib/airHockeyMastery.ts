export const AIR_HOCKEY_POWER_MAX = 100;
export const AIR_HOCKEY_POWER_DEFENSE_GAIN = 34;
export const AIR_HOCKEY_POWER_GOAL_GAIN = 12;
export const AIR_HOCKEY_POWER_DURATION_SEC = 4;
export const AIR_HOCKEY_POWER_IMPULSE_MULTIPLIER = 1.22;
export const AIR_HOCKEY_POWER_MALLET_TRANSFER_MULTIPLIER = 1.35;

export type AirHockeyPowerEvent = 'DEFENSE' | 'GOAL';

export function getAirHockeyPowerMeter(
  current: number,
  event: AirHockeyPowerEvent,
): number {
  const gain = event === 'DEFENSE'
    ? AIR_HOCKEY_POWER_DEFENSE_GAIN
    : AIR_HOCKEY_POWER_GOAL_GAIN;
  return Math.min(AIR_HOCKEY_POWER_MAX, Math.max(0, current) + gain);
}

export function canTriggerAirHockeyPower(
  meter: number,
  activeTimer: number,
  isAlive = true,
): boolean {
  return isAlive && meter >= AIR_HOCKEY_POWER_MAX && activeTimer <= 0;
}

export function getAirHockeyPowerGoalBonus(
  basePoints: number,
  powerStreak: number,
): number {
  const streakScale = 0.5 + Math.min(3, Math.max(0, powerStreak - 1)) * 0.2;
  return Math.max(1, Math.round(basePoints * streakScale));
}
