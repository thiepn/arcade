import React, { useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { sounds } from '../lib/sound';

interface FilterBarProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchOpen: boolean;
  onCloseSearch: () => void;
  totalVisible: number;
}

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'All', label: 'ALL' },
  { id: 'Reflex', label: 'REFLEX' },
  { id: 'Puzzle', label: 'PUZZLE' },
  { id: 'Timing', label: 'TIMING' },
  { id: 'Typing', label: 'TYPING' },
  { id: 'Physics', label: 'PHYSICS' },
  { id: 'Strategy', label: 'STRATEGY' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  searchOpen,
  onCloseSearch,
  totalVisible,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  return (
    <div id="library-section" className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-4 flex flex-col gap-3">
      {/* Search Input Bar (Shown if toggled or if query active) */}
      {(searchOpen || searchQuery) && (
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search games..."
            className="w-full pl-10 pr-9 py-2 rounded-full bg-[#18181B] border border-[#27272A] text-sm text-[#E4E4E7] placeholder-[#71717A] focus:outline-none focus:border-[#F43F5E] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#71717A] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Category Pills & Total Counter */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 scrollbar-none">
        <nav className="flex items-center gap-2 min-w-max">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                id={`filter-btn-${cat.id.toLowerCase()}`}
                onClick={() => {
                  sounds.playPop();
                  onSelectCategory(cat.id);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#F43F5E] text-white shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                    : 'bg-[#18181B] border border-[#27272A] text-[#A1A1AA] hover:text-white hover:border-[#3F3F46]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </nav>

        <span className="text-[11px] text-[#52525B] font-mono-arcade hidden sm:block shrink-0">
          {totalVisible} {totalVisible === 1 ? 'GAME' : 'GAMES'}
        </span>
      </div>
    </div>
  );
};

