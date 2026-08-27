import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { RotateCw, ArrowDown, ArrowLeft, ArrowRight, ChevronsDown, Zap, Trophy } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 22;

type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

const SHAPES: Record<TetrominoType, { shape: number[][]; color: string }> = {
  I: { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: '#06B6D4' },
  J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: '#3B82F6' },
  L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: '#F97316' },
  O: { shape: [[1, 1], [1, 1]], color: '#FACC15' },
  S: { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: '#10B981' },
  T: { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: '#A855F7' },
  Z: { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: '#EF4444' },
};

const TETROMINO_KEYS: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

interface ActivePiece {
  type: TetrominoType;
  matrix: number[][];
  x: number;
  y: number;
  color: string;
}

export const BlockDropGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(isPaused);
  const setSafeTimeout = useSafeTimeout();
  isPausedRef.current = isPaused;

  const [hudState, setHudState] = useState({
    score: 0,
    lines: 0,
    level: 1,
    nextType: 'T' as TetrominoType,
  });

  const gameStateRef = useRef({
    score: 0,
    lines: 0,
    level: 1,
    isAlive: true,
    hasDrawnPaused: false,

    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)) as (string | null)[][],
    currentPiece: null as ActivePiece | null,
    nextPieceType: 'T' as TetrominoType,
    dropTimer: 0,
    dropInterval: 0.8, // sec per step
    lockTimer: 0, // Lock delay timer for spin-slotting
    lockResets: 0,
    lastHudSync: 0,

    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[],
    popups: [] as { id: number; x: number; y: number; text: string; color: string; life: number }[],
    nextId: 1,
  });

  const getRandomPieceType = (): TetrominoType => {
    return TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)];
  };

  const spawnPiece = (type: TetrominoType): ActivePiece => {
    const data = SHAPES[type];
    return {
      type,
      matrix: data.shape.map((row) => [...row]),
      x: Math.floor(COLS / 2) - Math.floor(data.shape[0].length / 2),
      y: 0,
      color: data.color,
    };
  };

  const collides = (piece: ActivePiece, offX = 0, offY = 0, testMatrix?: number[][]) => {
    const matrix = testMatrix || piece.matrix;
    const grid = gameStateRef.current.grid;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const gx = piece.x + c + offX;
          const gy = piece.y + r + offY;

          if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
          if (gy >= 0 && grid[gy][gx]) return true;
        }
      }
    }
    return false;
  };

  const rotateMatrix = (matrix: number[][]) => {
    const N = matrix.length;
    const res: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        res[c][N - 1 - r] = matrix[r][c];
      }
    }
    return res;
  };

  // Actions
  const moveHorizontal = (dir: number) => {
    const state = gameStateRef.current;
    if (!state.currentPiece || !state.isAlive || isPausedRef.current) return;
    if (!collides(state.currentPiece, dir, 0)) {
      state.currentPiece.x += dir;
      if (soundEnabled) sounds.playPop();
    }
  };

  // Wall kick offset tests for spin slotting
  const KICK_OFFSETS = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, -1],
    [2, 0],
    [-2, 0],
    [1, -1],
    [-1, -1],
  ];

  const rotatePiece = () => {
    const state = gameStateRef.current;
    if (!state.currentPiece || !state.isAlive || isPausedRef.current) return;
    const rotated = rotateMatrix(state.currentPiece.matrix);

    // Try kick offsets for spin-slotting into tight corners/tucks
    for (const [ox, oy] of KICK_OFFSETS) {
      if (!collides(state.currentPiece, ox, oy, rotated)) {
        state.currentPiece.x += ox;
        state.currentPiece.y += oy;
        state.currentPiece.matrix = rotated;
        // Reset lock delay on successful rotation (up to 15 resets)
        if (state.lockTimer > 0 && state.lockResets < 15) {
          state.lockTimer = 0.5;
          state.lockResets++;
        }
        if (soundEnabled) sounds.playPop();
        return;
      }
    }
  };

  const hardDrop = () => {
    const state = gameStateRef.current;
    if (!state.currentPiece || !state.isAlive || isPausedRef.current) return;

    let dropDist = 0;
    while (!collides(state.currentPiece, 0, 1)) {
      state.currentPiece.y += 1;
      dropDist++;
    }

    state.score += dropDist * 2;
    state.lockTimer = 0;
    lockPiece();
    if (soundEnabled) sounds.playKnifeStick();
  };

  const softDrop = () => {
    const state = gameStateRef.current;
    if (!state.currentPiece || !state.isAlive || isPausedRef.current) return;
    if (!collides(state.currentPiece, 0, 1)) {
      state.currentPiece.y += 1;
      state.score += 1;
      if (state.lockTimer > 0) state.lockTimer = 0.5;
    } else {
      lockPiece();
    }
  };

  const lockPiece = () => {
    const state = gameStateRef.current;
    const piece = state.currentPiece;
    if (!piece) return;

    // Stamp piece into grid
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (piece.matrix[r][c]) {
          const gx = piece.x + c;
          const gy = piece.y + r;
          if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
            state.grid[gy][gx] = piece.color;
          }
        }
      }
    }

    // Check completed lines
    let clearedLines = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (state.grid[r].every((cell) => cell !== null)) {
        clearedLines++;
        state.grid.splice(r, 1);
        state.grid.unshift(Array(COLS).fill(null));
        r++; // check same index again
      }
    }

    if (clearedLines > 0) {
      state.lines += clearedLines;
      const pts = [0, 100, 300, 500, 1000][clearedLines] * state.level;
      state.score += pts;
      onScoreUpdate(state.score);
      if (soundEnabled) sounds.playLineClear();

      state.level = Math.floor(state.lines / 10) + 1;
      state.dropInterval = Math.max(0.12, 0.8 - (state.level - 1) * 0.08);

      const label = clearedLines === 4 ? 'TETRIS! +1000' : `+${pts} LINES!`;
      state.popups.push({
        id: state.nextId++,
        x: 100,
        y: 180,
        text: label,
        color: clearedLines === 4 ? '#06B6D4' : '#FACC15',
        life: 1.2,
      });
    }

    // Spawn next piece
    state.currentPiece = spawnPiece(state.nextPieceType);
    state.nextPieceType = getRandomPieceType();

    // Check game over
    if (collides(state.currentPiece, 0, 0)) {
      state.isAlive = false;
      if (soundEnabled) sounds.playExplosion();
      setSafeTimeout(() => onGameOver(state.score), 400);
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        moveHorizontal(-1);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        moveHorizontal(1);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        rotatePiece();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        softDrop();
      } else if (e.code === 'Space') {
        e.preventDefault();
        hardDrop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialization
  useEffect(() => {
    const state = gameStateRef.current;
    state.score = 0;
    state.lines = 0;
    state.level = 1;
    state.isAlive = true;
    state.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    state.nextPieceType = getRandomPieceType();
    state.currentPiece = spawnPiece(getRandomPieceType());
    state.particles = [];
    state.popups = [];
  }, []);

  useGameLoop({
    canvasRef,
    isPaused,
    onUpdate: (ctx, dt, w, h) => {
      const state = gameStateRef.current;
      const currentTime = performance.now();
      ctx.clearRect(0, 0, w, h);

      const boardW = COLS * BLOCK_SIZE;
      const boardH = ROWS * BLOCK_SIZE;
      const boardX = (w - boardW) / 2 - 30;
      const boardY = (h - boardH) / 2;

      if (!isPausedRef.current && state.isAlive) {
        // Falling & Lock Delay
        if (state.currentPiece) {
          const isResting = collides(state.currentPiece, 0, 1);
          if (isResting) {
            if (state.lockTimer === 0) {
              state.lockTimer = 0.55; // 550ms lock delay
              state.lockResets = 0;
            } else {
              state.lockTimer -= dt;
              if (state.lockTimer <= 0) {
                state.lockTimer = 0;
                lockPiece();
              }
            }
          } else {
            state.lockTimer = 0;
            state.dropTimer += dt;
            if (state.dropTimer >= state.dropInterval) {
              state.dropTimer = 0;
              state.currentPiece.y += 1;
            }
          }
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
      // RENDER NEON TETRO BOARD
      // ==========================================
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);

      // Grid background
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(boardX, boardY, boardW, boardH);
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.strokeRect(boardX, boardY, boardW, boardH);

      // Grid cell lines
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          ctx.strokeRect(boardX + c * BLOCK_SIZE, boardY + r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      }

      // Render Locked Grid Cells
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const color = state.grid[r][c];
          if (color) {
            ctx.save();
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.fillRect(boardX + c * BLOCK_SIZE + 1, boardY + r * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(boardX + c * BLOCK_SIZE + 2, boardY + r * BLOCK_SIZE + 2, BLOCK_SIZE - 4, 3);
            ctx.restore();
          }
        }
      }

      // Render Ghost Landing Piece
      if (state.currentPiece && state.isAlive) {
        let ghostY = state.currentPiece.y;
        while (!collides(state.currentPiece, 0, ghostY - state.currentPiece.y + 1)) {
          ghostY++;
        }

        ctx.save();
        ctx.strokeStyle = state.currentPiece.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        for (let r = 0; r < state.currentPiece.matrix.length; r++) {
          for (let c = 0; c < state.currentPiece.matrix[r].length; c++) {
            if (state.currentPiece.matrix[r][c]) {
              const gx = state.currentPiece.x + c;
              const gy = ghostY + r;
              if (gy >= 0) {
                ctx.strokeRect(boardX + gx * BLOCK_SIZE + 2, boardY + gy * BLOCK_SIZE + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
              }
            }
          }
        }
        ctx.restore();

        // Render Active Falling Piece
        ctx.save();
        ctx.fillStyle = state.currentPiece.color;
        ctx.shadowColor = state.currentPiece.color;
        ctx.shadowBlur = 12;

        for (let r = 0; r < state.currentPiece.matrix.length; r++) {
          for (let c = 0; c < state.currentPiece.matrix[r].length; c++) {
            if (state.currentPiece.matrix[r][c]) {
              const gx = state.currentPiece.x + c;
              const gy = state.currentPiece.y + r;
              if (gy >= 0) {
                ctx.fillRect(boardX + gx * BLOCK_SIZE + 1, boardY + gy * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.fillRect(boardX + gx * BLOCK_SIZE + 2, boardY + gy * BLOCK_SIZE + 2, BLOCK_SIZE - 4, 3);
                ctx.fillStyle = state.currentPiece.color;
              }
            }
          }
        }
        ctx.restore();
      }

      // Render Next Piece Preview Box on right side
      const nextBoxX = boardX + boardW + 20;
      const nextBoxY = boardY + 20;

      ctx.fillStyle = '#18181B';
      ctx.strokeStyle = '#27272A';
      ctx.lineWidth = 2;
      ctx.roundRect(nextBoxX, nextBoxY, 80, 80, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#71717A';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('NEXT', nextBoxX + 26, nextBoxY - 8);

      const nextShapeData = SHAPES[state.nextPieceType];
      ctx.fillStyle = nextShapeData.color;
      ctx.shadowColor = nextShapeData.color;
      ctx.shadowBlur = 8;

      const nMat = nextShapeData.shape;
      const nOffX = nextBoxX + (80 - nMat[0].length * 15) / 2;
      const nOffY = nextBoxY + (80 - nMat.length * 15) / 2;

      for (let r = 0; r < nMat.length; r++) {
        for (let c = 0; c < nMat[r].length; c++) {
          if (nMat[r][c]) {
            ctx.fillRect(nOffX + c * 15, nOffY + r * 15, 13, 13);
          }
        }
      }

      // Render Popups
      for (const pop of state.popups) {
        ctx.save();
        ctx.globalAlpha = pop.life;
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = pop.color;
        ctx.shadowBlur = 8;
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }

      // Sync React HUD (throttled to avoid frame drops)
      if (currentTime - state.lastHudSync > 150) {
        state.lastHudSync = currentTime;
        setHudState((prev) => {
          if (
            prev.score === state.score &&
            prev.lines === state.lines &&
            prev.level === state.level &&
            prev.nextType === state.nextPieceType
          ) {
            return prev;
          }
          return {
            score: state.score,
            lines: state.lines,
            level: state.level,
            nextType: state.nextPieceType,
          };
        });
      }

      return state.isAlive;
    }
  });

  return (
    <div
      ref={containerRef}
      id="block-drop-container"
      className="relative w-full h-full min-h-[440px] flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none"
    >
      {/* Top HUD */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-cyan-400 font-mono text-xs font-black backdrop-blur-md">
            LEVEL {hudState.level}
          </div>
          <div className="px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-emerald-400 font-mono text-xs font-bold backdrop-blur-md">
            LINES: {hudState.lines}
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Mobile Controls */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto z-10 sm:hidden">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => moveHorizontal(-1)}
            className="w-12 h-12 rounded-xl bg-zinc-900/90 border border-zinc-700 text-white flex items-center justify-center active:scale-95 shadow-md"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => moveHorizontal(1)}
            className="w-12 h-12 rounded-xl bg-zinc-900/90 border border-zinc-700 text-white flex items-center justify-center active:scale-95 shadow-md"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={softDrop}
            className="w-12 h-12 rounded-xl bg-zinc-900/90 border border-zinc-700 text-white flex items-center justify-center active:scale-95 shadow-md"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={rotatePiece}
            className="w-13 h-12 rounded-xl bg-cyan-600 text-white font-bold flex items-center justify-center active:scale-95 shadow-md shadow-cyan-500/20"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={hardDrop}
            className="w-13 h-12 rounded-xl bg-pink-600 text-white font-bold flex items-center justify-center active:scale-95 shadow-md shadow-pink-500/20"
          >
            <ChevronsDown className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
