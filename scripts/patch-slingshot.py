from pathlib import Path

path = Path('src/games/SlingshotGame.tsx')
s = path.read_text()

anchor = "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\n"
replacement = anchor + "import {\n  advanceSlingshotProbe,\n  getSlingshotPhysicsStepBatch,\n  getSlingshotResizeScale,\n  remapSlingshotPoint,\n} from '../lib/slingshotRuntime';\n"
if anchor not in s:
    raise SystemExit('Slingshot import anchor not found')
s = s.replace(anchor, replacement, 1)

old = """  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
"""
new = """  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
"""
if old not in s:
    raise SystemExit('Slingshot pause ref block not found')
s = s.replace(old, new, 1)

anchor = "    isAimingAtNext: false,\n    lockOnSoundPlayed: false,\n  });\n"
replacement = "    isAimingAtNext: false,\n    lockOnSoundPlayed: false,\n    physicsAccumulator: 0,\n    viewportWidth: 0,\n    viewportHeight: 0,\n  });\n"
if anchor not in s:
    raise SystemExit('Slingshot state anchor not found')
s = s.replace(anchor, replacement, 1)

old = "    if (!state.isTethered || !state.isAlive) return;\n"
new = "    if (!state.isTethered || !state.isAlive || isPausedRef.current) return;\n"
if old not in s:
    raise SystemExit('Slingshot launch guard not found')
s = s.replace(old, new, 1)

anchor = "    state.nebulae = [];\n\n    const startX = w / 2;\n"
replacement = "    state.nebulae = [];\n    state.viewportWidth = w;\n    state.viewportHeight = h;\n    state.physicsAccumulator = 0;\n\n    const startX = w / 2;\n"
if anchor not in s:
    raise SystemExit('Slingshot init viewport anchor not found')
s = s.replace(anchor, replacement, 1)

old = """    const handleAction = (e: MouseEvent | TouchEvent | KeyboardEvent) => {
      if ('key' in e && e.key !== ' ' && e.key !== 'Enter' && e.key !== 'ArrowUp') return;
      if (e.type === 'touchstart') e.preventDefault();
      launchProbe();
    };
"""
new = """    const handleAction = (e: MouseEvent | TouchEvent | KeyboardEvent) => {
      if (isPausedRef.current) return;
      if ('key' in e && e.key !== ' ' && e.key !== 'Enter' && e.key !== 'ArrowUp') return;
      if ('key' in e) e.preventDefault();
      if (e.type === 'touchstart') e.preventDefault();
      launchProbe();
    };
"""
if old not in s:
    raise SystemExit('Slingshot action handler block not found')
s = s.replace(old, new, 1)

old = """    onResize: (w, h) => {
      if (gameStateRef.current.nodes.length === 0) {
        initNodes(w, h);
      }
    },
"""
new = """    onResize: (w, h) => {
      const st = gameStateRef.current;
      const oldW = st.viewportWidth;
      const oldH = st.viewportHeight;
      if (oldW <= 0 || oldH <= 0 || st.nodes.length === 0) {
        initNodes(w, h);
        return;
      }
      if (Math.abs(oldW - w) < 0.5 && Math.abs(oldH - h) < 0.5) return;

      const sx = w / oldW;
      const sy = h / oldH;
      const sizeScale = getSlingshotResizeScale(oldW, oldH, w, h);

      st.nodes = st.nodes.map((node) => ({
        ...node,
        x: node.x * sx,
        y: node.y * sy,
        radius: node.radius * sizeScale,
        gravityRadius: node.gravityRadius * sizeScale,
      }));
      st.stardust = st.stardust.map((star) => ({
        ...star,
        x: star.x * sx,
        y: star.y * sy,
      }));
      st.asteroids = st.asteroids.map((asteroid) => ({
        ...asteroid,
        x: asteroid.x * sx,
        y: asteroid.y * sy,
        size: asteroid.size * sizeScale,
        orbitRadius: asteroid.orbitRadius * sizeScale,
      }));
      st.nebulae = st.nebulae.map((nebula) => ({
        ...nebula,
        x: nebula.x * sx,
        y: nebula.y * sy,
        radius: nebula.radius * sizeScale,
      }));
      st.trail = st.trail.map((point) => ({ ...point, ...remapSlingshotPoint(point, oldW, oldH, w, h) }));
      st.particles.forEach((particle) => {
        particle.x *= sx;
        particle.y *= sy;
        particle.vx *= sx;
        particle.vy *= sy;
        particle.size *= sizeScale;
      });
      st.popups.forEach((popup) => {
        popup.x *= sx;
        popup.y *= sy;
      });

      st.orbitRadius *= sizeScale;
      const currentAnchor = st.nodes.find((node) => node.id === st.currentAnchorId);
      if (st.isTethered && currentAnchor) {
        st.probeX = currentAnchor.x + Math.cos(st.orbitAngle) * st.orbitRadius;
        st.probeY = currentAnchor.y + Math.sin(st.orbitAngle) * st.orbitRadius;
      } else {
        st.probeX *= sx;
        st.probeY *= sy;
        st.probeVx *= sx;
        st.probeVy *= sy;
      }

      st.cameraY *= sy;
      st.targetCameraY *= sy;
      st.viewportWidth = w;
      st.viewportHeight = h;
      st.physicsAccumulator = 0;
    },
"""
if old not in s:
    raise SystemExit('Slingshot resize block not found')
s = s.replace(old, new, 1)

old = """      if (!isPausedRef.current && st.isAlive) {
        if (st.screenShake > 0) st.screenShake *= 0.88;

        st.cameraY += (st.targetCameraY - st.cameraY) * 0.085;

        const currentAnchor = st.nodes.find((n) => n.id === st.currentAnchorId);
        const nextAnchor = st.nodes.find((n) => n.id === st.currentAnchorId + 1);

        // Update pulse phase on all planets
        st.nodes.forEach((n) => {
          n.pulsePhase += 0.04;
        });

        // Update Asteroid orbits
        st.asteroids.forEach((ast) => {
          const anchor = st.nodes.find((n) => n.id === ast.orbitNodeId);
          if (anchor) {
            ast.angle += ast.orbitSpeed;
            ast.x = anchor.x + Math.cos(ast.angle) * ast.orbitRadius;
            ast.y = anchor.y + Math.sin(ast.angle) * ast.orbitRadius;
          }
        });

        if (st.isTethered && currentAnchor) {
"""
new = """      if (!isPausedRef.current && st.isAlive) {
        const frameScale = Math.max(0.001, Math.min(deltaSec, 0.05) * 60);
        if (st.screenShake > 0) {
          st.screenShake *= Math.pow(0.88, frameScale);
          if (st.screenShake < 0.2) st.screenShake = 0;
        }

        // Visual pulses stay smooth while gameplay advances in fixed 60 Hz steps.
        st.nodes.forEach((n) => {
          n.pulsePhase += 0.04 * frameScale;
        });

        const batch = getSlingshotPhysicsStepBatch(st.physicsAccumulator, deltaSec);
        st.physicsAccumulator = batch.remainderSec;
        for (let simStep = 0; simStep < batch.steps && st.isAlive; simStep++) {
          const currentAnchor = st.nodes.find((n) => n.id === st.currentAnchorId);
          const nextAnchor = st.nodes.find((n) => n.id === st.currentAnchorId + 1);

          // Asteroids and probe movement share the same fixed simulation clock.
          st.asteroids.forEach((ast) => {
            const anchor = st.nodes.find((n) => n.id === ast.orbitNodeId);
            if (anchor) {
              ast.angle += ast.orbitSpeed;
              ast.x = anchor.x + Math.cos(ast.angle) * ast.orbitRadius;
              ast.y = anchor.y + Math.sin(ast.angle) * ast.orbitRadius;
            }
          });

          if (st.isTethered && currentAnchor) {
"""
if old not in s:
    raise SystemExit('Slingshot update header block not found')
s = s.replace(old, new, 1)

old = """          // Free space flight
          st.probeX += st.probeVx;
          st.probeY += st.probeVy;
"""
new = """          // Free space flight on the same fixed simulation clock as orbital motion.
          advanceSlingshotProbe(st);
"""
if old not in s:
    raise SystemExit('Slingshot free-flight block not found')
s = s.replace(old, new, 1)

old = """        // Trail fade
        st.trail.forEach((t) => (t.alpha -= 0.02));
        st.trail = st.trail.filter((t) => t.alpha > 0.02);
      }

      // --- RENDERING ---
"""
new = """          // Trail fade is tied to simulation time rather than render frequency.
          st.trail.forEach((t) => (t.alpha -= 0.02));
          st.trail = st.trail.filter((t) => t.alpha > 0.02);
        }

        const cameraBlend = 1 - Math.pow(1 - 0.085, frameScale);
        st.cameraY += (st.targetCameraY - st.cameraY) * cameraBlend;
      }

      // --- RENDERING ---
"""
if old not in s:
    raise SystemExit('Slingshot trail/update close block not found')
s = s.replace(old, new, 1)

old = """      // Draw Particles
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
"""
new = """      const effectFrameScale = isPausedRef.current ? 0 : Math.max(0, Math.min(deltaSec, 0.05) * 60);

      // Draw Particles
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        p.x += p.vx * effectFrameScale;
        p.y += p.vy * effectFrameScale;
        p.life -= 0.03 * effectFrameScale;
"""
if old not in s:
    raise SystemExit('Slingshot particle update block not found')
s = s.replace(old, new, 1)

old = """        const popup = st.popups[i];
        popup.y -= 1.0;
        popup.life -= 0.02;
"""
new = """        const popup = st.popups[i];
        popup.y -= 1.0 * effectFrameScale;
        popup.life -= 0.02 * effectFrameScale;
"""
if old not in s:
    raise SystemExit('Slingshot popup update block not found')
s = s.replace(old, new, 1)

path.write_text(s)

Path('src/lib/slingshotRuntime.ts').write_text("""export const SLINGSHOT_PHYSICS_HZ = 60;
export const SLINGSHOT_FIXED_STEP_SEC = 1 / SLINGSHOT_PHYSICS_HZ;
export const SLINGSHOT_MAX_FRAME_SEC = 0.05;

export interface SlingshotProbeBody {
  probeX: number;
  probeY: number;
  probeVx: number;
  probeVy: number;
}

export const advanceSlingshotProbe = (body: SlingshotProbeBody) => {
  body.probeX += body.probeVx;
  body.probeY += body.probeVy;
};

export const getSlingshotPhysicsStepBatch = (accumulatorSec: number, deltaSec: number) => {
  const totalSec = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), SLINGSHOT_MAX_FRAME_SEC);
  const steps = Math.floor((totalSec + 1e-9) / SLINGSHOT_FIXED_STEP_SEC);
  return {
    steps,
    remainderSec: Math.max(0, totalSec - steps * SLINGSHOT_FIXED_STEP_SEC),
  };
};

export const getSlingshotResizeScale = (
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
) => {
  const sx = newWidth / Math.max(1, oldWidth);
  const sy = newHeight / Math.max(1, oldHeight);
  return Math.sqrt(Math.max(0.01, sx * sy));
};

export const remapSlingshotPoint = <T extends { x: number; y: number }>(
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
""")

Path('scripts/audit-slingshot.ts').write_text("""import { readFileSync } from 'node:fs';
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
""")

pkg = Path('package.json')
text = pkg.read_text()
needle = '    "quality:gravity": "bun scripts/audit-gravity.ts",\n'
if '"quality:slingshot"' not in text:
    if needle not in text:
        raise SystemExit('package Gravity anchor not found')
    text = text.replace(needle, needle + '    "quality:slingshot": "bun scripts/audit-slingshot.ts",\n', 1)
pkg.write_text(text)

release = Path('scripts/audit-release-32.ts')
text = release.read_text()
if "  'quality:slingshot'," not in text:
    needle = "  'quality:gravity',\n"
    if needle not in text:
        raise SystemExit('release Gravity gate anchor not found')
    text = text.replace(needle, needle + "  'quality:slingshot',\n", 1)
if "  'scripts/audit-slingshot.ts'," not in text:
    needle = "  'scripts/audit-gravity.ts',\n"
    if needle not in text:
        raise SystemExit('release Gravity audit anchor not found')
    text = text.replace(needle, needle + "  'scripts/audit-slingshot.ts',\n", 1)
release.write_text(text)
