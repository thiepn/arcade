import { clamp } from './gameCoordinates';

export const PINBALL_FIXED_STEP = 1 / 120;
export const PINBALL_MAX_SUBSTEPS = 8;
export const PINBALL_BALL_SAVER_SECONDS = 5;
export const PINBALL_MAX_BALL_SPEED = 980;
export const PINBALL_FLIPPER_REST_ANGLE = 0.34;
export const PINBALL_FLIPPER_UP_ANGLE = -0.52;

export interface PinballBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface PinballLayout {
  width: number;
  height: number;
  leftBound: number;
  rightBound: number;
  topBound: number;
  drainY: number;
  slingY: number;
  flipperY: number;
  flipperLength: number;
  flipperRadius: number;
  centerGapHalf: number;
  leftPivotX: number;
  rightPivotX: number;
  kickbackY: number;
  kickbackHeight: number;
  kickbackWidth: number;
}

export interface PinballCollision {
  normalX: number;
  normalY: number;
  penetration: number;
  contactT: number;
}

export interface PinballDrainInput {
  ballsRemaining: number;
  lives: number;
  ballSaverSeconds: number;
  ballSaverAvailable: boolean;
}

export type PinballDrainAction = 'continue' | 'ball-save' | 'new-life' | 'game-over';

export interface PinballDrainResult {
  action: PinballDrainAction;
  lives: number;
  ballSaverAvailable: boolean;
}

export const getPinballGravity = (height: number): number =>
  520 * clamp(Math.max(1, height) / 600, 0.82, 1.38);

export const getPinballSpeedScale = (height: number): number =>
  clamp(Math.max(1, height) / 600, 0.84, 1.36);

export const getPinballLayout = (width: number, height: number): PinballLayout => {
  const safeWidth = Math.max(280, width);
  const safeHeight = Math.max(420, height);
  const leftBound = safeWidth * 0.075;
  const rightBound = safeWidth * 0.925;
  const flipperY = safeHeight * 0.84;
  const flipperLength = clamp(safeWidth * 0.19, 76, 102);
  const flipperRadius = clamp(Math.min(safeWidth, safeHeight) * 0.015, 7.5, 10);
  const centerGapHalf = clamp(safeWidth * 0.04, 24, 36);
  const pivotOffset =
    Math.cos(PINBALL_FLIPPER_REST_ANGLE) * flipperLength + centerGapHalf;
  const centerX = safeWidth / 2;
  const drainY = safeHeight * 0.965;
  const kickbackY = safeHeight * 0.775;

  return {
    width: safeWidth,
    height: safeHeight,
    leftBound,
    rightBound,
    topBound: safeHeight * 0.045,
    drainY,
    slingY: safeHeight * 0.61,
    flipperY,
    flipperLength,
    flipperRadius,
    centerGapHalf,
    leftPivotX: centerX - pivotOffset,
    rightPivotX: centerX + pivotOffset,
    kickbackY,
    kickbackHeight: drainY - kickbackY,
    kickbackWidth: clamp(safeWidth * 0.032, 20, 30),
  };
};

export const createPinballServeVelocity = (
  height: number,
  random: () => number = Math.random,
): { vx: number; vy: number } => {
  const scale = getPinballSpeedScale(height);
  return {
    vx: (-220 + (clamp(random(), 0, 1) - 0.5) * 70) * scale,
    vy: (-620 + (clamp(random(), 0, 1) - 0.5) * 55) * scale,
  };
};

export const capPinballSpeed = (
  body: Pick<PinballBody, 'vx' | 'vy'>,
  maxSpeed = PINBALL_MAX_BALL_SPEED,
): void => {
  const speed = Math.hypot(body.vx, body.vy);
  if (speed <= maxSpeed || speed < 0.0001) return;
  const scale = maxSpeed / speed;
  body.vx *= scale;
  body.vy *= scale;
};

export const closestPointOnSegment = (
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number; t: number; distance: number } => {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq > 0
    ? clamp(((x - ax) * dx + (y - ay) * dy) / lengthSq, 0, 1)
    : 0;
  const nearX = ax + dx * t;
  const nearY = ay + dy * t;

  return {
    x: nearX,
    y: nearY,
    t,
    distance: Math.hypot(x - nearX, y - nearY),
  };
};

export const resolveCircleCircle = (
  body: PinballBody,
  centerX: number,
  centerY: number,
  obstacleRadius: number,
  restitution = 0.86,
): PinballCollision | null => {
  let dx = body.x - centerX;
  let dy = body.y - centerY;
  let distance = Math.hypot(dx, dy);
  const minimumDistance = body.radius + obstacleRadius;
  if (distance >= minimumDistance) return null;

  if (distance < 0.0001) {
    const speed = Math.hypot(body.vx, body.vy);
    dx = speed > 0.0001 ? -body.vx / speed : 0;
    dy = speed > 0.0001 ? -body.vy / speed : -1;
    distance = 0;
  }

  const normalLength = Math.hypot(dx, dy) || 1;
  const normalX = dx / normalLength;
  const normalY = dy / normalLength;
  const penetration = minimumDistance - distance;
  body.x += normalX * (penetration + 0.25);
  body.y += normalY * (penetration + 0.25);

  const normalVelocity = body.vx * normalX + body.vy * normalY;
  if (normalVelocity < 0) {
    body.vx -= (1 + restitution) * normalVelocity * normalX;
    body.vy -= (1 + restitution) * normalVelocity * normalY;
  }

  return { normalX, normalY, penetration, contactT: 0 };
};

export const resolveCircleSegment = (
  body: PinballBody,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  segmentRadius: number,
  restitution = 0.82,
  surfaceVx = 0,
  surfaceVy = 0,
): PinballCollision | null => {
  const closest = closestPointOnSegment(body.x, body.y, ax, ay, bx, by);
  const minimumDistance = body.radius + segmentRadius;
  if (closest.distance >= minimumDistance) return null;

  let normalX = body.x - closest.x;
  let normalY = body.y - closest.y;
  const distance = Math.hypot(normalX, normalY);
  if (distance < 0.0001) {
    const segmentX = bx - ax;
    const segmentY = by - ay;
    const segmentLength = Math.hypot(segmentX, segmentY) || 1;
    normalX = -segmentY / segmentLength;
    normalY = segmentX / segmentLength;
    if ((body.vx - surfaceVx) * normalX + (body.vy - surfaceVy) * normalY > 0) {
      normalX *= -1;
      normalY *= -1;
    }
  } else {
    normalX /= distance;
    normalY /= distance;
  }

  const penetration = minimumDistance - closest.distance;
  body.x += normalX * (penetration + 0.25);
  body.y += normalY * (penetration + 0.25);

  let relativeVx = body.vx - surfaceVx;
  let relativeVy = body.vy - surfaceVy;
  const normalVelocity = relativeVx * normalX + relativeVy * normalY;
  if (normalVelocity < 0) {
    relativeVx -= (1 + restitution) * normalVelocity * normalX;
    relativeVy -= (1 + restitution) * normalVelocity * normalY;
    body.vx = relativeVx + surfaceVx;
    body.vy = relativeVy + surfaceVy;
  }

  return {
    normalX,
    normalY,
    penetration,
    contactT: closest.t,
  };
};

export const resolveCircleAabb = (
  body: PinballBody,
  x: number,
  y: number,
  width: number,
  height: number,
  restitution = 0.78,
): PinballCollision | null => {
  const nearX = clamp(body.x, x, x + width);
  const nearY = clamp(body.y, y, y + height);
  const dx = body.x - nearX;
  const dy = body.y - nearY;
  const distance = Math.hypot(dx, dy);
  if (distance >= body.radius) return null;

  let normalX: number;
  let normalY: number;
  let penetration: number;

  if (distance < 0.0001) {
    const edge = [
      { value: body.x - x, nx: -1, ny: 0 },
      { value: x + width - body.x, nx: 1, ny: 0 },
      { value: body.y - y, nx: 0, ny: -1 },
      { value: y + height - body.y, nx: 0, ny: 1 },
    ].sort((a, b) => a.value - b.value)[0];
    normalX = edge.nx;
    normalY = edge.ny;
    penetration = body.radius + Math.max(0, edge.value);
  } else {
    normalX = dx / distance;
    normalY = dy / distance;
    penetration = body.radius - distance;
  }

  body.x += normalX * (penetration + 0.25);
  body.y += normalY * (penetration + 0.25);

  const normalVelocity = body.vx * normalX + body.vy * normalY;
  if (normalVelocity < 0) {
    body.vx -= (1 + restitution) * normalVelocity * normalX;
    body.vy -= (1 + restitution) * normalVelocity * normalY;
  }

  return { normalX, normalY, penetration, contactT: 0 };
};

export const consumePinballKickback = (
  active: boolean,
): { triggered: boolean; active: boolean } =>
  active
    ? { triggered: true, active: false }
    : { triggered: false, active: false };

export const resolvePinballDrain = ({
  ballsRemaining,
  lives,
  ballSaverSeconds,
  ballSaverAvailable,
}: PinballDrainInput): PinballDrainResult => {
  if (ballsRemaining > 0) {
    return { action: 'continue', lives, ballSaverAvailable };
  }

  if (ballSaverAvailable && ballSaverSeconds > 0) {
    return { action: 'ball-save', lives, ballSaverAvailable: false };
  }

  const nextLives = Math.max(0, lives - 1);
  return {
    action: nextLives <= 0 ? 'game-over' : 'new-life',
    lives: nextLives,
    ballSaverAvailable: false,
  };
};
