import React, { useState, useEffect, useRef } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { useSafeTimeout } from '../hooks/useGameLoop';
import { haptics } from '../lib/haptics';
import { Hammer, RefreshCw, Sparkles } from 'lucide-react';
import { findNextMergeDecision } from '../lib/mergeRules';

const COLS = 4;
const ROWS = 6;

interface TileInfo {
  val: number;
  id: number;
  isMerging?: boolean;
}

const TILE_STYLES: Record<
  number,
  { bg: string; border: string; text: string; glow: string }
> = {
  2: { bg: 'bg-[#1E293B]', border: 'border-[#38BDF8]/40', text: 'text-[#38BDF8]', glow: 'rgba(56, 189, 248, 0.3)' },
  4: { bg: 'bg-[#064E3B]', border: 'border-[#34D399]/40', text: 'text-[#34D399]', glow: 'rgba(52, 211, 153, 0.3)' },
  8: { bg: 'bg-[#78350F]', border: 'border-[#FBBF24]/40', text: 'text-[#FBBF24]', glow: 'rgba(251, 191, 36, 0.3)' },
  16: { bg: 'bg-[#7C2D12]', border: 'border-[#FB923C]/40', text: 'text-[#FB923C]', glow: 'rgba(251, 146, 60, 0.3)' },
  32: { bg: 'bg-[#881337]', border: 'border-[#F43F5E]/40', text: 'text-[#F43F5E]', glow: 'rgba(244, 63, 94, 0.4)' },
  64: { bg: 'bg-[#581C87]', border: 'border-[#C084FC]/40', text: 'text-[#C084FC]', glow: 'rgba(192, 132, 252, 0.4)' },
  128: { bg: 'bg-[#701A75]', border: 'border-[#F472B6]/50', text: 'text-[#F472B6]', glow: 'rgba(244, 114, 182, 0.5)' },
  256: { bg: 'bg-[#1E1B4B]', border: 'border-[#818CF8]/60', text: 'text-[#818CF8]', glow: 'rgba(129, 140, 248, 0.5)' },
  512: { bg: 'bg-[#713F12]', border: 'border-[#FACC15]/70', text: 'text-[#FEF08A]', glow: 'rgba(250, 204, 21, 0.6)' },
  1024: { bg: 'bg-[#831843]', border: 'border-[#FDA4AF]', text: 'text-[#FFF1F2]', glow: 'rgba(253, 164, 175, 0.7)' },
  2048: { bg: 'bg-[#BE123C]', border: 'border-[#FFE4E6]', text: 'text-white font-black', glow: 'rgba(244, 63, 94, 0.9)' },
  4096: { bg: 'bg-[#4C1D95]', border: 'border-[#DDD6FE]', text: 'text-white font-black', glow: 'rgba(167, 139, 250, 0.9)' },
};

export const MergeGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const [board, setBoard] = useState<(TileInfo | null)[][]>(() =>
    Array(COLS)
      .fill(null)
      .map(() => Array(ROWS).fill(null))
  );

  const [nextTile, setNextTile] = useState<number>(2);
  const [selectedCol, setSelectedCol] = useState<number>(1);
  const [hammerActive, setHammerActive] = useState<boolean>(false);
  const [hammerCharges, setHammerCharges] = useState<number>(1);
  const [swapsLeft, setSwapsLeft] = useState<number>(2);
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const nextTileId = useRef(1);
  const setSafeTimeout = useSafeTimeout();

  const getNewTileValue = () => {
    const choices = [2, 2, 4, 4, 8, 16];
    return choices[Math.floor(Math.random() * choices.length)];
  };

  useEffect(() => {
    setNextTile(getNewTileValue());
  }, []);

  const handleSwapNext = () => {
    if (swapsLeft <= 0 || isPaused || isGameOver) return;
    setSwapsLeft((prev) => prev - 1);
    setNextTile(getNewTileValue());
    if (soundEnabled) sounds.playPop();
  };

  const handleHammerClick = () => {
    if (hammerCharges <= 0 || isPaused || isGameOver) return;
    setHammerActive((prev) => !prev);
    if (soundEnabled) sounds.playPop();
  };

  const dropTile = (colIndex: number) => {
    if (isGameOver || isPaused) return;

    if (hammerActive) {
      // Break the top tile in this column
      const column = [...board[colIndex]];
      for (let r = 0; r < ROWS; r++) {
        if (column[r] !== null) {
          column[r] = null;
          const newBoard = board.map((c, i) => (i === colIndex ? [...column] : [...c]));
          setBoard(newBoard);
          setHammerActive(false);
          setHammerCharges((prev) => prev - 1);
          haptics.impact();
          if (soundEnabled) sounds.playExplosion();
          return;
        }
      }
      return;
    }

    const column = [...board[colIndex]];
    let dropRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (column[r] === null) {
        dropRow = r;
        break;
      }
    }

    if (dropRow === -1) {
      if (soundEnabled) sounds.playBuzz();
      return;
    }

    // Place tile
    const newBoard = board.map((col, cIdx) => (cIdx === colIndex ? [...col] : [...col]));
    newBoard[colIndex][dropRow] = { val: nextTile, id: nextTileId.current++ };

    if (soundEnabled) sounds.playPop();

    // Cascading merge algorithm
    let currentScore = score;
    let hadMerge = true;
    let mergeStreak = 0;

    while (hadMerge) {
      const valueBoard = newBoard.map((column) => column.map((tile) => tile?.val ?? null));
      const decision = findNextMergeDecision(valueBoard, colIndex);
      if (!decision) {
        hadMerge = false;
        break;
      }

      newBoard[decision.target.col][decision.target.row] = {
        val: decision.resultValue,
        id: nextTileId.current++,
        isMerging: true,
      };
      newBoard[decision.source.col][decision.source.row] = null;
      currentScore += decision.resultValue;
      mergeStreak++;

      // Gravity remains vertical, but horizontal merge destinations are selected
      // by the mirror-symmetric resolver rather than left-to-right scan order.
      for (let c = 0; c < COLS; c++) {
        const colTiles = newBoard[c].filter((t) => t !== null) as TileInfo[];
        const newCol: (TileInfo | null)[] = Array(ROWS - colTiles.length)
          .fill(null)
          .concat(colTiles);
        newBoard[c] = newCol;
      }
    }

    if (mergeStreak > 0) {
      if (mergeStreak >= 2) {
        haptics.combo();
      } else {
        haptics.score();
      }
      if (soundEnabled) sounds.playCombo(mergeStreak);
    } else {
      haptics.light();
    }

    setBoard(newBoard);
    setScore(currentScore);
    onScoreUpdate(currentScore);

    // Full board game over check
    const isFull = newBoard.every((col) => col[0] !== null);
    if (isFull) {
      setIsGameOver(true);
      haptics.gameOver();
      if (soundEnabled) sounds.playGameOver();
      setSafeTimeout(() => {
        onGameOver(currentScore);
      }, 700);
      return;
    }

    setNextTile(getNewTileValue());
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isGameOver || isPaused) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setSelectedCol((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setSelectedCol((prev) => Math.min(COLS - 1, prev + 1));
      } else if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'Enter') {
        dropTile(selectedCol);
      } else if (e.key === '1') dropTile(0);
      else if (e.key === '2') dropTile(1);
      else if (e.key === '3') dropTile(2);
      else if (e.key === '4') dropTile(3);
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedCol, isGameOver, isPaused, board, nextTile]);

  const nextStyle = TILE_STYLES[nextTile] || TILE_STYLES[2];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-3 select-none touch-none">
      {/* Top HUD: Next Tile & Powerups */}
      <div className="mb-3 flex items-center justify-between w-full max-w-xs px-1">
        <div className="flex items-center gap-2 bg-[#18181B] px-3 py-1.5 rounded-xl border border-[#27272A]">
          <span className="text-[11px] font-mono-arcade text-[#71717A] font-bold">NEXT:</span>
          <div
            className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs sm:text-sm shadow-md transition-transform ${nextStyle.bg} ${nextStyle.border} ${nextStyle.text}`}
            style={{ boxShadow: `0 0 10px ${nextStyle.glow}` }}
          >
            {nextTile}
          </div>
          <button
            type="button"
            onClick={handleSwapNext}
            disabled={swapsLeft <= 0}
            title="Swap Next Tile"
            className="p-1 rounded-lg bg-[#27272A] hover:bg-[#3F3F46] text-[#A1A1AA] hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hammer Powerup */}
        <button
          type="button"
          onClick={handleHammerClick}
          disabled={hammerCharges <= 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono-arcade text-xs font-bold transition-all cursor-pointer ${
            hammerActive
              ? 'bg-[#F43F5E] text-white border-[#F43F5E] shadow-[0_0_12px_rgba(244,63,94,0.6)] animate-pulse'
              : 'bg-[#18181B] text-[#A1A1AA] hover:text-white border-[#27272A] disabled:opacity-40'
          }`}
        >
          <Hammer className="w-3.5 h-3.5" />
          <span>HAMMER ({hammerCharges})</span>
        </button>
      </div>

      {/* Grid Container */}
      <div className="relative bg-[#0A0A0B] p-2.5 rounded-2xl border border-[#27272A] shadow-2xl flex gap-1.5 sm:gap-2">
        {board.map((col, cIdx) => (
          <div
            key={cIdx}
            onClick={() => dropTile(cIdx)}
            onMouseEnter={() => setSelectedCol(cIdx)}
            className={`flex flex-col gap-1.5 sm:gap-2 p-1 rounded-xl transition-colors cursor-pointer ${
              selectedCol === cIdx ? 'bg-[#18181B]/80' : 'hover:bg-[#18181B]/40'
            }`}
          >
            {col.map((tile, rIdx) => {
              const style = tile ? TILE_STYLES[tile.val] || TILE_STYLES[2] : null;

              return (
                <div
                  key={rIdx}
                  className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center font-bold text-sm sm:text-lg transition-all duration-200 ${
                    tile && style
                      ? `${style.bg} ${style.border} ${style.text} border shadow-lg scale-100`
                      : 'bg-[#18181B]/40 border border-[#27272A]/40'
                  }`}
                  style={
                    style
                      ? {
                          boxShadow: `0 0 10px ${style.glow}`,
                        }
                      : {}
                  }
                >
                  {tile?.val}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
