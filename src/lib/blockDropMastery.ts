export type BlockDropPiece = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

export const BLOCK_DROP_PIECES: readonly BlockDropPiece[] = [
  'I', 'J', 'L', 'O', 'S', 'T', 'Z',
];

export const createBlockDropBag = (
  random: () => number = Math.random,
): BlockDropPiece[] => {
  const bag = [...BLOCK_DROP_PIECES];
  for (let index = bag.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }
  return bag;
};

export const drawBlockDropBagPiece = (
  bag: BlockDropPiece[],
  random: () => number = Math.random,
): BlockDropPiece => {
  if (bag.length === 0) bag.push(...createBlockDropBag(random));
  return bag.shift()!;
};

export interface BlockDropLineMasteryResult {
  clearChain: number;
  backToBack: boolean;
  comboBonus: number;
  backToBackBonus: number;
  masteryBonus: number;
}

export const resolveBlockDropLineMastery = ({
  clearedLines,
  level,
  clearChain,
  backToBack,
}: {
  clearedLines: number;
  level: number;
  clearChain: number;
  backToBack: boolean;
}): BlockDropLineMasteryResult => {
  if (clearedLines <= 0) {
    return {
      clearChain: 0,
      backToBack,
      comboBonus: 0,
      backToBackBonus: 0,
      masteryBonus: 0,
    };
  }

  const nextChain = clearChain + 1;
  const comboBonus = Math.max(0, nextChain - 1) * 50 * Math.max(1, level);
  const isTetris = clearedLines === 4;
  const backToBackBonus = isTetris && backToBack ? 500 * Math.max(1, level) : 0;

  return {
    clearChain: nextChain,
    backToBack: isTetris,
    comboBonus,
    backToBackBonus,
    masteryBonus: comboBonus + backToBackBonus,
  };
};
