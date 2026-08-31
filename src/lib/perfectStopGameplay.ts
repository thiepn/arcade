export type PerfectStopPatternId =
  | 'center-lock'
  | 'side-snap'
  | 'speed-gate'
  | 'micro-zone'
  | 'drift-target'
  | 'reverse-pulse'
  | 'final-chaos';

export type PerfectStopRating = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';

export interface PerfectStopRoundConfig {
  id: PerfectStopPatternId;
  label: string;
  hint: string;
  targetStart: number;
  targetAmplitude: number;
  targetSpeedHz: number;
  markerSpeedPerSecond: number;
  speedPulse: number;
  speedPulseHz: number;
  flipIntervalMs: number;
  perfectWindow: number;
  greatWindow: number;
  goodWindow: number;
  scoreMultiplier: number;
}

export interface PerfectStopJudgement {
  distance: number;
  accuracy: number;
  rating: PerfectStopRating;
  points: number;
  nextStreak: number;
}

export const PERFECT_STOP_ROUNDS: PerfectStopRoundConfig[] = [
  {
    id: 'center-lock',
    label: 'CENTER LOCK',
    hint: 'Classic calibration. Stop on the center beacon.',
    targetStart: 50,
    targetAmplitude: 0,
    targetSpeedHz: 0,
    markerSpeedPerSecond: 118,
    speedPulse: 0,
    speedPulseHz: 0,
    flipIntervalMs: 0,
    perfectWindow: 2.2,
    greatWindow: 6,
    goodWindow: 12,
    scoreMultiplier: 1,
  },
  {
    id: 'side-snap',
    label: 'SIDE SNAP',
    hint: 'The target has moved off-center. Recalibrate quickly.',
    targetStart: 29,
    targetAmplitude: 0,
    targetSpeedHz: 0,
    markerSpeedPerSecond: 136,
    speedPulse: 0,
    speedPulseHz: 0,
    flipIntervalMs: 0,
    perfectWindow: 2,
    greatWindow: 5.5,
    goodWindow: 11,
    scoreMultiplier: 1.15,
  },
  {
    id: 'speed-gate',
    label: 'SPEED GATE',
    hint: 'Faster sweep. Read the approach instead of chasing the cursor.',
    targetStart: 72,
    targetAmplitude: 0,
    targetSpeedHz: 0,
    markerSpeedPerSecond: 166,
    speedPulse: 0.08,
    speedPulseHz: 0.6,
    flipIntervalMs: 0,
    perfectWindow: 2,
    greatWindow: 5,
    goodWindow: 10,
    scoreMultiplier: 1.3,
  },
  {
    id: 'micro-zone',
    label: 'MICRO ZONE',
    hint: 'The scoring window contracts. Precision matters more than speed.',
    targetStart: 43,
    targetAmplitude: 0,
    targetSpeedHz: 0,
    markerSpeedPerSecond: 154,
    speedPulse: 0.1,
    speedPulseHz: 0.75,
    flipIntervalMs: 0,
    perfectWindow: 1.5,
    greatWindow: 4,
    goodWindow: 8,
    scoreMultiplier: 1.5,
  },
  {
    id: 'drift-target',
    label: 'DRIFT TARGET',
    hint: 'The target moves. Match trajectories, then commit.',
    targetStart: 50,
    targetAmplitude: 18,
    targetSpeedHz: 0.18,
    markerSpeedPerSecond: 170,
    speedPulse: 0.12,
    speedPulseHz: 0.7,
    flipIntervalMs: 0,
    perfectWindow: 2,
    greatWindow: 5,
    goodWindow: 9,
    scoreMultiplier: 1.65,
  },
  {
    id: 'reverse-pulse',
    label: 'REVERSE PULSE',
    hint: 'The sweep reverses on a fixed pulse. Learn the rhythm.',
    targetStart: 62,
    targetAmplitude: 0,
    targetSpeedHz: 0,
    markerSpeedPerSecond: 182,
    speedPulse: 0.16,
    speedPulseHz: 0.8,
    flipIntervalMs: 850,
    perfectWindow: 1.8,
    greatWindow: 4.5,
    goodWindow: 8.5,
    scoreMultiplier: 1.85,
  },
  {
    id: 'final-chaos',
    label: 'FINAL CHAOS',
    hint: 'Moving target, speed pulse, and timed reversals combine.',
    targetStart: 50,
    targetAmplitude: 16,
    targetSpeedHz: 0.26,
    markerSpeedPerSecond: 195,
    speedPulse: 0.28,
    speedPulseHz: 0.9,
    flipIntervalMs: 700,
    perfectWindow: 1.6,
    greatWindow: 4.2,
    goodWindow: 8,
    scoreMultiplier: 2.1,
  },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const getPerfectStopTargetPosition = (config: PerfectStopRoundConfig, elapsedMs: number) => {
  if (config.targetAmplitude === 0 || config.targetSpeedHz === 0) return config.targetStart;
  const phase = (elapsedMs / 1000) * Math.PI * 2 * config.targetSpeedHz;
  return clamp(config.targetStart + Math.sin(phase) * config.targetAmplitude, 8, 92);
};

export const getPerfectStopMarkerSpeed = (config: PerfectStopRoundConfig, elapsedMs: number) => {
  if (config.speedPulse === 0 || config.speedPulseHz === 0) return config.markerSpeedPerSecond;
  const phase = (elapsedMs / 1000) * Math.PI * 2 * config.speedPulseHz;
  return config.markerSpeedPerSecond * (1 + Math.sin(phase) * config.speedPulse);
};

export const judgePerfectStop = (
  markerPosition: number,
  targetPosition: number,
  config: PerfectStopRoundConfig,
  streak: number,
): PerfectStopJudgement => {
  const distance = Math.abs(markerPosition - targetPosition);
  const accuracy = Math.max(0, Math.round((100 - Math.min(50, distance) * 2) * 10) / 10);

  let rating: PerfectStopRating = 'MISS';
  let basePoints = 50;
  if (distance <= config.perfectWindow) {
    rating = 'PERFECT';
    basePoints = 1000;
  } else if (distance <= config.greatWindow) {
    rating = 'GREAT';
    basePoints = 600;
  } else if (distance <= config.goodWindow) {
    rating = 'GOOD';
    basePoints = 250;
  }

  const nextStreak = rating === 'PERFECT' || rating === 'GREAT' ? streak + 1 : 0;
  const streakMultiplier = 1 + Math.min(0.72, nextStreak * 0.08);
  const points = Math.round(basePoints * config.scoreMultiplier * streakMultiplier);

  return { distance, accuracy, rating, points, nextStreak };
};
