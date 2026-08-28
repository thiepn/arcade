import { existsSync, readFileSync } from 'node:fs';

const errors = [];
const read = (path) => readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

assert(existsSync('src/lib/gameCoordinates.ts'), 'shared game-coordinate helpers are missing');

const loop = read('src/hooks/useGameLoop.ts');
assert(loop.includes('ResizeObserver'), 'game loop must observe parent-size changes');
assert(loop.includes('createGameResizeInfo'), 'game loop must expose normalized resize metadata');
assert(loop.includes('ctx.setTransform(dpr'), 'game loop must reset the DPR transform each frame');
assert(loop.includes('getBoundingClientRect'), 'game loop must measure the rendered game stage');

const responsiveGames = [
  'AirHockeyGame.tsx',
  'AstroBlasterGame.tsx',
  'BladeGame.tsx',
  'BreakoutGame.tsx',
  'ChainGame.tsx',
  'DodgeGame.tsx',
  'StackGame.tsx',
  'TowerGame.tsx',
];

for (const file of responsiveGames) {
  const source = read(`src/games/${file}`);
  assert(source.includes("../lib/gameCoordinates"), `${file} is not using the shared coordinate layer`);
  assert(source.includes('onResize: (w'), `${file} does not remap active state on resize`);
}

const airHockey = read('src/games/AirHockeyGame.tsx');
assert(airHockey.includes('rescaleTrail(state.puckTrail'), 'Air Hockey puck trail is not remapped');
assert(airHockey.includes('state.playerMallet.y = clamp'), 'Air Hockey mallets are not constrained after resize');

const astro = read('src/games/AstroBlasterGame.tsx');
assert(astro.includes('rescalePoint(state.ship'), 'Astro Blaster ship is not remapped');
assert(astro.includes('asteroid.vertices'), 'Astro Blaster asteroid geometry is not resized');

const blade = read('src/games/BladeGame.tsx');
assert(blade.includes('createBladeLaunchTrajectory'), 'Blade does not use the certified height-aware launcher');
assert(blade.includes('flightTimeScale'), 'Blade active trajectories are not preserved through resize');
assert(blade.includes('getBladeGravity(h)'), 'Blade gravity is not arena-height-aware');

const breakout = read('src/games/BreakoutGame.tsx');
assert(breakout.includes('rescaleTrail(ball.trail'), 'Breakout ball trails are not remapped');
assert(breakout.includes('brick.x *= scaleX'), 'Breakout bricks are not horizontally remapped');
assert(breakout.includes('brick.y *= scaleY'), 'Breakout bricks are not vertically remapped');

const chain = read('src/games/ChainGame.tsx');
assert(chain.includes('particle.maxExplosionRadius *= uniformScale'), 'Chain explosion radii are not resized');
assert(chain.includes('arc.x2 *= scaleX'), 'Chain lightning endpoints are not remapped');

const dodge = read('src/games/DodgeGame.tsx');
assert(dodge.includes('needsInitialPlacement'), 'Dodge player is not initialized from the measured arena');
assert(dodge.includes('rescaleTrail(state.ghostTrail'), 'Dodge ghost trail is not remapped');

const stack = read('src/games/StackGame.tsx');
assert(stack.includes('state.viewportWidth + state.currentWidth'), 'Stack still uses a fixed right rail edge');
assert(
  stack.includes('Math.max(220, state.viewportWidth * 0.45)'),
  'Stack mobile perfect-streak width reward is not preserved',
);

const tower = read('src/games/TowerGame.tsx');
assert(tower.includes('curW / 420'), 'Tower desktop movement speed is not width-aware');
assert(tower.includes('platform.x *= scaleX'), 'Tower platforms are not horizontally remapped');
assert(tower.includes('drone.maxX *= scaleX'), 'Tower drone bounds are not horizontally remapped');

if (errors.length) {
  console.error('Desktop-coordinate audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Desktop-coordinate audit passed: shared ResizeObserver sizing and ${responsiveGames.length} responsive game-world migrations are active.`,
);
