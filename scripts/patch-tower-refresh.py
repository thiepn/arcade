from pathlib import Path
import json

root = Path('.')
path = root / 'src/games/TowerGame.tsx'
s = path.read_text()

s = s.replace(
    "import { clamp } from '../lib/gameCoordinates';\n",
    "import { clamp } from '../lib/gameCoordinates';\nimport { TOWER_FIXED_STEP_SEC, getTowerPhysicsStepBatch } from '../lib/towerRuntime';\n",
)
s = s.replace("    viewportHeight: 600,\n", "    viewportHeight: 600,\n    physicsAccumulator: 0,\n")
s = s.replace(
    "    state.magnetActive = false;\n\n    generateWorldUpTo(1800, initialWidth);",
    "    state.magnetActive = false;\n    state.physicsAccumulator = 0;\n\n    generateWorldUpTo(1800, initialWidth);",
)
s = s.replace(
    "      state.viewportWidth = w;\n      state.viewportHeight = h;\n      if (state.platforms.length === 0) generateWorldUpTo(1800, w);",
    "      state.viewportWidth = w;\n      state.viewportHeight = h;\n      state.physicsAccumulator = 0;\n      if (state.platforms.length === 0) generateWorldUpTo(1800, w);",
)
s = s.replace(
    "    const handleKeyDown = (e: KeyboardEvent) => {\n      const state = gameStateRef.current;\n",
    "    const handleKeyDown = (e: KeyboardEvent) => {\n      const state = gameStateRef.current;\n      if (isPausedRef.current || !state.isAlive) return;\n",
)
s = s.replace(
    "  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {\n    if (!containerRef.current) return;\n",
    "  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {\n    if (!containerRef.current || isPausedRef.current || !gameStateRef.current.isAlive) return;\n",
)

old_head = """    onUpdate: (ctx, deltaSec, curW, curH) => {
      const dt = Math.min(deltaSec, 0.08);
      const state = gameStateRef.current;

      ctx.clearRect(0, 0, curW, curH);

      if (!isPausedRef.current && state.isAlive) {
"""
new_head = """    onUpdate: (ctx, deltaSec, curW, curH) => {
      const state = gameStateRef.current;

      ctx.clearRect(0, 0, curW, curH);

      const batch = getTowerPhysicsStepBatch(state.physicsAccumulator, deltaSec);
      state.physicsAccumulator = batch.remainderSec;
      if (!isPausedRef.current && state.isAlive) {
        for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++) {
          const dt = TOWER_FIXED_STEP_SEC;
"""
if old_head not in s:
    raise SystemExit('Tower onUpdate head marker not found')
s = s.replace(old_head, new_head, 1)

old_tail = """        // Update Popups
        for (let pop = state.popups.length - 1; pop >= 0; pop--) {
          const popup = state.popups[pop];
          popup.y += 30 * dt;
          popup.life -= dt * 1.4;
          if (popup.life <= 0) {
            state.popups.splice(pop, 1);
          }
        }
      }

      // ==========================================
"""
new_tail = """        // Update Popups
        for (let pop = state.popups.length - 1; pop >= 0; pop--) {
          const popup = state.popups[pop];
          popup.y += 30 * dt;
          popup.life -= dt * 1.4;
          if (popup.life <= 0) {
            state.popups.splice(pop, 1);
          }
        }
        }
      }

      // ==========================================
"""
if old_tail not in s:
    raise SystemExit('Tower onUpdate tail marker not found')
s = s.replace(old_tail, new_tail, 1)
path.write_text(s)

(root / 'src/lib/towerRuntime.ts').write_text("""export const TOWER_PHYSICS_HZ = 60;
export const TOWER_FIXED_STEP_SEC = 1 / TOWER_PHYSICS_HZ;
export const TOWER_MAX_FRAME_SEC = 0.08;
export const TOWER_MAX_STEPS_PER_FRAME = 8;

export interface TowerStepBatch {
  steps: number;
  remainderSec: number;
}

export const getTowerPhysicsStepBatch = (
  accumulatorSec: number,
  deltaSec: number,
): TowerStepBatch => {
  let accumulator = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), TOWER_MAX_FRAME_SEC);
  let steps = 0;
  while (accumulator + 1e-12 >= TOWER_FIXED_STEP_SEC && steps < TOWER_MAX_STEPS_PER_FRAME) {
    accumulator -= TOWER_FIXED_STEP_SEC;
    steps++;
  }
  return { steps, remainderSec: Math.max(0, accumulator) };
};
""")

(root / 'scripts/audit-tower.ts').write_text("""import { readFileSync } from 'node:fs';
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
""")

pkg_path = root / 'package.json'
pkg = json.loads(pkg_path.read_text())
new_scripts = {}
for k, v in pkg['scripts'].items():
    new_scripts[k] = v
    if k == 'quality:slingshot':
        new_scripts['quality:tower'] = 'bun scripts/audit-tower.ts'
pkg['scripts'] = new_scripts
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')

release_path = root / 'scripts/audit-release-32.ts'
r = release_path.read_text()
r = r.replace("  'quality:slingshot',\n", "  'quality:slingshot',\n  'quality:tower',\n", 1)
r = r.replace("  'scripts/audit-slingshot.ts',\n", "  'scripts/audit-slingshot.ts',\n  'scripts/audit-tower.ts',\n", 1)
release_path.write_text(r)
