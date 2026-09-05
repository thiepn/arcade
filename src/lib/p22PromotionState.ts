import type { P22GameId, P22GameplayDetail } from './p22GameplayEvents';
import {
  P22_ORB_SALVO_PLANS,
  P22_SNAKE_CHAPTERS,
  P22_TEACHING,
  getP22RoadRoutes,
  type OrbSalvoRequirement,
  type RoadDistrictRoute,
} from './p22PromotionStructures';
import { getKnifeRazorRoute, type KnifeRazorRouteKind } from './knifeRazorRoutes';

export type P22RoadDirection = 'left' | 'right' | 'forward' | 'backward';

export interface P22RunState {
  gameId: P22GameId;
  bonus: number;
  structure: string;
  step: string;
  completions: number;
  snakeChapterIndex: number;
  orbitRoute: string;
  railSequence: string;
  railCoreSuccess: number;
  railLastCombo: number | null;
  railPendingBonus: number;
  slingshotSector: number;
  slingshotArc: string;
  slingshotArcStep: number;
  slingshotMissionClear: boolean;
  slingshotFirstStepClear: boolean;
  slingshotPendingBonus: number;
  orbPlanIndex: number;
  orbPlanStep: number;
  matrixRound: number;
  matrixSuite: string;
  matrixSuiteStep: number;
  matrixSuiteLength: number;
  matrixOverclockChain: number;
  knifeRoute: KnifeRazorRouteKind | null;
  knifeRouteStep: number;
  knifeCycle: number;
  knifePendingBonus: number;
  roadCol: number;
  roadRow: number;
  roadDistrict: string;
  roadDistrictStartRow: number;
  roadRouteIndex: number | null;
  roadRouteStep: number;
  roadRouteComplete: boolean;
  roadRouteFailed: boolean;
  roadPendingBonus: number;
  roadRouteStreak: number;
}

export const createP22RunState = (gameId: P22GameId): P22RunState => {
  const teaching = P22_TEACHING[gameId];
  return {
    gameId,
    bonus: 0,
    structure: teaching.initialStructure,
    step: teaching.initialStep,
    completions: 0,
    snakeChapterIndex: 0,
    orbitRoute: 'TRIAD',
    railSequence: teaching.initialStructure,
    railCoreSuccess: 0,
    railLastCombo: null,
    railPendingBonus: 0,
    slingshotSector: 0,
    slingshotArc: teaching.initialStructure,
    slingshotArcStep: 1,
    slingshotMissionClear: false,
    slingshotFirstStepClear: false,
    slingshotPendingBonus: 0,
    orbPlanIndex: 0,
    orbPlanStep: 0,
    matrixRound: 1,
    matrixSuite: 'FOUNDATION',
    matrixSuiteStep: 0,
    matrixSuiteLength: 8,
    matrixOverclockChain: 0,
    knifeRoute: null,
    knifeRouteStep: 0,
    knifeCycle: 0,
    knifePendingBonus: 0,
    roadCol: 4,
    roadRow: 0,
    roadDistrict: 'NEON SUBURB',
    roadDistrictStartRow: 0,
    roadRouteIndex: null,
    roadRouteStep: 0,
    roadRouteComplete: false,
    roadRouteFailed: false,
    roadPendingBonus: 0,
    roadRouteStreak: 0,
  };
};

const award = (state: P22RunState, amount: number, label: string) => {
  const reward = Math.max(0, Math.floor(amount));
  if (!reward) return 0;
  state.bonus += reward;
  state.completions += 1;
  state.step = `${label} +${reward}`;
  return reward;
};

const formatOrbRequirement = (requirement: OrbSalvoRequirement) => {
  if (requirement.kind === 'swap') return 'SWAP';
  if (requirement.kind === 'burst') return 'BURST';
  const parts: string[] = [];
  if (requirement.minCombo) parts.push(`COMBO ${requirement.minCombo}+`);
  if (requirement.minDrop) parts.push(`DROP ${requirement.minDrop}+`);
  return parts.length ? parts.join(' + ') : 'MATCH';
};

const matchesOrbRequirement = (requirement: OrbSalvoRequirement, detail: P22GameplayDetail) => {
  if (requirement.kind === 'swap') return detail.kind === 'orb-swap';
  if (requirement.kind === 'burst') return detail.kind === 'orb-burst-arm';
  if (detail.kind !== 'orb-resolve') return false;
  return Math.max(0, Math.floor(detail.value ?? 0)) >= (requirement.minCombo ?? 0)
    && Math.max(0, Math.floor(detail.aux ?? 0)) >= (requirement.minDrop ?? 0);
};

const currentRoadRoute = (state: P22RunState): RoadDistrictRoute | null => {
  if (state.roadRouteIndex === null) return null;
  return getP22RoadRoutes(state.roadDistrict)[state.roadRouteIndex] ?? null;
};

const updateRoadRoute = (state: P22RunState) => {
  const routes = getP22RoadRoutes(state.roadDistrict);
  if (state.roadRouteComplete || state.roadRouteFailed) return;
  if (state.roadRouteIndex === null) {
    for (let index = 0; index < routes.length; index++) {
      const first = routes[index].waypoints[0];
      if (state.roadRow === state.roadDistrictStartRow + first.rowOffset && state.roadCol === first.col) {
        state.roadRouteIndex = index;
        state.roadRouteStep = 1;
        state.structure = `${state.roadDistrict} • ${routes[index].name}`;
        const next = routes[index].waypoints[1];
        state.step = `2/3 • ROW ${state.roadDistrictStartRow + next.rowOffset} • COL ${next.col}`;
        return;
      }
    }
    const firstRow = state.roadDistrictStartRow + routes[0].waypoints[0].rowOffset;
    if (state.roadRow > firstRow) {
      state.roadRouteFailed = true;
      state.structure = `${state.roadDistrict} • ROUTE MISSED`;
      state.step = 'BASE DISTRICT PLAY CONTINUES';
    } else {
      state.structure = `${state.roadDistrict} • LEFT / RIGHT`;
      state.step = `OPEN • ROW ${firstRow} • COL ${routes[0].waypoints[0].col} OR ${routes[1].waypoints[0].col}`;
    }
    return;
  }
  const route = currentRoadRoute(state);
  if (!route) return;
  const waypoint = route.waypoints[state.roadRouteStep];
  if (!waypoint) return;
  const targetRow = state.roadDistrictStartRow + waypoint.rowOffset;
  if (state.roadRow === targetRow && state.roadCol === waypoint.col) {
    state.roadRouteStep += 1;
    if (state.roadRouteStep >= route.waypoints.length) {
      state.roadRouteComplete = true;
      state.step = `ROUTE CLEAR • CHECKPOINT +${route.reward}`;
      return;
    }
    const next = route.waypoints[state.roadRouteStep];
    state.step = `${state.roadRouteStep + 1}/3 • ROW ${state.roadDistrictStartRow + next.rowOffset} • COL ${next.col}`;
  } else if (state.roadRow > targetRow) {
    state.roadRouteFailed = true;
    state.step = 'ROUTE MISSED • BASE DISTRICT PLAY CONTINUES';
  }
};

export const applyP22RoadMove = (state: P22RunState, direction: P22RoadDirection | null) => {
  if (!direction) return;
  if (direction === 'left') state.roadCol = Math.max(0, state.roadCol - 1);
  if (direction === 'right') state.roadCol = Math.min(8, state.roadCol + 1);
  if (direction === 'forward') state.roadRow += 1;
  if (direction === 'backward') state.roadRow = Math.max(0, state.roadRow - 1);
  updateRoadRoute(state);
};

export interface P22ProcessContext {
  firewallStage?: number;
  roadDirection?: P22RoadDirection | null;
}

export const processP22GameplayEvent = (
  state: P22RunState,
  detail: P22GameplayDetail,
  context: P22ProcessContext = {},
): number => {
  switch (state.gameId) {
    case 'snake': {
      if (detail.kind !== 'phase-thread') return 0;
      const chapter = P22_SNAKE_CHAPTERS[state.snakeChapterIndex % P22_SNAKE_CHAPTERS.length];
      const chain = Math.max(0, Math.floor(detail.value ?? 0));
      const firewall = Math.max(0, Math.floor(context.firewallStage ?? 0));
      state.structure = chapter.name;
      state.step = `FW L${firewall} • THREAD ${Math.min(chain, chapter.threadTarget)}/${chapter.threadTarget}`;
      if (chain < chapter.threadTarget || firewall < chapter.minFirewallStage) return 0;
      const bonus = award(state, chapter.reward, `${chapter.name} CLEAR`);
      state.snakeChapterIndex = (state.snakeChapterIndex + 1) % P22_SNAKE_CHAPTERS.length;
      const next = P22_SNAKE_CHAPTERS[state.snakeChapterIndex];
      state.structure = next.name;
      state.step = `NEXT • FW L${next.minFirewallStage}+ • THREAD ${next.threadTarget}`;
      return bonus;
    }
    case 'orbit': {
      if (detail.kind === 'constellation-route') {
        state.orbitRoute = detail.label ?? state.orbitRoute;
        state.step = `ROUTE ${state.orbitRoute} • AWAIT FORMATION`;
      } else if (detail.kind === 'constellation-start') {
        state.structure = detail.label ?? 'CONSTELLATION';
        state.step = `ROUTE ${detail.secondaryLabel ?? state.orbitRoute} • FORMATION ${String(detail.meta?.formation ?? 'THREAT')}`;
      } else if (detail.kind === 'constellation-clear') {
        const chain = Math.max(1, Math.floor(detail.value ?? 1));
        return award(state, 350 + Math.min(5, chain) * 100, `${detail.label ?? state.structure} CLEAR x${chain}`);
      }
      return 0;
    }
    case 'neonrail': {
      if (detail.kind === 'rail-sequence-start') {
        state.railSequence = detail.label ?? 'RAIL SEQUENCE';
        state.railCoreSuccess = 0;
        state.railLastCombo = null;
        state.structure = state.railSequence;
        state.step = `0/${Math.max(1, Math.floor(detail.aux ?? 18))} CORES`;
      } else if (detail.kind === 'rail-core-success') {
        const combo = Math.max(1, Math.floor(detail.value ?? 1));
        state.railCoreSuccess = state.railLastCombo !== null && combo === state.railLastCombo + 1 ? state.railCoreSuccess + 1 : 1;
        state.railLastCombo = combo;
        const target = Math.max(1, Math.floor(detail.aux ?? 18));
        state.step = `${Math.min(target, state.railCoreSuccess)}/${target} CORES`;
        if (state.railCoreSuccess === target) {
          state.railPendingBonus += 850;
          state.step = `SEQUENCE CLEAR • CASH +${state.railPendingBonus} AT ROUTE MASTERY`;
        }
      } else if (detail.kind === 'rail-mastery-reward' && state.railPendingBonus > 0) {
        const pending = state.railPendingBonus;
        state.railPendingBonus = 0;
        return award(state, pending, `${state.railSequence} MASTERED`);
      }
      return 0;
    }
    case 'slingshot': {
      if (detail.kind === 'mission-start') {
        const sector = Math.max(1, Math.floor(detail.value ?? 1));
        if (state.slingshotSector === sector) return 0;
        if (sector === 1) {
          state.slingshotFirstStepClear = false;
          state.slingshotPendingBonus = 0;
        } else if (!state.slingshotMissionClear && state.slingshotArcStep === 1) {
          state.slingshotFirstStepClear = false;
        }
        state.slingshotSector = sector;
        state.slingshotArc = detail.secondaryLabel ?? 'MISSION ARC';
        state.slingshotArcStep = Math.max(1, Math.floor(detail.index ?? 1));
        state.slingshotMissionClear = false;
        state.structure = state.slingshotArc;
        state.step = `${state.slingshotArcStep}/2 • ${detail.label ?? 'MISSION'} 0/${Math.max(1, Math.floor(detail.aux ?? 1))}`;
      } else if (detail.kind === 'mission-progress') {
        const progress = Math.max(0, Math.floor(detail.value ?? 0));
        const target = Math.max(1, Math.floor(detail.aux ?? 1));
        state.step = `${state.slingshotArcStep}/2 • ${detail.label ?? 'MISSION'} ${progress}/${target}`;
        if (detail.flag) {
          state.slingshotMissionClear = true;
          if (state.slingshotArcStep === 1) state.slingshotFirstStepClear = true;
          if (state.slingshotArcStep === 2 && state.slingshotFirstStepClear) {
            state.slingshotPendingBonus = 800 + Math.min(4, Math.floor((state.slingshotSector - 1) / 2)) * 100;
          }
        }
      } else if (detail.kind === 'mission-reward' && state.slingshotPendingBonus > 0) {
        const pending = state.slingshotPendingBonus;
        state.slingshotPendingBonus = 0;
        state.slingshotFirstStepClear = false;
        return award(state, pending, `${state.slingshotArc} CLEAR`);
      }
      return 0;
    }
    case 'bubblebuster': {
      const plan = P22_ORB_SALVO_PLANS[state.orbPlanIndex % P22_ORB_SALVO_PLANS.length];
      const requirement = plan.steps[state.orbPlanStep];
      state.structure = plan.name;
      state.step = `${state.orbPlanStep + 1}/${plan.steps.length} • ${formatOrbRequirement(requirement)}`;
      if (!requirement || !matchesOrbRequirement(requirement, detail)) return 0;
      state.orbPlanStep += 1;
      if (state.orbPlanStep < plan.steps.length) {
        state.step = `${state.orbPlanStep + 1}/${plan.steps.length} • ${formatOrbRequirement(plan.steps[state.orbPlanStep])}`;
        return 0;
      }
      const bonus = award(state, plan.reward, `${plan.name} CLEAR`);
      state.orbPlanIndex = (state.orbPlanIndex + 1) % P22_ORB_SALVO_PLANS.length;
      state.orbPlanStep = 0;
      const next = P22_ORB_SALVO_PLANS[state.orbPlanIndex];
      state.structure = next.name;
      state.step = `1/${next.steps.length} • ${formatOrbRequirement(next.steps[0])}`;
      return bonus;
    }
    case 'matrix': {
      if (detail.kind === 'matrix-protocol-start') {
        state.matrixRound = Math.max(1, Math.floor(detail.value ?? 1));
        state.matrixSuite = detail.label ?? 'FOUNDATION';
        state.matrixSuiteStep = Math.max(0, Math.floor(detail.index ?? 0));
        state.matrixSuiteLength = Math.max(1, Math.floor(detail.aux ?? 1));
        state.structure = state.matrixSuite;
        state.step = `ROUND ${state.matrixRound} • ${detail.secondaryLabel ?? 'PROTOCOL'} → ${String(detail.meta?.nextProtocol ?? 'NEXT')}`;
      } else if (detail.kind === 'matrix-protocol-clear') {
        state.matrixOverclockChain = detail.flag ? state.matrixOverclockChain + 1 : 0;
        if (state.matrixRound >= 9 && state.matrixSuiteStep === state.matrixSuiteLength - 1) {
          return award(state, 700 + Math.min(4, state.matrixOverclockChain) * 125, `${state.matrixSuite} CLEAR`);
        }
      }
      return 0;
    }
    case 'knifetarget': {
      if (detail.kind === 'razor-hit') {
        const stage = Math.max(1, Math.floor(detail.value ?? 1));
        const cycle = Math.floor((stage - 1) / 6);
        const cycleStage = ((stage - 1) % 6) + 1;
        if (cycle !== state.knifeCycle) {
          state.knifeCycle = cycle;
          state.knifeRoute = null;
          state.knifeRouteStep = 0;
          state.knifePendingBonus = 0;
        }
        const side = detail.meta?.routeSide as KnifeRazorRouteKind | undefined;
        if (!state.knifeRoute && cycleStage === 1 && side) {
          state.knifeRoute = side;
          state.knifeRouteStep = 1;
          const route = getKnifeRazorRoute(side);
          state.structure = route.name;
          state.step = `1/3 • NEXT STAGE ${route.stageSteps[1]}`;
        } else if (state.knifeRoute) {
          const route = getKnifeRazorRoute(state.knifeRoute);
          if (cycleStage === route.stageSteps[state.knifeRouteStep]) {
            state.knifeRouteStep += 1;
            if (state.knifeRouteStep >= route.stageSteps.length) {
              state.knifePendingBonus = route.reward;
              state.step = `ROUTE CLEAR • +${route.reward}`;
            } else {
              state.step = `${state.knifeRouteStep}/3 • NEXT STAGE ${route.stageSteps[state.knifeRouteStep]}`;
            }
          }
        }
      } else if (detail.kind === 'razor-reward' && state.knifePendingBonus > 0) {
        const pending = state.knifePendingBonus;
        state.knifePendingBonus = 0;
        return award(state, pending, `${state.knifeRoute ?? 'RAZOR ROUTE'} CLEAR`);
      }
      return 0;
    }
    case 'roadcross': {
      if (detail.kind === 'road-move-accepted') {
        applyP22RoadMove(state, context.roadDirection ?? null);
      } else if (detail.kind === 'road-district-start') {
        const oldRoute = currentRoadRoute(state);
        state.roadPendingBonus = state.roadRouteComplete && oldRoute ? oldRoute.reward : 0;
        state.roadRouteStreak = state.roadRouteComplete ? state.roadRouteStreak + 1 : 0;
        state.roadDistrict = detail.label ?? state.roadDistrict;
        state.roadDistrictStartRow = Math.max(0, Math.floor(detail.value ?? state.roadRow));
        state.roadRow = state.roadDistrictStartRow;
        state.roadRouteIndex = null;
        state.roadRouteStep = 0;
        state.roadRouteComplete = false;
        state.roadRouteFailed = false;
        updateRoadRoute(state);
      } else if (detail.kind === 'road-checkpoint-bonus' && state.roadPendingBonus > 0) {
        const pending = Math.round(state.roadPendingBonus * (1 + Math.min(3, state.roadRouteStreak - 1) * 0.15));
        state.roadPendingBonus = 0;
        return award(state, pending, `DISTRICT ROUTE x${Math.max(1, state.roadRouteStreak)}`);
      }
      return 0;
    }
  }
};
