export type GravityFlightContractId =
  | 'star-sweep'
  | 'thrift-vector'
  | 'polarity-run'
  | 'clean-vector'
  | 'ace-transit';

export interface GravityFlightStats {
  stars: number;
  boostsUsed: number;
  flipsUsed: number;
  recallsUsed: number;
}

export interface GravityFlightContract {
  id: GravityFlightContractId;
  label: string;
  detail: string;
  minStars: number;
  maxBoosts?: number;
  minFlips?: number;
  maxRecalls?: number;
}

export const GRAVITY_FLIGHT_CONTRACTS: readonly GravityFlightContract[] = [
  {
    id: 'star-sweep',
    label: 'STAR SWEEP',
    detail: 'Collect all 3 stars before warping.',
    minStars: 3,
  },
  {
    id: 'thrift-vector',
    label: 'THRIFT VECTOR',
    detail: 'Collect 2+ stars using at most 1 boost.',
    minStars: 2,
    maxBoosts: 1,
  },
  {
    id: 'polarity-run',
    label: 'POLARITY RUN',
    detail: 'Collect 2+ stars and flip gravity at least once.',
    minStars: 2,
    minFlips: 1,
  },
  {
    id: 'clean-vector',
    label: 'CLEAN VECTOR',
    detail: 'Collect 2+ stars without recalling the probe.',
    minStars: 2,
    maxRecalls: 0,
  },
  {
    id: 'ace-transit',
    label: 'ACE TRANSIT',
    detail: 'Collect all 3 stars, use at most 2 boosts, and never recall.',
    minStars: 3,
    maxBoosts: 2,
    maxRecalls: 0,
  },
] as const;

export const getGravityFlightContract = (level: number): GravityFlightContract => {
  const index = Math.max(0, Math.min(GRAVITY_FLIGHT_CONTRACTS.length - 1, Math.floor(level) - 1));
  return GRAVITY_FLIGHT_CONTRACTS[index];
};

export const isGravityFlightContractComplete = (
  contract: GravityFlightContract,
  stats: GravityFlightStats,
): boolean => {
  if (stats.stars < contract.minStars) return false;
  if (contract.maxBoosts !== undefined && stats.boostsUsed > contract.maxBoosts) return false;
  if (contract.minFlips !== undefined && stats.flipsUsed < contract.minFlips) return false;
  if (contract.maxRecalls !== undefined && stats.recallsUsed > contract.maxRecalls) return false;
  return true;
};

export const getGravityFlightContractBonus = (level: number, streak: number): number => {
  const safeLevel = Math.max(1, Math.min(5, Math.floor(level)));
  const safeStreak = Math.max(1, Math.min(5, Math.floor(streak)));
  return 500 + safeLevel * 200 + safeStreak * 300;
};
