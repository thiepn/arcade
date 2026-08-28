export const KNIFE_TARGET_TAU = Math.PI * 2;

export interface KnifePoint {
  x: number;
  y: number;
}

export const normalizeKnifeAngle = (angle: number): number =>
  ((angle % KNIFE_TARGET_TAU) + KNIFE_TARGET_TAU) % KNIFE_TARGET_TAU;

export const shortestKnifeAngleDistance = (a: number, b: number): number =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export const getKnifePointerAimAngle = (
  pointerX: number,
  pointerY: number,
  coreX: number,
  coreY: number,
  fallbackAngle = Math.PI / 2,
): number => {
  const dx = pointerX - coreX;
  const dy = pointerY - coreY;
  if (Math.hypot(dx, dy) < 4) return normalizeKnifeAngle(fallbackAngle);
  return normalizeKnifeAngle(Math.atan2(dy, dx));
};

export const getKnifeLocalImpactAngle = (
  worldAimAngle: number,
  coreAngle: number,
): number => normalizeKnifeAngle(worldAimAngle - coreAngle);

export const getKnifeWorldAngle = (
  localAngle: number,
  coreAngle: number,
): number => normalizeKnifeAngle(localAngle + coreAngle);

export const getKnifePolarPoint = (
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
): KnifePoint => ({
  x: centerX + Math.cos(angle) * radius,
  y: centerY + Math.sin(angle) * radius,
});

export const isKnifeAngleWithinArc = (
  localAngle: number,
  startAngle: number,
  spanAngle: number,
): boolean => {
  const offset = normalizeKnifeAngle(localAngle - startAngle);
  return offset <= Math.max(0, Math.min(KNIFE_TARGET_TAU, spanAngle));
};

export const getKnifeFlightPoint = (
  start: KnifePoint,
  end: KnifePoint,
  progress: number,
): KnifePoint => {
  const t = Math.max(0, Math.min(1, progress));
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
};
