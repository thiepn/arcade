import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, search, replacement, label) {
  const source = readFileSync(path, 'utf8');
  let count = 0;
  if (typeof search === 'string') {
    count = source.split(search).length - 1;
  } else {
    const flags = search.flags.includes('g') ? search.flags : `${search.flags}g`;
    count = [...source.matchAll(new RegExp(search.source, flags))].length;
  }
  if (count !== 1) throw new Error(`${path}: expected one ${label} match, found ${count}`);
  writeFileSync(path, source.replace(search, replacement));
}

const gamePath = 'src/games/BlockDropGame.tsx';

replaceOnce(
  gamePath,
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';",
  `import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';
import { getBlockDropLayout, resolveBlockDropHold } from '../lib/blockDropSupport';`,
  'Block Drop support import',
);

replaceOnce(gamePath, 'const BLOCK_SIZE = 22;\n\n', '', 'fixed block size removal');

replaceOnce(
  gamePath,
  `interface ActivePiece {
  type: TetrominoType;
  matrix: number[][];
  x: number;
  y: number;
  color: string;
}
`,
  `interface ActivePiece {
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
`,
  'preview renderer',
);

replaceOnce(
  gamePath,
  `    nextType: 'T' as TetrominoType,
  });`,
  `    nextType: 'T' as TetrominoType,
    holdType: null as TetrominoType | null,
    canHold: true,
  });`,
  'HUD hold state',
);

replaceOnce(
  gamePath,
  `    currentPiece: null as ActivePiece | null,
    nextPieceType: 'T' as TetrominoType,
    dropTimer: 0,`,
  `    currentPiece: null as ActivePiece | null,
    nextPieceType: 'T' as TetrominoType,
    holdPieceType: null as TetrominoType | null,
    canHold: true,
    dropTimer: 0,`,
  'game hold state',
);

replaceOnce(
  gamePath,
  `  const rotateMatrix = (matrix: number[][]) => {`,
  `  const finishGame = () => {
    const state = gameStateRef.current;
    if (!state.isAlive) return;
    state.isAlive = false;
    if (soundEnabled) sounds.playExplosion();
    setSafeTimeout(() => onGameOver(state.score), 400);
  };

  const rotateMatrix = (matrix: number[][]) => {`,
  'shared game-over helper',
);

replaceOnce(
  gamePath,
  `  const hardDrop = () => {`,
  `  const holdPiece = () => {
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

  const hardDrop = () => {`,
  'hold action',
);

replaceOnce(
  gamePath,
  `    // Spawn next piece
    state.currentPiece = spawnPiece(state.nextPieceType);
    state.nextPieceType = getRandomPieceType();

    // Check game over
    if (collides(state.currentPiece, 0, 0)) {
      state.isAlive = false;
      if (soundEnabled) sounds.playExplosion();
      setSafeTimeout(() => onGameOver(state.score), 400);
    }`,
  `    // Spawn next piece. A fresh placement restores exactly one Hold/Swap action.
    state.currentPiece = spawnPiece(state.nextPieceType);
    state.nextPieceType = getRandomPieceType();
    state.canHold = true;
    state.dropTimer = 0;
    state.lockTimer = 0;
    state.lockResets = 0;

    // Check game over
    if (collides(state.currentPiece, 0, 0)) finishGame();`,
  'hold reset after placement',
);

replaceOnce(
  gamePath,
  `      } else if (e.code === 'Space') {
        e.preventDefault();
        hardDrop();
      }`,
  `      } else if (e.code === 'Space') {
        e.preventDefault();
        hardDrop();
      } else if (
        e.code === 'KeyC' ||
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight'
      ) {
        e.preventDefault();
        holdPiece();
      }`,
  'keyboard hold controls',
);

replaceOnce(
  gamePath,
  `    state.nextPieceType = getRandomPieceType();
    state.currentPiece = spawnPiece(getRandomPieceType());
    state.particles = [];`,
  `    state.nextPieceType = getRandomPieceType();
    state.currentPiece = spawnPiece(getRandomPieceType());
    state.holdPieceType = null;
    state.canHold = true;
    state.dropTimer = 0;
    state.lockTimer = 0;
    state.lockResets = 0;
    state.particles = [];`,
  'hold initialization',
);

replaceOnce(
  gamePath,
  `      const boardW = COLS * BLOCK_SIZE;
      const boardH = ROWS * BLOCK_SIZE;
      const boardX = (w - boardW) / 2 - 30;
      const boardY = (h - boardH) / 2;`,
  `      const layout = getBlockDropLayout(w, h);
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
      } = layout;`,
  'responsive board layout',
);

let source = readFileSync(gamePath, 'utf8');
source = source.replaceAll('c * BLOCK_SIZE', 'c * cellSize');
source = source.replaceAll('r * BLOCK_SIZE', 'r * cellSize');
source = source.replaceAll('gx * BLOCK_SIZE', 'gx * cellSize');
source = source.replaceAll('gy * BLOCK_SIZE', 'gy * cellSize');
source = source.replaceAll('BLOCK_SIZE - 2', 'cellSize - 2');
source = source.replaceAll('BLOCK_SIZE - 4', 'cellSize - 4');
source = source.replaceAll(', BLOCK_SIZE, BLOCK_SIZE)', ', cellSize, cellSize)');
writeFileSync(gamePath, source);

replaceOnce(
  gamePath,
  /      \/\/ Render Next Piece Preview Box on right side[\s\S]*?\n      \/\/ Render Popups/,
  `      // Hold and Next previews flank the larger responsive board on every viewport.
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

      // Render Popups`,
  'Hold and Next preview render',
);

replaceOnce(
  gamePath,
  `            prev.level === state.level &&
            prev.nextType === state.nextPieceType
          ) {`,
  `            prev.level === state.level &&
            prev.nextType === state.nextPieceType &&
            prev.holdType === state.holdPieceType &&
            prev.canHold === state.canHold
          ) {`,
  'HUD hold comparison',
);

replaceOnce(
  gamePath,
  `            level: state.level,
            nextType: state.nextPieceType,
          };`,
  `            level: state.level,
            nextType: state.nextPieceType,
            holdType: state.holdPieceType,
            canHold: state.canHold,
          };`,
  'HUD hold sync',
);

replaceOnce(
  gamePath,
  'className="relative w-full h-full min-h-[440px] flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none"',
  'className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none"',
  'shrink-safe root',
);

replaceOnce(
  gamePath,
  `      {/* Mobile Controls */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto z-10 sm:hidden">[\s\S]*?      </div>
    </div>`,
  `      {/* Mobile Controls */}
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
    </div>`,
  'mobile control deck',
);

const registryPath = 'src/data/games.ts';
replaceOnce(
  registryPath,
  `    instructions: 'Move with Left/Right, Rotate with Up, Soft Drop with Down, Hard Drop with Space.',
    controlsHint: 'Arrows / WASD • Space: Hard Drop',`,
  `    instructions: 'Move with Left/Right, rotate with Up/W, soft drop with Down/S, hard drop with Space, and use C/Shift to Hold or swap one piece per placement.',
    controlsHint: 'Arrows / WASD • Space: Hard Drop • C / Shift: Hold',`,
  'registry hold controls',
);

console.log('Applied Cyber Block Drop responsive desktop sizing, Hold/Swap mechanics, Hold/Next previews, and mobile/keyboard hold controls.');
