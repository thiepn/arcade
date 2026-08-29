export const ONE_LINE_PHYSICS_HZ = 240;
export const ONE_LINE_FIXED_STEP_SEC = 1 / ONE_LINE_PHYSICS_HZ;
export const ONE_LINE_MAX_FRAME_SEC = 0.05;
export const ONE_LINE_REFERENCE_WIDTH = 420;
export const ONE_LINE_REFERENCE_HEIGHT = 500;
export const ONE_LINE_REFERENCE_INK = 1100;

export const getOneLineInkBudget = (width: number, height: number) => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const referenceDiagonal = Math.hypot(ONE_LINE_REFERENCE_WIDTH, ONE_LINE_REFERENCE_HEIGHT);
  const diagonal = Math.hypot(safeWidth, safeHeight);
  return ONE_LINE_REFERENCE_INK * (diagonal / referenceDiagonal);
};

export const getOneLinePhysicsStepBatch = (accumulatorSec: number, deltaSec: number) => {
  const totalSec = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), ONE_LINE_MAX_FRAME_SEC);
  const steps = Math.floor((totalSec + 1e-9) / ONE_LINE_FIXED_STEP_SEC);
  return {
    steps,
    remainderSec: Math.max(0, totalSec - steps * ONE_LINE_FIXED_STEP_SEC),
  };
};

export const remapOneLinePoint = <T extends { x: number; y: number }>(
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
