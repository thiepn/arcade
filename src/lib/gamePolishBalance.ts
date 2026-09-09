/** P25 deep-polish balance envelopes.
 *
 * These helpers deliberately avoid changing raw score formulas. They make the
 * difficulty curve depend on physical progress instead of score bonuses, cap
 * runaway late-game pressure, and remove avoidable RNG streaks while preserving
 * each game's existing identity and leaderboard scale.
 */
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const smoothstep01 = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

export const getAirHockeyOpeningPace = (elapsedSeconds: number): number =>
  0.84 + 0.16 * smoothstep01(Math.max(0, elapsedSeconds) / 8);

export const getAstroLargeAsteroidCount = (level: number): number =>
  Math.min(9, 3 + Math.max(1, Math.floor(level)));

export const getBladeSpawnIntervalFrames = (score: number): number =>
  Math.round(65 - 15 * smoothstep01(Math.max(0, score) / 12000));

const BLOCK_DROP_INTERVALS = [0.8, 0.72, 0.64, 0.56, 0.49, 0.43, 0.37, 0.32, 0.27, 0.23, 0.2, 0.17, 0.15, 0.13, 0.12] as const;
export const getBlockDropInterval = (level: number): number =>
  BLOCK_DROP_INTERVALS[Math.min(BLOCK_DROP_INTERVALS.length - 1, Math.max(0, Math.floor(level) - 1))];

export const getChainTargetPercent = (wave: number): number =>
  Math.min(0.78, 0.5 + Math.max(0, Math.floor(wave) - 1) * 0.04);

export const getChainBaseSpeed = (wave: number, randomValue: number): number =>
  1.3 + Math.min(1.45, Math.max(1, wave) * 0.12) + clamp(randomValue, 0, 1) * 0.95;

export const getDodgeSpawnDelayMs = (elapsedSeconds: number, activeHazards: number): number => {
  const pressure = smoothstep01(Math.max(0, elapsedSeconds) / 48);
  const base = 1100 - pressure * 650;
  const densityRelief = Math.max(0, activeHazards - 5) * 65;
  return Math.max(450, base + densityRelief);
};

export const getFlappyAeroGap = (gatesCleared: number): number =>
  Math.max(96, 132 - Math.max(0, gatesCleared) * 0.68);

export const getFlappyAeroScrollSpeed = (gatesCleared: number): number =>
  Math.min(270, 175 + Math.max(0, gatesCleared) * 2.5);

export const getOrbitHazardIntervalMs = (elapsedSeconds: number): number =>
  Math.round(1800 - 1050 * smoothstep01(Math.max(0, elapsedSeconds) / 58));

export const getPulseComboBpmBoost = (combo: number): number =>
  30 * (1 - Math.exp(-Math.max(0, combo) / 18));

export const getRoadCrossLaneSpeed = (maxRow: number, randomValue: number): number => {
  const district = Math.min(3, Math.floor(Math.max(0, maxRow) / 8));
  const minSpeed = 62 + district * 7;
  const maxSpeed = 112 + district * 7;
  return minSpeed + clamp(randomValue, 0, 0.999999) * (maxSpeed - minSpeed);
};

export const getSnakeTickIntervalMs = (snakeLength: number): number => {
  const growth = Math.max(0, Math.floor(snakeLength) - 3);
  const stage = Math.floor(growth / 4);
  return Math.max(65, 95 - stage * 3);
};

export const getStackTravelSpeed = (towerBlocks: number, viewportScale: number): number =>
  (3.5 + Math.min(4.5, Math.max(0, towerBlocks - 1) * 0.08)) * clamp(viewportScale, 0.85, 1.7);

export const getTowerPlatformGap = (altitude: number, randomValue: number): number => {
  const difficulty = smoothstep01(Math.max(0, altitude) / 2200);
  const maxGap = 82 + difficulty * 7;
  return 46 + clamp(randomValue, 0, 0.999999) * (maxGap - 46);
};

export const getTypeRushBaseSpeed = (elapsedSeconds: number, waveMultiplier: number): number => {
  const elapsed = Math.max(0, elapsedSeconds);
  const eased = 0.15 + 0.16 * (1 - Math.exp(-elapsed / 45));
  return eased * Math.max(0.5, waveMultiplier);
};

export type VanguardEnemyKind = 'swarmer' | 'drone' | 'interceptor' | 'sniper' | 'heavy';
const VANGUARD_SPEEDS: Record<VanguardEnemyKind, { base: number; growth: number; cap: number }> = {
  swarmer: { base: 3.4, growth: 0.15, cap: 4.75 },
  drone: { base: 2.2, growth: 0.2, cap: 3.7 },
  interceptor: { base: 4.2, growth: 0.06, cap: 4.65 },
  sniper: { base: 1.2, growth: 0.04, cap: 1.55 },
  heavy: { base: 1.3, growth: 0.035, cap: 1.6 },
};
export const getVanguardEnemySpeed = (kind: VanguardEnemyKind, wave: number): number => {
  const config = VANGUARD_SPEEDS[kind];
  return Math.min(config.cap, config.base + Math.max(1, wave) * config.growth);
};

export const getVanguardBossHp = (wave: number): number => {
  const safeWave = Math.max(1, Math.floor(wave));
  const early = Math.min(4, safeWave);
  const late = Math.max(0, safeWave - 4);
  return Math.round(40 + early * 20 + Math.sqrt(late) * 10);
};

export const getLaserRopeWarningFloor = (sweepSpeedRadSec: number): number => {
  const pressure = (Math.max(0, sweepSpeedRadSec) - 2.2) / (5.4 - 2.2);
  return 0.38 + 0.07 * smoothstep01(pressure);
};

export const getPinballRescueImpulse = (lowSpeedSeconds: number): number =>
  lowSpeedSeconds >= 1.8 ? 150 : lowSpeedSeconds >= 1.35 ? 120 : 0;

export const getBubbleDropCadence = (ceilingDrops: number): number =>
  ceilingDrops < 2 ? 6 : 5;

export const getBreakoutMinimumSpecials = (round: number): number =>
  Math.min(4, 2 + Math.floor(Math.max(1, round) / 4));

export type BalancedChoice = 'LEFT' | 'RIGHT';
export const chooseBalancedReactionChoice = (
  previous: BalancedChoice | null,
  streak: number,
  randomValue: number,
): BalancedChoice => {
  if (previous && streak >= 2) return previous === 'LEFT' ? 'RIGHT' : 'LEFT';
  return clamp(randomValue, 0, 0.999999) < 0.5 ? 'LEFT' : 'RIGHT';
};

export const getRhythmMissPenalty = (grooveHealth: number): number =>
  grooveHealth > 55 ? 6 : 7;

export const getSlingshotNodeOffset = (randomValue: number): number =>
  (clamp(randomValue, 0, 0.999999) - 0.5) * 190;

const MERGE_TILE_BAG_TEMPLATE = [2, 2, 4, 4, 8, 16] as const;
export const drawMergeTileFromBag = (bag: number[], random: () => number = Math.random): number => {
  if (bag.length === 0) {
    bag.push(...MERGE_TILE_BAG_TEMPLATE);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(clamp(random(), 0, 0.999999) * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop() ?? 2;
};
