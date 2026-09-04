import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { P17_GAME_FEEL_PROFILES, P17_HIGH_SPEED_GAME_IDS } from '../src/lib/gameFeelProfiles';
import { P17_FEEDBACK_EVENT, P17_MAX_FEEDBACK_NODES } from '../src/lib/gameFeelRuntime';
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
const report = read('docs/P17_GAME_FEEL_CERTIFICATION.md');
const p15 = read('docs/P15_ROSTER_AUDIT.md');
const p16 = read('docs/P16_BALANCE_CERTIFICATION.md');
const runtime = read('src/lib/gameFeelRuntime.ts');
const css = read('src/p17-game-feel.css');
const main = read('src/main.tsx');
const motionPreferences = read('src/lib/motionPreferences.ts');
const haptics = read('src/lib/haptics.ts');
const sound = read('src/lib/sound.ts');
const browserAudit = read('scripts/audit-browser-gameplay-p17.mjs');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
const ci = read('.github/workflows/ci.yml');
const release = read('scripts/audit-release-32.ts');

const registryEntries = [...registry.matchAll(
  /^\s{4}id:\s*'([a-z0-9-]+)',\s*\n\s{4}title:\s*'([^']+)'/gm,
)].map((match) => ({ id: match[1], title: match[2] }));
assert(registryEntries.length === 32, `P17 expected 32 registry games, found ${registryEntries.length}`);

assert(P17_GAME_FEEL_PROFILES.length === 32, `P17 expected 32 feel profiles, found ${P17_GAME_FEEL_PROFILES.length}`);
assert(new Set(P17_GAME_FEEL_PROFILES.map((profile) => profile.id)).size === 32, 'P17 feel profiles contain duplicate IDs');
assert(new Set(P17_GAME_FEEL_PROFILES.map((profile) => profile.title)).size === 32, 'P17 feel profiles contain duplicate titles');
for (const entry of registryEntries) {
  const profile = P17_GAME_FEEL_PROFILES.find((candidate) => candidate.id === entry.id);
  assert(Boolean(profile), `P17 feel profile missing ${entry.id}`);
  if (!profile) continue;
  assert(profile.title === entry.title, `P17 title mismatch for ${entry.id}: ${profile.title} vs ${entry.title}`);
  assert(profile.identity.trim().length >= 6, `${entry.id} has an empty/weak identity profile`);
  assert(profile.ordinary.trim().length >= 12, `${entry.id} lacks ordinary feedback intent`);
  assert(profile.mastery.trim().length >= 12, `${entry.id} lacks mastery feedback intent`);
  assert(profile.failure.trim().length >= 12, `${entry.id} lacks failure feedback intent`);
  assert(css.includes(`[data-p17-game="${entry.id}"]`), `P17 CSS identity selector missing ${entry.id}`);
}

const expectedTier1 = new Set(['stack','reaction','pulse','oneline','perfectstop','gravity','matrix','slingshot','blockdrop']);
const actualTier1 = new Set(P17_GAME_FEEL_PROFILES.filter((profile) => profile.priority === 1).map((profile) => profile.id));
assert(actualTier1.size === expectedTier1.size && [...expectedTier1].every((id) => actualTier1.has(id)), 'P17 Tier 1 priority set changed');

const expectedHighSpeed = [
  'dodge','drift','vanguard','tower','flappyaero','roadcross','astroblaster','laserrope','neonrail',
].sort();
assert(
  [...P17_HIGH_SPEED_GAME_IDS].sort().join(',') === expectedHighSpeed.join(','),
  `P17 high-speed readability set changed: ${[...P17_HIGH_SPEED_GAME_IDS].sort().join(',')}`,
);

const reportRows = [...report.matchAll(
  /^\|\s*([a-z0-9-]+)\s*\|\s*([^|]+?)\s*\|[^\n]*\|\s*PASS\s*\|$/gm,
)].map((match) => ({ id: match[1], title: match[2].trim() }));
assert(reportRows.length === 32, `P17 certification matrix must contain exactly 32 PASS rows, found ${reportRows.length}`);
assert(new Set(reportRows.map((row) => row.id)).size === 32, 'P17 certification matrix contains duplicate IDs');
for (const entry of registryEntries) {
  const row = reportRows.find((candidate) => candidate.id === entry.id);
  assert(Boolean(row), `P17 certification matrix missing ${entry.id}`);
  if (row) assert(row.title === entry.title, `P17 certification title mismatch for ${entry.id}`);
}

for (const heading of [
  '## Shared implementation contract',
  '## 32-game certification matrix',
  '## Rhythm timing preservation',
  '## High-speed readability set',
  '## Performance, mobile and cleanup',
  '## Audio and haptics',
  '## Human-experience acceptance checklist',
  '## No grade inflation',
  '## Exit decision',
]) {
  assert(report.includes(heading), `P17 report missing section ${heading}`);
}

// P17 must preserve the pre-promotion grading baseline rather than editing P15.
assert(p15.includes('- **S:** 5'), 'P15 S-rank count changed');
assert(p15.includes('- **A:** 20'), 'P15 A-rank count changed');
assert(p15.includes('- **B:** 7'), 'P15 B-rank count changed');
assert(report.includes('- **S: 5**') && report.includes('- **A: 20**') && report.includes('- **B: 7**'), 'P17 report does not preserve P15 grade distribution');

// P16 pacing/fairness remains authoritative and all 32 rows remain certified.
const p16PassRows = [...p16.matchAll(/^\|\s*[a-z0-9-]+\s*\|[^\n]*\|\s*PASS\s*\|$/gm)];
assert(p16PassRows.length === 32, `P16 balance report no longer has 32 PASS rows: ${p16PassRows.length}`);
assert(pkg.scripts?.['quality:gameplay-p16'] === 'bun scripts/audit-gameplay-p16.ts', 'P16 permanent gate changed');

// Rhythm is presentation-only: the exact P14/P16 timing contract may not move.
assert(RHYTHM_HIT_WINDOWS_MS.perfect === 70, 'Rhythm PERFECT window changed');
assert(RHYTHM_HIT_WINDOWS_MS.great === 125, 'Rhythm GREAT window changed');
assert(RHYTHM_HIT_WINDOWS_MS.good === 190, 'Rhythm GOOD window changed');
assert(RHYTHM_MISS_WINDOW_MS === 230, 'Rhythm MISS window changed');
assert(RHYTHM_LATENCY_MIN_MS === -200 && RHYTHM_LATENCY_MAX_MS === 200, 'Rhythm calibration bounds changed');

// Bounded shared runtime: no per-event DOM allocation and no pointer interception.
assert(P17_MAX_FEEDBACK_NODES === 8, `P17 feedback pool changed from 8 to ${P17_MAX_FEEDBACK_NODES}`);
assert(P17_FEEDBACK_EVENT === 'arcade:p17-feedback', 'P17 explicit feedback bridge name changed');
assert(runtime.includes('Array.from({ length: P17_MAX_FEEDBACK_NODES }'), 'P17 runtime no longer creates a fixed feedback pool');
assert(runtime.includes('state.layer.remove();'), 'P17 runtime does not remove its feedback layer during cleanup');
assert(runtime.includes('state.observer.disconnect();'), 'P17 runtime does not disconnect per-shell MutationObserver');
assert(runtime.includes('pruneDetachedShells();'), 'P17 runtime does not prune exited game shells');
assert(runtime.includes('if (!emitBurst(state, kind)) continue;'), 'P17 semantic feedback does not share the bounded cooldown gate');
assert(!runtime.includes('appendChild(document.createElement') && !runtime.includes('createElement(\'span\')\n    state.stage.appendChild'), 'P17 runtime appears to allocate feedback nodes per event');
assert(css.includes('pointer-events: none'), 'P17 feedback layer can intercept pointer input');
assert(css.includes('overflow: hidden'), 'P17 feedback layer is not clipped to game stage');
assert(css.includes('contain: layout paint'), 'P17 feedback layer lacks layout/paint containment');
assert(css.includes('High-speed games use smaller'), 'P17 high-speed readability branch is missing');
assert(css.includes('Reduced motion retains information'), 'P17 reduced-motion information replacement is missing');
assert(css.includes('html[data-p17-motion="reduced"]'), 'P17 explicit reduced-motion branch is missing');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'P17 OS reduced-motion media query is missing');
assert(motionPreferences.includes("dataset.p17Motion === 'reduced'"), 'canvas games cannot consume the global reduced-motion state');

// Main installation must be global. Gameplay remains uncoupled except for the narrow reduced-motion guard.
assert(main.includes("import { installGameFeelRuntime } from './lib/gameFeelRuntime';"), 'main.tsx does not import P17 runtime');
assert(main.includes("import './p17-game-feel.css';"), 'main.tsx does not import P17 styles');
assert(main.includes('installGameFeelRuntime();'), 'main.tsx does not install P17 runtime');
const gameFiles = readdirSync(join(root, 'src', 'games')).filter((name) => name.endsWith('Game.tsx'));
assert(gameFiles.length === 32, `P17 expected 32 game modules, found ${gameFiles.length}`);
const unguardedCanvasMotion: string[] = [];
const canvasShakeFiles: string[] = [];
for (const file of gameFiles) {
  const source = read(`src/games/${file}`);
  assert(!source.includes('gameFeelRuntime'), `${file} couples gameplay simulation directly to P17 feedback runtime`);

  // Distinguish actual camera-shake transforms from ordinary object transforms.
  // Vanguard, for example, stores screenShake state but currently only uses
  // ctx.translate for enemy rendering, so it must not receive a fake guard.
  const translateUsesShake = /ctx\.translate\s*\([^;]{0,220}shake/i.test(source);
  const shakeBranchTranslates = /if\s*\([^)]*shake[^)]*\)\s*\{[\s\S]{0,360}?ctx\.translate\s*\(/i.test(source);
  const hasCanvasShake = translateUsesShake || shakeBranchTranslates;
  if (hasCanvasShake) {
    canvasShakeFiles.push(file);
    if (!source.includes('isArcadeReducedMotion')) unguardedCanvasMotion.push(file);
  }
}
assert(
  canvasShakeFiles.length === 17,
  `P17 expected 17 real canvas camera-shake games, found ${canvasShakeFiles.length}: ${canvasShakeFiles.join(', ')}`,
);
assert(
  unguardedCanvasMotion.length === 0,
  `canvas camera-shake games lack P17 reduced-motion guard: ${unguardedCanvasMotion.join(', ')}`,
);

// Reuse the existing lightweight audio/haptic architecture; do not add heavy media loops.
assert(haptics.includes('lastScoreVibrateTime') && haptics.includes('> 75'), 'ordinary haptic score throttling changed');
assert(haptics.includes("typeof navigator.vibrate === 'function'"), 'haptics no longer degrade safely when unsupported');
assert(sound.includes('AudioContext') && sound.includes('masterGain'), 'shared Web Audio engine is missing');
assert(!sound.includes('new Audio(') && !sound.includes('HTMLAudioElement'), 'P17 audio architecture regressed to long-lived media elements');

// P17 browser audit must cover all 32 games in full-motion desktop and reduced-motion touch mobile.
for (const id of registryEntries.map((entry) => entry.id)) {
  assert(browserAudit.includes(`'${id}'`), `P17 browser audit missing ${id}`);
}
assert(browserAudit.includes("name: 'desktop-full'"), 'P17 browser audit missing full-motion desktop profile');
assert(browserAudit.includes("name: 'mobile-reduced'"), 'P17 browser audit missing reduced-motion mobile profile');
assert(browserAudit.includes("reducedMotion: 'reduce'"), 'P17 browser audit does not request reduced motion');
assert(browserAudit.includes('burstCount === 8'), 'P17 browser audit does not certify bounded feedback pool');
assert(browserAudit.includes('exit leaked P17 shell/layer'), 'P17 browser audit does not certify exit cleanup');

// Permanent gate wiring.
assert(pkg.scripts?.['quality:gameplay-p17'] === 'bun scripts/audit-gameplay-p17.ts', 'package.json missing permanent P17 source audit');
assert(pkg.scripts?.['quality:browser-p17'] === 'bun scripts/audit-browser-gameplay-p17.mjs', 'package.json missing permanent P17 browser audit');
assert(ci.includes('bun run quality:gameplay-p16\n      - run: bun run quality:gameplay-p17'), 'CI must run P17 immediately after P16');
assert(ci.includes('P17_CHROME_PATH="$chrome" bun run quality:browser-p17'), 'CI does not run P17 browser feel certification');
assert(release.includes("'quality:gameplay-p17'"), 'release32 required gate list missing P17 source audit');
assert(release.includes("'quality:browser-p17'"), 'release32 required gate list missing P17 browser audit');
assert(release.includes("'scripts/audit-gameplay-p17.ts'"), 'release32 required audit file list missing P17 source audit');
assert(release.includes("'scripts/audit-browser-gameplay-p17.mjs'"), 'release32 required audit file list missing P17 browser audit');

if (errors.length) {
  console.error('P17 GAME FEEL / FEEDBACK CERTIFICATION — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P17 GAME FEEL / FEEDBACK CERTIFICATION — PASS');
console.log('32/32 games have explicit feel profiles and certification rows; bounded shared feedback, 17 guarded canvas-shake paths, CSS reduced motion, mobile/runtime cleanup and grade/timing preservation are enforced.');
console.log('Subjective real-device feel remains a manual acceptance activity and is not represented as an automated fun score.');
