import React from 'react';
import { ArrowRight, Award, Flame, Target, TrendingUp, Trophy, Zap } from 'lucide-react';
import type { LeaderboardRankDelta, ResultMetaSummary } from '../lib/resultMeta';
import { sounds } from '../lib/sound';

interface ResultMetaSummaryProps {
  meta: ResultMetaSummary;
  rankDelta: LeaderboardRankDelta | null;
  accentColor: string;
  onPlayRecommended?: (gameId: string) => void;
}

export const ResultMetaSummaryPanel: React.FC<ResultMetaSummaryProps> = ({
  meta,
  rankDelta,
  accentColor,
  onPlayRecommended,
}) => {
  const rankImprovement = rankDelta && rankDelta.before !== null
    ? Math.max(0, rankDelta.before - rankDelta.after)
    : 0;

  return (
    <section
      aria-label="Run progression"
      className="mb-3 w-full rounded-xl border border-zinc-700/80 bg-[#111114] p-3 text-left"
      data-result-meta
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
          Run progress
        </span>
        <span className="text-[10px] font-mono-arcade text-zinc-500">
          LV {meta.levelAfter} · {meta.levelProgressPercent}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {meta.isPersonalBest && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              Personal best
            </div>
            <div className="mt-1 font-mono-arcade text-[10px] text-amber-100/75">
              {meta.pbGainAP > 0 ? `+${meta.pbGainAP.toLocaleString()} AP` : 'New precision best'}
            </div>
          </div>
        )}

        {meta.xpGained > 0 && (
          <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-2.5">
            <div className="flex items-center gap-1.5 font-bold text-cyan-200">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              +{meta.xpGained.toLocaleString()} XP
            </div>
            <div className="mt-1 font-mono-arcade text-[10px] text-cyan-100/70">
              {meta.unlockedAchievements.length} new {meta.unlockedAchievements.length === 1 ? 'badge' : 'badges'}
            </div>
          </div>
        )}

        {meta.levelUp && (
          <div className="col-span-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 p-2.5">
            <div className="flex items-center gap-1.5 font-bold text-fuchsia-200">
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              Level up · LV {meta.levelAfter}
            </div>
            <div className="mt-1 text-[10px] text-fuchsia-100/70">{meta.levelTitle}</div>
          </div>
        )}

        {meta.dailyChallenge && (
          <div className={`col-span-2 rounded-lg border p-2.5 ${meta.dailyChallenge.completed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-zinc-700 bg-black/20'}`}>
            <div className={`flex items-center gap-1.5 font-bold ${meta.dailyChallenge.completed ? 'text-emerald-200' : 'text-zinc-300'}`}>
              <Target className="h-3.5 w-3.5" aria-hidden="true" />
              {meta.dailyChallenge.completed ? 'Daily challenge complete' : `Daily challenge · ${meta.dailyChallenge.progressPercent}%`}
            </div>
            <div className="mt-1 font-mono-arcade text-[10px] text-zinc-400">
              {meta.dailyChallenge.bestAP.toLocaleString()} / {meta.dailyChallenge.targetAP.toLocaleString()} AP
              {meta.dailyChallenge.completed ? ` · ${meta.dailyChallenge.currentStreak} day streak` : ''}
            </div>
          </div>
        )}

        {rankDelta && (
          <div className="col-span-2 rounded-lg border border-violet-500/25 bg-violet-500/10 p-2.5">
            <div className="flex items-center gap-1.5 font-bold text-violet-200">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              {rankDelta.before === null
                ? `Entered global rank #${rankDelta.after}`
                : rankImprovement > 0
                  ? `Global rank ↑ ${rankImprovement} to #${rankDelta.after}`
                  : `Global rank #${rankDelta.after}`}
            </div>
          </div>
        )}
      </div>

      {meta.unlockedAchievements.length > 0 && (
        <div className="mt-2 space-y-1.5" data-result-achievements>
          {meta.unlockedAchievements.slice(0, 2).map((achievement) => (
            <div
              key={achievement.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/20 px-2.5 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Award className="h-3.5 w-3.5 shrink-0" style={{ color: achievement.accentColor }} aria-hidden="true" />
                <span className="truncate text-[11px] font-bold text-zinc-200">{achievement.title}</span>
              </span>
              <span className="shrink-0 font-mono-arcade text-[9px] text-zinc-500">+{achievement.xpReward} XP</span>
            </div>
          ))}
          {meta.unlockedAchievements.length > 2 && (
            <div className="px-1 text-[10px] text-zinc-500">
              +{meta.unlockedAchievements.length - 2} more unlocked
            </div>
          )}
        </div>
      )}

      {meta.nextRecommendation && onPlayRecommended && (
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onPlayRecommended(meta.nextRecommendation!.gameId);
          }}
          className="mt-2.5 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left transition hover:border-zinc-600 hover:bg-zinc-800 active:scale-[0.995]"
          data-result-next-recommendation={meta.nextRecommendation.gameId}
        >
          <span className="min-w-0">
            <span className="block text-[9px] font-black uppercase tracking-[0.13em] text-zinc-500">
              {meta.nextRecommendation.eyebrow}
            </span>
            <span className="block truncate text-xs font-bold text-white">
              Play next · {meta.nextRecommendation.gameTitle}
            </span>
            <span className="mt-0.5 block truncate text-[10px] text-zinc-400">
              {meta.nextRecommendation.detail}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" style={{ color: accentColor }} aria-hidden="true" />
        </button>
      )}
    </section>
  );
};
