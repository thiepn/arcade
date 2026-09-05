export type ReactionCircuitChoice = 'SPEED' | 'CONTROL';

export interface ReactionCircuitState {
  choices: ReactionCircuitChoice[];
  completions: number;
}

const PAIRS: readonly (readonly [number, number])[] = [
  [2, 4],
  [3, 5],
  [6, 7],
] as const;

export const createReactionCircuitState = (): ReactionCircuitState => ({
  choices: [],
  completions: 0,
});

export const isReactionCircuitBoundary = (corePosition: number): boolean =>
  corePosition === 1 || corePosition === 3 || corePosition === 5;

export const getReactionCircuitPairIndex = (corePosition: number): number =>
  corePosition === 1 ? 0 : corePosition === 3 ? 1 : corePosition === 5 ? 2 : -1;

export const chooseReactionCircuit = (
  current: ReactionCircuitState,
  pairIndex: number,
  choice: ReactionCircuitChoice,
): ReactionCircuitState => {
  if (pairIndex < 0 || pairIndex >= PAIRS.length) return current;
  const choices = [...current.choices];
  choices[pairIndex] = choice;
  return { ...current, choices };
};

export const getReactionCoreOrder = (state: ReactionCircuitState): number[] => {
  const order = [0, 1];
  for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) {
    const pair = PAIRS[pairIndex];
    const choice = state.choices[pairIndex] ?? 'SPEED';
    if (choice === 'CONTROL') order.push(pair[1], pair[0]);
    else order.push(pair[0], pair[1]);
  }
  return order;
};

export const getReactionCircuitRoundIndex = (
  sessionPosition: number,
  state: ReactionCircuitState,
): number => {
  const order = getReactionCoreOrder(state);
  return order[Math.max(0, Math.min(order.length - 1, sessionPosition))] ?? 0;
};

export const getReactionCircuitLabel = (
  sessionPosition: number,
  state: ReactionCircuitState,
): string => {
  const pairIndex = Math.floor(Math.max(0, sessionPosition - 2) / 2);
  if (sessionPosition < 2) return 'CALIBRATION CIRCUIT';
  const choice = state.choices[Math.min(2, pairIndex)] ?? 'SPEED';
  return `${choice} CIRCUIT ${Math.min(3, pairIndex + 1)}/3`;
};

export const getReactionCircuitCompletionBonus = (
  choice: ReactionCircuitChoice,
  pairIndex: number,
  bothCorrect: boolean,
): number => {
  if (!bothCorrect || pairIndex < 0) return 0;
  return 300 + pairIndex * 120 + (choice === 'CONTROL' ? 80 : 120);
};
