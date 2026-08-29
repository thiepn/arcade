import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dist = process.env.MA4_DIST || 'dist';
const expectedBase = process.env.MA4_EXPECT_BASE || '/';
const errors = [];
const read = (path) => readFileSync(join(root, path), 'utf8');

const games = read('src/data/games.ts');
const app = read('src/App.tsx');
const card = read('src/components/GameCard.tsx');
const shell = read('src/components/GameShell.tsx');
const main = read('src/main.tsx');
const css = read('src/index.css');
const statsModal = read('src/components/StatsModal.tsx');
const overallModal = read('src/components/OverallLeaderboardModal.tsx');
const profileModal = read('src/components/PlayerProfileModal.tsx');
const modalFocus = read('src/hooks/useModalFocus.ts');
const serviceWorker = read('public/sw.js');
const vite = read('vite.config.ts');
const pkg = JSON.parse(read('package.json'));

const lazyGameCount = (games.match(/component:\s*lazyGame\(/g) ?? []).length;
const staticGameImports = (games.match(/from ['"]\.\.\/games\//g) ?? []).length;
if (lazyGameCount !== 32) errors.push(`Expected 32 lazy game components, found ${lazyGameCount}`);
if (staticGameImports !== 0) errors.push(`Found ${staticGameImports} static game imports in the registry`);
for (const surface of ['GameShell', 'StatsModal', 'OverallLeaderboardModal', 'PlayerProfileModal', 'StressTester']) {
  if (!app.includes(`const ${surface} = lazy(`)) errors.push(`${surface} is not deferred with React.lazy`);
}
if (!app.includes('href="#library-section"') || !app.includes('id="library-section"')) errors.push('Skip navigation / game-library landmark is missing');
if (!app.includes('<ErrorBoundary key={`game-shell-')) errors.push('Game-shell error isolation is missing');
if (!card.includes('id={`play-btn-${game.id}`}') || !card.includes('aria-pressed={isFavorite}')) errors.push('Game cards lack separate native play/favorite controls');
if (card.includes('role="button"')) errors.push('Game card should use a native play button, not a simulated role button');
if (!shell.includes("import('canvas-confetti')")) errors.push('Confetti remains in the eager GameShell chunk');
if (!shell.includes('<Suspense') || !shell.includes('<ErrorBoundary key={`game-')) errors.push('Lazy game loading/failure isolation is missing');
if (!main.includes('<ErrorBoundary>') || !main.includes("vite:preloadError")) errors.push('Root runtime/dynamic-import recovery is missing');
if (!css.includes('.skip-link') || !css.includes(':focus-visible')) errors.push('Visible keyboard navigation styles are missing');
if (!modalFocus.includes("event.key !== 'Tab'")) errors.push('Modal focus trap is missing');
for (const [name, source] of [['Stats', statsModal], ['Overall', overallModal], ['Profile', profileModal]]) {
  if (!source.includes('useModalFocus(dialogRef)') || !source.includes('aria-modal="true"')) errors.push(`${name} modal focus/semantics are incomplete`);
}
if (!vite.includes("manifest: 'asset-manifest.json'")) errors.push('Vite asset manifest is not enabled');
if (!vite.includes("return 'react-vendor'")) errors.push('Stable vendor chunking is missing');
if (!serviceWorker.includes("scopeUrl('asset-manifest.json')") || !serviceWorker.includes('discoverManifestAssets')) errors.push('Service worker does not precache lazy build chunks');
if (pkg.version !== '1.1.1' || pkg.license !== 'Apache-2.0') errors.push('Release package metadata is incomplete');
for (const path of ['CHANGELOG.md', 'LICENSE']) if (!existsSync(join(root, path))) errors.push(`${path} is missing`);

const manifestPath = join(root, dist, 'asset-manifest.json');
if (!existsSync(manifestPath)) {
  errors.push(`${dist}: asset-manifest.json is missing`);
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const gameEntries = Object.keys(manifest).filter((key) => key.startsWith('src/games/') && key.endsWith('.tsx'));
  if (gameEntries.length !== 32) errors.push(`${dist}: expected 32 built game entries, found ${gameEntries.length}`);
  const entryKey = Object.keys(manifest).find((key) => manifest[key]?.isEntry === true);
  const entry = entryKey ? manifest[entryKey] : null;
  if (!entryKey || !entry) {
    errors.push(`${dist}: Vite entry manifest record is missing`);
  } else {
    const initialKeys = new Set();
    const visit = (key) => {
      if (initialKeys.has(key)) return;
      initialKeys.add(key);
      for (const dependency of manifest[key]?.imports || []) visit(dependency);
    };
    visit(entryKey);
    const eagerGames = [...initialKeys].filter((key) => key.startsWith('src/games/'));
    if (eagerGames.length) errors.push(`${dist}: game modules leaked into initial graph: ${eagerGames.join(', ')}`);
  }
}

const assetsDir = join(root, dist, 'assets');
if (!existsSync(assetsDir)) {
  errors.push(`${dist}: assets directory is missing`);
} else {
  const jsFiles = readdirSync(assetsDir).filter((name) => name.endsWith('.js'));
  if (jsFiles.length < 10) errors.push(`${dist}: expected code-split JavaScript output, found ${jsFiles.length} chunks`);
  for (const file of jsFiles) {
    const size = statSync(join(root, dist, 'assets', file)).size;
    if (size > 350_000) errors.push(`${dist}: ${file} is ${size} bytes; expected <=350000`);
  }
}

const builtIndexPath = join(root, dist, 'index.html');
if (existsSync(builtIndexPath) && expectedBase !== '/') {
  const builtIndex = readFileSync(builtIndexPath, 'utf8');
  if (!builtIndex.includes(`${expectedBase}assets/`)) errors.push(`${dist}: expected asset base ${expectedBase}`);
}

if (errors.length) {
  console.error('MA4 audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`MA4 audit passed: 32 lazy games, deferred secondary surfaces, accessible interaction/focus, recoverable runtime boundaries, complete offline chunk precache, and <=350 KB chunks in ${dist}.`);
