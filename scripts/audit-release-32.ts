import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const gamesDir = join(root, 'src', 'games');
const gameFiles = readdirSync(gamesDir)
  .filter((name) => name.endsWith('Game.tsx'))
  .sort();
const registry = read('src/data/games.ts');
const worker = read('worker/src/index.ts');
const pkg = JSON.parse(read('package.json')) as { description?: string; scripts?: Record<string, string> };
const readme = read('README.md');
const ci = read('.github/workflows/ci.yml');
const ma4 = read('scripts/audit-ma4.mjs');
const mobile = read('scripts/audit-mobile-runtime.ts');

const registryEntries = [...registry.matchAll(/^\s{4}id:\s*'([a-z0-9-]+)',[\s\S]*?component:\s*lazyGame\(\(\) => import\('\.\.\/games\/(\w+Game)'\)/gm)]
  .map((match) => ({ id: match[1], file: `${match[2]}.tsx` }));
const registryIds = registryEntries.map((entry) => entry.id);
const registryFiles = registryEntries.map((entry) => entry.file);
const workerRuleBlock = /Object\.fromEntries\(\s*\[([\s\S]*?)\]\.map\(\(id\)/.exec(worker)?.[1] ?? '';
const workerIds = [...workerRuleBlock.matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]);

assert(gameFiles.length === 32, `expected exactly 32 game source modules, found ${gameFiles.length}`);
assert(registryEntries.length === 32, `expected exactly 32 lazy registry entries, found ${registryEntries.length}`);
assert(new Set(registryIds).size === 32, 'registry contains duplicate game IDs');
assert(new Set(registryFiles).size === 32, 'registry contains duplicate game component files');
assert(workerIds.length === 32, `expected exactly 32 Worker accepted-game rules, found ${workerIds.length}`);
assert(new Set(workerIds).size === 32, 'Worker accepted-game list contains duplicate IDs');
assert((registry.match(/component:\s*lazyGame\(/g) ?? []).length === 32, 'registry is not fully lazy-loaded');
assert(!/from ['"]\.\.\/games\//.test(registry), 'registry contains an eager/static game import');

for (const file of gameFiles) {
  assert(registryFiles.includes(file), `${file} exists but is not registered`);
  const source = read(`src/games/${file}`);
  assert(/\bisPaused\b/.test(source), `${file} does not consume isPaused`);
  assert(/\bonGameOver\b/.test(source), `${file} does not use onGameOver`);
  assert(/\bonScoreUpdate\b/.test(source), `${file} does not use onScoreUpdate`);
  assert(!source.includes('transferControlToOffscreen'), `${file} requires OffscreenCanvas`);
  assert(!source.includes('new OffscreenCanvas'), `${file} constructs OffscreenCanvas directly`);
}

for (const { id, file } of registryEntries) {
  assert(gameFiles.includes(file), `${id} registers missing module ${file}`);
  assert(workerIds.includes(id), `${id} is missing from Worker GAME_RULES`);
}
for (const id of workerIds) {
  assert(registryIds.includes(id), `Worker accepts unregistered game ${id}`);
}

const expectedIds = [
  'orbit','stack','reaction','dodge','pulse','merge','typerush','oneline','breakout','perfectstop',
  'chain','gravity','blade','pinball','chrono','matrix','drift','vanguard','slingshot','snake',
  'rhythm','tower','pacmaze','flappyaero','roadcross','bubblebuster','astroblaster','laserrope',
  'blockdrop','knifetarget','airhockey','neonrail',
];
for (const id of expectedIds) {
  assert(registryIds.includes(id), `completed-roster game ${id} is missing from registry`);
}

const requiredQualityGates = [
  'quality:games',
  'quality:desktop',
  'quality:blade',
  'quality:pinball',
  'quality:chrono',
  'quality:shortcuts',
  'quality:pac',
  'quality:roadcross',
  'quality:typerush',
  'quality:oneline',
  'quality:gravity',
  'quality:slingshot',
  'quality:tower',
  'quality:astro',
  'quality:drift',
  'quality:vanguard',
  'quality:frame-rate',
  'quality:hud-render',
  'quality:gameplay-p0',
  'quality:gameplay-p1',
  'quality:gameplay-p2',
  'quality:gameplay-p4',
  'quality:gameplay-p5',
  'quality:gameplay-p6',
  'quality:gameplay-p7',
  'quality:gameplay-p8',
  'quality:gameplay-p9',
  'quality:gameplay-p10',
  'quality:gameplay-p11',
  'quality:browser-p3',
  'quality:lifecycle',
  'quality:mobile',
  'quality:rope',
  'quality:rope-feedback',
  'quality:rope-phase-c',
  'quality:blockdrop',
  'quality:knife',
  'quality:puck',
  'quality:rail',
  'quality:release32',
  'quality:hardening',
] as const;
for (const gate of requiredQualityGates) {
  assert(Boolean(pkg.scripts?.[gate]), `package.json is missing ${gate}`);
  assert(ci.includes(`bun run ${gate}`), `CI does not enforce ${gate}`);
}

const requiredAuditFiles = [
  'scripts/audit-desktop-coordinates.mjs',
  'scripts/audit-blade-trajectories.ts',
  'scripts/audit-pinball-physics.ts',
  'scripts/audit-chrono-reachability.ts',
  'scripts/audit-rhythm-shortcuts.ts',
  'scripts/audit-pac-controls.ts',
  'scripts/audit-road-cross.ts',
  'scripts/audit-type-rush.ts',
  'scripts/audit-one-line.ts',
  'scripts/audit-gravity.ts',
  'scripts/audit-slingshot.ts',
  'scripts/audit-tower.ts',
  'scripts/audit-astro.ts',
  'scripts/audit-drift.ts',
  'scripts/audit-vanguard.ts',
  'scripts/audit-frame-rate-global.ts',
  'scripts/audit-hud-render-performance.ts',
  'scripts/audit-gameplay-p0.ts',
  'scripts/audit-gameplay-p1.ts',
  'scripts/audit-gameplay-p2.ts',
  'scripts/audit-gameplay-p4.ts',
  'scripts/audit-gameplay-p5.ts',
  'scripts/audit-gameplay-p6.ts',
  'scripts/audit-gameplay-p7.ts',
  'scripts/audit-gameplay-p8.ts',
  'scripts/audit-gameplay-p9.ts',
  'scripts/audit-gameplay-p10.ts',
  'scripts/audit-gameplay-p11.ts',
  'scripts/audit-browser-gameplay-p3.mjs',
  'scripts/audit-game-lifecycle.ts',
  'scripts/audit-mobile-runtime.ts',
  'scripts/audit-laser-rope-presentation.ts',
  'scripts/audit-laser-rope-feedback.ts',
  'scripts/audit-laser-rope-phase-c.ts',
  'scripts/audit-block-drop-hold.ts',
  'scripts/audit-knife-target-aim.ts',
  'scripts/audit-air-hockey-layout.ts',
  'scripts/audit-neon-rail-shift.ts',
  'scripts/audit-repository-hardening.ts',
];
for (const path of requiredAuditFiles) {
  assert(existsSync(join(root, path)), `missing permanent regression audit ${path}`);
}

const workflowFiles = readdirSync(join(root, '.github', 'workflows')).sort();
assert(
  workflowFiles.length === 2 && workflowFiles[0] === 'ci.yml' && workflowFiles[1] === 'pages.yml',
  `temporary/unexpected workflows remain: ${workflowFiles.join(', ')}`,
);
const temporaryScripts = readdirSync(join(root, 'scripts')).filter((name) => /^(migrate|patch)-/i.test(name));
assert(temporaryScripts.length === 0, `temporary migration/patch scripts remain: ${temporaryScripts.join(', ')}`);

assert(pkg.description?.includes('32 instant-play browser arcade games') === true, 'package metadata does not advertise 32 games');
assert(readme.includes('collection of 32 instant-play mini-games'), 'README does not advertise the completed 32-game roster');
assert(ma4.includes('lazyGameCount !== 32'), 'MA4 lazy-game certification is not set to 32');
assert(ma4.includes('gameEntries.length !== 32'), 'MA4 built-game certification is not set to 32');
assert(mobile.includes('gameFiles.length === 32'), 'mobile runtime audit is not set to 32 games');
assert(registry.includes("id: 'neonrail'"), 'Neon Rail Shift registration is missing');
assert(worker.includes("'airhockey','neonrail'"), 'Neon Rail Shift Worker rule is missing');

if (errors.length) {
  console.error('FINAL 32-GAME RELEASE / REGRESSION AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('FINAL 32-GAME RELEASE / REGRESSION AUDIT — PASS');
console.log('32 source modules / 32 lazy registry entries / 32 Worker rules are in exact parity.');
console.log('All game contracts, permanent regression gates, repository hardening, roster metadata, mobile/MA4 counts, and cleanup constraints are certified.');
