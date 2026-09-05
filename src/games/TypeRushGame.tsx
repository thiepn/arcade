import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { Heart, Flame, Keyboard, Crosshair } from 'lucide-react';
import { useSafeTimeout } from '../hooks/useGameLoop';
import {
  TYPE_RUSH_WORD_RENDER_INTERVAL_MS,
  TYPE_RUSH_WPM_RENDER_INTERVAL_MS,
  shouldSyncTypeRushUi,
} from '../lib/typeRushRuntime';
import { chooseTypeRushWord, getTypeRushWave } from '../lib/typeRushProgression';
import { getTypeRushDirective, getTypeRushSpecialWeight, getTypeRushTargetBonus } from '../lib/typeRushMastery';
import {
  advanceTypeRushRelay,
  createTypeRushRelayState,
  getTypeRushRelayName,
  getTypeRushRelayStepLabel,
  syncTypeRushRelayWave,
  type TypeRushRelayState,
} from '../lib/typeRushRelays';

interface FallingWord {
  id: number;
  word: string;
  typedIndex: number;
  lane: number;
  x: number;
  y: number;
  speed: number;
  color: string;
  type: 'standard' | 'bomb' | 'freeze' | 'hyper';
}

const LANES = [16, 38, 62, 84];

const getRelayHud = (state: TypeRushRelayState) => ({
  name: getTypeRushRelayName(state),
  step: getTypeRushRelayStepLabel(state),
});

export const TypeRushGame: React.FC<GameComponentProps> = ({
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

  const inputRef = useRef<HTMLInputElement>(null);

  const [words, setWords] = useState<FallingWord[]>([]);
  const [activeWordId, setActiveWordId] = useState<number | null>(null);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [waveLabel, setWaveLabel] = useState('BOOT');
  const [turretAngle, setTurretAngle] = useState(0);
  const [lastInputChar, setLastInputChar] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [laserBeam, setLaserBeam] = useState<{ targetX: number; targetY: number } | null>(null);
  const [relayHud, setRelayHud] = useState(() => getRelayHud(createTypeRushRelayState()));

  const gameStateRef = useRef({
    words: [] as FallingWord[],
    activeWordId: null as number | null,
    nextId: 1,
    score: 0,
    lives: 3,
    streak: 0,
    charsTyped: 0,
    startTime: Date.now(),
    lastSpawn: 0,
    gameTime: 0,
    waveIndex: 0,
    freezeTimer: 0,
    relayState: createTypeRushRelayState(),
    isAlive: true,
  });

  const publishRelayHud = (relayState: TypeRushRelayState) => {
    setRelayHud(getRelayHud(relayState));
  };

  const focusDeviceKeyboard = () => {
    if (inputRef.current) inputRef.current.focus();
  };

  useEffect(() => {
    focusDeviceKeyboard();
  }, []);

  const spawnWord = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    const wave = getTypeRushWave(state.gameTime);
    const chosen = chooseTypeRushWord(
      wave,
      state.words.map((word) => word.word),
      Math.random(),
    );

    const randType = Math.random();
    const specialWeight = getTypeRushSpecialWeight(wave.index);
    let type: FallingWord['type'] = 'standard';
    let color = '#38BDF8';

    if (randType < specialWeight.bomb) {
      type = 'bomb';
      color = '#F43F5E';
    } else if (randType < specialWeight.freeze) {
      type = 'freeze';
      color = '#A78BFA';
    } else if (randType < specialWeight.hyper) {
      type = 'hyper';
      color = '#FACC15';
    }

    const laneOccupancy = [0, 0, 0, 0];
    state.words.forEach((word) => {
      if (word.lane >= 0 && word.lane < 4 && word.y < 35) laneOccupancy[word.lane]++;
    });

    let bestLane = 0;
    let minOcc = 999;
    for (let i = 0; i < 4; i++) {
      if (laneOccupancy[i] < minOcc) {
        minOcc = laneOccupancy[i];
        bestLane = i;
      }
    }

    const baseSpeed = (0.15 + Math.min(0.18, state.gameTime * 0.0028)) * wave.speedMultiplier;
    state.words.push({
      id: state.nextId++,
      word: chosen,
      typedIndex: 0,
      lane: bestLane,
      x: LANES[bestLane],
      y: 0,
      speed: baseSpeed * (type === 'hyper' ? 1.25 : 1),
      color,
      type,
    });
  };

  const handleKeyInput = (char: string) => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    const upperChar = char.toUpperCase();
    setLastInputChar(upperChar);

    let target = state.words.find((word) => word.id === state.activeWordId);

    if (!target) {
      const candidates = state.words
        .filter((word) => word.word[0] === upperChar && word.typedIndex === 0)
        .sort((a, b) => b.y - a.y);

      if (candidates.length > 0) {
        target = candidates[0];
        state.activeWordId = target.id;
        setActiveWordId(target.id);
      }
    }

    if (target && target.word[target.typedIndex] === upperChar) {
      target.typedIndex++;
      state.charsTyped++;
      state.streak++;
      setStreak(state.streak);

      const angle = (target.x - 50) * 0.95;
      setTurretAngle(angle);
      setLaserBeam({ targetX: target.x, targetY: target.y });
      setSafeTimeout(() => setLaserBeam(null), 120);

      if (soundEnabledRef.current) sounds.playLaser();

      if (target.typedIndex >= target.word.length) {
        const multiplier = state.streak >= 10 ? 3 : state.streak >= 5 ? 2 : 1;
        const wave = getTypeRushWave(state.gameTime);
        const targetBonus = getTypeRushTargetBonus(target.y, target.type, wave.index);
        let pts = Math.round(target.word.length * 100 * multiplier * wave.scoreMultiplier * targetBonus);

        const syncedRelay = syncTypeRushRelayWave(state.relayState, wave.index);
        const relayResult = advanceTypeRushRelay(syncedRelay, {
          yPercent: target.y,
          type: target.type,
        });
        state.relayState = relayResult.state;
        if (relayResult.bonus > 0) {
          pts += relayResult.bonus;
          if (soundEnabledRef.current) sounds.playSuccess();
        }
        publishRelayHud(state.relayState);

        if (target.type === 'bomb') {
          pts += state.words.length * 200;
          state.words = [];
          state.activeWordId = null;
          setActiveWordId(null);
          if (soundEnabledRef.current) sounds.playExplosion();
        } else if (target.type === 'freeze') {
          state.freezeTimer = 4.5;
          state.words = state.words.filter((word) => word.id !== target?.id);
          state.activeWordId = null;
          setActiveWordId(null);
          if (soundEnabledRef.current) sounds.playChime(900);
        } else {
          state.words = state.words.filter((word) => word.id !== target?.id);
          state.activeWordId = null;
          setActiveWordId(null);
          if (soundEnabledRef.current) sounds.playScore();
        }

        state.score += pts;
        setScore(state.score);
        onScoreUpdate(state.score);
      }

      setWords([...state.words]);
    } else {
      state.streak = 0;
      setStreak(0);
      if (soundEnabledRef.current) sounds.playHit();
    }
  };

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') return;
      if (event.key.length === 1 && /[a-zA-Z]/.test(event.key)) {
        event.preventDefault();
        handleKeyInput(event.key);
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, []);

  useEffect(() => {
    const state = gameStateRef.current;
    state.isAlive = true;
    state.score = 0;
    state.lives = 3;
    state.streak = 0;
    state.charsTyped = 0;
    state.words = [];
    state.gameTime = 0;
    state.waveIndex = 0;
    state.freezeTimer = 0;
    state.relayState = createTypeRushRelayState();
    setLives(3);
    setScore(0);
    setStreak(0);
    setWpm(0);
    setWaveLabel('BOOT');
    setWords([]);
    publishRelayHud(state.relayState);

    let animationId: number;
    let lastTime = performance.now();
    let lastWordRenderSync = lastTime;
    let lastWpmRenderSync = lastTime;

    const loop = (currentTime: number) => {
      const dt = Math.min(currentTime - lastTime, 40);
      lastTime = currentTime;

      if (!isPausedRef.current && state.isAlive) {
        state.gameTime += dt / 1000;

        if (state.freezeTimer > 0) state.freezeTimer -= dt / 1000;

        if (
          state.gameTime > 2 &&
          shouldSyncTypeRushUi(currentTime, lastWpmRenderSync, TYPE_RUSH_WPM_RENDER_INTERVAL_MS)
        ) {
          setWpm(Math.round((state.charsTyped / 5) / (state.gameTime / 60)));
          lastWpmRenderSync = currentTime;
        }

        const wave = getTypeRushWave(state.gameTime);
        if (wave.index !== state.waveIndex) {
          state.waveIndex = wave.index;
          state.relayState = syncTypeRushRelayWave(state.relayState, wave.index);
          setWaveLabel(wave.label);
          publishRelayHud(state.relayState);
          if (soundEnabledRef.current) sounds.playChime(700 + wave.index * 120);
        }
        if (currentTime - state.lastSpawn > wave.spawnIntervalMs && state.words.length < wave.maxWords) {
          spawnWord();
          state.lastSpawn = currentTime;
        }

        let livesLost = 0;
        const speedMult = state.freezeTimer > 0 ? 0.35 : 1;
        state.words.forEach((word) => {
          word.y += word.speed * speedMult * (dt / 16);
          if (word.y >= 88) livesLost++;
        });

        if (livesLost > 0) {
          state.words = state.words.filter((word) => word.y < 88);
          state.lives -= livesLost;
          state.streak = 0;
          setStreak(0);
          setLives(state.lives);
          if (soundEnabledRef.current) sounds.playBuzz();

          if (state.lives <= 0) {
            state.isAlive = false;
            if (soundEnabledRef.current) sounds.playGameOver();
            setSafeTimeout(() => onGameOver(state.score), 800);
            return;
          }
        }

        if (
          shouldSyncTypeRushUi(currentTime, lastWordRenderSync, TYPE_RUSH_WORD_RENDER_INTERVAL_MS)
        ) {
          setWords([...state.words]);
          lastWordRenderSync = currentTime;
        }
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [onGameOver, onScoreUpdate, setSafeTimeout]);

  return (
    <div
      onClick={focusDeviceKeyboard}
      className="relative w-full h-full flex flex-col items-center justify-between select-none bg-[#0A0A0B] overflow-hidden cursor-text"
    >
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        autoFocus
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck="false"
        inputMode="text"
        onChange={(event) => {
          const value = event.target.value;
          if (value.length > 0) {
            const char = value[value.length - 1];
            if (/[a-zA-Z]/.test(char)) handleKeyInput(char);
          }
          setInputValue('');
        }}
        className="opacity-0 absolute top-0 left-0 w-1 h-1 pointer-events-auto"
        aria-label="Type Rush Keyboard Input"
      />

      <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none z-20 gap-2">
        <div className="flex items-center gap-1.5 bg-[#18181B]/95 px-3 py-1.5 rounded-xl border border-[#27272A] shadow-md backdrop-blur">
          {[1, 2, 3].map((heart) => (
            <Heart
              key={heart}
              className={`w-3.5 h-3.5 transition-colors ${heart <= lives ? 'text-[#F43F5E] fill-[#F43F5E]' : 'text-[#27272A]'}`}
            />
          ))}
        </div>

        <div className="flex items-start gap-2 flex-wrap justify-end">
          {streak > 2 && (
            <div className="flex items-center gap-1 text-[#FACC15] font-mono-arcade text-xs bg-[#18181B]/95 px-3 py-1.5 rounded-xl border border-[#FACC15]/30 shadow-md backdrop-blur">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{streak} STREAK</span>
            </div>
          )}

          <div className="font-mono-arcade text-[10px] text-[#FACC15] bg-[#18181B]/95 px-2.5 py-1.5 rounded-xl border border-[#FACC15]/25 shadow-md backdrop-blur text-center">
            <div>{waveLabel} WAVE</div>
            <div className="text-[8px] text-[#A1A1AA]">{getTypeRushDirective(gameStateRef.current.waveIndex)}</div>
          </div>
          <div
            data-p23-transform="DIRECTIVE RELAY"
            className="font-mono-arcade text-[9px] text-cyan-200 bg-cyan-500/10 px-2.5 py-1.5 rounded-xl border border-cyan-400/25 shadow-md backdrop-blur max-w-44"
          >
            <div className="font-black">DIRECTIVE RELAY — {relayHud.name}</div>
            <div className="text-[8px] text-cyan-100/70 mt-0.5">{relayHud.step}</div>
          </div>
          <div className="font-mono-arcade text-xs text-[#38BDF8] bg-[#18181B]/95 px-3 py-1.5 rounded-xl border border-[#27272A] shadow-md backdrop-blur">
            {wpm} WPM
          </div>
        </div>
      </div>

      <div className="absolute inset-0 top-12 bottom-18 overflow-hidden pointer-events-auto">
        <div className="absolute bottom-[10%] left-0 right-0 border-b-2 border-dashed border-[#F43F5E]/40 flex items-center justify-center pointer-events-none">
          <span className="bg-[#0A0A0B] px-3 text-[9px] font-mono-arcade text-[#F43F5E]/70 uppercase tracking-widest">
            DEFENSE PERIMETER
          </span>
        </div>

        {laserBeam && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-15">
            <line
              x1="50%"
              y1="96%"
              x2={`${laserBeam.targetX}%`}
              y2={`${laserBeam.targetY + 3}%`}
              stroke="#38BDF8"
              strokeWidth="3"
              strokeDasharray="4 2"
              className="animate-pulse"
            />
          </svg>
        )}

        {words.map((w) => {
          const isTargeted = activeWordId === w.id;
          return (
            <button
              type="button"
              key={w.id}
              onClick={(event) => {
                event.stopPropagation();
                const state = gameStateRef.current;
                const previous = state.words.find((entry) => entry.id === state.activeWordId);
                if (previous && previous.id !== w.id) previous.typedIndex = 0;
                state.activeWordId = w.id;
                setActiveWordId(w.id);
                focusDeviceKeyboard();
              }}
              aria-label={`Target ${w.word}`}
              className={`absolute pointer-events-auto -translate-x-1/2 transition-all duration-75 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl font-mono-arcade text-xs sm:text-sm font-bold tracking-wider border shadow-xl flex items-center gap-1.5 cursor-default select-none ${isTargeted ? 'bg-[#18181B] border-white text-white shadow-[0_0_20px_rgba(56,189,248,0.6)] scale-105 z-20' : 'bg-[#18181B]/95 border-[#27272A]'}`}
              style={{
                left: `${w.x}%`,
                top: `${w.y}%`,
                borderColor: isTargeted ? '#38BDF8' : w.color,
              }}
            >
              {w.type === 'bomb' && <span className="text-xs">💣</span>}
              {w.type === 'freeze' && <span className="text-xs">❄️</span>}
              {w.type === 'hyper' && <span className="text-xs">⚡</span>}
              <span>
                <span className="text-[#34D399] font-black underline">{w.word.substring(0, w.typedIndex)}</span>
                <span className="text-white">{w.word.substring(w.typedIndex)}</span>
              </span>
              <span className="text-[8px] text-[#71717A]">{getTypeRushTargetBonus(w.y, w.type, gameStateRef.current.waveIndex).toFixed(1)}x</span>
            </button>
          );
        })}
      </div>

      <div className="absolute bottom-2 left-3 right-3 flex flex-col items-center gap-1.5 z-20">
        <div className="relative flex flex-col items-center">
          <div
            className="w-2.5 h-6 bg-[#38BDF8] rounded-full shadow-[0_0_15px_#38BDF8] transition-transform origin-bottom duration-75"
            style={{ transform: `rotate(${turretAngle}deg)` }}
          />
          <div className="w-10 h-2.5 bg-[#27272A] rounded-t-full border-t border-[#38BDF8]" />
        </div>

        <button
          type="button"
          onClick={focusDeviceKeyboard}
          className="w-full max-w-md flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#18181B]/95 border border-[#38BDF8]/40 hover:border-[#38BDF8] text-white transition-all shadow-lg cursor-pointer backdrop-blur"
        >
          <div className="flex items-center gap-2 text-xs font-mono-arcade text-[#38BDF8]">
            <Keyboard className="w-3.5 h-3.5" />
            <span>DEVICE KEYBOARD ACTIVE</span>
          </div>
          <div className="flex items-center gap-2 font-mono-arcade text-xs text-[#A1A1AA]">
            {lastInputChar ? (
              <span className="px-2 py-0.5 rounded bg-[#38BDF8]/20 text-[#38BDF8] font-bold border border-[#38BDF8]/40 animate-pulse">
                {lastInputChar}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px]">
                <Crosshair className="w-3 h-3 text-[#34D399] animate-spin" />
                <span>TAP TO FOCUS</span>
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};
