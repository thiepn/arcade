import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { Zap, Sparkles, Ghost, Flame, Trophy } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import { getFrameInvariantDecay, getFrameScale } from '../lib/frameRateRuntime';
import { getSnakeFirewallCells, getSnakeFirewallStage } from './snakeExperience';
import { extendSnakeGhostTimerForThread, getSnakePhaseThreadReward } from '../lib/snakePhaseMastery';
import { isArcadeReducedMotion } from '../lib/motionPreferences';

interface Point {
  x: number;
  y: number;
}

interface FoodItem {
  x: number;
  y: number;
  type: 'regular' | 'multiplier' | 'ghost' | 'nova';
  color: string;
  glow: string;
  points: number;
  symbol: string;
  pulse: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

export const SnakeGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const setSafeTimeout = useSafeTimeout();

  const [score, setScore] = useState(0);
  const [snakeLength, setSnakeLength] = useState(4);
  const [ghostTime, setGhostTime] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [combo, setCombo] = useState(0);
  const [firewallStage, setFirewallStage] = useState(0);
  const [phaseThreadChain, setPhaseThreadChain] = useState(0);

  const gameStateRef = useRef({
    gridW: 22,
    gridH: 22,
    cellSize: 20,
    snake: [
      { x: 11, y: 11 },
      { x: 10, y: 11 },
      { x: 9, y: 11 },
      { x: 8, y: 11 },
    ] as Point[],
    dir: { x: 1, y: 0 } as Point,
    nextDir: { x: 1, y: 0 } as Point,
    foods: [] as FoodItem[],
    firewalls: [] as Point[],
    firewallStage: 0,
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    score: 0,
    isAlive: true,
    ghostTimer: 0,
    multiplierTimer: 0,
    multiplierVal: 1,
    comboCount: 0,
    comboTimer: 0,
    phaseThreadCells: new Set<string>(),
    phaseThreadChain: 0,
    shake: 0,
    tickInterval: 95, // ms per grid step
    tickAccumulatorMs: 0,
  });

  const addFloatingText = (text: string, x: number, y: number, color = '#FFFFFF') => {
    gameStateRef.current.floatingTexts.push({
      id: Math.random(),
      text,
      x,
      y,
      color,
      life: 0,
      maxLife: 32,
    });
  };

  const spawnFood = useCallback((typeOverride?: FoodItem['type']) => {
    const state = gameStateRef.current;
    const occupied = new Set(state.snake.map((p) => `${p.x},${p.y}`));
    state.foods.forEach((f) => occupied.add(`${f.x},${f.y}`));
    state.firewalls.forEach((cell) => occupied.add(`${cell.x},${cell.y}`));

    const available: Point[] = [];
    for (let x = 1; x < state.gridW - 1; x++) {
      for (let y = 1; y < state.gridH - 1; y++) {
        if (!occupied.has(`${x},${y}`)) {
          available.push({ x, y });
        }
      }
    }

    if (available.length === 0) return;
    const pos = available[Math.floor(Math.random() * available.length)];

    let type: FoodItem['type'] = typeOverride || 'regular';
    if (!typeOverride) {
      const rand = Math.random();
      if (rand < 0.12) type = 'ghost';
      else if (rand < 0.26) type = 'multiplier';
      else if (rand < 0.38) type = 'nova';
    }

    let color = '#34D399';
    let glow = 'rgba(52, 211, 153, 0.6)';
    let points = 100;
    let symbol = '🟢';

    if (type === 'multiplier') {
      color = '#FACC15';
      glow = 'rgba(250, 204, 21, 0.7)';
      points = 250;
      symbol = '★';
    } else if (type === 'ghost') {
      color = '#A855F7';
      glow = 'rgba(168, 85, 247, 0.7)';
      points = 400;
      symbol = '👻';
    } else if (type === 'nova') {
      color = '#F43F5E';
      glow = 'rgba(244, 63, 94, 0.7)';
      points = 500;
      symbol = '💎';
    }

    state.foods.push({
      x: pos.x,
      y: pos.y,
      type,
      color,
      glow,
      points,
      symbol,
      pulse: 0,
    });
  }, []);

  const changeDirection = useCallback((dx: number, dy: number) => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    // Prevent immediate 180-degree turnaround
    if (dx !== 0 && state.dir.x !== 0 && dx === -state.dir.x) return;
    if (dy !== 0 && state.dir.y !== 0 && dy === -state.dir.y) return;

    state.nextDir = { x: dx, y: dy };
    haptics.light();
  }, []);

  useEffect(() => {
    // Initial food spawn
    const state = gameStateRef.current;
    state.foods = [];
    state.firewalls = [];
    state.firewallStage = 0;
    state.phaseThreadCells.clear();
    state.phaseThreadChain = 0;
    setFirewallStage(0);
    setPhaseThreadChain(0);
    spawnFood('regular');
    spawnFood('multiplier');

    // Keyboard controls
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        changeDirection(0, -1);
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        changeDirection(0, 1);
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        changeDirection(-1, 0);
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        changeDirection(1, 0);
      }
    };

    // Touch swipe controls
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) > 20) {
        if (absDx > absDy) {
          changeDirection(dx > 0 ? 1 : -1, 0);
        } else {
          changeDirection(0, dy > 0 ? 1 : -1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (canvas) {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [changeDirection, spawnFood]);

  // Step Logic
  const stepSnake = () => {
    const state = gameStateRef.current;
    if (isPausedRef.current || !state.isAlive) return;

    state.dir = { ...state.nextDir };
    const head = state.snake[0];
    const newHead: Point = {
      x: head.x + state.dir.x,
      y: head.y + state.dir.y,
    };

    // Timers
    if (state.ghostTimer > 0) {
      state.ghostTimer--;
      setGhostTime(state.ghostTimer);
      if (state.ghostTimer === 0) {
        state.phaseThreadCells.clear();
        state.phaseThreadChain = 0;
        setPhaseThreadChain(0);
      }
    }
    if (state.multiplierTimer > 0) {
      state.multiplierTimer--;
      if (state.multiplierTimer === 0) {
        state.multiplierVal = 1;
        setMultiplier(1);
      }
    }
    if (state.comboTimer > 0) {
      state.comboTimer--;
      if (state.comboTimer === 0) {
        state.comboCount = 0;
        setCombo(0);
      }
    }

    const isGhost = state.ghostTimer > 0;

    // Edge-to-edge portal wrapping (wrap right to left, left to right, top to bottom, bottom to top)
    const didWrapX = newHead.x < 0 || newHead.x >= state.gridW;
    const didWrapY = newHead.y < 0 || newHead.y >= state.gridH;

    newHead.x = (newHead.x + state.gridW) % state.gridW;
    newHead.y = (newHead.y + state.gridH) % state.gridH;

    if (didWrapX || didWrapY) {
      if (soundEnabled) sounds.playWarp();
      // Spawn warp particles at both edge portals
      for (let p = 0; p < 6; p++) {
        state.particles.push({
          x: (newHead.x + 0.5) * state.cellSize,
          y: (newHead.y + 0.5) * state.cellSize,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          life: 1,
          maxLife: 18,
          color: '#38BDF8',
          size: Math.random() * 3 + 2,
        });
      }
    }

    // Firewall collision. Ghost Phase now has a concrete traversal purpose.
    const firewallCollision = state.firewalls.some(
      (cell) => cell.x === newHead.x && cell.y === newHead.y
    );
    if (firewallCollision && !isGhost) {
      state.isAlive = false;
      state.shake = 16;
      haptics.gameOver();
      if (soundEnabled) sounds.playExplosion();
      addFloatingText('FIREWALL HIT', newHead.x * state.cellSize, newHead.y * state.cellSize, '#F43F5E');
      setSafeTimeout(() => onGameOver(state.score), 400);
      return;
    }

    if (firewallCollision && isGhost) {
      const cellKey = `${newHead.x},${newHead.y}`;
      if (!state.phaseThreadCells.has(cellKey)) {
        state.phaseThreadCells.add(cellKey);
        state.phaseThreadChain++;
        const reward = getSnakePhaseThreadReward(state.phaseThreadChain);
        state.score += reward;
        state.ghostTimer = extendSnakeGhostTimerForThread(state.ghostTimer, state.phaseThreadChain);
        setScore(state.score);
        setGhostTime(state.ghostTimer);
        setPhaseThreadChain(state.phaseThreadChain);
        onScoreUpdate(state.score);
        addFloatingText(
          `PHASE THREAD x${state.phaseThreadChain} +${reward}`,
          newHead.x * state.cellSize,
          newHead.y * state.cellSize - 14,
          '#C084FC',
        );
        haptics.combo();
        if (soundEnabled) sounds.playChime(720 + Math.min(6, state.phaseThreadChain) * 55);
      }
    }

    // Self collision
    const selfCollision = state.snake.some(
      (seg, idx) => idx > 0 && seg.x === newHead.x && seg.y === newHead.y
    );

    if (selfCollision && !isGhost) {
      state.isAlive = false;
      state.shake = 16;
      haptics.gameOver();
      if (soundEnabled) sounds.playExplosion();
      setSafeTimeout(() => onGameOver(state.score), 400);
      return;
    }

    // Move snake forward
    state.snake.unshift(newHead);

    // Check food consumption
    const foodIndex = state.foods.findIndex(
      (f) => f.x === newHead.x && f.y === newHead.y
    );

    if (foodIndex !== -1) {
      const eaten = state.foods[foodIndex];
      state.foods.splice(foodIndex, 1);

      // Score Calculation
      state.comboCount++;
      state.comboTimer = 45;
      setCombo(state.comboCount);

      const comboMultiplier = state.comboCount >= 4 ? 2 : 1;
      const totalGain = eaten.points * state.multiplierVal * comboMultiplier;
      state.score += totalGain;
      setScore(state.score);
      onScoreUpdate(state.score);
      setSnakeLength(state.snake.length);

      haptics.score();
      if (soundEnabled) sounds.playPop();

      // Power-up triggers
      if (eaten.type === 'ghost') {
        state.ghostTimer = 65; // ~6.5 seconds
        state.phaseThreadCells.clear();
        state.phaseThreadChain = 0;
        setGhostTime(65);
        setPhaseThreadChain(0);
        if (soundEnabled) sounds.playPowerUp();
        addFloatingText('👻 GHOST PHASE!', newHead.x * state.cellSize, newHead.y * state.cellSize - 15, '#A855F7');
      } else if (eaten.type === 'multiplier') {
        state.multiplierTimer = 85;
        state.multiplierVal = 2;
        setMultiplier(2);
        if (soundEnabled) sounds.playPowerUp();
        addFloatingText('★ 2x MULTIPLIER!', newHead.x * state.cellSize, newHead.y * state.cellSize - 15, '#FACC15');
      } else if (eaten.type === 'nova') {
        if (soundEnabled) sounds.playVictory();
        addFloatingText('💎 NOVA BURST! +500', newHead.x * state.cellSize, newHead.y * state.cellSize - 15, '#F43F5E');
      } else {
        addFloatingText(`+${totalGain}`, newHead.x * state.cellSize, newHead.y * state.cellSize - 10, eaten.color);
      }

      // Particle sparks
      for (let k = 0; k < 12; k++) {
        const ang = Math.random() * Math.PI * 2;
        state.particles.push({
          x: (newHead.x + 0.5) * state.cellSize,
          y: (newHead.y + 0.5) * state.cellSize,
          vx: Math.cos(ang) * (2 + Math.random() * 3),
          vy: Math.sin(ang) * (2 + Math.random() * 3),
          color: eaten.color,
          size: 2.5,
          life: 0,
          maxLife: 18,
        });
      }

      // Every four growth steps adds another short, navigable firewall phrase.
      const nextFirewallStage = getSnakeFirewallStage(state.snake.length);
      if (nextFirewallStage > state.firewallStage) {
        const blocked = new Set<string>();
        state.snake.forEach((segment) => blocked.add(`${segment.x},${segment.y}`));
        state.foods.forEach((food) => blocked.add(`${food.x},${food.y}`));
        state.firewalls = getSnakeFirewallCells(nextFirewallStage, blocked);
        state.firewallStage = nextFirewallStage;
        setFirewallStage(nextFirewallStage);
        addFloatingText(
          `FIREWALL LEVEL ${nextFirewallStage}`,
          newHead.x * state.cellSize,
          newHead.y * state.cellSize - 18,
          '#F43F5E',
        );
        if (soundEnabled) sounds.playTone(300 + nextFirewallStage * 70, 0.09, 'sawtooth');
      }

      // Spawn replacement food
      spawnFood();
      if (Math.random() < 0.35 && state.foods.length < 3) {
        spawnFood();
      }

      // Gradual speedup
      if (state.tickInterval > 65) {
        state.tickInterval = Math.max(65, 95 - Math.floor(state.score / 600) * 3);
      }
    } else {
      // Pop tail if no food eaten
      state.snake.pop();
    }
  };

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const state = gameStateRef.current;
      const minDim = Math.min(w, h) - 40;
      state.cellSize = Math.floor(minDim / state.gridW);
    },
    onUpdate: (ctx, deltaSec, curW, curH) => {
      const state = gameStateRef.current;
      const frameScale = !isPausedRef.current ? getFrameScale(deltaSec) : 0;
      if (!isPausedRef.current && state.isAlive) {
        state.tickAccumulatorMs += deltaSec * 1000;
        let safetySteps = 0;
        while (state.tickAccumulatorMs >= state.tickInterval && state.isAlive && safetySteps < 8) {
          state.tickAccumulatorMs -= state.tickInterval;
          stepSnake();
          safetySteps++;
        }
      }

      // Screen Shake
      if (state.shake > 0) {
                if (!isArcadeReducedMotion()) {
          ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        }
        state.shake *= getFrameInvariantDecay(0.88, frameScale);
        if (state.shake < 0.2) state.shake = 0;
      }

      ctx.clearRect(-10, -10, curW + 20, curH + 20);

      const gridPixelW = state.gridW * state.cellSize;
      const gridPixelH = state.gridH * state.cellSize;
      const offsetX = Math.floor((curW - gridPixelW) * 0.5);
      const offsetY = Math.floor((curH - gridPixelH) * 0.5);

      ctx.save();
      ctx.translate(offsetX, offsetY);

      // Cyber Grid Background
      ctx.strokeStyle = state.ghostTimer > 0 ? 'rgba(168, 85, 247, 0.12)' : 'rgba(56, 189, 248, 0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= state.gridW; x++) {
        ctx.beginPath();
        ctx.moveTo(x * state.cellSize, 0);
        ctx.lineTo(x * state.cellSize, gridPixelH);
        ctx.stroke();
      }
      for (let y = 0; y <= state.gridH; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * state.cellSize);
        ctx.lineTo(gridPixelW, y * state.cellSize);
        ctx.stroke();
      }

      // Perimeter Border
      ctx.strokeStyle = state.ghostTimer > 0 ? '#A855F7' : '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(0, 0, gridPixelW, gridPixelH);

      // Firewall cells: short static phrases that can be bypassed with Ghost Phase.
      state.firewalls.forEach((cell) => {
        const x = cell.x * state.cellSize;
        const y = cell.y * state.cellSize;
        const inset = Math.max(2, state.cellSize * 0.12);
        ctx.save();
        ctx.globalAlpha = state.ghostTimer > 0 ? 0.42 : 0.92;
        ctx.shadowColor = '#F43F5E';
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(244, 63, 94, 0.24)';
        ctx.fillRect(x + inset, y + inset, state.cellSize - inset * 2, state.cellSize - inset * 2);
        ctx.strokeStyle = '#F43F5E';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + inset, y + inset, state.cellSize - inset * 2, state.cellSize - inset * 2);
        ctx.beginPath();
        ctx.moveTo(x + inset + 2, y + state.cellSize - inset - 2);
        ctx.lineTo(x + state.cellSize - inset - 2, y + inset + 2);
        ctx.stroke();
        ctx.restore();
      });

      // Food items
      state.foods.forEach((f) => {
        f.pulse += 0.08 * frameScale;
        const cx = (f.x + 0.5) * state.cellSize;
        const cy = (f.y + 0.5) * state.cellSize;
        const rad = (state.cellSize * 0.42) + Math.sin(f.pulse) * 1.5;

        // Glow
        ctx.fillStyle = f.glow;
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 1.4, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Icon symbol
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.floor(state.cellSize * 0.55)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.symbol, cx, cy);
      });

      // Snake Body
      const isGhost = state.ghostTimer > 0;
      const snakeLen = state.snake.length;

      for (let i = snakeLen - 1; i >= 0; i--) {
        const seg = state.snake[i];
        const cx = (seg.x + 0.5) * state.cellSize;
        const cy = (seg.y + 0.5) * state.cellSize;
        const progress = 1 - i / snakeLen;
        const radius = (state.cellSize * 0.44) * (0.65 + progress * 0.35);

        ctx.save();
        if (isGhost) {
          ctx.globalAlpha = 0.55 + Math.sin(Date.now() * 0.01) * 0.2;
          ctx.fillStyle = '#C084FC';
          ctx.shadowColor = '#A855F7';
          ctx.shadowBlur = 8;
        } else if (i === 0) {
          // Head
          ctx.fillStyle = '#38BDF8';
          ctx.shadowColor = '#38BDF8';
          ctx.shadowBlur = 12;
        } else {
          // Body gradient
          ctx.fillStyle = i % 2 === 0 ? '#0284C7' : '#0EA5E9';
        }

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Head Eyes
        if (i === 0) {
          const eyeOffset = radius * 0.45;
          const lookX = state.dir.x * eyeOffset * 0.6;
          const lookY = state.dir.y * eyeOffset * 0.6;

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(cx + lookX - state.dir.y * eyeOffset, cy + lookY + state.dir.x * eyeOffset, 2.5, 0, Math.PI * 2);
          ctx.arc(cx + lookX + state.dir.y * eyeOffset, cy + lookY - state.dir.x * eyeOffset, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx * frameScale;
        p.y += p.vy * frameScale;
        p.life += frameScale;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (p.life >= p.maxLife) {
          state.particles.splice(i, 1);
        }
      }

      // Floating Texts
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ft.y -= 0.8 * frameScale;
        ft.life += frameScale;
        const alpha = Math.max(0, 1 - ft.life / ft.maxLife);

        ctx.fillStyle = ft.color;
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;

        if (ft.life >= ft.maxLife) {
          state.floatingTexts.splice(i, 1);
        }
      }

      ctx.restore(); // translation

      return state.isAlive;
    },
  });

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none game-canvas-container touch-none bg-[#090D16] overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block touch-none" />

      {/* Top HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-3 bg-[#18181B]/90 border border-[#27272A] px-3.5 py-1.5 rounded-xl font-mono-arcade text-xs backdrop-blur-md">
          <div className="flex items-center gap-1 text-cyan-400 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>LENGTH: {snakeLength}</span>
          </div>

          <span className="text-[#71717A]">|</span>

          {firewallStage > 0 && (
            <span className="text-rose-400 font-bold">FW L{firewallStage}</span>
          )}

          {multiplier > 1 && (
            <div className="flex items-center gap-1 text-amber-400 font-bold animate-pulse">
              <Trophy className="w-3.5 h-3.5" />
              <span>{multiplier}X BOOST</span>
            </div>
          )}

          {ghostTime > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold flex items-center gap-1 animate-pulse">
              <Ghost className="w-3 h-3" /> GHOST PHASE
            </span>
          )}

          {phaseThreadChain > 0 && (
            <span className="text-fuchsia-300 font-bold">THREAD x{phaseThreadChain}</span>
          )}

          {combo >= 2 && (
            <div className="flex items-center gap-1 text-rose-400 font-bold">
              <Flame className="w-3.5 h-3.5" />
              <span>COMBO x{combo}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 bg-[#18181B]/90 border border-[#27272A] px-3 py-1.5 rounded-xl font-mono-arcade text-xs text-[#A1A1AA] backdrop-blur-md">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>ARROWS / WASD / SWIPE TO STEER</span>
        </div>
      </div>

      {/* Tactile D-Pad Controls for Mobile and Touch */}
      <div className="absolute bottom-3 right-4 z-10 flex flex-col items-center gap-1 pointer-events-auto sm:hidden">
        <button
          type="button"
          onClick={() => changeDirection(0, -1)}
          className="w-11 h-11 rounded-lg bg-[#18181B]/90 border border-zinc-700 text-cyan-400 font-bold active:bg-cyan-500 active:text-black flex items-center justify-center backdrop-blur-md shadow-lg"
        >
          ▲
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => changeDirection(-1, 0)}
            className="w-11 h-11 rounded-lg bg-[#18181B]/90 border border-zinc-700 text-cyan-400 font-bold active:bg-cyan-500 active:text-black flex items-center justify-center backdrop-blur-md shadow-lg"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => changeDirection(0, 1)}
            className="w-11 h-11 rounded-lg bg-[#18181B]/90 border border-zinc-700 text-cyan-400 font-bold active:bg-cyan-500 active:text-black flex items-center justify-center backdrop-blur-md shadow-lg"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={() => changeDirection(1, 0)}
            className="w-11 h-11 rounded-lg bg-[#18181B]/90 border border-zinc-700 text-cyan-400 font-bold active:bg-cyan-500 active:text-black flex items-center justify-center backdrop-blur-md shadow-lg"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};
