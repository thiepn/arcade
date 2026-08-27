import React, { useMemo, useState, useEffect } from 'react';
import { Volume2, VolumeX, Search, BarChart2, Heart, Globe, Medal, Clock, Trophy, Sparkles, Flame, ChevronRight } from 'lucide-react';
import { sounds } from '../lib/sound';
import { UserStats } from '../types';
import { getPlayerLevelInfo, getPlayerRankProfile } from '../lib/achievements';

interface HeaderProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenStats: (tab?: 'stats' | 'achievements' | 'leaderboards') => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  favoriteCount: number;
  stats: UserStats;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  soundEnabled,
  onToggleSound,
  onOpenStats,
  searchOpen,
  onToggleSearch,
  favoriteCount,
  stats,
}) => {
  const levelInfo = useMemo(() => getPlayerLevelInfo(stats), [stats]);
  const rankProfile = useMemo(() => getPlayerRankProfile(stats), [stats]);

  // Session duration timer tracking time in current browser tab
  const [sessionSeconds, setSessionSeconds] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setSessionSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatSessionDuration = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#27272A] bg-[#0A0A0B]/95 backdrop-blur-xl shadow-lg shadow-black/40">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-16 flex items-center justify-between gap-1.5 sm:gap-4">
        {/* Left: Brand Logo & Main Navigation */}
        <div className="flex items-center gap-2 sm:gap-4 lg:gap-8 min-w-0">
          <div
            id="brand-logo-btn"
            onClick={() => {
              sounds.playClick();
              onSelectTab('all');
            }}
            className="flex items-center gap-2 cursor-pointer select-none group shrink-0"
          >
            <div className="w-7 h-7 bg-gradient-to-br from-[#F43F5E] via-[#E11D48] to-[#BE123C] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.45)] transition-all group-hover:scale-105 group-hover:rotate-3 border border-white/20">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm xs:text-base sm:text-lg font-black tracking-tight text-white group-hover:text-rose-300 transition-colors leading-none font-display">
                MICRO<span className="text-[#F43F5E]">ARCADE</span>
              </span>
              <span className="text-[8px] xs:text-[9px] font-mono-arcade text-[#71717A] tracking-wider uppercase leading-tight hidden xs:block">
                World Circuit
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-xl bg-[#121215] border border-[#27272A] text-xs font-mono-arcade text-[#A1A1AA]">
            <button
              type="button"
              id="nav-all-games-btn"
              onClick={() => {
                sounds.playPop();
                onSelectTab('all');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-[#27272A] text-white shadow-sm'
                  : 'hover:text-white hover:bg-[#18181B]'
              }`}
            >
              <span>All Games</span>
            </button>

            <button
              type="button"
              id="nav-favorites-btn"
              onClick={() => {
                sounds.playPop();
                onSelectTab('favorites');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
                activeTab === 'favorites'
                  ? 'bg-[#F43F5E]/20 text-[#F43F5E] border border-[#F43F5E]/40 shadow-sm'
                  : 'hover:text-white hover:bg-[#18181B]'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${activeTab === 'favorites' ? 'fill-current' : ''}`} />
              <span>Favorites</span>
              {favoriteCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#F43F5E] text-white rounded-full text-[9px] font-black">
                  {favoriteCount}
                </span>
              )}
            </button>

            <button
              type="button"
              id="nav-recent-btn"
              onClick={() => {
                sounds.playPop();
                onSelectTab('recent');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                activeTab === 'recent'
                  ? 'bg-[#27272A] text-white shadow-sm'
                  : 'hover:text-white hover:bg-[#18181B]'
              }`}
            >
              <span>Recent</span>
            </button>
          </nav>
        </div>

        {/* Center / Right: Leaderboard, Rank Division, Session Timer & Action Tools */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Global Leaderboards Quick-Action Button */}
          <button
            type="button"
            id="header-leaderboards-pill-btn"
            onClick={() => {
              sounds.playScore();
              onOpenStats('leaderboards');
            }}
            className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-sky-900/30 to-[#121215] border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 text-xs font-mono-arcade font-bold flex items-center gap-1 sm:gap-1.5 transition-all hover:scale-105 shadow-[0_0_12px_rgba(56,189,248,0.15)] cursor-pointer group shrink-0"
            title="Open Global World Leaderboards & Records"
          >
            <Trophy className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-12 transition-transform" />
            <span className="hidden sm:inline">LEADERBOARD</span>
            <span className="sm:hidden text-[10px]">RANKS</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse hidden xs:inline-block" />
          </button>

          {/* Ranking & Tier Profile Pill */}
          <button
            type="button"
            id="header-rank-badge-btn"
            onClick={() => {
              sounds.playClick();
              onOpenStats('achievements');
            }}
            className="px-1.5 sm:px-3 py-1 rounded-xl bg-[#121215] hover:bg-[#1A1A1E] border transition-all cursor-pointer flex items-center gap-1 sm:gap-2 group relative select-none shadow-sm hover:scale-105 active:scale-95 shrink-0 max-w-[110px] sm:max-w-none overflow-hidden"
            style={{
              borderColor: `${rankProfile.color}60`,
              boxShadow: `0 0 12px ${rankProfile.glowColor}`,
            }}
            title={`Rank Tier: ${rankProfile.rankTierName} • ${rankProfile.title} (${rankProfile.badgeCount}/${rankProfile.totalBadges} Badges Unlocked)`}
          >
            {/* Level Orb */}
            <div
              className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-mono-arcade font-black text-black shrink-0 shadow-inner"
              style={{ backgroundColor: rankProfile.color }}
            >
              {rankProfile.rankLevel}
            </div>

            {/* Rank Details */}
            <div className="hidden md:flex flex-col text-left leading-none min-w-0 overflow-hidden">
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className="text-[10px] font-mono-arcade font-black uppercase tracking-tight truncate max-w-[65px] lg:max-w-none"
                  style={{ color: rankProfile.color }}
                >
                  {rankProfile.rankTierName}
                </span>
                <span className="text-[9px] text-[#71717A] font-mono-arcade shrink-0">
                  Lv.{levelInfo.level}
                </span>
              </div>
              {/* Micro Progress to next rank */}
              <div className="w-12 sm:w-16 h-1 bg-[#27272A] rounded-full overflow-hidden mt-0.5 shrink-0">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, rankProfile.completionPercent))}%`,
                    backgroundColor: rankProfile.color,
                  }}
                />
              </div>
            </div>

            <div className="md:hidden flex items-center text-[10px] font-mono-arcade font-bold truncate" style={{ color: rankProfile.color }}>
              R.{rankProfile.rankLevel}
            </div>
          </button>

          {/* Session Duration Tracker */}
          <div
            id="session-duration-display"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#121215] border border-[#27272A] text-[#71717A] text-[11px] font-mono-arcade select-none group hover:border-[#3F3F46] transition-colors shrink-0"
            title={`Active session duration in this tab: ${formatSessionDuration(sessionSeconds)}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <Clock className="w-3 h-3 text-[#71717A] group-hover:text-[#A1A1AA] transition-colors" />
            <span className="text-[#A1A1AA] font-mono tracking-wider tabular-nums">{formatSessionDuration(sessionSeconds)}</span>
          </div>

          {/* Search Toggle Button */}
          <button
            type="button"
            id="search-toggle-btn"
            onClick={() => {
              sounds.playPop();
              onToggleSearch();
            }}
            className={`p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
              searchOpen
                ? 'bg-[#F43F5E]/20 border-[#F43F5E] text-white shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                : 'bg-[#121215] hover:bg-[#1F1F23] text-[#A1A1AA] hover:text-white border-[#27272A]'
            }`}
            title="Search games (/)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Sound Toggle Button */}
          <button
            type="button"
            id="sound-toggle-btn"
            onClick={() => {
              sounds.playPop();
              onToggleSound();
            }}
            className={`p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
              soundEnabled
                ? 'bg-[#121215] border-[#27272A] text-[#F43F5E] hover:bg-[#1F1F23]'
                : 'bg-[#121215] border-[#27272A] text-[#52525B] hover:text-[#A1A1AA]'
            }`}
            title="Toggle Sound (M)"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#F43F5E]" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          {/* Stats & Dashboard Hub */}
          <button
            type="button"
            id="stats-open-btn"
            onClick={() => {
              sounds.playClick();
              onOpenStats('stats');
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-[#121215] hover:bg-[#1F1F23] text-[#A1A1AA] hover:text-white border border-[#27272A] transition-all cursor-pointer hover:border-[#3F3F46] shrink-0"
            title="Arcade Stats, Settings & Achievements"
          >
            <BarChart2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};



