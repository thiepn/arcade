import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const games = readFileSync(join(root, 'src/data/games.ts'), 'utf8');
const card = readFileSync(join(root, 'src/components/GameCard.tsx'), 'utf8');
const main = readFileSync(join(root, 'src/main.tsx'), 'utf8');

const errors = [];
const lazyGameCount = (games.match(/component:\s*lazyGame\(/g) ?? []).length;
const staticGameImports = (games.match(/from ['"]\.\.\/games\//g) ?? []).length;

if (lazyGameCount !== 31) errors.push(`Expected 31 lazy game components, found ${lazyGameCount}`);
if (staticGameImports !== 0) errors.push(`Found ${staticGameImports} static game imports in the registry`);
if (!card.includes('role="button"') || !card.includes('tabIndex={0}') || !card.includes('onKeyDown={handleCardKeyDown}')) {
  errors.push('Game cards are missing keyboard-operable button semantics');
}
if (!card.includes('aria-pressed={isFavorite}')) errors.push('Favorite controls are missing aria-pressed state');
if (!main.includes('<ErrorBoundary>')) errors.push('Root runtime error boundary is missing');
if (!main.includes("vite:preloadError")) errors.push('Dynamic-import recovery handler is missing');

for (const dist of ['dist', 'dist-pages']) {
  const assetsDir = join(root, dist, 'assets');
  try {
    const files = readdirSync(assetsDir).filter((name) => name.endsWith('.js'));
    if (!files.length) errors.push(`${dist}: no JavaScript assets found`);
    for (const file of files) {
      const size = statSync(join(assetsDir, file)).size;
      if (size > 350_000) errors.push(`${dist}: ${file} is ${size} bytes; expected <= 350000`);
    }
  } catch {
    errors.push(`${dist}: missing build assets`);
  }
}

if (errors.length) {
  console.error('MA4 audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`MA4 audit passed: ${lazyGameCount} lazy games, accessible game cards, runtime recovery, and chunk-size ceiling.`);
