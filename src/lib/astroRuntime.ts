export const ASTRO_PHYSICS_HZ = 60;
export const ASTRO_FIXED_STEP_SEC = 1 / ASTRO_PHYSICS_HZ;
export const ASTRO_MAX_FRAME_SEC = 0.08;
export const ASTRO_MAX_STEPS_PER_FRAME = 8;

export interface AstroStepBatch {
  steps: number;
  remainderSec: number;
}

export const getAstroPhysicsStepBatch = (
  accumulatorSec: number,
  deltaSec: number,
): AstroStepBatch => {
  let accumulator = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), ASTRO_MAX_FRAME_SEC);
  let steps = 0;
  while (accumulator + 1e-12 >= ASTRO_FIXED_STEP_SEC && steps < ASTRO_MAX_STEPS_PER_FRAME) {
    accumulator -= ASTRO_FIXED_STEP_SEC;
    steps++;
  }
  return { steps, remainderSec: Math.max(0, accumulator) };
};
