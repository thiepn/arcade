import React from 'react';
import { CalendarDays, CheckCircle2, Flame, Play, Target, Trophy } from 'lucide-react';
import type { GameDefinition } from '../types';
import { DAILY_CHALLENGE_STRONG_AP, type DailyChallengeView } from '../lib/dailyChallenge';
import { sounds } from '../lib/sound';

interface DailyChallengeCardProps {
  game: GameDefinition;
  challenge: DailyChallengeView;
  onPlay: (gameId: string) => void;
}

export const DailyChallengeCard: React.FC<DailyChallengeCardProps> = ({ game, challenge, onPlay }) => {
  const strongProgress = Math.min(100, Math.round((challenge.bestAP / DAILY_CHALLENGE_STRONG_AP) * 100));

  return (
    <section
      className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-3"
      aria-labelledby="daily-challenge-title"
      data-daily-challenge={challenge.dayKey}
    >
      <div
        className="relative overflow-hidden rounded-2xl border bg-[#111114] p-4 sm:p-5 shadow-[0_14px_40px_rgba(0,0,0,0.24)]"
        style={{ borderColor: game.accentColor + '55' }}
      >
        <div
          className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: game.accentColor }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2 font-mono-arcade text-[10px] font-black uppercase tracking-[0.16em]">
              <span className="inline-flex items-center gap-1.5 text-cyan-300">
                <CalendarDays className="h-3.5 w-3.5" /> Daily Challenge
              </span>
              {challenge.completed && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> Complete
                </span>
              )}
            </div>

            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg font-black"
                style={{ borderColor: game.accentColor + '55', backgroundColor: game.accentColor + '18', color: game.accentColor }}
                aria-hidden="true"
              >
                <Target className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 id="daily-challenge-title" className="text-lg font-black text-white sm:text-xl">
                  {game.title}
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                  Complete one scored run to keep your streak alive. Push for <strong className="text-zinc-200">{DAILY_CHALLENGE_STRONG_AP.toLocaleString()} AP</strong> for today&apos;s strong-run mark.
                </p>
              </div>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-3 gap-2 sm:min-w-[330px]">
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-center">
              <Flame className="mx-auto mb-1 h-3.5 w-3.5 text-orange-400" />
              <div className="text-base font-black text-white">{challenge.currentStreak}</div>
              <div className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Streak</div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-center">
              <Trophy className="mx-auto mb-1 h-3.5 w-3.5 text-amber-400" />
              <div className="text-base font-black text-white">{challenge.bestStreak}</div>
              <div className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Best</div>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-center">
              <Target className="mx-auto mb-1 h-3.5 w-3.5 text-cyan-400" />
              <div className="text-base font-black text-white">{challenge.totalCompleted}</div>
              <div className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Days</div>
            </div>
          </div>

          <div className="shrink-0 lg:w-48">
            <div className="mb-2 flex items-center justify-between font-mono-arcade text-[9px] font-bold uppercase">
              <span className="text-zinc-500">Today&apos;s best</span>
              <span className={challenge.strongGoalReached ? 'text-emerald-300' : 'text-zinc-300'}>
                {challenge.bestAP.toLocaleString()} AP
              </span>
            </div>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-zinc-800" aria-label={'Strong goal progress ' + strongProgress + '%'}>
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: strongProgress + '%', backgroundColor: game.accentColor }}
              />
            </div>
            <button
              type="button"
              id="daily-challenge-play"
              onClick={() => {
                sounds.playSuccess();
                onPlay(game.id);
              }}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-black text-black transition hover:bg-zinc-100 active:scale-[0.98]"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {challenge.completed ? 'PLAY AGAIN' : 'PLAY TODAY'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
