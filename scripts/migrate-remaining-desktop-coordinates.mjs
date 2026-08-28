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

// Neon Puck Smash: move the fixed 400x500 simulation into the measured arena.
replaceOnce(
  'src/games/AirHockeyGame.tsx',
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';",
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';",
  'coordinate-helper import',
);
replaceOnce(
  'src/games/AirHockeyGame.tsx',
  '    nextId: 1,\n  });',
  '    nextId: 1,\n    viewportWidth: 400,\n    viewportHeight: 500,\n  });',
  'viewport state',
);
replaceOnce(
  'src/games/AirHockeyGame.tsx',
  '      const speed = 25;',
  '      const speed = 25 * clamp(state.viewportWidth / 400, 0.85, 1.8);',
  'responsive keyboard speed',
);
replaceOnce(
  'src/games/AirHockeyGame.tsx',
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
      const scaleY = h / Math.max(1, state.viewportHeight);
      const uniformScale = Math.min(scaleX, scaleY);

      rescalePoint(state.puck, scaleX, scaleY);
      rescaleVelocity(state.puck, scaleX, scaleY);
      state.puck.radius = clamp(state.puck.radius * uniformScale, 10, 20);

      for (const mallet of [state.playerMallet, state.aiMallet]) {
        rescalePoint(mallet, scaleX, scaleY);
        rescaleVelocity(mallet, scaleX, scaleY);
        mallet.radius = clamp(mallet.radius * uniformScale, 20, 34);
      }

      state.targetPlayerX *= scaleX;
      state.targetPlayerY *= scaleY;
      rescaleTrail(state.puckTrail, scaleX, scaleY);
      for (const particle of state.particles) {
        rescalePoint(particle, scaleX, scaleY);
        rescaleVelocity(particle, scaleX, scaleY);
        particle.size *= uniformScale;
      }
      for (const popup of state.popups) rescalePoint(popup, scaleX, scaleY);

      state.goalWidth = clamp(state.goalWidth * scaleX, 110, Math.min(210, w * 0.3));
      state.viewportWidth = w;
      state.viewportHeight = h;

      state.puck.x = clamp(state.puck.x, state.puck.radius + 16, w - state.puck.radius - 16);
      state.puck.y = clamp(state.puck.y, state.puck.radius + 16, h - state.puck.radius - 16);
      state.playerMallet.x = clamp(state.playerMallet.x, state.playerMallet.radius + 16, w - state.playerMallet.radius - 16);
      state.playerMallet.y = clamp(state.playerMallet.y, h / 2 + state.playerMallet.radius, h - state.playerMallet.radius - 16);
      state.aiMallet.x = clamp(state.aiMallet.x, state.aiMallet.radius + 16, w - state.aiMallet.radius - 16);
      state.aiMallet.y = clamp(state.aiMallet.y, state.aiMallet.radius + 16, h / 2 - state.aiMallet.radius);
      state.targetPlayerX = clamp(state.targetPlayerX, state.playerMallet.radius + 16, w - state.playerMallet.radius - 16);
      state.targetPlayerY = clamp(state.targetPlayerY, h / 2 + state.playerMallet.radius, h - state.playerMallet.radius - 16);
    },
    onUpdate:`,
  'responsive useGameLoop resize hook',
);

// Astro Blaster: rescale the full toroidal simulation instead of only changing bounds.
replaceOnce(
  'src/games/AstroBlasterGame.tsx',
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';",
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';",
  'coordinate-helper import',
);
replaceOnce(
  'src/games/AstroBlasterGame.tsx',
  /    onResize: \(w, h\) => \{\n      gameStateRef\.current\.width = w;\n      gameStateRef\.current\.height = h;\n      if \(gameStateRef\.current\.ship\.x === 0 && gameStateRef\.current\.ship\.y === 0\) \{\n        gameStateRef\.current\.ship\.x = w \/ 2;\n        gameStateRef\.current\.ship\.y = h \/ 2;\n      \}\n    \},/,
  `    onResize: (w, h) => {
      const state = gameStateRef.current;
      const scaleX = w / Math.max(1, state.width);
      const scaleY = h / Math.max(1, state.height);
      const uniformScale = Math.min(scaleX, scaleY);

      rescalePoint(state.ship, scaleX, scaleY);
      rescaleVelocity(state.ship, scaleX, scaleY);
      state.ship.radius = clamp(state.ship.radius * uniformScale, 11, 21);

      for (const bullet of state.bullets) {
        rescalePoint(bullet, scaleX, scaleY);
        rescaleVelocity(bullet, scaleX, scaleY);
      }
      for (const asteroid of state.asteroids) {
        rescalePoint(asteroid, scaleX, scaleY);
        rescaleVelocity(asteroid, scaleX, scaleY);
        asteroid.radius *= uniformScale;
        for (const vertex of asteroid.vertices) {
          vertex.x *= uniformScale;
          vertex.y *= uniformScale;
        }
      }
      for (const ufo of state.ufos) {
        rescalePoint(ufo, scaleX, scaleY);
        rescaleVelocity(ufo, scaleX, scaleY);
        ufo.radius *= uniformScale;
      }
      for (const stardust of state.stardustList) {
        rescalePoint(stardust, scaleX, scaleY);
        rescaleVelocity(stardust, scaleX, scaleY);
      }
      for (const particle of state.particles) {
        rescalePoint(particle, scaleX, scaleY);
        rescaleVelocity(particle, scaleX, scaleY);
        particle.size *= uniformScale;
      }
      for (const text of state.floatingTexts) rescalePoint(text, scaleX, scaleY);

      state.width = w;
      state.height = h;
      state.ship.x = ((state.ship.x % w) + w) % w;
      state.ship.y = ((state.ship.y % h) + h) % h;
    },`,
  'responsive onResize block',
);

// Dodge: initialize the player in the arena and remap every active object.
replaceOnce(
  'src/games/DodgeGame.tsx',
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';",
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { clamp, rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';",
  'coordinate-helper import',
);
replaceOnce(
  'src/games/DodgeGame.tsx',
  '    nextHazardId: 1,\n  });',
  '    nextHazardId: 1,\n    viewportWidth: 400,\n    viewportHeight: 600,\n  });',
  'viewport state',
);
replaceOnce(
  'src/games/DodgeGame.tsx',
  /    onResize: \(w, h\) => \{\n      const state = gameStateRef\.current;\n      if \(state\.stars\.length === 0\) \{\n        state\.stars = Array\.from\(\{ length: 50 \}, \(\) => \(\{\n          x: Math\.random\(\) \* w,\n          y: Math\.random\(\) \* h,\n          speed: 1 \+ Math\.random\(\) \* 3,\n          size: 1 \+ Math\.random\(\) \* 2,\n          alpha: 0\.2 \+ Math\.random\(\) \* 0\.7,\n        \}\)\);\n      \}\n    \},/,
  `    onResize: (w, h) => {
      const state = gameStateRef.current;
      const scaleX = w / Math.max(1, state.viewportWidth);
      const scaleY = h / Math.max(1, state.viewportHeight);
      const uniformScale = Math.min(scaleX, scaleY);
      const needsInitialPlacement =
        state.playerX === 0 && state.playerY === 0 && state.targetPlayerX === 0;

      if (!needsInitialPlacement) {
        state.playerX *= scaleX;
        state.playerY *= scaleY;
        state.targetPlayerX *= scaleX;
      }
      state.playerRadius = clamp(state.playerRadius * uniformScale, 11, 21);
      rescaleTrail(state.ghostTrail, scaleX, scaleY);

      for (const hazard of state.hazards) {
        rescalePoint(hazard, scaleX, scaleY);
        rescaleVelocity(hazard, scaleX, scaleY);
        hazard.width *= scaleX;
        hazard.height *= scaleY;
      }
      for (const collectible of state.collectibles) {
        rescalePoint(collectible, scaleX, scaleY);
        collectible.vy *= scaleY;
        collectible.radius *= uniformScale;
      }
      for (const particle of state.particles) {
        rescalePoint(particle, scaleX, scaleY);
        rescaleVelocity(particle, scaleX, scaleY);
        particle.size *= uniformScale;
      }
      for (const star of state.stars) {
        rescalePoint(star, scaleX, scaleY);
        star.speed *= scaleY;
        star.size *= uniformScale;
      }

      state.viewportWidth = w;
      state.viewportHeight = h;
      if (needsInitialPlacement) {
        state.playerX = w / 2;
        state.targetPlayerX = w / 2;
        state.playerY = h * 0.82;
      } else {
        state.playerX = clamp(state.playerX, state.playerRadius, w - state.playerRadius);
        state.targetPlayerX = clamp(state.targetPlayerX, state.playerRadius, w - state.playerRadius);
        state.playerY = clamp(state.playerY, state.playerRadius, h - state.playerRadius);
      }
    },`,
  'responsive onResize block',
);
replaceOnce(
  'src/games/DodgeGame.tsx',
  `        // Keyboard Movement
        const speed = 7;
        if (state.keys.left) state.targetPlayerX -= speed;
        if (state.keys.right) state.targetPlayerX += speed;
        if (state.keys.up) state.playerY = Math.max(30, state.playerY - speed);
        if (state.keys.down) state.playerY = Math.min(curH - 30, state.playerY + speed);`,
  `        // Keyboard Movement
        const horizontalSpeed = 7 * clamp(curW / 400, 0.85, 1.8);
        const verticalSpeed = 7 * clamp(curH / 600, 0.85, 1.35);
        if (state.keys.left) state.targetPlayerX -= horizontalSpeed;
        if (state.keys.right) state.targetPlayerX += horizontalSpeed;
        if (state.keys.up) state.playerY = Math.max(30, state.playerY - verticalSpeed);
        if (state.keys.down) state.playerY = Math.min(curH - 30, state.playerY + verticalSpeed);`,
  'responsive keyboard movement',
);

// Stack: replace the 500px mobile rail with the measured viewport and preserve runs through resize.
replaceOnce(
  'src/games/StackGame.tsx',
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';",
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { clamp } from '../lib/gameCoordinates';",
  'coordinate-helper import',
);
replaceOnce(
  'src/games/StackGame.tsx',
  '    initialized: false,\n  });',
  '    initialized: false,\n    viewportWidth: 500,\n  });',
  'viewport state',
);
replaceOnce(
  'src/games/StackGame.tsx',
  `      // Bonus width reward on high streak
      if (state.perfectStreak >= 5 && state.currentWidth < 220) {
        state.currentWidth = Math.min(220, state.currentWidth + 12);`,
  `      // Bonus width reward on high streak
      const rewardWidthCap = Math.min(320, state.viewportWidth * 0.45);
      if (state.perfectStreak >= 5 && state.currentWidth < rewardWidthCap) {
        state.currentWidth = Math.min(rewardWidthCap, state.currentWidth + 12);`,
  'responsive perfect-streak width cap',
);
replaceCount(
  'src/games/StackGame.tsx',
  /state\.currentX = state\.direction === 1 \? -state\.currentWidth : 500;/g,
  'state.currentX = state.direction === 1 ? -state.currentWidth : state.viewportWidth + state.currentWidth * 0.15;',
  2,
  'viewport-aware spawn edge',
);
replaceCount(
  'src/games/StackGame.tsx',
  /state\.speed = 3\.5 \+ Math\.min\(4\.5, state\.score \* 0\.08\);/g,
  'state.speed = 3.5 * clamp(state.viewportWidth / 500, 0.85, 1.7) + Math.min(4.5, state.score * 0.08);',
  2,
  'viewport-aware rail speed',
);
replaceOnce(
  'src/games/StackGame.tsx',
  '    const baseWidth = Math.min(200, Math.max(150, w * 0.5));',
  '    const baseWidth = clamp(w * 0.5, 150, 260);',
  'responsive base width',
);
replaceOnce(
  'src/games/StackGame.tsx',
  `    state.currentWidth = baseWidth;
    state.currentHeight = 26;
    state.currentX = -baseWidth;
    state.speed = 3.5;`,
  `    state.viewportWidth = w;
    state.currentWidth = baseWidth;
    state.currentHeight = 26;
    state.currentX = -baseWidth;
    state.speed = 3.5 * clamp(w / 500, 0.85, 1.7);`,
  'responsive initialization',
);
replaceOnce(
  'src/games/StackGame.tsx',
  `    onResize: (w) => {
      if (!gameStateRef.current.initialized) {
        initGame(w);
      }
    },`,
  `    onResize: (w) => {
      const state = gameStateRef.current;
      if (!state.initialized) {
        initGame(w);
        return;
      }

      const scaleX = w / Math.max(1, state.viewportWidth);
      state.currentX *= scaleX;
      state.currentWidth *= scaleX;
      state.speed *= scaleX;
      for (const block of state.blocks) {
        block.x *= scaleX;
        block.width *= scaleX;
      }
      for (const debris of state.debris) {
        debris.x *= scaleX;
        debris.width *= scaleX;
        debris.vx *= scaleX;
      }
      for (const ring of state.rings) {
        ring.x *= scaleX;
        ring.radius *= scaleX;
        ring.maxRadius *= scaleX;
      }
      for (const text of state.floatingTexts) text.x *= scaleX;
      state.viewportWidth = w;
    },`,
  'responsive onResize block',
);

console.log('Migrated Air Hockey, Astro Blaster, Dodge, and Stack to the shared desktop-coordinate layer.');
