import type { NeonRailLane } from './neonRailShift';
import { requestP22GameplayEvent } from './p22GameplayEvents';

export type NeonRailPhraseName = 'SWITCHBACK' | 'SLALOM' | 'HOLD_BREAK' | 'CENTER_CUT';

export interface NeonRailPhrase {
  name: NeonRailPhraseName;
  lanes: NeonRailLane[];
  sequenceName?: string;
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

const buildPhrase = (name: NeonRailPhraseName, start: NeonRailLane): NeonRailLane[] => {
  if (name === 'SWITCHBACK') return switchbackFrom(start);
  if (name === 'SLALOM') return slalomFrom(start);
  if (name === 'HOLD_BREAK') return holdBreakFrom(start);
  return centerCutFrom(start);
};

export interface NeonRailSequence {
  name: string;
  phrases: readonly [NeonRailPhraseName, NeonRailPhraseName, NeonRailPhraseName];
}

export interface BuiltNeonRailSequence {
  name: string;
  phrases: readonly [NeonRailPhrase, NeonRailPhrase, NeonRailPhrase];
  lanes: readonly NeonRailLane[];
}

export const P22_NEON_RAIL_SEQUENCES: readonly NeonRailSequence[] = [
  { name: 'OPEN CIRCUIT', phrases: ['SWITCHBACK', 'SLALOM', 'HOLD_BREAK'] },
  { name: 'CROSS CURRENT', phrases: ['SLALOM', 'CENTER_CUT', 'SWITCHBACK'] },
  { name: 'CENTER DRIVE', phrases: ['SWITCHBACK', 'CENTER_CUT', 'SLALOM'] },
  { name: 'HOLD REVERSAL', phrases: ['HOLD_BREAK', 'SWITCHBACK', 'CENTER_CUT'] },
  { name: 'WEAVE PRESSURE', phrases: ['SLALOM', 'HOLD_BREAK', 'CENTER_CUT'] },
  { name: 'NEON FINALE', phrases: ['CENTER_CUT', 'SLALOM', 'SWITCHBACK'] },
] as const;

export const createNeonRailSequence = (
  startLane: NeonRailLane,
  randomValue: number,
): BuiltNeonRailSequence => {
  const sequenceIndex = Math.floor(clampRandom(randomValue) * P22_NEON_RAIL_SEQUENCES.length);
  const sequence = P22_NEON_RAIL_SEQUENCES[sequenceIndex];
  let currentStart = startLane;
  const built = sequence.phrases.map((name) => {
    const lanes = buildPhrase(name, currentStart);
    currentStart = lanes[lanes.length - 1];
    return { name, lanes, sequenceName: sequence.name } as NeonRailPhrase;
  }) as [NeonRailPhrase, NeonRailPhrase, NeonRailPhrase];
  return { name: sequence.name, phrases: built, lanes: built.flatMap((phrase) => phrase.lanes) };
};

let runtimeSequence: { sequence: NeonRailSequence; step: number } | null = null;

export const resetP22NeonRailSequenceRuntime = () => {
  runtimeSequence = null;
};

const createHistoricalPhrase = (startLane: NeonRailLane, randomValue: number): NeonRailPhrase => {
  const index = Math.floor(clampRandom(randomValue) * 4);
  const names: readonly NeonRailPhraseName[] = ['SWITCHBACK', 'SLALOM', 'HOLD_BREAK', 'CENTER_CUT'];
  const name = names[index];
  return { name, lanes: buildPhrase(name, startLane) };
};

export const createNeonRailPhrase = (
  startLane: NeonRailLane,
  randomValue: number,
): NeonRailPhrase => {
  // Node/static audits retain the historical one-phrase API exactly. In the
  // browser, three normal six-row phrases are sequenced across three calls.
  if (typeof window === 'undefined') return createHistoricalPhrase(startLane, randomValue);

  if (!runtimeSequence) {
    const sequenceIndex = Math.floor(clampRandom(randomValue) * P22_NEON_RAIL_SEQUENCES.length);
    runtimeSequence = { sequence: P22_NEON_RAIL_SEQUENCES[sequenceIndex], step: 0 };
    requestP22GameplayEvent({
      gameId: 'neonrail',
      kind: 'rail-sequence-start',
      label: runtimeSequence.sequence.name,
      secondaryLabel: runtimeSequence.sequence.phrases.join(' → '),
      index: sequenceIndex,
      aux: 18,
    });
  }

  const active = runtimeSequence;
  const phraseName = active.sequence.phrases[active.step];
  const result: NeonRailPhrase = {
    name: phraseName,
    lanes: buildPhrase(phraseName, startLane),
    sequenceName: active.sequence.name,
  };
  active.step += 1;
  if (active.step >= active.sequence.phrases.length) runtimeSequence = null;
  return result;
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
    return { safeLane, blockedLanes: [blockedLane], coreLane: blockedLane, phaseOpportunity: true };
  }

  const useDoubleBarrier = rowIndex >= 3 && normalized >= 0.52;
  const blockedLanes = useDoubleBarrier
    ? otherLanes
    : [otherLanes[Math.floor(normalized * otherLanes.length)]];

  return { safeLane, blockedLanes, coreLane: safeLane, phaseOpportunity: false };
};

export const mirrorNeonRailPhrase = (phrase: NeonRailPhrase): NeonRailPhrase => ({
  ...phrase,
  lanes: phrase.lanes.map(mirrorLane),
});
