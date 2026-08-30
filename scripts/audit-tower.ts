import { readFileSync } from 'node:fs';
import { TOWER_FIXED_STEP_SEC, TOWER_PHYSICS_HZ, getTowerPhysicsStepBatch } from '../src/lib/towerRuntime';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
const source = readFileSync('src/games/TowerGame.tsx', 'utf8');

assert(TOWER_PHYSICS_HZ === 60, `expected 60 Hz Tower simulation, found ${TOWER_PHYSICS_HZ}`);
assert(source.includes('getTowerPhysicsStepBatch(state.physicsAccumulator, deltaSec)'), 'Tower does not use elapsed-time fixed-step batching');
assert(source.includes('const dt = TOWER_FIXED_STEP_SEC'), 'Tower simulation does not execute with fixed-step dt');
assert(source.includes('for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++)'), 'Tower gameplay is not inside the fixed-step loop');
assert(source.includes('state.px += state.vx;') && source.includes('state.py += state.vy;'), 'Tower player motion contract changed unexpectedly');
assert(source.includes('plat.x += plat.vx;') && source.includes('drone.x += drone.vx;'), 'Tower platform/drone motion is not fixed-step covered');
assert(source.includes('state.vx *= 0.89;'), 'Tower friction baseline changed unexpectedly');
assert(source.includes('state.laserY += state.laserSpeed * dt;'), 'Tower hazard laser is not time-scaled');
assert(source.includes('state.jetpackTimer -= dt;') && source.includes('state.magnetTimer -= dt;'), 'Tower power-up timers are not time-scaled');
assert(source.includes('if (isPausedRef.current || !state.isAlive) return;'), 'Tower keyboard input can mutate gameplay while paused');
assert(source.includes('isPausedRef.current || !gameStateRef.current.isAlive'), 'Tower pointer input can mutate gameplay while paused');

const simulate = (fps: number, seconds = 6) => {
  let accumulator = 0;
  let x = 200, y = 60, vx = 0, vy = 14, platformX = 50, droneX = 80, timer = 4.5, laserY = -260, steps = 0;
  const renderDt = 1 / fps;
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) {
    const batch = getTowerPhysicsStepBatch(accumulator, renderDt);
    accumulator = batch.remainderSec;
    for (let step = 0; step < batch.steps; step++) {
      const dt = TOWER_FIXED_STEP_SEC;
      vx = Math.min(8.8, vx + 38 * dt);
      vy -= 26 * dt;
      x += vx; y += vy; platformX += 2.1; droneX += 1.6; timer -= dt; laserY += 24 * dt; steps++;
    }
  }
  return { x, y, vx, vy, platformX, droneX, timer, laserY, steps };
};
const baseline = simulate(60);
for (const fps of [30, 60, 120, 144, 240]) {
  const result = simulate(fps);
  for (const key of ['x','y','vx','vy','platformX','droneX','timer','laserY'] as const) {
    assert(Math.abs(result[key] - baseline[key]) < 1e-6, `${fps} FPS changes Tower ${key}`);
  }
  assert(result.steps === baseline.steps, `${fps} FPS changes Tower simulation step count`);
}
if (errors.length) {
  console.error('GRAVITY TOWER REFRESH-RATE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('GRAVITY TOWER REFRESH-RATE AUDIT — PASS');
