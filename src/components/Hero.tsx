import React from 'react';
import { Shuffle, ArrowDown, Sparkles } from 'lucide-react';
import { sounds } from '../lib/sound';

interface HeroProps {
  onPlayRandom: () => void;
  onBrowseGames: () => void;
  totalGames: number;
}

export const Hero: React.FC<HeroProps> = ({
  onPlayRandom,
  onBrowseGames,
  totalGames,
}) => {
  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-8 pb-4 select-none">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        {/* Left Side: Headlines & Description */}
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#A1A1AA] tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]" />
            <span>{totalGames} MINI-GAMES • 0 SEC ONBOARDING</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            Tiny games. <span className="text-[#F43F5E]">Instant play.</span>
          </h1>

          <p className="text-[#71717A] text-sm sm:text-base max-w-lg leading-relaxed">
            Pick a game, understand it in 5 seconds, play for 5 minutes. No accounts, no tutorials, just fun.
          </p>
        </div>

        {/* Right Side: CTAs matching Sophisticated Dark design */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            id="hero-play-random-btn"
            onClick={() => {
              sounds.playSuccess();
              onPlayRandom();
            }}
            className="bg-white text-black px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-[#F4F4F5] active:scale-95 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            <span>PLAY RANDOM GAME</span>
          </button>

          <button
            type="button"
            id="hero-browse-btn"
            onClick={() => {
              sounds.playClick();
              onBrowseGames();
            }}
            className="bg-[#18181B] text-white border border-[#27272A] px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-[#27272A] hover:border-[#3F3F46] transition-all flex items-center gap-2 cursor-pointer"
          >
            <ArrowDown className="w-4 h-4 text-[#A1A1AA]" />
            <span>BROWSE ALL</span>
          </button>
        </div>
      </div>
    </section>
  );
};

