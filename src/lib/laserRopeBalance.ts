export const LASER_ROPE_MODE_MIN_WARNING_SEC = 0.38;

const TAU = Math.PI * 2;
const positiveModulo = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus;

export const getLaserRopeTimeToBottomCrossing = (
  sweepAngle: number,
  direction: number,
  sweepSpeedRadSec: number,
): number => {
  if (!Number.isFinite(sweepSpeedRadSec) || sweepSpeedRadSec <= 0) return Number.POSITIVE_INFINITY;
  const targetAngle = Math.PI / 2;
  const delta = direction >= 0
    ? positiveModulo(targetAngle - sweepAngle, TAU)
    : positiveModulo(sweepAngle - targetAngle, TAU);
  return delta / sweepSpeedRadSec;
};

export const getLaserRopeModeWarningSec = (
  sweepAngle: number,
  direction: number,
  sweepSpeedRadSec: number,
  candidateBeamsCount: number,
): number => {
  const beams = candidateBeamsCount >= 2 ? 2 : 1;
  let minimum = Number.POSITIVE_INFINITY;
  for (let beam = 0; beam < beams; beam++) {
    const beamAngle = sweepAngle + beam * Math.PI;
    minimum = Math.min(
      minimum,
      getLaserRopeTimeToBottomCrossing(beamAngle, direction, sweepSpeedRadSec),
    );
  }
  return minimum;
};

export const canApplyLaserRopeModeChange = (
  sweepAngle: number,
  direction: number,
  sweepSpeedRadSec: number,
  candidateBeamsCount: number,
  minimumWarningSec = LASER_ROPE_MODE_MIN_WARNING_SEC,
): boolean =>
  getLaserRopeModeWarningSec(
    sweepAngle,
    direction,
    sweepSpeedRadSec,
    candidateBeamsCount,
  ) >= minimumWarningSec;
