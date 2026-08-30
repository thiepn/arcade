import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const games = readdirSync(join(process.cwd(), 'src', 'games')).filter((name) => name.endsWith('Game.tsx')).sort();

assert(games.length === 32, `expected 32 game modules, found ${games.length}`);

const managedBridgeGames = [
  'AirHockeyGame.tsx','AstroBlasterGame.tsx','BladeGame.tsx','BubbleBusterGame.tsx',
  'DodgeGame.tsx','DriftGame.tsx','FlappyAeroGame.tsx','KnifeTargetGame.tsx',
  'LaserRopeGame.tsx','PacMazeGame.tsx','PerfectStopGame.tsx','PinballGame.tsx',
  'RhythmGame.tsx','RoadCrossGame.tsx','SlingshotGame.tsx','TowerGame.tsx',
].sort();
const manualCadenceGames = ['BlockDropGame.tsx','NeonRailShiftGame.tsx'].sort();
const eventOnlyGames = [
  'BreakoutGame.tsx','ChainGame.tsx','ChronoGame.tsx','GravityGame.tsx','MatrixGame.tsx',
  'MergeGame.tsx','OneLineGame.tsx','OrbitGame.tsx','PulseGame.tsx','ReactionGame.tsx',
  'SnakeGame.tsx','StackGame.tsx','TypeRushGame.tsx','VanguardGame.tsx',
].sort();
const classified = [...managedBridgeGames, ...manualCadenceGames, ...eventOnlyGames].sort();
assert(JSON.stringify(classified) === JSON.stringify(games), 'every game must have an explicit HUD/render publication policy');

const hookSource = read('src/hooks/useGameLoop.ts');
assert(hookSource.includes('export const useRenderPublishedState'), 'shared change/cadence state publisher is missing');
assert(hookSource.includes('export const useRenderPublishedCallback'), 'shared callback publisher is missing');
assert(hookSource.includes('trailingTimeoutRef'), 'render publishers no longer retain a trailing update');

const statePolicies: Array<[string, string, number]> = [
  ['AirHockeyGame.tsx', 'setHudState', 0],
  ['AstroBlasterGame.tsx', 'setHasShield', 0],
  ['AstroBlasterGame.tsx', 'setHasTripleShot', 0],
  ['BladeGame.tsx', 'setHudState', 50],
  ['BubbleBusterGame.tsx', 'setHudState', 0],
  ['DriftGame.tsx', 'setScore', 100],
  ['DriftGame.tsx', 'setNitroEnergy', 100],
  ['DriftGame.tsx', 'setCurrentSpeedKmh', 100],
  ['FlappyAeroGame.tsx', 'setHudState', 0],
  ['KnifeTargetGame.tsx', 'setHudState', 0],
  ['LaserRopeGame.tsx', 'setHudState', 80],
  ['PacMazeGame.tsx', 'setHudState', 0],
  ['PinballGame.tsx', 'setHud', 0],
  ['RhythmGame.tsx', 'setHudStats', 100],
  ['RoadCrossGame.tsx', 'setHudState', 0],
  ['SlingshotGame.tsx', 'setIsLockedOn', 0],
  ['TowerGame.tsx', 'setHudState', 100],
];

const findMatchingParen = (source: string, openIndex: number) => {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = openIndex; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') depth++;
    else if (char === ')') {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
};

for (const [file, setter, interval] of statePolicies) {
  const source = read(`src/games/${file}`);
  const declaration = new RegExp(
    `const\\s*\\[\\s*[A-Za-z_$][\\w$]*\\s*,\\s*${setter}\\s*\\]\\s*=\\s*useRenderPublishedState(?:<[^;=()]+>)?\\s*\\(`,
  ).exec(source);
  assert(Boolean(declaration), `${file}: ${setter} is no longer bridged through useRenderPublishedState`);
  if (!declaration) continue;

  const hookOffset = source.indexOf('useRenderPublishedState', declaration.index);
  const openParen = source.indexOf('(', hookOffset);
  const closeParen = findMatchingParen(source, openParen);
  assert(closeParen > openParen, `${file}: unable to parse ${setter} publication policy`);
  if (closeParen <= openParen) continue;

  const args = source.slice(openParen + 1, closeParen).trim();
  if (interval > 0) {
    assert(
      new RegExp(`,\\s*${interval}\\s*$`).test(args),
      `${file}: ${setter} must remain bounded to ${interval} ms`,
    );
  } else {
    assert(
      !/,\\s*\\d+\\s*$/.test(args) || /,\\s*0\\s*$/.test(args),
      `${file}: ${setter} should publish immediately on semantic change, not on a timer`,
    );
  }
}

for (const file of ['DodgeGame.tsx', 'DriftGame.tsx', 'TowerGame.tsx']) {
  const source = read(`src/games/${file}`);
  assert(
    source.includes('useRenderPublishedCallback(onScoreUpdate, 100)'),
    `${file}: continuous score publication is not bounded to 100 ms`,
  );
  assert(!source.includes('onScoreUpdate('), `${file}: direct hot-path onScoreUpdate call bypasses the bounded publisher`);
}

const perfectStop = read('src/games/PerfectStopGame.tsx');
assert(!perfectStop.includes('setMarkerPos('), 'Perfect Stop restored a per-frame React marker setter');
assert(!perfectStop.includes('[markerPos, setMarkerPos]'), 'Perfect Stop restored marker position React state');
assert(perfectStop.includes('markerElementRef.current.style.left'), 'Perfect Stop cursor is no longer driven imperatively at frame rate');

const blockDrop = read('src/games/BlockDropGame.tsx');
assert(
  blockDrop.includes('currentTime - state.lastHudSync > 150'),
  'Block Drop removed its 150 ms HUD publication bound',
);
const neonRail = read('src/games/NeonRailShiftGame.tsx');
assert(
  neonRail.includes('now - state.lastHudSync > 120'),
  'Neon Rail Shift removed its 120 ms HUD publication bound',
);

for (const file of games) {
  const source = read(`src/games/${file}`);
  const syncSections = [...source.matchAll(/(?:Sync|Update)[^\n]{0,40}HUD[^\n]*\n([\s\S]{0,900})/gi)];
  for (const section of syncSections) {
    const body = section[1];
    const rawSetter = /\b(set[A-Z][A-Za-z0-9_$]*)\s*\(/.exec(body);
    if (!rawSetter) continue;
    const setter = rawSetter[1];
    const isManaged = statePolicies.some(([policyFile, policySetter]) => policyFile === file && policySetter === setter);
    const isManual = manualCadenceGames.includes(file);
    assert(isManaged || isManual, `${file}: HUD sync calls raw ${setter} without a declared render publication policy`);
  }
}

if (errors.length) {
  console.error('HUD / RENDER-PERFORMANCE REGRESSION AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('HUD / RENDER-PERFORMANCE REGRESSION AUDIT — PASS');
console.log('All 32 games have an explicit render publication policy; continuous HUD/score bridges are bounded and Perfect Stop stays off React state at frame rate.');
