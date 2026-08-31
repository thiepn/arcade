import type { NeonRailLane } from './neonRailShift';

export type NeonRailPhraseName = 'SWITCHBACK' | 'SLALOM' | 'HOLD_BREAK' | 'CENTER_CUT';

export interface NeonRailPhrase {
  name: NeonRailPhraseName;
  lanes: NeonRailLane[];
}

export interface NeonRailChallengePattern {
  safeLane: NeonRailLane;
  blockedLanes: NeonRailLane[];
  coreLane: NeonRailLane;
  phaseOpportunity: boolean;
}

const clampRandom = (value: number) => Math.max(0, Math.min(0.999999, value));

const mirrorLane = (lane: NeonRailLane): NeonRailLane => (2 - lane) as NeonRailLane;

const switchbackFrom = (start: NeonRailLane): NeonRailLane[] => {
  if (start === 0) return [0, 1, 0, 1, 2, 1];
  if (start === 2) return [2, 1, 2, 1, 0, 1];
  return [1, 0, 1, 2, 1, 0];
};

const slalomFrom = (start: NeonRailLane): NeonRailLane[] => {
  if (start === 0) return [0, 1, 2, 1, 0, 1];
  if (start === 2) return [2, 1, 0, 1, 2, 1];
  return [1, 2, 1, 0, 1, 2];
};

const holdBreakFrom = (start: NeonRailLane): NeonRailLane[] => {
  if (start === 0) return [0, 0, 1, 1, 2, 2];
  if (start === 2) return [2, 2, 1, 1, 0, 0];
  return [1, 1, 0, 0, 1, 1];
};

const centerCutFrom = (start: NeonRailLane): NeonRailLane[] => {
  if (start === 0) return [0, 1, 1, 0, 1, 2];
  if (start === 2) return [2, 1, 1, 2, 1, 0];
  return [1, 0, 1, 1, 2, 1];
};

export const createNeonRailPhrase = (
  startLane: NeonRailLane,
  randomValue: number,
): NeonRailPhrase => {
  const index = Math.floor(clampRandom(randomValue) * 4);
  switch (index) {
    case 0:
      return { name: 'SWITCHBACK', lanes: switchbackFrom(startLane) };
    case 1:
      return { name: 'SLALOM', lanes: slalomFrom(startLane) };
    case 2:
      return { name: 'HOLD_BREAK', lanes: holdBreakFrom(startLane) };
    default:
      return { name: 'CENTER_CUT', lanes: centerCutFrom(startLane) };
  }
};

export const createNeonRailChallengePattern = (
  safeLane: NeonRailLane,
  rowIndex: number,
  densityRandom: number,
): NeonRailChallengePattern => {
  const otherLanes = ([0, 1, 2] as NeonRailLane[]).filter((lane) => lane !== safeLane);
  const normalized = clampRandom(densityRandom);
  const phaseOpportunity = rowIndex >= 6 && rowIndex % 5 === 4;

  if (phaseOpportunity) {
    const blockedLane = otherLanes[Math.floor(normalized * otherLanes.length)];
    return {
      safeLane,
      blockedLanes: [blockedLane],
      coreLane: blockedLane,
      phaseOpportunity: true,
    };
  }

  const useDoubleBarrier = rowIndex >= 3 && normalized >= 0.52;
  const blockedLanes = useDoubleBarrier
    ? otherLanes
    : [otherLanes[Math.floor(normalized * otherLanes.length)]];

  return {
    safeLane,
    blockedLanes,
    coreLane: safeLane,
    phaseOpportunity: false,
  };
};

export const mirrorNeonRailPhrase = (phrase: NeonRailPhrase): NeonRailPhrase => ({
  name: phrase.name,
  lanes: phrase.lanes.map(mirrorLane),
});
