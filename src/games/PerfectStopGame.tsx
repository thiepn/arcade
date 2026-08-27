import React, { useState, useEffect, useRef } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { Target, Award, Play, Sparkles } from 'lucide-react';
import { useSafeTimeout } from '../hooks/useGameLoop';

export const PerfectStopGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const [round, setRound] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [stoppedAccuracy, setStoppedAccuracy] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [markerPos, setMarkerPos] = useState(0);
  const setSafeTimeout = useSafeTimeout();

  const maxRounds = 5;
  const markerPosRef = useRef(0); // 0 to 100
  const markerDirRef = useRef(1);
  const markerSpeedRef = useRef(2.2);
  const animationFrameRef = useRef<number | null>(null);

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const startRound = (roundNum: number) => {
    setStoppedAccuracy(null);
    setIsRunning(true);
    markerPosRef.current = 0;
    markerDirRef.current = 1;
    // Speed ramps up with difficulty curve
    markerSpeedRef.current = 2.2 + (roundNum - 1) * 0.85;
    if (soundEnabled) sounds.playPop();
  };

  const handleStop = () => {
    if (!isRunning || isPausedRef.current) return;
    setIsRunning(false);

    const pos = markerPosRef.current;
    const distFromCenter = Math.abs(pos - 50);
    // Accuracy from 0.0% to 100.0%
    const accuracy = Math.max(
      0,
      Math.round((100 - distFromCenter * 2) * 10) / 10
    );
    setStoppedAccuracy(accuracy);

    let roundPts = Math.round(accuracy * 15);
    let newStreak = streak;

    if (accuracy >= 97) {
      newStreak++;
      roundPts *= 2.5;
      if (soundEnabled) sounds.playLaser();
    } else if (accuracy >= 88) {
      newStreak++;
      roundPts *= 1.5;
      if (soundEnabled) sounds.playCombo(newStreak);
    } else {
      newStreak = 0;
      if (soundEnabled) sounds.playHit();
    }

    setStreak(newStreak);
    const newScore = Math.round(score + roundPts);
    setScore(newScore);
    onScoreUpdate(newScore);

    if (round >= maxRounds) {
      setSafeTimeout(() => {
        onGameOver(newScore);
      }, 1400);
    }
  };

  const handleNextRound = () => {
    if (round < maxRounds) {
      const nextR = round + 1;
      setRound(nextR);
      startRound(nextR);
    }
  };

  useEffect(() => {
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(currentTime - lastTime, 40);
      lastTime = currentTime;

      if (isRunning && !isPausedRef.current) {
        markerPosRef.current +=
          markerSpeedRef.current * markerDirRef.current * (dt / 16);
        if (markerPosRef.current >= 100) {
          markerPosRef.current = 100;
          markerDirRef.current = -1;
        } else if (markerPosRef.current <= 0) {
          markerPosRef.current = 0;
          markerDirRef.current = 1;
        }
        setMarkerPos(markerPosRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isRunning]);

  useEffect(() => {
    startRound(1);
  }, []);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between p-6 select-none cursor-pointer bg-[#0A0A0B] touch-none"
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        if (isRunning) handleStop();
        else if (stoppedAccuracy !== null && round < maxRounds) handleNextRound();
      }}
      onKeyDown={(e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          if (isRunning) handleStop();
          else if (stoppedAccuracy !== null && round < maxRounds) handleNextRound();
        }
      }}
      tabIndex={0}
    >
      {/* Top Bar */}
      <div className="w-full flex items-center justify-between pointer-events-none">
        <span className="font-mono-arcade text-xs text-[#A1A1AA] bg-[#18181B] px-3.5 py-1.5 rounded-xl border border-[#27272A]">
          SECTOR {round} / {maxRounds}
        </span>
        {streak > 1 && (
          <span className="font-mono-arcade text-xs text-[#FACC15] bg-[#18181B] px-3.5 py-1.5 rounded-xl border border-[#FACC15]/30 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> STREAK x{streak}
          </span>
        )}
      </div>

      {/* Main Timing Scale */}
      <div className="w-full max-w-md flex flex-col items-center gap-8 pointer-events-none">
        {/* Rating feedback */}
        <div className="h-20 flex flex-col items-center justify-center">
          {stoppedAccuracy !== null ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-5xl font-mono-arcade font-black text-white">
                {stoppedAccuracy}%
              </span>
              <span
                className={`text-xs font-bold font-mono-arcade px-3.5 py-1 rounded-full border ${
                  stoppedAccuracy >= 97
                    ? 'text-[#38BDF8] border-[#38BDF8]/40 bg-[#38BDF8]/10 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                    : stoppedAccuracy >= 88
                    ? 'text-[#34D399] border-[#34D399]/40 bg-[#34D399]/10'
                    : stoppedAccuracy >= 75
                    ? 'text-[#FACC15] border-[#FACC15]/40 bg-[#FACC15]/10'
                    : 'text-[#71717A] border-[#27272A] bg-[#18181B]'
                }`}
              >
                {stoppedAccuracy >= 97
                  ? '🎯 DIAMOND BULLSEYE!'
                  : stoppedAccuracy >= 88
                  ? '⚡ PINPOINT ACCURACY'
                  : stoppedAccuracy >= 75
                  ? '👌 GOOD TIMING'
                  : 'OFF TARGET'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-mono-arcade text-[#A1A1AA] bg-[#18181B] px-4 py-2 rounded-xl border border-[#27272A]">
              <Target className="w-4 h-4 text-[#38BDF8]" />
              <span>LOCK ON CENTER 50.0% MARK</span>
            </div>
          )}
        </div>

        {/* The Track Slider */}
        <div className="w-full bg-[#18181B] p-4 rounded-2xl border border-[#27272A] shadow-2xl relative">
          {/* Target Center Zone Highlighting */}
          <div className="relative h-14 bg-[#09090B] rounded-xl overflow-hidden border border-[#27272A] flex items-center">
            {/* Center Bullseye marker */}
            <div className="absolute left-1/2 -translate-x-1/2 w-8 h-full bg-[#38BDF8]/20 border-x border-[#38BDF8]/50 flex items-center justify-center">
              <div className="w-0.5 h-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]" />
            </div>

            {/* Emerald Good Zone */}
            <div className="absolute left-1/2 -translate-x-1/2 w-28 h-full bg-[#34D399]/10 border-x border-[#34D399]/20" />

            {/* Moving Cursor Indicator */}
            <div
              className="absolute top-0 bottom-0 w-3 -ml-1.5 transition-none flex flex-col items-center justify-between py-1 pointer-events-none"
              style={{ left: `${markerPos}%` }}
            >
              <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_12px_#FFFFFF]" />
              <div className="w-1 h-full bg-white/90 shadow-[0_0_8px_#FFFFFF]" />
              <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_12px_#FFFFFF]" />
            </div>
          </div>

          {/* Scale Labels */}
          <div className="mt-3 flex justify-between text-[10px] font-mono-arcade text-[#71717A] px-1">
            <span>0%</span>
            <span>25%</span>
            <span className="text-[#38BDF8] font-bold">50% TARGET</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Action Button Prompter */}
        <div>
          {isRunning ? (
            <div className="px-6 py-2.5 rounded-xl bg-[#38BDF8] text-[#09090B] font-mono-arcade font-bold text-xs shadow-lg shadow-[#38BDF8]/20 animate-pulse">
              TAP OR SPACE TO STOP
            </div>
          ) : round < maxRounds ? (
            <div className="px-6 py-2.5 rounded-xl bg-[#18181B] text-white font-mono-arcade font-bold text-xs border border-[#27272A]">
              TAP FOR SECTOR {round + 1}
            </div>
          ) : (
            <div className="px-6 py-2.5 rounded-xl bg-[#34D399] text-[#09090B] font-mono-arcade font-bold text-xs">
              FINAL SCORE: {score}
            </div>
          )}
        </div>
      </div>

      <div className="h-2" />
    </div>
  );
};
