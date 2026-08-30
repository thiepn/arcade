export const DRIFT_PHYSICS_HZ = 60;
export const DRIFT_FIXED_STEP_SEC = 1 / DRIFT_PHYSICS_HZ;
export const DRIFT_MAX_FRAME_SEC = 0.08;
export const DRIFT_MAX_STEPS_PER_FRAME = 8;

export interface DriftStepBatch {
  steps: number;
  remainderSec: number;
}

export const getDriftPhysicsStepBatch = (
  accumulatorSec: number,
  deltaSec: number,
): DriftStepBatch => {
  let accumulator = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), DRIFT_MAX_FRAME_SEC);
  let steps = 0;
  while (accumulator + 1e-12 >= DRIFT_FIXED_STEP_SEC && steps < DRIFT_MAX_STEPS_PER_FRAME) {
    accumulator -= DRIFT_FIXED_STEP_SEC;
    steps++;
  }
  return { steps, remainderSec: Math.max(0, accumulator) };
};
