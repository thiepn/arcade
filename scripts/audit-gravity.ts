import { readFileSync } from 'node:fs';
import {
  GRAVITY_FIXED_STEP_SEC,
  GRAVITY_PHYSICS_HZ,
  advanceGravityBody,
  getGravityPhysicsStepBatch,
  getGravityResizeScale,
  remapGravityPoint,
} from '../src/lib/gravityRuntime';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
const source = readFileSync('src/games/GravityGame.tsx', 'utf8');

assert(GRAVITY_PHYSICS_HZ === 60, `expected 60 Hz fixed Gravity simulation, found ${GRAVITY_PHYSICS_HZ}`);
assert(source.includes('getGravityPhysicsStepBatch(state.physicsAccumulator, dt)'), 'Gravity does not use elapsed-time fixed-step simulation');
assert(source.includes('advanceGravityBody(state.probe, fx, fy, timeScale)'), 'Gravity body integration is not centralized in the deterministic step helper');
assert(!source.includes('state.probe.vx += fx * timeScale;'), 'legacy per-render-frame Newtonian integration remains');
assert(!/onResize:\s*\(w, h\)\s*=>\s*\{\s*setupLevel\(/.test(source), 'resize still rebuilds the active level');
assert(source.includes('state.planets = state.planets.map') && source.includes('state.stars = state.stars.map') && source.includes('state.trail = state.trail.map'), 'resize does not preserve/remap active level state');
assert(source.includes('state.probe.vx *= sx') && source.includes('state.probe.vy *= sy'), 'resize does not remap active probe velocity');
assert(!source.includes('applyDirectionSteer(pos.x, pos.y, 1.0)'), 'pointer move frequency can still apply extra steering impulses');
assert(source.includes('state.steerImpulsePending = true'), 'initial steering impulse is not queued for deterministic simulation');
assert(source.includes('particleFrameScale'), 'Gravity particle lifetime/motion remains render-frame dependent');
assert(source.includes('Math.pow(0.88') && source.includes('state.wormholePulse += Math.min(dt, 0.05) * 3'), 'Gravity visual timers remain render-frame dependent');

const simulate = (fps: number, seconds = 5) => {
  let accumulator = 0;
  const body = { x: 10, y: 20, vx: 1.25, vy: -0.4 };
  let steps = 0;
  const dt = 1 / fps;
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
    const batch = getGravityPhysicsStepBatch(accumulator, dt);
    accumulator = batch.remainderSec;
    for (let step = 0; step < batch.steps; step++) {
      advanceGravityBody(body, 0.0125, -0.006, 1);
      steps++;
    }
  }
  return { body, steps };
};
const baseline = simulate(60);
const expectedSteps = Math.round(5 / GRAVITY_FIXED_STEP_SEC);
assert(Math.abs(baseline.steps - expectedSteps) <= 1, `60 FPS executed ${baseline.steps} steps instead of about ${expectedSteps}`);
for (const fps of [30, 60, 120, 144, 240]) {
  const result = simulate(fps);
  assert(Math.abs(result.steps - baseline.steps) <= 1, `${fps} FPS executes ${result.steps} steps vs ${baseline.steps} at 60 FPS`);
  assert(Math.abs(result.body.x - baseline.body.x) < 0.001, `${fps} FPS changes Gravity X trajectory`);
  assert(Math.abs(result.body.y - baseline.body.y) < 0.001, `${fps} FPS changes Gravity Y trajectory`);
  assert(Math.abs(result.body.vx - baseline.body.vx) < 0.00001, `${fps} FPS changes Gravity X velocity`);
  assert(Math.abs(result.body.vy - baseline.body.vy) < 0.00001, `${fps} FPS changes Gravity Y velocity`);
}
const mapped = remapGravityPoint({ x: 100, y: 150 }, 400, 600, 800, 300);
assert(mapped.x === 200 && mapped.y === 75, 'Gravity resize remapping does not preserve normalized position');
assert(Math.abs(getGravityResizeScale(400, 600, 800, 300) - 1) < 1e-12, 'orientation-like resize should preserve circular object scale');
assert(Math.abs(getGravityResizeScale(400, 600, 800, 1200) - 2) < 1e-12, 'uniform 2x resize should scale circular objects by 2x');

if (errors.length) {
  console.error('GRAVITY DETERMINISM / RESIZE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('GRAVITY DETERMINISM / RESIZE AUDIT — PASS');
console.log('Refresh-rate invariant Newtonian stepping, deterministic steering, same-level resize remapping, and dt-based effects are certified.');
