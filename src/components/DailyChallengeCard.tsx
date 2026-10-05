import React from 'react';
import { CheckCircle2, Flame, Play, Target, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import type { GameDefinition } from '../types';
import type { DailyChallengeSummary } from '../lib/dailyChallenge';

interface DailyChallengeCardProps {
  game: GameDefinition;
  summary: DailyChallengeSummary;
  onPlay: () => void;
}

export const DailyChallengeCard: React.FC<DailyChallengeCardProps> = ({ game, summary, onPlay }) => {
  const remaining = Math.max(0, summary.definition.targetAP - summary.bestAP);
  const streakLabel = summary.currentStreak > 0
    ? `${summary.currentStreak} day${summary.currentStreak === 1 ? '' : 's'}`
    : 'Start today';

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      aria-label="Daily challenge"
      className="w-full max-w-6xl mx-auto px-4 sm:px-8 pb-3"
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#111114] p-4 sm:p-5"
        style={{ boxShadow: `0 16px 50px -32px ${game.accentColor}` }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full opacity-15 blur-3xl"
          style={{ backgroundColor: game.accentColor }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-black/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                <Target className="h-3 w-3" aria-hidden="true" />
                Daily challenge
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono-arcade uppercase tracking-wide text-zinc-500">
                <Flame className="h-3.5 w-3.5 text-orange-400" aria-hidden="true" />
                {streakLabel} streak
              </span>
              {summary.bestStreak > summary.currentStreak && (
                <span className="text-[10px] font-mono-arcade text-zinc-600">
                  Best {summary.bestStreak}
                </span>
              )}
            </div>

            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                style={{
                  color: game.accentColor,
                  borderColor: `${game.accentColor}55`,
                  backgroundColor: game.accentBg,
                }}
                aria-hidden="true"
              >
                {summary.completed ? <CheckCircle2 className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black text-white sm:text-xl">{game.title}</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                  {summary.completed
                    ? `Cleared at ${summary.bestAP.toLocaleString()} AP. Play again to push your daily best.`
                    : `Reach ${summary.definition.targetAP.toLocaleString()} AP in today's cabinet.`}
                </p>
              </div>
            </div>

            <div className="mt-4 max-w-2xl">
              <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-mono-arcade uppercase tracking-wide">
                <span className={summary.completed ? 'text-emerald-400' : 'text-zinc-500'}>
                  {summary.completed ? 'Challenge complete' : remaining > 0 ? `${remaining.toLocaleString()} AP to go` : 'Ready'}
                </span>
                <span className="text-zinc-400">
                  {summary.bestAP.toLocaleString()} / {summary.definition.targetAP.toLocaleString()} AP
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-inset ring-zinc-800"
                role="progressbar"
                aria-label="Daily challenge progress"
                aria-valuemin={0}
                aria-valuemax={summary.definition.targetAP}
                aria-valuenow={Math.min(summary.bestAP, summary.definition.targetAP)}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: summary.completed ? '#34D399' : game.accentColor }}
                  initial={false}
                  animate={{ width: `${summary.progressPercent}%` }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 lg:min-w-44">
            <button
              type="button"
              onClick={onPlay}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-black transition hover:bg-zinc-100 active:scale-[0.98]"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              {summary.completed ? 'Play again' : summary.bestAP > 0 ? 'Continue challenge' : 'Start daily run'}
            </button>
            <div className="text-center text-[9px] font-mono-arcade uppercase tracking-wide text-zinc-600">
              Resets 00:00 UTC • Works offline
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
};
