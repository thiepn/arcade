import React, { useEffect, useRef, useState } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { RotateCw, ArrowDown, ArrowLeft, ArrowRight, ChevronsDown, Zap, Trophy } from 'lucide-react';
import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import { getBlockDropLayout, resolveBlockDropHold } from '../lib/blockDropSupport';

const COLS = 10;
const ROWS = 20;
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

const drawPreview = (
  ctx: CanvasRenderingContext2D,
  label: 'HOLD' | 'NEXT',
  type: TetrominoType | null,
  x: number,
  y: number,
  size: number,
  cell: number,
  enabled = true,
) => {
  ctx.save();
  ctx.fillStyle = enabled ? 'rgba(15,23,42,0.92)' : 'rgba(9,9,11,0.78)';
  ctx.strokeStyle = enabled ? 'rgba(71,85,105,0.92)' : 'rgba(63,63,70,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, Math.max(7, size * 0.1));
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = enabled ? '#94A3B8' : '#52525B';
  ctx.font = '800 9px ui-monospace, monospace';
  ctx.fillText(label, x + size / 2, y - 8);
  if (label === 'HOLD') {
    ctx.font = '700 7px ui-monospace, monospace';
    ctx.fillStyle = enabled ? '#64748B' : '#3F3F46';
    ctx.fillText(enabled ? 'C / SHIFT' : 'LOCKED', x + size / 2, y + size + 12);
  }

  if (!type) {
    ctx.fillStyle = '#475569';
    ctx.font = '900 18px ui-monospace, monospace';
    ctx.fillText('—', x + size / 2, y + size / 2 + 6);
    ctx.restore();
    return;
  }

  const data = SHAPES[type];
  const matrix = data.shape;
  const pieceW = matrix[0].length * cell;
  const pieceH = matrix.length * cell;
  const offX = x + (size - pieceW) / 2;
  const offY = y + (size - pieceH) / 2;
  ctx.fillStyle = data.color;
  ctx.shadowColor = data.color;
  ctx.shadowBlur = enabled ? 10 : 3;
  ctx.globalAlpha = enabled ? 1 : 0.42;
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (!matrix[row][col]) continue;
      ctx.fillRect(offX + col * cell + 1, offY + row * cell + 1, cell - 2, cell - 2);
    }
  }
  ctx.restore();
};

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
    holdType: null as TetrominoType | null,
    canHold: true,
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
    holdPieceType: null as TetrominoType | null,
    canHold: true,
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

  const finishGame = () => {
    const state = gameStateRef.current;
    if (!state.isAlive) return;
    state.isAlive = false;
    if (soundEnabled) sounds.playExplosion();
    setSafeTimeout(() => onGameOver(state.score), 400);
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

  const holdPiece = () => {
    const state = gameStateRef.current;
    if (!state.currentPiece || !state.isAlive || isPausedRef.current || !state.canHold) return;

    const result = resolveBlockDropHold(
      {
        current: state.currentPiece.type,
        next: state.nextPieceType,
        hold: state.holdPieceType,
        canHold: state.canHold,
      },
      getRandomPieceType,
    );
    if (!result.changed) return;

    state.holdPieceType = result.hold;
    state.nextPieceType = result.next;
    state.currentPiece = spawnPiece(result.current);
    state.canHold = false;
    state.dropTimer = 0;
    state.lockTimer = 0;
    state.lockResets = 0;
    if (soundEnabled) sounds.playPop();

    if (collides(state.currentPiece, 0, 0)) finishGame();
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

    // Spawn next piece. A fresh placement restores exactly one Hold/Swap action.
    state.currentPiece = spawnPiece(state.nextPieceType);
    state.nextPieceType = getRandomPieceType();
    state.canHold = true;
    state.dropTimer = 0;
    state.lockTimer = 0;
    state.lockResets = 0;

    // Check game over
    if (collides(state.currentPiece, 0, 0)) finishGame();
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
      } else if (
        e.code === 'KeyC' ||
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight'
      ) {
        e.preventDefault();
        holdPiece();
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
    state.holdPieceType = null;
    state.canHold = true;
    state.dropTimer = 0;
    state.lockTimer = 0;
    state.lockResets = 0;
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

      const layout = getBlockDropLayout(w, h);
      const {
        cellSize,
        boardW,
        boardH,
        boardX,
        boardY,
        previewSize,
        previewCellSize,
        holdX,
        nextX,
        previewY,
      } = layout;

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
          ctx.strokeRect(boardX + c * cellSize, boardY + r * cellSize, cellSize, cellSize);
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
            ctx.fillRect(boardX + c * cellSize + 1, boardY + r * cellSize + 1, cellSize - 2, cellSize - 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(boardX + c * cellSize + 2, boardY + r * cellSize + 2, cellSize - 4, 3);
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
                ctx.strokeRect(boardX + gx * cellSize + 2, boardY + gy * cellSize + 2, cellSize - 4, cellSize - 4);
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
                ctx.fillRect(boardX + gx * cellSize + 1, boardY + gy * cellSize + 1, cellSize - 2, cellSize - 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.fillRect(boardX + gx * cellSize + 2, boardY + gy * cellSize + 2, cellSize - 4, 3);
                ctx.fillStyle = state.currentPiece.color;
              }
            }
          }
        }
        ctx.restore();
      }

      // Hold and Next previews flank the larger responsive board on every viewport.
      drawPreview(
        ctx,
        'HOLD',
        state.holdPieceType,
        holdX,
        previewY,
        previewSize,
        previewCellSize,
        state.canHold,
      );
      drawPreview(
        ctx,
        'NEXT',
        state.nextPieceType,
        nextX,
        previewY,
        previewSize,
        previewCellSize,
        true,
      );

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
            prev.nextType === state.nextPieceType &&
            prev.holdType === state.holdPieceType &&
            prev.canHold === state.canHold
          ) {
            return prev;
          }
          return {
            score: state.score,
            lines: state.lines,
            level: state.level,
            nextType: state.nextPieceType,
            holdType: state.holdPieceType,
            canHold: state.canHold,
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
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none"
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
      <div className="absolute bottom-2 left-2 right-2 z-10 grid grid-cols-6 gap-1 pointer-events-auto sm:hidden">
        <button
          type="button"
          onClick={() => moveHorizontal(-1)}
          className="h-11 min-w-0 rounded-lg bg-zinc-900/92 border border-zinc-700 text-white flex items-center justify-center active:scale-95 shadow-md"
          aria-label="Move left"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => moveHorizontal(1)}
          className="h-11 min-w-0 rounded-lg bg-zinc-900/92 border border-zinc-700 text-white flex items-center justify-center active:scale-95 shadow-md"
          aria-label="Move right"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={softDrop}
          className="h-11 min-w-0 rounded-lg bg-zinc-900/92 border border-zinc-700 text-white flex items-center justify-center active:scale-95 shadow-md"
          aria-label="Soft drop"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={holdPiece}
          disabled={!hudState.canHold}
          className="h-11 min-w-0 rounded-lg border border-amber-400/40 bg-amber-400/10 text-amber-200 flex flex-col items-center justify-center active:scale-95 shadow-md disabled:opacity-35 disabled:active:scale-100"
          aria-label="Hold or swap piece"
        >
          <span className="font-mono-arcade text-[7px] font-black">HOLD</span>
          <span className="mt-0.5 text-[6px] text-amber-300/55">C</span>
        </button>
        <button
          type="button"
          onClick={rotatePiece}
          className="h-11 min-w-0 rounded-lg bg-cyan-600 text-white font-bold flex items-center justify-center active:scale-95 shadow-md shadow-cyan-500/20"
          aria-label="Rotate piece"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={hardDrop}
          className="h-11 min-w-0 rounded-lg bg-pink-600 text-white font-bold flex items-center justify-center active:scale-95 shadow-md shadow-pink-500/20"
          aria-label="Hard drop"
        >
          <ChevronsDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
