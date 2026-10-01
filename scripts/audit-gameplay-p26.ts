import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getAirHockeyOpeningPace,
  getBladeSpawnIntervalFrames,
  getBlockDropInterval,
  getBreakoutMinimumSpecials,
  getBubbleDropCadence,
  getChainBaseSpeed,
  getChainTargetPercent,
  getDodgeSpawnDelayMs,
  getFlappyAeroGap,
  getFlappyAeroScrollSpeed,
  getLaserRopeWarningFloor,
  getOrbitHazardIntervalMs,
  getPinballRescueImpulse,
  getPulseComboBpmBoost,
  getRhythmMissPenalty,
  getRoadCrossLaneSpeed,
  getSnakeTickIntervalMs,
  getStackTravelSpeed,
  getTowerPlatformGap,
  getTypeRushBaseSpeed,
  getVanguardBossHp,
  getVanguardEnemySpeed,
} from '../src/lib/gamePolishBalance';
import {
  NEON_RAIL_MAX_SPAWN_INTERVAL,
  NEON_RAIL_MAX_SPEED,
  NEON_RAIL_MIN_SPAWN_INTERVAL,
  NEON_RAIL_MIN_SPEED,
  getNeonRailSpawnInterval,
  getNeonRailSpeed,
} from '../src/lib/neonRailShift';
import { getKnifeStageConfig } from '../src/lib/knifeStageProgression';
import { getPacGhostSpeed } from '../src/lib/pacGhostAi';
import { getChronoDesiredWallSpeed, getChronoSpawnInterval } from '../src/lib/chronoWavePlanner';
import {
  HEX_GOAL_PERCENT,
  HEX_INTERIOR_CELLS,
  HEX_MAX_CHAIN_BONUS,
  HEX_SECOND_HUNTER_PERCENT,
  HEX_START_LIVES,
  HEX_STEP_MS,
  VECTOR_HOLE_PARS,
  VECTOR_MAX_BANK_REWARD_EVENTS,
  VECTOR_STROKE_LIMIT_OVER_PAR,
  getHexClosureBonus,
  getHexTheoreticalMaxScore,
  getHexWinBonus,
  getVectorHoleScore,
  getVectorTheoreticalMaxScore,
} from '../src/lib/replacementGameBalance';
import { getPolicy, screenRun, SESSION_MS } from '../shared/leaderboard/domain';
import { SESSION_TTL_MS } from '../shared/scoringProtocol';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const finite = (...values: number[]) => values.every(Number.isFinite);
const sixHours = 6 * 60 * 60 * 1000;

// P26 certifies production reality after the two replacement-engine cutovers.
const main = read('src/main.tsx');
const replacements = read('src/lib/replacementGames.tsx');
const epoch = read('src/lib/replacementEpoch.ts');
const vite = read('vite.config.ts');
const vector = read('src/games/VectorGolf.tsx');
const hex = read('src/games/HexCapture.tsx');

assert(
  main.indexOf('applyReplacementGames();') >= 0 &&
  main.indexOf('applyReplacementGames();') < main.indexOf('createRoot('),
  'replacement engines must resolve before React reads the registry',
);
for (const marker of [
  "game.id === 'gravity'",
  "title: 'Vector Golf'",
  "import('../games/VectorGolf')",
  "game.id === 'astroblaster'",
  "title: 'Hex Capture'",
  "import('../games/HexCapture')",
  'sanitizeReplacementLocalScores();',
]) assert(replacements.includes(marker), `production replacement mapping missing: ${marker}`);

for (const marker of [
  "'../games/GravityGame': path.resolve(import.meta.dirname, 'src/games/VectorGolf.tsx')",
  "'../games/AstroBlasterGame': path.resolve(import.meta.dirname, 'src/games/HexCapture.tsx')",
]) assert(vite.includes(marker), `production bundle alias missing: ${marker}`);

assert(epoch.includes('REPLACEMENT_CUTOVER_MS'), 'replacement score epoch is not explicit');
assert(epoch.includes("const REPLACEMENT_SLOTS = ['gravity', 'astroblaster'] as const"), 'replacement compatibility slots changed');
assert(vector.includes('data-replacement-game="vector-golf"'), 'Vector Golf production marker missing');
assert(hex.includes('data-replacement-game="hex-capture"'), 'Hex Capture production marker missing');
assert(!vector.includes('>FLIGHT CONTRACT</span>'), 'Vector Golf restored a hidden historical-Gravity test marker');

// Replacement native-score compatibility with the already-deployed compatibility-slot policy.
assert.deepEqual([...VECTOR_HOLE_PARS], [3, 4, 4, 5, 5, 5]);
assert.equal(VECTOR_MAX_BANK_REWARD_EVENTS, 3);
assert.equal(VECTOR_STROKE_LIMIT_OVER_PAR, 5);
assert.equal(getVectorTheoreticalMaxScore(), 32_820);
assert.equal(getVectorHoleScore(5, 1, 0, 3, 999), getVectorHoleScore(5, 1, 0, 3, 3));
assert(getVectorHoleScore(5, 2, 20, 3, 3) < getVectorHoleScore(5, 1, 0, 3, 3));

const vectorPolicy = getPolicy('gravity', 'standard');
assert(vectorPolicy, 'gravity compatibility policy is missing');
assert.equal(vectorPolicy.hardMax, 33_000);
assert(getVectorTheoreticalMaxScore() <= vectorPolicy.hardMax, 'Vector Golf can exceed the deployed gravity hardMax');
assert.notEqual(
  screenRun('gravity', 'standard', getVectorTheoreticalMaxScore(), 120_000).status,
  'rejected',
  'a theoretically valid Vector Golf maximum is rejected by the production compatibility policy',
);

assert.equal(HEX_GOAL_PERCENT, 72);
assert.equal(HEX_STEP_MS, 82);
assert.equal(HEX_START_LIVES, 3);
assert.equal(HEX_SECOND_HUNTER_PERCENT, 34);
assert.equal(HEX_INTERIOR_CELLS, 504);
assert.equal(HEX_MAX_CHAIN_BONUS, 6);
assert.equal(getHexTheoreticalMaxScore(), 64_016);
assert.equal(
  getHexTheoreticalMaxScore(),
  getHexClosureBonus(HEX_INTERIOR_CELLS, HEX_MAX_CHAIN_BONUS) + getHexWinBonus(HEX_START_LIVES),
);
assert.equal(
  getHexTheoreticalMaxScore(),
  getHexClosureBonus(1, HEX_MAX_CHAIN_BONUS) * HEX_INTERIOR_CELLS + getHexWinBonus(HEX_START_LIVES),
  'Hex micro-capture splitting can exceed the conservative whole-board score bound',
);

const hexPolicy = getPolicy('astroblaster', 'standard');
assert(hexPolicy, 'astroblaster compatibility policy is missing');
assert(getHexTheoreticalMaxScore() <= hexPolicy.anchors[2], 'Hex Capture conservative whole-board maximum exceeds the reused mastery anchor');
assert.notEqual(
  screenRun('astroblaster', 'standard', getHexTheoreticalMaxScore(), 120_000).status,
  'rejected',
  'a conservative Hex Capture maximum is rejected by the production compatibility policy',
);

assert(vector.includes('getVectorHoleScore(') && vector.includes('VECTOR_STROKE_LIMIT_OVER_PAR'), 'Vector Golf is not using the P26 balance contract');
assert(hex.includes('getHexClosureBonus(claimed, st.chain)') && hex.includes('getHexWinBonus(st.lives)'), 'Hex Capture is not using the P26 balance contract');
assert(hex.includes('aria-keyshortcuts="Space"') && hex.includes('aria-pressed={heldDirection'), 'Hex Capture production controls are not semantically stateful');
assert(vector.includes('aria-label="Aim guide"') && vector.includes('aria-keyshortcuts="G"'), 'Vector Golf guide control is not semantically stateful');
assert(vector.includes("window.addEventListener('blur', clearDrag)") && vector.includes("document.addEventListener('visibilitychange', onVisibility)"), 'Vector Golf interrupted drag ownership is not released');
assert(hex.includes("window.addEventListener('blur', clearHeld)") && hex.includes("document.addEventListener('visibilitychange', visibility)"), 'Hex Capture interrupted held movement is not released');

// The online score/run lifetime and the client compatibility lifetime must agree.
assert.equal(SESSION_MS, sixHours);
assert.equal(SESSION_TTL_MS, sixHours);
for (const policy of [vectorPolicy, hexPolicy]) {
  assert.equal(policy.maxActiveMs, sixHours);
  assert(policy.minActiveMs >= 0 && policy.minActiveMs < policy.maxActiveMs);
}

// Long-horizon balance probe. This is accelerated mathematical validation, not a
// claim that CI literally idles every game for hours.
const horizons = [0, 60, 600, 3_600, 21_600, 86_400, 1_000_000] as const;
for (const seconds of horizons) {
  const wave = Math.max(1, Math.floor(seconds / 30) + 1);
  const level = Math.max(1, Math.floor(seconds / 45) + 1);
  const gates = Math.max(0, Math.floor(seconds / 3));

  const values = [
    getAirHockeyOpeningPace(seconds),
    getBladeSpawnIntervalFrames(wave),
    getBlockDropInterval(level),
    getBreakoutMinimumSpecials(level),
    getBubbleDropCadence(level),
    getChainBaseSpeed(wave, 0.999999),
    getChainTargetPercent(wave),
    getDodgeSpawnDelayMs(seconds, 12),
    getFlappyAeroGap(gates),
    getFlappyAeroScrollSpeed(gates),
    getLaserRopeWarningFloor(2.2 + seconds),
    getOrbitHazardIntervalMs(seconds),
    getPinballRescueImpulse(seconds),
    getPulseComboBpmBoost(seconds),
    getRhythmMissPenalty(Math.max(0, 100 - seconds)),
    getRoadCrossLaneSpeed(gates, 0.999999),
    getSnakeTickIntervalMs(level),
    getStackTravelSpeed(level, 1.7),
    getTowerPlatformGap(seconds * 10, 0.999999),
    getTypeRushBaseSpeed(seconds, 1.16),
    getVanguardBossHp(wave),
    getVanguardEnemySpeed('swarmer', wave),
    getVanguardEnemySpeed('drone', wave),
    getNeonRailSpeed(seconds),
    getNeonRailSpawnInterval(seconds),
    getKnifeStageConfig(level).baseSpeed,
    getKnifeStageConfig(level).preBladeCount,
    getPacGhostSpeed(level, false),
    getPacGhostSpeed(level, true),
    getChronoSpawnInterval(4),
    getChronoDesiredWallSpeed(4, 99),
  ];
  assert(finite(...values), `non-finite long-run balance value at ${seconds}s`);

  assert(getAirHockeyOpeningPace(seconds) >= 0.84 && getAirHockeyOpeningPace(seconds) <= 1);
  assert(getBladeSpawnIntervalFrames(wave) >= 50 && getBladeSpawnIntervalFrames(wave) <= 65);
  assert(getBlockDropInterval(level) >= 0.12 && getBlockDropInterval(level) <= 0.8);
  assert(getBreakoutMinimumSpecials(level) >= 2 && getBreakoutMinimumSpecials(level) <= 4);
  assert([5, 6].includes(getBubbleDropCadence(level)));
  assert(getChainTargetPercent(wave) <= 0.78 && getChainBaseSpeed(wave, 0.999999) <= 3.7);
  assert(getDodgeSpawnDelayMs(seconds, 12) >= 450);
  assert(getFlappyAeroGap(gates) >= 96 && getFlappyAeroScrollSpeed(gates) <= 270);
  assert(getLaserRopeWarningFloor(2.2 + seconds) >= 0.38 && getLaserRopeWarningFloor(2.2 + seconds) <= 0.45);
  assert(getOrbitHazardIntervalMs(seconds) >= 750 && getOrbitHazardIntervalMs(seconds) <= 1800);
  assert(getPinballRescueImpulse(seconds) >= 0 && getPinballRescueImpulse(seconds) <= 150);
  assert(getPulseComboBpmBoost(seconds) >= 0 && getPulseComboBpmBoost(seconds) < 30.000001);
  assert([6, 7].includes(getRhythmMissPenalty(Math.max(0, 100 - seconds))));
  assert(getRoadCrossLaneSpeed(gates, 0.999999) <= 133);
  assert(getSnakeTickIntervalMs(level) >= 65 && getSnakeTickIntervalMs(level) <= 95);
  assert(getStackTravelSpeed(level, 1.7) <= 13.6 + 1e-9);
  assert(getTowerPlatformGap(seconds * 10, 0.999999) < 89.001);
  assert(getTypeRushBaseSpeed(seconds, 1.16) < 0.36);
  assert(getVanguardEnemySpeed('swarmer', wave) <= 4.75);
  assert(getVanguardEnemySpeed('drone', wave) <= 3.7);
  assert(getVanguardBossHp(wave) < 12_000, 'Vanguard diminishing boss curve escaped the P26 million-second envelope');
  assert(getNeonRailSpeed(seconds) >= NEON_RAIL_MIN_SPEED && getNeonRailSpeed(seconds) <= NEON_RAIL_MAX_SPEED);
  assert(getNeonRailSpawnInterval(seconds) >= NEON_RAIL_MIN_SPAWN_INTERVAL && getNeonRailSpawnInterval(seconds) <= NEON_RAIL_MAX_SPAWN_INTERVAL);
  const knife = getKnifeStageConfig(level);
  assert(knife.baseSpeed <= 5 && knife.preBladeCount <= 5 && knife.knifeCount <= 14);
  assert(getPacGhostSpeed(level, false) <= 5.45 && getPacGhostSpeed(level, true) <= 3.25);
  assert(getChronoSpawnInterval(4) === 70 && getChronoDesiredWallSpeed(4, 99) < 4.33);
}

// Previous phase continuity is explicit.
const p24 = read('docs/P24_DEFINITIVE_32_S_CERTIFICATION.md');
const p25 = read('docs/P25_DEEP_GAME_POLISH.md');
assert(p24.includes('**32 S / 0 A / 0 B**'), 'P26 lost the historical P24 slot-score ledger');
assert(p25.includes('Vector Golf and Hex Capture replace the retired Gravity/Astro engines in the current live-integration ledger'), 'P26 is not based on the production-resolved P25 ledger');

for (const file of [
  'scripts/audit-browser-gameplay-p26.mjs',
  'scripts/audit-production-p26.mjs',
  'docs/P26_PRODUCTION_CERTIFICATION.md',
]) assert(fs.existsSync(path.join(root, file)), `P26 dependency missing: ${file}`);

const p26Doc = read('docs/P26_PRODUCTION_CERTIFICATION.md');
for (const marker of [
  '# P26 — Real-Device Gameplay Validation, Long-Run Balance & Production Certification',
  '32,820',
  '64,016',
  'browser device profiles are hardware proxies',
  'physical-device signoff remains a manual boundary',
  'does not inherit the old Gravity/Astro qualitative scorecard as an evaluation of the replacement engines',
]) assert(p26Doc.includes(marker), `P26 documentation missing: ${marker}`);

const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
assert(pkg.scripts?.['quality:gameplay-p26'] === 'bun scripts/audit-gameplay-p26.ts', 'package.json is missing quality:gameplay-p26');
assert(pkg.scripts?.['quality:browser-p26'] === 'bun scripts/audit-browser-gameplay-p26.mjs', 'package.json is missing quality:browser-p26');
assert(pkg.scripts?.['quality:production-p26'] === 'bun scripts/audit-production-p26.mjs', 'package.json is missing quality:production-p26');

const ci = read('.github/workflows/ci.yml');
assert(ci.includes('bun run quality:gameplay-p26'), 'CI does not enforce the P26 long-run/source gate');
assert(ci.includes('P26_CHROME_PATH="$chrome" bun run quality:browser-p26'), 'CI does not run the P26 device-profile browser gate');
assert(ci.includes('P26_EXPECT_BASE=/ bun run quality:production-p26'), 'CI does not inspect the root production artifact');
assert(ci.includes('P26_EXPECT_BASE=/arcade/ bun run quality:production-p26'), 'CI does not inspect the Pages production artifact');

const pages = read('.github/workflows/pages.yml');
assert(pages.includes('P26_EXPECT_BASE=/arcade/ bun run quality:production-p26'), 'Pages build does not certify the P26 artifact before upload');
assert(pages.includes("P26_QUICK: '1'") && pages.includes('P26_CHROME_PATH="$chrome" bun run quality:browser-p26'), 'deployed Pages does not run the P26 live smoke');

console.log('P26 PRODUCTION / LONG-RUN GAMEPLAY CERTIFICATION — PASS');
console.log('Production replacement engines, six-hour run limits, long-horizon balance envelopes and replacement score-policy compatibility are statically certified.');
console.log('Physical phone/tablet hardware remains a documented manual boundary; CI uses browser device profiles, not real devices.');
