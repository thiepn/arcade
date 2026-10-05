import { ACHIEVEMENTS_REGISTRY, type Achievement } from './achievements';
import { GAMES_REGISTRY } from '../data/games';
import type { GameCategory, UserStats } from '../types';

export interface NearAchievementGoal {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  accentColor: string;
  progressText: string;
  current: number;
  target: number;
  progressPercent: number;
  gameId: string | null;
}

export type PlayNextReason = 'achievement' | 'explore' | 'favorite' | 'continue' | 'record';

export interface PlayNextRecommendation {
  gameId: string;
  reason: PlayNextReason;
  eyebrow: string;
  title: string;
  detail: string;
}

const FEATURE_GAME: Readonly<Record<string, string>> = {
  feat_pinball_wizard: 'pinball',
  feat_blade_master: 'blade',
  feat_chrono_survivor: 'chrono',
  feat_serpent_ouroboros: 'snake',
  feat_stack_skyscraper: 'stack',
  feat_orbit_apex: 'orbit',
  feat_merge_fusion: 'merge',
  feat_vanguard_ace: 'vanguard',
  feat_rhythm_virtuoso: 'rhythm',
  feat_tower_ascendant: 'tower',
};

function gameExists(gameId: string | null | undefined): gameId is string {
  return Boolean(gameId && GAMES_REGISTRY.some((game) => game.id === gameId));
}

function chooseUnplayed(stats: UserStats, excluded = new Set<string>()): string | null {
  return GAMES_REGISTRY
    .filter((game) => !excluded.has(game.id) && (stats.playCounts[game.id] || 0) === 0)
    .sort((a, b) => a.title.localeCompare(b.title))[0]?.id ?? null;
}

function chooseClosestScoreTarget(
  stats: UserStats,
  threshold: number,
  categories?: readonly GameCategory[],
  excluded = new Set<string>(),
): string | null {
  const candidates = GAMES_REGISTRY
    .filter((game) => !excluded.has(game.id))
    .filter((game) => !categories || categories.includes(game.category))
    .map((game) => ({ game, score: stats.highScores[game.id] || 0 }))
    .filter(({ score }) => score < threshold)
    .sort((a, b) => {
      const aStarted = a.score > 0 ? 1 : 0;
      const bStarted = b.score > 0 ? 1 : 0;
      if (aStarted !== bStarted) return bStarted - aStarted;
      if (a.score !== b.score) return b.score - a.score;
      return a.game.title.localeCompare(b.game.title);
    });
  return candidates[0]?.game.id ?? null;
}

function choosePlayCountTarget(
  stats: UserStats,
  threshold: number,
  excluded = new Set<string>(),
): string | null {
  return GAMES_REGISTRY
    .filter((game) => !excluded.has(game.id))
    .map((game) => ({ game, plays: stats.playCounts[game.id] || 0 }))
    .filter(({ plays }) => plays < threshold)
    .sort((a, b) => {
      const aStarted = a.plays > 0 ? 1 : 0;
      const bStarted = b.plays > 0 ? 1 : 0;
      if (aStarted !== bStarted) return bStarted - aStarted;
      if (a.plays !== b.plays) return b.plays - a.plays;
      return a.game.title.localeCompare(b.game.title);
    })[0]?.game.id ?? null;
}

function categoryTotal(stats: UserStats, category: GameCategory): number {
  return GAMES_REGISTRY
    .filter((game) => game.category === category)
    .reduce((sum, game) => sum + (stats.highScores[game.id] || 0), 0);
}

function chooseFamiliarCategoryGame(
  stats: UserStats,
  category: GameCategory,
  excluded = new Set<string>(),
): string | null {
  return GAMES_REGISTRY
    .filter((game) => game.category === category && !excluded.has(game.id))
    .map((game) => ({
      game,
      plays: stats.playCounts[game.id] || 0,
      score: stats.highScores[game.id] || 0,
    }))
    .sort((a, b) =>
      b.plays - a.plays ||
      a.score - b.score ||
      a.game.title.localeCompare(b.game.title)
    )[0]?.game.id ?? null;
}

export function achievementActionGame(
  achievement: Achievement,
  stats: UserStats,
  excluded = new Set<string>(),
): string | null {
  const featureGame = FEATURE_GAME[achievement.id];
  if (gameExists(featureGame) && !excluded.has(featureGame)) return featureGame;

  if (achievement.id === 'skill_type_speedster' && !excluded.has('typerush')) return 'typerush';

  if (achievement.id.startsWith('skill_reflex_')) {
    return chooseClosestScoreTarget(stats, achievement.targetGoal, ['Reflex'], excluded);
  }
  if (achievement.id.startsWith('skill_physics_')) {
    return chooseClosestScoreTarget(stats, achievement.targetGoal, ['Physics'], excluded);
  }
  if (achievement.id.startsWith('skill_timing_')) {
    return chooseClosestScoreTarget(stats, achievement.targetGoal, ['Timing'], excluded);
  }
  if (achievement.id.startsWith('skill_puzzle_')) {
    return chooseClosestScoreTarget(stats, achievement.targetGoal, ['Puzzle', 'Strategy'], excluded);
  }

  if (achievement.id === 'variety_genre_maestro') {
    const reflex = categoryTotal(stats, 'Reflex');
    const physics = categoryTotal(stats, 'Physics');
    const weaker: GameCategory = reflex <= physics ? 'Reflex' : 'Physics';
    return chooseFamiliarCategoryGame(stats, weaker, excluded);
  }

  if (achievement.id === 'variety_omni_player') {
    return chooseClosestScoreTarget(stats, 2500, undefined, excluded);
  }
  if (achievement.id === 'variety_elite_mastery') {
    return chooseClosestScoreTarget(stats, 6000, undefined, excluded);
  }
  if (achievement.id === 'skill_score_10k_multi_10') {
    return chooseClosestScoreTarget(stats, 10_000, undefined, excluded);
  }
  if (achievement.id === 'skill_score_25k_multi_6') {
    return chooseClosestScoreTarget(stats, 25_000, undefined, excluded);
  }

  if (['variety_scout_10', 'variety_grand_tour', 'variety_grand_tour_25'].includes(achievement.id)) {
    return chooseUnplayed(stats, excluded);
  }
  if (achievement.id === 'variety_mastery_all_10') {
    return choosePlayCountTarget(stats, 10, excluded);
  }
  if (achievement.id === 'milestone_balanced') {
    return choosePlayCountTarget(stats, 15, excluded);
  }
  if (achievement.id === 'milestone_specialist') {
    const candidate = GAMES_REGISTRY
      .filter((game) => !excluded.has(game.id))
      .map((game) => ({ game, plays: stats.playCounts[game.id] || 0 }))
      .filter(({ plays }) => plays < achievement.targetGoal)
      .sort((a, b) => b.plays - a.plays || a.game.title.localeCompare(b.game.title))[0];
    return candidate?.game.id ?? null;
  }

  return null;
}

export function getNearAchievementGoals(stats: UserStats, limit = 2): NearAchievementGoal[] {
  return ACHIEVEMENTS_REGISTRY
    .filter((achievement) => achievement.category !== 'competitive' && !achievement.isUnlocked(stats))
    .map((achievement) => {
      const target = Math.max(1, achievement.targetGoal);
      const current = Math.min(target, Math.max(0, achievement.getCurrentProgress(stats)));
      const progressPercent = Math.min(99, Math.floor((current / target) * 100));
      return {
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        xpReward: achievement.xpReward,
        accentColor: achievement.accentColor,
        progressText: achievement.getProgressText(stats),
        current,
        target,
        progressPercent,
        gameId: achievementActionGame(achievement, stats),
      };
    })
    .sort((a, b) => {
      const aStarted = a.current > 0 ? 1 : 0;
      const bStarted = b.current > 0 ? 1 : 0;
      if (aStarted !== bStarted) return bStarted - aStarted;
      if (a.progressPercent !== b.progressPercent) return b.progressPercent - a.progressPercent;
      if (a.current === 0 && b.current === 0 && a.target !== b.target) return a.target - b.target;
      if (a.xpReward !== b.xpReward) return b.xpReward - a.xpReward;
      return a.title.localeCompare(b.title);
    })
    .slice(0, Math.max(0, limit));
}

function pushUnique(
  output: PlayNextRecommendation[],
  seen: Set<string>,
  recommendation: PlayNextRecommendation | null,
  limit: number,
): void {
  if (!recommendation || seen.has(recommendation.gameId) || output.length >= limit) return;
  if (!gameExists(recommendation.gameId)) return;
  seen.add(recommendation.gameId);
  output.push(recommendation);
}

export function getPlayNextRecommendations(
  stats: UserStats,
  options: { excludedGameIds?: readonly string[]; limit?: number } = {},
): PlayNextRecommendation[] {
  const limit = Math.max(1, options.limit ?? 3);
  const excluded = new Set(options.excludedGameIds ?? []);
  const seen = new Set(excluded);
  const output: PlayNextRecommendation[] = [];

  const nearGoals = getNearAchievementGoals(stats, 8);
  const actionable = nearGoals.find((goal) => gameExists(goal.gameId) && !seen.has(goal.gameId));
  if (actionable?.gameId) {
    pushUnique(output, seen, {
      gameId: actionable.gameId,
      reason: 'achievement',
      eyebrow: 'Closest badge',
      title: actionable.title,
      detail: `${actionable.progressPercent}% complete • +${actionable.xpReward.toLocaleString()} XP`,
    }, limit);
  }

  const unplayed = chooseUnplayed(stats, seen);
  if (unplayed) {
    const playedCount = GAMES_REGISTRY.filter((game) => (stats.playCounts[game.id] || 0) > 0).length;
    pushUnique(output, seen, {
      gameId: unplayed,
      reason: 'explore',
      eyebrow: 'Explore',
      title: 'Try a new cabinet',
      detail: `${playedCount} / ${GAMES_REGISTRY.length} games discovered`,
    }, limit);
  }

  const favorite = stats.favorites
    .filter((id) => gameExists(id) && !seen.has(id))
    .map((id) => ({ id, score: stats.highScores[id] || 0, plays: stats.playCounts[id] || 0 }))
    .sort((a, b) => a.score - b.score || b.plays - a.plays || a.id.localeCompare(b.id))[0];
  if (favorite) {
    pushUnique(output, seen, {
      gameId: favorite.id,
      reason: 'favorite',
      eyebrow: 'Favorite',
      title: favorite.score > 0 ? 'Push a favorite PB' : 'Start a favorite',
      detail: favorite.score > 0 ? `Current best ${favorite.score.toLocaleString()} AP` : 'No score posted yet',
    }, limit);
  }

  const recent = stats.recentlyPlayed.find((id) => gameExists(id) && !seen.has(id));
  if (recent) {
    const best = stats.highScores[recent] || 0;
    pushUnique(output, seen, {
      gameId: recent,
      reason: 'continue',
      eyebrow: 'Continue',
      title: 'Keep the run going',
      detail: best > 0 ? `Current best ${best.toLocaleString()} AP` : 'Recently played',
    }, limit);
  }

  const recordCandidate = GAMES_REGISTRY
    .filter((game) => !seen.has(game.id) && (stats.playCounts[game.id] || 0) > 0)
    .map((game) => ({ game, score: stats.highScores[game.id] || 0, plays: stats.playCounts[game.id] || 0 }))
    .sort((a, b) => b.plays - a.plays || a.score - b.score || a.game.title.localeCompare(b.game.title))[0];
  if (recordCandidate) {
    pushUnique(output, seen, {
      gameId: recordCandidate.game.id,
      reason: 'record',
      eyebrow: 'Personal best',
      title: 'Raise a familiar record',
      detail: recordCandidate.score > 0
        ? `Current best ${recordCandidate.score.toLocaleString()} AP`
        : `${recordCandidate.plays} sessions played`,
    }, limit);
  }

  for (const game of GAMES_REGISTRY) {
    if (output.length >= limit) break;
    pushUnique(output, seen, {
      gameId: game.id,
      reason: 'explore',
      eyebrow: 'Play next',
      title: 'Jump into another cabinet',
      detail: game.tagline,
    }, limit);
  }

  return output;
}
