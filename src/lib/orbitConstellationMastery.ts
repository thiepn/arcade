import { requestP22GameplayEvent } from './p22GameplayEvents';

export type OrbitConstellationRouteName = 'TRIAD' | 'SWITCHBACK' | 'SLINGSHOT' | 'CROSSWIND';
export type OrbitConstellationFormationName = 'SWEEP' | 'PINCH' | 'INNER BREAK' | 'CROSSWIND';

export interface OrbitConstellation {
  name: string;
  route: OrbitConstellationRouteName;
  formation: OrbitConstellationFormationName;
}

export const P22_ORBIT_CONSTELLATIONS: readonly OrbitConstellation[] = [
  { name: 'TRIAD SWEEP', route: 'TRIAD', formation: 'SWEEP' },
  { name: 'TRIAD PINCH', route: 'TRIAD', formation: 'PINCH' },
  { name: 'SWITCHBACK CROSS', route: 'SWITCHBACK', formation: 'CROSSWIND' },
  { name: 'SLINGSHOT BREAK', route: 'SLINGSHOT', formation: 'INNER BREAK' },
  { name: 'CROSSWIND PINCH', route: 'CROSSWIND', formation: 'PINCH' },
  { name: 'CROSSWIND BREAK', route: 'CROSSWIND', formation: 'INNER BREAK' },
] as const;

let activeRoute: OrbitConstellationRouteName = 'TRIAD';
let activeConstellation = P22_ORBIT_CONSTELLATIONS[0];

const constellationsForRoute = (route: OrbitConstellationRouteName) => {
  const matches = P22_ORBIT_CONSTELLATIONS.filter((entry) => entry.route === route);
  return matches.length > 0 ? matches : [P22_ORBIT_CONSTELLATIONS[0]];
};

export const noteOrbitConstellationRoute = (
  route: OrbitConstellationRouteName,
  routeIndex: number,
  lane: number,
) => {
  if (Math.max(0, Math.floor(routeIndex)) === 0) {
    activeRoute = 'TRIAD';
    activeConstellation = P22_ORBIT_CONSTELLATIONS[0];
  }
  activeRoute = route;
  requestP22GameplayEvent({
    gameId: 'orbit',
    kind: 'constellation-route',
    label: route,
    value: routeIndex,
    aux: lane,
  });
};

export const getOrbitConstellationFormationName = (
  formationIndex: number,
): OrbitConstellationFormationName => {
  const candidates = constellationsForRoute(activeRoute);
  const normalized = Math.abs(Math.floor(formationIndex));
  activeConstellation = candidates[normalized % candidates.length];
  requestP22GameplayEvent({
    gameId: 'orbit',
    kind: 'constellation-start',
    label: activeConstellation.name,
    secondaryLabel: activeConstellation.route,
    index: formationIndex,
    meta: { formation: activeConstellation.formation },
  });
  return activeConstellation.formation;
};

export const getOrbitConstellationClearBonus = (formationChain: number): number =>
  requestP22GameplayEvent({
    gameId: 'orbit',
    kind: 'constellation-clear',
    label: activeConstellation.name,
    secondaryLabel: activeConstellation.formation,
    value: formationChain,
  });

export const getActiveOrbitConstellation = (): OrbitConstellation => activeConstellation;
