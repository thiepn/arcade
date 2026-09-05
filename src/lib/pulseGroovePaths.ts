export type PulseGroovePathId = 'FLOW' | 'DRIVE' | 'ECHO' | 'REDLINE';
export type PulseGroovePathChoice = 'LEFT' | 'RIGHT';

export interface PulseGroovePathState {
  pathIndex: number;
  step: number;
  queuedChoice: PulseGroovePathChoice | null;
  completions: number;
}

export interface PulseGroovePathDefinition {
  id: PulseGroovePathId;
  label: string;
  patternIndices: readonly number[];
}

export const PULSE_GROOVE_PATHS: readonly PulseGroovePathDefinition[] = [
  { id: 'FLOW', label: 'FLOW PATH', patternIndices: [0, 1, 2, 4] },
  { id: 'DRIVE', label: 'DRIVE PATH', patternIndices: [3, 1, 5, 4] },
  { id: 'ECHO', label: 'ECHO PATH', patternIndices: [4, 2, 1, 0] },
  { id: 'REDLINE', label: 'REDLINE PATH', patternIndices: [3, 5, 4, 5] },
] as const;

export const createPulseGroovePathState = (): PulseGroovePathState => ({
  pathIndex: 0,
  step: 0,
  queuedChoice: null,
  completions: 0,
});

export const queuePulseGroovePathChoice = (
  current: PulseGroovePathState,
  choice: PulseGroovePathChoice,
): PulseGroovePathState => ({ ...current, queuedChoice: choice });

export const getPulseGroovePath = (state: PulseGroovePathState): PulseGroovePathDefinition =>
  PULSE_GROOVE_PATHS[state.pathIndex % PULSE_GROOVE_PATHS.length] ?? PULSE_GROOVE_PATHS[0];

export const getPulseGroovePatternIndex = (state: PulseGroovePathState): number => {
  const path = getPulseGroovePath(state);
  return path.patternIndices[Math.min(path.patternIndices.length - 1, state.step)] ?? 0;
};

export const getPulseGroovePathLabel = (state: PulseGroovePathState): string => {
  const path = getPulseGroovePath(state);
  return `${path.label} • ${Math.min(path.patternIndices.length, state.step + 1)}/${path.patternIndices.length}`;
};

export const advancePulseGroovePath = (
  current: PulseGroovePathState,
  combo: number,
  wagerSuccess: boolean,
): { state: PulseGroovePathState; completed: boolean; bonus: number } => {
  const path = getPulseGroovePath(current);
  const nextStep = current.step + 1;
  if (nextStep < path.patternIndices.length) {
    return { state: { ...current, step: nextStep }, completed: false, bonus: 0 };
  }

  const choice = current.queuedChoice;
  const offset = choice === 'RIGHT' ? 2 : 1;
  const nextPathIndex = (current.pathIndex + offset) % PULSE_GROOVE_PATHS.length;
  const bonus = 350 + Math.min(12, Math.max(0, combo)) * 30 + (wagerSuccess ? 250 : 0);
  return {
    state: {
      pathIndex: nextPathIndex,
      step: 0,
      queuedChoice: null,
      completions: current.completions + 1,
    },
    completed: true,
    bonus,
  };
};

export const getPulseQueuedPathLabel = (state: PulseGroovePathState): string => {
  if (!state.queuedChoice) return 'A/← LEFT • D/→ RIGHT';
  const offset = state.queuedChoice === 'RIGHT' ? 2 : 1;
  const next = PULSE_GROOVE_PATHS[(state.pathIndex + offset) % PULSE_GROOVE_PATHS.length];
  return `NEXT: ${next?.label ?? 'FLOW PATH'}`;
};
