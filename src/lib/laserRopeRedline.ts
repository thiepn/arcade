export const LASER_ROPE_REDLINE_EARN_EVERY = 5;
export const LASER_ROPE_REDLINE_MAX_CHARGES = 2;
export const LASER_ROPE_REDLINE_DURATION_SEC = 4;
export const LASER_ROPE_REDLINE_SPEED_MULTIPLIER = 1.22;
export const LASER_ROPE_REDLINE_SCORE_MULTIPLIER = 2;

export const canActivateLaserRopeRedline = (
  charges: number,
  active: boolean,
  isAlive: boolean,
): boolean => isAlive && !active && charges > 0;

export const getLaserRopeRedlineCharges = (
  jumpStreak: number,
  currentCharges: number,
): number => {
  if (jumpStreak <= 0 || jumpStreak % LASER_ROPE_REDLINE_EARN_EVERY !== 0) {
    return currentCharges;
  }
  return Math.min(LASER_ROPE_REDLINE_MAX_CHARGES, currentCharges + 1);
};

export const getLaserRopeRedlineSpeed = (
  effectiveSweepSpeed: number,
  active: boolean,
): number => effectiveSweepSpeed * (active ? LASER_ROPE_REDLINE_SPEED_MULTIPLIER : 1);

export const getLaserRopeRedlineReward = (
  basePoints: number,
  multiplier: number,
  feverMultiplier: number,
  active: boolean,
): number =>
  Math.round(
    basePoints *
      multiplier *
      feverMultiplier *
      (active ? LASER_ROPE_REDLINE_SCORE_MULTIPLIER : 1),
  );
