export type TypeRushRelayWordType = 'standard' | 'bomb' | 'freeze' | 'hyper';
export type TypeRushRelayBranch = 'CONTROL' | 'VOLATILE';
export type TypeRushRelayRequirement = 'STANDARD' | 'SPECIAL' | 'URGENT' | 'RISK';

export interface TypeRushRelayEvent {
  yPercent: number;
  type: TypeRushRelayWordType;
}

export interface TypeRushRelayState {
  waveIndex: number;
  relayIndex: number;
  step: number;
  branch: TypeRushRelayBranch | null;
  completions: number;
}

export interface TypeRushRelayResult {
  state: TypeRushRelayState;
  progressed: boolean;
  completed: boolean;
  bonus: number;
}

const RELAY_NAMES = [
  ['BOOT SEQUENCE', 'SIGNAL CHECK'],
  ['SURGE ROUTE', 'PRIORITY SHIFT'],
  ['OVERCLOCK CHAIN', 'SPECIAL VECTOR'],
  ['REDLINE RELAY', 'CRITICAL PATH'],
] as const;

const CONTROL_REQUIREMENTS: readonly TypeRushRelayRequirement[] = ['STANDARD', 'URGENT', 'SPECIAL'];
const VOLATILE_REQUIREMENTS: readonly TypeRushRelayRequirement[] = ['SPECIAL', 'RISK', 'URGENT'];

export const createTypeRushRelayState = (waveIndex = 0): TypeRushRelayState => ({
  waveIndex: Math.max(0, Math.min(3, Math.floor(waveIndex))),
  relayIndex: 0,
  step: 0,
  branch: null,
  completions: 0,
});

export const syncTypeRushRelayWave = (
  state: TypeRushRelayState,
  waveIndex: number,
): TypeRushRelayState => {
  const normalized = Math.max(0, Math.min(3, Math.floor(waveIndex)));
  if (normalized === state.waveIndex) return state;
  return {
    waveIndex: normalized,
    relayIndex: state.relayIndex % 2,
    step: 0,
    branch: null,
    completions: state.completions,
  };
};

export const getTypeRushRelayName = (state: TypeRushRelayState): string =>
  RELAY_NAMES[state.waveIndex]?.[state.relayIndex % 2] ?? RELAY_NAMES[0][0];

export const getTypeRushRelayRequirements = (
  branch: TypeRushRelayBranch | null,
): readonly TypeRushRelayRequirement[] =>
  branch === 'VOLATILE' ? VOLATILE_REQUIREMENTS : CONTROL_REQUIREMENTS;

export const getTypeRushRelayRequirement = (state: TypeRushRelayState): TypeRushRelayRequirement =>
  getTypeRushRelayRequirements(state.branch)[Math.min(2, state.step)] ?? 'STANDARD';

export const getTypeRushRelayStepLabel = (state: TypeRushRelayState): string => {
  if (!state.branch) return 'CHOOSE CONTROL OR VOLATILE TARGET';
  const requirement = getTypeRushRelayRequirement(state);
  return `${state.branch} • ${requirement} • ${Math.min(3, state.step + 1)}/3`;
};

const matchesRequirement = (
  requirement: TypeRushRelayRequirement,
  event: TypeRushRelayEvent,
): boolean => {
  if (requirement === 'STANDARD') return event.type === 'standard';
  if (requirement === 'SPECIAL') return event.type !== 'standard';
  if (requirement === 'URGENT') return event.yPercent >= 58;
  return event.yPercent >= 68 || event.type === 'bomb' || event.type === 'hyper';
};

export const advanceTypeRushRelay = (
  current: TypeRushRelayState,
  event: TypeRushRelayEvent,
): TypeRushRelayResult => {
  let state = { ...current };
  if (!state.branch) {
    state.branch = event.type !== 'standard' || event.yPercent >= 62 ? 'VOLATILE' : 'CONTROL';
  }

  const requirement = getTypeRushRelayRequirement(state);
  if (!matchesRequirement(requirement, event)) {
    return { state, progressed: false, completed: false, bonus: 0 };
  }

  state.step += 1;
  if (state.step < 3) {
    return { state, progressed: true, completed: false, bonus: 0 };
  }

  const bonus = 300 + state.waveIndex * 180 + Math.min(5, state.completions) * 60;
  state = {
    waveIndex: state.waveIndex,
    relayIndex: (state.relayIndex + 1) % 2,
    step: 0,
    branch: null,
    completions: state.completions + 1,
  };
  return { state, progressed: true, completed: true, bonus };
};
