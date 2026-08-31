import { readFileSync } from 'node:fs';
import {
  PERFECT_STOP_ROUNDS,
  getPerfectStopMarkerSpeed,
  getPerfectStopTargetPosition,
  judgePerfectStop,
} from '../src/lib/perfectStopGameplay';
import {
  REACTION_ROUNDS,
  requiresChoice,
  scoreReactionAttempt,
  usesInhibitionDecoy,
} from '../src/lib/reactionGameplay';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};
const read = (path: string) => readFileSync(path, 'utf8');

// Perfect Stop: seven authored rounds with materially different mechanics.
assert(PERFECT_STOP_ROUNDS.length === 7, `expected 7 Perfect Stop rounds, found ${PERFECT_STOP_ROUNDS.length}`);
assert(new Set(PERFECT_STOP_ROUNDS.map((round) => round.id)).size === 7, 'Perfect Stop pattern IDs are not unique');
assert(PERFECT_STOP_ROUNDS.some((round) => round.targetAmplitude > 0), 'Perfect Stop has no moving-target round');
assert(PERFECT_STOP_ROUNDS.some((round) => round.flipIntervalMs > 0), 'Perfect Stop has no timed-reversal round');
assert(PERFECT_STOP_ROUNDS.some((round) => round.goodWindow <= 8), 'Perfect Stop has no precision-window round');
assert(
  PERFECT_STOP_ROUNDS[PERFECT_STOP_ROUNDS.length - 1].markerSpeedPerSecond > PERFECT_STOP_ROUNDS[0].markerSpeedPerSecond,
  'Perfect Stop final round is not faster than its opener',
);

for (const round of PERFECT_STOP_ROUNDS) {
  for (let elapsed = 0; elapsed <= 12000; elapsed += 137) {
    const target = getPerfectStopTargetPosition(round, elapsed);
    const speed = getPerfectStopMarkerSpeed(round, elapsed);
    assert(target >= 8 && target <= 92, `${round.id}: moving target escaped safe track bounds`);
    assert(speed > 20 && speed < 400, `${round.id}: marker speed escaped playable bounds`);
  }

  const perfect = judgePerfectStop(round.targetStart, round.targetStart, round, 0);
  const great = judgePerfectStop(round.targetStart + (round.perfectWindow + round.greatWindow) / 2, round.targetStart, round, 0);
  const miss = judgePerfectStop(round.targetStart + round.goodWindow + 5, round.targetStart, round, 0);
  assert(perfect.rating === 'PERFECT', `${round.id}: exact target is not PERFECT`);
  assert(perfect.points > great.points, `${round.id}: PERFECT does not outscore GREAT`);
  assert(miss.rating === 'MISS', `${round.id}: clear miss is not classified as MISS`);
  assert(perfect.nextStreak === 1, `${round.id}: PERFECT does not start a streak`);
  assert(miss.nextStreak === 0, `${round.id}: MISS does not break the streak`);
}

// Reaction: every intended cognitive mode is represented and scored fairly.
assert(REACTION_ROUNDS.length === 8, `expected 8 Reaction rounds, found ${REACTION_ROUNDS.length}`);
for (const kind of ['simple', 'choice', 'inhibit', 'mixed'] as const) {
  assert(REACTION_ROUNDS.some((round) => round.kind === kind), `Reaction suite is missing ${kind} rounds`);
}
assert(REACTION_ROUNDS.some((round) => requiresChoice(round.kind)), 'Reaction suite has no choice-response rounds');
assert(REACTION_ROUNDS.some((round) => usesInhibitionDecoy(round.kind)), 'Reaction suite has no inhibition rounds');

for (const round of REACTION_ROUNDS) {
  assert(round.waitMinMs >= 250, `${round.label}: minimum wait is too short and encourages anticipation`);
  assert(round.waitMaxMs > round.waitMinMs, `${round.label}: wait range is invalid`);
  if (usesInhibitionDecoy(round.kind)) {
    assert(round.decoyMs >= 300 && round.decoyMs <= 600, `${round.label}: decoy duration is outside readable bounds`);
  } else {
    assert(round.decoyMs === 0, `${round.label}: non-inhibition round unexpectedly has a decoy`);
  }

  const fast = scoreReactionAttempt(round, 180, true);
  const slow = scoreReactionAttempt(round, 520, true);
  const wrong = scoreReactionAttempt(round, 180, false);
  assert(fast.points > slow.points, `${round.label}: faster correct response does not score higher`);
  assert(wrong.points === 0, `${round.label}: incorrect response still earns points`);
}

const perfectStopSource = read('src/games/PerfectStopGame.tsx');
assert(perfectStopSource.includes('PERFECT_STOP_ROUNDS'), 'Perfect Stop no longer consumes authored challenge rounds');
assert(perfectStopSource.includes('targetElementRef'), 'Perfect Stop moving target is no longer rendered');
assert(perfectStopSource.includes('AUTO REVERSE'), 'Perfect Stop reversal mechanic is no longer communicated');
assert(!perfectStopSource.includes('const maxRounds = 5'), 'Perfect Stop reverted to the old five identical rounds');
assert(!perfectStopSource.includes('LOCK ON CENTER 50.0% MARK'), 'Perfect Stop reverted to center-only instructions');

const reactionSource = read('src/games/ReactionGame.tsx');
assert(reactionSource.includes('REACTION_ROUNDS'), 'Reaction no longer consumes the mixed round plan');
assert(reactionSource.includes("completeAttempt(null, false, 'INHIBITION FAIL')"), 'Reaction inhibition failure is no longer enforced');
assert(reactionSource.includes("completeAttempt(reactionTimeMs, false, 'WRONG SIDE')"), 'Reaction wrong-choice failure is no longer enforced');
assert(reactionSource.includes("handleInput('LEFT')") && reactionSource.includes("handleInput('RIGHT')"), 'Reaction left/right controls are incomplete');
assert(!/Top\s+\d|Bottom\s+\d|percentile/i.test(reactionSource), 'Reaction restored unsupported percentile claims');

const registry = read('src/data/games.ts');
assert(registry.includes('mixed reflex gauntlet'), 'Reaction registry copy does not advertise the mixed reflex redesign');
assert(registry.includes('seven escalating precision sectors'), 'Perfect Stop registry copy does not advertise the P1 redesign');

if (errors.length) {
  console.error('P1 GAMEPLAY DEPTH AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P1 GAMEPLAY DEPTH AUDIT — PASS');
console.log('Perfect Stop has seven distinct mastery patterns; Reaction has eight mixed reflex rounds with choice and inhibition mechanics, fair scoring, and no unsupported percentile claims.');
