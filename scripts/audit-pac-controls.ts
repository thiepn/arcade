import { readFileSync } from 'node:fs';
import {
  PAC_MAX_ADVANCE_ITERATIONS,
  PAC_TURN_GRACE_TILES,
  advancePacMover,
  getPacDirectionForCode,
  queuePacDirection,
  type PacMover,
} from '../src/lib/pacMazeControls';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const expectedKeys: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

for (const [code, [x, y]] of Object.entries(expectedKeys)) {
  const direction = getPacDirectionForCode(code);
  assert(Boolean(direction), `${code} is not mapped`);
  assert(direction?.x === x && direction?.y === y, `${code} maps to the wrong direction`);
}
assert(getPacDirectionForCode('KeyF') === null, 'unrelated keys must not control Pac-Runner');
assert(PAC_TURN_GRACE_TILES >= 0.15, 'intersection turn grace is too small');
assert(PAC_MAX_ADVANCE_ITERATIONS >= 16, 'large-frame movement loop is too shallow');

const openMaze = () => false;

const reverseMover: PacMover = {
  px: 5.42,
  py: 4,
  dirX: 1,
  dirY: 0,
  nextDirX: 1,
  nextDirY: 0,
};
const reversedImmediately = queuePacDirection(reverseMover, -1, 0);
assert(reversedImmediately, 'opposite input was not recognized as an immediate reversal');
assert(reverseMover.dirX === -1 && reverseMover.dirY === 0, 'mid-corridor reversal was delayed');

const queuedCorner: PacMover = {
  px: 1.7,
  py: 1,
  dirX: 1,
  dirY: 0,
  nextDirX: 0,
  nextDirY: 1,
};
advancePacMover(queuedCorner, 0.5, openMaze, 19);
assert(Math.abs(queuedCorner.px - 2) < 1e-6, 'queued corner did not snap to the intersection center');
assert(queuedCorner.py > 1, 'queued turn did not continue through the new corridor');
assert(queuedCorner.dirX === 0 && queuedCorner.dirY === 1, 'queued turn selected the wrong direction');

const lateCorner: PacMover = {
  px: 2.12,
  py: 1,
  dirX: 1,
  dirY: 0,
  nextDirX: 0,
  nextDirY: 1,
};
advancePacMover(lateCorner, 0.1, openMaze, 19);
assert(Math.abs(lateCorner.px - 2) < 1e-6, 'late intersection input was not centered');
assert(lateCorner.py > 1, 'late intersection input did not receive the turn grace window');

const blockedTurn: PacMover = {
  px: 1.7,
  py: 1,
  dirX: 1,
  dirY: 0,
  nextDirX: 0,
  nextDirY: 1,
};
const downFromSecondColumnIsBlocked = (row: number, col: number) => row === 2 && col === 2;
advancePacMover(blockedTurn, 0.5, downFromSecondColumnIsBlocked, 19);
assert(blockedTurn.px > 2, 'blocked queued turn stopped valid forward movement');
assert(blockedTurn.dirX === 1 && blockedTurn.dirY === 0, 'blocked queued turn changed direction');
assert(
  blockedTurn.nextDirX === 0 && blockedTurn.nextDirY === 1,
  'blocked direction was not retained for the next valid intersection',
);

const wallStop: PacMover = {
  px: 1,
  py: 1,
  dirX: 1,
  dirY: 0,
  nextDirX: 1,
  nextDirY: 0,
};
const wallAtThirdColumn = (_row: number, col: number) => col === 3;
advancePacMover(wallStop, 2.5, wallAtThirdColumn, 19);
assert(Math.abs(wallStop.px - 2) < 1e-6, 'large frame tunneled through a wall');
assert(wallStop.dirX === 0 && wallStop.dirY === 0, 'player did not stop at the blocked tile center');

const tunnelMover: PacMover = {
  px: 0,
  py: 10,
  dirX: -1,
  dirY: 0,
  nextDirX: -1,
  nextDirY: 0,
};
advancePacMover(tunnelMover, 1, openMaze, 19);
assert(Math.abs(tunnelMover.px - 18) < 1e-6, 'left tunnel wrap did not preserve tile-distance movement');

const source = readFileSync('src/games/PacMazeGame.tsx', 'utf8');
for (const token of [
  'getPacDirectionForCode',
  'shouldCapturePacKey',
  'queuePacDirection',
  'advancePacMover',
  "window.addEventListener('keydown', handleKeyDown, true)",
  'event.preventDefault()',
]) {
  assert(source.includes(token), `PacMazeGame is missing required control token: ${token}`);
}
assert(!source.includes('const alignThreshold = 0.22'), 'old frame-sensitive turn threshold returned');
assert(
  !source.includes("if (e.code === 'ArrowUp' || e.code === 'KeyW')"),
  'duplicated inline keyboard mapping returned',
);

if (errors.length) {
  console.error('Cyber Pac-Runner control audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Cyber Pac-Runner control audit passed: captured WASD/arrows, immediate reversals, buffered and late intersection turns, blocked-input retention, wall stopping, and tunnel wrapping are certified.',
);
