export type BladeSpawnType =
  | 'watermelon'
  | 'pineapple'
  | 'strawberry'
  | 'dragonfruit'
  | 'kiwi'
  | 'mango'
  | 'gold'
  | 'shield'
  | 'bomb';

export interface BladeWavePhrase {
  id:
    | 'clean-cuts'
    | 'crosscut-angles'
    | 'armor-break'
    | 'red-zone'
    | 'razor-window'
    | 'mixed-mastery'
    | 'neon-finale';
  label: string;
  description: string;
  minCount: number;
  maxCount: number;
  maxBombs: 0 | 1;
  weights: Partial<Record<BladeSpawnType, number>>;
}

export const BLADE_WAVES_PER_PHRASE = 3;

export const BLADE_WAVE_PHRASES: readonly BladeWavePhrase[] = [
  {
    id: 'clean-cuts',
    label: 'CLEAN CUTS',
    description: 'Readable single-hit targets establish the slice rhythm.',
    minCount: 2,
    maxCount: 3,
    maxBombs: 0,
    weights: { strawberry: 4, kiwi: 2, watermelon: 2, mango: 1 },
  },
  {
    id: 'crosscut-angles',
    label: 'CROSSCUT ANGLES',
    description: 'Mixed target values reward deliberate multi-target swipe paths.',
    minCount: 2,
    maxCount: 3,
    maxBombs: 0,
    weights: { strawberry: 2, kiwi: 2, watermelon: 2, mango: 2, dragonfruit: 1 },
  },
  {
    id: 'armor-break',
    label: 'ARMOR BREAK',
    description: 'Two-slice pineapples and shield opportunities introduce commitment.',
    minCount: 2,
    maxCount: 4,
    maxBombs: 0,
    weights: { pineapple: 4, watermelon: 2, dragonfruit: 2, shield: 1, mango: 1 },
  },
  {
    id: 'red-zone',
    label: 'RED ZONE',
    description: 'One clearly bounded bomb may share the phrase with normal targets.',
    minCount: 3,
    maxCount: 4,
    maxBombs: 1,
    weights: { bomb: 2, strawberry: 2, kiwi: 1, watermelon: 2, mango: 2, pineapple: 1 },
  },
  {
    id: 'razor-window',
    label: 'RAZOR WINDOW',
    description: 'High-value clean targets emphasize optional center-cut precision.',
    minCount: 2,
    maxCount: 4,
    maxBombs: 0,
    weights: { gold: 3, dragonfruit: 3, mango: 2, kiwi: 2, watermelon: 1 },
  },
  {
    id: 'mixed-mastery',
    label: 'MIXED MASTERY',
    description: 'Armor, precision targets, and bounded bomb pressure combine.',
    minCount: 3,
    maxCount: 4,
    maxBombs: 1,
    weights: { bomb: 1, shield: 1, pineapple: 2, gold: 2, dragonfruit: 2, mango: 2, watermelon: 1 },
  },
  {
    id: 'neon-finale',
    label: 'NEON FINALE',
    description: 'The full target vocabulary appears in a high-pressure authored phrase.',
    minCount: 3,
    maxCount: 4,
    maxBombs: 1,
    weights: { bomb: 1, shield: 1, pineapple: 2, gold: 2, dragonfruit: 2, mango: 2, kiwi: 1, watermelon: 1 },
  },
] as const;

export const getBladeWavePhraseIndex = (waveCount: number): number => {
  const block = Math.floor(Math.max(0, waveCount - 1) / BLADE_WAVES_PER_PHRASE);
  if (block < BLADE_WAVE_PHRASES.length) return block;
  // After the authored opening arc, rotate the three mastery phrases instead of
  // collapsing into one endless terminal state.
  return 4 + ((block - 4) % 3);
};

export const getBladeWavePhrase = (waveCount: number): BladeWavePhrase =>
  BLADE_WAVE_PHRASES[getBladeWavePhraseIndex(waveCount)];

export const getBladeWavePhraseStep = (waveCount: number): number =>
  ((Math.max(1, waveCount) - 1) % BLADE_WAVES_PER_PHRASE) + 1;

export const getBladeWaveCount = (phrase: BladeWavePhrase, random = Math.random): number => {
  const span = phrase.maxCount - phrase.minCount + 1;
  return phrase.minCount + Math.floor(Math.max(0, Math.min(0.999999, random())) * span);
};

export const pickBladeSpawnType = (
  phrase: BladeWavePhrase,
  options: { random?: () => number; hasShield: boolean; bombsPlaced: number },
): BladeSpawnType => {
  const random = options.random ?? Math.random;
  const weighted = Object.entries(phrase.weights)
    .map(([type, weight]) => ({ type: type as BladeSpawnType, weight: Math.max(0, weight ?? 0) }))
    .filter(({ type, weight }) => {
      if (weight <= 0) return false;
      if (type === 'bomb' && options.bombsPlaced >= phrase.maxBombs) return false;
      if (type === 'shield' && options.hasShield) return false;
      return true;
    });

  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return 'strawberry';

  let cursor = Math.max(0, Math.min(0.999999, random())) * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.type;
  }
  return weighted[weighted.length - 1]?.type ?? 'strawberry';
};
