export type ReactionRoundKind = 'simple' | 'choice' | 'inhibit' | 'mixed';
export type ReactionChoice = 'LEFT' | 'RIGHT';

export interface ReactionRoundConfig {
  kind: ReactionRoundKind;
  label: string;
  hint: string;
  waitMinMs: number;
  waitMaxMs: number;
  decoyMs: number;
  scoreMultiplier: number;
}

export interface ReactionAttemptScore {
  points: number;
  grade: 'LIGHTNING' | 'SHARP' | 'SOLID' | 'LATE';
}

export const REACTION_ROUNDS: ReactionRoundConfig[] = [
  {
    kind: 'simple',
    label: 'GREEN LIGHT',
    hint: 'Wait for green, then react immediately.',
    waitMinMs: 650,
    waitMaxMs: 1450,
    decoyMs: 0,
    scoreMultiplier: 1,
  },
  {
    kind: 'simple',
    label: 'QUICK DRAW',
    hint: 'Same rule, shorter uncertainty window.',
    waitMinMs: 450,
    waitMaxMs: 1150,
    decoyMs: 0,
    scoreMultiplier: 1.1,
  },
  {
    kind: 'choice',
    label: 'LEFT / RIGHT',
    hint: 'React to the arrow. Tap the matching side or use A/D.',
    waitMinMs: 550,
    waitMaxMs: 1300,
    decoyMs: 0,
    scoreMultiplier: 1.2,
  },
  {
    kind: 'choice',
    label: 'CHOICE RUSH',
    hint: 'The target side is unpredictable. Read first, then move.',
    waitMinMs: 400,
    waitMaxMs: 1050,
    decoyMs: 0,
    scoreMultiplier: 1.3,
  },
  {
    kind: 'inhibit',
    label: 'NO-GO',
    hint: 'Ignore the red HOLD decoy. React only when green appears.',
    waitMinMs: 450,
    waitMaxMs: 1000,
    decoyMs: 430,
    scoreMultiplier: 1.35,
  },
  {
    kind: 'mixed',
    label: 'HOLD + CHOOSE',
    hint: 'Ignore the decoy, then answer the left/right cue.',
    waitMinMs: 350,
    waitMaxMs: 900,
    decoyMs: 390,
    scoreMultiplier: 1.5,
  },
  {
    kind: 'choice',
    label: 'FAST CHOICE',
    hint: 'A tighter launch delay makes anticipation dangerous.',
    waitMinMs: 300,
    waitMaxMs: 800,
    decoyMs: 0,
    scoreMultiplier: 1.55,
  },
  {
    kind: 'mixed',
    label: 'FINAL MIX',
    hint: 'Hold through the fake signal, then make the correct choice.',
    waitMinMs: 280,
    waitMaxMs: 720,
    decoyMs: 360,
    scoreMultiplier: 1.8,
  },
];

const SCORE_BASE: Record<ReactionRoundKind, { base: number; decay: number }> = {
  simple: { base: 1400, decay: 2.45 },
  choice: { base: 1680, decay: 1.85 },
  inhibit: { base: 1580, decay: 2.05 },
  mixed: { base: 1900, decay: 1.72 },
};

const GRADE_THRESHOLDS: Record<ReactionRoundKind, [number, number, number]> = {
  simple: [210, 285, 390],
  choice: [320, 430, 560],
  inhibit: [265, 350, 470],
  mixed: [365, 485, 625],
};

export const scoreReactionAttempt = (
  config: ReactionRoundConfig,
  reactionTimeMs: number,
  correct: boolean,
): ReactionAttemptScore => {
  const [lightning, sharp, solid] = GRADE_THRESHOLDS[config.kind];
  const grade = reactionTimeMs <= lightning
    ? 'LIGHTNING'
    : reactionTimeMs <= sharp
      ? 'SHARP'
      : reactionTimeMs <= solid
        ? 'SOLID'
        : 'LATE';

  if (!correct || !Number.isFinite(reactionTimeMs) || reactionTimeMs < 0) {
    return { points: 0, grade };
  }

  const scoring = SCORE_BASE[config.kind];
  const raw = Math.max(100, scoring.base - reactionTimeMs * scoring.decay);
  return {
    points: Math.max(0, Math.round(raw * config.scoreMultiplier)),
    grade,
  };
};

export const requiresChoice = (kind: ReactionRoundKind) => kind === 'choice' || kind === 'mixed';
export const usesInhibitionDecoy = (kind: ReactionRoundKind) => kind === 'inhibit' || kind === 'mixed';
