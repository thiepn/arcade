import assert from 'node:assert/strict';
import {
  getDailyChallengeDefinition,
  getDailyChallengeSummary,
  getDailyChallengeStreaks,
  normalizeDailyChallengeProgress,
  recordDailyChallengeScore,
  shiftUtcDayKey,
} from '../src/lib/dailyChallenge.ts';

const start = '2026-10-01';
const rotation = Array.from({ length: 32 }, (_, index) =>
  getDailyChallengeDefinition(shiftUtcDayKey(start, index)).gameId
);
assert.equal(new Set(rotation).size, 32, '32-day rotation must visit every cabinet exactly once');
for (let index = 1; index < rotation.length; index += 1) {
  assert.notEqual(rotation[index], rotation[index - 1], 'daily cabinet must not repeat on consecutive days');
}

for (let index = 0; index < 60; index += 1) {
  const definition = getDailyChallengeDefinition(shiftUtcDayKey(start, index));
  assert.ok([2000, 2500, 3000].includes(definition.targetAP), 'daily target must use the calibrated AP set');
}

const day1 = '2026-10-05';
const def1 = getDailyChallengeDefinition(day1);
const noon1 = Date.parse(`${day1}T12:00:00.000Z`);
let stats = { dailyChallenge: { days: {} } };

const wrongGame = rotation.find((id) => id !== def1.gameId);
const wrong = recordDailyChallengeScore(stats, wrongGame, def1.targetAP, noon1);
assert.equal(Object.keys(wrong.stats.dailyChallenge.days).length, 0, 'non-daily games must not mutate daily progress');

const partial = recordDailyChallengeScore(stats, def1.gameId, def1.targetAP - 1, noon1);
stats = partial.stats;
assert.equal(partial.justCompleted, false);
assert.equal(getDailyChallengeSummary(stats, day1).completed, false);
assert.equal(getDailyChallengeSummary(stats, day1).bestAP, def1.targetAP - 1);

const complete = recordDailyChallengeScore(stats, def1.gameId, def1.targetAP, noon1 + 1000);
stats = complete.stats;
assert.equal(complete.justCompleted, true, 'first qualifying score should complete the day');
assert.equal(getDailyChallengeSummary(stats, day1).completed, true);

const repeat = recordDailyChallengeScore(stats, def1.gameId, def1.targetAP + 500, noon1 + 2000);
stats = repeat.stats;
assert.equal(repeat.justCompleted, false, 'repeat qualifying scores must not re-complete the day');
assert.equal(getDailyChallengeSummary(stats, day1).bestAP, def1.targetAP + 500);

const day2 = shiftUtcDayKey(day1, 1);
const def2 = getDailyChallengeDefinition(day2);
const day2Done = recordDailyChallengeScore(stats, def2.gameId, def2.targetAP, Date.parse(`${day2}T12:00:00.000Z`));
stats = day2Done.stats;
assert.equal(getDailyChallengeSummary(stats, day2).currentStreak, 2, 'consecutive UTC completions should build the streak');

const day3 = shiftUtcDayKey(day1, 2);
assert.equal(getDailyChallengeSummary(stats, day3).currentStreak, 2, 'streak should remain alive during the current uncompleted UTC day');

const day4 = shiftUtcDayKey(day1, 3);
assert.equal(getDailyChallengeSummary(stats, day4).currentStreak, 0, 'missing a full UTC day must break the current streak');
assert.equal(getDailyChallengeSummary(stats, day4).bestStreak, 2, 'best streak must remain historical');

const cleaned = normalizeDailyChallengeProgress({
  days: {
    [day1]: { gameId: def1.gameId, targetAP: 2500, bestAP: 3000, completedAt: noon1 },
    bad: { gameId: 'not-a-game', targetAP: -1, bestAP: -5 },
  },
});
assert.deepEqual(Object.keys(cleaned.days), [day1], 'normalization must reject malformed history');

const streaks = getDailyChallengeStreaks(cleaned, day1);
assert.equal(streaks.currentStreak, 1);
assert.equal(streaks.bestStreak, 1);

console.log('P28 DAILY CHALLENGE CORE — PASS');
console.log('Deterministic 32-day rotation, AP targets, completion semantics and streak rules are certified.');
