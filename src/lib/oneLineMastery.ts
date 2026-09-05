export interface OneLineMasteryGoal {
  label: string;
  minStars: number;
  minInkRemainingPercent: number;
}

export const ONE_LINE_MASTERY_GOALS: readonly OneLineMasteryGoal[] = [
  {
    label: 'STAR ROUTE',
    minStars: 2,
    minInkRemainingPercent: 20,
  },
  {
    label: 'INK SAVER',
    minStars: 1,
    minInkRemainingPercent: 35,
  },
  {
    label: 'MASTER LINE',
    minStars: 3,
    minInkRemainingPercent: 15,
  },
] as const;

export const ONE_LINE_MASTERY_TIER_SIZE = 3;
export const ONE_LINE_MASTERY_MAX_INK_TARGET = 40;

export const getOneLineMasteryTier = (level: number): number =>
  Math.floor((Math.max(1, Math.floor(level)) - 1) / ONE_LINE_MASTERY_TIER_SIZE) + 1;

export const getOneLineMasteryGoal = (level: number): OneLineMasteryGoal => {
  const safeLevel = Math.max(1, Math.floor(level));
  const base = ONE_LINE_MASTERY_GOALS[(safeLevel - 1) % ONE_LINE_MASTERY_GOALS.length];
  const tier = getOneLineMasteryTier(safeLevel);
  // P21 preserves the three existing mastery identities while making later
  // three-stage cycles ask for progressively cleaner lines. Ordinary portal
  // clears remain unchanged; only the optional efficiency target tightens.
  const inkTightening = Math.min(10, (tier - 1) * 2);
  return {
    ...base,
    minInkRemainingPercent: Math.min(
      ONE_LINE_MASTERY_MAX_INK_TARGET,
      base.minInkRemainingPercent + inkTightening,
    ),
  };
};

export const getOneLineInkRemainingPercent = (
  usedInk: number,
  inkBudget: number,
): number => {
  const safeBudget = Math.max(1, inkBudget);
  const remaining = Math.max(0, safeBudget - Math.max(0, usedInk));
  return Math.max(0, Math.min(100, Math.round((remaining / safeBudget) * 100)));
};

export const isOneLineMasteryClear = (
  goal: OneLineMasteryGoal,
  stars: number,
  inkRemainingPercent: number,
): boolean =>
  Math.max(0, Math.floor(stars)) >= goal.minStars &&
  Math.max(0, Math.floor(inkRemainingPercent)) >= goal.minInkRemainingPercent;

export const getOneLineMasteryReward = (level: number, streak: number): number => {
  const safeLevel = Math.max(1, Math.floor(level));
  const safeStreak = Math.max(1, Math.floor(streak));
  const streakMultiplier = 1 + Math.min(4, safeStreak - 1) * 0.2;
  const tierMultiplier = 1 + Math.min(0.3, (getOneLineMasteryTier(safeLevel) - 1) * 0.05);
  return Math.round((1200 + safeLevel * 250) * streakMultiplier * tierMultiplier);
};
