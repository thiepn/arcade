from pathlib import Path

path = Path('src/games/GravityGame.tsx')
s = path.read_text()

anchor = "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\n"
replacement = anchor + "import {\n  advanceGravityBody,\n  getGravityPhysicsStepBatch,\n  getGravityResizeScale,\n  remapGravityPoint,\n} from '../lib/gravityRuntime';\n"
if anchor not in s:
    raise SystemExit('Gravity import anchor not found')
s = s.replace(anchor, replacement, 1)

anchor = "    wormholePulse: 0,\n    gravityInverted: false,\n  });\n"
replacement = "    wormholePulse: 0,\n    gravityInverted: false,\n    physicsAccumulator: 0,\n    viewportWidth: 0,\n    viewportHeight: 0,\n    steerImpulsePending: false,\n  });\n"
if anchor not in s:
    raise SystemExit('Gravity state anchor not found')
s = s.replace(anchor, replacement, 1)

anchor = "    state.startPos = { x: cx, y: cy };\n"
replacement = "    state.viewportWidth = w;\n    state.viewportHeight = h;\n    state.physicsAccumulator = 0;\n    state.steerImpulsePending = false;\n    state.startPos = { x: cx, y: cy };\n"
if anchor not in s:
    raise SystemExit('Gravity setup anchor not found')
s = s.replace(anchor, replacement, 1)

old = """      if (state.hasLaunched) {
        // In-flight steering: steer towards click/touch point!
        state.isSteering = true;
        state.steerTarget = pos;
        applyDirectionSteer(pos.x, pos.y, 1.5);
        return;
      }
"""
new = """      if (state.hasLaunched) {
        // In-flight steering is consumed by the fixed-step simulation, not pointer event frequency.
        state.isSteering = true;
        state.steerTarget = pos;
        state.steerImpulsePending = true;
        return;
      }
"""
if old not in s:
    raise SystemExit('Gravity steering-down block not found')
s = s.replace(old, new, 1)

old = """      if (state.hasLaunched && state.isSteering) {
        state.steerTarget = pos;
        applyDirectionSteer(pos.x, pos.y, 1.0);
        return;
      }
"""
new = """      if (state.hasLaunched && state.isSteering) {
        state.steerTarget = pos;
        return;
      }
"""
if old not in s:
    raise SystemExit('Gravity steering-move block not found')
s = s.replace(old, new, 1)

anchor = "      state.isSteering = false;\n\n      if (!state.isAiming || state.hasLaunched) return;\n"
replacement = "      state.isSteering = false;\n      state.steerImpulsePending = false;\n\n      if (!state.isAiming || state.hasLaunched) return;\n"
if anchor not in s:
    raise SystemExit('Gravity steering-up anchor not found')
s = s.replace(anchor, replacement, 1)

anchor = "        state.hasLaunched = true;\n        state.attempts++;\n"
replacement = "        state.hasLaunched = true;\n        state.physicsAccumulator = 0;\n        state.attempts++;\n"
if anchor not in s:
    raise SystemExit('Gravity launch anchor not found')
s = s.replace(anchor, replacement, 1)

old = """    onResize: (w, h) => {
      setupLevel(gameStateRef.current.level, w, h);
    },
"""
new = """    onResize: (w, h) => {
      const state = gameStateRef.current;
      const oldW = state.viewportWidth;
      const oldH = state.viewportHeight;
      if (oldW <= 0 || oldH <= 0 || state.planets.length === 0) {
        setupLevel(state.level, w, h);
        return;
      }
      if (Math.abs(oldW - w) < 0.5 && Math.abs(oldH - h) < 0.5) return;

      const sx = w / oldW;
      const sy = h / oldH;
      const sizeScale = getGravityResizeScale(oldW, oldH, w, h);
      const massScale = sizeScale * sizeScale * sizeScale;

      state.startPos = remapGravityPoint(state.startPos, oldW, oldH, w, h);
      state.aimDrag = remapGravityPoint(state.aimDrag, oldW, oldH, w, h);
      state.steerTarget = remapGravityPoint(state.steerTarget, oldW, oldH, w, h);
      state.target = {
        ...remapGravityPoint(state.target, oldW, oldH, w, h),
        radius: state.target.radius * sizeScale,
      };
      state.probe.x *= sx;
      state.probe.y *= sy;
      state.probe.vx *= sx;
      state.probe.vy *= sy;
      state.probe.radius *= sizeScale;
      state.trail = state.trail.map((point) => remapGravityPoint(point, oldW, oldH, w, h));
      state.planets = state.planets.map((planet) => {
        const baseMass = planet.baseMass * massScale;
        const mass = state.gravityInverted ? -baseMass : baseMass;
        return {
          ...planet,
          x: planet.x * sx,
          y: planet.y * sy,
          radius: planet.radius * sizeScale,
          baseMass,
          mass,
          type: mass < 0 ? 'repulsion' : 'gravity',
        };
      });
      state.stars = state.stars.map((star) => ({
        ...star,
        x: star.x * sx,
        y: star.y * sy,
        radius: star.radius * sizeScale,
      }));
      state.particles.forEach((particle) => {
        particle.x *= sx;
        particle.y *= sy;
        particle.vx *= sx;
        particle.vy *= sy;
        particle.size *= sizeScale;
      });
      state.viewportWidth = w;
      state.viewportHeight = h;
    },
"""
if old not in s:
    raise SystemExit('Gravity resize block not found')
s = s.replace(old, new, 1)

old = """      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= 0.88;
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-20, -20, curW + 40, curH + 40);

      state.wormholePulse += 0.05;
"""
new = """      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= Math.pow(0.88, Math.max(0.001, Math.min(dt, 0.05) * 60));
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-20, -20, curW + 40, curH + 40);

      state.wormholePulse += Math.min(dt, 0.05) * 3;
"""
if old not in s:
    raise SystemExit('Gravity frame-effects block not found')
s = s.replace(old, new, 1)

start = s.index("      if (!isPausedRef.current && state.isAlive) {\n        if (state.hasLaunched) {\n")
end_marker = "      // --- RENDERING ---\n"
end = s.index(end_marker, start)
new_block = """      if (!isPausedRef.current && state.isAlive && state.hasLaunched) {
        const batch = getGravityPhysicsStepBatch(state.physicsAccumulator, dt);
        state.physicsAccumulator = batch.remainderSec;
        const timeScale = isSlowMoRef.current ? 0.35 : 1.0;

        for (let step = 0; step < batch.steps && state.hasLaunched && state.isAlive; step++) {
          if (state.isSteering) {
            applyDirectionSteer(
              state.steerTarget.x,
              state.steerTarget.y,
              state.steerImpulsePending ? 1.5 : 0.6,
            );
            state.steerImpulsePending = false;
          }

          let fx = 0;
          let fy = 0;
          let collisionPlanet: Planet | null = null;

          for (const planet of state.planets) {
            const dx = planet.x - state.probe.x;
            const dy = planet.y - state.probe.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 6) {
              const force = (planet.mass * 0.75) / (dist * dist);
              fx += (dx / dist) * force;
              fy += (dy / dist) * force;
            }
            if (dist < planet.radius * 0.85 + state.probe.radius) {
              collisionPlanet = planet;
              break;
            }
          }

          if (collisionPlanet) {
            state.hasLaunched = false;
            state.physicsAccumulator = 0;
            state.steerImpulsePending = false;
            state.shake = 10;
            state.lives--;
            setLives(state.lives);
            haptics.impact();
            if (soundEnabled) sounds.playExplosion();

            for (let k = 0; k < 18; k++) {
              const ang = Math.random() * Math.PI * 2;
              state.particles.push({
                x: state.probe.x,
                y: state.probe.y,
                vx: Math.cos(ang) * (2 + Math.random() * 4),
                vy: Math.sin(ang) * (2 + Math.random() * 4),
                color: collisionPlanet.color,
                size: 3.5,
                life: 0,
                maxLife: 25,
              });
            }

            if (state.lives <= 0) {
              state.isAlive = false;
              haptics.gameOver();
              onGameOver(state.score);
            } else {
              setSafeTimeout(() => {
                state.probe.x = state.startPos.x;
                state.probe.y = state.startPos.y;
                state.probe.vx = 0;
                state.probe.vy = 0;
                state.trail = [];
                state.boosts = 4;
                state.physicsAccumulator = 0;
                setBoostsRemaining(4);
                setHasLaunched(false);
              }, 400);
            }
            break;
          }

          const tdx = state.target.x - state.probe.x;
          const tdy = state.target.y - state.probe.y;
          const tdistBefore = Math.hypot(tdx, tdy);
          const pullRadius = 100 * getGravityResizeScale(420, 500, curW, curH);
          if (tdistBefore > 0.001 && tdistBefore < pullRadius) {
            const pull = (pullRadius - tdistBefore) * 0.0045;
            fx += (tdx / tdistBefore) * pull;
            fy += (tdy / tdistBefore) * pull;
          }

          advanceGravityBody(state.probe, fx, fy, timeScale);

          state.trail.push({ x: state.probe.x, y: state.probe.y });
          if (state.trail.length > 50) state.trail.shift();

          for (const star of state.stars) {
            if (star.collected) continue;
            const sdist = Math.hypot(star.x - state.probe.x, star.y - state.probe.y);
            if (sdist < star.radius + state.probe.radius) {
              star.collected = true;
              state.score += 500;
              onScoreUpdate(state.score);
              setStarsCollected((prev) => prev + 1);
              haptics.score();
              if (soundEnabled) sounds.playScore();

              for (let k = 0; k < 12; k++) {
                state.particles.push({
                  x: star.x,
                  y: star.y,
                  vx: (Math.random() - 0.5) * 5,
                  vy: (Math.random() - 0.5) * 5,
                  color: '#FACC15',
                  size: 3,
                  life: 0,
                  maxLife: 20,
                });
              }
            }
          }

          const targetDist = Math.hypot(state.target.x - state.probe.x, state.target.y - state.probe.y);
          if (targetDist < state.target.radius * 0.8 + state.probe.radius) {
            state.hasLaunched = false;
            state.physicsAccumulator = 0;
            state.steerImpulsePending = false;
            setHasLaunched(false);

            const collectedStars = state.stars.filter((star) => star.collected).length;
            const sectorBonus = 1000 + collectedStars * 500;
            state.score += sectorBonus;
            onScoreUpdate(state.score);
            haptics.combo();
            if (soundEnabled) sounds.playSuccess();

            for (let k = 0; k < 30; k++) {
              state.particles.push({
                x: state.target.x,
                y: state.target.y,
                vx: (Math.random() - 0.5) * 7,
                vy: (Math.random() - 0.5) * 7,
                color: '#34D399',
                size: 4,
                life: 0,
                maxLife: 30,
              });
            }

            state.level++;
            setSafeTimeout(() => {
              setupLevel(state.level, state.viewportWidth, state.viewportHeight);
            }, 600);
            break;
          }

          if (
            state.probe.x < -80 ||
            state.probe.x > curW + 80 ||
            state.probe.y < -80 ||
            state.probe.y > curH + 80
          ) {
            state.hasLaunched = false;
            state.physicsAccumulator = 0;
            state.steerImpulsePending = false;
            setHasLaunched(false);
            state.lives--;
            setLives(state.lives);
            if (soundEnabled) sounds.playBuzz();

            if (state.lives <= 0) {
              state.isAlive = false;
              onGameOver(state.score);
            } else {
              setSafeTimeout(() => {
                state.probe.x = state.startPos.x;
                state.probe.y = state.startPos.y;
                state.probe.vx = 0;
                state.probe.vy = 0;
                state.trail = [];
                state.boosts = 4;
                state.physicsAccumulator = 0;
                setBoostsRemaining(4);
                setHasLaunched(false);
              }, 300);
            }
            break;
          }
        }
      }

"""
s = s[:start] + new_block + s[end:]

old = """        p.x += p.vx;
        p.y += p.vy;
        p.life++;
"""
new = """        const particleFrameScale = Math.max(0.001, Math.min(dt, 0.05) * 60);
        p.x += p.vx * particleFrameScale;
        p.y += p.vy * particleFrameScale;
        p.life += particleFrameScale;
"""
if old not in s:
    raise SystemExit('Gravity particle block not found')
s = s.replace(old, new, 1)

path.write_text(s)

Path('src/lib/gravityRuntime.ts').write_text("""export const GRAVITY_PHYSICS_HZ = 60;
export const GRAVITY_FIXED_STEP_SEC = 1 / GRAVITY_PHYSICS_HZ;
export const GRAVITY_MAX_FRAME_SEC = 0.05;

export const getGravityPhysicsStepBatch = (accumulatorSec: number, deltaSec: number) => {
  const totalSec = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), GRAVITY_MAX_FRAME_SEC);
  const steps = Math.floor((totalSec + 1e-9) / GRAVITY_FIXED_STEP_SEC);
  return { steps, remainderSec: Math.max(0, totalSec - steps * GRAVITY_FIXED_STEP_SEC) };
};

export const advanceGravityBody = <T extends { x: number; y: number; vx: number; vy: number }>(
  body: T,
  forceX: number,
  forceY: number,
  timeScale = 1,
) => {
  body.vx += forceX * timeScale;
  body.vy += forceY * timeScale;
  body.x += body.vx * timeScale;
  body.y += body.vy * timeScale;
  return body;
};

export const remapGravityPoint = <T extends { x: number; y: number }>(
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

export const getGravityResizeScale = (
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
) => Math.sqrt((newWidth / Math.max(1, oldWidth)) * (newHeight / Math.max(1, oldHeight)));
""")

Path('scripts/audit-gravity.ts').write_text("""import { readFileSync } from 'node:fs';
import {
  GRAVITY_FIXED_STEP_SEC,
  GRAVITY_PHYSICS_HZ,
  advanceGravityBody,
  getGravityPhysicsStepBatch,
  getGravityResizeScale,
  remapGravityPoint,
} from '../src/lib/gravityRuntime';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
const source = readFileSync('src/games/GravityGame.tsx', 'utf8');

assert(GRAVITY_PHYSICS_HZ === 60, `expected 60 Hz fixed Gravity simulation, found ${GRAVITY_PHYSICS_HZ}`);
assert(source.includes('getGravityPhysicsStepBatch(state.physicsAccumulator, dt)'), 'Gravity does not use elapsed-time fixed-step simulation');
assert(source.includes('advanceGravityBody(state.probe, fx, fy, timeScale)'), 'Gravity body integration is not centralized in the deterministic step helper');
assert(!source.includes('state.probe.vx += fx * timeScale;'), 'legacy per-render-frame Newtonian integration remains');
assert(!/onResize:\s*\(w, h\)\s*=>\s*\{\s*setupLevel\(/.test(source), 'resize still rebuilds the active level');
assert(source.includes('state.planets = state.planets.map') && source.includes('state.stars = state.stars.map') && source.includes('state.trail = state.trail.map'), 'resize does not preserve/remap active level state');
assert(source.includes('state.probe.vx *= sx') && source.includes('state.probe.vy *= sy'), 'resize does not remap active probe velocity');
assert(!source.includes('applyDirectionSteer(pos.x, pos.y, 1.0)'), 'pointer move frequency can still apply extra steering impulses');
assert(source.includes('state.steerImpulsePending = true'), 'initial steering impulse is not queued for deterministic simulation');
assert(source.includes('particleFrameScale'), 'Gravity particle lifetime/motion remains render-frame dependent');
assert(source.includes('Math.pow(0.88') && source.includes('state.wormholePulse += Math.min(dt, 0.05) * 3'), 'Gravity visual timers remain render-frame dependent');

const simulate = (fps: number, seconds = 5) => {
  let accumulator = 0;
  const body = { x: 10, y: 20, vx: 1.25, vy: -0.4 };
  let steps = 0;
  const dt = 1 / fps;
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
    const batch = getGravityPhysicsStepBatch(accumulator, dt);
    accumulator = batch.remainderSec;
    for (let step = 0; step < batch.steps; step++) {
      advanceGravityBody(body, 0.0125, -0.006, 1);
      steps++;
    }
  }
  return { body, steps };
};
const baseline = simulate(60);
const expectedSteps = Math.round(5 / GRAVITY_FIXED_STEP_SEC);
assert(Math.abs(baseline.steps - expectedSteps) <= 1, `60 FPS executed ${baseline.steps} steps instead of about ${expectedSteps}`);
for (const fps of [30, 60, 120, 144, 240]) {
  const result = simulate(fps);
  assert(Math.abs(result.steps - baseline.steps) <= 1, `${fps} FPS executes ${result.steps} steps vs ${baseline.steps} at 60 FPS`);
  assert(Math.abs(result.body.x - baseline.body.x) < 0.001, `${fps} FPS changes Gravity X trajectory`);
  assert(Math.abs(result.body.y - baseline.body.y) < 0.001, `${fps} FPS changes Gravity Y trajectory`);
  assert(Math.abs(result.body.vx - baseline.body.vx) < 0.00001, `${fps} FPS changes Gravity X velocity`);
  assert(Math.abs(result.body.vy - baseline.body.vy) < 0.00001, `${fps} FPS changes Gravity Y velocity`);
}
const mapped = remapGravityPoint({ x: 100, y: 150 }, 400, 600, 800, 300);
assert(mapped.x === 200 && mapped.y === 75, 'Gravity resize remapping does not preserve normalized position');
assert(Math.abs(getGravityResizeScale(400, 600, 800, 300) - 1) < 1e-12, 'orientation-like resize should preserve circular object scale');
assert(Math.abs(getGravityResizeScale(400, 600, 800, 1200) - 2) < 1e-12, 'uniform 2x resize should scale circular objects by 2x');

if (errors.length) {
  console.error('GRAVITY DETERMINISM / RESIZE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('GRAVITY DETERMINISM / RESIZE AUDIT — PASS');
console.log('Refresh-rate invariant Newtonian stepping, deterministic steering, same-level resize remapping, and dt-based effects are certified.');
""")

pkg = Path('package.json')
text = pkg.read_text()
needle = '    "quality:oneline": "bun scripts/audit-one-line.ts",\n'
if '"quality:gravity"' not in text:
    if needle not in text:
        raise SystemExit('package One Line anchor not found')
    text = text.replace(needle, needle + '    "quality:gravity": "bun scripts/audit-gravity.ts",\n', 1)
pkg.write_text(text)
