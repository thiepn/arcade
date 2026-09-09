import { AP_SCALE, apMicros, contributionMicros, formatPoints, getPolicy, modeLabel, SUBMISSION_MESSAGES } from '../../shared/leaderboard/domain';
import { OUTBOX_EVENT, getUploadHistory, flushUploads, uploadsAreDurable, type PendingRun } from '../lib/leaderboardOutbox';
import { RunClock } from '../lib/runClock';
import { SCORE_VERSION, SCORING_PROFILES, defaultScoreMode, isScoreMode, toArcadePoints } from '../../shared/scoring';
import type { ScoreDetails } from '../types';
import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameEntry } from '../data/games';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { beginLeaderboardSession, submitLeaderboardScore, type LeaderboardPlaySession } from '../lib/leaderboards';
import { useGamepadBridge } from '../hooks/useGamepadBridge';
import { ErrorBoundary } from './ErrorBoundary';
import { getStoredStats, isProgressSaved } from '../lib/storage';
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
  bestRawScore?: number;
  soundEnabled: boolean;
  hapticsEnabled?: boolean;
  onToggleSound: () => void;
  onToggleHaptics?: () => void;
  onBackToArcade: () => void;
  onPlayNextRandom: () => void;
  onSaveScore: (gameId: string, score: number, details?: ScoreDetails) => { isNewHighScore: boolean };
  onViewLeaderboard?: (gameId: string) => void;
  obscured?: boolean;
}

const EngineReady: React.FC<{onReady:()=>void;children:React.ReactNode}> = ({onReady,children}) => {
  useEffect(onReady,[onReady]);
  return <>{children}</>;
};

export const GameShell: React.FC<GameShellProps> = ({
  game,
  bestScore,
  bestRawScore = 0,
  soundEnabled,
  hapticsEnabled = true,
  onToggleSound,
  onToggleHaptics,
  onBackToArcade,
  onPlayNextRandom,
  onSaveScore,
  onViewLeaderboard,
  obscured = false,
}) => {
  const [currentRawScore, setCurrentRawScore] = useState(0);
  const [currentArcadePoints, setCurrentArcadePoints] = useState(0);
  const [scoringMode, setScoringMode] = useState(() => defaultScoreMode(game.id));
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const gameStageRef = useRef<HTMLElement>(null);
  const gamepadCursorRef = useRef<HTMLDivElement>(null);
  const prevArcadePointsRef = useRef(0);
  const activeSessionKeyRef = useRef(1);
  const gameOverHandledRef = useRef(false);
  const leaderboardSessionRef = useRef<LeaderboardPlaySession | null>(null);
  const leaderboardSessionPromiseRef = useRef<Promise<LeaderboardPlaySession | null> | null>(null);
  const mountedRef = useRef(true);
  const [submissionStatus, setSubmissionStatus] = useState<'local'|'pending'|'accepted'|'failed'|'review'|'rejected'|'expired'|'auth-required'>('local');
  const [submissionMessage,setSubmissionMessage]=useState('');
  const [submittedSessionId,setSubmittedSessionId]=useState<string|null>(null);
  const clockRef=useRef(new RunClock());
  const engineReadyRef=useRef(false);
  const clockRunningRef=useRef(true);
  const requestsRef=useRef(new Map<string,string>());
  const getSessionRequest=(key:number,mode:string)=>{
    const id=key+':'+mode;let request=requestsRef.current.get(id);
    if(!request){request=crypto.randomUUID();requestsRef.current.set(id,request);}return request;
  };
  const engineReady=useCallback(()=>{engineReadyRef.current=true;clockRef.current.setActive(clockRunningRef.current);},[]);
  useEffect(()=>{
    let cancelled=false;
    const update=async()=>{if(!submittedSessionId)return;const run=(await getUploadHistory()).find(r=>r.id===submittedSessionId);
      if(!cancelled&&run){setSubmissionStatus(run.status);setSubmissionMessage(SUBMISSION_MESSAGES[run.lastError??'']??'');}
    };
    window.addEventListener(OUTBOX_EVENT,update);void update();
    return()=>{cancelled=true;window.removeEventListener(OUTBOX_EVENT,update);};
  },[submittedSessionId]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Sync haptics enabled state with global haptics engine
  useEffect(() => {
    haptics.setEnabled(hapticsEnabled);
  }, [hapticsEnabled]);

  const [gameOverData, setGameOverData] = useState<{
    rawScore: number;
    arcadePoints: number;
    bestRawScore: number;
    bestArcadePoints: number;
    isNewHigh: boolean;
  } | null>(null);

  clockRunningRef.current=!isPaused&&!obscured&&!gameOverData;
  useEffect(()=>{clockRef.current.setActive(engineReadyRef.current&&clockRunningRef.current);},[isPaused,obscured,gameOverData]);

  const gamepad = useGamepadBridge({
    gameId: game.id,
    targetRef: gameStageRef,
    cursorRef: gamepadCursorRef,
    paused: isPaused,
    gameOver: Boolean(gameOverData),
    disabled: obscured,
  });

  // Keep mobile displays awake during active gameplay when the browser permits it.
  useEffect(() => {
    if (isPaused || obscured || gameOverData || !("wakeLock" in navigator)) return;
    let released = false;
    let sentinel: WakeLockSentinel | null = null;
    const acquire = async () => {
      if (released || document.hidden) return;
      try {
        const acquired = await navigator.wakeLock.request('screen');
        if (released) { await acquired.release(); return; }
        sentinel = acquired;
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
  }, [gameOverData, isPaused, obscured]);

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
    const request = beginLeaderboardSession(game.id, scoringMode,getSessionRequest(gameSessionKey,scoringMode),clockRef.current.startedAt).catch((error) => {
      if(!cancelled&&activeSessionKeyRef.current===sessionKey)setSubmissionMessage(error instanceof Error?error.message:'Could not reserve an online run.');
      return null;
    });
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
  }, [game.id, gameSessionKey, scoringMode]);

  const handleRestart = useCallback(() => {
    sounds.playClick();
    haptics.medium();
    setCurrentRawScore(0);
    setCurrentArcadePoints(0);
    setScoringMode(defaultScoreMode(game.id));
    prevArcadePointsRef.current = 0;
    setGameOverData(null);
    setSubmissionStatus('local');setSubmissionMessage('');setSubmittedSessionId(null);
    clockRef.current=new RunClock();engineReadyRef.current=false;
    setIsPaused(false);
    gameOverHandledRef.current = false;
    leaderboardSessionRef.current = null;
    leaderboardSessionPromiseRef.current = null;
    const nextSessionKey = activeSessionKeyRef.current + 1;
    activeSessionKeyRef.current = nextSessionKey;
    setGameSessionKey(nextSessionKey);
  }, [game.id]);

  const handleModeChange = useCallback((modeId:string)=>{
    if(!isScoreMode(game.id,modeId)||modeId===scoringMode)return;
    // A mode switch is a new match, not a relabeling of already-earned points.
    activeSessionKeyRef.current+=1;
    setGameSessionKey(activeSessionKeyRef.current);
    setScoringMode(modeId);setCurrentRawScore(0);setCurrentArcadePoints(0);prevArcadePointsRef.current=0;
    setGameOverData(null);gameOverHandledRef.current=false;setIsPaused(false);
    setSubmissionStatus('local');setSubmissionMessage('');setSubmittedSessionId(null);
    leaderboardSessionRef.current=null;leaderboardSessionPromiseRef.current=null;
    clockRef.current=new RunClock();engineReadyRef.current=false;
  },[game.id,scoringMode]);

  const handleScoreUpdate = useCallback((sessionKey: number, rawScore: number, modeId?: string) => {
    if (!mountedRef.current || !Number.isFinite(rawScore)) return;
    const normalizedRawScore = Math.max(0, Math.floor(rawScore));
    const newArcadePoints = toArcadePoints(game.id, normalizedRawScore, modeId ?? scoringMode);
    if (!mountedRef.current || sessionKey !== activeSessionKeyRef.current || gameOverHandledRef.current) return;
    if (!Number.isFinite(newArcadePoints)) return;

    setCurrentRawScore(normalizedRawScore);
    setCurrentArcadePoints(newArcadePoints);

    // Tactile haptic feedback on scoring increments
    const prev = prevArcadePointsRef.current;
    if (newArcadePoints > prev) {
      // Major AP milestone / thousands threshold vibration
      if (Math.floor(newArcadePoints / 1000) > Math.floor(prev / 1000) && newArcadePoints >= 1000) {
        haptics.combo();
      } else {
        haptics.score();
      }
    }
    prevArcadePointsRef.current = newArcadePoints;
  }, [game.id, scoringMode]);

  const handleGameOver = useCallback(
    (sessionKey: number, finalScore: number, modeId?: string) => {
      if (!mountedRef.current || sessionKey !== activeSessionKeyRef.current || gameOverHandledRef.current) return;
      gameOverHandledRef.current = true;
      const timing=clockRef.current.finish();

      const rawScore = Number.isFinite(finalScore) ? Math.max(0, Math.floor(finalScore)) : 0;
      const runMode = modeId ?? scoringMode;
      const arcadePoints = toArcadePoints(game.id, rawScore, runMode);
      const { isNewHighScore } = onSaveScore(game.id, arcadePoints, { rawScore, modeId: runMode, scoreVersion: SCORE_VERSION });
      setCurrentRawScore(rawScore);
      setCurrentArcadePoints(arcadePoints);
      const newBestArcadePoints = Math.max(bestScore, arcadePoints);
      const modeBestRaw=getStoredStats().modeBests?.[game.id+':'+runMode]?.rawScore??0;
      const newBestRawScore = Math.max(modeBestRaw, rawScore);

      const submitRemoteScore = async (session: LeaderboardPlaySession | null) => {
        const current = () => mountedRef.current && sessionKey === activeSessionKeyRef.current;
        if (!session) { if (current()) setSubmissionStatus('local'); return; }
        if(current()){setSubmissionStatus('pending');setSubmittedSessionId(session.id);}
        try{
          await submitLeaderboardScore(session,rawScore,runMode,timing.durationMs,timing.activeMs);
          const queued=(await getUploadHistory()).find(r=>r.id===session.id);
          if(current()&&queued){setSubmissionStatus(queued.status);setSubmissionMessage(SUBMISSION_MESSAGES[queued.lastError??'']??'');}
        }catch(error){if(current()){setSubmissionStatus('failed');setSubmissionMessage(error instanceof Error?error.message:'Upload could not be queued.');}}
      };
      if (leaderboardSessionRef.current) {
        void submitRemoteScore(leaderboardSessionRef.current);
      } else if (leaderboardSessionPromiseRef.current) {
        void leaderboardSessionPromiseRef.current.then(submitRemoteScore).catch(() => {});
      }

      setGameOverData({
        rawScore,
        arcadePoints,
        bestRawScore: newBestRawScore,
        bestArcadePoints: newBestArcadePoints,
        isNewHigh: isNewHighScore,
      });

      if (isNewHighScore && arcadePoints > 0) {
        // High score celebratory vibration pattern
        haptics.highScore();
        void import('canvas-confetti')
          .then(({ default: confetti }) => {
            confetti({
              particleCount: 75,
              spread: 60,
              origin: { y: 0.6 },
              colors: [game.accentColor, '#facc15', '#ffffff'],
              disableForReducedMotion: true,
            });
          })
          .catch(() => {});
      } else {
        // Session loss / game over tactile pulse
        haptics.gameOver();
      }
    },
    [bestRawScore, bestScore, game.accentColor, game.id, onSaveScore, scoringMode]
  );

  const sessionCallbacks = useMemo(() => {
    const sessionKey = gameSessionKey;
    return {
      onGameOver: (finalScore: number, modeId?: string) => handleGameOver(sessionKey, finalScore, modeId),
      onScoreUpdate: (newScore: number, modeId?: string) => handleScoreUpdate(sessionKey, newScore, modeId),
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
      if (document.hidden && !gameOverHandledRef.current) { clockRef.current.setActive(false); setIsPaused(true); }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Global game shell keyboard shortcuts
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (obscured || e.repeat || e.defaultPrevented || e.isComposing) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]') && e.key !== 'Escape') return;
      if ((e.code === 'Space' || e.code === 'Enter') && target?.closest('button, a[href]')) return;
      if (e.ctrlKey || e.metaKey) return;
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
    obscured,
    game.id,
    onViewLeaderboard,
  ]);

  const GameComponent = game.component;

  return (
    <div
      ref={shellRef}
      inert={obscured}
      aria-hidden={obscured || undefined}
      className={`game-shell fixed inset-0 z-50 bg-[#0A0A0B] flex flex-col items-center justify-between text-[#E4E4E7] overflow-hidden select-none ${
        isFullscreen ? 'p-0' : ''
      }`}
    >
      {/* Top Arcade Navigation Bar */}
      <header
        className={`arcade-game-toolbar w-full transition-all duration-200 z-30 select-none ${
          isFullscreen
            ? 'absolute top-0 left-0 right-0 px-2.5 sm:px-4 py-2 bg-[#0A0A0B]/85 backdrop-blur-md border-b border-[#27272A]/50 flex items-center justify-between gap-1.5 sm:gap-3'
            : 'max-w-4xl px-2.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3 border-b border-[#27272A] bg-[#0A0A0B]/95 backdrop-blur'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Left: Back Button & Title */}
        <div className="arcade-game-heading flex items-center gap-1.5 sm:gap-3 min-w-0 flex-shrink">
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

          <div className="arcade-game-title flex flex-col min-w-0">
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

        {/* Raw game score stays native; AP is the separate cross-game ranking currency. */}
        <div className="arcade-game-score flex items-center gap-1.5 sm:gap-3 bg-[#18181B] px-2 sm:px-3.5 py-1 rounded-xl border border-[#27272A] font-mono-arcade shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-[7px] sm:text-[9px] text-[#71717A] font-bold uppercase" title="Native score from this game">SCORE</span>
            <span data-raw-score={currentRawScore} className="text-xs sm:text-base font-bold text-white leading-tight">
              {currentRawScore.toLocaleString()}
            </span>
          </div>
          <div className="w-px h-3.5 sm:h-5 bg-[#27272A]" />
          <div className="flex flex-col items-center">
            <span className="text-[7px] sm:text-[9px] text-cyan-300 font-bold uppercase" title="Normalized Arcade Points used for cross-game rankings">AP</span>
            <span data-arcade-points={currentArcadePoints} className="text-xs sm:text-base font-bold text-cyan-200 leading-tight">
              {currentArcadePoints.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Right: Controls (Fullscreen, Restart, Pause, Sound, Haptics) */}
        <div className="arcade-game-actions flex items-center gap-1 sm:gap-1.5 shrink-0">
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
              <EngineReady key={gameSessionKey} onReady={engineReady}><GameComponent
                initialModeId={scoringMode}
                key={gameSessionKey}
                onGameOver={sessionCallbacks.onGameOver}
                onScoreUpdate={sessionCallbacks.onScoreUpdate}
                onModeChange={handleModeChange}
                isPaused={isPaused || obscured || gameOverData !== null}
                soundEnabled={soundEnabled}
                onRestartRequest={handleRestart}
              /></EngineReady>
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
              <div className="w-full max-w-sm max-h-full overflow-y-auto p-4 sm:p-6 rounded-2xl bg-[#18181B] border border-[#27272A] shadow-2xl flex flex-col items-center text-center">
                {gameOverData.isNewHigh ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 text-xs font-bold font-mono-arcade mb-3">
                    <Sparkles className="w-3.5 h-3.5" /> NEW HIGH SCORE! <span className="text-[9px] opacity-75">AP PB</span>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono-arcade text-[#71717A] tracking-widest uppercase mb-3 font-bold">
                    SESSION COMPLETE
                  </span>
                )}

                <h2 className="text-xl font-bold text-white mb-6">{game.title}</h2>

                {/* Raw Score and normalized Arcade Points are intentionally separate. */}
                <div className="w-full grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#0A0A0B] border border-[#27272A] mb-2 font-mono-arcade">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#71717A] font-bold uppercase">SCORE</span>
                    <span data-result-raw-score={gameOverData.rawScore} className="text-2xl sm:text-3xl font-black text-white">
                      {gameOverData.rawScore.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col border-l border-[#27272A] pl-3">
                    <span className="text-[10px] text-cyan-300 font-bold uppercase">ARCADE POINTS</span>
                    <span data-result-arcade-points={gameOverData.arcadePoints} className="text-2xl sm:text-3xl font-black text-cyan-200">
                      {gameOverData.arcadePoints.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-[#27272A] bg-[#111114] mb-6 font-mono-arcade text-[10px] sm:text-xs">
                  <span className="text-zinc-500">MODE BEST SCORE <strong className="text-zinc-200">{gameOverData.bestRawScore.toLocaleString()}</strong></span>
                  <span className="text-amber-400/80"><Trophy className="w-3 h-3 inline mr-1" />GAME BEST AP <strong>{gameOverData.bestArcadePoints.toLocaleString()}</strong></span>
                </div>

                {/* Action Buttons */}
                <details className="mb-3 rounded-lg border border-zinc-700 p-3 text-left text-xs text-zinc-300" data-scoring-details>
                  <summary className="cursor-pointer font-bold">How Score, AP and Rating work</summary>
                  <p className="mt-2">{SCORING_PROFILES[game.id]?.basis}</p>
                  <p className="mt-2"><strong>Score</strong> is the native number produced by this game. It is intentionally not comparable with scores from other games. <strong>AP</strong> is calculated separately from that raw score and is the normalized currency used for cross-game rankings.</p>
                  <p className="mt-2">Each game and supported mode has its own AP calibration. Opening, strong and mastery benchmarks are approximately 1,000 / 3,000 / 6,000 AP. Endless runs keep earning AP with diminishing returns. Overall Rating counts one bounded contribution per game. Finite-game elite targets are calibrated separately so they can reach a full 10,000 contribution too. Raw Score is never added across games. Exact rating ties share a rank; uncapped AP does not break them.</p>
                  <p className="mt-2">Mode: <strong>{modeLabel(game.id,scoringMode)}</strong>. This run’s rating value: <strong>{formatPoints(contributionMicros(game.id,apMicros(game.id,gameOverData.rawScore,scoringMode),scoringMode)/AP_SCALE)}</strong> / 10,000. Only your best result in this game contributes; replaying does not add it again.</p>
                  <p className="mt-2">Public scores are checked against game rules and conservative timing limits. This is not replay-verified anti-cheat.</p>
                </details>
                <p role="status" aria-live="polite" className="mb-3 text-xs text-zinc-300" data-score-submission={submissionStatus}>
                  {submissionStatus==='accepted'?'Published to the global leaderboard.':submissionStatus==='pending'?'Upload queued. It will retry automatically; you may replay now.':submissionStatus==='review'?'Saved for review; not publicly ranked yet.':submissionStatus==='auth-required'?'Upload paused: restore the original player identity.':submissionStatus==='expired'?'The upload window expired.':submissionStatus==='rejected'?'This run was not ranked.':submissionStatus==='failed'?'Upload could not be saved.':'This run is local only.'}
                  {submissionMessage&&<span className="block mt-1">{submissionMessage}</span>}
                  {!uploadsAreDurable()&&<span className="block text-amber-300">Upload storage is unavailable; keep this tab open until submission succeeds.</span>}
                  {' '}{isProgressSaved() ? 'Personal best saved on this device.' : 'Storage unavailable; progress lasts until this page closes.'}
                </p>
                {submissionStatus==='pending'&&<button type="button" className="mb-3 min-h-11 px-4 rounded-lg border border-zinc-600 text-xs" onClick={()=>void flushUploads(true)}>Retry upload now</button>}
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

      {/* A stable status strip keeps teaching/mastery text outside the playfield. */}
        <footer className="arcade-game-status w-full max-w-4xl px-4 py-1.5 flex items-center justify-between text-[10px] sm:text-[11px] font-mono-arcade text-[#52525B] pointer-events-none">
          <span>{gamepad.connected ? (gamepad.pointerMode ? 'Gamepad: Stick cursor • A hold/click • B pause/back' : 'Gamepad: Stick/D-pad move • A action • B pause/back') : `Controls: ${game.controlsHint}`}</span>
          <span className="hidden sm:inline">Alt+Enter: Fullscreen • Esc: Pause • R: Restart</span>
        </footer>
    </div>
  );
};
