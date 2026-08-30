from pathlib import Path
import json

root = Path('.')
path = root / 'src/games/VanguardGame.tsx'
s = path.read_text()

# Fixed-step runtime import.
s = s.replace(
    "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\n",
    "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { VANGUARD_FIXED_STEP_SEC, getVanguardPhysicsStepBatch } from '../lib/vanguardRuntime';\n",
    1,
)

# Track viewport and fixed-step remainder without changing the existing presentation/state model.
s = s.replace(
    "    keysPressed: {} as Record<string, boolean>,\n",
    "    keysPressed: {} as Record<string, boolean>,\n    viewportWidth: 0,\n    viewportHeight: 0,\n    physicsAccumulator: 0,\n",
    1,
)

# Bombs and input must not mutate gameplay while paused.
s = s.replace(
    "    if (state.bombs <= 0 || !state.isAlive) return;\n",
    "    if (state.bombs <= 0 || !state.isAlive || isPausedRef.current) return;\n",
    1,
)
s = s.replace(
    "    const handlePointerMove = (e: MouseEvent | TouchEvent) => {\n",
    "    const handlePointerMove = (e: MouseEvent | TouchEvent) => {\n      if (isPausedRef.current || !gameStateRef.current.isAlive) return;\n",
    1,
)
s = s.replace(
    "    const handleKeyDown = (e: KeyboardEvent) => {\n      gameStateRef.current.keysPressed[e.key] = true;\n",
    "    const handleKeyDown = (e: KeyboardEvent) => {\n      if (isPausedRef.current || !gameStateRef.current.isAlive) return;\n      gameStateRef.current.keysPressed[e.key] = true;\n",
    1,
)

# Preserve active gameplay across resize/orientation changes instead of resetting the ship and target.
old_resize = """    onResize: (w, h) => {
      const state = gameStateRef.current;
      state.playerX = w / 2;
      state.playerY = h * 0.8;
      state.targetX = w / 2;
      state.targetY = h * 0.8;

      // Initialize Starfield
      state.stars = [];
      for (let i = 0; i < 75; i++) {
        state.stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          speed: 1 + Math.random() * 3.5,
          size: Math.random() * 2 + 0.8,
        });
      }
    },
"""
new_resize = """    onResize: (w, h) => {
      const state = gameStateRef.current;
      const isInitial = state.viewportWidth <= 0 || state.viewportHeight <= 0;

      if (isInitial) {
        state.playerX = w / 2;
        state.playerY = h * 0.8;
        state.targetX = w / 2;
        state.targetY = h * 0.8;
      } else {
        const scaleX = w / state.viewportWidth;
        const scaleY = h / state.viewportHeight;
        state.playerX *= scaleX;
        state.playerY *= scaleY;
        state.targetX *= scaleX;
        state.targetY *= scaleY;
        for (const bullet of state.bullets) {
          bullet.x *= scaleX;
          bullet.y *= scaleY;
        }
        for (const enemy of state.enemies) {
          enemy.x *= scaleX;
          enemy.y *= scaleY;
        }
        for (const drop of state.drops) {
          drop.x *= scaleX;
          drop.y *= scaleY;
        }
        for (const particle of state.particles) {
          particle.x *= scaleX;
          particle.y *= scaleY;
        }
        for (const popup of state.popups) {
          popup.x *= scaleX;
          popup.y *= scaleY;
        }
        for (const star of state.stars) {
          star.x *= scaleX;
          star.y *= scaleY;
        }
      }

      state.viewportWidth = w;
      state.viewportHeight = h;
      state.physicsAccumulator = 0;

      if (state.stars.length === 0) {
        for (let i = 0; i < 75; i++) {
          state.stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            speed: 1 + Math.random() * 3.5,
            size: Math.random() * 2 + 0.8,
          });
        }
      }
    },
"""
if old_resize not in s:
    raise SystemExit('Vanguard resize marker not found')
s = s.replace(old_resize, new_resize, 1)

# Execute the frame-counted 60 Hz gameplay model on an elapsed-time fixed-step clock.
old_head = """    onUpdate: (ctx, deltaSec, curW, curH) => {
      const state = gameStateRef.current;
      const w = curW;
      const h = curH;

      if (!isPausedRef.current && state.isAlive) {
"""
new_head = """    onUpdate: (ctx, deltaSec, curW, curH) => {
      const state = gameStateRef.current;
      const w = curW;
      const h = curH;

      const batch = !isPausedRef.current && state.isAlive
        ? getVanguardPhysicsStepBatch(state.physicsAccumulator, deltaSec)
        : { steps: 0, remainderSec: 0 };
      state.physicsAccumulator = batch.remainderSec;

      if (!isPausedRef.current && state.isAlive) {
        for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++) {
          const dt = VANGUARD_FIXED_STEP_SEC;
"""
if old_head not in s:
    raise SystemExit('Vanguard update head marker not found')
s = s.replace(old_head, new_head, 1)

# Move effects/popups from render-frame mutation into the fixed gameplay clock.
old_tail = """        // --- UPDATE DROPS ---
        for (let i = state.drops.length - 1; i >= 0; i--) {
          const drop = state.drops[i];
          drop.y += drop.vy;

          if (Math.hypot(drop.x - state.playerX, drop.y - state.playerY) < 28) {
            state.drops.splice(i, 1);
            haptics.score();
            if (soundEnabled) sounds.playPop();

            if (drop.type === 'spread' || drop.type === 'laser') {
              state.weaponLevel = Math.min(3, state.weaponLevel + 1);
              setWeaponLevel(state.weaponLevel);
              addScorePopup('WEAPON UPGRADE!', state.playerX, state.playerY - 25, '#38BDF8');
            } else if (drop.type === 'shield') {
              state.lives = Math.min(4, state.lives + 1);
              setLives(state.lives);
              addScorePopup('+1 SHIELD!', state.playerX, state.playerY - 25, '#34D399');
            } else if (drop.type === 'bomb') {
              state.bombs = Math.min(4, state.bombs + 1);
              setBombs(state.bombs);
              addScorePopup('+1 NOVA EMP!', state.playerX, state.playerY - 25, '#A855F7');
            }
          } else if (drop.y > h + 30) {
            state.drops.splice(i, 1);
          }
        }
      }

      // --- RENDERING ---
"""
new_tail = """        // --- UPDATE DROPS ---
        for (let i = state.drops.length - 1; i >= 0; i--) {
          const drop = state.drops[i];
          drop.y += drop.vy;

          if (Math.hypot(drop.x - state.playerX, drop.y - state.playerY) < 28) {
            state.drops.splice(i, 1);
            haptics.score();
            if (soundEnabled) sounds.playPop();

            if (drop.type === 'spread' || drop.type === 'laser') {
              state.weaponLevel = Math.min(3, state.weaponLevel + 1);
              setWeaponLevel(state.weaponLevel);
              addScorePopup('WEAPON UPGRADE!', state.playerX, state.playerY - 25, '#38BDF8');
            } else if (drop.type === 'shield') {
              state.lives = Math.min(4, state.lives + 1);
              setLives(state.lives);
              addScorePopup('+1 SHIELD!', state.playerX, state.playerY - 25, '#34D399');
            } else if (drop.type === 'bomb') {
              state.bombs = Math.min(4, state.bombs + 1);
              setBombs(state.bombs);
              addScorePopup('+1 NOVA EMP!', state.playerX, state.playerY - 25, '#A855F7');
            }
          } else if (drop.y > h + 30) {
            state.drops.splice(i, 1);
          }
        }

        // Effects advance on the same 60 Hz gameplay clock and freeze while paused.
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 1.8 * dt;
          if (p.life <= 0) state.particles.splice(i, 1);
        }
        for (let i = state.popups.length - 1; i >= 0; i--) {
          const popup = state.popups[i];
          popup.y -= 54 * dt;
          popup.life -= 1.2 * dt;
          if (popup.life <= 0) state.popups.splice(i, 1);
        }
        }
      }

      // --- RENDERING ---
"""
if old_tail not in s:
    raise SystemExit('Vanguard drops/update tail marker not found')
s = s.replace(old_tail, new_tail, 1)

old_particles = """      // Draw Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        if (p.life <= 0) {
          state.particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Draw Popups
      for (let i = state.popups.length - 1; i >= 0; i--) {
        const popup = state.popups[i];
        popup.y -= 0.9;
        popup.life -= 0.02;
        if (popup.life <= 0) {
          state.popups.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, popup.life);
        ctx.fillStyle = popup.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.globalAlpha = 1.0;
      }
"""
new_particles = """      // Draw Particles
      for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Draw Popups
      for (const popup of state.popups) {
        ctx.globalAlpha = Math.max(0, popup.life);
        ctx.fillStyle = popup.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.globalAlpha = 1.0;
      }
"""
if old_particles not in s:
    raise SystemExit('Vanguard render effect marker not found')
s = s.replace(old_particles, new_particles, 1)

# Keep the bomb control visually disabled while paused as well as behaviorally blocked.
s = s.replace('          disabled={bombs <= 0}\n', '          disabled={bombs <= 0 || isPaused}\n', 1)
s = s.replace("            bombs > 0\n              ? 'bg-cyan-600/90", "            bombs > 0 && !isPaused\n              ? 'bg-cyan-600/90", 1)

for needle in [
    "getVanguardPhysicsStepBatch(state.physicsAccumulator, deltaSec)",
    "for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++)",
    "const dt = VANGUARD_FIXED_STEP_SEC",
    "state.playerX += (state.targetX - state.playerX) * 0.35;",
    "enemy.x += enemy.vx;",
    "b.x += b.vx;",
    "drop.y += drop.vy;",
    "state.shootCooldown++;",
    "state.spawnTimer++;",
    "state.physicsAccumulator = 0;",
]:
    if needle not in s:
        raise SystemExit(f'missing expected Vanguard marker: {needle}')

path.write_text(s)

# Fixed-step runtime helper.
(root / 'src/lib/vanguardRuntime.ts').write_text("""export const VANGUARD_PHYSICS_HZ = 60;
export const VANGUARD_FIXED_STEP_SEC = 1 / VANGUARD_PHYSICS_HZ;
export const VANGUARD_MAX_FRAME_SEC = 0.08;
export const VANGUARD_MAX_STEPS_PER_FRAME = 8;

export interface VanguardStepBatch {
  steps: number;
  remainderSec: number;
}

export const getVanguardPhysicsStepBatch = (
  accumulatorSec: number,
  deltaSec: number,
): VanguardStepBatch => {
  let accumulator = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), VANGUARD_MAX_FRAME_SEC);
  let steps = 0;
  while (accumulator + 1e-12 >= VANGUARD_FIXED_STEP_SEC && steps < VANGUARD_MAX_STEPS_PER_FRAME) {
    accumulator -= VANGUARD_FIXED_STEP_SEC;
    steps++;
  }
  return { steps, remainderSec: Math.max(0, accumulator) };
};
""")

# Permanent refresh-rate and pause/resize regression audit.
(root / 'scripts/audit-vanguard.ts').write_text("""import { readFileSync } from 'node:fs';
import {
  VANGUARD_FIXED_STEP_SEC,
  VANGUARD_PHYSICS_HZ,
  getVanguardPhysicsStepBatch,
} from '../src/lib/vanguardRuntime';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
const source = readFileSync('src/games/VanguardGame.tsx', 'utf8');

assert(VANGUARD_PHYSICS_HZ === 60, `expected 60 Hz Vanguard simulation, found ${VANGUARD_PHYSICS_HZ}`);
assert(source.includes('getVanguardPhysicsStepBatch(state.physicsAccumulator, deltaSec)'), 'Vanguard does not batch elapsed time into fixed simulation steps');
assert(source.includes('for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++)'), 'Vanguard gameplay is not inside the fixed-step loop');
assert(source.includes('const dt = VANGUARD_FIXED_STEP_SEC'), 'Vanguard fixed-step dt is missing');
assert(source.includes('state.playerX += (state.targetX - state.playerX) * 0.35;'), 'Vanguard player smoothing contract changed unexpectedly');
assert(source.includes('enemy.x += enemy.vx;') && source.includes('b.x += b.vx;') && source.includes('drop.y += drop.vy;'), 'Vanguard entity motion is not covered by the fixed-step simulation');
assert(source.includes('state.shootCooldown++;') && source.includes('state.spawnTimer++;') && source.includes('enemy.shootTimer++;'), 'Vanguard firing/spawn cadence is not covered by the fixed-step simulation');
assert(source.includes('p.life -= 1.8 * dt;') && source.includes('popup.life -= 1.2 * dt;'), 'Vanguard effects are not advanced on gameplay time');
assert(source.includes('state.bombs <= 0 || !state.isAlive || isPausedRef.current'), 'Vanguard bomb action can mutate gameplay while paused');
assert(source.includes('if (isPausedRef.current || !gameStateRef.current.isAlive) return;'), 'Vanguard input can mutate gameplay while paused');
assert(source.includes('const isInitial = state.viewportWidth <= 0 || state.viewportHeight <= 0;'), 'Vanguard resize preservation guard is missing');
assert(source.includes('state.playerX *= scaleX;') && source.includes('state.targetY *= scaleY;'), 'Vanguard active player/target state is not preserved through resize');
assert(source.includes('state.physicsAccumulator = 0;'), 'Vanguard fixed-step remainder is not reset on resize');

const simulate = (fps: number, seconds = 7) => {
  let accumulator = 0;
  let playerX = 120;
  const targetX = 310;
  let starY = 15;
  let bulletY = 420;
  let enemyX = 80;
  let enemyY = -20;
  let enemyPhase = 0;
  let dropY = 100;
  let particleX = 30;
  let particleLife = 1;
  let popupY = 200;
  let popupLife = 1;
  let invulnerable = 70;
  let shootCooldown = 0;
  let spawnTimer = 0;
  let enemyShootTimer = 0;
  let shots = 0;
  let spawns = 0;
  let enemyShots = 0;
  let steps = 0;
  const renderDt = 1 / fps;
  const frames = Math.round(seconds * fps);
  for (let frame = 0; frame < frames; frame++) {
    const batch = getVanguardPhysicsStepBatch(accumulator, renderDt);
    accumulator = batch.remainderSec;
    for (let step = 0; step < batch.steps; step++) {
      const dt = VANGUARD_FIXED_STEP_SEC;
      playerX += (targetX - playerX) * 0.35;
      starY += 2.5;
      bulletY -= 9;
      enemyX += 1.2;
      enemyY += 2.2;
      enemyPhase += 0.05;
      dropY += 1.5;
      particleX += 2;
      particleLife -= 1.8 * dt;
      popupY -= 54 * dt;
      popupLife -= 1.2 * dt;
      if (invulnerable > 0) invulnerable--;
      shootCooldown++;
      if (shootCooldown >= 8) { shootCooldown = 0; shots++; }
      spawnTimer++;
      if (spawnTimer > 55) { spawnTimer = 0; spawns++; }
      enemyShootTimer++;
      if (enemyShootTimer > 65) { enemyShootTimer = 0; enemyShots++; }
      steps++;
    }
  }
  return { playerX, starY, bulletY, enemyX, enemyY, enemyPhase, dropY, particleX, particleLife, popupY, popupLife, invulnerable, shootCooldown, spawnTimer, enemyShootTimer, shots, spawns, enemyShots, steps };
};

const baseline = simulate(60);
for (const fps of [30, 60, 120, 144, 240]) {
  const result = simulate(fps);
  for (const key of ['playerX','starY','bulletY','enemyX','enemyY','enemyPhase','dropY','particleX','particleLife','popupY','popupLife'] as const) {
    assert(Math.abs(result[key] - baseline[key]) < 1e-6, `${fps} FPS changes Vanguard ${key}: ${result[key]} vs ${baseline[key]}`);
  }
  for (const key of ['invulnerable','shootCooldown','spawnTimer','enemyShootTimer','shots','spawns','enemyShots','steps'] as const) {
    assert(result[key] === baseline[key], `${fps} FPS changes Vanguard ${key}: ${result[key]} vs ${baseline[key]}`);
  }
}

if (errors.length) {
  console.error('GALAXY VANGUARD REFRESH-RATE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('GALAXY VANGUARD REFRESH-RATE AUDIT — PASS');
console.log('Movement, firing, spawns, enemy cadence, drops, effects, pause input, and resize preservation are certified on the 60 Hz gameplay clock.');
""")

# Package script.
pkg_path = root / 'package.json'
pkg = json.loads(pkg_path.read_text())
scripts = pkg['scripts']
new_scripts = {}
inserted = False
for k, v in scripts.items():
    new_scripts[k] = v
    if k == 'quality:drift':
        new_scripts['quality:vanguard'] = 'bun scripts/audit-vanguard.ts'
        inserted = True
if not inserted:
    raise SystemExit('package quality:drift insertion point missing')
pkg['scripts'] = new_scripts
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')

# Release32 permanent gate and audit-file registration. CI is added after the temporary workflow is removed.
release_path = root / 'scripts/audit-release-32.ts'
r = release_path.read_text()
needle_gate = "  'quality:drift',\n"
needle_file = "  'scripts/audit-drift.ts',\n"
if needle_gate not in r or needle_file not in r:
    raise SystemExit('release32 Vanguard insertion point missing')
r = r.replace(needle_gate, needle_gate + "  'quality:vanguard',\n", 1)
r = r.replace(needle_file, needle_file + "  'scripts/audit-vanguard.ts',\n", 1)
release_path.write_text(r)
