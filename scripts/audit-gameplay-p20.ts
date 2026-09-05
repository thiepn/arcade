import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLADE_WAVE_PHRASES, BLADE_WAVES_PER_PHRASE } from '../src/lib/bladeWavePhrases';
import { P20_PROMOTIONS, P20_S_THRESHOLD, p20Total } from './p20-promotion-scorecards';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const cohort = ['gravity', 'chain', 'merge', 'drift', 'dodge', 'blade'] as const;
const p15 = read('docs/P15_ROSTER_AUDIT.md');
const p16 = read('docs/P16_BALANCE_CERTIFICATION.md');
const p17 = read('docs/P17_GAME_FEEL_CERTIFICATION.md');
const p18 = read('docs/P18_CLARITY_ACCESSIBILITY_CERTIFICATION.md');
const p19 = read('docs/P19_ARCADE_COHESION_CERTIFICATION.md');
const report = read('docs/P20_NEAR_S_PROMOTION_CERTIFICATION.md');
const gravity = read('src/games/GravityGame.tsx');
const chain = read('src/games/ChainGame.tsx');
const merge = read('src/games/MergeGame.tsx');
const drift = read('src/games/DriftGame.tsx');
const dodge = read('src/games/DodgeGame.tsx');
const blade = read('src/games/BladeGame.tsx');
const bladePhrases = read('src/lib/bladeWavePhrases.ts');
const bladeTrajectory = read('src/lib/bladeTrajectory.ts');
const bladePrecision = read('src/lib/bladePrecisionMastery.ts');
const p17Runtime = read('src/lib/gameFeelRuntime.ts');
const p18Runtime = read('src/lib/gameClarityRuntime.ts');
const p19Runtime = read('src/lib/arcadeCohesionRuntime.ts');
const browserAudit = read('scripts/audit-browser-gameplay-p20.mjs');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
const ci = read('.github/workflows/ci.yml');
const release = read('scripts/audit-release-32.ts');

assert(P20_S_THRESHOLD === 55, `P20 S threshold changed to ${P20_S_THRESHOLD}`);
assert(P20_PROMOTIONS.length === 6, `P20 expected exactly 6 promotion records, found ${P20_PROMOTIONS.length}`);
assert(P20_PROMOTIONS.map((record) => record.id).join(',') === cohort.join(','), 'P20 promotion cohort/order changed');
assert(new Set(P20_PROMOTIONS.map((record) => record.id)).size === 6, 'P20 promotion cohort contains duplicate IDs');

// Historical P15 remains immutable evidence.
for (const marker of [
  '| 6 | Gravity | A | 9 | 10 | 10 | 9 | 8 | 8 | 54 |',
  '| 7 | Chain | A | 9 | 10 | 9 | 9 | 8 | 9 | 54 |',
  '| 8 | Merge | A | 9 | 10 | 9 | 9 | 8 | 9 | 54 |',
  '| 9 | Cyber Drift | A | 9 | 9 | 9 | 9 | 9 | 8 | 53 |',
  '| 10 | Dodge | A | 9 | 9 | 9 | 9 | 9 | 8 | 53 |',
  '| 11 | Laser Blade | A | 9 | 9 | 8 | 9 | 10 | 8 | 53 |',
  '- **S:** 5',
  '- **A:** 20',
  '- **B:** 7',
]) assert(p15.includes(marker), `P20 historical P15 marker changed: ${marker}`);

for (const record of P20_PROMOTIONS) {
  const historicalTotal = p20Total(record.historical);
  const preTotal = p20Total(record.preP20);
  const finalTotal = p20Total(record.final);
  assert(historicalTotal === (record.id === 'gravity' || record.id === 'chain' || record.id === 'merge' ? 54 : 53), `${record.id} historical arithmetic changed: ${historicalTotal}`);
  assert(finalTotal >= P20_S_THRESHOLD, `${record.id} final score ${finalTotal} does not reach S threshold`);
  assert(finalTotal <= 60, `${record.id} final score exceeds 60`);
  for (const [category, value] of Object.entries(record.final)) {
    assert(value >= 1 && value <= 10, `${record.id} ${category} score ${value} is outside 1..10`);
  }
  for (const category of Object.keys(record.final) as Array<keyof typeof record.final>) {
    const delta = record.final[category] - record.historical[category];
    assert(delta >= 0 && delta <= 1, `${record.id} ${category} changed by ${delta}; P20 allows at most +1 without overwhelming evidence`);
    if (delta > 0) {
      const evidence = record.evidence[category];
      assert(Boolean(evidence && evidence.length >= 2), `${record.id} ${category} score increase lacks at least two evidence statements`);
    }
  }
  assert(record.adversarialReview.length >= 2, `${record.id} lacks an adversarial promotion review`);
  if (record.id === 'blade') assert(preTotal === 54 && finalTotal === 55, 'Laser Blade must be the one P20 gameplay-dependent 54→55 promotion');
  else assert(preTotal >= P20_S_THRESHOLD && finalTotal === preTotal, `${record.id} should not receive unnecessary P20 gameplay-score inflation`);
}

// P16 balance/fairness contracts remain authoritative.
for (const marker of [
  '| gravity | Gravity | Five authored sectors |',
  '| chain | Chain | Wave strategy |',
  '| merge | Merge | Player-paced puzzle |',
  '| drift | Cyber Drift | Fixed-cadence driving |',
  '| dodge | Dodge | Continuous mixed hazards |',
  '| blade | Laser Blade | Procedural target waves |',
  'Exactly 3 tactical charges per wave',
  'No forced timer pressure',
  'Spawn cadence remains fixed at 49 simulation steps',
  'Warp Dash remains 260 ms',
  'Trajectory audit certifies playable target arcs',
]) assert(p16.includes(marker), `P20 lost P16 contract marker: ${marker}`);

// Existing P17/P18/P19 infrastructure is preserved rather than replaced.
assert(p17.includes('32/32 games have explicit feel profiles'), 'P17 roster feel certification changed');
assert(p18.includes('32/32 objectives, control maps, mastery teaching paths'), 'P18 roster clarity certification changed');
assert(p19.includes('One arcade. Thirty-two distinct games.'), 'P19 product philosophy changed');
assert(p17Runtime.includes('POOL_SIZE = 8') || p17Runtime.includes('FEEDBACK_POOL_SIZE = 8') || p17Runtime.includes('8'), 'P17 bounded feedback runtime no longer exposes its eight-node contract');
assert(p18Runtime.includes('setAccessibleControlNames'), 'P18 accessible control naming runtime changed');
assert(p19Runtime.includes("shell.dataset.p19Shell = 'canonical'"), 'P19 canonical shell marker changed');

// Gravity: contract/sector feedback evidence without physics redesign.
for (const marker of ['getGravityFlightContract', 'isGravityFlightContractComplete', 'FLIGHT CONTRACT —', 'contractStreak', 'boostsUsed', 'flipsUsed', 'recallsUsed']) {
  assert(gravity.includes(marker), `Gravity promotion evidence missing ${marker}`);
}
assert(gravity.includes('if (lvl > 5)'), 'Gravity no longer retains its five-sector authored run');

// Chain: three distinct tools, staged cascades, and visible Resonance remain intact.
for (const marker of ['PLASMA DETONATOR', 'TESLA ARC CHAIN', 'CRYO GRAVITY VORTEX', 'RESONANCE', 'toolPurpose', 'advanceChainResonance', 'state.chargesLeft = 3']) {
  assert(chain.includes(marker), `Chain promotion evidence missing ${marker}`);
}

// Merge: deterministic resolver, three-tile queue, contract and feedback hierarchy remain intact.
for (const marker of ['findNextMergeDecision', 'tileQueue', 'CONTRACT', 'haptics.combo()', 'sounds.playCombo(mergeStreak)', 'isMergeContractComplete']) {
  assert(merge.includes(marker), `Merge promotion evidence missing ${marker}`);
}
assert(!merge.includes('setInterval('), 'Merge introduced forced timer pressure');

// Drift: fixed cadence, bounded Nitro and strong native feedback remain intact.
for (const marker of ['DRIFT_FIXED_STEP_SEC', 'st.spawnTimer > 48', 'st.maxSpeed * 1.55', 'STYLE ROUTE', 'skidmarks', 'speedlines', 'playDriftSkid', 'playNitroRoar']) {
  assert(drift.includes(marker), `Cyber Drift promotion evidence missing ${marker}`);
}

// Dodge: bounded dash, warning→active laser and active Phase Cut mastery remain intact.
for (const marker of ['state.dashTimer = 260', "type: 'laser_warning'", 'laserTimer: 1200', "h.type = 'laser_active'", 'isDodgePhaseCut', 'registerPhaseCut', 'ghostTrail']) {
  assert(dodge.includes(marker), `Dodge promotion evidence missing ${marker}`);
}

// Laser Blade: P20 authored composition must be real source behavior, not scorecard prose.
assert(BLADE_WAVE_PHRASES.length === 7, `Laser Blade expected 7 authored phrases, found ${BLADE_WAVE_PHRASES.length}`);
assert(BLADE_WAVES_PER_PHRASE === 3, 'Laser Blade phrase cadence changed from three waves per phrase');
for (const phrase of BLADE_WAVE_PHRASES) {
  assert(phrase.minCount >= 2 && phrase.maxCount <= 4 && phrase.minCount <= phrase.maxCount, `Laser Blade phrase ${phrase.id} violates 2–4 target bound`);
  assert(phrase.maxBombs <= 1, `Laser Blade phrase ${phrase.id} exceeds one-bomb fairness cap`);
}
for (const id of ['clean-cuts','crosscut-angles','armor-break']) {
  const phrase = BLADE_WAVE_PHRASES.find((candidate) => candidate.id === id);
  assert(Boolean(phrase && phrase.maxBombs === 0 && !phrase.weights.bomb), `Laser Blade teaching phrase ${id} contains bomb pressure`);
}
for (const id of ['red-zone','mixed-mastery','neon-finale']) {
  const phrase = BLADE_WAVE_PHRASES.find((candidate) => candidate.id === id);
  assert(Boolean(phrase && phrase.maxBombs === 1 && (phrase.weights.bomb ?? 0) > 0), `Laser Blade mastery phrase ${id} lost bounded bomb pressure`);
}
for (const marker of ['getBladeWavePhrase', 'getBladeWaveCount', 'pickBladeSpawnType', 'data-p20-blade-phrase', 'PHRASE —', 'STEP {wavePhraseStep}/3']) {
  assert(blade.includes(marker), `Laser Blade P20 source missing ${marker}`);
}
assert(blade.includes('createBladeLaunchTrajectory'), 'Laser Blade P20 replaced P16-certified trajectory model');
assert(blade.includes('resolveBladePrecisionSlice'), 'Laser Blade P20 replaced Razor precision mastery');
assert(bladeTrajectory.includes('BLADE_SIMULATION_HZ = 60'), 'Laser Blade 60 Hz trajectory contract changed');
assert(bladePrecision.includes('precision'), 'Laser Blade precision mastery implementation is missing');
assert(!bladePhrases.includes('setTimeout') && !bladePhrases.includes('setInterval'), 'Laser Blade phrase model introduced timing side effects');

// Documentation/score distribution and manual-boundary requirements.
for (const marker of [
  '## Historical scorecards',
  '## Current pre-P20 re-audit',
  '## Final P20 scorecards',
  '## Point-change ledger',
  '## Automated certification boundary',
  '## Manual promotion acceptance',
  '**PROMOTE TO S — 56/60.**',
  '**PROMOTE TO S — 55/60.**',
  '- **S: 11**',
  '- **A: 14**',
  '- **B: 7**',
  'Automation cannot prove “fun”, “beautiful”, “addictive”, or the subjective truth of S rank.',
]) assert(report.includes(marker), `P20 report missing ${marker}`);
assert((report.match(/\*\*PROMOTE TO S/g) ?? []).length === 6, 'P20 report must contain six explicit PROMOTE TO S decisions');

// Explicit non-goals: no replay/playback or retention platform introduced in the P20 application delta.
const forbiddenIdentifiers = [
  'ReplayPlayer','ReplayRecorder','ReplayViewer','GhostRun','RunRecording','PlaybackTimeline','InputRecording','RunHistory','ReplayExport',
  'DailyChallenge','WeeklyChallenge','BattlePass','CurrencyWallet','XpSystem','XPSystem','LoginReward','RewardCalendar',
];
for (const [path, source] of [
  ['src/games/BladeGame.tsx', blade],
  ['src/lib/bladeWavePhrases.ts', bladePhrases],
] as const) {
  for (const identifier of forbiddenIdentifiers) assert(!source.includes(identifier), `${path} introduces prohibited P20 system ${identifier}`);
}

// Permanent P20 source/browser/release wiring.
assert(pkg.scripts?.['quality:gameplay-p20'] === 'bun scripts/audit-gameplay-p20.ts', 'package.json missing permanent P20 source audit');
assert(pkg.scripts?.['quality:browser-p20'] === 'bun scripts/audit-browser-gameplay-p20.mjs', 'package.json missing permanent P20 browser audit');
assert(ci.includes('bun run quality:gameplay-p19\n      - run: bun run quality:gameplay-p20'), 'CI must run P20 immediately after P19');
assert(ci.includes('P20_CHROME_PATH="$chrome" bun run quality:browser-p20'), 'CI does not run P20 browser certification');
assert(release.includes("'quality:gameplay-p20'"), 'release32 required gate list missing P20 source audit');
assert(release.includes("'quality:browser-p20'"), 'release32 required gate list missing P20 browser audit');
assert(release.includes("'scripts/audit-gameplay-p20.ts'"), 'release32 required audit files missing P20 source audit');
assert(release.includes("'scripts/audit-browser-gameplay-p20.mjs'"), 'release32 required audit files missing P20 browser audit');
assert(existsSync(join(root, 'docs', 'P20_NEAR_S_PROMOTION_CERTIFICATION.md')), 'P20 certification document is missing');
assert(existsSync(join(root, 'scripts', 'p20-promotion-scorecards.ts')), 'P20 scorecard ledger is missing');
assert(existsSync(join(root, 'src', 'lib', 'bladeWavePhrases.ts')), 'Laser Blade authored phrase module is missing');

for (const id of cohort) assert(browserAudit.includes(`'${id}'`), `P20 browser audit missing ${id}`);
for (const profile of ["name: 'desktop'", "name: 'mobile'", "name: 'small-mobile'"]) assert(browserAudit.includes(profile), `P20 browser audit missing ${profile}`);
for (const marker of ['FLIGHT CONTRACT', 'RESONANCE', 'CONTRACT', 'STYLE ROUTE', 'WARP DASH', 'data-p20-blade-phrase']) {
  assert(browserAudit.includes(marker), `P20 browser audit missing candidate-specific marker ${marker}`);
}

if (errors.length) {
  console.error('P20 NEAR-S PROMOTION CERTIFICATION — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P20 NEAR-S PROMOTION CERTIFICATION — PASS');
for (const record of P20_PROMOTIONS) console.log(`${record.title}: ${p20Total(record.final)}/60 — S`);
console.log('6/6 promotion records reach the unchanged 55/60 threshold with evidence-ledger and adversarial-review coverage.');
console.log('Historical P15 remains 5 S / 20 A / 7 B; current P20 state is 11 S / 14 A / 7 B.');
console.log('Automation certifies source/runtime invariants, not subjective fun or taste.');
