from pathlib import Path

path = Path('src/games/OneLineGame.tsx')
s = path.read_text()

anchor = "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\n"
replacement = anchor + "import {\n  getOneLineInkBudget,\n  getOneLinePhysicsStepBatch,\n  remapOneLinePoint,\n} from '../lib/oneLineRuntime';\n"
if anchor not in s:
    raise SystemExit('One Line import anchor not found')
s = s.replace(anchor, replacement, 1)
s = s.replace("\n  const maxInkLength = 1100;\n", "\n", 1)

anchor = "    lastPos: { x: 0, y: 0 },\n  });\n"
replacement = "    lastPos: { x: 0, y: 0 },\n    physicsAccumulator: 0,\n    viewportWidth: 0,\n    viewportHeight: 0,\n  });\n"
if anchor not in s:
    raise SystemExit('One Line state anchor not found')
s = s.replace(anchor, replacement, 1)

anchor = "    state.physicsRunning = false;\n    state.stuckTimer = 0;\n"
replacement = "    state.physicsRunning = false;\n    state.physicsAccumulator = 0;\n    state.viewportWidth = w;\n    state.viewportHeight = h;\n    state.stuckTimer = 0;\n"
if anchor not in s:
    raise SystemExit('One Line generate state anchor not found')
s = s.replace(anchor, replacement, 1)

old = '''  const handleResetLevel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    generateLevel(gameStateRef.current.level, canvas.width / dpr, canvas.height / dpr);
  };

  const handleRandomNewLevel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    if (soundEnabled) sounds.playClick();
    generateLevel(gameStateRef.current.level, canvas.width / dpr, canvas.height / dpr);
  };
'''
new = '''  const resetCurrentAttempt = useCallback(() => {
    const state = gameStateRef.current;
    state.linePoints = [];
    state.particles = [];
    state.physicsRunning = false;
    state.physicsAccumulator = 0;
    state.stuckTimer = 0;
    state.ball = { x: state.startPos.x, y: state.startPos.y, vx: 0, vy: 0, radius: 9 };
    state.lastPos = { x: state.startPos.x, y: state.startPos.y };
    state.stars.forEach((star) => {
      star.collected = false;
    });
    isDrawingRef.current = false;
    setPhysicsRunning(false);
    setStarsCount(0);
    setInkPercent(100);
  }, []);

  const handleResetLevel = () => {
    if (soundEnabled) sounds.playClick();
    resetCurrentAttempt();
  };

  const handleRandomNewLevel = () => {
    const state = gameStateRef.current;
    const w = state.viewportWidth;
    const h = state.viewportHeight;
    if (w <= 0 || h <= 0) return;
    if (soundEnabled) sounds.playClick();
    generateLevel(state.level, w, h);
  };
'''
if old not in s:
    raise SystemExit('One Line reset/random block not found')
s = s.replace(old, new, 1)

old = '''        const curLen = calculateTotalLength(pts);
        if (curLen < maxInkLength) {
          pts.push(pt);
          const remaining = Math.max(0, Math.round(((maxInkLength - curLen) / maxInkLength) * 100));
          setInkPercent(remaining);
        }
'''
new = '''        const curLen = calculateTotalLength(pts);
        const rect = canvas.getBoundingClientRect();
        const maxInkLength = getOneLineInkBudget(rect.width, rect.height);
        if (curLen < maxInkLength) {
          const segmentLength = last ? Math.hypot(pt.x - last.x, pt.y - last.y) : 0;
          if (curLen + segmentLength <= maxInkLength) {
            pts.push(pt);
          }
          const usedLength = Math.min(maxInkLength, curLen + segmentLength);
          const remaining = Math.max(0, Math.round(((maxInkLength - usedLength) / maxInkLength) * 100));
          setInkPercent(remaining);
        }
'''
if old not in s:
    raise SystemExit('One Line ink budget block not found')
s = s.replace(old, new, 1)

old = '''    onResize: (w, h) => {
      generateLevel(gameStateRef.current.level, w, h);
    },
'''
new = '''    onResize: (w, h) => {
      const state = gameStateRef.current;
      const oldW = state.viewportWidth;
      const oldH = state.viewportHeight;
      if (oldW <= 0 || oldH <= 0 || state.obstacles.length === 0) {
        generateLevel(state.level, w, h);
        return;
      }
      if (Math.abs(oldW - w) < 0.5 && Math.abs(oldH - h) < 0.5) return;

      const sx = w / oldW;
      const sy = h / oldH;
      state.startPos = remapOneLinePoint(state.startPos, oldW, oldH, w, h);
      state.target = {
        ...remapOneLinePoint(state.target, oldW, oldH, w, h),
        radius: state.target.radius,
      };
      state.ball.x *= sx;
      state.ball.y *= sy;
      state.ball.vx *= sx;
      state.ball.vy *= sy;
      state.lastPos = remapOneLinePoint(state.lastPos, oldW, oldH, w, h);
      state.linePoints = state.linePoints.map((point) => remapOneLinePoint(point, oldW, oldH, w, h));
      state.obstacles = state.obstacles.map((obstacle) => ({
        ...obstacle,
        x: obstacle.x * sx,
        y: obstacle.y * sy,
        w: obstacle.w * sx,
        h: obstacle.h * sy,
      }));
      state.stars = state.stars.map((star) => ({
        ...star,
        x: star.x * sx,
        y: star.y * sy,
      }));
      state.particles.forEach((particle) => {
        particle.x *= sx;
        particle.y *= sy;
        particle.vx *= sx;
        particle.vy *= sy;
      });
      state.viewportWidth = w;
      state.viewportHeight = h;

      const maxInkLength = getOneLineInkBudget(w, h);
      const usedInk = calculateTotalLength(state.linePoints);
      setInkPercent(Math.max(0, Math.round(((maxInkLength - usedInk) / maxInkLength) * 100)));
    },
'''
if old not in s:
    raise SystemExit('One Line resize block not found')
s = s.replace(old, new, 1)

old = '''      if (!isPausedRef.current && state.physicsRunning) {
        const subSteps = 4;
        const gravityPerStep = 0.28 / subSteps;
        const ballR = state.ball.radius;
        const minAllowedDist = ballR + 2.5;

        for (let step = 0; step < subSteps; step++) {
          state.ball.vy += gravityPerStep;
          state.ball.vx *= 0.9985;
          state.ball.vy *= 0.9985;

          state.ball.x += state.ball.vx / subSteps;
          state.ball.y += state.ball.vy / subSteps;
'''
new = '''      if (!isPausedRef.current && state.physicsRunning) {
        const batch = getOneLinePhysicsStepBatch(state.physicsAccumulator, dt);
        state.physicsAccumulator = batch.remainderSec;
        const ballR = state.ball.radius;
        const minAllowedDist = ballR + 2.5;

        for (let step = 0; step < batch.steps; step++) {
          // 240 Hz fixed step = the original four 60 Hz substeps, independent of display refresh rate.
          state.ball.vy += 0.28 / 4;
          state.ball.vx *= 0.9985;
          state.ball.vy *= 0.9985;

          state.ball.x += state.ball.vx / 4;
          state.ball.y += state.ball.vy / 4;
'''
if old not in s:
    raise SystemExit('One Line physics start block not found')
s = s.replace(old, new, 1)

old = '''        if (travelDist < 0.6) {
          state.stuckTimer++;
          if (state.stuckTimer > 120) {
            state.physicsRunning = false;
            setPhysicsRunning(false);
            setSafeTimeout(() => {
              generateLevel(state.level, curW, curH);
            }, 300);
          }
        } else {
          state.stuckTimer = 0;
        }
'''
new = '''        const frameScale = Math.max(0.001, Math.min(dt, 0.05) * 60);
        if (travelDist / frameScale < 0.6) {
          state.stuckTimer += Math.min(dt, 0.05);
          if (state.stuckTimer > 2) {
            state.physicsRunning = false;
            setPhysicsRunning(false);
            setSafeTimeout(resetCurrentAttempt, 300);
          }
        } else {
          state.stuckTimer = 0;
        }
'''
if old not in s:
    raise SystemExit('One Line stuck block not found')
s = s.replace(old, new, 1)

old = '''          } else {
            setSafeTimeout(() => {
              if (!gameStateRef.current) return;
              generateLevel(state.level, curW, curH);
            }, 400);
          }
'''
new = '''          } else {
            setSafeTimeout(resetCurrentAttempt, 400);
          }
'''
if old not in s:
    raise SystemExit('One Line out-of-bounds reset block not found')
s = s.replace(old, new, 1)

old = '''        state.shake *= 0.88;
        if (state.shake < 0.2) state.shake = 0;
'''
new = '''        state.shake *= Math.pow(0.88, Math.max(0.001, Math.min(dt, 0.05) * 60));
        if (state.shake < 0.2) state.shake = 0;
'''
if old not in s:
    raise SystemExit('One Line shake block not found')
s = s.replace(old, new, 1)

old = '''        p.x += p.vx;
        p.y += p.vy;
        p.life++;
'''
new = '''        const particleFrameScale = Math.max(0.001, Math.min(dt, 0.05) * 60);
        p.x += p.vx * particleFrameScale;
        p.y += p.vy * particleFrameScale;
        p.life += particleFrameScale;
'''
if old not in s:
    raise SystemExit('One Line particle block not found')
s = s.replace(old, new, 1)

path.write_text(s)

Path('src/lib/oneLineRuntime.ts').write_text('''export const ONE_LINE_PHYSICS_HZ = 240;
export const ONE_LINE_FIXED_STEP_SEC = 1 / ONE_LINE_PHYSICS_HZ;
export const ONE_LINE_MAX_FRAME_SEC = 0.05;
export const ONE_LINE_REFERENCE_WIDTH = 420;
export const ONE_LINE_REFERENCE_HEIGHT = 500;
export const ONE_LINE_REFERENCE_INK = 1100;

export const getOneLineInkBudget = (width: number, height: number) => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const referenceDiagonal = Math.hypot(ONE_LINE_REFERENCE_WIDTH, ONE_LINE_REFERENCE_HEIGHT);
  const diagonal = Math.hypot(safeWidth, safeHeight);
  return ONE_LINE_REFERENCE_INK * (diagonal / referenceDiagonal);
};

export const getOneLinePhysicsStepBatch = (accumulatorSec: number, deltaSec: number) => {
  const totalSec = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), ONE_LINE_MAX_FRAME_SEC);
  const steps = Math.floor((totalSec + 1e-9) / ONE_LINE_FIXED_STEP_SEC);
  return {
    steps,
    remainderSec: Math.max(0, totalSec - steps * ONE_LINE_FIXED_STEP_SEC),
  };
};

export const remapOneLinePoint = <T extends { x: number; y: number }>(
  point: T,
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
): T => ({
  ...point,
  x: point.x * (newWidth / Math.max(1, oldWidth)),
  y: point.y * (newHeight / Math.max(1, oldHeight)),
});
''')

Path('scripts/audit-one-line.ts').write_text('''import { readFileSync } from 'node:fs';
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
assert(!source.includes('onResize: (w, h) => {\n      generateLevel('), 'resize still regenerates the puzzle');
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
''')

pkg = Path('package.json')
text = pkg.read_text()
needle = '    "quality:typerush": "bun scripts/audit-type-rush.ts",\n'
if '"quality:oneline"' not in text:
    if needle not in text:
        raise SystemExit('package Type Rush anchor not found')
    text = text.replace(needle, needle + '    "quality:oneline": "bun scripts/audit-one-line.ts",\n', 1)
pkg.write_text(text)

ci = Path('.github/workflows/ci.yml')
text = ci.read_text()
needle = '      - run: bun run quality:typerush\n'
if 'bun run quality:oneline' not in text:
    if needle not in text:
        raise SystemExit('CI Type Rush anchor not found')
    text = text.replace(needle, needle + '      - run: bun run quality:oneline\n', 1)
ci.write_text(text)

release = Path('scripts/audit-release-32.ts')
text = release.read_text()
if "  'quality:oneline'," not in text:
    needle = "  'quality:typerush',\n"
    if needle not in text:
        raise SystemExit('release Type Rush gate anchor not found')
    text = text.replace(needle, needle + "  'quality:oneline',\n", 1)
if "  'scripts/audit-one-line.ts'," not in text:
    needle = "  'scripts/audit-type-rush.ts',\n"
    if needle not in text:
        raise SystemExit('release Type Rush audit anchor not found')
    text = text.replace(needle, needle + "  'scripts/audit-one-line.ts',\n", 1)
release.write_text(text)
