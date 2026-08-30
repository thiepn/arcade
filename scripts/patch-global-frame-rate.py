from pathlib import Path
import json

root = Path('.')

def read(path): return (root / path).read_text()
def write(path, text): (root / path).write_text(text)
def repl(text, old, new, label, count=1):
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, count)

# Shared frame-rate runtime.
write('src/lib/frameRateRuntime.ts', '''export const ARCADE_REFERENCE_HZ = 60;
export const ARCADE_FIXED_STEP_SEC = 1 / ARCADE_REFERENCE_HZ;
export const ARCADE_MAX_FRAME_SEC = 0.08;
export const ARCADE_MAX_STEPS_PER_FRAME = 8;

export interface ArcadeStepBatch {
  steps: number;
  remainderSec: number;
}

export const getArcadeStepBatch = (accumulatorSec: number, deltaSec: number): ArcadeStepBatch => {
  let accumulator = Math.max(0, accumulatorSec) + Math.min(Math.max(0, deltaSec), ARCADE_MAX_FRAME_SEC);
  let steps = 0;
  while (accumulator + 1e-12 >= ARCADE_FIXED_STEP_SEC && steps < ARCADE_MAX_STEPS_PER_FRAME) {
    accumulator -= ARCADE_FIXED_STEP_SEC;
    steps++;
  }
  return { steps, remainderSec: Math.max(0, accumulator) };
};

export const getFrameScale = (deltaSec: number): number =>
  Math.min(ARCADE_MAX_STEPS_PER_FRAME, Math.max(0, deltaSec) * ARCADE_REFERENCE_HZ);

export const getFrameInvariantBlend = (perFrameBlend: number, frameScale: number): number => {
  const blend = Math.min(1, Math.max(0, perFrameBlend));
  return 1 - Math.pow(1 - blend, Math.max(0, frameScale));
};

export const getFrameInvariantDecay = (perFrameFactor: number, frameScale: number): number =>
  Math.pow(Math.min(1, Math.max(0, perFrameFactor)), Math.max(0, frameScale));

export const getFrameInvariantChance = (perFrameProbability: number, frameScale: number): number => {
  const probability = Math.min(1, Math.max(0, perFrameProbability));
  return 1 - Math.pow(1 - probability, Math.max(0, frameScale));
};
''')

# BREAKOUT — fixed 60 Hz gameplay, elapsed-time effects.
p = 'src/games/BreakoutGame.tsx'
s = read(p)
s = repl(s, "import { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';\n",
         "import { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';\nimport { ARCADE_FIXED_STEP_SEC, getArcadeStepBatch, getFrameScale } from '../lib/frameRateRuntime';\n", 'breakout import')
s = repl(s, "    viewportHeight: 600,\n", "    viewportHeight: 600,\n    physicsAccumulator: 0,\n", 'breakout accumulator state')
s = repl(s, "    state.fireballTimeRemaining = 0;\n", "    state.fireballTimeRemaining = 0;\n    state.physicsAccumulator = 0;\n", 'breakout init accumulator')
s = repl(s, "      state.viewportHeight = h;\n      state.paddleX = clamp",
         "      state.viewportHeight = h;\n      state.physicsAccumulator = 0;\n      state.paddleX = clamp", 'breakout resize accumulator')
s = repl(s, "    onUpdate: (ctx, dt, curW, curH) => {\n      const delta = Math.min(32, dt * 1000);\n      const state = gameStateRef.current;\n",
         "    onUpdate: (ctx, deltaSec, curW, curH) => {\n      const state = gameStateRef.current;\n      const batch = !isPausedRef.current && state.isAlive\n        ? getArcadeStepBatch(state.physicsAccumulator, deltaSec)\n        : { steps: 0, remainderSec: 0 };\n      state.physicsAccumulator = batch.remainderSec;\n      const effectFrameScale = !isPausedRef.current ? getFrameScale(deltaSec) : 0;\n", 'breakout onUpdate head')
s = repl(s, "        state.shake *= 0.88;\n        if (state.shake < 0.2) state.shake = 0;\n", "", 'breakout shake render decay')
s = repl(s, "      if (!isPausedRef.current && state.isAlive) {\n        // Paddle movement\n",
         "      if (!isPausedRef.current && state.isAlive) {\n        for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++) {\n          const delta = ARCADE_FIXED_STEP_SEC * 1000;\n          if (state.shake > 0) {\n            state.shake *= 0.88;\n            if (state.shake < 0.2) state.shake = 0;\n          }\n        // Paddle movement\n", 'breakout fixed loop start')
s = repl(s, "      }\n\n      // --- RENDERING ---\n", "        }\n      }\n\n      // --- RENDERING ---\n", 'breakout fixed loop end')
s = s.replace("        p.x += p.vx;\n        p.y += p.vy;\n        p.life++;",
              "        p.x += p.vx * effectFrameScale;\n        p.y += p.vy * effectFrameScale;\n        p.life += effectFrameScale;")
s = s.replace("        ft.y -= 0.8;\n        ft.life++;", "        ft.y -= 0.8 * effectFrameScale;\n        ft.life += effectFrameScale;")
write(p, s)

# CHAIN — fixed 60 Hz gameplay, elapsed-time floating text.
p = 'src/games/ChainGame.tsx'
s = read(p)
s = repl(s, "import { clamp, rescalePoint, rescaleVelocity } from '../lib/gameCoordinates';\n",
         "import { clamp, rescalePoint, rescaleVelocity } from '../lib/gameCoordinates';\nimport { getArcadeStepBatch, getFrameScale } from '../lib/frameRateRuntime';\n", 'chain import')
s = repl(s, "    viewportHeight: 600,\n", "    viewportHeight: 600,\n    physicsAccumulator: 0,\n", 'chain accumulator state')
s = repl(s, "    state.floatingTexts = [];\n    state.particles = initParticles",
         "    state.floatingTexts = [];\n    state.physicsAccumulator = 0;\n    state.particles = initParticles", 'chain init accumulator')
s = repl(s, "      state.viewportHeight = h;\n      if (state.particles.length === 0)",
         "      state.viewportHeight = h;\n      state.physicsAccumulator = 0;\n      if (state.particles.length === 0)", 'chain resize accumulator')
s = repl(s, "    onUpdate: (ctx, dt, curW, curH) => {\n      const state = gameStateRef.current;\n",
         "    onUpdate: (ctx, deltaSec, curW, curH) => {\n      const state = gameStateRef.current;\n      const batch = !isPausedRef.current\n        ? getArcadeStepBatch(state.physicsAccumulator, deltaSec)\n        : { steps: 0, remainderSec: 0 };\n      state.physicsAccumulator = batch.remainderSec;\n      const effectFrameScale = !isPausedRef.current ? getFrameScale(deltaSec) : 0;\n", 'chain onUpdate head')
s = repl(s, "        state.shake *= 0.88;\n        if (state.shake < 0.2) state.shake = 0;\n", "", 'chain shake render decay')
s = repl(s, "      let activeExplosions = 0;\n      let movingCount = 0;\n\n      if (!isPausedRef.current) {\n",
         "      if (!isPausedRef.current) {\n        for (let simStep = 0; simStep < batch.steps; simStep++) {\n          let activeExplosions = 0;\n          let movingCount = 0;\n          if (state.shake > 0) {\n            state.shake *= 0.88;\n            if (state.shake < 0.2) state.shake = 0;\n          }\n", 'chain fixed loop start')
s = repl(s, "      }\n\n      // --- RENDERING ---\n", "        }\n      }\n\n      // --- RENDERING ---\n", 'chain fixed loop end')
s = s.replace("        ft.y -= 0.8;\n        ft.life++;", "        ft.y -= 0.8 * effectFrameScale;\n        ft.life += effectFrameScale;")
write(p, s)

# DODGE — fixed 60 Hz gameplay, gameplay-time spawning, pause-safe input/effects.
p = 'src/games/DodgeGame.tsx'
s = read(p)
s = repl(s, "import { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';\n",
         "import { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';\nimport { ARCADE_FIXED_STEP_SEC, getArcadeStepBatch, getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';\n", 'dodge import')
s = repl(s, "    lastSpawn: 0,\n", "    spawnElapsedMs: 0,\n", 'dodge gameplay spawn timer')
s = repl(s, "    viewportHeight: 600,\n", "    viewportHeight: 600,\n    physicsAccumulator: 0,\n", 'dodge accumulator state')
s = repl(s, "    state.slowMoTimer = 0;\n", "    state.slowMoTimer = 0;\n    state.spawnElapsedMs = 0;\n    state.physicsAccumulator = 0;\n", 'dodge init timers')
s = repl(s, "    if (!state.isAlive || state.dashCharges <= 0 || state.isDashing) return;",
         "    if (!state.isAlive || state.dashCharges <= 0 || state.isDashing || isPausedRef.current) return;", 'dodge paused dash')
s = repl(s, "    const handlePointerMove = (e: MouseEvent | TouchEvent) => {\n      if ('touches' in e) e.preventDefault();",
         "    const handlePointerMove = (e: MouseEvent | TouchEvent) => {\n      if (isPausedRef.current || !state.isAlive) return;\n      if ('touches' in e) e.preventDefault();", 'dodge paused pointer')
s = repl(s, "    const handleKeyDown = (e: KeyboardEvent) => {\n      if (e.key === 'ArrowLeft'",
         "    const handleKeyDown = (e: KeyboardEvent) => {\n      if (isPausedRef.current || !state.isAlive) return;\n      if (e.key === 'ArrowLeft'", 'dodge paused key')
s = repl(s, "      state.viewportHeight = h;\n      if (needsInitialPlacement)",
         "      state.viewportHeight = h;\n      state.physicsAccumulator = 0;\n      if (needsInitialPlacement)", 'dodge resize accumulator')
s = repl(s, "    onUpdate: (ctx, deltaSec, curW, curH) => {\n      const dt = Math.min(32, deltaSec * 1000);\n      const state = gameStateRef.current;\n      const currentTime = performance.now();\n",
         "    onUpdate: (ctx, deltaSec, curW, curH) => {\n      const state = gameStateRef.current;\n      const batch = !isPausedRef.current && state.isAlive\n        ? getArcadeStepBatch(state.physicsAccumulator, deltaSec)\n        : { steps: 0, remainderSec: 0 };\n      state.physicsAccumulator = batch.remainderSec;\n      const effectFrameScale = !isPausedRef.current ? getFrameScale(deltaSec) : 0;\n", 'dodge onUpdate head')
s = repl(s, "        state.shake *= 0.88;\n        if (state.shake < 0.2) state.shake = 0;\n", "        state.shake *= getFrameInvariantDecay(0.88, effectFrameScale);\n        if (state.shake < 0.2) state.shake = 0;\n", 'dodge shake decay')
s = s.replace("        star.y += star.speed * (state.slowMoTimer > 0 ? 0.4 : 1);",
              "        star.y += star.speed * (state.slowMoTimer > 0 ? 0.4 : 1) * effectFrameScale;")
s = repl(s, "      if (!isPausedRef.current && state.isAlive) {\n        state.gameTime += dt / 1000;",
         "      if (!isPausedRef.current && state.isAlive) {\n        for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++) {\n        const dt = ARCADE_FIXED_STEP_SEC * 1000;\n        state.gameTime += ARCADE_FIXED_STEP_SEC;", 'dodge fixed loop start')
s = repl(s, "        if (currentTime - state.lastSpawn > spawnDelay) {\n          state.lastSpawn = currentTime;",
         "        state.spawnElapsedMs += dt;\n        if (state.spawnElapsedMs > spawnDelay) {\n          state.spawnElapsedMs = 0;", 'dodge gameplay spawn')
s = repl(s, "      }\n\n      // --- RENDERING ---\n", "        }\n      }\n\n      // --- RENDERING ---\n", 'dodge fixed loop end')
s = s.replace("        p.x += p.vx;\n        p.y += p.vy;\n        p.life++;",
              "        p.x += p.vx * effectFrameScale;\n        p.y += p.vy * effectFrameScale;\n        p.life += effectFrameScale;")
write(p, s)

# STACK — fixed 60 Hz game motion; frame-invariant camera/effects.
p = 'src/games/StackGame.tsx'
s = read(p)
s = repl(s, "import { clamp } from '../lib/gameCoordinates';\n",
         "import { clamp } from '../lib/gameCoordinates';\nimport { getArcadeStepBatch, getFrameInvariantBlend, getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';\n", 'stack import')
s = repl(s, "    viewportWidth: 500,\n", "    viewportWidth: 500,\n    physicsAccumulator: 0,\n", 'stack accumulator state')
s = repl(s, "    state.viewportWidth = w;\n    state.currentWidth = baseWidth;",
         "    state.viewportWidth = w;\n    state.physicsAccumulator = 0;\n    state.currentWidth = baseWidth;", 'stack init accumulator')
s = repl(s, "      state.viewportWidth = w;\n    },\n    onUpdate:",
         "      state.viewportWidth = w;\n      state.physicsAccumulator = 0;\n    },\n    onUpdate:", 'stack resize accumulator')
s = repl(s, "    onUpdate: (ctx, deltaSec, curW, curH) => {\n      const state = gameStateRef.current;",
         "    onUpdate: (ctx, deltaSec, curW, curH) => {\n      const state = gameStateRef.current;\n      const batch = !isPausedRef.current\n        ? getArcadeStepBatch(state.physicsAccumulator, deltaSec)\n        : { steps: 0, remainderSec: 0 };\n      state.physicsAccumulator = batch.remainderSec;\n      const effectFrameScale = !isPausedRef.current ? getFrameScale(deltaSec) : 0;", 'stack onUpdate head')
s = repl(s, "        state.shake *= 0.88;\n        if (state.shake < 0.2) state.shake = 0;\n", "        state.shake *= getFrameInvariantDecay(0.88, effectFrameScale);\n        if (state.shake < 0.2) state.shake = 0;\n", 'stack shake decay')
s = repl(s, "      state.cameraY += (state.targetCameraY - state.cameraY) * 0.1;",
         "      state.cameraY += (state.targetCameraY - state.cameraY) * getFrameInvariantBlend(0.1, effectFrameScale);", 'stack camera blend')
s = repl(s, "      if (!isPausedRef.current) {\n        // Move current block\n",
         "      if (!isPausedRef.current) {\n        for (let simStep = 0; simStep < batch.steps; simStep++) {\n        // Move current block\n", 'stack fixed loop start')
s = repl(s, "      }\n\n      // --- RENDERING ---\n", "        }\n      }\n\n      // --- RENDERING ---\n", 'stack fixed loop end')
s = s.replace("        ft.y += 0.8;\n        ft.life++;", "        ft.y += 0.8 * effectFrameScale;\n        ft.life += effectFrameScale;")
write(p, s)

# PAC MAZE — normalize per-frame fruit probability.
p = 'src/games/PacMazeGame.tsx'
s = read(p)
s = repl(s, "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\n",
         "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { getFrameInvariantChance } from '../lib/frameRateRuntime';\n", 'pac chance import')
s = repl(s, "if (!state.fruitActive && state.dotsEaten > 30 && Math.random() < 0.003)",
         "if (!state.fruitActive && state.dotsEaten > 30 && Math.random() < getFrameInvariantChance(0.003, dt * 60))", 'pac fruit chance')
write(p, s)

# RHYTHM — seconds-based overdrive and elapsed-time particle physics.
p = 'src/games/RhythmGame.tsx'
s = read(p)
s = repl(s, "state.overdriveTimer = 400; // ~7 seconds", "state.overdriveTimer = 400 / 60; // ~6.7 seconds", 'rhythm overdrive activation')
s = repl(s, "          state.overdriveTimer--;", "          state.overdriveTimer -= dt;", 'rhythm overdrive timer')
s = repl(s, "          part.x += part.vx;\n          part.y += part.vy;\n          part.vy += 0.12;",
         "          const particleFrameScale = dt * 60;\n          part.x += part.vx * particleFrameScale;\n          part.y += part.vy * particleFrameScale + 0.5 * 0.12 * particleFrameScale * (particleFrameScale - 1);\n          part.vy += 0.12 * particleFrameScale;", 'rhythm particle physics')
s = repl(s, "overdriveTime: Math.ceil(state.overdriveTimer / 60)", "overdriveTime: Math.ceil(state.overdriveTimer)", 'rhythm HUD timer')
write(p, s)

# ORBIT — gameplay-time spawns and frame-invariant smoothing/effects.
p = 'src/games/OrbitGame.tsx'
s = read(p)
s = repl(s, "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\n",
         "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { getFrameInvariantBlend, getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';\n", 'orbit runtime import')
s = repl(s, "    lastHazardSpawn: 0,\n    lastCrystalSpawn: 0,\n", "    hazardSpawnElapsedMs: 0,\n    crystalSpawnElapsedMs: 0,\n", 'orbit gameplay timers')
s = repl(s, "      const dt = Math.min(32, deltaSec * 1000);\n      const deltaRatio = dt / 16.67;\n      const state = gameStateRef.current;\n      const currentTime = performance.now();",
         "      const dt = Math.min(32, deltaSec * 1000);\n      const deltaRatio = getFrameScale(deltaSec);\n      const state = gameStateRef.current;\n      const activeFrameScale = !isPausedRef.current && state.isAlive ? deltaRatio : 0;\n      const currentTime = state.gameTime * 1000;", 'orbit onUpdate timing')
s = repl(s, "        state.shake *= 0.88;\n        if (state.shake < 0.2) state.shake = 0;",
         "        state.shake *= getFrameInvariantDecay(0.88, activeFrameScale);\n        if (state.shake < 0.2) state.shake = 0;", 'orbit shake decay')
s = repl(s, "        star.alpha += Math.sin(currentTime * star.twinkleSpeed * 0.05) * 0.01;",
         "        star.alpha += Math.sin(currentTime * star.twinkleSpeed * 0.05) * 0.01 * activeFrameScale;", 'orbit star twinkle')
s = repl(s, "        state.currentRadius += (state.targetRadius - state.currentRadius) * 0.18 * deltaRatio;",
         "        state.currentRadius += (state.targetRadius - state.currentRadius) * getFrameInvariantBlend(0.18, deltaRatio);", 'orbit radius blend')
s = s.replace("          t.alpha *= 0.82;", "          t.alpha *= getFrameInvariantDecay(0.82, deltaRatio);")
s = repl(s, "        if (currentTime - state.lastHazardSpawn > hazardInterval) {\n          spawnHazard(curW, curH, cx, cy);\n          state.lastHazardSpawn = currentTime;\n        }\n\n        if (currentTime - state.lastCrystalSpawn > 1600 && state.crystals.length < 5) {\n          spawnCrystal();\n          state.lastCrystalSpawn = currentTime;\n        }",
         "        state.hazardSpawnElapsedMs += dt;\n        state.crystalSpawnElapsedMs += dt;\n        if (state.hazardSpawnElapsedMs > hazardInterval) {\n          spawnHazard(curW, curH, cx, cy);\n          state.hazardSpawnElapsedMs = 0;\n        }\n\n        if (state.crystalSpawnElapsedMs > 1600 && state.crystals.length < 5) {\n          spawnCrystal();\n          state.crystalSpawnElapsedMs = 0;\n        }", 'orbit spawn timers')
s = s.replace("          h.trail.forEach((tr) => (tr.alpha *= 0.85));", "          h.trail.forEach((tr) => (tr.alpha *= getFrameInvariantDecay(0.85, deltaRatio)));")
s = s.replace("          state.warpEffect -= 0.08 * deltaRatio;", "          state.warpEffect -= 0.08 * activeFrameScale;")
s = s.replace("        p.x += p.vx;\n        p.y += p.vy;\n        p.life++;",
              "        p.x += p.vx * activeFrameScale;\n        p.y += p.vy * activeFrameScale;\n        p.life += activeFrameScale;")
s = s.replace("        ft.y -= 0.6;\n        ft.life++;", "        ft.y -= 0.6 * activeFrameScale;\n        ft.life += activeFrameScale;")
write(p, s)

# ROAD CROSS — exact exponential smoothing across refresh rates.
p = 'src/games/RoadCrossGame.tsx'
s = read(p)
s = repl(s, "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\n",
         "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { getFrameInvariantBlend } from '../lib/frameRateRuntime';\n", 'roadcross blend import')
s = repl(s, "        state.playerX += (targetX - state.playerX) * 0.4;\n        state.playerY += (targetY - state.playerY) * 0.4;",
         "        const playerBlend = getFrameInvariantBlend(0.4, dt * 60);\n        state.playerX += (targetX - state.playerX) * playerBlend;\n        state.playerY += (targetY - state.playerY) * playerBlend;", 'roadcross player blend')
s = repl(s, "        state.cameraY += (targetCamY - state.cameraY) * 0.12;",
         "        state.cameraY += (targetCamY - state.cameraY) * getFrameInvariantBlend(0.12, dt * 60);", 'roadcross camera blend')
write(p, s)

# PULSE — invariant visual smoothing/effect clocks.
p = 'src/games/PulseGame.tsx'
s = read(p)
s = repl(s, "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\n",
         "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { getFrameInvariantBlend, getFrameInvariantDecay } from '../lib/frameRateRuntime';\n", 'pulse runtime import')
s = repl(s, "      const deltaRatio = dt / 16.67;", "      const deltaRatio = dt / 16.67;\n      const activeFrameScale = !isPausedRef.current ? deltaRatio : 0;", 'pulse active scale')
s = repl(s, "        state.shake *= 0.88;", "        state.shake *= getFrameInvariantDecay(0.88, activeFrameScale);", 'pulse shake decay')
s = repl(s, "      state.pulseTime += (state.bpm / 60) * 0.07 * deltaRatio;", "      state.pulseTime += (state.bpm / 60) * 0.07 * activeFrameScale;", 'pulse pause clock')
s = repl(s, "          state.bgEqualizer[i] += (target - state.bgEqualizer[i]) * 0.25;",
         "          state.bgEqualizer[i] += (target - state.bgEqualizer[i]) * getFrameInvariantBlend(0.25, deltaRatio);", 'pulse equalizer blend')
s = repl(s, "          p.life++;", "          p.life += deltaRatio;", 'pulse particle life')
write(p, s)

# SNAKE — gameplay-time tick accumulator + elapsed-time effects.
p = 'src/games/SnakeGame.tsx'
s = read(p)
s = repl(s, "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\n",
         "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';\n", 'snake runtime import')
s = repl(s, "    lastTickTime: 0,\n", "    tickAccumulatorMs: 0,\n", 'snake gameplay tick accumulator')
s = repl(s, "  const stepSnake = (now: number) => {\n    const state = gameStateRef.current;\n    if (isPausedRef.current || !state.isAlive) return;\n\n    if (now - state.lastTickTime < state.tickInterval) return;\n    state.lastTickTime = now;\n",
         "  const stepSnake = () => {\n    const state = gameStateRef.current;\n    if (isPausedRef.current || !state.isAlive) return;\n", 'snake step clock')
s = repl(s, "      const state = gameStateRef.current;\n      const now = performance.now();\n      stepSnake(now);",
         "      const state = gameStateRef.current;\n      const frameScale = !isPausedRef.current ? getFrameScale(deltaSec) : 0;\n      if (!isPausedRef.current && state.isAlive) {\n        state.tickAccumulatorMs += deltaSec * 1000;\n        let safetySteps = 0;\n        while (state.tickAccumulatorMs >= state.tickInterval && state.isAlive && safetySteps < 8) {\n          state.tickAccumulatorMs -= state.tickInterval;\n          stepSnake();\n          safetySteps++;\n        }\n      }", 'snake onUpdate gameplay clock')
s = repl(s, "        state.shake *= 0.88;", "        state.shake *= getFrameInvariantDecay(0.88, frameScale);", 'snake shake decay')
s = repl(s, "        f.pulse += 0.08;", "        f.pulse += 0.08 * frameScale;", 'snake food pulse')
s = s.replace("        p.x += p.vx;\n        p.y += p.vy;\n        p.life++;",
              "        p.x += p.vx * frameScale;\n        p.y += p.vy * frameScale;\n        p.life += frameScale;")
s = s.replace("        ft.y -= 0.8;\n        ft.life++;", "        ft.y -= 0.8 * frameScale;\n        ft.life += frameScale;")
write(p, s)

# Permanent global timing policy audit.
write('scripts/audit-frame-rate-global.ts', r'''import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARCADE_FIXED_STEP_SEC,
  ARCADE_REFERENCE_HZ,
  getArcadeStepBatch,
  getFrameInvariantBlend,
  getFrameInvariantChance,
} from '../src/lib/frameRateRuntime';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const games = readdirSync(join(process.cwd(), 'src', 'games')).filter((name) => name.endsWith('Game.tsx')).sort();

assert(games.length === 32, `expected 32 game modules, found ${games.length}`);
assert(ARCADE_REFERENCE_HZ === 60, `reference gameplay clock changed to ${ARCADE_REFERENCE_HZ} Hz`);

const fixedStepGames = ['AstroBlasterGame.tsx','BladeGame.tsx','BreakoutGame.tsx','ChainGame.tsx','DodgeGame.tsx','DriftGame.tsx','GravityGame.tsx','OneLineGame.tsx','SlingshotGame.tsx','StackGame.tsx','TowerGame.tsx','VanguardGame.tsx'];
const elapsedGames = ['AirHockeyGame.tsx','ChronoGame.tsx','FlappyAeroGame.tsx','KnifeTargetGame.tsx','LaserRopeGame.tsx','NeonRailShiftGame.tsx','OrbitGame.tsx','PacMazeGame.tsx','PinballGame.tsx','PulseGame.tsx','RhythmGame.tsx','RoadCrossGame.tsx','SnakeGame.tsx'];
const discreteGames = ['BlockDropGame.tsx','BubbleBusterGame.tsx','MatrixGame.tsx','MergeGame.tsx','PerfectStopGame.tsx','ReactionGame.tsx','TypeRushGame.tsx'];
const policyGames = [...fixedStepGames, ...elapsedGames, ...discreteGames].sort();
assert(JSON.stringify(policyGames) === JSON.stringify(games), 'every game must have an explicit frame-rate policy classification');

for (const file of fixedStepGames) {
  const source = read(`src/games/${file}`);
  const usesShared = source.includes('getArcadeStepBatch') || /get(?:Astro|Blade|Gravity|OneLine|Slingshot|Tower|Vanguard|Drift)PhysicsStepBatch/.test(source);
  assert(usesShared, `${file} is classified fixed-step but has no fixed-step batch`);
}
for (const file of elapsedGames) {
  const source = read(`src/games/${file}`);
  assert(/onUpdate:\s*\([^)]*(?:dt|deltaSec|delta)/.test(source), `${file} lacks an elapsed-time update argument`);
}

const breakout = read('src/games/BreakoutGame.tsx');
assert(breakout.includes('getArcadeStepBatch(state.physicsAccumulator, deltaSec)'), 'Breakout fixed-step batching regressed');
assert(breakout.includes('const delta = ARCADE_FIXED_STEP_SEC * 1000'), 'Breakout no longer preserves the 60 Hz gameplay baseline');
const chain = read('src/games/ChainGame.tsx');
assert(chain.includes('getArcadeStepBatch(state.physicsAccumulator, deltaSec)'), 'Chain fixed-step batching regressed');
const dodge = read('src/games/DodgeGame.tsx');
assert(dodge.includes('getArcadeStepBatch(state.physicsAccumulator, deltaSec)'), 'Dodge fixed-step batching regressed');
assert(!dodge.includes('performance.now()'), 'Dodge spawn cadence depends on wall-clock time');
assert(dodge.includes('state.spawnElapsedMs += dt'), 'Dodge does not use gameplay-time spawn cadence');
const stack = read('src/games/StackGame.tsx');
assert(stack.includes('getArcadeStepBatch(state.physicsAccumulator, deltaSec)'), 'Stack fixed-step batching regressed');
const pac = read('src/games/PacMazeGame.tsx');
assert(!pac.includes('Math.random() < 0.003'), 'Pac Maze fruit spawn rate is raw per-frame probability');
assert(pac.includes('getFrameInvariantChance(0.003, dt * 60)'), 'Pac Maze fruit probability is not time-normalized');
const rhythm = read('src/games/RhythmGame.tsx');
assert(rhythm.includes('state.overdriveTimer -= dt'), 'Rhythm overdrive duration is frame-counted');
assert(!rhythm.includes('state.overdriveTimer--'), 'Rhythm retains frame-counted overdrive duration');
assert(rhythm.includes('particleFrameScale = dt * 60'), 'Rhythm particle physics is not elapsed-time normalized');
const orbit = read('src/games/OrbitGame.tsx');
assert(!orbit.includes('lastHazardSpawn') && !orbit.includes('lastCrystalSpawn'), 'Orbit spawn cadence still depends on wall-clock timestamps');
assert(orbit.includes('state.hazardSpawnElapsedMs += dt') && orbit.includes('state.crystalSpawnElapsedMs += dt'), 'Orbit spawn cadence is not gameplay-time based');
const road = read('src/games/RoadCrossGame.tsx');
assert(road.includes('getFrameInvariantBlend(0.4, dt * 60)'), 'Cyber Crosser player smoothing is refresh-rate dependent');
assert(road.includes('getFrameInvariantBlend(0.12, dt * 60)'), 'Cyber Crosser camera smoothing is refresh-rate dependent');
const snake = read('src/games/SnakeGame.tsx');
assert(!snake.includes('performance.now()'), 'Snake grid ticks still depend on wall-clock time');
assert(snake.includes('state.tickAccumulatorMs += deltaSec * 1000'), 'Snake lacks gameplay-time tick accumulation');
const pulse = read('src/games/PulseGame.tsx');
assert(pulse.includes('getFrameInvariantBlend(0.25, deltaRatio)'), 'Pulse equalizer smoothing is refresh-rate dependent');

for (const file of games) {
  const source = read(`src/games/${file}`);
  assert(!/\bsetInterval\s*\(/.test(source), `${file} contains raw setInterval gameplay timing`);
  assert(!/\bsetTimeout\s*\(/.test(source), `${file} contains raw setTimeout gameplay timing; use managed/gameplay timing`);
}

const simulateSteps = (fps: number, seconds = 8) => {
  let accumulator = 0;
  let steps = 0;
  const frames = Math.round(fps * seconds);
  for (let i = 0; i < frames; i++) {
    const batch = getArcadeStepBatch(accumulator, 1 / fps);
    accumulator = batch.remainderSec;
    steps += batch.steps;
  }
  return steps;
};
const baselineSteps = simulateSteps(60);
for (const fps of [30, 60, 120, 144, 240]) {
  assert(simulateSteps(fps) === baselineSteps, `${fps} FPS produces ${simulateSteps(fps)} shared fixed steps vs ${baselineSteps} at 60 FPS`);
}

const baselineBlend = 1 - Math.pow(1 - 0.25, 60);
for (const fps of [30, 60, 120, 144, 240]) {
  let value = 0;
  const frameScale = 60 / fps;
  for (let i = 0; i < fps; i++) value += (1 - value) * getFrameInvariantBlend(0.25, frameScale);
  assert(Math.abs(value - baselineBlend) < 1e-10, `${fps} FPS changes invariant smoothing result`);
}
const oneSecondChance60 = 1 - Math.pow(1 - 0.003, 60);
for (const fps of [30, 60, 120, 144, 240]) {
  const pFrame = getFrameInvariantChance(0.003, 60 / fps);
  const pSecond = 1 - Math.pow(1 - pFrame, fps);
  assert(Math.abs(pSecond - oneSecondChance60) < 1e-10, `${fps} FPS changes normalized event probability`);
}

if (errors.length) {
  console.error('GLOBAL FRAME-RATE / GAMEPLAY CLOCK AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('GLOBAL FRAME-RATE / GAMEPLAY CLOCK AUDIT — PASS');
console.log('All 32 games have an explicit timing policy; shared fixed-step, smoothing, probability, pause, and gameplay-clock regressions are certified.');
''')

# Package permanent gate.
pkg_path = root / 'package.json'
pkg = json.loads(pkg_path.read_text())
scripts = pkg['scripts']
new_scripts = {}
inserted = False
for k, v in scripts.items():
    new_scripts[k] = v
    if k == 'quality:vanguard':
        new_scripts['quality:frame-rate'] = 'bun scripts/audit-frame-rate-global.ts'
        inserted = True
if not inserted: raise SystemExit('package vanguard gate insertion point missing')
pkg['scripts'] = new_scripts
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')

# Release audit permanent registration.
p = 'scripts/audit-release-32.ts'
s = read(p)
s = repl(s, "  'quality:vanguard',\n", "  'quality:vanguard',\n  'quality:frame-rate',\n", 'release global gate')
s = repl(s, "  'scripts/audit-vanguard.ts',\n", "  'scripts/audit-vanguard.ts',\n  'scripts/audit-frame-rate-global.ts',\n", 'release global audit file')
write(p, s)

print('Global frame-rate normalization patch applied.')
