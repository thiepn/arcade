import { requestP22GameplayEvent } from './p22GameplayEvents';
import { getKnifeRazorRouteSide } from './knifeRazorRoutes';

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface KnifeMasteryShield {
  startAngle: number;
  spanAngle: number;
}

const normalize = (angle: number) => {
  const value = angle % TAU;
  return value < 0 ? value + TAU : value;
};

const distance = (a: number, b: number) => {
  const delta = Math.abs(normalize(a) - normalize(b));
  return Math.min(delta, TAU - delta);
};

const insideShield = (angle: number, shield: KnifeMasteryShield, margin: number) => {
  const span = Math.max(0, shield.spanAngle) + margin * 2;
  const start = normalize(shield.startAngle - margin);
  const relative = normalize(angle - start);
  return relative <= span;
};

export const getKnifeRazorTolerance = (stage: number) => {
  const tier = Math.floor((Math.max(1, Math.floor(stage)) - 1) / 6);
  return Math.max(0.09, 0.15 - tier * 0.01);
};

export const findKnifeRazorTarget = (
  stage: number,
  targetIndex: number,
  embeddedAngles: readonly number[] = [],
  shields: readonly KnifeMasteryShield[] = [],
): number => {
  const safeStage = Math.max(1, Math.floor(stage));
  const safeIndex = Math.max(0, Math.floor(targetIndex));
  const start = normalize(safeStage * 0.47 + safeIndex * GOLDEN_ANGLE);
  const minimumBladeClearance = 0.42;
  const shieldMargin = 0.14;

  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = normalize(start + (attempt / 32) * TAU);
    const bladeSafe = embeddedAngles.every((angle) => distance(candidate, angle) >= minimumBladeClearance);
    const shieldSafe = shields.every((shield) => !insideShield(candidate, shield, shieldMargin));
    if (bladeSafe && shieldSafe) return candidate;
  }

  return start;
};

export const isKnifeRazorHit = (hitAngle: number, targetAngle: number, stage: number) => {
  const tolerance = getKnifeRazorTolerance(stage);
  const hit = distance(hitAngle, targetAngle) <= tolerance;
  if (hit) {
    const routeSide = getKnifeRazorRouteSide(hitAngle, targetAngle, tolerance);
    requestP22GameplayEvent({
      gameId: 'knifetarget',
      kind: 'razor-hit',
      value: Math.max(1, Math.floor(stage)),
      aux: tolerance,
      meta: { routeSide: routeSide ?? 'PRECISION TRACE' },
    });
  }
  return hit;
};

export const getKnifeRazorBonus = (precisionChain: number, stage: number) => {
  const chain = Math.max(1, Math.floor(precisionChain));
  const safeStage = Math.max(1, Math.floor(stage));
  const chainMultiplier = Math.min(3, 1 + (chain - 1) * 0.45);
  const stageMultiplier = Math.min(2.2, 1 + (safeStage - 1) * 0.06);
  const baseReward = Math.round(300 * chainMultiplier * stageMultiplier);
  const routeBonus = requestP22GameplayEvent({
    gameId: 'knifetarget',
    kind: 'razor-reward',
    value: safeStage,
    aux: chain,
  });
  return baseReward + routeBonus;
};

export const isKnifeRazorRush = (precisionChain: number) => Math.floor(precisionChain) >= 3;
