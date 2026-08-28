import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import { clamp } from '../lib/gameCoordinates';
import { getAirHockeyTableLayout } from '../lib/airHockeyLayout';

interface Mallet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface Puck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';

const DIFFICULTY_CONFIG = {
  EASY: {
    label: 'CASUAL',
    aiSpeed: 190,
    predFactor: 0.04,
    pointsPerGoal: 500,
    multiplierBadge: '1.0x PTS',
    color: '#34D399',
  },
  MEDIUM: {
    label: 'PRO',
    aiSpeed: 310,
    predFactor: 0.09,
    pointsPerGoal: 875,
    multiplierBadge: '1.75x PTS',
    color: '#38BDF8',
  },
  HARD: {
    label: 'MASTER',
    aiSpeed: 460,
    predFactor: 0.14,
    pointsPerGoal: 1250,
    multiplierBadge: '2.5x PTS',
    color: '#F43F5E',
  },
};

export const AirHockeyGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('MEDIUM');
  const [hasGameStarted, setHasGameStarted] = useState(false);

  const [hudState, setHudState] = useState({
    playerScore: 0,
    aiScore: 0,
    timeLeft: 60,
    combo: 0,
    difficulty: 'MEDIUM' as DifficultyLevel,
  });

  const gameStateRef = useRef({
    playerScore: 0,
    aiScore: 0,
    gameScore: 0,
    timeLeft: 60,
    isAlive: true,
    combo: 0,
    difficulty: 'MEDIUM' as DifficultyLevel,

    puck: { x: 200, y: 250, vx: 0, vy: 0, radius: 14 } as Puck,
    playerMallet: { x: 200, y: 400, vx: 0, vy: 0, radius: 24, color: '#06B6D4' } as Mallet,
    aiMallet: { x: 200, y: 100, vx: 0, vy: 0, radius: 24, color: '#EC4899' } as Mallet,

    targetPlayerX: 200,
    targetPlayerY: 400,

    goalWidth: 140,
    isGoalResetting: false,
    goalTimer: 0,

    puckTrail: [] as { x: number; y: number; alpha: number }[],
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[],
    popups: [] as { id: number; x: number; y: number; text: string; color: string; life: number }[],
    nextId: 1,
    viewportWidth: 400,
    viewportHeight: 500,
  });

  const updatePointerTarget = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    gameStateRef.current.targetPlayerX = e.clientX - rect.left;
    gameStateRef.current.targetPlayerY = e.clientY - rect.top;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    updatePointerTarget(e);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updatePointerTarget(e);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      const speed = 25 * getAirHockeyTableLayout(
        state.viewportWidth,
        state.viewportHeight,
      ).motionScale;
      if (
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'KeyA' ||
        e.code === 'KeyD' ||
        e.code === 'KeyW' ||
        e.code === 'KeyS'
      ) {
        e.preventDefault();
      }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.targetPlayerX -= speed;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') state.targetPlayerX += speed;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') state.targetPlayerY -= speed;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') state.targetPlayerY += speed;
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const setSafeTimeout = useSafeTimeout();

  useEffect(() => {
    const state = gameStateRef.current;
    state.playerScore = 0;
    state.aiScore = 0;
    state.gameScore = 0;
    state.timeLeft = 60;
    state.isAlive = true;
    state.combo = 0;
    state.isGoalResetting = false;
    state.puckTrail = [];
    state.particles = [];
    state.popups = [];
    state.puck.x = 200;
    state.puck.y = 250;
    state.puck.vx = (Math.random() - 0.5) * 60;
    state.puck.vy = 150;
  }, []);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      const state = gameStateRef.current;
      const oldTable = getAirHockeyTableLayout(
        state.viewportWidth,
        state.viewportHeight,
      );
      const newTable = getAirHockeyTableLayout(w, h);
      const scaleX = newTable.width / Math.max(1, oldTable.width);
      const scaleY = newTable.height / Math.max(1, oldTable.height);
      const uniformScale = Math.min(scaleX, scaleY);

      const remapPoint = (point: { x: number; y: number }) => {
        point.x = newTable.left + (point.x - oldTable.left) * scaleX;
        point.y = newTable.top + (point.y - oldTable.top) * scaleY;
      };
      const remapVelocity = (velocity: { vx: number; vy: number }) => {
        velocity.vx *= scaleX;
        velocity.vy *= scaleY;
      };

      remapPoint(state.puck);
      remapVelocity(state.puck);
      state.puck.radius = clamp(state.puck.radius * uniformScale, 10, 18);

      for (const mallet of [state.playerMallet, state.aiMallet]) {
        remapPoint(mallet);
        remapVelocity(mallet);
        mallet.radius = clamp(mallet.radius * uniformScale, 20, 32);
      }

      const target = { x: state.targetPlayerX, y: state.targetPlayerY };
      remapPoint(target);
      state.targetPlayerX = target.x;
      state.targetPlayerY = target.y;

      for (const trail of state.puckTrail) remapPoint(trail);
      for (const particle of state.particles) {
        remapPoint(particle);
        remapVelocity(particle);
        particle.size *= uniformScale;
      }
      for (const popup of state.popups) remapPoint(popup);

      state.goalWidth = newTable.goalWidth;
      state.viewportWidth = w;
      state.viewportHeight = h;

      state.puck.x = clamp(
        state.puck.x,
        newTable.left + state.puck.radius,
        newTable.right - state.puck.radius,
      );
      state.puck.y = clamp(
        state.puck.y,
        newTable.top + state.puck.radius,
        newTable.bottom - state.puck.radius,
      );
      state.playerMallet.x = clamp(
        state.playerMallet.x,
        newTable.left + state.playerMallet.radius,
        newTable.right - state.playerMallet.radius,
      );
      state.playerMallet.y = clamp(
        state.playerMallet.y,
        newTable.centerY + state.playerMallet.radius + 4,
        newTable.bottom - state.playerMallet.radius,
      );
      state.aiMallet.x = clamp(
        state.aiMallet.x,
        newTable.left + state.aiMallet.radius,
        newTable.right - state.aiMallet.radius,
      );
      state.aiMallet.y = clamp(
        state.aiMallet.y,
        newTable.top + state.aiMallet.radius,
        newTable.centerY - state.aiMallet.radius - 4,
      );
      state.targetPlayerX = clamp(
        state.targetPlayerX,
        newTable.left + state.playerMallet.radius,
        newTable.right - state.playerMallet.radius,
      );
      state.targetPlayerY = clamp(
        state.targetPlayerY,
        newTable.centerY + state.playerMallet.radius + 4,
        newTable.bottom - state.playerMallet.radius,
      );
    },
    onUpdate: (ctx, dt, w, h) => {
      const state = gameStateRef.current;

      ctx.clearRect(0, 0, w, h);

      const table = getAirHockeyTableLayout(w, h);
      const tableW = table.width;
      const tableH = table.height;
      const tableLeft = table.left;
      const tableRight = table.right;
      const tableTop = table.top;
      const tableBottom = table.bottom;
      const centerY = table.centerY;
      const centerX = table.centerX;
      state.goalWidth = table.goalWidth;

      const resetPuck = (toPlayer: boolean) => {
        state.isGoalResetting = true;
        state.goalTimer = 0.8;
        state.puck.x = centerX;
        state.puck.y = toPlayer
          ? centerY + 60 * table.motionScale
          : centerY - 60 * table.motionScale;
        state.puck.vx = (Math.random() - 0.5) * 60 * table.motionScale;
        state.puck.vy = (toPlayer ? 80 : -80) * table.motionScale;
      };

      if (!isPausedRef.current && state.isAlive) {
        state.timeLeft -= dt;
        if (state.timeLeft <= 0) {
          state.timeLeft = 0;
          state.isAlive = false;
          if (soundEnabled) sounds.playGameOver();
          setSafeTimeout(() => onGameOver(state.gameScore), 400);
        }

        if (state.isGoalResetting) {
          state.goalTimer -= dt;
          if (state.goalTimer <= 0) state.isGoalResetting = false;
        }

        // 1. Update Player Mallet
        const minPlayerY = centerY + state.playerMallet.radius + 4;
        const maxPlayerY = tableBottom - state.playerMallet.radius;
        const minPlayerX = tableLeft + state.playerMallet.radius;
        const maxPlayerX = tableRight - state.playerMallet.radius;

        const boundedTargetX = Math.max(minPlayerX, Math.min(maxPlayerX, state.targetPlayerX));
        const boundedTargetY = Math.max(minPlayerY, Math.min(maxPlayerY, state.targetPlayerY));

        state.playerMallet.vx = (boundedTargetX - state.playerMallet.x) / Math.max(0.016, dt);
        state.playerMallet.vy = (boundedTargetY - state.playerMallet.y) / Math.max(0.016, dt);
        state.playerMallet.x = boundedTargetX;
        state.playerMallet.y = boundedTargetY;

        // 2. Update AI Mallet based on selected difficulty
        const diffConfig = DIFFICULTY_CONFIG[state.difficulty] || DIFFICULTY_CONFIG.MEDIUM;
        const tableCenterX = (tableLeft + tableRight) / 2;
        const aiHomeX = tableCenterX;
        const aiHomeY = tableTop + 55;

        let aiTargetX = aiHomeX;
        let aiTargetY = aiHomeY;

        const aiMinX = tableLeft + state.aiMallet.radius + 6;
        const aiMaxX = tableRight - state.aiMallet.radius - 6;
        const aiMinY = tableTop + state.aiMallet.radius + 6;
        const aiMaxY = centerY - state.aiMallet.radius - 10;

        if (state.puck.y < centerY + 20) {
          if (state.puck.y < state.aiMallet.y - 4) {
            aiTargetX = state.puck.x > tableCenterX ? aiMinX + 25 : aiMaxX - 25;
            aiTargetY = Math.max(aiMinY, state.puck.y - 10);
          } else {
            const predX = state.puck.x + state.puck.vx * diffConfig.predFactor;
            aiTargetX = Math.max(aiMinX, Math.min(aiMaxX, predX));
            aiTargetY = Math.min(aiMaxY, Math.max(aiMinY, state.puck.y - 18));
          }
        } else {
          const guardFactor = (state.puck.x - tableCenterX) / (tableRight - tableLeft);
          aiTargetX = tableCenterX + guardFactor * 50;
          aiTargetY = aiHomeY;
        }

        aiTargetX = Math.max(aiMinX, Math.min(aiMaxX, aiTargetX));
        aiTargetY = Math.max(aiMinY, Math.min(aiMaxY, aiTargetY));

        const aiSpeed = diffConfig.aiSpeed * table.motionScale;
        const aiDX = aiTargetX - state.aiMallet.x;
        const aiDY = aiTargetY - state.aiMallet.y;
        const aiDist = Math.hypot(aiDX, aiDY);

        if (aiDist > 2) {
          state.aiMallet.vx = (aiDX / aiDist) * Math.min(aiSpeed, aiDist / dt);
          state.aiMallet.vy = (aiDY / aiDist) * Math.min(aiSpeed, aiDist / dt);
        } else {
          state.aiMallet.vx = 0;
          state.aiMallet.vy = 0;
        }

        state.aiMallet.x += state.aiMallet.vx * dt;
        state.aiMallet.y += state.aiMallet.vy * dt;

        // 3. Update Puck Physics
        const puck = state.puck;
        puck.x += puck.vx * dt;
        puck.y += puck.vy * dt;

        const drag = Math.pow(0.993, dt * 60);
        puck.vx *= drag;
        puck.vy *= drag;

        const pSpeed = Math.hypot(puck.vx, puck.vy);
        const maxSpeed = 680 * table.motionScale;
        if (pSpeed > maxSpeed) {
          puck.vx = (puck.vx / pSpeed) * maxSpeed;
          puck.vy = (puck.vy / pSpeed) * maxSpeed;
        }

        state.puckTrail.unshift({ x: puck.x, y: puck.y, alpha: 0.7 });
        if (state.puckTrail.length > 6) state.puckTrail.pop();

        // 4. Wall collisions
        if (puck.x - puck.radius < tableLeft) {
          puck.x = tableLeft + puck.radius;
          puck.vx = Math.abs(puck.vx);
          if (soundEnabled) sounds.playPuckHit();
        } else if (puck.x + puck.radius > tableRight) {
          puck.x = tableRight - puck.radius;
          puck.vx = -Math.abs(puck.vx);
          if (soundEnabled) sounds.playPuckHit();
        }

        // 5. Goals
        const goalLeft = centerX - state.goalWidth / 2;
        const goalRight = centerX + state.goalWidth / 2;

        if (puck.y - puck.radius < tableTop) {
          if (puck.x > goalLeft && puck.x < goalRight && !state.isGoalResetting) {
            state.playerScore++;
            state.combo++;
            const basePts = diffConfig.pointsPerGoal;
            const pts = basePts * Math.min(4, state.combo);
            state.gameScore += pts;
            onScoreUpdate(state.gameScore);
            if (soundEnabled) sounds.playVictory();

            state.popups.push({
              id: state.nextId++,
              x: centerX,
              y: centerY - 40,
              text: `GOAL! +${pts}`,
              color: '#38BDF8',
              life: 1.0,
            });

            for (let i = 0; i < 16; i++) {
              state.particles.push({
                x: puck.x,
                y: tableTop + 5,
                vx: (Math.random() - 0.5) * 180,
                vy: Math.random() * 140 + 30,
                life: 0.6,
                color: '#38BDF8',
                size: 3.5,
              });
            }

            resetPuck(false);
          } else {
            puck.y = tableTop + puck.radius;
            puck.vy = Math.abs(puck.vy);
            if (soundEnabled) sounds.playPuckHit();
          }
        }

        if (puck.y + puck.radius > tableBottom) {
          if (puck.x > goalLeft && puck.x < goalRight && !state.isGoalResetting) {
            state.aiScore++;
            state.combo = 0;
            if (soundEnabled) sounds.playExplosion();

            state.popups.push({
              id: state.nextId++,
              x: centerX,
              y: centerY + 40,
              text: 'OPPONENT SCORED',
              color: '#F43F5E',
              life: 1.0,
            });

            for (let i = 0; i < 16; i++) {
              state.particles.push({
                x: puck.x,
                y: tableBottom - 5,
                vx: (Math.random() - 0.5) * 180,
                vy: -Math.random() * 140 - 30,
                life: 0.6,
                color: '#F43F5E',
                size: 3.5,
              });
            }

            resetPuck(true);
          } else {
            puck.y = tableBottom - puck.radius;
            puck.vy = -Math.abs(puck.vy);
            if (soundEnabled) sounds.playPuckHit();
          }
        }

        // 6. Mallet hit logic
        const checkMalletHit = (mallet: Mallet, isPlayer: boolean) => {
          const dx = puck.x - mallet.x;
          const dy = puck.y - mallet.y;
          const dist = Math.hypot(dx, dy);
          const minDist = puck.radius + mallet.radius;

          if (dist < minDist && dist > 0.001) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            puck.x += nx * overlap;
            puck.y += ny * overlap;

            const relVx = puck.vx - mallet.vx;
            const relVy = puck.vy - mallet.vy;
            const impulse = -(1 + 0.65) * (relVx * nx + relVy * ny);

            if (impulse > 0) {
              puck.vx += nx * impulse + mallet.vx * 0.4;
              puck.vy += ny * impulse + mallet.vy * 0.4;

              if (soundEnabled) sounds.playPuckHit();

              for (let i = 0; i < 6; i++) {
                state.particles.push({
                  x: puck.x,
                  y: puck.y,
                  vx: nx * 90 + (Math.random() - 0.5) * 60,
                  vy: ny * 90 + (Math.random() - 0.5) * 60,
                  life: 0.3,
                  color: isPlayer ? '#06B6D4' : '#EC4899',
                  size: 2.5,
                });
              }
            }
          }
        };

        checkMalletHit(state.playerMallet, true);
        checkMalletHit(state.aiMallet, false);

        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) state.particles.splice(i, 1);
        }

        for (let i = state.popups.length - 1; i >= 0; i--) {
          const pop = state.popups[i];
          pop.y -= 25 * dt;
          pop.life -= dt;
          if (pop.life <= 0) state.popups.splice(i, 1);
        }
      }

      // Smooth lightweight rendering
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#090D16';
      ctx.fillRect(tableLeft, tableTop, tableW, tableH);

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.lineWidth = 6;
      ctx.strokeRect(tableLeft - 1, tableTop - 1, tableW + 2, tableH + 2);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.strokeRect(tableLeft, tableTop, tableW, tableH);

      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tableLeft, centerY);
      ctx.lineTo(tableRight, centerY);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 48, 0, Math.PI * 2);
      ctx.stroke();

      const gLeft = centerX - state.goalWidth / 2;

      ctx.fillStyle = '#EC4899';
      ctx.fillRect(gLeft, tableTop - 2, state.goalWidth, 4);

      ctx.fillStyle = '#06B6D4';
      ctx.fillRect(gLeft, tableBottom - 2, state.goalWidth, 4);

      for (const t of state.puckTrail) {
        ctx.fillStyle = `rgba(250, 204, 21, ${t.alpha * 0.35})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, state.puck.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
      ctx.beginPath();
      ctx.arc(state.puck.x, state.puck.y, state.puck.radius + 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(state.puck.x, state.puck.y, state.puck.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(state.puck.x, state.puck.y, state.puck.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // AI Mallet
      ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
      ctx.beginPath();
      ctx.arc(state.aiMallet.x, state.aiMallet.y, state.aiMallet.radius + 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = state.aiMallet.color;
      ctx.beginPath();
      ctx.arc(state.aiMallet.x, state.aiMallet.y, state.aiMallet.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#141418';
      ctx.beginPath();
      ctx.arc(state.aiMallet.x, state.aiMallet.y, state.aiMallet.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Player Mallet
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.beginPath();
      ctx.arc(state.playerMallet.x, state.playerMallet.y, state.playerMallet.radius + 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = state.playerMallet.color;
      ctx.beginPath();
      ctx.arc(state.playerMallet.x, state.playerMallet.y, state.playerMallet.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#141418';
      ctx.beginPath();
      ctx.arc(state.playerMallet.x, state.playerMallet.y, state.playerMallet.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const pop of state.popups) {
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }

      setHudState((prev) => {
        const tLeft = Math.ceil(state.timeLeft);
        if (
          prev.playerScore === state.playerScore &&
          prev.aiScore === state.aiScore &&
          prev.timeLeft === tLeft &&
          prev.combo === state.combo &&
          prev.difficulty === state.difficulty
        ) {
          return prev;
        }
        return {
          playerScore: state.playerScore,
          aiScore: state.aiScore,
          timeLeft: tLeft,
          combo: state.combo,
          difficulty: state.difficulty,
        };
      });

      return state.isAlive;
    },
  });

  const changeDifficulty = (lvl: DifficultyLevel) => {
    setSelectedDifficulty(lvl);
    gameStateRef.current.difficulty = lvl;
    if (soundEnabled) sounds.playPuckHit();
  };

  const currentConfig = DIFFICULTY_CONFIG[selectedDifficulty];

  return (
    <div
      ref={containerRef}
      id="air-hockey-container"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerCancel={handlePointerCancel}
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none"
    >
      {/* Top HUD */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] flex items-center gap-2 font-mono text-xs font-black backdrop-blur-md">
            <span className="text-cyan-400">YOU: {hudState.playerScore}</span>
            <span className="text-zinc-500">-</span>
            <span className="text-pink-400">AI: {hudState.aiScore}</span>
          </div>

          <div
            className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-zinc-700 font-mono text-xs font-black"
            style={{ color: currentConfig.color }}
          >
            {currentConfig.label} ({currentConfig.multiplierBadge})
          </div>

          {hudState.combo > 1 && (
            <div className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black">
              {hudState.combo}x GOAL STREAK
            </div>
          )}
        </div>

        <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-300 font-mono text-xs font-bold backdrop-blur-md">
          TIME: <span className="text-amber-400 font-black">{hudState.timeLeft}s</span>
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full block cursor-none" />

      {/* Difficulty Selection Pills at Bottom */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1 bg-zinc-900/90 border border-zinc-800 rounded-2xl backdrop-blur-md z-20 pointer-events-auto shadow-2xl">
        {(['EASY', 'MEDIUM', 'HARD'] as DifficultyLevel[]).map((lvl) => {
          const cfg = DIFFICULTY_CONFIG[lvl];
          const isSelected = selectedDifficulty === lvl;
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => changeDifficulty(lvl)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-zinc-800 text-white shadow-md border border-zinc-600'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <span style={{ color: isSelected ? cfg.color : undefined }}>{cfg.label}</span>
              <span className="ml-1 text-[10px] opacity-75">{cfg.multiplierBadge}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
