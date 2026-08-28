export interface GameViewport {
  width: number;
  height: number;
}

export interface GameResizeInfo extends GameViewport {
  previousWidth: number;
  previousHeight: number;
  scaleX: number;
  scaleY: number;
  uniformScale: number;
  isInitial: boolean;
}

const positiveDimension = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 1;

export const createGameResizeInfo = (
  previousWidth: number,
  previousHeight: number,
  width: number,
  height: number,
): GameResizeInfo => {
  const nextWidth = positiveDimension(width);
  const nextHeight = positiveDimension(height);
  const hasPrevious = previousWidth > 0 && previousHeight > 0;
  const safePreviousWidth = hasPrevious ? previousWidth : nextWidth;
  const safePreviousHeight = hasPrevious ? previousHeight : nextHeight;
  const scaleX = nextWidth / positiveDimension(safePreviousWidth);
  const scaleY = nextHeight / positiveDimension(safePreviousHeight);

  return {
    width: nextWidth,
    height: nextHeight,
    previousWidth: hasPrevious ? previousWidth : 0,
    previousHeight: hasPrevious ? previousHeight : 0,
    scaleX,
    scaleY,
    uniformScale: Math.min(scaleX, scaleY),
    isInitial: !hasPrevious,
  };
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const rescalePoint = <T extends { x: number; y: number }>(
  point: T,
  scaleX: number,
  scaleY: number,
): T => {
  point.x *= scaleX;
  point.y *= scaleY;
  return point;
};

export const rescaleVelocity = <T extends { vx: number; vy: number }>(
  body: T,
  scaleX: number,
  scaleY: number,
): T => {
  body.vx *= scaleX;
  body.vy *= scaleY;
  return body;
};

export const rescaleTrail = <T extends { x: number; y: number }>(
  trail: T[],
  scaleX: number,
  scaleY: number,
): T[] => {
  for (const point of trail) rescalePoint(point, scaleX, scaleY);
  return trail;
};
