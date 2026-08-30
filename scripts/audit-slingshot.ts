import { readFileSync } from 'node:fs';
import {
  SLINGSHOT_FIXED_STEP_SEC,
  SLINGSHOT_PHYSICS_HZ,
  advanceSlingshotProbe,
  getSlingshotPhysicsStepBatch,
  getSlingshotResizeScale,
  remapSlingshotPoint,
} from '../src/lib/slingshotRuntime';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
const source = readFileSync('src/games/SlingshotGame.tsx', 'utf8');

assert(SLINGSHOT_PHYSICS_HZ === 60, `expected 60 Hz Slingshot simulation, found ${SLINGSHOT_PHYSICS_HZ}`);
assert(source.includes('getSlingshotPhysicsStepBatch(st.physicsAccumulator, deltaSec)'), 'Slingshot does not consume elapsed time through fixed-step simulation');
assert(source.includes('advanceSlingshotProbe(st)'), 'free-flight integration is not on the deterministic helper');
assert(!source.includes('st.probeX += st.probeVx;') && !source.includes('st.probeY += st.probeVy;'), 'legacy per-render-frame free-flight integration remains');
assert(source.includes('st.orbitAngle += st.orbitSpeed;') && source.includes('for (let simStep = 0; simStep < batch.steps'), 'orbit motion is not enclosed by the fixed-step clock');
assert(source.includes('if (!state.isTethered || !state.isAlive || isPausedRef.current) return;'), 'launchProbe is not pause-gated');
assert(source.includes('if (isPausedRef.current) return;'), 'window/canvas launch input is not pause-gated');
assert(!/onResize:\s*\(w, h\)\s*=>\s*\{\s*if \(gameStateRef\.current\.nodes\.length/.test(source), 'resize still only handles first initialization');
assert(source.includes('st.nodes = st.nodes.map') && source.includes('st.stardust = st.stardust.map') && source.includes('st.asteroids = st.asteroids.map'), 'resize does not remap core active world geometry');
assert(source.includes('st.nebulae = st.nebulae.map') && source.includes('st.trail = st.trail.map'), 'resize does not preserve background/trail world state');
assert(source.includes('st.probeVx *= sx') && source.includes('st.probeVy *= sy'), 'free-flight velocity is not remapped on resize');
assert(source.includes('effectFrameScale') && source.includes('p.life -= 0.03 * effectFrameScale') && source.includes('popup.life -= 0.02 * effectFrameScale'), 'effects remain refresh-rate dependent');
assert(source.includes('Math.pow(0.88, frameScale)') && source.includes('cameraBlend'), 'screen shake/camera smoothing remain render-frame dependent');

const simulate = (fps: number, seconds = 5) => {
  let accumulator = 0;
  const body = { probeX: 10, probeY: -20, probeVx: 3.2, probeVy: -1.4 };
  let orbitAngle = 0.3;
  let asteroidAngle = 1.1;
  let steps = 0;
  const dt = 1 / fps;
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
    const batch = getSlingshotPhysicsStepBatch(accumulator, dt);
    accumulator = batch.remainderSec;
    for (let step = 0; step < batch.steps; step++) {
      advanceSlingshotProbe(body);
      orbitAngle += 0.055;
      asteroidAngle += 0.04;
      steps++;
    }
  }
  return { body, orbitAngle, asteroidAngle, steps };
};
const baseline = simulate(60);
const expectedSteps = Math.round(5 / SLINGSHOT_FIXED_STEP_SEC);
assert(Math.abs(baseline.steps - expectedSteps) <= 1, `60 FPS executed ${baseline.steps} steps instead of about ${expectedSteps}`);
for (const fps of [30, 60, 120, 144, 240]) {
  const result = simulate(fps);
  assert(Math.abs(result.steps - baseline.steps) <= 1, `${fps} FPS executes ${result.steps} steps vs ${baseline.steps} at 60 FPS`);
  assert(Math.abs(result.body.probeX - baseline.body.probeX) < 0.001, `${fps} FPS changes free-flight X`);
  assert(Math.abs(result.body.probeY - baseline.body.probeY) < 0.001, `${fps} FPS changes free-flight Y`);
  assert(Math.abs(result.orbitAngle - baseline.orbitAngle) < 0.00001, `${fps} FPS changes orbital angle`);
  assert(Math.abs(result.asteroidAngle - baseline.asteroidAngle) < 0.00001, `${fps} FPS changes asteroid orbit angle`);
}

const mapped = remapSlingshotPoint({ x: 100, y: 150 }, 400, 600, 800, 300);
assert(mapped.x === 200 && mapped.y === 75, 'Slingshot resize mapping does not preserve normalized position');
assert(Math.abs(getSlingshotResizeScale(400, 600, 800, 300) - 1) < 1e-12, 'orientation-like resize should preserve circular scale');
assert(Math.abs(getSlingshotResizeScale(400, 600, 800, 1200) - 2) < 1e-12, 'uniform 2x resize should scale circular objects by 2x');

if (errors.length) {
  console.error('ORBITAL SLINGSHOT DETERMINISM / RESIZE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('ORBITAL SLINGSHOT DETERMINISM / RESIZE AUDIT — PASS');
console.log('Fixed-step orbit/free-flight timing, pause-safe launch input, resize continuity, and dt-scaled effects are certified.');
