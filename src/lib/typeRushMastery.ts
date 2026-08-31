export interface TypeRushSpecialWeight {
  bomb: number;
  freeze: number;
  hyper: number;
}

const DIRECTIVES = [
  'LOCK & CLEAR',
  'SPECIAL HUNT',
  'URGENT FIRST',
  'RISK = REWARD',
] as const;

const SPECIAL_WEIGHTS: readonly TypeRushSpecialWeight[] = [
  { bomb: 0.10, freeze: 0.18, hyper: 0.26 },
  { bomb: 0.12, freeze: 0.22, hyper: 0.34 },
  { bomb: 0.13, freeze: 0.25, hyper: 0.40 },
  { bomb: 0.14, freeze: 0.28, hyper: 0.46 },
] as const;

export const getTypeRushDirective = (waveIndex: number): string =>
  DIRECTIVES[Math.max(0, Math.min(DIRECTIVES.length - 1, Math.floor(waveIndex)))] ?? DIRECTIVES[0];

export const getTypeRushSpecialWeight = (waveIndex: number): TypeRushSpecialWeight =>
  SPECIAL_WEIGHTS[Math.max(0, Math.min(SPECIAL_WEIGHTS.length - 1, Math.floor(waveIndex)))] ?? SPECIAL_WEIGHTS[0];

export const getTypeRushTargetBonus = (
  yPercent: number,
  type: 'standard' | 'bomb' | 'freeze' | 'hyper',
  waveIndex: number,
): number => {
  let bonus = 1 + Math.max(0, Math.min(3, Math.floor(waveIndex))) * 0.05;
  if (yPercent >= 70) bonus += 0.5;
  else if (yPercent >= 50) bonus += 0.25;

  if (type === 'bomb') bonus += 0.2;
  else if (type === 'freeze') bonus += 0.1;
  else if (type === 'hyper') bonus += 0.3;

  return Math.min(2, Number(bonus.toFixed(2)));
};
