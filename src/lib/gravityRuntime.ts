export const GRAVITY_PHYSICS_HZ = 60;
export const GRAVITY_FIXED_STEP_SEC = 1 / GRAVITY_PHYSICS_HZ;
export const GRAVITY_MAX_FRAME_SEC = 0.05;
export const GRAVITY_MAX_STEPS_PER_FRAME = 6;

export const getGravityPhysicsStepBatch = (accumulatorSec: number, deltaSec: number) => {
  const totalSec = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), GRAVITY_MAX_FRAME_SEC);
  const requestedSteps = Math.floor((totalSec + 1e-9) / GRAVITY_FIXED_STEP_SEC);
  const steps = Math.min(GRAVITY_MAX_STEPS_PER_FRAME, requestedSteps);
  const remainderSec = requestedSteps > GRAVITY_MAX_STEPS_PER_FRAME
    ? 0
    : Math.max(0, totalSec - steps * GRAVITY_FIXED_STEP_SEC);
  return { steps, remainderSec };
};

export const advanceGravityBody = <T extends { x: number; y: number; vx: number; vy: number }>(
  body: T,
  forceX: number,
  forceY: number,
  timeScale = 1,
) => {
  body.vx += forceX * timeScale;
  body.vy += forceY * timeScale;
  body.x += body.vx * timeScale;
  body.y += body.vy * timeScale;
  return body;
};

export const remapGravityPoint = <T extends { x: number; y: number }>(
  point: T,
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
): T => ({
  ...point,
  x: point.x * (newWidth / Math.max(1, oldWidth)),
  y: point.y * (newHeight / Math.max(1, oldHeight)),
});

export const getGravityResizeScale = (
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
) => Math.sqrt((newWidth / Math.max(1, oldWidth)) * (newHeight / Math.max(1, oldHeight)));
