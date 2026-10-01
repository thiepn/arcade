import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BLADE_CADENCE_FULL_PRESSURE_WAVES,
  chooseBalancedReactionChoice,
  drawMergeTileFromBag,
  getAirHockeyOpeningPace,
  getAstroLargeAsteroidCount,
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
  getSlingshotNodeOffset,
  getSnakeTickIntervalMs,
  getStackTravelSpeed,
  getTowerPlatformGap,
  getTypeRushBaseSpeed,
  getVanguardBossHp,
  getVanguardEnemySpeed,
  type VanguardEnemyKind,
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
  GRAVITY_FIXED_STEP_SEC,
  GRAVITY_MAX_FRAME_SEC,
  GRAVITY_MAX_STEPS_PER_FRAME,
  getGravityPhysicsStepBatch,
} from '../src/lib/gravityRuntime';
import { PERFECT_STOP_ROUNDS } from '../src/lib/perfectStopGameplay';
import { TYPE_RUSH_WAVES, getTypeRushWave } from '../src/lib/typeRushProgression';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const approx = (a: number, b: number, eps = 1e-8) => Math.abs(a - b) <= eps;
const nonIncreasing = (values: number[]) =>
  values.every((value, index) => index === 0 || value <= values[index - 1] + 1e-9);
const nonDecreasing = (values: number[]) =>
  values.every((value, index) => index === 0 || value + 1e-9 >= values[index - 1]);
// ---------------------------------------------------------------------------
// Shared quantitative envelopes. P25 is a balance/fairness pass, not a scoring pass.
// ---------------------------------------------------------------------------

const hockeyPace = Array.from({ length: 81 }, (_, index) => getAirHockeyOpeningPace(index / 4));
assert(approx(hockeyPace[0], 0.84) && approx(getAirHockeyOpeningPace(8), 1));
assert(nonDecreasing(hockeyPace) && hockeyPace.every((value) => value >= 0.84 && value <= 1));

// Archived compatibility-slot envelope: Astro Blaster is retired from production,
 // but its historical P25 source remains deterministic for provenance.
const asteroidCounts = Array.from({ length: 100 }, (_, index) => getAstroLargeAsteroidCount(index + 1));
assert(nonDecreasing(asteroidCounts) && asteroidCounts[0] === 4 && asteroidCounts.every((value) => value <= 9));
assert.deepEqual([1, 4, 8, 20].map(getAstroLargeAsteroidCount), [4, 7, 9, 9]);

assert.equal(BLADE_CADENCE_FULL_PRESSURE_WAVES, 24);
const bladeCadence = Array.from(
  { length: BLADE_CADENCE_FULL_PRESSURE_WAVES * 2 + 1 },
  (_, waveCount) => getBladeSpawnIntervalFrames(waveCount),
);
assert(nonIncreasing(bladeCadence) && bladeCadence.every((value) => value >= 50 && value <= 65));
assert.equal(getBladeSpawnIntervalFrames(0), 65);
assert.equal(getBladeSpawnIntervalFrames(BLADE_CADENCE_FULL_PRESSURE_WAVES), 50);
assert.equal(getBladeSpawnIntervalFrames(100000), 50);

const blockDropIntervals = Array.from({ length: 60 }, (_, index) => getBlockDropInterval(index + 1));
assert(nonIncreasing(blockDropIntervals));
assert.equal(blockDropIntervals[0], 0.8);
assert.equal(getBlockDropInterval(30), 0.12);
assert(blockDropIntervals.every((value) => value >= 0.12 && value <= 0.8));

const chainTargets = Array.from({ length: 50 }, (_, index) => getChainTargetPercent(index + 1));
assert(nonDecreasing(chainTargets));
assert(approx(chainTargets[0], 0.5) && approx(getChainTargetPercent(8), 0.78));
assert(chainTargets.every((value) => value >= 0.5 && value <= 0.78));
for (const randomValue of [0, 0.25, 0.5, 0.75, 1]) {
  const speeds = Array.from({ length: 50 }, (_, index) => getChainBaseSpeed(index + 1, randomValue));
  assert(nonDecreasing(speeds) && speeds.every((value) => value >= 1.3 && value <= 3.7));
}
assert(getChainBaseSpeed(100, 1) <= 3.7);

for (const density of [0, 2, 5, 8, 12]) {
  const delays = Array.from({ length: 121 }, (_, second) => getDodgeSpawnDelayMs(second, density));
  assert(nonIncreasing(delays), `Dodge pressure is not monotonic at density ${density}`);
  assert(delays.every((value) => value >= 450), `Dodge spawn floor broke at density ${density}`);
}
for (const second of [0, 12, 24, 48, 120]) {
  assert(getDodgeSpawnDelayMs(second, 8) > getDodgeSpawnDelayMs(second, 2));
}

const aeroGates = Array.from({ length: 201 }, (_, value) => value);
const aeroGaps = aeroGates.map(getFlappyAeroGap);
const aeroSpeeds = aeroGates.map(getFlappyAeroScrollSpeed);
assert(nonIncreasing(aeroGaps) && aeroGaps.every((value) => value >= 96 && value <= 132));
assert(nonDecreasing(aeroSpeeds) && aeroSpeeds.every((value) => value >= 175 && value <= 270));
assert.equal(getFlappyAeroGap(0), 132);
assert.equal(getFlappyAeroScrollSpeed(0), 175);

const orbitCadence = Array.from({ length: 121 }, (_, second) => getOrbitHazardIntervalMs(second));
assert(nonIncreasing(orbitCadence));
assert.equal(getOrbitHazardIntervalMs(0), 1800);
assert.equal(getOrbitHazardIntervalMs(999), 750);
assert(orbitCadence.every((value) => value >= 750 && value <= 1800));

const pulseBoosts = Array.from({ length: 201 }, (_, combo) => getPulseComboBpmBoost(combo));
assert(nonDecreasing(pulseBoosts));
assert(approx(pulseBoosts[0], 0));
assert(pulseBoosts.every((value) => value >= 0 && value < 30.000001));

const roadBands = [
  { row: 0, min: 62, max: 112 },
  { row: 8, min: 69, max: 119 },
  { row: 16, min: 76, max: 126 },
  { row: 24, min: 83, max: 133 },
  { row: 999, min: 83, max: 133 },
];
for (const band of roadBands) {
  assert(approx(getRoadCrossLaneSpeed(band.row, 0), band.min));
  assert(Math.abs(getRoadCrossLaneSpeed(band.row, 0.999999) - band.max) < 0.001);
}

const snakeIntervals = Array.from({ length: 198 }, (_, index) => getSnakeTickIntervalMs(index + 3));
assert(nonIncreasing(snakeIntervals));
assert.equal(getSnakeTickIntervalMs(3), 95);
assert.equal(getSnakeTickIntervalMs(999), 65);
assert(snakeIntervals.every((value) => value >= 65 && value <= 95));

for (const viewportScale of [0.85, 1, 1.25, 1.7]) {
  const speeds = Array.from({ length: 100 }, (_, index) => getStackTravelSpeed(index + 1, viewportScale));
  assert(nonDecreasing(speeds));
}
assert(approx(getStackTravelSpeed(1, 1.7) / getStackTravelSpeed(1, 0.85), 2));
assert(approx(getStackTravelSpeed(60, 1.7) / getStackTravelSpeed(60, 0.85), 2));

const towerMaxGaps = Array.from({ length: 51 }, (_, index) =>
  getTowerPlatformGap(index * 100, 0.999999),
);
assert(nonDecreasing(towerMaxGaps));
assert(approx(getTowerPlatformGap(0, 0), 46));
assert(towerMaxGaps.every((value) => value >= 46 && value < 89.001));

assert.deepEqual(TYPE_RUSH_WAVES.map((wave) => wave.speedMultiplier), [0.9, 1, 1.08, 1.16]);
for (const wave of TYPE_RUSH_WAVES) {
  const values = [wave.startsAtSeconds, wave.startsAtSeconds + 15, wave.startsAtSeconds + 60, 1000]
    .map((elapsed) => getTypeRushBaseSpeed(elapsed, wave.speedMultiplier));
  assert(nonDecreasing(values));
  assert(values.every((value) => value >= 0.135 && value < 0.36));
  assert.equal(getTypeRushWave(wave.startsAtSeconds).index, wave.index);
}
assert(getTypeRushBaseSpeed(9999, TYPE_RUSH_WAVES[3].speedMultiplier) < 0.36);

const vanguardCaps: Record<VanguardEnemyKind, number> = {
  swarmer: 4.75,
  drone: 3.7,
  interceptor: 4.65,
  sniper: 1.55,
  heavy: 1.6,
};
for (const kind of Object.keys(vanguardCaps) as VanguardEnemyKind[]) {
  const speeds = Array.from({ length: 100 }, (_, index) => getVanguardEnemySpeed(kind, index + 1));
  assert(nonDecreasing(speeds), `Vanguard ${kind} speed should be monotonic`);
  assert(speeds.every((value) => value <= vanguardCaps[kind] + 1e-9));
}
const bossHp = Array.from({ length: 100 }, (_, index) => getVanguardBossHp(index + 1));
assert(nonDecreasing(bossHp));
assert(getVanguardBossHp(20) < 40 + 20 * 20);

const ropeWarnings = Array.from({ length: 33 }, (_, index) => getLaserRopeWarningFloor(2.2 + index * 0.1));
assert(nonDecreasing(ropeWarnings));
assert(approx(getLaserRopeWarningFloor(2.2), 0.38));
assert(approx(getLaserRopeWarningFloor(5.4), 0.45));

assert.equal(getPinballRescueImpulse(1.34), 0);
assert.equal(getPinballRescueImpulse(1.35), 120);
assert.equal(getPinballRescueImpulse(1.79), 120);
assert.equal(getPinballRescueImpulse(1.8), 150);

assert.deepEqual([0, 1, 2, 10].map(getBubbleDropCadence), [6, 6, 5, 5]);
assert.deepEqual([1, 4, 8, 20].map(getBreakoutMinimumSpecials), [2, 3, 4, 4]);

for (const previous of ['LEFT', 'RIGHT'] as const) {
  for (const randomValue of [0, 0.25, 0.5, 0.75, 0.999999]) {
    const forced = chooseBalancedReactionChoice(previous, 2, randomValue);
    assert.notEqual(forced, previous, 'Reaction choice streak exceeded two identical cues');
  }
}
assert.equal(getRhythmMissPenalty(100), 6);
assert.equal(getRhythmMissPenalty(56), 6);
assert.equal(getRhythmMissPenalty(55), 7);
assert.equal(getRhythmMissPenalty(0), 7);
assert(approx(getSlingshotNodeOffset(0), -95));
assert(Math.abs(getSlingshotNodeOffset(0.999999) - 95) < 0.001);

for (let cycle = 0; cycle < 4; cycle++) {
  const bag: number[] = [];
  const draws = Array.from({ length: 6 }, () => drawMergeTileFromBag(bag, () => (cycle + 1) / 5))
    .sort((a, b) => a - b);
  assert.deepEqual(draws, [2, 2, 4, 4, 8, 16]);
  assert.equal(bag.length, 0);
}

const railTimes = Array.from({ length: 91 }, (_, second) => second);
const railSpeeds = railTimes.map(getNeonRailSpeed);
const railIntervals = railTimes.map(getNeonRailSpawnInterval);
assert(nonDecreasing(railSpeeds) && nonIncreasing(railIntervals));
assert(approx(getNeonRailSpeed(0), NEON_RAIL_MIN_SPEED));
assert(approx(getNeonRailSpeed(90), NEON_RAIL_MAX_SPEED));
assert(approx(getNeonRailSpawnInterval(0), NEON_RAIL_MAX_SPAWN_INTERVAL));
assert(approx(getNeonRailSpawnInterval(90), NEON_RAIL_MIN_SPAWN_INTERVAL));
for (const second of [0, 15, 30, 45, 60, 75, 90]) {
  const speedPressure =
    (getNeonRailSpeed(second) - NEON_RAIL_MIN_SPEED) /
    (NEON_RAIL_MAX_SPEED - NEON_RAIL_MIN_SPEED);
  const spawnPressure =
    (NEON_RAIL_MAX_SPAWN_INTERVAL - getNeonRailSpawnInterval(second)) /
    (NEON_RAIL_MAX_SPAWN_INTERVAL - NEON_RAIL_MIN_SPAWN_INTERVAL);
  assert(approx(speedPressure, spawnPressure, 1e-9), `Rail pressure axes diverged at ${second}s`);
}

for (let modeOffset = 1; modeOffset <= 6; modeOffset++) {
  const configs = Array.from({ length: 25 }, (_, tier) => getKnifeStageConfig(modeOffset + tier * 6));
  assert(nonDecreasing(configs.map((config) => config.baseSpeed)));
  assert(configs.every((config) =>
    config.baseSpeed <= 5.0 && config.preBladeCount <= 5 && config.knifeCount <= 14));
}

for (let protocolOffset = 1; protocolOffset <= 6; protocolOffset++) {
  const normal = Array.from({ length: 20 }, (_, cycle) =>
    getPacGhostSpeed(protocolOffset + cycle * 6, false));
  const frightened = Array.from({ length: 20 }, (_, cycle) =>
    getPacGhostSpeed(protocolOffset + cycle * 6, true));
  assert(nonDecreasing(normal));
  assert(nonDecreasing(frightened));
  assert(normal.every((value) => value <= 5.45));
  assert(frightened.every((value) => value <= 3.25));
}

assert.deepEqual([1, 2, 3, 4].map(getChronoSpawnInterval), [88, 81, 75, 70]);
const chronoStageSpeeds = [1, 2, 3, 4].map((stage) => getChronoDesiredWallSpeed(stage, 2.15));
assert(nonDecreasing(chronoStageSpeeds));
assert(approx(getChronoDesiredWallSpeed(4, 99), (1.35 + 3 * 0.22) * 2.15));

// Archived compatibility-slot envelope: Gravity is retired from production,
 // but its historical fixed-step source remains regression-protected.
assert.equal(GRAVITY_MAX_STEPS_PER_FRAME, 3);
assert(approx(GRAVITY_MAX_FRAME_SEC, 0.05));
for (const accumulator of [0, GRAVITY_FIXED_STEP_SEC * 0.25, GRAVITY_FIXED_STEP_SEC * 0.999]) {
  for (const delta of [0, 1 / 120, 1 / 60, 0.05, 1]) {
    const batch = getGravityPhysicsStepBatch(accumulator, delta);
    assert(batch.steps <= GRAVITY_MAX_STEPS_PER_FRAME);
    assert(batch.remainderSec >= 0 && batch.remainderSec < GRAVITY_FIXED_STEP_SEC + 1e-8);
  }
}
assert.equal(
  getGravityPhysicsStepBatch(GRAVITY_FIXED_STEP_SEC * 0.999, 1).steps,
  GRAVITY_MAX_STEPS_PER_FRAME,
);

const finalChaos = PERFECT_STOP_ROUNDS.find((round) => round.id === 'final-chaos');
assert(finalChaos);
assert.equal(finalChaos.markerSpeedPerSecond, 188);
assert.equal(finalChaos.speedPulse, 0.24);
assert.equal(finalChaos.speedPulseHz, 0.86);
assert.equal(finalChaos.flipIntervalMs, 760);
assert.equal(finalChaos.perfectWindow, 1.7);
assert.equal(finalChaos.greatWindow, 4.4);
assert.equal(finalChaos.goodWindow, 8.2);
assert.equal(finalChaos.scoreMultiplier, 2.1);
assert(PERFECT_STOP_ROUNDS.every((round) =>
  round.perfectWindow < round.greatWindow && round.greatWindow < round.goodWindow));

// ---------------------------------------------------------------------------
// Integration ownership. The helper must still drive the live game path, not merely
// remain imported somewhere in the repository.
// ---------------------------------------------------------------------------

const integrationChecks: readonly [string, readonly string[]][] = [
  ['src/games/AirHockeyGame.tsx', ['diffConfig.aiSpeed * getAirHockeyOpeningPace(60 - state.timeLeft) * table.motionScale']],
  ['src/games/HexCapture.tsx', [
    'data-replacement-game="hex-capture"',
    'const GOAL = HEX_GOAL_PERCENT;',
    'const STEP_MS = HEX_STEP_MS;',
    'getHexClosureBonus(claimed, st.chain)',
    'getHexWinBonus(st.lives)',
    'const dt = Math.min(0.033',
  ]],
  ['src/games/BladeGame.tsx', ['state.spawnInterval = getBladeSpawnIntervalFrames(state.waveCount);']],
  ['src/games/BlockDropGame.tsx', ['state.dropInterval = getBlockDropInterval(state.level);']],
  ['src/games/BreakoutGame.tsx', ['const minimumSpecials = getBreakoutMinimumSpecials(round);']],
  ['src/games/BubbleBusterGame.tsx', ['state.shotsUntilDrop = getBubbleDropCadence(state.ceilingDrops);']],
  ['src/games/ChainGame.tsx', ['const reqPercent = getChainTargetPercent(waveNum);', 'const baseSpeed = getChainBaseSpeed(waveNum, Math.random());']],
  ['src/games/ChronoGame.tsx', ['desiredSpeed: getChronoDesiredWallSpeed(state.stage, state.speedMultiplier)', 'state.spawnInterval = getChronoSpawnInterval(nextStage);']],
  ['src/games/DodgeGame.tsx', ['const spawnDelay = getDodgeSpawnDelayMs(state.gameTime, state.hazards.length);']],
  ['src/games/DriftGame.tsx', ['proposedKind === st.lastSpawnKind', "proposedKind === 'hazard' || proposedKind === 'rival'"]],
  ['src/games/FlappyAeroGame.tsx', ['const gapHeight = getFlappyAeroGap(state.gatesCleared);', 'const baseScrollSpeed = getFlappyAeroScrollSpeed(state.gatesCleared);']],
  ['src/games/VectorGolf.tsx', [
    'data-replacement-game="vector-golf"',
    'const HOLES: Hole[] = [',
    'const dt = Math.min(0.033',
    'VECTOR_STROKE_LIMIT_OVER_PAR',
    'getVectorHoleScore(',
  ]],
  ['src/games/KnifeTargetGame.tsx', ['const config = getKnifeStageConfig(stageNum);', 'const stageConfig = getKnifeStageConfig(state.stage);']],
  ['src/games/LaserRopeGame.tsx', ['getLaserRopeWarningFloor(']],
  ['src/games/MatrixGame.tsx', ['state.round % 3 === 0 && !state.overclockActive', 'setReplaysLeft((current) => Math.min(2, current + 1))']],
  ['src/games/MergeGame.tsx', ['const getNewTileValue = () => drawMergeTileFromBag(tileBagRef.current);']],
  ['src/games/NeonRailShiftGame.tsx', ['getNeonRailSpeed(state.elapsed)', 'state.spawnTimer += getNeonRailSpawnInterval(state.elapsed);']],
  ['src/games/OneLineGame.tsx', ['if (archetype === state.lastArchetype)', 'state.lastArchetype = archetype;']],
  ['src/games/OrbitGame.tsx', ['const hazardInterval = getOrbitHazardIntervalMs(state.gameTime);']],
  ['src/games/PacMazeGame.tsx', ['getPacGhostSpeed(state.level, isFrightened)', 'state.frightenedTimer = getPacFrightenedDuration(state.level);']],
  ['src/games/PerfectStopGame.tsx', ['const PERFECT_STOP_SESSION_ROUNDS = [...PERFECT_STOP_ROUNDS', 'const speed = getPerfectStopMarkerSpeed(config, elapsed);']],
  ['src/games/PinballGame.tsx', ['const rescueImpulse = getPinballRescueImpulse(ball.lowSpeedTime);']],
  ['src/games/PulseGame.tsx', ['const comboBoost = getPulseComboBpmBoost(state.combo);']],
  ['src/games/ReactionGame.tsx', ['chooseBalancedReactionChoice(lastChoiceRef.current, choiceStreakRef.current, Math.random())']],
  ['src/games/RhythmGame.tsx', ['getRhythmMissPenalty(state.grooveHealth)']],
  ['src/games/RoadCrossGame.tsx', ['getRoadCrossLaneSpeed(getRoadCrossDistrictLevel(nextRow) * ROAD_CROSS_DISTRICT_LENGTH, Math.random())']],
  ['src/games/SlingshotGame.tsx', ['prevX + getSlingshotNodeOffset(Math.random())']],
  ['src/games/SnakeGame.tsx', ['state.tickInterval = getSnakeTickIntervalMs(state.snake.length);']],
  ['src/games/StackGame.tsx', ['state.speed = getStackTravelSpeed(', 'state.blocks.length', 'clamp(state.viewportWidth / 500, 0.85, 1.7)']],
  ['src/games/TowerGame.tsx', ['const gapY = getTowerPlatformGap(state.highestPlatformY, Math.random());']],
  ['src/games/TypeRushGame.tsx', ['const baseSpeed = getTypeRushBaseSpeed(state.gameTime, wave.speedMultiplier);']],
  ['src/games/VanguardGame.tsx', ['const bossMaxHp = getVanguardBossHp(state.wave);', "getVanguardEnemySpeed('swarmer', state.wave)", "getVanguardEnemySpeed('heavy', state.wave)"]],
];
assert.equal(integrationChecks.length, 32);

const replacementRuntime = read('src/lib/replacementGames.tsx');
const vite = read('vite.config.ts');
for (const token of [
  "game.id === 'gravity'",
  "import('../games/VectorGolf')",
  "game.id === 'astroblaster'",
  "import('../games/HexCapture')",
]) assert(replacementRuntime.includes(token), `production replacement mapping missing: ${token}`);
for (const token of [
  "'../games/GravityGame': path.resolve(import.meta.dirname, 'src/games/VectorGolf.tsx')",
  "'../games/AstroBlasterGame': path.resolve(import.meta.dirname, 'src/games/HexCapture.tsx')",
]) assert(vite.includes(token), `production bundle alias missing: ${token}`);

for (const [file, tokens] of integrationChecks) {
  const source = read(file);
  for (const token of tokens) assert(source.includes(token), `${file}: P25 live integration missing ${token}`);
}

// Guard the most important pre-P25 failure modes from silently returning.
const legacyFormulaGuards: readonly [string, string][] = [
  ['src/games/RoadCrossGame.tsx', '(Math.random() * 60 + 65) * dir'],
  ['src/games/SnakeGame.tsx', 'Math.floor(state.score / 600) * 3'],
  ['src/games/TypeRushGame.tsx', 'state.gameTime * 0.0028'],
  ['src/games/VanguardGame.tsx', '40 + state.wave * 20'],
  ['src/games/StackGame.tsx', '3.5 * clamp(state.viewportWidth / 500'],
  ['src/games/BladeGame.tsx', 'state.spawnInterval = 48'],
  ['src/games/BladeGame.tsx', 'getBladeSpawnIntervalFrames(state.score)'],
];
for (const [file, token] of legacyFormulaGuards) {
  assert(!read(file).includes(token), `${file}: legacy pre-P25 pressure formula returned: ${token}`);
}

const gravityRuntime = read('src/lib/gravityRuntime.ts');
assert(gravityRuntime.includes('GRAVITY_MAX_STEPS_PER_FRAME = 3'), 'Gravity explicit cap no longer matches the real 50 ms / 60 Hz bound');
assert(!gravityRuntime.includes('GRAVITY_MAX_STEPS_PER_FRAME = 6'), 'Gravity reverted to the nominal but unreachable six-step cap');

// Score comparability: P25 helpers and specialist balance modules must not become score-award paths.
const balanceSources = [
  'src/lib/gamePolishBalance.ts',
  'src/lib/chronoWavePlanner.ts',
  'src/lib/gravityRuntime.ts',
  'src/lib/knifeStageProgression.ts',
  'src/lib/neonRailShift.ts',
  'src/lib/pacGhostAi.ts',
];
for (const file of balanceSources) {
  const source = read(file);
  assert(!source.includes('score +='), `${file}: balance helper must not directly award raw score`);
  assert(!source.includes('onScoreUpdate('), `${file}: balance helper must not publish raw score`);
}

// Current phase continuity.
const p24 = read('docs/P24_DEFINITIVE_32_S_CERTIFICATION.md');
assert(p24.includes('## 2026-10-01 definitive current-source hardening'), 'P25 is not based on the hardened P24 current-source certification');
assert(p24.includes('**32 S / 0 A / 0 B**'), 'P25 lost the frozen 32/32 S-rank baseline');

const p25Doc = read('docs/P25_DEEP_GAME_POLISH.md');
for (const marker of [
  '# P25 — Deep Gameplay Polish & Balance Pass',
  '## 2026-10-01 all-game balance hardening addendum',
  'The original P25 balance envelopes remain frozen.',
  'No raw scoring formula or P24 scorecard is changed by this hardening pass.',
  'Laser Blade cadence now follows authored wave count',
  'Vector Golf and Hex Capture replace the retired Gravity/Astro engines in the current live-integration ledger.',
  '32 live integration paths',
]) assert(p25Doc.includes(marker), `P25 documentation missing current hardening evidence: ${marker}`);

const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
assert(pkg.scripts?.['quality:gameplay-p25'] === 'bun scripts/audit-gameplay-p25.ts', 'package.json is missing quality:gameplay-p25');
const ci = read('.github/workflows/ci.yml');
assert(ci.includes('bun run quality:gameplay-p25'), 'CI does not enforce quality:gameplay-p25');

console.log('P25 DEEP GAME POLISH — PASS');
console.log('32/32 live integration paths and their bounded pacing/fairness envelopes are certified without changing raw score formulas or the P24 score ledger.');
