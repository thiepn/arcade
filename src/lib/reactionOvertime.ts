import type { ReactionRoundConfig } from './reactionGameplay';

export const REACTION_OVERTIME_CORRECT_REQUIRED = 6;
export const REACTION_OVERTIME_MAX_MISTAKES = 2;

export const REACTION_OVERTIME_ROUNDS: readonly ReactionRoundConfig[] = [
  {
    kind: 'choice',
    label: 'OVERCLOCK CHOICE',
    hint: 'Overtime begins. Read the side cue before committing.',
    waitMinMs: 280,
    waitMaxMs: 660,
    decoyMs: 0,
    scoreMultiplier: 2.05,
  },
  {
    kind: 'inhibit',
    label: 'RED HOLD',
    hint: 'The decoy window is tighter. Hold discipline, then strike.',
    waitMinMs: 270,
    waitMaxMs: 620,
    decoyMs: 330,
    scoreMultiplier: 2.25,
  },
  {
    kind: 'mixed',
    label: 'NEURAL FINAL',
    hint: 'Final overtime: resist the fake signal and answer the side cue.',
    waitMinMs: 260,
    waitMaxMs: 580,
    decoyMs: 320,
    scoreMultiplier: 2.6,
  },
] as const;

export const isReactionOvertimeUnlocked = (
  correctAttempts: number,
  mistakes: number,
): boolean =>
  correctAttempts >= REACTION_OVERTIME_CORRECT_REQUIRED &&
  mistakes <= REACTION_OVERTIME_MAX_MISTAKES;
