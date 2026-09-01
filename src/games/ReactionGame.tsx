import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { AlertTriangle, ArrowLeft, ArrowRight, Award, Brain, Gauge, Play, ShieldAlert, Zap } from 'lucide-react';
import { useSafeTimeout } from '../hooks/useGameLoop';
import {
  REACTION_ROUNDS,
  requiresChoice,
  scoreReactionAttempt,
  usesInhibitionDecoy,
  type ReactionChoice,
} from '../lib/reactionGameplay';
import { REACTION_OVERTIME_ROUNDS, isReactionOvertimeUnlocked } from '../lib/reactionOvertime';

type StateMode = 'WAITING' | 'DECOY' | 'READY' | 'RESULT';

interface AttemptResult {
  reactionTimeMs: number | null;
  correct: boolean;
  reason: string;
  points: number;
  grade: 'LIGHTNING' | 'SHARP' | 'SOLID' | 'LATE';
}

export const ReactionGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const [mode, setMode] = useState<StateMode>('WAITING');
  const [roundIndex, setRoundIndex] = useState(0);
  const [lightsCount, setLightsCount] = useState(0);
  const [choiceTarget, setChoiceTarget] = useState<ReactionChoice | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [overtimeUnlocked, setOvertimeUnlocked] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const attemptLockedRef = useRef(false);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const timerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lightsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setSafeTimeout = useSafeTimeout();

  const getSessionRound = (index: number) =>
    index < REACTION_ROUNDS.length
      ? REACTION_ROUNDS[index]
      : REACTION_OVERTIME_ROUNDS[index - REACTION_ROUNDS.length];
  const roundConfig = getSessionRound(roundIndex);
  const maxRounds = REACTION_ROUNDS.length + REACTION_OVERTIME_ROUNDS.length;
  const displayRoundTotal = overtimeUnlocked || roundIndex >= REACTION_ROUNDS.length
    ? maxRounds
    : REACTION_ROUNDS.length;

  const clearRoundTimers = useCallback(() => {
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
      timerTimeoutRef.current = null;
    }
    if (lightsIntervalRef.current) {
      clearInterval(lightsIntervalRef.current);
      lightsIntervalRef.current = null;
    }
  }, []);

  const scheduleWhenActive = useCallback((callback: () => void, delayMs: number) => {
    const run = () => {
      if (isPausedRef.current) {
        timerTimeoutRef.current = setTimeout(run, 100);
        return;
      }
      callback();
    };
    timerTimeoutRef.current = setTimeout(run, delayMs);
  }, []);

  const startRound = (index: number) => {
    clearRoundTimers();
    const config = getSessionRound(index);
    attemptLockedRef.current = false;
    setMode('WAITING');
    setLightsCount(0);
    setChoiceTarget(null);
    setResult(null);

    let currentLight = 0;
    lightsIntervalRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      currentLight++;
      setLightsCount(currentLight);
      if (soundEnabledRef.current) sounds.playTick();

      if (currentLight >= 5) {
        if (lightsIntervalRef.current) {
          clearInterval(lightsIntervalRef.current);
          lightsIntervalRef.current = null;
        }

        const randomDelay = config.waitMinMs + Math.random() * (config.waitMaxMs - config.waitMinMs);
        scheduleWhenActive(() => {
          const revealReady = () => {
            const nextChoice = requiresChoice(config.kind)
              ? (Math.random() < 0.5 ? 'LEFT' : 'RIGHT') as ReactionChoice
              : null;
            setChoiceTarget(nextChoice);
            setMode('READY');
            startTimeRef.current = performance.now();
            if (soundEnabledRef.current) sounds.playChime(1200);
          };

          if (usesInhibitionDecoy(config.kind)) {
            setMode('DECOY');
            if (soundEnabledRef.current) sounds.playBuzz();
            scheduleWhenActive(() => {
              setMode('WAITING');
              setLightsCount(0);
              scheduleWhenActive(revealReady, 230 + Math.random() * 320);
            }, config.decoyMs);
          } else {
            revealReady();
          }
        }, randomDelay);
      }
    }, 185);
  };

  const completeAttempt = (
    reactionTimeMs: number | null,
    correct: boolean,
    reason: string,
  ) => {
    if (attemptLockedRef.current) return;
    attemptLockedRef.current = true;
    clearRoundTimers();

    const scoring = reactionTimeMs === null
      ? { points: 0, grade: 'LATE' as const }
      : scoreReactionAttempt(roundConfig, reactionTimeMs, correct);

    const nextMistakes = mistakes + (correct ? 0 : 1);
    const nextCorrectCount = history.length + (reactionTimeMs !== null && correct ? 1 : 0);
    if (!correct) setMistakes(nextMistakes);
    if (reactionTimeMs !== null && correct) {
      setHistory((previous) => [...previous, reactionTimeMs]);
    }

    const newScore = scoreRef.current + scoring.points;
    scoreRef.current = newScore;
    setScore(newScore);
    onScoreUpdate(newScore);
    setResult({ reactionTimeMs, correct, reason, points: scoring.points, grade: scoring.grade });
    setMode('RESULT');

    if (soundEnabledRef.current) {
      if (!correct) sounds.playHit();
      else if (scoring.grade === 'LIGHTNING') sounds.playLaser();
      else if (scoring.grade === 'SHARP') sounds.playSuccess();
      else sounds.playPop();
    }

    if (roundIndex === REACTION_ROUNDS.length - 1) {
      const unlocksOvertime = isReactionOvertimeUnlocked(nextCorrectCount, nextMistakes);
      setOvertimeUnlocked(unlocksOvertime);
      if (unlocksOvertime) {
        if (soundEnabledRef.current) sounds.playSuccess();
      } else {
        setSafeTimeout(() => onGameOver(newScore), 1500);
      }
    } else if (roundIndex >= maxRounds - 1) {
      setSafeTimeout(() => onGameOver(newScore), 1500);
    }
  };

  const handleInput = (choice?: ReactionChoice) => {
    if (isPausedRef.current) return;

    if (mode === 'RESULT') {
      if (roundIndex === REACTION_ROUNDS.length - 1 && !overtimeUnlocked) return;
      if (roundIndex < maxRounds - 1) {
        const nextIndex = roundIndex + 1;
        setRoundIndex(nextIndex);
        startRound(nextIndex);
      }
      return;
    }

    if (attemptLockedRef.current) return;

    if (mode === 'WAITING') {
      completeAttempt(null, false, 'FALSE START');
      return;
    }

    if (mode === 'DECOY') {
      completeAttempt(null, false, 'INHIBITION FAIL');
      return;
    }

    if (mode === 'READY') {
      const reactionTimeMs = Math.round(performance.now() - startTimeRef.current);
      const needsChoice = requiresChoice(roundConfig.kind);
      if (needsChoice && choice !== choiceTarget) {
        completeAttempt(reactionTimeMs, false, 'WRONG SIDE');
        return;
      }
      completeAttempt(reactionTimeMs, true, 'CORRECT');
    }
  };

  useEffect(() => {
    startRound(0);
    return clearRoundTimers;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (mode === 'RESULT' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        handleInput();
        return;
      }

      const needsChoice = requiresChoice(roundConfig.kind) && mode === 'READY';
      if (needsChoice) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'Digit1') {
          e.preventDefault();
          handleInput('LEFT');
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Digit2') {
          e.preventDefault();
          handleInput('RIGHT');
        }
        return;
      }

      if (
        e.code === 'Space' ||
        e.code === 'Enter' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'KeyA' ||
        e.code === 'KeyD'
      ) {
        e.preventDefault();
        handleInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, roundConfig.kind, choiceTarget, roundIndex]);

  const bestTime = history.length > 0 ? Math.min(...history) : null;
  const avgTime = history.length > 0
    ? Math.round(history.reduce((sum, value) => sum + value, 0) / history.length)
    : null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();

    if (mode === 'READY' && requiresChoice(roundConfig.kind) && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      handleInput(e.clientX < rect.left + rect.width / 2 ? 'LEFT' : 'RIGHT');
      return;
    }
    handleInput();
  };

  const readyBackground = mode === 'READY'
    ? requiresChoice(roundConfig.kind)
      ? 'bg-[#172554]'
      : 'bg-[#047857]'
    : mode === 'DECOY'
      ? 'bg-[#7F1D1D]'
      : 'bg-[#09090B]';

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      className={`relative w-full h-full flex flex-col items-center justify-between p-4 sm:p-6 select-none cursor-pointer transition-colors duration-100 touch-none ${readyBackground}`}
    >
      <div className="w-full flex items-start justify-between gap-2 z-10 pointer-events-none">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 bg-[#18181B]/90 px-3 py-1.5 rounded-xl border border-[#27272A] font-mono-arcade text-xs">
            <span className="text-[#A1A1AA]">ROUND</span>
            <span className="text-white font-bold">{roundIndex + 1} / {displayRoundTotal}</span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[10px] font-mono-arcade w-fit">
            {roundConfig.label}
          </span>
          {roundIndex >= REACTION_ROUNDS.length && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono-arcade w-fit">
              OVERTIME
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className="px-3 py-1.5 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-white text-xs font-mono-arcade tabular-nums">
            {score.toLocaleString()} PTS
          </span>
          {mistakes > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[10px] font-mono-arcade">
              ERRORS {mistakes}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-5 my-auto z-10 text-center w-full max-w-xl pointer-events-none">
        {mode === 'WAITING' && (
          <>
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-3xl bg-[#18181B]/90 border border-[#27272A] shadow-2xl">
              {[1, 2, 3, 4, 5].map((lightIndex) => {
                const isActive = lightIndex <= lightsCount;
                return (
                  <div key={lightIndex} className="p-1.5 sm:p-2 rounded-2xl bg-[#09090B] border border-[#27272A]">
                    <div
                      className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full transition-all duration-75 ${
                        isActive ? 'bg-[#EF4444] shadow-[0_0_20px_#EF4444]' : 'bg-[#27272A]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center gap-2">
              <h2 className="font-mono-arcade font-black text-2xl sm:text-3xl text-white tracking-wide animate-pulse">
                WAIT FOR THE SIGNAL
              </h2>
              <p className="max-w-md font-mono-arcade text-xs leading-relaxed text-[#A1A1AA]">
                {roundConfig.hint}
              </p>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono-arcade text-[#71717A]">
              {usesInhibitionDecoy(roundConfig.kind) ? <ShieldAlert className="w-3.5 h-3.5" /> : <Brain className="w-3.5 h-3.5" />}
              <span>{requiresChoice(roundConfig.kind) ? 'CHOICE RESPONSE' : 'SIMPLE RESPONSE'}{usesInhibitionDecoy(roundConfig.kind) ? ' • NO-GO ENABLED' : ''}</span>
            </div>
          </>
        )}

        {mode === 'DECOY' && (
          <div className="flex flex-col items-center gap-3 animate-in zoom-in-90 duration-75">
            <AlertTriangle className="w-20 h-20 text-[#FCA5A5] animate-pulse" />
            <h1 className="font-mono-arcade font-black text-5xl sm:text-7xl text-white tracking-widest">
              HOLD!
            </h1>
            <p className="font-mono-arcade text-sm text-[#FCA5A5]">DO NOT TAP THIS SIGNAL</p>
          </div>
        )}

        {mode === 'READY' && !requiresChoice(roundConfig.kind) && (
          <div className="flex flex-col items-center gap-2 animate-in zoom-in-75 duration-75">
            <Zap className="w-20 h-20 text-white fill-white animate-bounce" />
            <h1 className="font-mono-arcade font-black text-5xl sm:text-7xl text-white tracking-widest drop-shadow-2xl">
              TAP NOW!
            </h1>
          </div>
        )}

        {mode === 'READY' && requiresChoice(roundConfig.kind) && choiceTarget && (
          <div className="w-full flex flex-col items-center gap-5 animate-in zoom-in-75 duration-75">
            <Brain className="w-12 h-12 text-sky-300" />
            <div className="flex items-center gap-4 sm:gap-7">
              {choiceTarget === 'LEFT' ? (
                <ArrowLeft className="w-20 h-20 sm:w-28 sm:h-28 text-white stroke-[3]" />
              ) : (
                <ArrowRight className="w-20 h-20 sm:w-28 sm:h-28 text-white stroke-[3]" />
              )}
              <h1 className="font-mono-arcade font-black text-4xl sm:text-6xl text-white tracking-widest">
                {choiceTarget}
              </h1>
            </div>
            <p className="font-mono-arcade text-xs text-sky-200">
              TAP THE {choiceTarget} HALF • {choiceTarget === 'LEFT' ? 'A / ←' : 'D / →'}
            </p>
          </div>
        )}

        {mode === 'RESULT' && result && (
          <div className="flex flex-col items-center gap-4 animate-in zoom-in-90 duration-150">
            {result.correct && result.reactionTimeMs !== null ? (
              <>
                <div className="font-mono-arcade font-black text-6xl sm:text-7xl text-[#38BDF8] tracking-tight tabular-nums">
                  {result.reactionTimeMs} <span className="text-2xl text-white">MS</span>
                </div>
                <div className="px-5 py-2 rounded-2xl border border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#38BDF8] font-mono-arcade font-bold text-sm tracking-wider">
                  {result.grade} • +{result.points.toLocaleString()}
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-16 h-16 text-[#F43F5E]" />
                <h2 className="font-mono-arcade font-black text-3xl sm:text-4xl text-white tracking-wide">
                  {result.reason}
                </h2>
                <p className="font-mono-arcade text-xs text-[#FCA5A5]">ROUND SCORES 0 POINTS</p>
              </>
            )}

            {roundIndex === REACTION_ROUNDS.length - 1 && overtimeUnlocked && (
              <div className="px-4 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono-arcade text-xs font-black">
                OVERTIME UNLOCKED
              </div>
            )}

            <div className="mt-2 px-5 py-2 rounded-xl bg-[#18181B] border border-[#27272A] font-mono-arcade text-xs text-[#A1A1AA] flex items-center gap-2">
              <Play className="w-3.5 h-3.5 text-[#34D399]" />
              <span>{roundIndex < maxRounds - 1 && !(roundIndex === REACTION_ROUNDS.length - 1 && !overtimeUnlocked) ? `TAP FOR ${getSessionRound(roundIndex + 1).label}` : 'CALCULATING FINAL SCORE...'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="w-full flex items-end justify-between gap-2 z-10 pointer-events-none min-h-8">
        <div className="flex gap-2">
          {bestTime !== null && (
            <div className="flex items-center gap-1.5 bg-[#18181B]/90 px-2.5 py-1.5 rounded-lg border border-[#27272A] font-mono-arcade text-[10px] text-[#38BDF8]">
              <Award className="w-3 h-3" /> BEST {bestTime}ms
            </div>
          )}
          {avgTime !== null && (
            <div className="hidden sm:flex items-center gap-1.5 bg-[#18181B]/90 px-2.5 py-1.5 rounded-lg border border-[#27272A] font-mono-arcade text-[10px] text-[#34D399]">
              <Gauge className="w-3 h-3" /> AVG {avgTime}ms
            </div>
          )}
        </div>
        <span className="font-mono-arcade text-[10px] text-[#71717A] text-right">
          SPACE / TAP • CHOICE: A/D OR ←/→
        </span>
      </div>
    </div>
  );
};
