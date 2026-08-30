export const TOWER_PHYSICS_HZ = 60;
export const TOWER_FIXED_STEP_SEC = 1 / TOWER_PHYSICS_HZ;
export const TOWER_MAX_FRAME_SEC = 0.08;
export const TOWER_MAX_STEPS_PER_FRAME = 8;

export interface TowerStepBatch {
  steps: number;
  remainderSec: number;
}

export const getTowerPhysicsStepBatch = (
  accumulatorSec: number,
  deltaSec: number,
): TowerStepBatch => {
  let accumulator = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), TOWER_MAX_FRAME_SEC);
  let steps = 0;
  while (accumulator + 1e-12 >= TOWER_FIXED_STEP_SEC && steps < TOWER_MAX_STEPS_PER_FRAME) {
    accumulator -= TOWER_FIXED_STEP_SEC;
    steps++;
  }
  return { steps, remainderSec: Math.max(0, accumulator) };
};
