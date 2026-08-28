import React from 'react';
import { motion } from 'motion/react';
import { GameDefinition } from '../types';
import {
  Heart,
  Play,
  Zap,
  Layers,
  Radio,
  Grid,
  Keyboard,
  PenTool,
  Boxes,
  Crosshair,
  Sparkles,
  Compass,
  ShieldAlert,
  Sword,
  Disc,
  Hexagon,
  Terminal,
  Flame,
  Rocket,
  Pickaxe,
  Ghost,
  Wind,
  Footprints,
  CircleDot,
  Target,
  Activity,
  Grid3X3,
  Trophy,
} from 'lucide-react';
import { sounds } from '../lib/sound';

interface GameCardProps {
  game: GameDefinition;
  highScore: number;
  playCount: number;
  isFavorite: boolean;
  onSelect: (gameId: string) => void;
  onToggleFavorite: (gameId: string, e: React.MouseEvent) => void;
  index?: number;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Orbit: Compass,
  Layers,
  Zap,
  ShieldAlert,
  Radio,
  Grid,
  Keyboard,
  PenTool,
  Boxes,
  Crosshair,
  Sparkles,
  Compass,
  Sword,
  Disc,
  Hexagon,
  Terminal,
  Flame,
  Rocket,
  Pickaxe,
  Ghost,
  Wind,
  Footprints,
  CircleDot,
  Target,
  Activity,
  Grid3X3,
  Trophy,
};

export const GameCard: React.FC<GameCardProps> = ({
  game,
  highScore,
  playCount,
  isFavorite,
  onSelect,
  onToggleFavorite,
  index = 0,
}) => {
  const IconComponent = ICON_MAP[game.icon] || Zap;
  const titleId = `game-title-${game.id}`;
  const descriptionId = `game-description-${game.id}`;

  return (
    <motion.article
      id={`game-card-${game.id}`}
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.92, transition: { duration: 0.15, ease: 'easeOut' } }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.035, 0.35),
        ease: [0.22, 1, 0.36, 1],
        layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
      }}
      whileHover={{ y: -4, transition: { duration: 0.18, ease: 'easeOut' } }}
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

      <div className="pointer-events-none relative z-0 my-3.5 flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-[#27272A]/70 bg-[#0A0A0B]">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: `${game.accentColor}14`, color: game.accentColor }}
        >
          <IconComponent className="h-6 w-6" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-[#0A0A0B]/80 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <span className="flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1 text-xs font-bold text-black shadow-md">
            <Play className="h-3 w-3 fill-current" /> PLAY
          </span>
        </div>
      </div>

      <div className="pointer-events-none relative z-0 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id={titleId} className="truncate text-base font-bold text-white">{game.title}</h3>
          {highScore > 0 && (
            <span className="shrink-0 rounded border border-amber-500/20 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 font-mono-arcade">
              BEST {highScore.toLocaleString()}
            </span>
          )}
        </div>
        <p id={descriptionId} className="line-clamp-1 text-xs text-[#71717A]">{game.tagline}</p>
        <span className="sr-only">Played {playCount.toLocaleString()} times.</span>
      </div>
    </motion.article>
  );
};
