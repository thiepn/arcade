export type PacGhostMode = 'CHASE' | 'SCATTER';

export interface PacGhostTargetEntity {
  id: number;
  x: number;
  y: number;
  scatterX: number;
  scatterY: number;
}

export interface PacPlayerTargetState {
  px: number;
  py: number;
  dirX: number;
  dirY: number;
}

export const getPacGhostMode = (
  levelElapsedSeconds: number,
  level: number,
): PacGhostMode => {
  const safeLevel = Math.max(1, Math.floor(level));
  const scatterDuration = Math.max(3.2, 5.2 - (safeLevel - 1) * 0.22);
  const chaseDuration = Math.max(8.5, 11.5 - (safeLevel - 1) * 0.18);
  const cycle = scatterDuration + chaseDuration;
  const position = Math.max(0, levelElapsedSeconds) % cycle;
  return position < scatterDuration ? 'SCATTER' : 'CHASE';
};

export const getPacGhostTarget = (
  ghost: PacGhostTargetEntity,
  ghosts: readonly PacGhostTargetEntity[],
  player: PacPlayerTargetState,
  mode: PacGhostMode,
): { x: number; y: number } => {
  if (mode === 'SCATTER') {
    return { x: ghost.scatterX, y: ghost.scatterY };
  }

  if (ghost.id === 1) {
    return {
      x: player.px + player.dirX * 4,
      y: player.py + player.dirY * 4,
    };
  }

  if (ghost.id === 2) {
    const blinky = ghosts.find((candidate) => candidate.id === 0) ?? ghosts[0] ?? ghost;
    const aheadX = player.px + player.dirX * 2;
    const aheadY = player.py + player.dirY * 2;
    return {
      x: aheadX * 2 - blinky.x,
      y: aheadY * 2 - blinky.y,
    };
  }

  if (ghost.id === 3) {
    const distance = Math.hypot(ghost.x - player.px, ghost.y - player.py);
    if (distance < 6) {
      return { x: ghost.scatterX, y: ghost.scatterY };
    }
  }

  return { x: player.px, y: player.py };
};

export const getPacGhostSpeed = (level: number, frightened: boolean): number => {
  const safeLevel = Math.max(1, Math.floor(level));
  if (frightened) return Math.min(3.3, 2.75 + (safeLevel - 1) * 0.06);
  return Math.min(5.6, 4.35 + (safeLevel - 1) * 0.17);
};

export const getPacFrightenedDuration = (level: number): number =>
  Math.max(4.5, 8.5 - (Math.max(1, Math.floor(level)) - 1) * 0.55);
