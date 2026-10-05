import { ACHIEVEMENTS_REGISTRY, getPlayerLevelInfo } from './achievements';
import { getDailyChallengeSummary, getUtcDayKey } from './dailyChallenge';
import { getPlayNextRecommendations, type PlayNextReason } from './homeProgression';
import { GAMES_REGISTRY } from '../data/games';
import type { UserStats } from '../types';

export type ResultCelebration = 'level-up' | 'daily-challenge' | 'achievement' | 'personal-best' | 'none';

export interface ResultUnlockedAchievement {
  id: string;
  title: string;
  xpReward: number;
  accentColor: string;
}

export interface ResultNextRecommendation {
  gameId: string;
  gameTitle: string;
  reason: PlayNextReason;
  eyebrow: string;
  detail: string;
}

export interface ResultDailyProgress {
  targetAP: number;
  bestAP: number;
  progressPercent: number;
  justCompleted: boolean;
  currentStreak: number;
  bestStreak: number;
}

export interface LeaderboardRankDelta {
  before: number | null;
  after: number;
}

export interface ResultMetaSummary {
  isPersonalBest: boolean;
  previousBestAP: number;
  bestAP: number;
  pbGainAP: number;
  unlockedAchievements: ResultUnlockedAchievement[];
  xpBefore: number;
  xpAfter: number;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  levelTitle: string;
  levelProgressPercent: number;
  levelUp: boolean;
  dailyChallenge: ResultDailyProgress | null;
  nextRecommendation: ResultNextRecommendation | null;
  celebration: ResultCelebration;
}

export interface BuildResultMetaOptions {
  dayKey?: string;
  isPersonalBest?: boolean;
}

export function buildResultMeta(
  before: UserStats,
  after: UserStats,
  gameId: string,
  options: BuildResultMetaOptions = {},
): ResultMetaSummary {
  const dayKey = options.dayKey ?? getUtcDayKey();
  const beforeLevel = getPlayerLevelInfo(before);
  const afterLevel = getPlayerLevelInfo(after);

  const beforeUnlocked = new Set(
    ACHIEVEMENTS_REGISTRY
      .filter((achievement) => achievement.category !== 'competitive' && achievement.isUnlocked(before))
      .map((achievement) => achievement.id),
  );
  const unlockedAchievements = ACHIEVEMENTS_REGISTRY
    .filter((achievement) =>
      achievement.category !== 'competitive' &&
      !beforeUnlocked.has(achievement.id) &&
      achievement.isUnlocked(after)
    )
    .map((achievement) => ({
      id: achievement.id,
      title: achievement.title,
      xpReward: achievement.xpReward,
      accentColor: achievement.accentColor,
    }))
    .sort((a, b) => b.xpReward - a.xpReward || a.title.localeCompare(b.title));

  const beforeBestAP = before.highScores[gameId] ?? 0;
  const afterBestAP = after.highScores[gameId] ?? 0;
  const pbGainAP = Math.max(0, afterBestAP - beforeBestAP);
  const isPersonalBest = options.isPersonalBest ?? pbGainAP > 0;

  const beforeDaily = getDailyChallengeSummary(before, dayKey);
  const afterDaily = getDailyChallengeSummary(after, dayKey);
  const dailyChallenge = afterDaily.definition.gameId === gameId
    ? {
        targetAP: afterDaily.definition.targetAP,
        bestAP: afterDaily.bestAP,
        progressPercent: afterDaily.progressPercent,
        justCompleted: !beforeDaily.completed && afterDaily.completed,
        currentStreak: afterDaily.currentStreak,
        bestStreak: afterDaily.bestStreak,
      }
    : null;

  const excludedGameIds = new Set<string>([gameId, afterDaily.definition.gameId]);
  const recommended = getPlayNextRecommendations(after, {
    excludedGameIds: [...excludedGameIds],
    limit: 1,
  })[0];
  const recommendedGame = recommended
    ? GAMES_REGISTRY.find((game) => game.id === recommended.gameId)
    : undefined;
  const nextRecommendation = recommended && recommendedGame
    ? {
        gameId: recommended.gameId,
        gameTitle: recommendedGame.title,
        reason: recommended.reason,
        eyebrow: recommended.eyebrow,
        detail: recommended.detail,
      }
    : null;

  const levelUp = afterLevel.level > beforeLevel.level;
  const xpGained = Math.max(0, afterLevel.totalXP - beforeLevel.totalXP);
  const celebration: ResultCelebration = levelUp
    ? 'level-up'
    : dailyChallenge?.justCompleted
      ? 'daily-challenge'
      : unlockedAchievements.length > 0
        ? 'achievement'
        : isPersonalBest
          ? 'personal-best'
          : 'none';

  return {
    isPersonalBest,
    previousBestAP: beforeBestAP,
    bestAP: afterBestAP,
    pbGainAP,
    unlockedAchievements,
    xpBefore: beforeLevel.totalXP,
    xpAfter: afterLevel.totalXP,
    xpGained,
    levelBefore: beforeLevel.level,
    levelAfter: afterLevel.level,
    levelTitle: afterLevel.title,
    levelProgressPercent: afterLevel.progressPercent,
    levelUp,
    dailyChallenge,
    nextRecommendation,
    celebration,
  };
}
