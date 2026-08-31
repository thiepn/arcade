import { CHRONO_SIDES, getChronoGapCenterAngle } from './chronoWavePlanner';

export const CHRONO_FOCUS_MAX_CHARGES = 2;
export const CHRONO_FOCUS_PASS_INTERVAL = 4;
export const CHRONO_FOCUS_PRECISION_FRACTION = 0.3;
export const CHRONO_FOCUS_MAX_STREAK = 5;

export const getCircularAngleDistance = (a: number, b: number): number => {
  const tau = Math.PI * 2;
  let diff = Math.abs(a - b) % tau;
  if (diff > Math.PI) diff = tau - diff;
  return diff;
};

export const getChronoFocusCharges = (cleanPasses: number, currentCharges: number): number => {
  const safeCharges = Math.max(0, Math.min(CHRONO_FOCUS_MAX_CHARGES, Math.floor(currentCharges)));
  if (cleanPasses > 0 && cleanPasses % CHRONO_FOCUS_PASS_INTERVAL === 0) {
    return Math.min(CHRONO_FOCUS_MAX_CHARGES, safeCharges + 1);
  }
  return safeCharges;
};

export const isChronoFocusHit = (
  playerAngle: number,
  openSide: number,
  openSpan: number,
  sides = CHRONO_SIDES,
): boolean => {
  const center = getChronoGapCenterAngle(openSide, openSpan, sides);
  const sectorAngle = (Math.PI * 2) / sides;
  const halfGapWidth = (openSpan * sectorAngle) / 2;
  const precisionRadius = halfGapWidth * CHRONO_FOCUS_PRECISION_FRACTION;
  return getCircularAngleDistance(playerAngle, center) <= precisionRadius;
};

export const getChronoFocusBonus = (streak: number): number => {
  const safeStreak = Math.max(1, Math.min(CHRONO_FOCUS_MAX_STREAK, Math.floor(streak)));
  return 500 + safeStreak * 350;
};
