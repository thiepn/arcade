import { readFileSync } from 'node:fs';
import {
  ASTRO_FIXED_STEP_SEC,
  ASTRO_PHYSICS_HZ,
  getAstroPhysicsStepBatch,
} from '../src/lib/astroRuntime';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
const source = readFileSync('src/games/AstroBlasterGame.tsx', 'utf8');

assert(ASTRO_PHYSICS_HZ === 60, `expected 60 Hz Astro simulation, found ${ASTRO_PHYSICS_HZ}`);
assert(source.includes('getAstroPhysicsStepBatch(state.physicsAccumulator, deltaSec)'), 'Astro Blaster does not use elapsed-time fixed-step batching');
assert(source.includes('for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++)'), 'Astro gameplay is not inside the fixed-step loop');
assert(source.includes('const dt = ASTRO_FIXED_STEP_SEC'), 'Astro fixed-step contract is missing');
assert(source.includes('s.invulnerableTimer--') && source.includes('s.shieldTimer--') && source.includes('s.tripleShotTimer--'), 'Ship timers are not covered by the fixed simulation clock');
assert(source.includes('state.ufoSpawnTimer--') && source.includes('ufo.shootTimer--'), 'UFO spawn/fire timers are not covered by the fixed simulation clock');
assert(source.includes('state.shootCooldown--'), 'Cannon cooldown is not covered by the fixed simulation clock');
assert(source.includes('b.life++') && source.includes('sd.life++'), 'Projectile/collectible lifetimes are not covered by the fixed simulation clock');
assert(source.includes('a.rotation += a.vRot'), 'Asteroid rotation is not covered by the fixed simulation clock');
assert(source.includes('s.tripleShotTimer = 360') && source.includes('s.shieldTimer = 360'), 'Certified six-second power-up durations changed unexpectedly');

const simulate = (fps: number, seconds = 10) => {
  let accumulator = 0;
  let x = 300;
  let y = 250;
  let vx = 0;
  let vy = 0;
  let angle = -Math.PI / 2;
  let bulletX = 120;
  let asteroidX = 40;
  let ufoX = -20;
  let triple = 360;
  let shield = 360;
  let invulnerable = 90;
  let ufoSpawn = 450;
  let ufoShoot = 80;
  let cooldown = 11;
  let steps = 0;
  const renderDt = 1 / fps;
  const frames = Math.round(seconds * fps);
  for (let frame = 0; frame < frames; frame++) {
    const batch = getAstroPhysicsStepBatch(accumulator, renderDt);
    accumulator = batch.remainderSec;
    for (let step = 0; step < batch.steps; step++) {
      angle += 0.075;
      vx += Math.cos(angle) * 0.16;
      vy += Math.sin(angle) * 0.16;
      vx *= 0.985;
      vy *= 0.985;
      const speed = Math.hypot(vx, vy);
      if (speed > 7.5) { vx = vx / speed * 7.5; vy = vy / speed * 7.5; }
      x += vx;
      y += vy;
      bulletX += 9.5;
      asteroidX += 1.1;
      ufoX += 1.8;
      triple = Math.max(0, triple - 1);
      shield = Math.max(0, shield - 1);
      invulnerable = Math.max(0, invulnerable - 1);
      ufoSpawn--;
      ufoShoot--;
      cooldown = Math.max(0, cooldown - 1);
      steps++;
    }
  }
  return { x, y, vx, vy, angle, bulletX, asteroidX, ufoX, triple, shield, invulnerable, ufoSpawn, ufoShoot, cooldown, steps };
};

const baseline = simulate(60);
for (const fps of [30, 60, 120, 144, 240]) {
  const result = simulate(fps);
  for (const key of ['x','y','vx','vy','angle','bulletX','asteroidX','ufoX','triple','shield','invulnerable','ufoSpawn','ufoShoot','cooldown'] as const) {
    assert(Math.abs(result[key] - baseline[key]) < 1e-6, `${fps} FPS changes Astro ${key}: ${result[key]} vs ${baseline[key]}`);
  }
  assert(result.steps === baseline.steps, `${fps} FPS executes ${result.steps} steps vs ${baseline.steps} at 60 FPS`);
}

assert(Math.abs(360 * ASTRO_FIXED_STEP_SEC - 6) < 1e-12, '360-step power-up duration is not six seconds');
assert(Math.abs(450 * ASTRO_FIXED_STEP_SEC - 7.5) < 1e-12, 'initial UFO spawn cadence changed from 7.5 seconds');

if (errors.length) {
  console.error('ASTRO BLASTER REFRESH-RATE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('ASTRO BLASTER REFRESH-RATE AUDIT — PASS');
console.log('Ship physics, bullets, asteroids, UFO cadence, cooldowns, and power-up durations are refresh-rate invariant at the certified 60 Hz gameplay clock.');
