import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { Heart, Zap, Flame, Music, Activity, Disc3 } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import { getFrameInvariantBlend, getFrameInvariantDecay } from '../lib/frameRateRuntime';
import {
  PULSE_WAGER_MAX_CHARGES,
  PULSE_WAGER_START_CHARGES,
  PULSE_WAGER_WINDOW_PX,
  canArmPulseWager,
  getPulseWagerReward,
  isPulseWagerHit,
  shouldEarnPulseWager,
} from '../lib/pulseMastery';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface GroovePattern {
  name: string;
  badge: string;
  baseBpm: number;
  direction: 1 | -1;
  targetScale: number;
  color: string;
}

const GROOVE_PATTERNS: GroovePattern[] = [
  { name: 'CHILL FLOW', badge: 'FLOW ~', baseBpm: 84, direction: 1, targetScale: 1.0, color: '#38BDF8' },
  { name: 'STEADY BEAT', badge: 'GROOVE 4/4', baseBpm: 96, direction: 1, targetScale: 1.0, color: '#34D399' },
  { name: 'HALF-TIME DROP', badge: 'BASS DROP 💥', baseBpm: 78, direction: 1, targetScale: 1.12, color: '#A855F7' },
  { name: 'SYNCOPATED SNAP', badge: 'OFFBEAT ⚡', baseBpm: 108, direction: 1, targetScale: 0.88, color: '#FACC15' },
  { name: 'INWARD DROP', badge: 'IMPLODE ⬇', baseBpm: 98, direction: -1, targetScale: 1.0, color: '#F43F5E' },
  { name: 'DOUBLE TIME', badge: 'RUSH 🚀', baseBpm: 126, direction: 1, targetScale: 0.92, color: '#FB923C' },
];

export const PulseGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const setSafeTimeout = useSafeTimeout();

  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [feverMode, setFeverMode] = useState(false);
  const [currentBpm, setCurrentBpm] = useState(84);
  const [patternInfo, setPatternInfo] = useState<GroovePattern>(GROOVE_PATTERNS[0]);
  const [wagerHud, setWagerHud] = useState({
    charges: PULSE_WAGER_START_CHARGES,
    armed: false,
    streak: 0,
  });
  const [lastFeedback, setLastFeedback] = useState<{
    text: string;
    subtext: string;
    color: string;
  } | null>(null);

  const gameStateRef = useRef({
    currentRadius: 15,
    targetRadius: 105,
    baseTargetRadius: 105,
    speed: 2.35,
    direction: 1 as 1 | -1,
    pattern: GROOVE_PATTERNS[0],
    beatIndex: 0,
    combo: 0,
    syncWagerCharges: PULSE_WAGER_START_CHARGES,
    syncWagerArmed: false,
    syncWagerStreak: 0,
    score: 0,
    lives: 3,
    bpm: 84,
    isAlive: true,
    particles: [] as Particle[],
    flashAlpha: 0,
    bgEqualizer: Array(24).fill(0),
    pulseTime: 0,
    shake: 0,
    lastHitTime: 0,
  });

  const publishWagerHud = () => {
    const state = gameStateRef.current;
    setWagerHud({
      charges: state.syncWagerCharges,
      armed: state.syncWagerArmed,
      streak: state.syncWagerStreak,
    });
  };

  const armSyncWager = () => {
    const state = gameStateRef.current;
    if (!canArmPulseWager(state.syncWagerCharges, state.syncWagerArmed, state.isAlive) || isPausedRef.current) return;
    state.syncWagerCharges--;
    state.syncWagerArmed = true;
    publishWagerHud();
    if (soundEnabledRef.current) sounds.playPowerUp();
  };

  const nextBeat = useCallback(() => {
    const state = gameStateRef.current;
    state.beatIndex++;

    // Cycle through rhythmic patterns with natural, varied tempos
    let patternIdx = 0;
    const cycle = state.beatIndex % 8;

    if (state.combo >= 10 && cycle === 6) {
      patternIdx = 5; // Double Time rush
    } else if (state.combo >= 5 && cycle === 4) {
      patternIdx = 4; // Inward drop
    } else if (cycle === 2 || cycle === 5) {
      patternIdx = (state.beatIndex % 3 === 0) ? 2 : 3; // Bass drop or syncopation
    } else if (cycle === 0) {
      patternIdx = 0; // Chill flow
    } else {
      patternIdx = 1; // Steady beat
    }

    const selectedPattern = GROOVE_PATTERNS[patternIdx];
    state.pattern = selectedPattern;
    setPatternInfo(selectedPattern);

    // Dynamic BPM scaling (combo speeds tempo up to 155 BPM for thrilling fever gameplay)
    const comboBoost = Math.min(30, Math.floor(state.combo * 1.2));
    const dynamicBpm = Math.min(155, selectedPattern.baseBpm + comboBoost);
    state.bpm = dynamicBpm;
    setCurrentBpm(dynamicBpm);

    state.direction = selectedPattern.direction;
    state.targetRadius = state.baseTargetRadius * selectedPattern.targetScale;

    if (selectedPattern.direction === -1) {
      state.currentRadius = state.targetRadius + 95;
      state.speed = (dynamicBpm / 60) * 2.45;
    } else {
      state.currentRadius = 15;
      state.speed = (dynamicBpm / 60) * 2.35;
    }
  }, []);

  const triggerHit = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;
    const wagerAttempt = state.syncWagerArmed;
    if (wagerAttempt) {
      state.syncWagerArmed = false;
    }

    // Safety threshold against spamming
    if (state.direction === 1 && state.currentRadius < state.targetRadius * 0.45) {
      state.lives--;
      setLives(state.lives);
      state.combo = 0;
      setCombo(0);
      setFeverMode(false);
      if (wagerAttempt) {
        state.syncWagerStreak = 0;
        publishWagerHud();
      }
      setLastFeedback({
        text: 'EARLY MISS',
        subtext: 'WAIT FOR THE BEAT',
        color: 'text-[#F43F5E]',
      });
      state.shake = 8;
      haptics.impact();
      if (soundEnabledRef.current) sounds.playBuzz();

      if (state.lives <= 0) {
        state.isAlive = false;
        haptics.gameOver();
        if (soundEnabledRef.current) sounds.playGameOver();
        setSafeTimeout(() => {
          onGameOver(state.score);
        }, 650);
      }
      return;
    }

    if (state.direction === -1 && state.currentRadius > state.targetRadius + 55) {
      state.lives--;
      setLives(state.lives);
      state.combo = 0;
      setCombo(0);
      setFeverMode(false);
      if (wagerAttempt) {
        state.syncWagerStreak = 0;
        publishWagerHud();
      }
      setLastFeedback({
        text: 'EARLY MISS',
        subtext: 'WAIT FOR COLLAPSE',
        color: 'text-[#F43F5E]',
      });
      state.shake = 8;
      haptics.impact();
      if (soundEnabledRef.current) sounds.playBuzz();

      if (state.lives <= 0) {
        state.isAlive = false;
        haptics.gameOver();
        if (soundEnabledRef.current) sounds.playGameOver();
        setSafeTimeout(() => {
          onGameOver(state.score);
        }, 650);
      }
      return;
    }

    const diff = state.currentRadius - state.targetRadius;
    const absDiff = Math.abs(diff);

    // Tighter, skill-testing timing windows
    if (absDiff <= 8) {
      // PERFECT SYNC
      state.combo++;
      const isFever = state.combo >= 5;
      const multiplier = isFever ? 3 : 1;
      const pts = 250 * Math.min(6, state.combo) * multiplier;
      state.score += pts;
      state.flashAlpha = 0.35;
      state.shake = 6;

      if (isFever) {
        haptics.combo();
      } else {
        haptics.score();
      }

      // Heart recovery milestone every 15 combo
      if (state.combo % 15 === 0 && state.lives < 3) {
        state.lives++;
        setLives(state.lives);
      }

      setLastFeedback({
        text: isFever ? '🔥 HYPER PERFECT' : 'PERFECT SYNC',
        subtext: `${diff > 0 ? '+' : ''}${Math.round(diff)}px • +${pts}`,
        color: isFever ? 'text-amber-400' : 'text-[#38BDF8]',
      });

      if (soundEnabledRef.current) {
        const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
        const note = scale[state.combo % scale.length];
        sounds.playChime(note);
      }
    } else if (absDiff <= 18) {
      // GREAT (keeps combo chain alive!)
      state.combo++;
      const pts = 120 * (state.combo >= 5 ? 2 : 1);
      state.score += pts;
      haptics.light();
      setLastFeedback({
        text: 'GREAT',
        subtext: `${diff > 0 ? 'LATE' : 'EARLY'} • +${pts}`,
        color: 'text-[#34D399]',
      });
      if (soundEnabledRef.current) sounds.playSuccess();
    } else if (absDiff <= 28) {
      // GOOD (gives points, combo resets to 1)
      state.combo = 1;
      state.score += 50;
      haptics.light();
      setLastFeedback({
        text: 'GOOD',
        subtext: `${diff > 0 ? 'SLIGHT LATE' : 'SLIGHT EARLY'} • +50`,
        color: 'text-[#FACC15]',
      });
      if (soundEnabledRef.current) sounds.playPop();
    } else {
      // MISS
      state.combo = 0;
      state.lives--;
      setLives(state.lives);
      state.shake = 12;
      haptics.impact();
      setLastFeedback({
        text: 'MISS',
        subtext: 'OFF BEAT',
        color: 'text-[#F43F5E]',
      });
      if (soundEnabledRef.current) sounds.playBuzz();

      if (state.lives <= 0) {
        state.isAlive = false;
        haptics.gameOver();
        if (soundEnabledRef.current) sounds.playGameOver();
        setSafeTimeout(() => {
          onGameOver(state.score);
        }, 700);
        return;
      }
    }

    if (wagerAttempt) {
      if (isPulseWagerHit(absDiff)) {
        state.syncWagerStreak++;
        const wagerReward = getPulseWagerReward(state.combo, state.syncWagerStreak);
        state.score += wagerReward;
        setLastFeedback({
          text: `SYNC WAGER x${state.syncWagerStreak}!`,
          subtext: `±${PULSE_WAGER_WINDOW_PX}px BONUS • +${wagerReward}`,
          color: 'text-fuchsia-300',
        });
        if (soundEnabledRef.current) sounds.playVictory();
      } else {
        state.syncWagerStreak = 0;
      }
    }
    if (shouldEarnPulseWager(state.combo)) {
      state.syncWagerCharges = Math.min(PULSE_WAGER_MAX_CHARGES, state.syncWagerCharges + 1);
    }
    publishWagerHud();

    setCombo(state.combo);
    setFeverMode(state.combo >= 5);
    onScoreUpdate(state.score);

    // Burst particles
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      const cx = canvas.width / dpr / 2;
      const cy = canvas.height / dpr / 2;

      const count = absDiff <= 8 ? 20 : 12;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        const spd = 2.5 + Math.random() * 3.5;
        state.particles.push({
          x: cx + Math.cos(ang) * state.targetRadius,
          y: cy + Math.sin(ang) * state.targetRadius,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0,
          maxLife: 20,
          color: absDiff <= 8 ? '#38BDF8' : absDiff <= 18 ? '#34D399' : '#FACC15',
          size: 2.5,
        });
      }
      if (state.particles.length > 40) {
        state.particles = state.particles.slice(-40);
      }
    }

    // Advance to next beat
    nextBeat();
  }, [nextBeat, onGameOver, onScoreUpdate, setSafeTimeout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = gameStateRef.current;
    state.isAlive = true;
    state.score = 0;
    state.lives = 3;
    state.combo = 0;
    state.syncWagerCharges = PULSE_WAGER_START_CHARGES;
    state.syncWagerArmed = false;
    state.syncWagerStreak = 0;
    setWagerHud({ charges: PULSE_WAGER_START_CHARGES, armed: false, streak: 0 });
    state.bpm = 84;
    state.currentRadius = 15;
    state.direction = 1;
    state.pattern = GROOVE_PATTERNS[0];
    state.particles = [];
    state.shake = 0;
    setLives(3);
    setCombo(0);
    setFeverMode(false);
    setLastFeedback(null);
    setCurrentBpm(84);
    setPatternInfo(GROOVE_PATTERNS[0]);
    nextBeat();

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      triggerHit();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF') {
        e.preventDefault();
        armSyncWager();
        return;
      }
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault();
        triggerHit();
      }
    };

    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('mousedown', handlePointerDown);
      canvas.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerHit, nextBeat]);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const minDim = Math.min(w, h);
      const baseR = minDim * 0.32;
      gameStateRef.current.baseTargetRadius = baseR;
      gameStateRef.current.targetRadius = baseR;
    },
    onUpdate: (ctx, deltaSec, curW, curH) => {
      const dt = Math.min(32, deltaSec * 1000);
      const deltaRatio = dt / 16.67;
      const activeFrameScale = !isPausedRef.current ? deltaRatio : 0;
      const state = gameStateRef.current;
      const cx = curW / 2;
      const cy = curH / 2;

      ctx.save();

      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= getFrameInvariantDecay(0.88, activeFrameScale);
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-20, -20, curW + 40, curH + 40);

      state.pulseTime += (state.bpm / 60) * 0.07 * activeFrameScale;

      if (!isPausedRef.current && state.isAlive) {
        // Step pulse ring
        state.currentRadius += state.speed * state.direction * deltaRatio;

        // Strict auto-miss on overshoot
        let isOvershot = false;
        if (state.direction === 1 && state.currentRadius > state.targetRadius + 28) {
          isOvershot = true;
        } else if (state.direction === -1 && state.currentRadius < state.targetRadius - 28) {
          isOvershot = true;
        }

        if (isOvershot) {
          state.combo = 0;
          state.lives--;
          setLives(state.lives);
          setCombo(0);
          setFeverMode(false);
          if (state.syncWagerArmed) {
            state.syncWagerArmed = false;
            state.syncWagerStreak = 0;
            publishWagerHud();
          }
          setLastFeedback({ text: 'MISSED BEAT', subtext: 'TOO LATE', color: 'text-[#F43F5E]' });
          state.shake = 10;
          if (soundEnabledRef.current) sounds.playBuzz();

          if (state.lives <= 0) {
            state.isAlive = false;
            if (soundEnabledRef.current) sounds.playGameOver();
            setSafeTimeout(() => {
              onGameOver(state.score);
            }, 700);
          } else {
            nextBeat();
          }
        }

        // Equalizer animations
        for (let i = 0; i < state.bgEqualizer.length; i++) {
          const target =
            (Math.sin(state.pulseTime * 3 + i * 0.6) + 1) * (state.combo >= 5 ? 22 : 14) + 5;
          state.bgEqualizer[i] += (target - state.bgEqualizer[i]) * getFrameInvariantBlend(0.25, deltaRatio);
        }

        // Update particles
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx * deltaRatio;
          p.y += p.vy * deltaRatio;
          p.life += deltaRatio;
          if (p.life >= p.maxLife) {
            state.particles.splice(i, 1);
          }
        }
      }

      // --- RENDERING ---

      // Background Equalizer
      const eqBarW = curW / state.bgEqualizer.length;
      ctx.fillStyle = state.combo >= 5 ? 'rgba(250, 204, 21, 0.12)' : 'rgba(56, 189, 248, 0.07)';
      state.bgEqualizer.forEach((hVal, idx) => {
        ctx.fillRect(idx * eqBarW, curH - hVal, eqBarW - 2, hVal);
      });

      // Target Sync Outer Ring (Beat Guide)
      const ringColor = state.pattern.color;
      ctx.strokeStyle = state.combo >= 5 ? '#FACC15' : ringColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, state.targetRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Precision sweet-spot zone markers
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy, state.targetRadius - 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, state.targetRadius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (state.syncWagerArmed) {
        ctx.strokeStyle = 'rgba(232, 121, 249, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, state.targetRadius - PULSE_WAGER_WINDOW_PX, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, state.targetRadius + PULSE_WAGER_WINDOW_PX, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Center Core
      const coreR = 16 + Math.sin(state.pulseTime * 4) * 3;
      ctx.fillStyle = state.combo >= 5 ? '#FACC15' : ringColor;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Active Beat Traveling Ring
      ctx.strokeStyle =
        state.combo >= 5
          ? 'rgba(250, 204, 21, 0.95)'
          : state.direction === -1
          ? 'rgba(244, 63, 94, 0.95)'
          : 'rgba(56, 189, 248, 0.95)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, state.currentRadius), 0, Math.PI * 2);
      ctx.stroke();

      // Particles
      state.particles.forEach((p) => {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      ctx.restore();
      return state.isAlive;
    },
  });

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none game-canvas-container touch-none bg-[#090D16] overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer touch-none" />

      {/* Top Rhythm HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10 font-mono-arcade">
        {/* Lives & BPM */}
        <div className="flex items-center gap-3 bg-[#18181B]/90 border border-[#27272A] px-3.5 py-1.5 rounded-xl text-xs backdrop-blur-md">
          <div className="flex items-center gap-1 text-[#F43F5E]">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-3.5 h-3.5 ${i < lives ? 'fill-current' : 'opacity-25'}`}
              />
            ))}
          </div>
          <span className="text-[#71717A]">|</span>
          <div className="flex items-center gap-1 text-[#38BDF8] font-bold">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>{currentBpm} BPM</span>
          </div>
          <span className="text-[#71717A]">|</span>
          <span className="text-amber-400 font-bold">{patternInfo.badge}</span>
        </div>

        {/* Combo / Fever Badge */}
        {combo > 0 && (
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all backdrop-blur-md ${
              feverMode
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 animate-pulse'
                : 'bg-[#18181B]/90 border-[#27272A] text-white'
            }`}
          >
            {feverMode ? <Flame className="w-3.5 h-3.5 fill-current" /> : <Zap className="w-3.5 h-3.5 text-[#38BDF8]" />}
            <span>{combo}X COMBO {feverMode && '(3X FEVER!)'}</span>
          </div>
        )}
      </div>

      {/* Center Timing Feedback */}
      {lastFeedback && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center z-20 animate-in zoom-in-90 duration-150">
          <h2 className={`font-black font-mono-arcade text-lg sm:text-2xl tracking-wider ${lastFeedback.color}`}>
            {lastFeedback.text}
          </h2>
          <p className="font-mono-arcade text-[10px] sm:text-xs text-[#A1A1AA] mt-0.5">
            {lastFeedback.subtext}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={armSyncWager}
        disabled={wagerHud.charges <= 0 || wagerHud.armed}
        className={`absolute bottom-12 left-1/2 z-20 -translate-x-1/2 rounded-xl border px-3.5 py-2 font-mono-arcade text-[10px] font-black transition-all ${
          wagerHud.armed
            ? 'border-fuchsia-300 bg-fuchsia-500/20 text-fuchsia-200'
            : wagerHud.charges > 0
            ? 'border-amber-400/45 bg-zinc-950/85 text-amber-200 hover:bg-amber-500/15'
            : 'cursor-not-allowed border-zinc-800 bg-zinc-950/70 text-zinc-600'
        }`}
      >
        {wagerHud.armed
          ? `SYNC WAGER ARMED • ±${PULSE_WAGER_WINDOW_PX}px${wagerHud.streak > 0 ? ` • x${wagerHud.streak}` : ''}`
          : `ARM SYNC WAGER [F/SHIFT] • ${wagerHud.charges}/${PULSE_WAGER_MAX_CHARGES}`}
      </button>

      {/* Bottom Cue */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#18181B]/90 border border-[#27272A] px-4 py-1.5 rounded-full font-mono-arcade text-xs text-[#A1A1AA] pointer-events-none backdrop-blur-md">
        <Music className="w-3.5 h-3.5 text-[#38BDF8] animate-bounce" />
        <span>TAP OR PRESS SPACE ON THE BEAT</span>
      </div>
    </div>
  );
};
