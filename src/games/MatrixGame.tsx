import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { Heart, Zap, Sparkles, RefreshCw, Terminal, CheckCircle2, Flame, Award } from 'lucide-react';
import { useSafeTimeout } from '../hooks/useGameLoop';
import {
  applyMatrixProtocol,
  getMatrixProtocolForRound,
  getMatrixProtocolPrompt,
  type MatrixProtocol,
} from '../lib/matrixProtocols';

interface MatrixNode {
  id: number;
  label: string;
  keyLabel: string;
  color: string;
  glow: string;
}

const NODES: MatrixNode[] = [
  { id: 0, label: '01', keyLabel: 'Q', color: '#38BDF8', glow: 'rgba(56, 189, 248, 0.6)' },
  { id: 1, label: '02', keyLabel: 'W', color: '#34D399', glow: 'rgba(52, 211, 153, 0.6)' },
  { id: 2, label: '03', keyLabel: 'E', color: '#FACC15', glow: 'rgba(250, 204, 21, 0.6)' },
  { id: 3, label: '04', keyLabel: 'A', color: '#FB923C', glow: 'rgba(251, 146, 60, 0.6)' },
  { id: 4, label: '05', keyLabel: 'S', color: '#EC4899', glow: 'rgba(236, 72, 153, 0.6)' },
  { id: 5, label: '06', keyLabel: 'D', color: '#A855F7', glow: 'rgba(168, 85, 247, 0.6)' },
  { id: 6, label: '07', keyLabel: 'Z', color: '#6366F1', glow: 'rgba(99, 102, 241, 0.6)' },
  { id: 7, label: '08', keyLabel: 'X', color: '#F43F5E', glow: 'rgba(244, 63, 94, 0.6)' },
  { id: 8, label: '09', keyLabel: 'C', color: '#14B8A6', glow: 'rgba(20, 184, 166, 0.6)' },
];

export const MatrixGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const setSafeTimeout = useSafeTimeout();

  const [sequence, setSequence] = useState<number[]>([]);
  const [playerStep, setPlayerStep] = useState<number>(0);
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const [isShowingSequence, setIsShowingSequence] = useState<boolean>(true);
  const [roundLevel, setRoundLevel] = useState<number>(1);
  const [lives, setLives] = useState<number>(3);
  const [combo, setCombo] = useState<number>(0);
  const [replaysLeft, setReplaysLeft] = useState<number>(2);
  const [statusMessage, setStatusMessage] = useState<string>('OBSERVE PATTERN');
  const [timerProgress, setTimerProgress] = useState<number>(100);
  const [protocol, setProtocol] = useState<MatrixProtocol>('FORWARD');

  const gameStateRef = useRef({
    sequence: [] as number[],
    expectedSequence: [] as number[],
    protocol: 'FORWARD' as MatrixProtocol,
    playerStep: 0,
    score: 0,
    lives: 3,
    round: 1,
    combo: 0,
    isAlive: true,
    timer: 100,
    timerInterval: null as any,
    isInputLocked: true,
  });

  const scheduleWhenActive = useCallback((fn: () => void, delay: number) => {
    const run = () => {
      if (!gameStateRef.current.isAlive) return;
      if (isPausedRef.current) {
        setSafeTimeout(run, 100);
        return;
      }
      fn();
    };
    setSafeTimeout(run, delay);
  }, [setSafeTimeout]);

  const playSequencePlayback = useCallback((seq: number[], speedMs = 320) => {
    setIsShowingSequence(true);
    gameStateRef.current.isInputLocked = true;
    setStatusMessage('TRANSMITTING SEQUENCE...');

    seq.forEach((nodeIdx, step) => {
      scheduleWhenActive(() => {
        setActiveNode(nodeIdx);
        if (soundEnabledRef.current) sounds.playMatrixNode(nodeIdx);

        scheduleWhenActive(() => {
          setActiveNode(null);
          if (step === seq.length - 1) {
            setIsShowingSequence(false);
            gameStateRef.current.isInputLocked = false;
            setStatusMessage(getMatrixProtocolPrompt(gameStateRef.current.protocol));
            gameStateRef.current.timer = 100;
            setTimerProgress(100);
          }
        }, speedMs * 0.7);
      }, (step + 1) * speedMs);
    });
  }, [scheduleWhenActive]);

  const startNewRound = useCallback((round: number) => {
    const state = gameStateRef.current;
    state.playerStep = 0;
    setPlayerStep(0);
    setRoundLevel(round);

    // Initial 3 items, +1 every 2 rounds
    const length = 3 + Math.floor((round - 1) * 0.7);
    const newSeq: number[] = [];
    for (let i = 0; i < length; i++) {
      newSeq.push(Math.floor(Math.random() * 9));
    }

    const nextProtocol = getMatrixProtocolForRound(round);
    state.sequence = newSeq;
    state.protocol = nextProtocol;
    state.expectedSequence = applyMatrixProtocol(newSeq, nextProtocol);
    setSequence(newSeq);
    setProtocol(nextProtocol);

    const playbackSpeed = Math.max(180, 340 - round * 15);
    playSequencePlayback(newSeq, playbackSpeed);
  }, [playSequencePlayback]);

  // Player Node Press
  const handleNodeClick = useCallback((nodeIdx: number) => {
    const state = gameStateRef.current;
    if (state.isInputLocked || !state.isAlive || isPausedRef.current) return;

    setActiveNode(nodeIdx);
    if (soundEnabled) sounds.playMatrixNode(nodeIdx);
    scheduleWhenActive(() => setActiveNode(null), 180);

    const expected = state.expectedSequence[state.playerStep];

    if (nodeIdx === expected) {
      // Correct step
      state.playerStep++;
      setPlayerStep(state.playerStep);

      state.combo++;
      setCombo(state.combo);

      const stepPoints = 100 + state.combo * 25;
      state.score += stepPoints;
      onScoreUpdate(state.score);

      // Check if sequence completed
      if (state.playerStep >= state.sequence.length) {
        state.isInputLocked = true;
        setStatusMessage('CYBER LINK VERIFIED! +1000');
        state.score += 1000 + Math.floor(state.timer * 10);
        onScoreUpdate(state.score);
        if (soundEnabled) sounds.playSuccess();

        scheduleWhenActive(() => {
          state.round++;
          startNewRound(state.round);
        }, 800);
      }
    } else {
      // Error!
      state.lives--;
      state.combo = 0;
      setLives(state.lives);
      setCombo(0);
      if (soundEnabled) sounds.playGlitch();
      setStatusMessage('DECRYPT ERROR! -1 LIFE');

      if (state.lives <= 0) {
        state.isAlive = false;
        state.isInputLocked = true;
        onGameOver(state.score);
      } else {
        // Replay pattern for another chance
        state.isInputLocked = true;
        scheduleWhenActive(() => {
          state.playerStep = 0;
          setPlayerStep(0);
          playSequencePlayback(state.sequence);
        }, 1000);
      }
    }
  }, [onGameOver, onScoreUpdate, playSequencePlayback, scheduleWhenActive, soundEnabled, startNewRound]);

  const handleReplayPattern = useCallback(() => {
    const state = gameStateRef.current;
    if (replaysLeft <= 0 || isShowingSequence || !state.isAlive) return;

    setReplaysLeft((prev) => prev - 1);
    state.playerStep = 0;
    setPlayerStep(0);
    playSequencePlayback(state.sequence);
  }, [isShowingSequence, playSequencePlayback, replaysLeft]);

  // Initial mount
  useEffect(() => {
    startNewRound(1);
  }, [startNewRound]);

  // Round Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      const state = gameStateRef.current;
      if (isPausedRef.current || !state.isAlive || state.isInputLocked) return;

      state.timer -= 1.2;
      setTimerProgress(Math.max(0, state.timer));

      if (state.timer <= 0) {
        // Time expired
        state.lives--;
        state.combo = 0;
        setLives(state.lives);
        setCombo(0);
        if (soundEnabled) sounds.playBuzz();
        setStatusMessage('TIMEOUT! -1 LIFE');

        if (state.lives <= 0) {
          state.isAlive = false;
          onGameOver(state.score);
        } else {
          state.isInputLocked = true;
          scheduleWhenActive(() => {
            state.playerStep = 0;
            setPlayerStep(0);
            playSequencePlayback(state.sequence);
          }, 800);
        }
      }
    }, 100);

    return () => clearInterval(timer);
  }, [onGameOver, playSequencePlayback, scheduleWhenActive, soundEnabled]);

  // Keyboard shortcut bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPausedRef.current || !gameStateRef.current.isAlive) return;

      const key = e.key.toUpperCase();
      const keyMap: Record<string, number> = {
        Q: 0,
        W: 1,
        E: 2,
        A: 3,
        S: 4,
        D: 5,
        Z: 6,
        X: 7,
        C: 8,
        '7': 0,
        '8': 1,
        '9': 2,
        '4': 3,
        '5': 4,
        '6': 5,
        '1': 6,
        '2': 7,
        '3': 8,
      };

      if (key in keyMap) {
        handleNodeClick(keyMap[key]);
      } else if (key === 'R') {
        handleReplayPattern();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNodeClick, handleReplayPattern]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-4 select-none bg-[#090D16] overflow-hidden">
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-3 bg-[#18181B]/90 border border-[#27272A] px-3.5 py-1.5 rounded-xl font-mono-arcade text-xs backdrop-blur-md">
          <span className="text-white font-bold">ROUND {roundLevel}</span>
          <span className="text-[#71717A]">|</span>
          <span className="text-cyan-300 font-bold">PROTOCOL {protocol.replace('_', '+')}</span>
          <span className="text-[#71717A]">|</span>
          <div className="flex items-center gap-1 text-[#F43F5E]">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-3.5 h-3.5 ${i < lives ? 'fill-current' : 'opacity-25'}`}
              />
            ))}
          </div>
          <span className="text-[#71717A]">|</span>
          <div className="flex items-center gap-1 text-emerald-400 font-bold">
            <Flame className="w-3.5 h-3.5" />
            <span>COMBO x{combo}</span>
          </div>
        </div>

        {/* Status Prompt & Replay Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReplayPattern}
            disabled={replaysLeft <= 0 || isShowingSequence}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono-arcade text-xs border transition-all cursor-pointer backdrop-blur-md ${
              replaysLeft > 0 && !isShowingSequence
                ? 'bg-[#18181B]/90 hover:bg-[#27272A] text-amber-300 border-amber-500/30'
                : 'bg-zinc-900/50 text-zinc-600 border-zinc-800 cursor-not-allowed'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" /> REPLAY ({replaysLeft}) [R]
          </button>
        </div>
      </div>

      {/* Center 3x3 Holographic Terminal Grid */}
      <div className="flex flex-col items-center justify-center gap-4 my-auto w-full max-w-sm">
        {/* Terminal Status Headline */}
        <div className="w-full flex items-center justify-between px-2 text-xs font-mono-arcade">
          <span
            className={`font-bold flex items-center gap-1.5 ${
              isShowingSequence ? 'text-cyan-400 animate-pulse' : 'text-emerald-400'
            }`}
          >
            <Terminal className="w-4 h-4" /> {statusMessage}
          </span>
          <span className="text-zinc-500 font-bold">
            STEP {playerStep}/{sequence.length}
          </span>
        </div>

        {/* Timer Bar */}
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-100"
            style={{ width: `${timerProgress}%` }}
          />
        </div>

        {/* 3x3 Grid */}
        <div className="grid grid-cols-3 gap-3 w-full aspect-square p-3 rounded-2xl bg-[#121620] border border-[#27272A] shadow-2xl">
          {NODES.map((node) => {
            const isActive = activeNode === node.id;
            return (
              <button
                key={node.id}
                type="button"
                id={`matrix-node-${node.id}`}
                onClick={() => handleNodeClick(node.id)}
                disabled={isShowingSequence}
                style={{
                  borderColor: isActive ? node.color : '#27272A',
                  backgroundColor: isActive ? node.glow : 'rgba(24, 24, 27, 0.8)',
                  boxShadow: isActive ? `0 0 20px ${node.color}` : 'none',
                }}
                className={`relative rounded-xl border-2 flex flex-col items-center justify-center p-3 transition-all duration-150 select-none cursor-pointer group active:scale-95 ${
                  isActive ? 'scale-105' : 'hover:border-zinc-500'
                }`}
              >
                <span
                  className="text-lg font-bold font-mono-arcade transition-colors"
                  style={{ color: isActive ? '#FFFFFF' : node.color }}
                >
                  {node.label}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono-arcade mt-1">
                  [{node.keyLabel}]
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="flex items-center gap-2 bg-[#18181B]/90 border border-[#27272A] px-4 py-1.5 rounded-full font-mono-arcade text-xs text-[#A1A1AA] pointer-events-none z-10 backdrop-blur-md">
        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
        <span>TAP PADS OR USE KEYS [QWE / ASD / ZXC]</span>
      </div>
    </div>
  );
};
