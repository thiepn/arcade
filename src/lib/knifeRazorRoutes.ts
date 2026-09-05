export type KnifeRazorRouteKind = 'PRECISION TRACE' | 'TEMPO TRACE';

export interface KnifeRazorRoute {
  name: KnifeRazorRouteKind;
  /** Stage positions within each six-stage cycle that must receive Razor hits. */
  stageSteps: readonly [number, number, number];
  reward: number;
}

export const P22_KNIFE_RAZOR_ROUTES: readonly KnifeRazorRoute[] = [
  { name: 'PRECISION TRACE', stageSteps: [1, 5, 6], reward: 950 },
  { name: 'TEMPO TRACE', stageSteps: [1, 3, 6], reward: 950 },
] as const;

const TAU = Math.PI * 2;

const signedAngleDelta = (angle: number, target: number) => {
  let delta = (angle - target) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return delta;
};

export const getKnifeRazorRouteSide = (
  hitAngle: number,
  targetAngle: number,
  tolerance: number,
): KnifeRazorRouteKind | null => {
  const safeTolerance = Math.max(0, tolerance);
  const delta = signedAngleDelta(hitAngle, targetAngle);
  if (Math.abs(delta) > safeTolerance) return null;
  return delta < 0 ? 'PRECISION TRACE' : 'TEMPO TRACE';
};

export const getKnifeRouteCycleStage = (stage: number) =>
  ((Math.max(1, Math.floor(stage)) - 1) % 6) + 1;

export const getKnifeRouteCycle = (stage: number) =>
  Math.floor((Math.max(1, Math.floor(stage)) - 1) / 6);

export const getKnifeRazorRoute = (name: KnifeRazorRouteKind) =>
  P22_KNIFE_RAZOR_ROUTES.find((route) => route.name === name) ?? P22_KNIFE_RAZOR_ROUTES[0];
