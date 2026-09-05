import {
  getOrbitConstellationClearBonus,
  getOrbitConstellationFormationName,
} from './orbitConstellationMastery';

export interface OrbitThreatTarget {
  lane: 0 | 1 | 2;
  leadRadians: number;
}

export interface OrbitThreatFormation {
  name: 'SWEEP' | 'PINCH' | 'INNER BREAK' | 'CROSSWIND';
  safeLane: 0 | 1 | 2;
  targets: readonly OrbitThreatTarget[];
}

export const ORBIT_FORMATION_WARNING_SEC = 1.2;
export const ORBIT_FORMATION_COOLDOWN_SEC = 7.2;
export const ORBIT_FORMATION_RESOLVE_SEC = 1.7;
export const ORBIT_FORMATION_GRACE_SEC = 2.0;

export const ORBIT_THREAT_FORMATIONS: readonly OrbitThreatFormation[] = [
  {
    name: 'SWEEP',
    safeLane: 2,
    targets: [
      { lane: 0, leadRadians: 0.58 },
      { lane: 1, leadRadians: 0.92 },
    ],
  },
  {
    name: 'PINCH',
    safeLane: 1,
    targets: [
      { lane: 0, leadRadians: 0.72 },
      { lane: 2, leadRadians: 0.72 },
    ],
  },
  {
    name: 'INNER BREAK',
    safeLane: 0,
    targets: [
      { lane: 1, leadRadians: -0.64 },
      { lane: 2, leadRadians: -0.96 },
    ],
  },
  {
    name: 'CROSSWIND',
    safeLane: 1,
    targets: [
      { lane: 0, leadRadians: -0.68 },
      { lane: 2, leadRadians: 0.68 },
    ],
  },
] as const;

export const getOrbitThreatFormation = (index: number): OrbitThreatFormation => {
  const formationName = getOrbitConstellationFormationName(index);
  return ORBIT_THREAT_FORMATIONS.find((formation) => formation.name === formationName)
    ?? ORBIT_THREAT_FORMATIONS[0];
};

export const getOrbitLaneName = (lane: number): 'INNER' | 'MID' | 'OUTER' => {
  if (lane <= 0) return 'INNER';
  if (lane >= 2) return 'OUTER';
  return 'MID';
};

export const getOrbitFormationBonus = (chain: number): number => {
  const base = 250 * Math.min(5, Math.max(1, Math.floor(chain)));
  return base + getOrbitConstellationClearBonus(chain);
};
