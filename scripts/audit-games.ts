import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = process.cwd();
const gamesDir = join(root, 'src', 'games');
const registryPath = join(root, 'src', 'data', 'games.ts');
const workerPath = join(root, 'worker', 'src', 'index.ts');
const registrySource = readFileSync(registryPath, 'utf8');
const workerSource = readFileSync(workerPath, 'utf8');

const files = readdirSync(gamesDir)
  .filter((name) => name.endsWith('Game.tsx'))
  .sort();

const importedComponents = new Map<string, string>();
const registeredComponents = new Set<string>();

// Support both the original direct imports and MA4's React.lazy dynamic registrations.
for (const match of registrySource.matchAll(/import\s+\{\s*(\w+Game)\s*\}\s+from\s+'\.\.\/games\/(\w+Game)'/g)) {
  importedComponents.set(match[1], `${match[2]}.tsx`);
}
for (const match of registrySource.matchAll(/component:\s*(\w+Game)\s*,/g)) {
  registeredComponents.add(match[1]);
}
for (const match of registrySource.matchAll(/component:\s*lazyGame\(\(\) => import\('\.\.\/games\/(\w+Game)'\)\.then\(\(\{\s*(\w+Game)\s*\}\)/g)) {
  const [, fileStem, component] = match;
  importedComponents.set(component, `${fileStem}.tsx`);
  registeredComponents.add(component);
}

const registeredFiles = new Set(
  [...registeredComponents]
    .map((component) => importedComponents.get(component))
    .filter((value): value is string => Boolean(value)),
);

const registryIds = new Set<string>();
for (const match of registrySource.matchAll(/^\s{4}id:\s*'([a-z0-9-]+)',/gm)) {
  registryIds.add(match[1]);
}

const workerRuleBlock = /Object\.fromEntries\(\s*\[([\s\S]*?)\]\.map\(\(id\)/.exec(workerSource)?.[1] ?? '';
const workerGameIds = new Set<string>(
  [...workerRuleBlock.matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]),
);

const controlHints = new Map<string, string>();
for (const component of registeredComponents) {
  const escaped = component.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const importedFile = importedComponents.get(component)?.replace(/\.tsx$/, '') ?? '';
  const escapedFile = importedFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const direct = new RegExp(`controlsHint:\\s*'([^']+)'[\\s\\S]{0,240}?component:\\s*${escaped}\\s*,`).exec(registrySource);
  const lazy = escapedFile
    ? new RegExp(`controlsHint:\\s*'([^']+)'[\\s\\S]{0,420}?component:\\s*lazyGame\\(\\(\\) => import\\('\\.\\.\\/games\\/${escapedFile}'\\)`).exec(registrySource)
    : null;
  const match = direct ?? lazy;
  if (match) controlHints.set(component, match[1]);
}

const errors: string[] = [];
const warnings: string[] = [];

if (registeredComponents.size !== importedComponents.size) {
  errors.push(`Registry imports ${importedComponents.size} game components but registers ${registeredComponents.size}.`);
}
if (registryIds.size !== registeredComponents.size) {
  errors.push(`Registry contains ${registryIds.size} game IDs but ${registeredComponents.size} registered components.`);
}
if (!workerRuleBlock) {
  errors.push('Unable to parse Cloudflare GAME_RULES accepted-game list.');
}

for (const id of registryIds) {
  if (!workerGameIds.has(id)) errors.push(`Frontend game ${id} is missing from Cloudflare GAME_RULES.`);
}
for (const id of workerGameIds) {
  if (!registryIds.has(id)) errors.push(`Cloudflare GAME_RULES contains ${id}, which is absent from GAMES_REGISTRY.`);
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
  mouse: boolean;
  touch: boolean;
  click: boolean;
  raf: boolean;
  timers: number;
  listeners: number;
  hint: string;
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
  const component = [...importedComponents.entries()].find(([, importedFile]) => importedFile === file)?.[0];
  const hint = component ? (controlHints.get(component) ?? '') : '';
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

  const keyboard = /keydown|keyup|onKeyDown|onKeyUp/.test(source);
  const pointer = /pointerdown|pointermove|pointerup|pointercancel|onPointer/.test(source);
  const mouse = /mousedown|mousemove|mouseup|onMouse/.test(source);
  const touch = /touchstart|touchmove|touchend|touchcancel|onTouch/.test(source);
  const click = /onClick/.test(source);

  const promisesTouch = /touch|tap|swipe/i.test(hint);
  const promisesContinuousTouch = promisesTouch && /drag|swipe|steer|draw/i.test(hint);
  if (promisesTouch && !(pointer || touch || click)) {
    errors.push(`${file}: registry promises touch/tap input (${JSON.stringify(hint)}) but no pointer/touch/click handler is present.`);
  }
  if (promisesContinuousTouch && !(pointer || touch)) {
    errors.push(`${file}: registry promises continuous touch input (${JSON.stringify(hint)}) but only mouse/click input is implemented.`);
  }

  rows.push({
    file: basename(file, '.tsx'),
    pause: hasPause,
    gameOver: hasGameOver,
    score: hasScore,
    keyboard,
    pointer,
    mouse,
    touch,
    click,
    raf: rafs > 0,
    timers: intervals + timeouts,
    listeners: [...addEvents.values()].reduce((sum, value) => sum + value, 0),
    hint,
  });
}

console.log(`MA1 GAME QUALITY AUDIT — ${files.length} game source files / ${registeredComponents.size} registered games / ${workerGameIds.size} Worker rules`);
console.log('');
console.log('Game | Pause | Over | Score | Key | Pointer | Mouse | Touch | Click | RAF | Timers | Listeners | Registry controls');
console.log('--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---');
for (const row of rows) {
  const yes = (value: boolean) => value ? 'yes' : '—';
  console.log(`${row.file} | ${yes(row.pause)} | ${yes(row.gameOver)} | ${yes(row.score)} | ${yes(row.keyboard)} | ${yes(row.pointer)} | ${yes(row.mouse)} | ${yes(row.touch)} | ${yes(row.click)} | ${yes(row.raf)} | ${row.timers} | ${row.listeners} | ${row.hint || 'unregistered'}`);
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
