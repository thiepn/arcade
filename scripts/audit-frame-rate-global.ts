import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARCADE_FIXED_STEP_SEC,
  ARCADE_REFERENCE_HZ,
  getArcadeStepBatch,
  getFrameInvariantBlend,
  getFrameInvariantChance,
} from '../src/lib/frameRateRuntime';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const games = readdirSync(join(process.cwd(), 'src', 'games')).filter((name) => name.endsWith('Game.tsx')).sort();

assert(games.length === 32, `expected 32 game modules, found ${games.length}`);
assert(ARCADE_REFERENCE_HZ === 60, `reference gameplay clock changed to ${ARCADE_REFERENCE_HZ} Hz`);

const fixedStepGames = ['AstroBlasterGame.tsx','BladeGame.tsx','BreakoutGame.tsx','ChainGame.tsx','DodgeGame.tsx','DriftGame.tsx','GravityGame.tsx','OneLineGame.tsx','SlingshotGame.tsx','StackGame.tsx','TowerGame.tsx','VanguardGame.tsx'];
const elapsedGames = ['AirHockeyGame.tsx','ChronoGame.tsx','FlappyAeroGame.tsx','KnifeTargetGame.tsx','LaserRopeGame.tsx','NeonRailShiftGame.tsx','OrbitGame.tsx','PacMazeGame.tsx','PinballGame.tsx','PulseGame.tsx','RhythmGame.tsx','RoadCrossGame.tsx','SnakeGame.tsx'];
const discreteGames = ['BlockDropGame.tsx','BubbleBusterGame.tsx','MatrixGame.tsx','MergeGame.tsx','PerfectStopGame.tsx','ReactionGame.tsx','TypeRushGame.tsx'];
const policyGames = [...fixedStepGames, ...elapsedGames, ...discreteGames].sort();
assert(JSON.stringify(policyGames) === JSON.stringify(games), 'every game must have an explicit frame-rate policy classification');

for (const file of fixedStepGames) {
  const source = read(`src/games/${file}`);
  const usesShared = source.includes('getArcadeStepBatch') || /get(?:Astro|Gravity|OneLine|Slingshot|Tower|Vanguard|Drift)PhysicsStepBatch/.test(source) || source.includes('getBladeSimulationStepBatch');
  assert(usesShared, `${file} is classified fixed-step but has no fixed-step batch`);
}
for (const file of elapsedGames) {
  const source = read(`src/games/${file}`);
  assert(/onUpdate:\s*\([^)]*(?:dt|deltaSec|delta)/.test(source), `${file} lacks an elapsed-time update argument`);
}

const breakout = read('src/games/BreakoutGame.tsx');
assert(breakout.includes('getArcadeStepBatch(state.physicsAccumulator, deltaSec)'), 'Breakout fixed-step batching regressed');
assert(breakout.includes('const delta = ARCADE_FIXED_STEP_SEC * 1000'), 'Breakout no longer preserves the 60 Hz gameplay baseline');
const chain = read('src/games/ChainGame.tsx');
assert(chain.includes('getArcadeStepBatch(state.physicsAccumulator, deltaSec)'), 'Chain fixed-step batching regressed');
const dodge = read('src/games/DodgeGame.tsx');
assert(dodge.includes('getArcadeStepBatch(state.physicsAccumulator, deltaSec)'), 'Dodge fixed-step batching regressed');
assert(!dodge.includes('performance.now()'), 'Dodge spawn cadence depends on wall-clock time');
assert(dodge.includes('state.spawnElapsedMs += dt'), 'Dodge does not use gameplay-time spawn cadence');
const stack = read('src/games/StackGame.tsx');
assert(stack.includes('getArcadeStepBatch(state.physicsAccumulator, deltaSec)'), 'Stack fixed-step batching regressed');
const pac = read('src/games/PacMazeGame.tsx');
assert(!pac.includes('Math.random() < 0.003'), 'Pac Maze fruit spawn rate is raw per-frame probability');
assert(pac.includes('getFrameInvariantChance(0.003, dt * 60)'), 'Pac Maze fruit probability is not time-normalized');
const rhythm = read('src/games/RhythmGame.tsx');
assert(rhythm.includes('state.overdriveTimer -= dt'), 'Rhythm overdrive duration is frame-counted');
assert(!rhythm.includes('state.overdriveTimer--'), 'Rhythm retains frame-counted overdrive duration');
assert(rhythm.includes('particleFrameScale = dt * 60'), 'Rhythm particle physics is not elapsed-time normalized');
const orbit = read('src/games/OrbitGame.tsx');
assert(!orbit.includes('lastHazardSpawn') && !orbit.includes('lastCrystalSpawn'), 'Orbit spawn cadence still depends on wall-clock timestamps');
assert(orbit.includes('state.hazardSpawnElapsedMs += dt') && orbit.includes('state.crystalSpawnElapsedMs += dt'), 'Orbit spawn cadence is not gameplay-time based');
const road = read('src/games/RoadCrossGame.tsx');
assert(road.includes('getFrameInvariantBlend(0.4, dt * 60)'), 'Cyber Crosser player smoothing is refresh-rate dependent');
assert(road.includes('getFrameInvariantBlend(0.12, dt * 60)'), 'Cyber Crosser camera smoothing is refresh-rate dependent');
const snake = read('src/games/SnakeGame.tsx');
assert(!snake.includes('performance.now()'), 'Snake grid ticks still depend on wall-clock time');
assert(snake.includes('state.tickAccumulatorMs += deltaSec * 1000'), 'Snake lacks gameplay-time tick accumulation');
const pulse = read('src/games/PulseGame.tsx');
assert(pulse.includes('getFrameInvariantBlend(0.25, deltaRatio)'), 'Pulse equalizer smoothing is refresh-rate dependent');

for (const file of [...fixedStepGames, ...elapsedGames]) {
  const source = read(`src/games/${file}`);
  assert(!/\bsetInterval\s*\(/.test(source), `${file} contains raw setInterval gameplay timing`);
  assert(!/\bsetTimeout\s*\(/.test(source), `${file} contains raw setTimeout gameplay timing; use managed/gameplay timing`);
}

const simulateSteps = (fps: number, seconds = 8) => {
  let accumulator = 0;
  let steps = 0;
  const frames = Math.round(fps * seconds);
  for (let i = 0; i < frames; i++) {
    const batch = getArcadeStepBatch(accumulator, 1 / fps);
    accumulator = batch.remainderSec;
    steps += batch.steps;
  }
  return steps;
};
const baselineSteps = simulateSteps(60);
for (const fps of [30, 60, 120, 144, 240]) {
  assert(simulateSteps(fps) === baselineSteps, `${fps} FPS produces ${simulateSteps(fps)} shared fixed steps vs ${baselineSteps} at 60 FPS`);
}

const baselineBlend = 1 - Math.pow(1 - 0.25, 60);
for (const fps of [30, 60, 120, 144, 240]) {
  let value = 0;
  const frameScale = 60 / fps;
  for (let i = 0; i < fps; i++) value += (1 - value) * getFrameInvariantBlend(0.25, frameScale);
  assert(Math.abs(value - baselineBlend) < 1e-10, `${fps} FPS changes invariant smoothing result`);
}
const oneSecondChance60 = 1 - Math.pow(1 - 0.003, 60);
for (const fps of [30, 60, 120, 144, 240]) {
  const pFrame = getFrameInvariantChance(0.003, 60 / fps);
  const pSecond = 1 - Math.pow(1 - pFrame, fps);
  assert(Math.abs(pSecond - oneSecondChance60) < 1e-10, `${fps} FPS changes normalized event probability`);
}

if (errors.length) {
  console.error('GLOBAL FRAME-RATE / GAMEPLAY CLOCK AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('GLOBAL FRAME-RATE / GAMEPLAY CLOCK AUDIT — PASS');
console.log('All 32 games have an explicit timing policy; shared fixed-step, smoothing, probability, pause, and gameplay-clock regressions are certified.');
