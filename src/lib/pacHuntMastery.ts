export const PAC_HUNT_TIMER_FACTOR = 0.58;
export const PAC_HUNT_GHOST_SPEED_MULTIPLIER = 1.35;
export const PAC_HUNT_SCORE_MULTIPLIER = 2;

export const canActivatePacHunt = (
  huntReady: boolean,
  frightenedTimer: number,
  isAlive: boolean,
): boolean => huntReady && frightenedTimer > 0 && isAlive;

export const getPacHuntGhostSpeed = (baseSpeed: number, huntActive: boolean): number =>
  baseSpeed * (huntActive ? PAC_HUNT_GHOST_SPEED_MULTIPLIER : 1);

export const getPacHuntCapturePoints = (basePoints: number, huntActive: boolean): number =>
  Math.round(basePoints * (huntActive ? PAC_HUNT_SCORE_MULTIPLIER : 1));
