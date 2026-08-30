import { readFileSync } from 'node:fs';
import {
  DRIFT_FIXED_STEP_SEC,
  DRIFT_PHYSICS_HZ,
  getDriftPhysicsStepBatch,
} from '../src/lib/driftRuntime';

const source = readFileSync('src/games/DriftGame.tsx', 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };

assert(DRIFT_PHYSICS_HZ === 60, `expected 60 Hz Drift simulation, found ${DRIFT_PHYSICS_HZ}`);
assert(source.includes('getDriftPhysicsStepBatch(st.physicsAccumulator, deltaSec)'), 'Cyber Drift does not batch elapsed time into fixed simulation steps');
assert(source.includes('const dt = DRIFT_FIXED_STEP_SEC'), 'Cyber Drift fixed-step dt is missing');
assert(source.includes('for (let simStep = 0; simStep < batch.steps && st.isAlive; simStep++)'), 'Cyber Drift gameplay is not inside the fixed-step loop');
assert(source.includes('st.trackDistance += currentSpeed;'), 'track progression escaped the fixed-step contract');
assert(source.includes('st.carX += st.carVx;'), 'car movement escaped the fixed-step contract');
assert(source.includes('st.spawnTimer++;'), 'spawn cadence escaped the fixed-step contract');
assert(source.includes('seg.y += currentSpeed;'), 'track obstacle motion escaped the fixed-step contract');
assert(source.includes('st.boostTimer -= dt;'), 'nitro duration is not elapsed-time controlled');
assert(!source.includes('setSafeTimeout') && !source.includes('useSafeTimeout'), 'nitro still uses a wall-clock timeout');
assert(source.includes('if (isPausedRef.current || !gameStateRef.current.isAlive) return;'), 'keyboard/pointer input is not pause guarded');

const renderMarker = source.indexOf('// --- RENDERING ---');
const particleUpdate = source.indexOf('p.life -= 0.03;');
const popupUpdate = source.indexOf('popup.life -= 0.02;');
assert(renderMarker > 0 && particleUpdate > 0 && particleUpdate < renderMarker, 'particle lifetime still advances in render space');
assert(renderMarker > 0 && popupUpdate > 0 && popupUpdate < renderMarker, 'popup lifetime still advances in render space');
assert(source.indexOf('p.life -= 0.03;', renderMarker) === -1, 'particle lifetime mutates during rendering');
assert(source.indexOf('popup.life -= 0.02;', renderMarker) === -1, 'popup lifetime mutates during rendering');

const simulate = (fps: number, seconds = 6) => {
  let accumulator = 0;
  let carX = 200;
  let carVx = 0;
  let angle = 0;
  let trackDistance = 0;
  let nitro = 70;
  let invulnerable = 65;
  let boostTimer = 1.8;
  let segmentY = -80;
  let particleX = 0;
  let particleLife = 0.9;
  let popupY = 100;
  let popupLife = 1;
  let steps = 0;
  const renderDt = 1 / fps;
  const frames = Math.round(seconds * fps);
  for (let frame = 0; frame < frames; frame++) {
    const batch = getDriftPhysicsStepBatch(accumulator, renderDt);
    accumulator = batch.remainderSec;
    for (let step = 0; step < batch.steps; step++) {
      const currentSpeed = boostTimer > 0 ? 9.2 * 1.55 : 6.8;
      carVx = Math.min(7, carVx + 0.65);
      angle += (0.38 - angle) * 0.22;
      carX += carVx;
      trackDistance += currentSpeed;
      nitro = Math.min(100, nitro + 0.06);
      invulnerable = Math.max(0, invulnerable - 1);
      boostTimer = Math.max(0, boostTimer - DRIFT_FIXED_STEP_SEC);
      segmentY += currentSpeed;
      particleX += 2;
      particleLife -= 0.03;
      popupY -= 1;
      popupLife -= 0.02;
      steps++;
    }
  }
  return { carX, carVx, angle, trackDistance, nitro, invulnerable, boostTimer, segmentY, particleX, particleLife, popupY, popupLife, steps };
};

const baseline = simulate(60);
for (const fps of [30, 60, 120, 144, 240]) {
  const result = simulate(fps);
  for (const key of ['carX','carVx','angle','trackDistance','nitro','invulnerable','boostTimer','segmentY','particleX','particleLife','popupY','popupLife'] as const) {
    assert(Math.abs(result[key] - baseline[key]) < 1e-6, `${fps} FPS changes ${key}: ${result[key]} vs ${baseline[key]}`);
  }
  assert(result.steps === baseline.steps, `${fps} FPS executes ${result.steps} simulation steps vs ${baseline.steps}`);
}

if (errors.length) {
  console.error('CYBER DRIFT REFRESH-RATE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('CYBER DRIFT REFRESH-RATE AUDIT — PASS');
console.log('Driving, nitro, track movement, spawn cadence, particles, and popups are invariant across certified refresh rates.');
