export interface MatrixOverclockConfig {
  sequenceBonus: number;
  playbackScale: number;
  stepScoreMultiplier: number;
  clearScoreMultiplier: number;
  disablesManualReplay: boolean;
}

export const MATRIX_OVERCLOCK: MatrixOverclockConfig = {
  sequenceBonus: 2,
  playbackScale: 0.78,
  stepScoreMultiplier: 1.5,
  clearScoreMultiplier: 1.8,
  disablesManualReplay: true,
};

export const canArmMatrixOverclock = (round: number, lives: number) =>
  Number.isFinite(round) && Math.floor(round) >= 1 && Number.isFinite(lives) && lives > 0;

export const getMatrixSequenceLength = (baseLength: number, overclockActive: boolean) =>
  Math.max(1, Math.floor(baseLength)) + (overclockActive ? MATRIX_OVERCLOCK.sequenceBonus : 0);

export const getMatrixPlaybackSpeed = (baseSpeedMs: number, overclockActive: boolean) => {
  const base = Math.max(140, baseSpeedMs);
  return overclockActive ? Math.max(140, Math.round(base * MATRIX_OVERCLOCK.playbackScale)) : base;
};

export const getMatrixStepPoints = (basePoints: number, overclockActive: boolean) =>
  Math.round(Math.max(0, basePoints) * (overclockActive ? MATRIX_OVERCLOCK.stepScoreMultiplier : 1));

export const getMatrixClearPoints = (basePoints: number, overclockActive: boolean) =>
  Math.round(Math.max(0, basePoints) * (overclockActive ? MATRIX_OVERCLOCK.clearScoreMultiplier : 1));
