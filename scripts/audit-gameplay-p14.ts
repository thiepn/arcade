import { readFileSync } from 'node:fs';
import {
  RHYTHM_HOLD_RELEASE_GRACE_MS,
  getRhythmHoldCompletionBonus,
  getRhythmHoldEndBeat,
  isRhythmHoldComplete,
  shouldBreakRhythmHold,
} from '../src/lib/rhythmHoldMastery';
import { RHYTHM_HIT_WINDOWS_MS } from '../src/lib/rhythmTiming';
import {
  BLOCK_DROP_PIECES,
  drawBlockDropBagPiece,
  resolveBlockDropLineMastery,
} from '../src/lib/blockDropMastery';
import {
  BLADE_PRECISION_CHAIN_CAP,
  BLADE_PRECISION_RATIO,
  isBladePrecisionSlice,
  resolveBladePrecisionSlice,
} from '../src/lib/bladePrecisionMastery';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};
const read = (path: string) => readFileSync(path, 'utf8');

// Rhythm: hold notes must require sustained lane ownership without changing P0 head windows.
assert(RHYTHM_HIT_WINDOWS_MS.perfect === 70, 'P14 changed Rhythm PERFECT head timing');
assert(RHYTHM_HIT_WINDOWS_MS.great === 125, 'P14 changed Rhythm GREAT head timing');
assert(RHYTHM_HIT_WINDOWS_MS.good === 190, 'P14 changed Rhythm GOOD head timing');
assert(RHYTHM_HOLD_RELEASE_GRACE_MS >= 60 && RHYTHM_HOLD_RELEASE_GRACE_MS <= 140, 'hold release grace is not bounded');
assert(getRhythmHoldEndBeat(4, 2.5) === 6.5, 'hold end beat calculation regressed');
assert(!isRhythmHoldComplete(5.9, 4, 2), 'hold completes before its tail');
assert(isRhythmHoldComplete(6, 4, 2), 'hold does not complete at its tail');
assert(!shouldBreakRhythmHold({ judgementBeat: 4.1, startBeat: 4, holdBeats: 2, bpm: 120, laneHeld: false }), 'brief release inside grace breaks hold');
assert(shouldBreakRhythmHold({ judgementBeat: 4.3, startBeat: 4, holdBeats: 2, bpm: 120, laneHeld: false }), 'early released hold is not broken');
assert(!shouldBreakRhythmHold({ judgementBeat: 5, startBeat: 4, holdBeats: 2, bpm: 120, laneHeld: true }), 'held lane incorrectly breaks hold');
assert(!shouldBreakRhythmHold({ judgementBeat: 6.1, startBeat: 4, holdBeats: 2, bpm: 120, laneHeld: false }), 'completed hold is treated as broken');
assert(getRhythmHoldCompletionBonus(2, 2) > getRhythmHoldCompletionBonus(1, 1), 'hold reward does not scale with duration/multiplier');

// Block Drop: every seven draws contain all seven tetrominoes exactly once.
let seed = 0x14b10c;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x1_0000_0000;
};
const bag: typeof BLOCK_DROP_PIECES[number][] = [];
const draws = Array.from({ length: 21 }, () => drawBlockDropBagPiece(bag, random));
const canonical = [...BLOCK_DROP_PIECES].sort().join('');
for (let offset = 0; offset < draws.length; offset += 7) {
  assert(draws.slice(offset, offset + 7).sort().join('') === canonical, `7-bag ${offset / 7 + 1} is missing or duplicating a tetromino`);
}
const firstClear = resolveBlockDropLineMastery({ clearedLines: 1, level: 2, clearChain: 0, backToBack: false });
assert(firstClear.clearChain === 1 && firstClear.comboBonus === 0, 'first line clear should start chain without bonus');
const secondClear = resolveBlockDropLineMastery({ clearedLines: 2, level: 2, clearChain: firstClear.clearChain, backToBack: false });
assert(secondClear.clearChain === 2 && secondClear.comboBonus === 100, 'consecutive line clear bonus regressed');
const tetrisOne = resolveBlockDropLineMastery({ clearedLines: 4, level: 3, clearChain: 0, backToBack: false });
const tetrisTwo = resolveBlockDropLineMastery({ clearedLines: 4, level: 3, clearChain: tetrisOne.clearChain, backToBack: tetrisOne.backToBack });
assert(tetrisOne.backToBack && tetrisOne.backToBackBonus === 0, 'first Tetris should arm B2B without paying it');
assert(tetrisTwo.backToBackBonus === 1500, 'back-to-back Tetris bonus regressed');
const emptyPlacement = resolveBlockDropLineMastery({ clearedLines: 0, level: 3, clearChain: 4, backToBack: true });
assert(emptyPlacement.clearChain === 0 && emptyPlacement.backToBack, 'empty placement should break clear chain but preserve Tetris B2B eligibility');

// Laser Blade: center-line precision is optional and bounded.
assert(BLADE_PRECISION_RATIO > 0.2 && BLADE_PRECISION_RATIO < 0.4, 'Blade precision window is not meaningfully tighter than normal slicing');
assert(BLADE_PRECISION_CHAIN_CAP === 8, 'Blade precision chain cap changed');
assert(isBladePrecisionSlice(10, 40), 'valid center cut is not recognized');
assert(!isBladePrecisionSlice(20, 40), 'wide ordinary cut is incorrectly treated as precision');
let precision = resolveBladePrecisionSlice(5, 40, 0);
assert(precision.precise && precision.chain === 1 && precision.bonus > 0, 'first precision cut does not start Razor chain');
precision = resolveBladePrecisionSlice(5, 40, 3);
assert(precision.chain === 4 && precision.razorRush, 'fourth precision cut does not trigger Razor Rush');
precision = resolveBladePrecisionSlice(30, 40, 4);
assert(!precision.precise && precision.chain === 0 && precision.bonus === 0, 'ordinary slice does not reset optional Razor chain');
precision = resolveBladePrecisionSlice(5, 40, BLADE_PRECISION_CHAIN_CAP);
assert(precision.chain === BLADE_PRECISION_CHAIN_CAP && !precision.razorRush, 'capped Razor chain can farm repeated milestone rushes');

const rhythm = read('src/games/RhythmGame.tsx');
for (const token of [
  'laneHeldRef',
  'isHolding',
  'getRhythmHoldCompletionBonus',
  'isRhythmHoldComplete',
  'shouldBreakRhythmHold',
  'HOLD CLEAR',
  'HOLD BREAK',
]) {
  assert(rhythm.includes(token), `Rhythm hold integration missing: ${token}`);
}
assert(rhythm.includes("closestNote.type === 'hold'"), 'hold note head does not enter sustained state');
assert(rhythm.includes('laneHeldRef.current[i] = true') && rhythm.includes('laneHeldRef.current[i] = false'), 'keyboard hold ownership is not tracked');
assert(rhythm.includes('laneHeldRef.current[idx] = true') && rhythm.includes('laneHeldRef.current[idx] = false'), 'touch hold ownership is not tracked');

const block = read('src/games/BlockDropGame.tsx');
for (const token of [
  'drawBlockDropBagPiece',
  'resolveBlockDropLineMastery',
  'pieceBag',
  'clearChain',
  'backToBack',
  'CLEAR CHAIN',
  'B2B TETRIS',
  'resolveBlockDropHold',
]) {
  assert(block.includes(token), `Block Drop mastery integration missing: ${token}`);
}
assert(!block.includes('TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)]'), 'independent random tetromino draw returned');

const blade = read('src/games/BladeGame.tsx');
for (const token of [
  'resolveBladePrecisionSlice',
  'precisionChain',
  'CENTER CUT',
  'RAZOR RUSH',
  "target.type === 'bomb'",
  'state.strokeCuts >= 3',
]) {
  assert(blade.includes(token), `Laser Blade precision integration missing: ${token}`);
}

const registry = read('src/data/games.ts');
assert(registry.includes('hold the lane through the full laser tail'), 'Rhythm registry does not teach real hold-note behavior');
assert(registry.includes('7-bag'), 'Block Drop registry does not teach 7-bag planning');
assert(registry.includes('back-to-back Tetris'), 'Block Drop registry does not teach B2B mastery');
assert(registry.includes('center cuts build a Razor chain'), 'Laser Blade registry does not teach precision mastery');

if (errors.length) {
  console.error('P14 FLAGSHIP DEPTH / QUALITY AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P14 FLAGSHIP DEPTH / QUALITY AUDIT — PASS');
console.log('Real Rhythm holds, Block Drop 7-bag/line mastery, and optional Laser Blade center-cut mastery are certified without weakening earlier contracts.');
