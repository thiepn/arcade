import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BREAKOUT_CONTRACTS,
  BREAKOUT_ROUND_IDENTITIES,
  getBreakoutContract,
  getBreakoutRoundIdentity,
} from '../src/lib/breakoutMastery';
import {
  AIR_HOCKEY_POWER_DEFENSE_GAIN,
  AIR_HOCKEY_POWER_DURATION_SEC,
  AIR_HOCKEY_POWER_GOAL_GAIN,
  AIR_HOCKEY_POWER_MAX,
  AIR_HOCKEY_POWER_STREAK_BONUS_SCALES,
  getAirHockeyPowerGoalBonus,
} from '../src/lib/airHockeyMastery';
import {
  AIR_HOCKEY_DIFFICULTY_CONFIG,
  AIR_HOCKEY_MAX_PUCK_SPEED,
  AIR_HOCKEY_PLAYER_MAX_SPEED,
} from '../src/lib/airHockeyFairness';
import {
  TOWER_APEX_DURATION_SEC,
  TOWER_APEX_EARN_EVERY,
  TOWER_APEX_MAX_CHARGES,
  TOWER_APEX_ROUTE_COMPLETE_BONUS,
  TOWER_APEX_ROUTE_LENGTH,
  getTowerApexRouteBonus,
  getTowerPrecisionBonus,
} from '../src/lib/towerApexMastery';
import {
  PAC_LEVEL_PROTOCOLS,
  getPacFrightenedDuration,
  getPacGhostMode,
  getPacGhostSpeed,
  getPacLevelProtocol,
} from '../src/lib/pacGhostAi';
import {
  ONE_LINE_MASTERY_GOALS,
  ONE_LINE_MASTERY_MAX_INK_TARGET,
  ONE_LINE_MASTERY_TIER_SIZE,
  getOneLineMasteryGoal,
  getOneLineMasteryReward,
  getOneLineMasteryTier,
} from '../src/lib/oneLineMastery';
import {
  CHRONO_GAP_PHRASES,
  CHRONO_MAX_GAP_SHIFT_SECTORS,
  CHRONO_OPEN_SPAN,
  CHRONO_SIDES,
  circularChronoSectorDistance,
  getChronoDesiredWallSpeed,
  getChronoSpawnInterval,
  isChronoGapTransitionReachable,
  planChronoWall,
} from '../src/lib/chronoWavePlanner';
import { P21_PROMOTIONS, P21_S_THRESHOLD, p21Total } from './p21-promotion-scorecards';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const cohort = ['breakout', 'airhockey', 'tower', 'pacmaze', 'oneline', 'chrono'] as const;
const p15 = read('docs/P15_ROSTER_AUDIT.md');
const p16 = read('docs/P16_BALANCE_CERTIFICATION.md');
const p17 = read('docs/P17_GAME_FEEL_CERTIFICATION.md');
const p18 = read('docs/P18_CLARITY_ACCESSIBILITY_CERTIFICATION.md');
const p19 = read('docs/P19_ARCADE_COHESION_CERTIFICATION.md');
const p20 = read('docs/P20_NEAR_S_PROMOTION_CERTIFICATION.md');
const report = read('docs/P21_STRONG_A_PROMOTION_CERTIFICATION.md');
const browserAudit = read('scripts/audit-browser-gameplay-p21.mjs');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
const ci = read('.github/workflows/ci.yml');
const release = read('scripts/audit-release-32.ts');

assert(P21_S_THRESHOLD === 55, `P21 S threshold changed to ${P21_S_THRESHOLD}`);
assert(P21_PROMOTIONS.length === 6, `P21 expected exactly 6 promotion records, found ${P21_PROMOTIONS.length}`);
assert(P21_PROMOTIONS.map((record) => record.id).join(',') === cohort.join(','), 'P21 promotion cohort/order changed');
assert(new Set(P21_PROMOTIONS.map((record) => record.id)).size === 6, 'P21 promotion cohort contains duplicate IDs');

// Immutable P15 is authoritative. These are the actual repository scorecards,
// including the corrected Breakout/Pac/One Line values discovered during P21.
for (const marker of [
  '| 12 | Breakout Mini | A | 9 | 9 | 9 | 9 | 8 | 8 | 52 |',
  '| 13 | Neon Puck Smash | A | 9 | 9 | 8 | 9 | 9 | 8 | 52 |',
  '| 14 | Gravity Tower Jumper | A | 9 | 9 | 9 | 8 | 9 | 8 | 52 |',
  '| 15 | Cyber Pac-Runner | A | 9 | 9 | 9 | 8 | 8 | 8 | 51 |',
  '| 16 | One Line | A | 9 | 10 | 9 | 8 | 7 | 8 | 51 |',
  '| 17 | Chrono Wave | A | 9 | 9 | 9 | 8 | 8 | 8 | 51 |',
  '- **S:** 5',
  '- **A:** 20',
  '- **B:** 7',
]) assert(p15.includes(marker), `P21 historical P15 marker changed: ${marker}`);

for (const record of P21_PROMOTIONS) {
  const historicalTotal = p21Total(record.historical);
  const preTotal = p21Total(record.preP21);
  const finalTotal = p21Total(record.final);
  const expectedHistorical = record.id === 'breakout' || record.id === 'airhockey' || record.id === 'tower' ? 52 : 51;
  assert(historicalTotal === expectedHistorical, `${record.id} historical arithmetic changed: ${historicalTotal}`);
  assert(preTotal <= finalTotal, `${record.id} pre-P21 total exceeds final total`);
  assert(finalTotal >= P21_S_THRESHOLD && finalTotal <= 60, `${record.id} final score ${finalTotal} is outside S range`);
  for (const [category, value] of Object.entries(record.final)) {
    assert(value >= 1 && value <= 10, `${record.id} ${category} score ${value} is outside 1..10`);
  }
  for (const category of Object.keys(record.final) as Array<keyof typeof record.final>) {
    const delta = record.final[category] - record.historical[category];
    assert(delta >= 0 && delta <= 1, `${record.id} ${category} changed by ${delta}; P21 permits at most +1 per category`);
    if (delta > 0) {
      const evidence = record.evidence[category];
      assert(Boolean(evidence && evidence.length >= 2), `${record.id} ${category} increase lacks at least two evidence statements`);
    }
  }
  assert(record.adversarialReview.length >= 2, `${record.id} lacks an adversarial promotion review`);
}

// Breakout: original four-contract vocabulary is preserved beneath eight authored identities.
assert(BREAKOUT_CONTRACTS.length === 4, 'Breakout base contract count changed');
assert(BREAKOUT_ROUND_IDENTITIES.length === 8, 'Breakout must expose eight authored round identities');
assert(new Set(BREAKOUT_ROUND_IDENTITIES.map((identity) => identity.id)).size === 8, 'Breakout round identities are not unique');
assert(getBreakoutContract(1).kind === 'COMBO_DRIVE' && getBreakoutContract(5).kind === 'COMBO_DRIVE', 'Breakout four-contract rotation changed');
assert(getBreakoutRoundIdentity(1).label === 'CONTROL READ', 'Breakout opening authored identity changed');
assert(getBreakoutRoundIdentity(8).label === 'SPECIAL FINALE', 'Breakout finale authored identity changed');
assert(getBreakoutContract(1).target === 6, 'Breakout opening combo target changed');
assert(getBreakoutContract(6).target === 3, 'Breakout late Power Bank target should tighten from 2 to 3');

// Puck: match progression changes only score conversion inside the existing Power window.
assert(AIR_HOCKEY_POWER_MAX === 100 && AIR_HOCKEY_POWER_DEFENSE_GAIN === 34 && AIR_HOCKEY_POWER_GOAL_GAIN === 12, 'Puck Power meter economy changed');
assert(AIR_HOCKEY_POWER_DURATION_SEC === 4, 'Puck Power duration changed');
assert(AIR_HOCKEY_POWER_STREAK_BONUS_SCALES.length === 4, 'Puck P21 conversion ladder must contain four tiers');
assert(AIR_HOCKEY_POWER_STREAK_BONUS_SCALES.every((value, index, values) => index === 0 || value > values[index - 1]), 'Puck conversion ladder must rise monotonically');
assert(getAirHockeyPowerGoalBonus(500, 1) === 250 && getAirHockeyPowerGoalBonus(500, 4) === 675, 'Puck P21 conversion rewards changed unexpectedly');
assert(AIR_HOCKEY_PLAYER_MAX_SPEED === 1050 && AIR_HOCKEY_MAX_PUCK_SPEED === 680, 'Puck certified velocity caps changed');
assert(AIR_HOCKEY_DIFFICULTY_CONFIG.EASY.reactionMs === 165 && AIR_HOCKEY_DIFFICULTY_CONFIG.MEDIUM.reactionMs === 105 && AIR_HOCKEY_DIFFICULTY_CONFIG.HARD.reactionMs === 70, 'Puck AI reaction bounds changed');

// Tower: five precision centers create a score-only route completion; prior Apex economy is frozen.
assert(TOWER_APEX_EARN_EVERY === 3 && TOWER_APEX_MAX_CHARGES === 2 && TOWER_APEX_DURATION_SEC === 4.5, 'Tower Apex charge/duration contract changed');
assert(TOWER_APEX_ROUTE_LENGTH === 5 && TOWER_APEX_ROUTE_COMPLETE_BONUS === 900, 'Tower P21 route contract changed');
assert(getTowerApexRouteBonus(4) === 0 && getTowerApexRouteBonus(5) === 900 && getTowerApexRouteBonus(10) === 900, 'Tower route completion cadence is incorrect');
assert(getTowerPrecisionBonus(1) === 150 && getTowerPrecisionBonus(5) === 1650 && getTowerPrecisionBonus(99) === 750, 'Tower precision/route reward integration changed');

// Pac: six authored level protocols vary tactical rhythm while preserving certified floors/caps.
assert(PAC_LEVEL_PROTOCOLS.length === 6, 'Pac must expose six authored level protocols');
assert(new Set(PAC_LEVEL_PROTOCOLS.map((protocol) => protocol.id)).size === 6, 'Pac level protocols are not unique');
assert(getPacLevelProtocol(1).label === 'ORIENTATION' && getPacLevelProtocol(6).label === 'ENDURANCE' && getPacLevelProtocol(7).label === 'ORIENTATION', 'Pac protocol cycle changed');
for (let level = 1; level <= 24; level++) {
  assert(getPacFrightenedDuration(level) >= 4.5, `Pac level ${level} broke frightened-time floor`);
  assert(getPacGhostSpeed(level, false) <= 5.6, `Pac level ${level} broke normal ghost-speed cap`);
  assert(getPacGhostSpeed(level, true) <= 3.3, `Pac level ${level} broke frightened ghost-speed cap`);
  assert(getPacGhostMode(0, level) === 'SCATTER', `Pac level ${level} should open in SCATTER`);
}

// One Line: three original mastery identities remain, but later tiers tighten only optional ink efficiency.
assert(ONE_LINE_MASTERY_GOALS.length === 3 && ONE_LINE_MASTERY_TIER_SIZE === 3, 'One Line base mastery/tier cadence changed');
assert(ONE_LINE_MASTERY_MAX_INK_TARGET === 40, 'One Line optional mastery target cap changed');
assert(getOneLineMasteryGoal(1).label === 'STAR ROUTE' && getOneLineMasteryGoal(1).minInkRemainingPercent === 20, 'One Line opening mastery goal changed');
assert(getOneLineMasteryGoal(4).label === 'STAR ROUTE' && getOneLineMasteryGoal(4).minInkRemainingPercent === 22, 'One Line tier-two mastery tightening changed');
assert(getOneLineMasteryTier(1) === 1 && getOneLineMasteryTier(4) === 2 && getOneLineMasteryTier(10) === 4, 'One Line mastery tier calculation changed');
for (let level = 1; level <= 30; level++) assert(getOneLineMasteryGoal(level).minInkRemainingPercent <= 40, `One Line level ${level} exceeded optional ink target cap`);
assert(getOneLineMasteryReward(10, 2) > getOneLineMasteryReward(1, 2), 'One Line later mastery tiers do not increase reward');

// Chrono: phrase grammar is bounded entirely inside the old reachability vocabulary.
assert(CHRONO_GAP_PHRASES.length === 4, 'Chrono must expose four gap phrase families');
for (const phrase of CHRONO_GAP_PHRASES) {
  assert(phrase.offsets.length >= 4, `${phrase.label} is too short to form a phrase`);
  assert(phrase.offsets.every((offset) => Math.abs(offset) <= CHRONO_MAX_GAP_SHIFT_SECTORS), `${phrase.label} exceeds the ±1 transition envelope`);
}
let seed = 0x21c0ffee;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};
for (const stage of [1, 2, 3, 4]) {
  let currentFrame = 0;
  let lastImpactFrame = 0;
  let lastOpenSide = 0;
  let consecutiveSameGap = 0;
  for (let index = 0; index < 160; index++) {
    currentFrame += getChronoSpawnInterval(stage);
    const previousOpenSide = lastOpenSide;
    const plan = planChronoWall({
      currentFrame,
      spawnRadius: 520,
      playerRadius: 58,
      desiredSpeed: getChronoDesiredWallSpeed(stage, 1.4),
      rotationSpeed: 0.184,
      lastImpactFrame,
      lastOpenSide,
      consecutiveSameGap,
      random,
    });
    assert(plan.openSpan === CHRONO_OPEN_SPAN, `Chrono stage ${stage} changed open-span safety`);
    assert(circularChronoSectorDistance(previousOpenSide, plan.openSide, CHRONO_SIDES) <= 1, `Chrono stage ${stage} phrase jumped more than one sector`);
    assert(isChronoGapTransitionReachable(previousOpenSide, plan.openSide, plan.impactGapFrames, 0.184, plan.openSpan, CHRONO_SIDES), `Chrono stage ${stage} phrase generated unreachable transition`);
    assert(plan.consecutiveSameGap <= 2, `Chrono stage ${stage} repeated one gap more than twice`);
    lastImpactFrame = plan.impactFrame;
    lastOpenSide = plan.openSide;
    consecutiveSameGap = plan.consecutiveSameGap;
  }
}

// Prior phase contracts and promotion history remain explicit and separate.
assert(p16.includes('P16 — Difficulty & Balance Certification'), 'P16 balance certification missing');
assert(p17.includes('exactly **8 pooled feedback nodes** per active shell'), 'P17 bounded feel contract changed');
assert(p18.includes('Every shipped game has one explicit P18 clarity profile'), 'P18 clarity profile contract changed');
assert(p19.includes('one arcade, thirty-two distinct games'), 'P19 cohesion philosophy changed');
assert(p20.includes('- **S: 11**') && p20.includes('- **A: 14**') && p20.includes('- **B: 7**'), 'P20 current distribution record changed');

for (const marker of [
  '## Historical P15 scorecards',
  '## Current pre-P21 re-audit',
  '## Final P21 scorecards',
  '## Evidence ledger',
  '## Adversarial promotion review',
  '## Manual acceptance boundary',
  '- **S: 17**',
  '- **A: 8**',
  '- **B: 7**',
]) assert(report.includes(marker), `P21 report missing ${marker}`);
assert((report.match(/PROMOTE TO S/g) ?? []).length >= 6, 'P21 report must contain six explicit promotion decisions');

// P21 application delta contains no replay recorder/playback or retention metagame.
const forbiddenIdentifiers = [
  'ReplayPlayer','ReplayRecorder','ReplayViewer','GhostRun','RunRecording','PlaybackTimeline','InputRecording','RunHistory','ReplayExport',
  'DailyChallenge','WeeklyChallenge','BattlePass','CurrencyWallet','XpSystem','XPSystem','LoginReward','RewardCalendar',
];
for (const path of [
  'src/lib/breakoutMastery.ts',
  'src/lib/airHockeyMastery.ts',
  'src/lib/towerApexMastery.ts',
  'src/lib/pacGhostAi.ts',
  'src/lib/oneLineMastery.ts',
  'src/lib/chronoWavePlanner.ts',
]) {
  const source = read(path);
  for (const identifier of forbiddenIdentifiers) assert(!source.includes(identifier), `${path} introduces prohibited P21 system ${identifier}`);
}

assert(pkg.scripts?.['quality:gameplay-p21'] === 'bun scripts/audit-gameplay-p21.ts', 'package.json missing permanent P21 source audit');
assert(pkg.scripts?.['quality:browser-p21'] === 'bun scripts/audit-browser-gameplay-p21.mjs', 'package.json missing permanent P21 browser audit');
assert(ci.includes('bun run quality:gameplay-p20\n      - run: bun run quality:gameplay-p21'), 'CI must run P21 immediately after P20');
assert(ci.includes('P21_CHROME_PATH="$chrome" bun run quality:browser-p21'), 'CI does not run P21 browser certification');
assert(release.includes("'quality:gameplay-p21'"), 'release32 required gate list missing P21 source audit');
assert(release.includes("'quality:browser-p21'"), 'release32 required gate list missing P21 browser audit');
assert(release.includes("'scripts/audit-gameplay-p21.ts'"), 'release32 required files missing P21 source audit');
assert(release.includes("'scripts/audit-browser-gameplay-p21.mjs'"), 'release32 required files missing P21 browser audit');
assert(existsSync(join(root, 'docs', 'P21_STRONG_A_PROMOTION_CERTIFICATION.md')), 'P21 certification document is missing');
assert(existsSync(join(root, 'scripts', 'p21-promotion-scorecards.ts')), 'P21 scorecard ledger is missing');

for (const id of cohort) assert(browserAudit.includes(`'${id}'`), `P21 browser audit missing ${id}`);
for (const profile of ["name: 'desktop'", "name: 'mobile'", "name: 'small-mobile'"]) assert(browserAudit.includes(profile), `P21 browser audit missing ${profile}`);

if (errors.length) {
  console.error('P21 STRONG-A PROMOTION CERTIFICATION — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P21 STRONG-A PROMOTION CERTIFICATION — PASS');
for (const record of P21_PROMOTIONS) console.log(`${record.title}: ${p21Total(record.final)}/60 — S`);
console.log('6/6 strong-A promotion records reach the unchanged 55/60 threshold with evidence-ledger and adversarial-review coverage.');
console.log('Historical P15 remains 5 S / 20 A / 7 B; P20 remains 11 S / 14 A / 7 B; current P21 state is 17 S / 8 A / 7 B.');
console.log('Automation certifies objective source/runtime contracts, not subjective fun or taste.');
