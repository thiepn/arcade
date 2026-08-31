import { readFileSync } from 'node:fs';
import {
  MATRIX_OVERCLOCK,
  canArmMatrixOverclock,
  getMatrixClearPoints,
  getMatrixPlaybackSpeed,
  getMatrixSequenceLength,
  getMatrixStepPoints,
} from '../src/lib/matrixMastery';
import {
  findKnifeRazorTarget,
  getKnifeRazorBonus,
  getKnifeRazorTolerance,
  isKnifeRazorHit,
  isKnifeRazorRush,
} from '../src/lib/knifeMastery';
import {
  NEON_RAIL_MAX_SURGE_CHARGES,
  NEON_RAIL_MASTERY_STREAK,
  NEON_RAIL_SURGE_DURATION,
  NEON_RAIL_SURGE_SCORE_MULTIPLIER,
  NEON_RAIL_SURGE_SPEED_MULTIPLIER,
  getNeonRailMasteryReward,
  isNeonRailMasteryMilestone,
} from '../src/lib/neonRailMastery';
import { MATRIX_PROTOCOLS } from '../src/lib/matrixProtocols';
import { getKnifeStageConfig } from '../src/lib/knifeStageProgression';
import { createNeonRailPhrase } from '../src/lib/neonRailDepth';

const read = (path: string) => readFileSync(path, 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

// Memory Matrix — P2 protocols stay intact while Overclock adds opt-in risk/reward.
assert(MATRIX_PROTOCOLS.length === 4, 'Matrix P2 protocol roster changed');
assert(MATRIX_OVERCLOCK.sequenceBonus === 2, 'Matrix Overclock must add exactly two sequence nodes');
assert(MATRIX_OVERCLOCK.playbackScale < 1 && MATRIX_OVERCLOCK.playbackScale >= 0.7, 'Matrix Overclock playback scaling is outside a readable range');
assert(MATRIX_OVERCLOCK.stepScoreMultiplier > 1, 'Matrix Overclock does not reward harder step recall');
assert(MATRIX_OVERCLOCK.clearScoreMultiplier > MATRIX_OVERCLOCK.stepScoreMultiplier, 'Matrix Overclock clear reward is not meaningfully stronger');
assert(MATRIX_OVERCLOCK.disablesManualReplay, 'Matrix Overclock must disable manual replay');
assert(canArmMatrixOverclock(1, 3), 'Matrix Overclock cannot be armed during a valid run');
assert(!canArmMatrixOverclock(2, 0), 'Matrix Overclock can be armed after all lives are lost');
assert(getMatrixSequenceLength(5, true) === 7, 'Matrix Overclock sequence bonus changed');
assert(getMatrixPlaybackSpeed(300, true) < getMatrixPlaybackSpeed(300, false), 'Matrix Overclock is not faster than standard playback');
assert(getMatrixPlaybackSpeed(120, true) >= 140, 'Matrix Overclock playback can fall below readability floor');
assert(getMatrixStepPoints(200, true) > getMatrixStepPoints(200, false), 'Matrix Overclock step scoring does not increase');
assert(getMatrixClearPoints(1200, true) > getMatrixClearPoints(1200, false), 'Matrix Overclock clear scoring does not increase');

// Knife Target — every generated Razor Mark must remain attainable and reward precision chains.
assert(getKnifeRazorTolerance(1) > getKnifeRazorTolerance(30), 'Knife Razor tolerance does not tighten with mastery tiers');
assert(getKnifeRazorTolerance(100) >= 0.09, 'Knife Razor tolerance falls below fairness floor');
assert(isKnifeRazorRush(3) && !isKnifeRazorRush(2), 'Knife Razor Rush threshold changed');
assert(getKnifeRazorBonus(3, 6) > getKnifeRazorBonus(1, 1), 'Knife Razor chain/stage mastery does not increase reward');
for (let stage = 1; stage <= 18; stage++) {
  const config = getKnifeStageConfig(stage);
  const embedded = [0.2, 1.8, 4.1];
  const shields = Array.from({ length: config.shieldCount }, (_, index) => ({
    startAngle: 0.25 + (index / Math.max(1, config.shieldCount)) * Math.PI * 2,
    spanAngle: config.shieldSpan,
  }));
  const target = findKnifeRazorTarget(stage, stage + 2, embedded, shields);
  assert(Number.isFinite(target) && target >= 0 && target < Math.PI * 2, `Knife stage ${stage} Razor target escaped angular bounds`);
  assert(isKnifeRazorHit(target, target, stage), `Knife stage ${stage} exact Razor target is not a precision hit`);
  assert(!isKnifeRazorHit(target + 0.5, target, stage), `Knife stage ${stage} Razor hit window is excessively wide`);
}

// Neon Rail — sustained phrase-level accuracy earns a bounded, player-spendable Surge.
assert(NEON_RAIL_MASTERY_STREAK === 6, 'Neon Rail mastery streak must match the six-row authored phrases');
assert(NEON_RAIL_MAX_SURGE_CHARGES === 2, 'Neon Rail Surge charge cap changed');
assert(NEON_RAIL_SURGE_DURATION >= 4 && NEON_RAIL_SURGE_DURATION <= 7, 'Neon Rail Surge duration is outside an arcade-readable window');
assert(NEON_RAIL_SURGE_SPEED_MULTIPLIER > 1 && NEON_RAIL_SURGE_SPEED_MULTIPLIER <= 1.25, 'Neon Rail Surge speed risk is outside bounded range');
assert(NEON_RAIL_SURGE_SCORE_MULTIPLIER === 2, 'Neon Rail Surge should remain a clear 2x scoring wager');
assert(isNeonRailMasteryMilestone(6) && isNeonRailMasteryMilestone(12), 'Neon Rail mastery milestones no longer repeat every phrase length');
assert(!isNeonRailMasteryMilestone(5) && !isNeonRailMasteryMilestone(7), 'Neon Rail mastery triggers off-cycle');
assert(getNeonRailMasteryReward(12) > getNeonRailMasteryReward(6), 'Neon Rail repeated mastery does not escalate reward');
for (const start of [0, 1, 2] as const) {
  assert(createNeonRailPhrase(start, 0.2).lanes.length === NEON_RAIL_MASTERY_STREAK, 'Neon Rail authored phrase length no longer matches mastery cadence');
}

const matrix = read('src/games/MatrixGame.tsx');
const knife = read('src/games/KnifeTargetGame.tsx');
const rail = read('src/games/NeonRailShiftGame.tsx');
const registry = read('src/data/games.ts');

for (const token of ['MATRIX_OVERCLOCK', 'getMatrixSequenceLength', 'overclockActive', 'overclockArmed', 'OVERCLOCK NEXT', "key === 'O'"]) {
  assert(matrix.includes(token), `Matrix P7 integration missing ${token}`);
}
assert(matrix.includes('state.overclockActive || replaysLeft <= 0'), 'Matrix Overclock does not disable manual replay');

for (const token of ['findKnifeRazorTarget', 'isKnifeRazorHit', 'precisionTargetAngle', 'precisionChain', 'RAZOR RUSH']) {
  assert(knife.includes(token), `Knife Target P7 integration missing ${token}`);
}
assert(knife.includes('getKnifeRazorTolerance(state.stage)'), 'Knife Target does not render the stage-scaled Razor window');

for (const token of ['isNeonRailMasteryMilestone', 'triggerSurge', 'surgeCharges', 'surgeTimer', "event.code === 'ShiftLeft'", 'SURGE']) {
  assert(rail.includes(token), `Neon Rail P7 integration missing ${token}`);
}
assert(rail.includes('NEON_RAIL_MAX_SURGE_CHARGES'), 'Neon Rail Surge charges are not bounded');

for (const phrase of ['optional Overclock rounds', 'Razor Marks', 'six consecutive route cores']) {
  assert(registry.includes(phrase), `registry is missing P7 teaching phrase: ${phrase}`);
}

if (errors.length) {
  console.error('P7 MASTERY TRIO AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P7 MASTERY TRIO AUDIT — PASS');
console.log('Matrix Overclock, Knife Razor Marks, and Neon Rail Surge risk/reward mastery are certified.');
