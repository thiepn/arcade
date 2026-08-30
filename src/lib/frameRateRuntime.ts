export const ARCADE_REFERENCE_HZ = 60;
export const ARCADE_FIXED_STEP_SEC = 1 / ARCADE_REFERENCE_HZ;
export const ARCADE_MAX_FRAME_SEC = 0.08;
export const ARCADE_MAX_STEPS_PER_FRAME = 8;

export interface ArcadeStepBatch {
  steps: number;
  remainderSec: number;
}

export const getArcadeStepBatch = (accumulatorSec: number, deltaSec: number): ArcadeStepBatch => {
  let accumulator = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), ARCADE_MAX_FRAME_SEC);
  let steps = 0;
  while (accumulator + 1e-12 >= ARCADE_FIXED_STEP_SEC && steps < ARCADE_MAX_STEPS_PER_FRAME) {
    accumulator -= ARCADE_FIXED_STEP_SEC;
    steps++;
  }
  return { steps, remainderSec: Math.max(0, accumulator) };
};

export const getFrameScale = (deltaSec: number): number =>
  Math.min(ARCADE_MAX_STEPS_PER_FRAME, Math.max(0, deltaSec) * ARCADE_REFERENCE_HZ);

export const getFrameInvariantBlend = (perFrameBlend: number, frameScale: number): number => {
  const blend = Math.min(1, Math.max(0, perFrameBlend));
  return 1 - Math.pow(1 - blend, Math.max(0, frameScale));
};

export const getFrameInvariantDecay = (perFrameFactor: number, frameScale: number): number =>
  Math.pow(Math.min(1, Math.max(0, perFrameFactor)), Math.max(0, frameScale));

export const getFrameInvariantChance = (perFrameProbability: number, frameScale: number): number => {
  const probability = Math.min(1, Math.max(0, perFrameProbability));
  return 1 - Math.pow(1 - probability, Math.max(0, frameScale));
};
