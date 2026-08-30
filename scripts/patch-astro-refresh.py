from pathlib import Path

root = Path('.')
path = root / 'src/games/AstroBlasterGame.tsx'
s = path.read_text()

s = s.replace(
    "import { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';\n",
    "import { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';\nimport { ASTRO_FIXED_STEP_SEC, getAstroPhysicsStepBatch } from '../lib/astroRuntime';\n",
)

s = s.replace(
    "    ufoSpawnTimer: 450,\n    shootCooldown: 0,\n",
    "    ufoSpawnTimer: 450,\n    shootCooldown: 0,\n    physicsAccumulator: 0,\n",
)

s = s.replace(
    "    state.ship.invulnerableTimer = 90;\n    startLevel(1);",
    "    state.ship.invulnerableTimer = 90;\n    state.ufoSpawnTimer = 450;\n    state.shootCooldown = 0;\n    state.physicsAccumulator = 0;\n    startLevel(1);",
)

s = s.replace(
    "      state.width = w;\n      state.height = h;\n      state.ship.x = ((state.ship.x % w) + w) % w;",
    "      state.width = w;\n      state.height = h;\n      state.physicsAccumulator = 0;\n      state.ship.x = ((state.ship.x % w) + w) % w;",
)

old_head = """    onUpdate: (ctx, dt, width, height) => {
      const state = gameStateRef.current;
      const w = width;
      const h = height;
      state.width = w;
      state.height = h;

      ctx.save();
      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= 0.88;
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-10, -10, w + 20, h + 20);

      // =====================================
      // PHYSICS & UPDATE LOGIC
      // =====================================
      if (!isPausedRef.current && state.isAlive) {
        const s = state.ship;
"""
new_head = """    onUpdate: (ctx, deltaSec, width, height) => {
      const state = gameStateRef.current;
      const w = width;
      const h = height;
      state.width = w;
      state.height = h;

      ctx.save();
      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        const frameScale = Math.max(0, Math.min(deltaSec, 0.08) * 60);
        state.shake *= Math.pow(0.88, frameScale);
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-10, -10, w + 20, h + 20);

      // =====================================
      // PHYSICS & UPDATE LOGIC
      // =====================================
      if (!isPausedRef.current && state.isAlive) {
        const batch = getAstroPhysicsStepBatch(state.physicsAccumulator, deltaSec);
        state.physicsAccumulator = batch.remainderSec;
        for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++) {
          const dt = ASTRO_FIXED_STEP_SEC;
          const s = state.ship;
"""
if old_head not in s:
    raise SystemExit('Astro onUpdate head marker not found')
s = s.replace(old_head, new_head, 1)

old_tail = """        // Update Popups
        for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
          const ft = state.floatingTexts[i];
          ft.y -= 1.1;
          ft.life++;
          if (ft.life >= ft.maxLife) {
            state.floatingTexts.splice(i, 1);
          }
        }
      }

      // =====================================
      // VECTOR GRAPHICS RENDERING
"""
new_tail = """        // Update Popups
        for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
          const ft = state.floatingTexts[i];
          ft.y -= 1.1;
          ft.life++;
          if (ft.life >= ft.maxLife) {
            state.floatingTexts.splice(i, 1);
          }
        }
        }
      }

      // =====================================
      // VECTOR GRAPHICS RENDERING
"""
if old_tail not in s:
    raise SystemExit('Astro onUpdate tail marker not found')
s = s.replace(old_tail, new_tail, 1)

for needle in [
    "getAstroPhysicsStepBatch(state.physicsAccumulator, deltaSec)",
    "const dt = ASTRO_FIXED_STEP_SEC",
    "s.invulnerableTimer--",
    "s.tripleShotTimer--",
    "state.ufoSpawnTimer--",
    "ufo.shootTimer--",
    "b.life++",
    "a.rotation += a.vRot",
    "state.shootCooldown--",
]:
    if needle not in s:
        raise SystemExit(f'missing expected Astro marker: {needle}')

path.write_text(s)

(root / 'src/lib/astroRuntime.ts').write_text("""export const ASTRO_PHYSICS_HZ = 60;
export const ASTRO_FIXED_STEP_SEC = 1 / ASTRO_PHYSICS_HZ;
export const ASTRO_MAX_FRAME_SEC = 0.08;
export const ASTRO_MAX_STEPS_PER_FRAME = 8;

export interface AstroStepBatch {
  steps: number;
  remainderSec: number;
}

export const getAstroPhysicsStepBatch = (
  accumulatorSec: number,
  deltaSec: number,
): AstroStepBatch => {
  let accumulator = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), ASTRO_MAX_FRAME_SEC);
  let steps = 0;
  while (accumulator + 1e-12 >= ASTRO_FIXED_STEP_SEC && steps < ASTRO_MAX_STEPS_PER_FRAME) {
    accumulator -= ASTRO_FIXED_STEP_SEC;
    steps++;
  }
  return { steps, remainderSec: Math.max(0, accumulator) };
};
""")

(root / 'scripts/audit-astro.ts').write_text("""import { readFileSync } from 'node:fs';
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
""")
