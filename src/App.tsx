/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GAMES_REGISTRY, GameEntry } from './data/games';
import { GameDefinition, UserStats, AppTheme } from './types';
import {
  getStoredStats,
  recordGamePlay,
  recordScore,
  toggleFavoriteGame,
  updateSoundPreference,
  updateHapticsPreference,
  updateThemePreference,
  clearAllStats,
} from './lib/storage';
import { sounds } from './lib/sound';
import { haptics } from './lib/haptics';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { FilterBar } from './components/FilterBar';
import { GameCard } from './components/GameCard';
import { GameShell } from './components/GameShell';
import { RecentlyPlayedSection } from './components/RecentlyPlayedSection';
import { StatsModal } from './components/StatsModal';
import { StressTester } from './components/StressTester';
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, Gamepad2, Shuffle, Heart, BarChart2, Globe, Trophy, Medal, Activity } from 'lucide-react';

export default function App() {
  const [stats, setStats] = useState<UserStats>(() => getStoredStats());
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'recent'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [statsModalOpen, setStatsModalOpen] = useState<boolean>(false);
  const [stressTesterOpen, setStressTesterOpen] = useState<boolean>(false);
  const [statsModalTab, setStatsModalTab] = useState<'stats' | 'achievements' | 'leaderboards'>('stats');
  const [statsModalGameId, setStatsModalGameId] = useState<string | undefined>(undefined);

  // Sync sound settings with sound engine
  useEffect(() => {
    sounds.setMuted(!stats.soundEnabled);
    sounds.setVolume(stats.volume);
  }, [stats.soundEnabled, stats.volume]);

  // Sync haptics settings with haptics engine
  useEffect(() => {
    haptics.setEnabled(stats.hapticsEnabled ?? true);
  }, [stats.hapticsEnabled]);

  // Sync theme mode with document element & body
  useEffect(() => {
    const validThemes: AppTheme[] = [
      'default',
      'retro-monochrome',
      'cyberpunk',
      'matrix-emerald',
      'sunset-amber',
    ];
    const currentTheme: AppTheme = validThemes.includes(stats.theme as AppTheme)
      ? (stats.theme as AppTheme)
      : 'default';

    document.documentElement.setAttribute('data-theme', currentTheme);
    document.body.setAttribute('data-theme', currentTheme);

    // Remove all possible theme classes first
    validThemes.forEach((t) => {
      document.documentElement.classList.remove(`theme-${t}`, t);
      document.body.classList.remove(`theme-${t}`, t);
    });

    if (currentTheme !== 'default') {
      document.documentElement.classList.add(`theme-${currentTheme}`, currentTheme);
      document.body.classList.add(`theme-${currentTheme}`, currentTheme);
    }
  }, [stats.theme]);

  // Global key bindings: '/' to search, 'Esc' to close search/modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeGameId) return; // Ignore homepage keys if in game shell

      if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false);
        if (statsModalOpen) setStatsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeGameId, searchOpen, statsModalOpen]);

  // Launch a game
  const handleLaunchGame = useCallback((gameId: string) => {
    haptics.click();
    const updated = recordGamePlay(gameId);
    setStats(updated);
    setActiveGameId(gameId);
  }, []);

  const handleOpenStats = useCallback((tab: 'stats' | 'achievements' | 'leaderboards' = 'stats', gameId?: string) => {
    haptics.light();
    setStatsModalTab(tab);
    setStatsModalGameId(gameId);
    setStatsModalOpen(true);
  }, []);

  // Launch a random game (avoids repeating previous)
  const handlePlayRandomGame = useCallback(() => {
    haptics.medium();
    const available = GAMES_REGISTRY.filter((g) => g.id !== activeGameId);
    const chosen = available[Math.floor(Math.random() * available.length)] || GAMES_REGISTRY[0];
    handleLaunchGame(chosen.id);
  }, [activeGameId, handleLaunchGame]);

  // Toggle favorite
  const handleToggleFavorite = useCallback((gameId: string) => {
    haptics.light();
    const updated = toggleFavoriteGame(gameId);
    setStats(updated);
  }, []);

  // Sound preference toggle
  const handleToggleSound = useCallback(() => {
    const newSound = !stats.soundEnabled;
    const updated = updateSoundPreference(newSound);
    sounds.setMuted(!newSound);
    setStats(updated);
  }, [stats.soundEnabled]);

  // Haptics preference toggle
  const handleToggleHaptics = useCallback(() => {
    const newHaptics = !(stats.hapticsEnabled ?? true);
    const updated = updateHapticsPreference(newHaptics);
    haptics.setEnabled(newHaptics);
    if (newHaptics) {
      haptics.combo();
    }
    setStats(updated);
  }, [stats.hapticsEnabled]);

  // Theme preference toggle
  const handleUpdateTheme = useCallback((theme: AppTheme) => {
    const updated = updateThemePreference(theme);
    setStats(updated);
  }, []);

  // Save score from inside GameShell
  const handleSaveScore = useCallback((gameId: string, score: number) => {
    const result = recordScore(gameId, score);
    setStats(result.stats);
    return { isNewHighScore: result.isNewHighScore };
  }, []);

  // Clear data
  const handleClearData = useCallback(() => {
    const fresh = clearAllStats();
    setStats(fresh);
  }, []);

  // Recently played game objects
  const recentGameDefs = useMemo(() => {
    return stats.recentlyPlayed
      .map((id) => GAMES_REGISTRY.find((g) => g.id === id))
      .filter((g): g is GameEntry => Boolean(g));
  }, [stats.recentlyPlayed]);

  // Filtered games collection
  const filteredGames = useMemo(() => {
    return GAMES_REGISTRY.filter((game) => {
      // Tab filter
      if (activeTab === 'favorites' && !stats.favorites.includes(game.id)) {
        return false;
      }
      if (activeTab === 'recent' && !stats.recentlyPlayed.includes(game.id)) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'All' && game.category !== selectedCategory) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = game.title.toLowerCase().includes(q);
        const matchesDesc = game.description.toLowerCase().includes(q);
        const matchesTagline = game.tagline.toLowerCase().includes(q);
        const matchesCategory = game.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesTagline && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [activeTab, selectedCategory, searchQuery, stats.favorites, stats.recentlyPlayed]);

  const activeGame = GAMES_REGISTRY.find((g) => g.id === activeGameId);

  const scrollToLibrary = () => {
    const el = document.getElementById('library-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* If a game is active, render full-screen unified Game Shell */}
      {activeGame && (
        <GameShell
          key={activeGame.id}
          game={activeGame}
          bestScore={stats.highScores[activeGame.id] || 0}
          soundEnabled={stats.soundEnabled}
          hapticsEnabled={stats.hapticsEnabled ?? true}
          onToggleSound={handleToggleSound}
          onToggleHaptics={handleToggleHaptics}
          onBackToArcade={() => setActiveGameId(null)}
          onPlayNextRandom={handlePlayRandomGame}
          onSaveScore={handleSaveScore}
          onViewLeaderboard={(gameId) => handleOpenStats('leaderboards', gameId)}
        />
      )}

      {/* Main Arcade Homepage */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab as any);
            setSelectedCategory('All');
          }}
          soundEnabled={stats.soundEnabled}
          onToggleSound={handleToggleSound}
          onOpenStats={handleOpenStats}
          searchOpen={searchOpen}
          onToggleSearch={() => setSearchOpen((prev) => !prev)}
          favoriteCount={stats.favorites.length}
          stats={stats}
        />

        {/* Hero Section (only when not searching / on all games tab) */}
        {activeTab === 'all' && !searchQuery && (
          <Hero
            onPlayRandom={handlePlayRandomGame}
            onBrowseGames={scrollToLibrary}
            totalGames={GAMES_REGISTRY.length}
          />
        )}

        {/* Continue Playing / Recently Played Shelf */}
        {activeTab === 'all' && !searchQuery && (
          <RecentlyPlayedSection
            recentGames={recentGameDefs}
            highScores={stats.highScores}
            onSelectGame={handleLaunchGame}
          />
        )}

        {/* Filter Controls (Categories + Search) */}
        <FilterBar
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchOpen={searchOpen}
          onCloseSearch={() => setSearchOpen(false)}
          totalVisible={filteredGames.length}
        />

        {/* Game Cards Grid */}
        <main className="w-full max-w-6xl mx-auto px-4 py-4 flex-1">
          {filteredGames.length > 0 ? (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredGames.map((game, index) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    highScore={stats.highScores[game.id] || 0}
                    playCount={stats.playCounts[game.id] || 0}
                    isFavorite={stats.favorites.includes(game.id)}
                    onSelect={handleLaunchGame}
                    onToggleFavorite={handleToggleFavorite}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full py-16 flex flex-col items-center justify-center text-center p-6 rounded-3xl bg-neutral-900/40 border border-neutral-800"
            >
              <Gamepad2 className="w-12 h-12 text-neutral-600 mb-3" />
              <h3 className="text-lg font-display font-bold text-neutral-300 mb-1">
                No mini-games found
              </h3>
              <p className="text-xs text-neutral-500 font-mono-arcade mb-4 max-w-xs">
                {activeTab === 'favorites'
                  ? 'You haven’t favorited any games yet. Click the heart icon on any card to add it.'
                  : 'Try clearing your search query or switching category filters.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setActiveTab('all');
                }}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-mono-arcade font-bold text-neutral-200"
              >
                Reset Filters
              </button>
            </motion.div>
          )}
        </main>
      </div>

      {/* Footer / Quick Stats Bar */}
      <footer className="w-full border-t border-[#27272A] bg-[#0A0A0B] py-4 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono-arcade text-[#52525B]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#F43F5E] animate-pulse" />
            <span className="font-bold text-[#A1A1AA]">MICRO ARCADE</span>
            <span>• {GAMES_REGISTRY.length} MINI-GAMES • 0 SEC ONBOARDING</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handlePlayRandomGame}
              className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5 text-[#F43F5E]" /> Random Game
            </button>
            <button
              type="button"
              onClick={() => handleOpenStats('achievements')}
              className="hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Medal className="w-3.5 h-3.5 text-amber-400" /> Badges
            </button>
            <button
              type="button"
              onClick={() => handleOpenStats('leaderboards')}
              className="hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" /> Leaderboards
            </button>
            <button
              type="button"
              onClick={() => handleOpenStats('stats')}
              className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart2 className="w-3.5 h-3.5 text-[#F43F5E]" /> Statistics
            </button>
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => setStressTesterOpen(true)}
                className="hover:text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer text-emerald-500/80"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Stress Test
              </button>
            )}
          </div>
        </div>
      </footer>

      {import.meta.env.DEV && stressTesterOpen && (
        <StressTester onClose={() => setStressTesterOpen(false)} />
      )}

      {/* Statistics Modal Overlay */}
      {statsModalOpen && (
        <StatsModal
          stats={stats}
          initialTab={statsModalTab}
          initialGameId={statsModalGameId}
          onClose={() => setStatsModalOpen(false)}
          onUpdateSound={(enabled, volume) => {
            const updated = updateSoundPreference(enabled, volume);
            setStats(updated);
          }}
          onUpdateHaptics={(enabled) => {
            const updated = updateHapticsPreference(enabled);
            setStats(updated);
          }}
          onUpdateTheme={handleUpdateTheme}
          onClearData={handleClearData}
          onLaunchGame={(gameId) => {
            setStatsModalOpen(false);
            handleLaunchGame(gameId);
          }}
        />
      )}
    </div>
  );
}
