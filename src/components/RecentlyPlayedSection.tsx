import React from 'react';
import { GameDefinition } from '../types';
import { Play, Clock } from 'lucide-react';
import { sounds } from '../lib/sound';

interface RecentlyPlayedSectionProps {
  recentGames: GameDefinition[];
  highScores: Record<string, number>;
  onSelectGame: (gameId: string) => void;
}

export const RecentlyPlayedSection: React.FC<RecentlyPlayedSectionProps> = ({
  recentGames,
  highScores,
  onSelectGame,
}) => {
  if (recentGames.length === 0) return null;

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-2 pb-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-[#E4E4E7] flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#F43F5E]" />
          <span>Continue Playing</span>
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {recentGames.map((game) => {
          const score = highScores[game.id] || 0;
          return (
            <button
              key={game.id}
              type="button"
              id={`recent-game-${game.id}`}
              onClick={() => {
                sounds.playClick();
                onSelectGame(game.id);
              }}
              className="group p-3 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] hover:border-[#3F3F46] transition-all text-left flex flex-col justify-between gap-2 overflow-hidden hover:shadow-md cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: game.accentColor }}
                />
                <span className="text-[10px] uppercase font-bold text-[#71717A]">
                  {game.category}
                </span>
              </div>

              <div>
                <h4 className="font-bold text-sm text-[#E4E4E7] group-hover:text-white truncate">
                  {game.title}
                </h4>
                {score > 0 ? (
                  <span className="text-[10px] font-mono-arcade text-amber-400 font-semibold">
                    Best: {score.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono-arcade text-[#52525B]">
                    Instant Play
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end">
                <div className="p-1 rounded bg-white text-black opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                  <Play className="w-2.5 h-2.5 fill-current" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

