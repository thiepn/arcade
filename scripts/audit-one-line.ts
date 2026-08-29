import { readFileSync } from 'node:fs';
import {
  ONE_LINE_FIXED_STEP_SEC,
  ONE_LINE_PHYSICS_HZ,
  getOneLineInkBudget,
  getOneLinePhysicsStepBatch,
  remapOneLinePoint,
} from '../src/lib/oneLineRuntime';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};
const source = readFileSync('src/games/OneLineGame.tsx', 'utf8');

assert(ONE_LINE_PHYSICS_HZ === 240, `expected 240 Hz fixed physics, found ${ONE_LINE_PHYSICS_HZ}`);
assert(source.includes('getOneLinePhysicsStepBatch(state.physicsAccumulator, dt)'), 'One Line does not consume elapsed time through fixed-step physics');
assert(!source.includes('const subSteps = 4;'), 'legacy per-render-frame substep loop remains');
assert(source.includes('setSafeTimeout(resetCurrentAttempt, 300)') && source.includes('setSafeTimeout(resetCurrentAttempt, 400)'), 'failed attempts do not preserve the current puzzle');
assert(source.includes('const handleResetLevel = () =>') && source.includes('resetCurrentAttempt();'), 'Clear does not reset only the current attempt');
assert(source.includes('const handleRandomNewLevel = () =>') && source.includes('generateLevel(state.level, w, h);'), 'Random does not explicitly generate a new layout');
assert(!/onResize:\s*\(w, h\)\s*=>\s*\{\s*generateLevel\(/.test(source), 'resize still regenerates the puzzle');
assert(source.includes('state.linePoints = state.linePoints.map') && source.includes('state.obstacles = state.obstacles.map') && source.includes('state.stars = state.stars.map'), 'resize does not remap active puzzle state');
assert(source.includes('getOneLineInkBudget(rect.width, rect.height)'), 'ink budget is not viewport-scaled during drawing');
assert(!source.includes('const maxInkLength = 1100'), 'fixed 1100px ink budget remains');

const referenceInk = getOneLineInkBudget(420, 500);
assert(Math.abs(referenceInk - 1100) < 1e-6, `reference ink changed: ${referenceInk}`);
assert(getOneLineInkBudget(840, 1000) > referenceInk * 1.99, 'ink budget does not scale with viewport diagonal');
assert(getOneLineInkBudget(320, 500) < referenceInk, 'narrow viewport receives an oversized fixed ink budget');

const remapped = remapOneLinePoint({ x: 100, y: 150 }, 400, 600, 800, 300);
assert(remapped.x === 200 && remapped.y === 75, 'resize remapping does not preserve normalized position');

const simulateSteps = (fps: number, seconds = 3) => {
  let accumulator = 0;
  let steps = 0;
  const dt = 1 / fps;
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
    const batch = getOneLinePhysicsStepBatch(accumulator, dt);
    steps += batch.steps;
    accumulator = batch.remainderSec;
  }
  return steps;
};
const expectedSteps = Math.round(3 / ONE_LINE_FIXED_STEP_SEC);
for (const fps of [30, 60, 120, 144, 240]) {
  const steps = simulateSteps(fps);
  assert(Math.abs(steps - expectedSteps) <= 1, `${fps} FPS executes ${steps} physics steps instead of about ${expectedSteps}`);
}

if (errors.length) {
  console.error('ONE LINE FAIRNESS / RESIZE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('ONE LINE FAIRNESS / RESIZE AUDIT — PASS');
console.log('Fixed-step physics, same-puzzle resize/reset behavior, distinct Random/Clear actions, and viewport-scaled ink are certified.');
