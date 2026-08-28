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

writeFileSync(
  'src/lib/bladeTrajectory.ts',
  `import { clamp } from './gameCoordinates';

export const BLADE_BASE_ARENA_HEIGHT = 500;
export const BLADE_BASE_GRAVITY = 0.28;
export const BLADE_APEX_MIN_RATIO = 0.12;
export const BLADE_APEX_MAX_RATIO = 0.32;
export const BLADE_LANDING_MARGIN_RATIO = 0.08;

export interface BladeLaunchOptions {
  startX: number;
  startY: number;
  width: number;
  height: number;
  random?: () => number;
}

export interface BladeLaunchTrajectory {
  vx: number;
  vy: number;
  gravity: number;
  apexY: number;
  apexRatio: number;
  landingX: number;
  framesToApex: number;
}

export const getBladeGravity = (height: number): number => {
  const safeHeight = Math.max(1, height);
  return BLADE_BASE_GRAVITY * clamp(safeHeight / BLADE_BASE_ARENA_HEIGHT, 0.9, 1.45);
};

export const createBladeLaunchTrajectory = ({
  startX,
  startY,
  width,
  height,
  random = Math.random,
}: BladeLaunchOptions): BladeLaunchTrajectory => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const gravity = getBladeGravity(safeHeight);
  const apexRandom = clamp(random(), 0, 0.999999);
  const apexRatio =
    BLADE_APEX_MIN_RATIO +
    apexRandom * (BLADE_APEX_MAX_RATIO - BLADE_APEX_MIN_RATIO);
  const apexY = safeHeight * apexRatio;
  const rise = Math.max(1, startY - apexY);

  // The game applies gravity before position each 60 Hz step. The half-gravity
  // correction makes the discrete parabola land on the requested apex height.
  const launchSpeedY = Math.sqrt(2 * gravity * rise) + gravity / 2;
  const framesToApex = Math.max(1, launchSpeedY / gravity);

  const desiredApexX = safeWidth * (0.2 + clamp(random(), 0, 0.999999) * 0.6);
  const minLandingX = safeWidth * BLADE_LANDING_MARGIN_RATIO;
  const maxLandingX = safeWidth * (1 - BLADE_LANDING_MARGIN_RATIO);
  const landingX = clamp(2 * desiredApexX - startX, minLandingX, maxLandingX);
  const vx = (landingX - startX) / (framesToApex * 2);

  return {
    vx,
    vy: -launchSpeedY,
    gravity,
    apexY,
    apexRatio,
    landingX,
    framesToApex,
  };
};
`,
);

writeFileSync(
  'scripts/audit-blade-trajectories.ts',
  `import {
  BLADE_APEX_MAX_RATIO,
  BLADE_APEX_MIN_RATIO,
  BLADE_LANDING_MARGIN_RATIO,
  createBladeLaunchTrajectory,
} from '../src/lib/bladeTrajectory';

const heights = [440, 500, 660, 900, 1080];
const apexSamples = [0, 0.5, 0.999999];
const tolerancePx = 0.75;
const errors: string[] = [];

for (const height of heights) {
  const width = Math.round(height * 1.5);
  const startX = width * 0.35;
  const startY = height + 25;

  for (const apexSample of apexSamples) {
    const randomValues = [apexSample, 0.65];
    const trajectory = createBladeLaunchTrajectory({
      startX,
      startY,
      width,
      height,
      random: () => randomValues.shift() ?? 0.5,
    });

    let y = startY;
    let vy = trajectory.vy;
    let measuredApexY = y;
    let frames = 0;

    while (frames < 240) {
      vy += trajectory.gravity;
      y += vy;
      measuredApexY = Math.min(measuredApexY, y);
      frames++;
      if (vy >= 0) break;
    }

    if (Math.abs(measuredApexY - trajectory.apexY) > tolerancePx) {
      errors.push(
        `${height}px sample ${apexSample}: measured apex ${measuredApexY.toFixed(2)} != requested ${trajectory.apexY.toFixed(2)}`,
      );
    }

    const measuredRatio = measuredApexY / height;
    if (
      measuredRatio < BLADE_APEX_MIN_RATIO - 0.002 ||
      measuredRatio > BLADE_APEX_MAX_RATIO + 0.002
    ) {
      errors.push(
        `${height}px sample ${apexSample}: apex ratio ${measuredRatio.toFixed(4)} is outside the certified upper band`,
      );
    }

    const minLandingX = width * BLADE_LANDING_MARGIN_RATIO;
    const maxLandingX = width * (1 - BLADE_LANDING_MARGIN_RATIO);
    if (trajectory.landingX < minLandingX || trajectory.landingX > maxLandingX) {
      errors.push(`${height}px sample ${apexSample}: projected landing is outside the arena`);
    }

    if (trajectory.framesToApex < 45 || trajectory.framesToApex > 75) {
      errors.push(
        `${height}px sample ${apexSample}: ${trajectory.framesToApex.toFixed(1)} frames to apex is outside the playable range`,
      );
    }
  }
}

if (errors.length) {
  console.error('Laser Blade trajectory audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Laser Blade trajectory audit passed: every certified mobile/desktop height reaches the ${(BLADE_APEX_MIN_RATIO * 100).toFixed(0)}–${(BLADE_APEX_MAX_RATIO * 100).toFixed(0)}% upper arena band.`,
);
`,
);

replaceOnce(
  'src/games/BladeGame.tsx',
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';",
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';\nimport { rescalePoint, rescaleTrail, rescaleVelocity } from '../lib/gameCoordinates';\nimport { createBladeLaunchTrajectory, getBladeGravity } from '../lib/bladeTrajectory';",
  'trajectory imports',
);

replaceOnce(
  'src/games/BladeGame.tsx',
  `      const targetApexX = w * (0.25 + Math.random() * 0.5);
      const flightDuration = 1.15 + Math.random() * 0.25;
      const vx = (targetApexX - startX) / (flightDuration * 60);
      const vy = -(11.0 + Math.random() * 3.5);`,
  `      const trajectory = createBladeLaunchTrajectory({
        startX,
        startY,
        width: w,
        height: h,
      });
      const { vx, vy } = trajectory;`,
  'height-aware launch block',
);

replaceOnce(
  'src/games/BladeGame.tsx',
  `    onResize: (w, h) => {
      gameStateRef.current.width = w;
      gameStateRef.current.height = h;
    },`,
  `    onResize: (w, h) => {
      const state = gameStateRef.current;
      const scaleX = w / Math.max(1, state.width);
      const scaleY = h / Math.max(1, state.height);
      const previousGravity = getBladeGravity(state.height);
      const nextGravity = getBladeGravity(h);
      const flightTimeScale = Math.sqrt(
        Math.max(0.0001, (scaleY * previousGravity) / nextGravity),
      );
      const velocityScaleX = scaleX / flightTimeScale;
      const velocityScaleY = scaleY / flightTimeScale;

      for (const target of state.targets) {
        rescalePoint(target, scaleX, scaleY);
        rescaleVelocity(target, velocityScaleX, velocityScaleY);
      }
      for (const piece of state.slicedPieces) {
        rescalePoint(piece, scaleX, scaleY);
        rescaleVelocity(piece, velocityScaleX, velocityScaleY);
      }
      for (const particle of state.particles) {
        rescalePoint(particle, scaleX, scaleY);
        rescaleVelocity(particle, velocityScaleX, velocityScaleY);
      }
      rescaleTrail(state.bladeTrail, scaleX, scaleY);
      for (const text of state.floatingTexts) rescalePoint(text, scaleX, scaleY);

      state.width = w;
      state.height = h;
    },`,
  'responsive trajectory resize block',
);

replaceOnce(
  'src/games/BladeGame.tsx',
  '        const gravity = 0.28;',
  '        const gravity = getBladeGravity(h);',
  'height-aware gravity',
);

replaceOnce(
  'scripts/audit-desktop-coordinates.mjs',
  "  'BreakoutGame.tsx',",
  "  'BladeGame.tsx',\n  'BreakoutGame.tsx',",
  'Blade desktop-audit registration',
);

replaceOnce(
  'scripts/audit-desktop-coordinates.mjs',
  "const breakout = read('src/games/BreakoutGame.tsx');",
  `const blade = read('src/games/BladeGame.tsx');
assert(blade.includes('createBladeLaunchTrajectory'), 'Blade does not use the certified height-aware launcher');
assert(blade.includes('flightTimeScale'), 'Blade active trajectories are not preserved through resize');
assert(blade.includes('getBladeGravity(h)'), 'Blade gravity is not arena-height-aware');

const breakout = read('src/games/BreakoutGame.tsx');`,
  'Blade desktop-audit assertions',
);

replaceOnce(
  'package.json',
  '    "quality:desktop": "node scripts/audit-desktop-coordinates.mjs",',
  '    "quality:desktop": "node scripts/audit-desktop-coordinates.mjs",\n    "quality:blade": "bun scripts/audit-blade-trajectories.ts",',
  'Blade quality script',
);

replaceOnce(
  '.github/workflows/ci.yml',
  '      - run: bun run quality:desktop\n',
  '      - run: bun run quality:desktop\n      - run: bun run quality:blade\n',
  'Blade CI gate',
);

replaceOnce(
  'CHANGELOG.md',
  '- Added a shared `ResizeObserver`-driven canvas coordinate layer and migrated Air Hockey, Astro Blaster, Breakout, Chain, Dodge, Stack, and Gravity Tower to remap live game state across desktop resizing, fullscreen changes, and device orientation changes.',
  '- Added a shared `ResizeObserver`-driven canvas coordinate layer and migrated Air Hockey, Astro Blaster, Breakout, Chain, Dodge, Laser Blade, Stack, and Gravity Tower to remap live game state across desktop resizing, fullscreen changes, and device orientation changes.\n- Replaced Laser Blade\'s fixed launch velocity with a certified height-aware parabola that places every target apex in the upper 12–32% of mobile and desktop arenas.',
  'Laser Blade changelog entry',
);

console.log('Applied certified height-aware Laser Blade trajectories and responsive live-resize preservation.');
