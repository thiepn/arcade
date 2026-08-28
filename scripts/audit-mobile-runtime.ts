import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_CANVAS_BACKING_PIXELS,
  appendRoundedRectPath,
  getSafeCanvasDpr,
} from '../src/lib/mobileRuntime';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const read = (path: string) => readFileSync(path, 'utf8');
const gameFiles = readdirSync('src/games')
  .filter((file) => file.endsWith('Game.tsx'))
  .sort();

assert(gameFiles.length === 32, `expected 32 game modules, found ${gameFiles.length}`);

const main = read('src/main.tsx');
const runtime = read('src/lib/mobileRuntime.ts');
const loop = read('src/hooks/useGameLoop.ts');
const shell = read('src/components/GameShell.tsx');
const css = read('src/index.css');
const drift = read('src/games/DriftGame.tsx');

assert(
  main.indexOf('installMobileRuntimeCompatibility();') < main.indexOf('createRoot('),
  'mobile runtime compatibility must install before React renders a game',
);
assert(
  runtime.includes("typeof prototype.roundRect === 'function'") &&
    runtime.includes("Object.defineProperty(prototype, 'roundRect'"),
  'Canvas roundRect compatibility fallback is missing',
);
assert(
  loop.includes('getSafeCanvasDpr') && loop.includes('MAX_CANVAS_BACKING_PIXELS') === false,
  'game loop is not using the shared safe-DPR calculation',
);
assert(
  loop.includes("window.visualViewport?.addEventListener('resize'") &&
    loop.includes("window.visualViewport?.addEventListener('scroll'"),
  'game loop does not follow mobile visual-viewport changes',
);
assert(
  loop.includes('measuredWidth < MIN_RENDER_DIMENSION') &&
    loop.includes('measuredHeight < MIN_RENDER_DIMENSION'),
  'game loop can still initialize a zero-size mobile game world',
);
assert(
  loop.includes("new CustomEvent('arcade:game-loop-error'") &&
    loop.includes('GAME RENDER ERROR') &&
    loop.includes('finally {'),
  'async canvas failures can still collapse into an unexplained black screen',
);

for (const [width, height, dpr] of [
  [320, 480, 3],
  [360, 800, 3],
  [430, 932, 3],
  [768, 1024, 2],
  [1024, 1366, 2],
] as const) {
  const safeDpr = getSafeCanvasDpr(width, height, dpr);
  const backingPixels = width * safeDpr * height * safeDpr;
  assert(safeDpr >= 1 && safeDpr <= 2, `${width}x${height}: invalid safe DPR ${safeDpr}`);
  assert(
    backingPixels <= MAX_CANVAS_BACKING_PIXELS + 1,
    `${width}x${height}: backing canvas exceeds the mobile-safe pixel budget`,
  );
}

const pathOperations: string[] = [];
const fakeContext = {
  moveTo: () => pathOperations.push('moveTo'),
  lineTo: () => pathOperations.push('lineTo'),
  quadraticCurveTo: () => pathOperations.push('quadraticCurveTo'),
  closePath: () => pathOperations.push('closePath'),
} as unknown as CanvasRenderingContext2D;
appendRoundedRectPath(fakeContext, 0, 0, 40, 20, 6);
assert(pathOperations[0] === 'moveTo', 'rounded-rectangle fallback does not start a path');
assert(pathOperations.at(-1) === 'closePath', 'rounded-rectangle fallback does not close its path');
assert(
  pathOperations.filter((operation) => operation === 'quadraticCurveTo').length === 4,
  'rounded-rectangle fallback does not render all four corners',
);

assert(shell.includes('min-h-0'), 'game shell flex stage is not allowed to shrink on mobile');
assert(
  css.includes('--arcade-viewport-height') &&
    css.includes('height: var(--arcade-viewport-height'),
  'game shell is not using the measured mobile visual viewport height',
);
assert(
  css.includes('.game-shell canvas') && css.includes('touch-action: none'),
  'shared mobile canvas touch containment is missing',
);

for (const token of [
  'getDriftRoadWidth',
  'const roadWidth = getDriftRoadWidth(w)',
  'viewportWidth',
  'viewportHeight',
  'onPointerCancel={handleSteerEnd}',
  'min-h-0',
  'touch-none',
]) {
  assert(drift.includes(token), `Cyber Drift is missing mobile hotfix token: ${token}`);
}
assert(!drift.includes('const ROAD_WIDTH = 300'), 'Cyber Drift restored a fixed desktop road width');

for (const file of gameFiles) {
  const source = read(join('src/games', file));
  assert(
    !source.includes('transferControlToOffscreen') && !source.includes('new OffscreenCanvas'),
    `${file} uses an unsupported mandatory OffscreenCanvas path`,
  );
  assert(!source.includes('.reset()'), `${file} uses CanvasRenderingContext2D.reset without a fallback`);
}

if (errors.length) {
  console.error('Mobile runtime audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const roundRectGames = gameFiles.filter((file) =>
  read(join('src/games', file)).includes('.roundRect('),
);
console.log(
  `Mobile runtime audit passed: ${gameFiles.length} games share safe viewport sizing, canvas-memory limits, render-failure recovery, and roundRect compatibility (${roundRectGames.length} game modules currently rely on it).`,
);
