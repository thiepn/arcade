export const AIR_HOCKEY_POWER_MAX = 100;
export const AIR_HOCKEY_POWER_DEFENSE_GAIN = 34;
export const AIR_HOCKEY_POWER_GOAL_GAIN = 12;
export const AIR_HOCKEY_POWER_DURATION_SEC = 4;
export const AIR_HOCKEY_POWER_IMPULSE_MULTIPLIER = 1.22;
export const AIR_HOCKEY_POWER_MALLET_TRANSFER_MULTIPLIER = 1.35;
export const AIR_HOCKEY_POWER_STREAK_BONUS_SCALES = [0.5, 0.75, 1.05, 1.35] as const;

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

// P21 gives the existing four-second Power Play a clearer internal match arc:
// consecutive goals climb through four score-only conversion tiers. Physics,
// duration, AI limits, puck cap, and the ordinary scoring route are unchanged.
export function getAirHockeyPowerGoalBonus(
  basePoints: number,
  powerStreak: number,
): number {
  const safeStreak = Math.max(1, Math.floor(powerStreak));
  const scale = AIR_HOCKEY_POWER_STREAK_BONUS_SCALES[
    Math.min(AIR_HOCKEY_POWER_STREAK_BONUS_SCALES.length - 1, safeStreak - 1)
  ];
  return Math.max(1, Math.round(basePoints * scale));
}
