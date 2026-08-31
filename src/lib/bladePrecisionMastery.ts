export const BLADE_PRECISION_RATIO = 0.32;
export const BLADE_PRECISION_CHAIN_CAP = 8;

export interface BladePrecisionOutcome {
  precise: boolean;
  chain: number;
  bonus: number;
  razorRush: boolean;
}

export const isBladePrecisionSlice = (distanceFromCenter: number, radius: number) =>
  radius > 0 && distanceFromCenter <= radius * BLADE_PRECISION_RATIO;

export const resolveBladePrecisionSlice = (
  distanceFromCenter: number,
  radius: number,
  currentChain: number,
): BladePrecisionOutcome => {
  if (!isBladePrecisionSlice(distanceFromCenter, radius)) {
    return { precise: false, chain: 0, bonus: 0, razorRush: false };
  }

  const rawChain = currentChain + 1;
  const chain = Math.min(BLADE_PRECISION_CHAIN_CAP, rawChain);
  const razorRush = rawChain === 4 || rawChain === 8;
  const bonus = 75 * chain + (razorRush ? 300 : 0);
  return { precise: true, chain, bonus, razorRush };
};
