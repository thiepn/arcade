export type AirHockeyDifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';

export interface AirHockeyDifficultyConfig {
  label: string;
  aiSpeed: number;
  predictionSeconds: number;
  reactionMs: number;
  aimErrorPx: number;
  pointsPerGoal: number;
  multiplierBadge: string;
  color: string;
}

export const AIR_HOCKEY_PLAYER_MAX_SPEED = 1050;
export const AIR_HOCKEY_MAX_PUCK_SPEED = 680;

export const AIR_HOCKEY_DIFFICULTY_CONFIG: Record<AirHockeyDifficultyLevel, AirHockeyDifficultyConfig> = {
  EASY: {
    label: 'CASUAL',
    aiSpeed: 180,
    predictionSeconds: 0.035,
    reactionMs: 165,
    aimErrorPx: 24,
    pointsPerGoal: 500,
    multiplierBadge: '1.0x PTS',
    color: '#34D399',
  },
  MEDIUM: {
    label: 'PRO',
    aiSpeed: 280,
    predictionSeconds: 0.075,
    reactionMs: 105,
    aimErrorPx: 12,
    pointsPerGoal: 875,
    multiplierBadge: '1.75x PTS',
    color: '#38BDF8',
  },
  HARD: {
    label: 'MASTER',
    aiSpeed: 400,
    predictionSeconds: 0.115,
    reactionMs: 70,
    aimErrorPx: 5,
    pointsPerGoal: 1250,
    multiplierBadge: '2.5x PTS',
    color: '#F43F5E',
  },
};

export const advanceMalletTowardsTarget = (
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  maxSpeed: number,
  deltaSec: number,
) => {
  const dx = targetX - currentX;
  const dy = targetY - currentY;
  const distance = Math.hypot(dx, dy);
  const safeDelta = Math.max(0, deltaSec);
  const maxTravel = Math.max(0, maxSpeed) * safeDelta;
  const travel = distance > 0 ? Math.min(distance, maxTravel) : 0;
  const ratio = distance > 0 ? travel / distance : 0;
  const x = currentX + dx * ratio;
  const y = currentY + dy * ratio;
  const velocityDelta = Math.max(1 / 240, safeDelta);

  return {
    x,
    y,
    vx: (x - currentX) / velocityDelta,
    vy: (y - currentY) / velocityDelta,
  };
};

export const capAirHockeyVelocity = (vx: number, vy: number, maxSpeed: number) => {
  const speed = Math.hypot(vx, vy);
  if (speed <= maxSpeed || speed <= 0) return { vx, vy };
  const scale = maxSpeed / speed;
  return { vx: vx * scale, vy: vy * scale };
};
