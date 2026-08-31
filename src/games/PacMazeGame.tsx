import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { Ghost, Zap, Shield, Sparkles, Trophy, Flame } from 'lucide-react';
import { useGameLoop, useSafeTimeout, useRenderPublishedState } from '../hooks/useGameLoop';
import { getFrameInvariantChance } from '../lib/frameRateRuntime';
import {
  advancePacMover,
  getPacDirectionForCode,
  queuePacDirection,
  shouldCapturePacKey,
} from '../lib/pacMazeControls';
import {
  getPacFrightenedDuration,
  getPacGhostMode,
  getPacGhostSpeed,
  getPacGhostTarget,
  type PacGhostMode,
} from '../lib/pacGhostAi';

// Maze Tile Grid Definition
// 1 = Wall, 0 = Dot, 2 = Power Pellet, 3 = Empty/Spawn, 4 = Fruit Spawn, 9 = Gate
const MAZE_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2, 1],
  [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 0, 1, 1, 1, 3, 1, 3, 1, 1, 1, 0, 1, 1, 1, 1],
  [3, 3, 3, 1, 0, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 1, 3, 3, 3],
  [1, 1, 1, 1, 0, 1, 3, 1, 1, 9, 1, 1, 3, 1, 0, 1, 1, 1, 1],
  [3, 3, 3, 3, 0, 3, 3, 1, 3, 3, 3, 1, 3, 3, 0, 3, 3, 3, 3],
  [1, 1, 1, 1, 0, 1, 3, 1, 1, 1, 1, 1, 3, 1, 0, 1, 1, 1, 1],
  [3, 3, 3, 1, 0, 1, 3, 3, 3, 4, 3, 3, 3, 1, 0, 1, 3, 3, 3],
  [1, 1, 1, 1, 0, 1, 3, 1, 1, 1, 1, 1, 3, 1, 0, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
  [1, 2, 0, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 1, 0, 2, 1],
  [1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const COLS = 19;
const ROWS = 22;

interface GhostEntity {
  id: number;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  color: string;
  name: string;
  scatterX: number;
  scatterY: number;
}

export const PacMazeGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const setSafeTimeout = useSafeTimeout();

  const [hudState, setHudState] = useRenderPublishedState({
    score: 0,
    lives: 3,
    powerTime: 0,
    dotsLeft: 0,
    multiplier: 1,
    ghostsEatenStreak: 0,
    level: 1,
    ghostMode: 'SCATTER' as PacGhostMode,
  });

  const gameStateRef = useRef({
    score: 0,
    lives: 3,
    isAlive: true,
    grid: MAZE_MAP.map((r) => [...r]),
    totalDots: 0,
    dotsEaten: 0,
    level: 1,
    levelElapsed: 0,
    ghostMode: 'SCATTER' as PacGhostMode,

    // Player position (in tile coordinates float)
    px: 9,
    py: 16,
    dirX: 0,
    dirY: 0,
    nextDirX: 0,
    nextDirY: 0,
    mouthAngle: 0.2,
    mouthOpening: true,

    // Power Pellet mode
    frightenedTimer: 0,
    ghostsEatenStreak: 0,

    // Fruit
    fruitActive: false,
    fruitTimer: 0,
    fruitType: 'cherry', // cherry, strawberry, star

    // Ghosts
    ghosts: [
      { id: 0, x: 9, y: 10, dirX: 0, dirY: -1, color: '#EF4444', name: 'Blinky', scatterX: 18, scatterY: 0 },
      { id: 1, x: 8, y: 10, dirX: 0, dirY: -1, color: '#EC4899', name: 'Pinky', scatterX: 0, scatterY: 0 },
      { id: 2, x: 10, y: 10, dirX: 0, dirY: -1, color: '#06B6D4', name: 'Inky', scatterX: 18, scatterY: 21 },
      { id: 3, x: 9, y: 11, dirX: 0, dirY: -1, color: '#F97316', name: 'Clyde', scatterX: 0, scatterY: 21 },
    ] as GhostEntity[],

    // Visuals
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[],
    popups: [] as { id: number; x: number; y: number; text: string; color: string; life: number }[],
    nextId: 1,
  });

  // Count dots
  useEffect(() => {
    let dotCount = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (MAZE_MAP[r][c] === 0 || MAZE_MAP[r][c] === 2) {
          dotCount++;
        }
      }
    }
    gameStateRef.current.totalDots = dotCount;
    gameStateRef.current.grid = MAZE_MAP.map((r) => [...r]);
  }, []);

  // Capture desktop controls before browser scrolling or shell-level handlers.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = getPacDirectionForCode(event.code);
      if (!direction || !shouldCapturePacKey(event)) return;

      event.preventDefault();
      const state = gameStateRef.current;
      if (!state.isAlive || isPausedRef.current) return;
      queuePacDirection(state, direction.x, direction.y);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Swipe / Touch Controls
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    touchStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.clientX - touchStartRef.current.x;
    const dy = e.clientY - touchStartRef.current.y;
    const threshold = 18;

    if (Math.hypot(dx, dy) > threshold) {
      const state = gameStateRef.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        queuePacDirection(state, dx > 0 ? 1 : -1, 0);
      } else {
        queuePacDirection(state, 0, dy > 0 ? 1 : -1);
      }
      touchStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerUp = () => {
    touchStartRef.current = null;
  };

  // Main Loop
  const isWall = (r: number, c: number) => {
    // Warp tunnel wrap
    if (c < 0 || c >= COLS) return false;
    if (r < 0 || r >= ROWS) return true;
    return gameStateRef.current.grid[r][c] === 1 || gameStateRef.current.grid[r][c] === 9;
  };

  const isGhostWall = (r: number, c: number) => {
    if (c < 0 || c >= COLS) return false;
    if (r < 0 || r >= ROWS) return true;
    return gameStateRef.current.grid[r][c] === 1;
  };

  useGameLoop({
    canvasRef,
    isPaused,
    onUpdate: (ctx, dt, w, h) => {
      const state = gameStateRef.current;

      ctx.clearRect(0, 0, w, h);

      // Tile scaling to fit canvas with padding
      const tileSize = Math.min((w - 20) / COLS, (h - 20) / ROWS);
      const offsetX = (w - COLS * tileSize) / 2;
      const offsetY = (h - ROWS * tileSize) / 2;

      if (!isPausedRef.current && state.isAlive) {
        state.levelElapsed += dt;
        const nextGhostMode = getPacGhostMode(state.levelElapsed, state.level);
        if (nextGhostMode !== state.ghostMode) {
          state.ghostMode = nextGhostMode;
          for (const ghost of state.ghosts) {
            ghost.dirX *= -1;
            ghost.dirY *= -1;
          }
        }

        // Mouth animation
        if (state.mouthOpening) {
          state.mouthAngle += dt * 4;
          if (state.mouthAngle >= 0.45) state.mouthOpening = false;
        } else {
          state.mouthAngle -= dt * 4;
          if (state.mouthAngle <= 0.05) state.mouthOpening = true;
        }

        // Frightened timer
        if (state.frightenedTimer > 0) {
          state.frightenedTimer -= dt;
          if (state.frightenedTimer <= 0) {
            state.ghostsEatenStreak = 0;
          }
        }

        // Fruit logic
        if (!state.fruitActive && state.dotsEaten > 30 && Math.random() < getFrameInvariantChance(0.003, dt * 60)) {
          state.fruitActive = true;
          state.fruitTimer = 10;
        }
        if (state.fruitActive) {
          state.fruitTimer -= dt;
          if (state.fruitTimer <= 0) state.fruitActive = false;
        }

        // Movement is tile-center based rather than threshold based. Inputs are
        // buffered until the next valid intersection, while opposite directions
        // reverse immediately even between tile centers.
        const playerSpeedTilesPerSecond = state.frightenedTimer > 0 ? 5.6 : 5.0;
        advancePacMover(
          state,
          playerSpeedTilesPerSecond * dt,
          isWall,
          COLS,
        );

        // Eat dots & power pellets
        const pCol = Math.round(state.px);
        const pRow = Math.round(state.py);
        if (pCol >= 0 && pCol < COLS && pRow >= 0 && pRow < ROWS) {
          const tile = state.grid[pRow][pCol];
          if (tile === 0) {
            // Normal dot
            state.grid[pRow][pCol] = 3;
            state.dotsEaten++;
            state.score += 10;
            onScoreUpdate(state.score);
            if (soundEnabled && state.dotsEaten % 2 === 0) sounds.playChomp();

            // Spawn micro particle
            state.particles.push({
              x: offsetX + (pCol + 0.5) * tileSize,
              y: offsetY + (pRow + 0.5) * tileSize,
              vx: (Math.random() - 0.5) * 40,
              vy: (Math.random() - 0.5) * 40,
              life: 0.3,
              color: '#FACC15',
              size: 2,
            });
          } else if (tile === 2) {
            // Power pellet!
            state.grid[pRow][pCol] = 3;
            state.dotsEaten++;
            state.score += 100;
            state.frightenedTimer = getPacFrightenedDuration(state.level);
            state.ghostsEatenStreak = 0;
            onScoreUpdate(state.score);
            if (soundEnabled) sounds.playPowerUp();

            // Big particle burst
            for (let i = 0; i < 16; i++) {
              const ang = Math.random() * Math.PI * 2;
              state.particles.push({
                x: offsetX + (pCol + 0.5) * tileSize,
                y: offsetY + (pRow + 0.5) * tileSize,
                vx: Math.cos(ang) * (Math.random() * 80 + 30),
                vy: Math.sin(ang) * (Math.random() * 80 + 30),
                life: 0.5,
                color: '#38BDF8',
                size: 3.5,
              });
            }

            state.popups.push({
              id: state.nextId++,
              x: offsetX + (pCol + 0.5) * tileSize,
              y: offsetY + (pRow + 0.5) * tileSize - 10,
              text: 'POWER CHARGE!',
              color: '#38BDF8',
              life: 1.0,
            });
          }

          // Check Fruit eating
          if (state.fruitActive && pRow === 12 && pCol === 9) {
            state.fruitActive = false;
            const fruitPts = 500;
            state.score += fruitPts;
            onScoreUpdate(state.score);
            if (soundEnabled) sounds.playFeverMode();
            state.popups.push({
              id: state.nextId++,
              x: offsetX + (pCol + 0.5) * tileSize,
              y: offsetY + (pRow + 0.5) * tileSize - 12,
              text: `+${fruitPts} CHERRY!`,
              color: '#F43F5E',
              life: 1.2,
            });
          }

          // Check all dots cleared (Win / Next stage refill)
          if (state.dotsEaten >= state.totalDots) {
            state.score += 2000;
            onScoreUpdate(state.score);
            if (soundEnabled) sounds.playSuccess();
            state.grid = MAZE_MAP.map((r) => [...r]);
            state.dotsEaten = 0;
            state.level++;
            state.levelElapsed = 0;
            state.ghostMode = 'SCATTER';
            state.frightenedTimer = 0;
            state.ghostsEatenStreak = 0;
            state.px = 9;
            state.py = 16;
            state.dirX = 0;
            state.dirY = 0;
            state.nextDirX = 0;
            state.nextDirY = 0;
            state.ghosts.forEach((ghost, index) => {
              const starts = [[9, 10], [8, 10], [10, 10], [9, 11]] as const;
              ghost.x = starts[index][0];
              ghost.y = starts[index][1];
              ghost.dirX = 0;
              ghost.dirY = -1;
            });
          }
        }

        // Ghost AI Movement
        const isFrightened = state.frightenedTimer > 0;
        const ghostSpeed = getPacGhostSpeed(state.level, isFrightened) * dt;

        for (const ghost of state.ghosts) {
          const gCol = Math.round(ghost.x);
          const gRow = Math.round(ghost.y);

          // Decision at intersection
          const alignedGX = Math.abs(ghost.x - gCol) < 0.12;
          const alignedGY = Math.abs(ghost.y - gRow) < 0.12;

          if (alignedGX && alignedGY) {
            ghost.x = gCol;
            ghost.y = gRow;

            // Each ghost keeps a distinct chase personality; global scatter windows
            // periodically break pursuit and create route-planning opportunities.
            let targetX: number;
            let targetY: number;
            if (isFrightened) {
              targetX = Math.random() * COLS;
              targetY = Math.random() * ROWS;
            } else {
              const target = getPacGhostTarget(ghost, state.ghosts, state, state.ghostMode);
              targetX = target.x;
              targetY = target.y;
            }

            // Available moves (cannot reverse 180 directly)
            const directions = [
              { dx: 0, dy: -1 },
              { dx: 0, dy: 1 },
              { dx: -1, dy: 0 },
              { dx: 1, dy: 0 },
            ].filter((dir) => {
              // No reverse
              if (dir.dx === -ghost.dirX && dir.dy === -ghost.dirY) return false;
              return !isGhostWall(gRow + dir.dy, gCol + dir.dx);
            });

            if (directions.length > 0) {
              // Pick direction closest to target
              let bestDir = directions[0];
              let bestDist = Infinity;

              for (const d of directions) {
                const nx = gCol + d.dx;
                const ny = gRow + d.dy;
                const dist = Math.hypot(nx - targetX, ny - targetY);
                if (dist < bestDist) {
                  bestDist = dist;
                  bestDir = d;
                }
              }
              ghost.dirX = bestDir.dx;
              ghost.dirY = bestDir.dy;
            }
          }

          // Move ghost
          ghost.x += ghost.dirX * ghostSpeed;
          ghost.y += ghost.dirY * ghostSpeed;

          // Wrap tunnel
          if (ghost.x < -0.5) ghost.x = COLS - 0.5;
          else if (ghost.x > COLS - 0.5) ghost.x = -0.5;

          // Collision with Player
          const distToPlayer = Math.hypot(ghost.x - state.px, ghost.y - state.py);
          if (distToPlayer < 0.75) {
            if (isFrightened) {
              // Ghost eaten!
              ghost.x = 9;
              ghost.y = 10;
              ghost.dirX = 0;
              ghost.dirY = -1;
              state.ghostsEatenStreak++;
              const pts = 200 * Math.pow(2, state.ghostsEatenStreak - 1);
              state.score += pts;
              onScoreUpdate(state.score);
              if (soundEnabled) sounds.playDroneDestroy();

              state.popups.push({
                id: state.nextId++,
                x: offsetX + (ghost.x + 0.5) * tileSize,
                y: offsetY + (ghost.y + 0.5) * tileSize - 10,
                text: `+${pts}`,
                color: '#38BDF8',
                life: 1.2,
              });
            } else {
              // Player caught!
              state.lives--;
              if (soundEnabled) sounds.playExplosion();

              if (state.lives <= 0) {
                state.isAlive = false;
                setSafeTimeout(() => onGameOver(state.score), 400);
              } else {
                // Reset positions
                state.px = 9;
                state.py = 16;
                state.dirX = 0;
                state.dirY = 0;
                state.nextDirX = 0;
                state.nextDirY = 0;
                state.ghosts[0].x = 9;
                state.ghosts[0].y = 10;
                state.ghosts[1].x = 8;
                state.ghosts[1].y = 10;
                state.ghosts[2].x = 10;
                state.ghosts[2].y = 10;
                state.ghosts[3].x = 9;
                state.ghosts[3].y = 11;
              }
            }
          }
        }

        // Update Particles
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) state.particles.splice(i, 1);
        }

        // Update Popups
        for (let i = state.popups.length - 1; i >= 0; i--) {
          const pop = state.popups[i];
          pop.y -= 25 * dt;
          pop.life -= dt;
          if (pop.life <= 0) state.popups.splice(i, 1);
        }
      }

      // ==========================================
      // RENDER NEON MAZE
      // ==========================================
      // Background
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);

      // Draw Walls
      ctx.lineWidth = tileSize * 0.22;
      ctx.strokeStyle = '#3B82F6';

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = state.grid[r][c];
          const cx = offsetX + c * tileSize;
          const cy = offsetY + r * tileSize;

          if (cell === 1) {
            ctx.fillStyle = '#1E3A8A';
            ctx.fillRect(cx + 1, cy + 1, tileSize - 2, tileSize - 2);
            ctx.strokeRect(cx + 2, cy + 2, tileSize - 4, tileSize - 4);
          } else if (cell === 9) {
            // Ghost gate
            ctx.fillStyle = '#EC4899';
            ctx.fillRect(cx + 2, cy + tileSize * 0.4, tileSize - 4, tileSize * 0.2);
          } else if (cell === 0) {
            // Dot
            ctx.fillStyle = '#FACC15';
            ctx.beginPath();
            ctx.arc(cx + tileSize / 2, cy + tileSize / 2, tileSize * 0.14, 0, Math.PI * 2);
            ctx.fill();
          } else if (cell === 2) {
            // Power Pellet
            const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.2;
            ctx.fillStyle = '#38BDF8';
            ctx.beginPath();
            ctx.arc(cx + tileSize / 2, cy + tileSize / 2, tileSize * 0.35 * pulse, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw Fruit
      if (state.fruitActive) {
        const fx = offsetX + (9 + 0.5) * tileSize;
        const fy = offsetY + (12 + 0.5) * tileSize;
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(fx - 3, fy, 5, 0, Math.PI * 2);
        ctx.arc(fx + 3, fy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fx, fy - 3);
        ctx.lineTo(fx, fy - 8);
        ctx.stroke();
      }

      // Draw Ghosts
      const isFrightened = state.frightenedTimer > 0;
      for (const ghost of state.ghosts) {
        const gx = offsetX + (ghost.x + 0.5) * tileSize;
        const gy = offsetY + (ghost.y + 0.5) * tileSize;
        const gRad = tileSize * 0.44;

        ctx.save();
        const ghostColor = isFrightened
          ? state.frightenedTimer < 2 && Math.sin(performance.now() * 0.02) > 0
            ? '#FFFFFF'
            : '#0284C7'
          : ghost.color;

        ctx.fillStyle = ghostColor;
        ctx.shadowColor = ghostColor;
        ctx.shadowBlur = 10;

        // Ghost body Dome
        ctx.beginPath();
        ctx.arc(gx, gy - 2, gRad, Math.PI, 0, false);
        ctx.lineTo(gx + gRad, gy + gRad * 0.8);
        // Tentacles
        ctx.lineTo(gx + gRad * 0.33, gy + gRad * 0.4);
        ctx.lineTo(gx, gy + gRad * 0.8);
        ctx.lineTo(gx - gRad * 0.33, gy + gRad * 0.4);
        ctx.lineTo(gx - gRad, gy + gRad * 0.8);
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(gx - 4, gy - 4, 3.5, 0, Math.PI * 2);
        ctx.arc(gx + 4, gy - 4, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isFrightened ? '#EF4444' : '#1E293B';
        ctx.beginPath();
        ctx.arc(gx - 4 + ghost.dirX * 1.5, gy - 4 + ghost.dirY * 1.5, 1.8, 0, Math.PI * 2);
        ctx.arc(gx + 4 + ghost.dirX * 1.5, gy - 4 + ghost.dirY * 1.5, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Draw Player (Pac Eater)
      if (state.isAlive) {
        const px = offsetX + (state.px + 0.5) * tileSize;
        const py = offsetY + (state.py + 0.5) * tileSize;
        const pRad = tileSize * 0.45;

        // Angle orientation
        let baseAngle = 0;
        if (state.dirX === 1) baseAngle = 0;
        else if (state.dirX === -1) baseAngle = Math.PI;
        else if (state.dirY === 1) baseAngle = Math.PI / 2;
        else if (state.dirY === -1) baseAngle = -Math.PI / 2;

        ctx.save();
        ctx.fillStyle = '#FACC15';
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 14;

        ctx.beginPath();
        ctx.arc(
          px,
          py,
          pRad,
          baseAngle + state.mouthAngle * Math.PI,
          baseAngle + (2 - state.mouthAngle) * Math.PI,
          false
        );
        ctx.lineTo(px, py);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Render Particles
      for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Popups
      for (const pop of state.popups) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pop.life);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = pop.color;
        ctx.shadowBlur = 8;
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }

      // Update React HUD state (throttled)
      setHudState((prev) => {
        const pTime = Math.ceil(state.frightenedTimer);
        const dLeft = state.totalDots - state.dotsEaten;
        const mult = state.ghostsEatenStreak > 0 ? Math.pow(2, state.ghostsEatenStreak) : 1;
        if (
          prev.score === state.score &&
          prev.lives === state.lives &&
          prev.powerTime === pTime &&
          prev.dotsLeft === dLeft &&
          prev.multiplier === mult &&
          prev.ghostsEatenStreak === state.ghostsEatenStreak &&
          prev.level === state.level &&
          prev.ghostMode === state.ghostMode
        ) {
          return prev;
        }
        return {
          score: state.score,
          lives: state.lives,
          powerTime: pTime,
          dotsLeft: dLeft,
          multiplier: mult,
          ghostsEatenStreak: state.ghostsEatenStreak,
          level: state.level,
          ghostMode: state.ghostMode,
        };
      });

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="pacmaze-game-container"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none"
    >
      {/* Top HUD Display */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-sky-300 font-mono text-[10px] font-black backdrop-blur-md">
            LEVEL {hudState.level} · {hudState.ghostMode}
          </div>

          {/* Lives */}
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] flex items-center gap-1 text-amber-400 font-mono text-xs font-black backdrop-blur-md">
            <span>LIVES:</span>
            {Array.from({ length: hudState.lives }).map((_, i) => (
              <span key={i} className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
            ))}
          </div>

          {hudState.powerTime > 0 && (
            <div className="px-2.5 py-1 rounded-xl bg-sky-500/25 border border-sky-500 text-sky-300 font-mono text-xs font-bold flex items-center gap-1 animate-pulse">
              <Zap className="w-3.5 h-3.5" />
              <span>POWER: {hudState.powerTime}s</span>
            </div>
          )}
        </div>

        <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-400 font-mono text-xs font-bold backdrop-blur-md">
          DOTS: <span className="text-white">{hudState.dotsLeft}</span>
        </div>
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
