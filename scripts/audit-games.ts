import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = process.cwd();
const gamesDir = join(root, 'src', 'games');
const registryPath = join(root, 'src', 'data', 'games.ts');
const registrySource = readFileSync(registryPath, 'utf8');

const files = readdirSync(gamesDir)
  .filter((name) => name.endsWith('Game.tsx'))
  .sort();

const importedComponents = new Map<string, string>();
for (const match of registrySource.matchAll(/import\s+\{\s*(\w+Game)\s*\}\s+from\s+'\.\.\/games\/(\w+Game)'/g)) {
  importedComponents.set(match[1], `${match[2]}.tsx`);
}

const registeredComponents = new Set<string>();
for (const match of registrySource.matchAll(/component:\s*(\w+Game)\s*,/g)) {
  registeredComponents.add(match[1]);
}

const registeredFiles = new Set(
  [...registeredComponents]
    .map((component) => importedComponents.get(component))
    .filter((value): value is string => Boolean(value)),
);

const errors: string[] = [];
const warnings: string[] = [];

if (registeredComponents.size !== importedComponents.size) {
  errors.push(`Registry imports ${importedComponents.size} game components but registers ${registeredComponents.size}.`);
}

for (const file of files) {
  if (!registeredFiles.has(file)) errors.push(`${file} exists but is not registered in GAMES_REGISTRY.`);
}
for (const file of registeredFiles) {
  if (!files.includes(file)) errors.push(`${file} is registered but the source file does not exist.`);
}

type Row = {
  file: string;
  pause: boolean;
  gameOver: boolean;
  score: boolean;
  keyboard: boolean;
  pointer: boolean;
  touch: boolean;
  raf: boolean;
  timers: number;
  listeners: number;
};

const rows: Row[] = [];

function count(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function listenerEvents(source: string, method: 'addEventListener' | 'removeEventListener'): Map<string, number> {
  const result = new Map<string, number>();
  const regex = new RegExp(`${method}\\(\\s*['\"]([^'\"]+)['\"]`, 'g');
  for (const match of source.matchAll(regex)) result.set(match[1], (result.get(match[1]) ?? 0) + 1);
  return result;
}

for (const file of files) {
  const source = readFileSync(join(gamesDir, file), 'utf8');
  const addEvents = listenerEvents(source, 'addEventListener');
  const removeEvents = listenerEvents(source, 'removeEventListener');

  for (const [event, additions] of addEvents) {
    const removals = removeEvents.get(event) ?? 0;
    if (removals < additions) {
      errors.push(`${file}: ${event} listener added ${additions}x but removed ${removals}x.`);
    }
  }

  const intervals = count(source, /(?<!clear)Interval\s*\(/g);
  const intervalClears = count(source, /clearInterval\s*\(/g);
  if (intervals > intervalClears && !source.includes('useSafeInterval')) {
    warnings.push(`${file}: ${intervals} interval allocation(s) but ${intervalClears} explicit clear(s).`);
  }

  const timeouts = count(source, /(?<!clear)Timeout\s*\(/g);
  const timeoutClears = count(source, /clearTimeout\s*\(/g);
  if (timeouts > timeoutClears && !source.includes('useSafeTimeout')) {
    warnings.push(`${file}: ${timeouts} timeout allocation(s) but ${timeoutClears} explicit clear(s).`);
  }

  const rafs = count(source, /requestAnimationFrame\s*\(/g);
  const rafCancels = count(source, /cancelAnimationFrame\s*\(/g);
  if (rafs > 0 && rafCancels === 0) warnings.push(`${file}: uses requestAnimationFrame without explicit cancellation.`);

  const hasPause = /\bisPaused\b/.test(source);
  const hasGameOver = /\bonGameOver\b/.test(source);
  const hasScore = /\bonScoreUpdate\b/.test(source);
  if (!hasPause) errors.push(`${file}: does not consume the shared isPaused contract.`);
  if (!hasGameOver) errors.push(`${file}: does not expose/use onGameOver.`);
  if (!hasScore) errors.push(`${file}: does not expose/use onScoreUpdate.`);

  rows.push({
    file: basename(file, '.tsx'),
    pause: hasPause,
    gameOver: hasGameOver,
    score: hasScore,
    keyboard: /keydown|keyup|onKeyDown|onKeyUp/.test(source),
    pointer: /pointerdown|pointermove|pointerup|onPointer|mousedown|mousemove|mouseup|onMouse|onClick/.test(source),
    touch: /touchstart|touchmove|touchend|onTouch/.test(source),
    raf: rafs > 0,
    timers: intervals + timeouts,
    listeners: [...addEvents.values()].reduce((sum, value) => sum + value, 0),
  });
}

console.log(`MA1 GAME QUALITY AUDIT — ${files.length} game source files / ${registeredComponents.size} registered games`);
console.log('');
console.log('Game | Pause | GameOver | Score | Keyboard | Pointer | Touch | RAF | Timers | Listeners');
console.log('--- | --- | --- | --- | --- | --- | --- | --- | ---: | ---:');
for (const row of rows) {
  const yes = (value: boolean) => value ? 'yes' : '—';
  console.log(`${row.file} | ${yes(row.pause)} | ${yes(row.gameOver)} | ${yes(row.score)} | ${yes(row.keyboard)} | ${yes(row.pointer)} | ${yes(row.touch)} | ${yes(row.raf)} | ${row.timers} | ${row.listeners}`);
}

if (warnings.length) {
  console.log('\nWARNINGS');
  for (const warning of warnings) console.log(`- ${warning}`);
}
if (errors.length) {
  console.error('\nERRORS');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('\nStructural game-quality checks passed.');
}
