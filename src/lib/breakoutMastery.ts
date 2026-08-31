export type BreakoutContractKind =
  | 'COMBO_DRIVE'
  | 'POWER_BANK'
  | 'ARMOR_BREAK'
  | 'SPECIAL_HUNT';

export type BreakoutContractEvent = 'COMBO' | 'POWER' | 'ARMORED' | 'SPECIAL';

export interface BreakoutContract {
  kind: BreakoutContractKind;
  label: string;
  hint: string;
  target: number;
}

export const BREAKOUT_CONTRACTS: readonly BreakoutContract[] = [
  {
    kind: 'COMBO_DRIVE',
    label: 'COMBO DRIVE',
    hint: 'Reach a 6-hit brick combo before the next paddle touch.',
    target: 6,
  },
  {
    kind: 'POWER_BANK',
    label: 'POWER BANK',
    hint: 'Catch two marked brick drops this round.',
    target: 2,
  },
  {
    kind: 'ARMOR_BREAK',
    label: 'ARMOR BREAK',
    hint: 'Destroy three multi-hit armored bricks.',
    target: 3,
  },
  {
    kind: 'SPECIAL_HUNT',
    label: 'SPECIAL HUNT',
    hint: 'Destroy three marked power bricks.',
    target: 3,
  },
] as const;

export const getBreakoutContract = (round: number): BreakoutContract => {
  const safeRound = Math.max(1, Math.floor(round));
  return BREAKOUT_CONTRACTS[(safeRound - 1) % BREAKOUT_CONTRACTS.length];
};

export const advanceBreakoutContractProgress = (
  contract: BreakoutContract,
  currentProgress: number,
  event: BreakoutContractEvent,
  value = 1,
): number => {
  const current = Math.max(0, Math.floor(currentProgress));
  let next = current;

  if (contract.kind === 'COMBO_DRIVE' && event === 'COMBO') {
    next = Math.max(current, Math.max(0, Math.floor(value)));
  } else if (contract.kind === 'POWER_BANK' && event === 'POWER') {
    next = current + Math.max(0, Math.floor(value));
  } else if (contract.kind === 'ARMOR_BREAK' && event === 'ARMORED') {
    next = current + Math.max(0, Math.floor(value));
  } else if (contract.kind === 'SPECIAL_HUNT' && event === 'SPECIAL') {
    next = current + Math.max(0, Math.floor(value));
  }

  return Math.min(contract.target, next);
};

export const isBreakoutContractComplete = (
  contract: BreakoutContract,
  progress: number,
): boolean => progress >= contract.target;

export const getBreakoutContractReward = (round: number, streak: number): number => {
  const safeRound = Math.max(1, Math.floor(round));
  const safeStreak = Math.max(1, Math.floor(streak));
  const streakMultiplier = 1 + Math.min(4, safeStreak - 1) * 0.2;
  return Math.round((1000 + safeRound * 300) * streakMultiplier);
};
