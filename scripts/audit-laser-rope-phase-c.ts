import { existsSync, readFileSync } from 'node:fs';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const game = readFileSync('src/games/LaserRopeGame.tsx', 'utf8');
const shell = readFileSync('src/components/GameShell.tsx', 'utf8');
const registry = readFileSync('src/data/games.ts', 'utf8');

// Laser Rope must behave like another game inside Micro Arcade, not a separate app.
assert(!existsSync('src/components/LaserRopeStartPanel.tsx'), 'standalone Laser Rope start screen returned');
assert(!existsSync('src/components/LaserRopeHud.tsx'), 'standalone Laser Rope HUD returned');
assert(!existsSync('src/lib/laserRopePresentation.ts'), 'standalone Laser Rope presentation renderer returned');
assert(!existsSync('src/lib/laserRopeFeedback.ts'), 'standalone Laser Rope feedback renderer returned');

for (const token of [
  'LaserRopeStartPanel',
  'hasStartedRef',
  'startRun',
  'SYSTEM LIVE',
  'READ · REACT · SURVIVE',
]) {
  assert(!game.includes(token), `Laser Rope regained a pre-game standalone experience: ${token}`);
}

for (const token of [
  "const isLaserRope = game.id === 'laserrope'",
  'SYSTEM PAUSED',
  'Reflex Protocol',
  'RUN TERMINATED',
  'REFLEX GRADE',
]) {
  assert(!shell.includes(token), `shared GameShell contains Laser Rope-only presentation: ${token}`);
}

assert(
  registry.includes("controlsHint: 'Jump: Space / W / ↑ • Slide: S / ↓ • Tap Buttons'"),
  'Laser Rope registry controls do not explain both jump and slide',
);
assert(
  registry.includes('Jump LOW and DUAL sweeps') && registry.includes('Slide under HIGH sweeps'),
  'Laser Rope instructions do not explain the actual jump/slide rules',
);

for (const token of [
  'state.playerVY = state.jumpCount === 0 ? 560 : 480',
  'const gravity = 1450',
  'state.playerVY = -750',
  'state.speedTarget = Math.min(5.4, 2.2 + state.jumpStreak * 0.1)',
  'if (state.playerY > 24)',
  'if (state.jumpStreak >= 20) state.multiplier = 4',
  "e.code === 'Space'",
  "e.code === 'ArrowDown'",
  'min-h-0',
  'flex-1 sm:flex-none',
  'const arenaRadiusX = Math.min(165',
]) {
  assert(game.includes(token), `site-cohesion repair changed or omitted a core Laser Rope rule: ${token}`);
}

assert(!game.includes('min-h-[440px]'), 'Laser Rope returned to a fixed minimum game height');

if (errors.length) {
  console.error('Laser Rope Reflex shell-cohesion audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Laser Rope Reflex shell-cohesion audit passed: no start gate, no custom pause/result shell, no standalone presentation framework, responsive shared-layout controls, correct jump/slide instructions, and the certified core mechanics remain intact.',
);
