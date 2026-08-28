import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function fail(message) {
  console.error(`MA3 AUDIT FAIL: ${message}`);
  process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function read(path) {
  if (!existsSync(path)) {
    fail(`missing ${path}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

const index = read('index.html');
const manifestText = read('public/manifest.webmanifest');
const serviceWorker = read('public/sw.js');
const pwaStatus = read('src/components/PwaStatus.tsx');
const gamepad = read('src/hooks/useGamepadBridge.ts');
const gameShell = read('src/components/GameShell.tsx');
const css = read('src/index.css');
const pagesWorkflow = read('.github/workflows/pages.yml');

let manifest = {};
try {
  manifest = JSON.parse(manifestText);
} catch (error) {
  fail(`manifest is not valid JSON: ${error}`);
}

assert(manifest.name === 'Micro Arcade', 'manifest app name must be Micro Arcade');
assert(manifest.start_url === './' && manifest.scope === './', 'manifest start_url/scope must remain deployment-relative');
assert(manifest.display === 'standalone', 'manifest must request standalone display');
assert(Array.isArray(manifest.icons) && manifest.icons.some((icon) => icon.sizes === '192x192'), 'manifest needs a 192x192 icon');
assert(Array.isArray(manifest.icons) && manifest.icons.some((icon) => icon.sizes === '512x512'), 'manifest needs a 512x512 icon');

assert(index.includes('viewport-fit=cover'), 'viewport must support safe areas');
assert(!index.includes('user-scalable=no'), 'global zoom must not be disabled');
assert(!index.includes('maximum-scale=1'), 'global zoom maximum must not be locked');
assert(index.includes('rel="manifest"'), 'index must link the web manifest');
assert(index.includes('apple-touch-icon'), 'index must provide an Apple touch icon');
assert(index.includes('theme-color'), 'index must provide a theme color');
assert(!index.includes('fonts.googleapis.com'), 'PWA shell must not depend on remote Google Fonts');

assert(serviceWorker.includes("event.data?.type === 'SKIP_WAITING'"), 'service worker updates must be explicitly activated');
assert(!/install[\s\S]{0,300}self\.skipWaiting\(\)/.test(serviceWorker), 'service worker must not force skipWaiting during install');
assert(serviceWorker.includes("request.mode === 'navigate'"), 'service worker needs an offline navigation fallback');
assert(serviceWorker.includes('Never intercept the leaderboard/API origin'), 'service worker must leave external API requests alone');

assert(pwaStatus.includes('beforeinstallprompt'), 'PWA UI must support browser install prompts');
assert(pwaStatus.includes('controllerchange'), 'PWA UI must safely activate waiting updates');
assert(pwaStatus.includes('activeGame'), 'PWA update UI must defer while a game is active');
assert(pwaStatus.includes("window.addEventListener('offline'"), 'PWA UI must expose offline status');

assert(gamepad.includes('navigator.getGamepads'), 'gamepad bridge must poll the Gamepad API');
assert(gamepad.includes("gamepadconnected"), 'gamepad bridge must handle controller connection events');
assert(gamepad.includes('POINTER_GAMES'), 'gamepad bridge must support pointer-driven games');
assert(gamepad.includes("gameId === 'merge'"), 'gamepad bridge must map Merge controls');
assert(gamepad.includes("gameId === 'rhythm'"), 'gamepad bridge must map Rhythm controls');
assert(gamepad.includes("gameId === 'astroblaster'"), 'gamepad bridge must map Astro Blaster controls');
assert(gameShell.includes('useGamepadBridge'), 'GameShell must activate the gamepad bridge');
assert(gameShell.includes('gamepad-virtual-cursor'), 'GameShell must render the virtual gamepad cursor');
assert(gameShell.includes('wakeLock'), 'GameShell must request a wake lock during active mobile play');

assert(css.includes('.game-shell'), 'mobile safe-area game shell styles are missing');
assert(css.includes('env(safe-area-inset-bottom)'), 'safe-area bottom inset handling is missing');
assert(css.includes('100dvh'), 'dynamic viewport height handling is missing');
assert(css.includes('prefers-reduced-motion'), 'reduced-motion accessibility handling is missing');

assert(pagesWorkflow.includes('actions/deploy-pages@v4'), 'Pages workflow must deploy the built artifact');
assert(pagesWorkflow.includes('bun run build:pages'), 'Pages workflow must build the Vite Pages variant');
assert(pagesWorkflow.includes('actions/upload-pages-artifact@v3'), 'Pages workflow must upload dist, not raw source');

for (const icon of ['public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/icons/apple-touch-icon.png']) {
  assert(existsSync(icon), `${icon} is missing`);
}

const dist = 'dist';
if (existsSync(dist)) {
  const builtIndex = read(join(dist, 'index.html'));
  const expectedBase = process.env.MA3_EXPECT_BASE ?? '/';
  assert(existsSync(join(dist, 'manifest.webmanifest')), 'built manifest is missing');
  assert(existsSync(join(dist, 'sw.js')), 'built service worker is missing');
  assert(existsSync(join(dist, 'icons/icon-192.png')), 'built 192 icon is missing');
  assert(existsSync(join(dist, 'icons/icon-512.png')), 'built 512 icon is missing');
  if (expectedBase !== '/') {
    assert(builtIndex.includes(`${expectedBase}assets/`), `built asset URLs must use expected base ${expectedBase}`);
  }
}

if (!process.exitCode) {
  console.log('MA3 PWA / offline / gamepad / mobile structural certification passed.');
}
