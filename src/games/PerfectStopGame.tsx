import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { Activity, Sparkles, Target } from 'lucide-react';
import { useSafeTimeout } from '../hooks/useGameLoop';
import {
  PERFECT_STOP_ROUNDS,
  getPerfectStopMarkerSpeed,
  getPerfectStopTargetPosition,
  judgePerfectStop,
  type PerfectStopJudgement,
} from '../lib/perfectStopGameplay';
import { PERFECT_STOP_ENCORE_ROUNDS, isPerfectStopEncoreUnlocked } from '../lib/perfectStopEncore';

const PERFECT_STOP_SESSION_ROUNDS = [...PERFECT_STOP_ROUNDS, ...PERFECT_STOP_ENCORE_ROUNDS];

export const PerfectStopGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const [roundIndex, setRoundIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<PerfectStopJudgement | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [masterHits, setMasterHits] = useState(0);
  const [encoreUnlocked, setEncoreUnlocked] = useState(false);
  const setSafeTimeout = useSafeTimeout();

  const markerPosRef = useRef(0);
  const targetPosRef = useRef(PERFECT_STOP_ROUNDS[0].targetStart);
  const markerElementRef = useRef<HTMLDivElement>(null);
  const targetElementRef = useRef<HTMLDivElement>(null);
  const markerDirRef = useRef(1);
  const elapsedRef = useRef(0);
  const nextFlipRef = useRef(Number.POSITIVE_INFINITY);
  const animationFrameRef = useRef<number | null>(null);

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const roundConfig = PERFECT_STOP_SESSION_ROUNDS[roundIndex];
  const maxRounds = PERFECT_STOP_SESSION_ROUNDS.length;
  const displayRoundTotal = encoreUnlocked || roundIndex >= PERFECT_STOP_ROUNDS.length
    ? maxRounds
    : PERFECT_STOP_ROUNDS.length;

  const startRound = (index: number) => {
    const config = PERFECT_STOP_SESSION_ROUNDS[index];
    const startPosition = index % 2 === 0 ? 0 : 100;
    const direction = index % 2 === 0 ? 1 : -1;

    setResult(null);
    setIsRunning(true);
    markerPosRef.current = startPosition;
    targetPosRef.current = getPerfectStopTargetPosition(config, 0);
    markerDirRef.current = direction;
    elapsedRef.current = 0;
    nextFlipRef.current = config.flipIntervalMs > 0
      ? config.flipIntervalMs
      : Number.POSITIVE_INFINITY;

    if (markerElementRef.current) markerElementRef.current.style.left = `${startPosition}%`;
    if (targetElementRef.current) targetElementRef.current.style.left = `${targetPosRef.current}%`;
    if (soundEnabled) sounds.playPop();
  };

  const handleStop = () => {
    if (!isRunning || isPausedRef.current) return;
    setIsRunning(false);

    const judgement = judgePerfectStop(
      markerPosRef.current,
      targetPosRef.current,
      roundConfig,
      streak,
    );
    setResult(judgement);
    setStreak(judgement.nextStreak);
    const isMasterHit = judgement.rating === 'PERFECT' || judgement.rating === 'GREAT';
    const nextMasterHits = masterHits + (roundIndex < PERFECT_STOP_ROUNDS.length && isMasterHit ? 1 : 0);
    if (roundIndex < PERFECT_STOP_ROUNDS.length && isMasterHit) setMasterHits(nextMasterHits);

    const newScore = score + judgement.points;
    setScore(newScore);
    onScoreUpdate(newScore);

    if (soundEnabled) {
      if (judgement.rating === 'PERFECT') sounds.playLaser();
      else if (judgement.rating === 'GREAT') sounds.playCombo(Math.max(1, judgement.nextStreak));
      else if (judgement.rating === 'GOOD') sounds.playPop();
      else sounds.playHit();
    }

    if (roundIndex === PERFECT_STOP_ROUNDS.length - 1) {
      const unlocksEncore = isPerfectStopEncoreUnlocked(nextMasterHits);
      setEncoreUnlocked(unlocksEncore);
      if (unlocksEncore) {
        if (soundEnabled) sounds.playSuccess();
      } else {
        setSafeTimeout(() => onGameOver(newScore), 1400);
      }
    } else if (roundIndex >= maxRounds - 1) {
      setSafeTimeout(() => onGameOver(newScore), 1400);
    }
  };

  const handleNextRound = () => {
    if (!result) return;
    if (roundIndex === PERFECT_STOP_ROUNDS.length - 1 && !encoreUnlocked) return;
    if (roundIndex >= maxRounds - 1) return;
    const nextIndex = roundIndex + 1;
    setRoundIndex(nextIndex);
    startRound(nextIndex);
  };

  useEffect(() => {
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(currentTime - lastTime, 40);
      lastTime = currentTime;

      if (isRunning && !isPausedRef.current) {
        const config = PERFECT_STOP_SESSION_ROUNDS[roundIndex];
        elapsedRef.current += dt;
        const elapsed = elapsedRef.current;

        if (config.flipIntervalMs > 0 && elapsed >= nextFlipRef.current) {
          markerDirRef.current *= -1;
          while (elapsed >= nextFlipRef.current) {
            nextFlipRef.current += config.flipIntervalMs;
          }
        }

        const speed = getPerfectStopMarkerSpeed(config, elapsed);
        markerPosRef.current += speed * markerDirRef.current * (dt / 1000);

        if (markerPosRef.current > 100) {
          markerPosRef.current = 200 - markerPosRef.current;
          markerDirRef.current = -1;
        } else if (markerPosRef.current < 0) {
          markerPosRef.current = -markerPosRef.current;
          markerDirRef.current = 1;
        }

        targetPosRef.current = getPerfectStopTargetPosition(config, elapsed);

        if (markerElementRef.current) {
          markerElementRef.current.style.left = `${markerPosRef.current}%`;
        }
        if (targetElementRef.current) {
          targetElementRef.current.style.left = `${targetPosRef.current}%`;
        }
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isRunning, roundIndex]);

  useEffect(() => {
    startRound(0);
  }, []);

  const ratingClass = result?.rating === 'PERFECT'
    ? 'text-[#38BDF8] border-[#38BDF8]/40 bg-[#38BDF8]/10 shadow-[0_0_14px_rgba(56,189,248,0.3)]'
    : result?.rating === 'GREAT'
      ? 'text-[#34D399] border-[#34D399]/40 bg-[#34D399]/10'
      : result?.rating === 'GOOD'
        ? 'text-[#FACC15] border-[#FACC15]/40 bg-[#FACC15]/10'
        : 'text-[#F43F5E] border-[#F43F5E]/40 bg-[#F43F5E]/10';

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between p-4 sm:p-6 select-none cursor-pointer bg-[#0A0A0B] touch-none"
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        if (isRunning) handleStop();
        else if (result && roundIndex < maxRounds - 1) handleNextRound();
      }}
      onKeyDown={(e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          if (isRunning) handleStop();
          else if (result && roundIndex < maxRounds - 1) handleNextRound();
        }
      }}
      tabIndex={0}
    >
      <div className="w-full flex items-start justify-between gap-2 pointer-events-none">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono-arcade text-xs text-[#A1A1AA] bg-[#18181B] px-3 py-1.5 rounded-xl border border-[#27272A] w-fit">
            SECTOR {roundIndex + 1} / {displayRoundTotal}
          </span>
          <span className="font-mono-arcade text-[10px] text-[#38BDF8] bg-[#38BDF8]/10 px-2.5 py-1 rounded-lg border border-[#38BDF8]/20 w-fit">
            {roundConfig.label}
          </span>
          <span className="font-mono-arcade text-[9px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 w-fit">
            MASTER {Math.min(masterHits, 4)} / 4
          </span>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className="font-mono-arcade text-xs text-white bg-[#18181B] px-3 py-1.5 rounded-xl border border-[#27272A] tabular-nums">
            {score.toLocaleString()} PTS
          </span>
          {streak > 1 && (
            <span className="font-mono-arcade text-[10px] text-[#FACC15] bg-[#18181B] px-2.5 py-1 rounded-lg border border-[#FACC15]/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> STREAK x{streak}
            </span>
          )}
        </div>
      </div>

      <div className="w-full max-w-lg flex flex-col items-center gap-5 sm:gap-7 pointer-events-none">
        <div className="min-h-24 flex flex-col items-center justify-center text-center gap-2">
          {result ? (
            <>
              <div className="flex items-end gap-2">
                <span className="text-5xl sm:text-6xl font-mono-arcade font-black text-white tabular-nums">
                  {result.accuracy}%
                </span>
                <span className="font-mono-arcade text-xs text-[#A1A1AA] mb-2">
                  Δ {result.distance.toFixed(1)}
                </span>
              </div>
              <div className={`px-4 py-1.5 rounded-full border font-mono-arcade font-black text-xs tracking-wider ${ratingClass}`}>
                {result.rating} • +{result.points.toLocaleString()}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-mono-arcade text-white">
                <Target className="w-5 h-5 text-[#38BDF8]" />
                <span>STOP INSIDE THE TARGET BEACON</span>
              </div>
              <p className="max-w-sm text-[11px] leading-relaxed font-mono-arcade text-[#71717A]">
                {roundConfig.hint}
              </p>
            </>
          )}
        </div>

        <div className="w-full bg-[#18181B] p-4 rounded-2xl border border-[#27272A] shadow-2xl relative">
          <div className="relative h-16 bg-[#09090B] rounded-xl overflow-hidden border border-[#27272A] flex items-center">
            <div
              ref={targetElementRef}
              className="absolute top-0 bottom-0 -translate-x-1/2 border-x border-[#34D399]/50 bg-[#34D399]/10 flex items-center justify-center"
              style={{
                left: `${roundConfig.targetStart}%`,
                width: `${roundConfig.goodWindow * 2}%`,
              }}
            >
              <div
                className="h-full bg-[#38BDF8]/15 border-x border-[#38BDF8]/60 flex items-center justify-center"
                style={{ width: `${Math.max(8, (roundConfig.perfectWindow / roundConfig.goodWindow) * 100)}%` }}
              >
                <div className="w-0.5 h-full bg-[#38BDF8] shadow-[0_0_10px_#38BDF8]" />
              </div>
            </div>

            <div
              ref={markerElementRef}
              className="absolute top-0 bottom-0 w-3 -ml-1.5 transition-none flex flex-col items-center justify-between py-1 pointer-events-none z-10"
              style={{ left: '0%' }}
            >
              <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_12px_#FFFFFF]" />
              <div className="w-1 h-full bg-white/90 shadow-[0_0_8px_#FFFFFF]" />
              <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_12px_#FFFFFF]" />
            </div>
          </div>

          <div className="mt-3 flex justify-between text-[10px] font-mono-arcade text-[#71717A] px-1">
            <span>0</span>
            <span>25</span>
            <span className="text-[#A1A1AA]">50</span>
            <span>75</span>
            <span>100</span>
          </div>

          {(roundConfig.targetAmplitude > 0 || roundConfig.flipIntervalMs > 0 || roundConfig.speedPulse > 0) && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {roundConfig.targetAmplitude > 0 && (
                <span className="px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[9px] font-mono-arcade">
                  MOVING TARGET
                </span>
              )}
              {roundConfig.speedPulse > 0 && (
                <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[9px] font-mono-arcade">
                  SPEED PULSE
                </span>
              )}
              {roundConfig.flipIntervalMs > 0 && (
                <span className="px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[9px] font-mono-arcade flex items-center gap-1">
                  <Activity className="w-3 h-3" /> AUTO REVERSE
                </span>
              )}
            </div>
          )}
        </div>

        <div>
          {roundIndex === PERFECT_STOP_ROUNDS.length - 1 && encoreUnlocked && result && (
            <div className="mb-2 px-5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono-arcade font-black text-xs text-center">
              MASTER ENCORE UNLOCKED
            </div>
          )}
          {isRunning ? (
            <div className="px-6 py-2.5 rounded-xl bg-[#38BDF8] text-[#09090B] font-mono-arcade font-bold text-xs shadow-lg shadow-[#38BDF8]/20 animate-pulse">
              TAP OR SPACE TO LOCK
            </div>
          ) : roundIndex < maxRounds - 1 && !(roundIndex === PERFECT_STOP_ROUNDS.length - 1 && !encoreUnlocked) ? (
            <div className="px-6 py-2.5 rounded-xl bg-[#18181B] text-white font-mono-arcade font-bold text-xs border border-[#27272A]">
              TAP FOR {PERFECT_STOP_SESSION_ROUNDS[roundIndex + 1].label}
            </div>
          ) : (
            <div className="px-6 py-2.5 rounded-xl bg-[#34D399] text-[#09090B] font-mono-arcade font-bold text-xs">
              FINAL SCORE: {score.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className="h-2" />
    </div>
  );
};
