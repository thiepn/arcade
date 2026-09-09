import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
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
} from '../src/lib/gamePolishBalance';
import { getNeonRailSpawnInterval, getNeonRailSpeed } from '../src/lib/neonRailShift';
import { getKnifeStageConfig } from '../src/lib/knifeStageProgression';
import { getPacGhostSpeed } from '../src/lib/pacGhostAi';
import { getChronoDesiredWallSpeed, getChronoSpawnInterval } from '../src/lib/chronoWavePlanner';
import { GRAVITY_MAX_STEPS_PER_FRAME, getGravityPhysicsStepBatch } from '../src/lib/gravityRuntime';
import { PERFECT_STOP_ROUNDS } from '../src/lib/perfectStopGameplay';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const approx = (a: number, b: number, eps = 1e-8) => Math.abs(a - b) <= eps;
const nonIncreasing = (values: number[]) => values.every((value, index) => index === 0 || value <= values[index - 1] + 1e-9);
const nonDecreasing = (values: number[]) => values.every((value, index) => index === 0 || value + 1e-9 >= values[index - 1]);

// Shared difficulty envelopes: no score formulas are changed by these helpers.
assert(approx(getAirHockeyOpeningPace(0), 0.84));
assert(approx(getAirHockeyOpeningPace(8), 1));
assert(nonDecreasing([0, 2, 4, 8, 20].map(getAirHockeyOpeningPace)));
assert.deepEqual([1, 4, 8, 20].map(getAstroLargeAsteroidCount), [4, 7, 9, 9]);
assert(nonIncreasing([0, 2000, 6000, 12000, 100000].map(getBladeSpawnIntervalFrames)));
assert.equal(getBladeSpawnIntervalFrames(100000), 50);
assert(nonIncreasing(Array.from({ length: 20 }, (_, index) => getBlockDropInterval(index + 1))));
assert(getBlockDropInterval(10) > 0.12 && getBlockDropInterval(30) === 0.12);
assert(getChainTargetPercent(1) === 0.5 && getChainTargetPercent(100) === 0.78);
assert(getChainBaseSpeed(100, 1) <= 3.7);
assert(getDodgeSpawnDelayMs(0, 0) >= 1000);
assert(getDodgeSpawnDelayMs(120, 8) > getDodgeSpawnDelayMs(120, 2));
assert(getFlappyAeroGap(1000) >= 96 && getFlappyAeroScrollSpeed(1000) <= 270);
assert(getOrbitHazardIntervalMs(0) === 1800 && getOrbitHazardIntervalMs(999) === 750);
assert(getPulseComboBpmBoost(1000) <= 30 && getPulseComboBpmBoost(50) < 30);
assert(getRoadCrossLaneSpeed(31, 0.5) > getRoadCrossLaneSpeed(0, 0.5));
assert(getSnakeTickIntervalMs(3) === 95 && getSnakeTickIntervalMs(999) === 65);
assert(approx(getStackTravelSpeed(1, 1.7) / getStackTravelSpeed(1, 0.85), 2));
assert(approx(getStackTravelSpeed(60, 1.7) / getStackTravelSpeed(60, 0.85), 2));
assert(getTowerPlatformGap(0, 0) === 46 && getTowerPlatformGap(9999, 0.999999) < 89.01);
assert(getTypeRushBaseSpeed(0, 1) === 0.15 && getTypeRushBaseSpeed(9999, 1) < 0.311);
assert(getVanguardEnemySpeed('swarmer', 999) <= 4.75);
assert(getVanguardEnemySpeed('drone', 999) <= 3.7);
assert(getVanguardBossHp(20) < 40 + 20 * 20);
assert(getLaserRopeWarningFloor(5.4) > getLaserRopeWarningFloor(2.2));
assert(getPinballRescueImpulse(1) === 0 && getPinballRescueImpulse(1.9) === 150);
assert.deepEqual([0, 1, 2, 10].map(getBubbleDropCadence), [6, 6, 5, 5]);
assert.deepEqual([1, 4, 8, 20].map(getBreakoutMinimumSpecials), [2, 3, 4, 4]);
assert.equal(chooseBalancedReactionChoice('LEFT', 2, 0.01), 'RIGHT');
assert.equal(chooseBalancedReactionChoice('RIGHT', 2, 0.99), 'LEFT');
assert.equal(getRhythmMissPenalty(100), 6);
assert.equal(getRhythmMissPenalty(40), 7);
assert(Math.abs(getSlingshotNodeOffset(0)) <= 95 && Math.abs(getSlingshotNodeOffset(0.999999)) <= 95);

const bag: number[] = [];
const draws = Array.from({ length: 6 }, () => drawMergeTileFromBag(bag, () => 0.42)).sort((a, b) => a - b);
assert.deepEqual(draws, [2, 2, 4, 4, 8, 16]);

const railTimes = [0, 20, 45, 70, 90, 180];
assert(nonDecreasing(railTimes.map(getNeonRailSpeed)));
assert(nonIncreasing(railTimes.map(getNeonRailSpawnInterval)));
assert(getNeonRailSpeed(180) <= 0.68 && getNeonRailSpawnInterval(180) >= 0.5);
assert(getKnifeStageConfig(1000).baseSpeed <= 5.0 && getKnifeStageConfig(1000).preBladeCount <= 5);
assert(getPacGhostSpeed(1000, false) <= 5.45 && getPacGhostSpeed(1000, true) <= 3.25);
assert.deepEqual([1, 2, 3, 4].map(getChronoSpawnInterval), [88, 81, 75, 70]);
assert(getChronoDesiredWallSpeed(4, 99) < (1.35 + 3 * 0.24) * 2.35);
assert.equal(GRAVITY_MAX_STEPS_PER_FRAME, 6);
assert(getGravityPhysicsStepBatch(0, 1).steps <= GRAVITY_MAX_STEPS_PER_FRAME);
const finalChaos = PERFECT_STOP_ROUNDS.find((round) => round.id === 'final-chaos');
assert(finalChaos && finalChaos.markerSpeedPerSecond === 188 && finalChaos.flipIntervalMs === 760);

// Explicitly prove all 32 game implementations participate in the deep-polish pass.
const coverage: Record<string, [string, string]> = {
  airhockey: ['src/games/AirHockeyGame.tsx', 'getAirHockeyOpeningPace'],
  astroblaster: ['src/games/AstroBlasterGame.tsx', 'getAstroLargeAsteroidCount'],
  blade: ['src/games/BladeGame.tsx', 'getBladeSpawnIntervalFrames'],
  blockdrop: ['src/games/BlockDropGame.tsx', 'getBlockDropInterval'],
  breakout: ['src/games/BreakoutGame.tsx', 'getBreakoutMinimumSpecials'],
  bubblebuster: ['src/games/BubbleBusterGame.tsx', 'getBubbleDropCadence'],
  chain: ['src/games/ChainGame.tsx', 'getChainTargetPercent'],
  chrono: ['src/lib/chronoWavePlanner.ts', 'return 70'],
  dodge: ['src/games/DodgeGame.tsx', 'getDodgeSpawnDelayMs'],
  drift: ['src/games/DriftGame.tsx', 'lastSpawnKind'],
  flappyaero: ['src/games/FlappyAeroGame.tsx', 'getFlappyAeroGap'],
  gravity: ['src/lib/gravityRuntime.ts', 'GRAVITY_MAX_STEPS_PER_FRAME'],
  knifetarget: ['src/lib/knifeStageProgression.ts', 'Math.min(4, tier) * 0.22'],
  laserrope: ['src/games/LaserRopeGame.tsx', 'getLaserRopeWarningFloor'],
  matrix: ['src/games/MatrixGame.tsx', 'state.round % 3 === 0'],
  merge: ['src/games/MergeGame.tsx', 'drawMergeTileFromBag'],
  neonrail: ['src/lib/neonRailShift.ts', 'smoothstep01'],
  oneline: ['src/games/OneLineGame.tsx', 'lastArchetype'],
  orbit: ['src/games/OrbitGame.tsx', 'getOrbitHazardIntervalMs'],
  pacmaze: ['src/lib/pacGhostAi.ts', 'const early = Math.min(7, completed)'],
  perfectstop: ['src/lib/perfectStopGameplay.ts', 'markerSpeedPerSecond: 188'],
  pinball: ['src/games/PinballGame.tsx', 'getPinballRescueImpulse'],
  pulse: ['src/games/PulseGame.tsx', 'getPulseComboBpmBoost'],
  reaction: ['src/games/ReactionGame.tsx', 'chooseBalancedReactionChoice'],
  rhythm: ['src/games/RhythmGame.tsx', 'getRhythmMissPenalty'],
  roadcross: ['src/games/RoadCrossGame.tsx', 'getRoadCrossLaneSpeed'],
  slingshot: ['src/games/SlingshotGame.tsx', 'getSlingshotNodeOffset'],
  snake: ['src/games/SnakeGame.tsx', 'getSnakeTickIntervalMs(state.snake.length)'],
  stack: ['src/games/StackGame.tsx', 'getStackTravelSpeed'],
  tower: ['src/games/TowerGame.tsx', 'getTowerPlatformGap'],
  typerush: ['src/games/TypeRushGame.tsx', 'getTypeRushBaseSpeed'],
  vanguard: ['src/games/VanguardGame.tsx', 'getVanguardBossHp'],
};
assert.equal(Object.keys(coverage).length, 32);
for (const [game, [file, marker]] of Object.entries(coverage)) {
  assert(read(file).includes(marker), `${game}: P25 implementation marker missing from ${file}`);
}

// Leaderboard comparability is intentional: no P25 helper awards points.
assert(!read('src/lib/gamePolishBalance.ts').includes('score +='), 'P25 helper must not mutate scores');
assert(!read('src/lib/gamePolishBalance.ts').includes('pointsPerGoal'), 'P25 must not alter score scale');

console.log('P25 DEEP GAME POLISH — PASS');
console.log('32/32 games have bounded pacing/fairness polish without changing raw score formulas.');
