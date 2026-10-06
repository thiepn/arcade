import { startLeaderboardSync } from './lib/leaderboardOutbox';
import { currentBestAP,currentBestRaw } from './lib/localCompetition';
import {
  getGlobalLeaderboardForGame,
  isLiveLeaderboardConfigured,
  LEADERBOARD_UPDATED_EVENT,
  refreshGameLeaderboard,
  refreshOverallLeaderboard,
} from './lib/leaderboards';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { RecentlyPlayedSection } from './components/RecentlyPlayedSection';
import { DailyChallengeCard } from './components/DailyChallengeCard';
import { ProgressionHomeSection } from './components/ProgressionHomeSection';
import { PwaStatus } from './components/PwaStatus';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sparkles, Gamepad2, Shuffle, Heart, BarChart2, Globe, Trophy, Medal, Activity, UserRound } from 'lucide-react';
import { getDailyChallengeSummary, getUtcDayKey } from './lib/dailyChallenge';
import { buildResultMeta } from './lib/resultMeta';


const GameShell = lazy(() => import('./components/GameShell').then(({ GameShell }) => ({ default: GameShell })));
const StatsModal = lazy(() => import('./components/StatsModal').then(({ StatsModal }) => ({ default: StatsModal })));
const OverallLeaderboardModal = lazy(() => import('./components/OverallLeaderboardModal').then(({ OverallLeaderboardModal }) => ({ default: OverallLeaderboardModal })));
const PlayerProfileModal = lazy(() => import('./components/PlayerProfileModal').then(({ PlayerProfileModal }) => ({ default: PlayerProfileModal })));
const StressTester = lazy(() => import('./components/StressTester').then(({ StressTester }) => ({ default: StressTester })));

const DeferredSurface: React.FC<{ label: string; fullscreen?: boolean }> = ({ label, fullscreen = false }) => (
  <div
    className={`${fullscreen ? 'fixed inset-0 z-[70]' : 'fixed inset-0 z-[90]'} flex items-center justify-center bg-[#0A0A0B]/92 p-6 text-white backdrop-blur-sm`}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div className="flex items-center gap-3 rounded-xl border border-[#27272A] bg-[#111114] px-4 py-3 text-xs font-mono-arcade text-zinc-300 shadow-2xl">
      <span className="h-3 w-3 animate-pulse rounded-full bg-cyan-400" aria-hidden="true" />
      {label}
    </div>
  </div>
);

export default function App() {
  const reduceMotion = useReducedMotion() === true;
  useEffect(startLeaderboardSync, []);
  useEffect(()=>{const refresh=(e:StorageEvent)=>{if(e.key==='micro_arcade_stats_v3')setStats(getStoredStats());};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);},[]);
  const [stats, setStats] = useState<UserStats>(() => getStoredStats());
  const [dailyDayKey, setDailyDayKey] = useState(() => getUtcDayKey());
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'recent'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [statsModalOpen, setStatsModalOpen] = useState<boolean>(false);
  const [overallLeaderboardOpen, setOverallLeaderboardOpen] = useState<boolean>(false);
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [stressTesterOpen, setStressTesterOpen] = useState<boolean>(false);
  const [statsModalTab, setStatsModalTab] = useState<'stats' | 'achievements' | 'leaderboards'>('stats');
  const [statsModalGameId, setStatsModalGameId] = useState<string | undefined>(undefined);
  const [homeLeaderboardTick, setHomeLeaderboardTick] = useState(0);
  const [rankLoadingIds, setRankLoadingIds] = useState<Set<string> | null>(() =>
    isLiveLeaderboardConfigured() ? null : new Set()
  );
  const [rankUnavailableIds, setRankUnavailableIds] = useState<Set<string>>(new Set());
  const [rankSummaryUnavailable, setRankSummaryUnavailable] = useState(false);
  const runBaselineRef = useRef<UserStats | null>(null);

  useEffect(() => {
    const handleLeaderboardUpdate = () => setHomeLeaderboardTick((tick) => tick + 1);
    window.addEventListener(LEADERBOARD_UPDATED_EVENT, handleLeaderboardUpdate);
    return () => window.removeEventListener(LEADERBOARD_UPDATED_EVENT, handleLeaderboardUpdate);
  }, []);

  useEffect(() => {
    const refreshDailyDay = () => {
      const next = getUtcDayKey();
      setDailyDayKey((current) => current === next ? current : next);
    };
    const timer = window.setInterval(refreshDailyDay, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshDailyDay();
    };
    window.addEventListener('focus', refreshDailyDay);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshDailyDay);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Keep the home library's per-game AP/rank summary current without fetching all 32 boards.
  useEffect(() => {
    if (activeGameId !== null) return;
    if (!isLiveLeaderboardConfigured()) {
      setRankLoadingIds(new Set());
      setRankUnavailableIds(new Set());
      setRankSummaryUnavailable(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const refreshHomeCompetition = async () => {
      const candidates = new Set<string>();
      for (const game of GAMES_REGISTRY) {
        if (currentBestAP(stats, game.id) > 0) candidates.add(game.id);
      }

      setRankLoadingIds(null);
      setRankUnavailableIds(new Set());
      setRankSummaryUnavailable(false);

      try {
        const overall = await refreshOverallLeaderboard({ signal: controller.signal });
        for (const contribution of overall.contributions ?? []) candidates.add(contribution.gameId);
      } catch {
        if (!cancelled) setRankSummaryUnavailable(true);
      }

      if (cancelled) return;

      const validIds = [...candidates].filter((gameId) =>
        GAMES_REGISTRY.some((game) => game.id === gameId)
      );
      setRankLoadingIds(new Set(validIds));

      let cursor = 0;
      const worker = async () => {
        while (!cancelled) {
          const gameId = validIds[cursor++];
          if (!gameId) return;
          try {
            await refreshGameLeaderboard(gameId, 'all', { signal: controller.signal });
          } catch {
            if (!cancelled) {
              setRankUnavailableIds((current) => {
                const next = new Set(current);
                next.add(gameId);
                return next;
              });
            }
          } finally {
            if (!cancelled) {
              setRankLoadingIds((current) => {
                if (current === null || !current.has(gameId)) return current;
                const next = new Set(current);
                next.delete(gameId);
                return next;
              });
            }
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(4, validIds.length) }, () => worker())
      );
    };

    void refreshHomeCompetition();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeGameId]);

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

  // Global home shortcuts stay aligned with the same product actions shown in the header.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeGameId || statsModalOpen || overallLeaderboardOpen || profileOpen) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const editing = Boolean(target?.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));

      if (e.key === '/' && !editing) {
        e.preventDefault();
        setSearchOpen(true);
      } else if ((e.key === 'm' || e.key === 'M') && !editing && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
        e.preventDefault();
        sounds.playPop();
        const newSound = !stats.soundEnabled;
        const updated = updateSoundPreference(newSound);
        sounds.setMuted(!newSound);
        setStats(updated);
      } else if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeGameId, searchOpen, stats.soundEnabled, statsModalOpen, overallLeaderboardOpen, profileOpen]);

  // Launch a game
  const handleLaunchGame = useCallback((gameId: string) => {
    haptics.click();
    runBaselineRef.current = getStoredStats();
    const updated = recordGamePlay(gameId);
    setStats(updated);
    setActiveGameId(gameId);
  }, []);

  const handleOpenStats = useCallback((tab: 'stats' | 'achievements' | 'leaderboards' = 'stats', gameId?: string) => {
    haptics.light();
    if (tab === 'leaderboards' && !gameId) {
      setOverallLeaderboardOpen(true);
      return;
    }
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
  const handleSaveScore = useCallback((gameId: string, score: number, details?: import("./types").ScoreDetails) => {
    const baseline = runBaselineRef.current ?? getStoredStats();
    const result = recordScore(gameId, score, details);
    const meta = buildResultMeta(baseline, result.stats, gameId, { isPersonalBest: result.isNewHighScore });
    runBaselineRef.current = result.stats;
    setStats(result.stats);
    return { isNewHighScore: result.isNewHighScore, meta };
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

  const dailyChallenge = useMemo(
    () => getDailyChallengeSummary(stats, dailyDayKey),
    [stats, dailyDayKey]
  );
  const dailyChallengeGame = useMemo(
    () => GAMES_REGISTRY.find((game) => game.id === dailyChallenge.definition.gameId),
    [dailyChallenge.definition.gameId]
  );

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
        const q = searchQuery.trim().toLowerCase();
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

  const gameCompetition = useMemo(() => {
    void homeLeaderboardTick;
    return Object.fromEntries(
      GAMES_REGISTRY.map((game) => {
        const board = getGlobalLeaderboardForGame(game.id);
        return [
          game.id,
          {
            ap: Math.max(currentBestAP(stats, game.id), board.userEntry?.score ?? 0),
            rank: board.userRank,
          },
        ];
      })
    ) as Record<string, { ap: number; rank: number | null }>;
  }, [stats, homeLeaderboardTick]);

  const activeGame = GAMES_REGISTRY.find((g) => g.id === activeGameId);

  const scrollToLibrary = () => {
    const el = document.getElementById('library-section');
    if (el) {
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  };

  return (
    <div data-p31-motion={reduceMotion ? 'reduced' : 'full'} className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-200"
      onKeyDown={(event) => {
        const target = event.target instanceof HTMLElement ? event.target : null;
        const editing = target?.matches('input, textarea, select, [contenteditable="true"]');
        const activatingControl = (event.code === 'Space' || event.code === 'Enter') && target?.closest('button, a[href]');
        // Game listeners on window must not cancel native button activation or text entry.
        if ((editing && event.key !== 'Escape') || activatingControl) event.stopPropagation();
      }}>
      <a href="#library-section" className="skip-link" inert={Boolean(activeGame) || statsModalOpen || overallLeaderboardOpen || profileOpen || stressTesterOpen}>Skip to game library</a>
      {/* If a game is active, render full-screen unified Game Shell */}
      {activeGame && (
        <ErrorBoundary key={`game-shell-${activeGame.id}`} onReset={() => setActiveGameId(null)}>
          <Suspense fallback={<DeferredSurface label={`Loading ${activeGame.title}…`} fullscreen />}>
            <GameShell
              key={activeGame.id}
              game={activeGame}
              obscured={statsModalOpen || overallLeaderboardOpen || profileOpen}
              bestScore={currentBestAP(stats,activeGame.id)}
              bestRawScore={currentBestRaw(stats,activeGame.id)}
              soundEnabled={stats.soundEnabled}
              hapticsEnabled={stats.hapticsEnabled ?? true}
              onToggleSound={handleToggleSound}
              onToggleHaptics={handleToggleHaptics}
              onBackToArcade={() => setActiveGameId(null)}
              onPlayNextRandom={handlePlayRandomGame}
              onPlayRecommended={handleLaunchGame}
              onSaveScore={handleSaveScore}
              onViewLeaderboard={(gameId) => handleOpenStats('leaderboards', gameId)}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Main Arcade Homepage */}
      <div className="flex-1 flex flex-col" inert={Boolean(activeGame) || statsModalOpen || overallLeaderboardOpen || profileOpen || stressTesterOpen}>
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
          onOpenProfile={() => setProfileOpen(true)}
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

        {activeTab === 'all' && !searchQuery && dailyChallengeGame && (
          <DailyChallengeCard
            game={dailyChallengeGame}
            summary={dailyChallenge}
            onPlay={() => handleLaunchGame(dailyChallengeGame.id)}
          />
        )}

        {activeTab === 'all' && !searchQuery && (
          <ProgressionHomeSection
            stats={stats}
            excludedGameId={dailyChallenge.definition.gameId}
            onPlayGame={handleLaunchGame}
            onOpenAchievements={() => handleOpenStats('achievements')}
          />
        )}

        {/* Continue Playing / Recently Played Shelf */}
        {activeTab === 'all' && !searchQuery && (
          <RecentlyPlayedSection
            recentGames={recentGameDefs}
            highScores={Object.fromEntries(GAMES_REGISTRY.map(g=>[g.id,currentBestAP(stats,g.id)]))}
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
        <main id="library-section" tabIndex={-1} aria-label="Game library" className="w-full max-w-6xl mx-auto px-4 py-4 flex-1 outline-none">
          {filteredGames.length > 0 ? (
            <motion.div layout={!reduceMotion} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence initial={!reduceMotion} mode={reduceMotion ? "sync" : "popLayout"}>
                {filteredGames.map((game, index) => {
                  const competition = gameCompetition[game.id] ?? { ap: 0, rank: null };
                  const rankLoading =
                    competition.rank === null &&
                    (rankLoadingIds === null || rankLoadingIds.has(game.id));
                  const rankUnavailable =
                    competition.rank === null &&
                    !rankLoading &&
                    (rankUnavailableIds.has(game.id) || rankSummaryUnavailable);
                  return (
                    <GameCard
                      key={game.id}
                      game={game}
                      highScore={competition.ap}
                      rank={competition.rank}
                      rankLoading={rankLoading}
                      rankUnavailable={rankUnavailable}
                      playCount={stats.playCounts[game.id] || 0}
                      isFavorite={stats.favorites.includes(game.id)}
                      onSelect={handleLaunchGame}
                      onToggleFavorite={handleToggleFavorite}
                      index={index}
                    />
                  );
                })}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
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
      <footer inert={Boolean(activeGame) || statsModalOpen || overallLeaderboardOpen || profileOpen || stressTesterOpen} className="w-full border-t border-[#27272A] bg-[#0A0A0B] py-4 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono-arcade text-[#52525B]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#F43F5E] animate-pulse" />
            <span className="font-bold text-[#A1A1AA]">MICRO ARCADE</span>
            <span>• {GAMES_REGISTRY.length} MINI-GAMES • 0 SEC ONBOARDING</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
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
              onClick={() => setProfileOpen(true)}
              className="hover:text-violet-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <UserRound className="w-3.5 h-3.5 text-violet-400" /> Profile
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

      <PwaStatus activeGame={Boolean(activeGame)} />

      {import.meta.env.DEV && stressTesterOpen && (
        <Suspense fallback={<DeferredSurface label="Loading developer tools…" />}>
          <StressTester onClose={() => setStressTesterOpen(false)} />
        </Suspense>
      )}

      {overallLeaderboardOpen && (
        <Suspense fallback={<DeferredSurface label="Loading leaderboards…" />}>
          <OverallLeaderboardModal stats={stats} onClose={() => setOverallLeaderboardOpen(false)} />
        </Suspense>
      )}

      {profileOpen && (
        <Suspense fallback={<DeferredSurface label="Loading player profile…" />}>
          <PlayerProfileModal stats={stats} onClose={() => setProfileOpen(false)} />
        </Suspense>
      )}

      {/* Statistics Modal Overlay */}
      {statsModalOpen && (
        <Suspense fallback={<DeferredSurface label="Loading arcade data…" />}>
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
        </Suspense>
      )}
    </div>
  );
}
