import assert from 'node:assert/strict';
import { GAMES_REGISTRY } from '../src/data/games.ts';
import { getDailyChallengeDefinition } from '../src/lib/dailyChallenge.ts';
import { buildResultMeta } from '../src/lib/resultMeta.ts';

const blank = () => ({
  highScores: {},
  playCounts: {},
  totalPlayTimeSeconds: {},
  favorites: [],
  recentlyPlayed: [],
  soundEnabled: true,
  hapticsEnabled: true,
  volume: 0.8,
  theme: 'default',
  dailyChallenge: { days: {} },
});

const ids = GAMES_REGISTRY.slice(0, 10).map((game) => game.id);
const beforeLevel = blank();
beforeLevel.playCounts = Object.fromEntries(ids.slice(0, 9).map((id) => [id, 1]));
beforeLevel.highScores = Object.fromEntries(ids.slice(0, 9).map((id) => [id, 1111]));

const afterLevel = {
  ...beforeLevel,
  playCounts: { ...beforeLevel.playCounts, [ids[9]]: 1 },
  highScores: { ...beforeLevel.highScores, [ids[9]]: 1 },
};
const levelMeta = buildResultMeta(beforeLevel, afterLevel, ids[9], {
  dayKey: '2026-10-06',
  isPersonalBest: true,
});
assert.equal(levelMeta.xpGained, 300, 'score + exploration badges should award 300 XP');
assert.equal(levelMeta.levelBefore, 1);
assert.equal(levelMeta.levelAfter, 2);
assert.equal(levelMeta.levelUp, true);
assert.equal(levelMeta.celebration, 'level-up');
assert.deepEqual(
  new Set(levelMeta.unlockedAchievements.map((item) => item.id)),
  new Set(['score_10k', 'variety_scout_10']),
);
assert.ok(levelMeta.nextRecommendation);
assert.notEqual(levelMeta.nextRecommendation.gameId, ids[9], 'next recommendation must not repeat the finished cabinet');

const pbBefore = blank();
pbBefore.highScores = { [ids[0]]: 2200 };
const pbAfter = { ...pbBefore, highScores: { [ids[0]]: 2800 } };
const pbMeta = buildResultMeta(pbBefore, pbAfter, ids[0], {
  dayKey: '2026-10-06',
  isPersonalBest: true,
});
assert.equal(pbMeta.pbGainAP, 600);
assert.equal(pbMeta.celebration, 'personal-best');

const dayKey = '2026-10-06';
const daily = getDailyChallengeDefinition(dayKey);
const dailyBefore = blank();
const dailyAfter = {
  ...dailyBefore,
  dailyChallenge: {
    days: {
      [dayKey]: {
        gameId: daily.gameId,
        targetAP: daily.targetAP,
        bestAP: daily.targetAP,
        completedAt: Date.parse(dayKey + 'T12:00:00.000Z'),
      },
    },
  },
};
const dailyMeta = buildResultMeta(dailyBefore, dailyAfter, daily.gameId, {
  dayKey,
  isPersonalBest: false,
});
assert.equal(dailyMeta.dailyChallenge?.justCompleted, true);
assert.equal(dailyMeta.dailyChallenge?.currentStreak, 1);
assert.equal(dailyMeta.celebration, 'daily-challenge');
assert.notEqual(dailyMeta.nextRecommendation?.gameId, daily.gameId, 'daily cabinet must not duplicate the next recommendation');

const quietMeta = buildResultMeta(blank(), blank(), ids[0], {
  dayKey: '2026-10-06',
  isPersonalBest: false,
});
assert.equal(quietMeta.xpGained, 0);
assert.equal(quietMeta.unlockedAchievements.length, 0);
assert.equal(quietMeta.celebration, 'none');

console.log('P30 RESULT META CORE — PASS');
console.log('PB, badge/XP, level-up, daily challenge and next-action deltas are deterministic and local-first.');
