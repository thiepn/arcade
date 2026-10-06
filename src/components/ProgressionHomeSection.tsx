import React, { useMemo } from 'react';
import { ArrowRight, Award, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { ACHIEVEMENTS_REGISTRY, getPlayerLevelInfo } from '../lib/achievements';
import { getNearAchievementGoals, getPlayNextRecommendations } from '../lib/homeProgression';
import { GAMES_REGISTRY } from '../data/games';
import type { UserStats } from '../types';
import { sounds } from '../lib/sound';

interface ProgressionHomeSectionProps {
  stats: UserStats;
  excludedGameId?: string;
  onPlayGame: (gameId: string) => void;
  onOpenAchievements: () => void;
}

export const ProgressionHomeSection: React.FC<ProgressionHomeSectionProps> = ({
  stats,
  excludedGameId,
  onPlayGame,
  onOpenAchievements,
}) => {
  const reduceMotion = useReducedMotion() === true;
  const level = useMemo(() => getPlayerLevelInfo(stats), [stats]);
  const unlockedCount = useMemo(
    () => ACHIEVEMENTS_REGISTRY.filter((achievement) => achievement.isUnlocked(stats)).length,
    [stats],
  );
  const nearGoals = useMemo(() => getNearAchievementGoals(stats, 2), [stats]);
  const recommendations = useMemo(
    () => getPlayNextRecommendations(stats, {
      excludedGameIds: excludedGameId ? [excludedGameId] : [],
      limit: 3,
    }),
    [stats, excludedGameId],
  );

  const xpRemaining = level.nextLevelXP === null ? 0 : Math.max(0, level.nextLevelXP - level.totalXP);

  return (
    <section
      aria-label="Arcade progression"
      data-p31-motion={reduceMotion ? 'reduced' : 'full'}
      className="w-full max-w-6xl mx-auto px-4 sm:px-8 pb-4"
    >
      <div className="grid gap-3 lg:grid-cols-[1.05fr_1.45fr]">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.24, ease: 'easeOut' }}
          className="rounded-2xl border border-zinc-800 bg-[#111114] p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Progression
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-3xl font-black tabular-nums"
                  style={{ color: level.accentColor }}
                >
                  LV {level.level}
                </span>
                <span className="truncate text-sm font-bold text-white">{level.title}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {level.totalXP.toLocaleString()} XP • {unlockedCount}/{ACHIEVEMENTS_REGISTRY.length} badges
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playPop();
                onOpenAchievements();
              }}
              className="min-h-11 shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-zinc-300 transition hover:border-zinc-600 hover:text-white active:scale-[0.98]"
            >
              View badges
            </button>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-mono-arcade">
              <span className="text-zinc-500">
                {level.isMaxLevel ? 'Maximum level reached' : `${xpRemaining.toLocaleString()} XP to LV ${level.level + 1}`}
              </span>
              <span className="text-zinc-400">{level.progressPercent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Player level progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={level.progressPercent}
              className="h-2 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-inset ring-zinc-800"
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: level.accentColor }}
                initial={false}
                animate={{ width: `${level.progressPercent}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }}
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
              <Target className="h-3.5 w-3.5" aria-hidden="true" />
              Closest goals
            </div>
            {nearGoals.length > 0 ? nearGoals.map((goal) => (
              <button
                type="button"
                key={goal.id}
                onClick={() => {
                  if (goal.gameId) {
                    sounds.playClick();
                    onPlayGame(goal.gameId);
                  } else {
                    sounds.playPop();
                    onOpenAchievements();
                  }
                }}
                className="group min-h-14 w-full rounded-xl border border-zinc-800 bg-black/20 p-3 text-left transition hover:border-zinc-700 hover:bg-black/30 active:scale-[0.995]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-zinc-200">{goal.title}</div>
                    <div className="mt-0.5 truncate text-[10px] font-mono-arcade text-zinc-500">{goal.progressText}</div>
                  </div>
                  <span className="shrink-0 text-[10px] font-black" style={{ color: goal.accentColor }}>
                    +{goal.xpReward.toLocaleString()} XP
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${goal.progressPercent}%`, backgroundColor: goal.accentColor }}
                  />
                </div>
              </button>
            )) : (
              <div className="rounded-xl border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-500">
                All local progression goals are complete.
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.24, delay: reduceMotion ? 0 : 0.04, ease: 'easeOut' }}
          className="rounded-2xl border border-zinc-800 bg-[#111114] p-4 sm:p-5"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                Play next
              </div>
              <p className="mt-1 text-xs text-zinc-500">Based only on your own arcade progress.</p>
            </div>
            <Trophy className="h-5 w-5 text-amber-400/70" aria-hidden="true" />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {recommendations.map((recommendation) => {
              const game = GAMES_REGISTRY.find((entry) => entry.id === recommendation.gameId);
              if (!game) return null;
              return (
                <button
                  type="button"
                  key={recommendation.gameId}
                  onClick={() => {
                    sounds.playClick();
                    onPlayGame(recommendation.gameId);
                  }}
                  className="group flex min-h-36 flex-col justify-between rounded-xl border border-zinc-800 bg-black/20 p-3 text-left transition hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-black/30 active:translate-y-0"
                >
                  <div>
                    <span
                      className="text-[9px] font-black uppercase tracking-[0.14em]"
                      style={{ color: game.accentColor }}
                    >
                      {recommendation.eyebrow}
                    </span>
                    <h3 className="mt-1 text-sm font-black text-white">{game.title}</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{recommendation.title}</p>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <span className="text-[9px] leading-tight text-zinc-600">{recommendation.detail}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-white" aria-hidden="true" />
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playPop();
              onOpenAchievements();
            }}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[10px] font-bold text-zinc-500 transition hover:text-amber-300"
          >
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            See all achievements and progression
          </button>
        </motion.div>
      </div>
    </section>
  );
};
