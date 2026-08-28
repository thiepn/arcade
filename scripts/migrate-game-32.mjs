import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value);
const replaceOnce = (source, search, replacement, label) => {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label} match, found ${count}`);
  return source.replace(search, replacement);
};

// 1. Register the 32nd game as a lazy-loaded entry.
{
  const path = 'src/data/games.ts';
  let source = read(path);
  if (!source.includes("id: 'neonrail'")) {
    const insertionPoint = source.lastIndexOf('\n];');
    if (insertionPoint < 0) throw new Error('Unable to locate end of GAMES_REGISTRY');
    const entry = `
  {
    id: 'neonrail',
    title: 'Neon Rail Shift',
    tagline: 'Read the safe rail, shift fast, and phase through danger.',
    description: 'A three-rail cyber reflex runner with reachable barrier patterns, collectible energy cores, escalating speed, streak scoring, and a timed Phase shield.',
    category: 'Reflex',
    sessionLength: '1–3 min',
    accentColor: '#22d3ee',
    accentGlow: 'rgba(34, 211, 238, 0.4)',
    accentBg: 'rgba(34, 211, 238, 0.1)',
    instructions: 'Shift between the three rails to follow green cores and avoid red barriers. Use Phase to break through one dangerous crossing while it is active.',
    controlsHint: 'A / D • Arrow Keys • Tap Lane • Space: Phase',
    icon: 'Activity',
    component: lazyGame(() => import('../games/NeonRailShiftGame').then(({ NeonRailShiftGame }) => ({ default: NeonRailShiftGame }))),
  },`;
    source = source.slice(0, insertionPoint) + entry + source.slice(insertionPoint);
    write(path, source);
  }
}

// 2. Keep Cloudflare accepted-game parity.
{
  const path = 'worker/src/index.ts';
  let source = read(path);
  source = replaceOnce(
    source,
    "'blockdrop','knifetarget','airhockey',",
    "'blockdrop','knifetarget','airhockey','neonrail',",
    'Worker game roster',
  );
  write(path, source);
}

// 3. Raise release/lazy-load certification to 32 games.
{
  const path = 'scripts/audit-ma4.mjs';
  let source = read(path);
  source = replaceOnce(source, 'lazyGameCount !== 31', 'lazyGameCount !== 32', 'MA4 lazy count condition');
  source = replaceOnce(source, 'Expected 31 lazy game components', 'Expected 32 lazy game components', 'MA4 lazy count message');
  source = replaceOnce(source, 'gameEntries.length !== 31', 'gameEntries.length !== 32', 'MA4 build count condition');
  source = replaceOnce(source, 'expected 31 built game entries', 'expected 32 built game entries', 'MA4 build count message');
  source = replaceOnce(source, 'MA4 audit passed: 31 lazy games', 'MA4 audit passed: 32 lazy games', 'MA4 success message');
  write(path, source);
}

// 4. Raise cross-game mobile certification to 32 modules.
{
  const path = 'scripts/audit-mobile-runtime.ts';
  let source = read(path);
  source = replaceOnce(source, 'gameFiles.length === 31', 'gameFiles.length === 32', 'mobile module count condition');
  source = replaceOnce(source, 'expected 31 game modules', 'expected 32 game modules', 'mobile module count message');
  write(path, source);
}

// 5. Expose a permanent rail audit and current product count.
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  pkg.scripts['quality:rail'] = 'bun scripts/audit-neon-rail-shift.ts';
  pkg.description = 'A polished, installable collection of 32 instant-play browser arcade games.';
  write(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

// 6. Update public documentation while preserving the historical 1.0.0 31-game note.
{
  const path = 'README.md';
  let source = read(path);
  source = replaceOnce(
    source,
    'collection of 31 instant-play mini-games',
    'collection of 32 instant-play mini-games',
    'README game count',
  );
  write(path, source);
}

{
  const path = 'CHANGELOG.md';
  let source = read(path);
  if (!source.includes('Added Neon Rail Shift as the 32nd game')) {
    const marker = '\n## 1.0.0 — 2026-08-28';
    if (!source.includes(marker)) throw new Error('Unable to locate changelog release marker');
    source = source.replace(
      marker,
      '\n- Added Neon Rail Shift as the 32nd game: a responsive three-rail reflex runner with certified reachable barrier sequences, safe-lane core guidance, streak scoring, progressive speed, touch/keyboard lane switching, and a cooldown-based Phase shield.\n' + marker,
    );
    write(path, source);
  }
}

console.log('Registered Neon Rail Shift as game 32 and updated Worker, mobile, MA4, package, README, and changelog roster metadata.');
