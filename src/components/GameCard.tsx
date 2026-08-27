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
  Layers: Layers,
  Zap: Zap,
  ShieldAlert: ShieldAlert,
  Radio: Radio,
  Grid: Grid,
  Keyboard: Keyboard,
  PenTool: PenTool,
  Boxes: Boxes,
  Crosshair: Crosshair,
  Sparkles: Sparkles,
  Compass: Compass,
  Sword: Sword,
  Disc: Disc,
  Hexagon: Hexagon,
  Terminal: Terminal,
  Flame: Flame,
  Rocket: Rocket,
  Pickaxe: Pickaxe,
  Ghost: Ghost,
  Wind: Wind,
  Footprints: Footprints,
  CircleDot: CircleDot,
  Target: Target,
  Activity: Activity,
  Grid3X3: Grid3X3,
  Trophy: Trophy,
};

export const GameCard: React.FC<GameCardProps> = ({
  game,
  highScore,
  isFavorite,
  onSelect,
  onToggleFavorite,
  index = 0,
}) => {
  const IconComponent = ICON_MAP[game.icon] || Zap;

  const handleCardClick = () => {
    sounds.playClick();
    onSelect(game.id);
  };

  return (
    <motion.div
      id={`game-card-${game.id}`}
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.92, transition: { duration: 0.15, ease: 'easeOut' } }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.035, 0.35),
        ease: [0.22, 1, 0.36, 1],
        layout: {
          duration: 0.28,
          ease: [0.22, 1, 0.36, 1],
        },
      }}
      whileHover={{ y: -4, transition: { duration: 0.18, ease: 'easeOut' } }}
      whileTap={{ scale: 0.98 }}
      onClick={handleCardClick}
      className="group relative flex flex-col justify-between p-4 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-[#F43F5E] transition-colors duration-200 cursor-pointer overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
    >
      {/* Top Header Row: Category Badge & Favorite Button */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider"
            style={{
              backgroundColor: `${game.accentColor}18`,
              color: game.accentColor,
            }}
          >
            {game.category}
          </span>
          <span className="text-[10px] text-[#71717A]">
            • {game.sessionLength}
          </span>
        </div>

        <button
          type="button"
          id={`fav-btn-${game.id}`}
          onClick={(e) => {
            e.stopPropagation();
            sounds.playPop();
            onToggleFavorite(game.id, e);
          }}
          className={`p-1.5 rounded-lg transition-all ${
            isFavorite
              ? 'text-[#F43F5E] bg-[#F43F5E]/10'
              : 'text-[#52525B] hover:text-[#A1A1AA]'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#F43F5E]' : ''}`} />
        </button>
      </div>

      {/* Middle Thumbnail Visual Graphic */}
      <div className="relative my-3.5 w-full h-28 rounded-lg bg-[#0A0A0B] border border-[#27272A]/70 flex items-center justify-center overflow-hidden">
        {/* Dynamic Abstract Game Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-sm"
          style={{
            backgroundColor: `${game.accentColor}14`,
            color: game.accentColor,
          }}
        >
          <IconComponent className="w-6 h-6" />
        </div>

        {/* Hover "PLAY" Overlay */}
        <div className="absolute inset-0 bg-[#0A0A0B]/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 backdrop-blur-[1px]">
          <span className="px-3.5 py-1 rounded-md font-bold text-xs bg-white text-black flex items-center gap-1.5 shadow-md">
            <Play className="w-3 h-3 fill-current" /> PLAY
          </span>
        </div>
      </div>

      {/* Bottom Title, Tagline & High Score */}
      <div className="z-10 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-bold text-base text-white group-hover:text-white transition-colors truncate">
            {game.title}
          </h3>
          {highScore > 0 && (
            <span className="text-[10px] font-mono-arcade text-amber-400 font-bold bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
              BEST {highScore.toLocaleString()}
            </span>
          )}
        </div>
        <p className="text-xs text-[#71717A] line-clamp-1">
          {game.tagline}
        </p>
      </div>
    </motion.div>
  );
};

