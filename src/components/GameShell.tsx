import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameEntry } from '../data/games';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { beginLeaderboardSession, submitLeaderboardScore, type LeaderboardPlaySession } from '../lib/leaderboards';
import { useGamepadBridge } from '../hooks/useGamepadBridge';
import { ErrorBoundary } from './ErrorBoundary';
import {
  ArrowLeft,
  RotateCcw,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Trophy,
  Shuffle,
  Sparkles,
  Maximize2,
  Minimize2,
  Globe,
  Smartphone,
  Gamepad2,
} from 'lucide-react';

interface GameShellProps {
  game: GameEntry;
  bestScore: number;
  soundEnabled: boolean;
  hapticsEnabled?: boolean;
  onToggleSound: () => void;
  onToggleHaptics?: () => void;
  onBackToArcade: () => void;
  onPlayNextRandom: () => void;
  onSaveScore: (gameId: string, score: number) => { isNewHighScore: boolean };
  onViewLeaderboard?: (gameId: string) => void;
}

export const GameShell: React.FC<GameShellProps> = ({
  game,
  bestScore,
  soundEnabled,
  hapticsEnabled = true,
  onToggleSound,
  onToggleHaptics,
  onBackToArcade,
  onPlayNextRandom,
  onSaveScore,
  onViewLeaderboard,
}) => {
  const [currentScore, setCurrentScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const gameStageRef = useRef<HTMLElement>(null);
  const gamepadCursorRef = useRef<HTMLDivElement>(null);
  const prevScoreRef = useRef(0);
  const activeSessionKeyRef = useRef(1);
  const gameOverHandledRef = useRef(false);
  const leaderboardSessionRef = useRef<LeaderboardPlaySession | null>(null);
  const leaderboardSessionPromiseRef = useRef<Promise<LeaderboardPlaySession | null> | null>(null);

  // Sync haptics enabled state with global haptics engine
  useEffect(() => {
    haptics.setEnabled(hapticsEnabled);
  }, [hapticsEnabled]);

  const [gameOverData, setGameOverData] = useState<{
    score: number;
    best: number;
    isNewHigh: boolean;
  } | null>(null);

  const gamepad = useGamepadBridge({
    gameId: game.id,
    targetRef: gameStageRef,
    cursorRef: gamepadCursorRef,
    paused: isPaused,
    gameOver: Boolean(gameOverData),
  });

  // Keep mobile displays awake during active gameplay when the browser permits it.
  useEffect(() => {
    if (isPaused || gameOverData || !("wakeLock" in navigator)) return;
    let released = false;
    let sentinel = null;
    const acquire = async () => {
      if (released || document.hidden) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {}
    };
    const onVisibility = () => {
      if (!document.hidden && !released) void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) void sentinel.release().catch(() => {});
    };
  }, [gameOverData, isPaused]);

  // Lock background page scrolling/pull-to-refresh while the full-screen game shell is active.
  useEffect(() => {
    document.body.classList.add('game-active');
    return () => document.body.classList.remove('game-active');
  }, []);

  // Key to force-remount the mini-game component upon instant restart
  const [gameSessionKey, setGameSessionKey] = useState(1);
  activeSessionKeyRef.current = gameSessionKey;

  useEffect(() => {
    let cancelled = false;
    leaderboardSessionRef.current = null;
    const sessionKey = gameSessionKey;
    const request = beginLeaderboardSession(game.id);
    leaderboardSessionPromiseRef.current = request;
    void request.then((session) => {
      if (!cancelled && activeSessionKeyRef.current === sessionKey) {
        leaderboardSessionRef.current = session;
      }
    }).catch((error) => {
      console.warn('Unable to start live leaderboard session:', error);
    });
    return () => {
      cancelled = true;
    };
  }, [game.id, gameSessionKey]);

  const handleRestart = useCallback(() => {
    sounds.playClick();
    haptics.medium();
    setCurrentScore(0);
    prevScoreRef.current = 0;
    setGameOverData(null);
    setIsPaused(false);
    gameOverHandledRef.current = false;
    const nextSessionKey = activeSessionKeyRef.current + 1;
    activeSessionKeyRef.current = nextSessionKey;
    setGameSessionKey(nextSessionKey);
  }, []);

  const handleScoreUpdate = useCallback((sessionKey: number, newScore: number) => {
    if (sessionKey !== activeSessionKeyRef.current || gameOverHandledRef.current) return;
    if (!Number.isFinite(newScore)) return;

    setCurrentScore(newScore);

    // Tactile haptic feedback on scoring increments
    const prev = prevScoreRef.current;
    if (newScore > prev) {
      // Major milestone / thousands threshold vibration
      if (Math.floor(newScore / 1000) > Math.floor(prev / 1000) && newScore >= 1000) {
        haptics.combo();
      } else {
        haptics.score();
      }
    }
    prevScoreRef.current = newScore;
  }, []);

  const handleGameOver = useCallback(
    (sessionKey: number, finalScore: number) => {
      if (sessionKey !== activeSessionKeyRef.current || gameOverHandledRef.current) return;
      gameOverHandledRef.current = true;

      const safeFinalScore = Number.isFinite(finalScore) ? Math.max(0, finalScore) : 0;
      const { isNewHighScore } = onSaveScore(game.id, safeFinalScore);
      const newBest = Math.max(bestScore, safeFinalScore);

      const submitRemoteScore = (session: LeaderboardPlaySession | null) => {
        if (session) void submitLeaderboardScore(session, safeFinalScore);
      };
      if (leaderboardSessionRef.current) {
        submitRemoteScore(leaderboardSessionRef.current);
      } else if (leaderboardSessionPromiseRef.current) {
        void leaderboardSessionPromiseRef.current.then(submitRemoteScore).catch(() => {});
      }

      setGameOverData({
        score: safeFinalScore,
        best: newBest,
        isNewHigh: isNewHighScore,
      });

      if (isNewHighScore && safeFinalScore > 0) {
        // High score celebratory vibration pattern
        haptics.highScore();
        void import('canvas-confetti')
          .then(({ default: confetti }) => {
            confetti({
              particleCount: 75,
              spread: 60,
              origin: { y: 0.6 },
              colors: [game.accentColor, '#facc15', '#ffffff'],
            });
          })
          .catch(() => {});
      } else {
        // Session loss / game over tactile pulse
        haptics.gameOver();
      }
    },
    [bestScore, game.accentColor, game.id, onSaveScore]
  );

  const sessionCallbacks = useMemo(() => {
    const sessionKey = gameSessionKey;
    return {
      onGameOver: (finalScore: number) => handleGameOver(sessionKey, finalScore),
      onScoreUpdate: (newScore: number) => handleScoreUpdate(sessionKey, newScore),
    };
  }, [gameSessionKey, handleGameOver, handleScoreUpdate]);

  const togglePause = useCallback(() => {
    sounds.playPop();
    haptics.light();
    setIsPaused((prev) => !prev);
  }, []);

  const toggleFullscreen = useCallback(() => {
    sounds.playClick();
    haptics.light();

    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));

    try {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(syncFullscreenState);
        return;
      }

      const target = shellRef.current ?? document.documentElement;
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(syncFullscreenState);
      }
    } catch {
      syncFullscreenState();
    }
  }, []);

  // Listen for browser fullscreen exit (e.g. Esc in native fullscreen)
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Backgrounding or locking a device must never let a live run advance unseen.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !gameOverHandledRef.current) setIsPaused(true);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Global game shell keyboard shortcuts
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (gameOverData) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleRestart();
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          onPlayNextRandom();
        } else if ((e.key === 'l' || e.key === 'L') && onViewLeaderboard) {
          e.preventDefault();
          onViewLeaderboard(game.id);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onBackToArcade();
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
      } else if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) {
        if (e.target instanceof HTMLInputElement) return;
        e.preventDefault();
        handleRestart();
      } else if (e.key === 'm' || e.key === 'M') {
        if (e.target instanceof HTMLInputElement) return;
        e.preventDefault();
        onToggleSound();
      } else if (
        e.altKey &&
        e.code === 'Enter' &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target instanceof HTMLElement && e.target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [
    gameOverData,
    handleRestart,
    onBackToArcade,
    onPlayNextRandom,
    onToggleSound,
    togglePause,
    toggleFullscreen,
  ]);

  const GameComponent = game.component;

  return (
    <div
      ref={shellRef}
      className={`game-shell fixed inset-0 z-50 bg-[#0A0A0B] flex flex-col items-center justify-between text-[#E4E4E7] overflow-hidden select-none ${
        isFullscreen ? 'p-0' : ''
      }`}
    >
      {/* Top Arcade Navigation Bar */}
      <header
        className={`w-full transition-all duration-200 z-30 select-none ${
          isFullscreen
            ? 'absolute top-0 left-0 right-0 px-2.5 sm:px-4 py-2 bg-[#0A0A0B]/85 backdrop-blur-md border-b border-[#27272A]/50 flex items-center justify-between gap-1.5 sm:gap-3'
            : 'max-w-4xl px-2.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3 border-b border-[#27272A] bg-[#0A0A0B]/95 backdrop-blur'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Left: Back Button & Title */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-shrink">
          <button
            type="button"
            id="game-back-btn"
            onClick={(e) => {
              e.stopPropagation();
              sounds.playClick();
              if (document.fullscreenElement) {
                try {
                  document.exitFullscreen().catch(() => {});
                } catch {}
              }
              onBackToArcade();
            }}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg bg-[#18181B] hover:bg-[#27272A] active:bg-[#3F3F46] text-[#A1A1AA] hover:text-white border border-[#27272A] transition-colors text-xs font-bold cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">ARCADE</span>
          </button>

          <div className="flex flex-col min-w-0">
            <h1 className="font-bold text-xs sm:text-base flex items-center gap-1 sm:gap-2 text-white min-w-0">
              <span className="truncate max-w-[90px] xs:max-w-[130px] sm:max-w-[200px] md:max-w-none">{game.title}</span>
              {gamepad.connected && (
                <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[8px] font-mono-arcade font-black text-cyan-300 shrink-0" title={gamepad.controllerName ?? 'Gamepad connected'}>
                  <Gamepad2 className="w-3 h-3" />
                  <span className="hidden md:inline">{gamepad.pointerMode ? 'CURSOR' : 'PAD'}</span>
                </span>
              )}
              <span
                className="text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 hidden xs:inline-block"
                style={{
                  backgroundColor: `${game.accentColor}20`,
                  color: game.accentColor,
                }}
              >
                {game.category}
              </span>
            </h1>
          </div>
        </div>

        {/* Center: Live Score Display */}
        <div className="flex items-center gap-1.5 sm:gap-3 bg-[#18181B] px-2 sm:px-3.5 py-1 rounded-xl border border-[#27272A] font-mono-arcade shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-[7px] sm:text-[9px] text-[#71717A] font-bold uppercase">SCORE</span>
            <span className="text-xs sm:text-base font-bold text-white leading-tight">
              {currentScore.toLocaleString()}
            </span>
          </div>
          <div className="w-px h-3.5 sm:h-5 bg-[#27272A]" />
          <div className="flex flex-col items-center">
            <span className="text-[7px] sm:text-[9px] text-amber-400/80 font-bold uppercase flex items-center gap-0.5">
              <Trophy className="w-2.5 h-2.5 hidden xs:inline" /> BEST
            </span>
            <span className="text-xs sm:text-base font-bold text-amber-400 leading-tight">
              {Math.max(bestScore, currentScore).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Right: Controls (Fullscreen, Restart, Pause, Sound, Haptics) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {onToggleHaptics && (
            <button
              type="button"
              id="game-haptics-btn"
              onClick={(e) => {
                e.stopPropagation();
                haptics.click();
                onToggleHaptics();
              }}
              title={hapticsEnabled ? 'Haptic Feedback (Vibration) ON' : 'Haptic Feedback OFF'}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer border hidden sm:inline-flex shrink-0 ${
                hapticsEnabled
                  ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                  : 'bg-[#18181B] hover:bg-[#27272A] text-[#52525B] hover:text-[#71717A] border-[#27272A]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          <button
            type="button"
            id="game-fullscreen-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            title={isFullscreen ? 'Exit Fullscreen (Alt+Enter)' : 'Fullscreen Immersive (Alt+Enter)'}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer border inline-flex shrink-0 ${
              isFullscreen
                ? 'bg-[#38BDF8]/20 text-[#38BDF8] border-[#38BDF8]/40 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                : 'bg-[#18181B] hover:bg-[#27272A] text-[#A1A1AA] hover:text-white border-[#27272A]'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          <button
            type="button"
            id="game-restart-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleRestart();
            }}
            title="Restart Game (R)"
            className="p-1.5 sm:p-2 rounded-lg bg-[#18181B] hover:bg-[#27272A] active:bg-[#3F3F46] text-[#A1A1AA] hover:text-white border border-[#27272A] transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            type="button"
            id="game-pause-btn"
            onClick={(e) => {
              e.stopPropagation();
              togglePause();
            }}
            title="Pause Game (Esc)"
            className="p-1.5 sm:p-2 rounded-lg bg-[#18181B] hover:bg-[#27272A] active:bg-[#3F3F46] text-[#A1A1AA] hover:text-white border border-[#27272A] transition-colors cursor-pointer shrink-0"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F43F5E]" /> : <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          <button
            type="button"
            id="game-sound-btn"
            onClick={(e) => {
              e.stopPropagation();
              haptics.light();
              onToggleSound();
            }}
            title="Toggle Sound (M)"
            className="p-1.5 sm:p-2 rounded-lg bg-[#18181B] hover:bg-[#27272A] active:bg-[#3F3F46] text-[#A1A1AA] hover:text-white border border-[#27272A] transition-colors cursor-pointer shrink-0"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F43F5E]" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#52525B]" />
            )}
          </button>
        </div>
      </header>

      {/* Main Game Stage Area */}
      <main
        ref={gameStageRef}
        className={`relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden transition-all duration-150 ${
          isFullscreen
            ? 'h-full max-w-none max-h-none p-0 pt-12'
            : 'max-w-4xl p-1.5 sm:p-3'
        }`}
        style={{ touchAction: 'none', overscrollBehavior: 'none' }}
      >
        <div
          className={`relative w-full h-full min-h-0 bg-[#0A0A0B] overflow-hidden flex items-center justify-center transition-all ${
            isFullscreen
              ? 'rounded-none border-0 max-h-none'
              : 'max-h-[660px] rounded-2xl border border-[#27272A] shadow-2xl'
          }`}
        >
          {/* Subtle grid background */}
          <div className="absolute inset-0 opacity-15 arcade-grid-bg pointer-events-none" />

          <div
            ref={gamepadCursorRef}
            id="gamepad-virtual-cursor"
            className="gamepad-virtual-cursor"
            aria-hidden="true"
          />

          {/* Active Mini-Game Component */}
          <ErrorBoundary key={`game-${game.id}-${gameSessionKey}`} onReset={handleRestart}>
            <Suspense
              fallback={(
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0A0A0B]" role="status" aria-live="polite" aria-busy="true">
                  <div className="flex items-center gap-2 rounded-xl border border-[#27272A] bg-[#111114] px-4 py-3 text-xs font-mono-arcade text-zinc-300">
                    <span className="h-3 w-3 animate-pulse rounded-full" style={{ backgroundColor: game.accentColor }} aria-hidden="true" />
                    Loading {game.title}…
                  </div>
                </div>
              )}
            >
              <GameComponent
                key={gameSessionKey}
                onGameOver={sessionCallbacks.onGameOver}
                onScoreUpdate={sessionCallbacks.onScoreUpdate}
                isPaused={isPaused || gameOverData !== null}
                soundEnabled={soundEnabled}
                onRestartRequest={handleRestart}
              />
            </Suspense>
          </ErrorBoundary>

          {/* Pause Modal Overlay */}
          {isPaused && !gameOverData && (
            <div className="absolute inset-0 bg-[#0A0A0B]/90 backdrop-blur-md z-40 flex flex-col items-center justify-center gap-4 p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-6 rounded-2xl bg-[#141418] border border-[#27272A] text-center max-w-sm w-full shadow-2xl flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-[#F43F5E] mb-3 shadow-lg shadow-rose-500/10">
                  <Pause className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-white font-mono-arcade tracking-wide mb-1">GAME PAUSED</h2>
                
                {/* How To Play Card */}
                <div className="w-full my-3.5 p-3.5 rounded-xl bg-[#0B0B0E] border border-cyan-500/30 text-left">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-mono-arcade text-xs font-bold mb-1.5 uppercase">
                    <Sparkles className="w-3.5 h-3.5" /> How To Play
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed font-sans font-medium">
                    {game.instructions}
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full font-mono-arcade text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      haptics.light();
                      togglePause();
                    }}
                    className="w-full py-2.5 rounded-xl bg-white text-black font-black hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> RESUME (ESC)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.medium();
                      handleRestart();
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#222228] hover:bg-[#2C2C34] text-white font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer border border-[#33333E]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> RESTART (R)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.light();
                      onBackToArcade();
                    }}
                    className="w-full py-2 rounded-xl bg-transparent hover:bg-[#1E1E24] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    EXIT TO ARCADE
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Game Over Result Panel */}
          {gameOverData && (
            <div className="absolute inset-0 bg-[#0A0A0B]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-sm p-6 rounded-2xl bg-[#18181B] border border-[#27272A] shadow-2xl flex flex-col items-center text-center">
                {gameOverData.isNewHigh ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 text-xs font-bold font-mono-arcade mb-3">
                    <Sparkles className="w-3.5 h-3.5" /> NEW HIGH SCORE!
                  </div>
                ) : (
                  <span className="text-[10px] font-mono-arcade text-[#71717A] tracking-widest uppercase mb-3 font-bold">
                    SESSION COMPLETE
                  </span>
                )}

                <h2 className="text-xl font-bold text-white mb-6">{game.title}</h2>

                {/* Score & Best Comparison Block */}
                <div className="w-full grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#0A0A0B] border border-[#27272A] mb-6 font-mono-arcade">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#71717A] font-bold uppercase">SCORE</span>
                    <span className="text-2xl sm:text-3xl font-black text-white">
                      {gameOverData.score.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col border-l border-[#27272A] pl-3">
                    <span className="text-[10px] text-amber-400/80 font-bold uppercase flex items-center justify-center gap-1">
                      <Trophy className="w-3 h-3" /> BEST
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-amber-400">
                      {gameOverData.best.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="w-full flex flex-col gap-2.5">
                  <button
                    type="button"
                    id="btn-play-again"
                    onClick={() => {
                      haptics.medium();
                      handleRestart();
                    }}
                    className="w-full py-3 rounded-lg font-bold text-xs bg-white text-black hover:bg-[#F4F4F5] shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> PLAY AGAIN (Space)
                  </button>

                  {onViewLeaderboard && (
                    <button
                      type="button"
                      id="btn-view-leaderboard"
                      onClick={() => {
                        haptics.light();
                        onViewLeaderboard(game.id);
                      }}
                      className="w-full py-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5 text-amber-400" /> GLOBAL LEADERBOARD (L)
                    </button>
                  )}

                  <button
                    type="button"
                    id="btn-next-random"
                    onClick={() => {
                      haptics.medium();
                      onPlayNextRandom();
                    }}
                    className="w-full py-2.5 rounded-lg bg-[#27272A] hover:bg-[#3F3F46] text-[#E4E4E7] font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5" /> NEXT RANDOM GAME (N)
                  </button>

                  <button
                    type="button"
                    id="btn-exit-arcade"
                    onClick={() => {
                      haptics.light();
                      onBackToArcade();
                    }}
                    className="w-full py-2 rounded-lg text-[#71717A] hover:text-white text-xs transition-colors cursor-pointer"
                  >
                    Back to Arcade (Esc)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Hint (hidden in Fullscreen mode for maximum vertical gameplay room) */}
      {!isFullscreen && (
        <footer className="w-full max-w-4xl px-4 py-1.5 flex items-center justify-between text-[10px] sm:text-[11px] font-mono-arcade text-[#52525B] pointer-events-none">
          <span>{gamepad.connected ? (gamepad.pointerMode ? 'Gamepad: Stick cursor • A hold/click • B pause/back' : 'Gamepad: Stick/D-pad move • A action • B pause/back') : `Controls: ${game.controlsHint}`}</span>
          <span className="hidden sm:inline">Alt+Enter: Fullscreen • Esc: Pause • R: Restart</span>
        </footer>
      )}
    </div>
  );
};
