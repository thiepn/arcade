import { existsSync, readFileSync } from 'node:fs';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const game = readFileSync('src/games/LaserRopeGame.tsx', 'utf8');
const shell = readFileSync('src/components/GameShell.tsx', 'utf8');

for (const removedPath of [
  'src/components/LaserRopeStartPanel.tsx',
  'src/components/LaserRopeHud.tsx',
  'src/lib/laserRopePresentation.ts',
  'src/lib/laserRopeFeedback.ts',
]) {
  assert(!existsSync(removedPath), `bespoke Laser Rope presentation file returned: ${removedPath}`);
}

for (const token of [
  'LaserRopeStartPanel',
  'LaserRopeHud',
  'laserRopePresentation',
  'laserRopeFeedback',
  'drawLaserRopeBackground',
  'drawLaserRopeArenaFrame',
  'drawLaserRopePlayerNode',
  'hasStartedRef',
  'SYSTEM LIVE',
  'START RUN',
]) {
  assert(!game.includes(token), `Laser Rope regained standalone presentation token: ${token}`);
}

for (const token of [
  'const centerX = w / 2',
  'const groundY = h * 0.72',
  '<canvas ref={canvasRef}',
  'ArrowUp',
  'ArrowDown',
  'feverPercent',
  'STREAK:',
  'SPEED:',
  'JUMP',
  'SLIDE / DUCK',
  'touch-none',
]) {
  assert(game.includes(token), `site-cohesive Laser Rope implementation is missing: ${token}`);
}

for (const token of [
  "const isLaserRope = game.id === 'laserrope'",
  'SYSTEM PAUSED',
  'Reflex Protocol',
  'RUN TERMINATED',
  'REFLEX GRADE',
]) {
  assert(!shell.includes(token), `GameShell regained Laser Rope-only UI: ${token}`);
}

for (const token of ['GAME PAUSED', 'How To Play', 'SESSION COMPLETE']) {
  assert(shell.includes(token), `shared GameShell presentation is missing: ${token}`);
}

if (errors.length) {
  console.error('Laser Rope Reflex site-cohesion audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Laser Rope Reflex site-cohesion audit passed: the game uses the shared arcade shell and inline canvas/HUD language, with no bespoke start screen, HUD framework, or game-specific pause/result UI.',
);
