export type ChainResonanceTool = 'plasma' | 'tesla' | 'cryo';

export interface ChainResonanceOrder {
  name: string;
  order: readonly [ChainResonanceTool, ChainResonanceTool, ChainResonanceTool];
}

export const CHAIN_RESONANCE_ORDERS: readonly ChainResonanceOrder[] = [
  { name: 'BREACH ARC', order: ['cryo', 'tesla', 'plasma'] },
  { name: 'FUSION LINE', order: ['tesla', 'plasma', 'cryo'] },
  { name: 'VOID LATTICE', order: ['plasma', 'cryo', 'tesla'] },
] as const;

export const getChainResonanceOrder = (wave: number): ChainResonanceOrder =>
  CHAIN_RESONANCE_ORDERS[(Math.max(1, wave) - 1) % CHAIN_RESONANCE_ORDERS.length];

export interface ChainResonanceProgress {
  step: number;
  failed: boolean;
}

export const advanceChainResonance = (
  wave: number,
  current: ChainResonanceProgress,
  tool: ChainResonanceTool,
): ChainResonanceProgress => {
  if (current.failed || current.step >= 3) return current;
  const expected = getChainResonanceOrder(wave).order[current.step];
  if (tool !== expected) return { step: current.step, failed: true };
  return { step: current.step + 1, failed: false };
};

export const isChainResonanceComplete = (progress: ChainResonanceProgress): boolean =>
  !progress.failed && progress.step === 3;

export const getChainResonanceBonus = (resonanceChain: number): number =>
  900 * Math.min(5, Math.max(1, resonanceChain));

export const formatChainResonanceTool = (tool: ChainResonanceTool): string =>
  tool.toUpperCase();
