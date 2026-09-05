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

export interface PacLevelProtocol {
  id: string;
  label: string;
  scatterSeconds: number;
  chaseSeconds: number;
  speedBonus: number;
  frightenedSeconds: number;
}

// P21 gives successive maze clears a deliberate tactical rhythm without
// changing the classic board or adding a mode. The six protocols cycle with a
// small bounded pressure increase on later cycles, so replay comes from reading
// different chase/scatter emphases rather than raw speed alone.
export const PAC_LEVEL_PROTOCOLS: readonly PacLevelProtocol[] = [
  { id: 'orientation', label: 'ORIENTATION', scatterSeconds: 5.2, chaseSeconds: 11.5, speedBonus: 0, frightenedSeconds: 8.5 },
  { id: 'corner-read', label: 'CORNER READ', scatterSeconds: 4.8, chaseSeconds: 10.8, speedBonus: 0.05, frightenedSeconds: 7.8 },
  { id: 'target-mix', label: 'TARGET MIX', scatterSeconds: 4.4, chaseSeconds: 10.4, speedBonus: 0.08, frightenedSeconds: 7.3 },
  { id: 'switchback', label: 'SWITCHBACK', scatterSeconds: 5.0, chaseSeconds: 9.6, speedBonus: 0.10, frightenedSeconds: 6.8 },
  { id: 'pursuit', label: 'PURSUIT', scatterSeconds: 3.8, chaseSeconds: 9.0, speedBonus: 0.13, frightenedSeconds: 6.2 },
  { id: 'endurance', label: 'ENDURANCE', scatterSeconds: 3.4, chaseSeconds: 8.6, speedBonus: 0.16, frightenedSeconds: 5.7 },
] as const;

export const getPacLevelProtocol = (level: number): PacLevelProtocol => {
  const safeLevel = Math.max(1, Math.floor(level));
  return PAC_LEVEL_PROTOCOLS[(safeLevel - 1) % PAC_LEVEL_PROTOCOLS.length];
};

const getPacProtocolCycle = (level: number): number =>
  Math.floor((Math.max(1, Math.floor(level)) - 1) / PAC_LEVEL_PROTOCOLS.length);

export const getPacGhostMode = (
  levelElapsedSeconds: number,
  level: number,
): PacGhostMode => {
  const protocol = getPacLevelProtocol(level);
  const cyclePressure = getPacProtocolCycle(level);
  const scatterDuration = Math.max(3.2, protocol.scatterSeconds - cyclePressure * 0.15);
  const chaseDuration = Math.max(8.5, protocol.chaseSeconds - cyclePressure * 0.2);
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
  const protocol = getPacLevelProtocol(safeLevel);
  if (frightened) {
    return Math.min(3.3, 2.75 + (safeLevel - 1) * 0.045 + protocol.speedBonus * 0.45);
  }
  return Math.min(5.6, 4.35 + (safeLevel - 1) * 0.14 + protocol.speedBonus);
};

export const getPacFrightenedDuration = (level: number): number => {
  const protocol = getPacLevelProtocol(level);
  const cyclePressure = getPacProtocolCycle(level);
  return Math.max(4.5, protocol.frightenedSeconds - cyclePressure * 0.3);
};
