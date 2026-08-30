import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const gamesDir = join(root, 'src', 'games');
const files = readdirSync(gamesDir).filter((name) => name.endsWith('Game.tsx')).sort();

const lineNo = (source: string, index: number) => source.slice(0, index).split('\n').length;
const matches = (source: string, re: RegExp) => [...source.matchAll(re)].map((m) => ({ line: lineNo(source, m.index ?? 0), text: m[0].replace(/\s+/g, ' ').slice(0, 180) }));

for (const file of files) {
  const source = readFileSync(join(gamesDir, file), 'utf8');
  const flags: string[] = [];

  const fixedMin = matches(source, /min-h-\[(?:3\d\d|4\d\d|5\d\d|6\d\d)px\]/g);
  if (fixedMin.length) flags.push(`fixed-min-height:${fixedMin.map(x => `${x.line}:${x.text}`).join('|')}`);

  const rawTimers = matches(source, /\b(?:setTimeout|setInterval)\s*\(/g);
  if (rawTimers.length) flags.push(`raw-timers:${rawTimers.map(x => x.line).join(',')}`);

  const perfNow = matches(source, /performance\.now\(\)/g);
  if (perfNow.length) flags.push(`performance-now:${perfNow.map(x => x.line).join(',')}`);

  const randomProb = matches(source, /Math\.random\(\)\s*<\s*0?\.\d+/g);
  if (randomProb.length) flags.push(`random-prob:${randomProb.map(x => `${x.line}:${x.text}`).join('|')}`);

  const onUpdateStart = source.indexOf('onUpdate:');
  if (onUpdateStart >= 0) {
    const tail = source.slice(onUpdateStart);
    const renderStateSetters = matches(tail, /\bset[A-Z][A-Za-z0-9_]*\s*\(/g).filter((x) => !/setSafeTimeout/.test(x.text));
    if (renderStateSetters.length) flags.push(`react-setters-in-update:${renderStateSetters.slice(0,20).map(x => `${x.line + lineNo(source,onUpdateStart)-1}:${x.text}`).join('|')}`);
  } else if (source.includes('useGameLoop')) {
    flags.push('useGameLoop-without-onUpdate');
  }

  const inputHandlers = [...source.matchAll(/const\s+(handle(?:Pointer|Touch|Mouse|Key|Lane|Click|Tap|Trigger|Press|Swipe)[A-Za-z0-9_]*)\s*=\s*(?:useCallback\()?\s*\([^)]*\)\s*=>\s*\{/g)];
  const unguardedInputs: string[] = [];
  for (const m of inputHandlers) {
    const start = m.index ?? 0;
    const segment = source.slice(start, start + 700);
    if (!/(isPausedRef\.current|\bisPaused\b)/.test(segment) && /state\.|gameStateRef\.current|onScoreUpdate|onGameOver/.test(segment)) {
      unguardedInputs.push(`${lineNo(source,start)}:${m[1]}`);
    }
  }
  if (unguardedInputs.length) flags.push(`possibly-unguarded-input:${unguardedInputs.join('|')}`);

  const onResize = source.indexOf('onResize:');
  if (onResize >= 0) {
    const segment = source.slice(onResize, onResize + 4500);
    const suspiciousReset = matches(segment, /state\.(?:score|lives|wave|round|level|isAlive|combo|gameTime|currentBeat|chargesLeft|bombs)\s*=\s*(?:0|1|2|3|true|false)/g);
    if (suspiciousReset.length) flags.push(`resize-core-reset?:${suspiciousReset.map(x => `${x.line + lineNo(source,onResize)-1}:${x.text}`).join('|')}`);
  }

  const gameOverCalls = matches(source, /onGameOver\s*\(/g);
  if (gameOverCalls.length > 1) flags.push(`multiple-gameover-sites:${gameOverCalls.map(x => x.line).join(',')}`);

  const fullWindowPointer = matches(source, /window\.addEventListener\(['"](?:mousemove|touchmove)['"]/g);
  if (fullWindowPointer.length) flags.push(`global-pointer-tracking:${fullWindowPointer.map(x => x.line).join(',')}`);

  const preventTouch = source.includes("touchmove") && !source.includes('preventDefault');
  if (preventTouch) flags.push('touchmove-without-preventDefault');

  console.log(`\n=== ${file} ===`);
  if (!flags.length) console.log('NO STATIC FLAGS');
  else for (const flag of flags) console.log(flag);
}
