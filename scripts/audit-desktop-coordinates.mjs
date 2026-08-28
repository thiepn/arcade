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

for (const file of ['BreakoutGame.tsx', 'ChainGame.tsx', 'TowerGame.tsx']) {
  const source = read(`src/games/${file}`);
  assert(source.includes("../lib/gameCoordinates"), `${file} is not using the shared coordinate layer`);
  assert(source.includes('viewportWidth:'), `${file} does not retain its current logical viewport`);
  assert(source.includes('viewportHeight:'), `${file} does not retain its current logical height`);
  assert(source.includes('onResize: (w, h)'), `${file} does not remap active state on resize`);
}

const breakout = read('src/games/BreakoutGame.tsx');
assert(breakout.includes('rescaleTrail(ball.trail'), 'Breakout ball trails are not remapped');
assert(breakout.includes('brick.x *= scaleX'), 'Breakout bricks are not horizontally remapped');
assert(breakout.includes('brick.y *= scaleY'), 'Breakout bricks are not vertically remapped');

const chain = read('src/games/ChainGame.tsx');
assert(chain.includes('particle.maxExplosionRadius *= uniformScale'), 'Chain explosion radii are not resized');
assert(chain.includes('arc.x2 *= scaleX'), 'Chain lightning endpoints are not remapped');

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
  'Desktop-coordinate audit passed: shared ResizeObserver canvas sizing and responsive Breakout, Chain, and Tower world remapping are active.',
);
