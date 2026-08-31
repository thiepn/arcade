export type DriftStyleEvent = 'apex' | 'rival' | 'nitro';

export interface DriftStyleRoute {
  id: string;
  label: string;
  events: readonly [DriftStyleEvent, DriftStyleEvent, DriftStyleEvent];
}

export interface DriftStyleAdvanceResult {
  routeIndex: number;
  progress: number;
  completed: boolean;
}

export const DRIFT_STYLE_ROUTES: readonly DriftStyleRoute[] = [
  {
    id: 'apex-hunter',
    label: 'APEX HUNTER',
    events: ['apex', 'rival', 'nitro'],
  },
  {
    id: 'street-charge',
    label: 'STREET CHARGE',
    events: ['nitro', 'apex', 'rival'],
  },
  {
    id: 'rival-line',
    label: 'RIVAL LINE',
    events: ['rival', 'nitro', 'apex'],
  },
] as const;

export const DRIFT_STYLE_MAX_CHAIN = 5;

export const getDriftStyleEventLabel = (event: DriftStyleEvent): string => {
  if (event === 'apex') return 'APEX';
  if (event === 'rival') return 'CLOSE PASS';
  return 'NITRO';
};

export const advanceDriftStyleRoute = (
  routeIndex: number,
  progress: number,
  event: DriftStyleEvent,
): DriftStyleAdvanceResult => {
  const safeRouteIndex = ((Math.floor(routeIndex) % DRIFT_STYLE_ROUTES.length) + DRIFT_STYLE_ROUTES.length) % DRIFT_STYLE_ROUTES.length;
  const route = DRIFT_STYLE_ROUTES[safeRouteIndex];
  const safeProgress = Math.max(0, Math.min(route.events.length - 1, Math.floor(progress)));
  const expected = route.events[safeProgress];

  if (event === expected) {
    const nextProgress = safeProgress + 1;
    if (nextProgress >= route.events.length) {
      return {
        routeIndex: (safeRouteIndex + 1) % DRIFT_STYLE_ROUTES.length,
        progress: 0,
        completed: true,
      };
    }
    return { routeIndex: safeRouteIndex, progress: nextProgress, completed: false };
  }

  return {
    routeIndex: safeRouteIndex,
    progress: event === route.events[0] ? 1 : 0,
    completed: false,
  };
};

export const getDriftStyleBonus = (chain: number): number => {
  const safeChain = Math.max(1, Math.min(DRIFT_STYLE_MAX_CHAIN, Math.floor(chain)));
  return 650 + safeChain * 450;
};
