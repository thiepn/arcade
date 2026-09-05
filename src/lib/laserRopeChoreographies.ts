export type LaserRopeMode = 'LOW' | 'HIGH' | 'DUAL';

export interface LaserRopeChoreography {
  id: string;
  label: string;
  modes: readonly LaserRopeMode[];
}

export interface LaserRopeChoreographyState {
  choreographyIndex: number;
  step: number;
  completions: number;
}

export const LASER_ROPE_CHOREOGRAPHIES: readonly LaserRopeChoreography[] = [
  { id: 'cross-step', label: 'CROSS STEP', modes: ['LOW', 'HIGH', 'LOW', 'HIGH'] },
  { id: 'double-cut', label: 'DOUBLE CUT', modes: ['HIGH', 'DUAL', 'LOW', 'HIGH'] },
  { id: 'switchback', label: 'SWITCHBACK', modes: ['LOW', 'DUAL', 'HIGH', 'LOW'] },
  { id: 'red-zone', label: 'RED ZONE', modes: ['DUAL', 'LOW', 'DUAL', 'HIGH'] },
] as const;

export const createLaserRopeChoreographyState = (): LaserRopeChoreographyState => ({
  choreographyIndex: 0,
  step: 0,
  completions: 0,
});

export const getLaserRopeChoreography = (
  state: LaserRopeChoreographyState,
): LaserRopeChoreography =>
  LASER_ROPE_CHOREOGRAPHIES[state.choreographyIndex % LASER_ROPE_CHOREOGRAPHIES.length]
    ?? LASER_ROPE_CHOREOGRAPHIES[0];

export const getLaserRopeDesiredMode = (state: LaserRopeChoreographyState): LaserRopeMode => {
  const choreography = getLaserRopeChoreography(state);
  return choreography.modes[Math.min(choreography.modes.length - 1, state.step)] ?? 'LOW';
};

export const getLaserRopeChoreographyLabel = (state: LaserRopeChoreographyState): string => {
  const choreography = getLaserRopeChoreography(state);
  return `${choreography.label} • ${Math.min(choreography.modes.length, state.step + 1)}/${choreography.modes.length}`;
};

export const advanceLaserRopeChoreography = (
  current: LaserRopeChoreographyState,
  clearedMode: LaserRopeMode,
  redlineActive: boolean,
  jumpStreak: number,
): { state: LaserRopeChoreographyState; progressed: boolean; completed: boolean; bonus: number } => {
  const expected = getLaserRopeDesiredMode(current);
  if (clearedMode !== expected) {
    return { state: { ...current, step: 0 }, progressed: false, completed: false, bonus: 0 };
  }

  const choreography = getLaserRopeChoreography(current);
  const nextStep = current.step + 1;
  if (nextStep < choreography.modes.length) {
    return { state: { ...current, step: nextStep }, progressed: true, completed: false, bonus: 0 };
  }

  const bonus = 500 + Math.min(20, jumpStreak) * 20 + (redlineActive ? 300 : 0);
  return {
    state: {
      choreographyIndex: (current.choreographyIndex + 1) % LASER_ROPE_CHOREOGRAPHIES.length,
      step: 0,
      completions: current.completions + 1,
    },
    progressed: true,
    completed: true,
    bonus,
  };
};
