import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const registry = read('src/data/games.ts');
const app = read('src/App.tsx');
const header = read('src/components/Header.tsx');
const shell = read('src/components/GameShell.tsx');
const p18Runtime = read('src/lib/gameClarityRuntime.ts');
const runtime = read('src/lib/arcadeCohesionRuntime.ts');
const css = read('src/p19-arcade-cohesion.css');
const main = read('src/main.tsx');
const report = read('docs/P19_ARCADE_COHESION_CERTIFICATION.md');
const p15 = read('docs/P15_ROSTER_AUDIT.md');
const p16 = read('docs/P16_BALANCE_CERTIFICATION.md');
const p17 = read('docs/P17_GAME_FEEL_CERTIFICATION.md');
const p18 = read('docs/P18_CLARITY_ACCESSIBILITY_CERTIFICATION.md');
const browserAudit = read('scripts/audit-browser-gameplay-p19.mjs');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string>; dependencies?: Record<string, string> };
const ci = read('.github/workflows/ci.yml');
const release = read('scripts/audit-release-32.ts');

const registryIds = [...registry.matchAll(/^\s{4}id:\s*'([a-z0-9-]+)',/gm)].map((match) => match[1]);
const gameFiles = readdirSync(join(root, 'src', 'games')).filter((name) => name.endsWith('Game.tsx'));

assert(registryIds.length === 32, `P19 expected 32 registered games, found ${registryIds.length}`);
assert(new Set(registryIds).size === 32, 'P19 registry contains duplicate IDs');
assert(gameFiles.length === 32, `P19 expected 32 game modules, found ${gameFiles.length}`);

// P19 is a product-level layer, never a game-simulation dependency.
for (const file of gameFiles) {
  const source = read(`src/games/${file}`);
  assert(!/arcadeCohesionRuntime|p19-arcade-cohesion|data-p19|p19-/.test(source), `${file} is coupled directly to P19 product cohesion`);
}

assert(main.includes("import { installArcadeCohesionRuntime } from './lib/arcadeCohesionRuntime';"), 'main.tsx does not import P19 cohesion runtime');
assert(main.includes("import './p19-arcade-cohesion.css';"), 'main.tsx does not import P19 cohesion stylesheet');
assert(main.includes('installArcadeCohesionRuntime();'), 'main.tsx does not install P19 cohesion runtime');

for (const marker of [
  "document.documentElement.dataset.p19Cohesion = 'ready'",
  "shell.dataset.p19Shell = 'canonical'",
  "p19-game-card",
  "p19-modal-overlay",
  "p19-loading-state",
  "p19-pause-overlay",
  "p19-result-overlay",
  "p19-action-primary",
  "p19-action-secondary",
  "p19-action-tertiary",
]) assert(runtime.includes(marker), `P19 runtime missing canonical marker ${marker}`);

assert(runtime.includes("button.textContent = 'BACK TO ARCADE'"), 'P19 pause exit terminology is not normalized to Back to Arcade');
assert(runtime.includes("dialog.setAttribute('inert', '')"), 'P19 modal-stack protection does not inert lower dialogs');
assert(runtime.includes("dialog.setAttribute('aria-hidden', 'true')"), 'P19 modal-stack protection does not hide lower dialogs from accessibility APIs');
assert(runtime.includes('new MutationObserver(decorate)'), 'P19 cohesion runtime does not discover lazy/shared surfaces');
assert(runtime.includes('observer?.disconnect();'), 'P19 cohesion runtime lacks observer cleanup');

// Preserve P18 landmarks used by its permanent browser/teaching certification.
for (const landmark of ["GAME PAUSED", "SESSION COMPLETE", "NEW HIGH SCORE!", "game-back-btn", "game-restart-btn", "game-pause-btn", "game-sound-btn", "game-fullscreen-btn"]) {
  assert(shell.includes(landmark), `P19 changed required P18/GameShell landmark ${landmark}`);
}
assert(p18Runtime.includes("normalise(node.textContent ?? '') === 'GAME PAUSED'"), 'P18 pause landmark contract changed');
assert(p18Runtime.includes("text === 'SESSION COMPLETE' || text === 'NEW HIGH SCORE!'"), 'P18 result landmark contract changed');

// Header/product semantics: the brand must be a real control, not a clickable generic element.
assert(/<button[\s\S]{0,200}id="brand-logo-btn"/.test(header), 'P19 brand identity is not implemented as a native button');
assert(!/<div[\s\S]{0,120}id="brand-logo-btn"/.test(header), 'clickable brand div remains after P19');
for (const id of ['search-toggle-btn','sound-toggle-btn','stats-open-btn','header-leaderboards-pill-btn','header-rank-badge-btn']) {
  assert(header.includes(`id="${id}"`), `P19 header lost shared control ${id}`);
}
assert(header.includes('aria-label="Open global leaderboards"'), 'P19 leaderboard utility lacks an explicit accessible name');
assert(header.includes("aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}"), 'P19 home sound utility does not expose state in its accessible name');

// CSS contract: shared geometry, focus, mobile and reduced-motion branches must exist.
for (const marker of [
  '--p19-control-size',
  '.p19-game-card',
  '.p19-icon-button',
  '.p19-modal-overlay',
  '.p19-modal-panel',
  '.p19-loading-panel',
  '.p19-action-primary',
  '.p19-action-secondary',
  '.p19-action-tertiary',
  '@media (pointer: coarse)',
  '@media (max-width: 420px)',
  '@media (max-height: 620px)',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
]) assert(css.includes(marker), `P19 stylesheet missing ${marker}`);
assert(css.includes('min-height: 2.75rem'), 'P19 canonical actions do not retain a 44px practical touch target');

// No replay platform or new retention/meta platform may enter application code in P19.
const forbiddenIdentifiers = [
  'ReplayPlayer', 'ReplayRecorder', 'ReplayViewer', 'GhostRun', 'RunRecording', 'PlaybackTimeline',
  'InputRecording', 'RunHistory', 'ReplayExport', 'DailyChallenge', 'WeeklyChallenge', 'BattlePass',
  'CurrencyWallet', 'XpSystem', 'XPSystem', 'LoginReward', 'RewardCalendar',
];
const applicationFiles = [
  'src/App.tsx',
  'src/components/ErrorBoundary.tsx',
  'src/components/FilterBar.tsx',
  'src/components/GameCard.tsx',
  'src/components/GameShell.tsx',
  'src/components/Header.tsx',
  'src/components/Hero.tsx',
  'src/components/OverallLeaderboardModal.tsx',
  'src/components/PlayerProfileModal.tsx',
  'src/components/PwaStatus.tsx',
  'src/components/RecentlyPlayedSection.tsx',
  'src/components/StatsModal.tsx',
  'src/lib/arcadeCohesionRuntime.ts',
];
for (const path of applicationFiles) {
  const source = read(path);
  for (const identifier of forbiddenIdentifiers) assert(!source.includes(identifier), `${path} introduces prohibited P19 system ${identifier}`);
}

// P19 must not grow the dependency surface just to achieve cohesion.
const dependencyNames = Object.keys(pkg.dependencies ?? {}).sort();
assert(dependencyNames.join(',') === ['canvas-confetti','lucide-react','motion','react','react-dom'].sort().join(','), `P19 dependency surface changed: ${dependencyNames.join(', ')}`);

// Preserve prior roster/balance/feel/clarity contracts and historical grades.
assert(p15.includes('- **S:** 5'), 'P15 S-rank count changed');
assert(p15.includes('- **A:** 20'), 'P15 A-rank count changed');
assert(p15.includes('- **B:** 7'), 'P15 B-rank count changed');
assert([...p16.matchAll(/^\|\s*[a-z0-9-]+\s*\|[^\n]*\|\s*PASS\s*\|$/gm)].length === 32, 'P16 no longer contains 32 balance PASS rows');
assert([...p17.matchAll(/^\|\s*[a-z0-9-]+\s*\|[^\n]*\|\s*PASS\s*\|$/gm)].length === 32, 'P17 no longer contains 32 feel PASS rows');
assert([...p18.matchAll(/^\|\s*[a-z0-9-]+\s*\|[^\n]*\|\s*PASS\s*\|$/gm)].length === 32, 'P18 no longer contains 32 clarity PASS rows');
assert(pkg.scripts?.['quality:gameplay-p18'] === 'bun scripts/audit-gameplay-p18.ts', 'P18 permanent source gate changed');
assert(pkg.scripts?.['quality:browser-p18'] === 'bun scripts/audit-browser-gameplay-p18.mjs', 'P18 permanent browser gate changed');

// P19 documentation must cover the complete roster and state its manual/aesthetic boundary.
const reportRows = [...report.matchAll(/^\|\s*([a-z0-9-]+)\s*\|[^\n]*\|\s*PASS\s*\|$/gm)];
assert(reportRows.length === 32, `P19 certification matrix must contain 32 PASS rows, found ${reportRows.length}`);
for (const id of registryIds) assert(reportRows.some((row) => row[1] === id), `P19 report missing roster row ${id}`);
for (const heading of [
  '## Explicit non-goals',
  '## Product identity contract',
  '## Design-system contract',
  '## Shared component inventory',
  '## Shell contract',
  '## Card contract',
  '## Modal contract',
  '## Result contract',
  '## Loading, empty and recovery states',
  '## Responsive contract',
  '## Navigation contract',
  '## Accessibility continuity',
  '## Manual product-cohesion protocol',
  '## No grade inflation',
  '## Exit decision',
]) assert(report.includes(heading), `P19 report missing section ${heading}`);
assert(report.includes('P19 contains no previous-run playback facility'), 'P19 report does not explicitly reject run playback');
assert(report.includes('Automation verifies DOM/runtime invariants, not taste'), 'P19 report lacks manual aesthetic acceptance boundary');

// Permanent source/browser wiring.
assert(pkg.scripts?.['quality:gameplay-p19'] === 'bun scripts/audit-gameplay-p19.ts', 'package.json missing permanent P19 source audit');
assert(pkg.scripts?.['quality:browser-p19'] === 'bun scripts/audit-browser-gameplay-p19.mjs', 'package.json missing permanent P19 browser audit');
assert(ci.includes('bun run quality:gameplay-p18\n      - run: bun run quality:gameplay-p19'), 'CI must run P19 immediately after P18');
assert(ci.includes('P19_CHROME_PATH="$chrome" bun run quality:browser-p19'), 'CI does not run P19 browser cohesion certification');
assert(release.includes("'quality:gameplay-p19'"), 'release32 required gate list missing P19 source audit');
assert(release.includes("'quality:browser-p19'"), 'release32 required gate list missing P19 browser audit');
assert(release.includes("'scripts/audit-gameplay-p19.ts'"), 'release32 required audit file list missing P19 source audit');
assert(release.includes("'scripts/audit-browser-gameplay-p19.mjs'"), 'release32 required audit file list missing P19 browser audit');
assert(existsSync(join(root, 'docs', 'P19_ARCADE_COHESION_CERTIFICATION.md')), 'P19 certification document is missing');
assert(existsSync(join(root, 'src', 'lib', 'arcadeCohesionRuntime.ts')), 'P19 cohesion runtime is missing');
assert(existsSync(join(root, 'src', 'p19-arcade-cohesion.css')), 'P19 cohesion stylesheet is missing');

for (const id of registryIds) assert(browserAudit.includes(`'${id}'`), `P19 browser audit missing ${id}`);
for (const profile of ["name: 'desktop'", "name: 'mobile'", "name: 'small-mobile'"]) assert(browserAudit.includes(profile), `P19 browser audit missing ${profile}`);
assert(browserAudit.includes('home card contract'), 'P19 browser audit does not certify the arcade home card contract');
assert(browserAudit.includes('navigation stress'), 'P19 browser audit does not certify cross-game navigation stress');
assert(browserAudit.includes('settings persistence'), 'P19 browser audit does not certify shared settings persistence');
assert(browserAudit.includes('orientation recovery'), 'P19 browser audit does not certify viewport/orientation recovery');
assert(browserAudit.includes('exit leaked P19'), 'P19 browser audit does not certify P19 cleanup');

// Existing App architecture/features remain present rather than being replaced with a P19 metagame.
assert(app.includes('<RecentlyPlayedSection'), 'P19 unexpectedly removed the existing recent-games surface');
assert(app.includes('<StatsModal'), 'P19 unexpectedly removed the existing stats/settings surface');
assert(app.includes('<OverallLeaderboardModal'), 'P19 unexpectedly removed the existing leaderboard surface');
assert(app.includes('<PlayerProfileModal'), 'P19 unexpectedly removed the existing profile surface');

if (errors.length) {
  console.error('P19 ARCADE COHESION CERTIFICATION — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P19 ARCADE COHESION CERTIFICATION — PASS');
console.log('32/32 games retain one canonical shell/card/pause/result product contract while game simulation remains isolated from P19.');
console.log('No replay, challenge, currency or new retention platform is introduced; subjective aesthetic cohesion remains a manual acceptance activity.');
