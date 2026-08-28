import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, search, replacement, label) {
  const source = readFileSync(path, 'utf8');
  let count = 0;
  if (typeof search === 'string') {
    count = source.split(search).length - 1;
  } else {
    const flags = search.flags.includes('g') ? search.flags : `${search.flags}g`;
    count = [...source.matchAll(new RegExp(search.source, flags))].length;
  }
  if (count !== 1) throw new Error(`${path}: expected one ${label} match, found ${count}`);
  writeFileSync(path, source.replace(search, replacement));
}

function replaceCount(path, search, replacement, expected, label) {
  const source = readFileSync(path, 'utf8');
  const matches = source.match(search) ?? [];
  if (matches.length !== expected) {
    throw new Error(`${path}: expected ${expected} ${label} matches, found ${matches.length}`);
  }
  writeFileSync(path, source.replace(search, replacement));
}

replaceOnce(
  'src/games/BreakoutGame.tsx',
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';",
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';",
  'coordinate-helper import',
);
replaceOnce(
  'src/games/BreakoutGame.tsx',
  '    lastLaserFire: 0,\n  });',
  '    lastLaserFire: 0,\n    viewportWidth: 400,\n    viewportHeight: 600,\n  });',
  'viewport state',
);
replaceOnce(
  'src/games/BreakoutGame.tsx',
  /    onResize: \(w, h\) => \{\n      const state = gameStateRef\.current;\n      if \(state\.bricks\.length === 0\) \{\n        state\.bricks = initBricks\(w, state\.round\);\n      \}\n    \},/,
  `    onResize: (w, h) => {
      const state = gameStateRef.current;
      const scaleX = w / Math.max(1, state.viewportWidth);
      const scaleY = h / Math.max(1, state.viewportHeight);
      const uniformScale = Math.min(scaleX, scaleY);

      state.paddleX = state.paddleX > 0 ? state.paddleX * scaleX : w / 2;
      state.targetPaddleX = state.targetPaddleX > 0 ? state.targetPaddleX * scaleX : w / 2;
      state.paddleW = clamp(state.paddleW * scaleX, 72, Math.min(180, w * 0.32));
      state.paddleTargetW = clamp(state.paddleTargetW * scaleX, 72, Math.min(180, w * 0.32));
      state.paddleH = clamp(state.paddleH * uniformScale, 12, 22);

      for (const brick of state.bricks) {
        brick.x *= scaleX;
        brick.y *= scaleY;
        brick.w *= scaleX;
        brick.h *= scaleY;
      }
      for (const ball of state.balls) {
        rescalePoint(ball, scaleX, scaleY);
        rescaleVelocity(ball, scaleX, scaleY);
        rescaleTrail(ball.trail, scaleX, scaleY);
        ball.radius = clamp(ball.radius * uniformScale, 5, 10);
        ball.x = clamp(ball.x, ball.radius, w - ball.radius);
        ball.y = clamp(ball.y, ball.radius, h + ball.radius);
      }
      for (const particle of state.particles) {
        rescalePoint(particle, scaleX, scaleY);
        rescaleVelocity(particle, scaleX, scaleY);
        particle.size *= uniformScale;
      }
      for (const powerUp of state.powerUps) {
        rescalePoint(powerUp, scaleX, scaleY);
        powerUp.vy *= scaleY;
      }
      for (const laser of state.lasers) {
        rescalePoint(laser, scaleX, scaleY);
        laser.vy *= scaleY;
      }
      for (const text of state.floatingTexts) rescalePoint(text, scaleX, scaleY);

      state.viewportWidth = w;
      state.viewportHeight = h;
      state.paddleX = clamp(state.paddleX, state.paddleW / 2, w - state.paddleW / 2);
      state.targetPaddleX = clamp(state.targetPaddleX, state.paddleW / 2, w - state.paddleW / 2);

      if (state.bricks.length === 0) state.bricks = initBricks(w, state.round);
    },`,
  'responsive onResize block',
);
replaceOnce(
  'src/games/BreakoutGame.tsx',
  '            state.paddleTargetW = 96;',
  '            state.paddleTargetW = clamp(state.viewportWidth * 0.22, 72, Math.min(180, state.viewportWidth * 0.32));',
  'responsive paddle reset width',
);
replaceOnce(
  'src/games/BreakoutGame.tsx',
  "            state.lasers.push({ x: state.paddleX - state.paddleW / 2 + 10, y: paddleY, vy: -12 });\n            state.lasers.push({ x: state.paddleX + state.paddleW / 2 - 10, y: paddleY, vy: -12 });",
  "            const laserSpeed = -12 * clamp(curH / 600, 0.85, 1.35);\n            state.lasers.push({ x: state.paddleX - state.paddleW / 2 + 10, y: paddleY, vy: laserSpeed });\n            state.lasers.push({ x: state.paddleX + state.paddleW / 2 - 10, y: paddleY, vy: laserSpeed });",
  'responsive laser velocity',
);
replaceOnce(
  'src/games/BreakoutGame.tsx',
  "              vx: 4,\n              vy: -6,\n              radius: 6,",
  "              vx: 4 * clamp(curW / 400, 0.85, 1.8),\n              vy: -6 * clamp(curH / 600, 0.85, 1.35),\n              radius: clamp(6 * Math.min(curW / 400, curH / 600), 5, 10),",
  'responsive round-reset ball',
);
replaceOnce(
  'src/games/BreakoutGame.tsx',
  '    state.paddleTargetW = 140;',
  '    state.paddleTargetW = clamp(curW * 0.3, 140, Math.min(240, curW * 0.38));',
  'responsive wide-paddle target',
);

replaceOnce(
  'src/games/ChainGame.tsx',
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';",
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { clamp, rescalePoint, rescaleVelocity } from '../lib/gameCoordinates';",
  'coordinate-helper import',
);
replaceOnce(
  'src/games/ChainGame.tsx',
  "    selectedTool: 'plasma' as DetonatorTool,\n  });",
  "    selectedTool: 'plasma' as DetonatorTool,\n    viewportWidth: 400,\n    viewportHeight: 600,\n  });",
  'viewport state',
);
replaceOnce(
  'src/games/ChainGame.tsx',
  "    const colors = ['#F43F5E', '#38BDF8', '#34D399', '#FACC15', '#A855F7', '#FB923C'];",
  "    const colors = ['#F43F5E', '#38BDF8', '#34D399', '#FACC15', '#A855F7', '#FB923C'];\n    const horizontalScale = clamp(w / 400, 0.85, 1.8);\n    const verticalScale = clamp(h / 600, 0.85, 1.35);",
  'particle viewport speed scales',
);
replaceOnce(
  'src/games/ChainGame.tsx',
  '        vx: Math.cos(angle) * spd,\n        vy: Math.sin(angle) * spd,',
  '        vx: Math.cos(angle) * spd * horizontalScale,\n        vy: Math.sin(angle) * spd * verticalScale,',
  'particle responsive velocity',
);
replaceOnce(
  'src/games/ChainGame.tsx',
  /    onResize: \(w, h\) => \{\n      const state = gameStateRef\.current;\n      if \(state\.particles\.length === 0\) \{\n        state\.particles = initParticles\(w, h, state\.wave\);\n      \}\n    \},/,
  `    onResize: (w, h) => {
      const state = gameStateRef.current;
      const scaleX = w / Math.max(1, state.viewportWidth);
      const scaleY = h / Math.max(1, state.viewportHeight);
      const uniformScale = Math.min(scaleX, scaleY);

      for (const particle of state.particles) {
        rescalePoint(particle, scaleX, scaleY);
        rescaleVelocity(particle, scaleX, scaleY);
        particle.radius *= uniformScale;
        particle.explosionRadius *= uniformScale;
        particle.maxExplosionRadius *= uniformScale;
      }
      for (const vortex of state.vortexes) {
        rescalePoint(vortex, scaleX, scaleY);
        vortex.radius *= uniformScale;
        vortex.pullStrength *= uniformScale;
      }
      for (const arc of state.lightningArcs) {
        arc.x1 *= scaleX;
        arc.y1 *= scaleY;
        arc.x2 *= scaleX;
        arc.y2 *= scaleY;
      }
      for (const spark of state.sparks) {
        rescalePoint(spark, scaleX, scaleY);
        rescaleVelocity(spark, scaleX, scaleY);
        spark.size *= uniformScale;
      }
      for (const text of state.floatingTexts) rescalePoint(text, scaleX, scaleY);

      state.viewportWidth = w;
      state.viewportHeight = h;
      if (state.particles.length === 0) state.particles = initParticles(w, h, state.wave);
    },`,
  'responsive onResize block',
);

replaceOnce(
  'src/games/TowerGame.tsx',
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';",
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { clamp } from '../lib/gameCoordinates';",
  'coordinate-helper import',
);
replaceOnce(
  'src/games/TowerGame.tsx',
  '    leftPressed: false,\n    rightPressed: false,\n  });',
  '    leftPressed: false,\n    rightPressed: false,\n    viewportWidth: 420,\n    viewportHeight: 600,\n  });',
  'viewport state',
);
replaceCount(
  'src/games/TowerGame.tsx',
  /state\.vx = 8;/g,
  'state.vx = 8 * Math.min(1.8, Math.max(0.85, state.viewportWidth / 420));',
  2,
  'positive wall-jump velocity',
);
replaceCount(
  'src/games/TowerGame.tsx',
  /state\.vx = -8;/g,
  'state.vx = -8 * Math.min(1.8, Math.max(0.85, state.viewportWidth / 420));',
  2,
  'negative wall-jump velocity',
);
replaceOnce(
  'src/games/TowerGame.tsx',
  '    const w = Math.max(300, currentWorldWidth);',
  '    const w = Math.max(300, currentWorldWidth);\n    const horizontalScale = Math.min(1.8, Math.max(0.85, w / 420));\n    const platformScale = Math.min(1.45, horizontalScale);',
  'world horizontal scale',
);
replaceOnce(
  'src/games/TowerGame.tsx',
  `      state.platforms.push({
        id: state.nextId++,
        x: w / 2 - 55,
        y: 20,
        w: 110,`,
  `      const basePlatformWidth = 110 * platformScale;
      state.platforms.push({
        id: state.nextId++,
        x: w / 2 - basePlatformWidth / 2,
        y: 20,
        w: basePlatformWidth,`,
  'responsive base platform',
);
replaceOnce(
  'src/games/TowerGame.tsx',
  '      const platW = Math.random() * 25 + 68; // 68 to 93 px width',
  '      const platW = (Math.random() * 25 + 68) * platformScale;',
  'responsive generated platform width',
);
replaceOnce(
  'src/games/TowerGame.tsx',
  "        vx = (Math.random() * 1.6 + 1.1) * (Math.random() < 0.5 ? 1 : -1);",
  "        vx = (Math.random() * 1.6 + 1.1) * horizontalScale * (Math.random() < 0.5 ? 1 : -1);",
  'moving-platform speed scale',
);
replaceOnce(
  'src/games/TowerGame.tsx',
  "          vx: (Math.random() * 1.5 + 1.0) * (Math.random() < 0.5 ? 1 : -1),",
  "          vx: (Math.random() * 1.5 + 1.0) * horizontalScale * (Math.random() < 0.5 ? 1 : -1),",
  'drone speed scale',
);
replaceOnce(
  'src/games/TowerGame.tsx',
  `  useGameLoop({
    canvasRef,
    isPaused,
    onUpdate:`,
  `  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const state = gameStateRef.current;
      const scaleX = w / Math.max(1, state.viewportWidth);

      state.px = clamp(state.px * scaleX, state.radius + 16, w - state.radius - 16);
      state.vx *= scaleX;
      for (const platform of state.platforms) {
        platform.x *= scaleX;
        platform.w *= scaleX;
        if (platform.vx !== undefined) platform.vx *= scaleX;
        if (platform.minX !== undefined) platform.minX *= scaleX;
        if (platform.maxX !== undefined) platform.maxX *= scaleX;
      }
      for (const drone of state.drones) {
        drone.x *= scaleX;
        drone.vx *= scaleX;
        drone.minX *= scaleX;
        drone.maxX *= scaleX;
      }
      for (const ring of state.boostRings) ring.x *= scaleX;
      for (const particle of state.particles) {
        particle.x *= scaleX;
        particle.vx *= scaleX;
      }
      for (const popup of state.popups) popup.x *= scaleX;

      state.viewportWidth = w;
      state.viewportHeight = h;
      if (state.platforms.length === 0) generateWorldUpTo(1800, w);
    },
    onUpdate:`,
  'responsive useGameLoop resize hook',
);
replaceOnce(
  'src/games/TowerGame.tsx',
  '        const moveAccel = 38;\n        const maxMoveSpeed = 8.8;',
  '        const horizontalScale = Math.min(1.8, Math.max(0.85, curW / 420));\n        const moveAccel = 38 * horizontalScale;\n        const maxMoveSpeed = 8.8 * horizontalScale;',
  'desktop movement scaling',
);

console.log('Migrated Breakout, Chain, and Gravity Tower to the shared desktop-coordinate layer.');
