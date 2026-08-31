export interface OrbitRoute {
  name: 'TRIAD' | 'SWITCHBACK' | 'SLINGSHOT' | 'CROSSWIND';
  lanes: readonly [number, number, number, number];
}

export const ORBIT_ROUTES: readonly OrbitRoute[] = [
  { name: 'TRIAD', lanes: [0, 1, 2, 1] },
  { name: 'SWITCHBACK', lanes: [2, 1, 0, 1] },
  { name: 'SLINGSHOT', lanes: [0, 2, 1, 2] },
  { name: 'CROSSWIND', lanes: [1, 0, 2, 0] },
] as const;

const getRoute = (routeIndex: number) => {
  const index = Math.max(0, Math.floor(routeIndex));
  const route = ORBIT_ROUTES[Math.floor(index / 4) % ORBIT_ROUTES.length];
  return { route, step: index % 4 };
};

export const getOrbitRouteLane = (routeIndex: number): number => {
  const { route, step } = getRoute(routeIndex);
  return route.lanes[step];
};

export const getOrbitRouteName = (routeIndex: number): OrbitRoute['name'] =>
  getRoute(routeIndex).route.name;

export const getOrbitRouteMultiplier = (routeChain: number): number =>
  Math.min(5, 1 + Math.floor(Math.max(0, routeChain - 1) / 3));

export const isOrbitNearMiss = (
  distance: number,
  collisionRadius: number,
  relativeDot: number,
): boolean => {
  const safeGap = distance - collisionRadius;
  return safeGap >= 2 && safeGap <= 18 && relativeDot > 0;
};
