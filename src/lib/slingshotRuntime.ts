export const SLINGSHOT_PHYSICS_HZ = 60;
export const SLINGSHOT_FIXED_STEP_SEC = 1 / SLINGSHOT_PHYSICS_HZ;
export const SLINGSHOT_MAX_FRAME_SEC = 0.05;

export interface SlingshotProbeBody {
  probeX: number;
  probeY: number;
  probeVx: number;
  probeVy: number;
}

export const advanceSlingshotProbe = (body: SlingshotProbeBody) => {
  body.probeX += body.probeVx;
  body.probeY += body.probeVy;
};

export const getSlingshotPhysicsStepBatch = (accumulatorSec: number, deltaSec: number) => {
  const totalSec = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), SLINGSHOT_MAX_FRAME_SEC);
  const steps = Math.floor((totalSec + 1e-9) / SLINGSHOT_FIXED_STEP_SEC);
  return {
    steps,
    remainderSec: Math.max(0, totalSec - steps * SLINGSHOT_FIXED_STEP_SEC),
  };
};

export const getSlingshotResizeScale = (
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
) => {
  const sx = newWidth / Math.max(1, oldWidth);
  const sy = newHeight / Math.max(1, oldHeight);
  return Math.sqrt(Math.max(0.01, sx * sy));
};

export const remapSlingshotPoint = <T extends { x: number; y: number }>(
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
