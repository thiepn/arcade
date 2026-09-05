import type { PerfectStopRoundConfig } from './perfectStopGameplay';

export type PerfectStopBeaconChoice = 'PRIMARY' | 'PRECISION';
export type PerfectStopRouteId = 'CALIBRATION' | 'EDGE';

export interface PerfectStopRouteState {
  route: PerfectStopRouteId | null;
  progress: number;
  completions: number;
}

export interface PerfectStopRouteResolution {
  state: PerfectStopRouteState;
  choice: PerfectStopBeaconChoice | null;
  bonus: number;
  masterCreditBonus: number;
  completed: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const createPerfectStopRouteState = (): PerfectStopRouteState => ({
  route: null,
  progress: 0,
  completions: 0,
});

export const getPerfectStopPrecisionTarget = (
  primaryTarget: number,
  config: PerfectStopRoundConfig,
  roundIndex: number,
): number | null => {
  const minimumSeparation = config.goodWindow * 2 + 5;
  let candidate = 100 - primaryTarget;
  if (Math.abs(candidate - primaryTarget) < minimumSeparation) {
    const direction = roundIndex % 2 === 0 ? 1 : -1;
    candidate = primaryTarget + direction * Math.max(24, minimumSeparation);
  }
  candidate = clamp(candidate, 9, 91);
  return Math.abs(candidate - primaryTarget) >= minimumSeparation ? candidate : null;
};

export const getPerfectStopBeaconChoice = (
  markerPosition: number,
  primaryTarget: number,
  precisionTarget: number | null,
  goodWindow: number,
): PerfectStopBeaconChoice | null => {
  const primaryDistance = Math.abs(markerPosition - primaryTarget);
  const precisionDistance = precisionTarget === null
    ? Number.POSITIVE_INFINITY
    : Math.abs(markerPosition - precisionTarget);
  const primaryHit = primaryDistance <= goodWindow;
  const precisionHit = precisionDistance <= goodWindow;
  if (!primaryHit && !precisionHit) return null;
  if (precisionHit && precisionDistance < primaryDistance) return 'PRECISION';
  return 'PRIMARY';
};

export const advancePerfectStopRoute = (
  current: PerfectStopRouteState,
  choice: PerfectStopBeaconChoice | null,
  rating: 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS',
  roundIndex: number,
): PerfectStopRouteResolution => {
  const success = rating === 'PERFECT' || rating === 'GREAT' || rating === 'GOOD';
  if (!choice || !success) {
    return {
      state: { ...current, progress: 0 },
      choice,
      bonus: 0,
      masterCreditBonus: 0,
      completed: false,
    };
  }

  const route: PerfectStopRouteId = current.route ?? (choice === 'PRECISION' ? 'EDGE' : 'CALIBRATION');
  const expectedChoice: PerfectStopBeaconChoice = route === 'EDGE' ? 'PRECISION' : 'PRIMARY';
  const progress = choice === expectedChoice ? current.progress + 1 : 0;
  const masterCreditBonus = choice === 'PRECISION' && (rating === 'PERFECT' || rating === 'GREAT') ? 1 : 0;

  if (progress < 2) {
    return {
      state: { ...current, route, progress },
      choice,
      bonus: 0,
      masterCreditBonus,
      completed: false,
    };
  }

  const bonus = 350 + Math.min(6, roundIndex) * 80 + Math.min(4, current.completions) * 100;
  return {
    state: { route: null, progress: 0, completions: current.completions + 1 },
    choice,
    bonus,
    masterCreditBonus,
    completed: true,
  };
};

export const getPerfectStopRouteLabel = (state: PerfectStopRouteState): string =>
  state.route ? `${state.route} ROUTE • ${state.progress}/2` : 'BEACON ROUTE • CHOOSE TARGET';
