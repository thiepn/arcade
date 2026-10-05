import assert from 'node:assert/strict';
import { ACHIEVEMENTS_REGISTRY } from '../src/lib/achievements.ts';
import {
  achievementActionGame,
  getNearAchievementGoals,
  getPlayNextRecommendations,
} from '../src/lib/homeProgression.ts';
import { GAMES_REGISTRY } from '../src/data/games.ts';

const blankStats = {
  highScores: {},
  playCounts: {},
  totalPlayTimeSeconds: {},
  favorites: [],
  recentlyPlayed: [],
  soundEnabled: true,
  hapticsEnabled: true,
  volume: 0.8,
  theme: 'default',
};

assert.ok(ACHIEVEMENTS_REGISTRY.length >= 50, 'P29 expects the existing mature achievement catalog');

const blankGoals = getNearAchievementGoals(blankStats, 3);
assert.equal(blankGoals.length, 3);
assert.ok(blankGoals.every((goal) => goal.progressPercent >= 0 && goal.progressPercent < 100));
assert.ok(blankGoals.every((goal) => goal.xpReward > 0));
assert.ok(blankGoals.every((goal) => {
  const source = ACHIEVEMENTS_REGISTRY.find((achievement) => achievement.id === goal.id);
  return source?.category !== 'competitive';
}), 'home near-goals must stay local and not depend on live leaderboard availability');

const exploreRecommendations = getPlayNextRecommendations(blankStats, { limit: 3 });
assert.equal(exploreRecommendations.length, 3);
assert.equal(new Set(exploreRecommendations.map((item) => item.gameId)).size, 3, 'recommendations must be unique');
assert.ok(exploreRecommendations.some((item) => item.reason === 'explore'), 'new players should receive an exploration recommendation');

const firstGame = GAMES_REGISTRY[0].id;
const secondGame = GAMES_REGISTRY[1].id;
const activeStats = {
  ...blankStats,
  highScores: { [firstGame]: 2300, [secondGame]: 4100 },
  playCounts: { [firstGame]: 8, [secondGame]: 2 },
  favorites: [firstGame],
  recentlyPlayed: [secondGame, firstGame],
};
const activeRecommendations = getPlayNextRecommendations(activeStats, {
  excludedGameIds: [firstGame],
  limit: 3,
});
assert.ok(activeRecommendations.every((item) => item.gameId !== firstGame), 'excluded daily game must not be duplicated in Play next');
assert.equal(new Set(activeRecommendations.map((item) => item.gameId)).size, activeRecommendations.length);
assert.ok(activeRecommendations.some((item) => item.reason === 'explore'), 'partially explored catalog should still surface discovery');

const orbitAchievement = ACHIEVEMENTS_REGISTRY.find((achievement) => achievement.id === 'feat_orbit_apex');
assert.ok(orbitAchievement);
assert.equal(achievementActionGame(orbitAchievement, blankStats), 'orbit', 'game-specific badge must resolve to its actual cabinet');

const omni = ACHIEVEMENTS_REGISTRY.find((achievement) => achievement.id === 'variety_omni_player');
assert.ok(omni);
const scoreStats = {
  ...blankStats,
  highScores: Object.fromEntries(GAMES_REGISTRY.map((game, index) => [game.id, index === 0 ? 2400 : 3000])),
  playCounts: Object.fromEntries(GAMES_REGISTRY.map((game) => [game.id, 1])),
};
assert.equal(
  achievementActionGame(omni, scoreStats),
  GAMES_REGISTRY[0].id,
  'cross-cabinet score goal should point to the closest unfinished score target',
);

console.log('P29 PROGRESSION HOME CORE — PASS');
console.log('Near-goal ordering, actionable badge routing and explainable unique recommendations are certified.');
