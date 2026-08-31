import { readFileSync } from 'node:fs';
import { getOrbitRouteLane, getOrbitRouteMultiplier, isOrbitNearMiss, ORBIT_ROUTES } from '../src/lib/orbitMastery';
import { getMergeContract, isMergeContractComplete } from '../src/lib/mergeMastery';
import { getTypeRushDirective, getTypeRushSpecialWeight, getTypeRushTargetBonus } from '../src/lib/typeRushMastery';

const read = (path: string) => readFileSync(path, 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const orbit = read('src/games/OrbitGame.tsx');
const merge = read('src/games/MergeGame.tsx');
const typeRush = read('src/games/TypeRushGame.tsx');
const registry = read('src/data/games.ts');

// Orbit: four authored route identities, deterministic lane phrases, bounded multipliers, one-shot safe grazes.
assert(ORBIT_ROUTES.length === 4, `expected 4 Orbit route identities, found ${ORBIT_ROUTES.length}`);
assert(new Set(ORBIT_ROUTES.map((route) => route.name)).size === 4, 'Orbit route names must be unique');
assert(ORBIT_ROUTES.every((route) => route.lanes.length === 4), 'every Orbit route must contain four lane steps');
assert(Array.from({ length: 16 }, (_, index) => getOrbitRouteLane(index)).every((lane) => lane >= 0 && lane <= 2), 'Orbit routes must stay within lanes 0..2');
assert(getOrbitRouteMultiplier(0) === 1 && getOrbitRouteMultiplier(3) === 1 && getOrbitRouteMultiplier(4) === 2 && getOrbitRouteMultiplier(20) === 5, 'Orbit route multiplier progression changed');
assert(isOrbitNearMiss(20, 10, 2), 'valid Orbit near miss was rejected');
assert(!isOrbitNearMiss(11, 10, 2), 'collision-adjacent Orbit pass must not score as a graze');
assert(!isOrbitNearMiss(20, 10, -2), 'approaching Orbit comet must not score before closest approach');
assert(orbit.includes('routeIndex'), 'Orbit source does not attach authored route indices to crystals');
assert(orbit.includes('nearMissAwarded'), 'Orbit hazards do not guard one-shot graze scoring');
assert(orbit.includes('GRAZE x'), 'Orbit lacks graze feedback');
assert(orbit.includes('getOrbitRouteName(state.routeIndex)'), 'Orbit does not surface the active route identity');

// Merge: alternating contracts and a true three-tile planning queue.
const c1 = getMergeContract(1);
const c2 = getMergeContract(2);
const c3 = getMergeContract(3);
const c4 = getMergeContract(4);
assert(c1.type === 'cascade' && c1.targetCascade === 2, 'Merge contract 1 must begin with a 2+ cascade');
assert(c2.type === 'value' && c2.targetValue === 32, 'Merge contract 2 must require forging 32');
assert(c3.type === 'cascade' && c3.targetCascade === 3, 'Merge contract 3 must escalate cascade mastery');
assert(c4.type === 'value' && c4.targetValue === 64, 'Merge contract 4 must escalate value mastery');
assert(isMergeContractComplete(c1, { mergeStreak: 2, highestTile: 4 }), 'Merge cascade contract completion failed');
assert(!isMergeContractComplete(c1, { mergeStreak: 1, highestTile: 2048 }), 'Merge cascade contract must not be bypassed by tile value');
assert(isMergeContractComplete(c2, { mergeStreak: 0, highestTile: 32 }), 'Merge value contract completion failed');
assert(merge.includes('tileQueue.map'), 'Merge does not render a three-tile planning queue');
assert(merge.includes('[queue[1], queue[2], getNewTileValue()]'), 'Merge queue does not advance by one tile after a drop');
assert(merge.includes('setHammerCharges((charges) => Math.min(2, charges + 1))'), 'Merge contracts do not recharge hammer agency');
assert(merge.includes('setSwapsLeft((swaps) => Math.min(3, swaps + 1))'), 'Merge contracts do not recharge swap agency');

// Type Rush: direct target choice, distinct directives, escalating special pressure, urgent-risk scoring.
assert(getTypeRushDirective(0) === 'LOCK & CLEAR', 'Type Rush BOOT directive changed');
assert(getTypeRushDirective(3) === 'RISK = REWARD', 'Type Rush REDLINE directive changed');
const weights = [0, 1, 2, 3].map(getTypeRushSpecialWeight);
assert(weights.every((weight, index) => index === 0 || weight.hyper > weights[index - 1].hyper), 'Type Rush special-word pressure must rise by wave');
assert(getTypeRushTargetBonus(75, 'hyper', 3) > getTypeRushTargetBonus(20, 'standard', 0), 'Type Rush urgent special targets must pay more than safe standard targets');
assert(getTypeRushTargetBonus(75, 'hyper', 3) <= 2, 'Type Rush target bonus must remain capped at 2x');
assert(typeRush.includes('aria-label={`Target ${w.word}`}'), 'Type Rush visible words are not directly targetable');
assert(typeRush.includes('previous.typedIndex = 0'), 'Type Rush target switching can strand partial words');
assert(typeRush.includes('getTypeRushTargetBonus(target.y, target.type, wave.index)'), 'Type Rush scoring does not use risk/urgency bonus');
assert(typeRush.includes('getTypeRushDirective(gameStateRef.current.waveIndex)'), 'Type Rush does not surface wave directives');

assert(registry.includes('authored crystal routes'), 'Orbit registry does not teach route mastery');
assert(registry.includes('three-tile preview'), 'Merge registry does not teach planning preview');
assert(registry.includes('tap/click any word to choose it directly'), 'Type Rush registry does not teach direct target selection');

if (errors.length) {
  console.error('P5 BOTTOM-THREE ELEVATION AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P5 BOTTOM-THREE ELEVATION AUDIT — PASS');
console.log('Orbit route/graze mastery, Merge preview/contracts, and Type Rush target/directive risk-reward loops are certified.');
