import { clamp } from './gameCoordinates';

export const BLADE_BASE_ARENA_HEIGHT = 500;
export const BLADE_BASE_GRAVITY = 0.28;
export const BLADE_APEX_MIN_RATIO = 0.12;
export const BLADE_APEX_MAX_RATIO = 0.32;
export const BLADE_LANDING_MARGIN_RATIO = 0.08;

export interface BladeLaunchOptions {
  startX: number;
  startY: number;
  width: number;
  height: number;
  random?: () => number;
}

export interface BladeLaunchTrajectory {
  vx: number;
  vy: number;
  gravity: number;
  apexY: number;
  apexRatio: number;
  landingX: number;
  framesToApex: number;
}

export const getBladeGravity = (height: number): number => {
  const safeHeight = Math.max(1, height);
  return BLADE_BASE_GRAVITY * clamp(safeHeight / BLADE_BASE_ARENA_HEIGHT, 0.9, 1.45);
};

export const createBladeLaunchTrajectory = ({
  startX,
  startY,
  width,
  height,
  random = Math.random,
}: BladeLaunchOptions): BladeLaunchTrajectory => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const gravity = getBladeGravity(safeHeight);
  const apexRandom = clamp(random(), 0, 0.999999);
  const apexRatio =
    BLADE_APEX_MIN_RATIO +
    apexRandom * (BLADE_APEX_MAX_RATIO - BLADE_APEX_MIN_RATIO);
  const apexY = safeHeight * apexRatio;
  const rise = Math.max(1, startY - apexY);

  // The game applies gravity before position each 60 Hz step. The half-gravity
  // correction makes the discrete parabola land on the requested apex height.
  const launchSpeedY = Math.sqrt(2 * gravity * rise) + gravity / 2;
  const framesToApex = Math.max(1, launchSpeedY / gravity);

  const desiredApexX = safeWidth * (0.2 + clamp(random(), 0, 0.999999) * 0.6);
  const minLandingX = safeWidth * BLADE_LANDING_MARGIN_RATIO;
  const maxLandingX = safeWidth * (1 - BLADE_LANDING_MARGIN_RATIO);
  const landingX = clamp(2 * desiredApexX - startX, minLandingX, maxLandingX);
  const vx = (landingX - startX) / (framesToApex * 2);

  return {
    vx,
    vy: -launchSpeedY,
    gravity,
    apexY,
    apexRatio,
    landingX,
    framesToApex,
  };
};
