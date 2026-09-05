import type { P22GameId } from './p22GameplayEvents';

export interface P22TeachingProfile {
  title: string;
  summary: string;
  benefit: string;
  tradeoff: string;
  initialStructure: string;
  initialStep: string;
}

export const P22_TEACHING: Record<P22GameId, P22TeachingProfile> = {
  snake: {
    title: 'PHASE THREAD CHAPTER',
    summary: 'Each chapter asks for a deeper Ghost Phase thread once the firewall has developed far enough.',
    benefit: 'Complete the visible thread target for a score-only chapter bonus and advance to the next chapter.',
    tradeoff: 'Chapters are optional. The 90-tick Ghost Phase cap and ordinary firewall collision rules never change.',
    initialStructure: 'GHOST IGNITION',
    initialStep: 'FW L1 • THREAD 0/2',
  },
  orbit: {
    title: 'CONSTELLATION',
    summary: 'Crystal routes and telegraphed threat formations are now composed into named constellation beats.',
    benefit: 'Collect the route, read the advertised safe lane, then clear the formation for a score-only constellation bonus.',
    tradeoff: 'Every formation still keeps its certified warning, cooldown, grace window, and guaranteed safe lane.',
    initialStructure: 'TRIAD SWEEP',
    initialStep: 'ROUTE TRIAD • FORMATION SWEEP',
  },
  neonrail: {
    title: 'RAIL SEQUENCE',
    summary: 'Three existing rail phrases now form one recognizable authored sequence with mirrored variation.',
    benefit: 'Clean cores across the sequence build a score-only sequence bonus that cashes on the next Route Mastery milestone.',
    tradeoff: 'Phase and Surge remain optional; safe-lane, obstacle-density, Surge speed, and charge caps are unchanged.',
    initialStructure: 'OPEN CIRCUIT',
    initialStep: '0/18 CORES',
  },
  slingshot: {
    title: 'MISSION ARC',
    summary: 'Two existing navigation missions now form a short multi-sector arc.',
    benefit: 'Clear both arc missions in order for an additional score-only navigation payoff.',
    tradeoff: 'Missions remain optional and never alter gravity, launch physics, lives, or the legal warp route.',
    initialStructure: 'LOCK & DUST',
    initialStep: '1/2 • LOCK CHAIN',
  },
  bubblebuster: {
    title: 'SALVO PLAN',
    summary: 'Existing chamber, one-swap, cascade, and Burst decisions now form rotating tactical salvo plans.',
    benefit: 'Complete the visible plan with the controls you already use for a score-only plan bonus.',
    tradeoff: 'Plans never grant colors, extra Burst charges, slower ceiling pressure, or guaranteed matches.',
    initialStructure: 'CHAMBER READ',
    initialStep: 'SWAP → MATCH',
  },
  matrix: {
    title: 'PROTOCOL SUITE',
    summary: 'The four existing transforms are composed into recognizable protocol suites after the original eight-round foundation.',
    benefit: 'Read the next protocol and choose when to risk the existing Overclock for suite-chain score bonuses.',
    tradeoff: 'Ordinary clears remain valid; Overclock still adds exactly two nodes, uses the same speed floor, and disables manual pattern replay only while active.',
    initialStructure: 'FOUNDATION',
    initialStep: 'ROUND 1 • FORWARD → FORWARD',
  },
  knifetarget: {
    title: 'RAZOR ROUTE',
    summary: 'The opening Razor window is split into two safe notches that commit the six-stage cycle to a precision or tempo route.',
    benefit: 'Land the route’s later Razor marks for a score-only route payoff before the Boss Core closes the cycle.',
    tradeoff: 'Both notches stay inside the existing certified Razor tolerance; shields, embedded blades, lives, and ordinary throws remain authoritative.',
    initialStructure: 'ROUTE OPEN',
    initialStep: '◀ PRECISION • TEMPO ▶',
  },
  roadcross: {
    title: 'DISTRICT ROUTE',
    summary: 'Each district offers optional waypoint columns that reward deliberate lateral planning with the existing movement controls.',
    benefit: 'Hit the three visible waypoint columns in order before the next district for a score-only checkpoint route bonus.',
    tradeoff: 'Traffic, trains, rivers, collision immunity, and forward progression are never altered to hand you the route.',
    initialStructure: 'NEON SUBURB • LEFT',
    initialStep: 'ROW 2 • COL 2',
  },
};

export interface SnakePhaseChapter {
  name: string;
  minFirewallStage: number;
  threadTarget: number;
  reward: number;
}

export const P22_SNAKE_CHAPTERS: readonly SnakePhaseChapter[] = [
  { name: 'GHOST IGNITION', minFirewallStage: 1, threadTarget: 2, reward: 450 },
  { name: 'FIREWALL WEAVE', minFirewallStage: 2, threadTarget: 3, reward: 600 },
  { name: 'PHASE LADDER', minFirewallStage: 2, threadTarget: 4, reward: 750 },
  { name: 'DEEP THREAD', minFirewallStage: 3, threadTarget: 5, reward: 900 },
  { name: 'NOVA THREAD', minFirewallStage: 3, threadTarget: 6, reward: 1050 },
] as const;

export type OrbSalvoRequirement =
  | { kind: 'swap' }
  | { kind: 'burst' }
  | { kind: 'resolve'; minCombo?: number; minDrop?: number };

export interface OrbSalvoPlan {
  name: string;
  steps: readonly OrbSalvoRequirement[];
  reward: number;
}

export const P22_ORB_SALVO_PLANS: readonly OrbSalvoPlan[] = [
  { name: 'CHAMBER READ', steps: [{ kind: 'swap' }, { kind: 'resolve', minCombo: 1 }], reward: 500 },
  { name: 'CASCADE LINE', steps: [{ kind: 'resolve', minDrop: 1 }], reward: 600 },
  { name: 'BURST CONVERT', steps: [{ kind: 'burst' }, { kind: 'resolve', minCombo: 1 }], reward: 650 },
  { name: 'COMBO BANK', steps: [{ kind: 'resolve', minCombo: 2 }, { kind: 'burst' }, { kind: 'resolve', minCombo: 3 }], reward: 800 },
  { name: 'SWAP DROP', steps: [{ kind: 'swap' }, { kind: 'resolve', minDrop: 1 }], reward: 850 },
  { name: 'MASTER SALVO', steps: [{ kind: 'swap' }, { kind: 'burst' }, { kind: 'resolve', minCombo: 2, minDrop: 1 }], reward: 1000 },
] as const;

export interface RoadRouteWaypoint {
  rowOffset: number;
  col: number;
}

export interface RoadDistrictRoute {
  name: string;
  waypoints: readonly [RoadRouteWaypoint, RoadRouteWaypoint, RoadRouteWaypoint];
  reward: number;
}

export const P22_ROAD_DISTRICT_ROUTES: Record<string, readonly [RoadDistrictRoute, RoadDistrictRoute]> = {
  'NEON SUBURB': [
    { name: 'LEFT TRACE', waypoints: [{ rowOffset: 2, col: 2 }, { rowOffset: 6, col: 4 }, { rowOffset: 10, col: 6 }], reward: 650 },
    { name: 'RIGHT TRACE', waypoints: [{ rowOffset: 2, col: 6 }, { rowOffset: 6, col: 4 }, { rowOffset: 10, col: 2 }], reward: 650 },
  ],
  'RUSH CIRCUIT': [
    { name: 'APEX LEFT', waypoints: [{ rowOffset: 1, col: 1 }, { rowOffset: 4, col: 4 }, { rowOffset: 7, col: 7 }], reward: 800 },
    { name: 'APEX RIGHT', waypoints: [{ rowOffset: 1, col: 7 }, { rowOffset: 4, col: 4 }, { rowOffset: 7, col: 1 }], reward: 800 },
  ],
  'FLOOD CHANNEL': [
    { name: 'TIDELINE', waypoints: [{ rowOffset: 1, col: 2 }, { rowOffset: 4, col: 5 }, { rowOffset: 7, col: 7 }], reward: 900 },
    { name: 'BACKWASH', waypoints: [{ rowOffset: 1, col: 6 }, { rowOffset: 4, col: 3 }, { rowOffset: 7, col: 1 }], reward: 900 },
  ],
  RAILWORKS: [
    { name: 'SIGNAL LEFT', waypoints: [{ rowOffset: 1, col: 1 }, { rowOffset: 4, col: 5 }, { rowOffset: 7, col: 7 }], reward: 1000 },
    { name: 'SIGNAL RIGHT', waypoints: [{ rowOffset: 1, col: 7 }, { rowOffset: 4, col: 3 }, { rowOffset: 7, col: 1 }], reward: 1000 },
  ],
};

export const getP22RoadRoutes = (districtName: string) =>
  P22_ROAD_DISTRICT_ROUTES[districtName] ?? P22_ROAD_DISTRICT_ROUTES['NEON SUBURB'];
