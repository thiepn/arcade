import { requestP22GameplayEvent } from './p22GameplayEvents';

export const NEON_RAIL_MASTERY_STREAK = 6;
export const NEON_RAIL_MAX_SURGE_CHARGES = 2;
export const NEON_RAIL_SURGE_DURATION = 5;
export const NEON_RAIL_SURGE_SPEED_MULTIPLIER = 1.18;
export const NEON_RAIL_SURGE_SCORE_MULTIPLIER = 2;
export const P22_NEON_RAIL_SEQUENCE_CORE_COUNT = 18;

export const isNeonRailMasteryMilestone = (combo: number) => {
  const safeCombo = Math.max(0, Math.floor(combo));
  requestP22GameplayEvent({
    gameId: 'neonrail',
    kind: 'rail-core-success',
    value: safeCombo,
    aux: P22_NEON_RAIL_SEQUENCE_CORE_COUNT,
  });
  return safeCombo > 0 && safeCombo % NEON_RAIL_MASTERY_STREAK === 0;
};

export const getNeonRailMasteryReward = (combo: number) => {
  if (!isNeonRailMasteryMilestone(combo)) return 0;
  const tier = Math.floor(Math.max(0, combo - NEON_RAIL_MASTERY_STREAK) / NEON_RAIL_MASTERY_STREAK);
  const baseReward = 500 + Math.min(1500, tier * 250);
  const sequenceBonus = requestP22GameplayEvent({
    gameId: 'neonrail',
    kind: 'rail-mastery-reward',
    value: Math.max(0, Math.floor(combo)),
  });
  return baseReward + sequenceBonus;
};

export const getNeonRailSurgeSpeedMultiplier = (surgeActive: boolean) =>
  surgeActive ? NEON_RAIL_SURGE_SPEED_MULTIPLIER : 1;

export const getNeonRailSurgeScoreMultiplier = (surgeActive: boolean) =>
  surgeActive ? NEON_RAIL_SURGE_SCORE_MULTIPLIER : 1;
