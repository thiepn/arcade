export interface PacDirection {
  x: number;
  y: number;
}

export interface PacMover {
  px: number;
  py: number;
  dirX: number;
  dirY: number;
  nextDirX: number;
  nextDirY: number;
}

export type PacWallCheck = (row: number, col: number) => boolean;

export const PAC_TURN_GRACE_TILES = 0.18;
export const PAC_MAX_ADVANCE_ITERATIONS = 32;

const KEY_DIRECTIONS: Readonly<Record<string, PacDirection>> = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

const isCardinalDirection = (x: number, y: number): boolean =>
  Math.abs(x) + Math.abs(y) === 1;

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

export const getPacDirectionForCode = (code: string): PacDirection | null =>
  KEY_DIRECTIONS[code] ?? null;

export const shouldCapturePacKey = (event: KeyboardEvent): boolean =>
  Boolean(getPacDirectionForCode(event.code)) &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !isEditableTarget(event.target);

export const queuePacDirection = (
  mover: PacMover,
  directionX: number,
  directionY: number,
): boolean => {
  if (!isCardinalDirection(directionX, directionY)) return false;

  mover.nextDirX = directionX;
  mover.nextDirY = directionY;

  const isImmediateReverse =
    mover.dirX === -directionX && mover.dirY === -directionY;
  if (isImmediateReverse) {
    mover.dirX = directionX;
    mover.dirY = directionY;
  }

  return isImmediateReverse;
};

const canMoveFromCenter = (
  row: number,
  col: number,
  directionX: number,
  directionY: number,
  isWall: PacWallCheck,
): boolean =>
  isCardinalDirection(directionX, directionY) &&
  !isWall(row + directionY, col + directionX);

const applyQueuedDirectionAtCenter = (
  mover: PacMover,
  row: number,
  col: number,
  isWall: PacWallCheck,
): boolean => {
  if (
    !canMoveFromCenter(
      row,
      col,
      mover.nextDirX,
      mover.nextDirY,
      isWall,
    )
  ) {
    return false;
  }

  mover.dirX = mover.nextDirX;
  mover.dirY = mover.nextDirY;
  return true;
};

export const tryPacBufferedTurn = (
  mover: PacMover,
  isWall: PacWallCheck,
  graceTiles = PAC_TURN_GRACE_TILES,
): boolean => {
  if (!isCardinalDirection(mover.nextDirX, mover.nextDirY)) return false;

  const sameDirection =
    mover.dirX === mover.nextDirX && mover.dirY === mover.nextDirY;
  if (sameDirection) return false;

  const reverseDirection =
    mover.dirX === -mover.nextDirX && mover.dirY === -mover.nextDirY;
  if (reverseDirection) {
    mover.dirX = mover.nextDirX;
    mover.dirY = mover.nextDirY;
    return true;
  }

  const col = Math.round(mover.px);
  const row = Math.round(mover.py);
  const horizontalOffset = Math.abs(mover.px - col);
  const verticalOffset = Math.abs(mover.py - row);
  const movingHorizontally = mover.dirX !== 0;
  const movingVertically = mover.dirY !== 0;

  const withinTurnWindow =
    (!movingHorizontally && !movingVertically &&
      horizontalOffset <= graceTiles && verticalOffset <= graceTiles) ||
    (movingHorizontally &&
      horizontalOffset <= graceTiles && verticalOffset <= graceTiles) ||
    (movingVertically &&
      verticalOffset <= graceTiles && horizontalOffset <= graceTiles);

  if (!withinTurnWindow) return false;
  if (!applyQueuedDirectionAtCenter(mover, row, col, isWall)) return false;

  mover.px = col;
  mover.py = row;
  return true;
};

const wrapPacTunnelX = (x: number, cols: number): number => {
  const leftEdge = -0.5;
  const rightEdge = cols - 0.5;
  if (x < leftEdge) return x + cols;
  if (x > rightEdge) return x - cols;
  return x;
};

export const advancePacMover = (
  mover: PacMover,
  distanceTiles: number,
  isWall: PacWallCheck,
  cols: number,
  graceTiles = PAC_TURN_GRACE_TILES,
): void => {
  if (!Number.isFinite(distanceTiles) || distanceTiles <= 0 || cols <= 0) return;

  tryPacBufferedTurn(mover, isWall, graceTiles);

  let remaining = distanceTiles;
  let iterations = 0;
  const epsilon = 1e-7;

  while (remaining > epsilon && iterations < PAC_MAX_ADVANCE_ITERATIONS) {
    iterations++;

    if (!isCardinalDirection(mover.dirX, mover.dirY)) {
      if (!tryPacBufferedTurn(mover, isWall, graceTiles)) break;
    }

    const centerCol = Math.round(mover.px);
    const centerRow = Math.round(mover.py);
    const atCenter =
      Math.abs(mover.px - centerCol) <= epsilon &&
      Math.abs(mover.py - centerRow) <= epsilon;

    if (atCenter) {
      mover.px = centerCol;
      mover.py = centerRow;
      applyQueuedDirectionAtCenter(mover, centerRow, centerCol, isWall);

      if (
        !canMoveFromCenter(
          centerRow,
          centerCol,
          mover.dirX,
          mover.dirY,
          isWall,
        )
      ) {
        mover.dirX = 0;
        mover.dirY = 0;
        break;
      }
    }

    if (mover.dirX !== 0) mover.py = Math.round(mover.py);
    if (mover.dirY !== 0) mover.px = Math.round(mover.px);

    let distanceToCenter: number;
    let destinationCenter: number;

    if (mover.dirX > 0) {
      destinationCenter = Math.floor(mover.px + epsilon) + 1;
      distanceToCenter = destinationCenter - mover.px;
    } else if (mover.dirX < 0) {
      destinationCenter = Math.ceil(mover.px - epsilon) - 1;
      distanceToCenter = mover.px - destinationCenter;
    } else if (mover.dirY > 0) {
      destinationCenter = Math.floor(mover.py + epsilon) + 1;
      distanceToCenter = destinationCenter - mover.py;
    } else {
      destinationCenter = Math.ceil(mover.py - epsilon) - 1;
      distanceToCenter = mover.py - destinationCenter;
    }

    if (distanceToCenter <= epsilon) continue;

    const step = Math.min(remaining, distanceToCenter);
    mover.px += mover.dirX * step;
    mover.py += mover.dirY * step;
    mover.px = wrapPacTunnelX(mover.px, cols);
    remaining -= step;

    if (step + epsilon < distanceToCenter) continue;

    if (mover.dirX !== 0) {
      const wrappedCenter = wrapPacTunnelX(destinationCenter, cols);
      mover.px = wrappedCenter;
      mover.py = Math.round(mover.py);
    } else {
      mover.py = destinationCenter;
      mover.px = Math.round(mover.px);
    }

    const row = Math.round(mover.py);
    const col = Math.round(mover.px);
    applyQueuedDirectionAtCenter(mover, row, col, isWall);

    if (!canMoveFromCenter(row, col, mover.dirX, mover.dirY, isWall)) {
      mover.dirX = 0;
      mover.dirY = 0;
      break;
    }
  }
};
