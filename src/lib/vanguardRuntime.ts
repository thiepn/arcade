export const VANGUARD_PHYSICS_HZ = 60;
export const VANGUARD_FIXED_STEP_SEC = 1 / VANGUARD_PHYSICS_HZ;
export const VANGUARD_MAX_FRAME_SEC = 0.08;
export const VANGUARD_MAX_STEPS_PER_FRAME = 8;

export interface VanguardStepBatch {
  steps: number;
  remainderSec: number;
}

export const getVanguardPhysicsStepBatch = (
  accumulatorSec: number,
  deltaSec: number,
): VanguardStepBatch => {
  let accumulator = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), VANGUARD_MAX_FRAME_SEC);
  let steps = 0;
  while (accumulator + 1e-12 >= VANGUARD_FIXED_STEP_SEC && steps < VANGUARD_MAX_STEPS_PER_FRAME) {
    accumulator -= VANGUARD_FIXED_STEP_SEC;
    steps++;
  }
  return { steps, remainderSec: Math.max(0, accumulator) };
};
