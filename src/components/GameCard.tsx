import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Heart, Play } from 'lucide-react';
import { GameDefinition } from '../types';
import { sounds } from '../lib/sound';
import { GamePreview } from './GamePreview';

interface GameCardProps {
  game: GameDefinition;
  highScore: number;
  rank: number | null;
  rankLoading?: boolean;
  rankUnavailable?: boolean;
  playCount: number;
  isFavorite: boolean;
  onSelect: (gameId: string) => void;
  onToggleFavorite: (gameId: string, e: React.MouseEvent) => void;
  index?: number;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  highScore,
  rank,
  rankLoading = false,
  rankUnavailable = false,
  playCount,
  isFavorite,
  onSelect,
  onToggleFavorite,
  index = 0,
}) => {
  const reduceMotion = useReducedMotion() === true;
  const titleId = `game-title-${game.id}`;
  const descriptionId = `game-description-${game.id}`;

  return (
    <motion.article
      id={`game-card-${game.id}`}
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.92, transition: { duration: 0.15, ease: 'easeOut' } }}
      transition={reduceMotion ? { duration: 0 } : {
        duration: 0.3,
        delay: Math.min(index * 0.035, 0.35),
        ease: [0.22, 1, 0.36, 1],
        layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
      }}
      whileHover={reduceMotion ? undefined : { y: -4, transition: { duration: 0.18, ease: 'easeOut' } }}
      data-p31-motion={reduceMotion ? 'reduced' : 'full'}
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#27272A] bg-[#18181B] p-4 transition-colors duration-200 hover:border-[#F43F5E] hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <button
        type="button"
        id={`play-btn-${game.id}`}
        onClick={() => {
          sounds.playClick();
          onSelect(game.id);
        }}
        className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B]"
        aria-label={`Play ${game.title}. ${game.tagline}`}
      />

      <div className="relative z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${game.accentColor}18`, color: game.accentColor }}
          >
            {game.category}
          </span>
          <span className="text-[10px] text-[#71717A]">• {game.sessionLength}</span>
        </div>

        <button
          type="button"
          id={`fav-btn-${game.id}`}
          onClick={(event) => {
            event.stopPropagation();
            sounds.playPop();
            onToggleFavorite(game.id, event);
          }}
          className={`pointer-events-auto relative z-30 rounded-lg p-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${
            isFavorite ? 'bg-[#F43F5E]/10 text-[#F43F5E]' : 'text-[#52525B] hover:text-[#A1A1AA]'
          }`}
          aria-label={isFavorite ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
          aria-pressed={isFavorite}
        >
          <Heart className={`h-3.5 w-3.5 ${isFavorite ? 'fill-[#F43F5E]' : ''}`} />
        </button>
      </div>

      <div className="pointer-events-none relative z-0 my-3.5 aspect-[16/9] w-full overflow-hidden rounded-lg border border-[#27272A]/80 bg-[#0A0A0B] shadow-inner">
        <GamePreview game={game} />
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-[#0A0A0B]/72 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <span className="flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1.5 text-xs font-bold text-black shadow-md">
            <Play className="h-3 w-3 fill-current" /> PLAY
          </span>
        </div>
      </div>

      <div className="pointer-events-none relative z-0 flex flex-col gap-1">
        <h3 id={titleId} className="truncate text-base font-bold text-white">{game.title}</h3>
        <p id={descriptionId} className="line-clamp-1 text-xs text-[#71717A]">{game.tagline}</p>
        <div
          className="mt-2 grid grid-cols-2 gap-1.5 font-mono-arcade"
          data-game-competition-stats={game.id}
          aria-label={`Your stats for ${game.title}`}
        >
          <span className="flex min-w-0 items-center justify-between gap-1 rounded-md border border-amber-500/20 bg-amber-950/25 px-2 py-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500/70">My AP</span>
            <strong data-game-ap={game.id} className="truncate text-[11px] font-bold text-amber-300">
              {highScore.toLocaleString()}
            </strong>
          </span>
          <span
            className="flex min-w-0 items-center justify-between gap-1 rounded-md border border-cyan-500/20 bg-cyan-950/20 px-2 py-1"
            aria-label={
              rankLoading
                ? 'Rank loading'
                : rank !== null
                  ? `Rank ${rank}`
                  : rankUnavailable
                    ? 'Rank unavailable'
                    : 'Unranked'
            }
          >
            <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-500/70">My rank</span>
            <strong data-game-rank={game.id} className="truncate text-[11px] font-bold text-cyan-300">
              {rankLoading ? '…' : rank !== null ? `#${rank.toLocaleString()}` : rankUnavailable ? '—' : 'UNRANKED'}
            </strong>
          </span>
        </div>
        <span className="sr-only">Played {playCount.toLocaleString()} times.</span>
      </div>
    </motion.article>
  );
};
