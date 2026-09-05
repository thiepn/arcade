export const TOWER_APEX_EARN_EVERY = 3;
export const TOWER_APEX_MAX_CHARGES = 2;
export const TOWER_APEX_DURATION_SEC = 4.5;
export const TOWER_APEX_BOUNCE_MULTIPLIER = 1.18;
export const TOWER_APEX_SCORE_MULTIPLIER = 2;
export const TOWER_APEX_ROUTE_LENGTH = 5;
export const TOWER_APEX_ROUTE_COMPLETE_BONUS = 900;

export const isTowerPrecisionLanding = (
  playerX: number,
  platformX: number,
  platformWidth: number,
): boolean => {
  const center = platformX + platformWidth / 2;
  const tolerance = Math.max(8, Math.min(20, platformWidth * 0.18));
  return Math.abs(playerX - center) <= tolerance;
};

export const getTowerApexCharges = (
  precisionStreak: number,
  currentCharges: number,
): number => {
  if (precisionStreak <= 0 || precisionStreak % TOWER_APEX_EARN_EVERY !== 0) {
    return currentCharges;
  }
  return Math.min(TOWER_APEX_MAX_CHARGES, currentCharges + 1);
};

export const canActivateTowerApexDrive = (
  charges: number,
  active: boolean,
  isAlive: boolean,
): boolean => isAlive && !active && charges > 0;

export const getTowerApexBounceVelocity = (
  baseVelocity: number,
  active: boolean,
): number => baseVelocity * (active ? TOWER_APEX_BOUNCE_MULTIPLIER : 1);

export const getTowerApexReward = (basePoints: number, active: boolean): number =>
  Math.round(basePoints * (active ? TOWER_APEX_SCORE_MULTIPLIER : 1));

export const getTowerPrecisionBonus = (precisionStreak: number): number =>
  150 * Math.min(5, Math.max(1, precisionStreak));

// P21 turns the existing precision streak into a compact, visible mastery route.
// The route does not grant safety, movement, or extra Apex charges; it only rewards
// sustaining five consecutive center landings without changing ordinary ascent.
export const getTowerApexRouteBonus = (precisionStreak: number): number =>
  precisionStreak > 0 && precisionStreak % TOWER_APEX_ROUTE_LENGTH === 0
    ? TOWER_APEX_ROUTE_COMPLETE_BONUS
    : 0;

export const getTowerApexRouteProgress = (precisionStreak: number): number => {
  const safe = Math.max(0, Math.floor(precisionStreak));
  if (safe > 0 && safe % TOWER_APEX_ROUTE_LENGTH === 0) return TOWER_APEX_ROUTE_LENGTH;
  return safe % TOWER_APEX_ROUTE_LENGTH;
};
