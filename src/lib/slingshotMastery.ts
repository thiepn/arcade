import { requestP22GameplayEvent } from './p22GameplayEvents';

export type SlingshotMissionKind =
  | 'LOCK_CHAIN'
  | 'STARDUST_ROUTE'
  | 'PERFECT_CAPTURE'
  | 'GOLD_TRAIL';

export type SlingshotMissionEvent =
  | 'LOCKED_LAUNCH'
  | 'STARDUST'
  | 'PERFECT_CAPTURE'
  | 'GOLD_DUST';

export interface SlingshotMission {
  kind: SlingshotMissionKind;
  label: string;
  hint: string;
  target: number;
}

export interface SlingshotMissionArc {
  name: string;
  first: SlingshotMissionKind;
  second: SlingshotMissionKind;
}

export const SLINGSHOT_MISSIONS: readonly SlingshotMission[] = [
  { kind: 'LOCK_CHAIN', label: 'LOCK CHAIN', hint: 'Launch three times while the trajectory is perfectly locked.', target: 3 },
  { kind: 'STARDUST_ROUTE', label: 'STARDUST ROUTE', hint: 'Collect six stardust crystals before the sector warp.', target: 6 },
  { kind: 'PERFECT_CAPTURE', label: 'DEEP CAPTURE', hint: 'Land three deep gravity-well captures.', target: 3 },
  { kind: 'GOLD_TRAIL', label: 'GOLD TRAIL', hint: 'Thread through three gold stardust crystals.', target: 3 },
] as const;

export const P22_SLINGSHOT_MISSION_ARCS: readonly SlingshotMissionArc[] = [
  { name: 'LOCK & DUST', first: 'LOCK_CHAIN', second: 'STARDUST_ROUTE' },
  { name: 'CAPTURE & GOLD', first: 'PERFECT_CAPTURE', second: 'GOLD_TRAIL' },
  { name: 'VECTOR CHAIN', first: 'LOCK_CHAIN', second: 'STARDUST_ROUTE' },
  { name: 'DEEP TRAIL', first: 'PERFECT_CAPTURE', second: 'GOLD_TRAIL' },
] as const;

export const getSlingshotMissionArc = (sector: number) => {
  const safeSector = Math.max(1, Math.floor(sector));
  const pairIndex = Math.floor((safeSector - 1) / 2);
  const arc = P22_SLINGSHOT_MISSION_ARCS[pairIndex % P22_SLINGSHOT_MISSION_ARCS.length];
  return { arc, step: ((safeSector - 1) % 2) + 1 };
};

export const getSlingshotMission = (sector: number): SlingshotMission => {
  const safeSector = Math.max(1, Math.floor(sector));
  const mission = SLINGSHOT_MISSIONS[(safeSector - 1) % SLINGSHOT_MISSIONS.length];
  const { arc, step } = getSlingshotMissionArc(safeSector);
  requestP22GameplayEvent({
    gameId: 'slingshot',
    kind: 'mission-start',
    label: mission.label,
    secondaryLabel: arc.name,
    value: safeSector,
    aux: mission.target,
    index: step,
  });
  return mission;
};

export const advanceSlingshotMissionProgress = (
  mission: SlingshotMission,
  currentProgress: number,
  event: SlingshotMissionEvent,
): number => {
  const current = Math.max(0, Math.floor(currentProgress));
  const matches =
    (mission.kind === 'LOCK_CHAIN' && event === 'LOCKED_LAUNCH') ||
    (mission.kind === 'STARDUST_ROUTE' && event === 'STARDUST') ||
    (mission.kind === 'PERFECT_CAPTURE' && event === 'PERFECT_CAPTURE') ||
    (mission.kind === 'GOLD_TRAIL' && event === 'GOLD_DUST');
  const next = matches ? Math.min(mission.target, current + 1) : current;
  if (next !== current) {
    requestP22GameplayEvent({
      gameId: 'slingshot',
      kind: 'mission-progress',
      label: mission.label,
      value: next,
      aux: mission.target,
      flag: next >= mission.target,
    });
  }
  return next;
};

export const isSlingshotMissionComplete = (
  mission: SlingshotMission,
  progress: number,
): boolean => progress >= mission.target;

export const getSlingshotMissionReward = (sector: number, streak: number): number => {
  const safeSector = Math.max(1, Math.floor(sector));
  const safeStreak = Math.max(1, Math.floor(streak));
  const streakMultiplier = 1 + Math.min(4, safeStreak - 1) * 0.25;
  const baseReward = Math.round((1200 + safeSector * 350) * streakMultiplier);
  const arcBonus = requestP22GameplayEvent({
    gameId: 'slingshot',
    kind: 'mission-reward',
    value: safeSector,
    aux: safeStreak,
  });
  return baseReward + arcBonus;
};
