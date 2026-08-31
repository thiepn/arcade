import type { PerfectStopRoundConfig } from './perfectStopGameplay';

export const PERFECT_STOP_ENCORE_HITS_REQUIRED = 4;

export const PERFECT_STOP_ENCORE_ROUNDS: readonly PerfectStopRoundConfig[] = [
  {
    id: 'afterimage',
    label: 'AFTERIMAGE',
    hint: 'Master encore: track a faster drifting beacon through a pulsing sweep.',
    targetStart: 50,
    targetAmplitude: 20,
    targetSpeedHz: 0.31,
    markerSpeedPerSecond: 205,
    speedPulse: 0.22,
    speedPulseHz: 1.0,
    flipIntervalMs: 0,
    perfectWindow: 1.5,
    greatWindow: 3.8,
    goodWindow: 7.2,
    scoreMultiplier: 2.35,
  },
  {
    id: 'phase-break',
    label: 'PHASE BREAK',
    hint: 'A narrow static beacon meets fast speed pulses and abrupt reversals.',
    targetStart: 37,
    targetAmplitude: 0,
    targetSpeedHz: 0,
    markerSpeedPerSecond: 215,
    speedPulse: 0.32,
    speedPulseHz: 1.08,
    flipIntervalMs: 620,
    perfectWindow: 1.3,
    greatWindow: 3.4,
    goodWindow: 6.5,
    scoreMultiplier: 2.7,
  },
  {
    id: 'zero-margin',
    label: 'ZERO MARGIN',
    hint: 'Final mastery test: moving beacon, heavy speed pulse, and rapid reversals.',
    targetStart: 50,
    targetAmplitude: 17,
    targetSpeedHz: 0.34,
    markerSpeedPerSecond: 228,
    speedPulse: 0.34,
    speedPulseHz: 1.12,
    flipIntervalMs: 560,
    perfectWindow: 1.15,
    greatWindow: 3,
    goodWindow: 5.8,
    scoreMultiplier: 3.1,
  },
] as const;

export const isPerfectStopEncoreUnlocked = (masterHits: number): boolean =>
  masterHits >= PERFECT_STOP_ENCORE_HITS_REQUIRED;
