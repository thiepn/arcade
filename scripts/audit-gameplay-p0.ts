import { readFileSync } from 'node:fs';
import {
  findNextMergeDecision,
  resolveMergeCascadeValues,
  type MergeValueBoard,
} from '../src/lib/mergeRules';
import {
  RHYTHM_HIT_WINDOWS_MS,
  RHYTHM_LATENCY_MAX_MS,
  RHYTHM_LATENCY_MIN_MS,
  RHYTHM_MISS_WINDOW_MS,
  beatsToMilliseconds,
  clampRhythmLatencyOffset,
  getLatencyCompensatedBeat,
  millisecondsToBeats,
} from '../src/lib/rhythmTiming';
import {
  AIR_HOCKEY_DIFFICULTY_CONFIG,
  AIR_HOCKEY_MAX_PUCK_SPEED,
  AIR_HOCKEY_PLAYER_MAX_SPEED,
  advanceMalletTowardsTarget,
  capAirHockeyVelocity,
} from '../src/lib/airHockeyFairness';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};
const read = (path: string) => readFileSync(path, 'utf8');

const mirrorBoard = (board: MergeValueBoard): MergeValueBoard =>
  [...board].reverse().map((column) => [...column]);

const bottomBoard = (values: Array<number | null>): MergeValueBoard =>
  values.map((value) => value === null ? Array(6).fill(null) : [...Array(5).fill(null), value]);

const leftChain = resolveMergeCascadeValues(bottomBoard([2, 2, 4, null]), 0);
const rightChain = resolveMergeCascadeValues(bottomBoard([null, 4, 2, 2]), 3);
assert(leftChain.score === 12 && leftChain.merges === 2, 'Merge chain 2+2 -> 4 -> 8 no longer resolves fully');
assert(
  JSON.stringify(mirrorBoard(leftChain.board)) === JSON.stringify(rightChain.board),
  'Merge cascade is not horizontally mirror-symmetric for the canonical 2,2,4 case',
);

let seed = 0x5eed1234;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x1_0000_0000;
};
const values = [null, null, 2, 4, 8, 16] as const;
for (let sample = 0; sample < 1000; sample++) {
  const board: MergeValueBoard = Array.from({ length: 4 }, () => {
    const occupied = Math.floor(random() * 7);
    return [...Array(6 - occupied).fill(null), ...Array.from({ length: occupied }, () => values[Math.floor(random() * values.length)] ?? 2)];
  });
  const focus = Math.floor(random() * 4);
  const normal = resolveMergeCascadeValues(board, focus);
  const mirrored = resolveMergeCascadeValues(mirrorBoard(board), 3 - focus);
  assert(normal.score === mirrored.score, `Merge mirror score diverged in seeded sample ${sample}`);
  assert(normal.merges === mirrored.merges, `Merge mirror count diverged in seeded sample ${sample}`);
  assert(
    JSON.stringify(mirrorBoard(normal.board)) === JSON.stringify(mirrored.board),
    `Merge mirror board diverged in seeded sample ${sample}`,
  );
}

const verticalDecision = findNextMergeDecision(bottomBoard([null, 2, null, null]).map((column, index) => {
  if (index !== 1) return column;
  return [null, null, null, null, 2, 2];
}), 1);
assert(
  verticalDecision?.target.row === 5,
  'Vertical Merge no longer resolves into the lower gravity cell',
);

assert(RHYTHM_HIT_WINDOWS_MS.perfect === 70, 'Rhythm PERFECT window changed from certified 70ms');
assert(RHYTHM_HIT_WINDOWS_MS.great === 125, 'Rhythm GREAT window changed from certified 125ms');
assert(RHYTHM_HIT_WINDOWS_MS.good === 190, 'Rhythm GOOD window changed from certified 190ms');
assert(RHYTHM_MISS_WINDOW_MS > RHYTHM_HIT_WINDOWS_MS.good, 'Rhythm MISS threshold overlaps the GOOD window');
assert(RHYTHM_MISS_WINDOW_MS <= 250, 'Rhythm MISS threshold became excessively forgiving');
assert(clampRhythmLatencyOffset(999) === RHYTHM_LATENCY_MAX_MS, 'Rhythm positive latency clamp regressed');
assert(clampRhythmLatencyOffset(-999) === RHYTHM_LATENCY_MIN_MS, 'Rhythm negative latency clamp regressed');
assert(Math.abs(millisecondsToBeats(100, 120) - 0.2) < 1e-9, 'Rhythm milliseconds-to-beats conversion regressed');
assert(Math.abs(beatsToMilliseconds(0.2, 120) - 100) < 1e-9, 'Rhythm beats-to-milliseconds conversion regressed');
assert(Math.abs(getLatencyCompensatedBeat(10, 120, 100) - 9.8) < 1e-9, 'Rhythm +100ms compensation has wrong sign');

const easy = AIR_HOCKEY_DIFFICULTY_CONFIG.EASY;
const medium = AIR_HOCKEY_DIFFICULTY_CONFIG.MEDIUM;
const hard = AIR_HOCKEY_DIFFICULTY_CONFIG.HARD;
assert(easy.aiSpeed < medium.aiSpeed && medium.aiSpeed < hard.aiSpeed, 'Air Hockey AI speed tiers are not monotonic');
assert(easy.reactionMs > medium.reactionMs && medium.reactionMs > hard.reactionMs, 'Air Hockey AI reaction tiers are not monotonic');
assert(easy.aimErrorPx > medium.aimErrorPx && medium.aimErrorPx > hard.aimErrorPx, 'Air Hockey AI aim-error tiers are not monotonic');
assert(AIR_HOCKEY_PLAYER_MAX_SPEED > hard.aiSpeed, 'Air Hockey hard AI is as fast as or faster than the human speed cap');
assert(AIR_HOCKEY_PLAYER_MAX_SPEED <= 1200, 'Air Hockey player pointer speed cap became effectively unlimited');
const moved = advanceMalletTowardsTarget(0, 0, 1000, 0, AIR_HOCKEY_PLAYER_MAX_SPEED, 1 / 60);
assert(moved.x <= AIR_HOCKEY_PLAYER_MAX_SPEED / 60 + 1e-9, 'Air Hockey mallet can teleport farther than the certified per-frame travel cap');
const capped = capAirHockeyVelocity(2000, 0, AIR_HOCKEY_MAX_PUCK_SPEED);
assert(Math.hypot(capped.vx, capped.vy) <= AIR_HOCKEY_MAX_PUCK_SPEED + 1e-9, 'Air Hockey puck cap fails after a power hit');

const mergeSource = read('src/games/MergeGame.tsx');
assert(mergeSource.includes('findNextMergeDecision'), 'Merge game bypasses the symmetric cascade resolver');
assert(!mergeSource.includes('// Check right'), 'Merge restored the old scan-order cascade implementation');

const orbitSource = read('src/games/OrbitGame.tsx');
assert(orbitSource.includes('const pulseOrbit'), 'Orbit lacks the unified pulse control');
assert(orbitSource.includes("addEventListener('pointerdown'"), 'Orbit pointer input is not unified through pointerdown');
const registrySource = read('src/data/games.ts');
assert(registrySource.includes('Tap/Space pulses to shift one lane and reverse direction.'), 'Orbit registry instructions disagree with the gameplay control');

const rhythmSource = read('src/games/RhythmGame.tsx');
for (const token of ['RHYTHM_HIT_WINDOWS_MS', 'RHYTHM_MISS_WINDOW_MS', 'getLatencyCompensatedBeat', 'getSignedTimingErrorMs', 'SYNC']) {
  assert(rhythmSource.includes(token), `Rhythm timing/calibration token missing: ${token}`);
}
assert(!rhythmSource.includes('const WINDOW_PERFECT = 0.20'), 'Rhythm restored BPM-dependent beat-window judgement');
const rhythmEngineSource = read('src/lib/rhythmSongs.ts');
assert(rhythmEngineSource.includes('getEstimatedOutputLatencyMs'), 'Rhythm audio engine no longer exposes output-latency estimation');

const airHockeySource = read('src/games/AirHockeyGame.tsx');
for (const token of ['AIR_HOCKEY_DIFFICULTY_CONFIG', 'AIR_HOCKEY_PLAYER_MAX_SPEED', 'advanceMalletTowardsTarget', 'aiDecisionCooldown', 'aimErrorPx', 'capAirHockeyVelocity']) {
  assert(airHockeySource.includes(token), `Air Hockey fairness token missing: ${token}`);
}
assert(!airHockeySource.includes('state.playerMallet.x = boundedTargetX;'), 'Air Hockey restored pointer teleport movement');

if (errors.length) {
  console.error('P0 GAMEPLAY / FAIRNESS AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P0 GAMEPLAY / FAIRNESS AUDIT — PASS');
console.log('Merge symmetry, Orbit control parity, fixed-ms Rhythm judgement/calibration, and bounded/reaction-limited Air Hockey fairness are certified.');
