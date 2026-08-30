from pathlib import Path
import json
import re

ROOT = Path('.')

def read(path: str) -> str:
    return (ROOT / path).read_text()

def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text)

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

def find_matching_paren(text: str, open_index: int) -> int:
    depth = 0
    quote = None
    escape = False
    i = open_index
    while i < len(text):
        ch = text[i]
        if quote:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if text.startswith('//', i):
            newline = text.find('\n', i)
            i = len(text) if newline == -1 else newline + 1
            continue
        if text.startswith('/*', i):
            end = text.find('*/', i + 2)
            i = len(text) if end == -1 else end + 2
            continue
        if ch in "'\"`":
            quote = ch
            i += 1
            continue
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise SystemExit(f'unmatched parenthesis at offset {open_index}')

def ensure_hook_import(path: str, names: list[str]) -> None:
    source = read(path)
    pattern = re.compile(r"import\s*\{(?P<names>[^}]*)\}\s*from\s*'../hooks/useGameLoop';", re.S)
    match = pattern.search(source)
    if match:
        existing = [item.strip() for item in match.group('names').split(',') if item.strip()]
        changed = False
        for name in names:
            if name not in existing:
                existing.append(name)
                changed = True
        if changed:
            replacement = "import { " + ", ".join(existing) + " } from '../hooks/useGameLoop';"
            source = source[:match.start()] + replacement + source[match.end():]
            write(path, source)
        return

    react_import = re.search(r"^import .* from 'react';\n", source, re.M)
    if not react_import:
        raise SystemExit(f'cannot place useGameLoop hook import in {path}')
    insertion = "import { " + ", ".join(names) + " } from '../hooks/useGameLoop';\n"
    source = source[:react_import.end()] + insertion + source[react_import.end():]
    write(path, source)

def replace_state_hook(path: str, setter: str, interval_ms: int = 0) -> None:
    source = read(path)
    pattern = re.compile(
        rf"(const\s*\[\s*[A-Za-z_$][\w$]*\s*,\s*{re.escape(setter)}\s*\]\s*=\s*)"
        rf"useState(?P<generic><[^;=()]+>)?\s*\("
    )
    match = pattern.search(source)
    if not match:
        raise SystemExit(f'cannot find useState declaration for {setter} in {path}')
    token_start = source.find('useState', match.start(), match.end())
    if token_start == -1:
        raise SystemExit(f'cannot locate useState token for {setter} in {path}')
    open_paren = source.find('(', token_start, match.end() + 1)
    if open_paren == -1:
        raise SystemExit(f'cannot locate useState opening paren for {setter} in {path}')
    close_paren = find_matching_paren(source, open_paren)

    if interval_ms > 0:
        source = source[:close_paren] + f', {interval_ms}' + source[close_paren:]
    source = source[:token_start] + 'useRenderPublishedState' + source[token_start + len('useState'):]
    write(path, source)

def insert_publish_score(path: str, interval_ms: int = 100) -> None:
    source = read(path)
    component = re.search(
        r"export const [A-Za-z0-9_]+Game: React\.FC<GameComponentProps> = \(\{[\s\S]*?\}\) => \{\n",
        source,
    )
    if not component:
        raise SystemExit(f'cannot find component start in {path}')
    if 'useRenderPublishedCallback(onScoreUpdate' not in source:
        insertion = f"  const publishScore = useRenderPublishedCallback(onScoreUpdate, {interval_ms});\n"
        source = source[:component.end()] + insertion + source[component.end():]
    source = source.replace('onScoreUpdate(', 'publishScore(')
    write(path, source)

# 1. Shared render-to-React publication helpers.
path = 'src/hooks/useGameLoop.ts'
source = read(path)
source = replace_once(
    source,
    "import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';",
    "import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';",
    'useGameLoop React imports',
)

helper_code = r'''
const arePublishedValuesEqual = <T,>(left: T, right: T): boolean => {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => Object.is(value, right[index]));
  }

  if (Object.getPrototypeOf(left) !== Object.prototype || Object.getPrototypeOf(right) !== Object.prototype) {
    return false;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key) && Object.is(leftRecord[key], rightRecord[key]));
};

const resolvePublishedStateAction = <T,>(previous: T, action: SetStateAction<T>): T =>
  typeof action === 'function' ? (action as (value: T) => T)(previous) : action;

/**
 * Bridges render-loop values into React without making React part of the frame clock.
 * A zero interval publishes only semantic changes. A positive interval also caps
 * continuous HUD refreshes while retaining a trailing update.
 */
export const useRenderPublishedState = <T,>(
  initialState: T | (() => T),
  minIntervalMs = 0,
): [T, Dispatch<SetStateAction<T>>] => {
  const [state, setState] = useState(initialState);
  const publishedRef = useRef(state);
  const pendingRef = useRef(state);
  const lastPublishedAtRef = useRef(Number.NEGATIVE_INFINITY);
  const trailingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTrailing = useCallback(() => {
    if (trailingTimeoutRef.current !== null) {
      clearTimeout(trailingTimeoutRef.current);
      trailingTimeoutRef.current = null;
    }
  }, []);

  const commitPending = useCallback(() => {
    const next = pendingRef.current;
    if (arePublishedValuesEqual(publishedRef.current, next)) return;
    publishedRef.current = next;
    lastPublishedAtRef.current = performance.now();
    setState(next);
  }, []);

  const publish = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    pendingRef.current = resolvePublishedStateAction(pendingRef.current, action);
    if (arePublishedValuesEqual(publishedRef.current, pendingRef.current)) {
      clearTrailing();
      return;
    }

    const now = performance.now();
    const elapsed = now - lastPublishedAtRef.current;
    if (minIntervalMs <= 0 || elapsed >= minIntervalMs) {
      clearTrailing();
      commitPending();
      return;
    }

    if (trailingTimeoutRef.current === null) {
      trailingTimeoutRef.current = setTimeout(() => {
        trailingTimeoutRef.current = null;
        commitPending();
      }, Math.max(0, minIntervalMs - elapsed));
    }
  }, [clearTrailing, commitPending, minIntervalMs]);

  useEffect(() => clearTrailing, [clearTrailing]);
  return [state, publish];
};

/**
 * Bounded publisher for parent callbacks such as onScoreUpdate. Values are
 * de-duplicated before crossing the React component boundary and a trailing
 * publish guarantees the latest value is not lost.
 */
export const useRenderPublishedCallback = <T,>(
  callback: (value: T) => void,
  minIntervalMs = 100,
) => {
  const callbackRef = useLatestCallback(callback);
  const hasPublishedRef = useRef(false);
  const publishedRef = useRef<T | undefined>(undefined);
  const hasPendingRef = useRef(false);
  const pendingRef = useRef<T | undefined>(undefined);
  const lastPublishedAtRef = useRef(Number.NEGATIVE_INFINITY);
  const trailingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTrailing = useCallback(() => {
    if (trailingTimeoutRef.current !== null) {
      clearTimeout(trailingTimeoutRef.current);
      trailingTimeoutRef.current = null;
    }
  }, []);

  const commitPending = useCallback(() => {
    if (!hasPendingRef.current) return;
    const next = pendingRef.current as T;
    hasPendingRef.current = false;
    if (hasPublishedRef.current && arePublishedValuesEqual(publishedRef.current as T, next)) return;
    hasPublishedRef.current = true;
    publishedRef.current = next;
    lastPublishedAtRef.current = performance.now();
    callbackRef.current(next);
  }, [callbackRef]);

  const publish = useCallback((value: T) => {
    pendingRef.current = value;
    hasPendingRef.current = true;

    if (hasPublishedRef.current && arePublishedValuesEqual(publishedRef.current as T, value)) {
      hasPendingRef.current = false;
      clearTrailing();
      return;
    }

    const now = performance.now();
    const elapsed = now - lastPublishedAtRef.current;
    if (minIntervalMs <= 0 || elapsed >= minIntervalMs) {
      clearTrailing();
      commitPending();
      return;
    }

    if (trailingTimeoutRef.current === null) {
      trailingTimeoutRef.current = setTimeout(() => {
        trailingTimeoutRef.current = null;
        commitPending();
      }, Math.max(0, minIntervalMs - elapsed));
    }
  }, [clearTrailing, commitPending, minIntervalMs]);

  useEffect(() => clearTrailing, [clearTrailing]);
  return publish;
};

'''
source = replace_once(source, 'interface UseGameLoopProps {\n', helper_code + 'interface UseGameLoopProps {\n', 'useGameLoop props insertion')
write(path, source)

# 2. Change-only HUD bridges.
change_only_state = {
    'src/games/AirHockeyGame.tsx': ['setHudState'],
    'src/games/AstroBlasterGame.tsx': ['setHasShield', 'setHasTripleShot'],
    'src/games/BubbleBusterGame.tsx': ['setHudState'],
    'src/games/FlappyAeroGame.tsx': ['setHudState'],
    'src/games/KnifeTargetGame.tsx': ['setHudState'],
    'src/games/PacMazeGame.tsx': ['setHudState'],
    'src/games/PinballGame.tsx': ['setHud'],
    'src/games/RoadCrossGame.tsx': ['setHudState'],
    'src/games/SlingshotGame.tsx': ['setIsLockedOn'],
}
for game_path, setters in change_only_state.items():
    ensure_hook_import(game_path, ['useRenderPublishedState'])
    for setter in setters:
        replace_state_hook(game_path, setter)

# 3. Continuous HUD bridges.
bounded_state = {
    'src/games/BladeGame.tsx': [('setHudState', 50)],
    'src/games/LaserRopeGame.tsx': [('setHudState', 80)],
    'src/games/RhythmGame.tsx': [('setHudStats', 100)],
    'src/games/TowerGame.tsx': [('setHudState', 100)],
    'src/games/DriftGame.tsx': [
        ('setScore', 100),
        ('setNitroEnergy', 100),
        ('setCurrentSpeedKmh', 100),
    ],
}
for game_path, policies in bounded_state.items():
    ensure_hook_import(game_path, ['useRenderPublishedState'])
    for setter, interval in policies:
        replace_state_hook(game_path, setter, interval)

# 4. Bound continuous parent score publication.
for game_path in [
    'src/games/DodgeGame.tsx',
    'src/games/DriftGame.tsx',
    'src/games/TowerGame.tsx',
]:
    ensure_hook_import(game_path, ['useRenderPublishedCallback'])
    insert_publish_score(game_path, 100)

# 5. Perfect Stop cursor: imperative frame-rate DOM update, no React state.
path = 'src/games/PerfectStopGame.tsx'
source = read(path)
source = replace_once(source, '  const [markerPos, setMarkerPos] = useState(0);\n', '', 'Perfect Stop marker React state')
source = replace_once(
    source,
    '  const markerPosRef = useRef(0); // 0 to 100\n',
    "  const markerPosRef = useRef(0); // 0 to 100\n  const markerElementRef = useRef<HTMLDivElement>(null);\n",
    'Perfect Stop marker element ref',
)
source = replace_once(
    source,
    '    markerPosRef.current = 0;\n    markerDirRef.current = 1;\n',
    "    markerPosRef.current = 0;\n    if (markerElementRef.current) markerElementRef.current.style.left = '0%';\n    markerDirRef.current = 1;\n",
    'Perfect Stop round marker reset',
)
source = replace_once(
    source,
    '        setMarkerPos(markerPosRef.current);\n',
    "        if (markerElementRef.current) {\n          markerElementRef.current.style.left = `${markerPosRef.current}%`;\n        }\n",
    'Perfect Stop per-frame state setter',
)
source = replace_once(
    source,
    '            <div\n              className="absolute top-0 bottom-0 w-3 -ml-1.5 transition-none flex flex-col items-center justify-between py-1 pointer-events-none"\n              style={{ left: `${markerPos}%` }}\n            >',
    '            <div\n              ref={markerElementRef}\n              className="absolute top-0 bottom-0 w-3 -ml-1.5 transition-none flex flex-col items-center justify-between py-1 pointer-events-none"\n              style={{ left: \'0%\' }}\n            >',
    'Perfect Stop marker JSX',
)
write(path, source)

# 6. Permanent static regression gate.
audit = r'''import { readFileSync, readdirSync } from 'node:fs';
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
'''
write('scripts/audit-hud-render-performance.ts', audit)

# 7. Package and release certification wiring.
path = 'package.json'
data = json.loads(read(path))
scripts = data['scripts']
if 'quality:hud-render' not in scripts:
    out = {}
    inserted = False
    for key, value in scripts.items():
        out[key] = value
        if key == 'quality:frame-rate':
            out['quality:hud-render'] = 'bun scripts/audit-hud-render-performance.ts'
            inserted = True
    if not inserted:
        raise SystemExit('package quality:frame-rate marker missing')
    data['scripts'] = out
write(path, json.dumps(data, indent=2) + '\n')

path = 'scripts/audit-release-32.ts'
source = read(path)
if "'quality:hud-render'" not in source:
    source = replace_once(
        source,
        "  'quality:frame-rate',\n",
        "  'quality:frame-rate',\n  'quality:hud-render',\n",
        'release quality gate list',
    )
if "'scripts/audit-hud-render-performance.ts'" not in source:
    source = replace_once(
        source,
        "  'scripts/audit-frame-rate-global.ts',\n",
        "  'scripts/audit-frame-rate-global.ts',\n  'scripts/audit-hud-render-performance.ts',\n",
        'release audit file list',
    )
write(path, source)

print('HUD/render-performance patch applied.')
