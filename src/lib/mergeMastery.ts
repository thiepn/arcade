export type MergeContract =
  | { type: 'cascade'; level: number; targetCascade: number; bonus: number; label: string }
  | { type: 'value'; level: number; targetValue: number; bonus: number; label: string };

export interface MergeContractSnapshot {
  mergeStreak: number;
  highestTile: number;
}

export const getMergeContract = (level: number): MergeContract => {
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel % 2 === 1) {
    const targetCascade = Math.min(5, 2 + Math.floor((safeLevel - 1) / 2));
    return {
      type: 'cascade',
      level: safeLevel,
      targetCascade,
      bonus: 600 + safeLevel * 250,
      label: `CASCADE ${targetCascade}+`,
    };
  }

  const valueTier = Math.floor(safeLevel / 2) - 1;
  const targetValue = Math.min(2048, 32 * 2 ** valueTier);
  return {
    type: 'value',
    level: safeLevel,
    targetValue,
    bonus: 800 + safeLevel * 300,
    label: `FORGE ${targetValue}`,
  };
};

export const isMergeContractComplete = (
  contract: MergeContract,
  snapshot: MergeContractSnapshot,
): boolean => contract.type === 'cascade'
  ? snapshot.mergeStreak >= contract.targetCascade
  : snapshot.highestTile >= contract.targetValue;
