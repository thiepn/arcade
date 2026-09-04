import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { P18_FIRST_RUN_HINT_IDS, P18_GAME_CLARITY_PROFILES } from '../src/lib/gameClarityProfiles';
import {
  RHYTHM_HIT_WINDOWS_MS,
  RHYTHM_LATENCY_MAX_MS,
  RHYTHM_LATENCY_MIN_MS,
  RHYTHM_MISS_WINDOW_MS,
} from '../src/lib/rhythmTiming';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const registry = read('src/data/games.ts');
const runtime = read('src/lib/gameClarityRuntime.ts');
const css = read('src/p18-clarity-accessibility.css');
const main = read('src/main.tsx');
const report = read('docs/P18_CLARITY_ACCESSIBILITY_CERTIFICATION.md');
const terminology = read('docs/P18_TERMINOLOGY_REGISTRY.md');
const p15 = read('docs/P15_ROSTER_AUDIT.md');
const p16 = read('docs/P16_BALANCE_CERTIFICATION.md');
const p17 = read('docs/P17_GAME_FEEL_CERTIFICATION.md');
const p17Runtime = read('src/lib/gameFeelRuntime.ts');
const browserAudit = read('scripts/audit-browser-gameplay-p18.mjs');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
const ci = read('.github/workflows/ci.yml');
const release = read('scripts/audit-release-32.ts');

const registryEntries = [...registry.matchAll(
  /^\s{4}id:\s*'([a-z0-9-]+)',\s*\n\s{4}title:\s*'([^']+)'[\s\S]*?^\s{4}instructions:\s*'([^']+)',\s*\n\s{4}controlsHint:\s*'([^']+)'/gm,
)].map((match) => ({ id: match[1], title: match[2], instructions: match[3], controlsHint: match[4] }));

assert(registryEntries.length === 32, `P18 expected 32 registry teaching entries, found ${registryEntries.length}`);
assert(P18_GAME_CLARITY_PROFILES.length === 32, `P18 expected 32 clarity profiles, found ${P18_GAME_CLARITY_PROFILES.length}`);
assert(new Set(P18_GAME_CLARITY_PROFILES.map((profile) => profile.id)).size === 32, 'P18 clarity profiles contain duplicate IDs');
assert(new Set(P18_GAME_CLARITY_PROFILES.map((profile) => profile.title)).size === 32, 'P18 clarity profiles contain duplicate titles');

for (const entry of registryEntries) {
  const profile = P18_GAME_CLARITY_PROFILES.find((candidate) => candidate.id === entry.id);
  assert(Boolean(profile), `P18 clarity profile missing ${entry.id}`);
  if (!profile) continue;
  assert(profile.title === entry.title, `P18 title mismatch for ${entry.id}: ${profile.title} vs ${entry.title}`);
  assert(profile.sourceControls === entry.controlsHint, `${entry.id} P18 sourceControls drifted from registry controlsHint`);
  assert(entry.instructions.trim().length >= 20, `${entry.id} legacy How To Play instruction is missing/too short`);
  assert(profile.objective.trim().length >= 20 && profile.objective.length <= 150, `${entry.id} objective is missing or too long`);
  assert(profile.essential.length >= 1 && profile.essential.length <= 3, `${entry.id} essential-control disclosure is missing or overloaded`);
  assert(profile.secondary.length <= 3, `${entry.id} secondary-control disclosure is overloaded`);
  assert(profile.masteryName.trim().length >= 3, `${entry.id} mastery terminology is missing`);
  assert(profile.mastery.trim().length >= 24, `${entry.id} mastery teaching path is missing`);
  assert(profile.danger.trim().length >= 12, `${entry.id} danger explanation is missing`);
  assert(profile.benefit.trim().length >= 12, `${entry.id} benefit explanation is missing`);
  assert(profile.failure.trim().length >= 12, `${entry.id} failure explanation is missing`);
  assert(profile.nextTry.trim().length >= 12, `${entry.id} next-attempt guidance is missing`);
  assert(profile.visualRedundancy.trim().length >= 20, `${entry.id} color-redundancy evidence is missing`);
}

const expectedTier1 = new Set(['stack','flappyaero','laserrope','pulse','reaction','perfectstop','typerush']);
const actualTier1 = new Set(P18_GAME_CLARITY_PROFILES.filter((profile) => profile.priority === 1).map((profile) => profile.id));
assert(actualTier1.size === expectedTier1.size && [...expectedTier1].every((id) => actualTier1.has(id)), 'P18 Tier 1 priority set changed');

const expectedHighSpeed = ['dodge','drift','vanguard','tower','flappyaero','roadcross','astroblaster','laserrope','neonrail'].sort();
const actualHighSpeed = P18_GAME_CLARITY_PROFILES.filter((profile) => profile.highSpeed).map((profile) => profile.id).sort();
assert(actualHighSpeed.join(',') === expectedHighSpeed.join(','), `P18 high-speed readability set changed: ${actualHighSpeed.join(',')}`);

assert(P18_FIRST_RUN_HINT_IDS.length > 0 && P18_FIRST_RUN_HINT_IDS.length <= 12, `P18 micro-hints must stay selective; found ${P18_FIRST_RUN_HINT_IDS.length}`);
for (const id of P18_FIRST_RUN_HINT_IDS) {
  const hint = P18_GAME_CLARITY_PROFILES.find((profile) => profile.id === id)?.firstRunHint ?? '';
  assert(hint.length >= 8 && hint.length <= 70, `${id} first-run hint is missing or too long`);
}

const canonicalMasteryTerms: Record<string, string> = {
  stack: 'Focus',
  reaction: 'Overtime',
  pulse: 'Sync Wager',
  oneline: 'Master Route',
  perfectstop: 'Master Encore',
  chain: 'Resonance',
  gravity: 'Flight Contracts',
  blade: 'Razor',
  chrono: 'Focus Wager',
  matrix: 'Overclock',
  drift: 'Style Routes',
  snake: 'Phase Thread',
  tower: 'Apex Drive',
  pacmaze: 'Hunt Rush',
  flappyaero: 'Flow Boost',
  bubblebuster: 'Burst',
  laserrope: 'Redline',
  blockdrop: 'B2B',
  knifetarget: 'Razor Marks',
  airhockey: 'Power Play',
  neonrail: 'Surge',
  dodge: 'Phase Cut',
};
for (const [id, term] of Object.entries(canonicalMasteryTerms)) {
  const profile = P18_GAME_CLARITY_PROFILES.find((candidate) => candidate.id === id);
  assert(Boolean(profile), `P18 mastery registry missing ${id}`);
  if (profile) assert(`${profile.masteryName} ${profile.mastery}`.includes(term), `${id} P18 mastery terminology drifted from ${term}`);
  assert(terminology.includes(`| ${id} |`) && terminology.includes(term), `P18 terminology document missing ${id}/${term}`);
}

// Shared runtime must improve shell semantics/teaching without changing game simulation.
assert(main.includes("import { installGameClarityRuntime } from './lib/gameClarityRuntime';"), 'main.tsx does not import P18 clarity runtime');
assert(main.includes("import './p18-clarity-accessibility.css';"), 'main.tsx does not import P18 styles');
assert(main.includes('installGameClarityRuntime();'), 'main.tsx does not install P18 clarity runtime');
assert(runtime.includes("shell.dataset.p18Clarity = 'ready'"), 'P18 runtime does not expose readiness state');
assert(runtime.includes("setAttribute('aria-label', `${state.profile.title} gameplay area."), 'P18 gameplay region lacks an accessible objective label');
assert(runtime.includes("overlay.setAttribute('role', 'dialog')"), 'P18 overlays are not given dialog semantics');
assert(runtime.includes("overlay.setAttribute('aria-modal', 'true')"), 'P18 overlays are not marked modal');
assert(runtime.includes("data-p18-clarity-panel" ) || runtime.includes('p18ClarityPanel'), 'P18 runtime does not create structured teaching content');
assert(runtime.includes('ESSENTIAL') && runtime.includes('SECONDARY') && runtime.includes('WATCH FOR'), 'P18 teaching hierarchy is incomplete');
assert(runtime.includes('FAILURE RULE') && runtime.includes('NEXT TRY'), 'P18 result guidance is incomplete');
assert(runtime.includes('localStorage') && runtime.includes('p18-hint'), 'P18 first-run hints are not persistence-bounded');
assert(runtime.includes("pointerdown") && runtime.includes('removeHint(state)'), 'P18 hints do not dismiss naturally on interaction');
assert(runtime.includes("event.key !== 'Tab'") || runtime.includes("event.key !== 'Tab'"), 'P18 dialog focus trap is missing');
assert(runtime.includes('state.observer.disconnect();'), 'P18 runtime does not disconnect per-shell MutationObserver');
assert(runtime.includes("window.removeEventListener('keydown'"), 'P18 runtime does not clean up key listeners');

for (const id of ['game-back-btn','game-restart-btn','game-pause-btn','game-sound-btn','game-fullscreen-btn','game-haptics-btn']) {
  assert(runtime.includes(id), `P18 accessible-name map missing ${id}`);
}
assert(runtime.includes("setAttribute('aria-label'"), 'P18 runtime does not assign accessible names');
assert(css.includes(':focus-visible'), 'P18 visible keyboard-focus treatment is missing');
assert(css.includes('min-height: 44px'), 'P18 coarse-pointer action targets do not approach 44px');
assert(css.includes('min-width: 42px') && css.includes('min-height: 42px'), 'P18 shell touch-target floor is missing');
assert(css.includes('@media (max-width: 420px)'), 'P18 narrow-text layout branch is missing');
assert(css.includes('@media (max-height: 620px)'), 'P18 short-viewport layout branch is missing');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'P18 reduced-motion teaching branch is missing');
assert(css.includes('overflow-y: auto'), 'P18 pause/result content cannot recover on short screens');

// P18 remains presentation/teaching-only. No game module may import it directly.
const gameFiles = readdirSync(join(root, 'src', 'games')).filter((name) => name.endsWith('Game.tsx'));
assert(gameFiles.length === 32, `P18 expected 32 game modules, found ${gameFiles.length}`);
for (const file of gameFiles) {
  const source = read(`src/games/${file}`);
  assert(!source.includes('gameClarityRuntime') && !source.includes('gameClarityProfiles'), `${file} couples gameplay simulation directly to P18 teaching runtime`);
}

// Preserve P15 grades and all P16/P17 contracts.
assert(p15.includes('- **S:** 5'), 'P15 S-rank count changed');
assert(p15.includes('- **A:** 20'), 'P15 A-rank count changed');
assert(p15.includes('- **B:** 7'), 'P15 B-rank count changed');
assert([...p16.matchAll(/^\|\s*[a-z0-9-]+\s*\|[^\n]*\|\s*PASS\s*\|$/gm)].length === 32, 'P16 no longer contains 32 balance PASS rows');
assert([...p17.matchAll(/^\|\s*[a-z0-9-]+\s*\|[^\n]*\|\s*PASS\s*\|$/gm)].length === 32, 'P17 no longer contains 32 feel PASS rows');
assert(p17Runtime.includes("export const P17_MAX_FEEDBACK_NODES = 8"), 'P17 feedback pool contract changed');
assert(pkg.scripts?.['quality:gameplay-p16'] === 'bun scripts/audit-gameplay-p16.ts', 'P16 permanent gate changed');
assert(pkg.scripts?.['quality:gameplay-p17'] === 'bun scripts/audit-gameplay-p17.ts', 'P17 permanent gate changed');

assert(RHYTHM_HIT_WINDOWS_MS.perfect === 70, 'Rhythm PERFECT window changed');
assert(RHYTHM_HIT_WINDOWS_MS.great === 125, 'Rhythm GREAT window changed');
assert(RHYTHM_HIT_WINDOWS_MS.good === 190, 'Rhythm GOOD window changed');
assert(RHYTHM_MISS_WINDOW_MS === 230, 'Rhythm MISS window changed');
assert(RHYTHM_LATENCY_MIN_MS === -200 && RHYTHM_LATENCY_MAX_MS === 200, 'Rhythm calibration bounds changed');

const reportRows = [...report.matchAll(/^\|\s*([a-z0-9-]+)\s*\|[^\n]*\|\s*PASS\s*\|$/gm)];
assert(reportRows.length === 32, `P18 certification matrix must contain 32 PASS rows, found ${reportRows.length}`);
for (const heading of [
  '## Shared teaching contract',
  '## 32-game certification matrix',
  '## Color and contrast',
  '## Touch, keyboard and modal focus',
  '## Reduced motion, muted audio and haptics',
  '## Manual new-player protocol',
  '## Expert readability protocol',
  '## Accessibility boundary',
  '## No grade inflation',
  '## Exit decision',
]) assert(report.includes(heading), `P18 report missing section ${heading}`);
assert(report.includes('does not claim full WCAG conformance'), 'P18 report lacks an explicit accessibility-claim boundary');

for (const id of registryEntries.map((entry) => entry.id)) assert(browserAudit.includes(`'${id}'`), `P18 browser audit missing ${id}`);
assert(browserAudit.includes("name: 'desktop'"), 'P18 browser audit missing desktop profile');
assert(browserAudit.includes("name: 'mobile'"), 'P18 browser audit missing 390px mobile profile');
assert(browserAudit.includes("name: 'small-mobile'"), 'P18 browser audit missing 320px small-mobile profile');
assert(browserAudit.includes("reducedMotion: 'reduce'"), 'P18 browser audit lacks reduced-motion coverage');
assert(browserAudit.includes('accessible shell labels'), 'P18 browser audit does not certify accessible shell labels');
assert(browserAudit.includes('pause teaching panel'), 'P18 browser audit does not certify structured pause teaching');
assert(browserAudit.includes('exit leaked P18'), 'P18 browser audit does not certify exit cleanup');

assert(pkg.scripts?.['quality:gameplay-p18'] === 'bun scripts/audit-gameplay-p18.ts', 'package.json missing permanent P18 source audit');
assert(pkg.scripts?.['quality:browser-p18'] === 'bun scripts/audit-browser-gameplay-p18.mjs', 'package.json missing permanent P18 browser audit');
assert(ci.includes('bun run quality:gameplay-p17\n      - run: bun run quality:gameplay-p18'), 'CI must run P18 immediately after P17');
assert(ci.includes('P18_CHROME_PATH="$chrome" bun run quality:browser-p18'), 'CI does not run P18 browser clarity certification');
assert(release.includes("'quality:gameplay-p18'"), 'release32 required gate list missing P18 source audit');
assert(release.includes("'quality:browser-p18'"), 'release32 required gate list missing P18 browser audit');
assert(release.includes("'scripts/audit-gameplay-p18.ts'"), 'release32 required audit file list missing P18 source audit');
assert(release.includes("'scripts/audit-browser-gameplay-p18.mjs'"), 'release32 required audit file list missing P18 browser audit');
assert(existsSync(join(root, 'docs', 'P18_TERMINOLOGY_REGISTRY.md')), 'P18 terminology registry is missing');

if (errors.length) {
  console.error('P18 CLARITY / TEACHING / ACCESSIBILITY CERTIFICATION — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P18 CLARITY / TEACHING / ACCESSIBILITY CERTIFICATION — PASS');
console.log('32/32 objectives, control maps, mastery teaching paths, failure explanations, visual-redundancy notes and responsive teaching profiles are structurally certified.');
console.log('Automation certifies objective source/runtime invariants only; subjective learnability and full accessibility remain manual acceptance activities.');
