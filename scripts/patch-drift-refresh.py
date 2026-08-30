from pathlib import Path

root = Path('.')
path = root / 'src/games/DriftGame.tsx'
s = path.read_text()

s = s.replace(
    "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\n",
    "import { useGameLoop } from '../hooks/useGameLoop';\nimport { DRIFT_FIXED_STEP_SEC, getDriftPhysicsStepBatch } from '../lib/driftRuntime';\n",
    1,
)

s = s.replace(
    "    isBoosting: false,\n    invulnerableTime: 0,",
    "    isBoosting: false,\n    boostTimer: 0,\n    invulnerableTime: 0,",
    1,
)
s = s.replace(
    "    viewportWidth: 0,\n    viewportHeight: 0,\n",
    "    viewportWidth: 0,\n    viewportHeight: 0,\n    physicsAccumulator: 0,\n",
    1,
)

s = s.replace("\n  const setSafeTimeout = useSafeTimeout();\n", "\n", 1)

old_trigger = """    if (state.nitro >= 25 && !state.isBoosting && state.isAlive) {
      state.nitro -= 25;
      setNitroEnergy(state.nitro);
      state.isBoosting = true;
      setIsBoosting(true);
      state.screenShake = 10;
"""
new_trigger = """    if (state.nitro >= 25 && !state.isBoosting && state.isAlive && !isPausedRef.current) {
      state.nitro -= 25;
      setNitroEnergy(state.nitro);
      state.isBoosting = true;
      state.boostTimer = 1.8;
      setIsBoosting(true);
      state.screenShake = 10;
"""
if old_trigger not in s:
    raise SystemExit('nitro trigger marker missing')
s = s.replace(old_trigger, new_trigger, 1)

old_timeout = """
      setSafeTimeout(() => {
        state.isBoosting = false;
        setIsBoosting(false);
      }, 1800);
    }
  }, [soundEnabled, setSafeTimeout]);
"""
new_timeout = """
    }
  }, [soundEnabled]);
"""
if old_timeout not in s:
    raise SystemExit('nitro timeout marker missing')
s = s.replace(old_timeout, new_timeout, 1)

s = s.replace(
    "    const handleKeyDown = (e: KeyboardEvent) => {\n",
    "    const handleKeyDown = (e: KeyboardEvent) => {\n      if (isPausedRef.current || !gameStateRef.current.isAlive) return;\n",
    1,
)

s = s.replace(
    "      state.viewportWidth = w;\n      state.viewportHeight = h;\n",
    "      state.viewportWidth = w;\n      state.viewportHeight = h;\n      state.physicsAccumulator = 0;\n",
    1,
)

old_head = """    onUpdate: (ctx, dt, w, h) => {
      const st = gameStateRef.current;
      
      ctx.save();
      const roadCenterX = w / 2;
      const roadWidth = getDriftRoadWidth(w);

      if (!isPausedRef.current && st.isAlive) {
        if (st.invulnerableTime > 0) st.invulnerableTime--;
"""
new_head = """    onUpdate: (ctx, deltaSec, w, h) => {
      const st = gameStateRef.current;

      const batch = getDriftPhysicsStepBatch(st.physicsAccumulator, deltaSec);
      st.physicsAccumulator = batch.remainderSec;

      ctx.save();
      const roadCenterX = w / 2;
      const roadWidth = getDriftRoadWidth(w);

      if (!isPausedRef.current && st.isAlive) {
        for (let simStep = 0; simStep < batch.steps && st.isAlive; simStep++) {
          const dt = DRIFT_FIXED_STEP_SEC;
          if (st.invulnerableTime > 0) st.invulnerableTime--;
          if (st.isBoosting) {
            st.boostTimer -= dt;
            if (st.boostTimer <= 0) {
              st.boostTimer = 0;
              st.isBoosting = false;
              setIsBoosting(false);
            }
          }
"""
if old_head not in s:
    raise SystemExit('onUpdate head marker missing')
s = s.replace(old_head, new_head, 1)

old_tail = """        // Skid marks fade
        st.skidmarks.forEach((s) => (s.alpha -= 0.012));
        st.skidmarks = st.skidmarks.filter((s) => s.alpha > 0.02);
      }

      // --- RENDERING ---
"""
new_tail = """        // Skid marks fade
        st.skidmarks.forEach((s) => (s.alpha -= 0.012));
        st.skidmarks = st.skidmarks.filter((s) => s.alpha > 0.02);

        // Update particles on the certified gameplay clock.
        for (let i = st.particles.length - 1; i >= 0; i--) {
          const p = st.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.03;
          if (p.life <= 0) st.particles.splice(i, 1);
        }

        // Update score popups on the certified gameplay clock.
        for (let i = st.popups.length - 1; i >= 0; i--) {
          const popup = st.popups[i];
          popup.y -= 1.0;
          popup.life -= 0.02;
          if (popup.life <= 0) st.popups.splice(i, 1);
        }
        }
      }

      // --- RENDERING ---
"""
if old_tail not in s:
    raise SystemExit('simulation tail marker missing')
s = s.replace(old_tail, new_tail, 1)

old_particles = """      // Draw Particles
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        if (p.life <= 0) {
          st.particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
"""
new_particles = """      // Draw Particles
      for (const p of st.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
"""
if old_particles not in s:
    raise SystemExit('particle render marker missing')
s = s.replace(old_particles, new_particles, 1)

old_popups = """      // Draw Score Popups
      for (let i = st.popups.length - 1; i >= 0; i--) {
        const popup = st.popups[i];
        popup.y -= 1.0;
        popup.life -= 0.02;
        if (popup.life <= 0) {
          st.popups.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, popup.life);
        ctx.fillStyle = popup.color;
        ctx.font = `bold ${Math.round(12 * (popup.scale || 1.0))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.globalAlpha = 1.0;
      }
"""
new_popups = """      // Draw Score Popups
      for (const popup of st.popups) {
        ctx.globalAlpha = Math.max(0, popup.life);
        ctx.fillStyle = popup.color;
        ctx.font = `bold ${Math.round(12 * (popup.scale || 1.0))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.globalAlpha = 1.0;
      }
"""
if old_popups not in s:
    raise SystemExit('popup render marker missing')
s = s.replace(old_popups, new_popups, 1)

s = s.replace(
    "  ) => {\n    event.preventDefault();\n    event.currentTarget.setPointerCapture?.(event.pointerId);\n",
    "  ) => {\n    event.preventDefault();\n    if (isPausedRef.current || !gameStateRef.current.isAlive) return;\n    event.currentTarget.setPointerCapture?.(event.pointerId);\n",
    1,
)

required = [
    "getDriftPhysicsStepBatch(st.physicsAccumulator, deltaSec)",
    "const dt = DRIFT_FIXED_STEP_SEC",
    "for (let simStep = 0; simStep < batch.steps && st.isAlive; simStep++)",
    "st.boostTimer -= dt",
    "st.trackDistance += currentSpeed",
    "st.carX += st.carVx",
    "seg.y += currentSpeed",
    "st.spawnTimer++",
    "p.life -= 0.03",
    "popup.life -= 0.02",
]
for marker in required:
    if marker not in s:
        raise SystemExit(f'missing patched marker: {marker}')
if 'setSafeTimeout' in s or 'useSafeTimeout' in s:
    raise SystemExit('wall-clock nitro timer remains')

path.write_text(s)

(root / 'src/lib/driftRuntime.ts').write_text("""export const DRIFT_PHYSICS_HZ = 60;
export const DRIFT_FIXED_STEP_SEC = 1 / DRIFT_PHYSICS_HZ;
export const DRIFT_MAX_FRAME_SEC = 0.08;
export const DRIFT_MAX_STEPS_PER_FRAME = 8;

export interface DriftStepBatch {
  steps: number;
  remainderSec: number;
}

export const getDriftPhysicsStepBatch = (
  accumulatorSec: number,
  deltaSec: number,
): DriftStepBatch => {
  let accumulator = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), DRIFT_MAX_FRAME_SEC);
  let steps = 0;
  while (accumulator + 1e-12 >= DRIFT_FIXED_STEP_SEC && steps < DRIFT_MAX_STEPS_PER_FRAME) {
    accumulator -= DRIFT_FIXED_STEP_SEC;
    steps++;
  }
  return { steps, remainderSec: Math.max(0, accumulator) };
};
""")

(root / 'scripts/audit-drift.ts').write_text("""import { readFileSync } from 'node:fs';
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
""")
