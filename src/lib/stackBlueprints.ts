export type StackPlacementClass =
  | 'CENTERED'
  | 'LEFT_OFFSET'
  | 'RIGHT_OFFSET'
  | 'NARROW_OVERLAP'
  | 'PERFECT'
  | 'FOCUS_PERFECT';

export type StackBlueprintBranch = 'LEFT' | 'RIGHT' | null;

export interface StackBlueprintDefinition {
  id: string;
  label: string;
  steps: readonly StackPlacementClass[];
  branchable?: boolean;
}

export interface StackBlueprintState {
  blueprintIndex: number;
  step: number;
  branch: StackBlueprintBranch;
  completions: number;
}

export const STACK_BLUEPRINTS: readonly StackBlueprintDefinition[] = [
  { id: 'centerline', label: 'CENTERLINE', steps: ['CENTERED', 'PERFECT', 'CENTERED'] },
  { id: 'offset', label: 'OFFSET', steps: ['LEFT_OFFSET', 'RIGHT_OFFSET', 'CENTERED'], branchable: true },
  { id: 'bridge', label: 'BRIDGE', steps: ['LEFT_OFFSET', 'LEFT_OFFSET', 'RIGHT_OFFSET'], branchable: true },
  { id: 'focus', label: 'FOCUS SPIRE', steps: ['CENTERED', 'FOCUS_PERFECT', 'PERFECT'] },
  { id: 'skyline', label: 'SKYLINE', steps: ['RIGHT_OFFSET', 'CENTERED', 'PERFECT'], branchable: true },
] as const;

export const createStackBlueprintState = (): StackBlueprintState => ({
  blueprintIndex: 0,
  step: 0,
  branch: null,
  completions: 0,
});

export const classifyStackPlacement = (
  diffPx: number,
  currentWidth: number,
  overlapWidth: number,
  perfect: boolean,
  focusAttempt: boolean,
): StackPlacementClass => {
  if (perfect && focusAttempt) return 'FOCUS_PERFECT';
  if (perfect) return 'PERFECT';
  const absDiff = Math.abs(diffPx);
  if (absDiff <= Math.max(6, currentWidth * 0.045)) return 'CENTERED';
  if (overlapWidth / Math.max(1, currentWidth) < 0.72) return 'NARROW_OVERLAP';
  return diffPx < 0 ? 'LEFT_OFFSET' : 'RIGHT_OFFSET';
};

export const getStackBlueprint = (state: StackBlueprintState): StackBlueprintDefinition =>
  STACK_BLUEPRINTS[state.blueprintIndex % STACK_BLUEPRINTS.length] ?? STACK_BLUEPRINTS[0];

const mirrorPlacement = (placement: StackPlacementClass): StackPlacementClass => {
  if (placement === 'LEFT_OFFSET') return 'RIGHT_OFFSET';
  if (placement === 'RIGHT_OFFSET') return 'LEFT_OFFSET';
  return placement;
};

export const getStackBlueprintExpectedPlacement = (state: StackBlueprintState): StackPlacementClass => {
  const blueprint = getStackBlueprint(state);
  let expected = blueprint.steps[Math.min(blueprint.steps.length - 1, state.step)] ?? 'CENTERED';
  if (blueprint.branchable && state.branch === 'RIGHT') expected = mirrorPlacement(expected);
  return expected;
};

export const getStackBlueprintLabel = (state: StackBlueprintState): string => {
  const blueprint = getStackBlueprint(state);
  const branch = state.branch ? ` • ${state.branch}` : '';
  return `${blueprint.label}${branch} • ${Math.min(blueprint.steps.length, state.step + 1)}/${blueprint.steps.length}`;
};

export const advanceStackBlueprint = (
  current: StackBlueprintState,
  placement: StackPlacementClass,
  towerBlocks: number,
): { state: StackBlueprintState; progressed: boolean; completed: boolean; bonus: number } => {
  const blueprint = getStackBlueprint(current);
  let state = { ...current };

  if (blueprint.branchable && state.step === 0 && state.branch === null) {
    if (placement === 'LEFT_OFFSET') state.branch = 'LEFT';
    else if (placement === 'RIGHT_OFFSET') state.branch = 'RIGHT';
  }

  const expected = getStackBlueprintExpectedPlacement(state);
  const compatibleCentered = expected === 'CENTERED' && (placement === 'CENTERED' || placement === 'PERFECT' || placement === 'FOCUS_PERFECT');
  const compatiblePerfect = expected === 'PERFECT' && (placement === 'PERFECT' || placement === 'FOCUS_PERFECT');
  if (placement !== expected && !compatibleCentered && !compatiblePerfect) {
    return { state: { ...state, step: 0, branch: null }, progressed: false, completed: false, bonus: 0 };
  }

  state.step += 1;
  if (state.step < blueprint.steps.length) {
    return { state, progressed: true, completed: false, bonus: 0 };
  }

  const altitudeBonus = Math.min(4, Math.floor(Math.max(0, towerBlocks - 1) / 10));
  const bonus = 3 + altitudeBonus + Math.min(3, current.completions);
  return {
    state: {
      blueprintIndex: (current.blueprintIndex + 1) % STACK_BLUEPRINTS.length,
      step: 0,
      branch: null,
      completions: current.completions + 1,
    },
    progressed: true,
    completed: true,
    bonus,
  };
};
