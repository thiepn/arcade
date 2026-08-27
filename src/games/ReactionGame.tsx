import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { Zap, AlertTriangle, Play, Award, Gauge } from 'lucide-react';

type StateMode = 'WAITING' | 'READY' | 'TOO_EARLY' | 'RESULT';

export const ReactionGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const [mode, setMode] = useState<StateMode>('WAITING');
  const [round, setRound] = useState(1);
  const [lightsCount, setLightsCount] = useState(0);
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);

  const startTimeRef = useRef<number>(0);
  const timerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lightsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxRounds = 5;

  const startWaitingRound = useCallback(() => {
    if (lightsIntervalRef.current) clearInterval(lightsIntervalRef.current);
    if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);

    setMode('WAITING');
    setReactionTime(null);
    setLightsCount(0);

    let currentLight = 0;
    // Step 5 F1 start lights quickly (240ms each = 1.2s total)
    lightsIntervalRef.current = setInterval(() => {
      currentLight++;
      setLightsCount(currentLight);
      if (soundEnabled) sounds.playTick();

      if (currentLight >= 5) {
        if (lightsIntervalRef.current) clearInterval(lightsIntervalRef.current);

        // Random reaction trigger delay (700ms to 1900ms)
        const randomDelay = 700 + Math.random() * 1200;
        timerTimeoutRef.current = setTimeout(() => {
          setMode('READY');
          setLightsCount(0); // Lights out! GO!
          startTimeRef.current = performance.now();
          if (soundEnabled) sounds.playChime(1200);
        }, randomDelay);
      }
    }, 240);
  }, [soundEnabled]);

  // Auto-start round 1 on mount
  useEffect(() => {
    startWaitingRound();
    return () => {
      if (lightsIntervalRef.current) clearInterval(lightsIntervalRef.current);
      if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);
    };
  }, [startWaitingRound]);

  const handleInteraction = () => {
    if (isPaused) return;

    if (mode === 'WAITING') {
      // False start / Jump start!
      if (lightsIntervalRef.current) clearInterval(lightsIntervalRef.current);
      if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);
      setMode('TOO_EARLY');
      setFalseStarts((prev) => prev + 1);
      if (soundEnabled) sounds.playBuzz();
    } else if (mode === 'READY') {
      // Valid reflex!
      const timeMs = Math.round(performance.now() - startTimeRef.current);
      setReactionTime(timeMs);
      setMode('RESULT');

      const newHistory = [...history, timeMs];
      setHistory(newHistory);

      // Score calculation
      const totalScore = newHistory.reduce(
        (acc, t) => acc + Math.max(50, 1200 - t * 2),
        0
      );
      onScoreUpdate(totalScore);

      if (timeMs < 200) {
        if (soundEnabled) sounds.playLaser();
      } else if (timeMs < 280) {
        if (soundEnabled) sounds.playSuccess();
      } else {
        if (soundEnabled) sounds.playPop();
      }

      if (round >= maxRounds) {
        setTimeout(() => {
          onGameOver(totalScore);
        }, 1400);
      }
    } else if (mode === 'TOO_EARLY' || mode === 'RESULT') {
      if (round < maxRounds) {
        setRound((prev) => prev + (mode === 'RESULT' ? 1 : 0));
        startWaitingRound();
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleInteraction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode, round, history, isPaused]);

  const getRank = (time: number) => {
    if (time < 190)
      return {
        label: 'NEURAL GODLIKE',
        percentile: 'Top 0.1%',
        color: 'text-[#38BDF8] border-[#38BDF8]/40 bg-[#38BDF8]/10',
      };
    if (time < 240)
      return {
        label: 'F1 PILOT',
        percentile: 'Top 2%',
        color: 'text-[#34D399] border-[#34D399]/40 bg-[#34D399]/10',
      };
    if (time < 300)
      return {
        label: 'ESPORTS PRO',
        percentile: 'Top 15%',
        color: 'text-[#FACC15] border-[#FACC15]/40 bg-[#FACC15]/10',
      };
    if (time < 380)
      return {
        label: 'STANDARD REFLEX',
        percentile: 'Top 50%',
        color: 'text-[#FB923C] border-[#FB923C]/40 bg-[#FB923C]/10',
      };
    return {
      label: 'SLUGGISH',
      percentile: 'Bottom 30%',
      color: 'text-[#71717A] border-[#27272A] bg-[#18181B]',
    };
  };

  const bestTime = history.length > 0 ? Math.min(...history) : null;
  const avgTime =
    history.length > 0
      ? Math.round(history.reduce((a, b) => a + b, 0) / history.length)
      : null;

  return (
    <div
      onClick={handleInteraction}
      className={`relative w-full h-full flex flex-col items-center justify-between p-6 select-none cursor-pointer transition-colors duration-150 touch-none ${
        mode === 'READY'
          ? 'bg-[#059669]'
          : mode === 'TOO_EARLY'
          ? 'bg-[#991B1B]'
          : 'bg-[#09090B]'
      }`}
    >
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-2 bg-[#18181B]/80 px-3.5 py-1.5 rounded-xl border border-[#27272A] font-mono-arcade text-xs">
          <span className="text-[#A1A1AA]">ROUND</span>
          <span className="text-white font-bold">
            {round} / {maxRounds}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {bestTime && (
            <div className="flex items-center gap-1.5 bg-[#18181B]/80 px-3 py-1.5 rounded-xl border border-[#27272A] font-mono-arcade text-xs text-[#38BDF8]">
              <Award className="w-3.5 h-3.5" />
              <span>BEST: {bestTime}ms</span>
            </div>
          )}
          {avgTime && (
            <div className="flex items-center gap-1.5 bg-[#18181B]/80 px-3 py-1.5 rounded-xl border border-[#27272A] font-mono-arcade text-xs text-[#34D399]">
              <Gauge className="w-3.5 h-3.5" />
              <span>AVG: {avgTime}ms</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Status Display Area */}
      <div className="flex flex-col items-center justify-center gap-6 my-auto z-10 pointer-events-none text-center">
        {mode === 'WAITING' && (
          <>
            {/* F1 Gantry Start Lights */}
            <div className="flex items-center gap-3 p-4 rounded-3xl bg-[#18181B]/90 border border-[#27272A] shadow-2xl">
              {[1, 2, 3, 4, 5].map((lightIndex) => {
                const isActive = lightIndex <= lightsCount;
                return (
                  <div
                    key={lightIndex}
                    className="flex flex-col items-center gap-2 p-2 rounded-2xl bg-[#09090B] border border-[#27272A]"
                  >
                    <div
                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full transition-all duration-75 ${
                        isActive
                          ? 'bg-[#EF4444] shadow-[0_0_20px_#EF4444]'
                          : 'bg-[#27272A]'
                      }`}
                    />
                    <div
                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full transition-all duration-75 ${
                        isActive
                          ? 'bg-[#EF4444] shadow-[0_0_20px_#EF4444]'
                          : 'bg-[#27272A]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center gap-1">
              <h2 className="font-mono-arcade font-black text-2xl sm:text-3xl text-white tracking-wide animate-pulse">
                WAIT FOR GREEN...
              </h2>
              <p className="font-mono-arcade text-xs text-[#A1A1AA]">
                DO NOT TAP UNTIL LIGHTS GO OUT & TURN GREEN
              </p>
            </div>
          </>
        )}

        {mode === 'READY' && (
          <div className="flex flex-col items-center gap-2 animate-in zoom-in-75 duration-75">
            <Zap className="w-20 h-20 text-white fill-white animate-bounce" />
            <h1 className="font-mono-arcade font-black text-5xl sm:text-7xl text-white tracking-widest drop-shadow-2xl">
              TAP NOW!
            </h1>
          </div>
        )}

        {mode === 'TOO_EARLY' && (
          <div className="flex flex-col items-center gap-3 animate-in fade-in duration-100">
            <AlertTriangle className="w-16 h-16 text-[#FCA5A5] animate-bounce" />
            <h2 className="font-mono-arcade font-black text-3xl sm:text-4xl text-white tracking-wide">
              FALSE START!
            </h2>
            <p className="font-mono-arcade text-sm text-[#FCA5A5]">
              You tapped too early. Wait for the green light!
            </p>
            <div className="mt-4 px-4 py-2 rounded-xl bg-black/40 border border-white/20 font-mono-arcade text-xs text-white">
              TAP TO TRY ROUND {round} AGAIN
            </div>
          </div>
        )}

        {mode === 'RESULT' && reactionTime && (
          <div className="flex flex-col items-center gap-4 animate-in zoom-in-90 duration-150">
            <div className="font-mono-arcade font-black text-6xl sm:text-7xl text-[#38BDF8] tracking-tight">
              {reactionTime} <span className="text-2xl text-white">MS</span>
            </div>

            {(() => {
              const rank = getRank(reactionTime);
              return (
                <div
                  className={`flex flex-col items-center gap-1 px-5 py-2.5 rounded-2xl border ${rank.color}`}
                >
                  <span className="font-mono-arcade font-bold text-sm tracking-wider">
                    {rank.label}
                  </span>
                  <span className="font-mono-arcade text-[10px] opacity-80">
                    {rank.percentile} reflex speed
                  </span>
                </div>
              );
            })()}

            <div className="mt-4 px-5 py-2 rounded-xl bg-[#18181B] border border-[#27272A] font-mono-arcade text-xs text-[#A1A1AA] flex items-center gap-2">
              <Play className="w-3.5 h-3.5 text-[#34D399]" />
              <span>
                {round < maxRounds ? 'TAP FOR NEXT ROUND' : 'CALCULATING FINAL SCORE...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="w-full flex justify-center z-10 pointer-events-none">
        <span className="font-mono-arcade text-xs text-[#71717A]">
          CLICK ANYWHERE ON SCREEN OR PRESS SPACEBAR
        </span>
      </div>
    </div>
  );
};
