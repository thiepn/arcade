import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';

type LaneType = 'grass' | 'road' | 'train' | 'river';

interface Vehicle {
  x: number;
  w: number;
  speed: number;
  color: string;
}

interface RiverLog {
  x: number;
  w: number;
  speed: number;
}

interface Lane {
  id: number;
  rowY: number;
  type: LaneType;
  direction: 1 | -1;
  speed: number;
  vehicles: Vehicle[];
  logs: RiverLog[];
  trainActive?: boolean;
  trainWarning?: boolean;
  trainTimer?: number;
  coins: { col: number; collected: boolean }[];
}

export const RoadCrossGame: React.FC<GameComponentProps> = ({
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
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const [hudState, setHudState] = useState({
    score: 0,
    distance: 0,
    combo: 0,
    multiplier: 1,
  });

  const COLS_COUNT = 9;
  const TILE_SIZE = 46;

  const gameStateRef = useRef({
    col: 4,
    row: 0,
    playerX: 4 * 46,
    playerY: 0,
    jumpProgress: 1,
    jumpHeight: 0,
    isAlive: true,
    facing: 'up' as 'up' | 'down' | 'left' | 'right',

    maxRowReached: 0,
    score: 0,
    cameraY: 0,
    laserRow: -7,
    laserSpeed: 0.7,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,

    lanes: [] as Lane[],
    highestLaneRow: 0,
    popups: [] as { id: number; x: number; y: number; text: string; color: string; life: number }[],
    nextId: 1,
    width: 420,
    height: 500,
  });

  const triggerMove = (dCol: number, dRow: number) => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    // Strict 1-block discrete movements
    const targetCol = Math.max(0, Math.min(COLS_COUNT - 1, state.col + dCol));
    const targetRow = Math.max(0, state.row + dRow);

    if (dRow > 0) state.facing = 'up';
    else if (dRow < 0) state.facing = 'down';
    else if (dCol > 0) state.facing = 'right';
    else if (dCol < 0) state.facing = 'left';

    state.col = targetCol;
    state.row = targetRow;
    state.jumpProgress = 0;

    if (soundEnabled) sounds.playHop();

    if (dRow > 0) {
      state.combo++;
      state.comboTimer = 2.0;
      if (state.combo >= 20) state.multiplier = 4;
      else if (state.combo >= 10) state.multiplier = 3;
      else if (state.combo >= 4) state.multiplier = 2;
      else state.multiplier = 1;

      if (state.row > state.maxRowReached) {
        const delta = state.row - state.maxRowReached;
        state.maxRowReached = state.row;
        state.score += delta * 20 * state.multiplier;
        onScoreUpdate(state.score);
      }
    }
  };

  // Keyboard controls: Arrow keys and WASD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        e.preventDefault();
        triggerMove(0, 1); // 1 block forward
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        triggerMove(0, -1); // 1 block backward
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        triggerMove(-1, 0); // 1 block left only
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        triggerMove(1, 0); // 1 block right only
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Unified pointer navigation: short press = contextual tap, swipe = cardinal move.
  const handleTapAt = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const boardWidth = COLS_COUNT * TILE_SIZE;
    const offsetX = (rect.width - boardWidth) / 2;
    const playerScreenX = offsetX + gameStateRef.current.col * TILE_SIZE + TILE_SIZE / 2;

    if (clickY > rect.height * 0.75 && Math.abs(clickX - playerScreenX) < 40) {
      triggerMove(0, -1);
    } else if (clickX < playerScreenX - 35) {
      triggerMove(-1, 0);
    } else if (clickX > playerScreenX + 35) {
      triggerMove(1, 0);
    } else {
      triggerMove(0, 1);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const startPoint = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!startPoint) {
      handleTapAt(e.clientX, e.clientY);
      return;
    }

    const dx = e.clientX - startPoint.x;
    const dy = e.clientY - startPoint.y;
    const threshold = 24;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) {
      handleTapAt(e.clientX, e.clientY);
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) triggerMove(dx > 0 ? 1 : -1, 0);
    else triggerMove(0, dy < 0 ? 1 : -1);
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
  };

  const generateLanesUpTo = (targetRow: number) => {
    const state = gameStateRef.current;
    while (state.highestLaneRow < targetRow) {
      const nextRow = state.highestLaneRow + 1;
      let type: LaneType = 'road';
      const rand = Math.random();

      if (nextRow <= 3) {
        type = 'grass';
      } else if (rand < 0.3) {
        type = 'grass';
      } else if (rand < 0.65) {
        type = 'road';
      } else if (rand < 0.85) {
        type = 'river';
      } else {
        type = 'train';
      }

      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const speed = (Math.random() * 60 + 65) * dir;
      const vehicles: Vehicle[] = [];
      const logs: RiverLog[] = [];
      const coins: { col: number; collected: boolean }[] = [];

      if (type === 'road') {
        const colors = ['#F43F5E', '#38BDF8', '#FACC15', '#A855F7'];
        const vCount = Math.floor(Math.random() * 2) + 2;
        for (let i = 0; i < vCount; i++) {
          vehicles.push({
            x: i * 220 + Math.random() * 50,
            w: 55,
            speed,
            color: colors[Math.floor(Math.random() * colors.length)],
          });
        }
      }

      if (type === 'river') {
        const logCount = 3;
        for (let i = 0; i < logCount; i++) {
          logs.push({
            x: i * 160 + Math.random() * 30,
            w: 85,
            speed: speed * 0.7,
          });
        }
      }

      if (Math.random() < 0.35) {
        coins.push({
          col: Math.floor(Math.random() * COLS_COUNT),
          collected: false,
        });
      }

      state.lanes.push({
        id: state.nextId++,
        rowY: nextRow,
        type,
        direction: dir,
        speed,
        vehicles,
        logs,
        trainActive: false,
        trainWarning: false,
        trainTimer: Math.random() * 3 + 2.5,
        coins,
      });

      state.highestLaneRow = nextRow;
    }
  };

  useEffect(() => {
    const state = gameStateRef.current;
    state.col = 4;
    state.row = 0;
    state.playerX = 4 * TILE_SIZE;
    state.playerY = 0;
    state.isAlive = true;
    state.maxRowReached = 0;
    state.score = 0;
    state.cameraY = 0;
    state.laserRow = -7;
    state.combo = 0;
    state.multiplier = 1;
    state.lanes = [];
    state.highestLaneRow = 0;
    state.popups = [];

    // Pre-populate negative starting buffer lanes as peaceful cyber grass
    for (let r = -6; r <= 0; r++) {
      state.lanes.push({
        id: state.nextId++,
        rowY: r,
        type: 'grass',
        direction: 1,
        speed: 0,
        vehicles: [],
        logs: [],
        coins: [],
      });
    }
    state.highestLaneRow = 0;
    generateLanesUpTo(25);
  }, []);

  useGameLoop({
    canvasRef,
    isPaused,
    onResize: (w, h) => {
      gameStateRef.current.width = w;
      gameStateRef.current.height = h;
    },
    onUpdate: (ctx, deltaSec, w, h) => {
      const dt = Math.min(deltaSec, 0.05);
      const state = gameStateRef.current;
      state.width = w;
      state.height = h;

      ctx.clearRect(0, 0, w, h);

      const boardWidth = COLS_COUNT * TILE_SIZE;
      const offsetX = (w - boardWidth) / 2;

      if (!isPausedRef.current && state.isAlive) {
        // Combo decay
        if (state.comboTimer > 0) {
          state.comboTimer -= dt;
          if (state.comboTimer <= 0) {
            state.combo = 0;
            state.multiplier = 1;
          }
        }

        // Jump animation
        if (state.jumpProgress < 1) {
          state.jumpProgress = Math.min(1, state.jumpProgress + dt * 9);
          state.jumpHeight = Math.sin(state.jumpProgress * Math.PI) * 14;
        } else {
          state.jumpHeight = 0;
        }

        // Smooth visual position lerp
        const targetX = state.col * TILE_SIZE;
        const targetY = state.row * TILE_SIZE;
        state.playerX += (targetX - state.playerX) * 0.4;
        state.playerY += (targetY - state.playerY) * 0.4;

        // Camera follow
        const targetCamY = state.playerY - h * 0.35;
        state.cameraY += (targetCamY - state.cameraY) * 0.12;

        // Laser creeping
        state.laserSpeed = Math.min(2.0, 0.7 + state.maxRowReached * 0.015);
        state.laserRow += state.laserSpeed * dt;

        generateLanesUpTo(state.row + 16);

        const currentLane = state.lanes.find((l) => l.rowY === state.row);
        const playerCenterX = state.playerX + TILE_SIZE / 2;
        let isSafeOnLog = false;

        for (const lane of state.lanes) {
          // Update Road Vehicles
          for (const v of lane.vehicles) {
            v.x += v.speed * dt;
            if (v.speed > 0 && v.x > boardWidth + 80) v.x = -v.w - 40;
            else if (v.speed < 0 && v.x < -v.w - 40) v.x = boardWidth + 40;

            // Collision check only when grounded in this lane
            if (lane.rowY === state.row && state.jumpProgress > 0.8) {
              const carLeft = v.x + 4;
              const carRight = v.x + v.w - 4;
              if (playerCenterX > carLeft && playerCenterX < carRight) {
                state.isAlive = false;
                if (soundEnabled) sounds.playExplosion();
                setSafeTimeout(() => onGameOver(state.score), 400);
              }
            }
          }

          // Update River Logs
          for (const log of lane.logs) {
            log.x += log.speed * dt;
            if (log.speed > 0 && log.x > boardWidth + 80) log.x = -log.w - 40;
            else if (log.speed < 0 && log.x < -log.w - 40) log.x = boardWidth + 40;

            if (lane.rowY === state.row) {
              const logLeft = log.x - 4;
              const logRight = log.x + log.w + 4;
              if (playerCenterX >= logLeft && playerCenterX <= logRight) {
                isSafeOnLog = true;
                // Move with log smoothly
                if (state.jumpProgress >= 0.9) {
                  const shiftedX = state.playerX + log.speed * dt;
                  const clampedCol = Math.max(0, Math.min(COLS_COUNT - 1, Math.round(shiftedX / TILE_SIZE)));
                  state.col = clampedCol;
                }
              }
            }
          }

          // Update Hyper Trains
          if (lane.type === 'train') {
            lane.trainTimer! -= dt;
            if (lane.trainTimer! <= 1.0 && lane.trainTimer! > 0) {
              lane.trainWarning = true;
            } else if (lane.trainTimer! <= 0 && lane.trainTimer! > -1.0) {
              lane.trainWarning = false;
              lane.trainActive = true;

              if (lane.rowY === state.row && state.jumpProgress > 0.6) {
                state.isAlive = false;
                if (soundEnabled) sounds.playExplosion();
                setSafeTimeout(() => onGameOver(state.score), 400);
              }
            } else if (lane.trainTimer! <= -1.0) {
              lane.trainActive = false;
              lane.trainTimer = Math.random() * 4 + 3.0;
            }
          }

          // Collect Coins
          for (const coin of lane.coins) {
            if (!coin.collected && lane.rowY === state.row && coin.col === state.col) {
              coin.collected = true;
              const coinPts = 150 * state.multiplier;
              state.score += coinPts;
              onScoreUpdate(state.score);
              if (soundEnabled) sounds.playScore();

              state.popups.push({
                id: state.nextId++,
                x: offsetX + (coin.col + 0.5) * TILE_SIZE,
                y: h - (lane.rowY * TILE_SIZE - state.cameraY) - 10,
                text: `+${coinPts}`,
                color: '#FACC15',
                life: 0.8,
              });
            }
          }
        }

        // River Drowning Check (only when fully landed)
        if (currentLane && currentLane.type === 'river' && !isSafeOnLog && state.jumpProgress >= 0.95) {
          state.isAlive = false;
          if (soundEnabled) sounds.playPop();
          setSafeTimeout(() => onGameOver(state.score), 400);
        }

        // Laser field catch up
        if (state.row <= state.laserRow) {
          state.isAlive = false;
          if (soundEnabled) sounds.playExplosion();
          setSafeTimeout(() => onGameOver(state.score), 400);
        }

        // Popups decay
        for (let i = state.popups.length - 1; i >= 0; i--) {
          const pop = state.popups[i];
          pop.y -= 25 * dt;
          pop.life -= dt;
          if (pop.life <= 0) state.popups.splice(i, 1);
        }
      }

      // ==========================================
      // LIGHTWEIGHT HIGH-FPS RENDER
      // ==========================================
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);

      const toScreenY = (rowY: number) => {
        return h - (rowY * TILE_SIZE - state.cameraY) - TILE_SIZE;
      };

      // Draw Lanes
      for (const lane of state.lanes) {
        const sy = toScreenY(lane.rowY);
        if (sy < -60 || sy > h + 60) continue;

        if (lane.type === 'grass') {
          ctx.fillStyle = '#064E3B';
          ctx.fillRect(offsetX, sy, boardWidth, TILE_SIZE);
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 1;
          ctx.strokeRect(offsetX, sy, boardWidth, TILE_SIZE);
        } else if (lane.type === 'road') {
          ctx.fillStyle = '#18181B';
          ctx.fillRect(offsetX, sy, boardWidth, TILE_SIZE);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          for (let d = 0; d < boardWidth; d += 40) {
            ctx.fillRect(offsetX + d, sy + TILE_SIZE / 2 - 1, 20, 2);
          }
        } else if (lane.type === 'river') {
          ctx.fillStyle = '#0C4A6E';
          ctx.fillRect(offsetX, sy, boardWidth, TILE_SIZE);
          ctx.fillStyle = '#0284C7';
          ctx.fillRect(offsetX, sy + 2, boardWidth, 2);
        } else if (lane.type === 'train') {
          ctx.fillStyle = '#27272A';
          ctx.fillRect(offsetX, sy, boardWidth, TILE_SIZE);

          ctx.strokeStyle = '#71717A';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(offsetX, sy + 8);
          ctx.lineTo(offsetX + boardWidth, sy + 8);
          ctx.moveTo(offsetX, sy + TILE_SIZE - 8);
          ctx.lineTo(offsetX + boardWidth, sy + TILE_SIZE - 8);
          ctx.stroke();

          if (lane.trainWarning) {
            const flash = Math.sin(performance.now() * 0.03) > 0;
            ctx.fillStyle = flash ? '#EF4444' : '#7F1D1D';
            ctx.beginPath();
            ctx.arc(offsetX - 10, sy + TILE_SIZE / 2, 5, 0, Math.PI * 2);
            ctx.arc(offsetX + boardWidth + 10, sy + TILE_SIZE / 2, 5, 0, Math.PI * 2);
            ctx.fill();
          }

          if (lane.trainActive) {
            ctx.fillStyle = '#EF4444';
            ctx.fillRect(offsetX, sy + 4, boardWidth, TILE_SIZE - 8);
          }
        }

        // River Logs
        for (const log of lane.logs) {
          ctx.fillStyle = '#0284C7';
          ctx.fillRect(offsetX + log.x, sy + 6, log.w, TILE_SIZE - 12);
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(offsetX + log.x, sy + 6, log.w, TILE_SIZE - 12);
        }

        // Vehicles
        for (const v of lane.vehicles) {
          ctx.fillStyle = v.color;
          ctx.fillRect(offsetX + v.x, sy + 8, v.w, TILE_SIZE - 16);
          ctx.strokeStyle = '#FFFFFF44';
          ctx.lineWidth = 1;
          ctx.strokeRect(offsetX + v.x, sy + 8, v.w, TILE_SIZE - 16);

          ctx.fillStyle = '#FFFFFF';
          if (v.speed > 0) {
            ctx.fillRect(offsetX + v.x + v.w - 4, sy + 10, 3, 3);
            ctx.fillRect(offsetX + v.x + v.w - 4, sy + TILE_SIZE - 19, 3, 3);
          } else {
            ctx.fillRect(offsetX + v.x + 1, sy + 10, 3, 3);
            ctx.fillRect(offsetX + v.x + 1, sy + TILE_SIZE - 19, 3, 3);
          }
        }

        // Coins
        for (const coin of lane.coins) {
          if (coin.collected) continue;
          const cx = offsetX + (coin.col + 0.5) * TILE_SIZE;
          const cy = sy + TILE_SIZE / 2;
          ctx.fillStyle = '#FACC15';
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Player Cyber Bot
      if (state.isAlive) {
        const psx = offsetX + state.playerX + TILE_SIZE / 2;
        const psy = toScreenY(state.playerY / TILE_SIZE) + TILE_SIZE / 2 - state.jumpHeight;

        ctx.save();
        ctx.translate(psx, psy);

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, state.jumpHeight + 10, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bot Body
        ctx.fillStyle = '#10B981';
        ctx.fillRect(-10, -10, 20, 20);
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-10, -10, 20, 20);

        // Eyes Visor
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-7, -6, 14, 7);

        ctx.fillStyle = '#047857';
        ctx.beginPath();
        ctx.arc(-2, -3, 1.5, 0, Math.PI * 2);
        ctx.arc(2, -3, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Laser Death Line
      const laserSY = toScreenY(state.laserRow);
      if (laserSY < h + 80) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.fillRect(0, laserSY, w, h - laserSY);
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, laserSY);
        ctx.lineTo(w, laserSY);
        ctx.stroke();
      }

      // Popups
      for (const pop of state.popups) {
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }

      // Sync HUD
      setHudState((prev) => {
        if (
          prev.score === state.score &&
          prev.distance === state.maxRowReached &&
          prev.combo === state.combo &&
          prev.multiplier === state.multiplier
        ) {
          return prev;
        }
        return {
          score: state.score,
          distance: state.maxRowReached,
          combo: state.combo,
          multiplier: state.multiplier,
        };
      });

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="road-cross-container"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="relative w-full h-full min-h-[440px] flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none cursor-pointer"
    >
      {/* Top HUD */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-emerald-400 font-mono text-xs font-black backdrop-blur-md">
            ROW: {hudState.distance}
          </div>

          {hudState.multiplier > 1 && (
            <div className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black">
              {hudState.multiplier}x MULTIPLIER
            </div>
          )}
        </div>

        {hudState.combo > 0 && (
          <div className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold">
            STREAK: {hudState.combo}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* On-screen Directional Touch Controls for mobile & tablet */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-auto z-10">
        {/* Left & Right lateral movement */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerMove(-1, 0); // 1 block left only
            }}
            className="w-13 h-12 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center active:scale-95 shadow-lg cursor-pointer"
            aria-label="Move Left"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerMove(1, 0); // 1 block right only
            }}
            className="w-13 h-12 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center active:scale-95 shadow-lg cursor-pointer"
            aria-label="Move Right"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Backward & Forward (1 block) */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerMove(0, -1); // 1 block backward
            }}
            className="w-12 h-12 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center active:scale-95 shadow-lg cursor-pointer"
            aria-label="Move Backward"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerMove(0, 1); // 1 block forward
            }}
            className="px-5 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black flex items-center justify-center gap-1 active:scale-95 shadow-lg shadow-emerald-500/30 cursor-pointer"
            aria-label="Move Forward 1 Block"
          >
            <ArrowUp className="w-5 h-5" />
            <span className="font-mono text-xs font-black">FORWARD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
