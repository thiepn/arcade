export type NeonRailLane = 0 | 1 | 2;

export const NEON_RAIL_PHASE_COOLDOWN = 5;
export const NEON_RAIL_PLAYER_Y = 0.82;
export const NEON_RAIL_MIN_SPEED = 0.34;
export const NEON_RAIL_MAX_SPEED = 0.68;
export const NEON_RAIL_MIN_SPAWN_INTERVAL = 0.5;
export const NEON_RAIL_MAX_SPAWN_INTERVAL = 0.92;

export interface NeonRailPattern {
  safeLane: NeonRailLane;
  blockedLanes: NeonRailLane[];
  coreLane: NeonRailLane;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const clampNeonRailLane = (lane: number): NeonRailLane =>
  clamp(Math.round(lane), 0, 2) as NeonRailLane;

export const getNeonRailSpeed = (elapsedSeconds: number): number =>
  clamp(
    NEON_RAIL_MIN_SPEED + Math.max(0, elapsedSeconds) * 0.0045,
    NEON_RAIL_MIN_SPEED,
    NEON_RAIL_MAX_SPEED,
  );

export const getNeonRailSpawnInterval = (elapsedSeconds: number): number =>
  clamp(
    NEON_RAIL_MAX_SPAWN_INTERVAL - Math.max(0, elapsedSeconds) * 0.004,
    NEON_RAIL_MIN_SPAWN_INTERVAL,
    NEON_RAIL_MAX_SPAWN_INTERVAL,
  );

export const chooseAdjacentNeonRailLane = (
  previousSafeLane: NeonRailLane,
  randomValue: number,
): NeonRailLane => {
  const options: NeonRailLane[] = [previousSafeLane];
  if (previousSafeLane > 0) options.unshift((previousSafeLane - 1) as NeonRailLane);
  if (previousSafeLane < 2) options.push((previousSafeLane + 1) as NeonRailLane);
  const normalized = clamp(randomValue, 0, 0.999999);
  return options[Math.floor(normalized * options.length)];
};

export const createNeonRailPattern = (
  previousSafeLane: NeonRailLane,
  rowIndex: number,
  laneRandom: number,
  densityRandom: number,
): NeonRailPattern => {
  const safeLane = chooseAdjacentNeonRailLane(previousSafeLane, laneRandom);
  const otherLanes = ([0, 1, 2] as NeonRailLane[]).filter((lane) => lane !== safeLane);
  const useDoubleBarrier = rowIndex >= 3 && densityRandom >= 0.52;
  const blockedLanes = useDoubleBarrier
    ? otherLanes
    : [otherLanes[Math.floor(clamp(densityRandom, 0, 0.999999) * otherLanes.length)]];

  return {
    safeLane,
    blockedLanes,
    coreLane: safeLane,
  };
};

export const getNeonRailLaneX = (
  lane: NeonRailLane,
  yProgress: number,
  viewportWidth: number,
): number => {
  const depth = clamp(yProgress, 0, 1);
  const centerX = viewportWidth / 2;
  const bottomSpread = Math.min(viewportWidth * 0.29, 210);
  const horizonSpread = bottomSpread * 0.28;
  const spread = horizonSpread + (bottomSpread - horizonSpread) * depth;
  return centerX + (lane - 1) * spread;
};
