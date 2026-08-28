import { readFileSync } from 'node:fs';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const game = readFileSync('src/games/LaserRopeGame.tsx', 'utf8');
const startPanel = readFileSync('src/components/LaserRopeStartPanel.tsx', 'utf8');
const shell = readFileSync('src/components/GameShell.tsx', 'utf8');
const registry = readFileSync('src/data/games.ts', 'utf8');

for (const token of [
  'LaserRopeStartPanel',
  'hasStartedRef',
  'hasStartedRef.current',
  'setHasStarted(true)',
  'SYSTEM LIVE',
  'LOW / DUAL = JUMP',
  'state.isAlive && hasStartedRef.current',
  'setSafeTimeout(() => onGameOver(state.score), 650)',
  'deathPresentationTimer = 0.7',
  'SPACE / ↑ · LOW',
  'S / ↓ · HIGH',
]) {
  assert(game.includes(token), `LaserRopeGame is missing Phase C token: ${token}`);
}

for (const token of [
  'LASER ROPE',
  'READ · REACT · SURVIVE',
  'LOW',
  'DUAL',
  'HIGH',
  'SPACE · W · ↑',
  'S · ↓',
  'Warning rings announce new beam patterns',
  'START RUN',
  'PRESS SPACE / ENTER OR TAP START',
]) {
  assert(startPanel.includes(token), `Laser Rope start briefing is missing token: ${token}`);
}

for (const token of [
  "const isLaserRope = game.id === 'laserrope'",
  'SYSTEM PAUSED',
  'Reflex Protocol',
  'RUN TERMINATED',
  'REFLEX GRADE',
  "if (score >= 12000) return 'S+'",
  "if (score >= 8000) return 'S'",
  "if (score >= 5000) return 'A'",
  "if (score >= 2500) return 'B'",
]) {
  assert(shell.includes(token), `GameShell is missing Laser Rope Phase C token: ${token}`);
}

assert(
  registry.includes("controlsHint: 'Jump: Space / W / ↑ • Slide: S / ↓ • Tap Buttons'"),
  'Laser Rope registry controls do not explain both jump and slide',
);
assert(
  registry.includes('Watch the warning rings before patterns change.'),
  'Laser Rope instructions do not explain pattern telegraphs',
);

// Phase C must not rewrite the certified core timing/physics rules.
for (const token of [
  'state.playerVY = state.jumpCount === 0 ? 560 : 480',
  'const gravity = 1450',
  'state.playerVY = -750',
  'state.speedTarget = Math.min(5.4, 2.2 + state.jumpStreak * 0.1)',
  'if (state.playerY > 24)',
  'if (state.jumpStreak >= 20) state.multiplier = 4',
]) {
  assert(game.includes(token), `Phase C changed a certified gameplay rule: ${token}`);
}

assert(
  game.includes('min-h-0') && game.includes('sm:min-w-[150px]'),
  'Phase C controls are not mobile/desktop responsive',
);

if (errors.length) {
  console.error('Laser Rope Reflex Phase C audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Laser Rope Reflex Phase C audit passed: start briefing, pause protocol, game-over grading, polished controls, warning guidance, responsive layout, and preservation of certified gameplay mechanics are active.',
);
