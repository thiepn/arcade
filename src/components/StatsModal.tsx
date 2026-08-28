import React, { useState, useMemo, useEffect } from 'react';
import { useSafeTimeout } from '../hooks/useGameLoop';
import { UserStats, AppTheme } from '../types';
import { GAMES_REGISTRY, GameEntry } from '../data/games';
import {
  X,
  Trophy,
  Volume2,
  VolumeX,
  Flame,
  RotateCcw,
  Award,
  Globe,
  Crown,
  Medal,
  Play,
  RefreshCw,
  Sparkles,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Smartphone,
  Zap,
  Gamepad2,
  Star,
  Compass,
  Layers,
  Heart,
  Target,
  Orbit,
  Gem,
  Lock,
  CheckCircle2,
  Shield,
  Filter,
  Users,
  Search,
  ChevronDown,
  LayoutGrid,
  ListFilter,
  Check,
  BarChart3,
  Clock,
  Activity,
  Percent,
  Palette,
} from 'lucide-react';
import { sounds } from '../lib/sound';
import { haptics } from '../lib/haptics';
import {
  getGlobalLeaderboardForGame,
  getOverallArcadeLeaderboard,
  getDivisionColor,
  simulateLiveCompetition,
  resetAllLeaderboards,
  LeaderboardDivision,
  LeaderboardEntry,
  GlobalOverallEntry,
  LEADERBOARD_UPDATED_EVENT,
} from '../lib/leaderboards';
import {
  ACHIEVEMENTS_REGISTRY,
  Achievement,
  AchievementCategory,
  getPlayerRankProfile,
  getPlayerLevelInfo,
  RANK_TIERS,
  getTotalPlayCount,
  getTotalHighScore,
  getUniqueGamesCount,
  getBestGlobalRank,
} from '../lib/achievements';

interface StatsModalProps {
  stats: UserStats;
  onClose: () => void;
  onUpdateSound: (enabled: boolean, volume: number) => void;
  onUpdateHaptics?: (enabled: boolean) => void;
  onUpdateTheme?: (theme: AppTheme) => void;
  onClearData: () => void;
  onLaunchGame?: (gameId: string) => void;
  initialTab?: 'stats' | 'achievements' | 'leaderboards';
  initialGameId?: string;
}

const SEEN_BADGES_KEY = 'micro_arcade_seen_badges_v1';

export const StatsModal: React.FC<StatsModalProps> = ({
  stats,
  onClose,
  onUpdateSound,
  onUpdateHaptics,
  onUpdateTheme,
  onClearData,
  onLaunchGame,
  initialTab = 'stats',
  initialGameId,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'achievements' | 'leaderboards'>(initialTab);
  const [leaderboardScope, setLeaderboardScope] = useState<'perGame' | 'overall'>('overall');
  const [selectedGameId, setSelectedGameId] = useState<string>(
    initialGameId || GAMES_REGISTRY[0].id
  );
  
  // Game track selection controls
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const [gameCategoryFilter, setGameCategoryFilter] = useState<string>('all');
  const [gamePickerOpen, setGamePickerOpen] = useState(false);

  // Leaderboard filters
  const [divisionFilter, setDivisionFilter] = useState<'all' | LeaderboardDivision>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const setSafeTimeout = useSafeTimeout();

  useEffect(() => {
    const handleLeaderboardUpdate = () => setRefreshTick((tick) => tick + 1);
    window.addEventListener(LEADERBOARD_UPDATED_EVENT, handleLeaderboardUpdate);
    return () => window.removeEventListener(LEADERBOARD_UPDATED_EVENT, handleLeaderboardUpdate);
  }, []);

  // Achievement filters & search
  const [achievementFilter, setAchievementFilter] = useState<
    'all' | 'unlocked' | 'locked' | AchievementCategory
  >('all');
  const [achievementSearch, setAchievementSearch] = useState('');
  const [selectedBadge, setSelectedBadge] = useState<Achievement | null>(null);
  const [selectedRankTierInfo, setSelectedRankTierInfo] = useState<(typeof RANK_TIERS)[number] | null>(null);

  // Stats tab controls
  const [statsSearchQuery, setStatsSearchQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Track acknowledged / seen badges in local storage
  const [seenBadgeIds, setSeenBadgeIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(SEEN_BADGES_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedBadge) {
          setSelectedBadge(null);
        } else if (selectedRankTierInfo) {
          setSelectedRankTierInfo(null);
        } else if (gamePickerOpen) {
          setGamePickerOpen(false);
        } else {
          sounds.playPop();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedBadge, selectedRankTierInfo, gamePickerOpen]);

  // Overall player calculated data
  const totalPlays = getTotalPlayCount(stats);
  const totalScore = getTotalHighScore(stats);
  const uniqueGamesPlayed = getUniqueGamesCount(stats);
  const bestGlobalRank = useMemo(() => getBestGlobalRank(stats), [stats]);
  const rankProfile = useMemo(() => getPlayerRankProfile(stats), [stats]);
  const levelInfo = useMemo(() => getPlayerLevelInfo(stats), [stats]);

  // Total unlocked count
  const unlockedBadgesCount = useMemo(() => {
    return ACHIEVEMENTS_REGISTRY.filter((a) => a.isUnlocked(stats)).length;
  }, [stats]);

  // Newly unlocked achievements that the player hasn't seen yet
  const newlyUnlockedBadgeIds = useMemo(() => {
    const newIds = new Set<string>();
    ACHIEVEMENTS_REGISTRY.forEach((badge) => {
      if (badge.isUnlocked(stats) && !seenBadgeIds.has(badge.id)) {
        newIds.add(badge.id);
      }
    });
    return newIds;
  }, [stats, seenBadgeIds]);

  // Filtered achievements by category, lock status, and search query
  const filteredAchievements = useMemo(() => {
    return ACHIEVEMENTS_REGISTRY.filter((badge) => {
      const isUnlocked = badge.isUnlocked(stats);
      if (achievementFilter === 'unlocked' && !isUnlocked) return false;
      if (achievementFilter === 'locked' && isUnlocked) return false;
      if (
        achievementFilter !== 'all' &&
        achievementFilter !== 'unlocked' &&
        achievementFilter !== 'locked' &&
        badge.category !== achievementFilter
      ) {
        return false;
      }
      if (achievementSearch.trim()) {
        const query = achievementSearch.toLowerCase();
        const matchesTitle = badge.title.toLowerCase().includes(query);
        const matchesDesc = badge.description.toLowerCase().includes(query);
        const matchesTier = badge.tier.toLowerCase().includes(query);
        const matchesCategory = badge.category.toLowerCase().includes(query);
        return matchesTitle || matchesDesc || matchesTier || matchesCategory;
      }
      return true;
    });
  }, [stats, achievementFilter, achievementSearch]);

  const handleAcknowledgeBadge = (badgeId: string) => {
    const updated = new Set(seenBadgeIds);
    updated.add(badgeId);
    setSeenBadgeIds(updated);
    try {
      localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(Array.from(updated)));
    } catch {}
  };

  const handleAcknowledgeAll = () => {
    const allUnlocked = ACHIEVEMENTS_REGISTRY.filter((a) => a.isUnlocked(stats)).map((a) => a.id);
    const updated = new Set([...seenBadgeIds, ...allUnlocked]);
    setSeenBadgeIds(updated);
    try {
      localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(Array.from(updated)));
    } catch {}
    sounds.playScore();
    haptics.combo();
  };

  // Find most played game
  let mostPlayedGameId = '';
  let highestPlayCount = 0;
  (Object.entries(stats.playCounts) as [string, number][]).forEach(([id, count]) => {
    if (count > highestPlayCount) {
      highestPlayCount = count;
      mostPlayedGameId = id;
    }
  });

  const mostPlayedGame = GAMES_REGISTRY.find((g) => g.id === mostPlayedGameId);
  const selectedGame = GAMES_REGISTRY.find((g) => g.id === selectedGameId) || GAMES_REGISTRY[0];

  // Game categories for filtering
  const gameCategories = useMemo(() => {
    const cats = new Set<string>();
    GAMES_REGISTRY.forEach((g) => cats.add(g.category));
    return ['all', ...Array.from(cats)];
  }, []);

  // Filtered games list for individual game picker
  const filteredGames = useMemo(() => {
    return GAMES_REGISTRY.filter((game) => {
      if (gameCategoryFilter !== 'all' && game.category !== gameCategoryFilter) {
        return false;
      }
      if (gameSearchQuery.trim()) {
        const query = gameSearchQuery.toLowerCase();
        const matchesTitle = game.title.toLowerCase().includes(query);
        const matchesDesc = game.description.toLowerCase().includes(query);
        const matchesCat = game.category.toLowerCase().includes(query);
        return matchesTitle || matchesDesc || matchesCat;
      }
      return true;
    });
  }, [gameCategoryFilter, gameSearchQuery]);

  // Fetch leaderboard for selected game
  const userHighScore = stats.highScores[selectedGame.id] || 0;
  const userGamePlays = stats.playCounts[selectedGame.id] || 0;

  const gameLeaderboardData = useMemo(() => {
    void refreshTick;
    return getGlobalLeaderboardForGame(selectedGame.id, userHighScore);
  }, [selectedGame.id, userHighScore, refreshTick]);

  // Overall Arcade Championship Leaderboard
  const overallLeaderboardData = useMemo(() => {
    void refreshTick;
    return getOverallArcadeLeaderboard(stats);
  }, [stats, refreshTick]);

  // Filtered leaderboard entries based on division filter
  const displayedGameEntries = useMemo(() => {
    if (divisionFilter === 'all') return gameLeaderboardData.topEntries;
    return gameLeaderboardData.topEntries.filter((e) => e.division === divisionFilter);
  }, [gameLeaderboardData.topEntries, divisionFilter]);

  const displayedOverallEntries = useMemo(() => {
    if (divisionFilter === 'all') return overallLeaderboardData.topEntries;
    return overallLeaderboardData.topEntries.filter((e) => e.division === divisionFilter);
  }, [overallLeaderboardData.topEntries, divisionFilter]);

  const handleRefreshRivals = () => {
    sounds.playPop();
    setIsRefreshing(true);
    simulateLiveCompetition(selectedGame.id);
    setSafeTimeout(() => {
      setRefreshTick((t) => t + 1);
      setIsRefreshing(false);
      sounds.playScore();
      haptics.light();
    }, 450);
  };

  const handleResetAll = () => {
    sounds.playHit();
    resetAllLeaderboards();
    onClearData();
    setConfirmClear(false);
    setRefreshTick((t) => t + 1);
  };

  const renderBadgeIcon = (iconName: string, className: string = 'w-5 h-5') => {
    switch (iconName) {
      case 'Play': return <Play className={className} />;
      case 'Gamepad2': return <Gamepad2 className={className} />;
      case 'Flame': return <Flame className={className} />;
      case 'Trophy': return <Trophy className={className} />;
      case 'Crown': return <Crown className={className} />;
      case 'Zap': return <Zap className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      case 'Award': return <Award className={className} />;
      case 'Medal': return <Medal className={className} />;
      case 'Star': return <Star className={className} />;
      case 'Compass': return <Compass className={className} />;
      case 'Layers': return <Layers className={className} />;
      case 'Globe': return <Globe className={className} />;
      case 'Heart': return <Heart className={className} />;
      case 'Target': return <Target className={className} />;
      case 'Orbit': return <Orbit className={className} />;
      case 'Gem': return <Gem className={className} />;
      default: return <Award className={className} />;
    }
  };

  const getTierBadgeStyle = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'master':
        return 'bg-rose-950/70 text-rose-300 border-rose-500/60 shadow-sm shadow-rose-500/30';
      case 'diamond':
        return 'bg-purple-950/60 text-purple-300 border-purple-500/50 shadow-sm shadow-purple-500/20';
      case 'gold':
        return 'bg-amber-950/60 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20';
      case 'silver':
        return 'bg-slate-800 text-slate-200 border-slate-600';
      case 'bronze':
      default:
        return 'bg-orange-950/40 text-orange-400 border-orange-800/50';
    }
  };

  return (
    <div
      id="stats-modal-overlay"
      className="fixed inset-0 z-50 bg-[#0A0A0B]/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sounds.playPop();
          onClose();
        }
      }}
    >
      <div
        id="stats-modal-container"
        className="w-full max-w-4xl rounded-2xl bg-[#111114] border border-[#27272A] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-98 duration-200"
      >
        {/* MODAL STICKY HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#27272A] bg-[#141418] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-md shrink-0 border"
              style={{
                backgroundColor:
                  activeTab === 'leaderboards'
                    ? 'rgba(56, 189, 248, 0.15)'
                    : activeTab === 'achievements'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(244, 63, 94, 0.15)',
                color:
                  activeTab === 'leaderboards'
                    ? '#38BDF8'
                    : activeTab === 'achievements'
                    ? '#FACC15'
                    : '#F43F5E',
                borderColor:
                  activeTab === 'leaderboards'
                    ? 'rgba(56, 189, 248, 0.3)'
                    : activeTab === 'achievements'
                    ? 'rgba(245, 158, 11, 0.3)'
                    : 'rgba(244, 63, 94, 0.3)',
              }}
            >
              {activeTab === 'stats' ? (
                <Award className="w-5 h-5" />
              ) : activeTab === 'achievements' ? (
                <Medal className="w-5 h-5 text-amber-400" />
              ) : (
                <Trophy className="w-5 h-5" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-black text-base sm:text-lg text-white font-display truncate">
                  {activeTab === 'stats'
                    ? 'Player Statistics & Metrics'
                    : activeTab === 'achievements'
                    ? 'Competitive Ranks & Badges'
                    : 'World Championship Leaderboards'}
                </h2>
                {activeTab === 'leaderboards' && (
                  <span className="text-[10px] font-mono-arcade font-black uppercase px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/50">
                    Live Circuit
                  </span>
                )}
                {activeTab === 'achievements' && newlyUnlockedBadgeIds.size > 0 && (
                  <span className="text-[10px] font-mono-arcade font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-black animate-pulse flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {newlyUnlockedBadgeIds.size} New
                  </span>
                )}
              </div>
              <span className="text-xs font-mono-arcade text-[#A1A1AA] truncate">
                {activeTab === 'stats'
                  ? 'Comprehensive gaming records, high scores & system settings'
                  : activeTab === 'achievements'
                  ? '10-Tier competitive rank ladder, XP progression & 48 milestone achievements'
                  : 'Global competitive standings, rival sync & per-game world records'}
              </span>
            </div>
          </div>

          <button
            type="button"
            id="close-stats-modal-btn"
            onClick={() => {
              sounds.playPop();
              onClose();
            }}
            className="p-2 rounded-xl bg-[#1C1C21] hover:bg-[#27272A] text-[#A1A1AA] hover:text-white border border-[#27272A] transition-colors cursor-pointer shrink-0 ml-2"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PRIMARY TAB NAVIGATION */}
        <div className="px-3 sm:px-6 pt-3 pb-2 bg-[#111114] border-b border-[#27272A] shrink-0">
          <div className="grid grid-cols-3 rounded-xl bg-[#0A0A0C] p-1 border border-[#27272A] font-mono-arcade text-xs font-bold gap-1 w-full">
            <button
              type="button"
              id="tab-leaderboards-btn"
              onClick={() => {
                sounds.playClick();
                setActiveTab('leaderboards');
              }}
              className={`py-2 px-1.5 sm:px-3 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-w-0 ${
                activeTab === 'leaderboards'
                  ? 'bg-gradient-to-r from-cyan-600 to-sky-500 text-white shadow-md shadow-cyan-500/20 font-black'
                  : 'text-[#A1A1AA] hover:text-white hover:bg-[#18181C]'
              }`}
            >
              <Trophy className="w-4 h-4 shrink-0" />
              <span className="truncate hidden sm:inline">LEADERBOARDS</span>
              <span className="truncate sm:hidden text-[11px]">BOARDS</span>
            </button>

            <button
              type="button"
              id="tab-achievements-btn"
              onClick={() => {
                sounds.playClick();
                setActiveTab('achievements');
              }}
              className={`py-2 px-1.5 sm:px-3 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-w-0 ${
                activeTab === 'achievements'
                  ? 'bg-gradient-to-r from-amber-500 to-[#F43F5E] text-white shadow-md shadow-amber-500/20 font-black'
                  : 'text-[#A1A1AA] hover:text-white hover:bg-[#18181C]'
              }`}
            >
              <Medal className="w-4 h-4 shrink-0" />
              <span className="truncate hidden sm:inline">RANKS & BADGES</span>
              <span className="truncate sm:hidden text-[11px]">BADGES</span>
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.2 rounded-full font-black shrink-0 hidden xs:inline-flex ${
                  activeTab === 'achievements'
                    ? 'bg-black/40 text-white'
                    : 'bg-[#27272A] text-amber-400'
                }`}
              >
                {unlockedBadgesCount}/{ACHIEVEMENTS_REGISTRY.length}
              </span>
            </button>

            <button
              type="button"
              id="tab-stats-btn"
              onClick={() => {
                sounds.playClick();
                setActiveTab('stats');
              }}
              className={`py-2 px-1.5 sm:px-3 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-w-0 ${
                activeTab === 'stats'
                  ? 'bg-[#27272A] text-white shadow-sm font-black'
                  : 'text-[#A1A1AA] hover:text-white hover:bg-[#18181C]'
              }`}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span className="truncate hidden sm:inline">PLAYER & STATS</span>
              <span className="truncate sm:hidden text-[11px]">STATS</span>
            </button>
          </div>
        </div>

        {/* SCROLLABLE MAIN CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 text-slate-100">
          
          {/* ========================================================================= */}
          {/* TAB 1: GLOBAL LEADERBOARDS & COMPREHENSIVE GAME TRACKS                   */}
          {/* ========================================================================= */}
          {activeTab === 'leaderboards' && (
            <div className="flex flex-col gap-4">
              
              {/* TOP SCOPE TOGGLE & RIVAL SYNC BAR */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-1.5 rounded-xl bg-[#0A0A0C] border border-[#27272A]">
                <div className="flex items-center gap-1 font-mono-arcade text-xs">
                  <button
                    type="button"
                    id="scope-overall-btn"
                    onClick={() => {
                      sounds.playClick();
                      setLeaderboardScope('overall');
                      setGamePickerOpen(false);
                    }}
                    className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      leaderboardScope === 'overall'
                        ? 'bg-gradient-to-r from-amber-500 to-[#F43F5E] text-white shadow-md font-black'
                        : 'text-[#A1A1AA] hover:text-white hover:bg-[#18181C]'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span>World Championship</span>
                  </button>

                  <button
                    type="button"
                    id="scope-per-game-btn"
                    onClick={() => {
                      sounds.playClick();
                      setLeaderboardScope('perGame');
                    }}
                    className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      leaderboardScope === 'perGame'
                        ? 'bg-cyan-500 text-black shadow-md font-black'
                        : 'text-[#A1A1AA] hover:text-white hover:bg-[#18181C]'
                    }`}
                  >
                    <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Game Tracks</span>
                  </button>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 px-1 sm:px-0">
                  <button
                    type="button"
                    id="sync-live-rivals-btn"
                    onClick={handleRefreshRivals}
                    title="Simulate live score activity from global rival contenders"
                    className={`px-3 py-1.5 rounded-lg bg-[#141418] hover:bg-[#202026] border border-[#27272A] text-xs font-mono-arcade font-bold text-[#A1A1AA] hover:text-white transition-all cursor-pointer flex items-center gap-1.5 ${
                      isRefreshing ? 'text-amber-400 border-amber-500/50' : ''
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
                    <span>Sync Live Rivals</span>
                  </button>
                </div>
              </div>

              {/* CLEAN HEADER STRIP: SELECTED GAME (PER-GAME) OR CHAMPIONSHIP OVERVIEW */}
              {leaderboardScope === 'perGame' ? (
                <div className="flex flex-col gap-2 relative">
                  {/* Compact Game Selector Row */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#0F0F14] border border-[#27272A]">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        id="game-selector-dropdown-btn"
                        onClick={() => {
                          sounds.playClick();
                          setGamePickerOpen(!gamePickerOpen);
                        }}
                        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#181820] hover:bg-[#22222C] border border-[#27272A] hover:border-cyan-500/50 transition-all cursor-pointer group text-left min-w-0"
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: selectedGame.accentColor }}
                        />
                        <span className="font-bold text-xs sm:text-sm text-white truncate max-w-[140px] sm:max-w-[200px]">
                          {selectedGame.title}
                        </span>
                        <span
                          className="text-[9px] font-mono-arcade uppercase px-1.5 py-0.2 rounded font-bold shrink-0 hidden xs:inline"
                          style={{
                            backgroundColor: `${selectedGame.accentColor}25`,
                            color: selectedGame.accentColor,
                          }}
                        >
                          {selectedGame.category}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 text-[#A1A1AA] group-hover:text-white transition-transform ${gamePickerOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* High Score & Play Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 font-mono-arcade">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-[#71717A] uppercase block leading-tight">Your Best</span>
                        <span className="text-sm font-black text-amber-400">
                          {userHighScore > 0 ? `${userHighScore.toLocaleString()} pts` : 'No Score'}
                        </span>
                      </div>

                      {onLaunchGame && (
                        <button
                          type="button"
                          id="play-selected-game-btn"
                          onClick={() => {
                            sounds.playClick();
                            onLaunchGame(selectedGame.id);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-[#F43F5E] hover:bg-[#E11D48] text-white font-mono-arcade font-black text-xs flex items-center gap-1.5 shadow-md shadow-rose-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                        >
                          <Play className="w-3 h-3 fill-current" /> PLAY
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sleek Floating Dropdown for Game Selection */}
                  {gamePickerOpen && (
                    <div className="p-3 rounded-xl bg-[#111116] border border-cyan-500/50 shadow-2xl flex flex-col gap-2.5 z-20 animate-in fade-in zoom-in-98 duration-150">
                      <div className="flex items-center justify-between gap-2">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={gameSearchQuery}
                            onChange={(e) => setGameSearchQuery(e.target.value)}
                            placeholder="Filter 24 arcade games..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0A0A0D] border border-[#27272A] text-xs font-mono-arcade text-white placeholder-[#71717A] focus:outline-none focus:border-cyan-500"
                            autoFocus
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setGamePickerOpen(false)}
                          className="p-1.5 rounded-lg text-[#71717A] hover:text-white hover:bg-[#1C1C22]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Genre chips */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-mono-arcade">
                        {gameCategories.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setGameCategoryFilter(cat)}
                            className={`px-2 py-0.5 rounded capitalize whitespace-nowrap cursor-pointer transition-colors ${
                              gameCategoryFilter === cat
                                ? 'bg-cyan-500 text-black font-bold'
                                : 'bg-[#18181E] text-[#A1A1AA] hover:text-white'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {/* Games grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {filteredGames.map((g) => {
                          const isCur = g.id === selectedGameId;
                          const best = stats.highScores[g.id] || 0;
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                setSelectedGameId(g.id);
                                setGamePickerOpen(false);
                              }}
                              className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                                isCur
                                  ? 'bg-[#1C1C24] border-cyan-400 text-white font-bold ring-1 ring-cyan-400/40'
                                  : 'bg-[#141418] hover:bg-[#1A1A20] border-[#27272A] text-[#A1A1AA] hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.accentColor }} />
                                <span className="text-xs truncate">{g.title}</span>
                              </div>
                              <span className="text-[10px] font-mono-arcade text-amber-400 shrink-0">
                                {best > 0 ? best.toLocaleString() : '—'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* World Championship Overview Strip */
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-950/30 via-[#131318] to-rose-950/20 border border-amber-500/30 font-mono-arcade">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center justify-center shrink-0">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs sm:text-sm text-white uppercase tracking-tight font-display">
                          World Championship Circuit
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300">
                          Season 1
                        </span>
                      </div>
                      <span className="text-[11px] text-[#71717A]">
                        Unified Rating based on High Scores, Badge XP & Play Volume
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#27272A]">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-[#71717A] uppercase block leading-tight">Your Championship Rating</span>
                      <span className="text-sm font-black text-amber-400">
                        {rankProfile.ratingScore.toLocaleString()} PTS
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#71717A] uppercase block leading-tight">Global Standing</span>
                      <span className="text-xs font-black text-white px-2 py-0.5 rounded bg-[#1C1C22] border border-[#27272A]">
                        {overallLeaderboardData.userRank ? `#${overallLeaderboardData.userRank}` : 'Active'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* DIVISION FILTER PILLS & ACTIVE STANDING */}
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#0A0A0C] border border-[#27272A] font-mono-arcade text-xs overflow-x-auto">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-[#71717A] uppercase font-bold pl-1 hidden sm:inline">Division:</span>
                  {(['all', 'diamond', 'platinum', 'gold', 'silver', 'bronze'] as const).map((div) => {
                    const isSelected = divisionFilter === div;
                    return (
                      <button
                        key={div}
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setDivisionFilter(div);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white text-black font-black shadow-sm'
                            : 'bg-[#141418] text-[#A1A1AA] hover:text-white border border-[#27272A]'
                        }`}
                      >
                        {div}
                      </button>
                    );
                  })}
                </div>

                <div className="text-[11px] text-[#71717A] shrink-0 pr-1">
                  {(leaderboardScope === 'perGame' ? displayedGameEntries : displayedOverallEntries).length} Rivals Listed
                </div>
              </div>

              {/* CLEAN VERTICAL RANKINGS TABLE WITH ZEBRA STRIPING */}
              <div className="w-full rounded-xl border border-[#27272A] overflow-hidden bg-[#0A0A0C]">
                {/* Table Column Headers */}
                <div className="grid grid-cols-12 px-3 sm:px-4 py-2.5 bg-[#14141A] border-b border-[#27272A] text-[11px] font-mono-arcade font-bold text-[#71717A] uppercase tracking-wider select-none">
                  <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
                  <div className="col-span-6 sm:col-span-6 pl-1 sm:pl-2">Competitor</div>
                  <div className="hidden sm:block sm:col-span-2 text-center">Division</div>
                  <div className="col-span-4 sm:col-span-3 text-right">Score / Rating</div>
                </div>

                {/* Vertical Table Rows with Zebra Striping */}
                <div className="max-h-[380px] overflow-y-auto divide-y divide-[#1F1F24]">
                  {(leaderboardScope === 'perGame' ? displayedGameEntries : displayedOverallEntries).map((entry, idx) => {
                    const isTop1 = entry.rank === 1;
                    const isTop2 = entry.rank === 2;
                    const isTop3 = entry.rank === 3;
                    const isTopRank = entry.rank <= 3;
                    const scoreValue = 'score' in entry ? entry.score : entry.ratingScore;
                    const isEven = idx % 2 === 0;

                    return (
                      <div
                        key={entry.id}
                        className={`grid grid-cols-12 items-center px-3 sm:px-4 py-2.5 text-xs font-mono-arcade transition-colors ${
                          entry.isUser
                            ? 'bg-gradient-to-r from-[#F43F5E]/20 via-[#1E1218] to-amber-500/10 border-y border-[#F43F5E]/60 text-white font-bold'
                            : isEven
                            ? 'bg-[#0A0A0D] hover:bg-[#16161D] text-[#D4D4D8]'
                            : 'bg-[#101015] hover:bg-[#16161D] text-[#D4D4D8]'
                        }`}
                      >
                        {/* Rank Column */}
                        <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                          {isTop1 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-xs shadow-md shadow-amber-500/30" title="Rank 1 - Champion">
                              <Crown className="w-3.5 h-3.5 fill-current" />
                            </span>
                          ) : isTop2 ? (
                            <span className="w-6 h-6 rounded-full bg-slate-300 text-black flex items-center justify-center font-black text-xs shadow-sm" title="Rank 2 - Silver">
                              2
                            </span>
                          ) : isTop3 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-700 text-white flex items-center justify-center font-black text-xs shadow-sm" title="Rank 3 - Bronze">
                              3
                            </span>
                          ) : (
                            <span className="text-[#71717A] font-bold text-center">
                              #{entry.rank}
                            </span>
                          )}
                        </div>

                        {/* Competitor Name & Flag Column */}
                        <div className="col-span-6 sm:col-span-6 flex items-center gap-2 pl-1 sm:pl-2 min-w-0">
                          <span className="text-base shrink-0 select-none">{entry.country}</span>
                          <span className={`truncate font-bold ${entry.isUser ? 'text-rose-300' : isTop1 ? 'text-amber-300' : 'text-white'}`}>
                            {entry.name}
                          </span>
                          {entry.isUser && (
                            <span className="px-1.5 py-0.2 rounded bg-[#F43F5E] text-white text-[9px] font-black uppercase shrink-0 shadow-xs">
                              YOU
                            </span>
                          )}
                          {'badgeTitle' in entry && entry.badgeTitle && (
                            <span className="text-[9px] text-[#71717A] truncate hidden md:inline">
                              • {entry.badgeTitle}
                            </span>
                          )}
                        </div>

                        {/* Division Column */}
                        <div className="hidden sm:flex sm:col-span-2 items-center justify-center">
                          {entry.division ? (
                            <span
                              className={`text-[9px] font-mono-arcade font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${getTierBadgeStyle(
                                entry.division
                              )}`}
                            >
                              {entry.division}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#71717A]">—</span>
                          )}
                        </div>

                        {/* Score & Live Trend Column */}
                        <div className="col-span-4 sm:col-span-3 flex items-center justify-end gap-2 text-right">
                          {'trend' in entry && (
                            <span className="shrink-0" title={`Live Competition Trend: ${entry.trend}`}>
                              {entry.trend === 'up' ? (
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 inline" />
                              ) : entry.trend === 'down' ? (
                                <TrendingDown className="w-3.5 h-3.5 text-rose-400 inline" />
                              ) : (
                                <Minus className="w-3.5 h-3.5 text-[#52525B] inline" />
                              )}
                            </span>
                          )}
                          <span
                            className={`font-black tabular-nums text-xs sm:text-sm ${
                              entry.isUser
                                ? 'text-rose-300'
                                : isTop1
                                ? 'text-amber-400'
                                : isTopRank
                                ? 'text-white'
                                : 'text-[#D4D4D8]'
                            }`}
                          >
                            {scoreValue.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: 6-TIER COMPETITIVE RANK LADDER & BADGES SHOWCASE                  */}
          {/* ========================================================================= */}
          {activeTab === 'achievements' && (
            <div className="flex flex-col gap-5">
              
              {/* RANK PROFILE HERO BANNER */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0A0A0C] border border-[#27272A] flex flex-col gap-4 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-bold shadow-xl border shrink-0 relative select-none"
                      style={{
                        backgroundColor: `${rankProfile.color}20`,
                        borderColor: `${rankProfile.color}70`,
                        boxShadow: `0 0 20px ${rankProfile.glowColor}`,
                      }}
                    >
                      <span className="text-[9px] font-mono-arcade text-[#A1A1AA] uppercase leading-none">RANK</span>
                      <span
                        className="text-xl font-black font-mono-arcade leading-tight"
                        style={{ color: rankProfile.color }}
                      >
                        {rankProfile.rankLevel}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-mono-arcade uppercase font-black tracking-wider"
                          style={{ color: rankProfile.color }}
                        >
                          TIER {rankProfile.rankLevel} • {rankProfile.rankTierName}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-white font-display flex items-center gap-2">
                        {rankProfile.title}
                      </h3>
                      <span className="text-xs font-mono-arcade text-[#A1A1AA] mt-0.5">
                        {levelInfo.totalXP} Total XP Earned • {unlockedBadgesCount} of {ACHIEVEMENTS_REGISTRY.length} Badges Claimed ({rankProfile.completionPercent}%)
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right flex flex-col items-start sm:items-end font-mono-arcade pt-2 sm:pt-0 border-t sm:border-t-0 border-[#27272A] w-full sm:w-auto">
                    <span
                      className="text-2xl font-black"
                      style={{ color: rankProfile.color }}
                    >
                      {rankProfile.ratingScore.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[#71717A] uppercase tracking-wider">Overall Rating Score</span>
                  </div>
                </div>

                {/* 6-TIER RANK LADDER PROGRESSION TRACK (SPACIOUS & INTERACTIVE) */}
                <div className="flex flex-col gap-2 pt-3 border-t border-[#1F1F23]">
                  <div className="flex items-center justify-between text-xs font-mono-arcade text-[#A1A1AA]">
                    <span className="font-bold uppercase tracking-wider text-white">
                      Competitive Tier Ladder (Click to Inspect)
                    </span>
                    <span>
                      {rankProfile.nextThreshold
                        ? `${rankProfile.nextThreshold - unlockedBadgesCount} badges to next rank`
                        : 'Max Rank Achieved!'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
                    {RANK_TIERS.map((tier) => {
                      const isReached = rankProfile.badgeCount >= tier.minBadges;
                      const isCurrent = rankProfile.rankLevel === tier.level;

                      return (
                        <div
                          key={tier.level}
                          onClick={() => {
                            sounds.playClick();
                            setSelectedRankTierInfo(tier);
                          }}
                          className={`p-3 rounded-2xl border text-center font-mono-arcade transition-all cursor-pointer flex flex-col justify-between gap-2 relative overflow-hidden group hover:scale-105 active:scale-95 ${
                            isCurrent
                              ? 'bg-gradient-to-b from-[#1E1E28] to-[#121218] border-white shadow-xl shadow-white/10 ring-2 ring-white/60'
                              : isReached
                              ? 'bg-gradient-to-b from-[#14141C] to-[#0A0A0E] border-[#3F3F4E] hover:border-zinc-300'
                              : 'bg-[#08080A] border-[#181820] opacity-50 hover:opacity-75'
                          }`}
                        >
                          {/* Top Tag */}
                          <div className="flex items-center justify-between gap-1 z-10">
                            <span className="text-[9px] text-zinc-400 font-black">T{tier.level}</span>
                            {isCurrent && (
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-white text-black shadow-sm animate-pulse">
                                CURRENT
                              </span>
                            )}
                          </div>

                          {/* Center Rank Emblem */}
                          <div
                            className="w-9 h-9 mx-auto rounded-xl flex items-center justify-center font-black text-sm border shadow-lg transition-transform group-hover:rotate-6 z-10"
                            style={{
                              backgroundColor: `${tier.color}20`,
                              borderColor: isReached ? tier.color : '#27272A',
                              color: isReached ? tier.color : '#52525B',
                              boxShadow: isReached ? `0 0 12px ${tier.glowColor}` : 'none',
                            }}
                          >
                            {tier.level === 10 ? '👑' : tier.level >= 8 ? '💎' : tier.level >= 6 ? '⭐' : tier.level}
                          </div>

                          {/* Name */}
                          <div
                            className="text-[11px] font-black uppercase tracking-wide truncate z-10"
                            style={{ color: isReached ? tier.color : '#71717A' }}
                          >
                            {tier.name}
                          </div>

                          <div className="text-[10px] text-zinc-400 pt-1.5 border-t border-[#27272A]/50 z-10">
                            {tier.minBadges}+ Badges
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* NEWLY UNLOCKED BADGES NOTICE */}
              {newlyUnlockedBadgeIds.size > 0 && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/60 via-[#18181C] to-rose-950/40 border border-amber-400/80 flex items-center justify-between gap-3 animate-badge-glow">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-mono-arcade font-black text-amber-300 truncate">
                        {newlyUnlockedBadgeIds.size} New {newlyUnlockedBadgeIds.size === 1 ? 'Badge' : 'Badges'} Unlocked!
                      </span>
                      <span className="text-[11px] text-[#A1A1AA] truncate">
                        Glowing badges have met requirements. Click to view criteria!
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAcknowledgeAll}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-mono-arcade text-xs font-black transition-all cursor-pointer shadow-md hover:scale-105 shrink-0"
                  >
                    Collect All ✨
                  </button>
                </div>
              )}

              {/* SEARCH & CATEGORY FILTERS FOR BADGES */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={achievementSearch}
                    onChange={(e) => setAchievementSearch(e.target.value)}
                    placeholder="Search badges by title, description or tier..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0A0A0C] border border-[#27272A] text-xs font-mono-arcade text-white placeholder-[#71717A] focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  {achievementSearch && (
                    <button
                      type="button"
                      onClick={() => setAchievementSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs font-mono-arcade">
                  {(['all', 'unlocked', 'locked', 'milestones', 'scores', 'variety', 'skill', 'competitive'] as const).map((filter) => {
                    const isSelected = achievementFilter === filter;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setAchievementFilter(filter);
                        }}
                        className={`px-3 py-1.5 rounded-lg capitalize whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? filter === 'unlocked'
                              ? 'bg-emerald-500 text-white font-bold'
                              : filter === 'locked'
                              ? 'bg-[#27272A] text-white font-bold'
                              : 'bg-white text-black font-bold'
                            : 'bg-[#0A0A0C] text-[#A1A1AA] hover:text-white border border-[#27272A]'
                        }`}
                      >
                        {filter === 'all'
                          ? `All (${ACHIEVEMENTS_REGISTRY.length})`
                          : filter === 'unlocked'
                          ? `Unlocked (${unlockedBadgesCount})`
                          : filter === 'locked'
                          ? `Locked (${ACHIEVEMENTS_REGISTRY.length - unlockedBadgesCount})`
                          : filter}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BADGES GRID (SPACIOUS 2-COLUMN, COMFORTABLE PADDING & NO TEXT OVERFLOW) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {filteredAchievements.map((badge, idx) => {
                  const unlocked = badge.isUnlocked(stats);
                  const isNewlyUnlocked = newlyUnlockedBadgeIds.has(badge.id);
                  const progressText = badge.getProgressText(stats);
                  const currentVal = badge.getCurrentProgress(stats);
                  const pct = Math.min(100, Math.round((currentVal / badge.targetGoal) * 100));

                  return (
                    <div
                      key={badge.id}
                      onClick={() => {
                        if (isNewlyUnlocked) {
                          handleAcknowledgeBadge(badge.id);
                        }
                        if (unlocked) {
                          sounds.playScore();
                          haptics.score();
                        } else {
                          sounds.playPop();
                          haptics.light();
                        }
                        setSelectedBadge(badge);
                      }}
                      className={`p-4 rounded-2xl border flex flex-col justify-between gap-3.5 transition-all cursor-pointer relative group ${
                        isNewlyUnlocked
                          ? 'bg-gradient-to-br from-amber-950/40 via-[#0A0A0C] to-rose-950/30 border-amber-400 shadow-xl shadow-amber-500/20'
                          : unlocked
                          ? 'bg-[#0A0A0C] hover:bg-[#141418] border-[#27272A] hover:border-amber-400/50 hover:scale-[1.01]'
                          : 'bg-[#0A0A0C]/60 border-[#1F1F23] opacity-85 hover:opacity-100 hover:border-[#27272A]'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Icon Box */}
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border relative ${
                            isNewlyUnlocked
                              ? 'shadow-md shadow-amber-500/40'
                              : unlocked
                              ? 'shadow-md'
                              : 'bg-[#18181C] border-[#27272A] text-[#52525B]'
                          }`}
                          style={
                            unlocked
                              ? {
                                  backgroundColor: `${badge.accentColor}25`,
                                  borderColor: isNewlyUnlocked ? '#F59E0B' : `${badge.accentColor}60`,
                                  color: isNewlyUnlocked ? '#FDE047' : badge.accentColor,
                                }
                              : undefined
                          }
                        >
                          {renderBadgeIcon(badge.icon, 'w-5 h-5')}
                          {isNewlyUnlocked && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                          )}
                        </div>

                        {/* Title, Tier, XP & Description */}
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <h4
                              className={`font-black text-sm truncate ${
                                isNewlyUnlocked
                                  ? 'text-amber-200'
                                  : unlocked
                                  ? 'text-white'
                                  : 'text-[#A1A1AA]'
                              }`}
                            >
                              {badge.title}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isNewlyUnlocked && (
                                <span className="text-[9px] font-mono-arcade font-black uppercase px-1.5 py-0.5 rounded bg-amber-400 text-black flex items-center gap-0.5 shadow-sm">
                                  <Sparkles className="w-2.5 h-2.5" /> NEW!
                                </span>
                              )}
                              <span className="text-[9px] font-mono-arcade font-bold px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
                                +{badge.xpReward} XP
                              </span>
                              <span
                                className={`text-[9px] font-mono-arcade font-black uppercase px-1.5 py-0.5 rounded border ${getTierBadgeStyle(
                                  badge.tier
                                )}`}
                              >
                                {badge.tier}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-[#A1A1AA] line-clamp-2 mt-1 leading-relaxed">
                            {badge.description}
                          </p>
                        </div>
                      </div>

                      {/* Footer Progress */}
                      <div className="flex flex-col gap-1.5 pt-2.5 border-t border-[#1F1F23] font-mono-arcade text-xs">
                        <div className="flex items-center justify-between">
                          <span
                            className={
                              unlocked
                                ? 'text-emerald-400 font-bold flex items-center gap-1.5'
                                : 'text-[#71717A] flex items-center gap-1.5'
                            }
                          >
                            {unlocked ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> UNLOCKED
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" /> LOCKED
                              </>
                            )}
                          </span>
                          <span className={unlocked ? 'text-white font-bold' : 'text-[#A1A1AA]'}>
                            {progressText}
                          </span>
                        </div>

                        {!unlocked && (
                          <div className="w-full h-2 rounded-full bg-[#18181C] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#38BDF8] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: PLAYER ARCADE STATISTICS & SETTINGS                               */}
          {/* ========================================================================= */}
          {activeTab === 'stats' && (
            <div className="flex flex-col gap-6">
              
              {/* PRIMARY STATS METRICS GRID (SPACIOUS 4-COLUMN WITH NO TEXT OVERFLOW) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-arcade">
                <div className="p-4 rounded-2xl bg-[#0A0A0C] border border-[#27272A] flex flex-col justify-between gap-1">
                  <span className="text-[10px] text-[#71717A] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" /> TOTAL SESSIONS
                  </span>
                  <span className="text-2xl font-black text-white">{totalPlays}</span>
                  <span className="text-[10px] text-[#71717A]">Arcade Plays Logged</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#0A0A0C] border border-[#27272A] flex flex-col justify-between gap-1">
                  <span className="text-[10px] text-[#71717A] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" /> TOTAL SCORE
                  </span>
                  <span className="text-2xl font-black text-amber-400 truncate">
                    {totalScore.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#71717A]">Cumulative High Scores</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#0A0A0C] border border-[#27272A] flex flex-col justify-between gap-1">
                  <span className="text-[10px] text-[#71717A] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Gamepad2 className="w-3.5 h-3.5 text-[#F43F5E]" /> MINIS EXPLORED
                  </span>
                  <span className="text-2xl font-black text-[#F43F5E]">
                    {uniqueGamesPlayed} / {GAMES_REGISTRY.length}
                  </span>
                  <span className="text-[10px] text-[#71717A]">Unique Titles Played</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#0A0A0C] border border-[#27272A] flex flex-col justify-between gap-1">
                  <span className="text-[10px] text-[#71717A] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-purple-400" /> RATING SCORE
                  </span>
                  <span className="text-2xl font-black text-purple-300">
                    {rankProfile.ratingScore.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#71717A]">Tier {rankProfile.rankLevel} Contender</span>
                </div>
              </div>

              {/* RANK PROGRESSION SHORTCUT CARD */}
              <div
                onClick={() => {
                  sounds.playClick();
                  setActiveTab('achievements');
                }}
                className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/30 via-[#18181C] to-rose-950/20 border border-amber-500/40 flex items-center justify-between cursor-pointer hover:border-amber-400/70 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-black font-mono-arcade text-black text-base shadow-lg group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: rankProfile.color }}
                  >
                    {rankProfile.rankLevel}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-white">Tier {rankProfile.rankLevel} • {rankProfile.title}</span>
                      <span className="text-[10px] font-mono-arcade px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold">
                        {unlockedBadgesCount} / {ACHIEVEMENTS_REGISTRY.length} Badges
                      </span>
                    </div>
                    <span className="text-xs font-mono-arcade text-[#A1A1AA] mt-0.5">
                      {levelInfo.totalXP} XP Earned • Tap to view all 6 tiers and milestones
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-mono-arcade text-amber-400 group-hover:text-amber-300 font-bold">
                  <span>View Rank Ladder</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* FAVORITE MINI SPOTLIGHT */}
              {mostPlayedGame && (
                <div className="p-4 sm:p-5 rounded-2xl bg-[#0A0A0C] border border-[#27272A] flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
                      style={{
                        backgroundColor: `${mostPlayedGame.accentColor}25`,
                        color: mostPlayedGame.accentColor,
                      }}
                    >
                      <Flame className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono-arcade text-[#71717A] uppercase font-bold tracking-wider">
                        MOST PLAYED MINI-GAME
                      </span>
                      <span className="font-bold text-base text-white mt-0.5">
                        {mostPlayedGame.title}
                      </span>
                      <span className="text-xs font-mono-arcade text-amber-400">
                        {highestPlayCount} {highestPlayCount === 1 ? 'session' : 'sessions logged'} • Best Record: {(stats.highScores[mostPlayedGame.id] || 0).toLocaleString()} pts
                      </span>
                    </div>
                  </div>

                  {onLaunchGame && (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        onLaunchGame(mostPlayedGame.id);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#27272A] hover:bg-[#3F3F46] text-white font-mono-arcade text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Play
                    </button>
                  )}
                </div>
              )}

              {/* THEME & VISUAL DISPLAY SELECTOR */}
              <div className="flex flex-col gap-3 pt-2 border-t border-[#27272A]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xs font-mono-arcade text-[#A1A1AA] uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-white" /> Arcade Visual Themes (5 Available)
                  </h3>
                  <span className="text-[10px] font-mono-arcade px-2 py-0.5 rounded bg-[#18181C] border border-[#27272A] text-white font-bold capitalize">
                    {stats.theme === 'retro-monochrome'
                      ? 'Retro Monochrome'
                      : stats.theme === 'cyberpunk'
                      ? 'Cyberpunk Synthwave'
                      : stats.theme === 'matrix-emerald'
                      ? '8-Bit Emerald'
                      : stats.theme === 'sunset-amber'
                      ? 'Solar Flare'
                      : 'Neon Obsidian'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {/* Theme 1: Default Dark (Neon Obsidian) */}
                  <div
                    onClick={() => {
                      if (stats.theme !== 'default') {
                        sounds.playScore();
                        haptics.medium();
                        onUpdateTheme?.('default');
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
                      stats.theme === 'default' || !stats.theme
                        ? 'bg-[#141418] border-[#F43F5E] shadow-lg ring-1 ring-[#F43F5E]/40'
                        : 'bg-[#0A0A0C] border-[#27272A] hover:border-[#3F3F46] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Neon Obsidian</span>
                          <span className="text-[9px] font-mono-arcade px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                            Default
                          </span>
                        </div>
                        <p className="text-[11px] text-[#A1A1AA] mt-1 leading-snug">
                          Classic arcade palette with vibrant rose & cyan accents.
                        </p>
                      </div>

                      {(stats.theme === 'default' || !stats.theme) ? (
                        <span className="w-5 h-5 rounded-full bg-[#F43F5E] text-white flex items-center justify-center shrink-0 shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full border border-[#27272A] bg-[#18181C] shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#27272A]/60 text-[10px] font-mono-arcade">
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-[#F43F5E]" />
                        <span className="w-3 h-3 rounded-full bg-[#38BDF8]" />
                        <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                        <span className="w-3 h-3 rounded-full bg-[#0A0A0B] border border-[#3F3F46]" />
                      </div>
                      <span className={(stats.theme === 'default' || !stats.theme) ? 'text-rose-400 font-bold' : 'text-[#71717A]'}>
                        {(stats.theme === 'default' || !stats.theme) ? 'Active' : 'Apply'}
                      </span>
                    </div>
                  </div>

                  {/* Theme 2: Retro Monochrome */}
                  <div
                    onClick={() => {
                      if (stats.theme !== 'retro-monochrome') {
                        sounds.playScore();
                        haptics.medium();
                        onUpdateTheme?.('retro-monochrome');
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
                      stats.theme === 'retro-monochrome'
                        ? 'bg-[#181818] border-white shadow-lg ring-1 ring-white/50'
                        : 'bg-[#0A0A0C] border-[#27272A] hover:border-[#3F3F46] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Retro Monochrome</span>
                          <span className="text-[9px] font-mono-arcade px-1.5 py-0.2 rounded bg-white text-black font-black">
                            Clean
                          </span>
                        </div>
                        <p className="text-[11px] text-[#A1A1AA] mt-1 leading-snug">
                          High-contrast crisp black & white terminal aesthetic.
                        </p>
                      </div>

                      {stats.theme === 'retro-monochrome' ? (
                        <span className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-md">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full border border-[#27272A] bg-[#18181C] shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#27272A]/60 text-[10px] font-mono-arcade">
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-white" />
                        <span className="w-3 h-3 rounded-full bg-[#E4E4E7]" />
                        <span className="w-3 h-3 rounded-full bg-[#71717A]" />
                        <span className="w-3 h-3 rounded-full bg-black border border-white/60" />
                      </div>
                      <span className={stats.theme === 'retro-monochrome' ? 'text-white font-bold' : 'text-[#71717A]'}>
                        {stats.theme === 'retro-monochrome' ? 'Active' : 'Apply'}
                      </span>
                    </div>
                  </div>

                  {/* Theme 3: Cyberpunk Synthwave */}
                  <div
                    onClick={() => {
                      if (stats.theme !== 'cyberpunk') {
                        sounds.playScore();
                        haptics.medium();
                        onUpdateTheme?.('cyberpunk');
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
                      stats.theme === 'cyberpunk'
                        ? 'bg-[#180F2A] border-[#FACC15] shadow-lg ring-1 ring-[#FACC15]/40'
                        : 'bg-[#0A0A0C] border-[#27272A] hover:border-[#3F3F46] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Cyberpunk</span>
                          <span className="text-[9px] font-mono-arcade px-1.5 py-0.2 rounded bg-yellow-400 text-black font-bold">
                            Synthwave
                          </span>
                        </div>
                        <p className="text-[11px] text-[#A1A1AA] mt-1 leading-snug">
                          Electric neon yellow & hot magenta on deep void violet.
                        </p>
                      </div>

                      {stats.theme === 'cyberpunk' ? (
                        <span className="w-5 h-5 rounded-full bg-[#FACC15] text-black flex items-center justify-center shrink-0 shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full border border-[#27272A] bg-[#18181C] shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#27272A]/60 text-[10px] font-mono-arcade">
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-[#FACC15]" />
                        <span className="w-3 h-3 rounded-full bg-[#EC4899]" />
                        <span className="w-3 h-3 rounded-full bg-[#06B6D4]" />
                        <span className="w-3 h-3 rounded-full bg-[#0A0612] border border-[#3B1C56]" />
                      </div>
                      <span className={stats.theme === 'cyberpunk' ? 'text-yellow-400 font-bold' : 'text-[#71717A]'}>
                        {stats.theme === 'cyberpunk' ? 'Active' : 'Apply'}
                      </span>
                    </div>
                  </div>

                  {/* Theme 4: 8-Bit Emerald */}
                  <div
                    onClick={() => {
                      if (stats.theme !== 'matrix-emerald') {
                        sounds.playScore();
                        haptics.medium();
                        onUpdateTheme?.('matrix-emerald');
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
                      stats.theme === 'matrix-emerald'
                        ? 'bg-[#0A1810] border-[#22C55E] shadow-lg ring-1 ring-[#22C55E]/40'
                        : 'bg-[#0A0A0C] border-[#27272A] hover:border-[#3F3F46] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">8-Bit Emerald</span>
                          <span className="text-[9px] font-mono-arcade px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                            Matrix
                          </span>
                        </div>
                        <p className="text-[11px] text-[#A1A1AA] mt-1 leading-snug">
                          Phosphor terminal green inspired by classic handhelds.
                        </p>
                      </div>

                      {stats.theme === 'matrix-emerald' ? (
                        <span className="w-5 h-5 rounded-full bg-[#22C55E] text-black flex items-center justify-center shrink-0 shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full border border-[#27272A] bg-[#18181C] shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#27272A]/60 text-[10px] font-mono-arcade">
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-[#22C55E]" />
                        <span className="w-3 h-3 rounded-full bg-[#86EFAC]" />
                        <span className="w-3 h-3 rounded-full bg-[#A3E635]" />
                        <span className="w-3 h-3 rounded-full bg-[#040D07] border border-[#166534]" />
                      </div>
                      <span className={stats.theme === 'matrix-emerald' ? 'text-emerald-400 font-bold' : 'text-[#71717A]'}>
                        {stats.theme === 'matrix-emerald' ? 'Active' : 'Apply'}
                      </span>
                    </div>
                  </div>

                  {/* Theme 5: Solar Flare */}
                  <div
                    onClick={() => {
                      if (stats.theme !== 'sunset-amber') {
                        sounds.playScore();
                        haptics.medium();
                        onUpdateTheme?.('sunset-amber');
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
                      stats.theme === 'sunset-amber'
                        ? 'bg-[#1C120C] border-[#F59E0B] shadow-lg ring-1 ring-[#F59E0B]/40'
                        : 'bg-[#0A0A0C] border-[#27272A] hover:border-[#3F3F46] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">Solar Flare</span>
                          <span className="text-[9px] font-mono-arcade px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                            Sunset
                          </span>
                        </div>
                        <p className="text-[11px] text-[#A1A1AA] mt-1 leading-snug">
                          Warm amber & neon tangerine blaze with flame accents.
                        </p>
                      </div>

                      {stats.theme === 'sunset-amber' ? (
                        <span className="w-5 h-5 rounded-full bg-[#F59E0B] text-black flex items-center justify-center shrink-0 shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full border border-[#27272A] bg-[#18181C] shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#27272A]/60 text-[10px] font-mono-arcade">
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                        <span className="w-3 h-3 rounded-full bg-[#FB923C]" />
                        <span className="w-3 h-3 rounded-full bg-[#F43F5E]" />
                        <span className="w-3 h-3 rounded-full bg-[#0D0907] border border-[#7C2D12]" />
                      </div>
                      <span className={stats.theme === 'sunset-amber' ? 'text-amber-400 font-bold' : 'text-[#71717A]'}>
                        {stats.theme === 'sunset-amber' ? 'Active' : 'Apply'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AUDIO & HARDWARE SETTINGS */}
              <div className="flex flex-col gap-3 pt-2 border-t border-[#27272A]">
                <h3 className="text-xs font-mono-arcade text-[#A1A1AA] uppercase font-bold tracking-wider">
                  Audio & Hardware Feedback
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Web Audio Oscillators */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0A0C] border border-[#27272A]">
                    <div className="flex items-center gap-3">
                      {stats.soundEnabled ? (
                        <Volume2 className="w-5 h-5 text-[#F43F5E]" />
                      ) : (
                        <VolumeX className="w-5 h-5 text-[#52525B]" />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">Synthesized Audio FX</span>
                        <span className="text-[10px] text-[#71717A] font-mono-arcade">
                          0-latency Web Audio oscillators
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const newEnabled = !stats.soundEnabled;
                        sounds.setMuted(!newEnabled);
                        onUpdateSound(newEnabled, stats.volume);
                      }}
                      className={`px-3.5 py-1.5 rounded-full font-mono-arcade text-xs font-black transition-colors cursor-pointer ${
                        stats.soundEnabled
                          ? 'bg-[#F43F5E] text-white shadow-sm'
                          : 'bg-[#27272A] text-[#A1A1AA]'
                      }`}
                    >
                      {stats.soundEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Mobile Haptics */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0A0C] border border-[#27272A]">
                    <div className="flex items-center gap-3">
                      <Smartphone className={`w-5 h-5 ${stats.hapticsEnabled !== false ? 'text-[#10B981]' : 'text-[#52525B]'}`} />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">Haptic Vibration</span>
                        <span className="text-[10px] text-[#71717A] font-mono-arcade">
                          Tactile feedback pulses
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextHaptics = !(stats.hapticsEnabled !== false);
                        haptics.setEnabled(nextHaptics);
                        if (nextHaptics) {
                          haptics.combo();
                        }
                        if (onUpdateHaptics) {
                          onUpdateHaptics(nextHaptics);
                        }
                      }}
                      className={`px-3.5 py-1.5 rounded-full font-mono-arcade text-xs font-black transition-colors cursor-pointer ${
                        stats.hapticsEnabled !== false
                          ? 'bg-[#10B981] text-white shadow-sm'
                          : 'bg-[#27272A] text-[#A1A1AA]'
                      }`}
                    >
                      {stats.hapticsEnabled !== false ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>

              {/* COMPREHENSIVE PER-GAME BEST RECORDS TABLE */}
              <div className="flex flex-col gap-3 pt-2 border-t border-[#27272A]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-mono-arcade text-[#A1A1AA] uppercase font-bold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" /> Per-Game Personal Records ({GAMES_REGISTRY.length} Games)
                  </h3>

                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={statsSearchQuery}
                      onChange={(e) => setStatsSearchQuery(e.target.value)}
                      placeholder="Filter records..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0A0A0C] border border-[#27272A] text-xs font-mono-arcade text-white placeholder-[#71717A] focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {GAMES_REGISTRY.filter((g) => {
                    if (!statsSearchQuery.trim()) return true;
                    return (
                      g.title.toLowerCase().includes(statsSearchQuery.toLowerCase()) ||
                      g.category.toLowerCase().includes(statsSearchQuery.toLowerCase())
                    );
                  }).map((game) => {
                    const score = stats.highScores[game.id] || 0;
                    const plays = stats.playCounts[game.id] || 0;

                    return (
                      <div
                        key={game.id}
                        onClick={() => {
                          setSelectedGameId(game.id);
                          setLeaderboardScope('perGame');
                          setActiveTab('leaderboards');
                        }}
                        className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-[#0A0A0C] hover:bg-[#141418] border border-[#27272A] text-xs font-mono-arcade transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: game.accentColor }}
                          />
                          <span className="text-white font-bold group-hover:text-cyan-300 transition-colors truncate">
                            {game.title}
                          </span>
                          <span className="text-[10px] text-[#71717A] hidden sm:inline">
                            ({plays} {plays === 1 ? 'play' : 'plays'})
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={score > 0 ? 'text-amber-400 font-black' : 'text-[#52525B]'}>
                            {score > 0 ? score.toLocaleString() : '—'}
                          </span>
                          <div className="flex items-center gap-1 text-[#71717A] group-hover:text-white transition-colors text-[11px]">
                            <span>View Board</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DATA RESET UTILITY */}
              <div className="pt-3 border-t border-[#27272A]">
                {confirmClear ? (
                  <div className="flex flex-col gap-3 p-4 rounded-xl bg-rose-950/40 border border-rose-500/50">
                    <span className="text-xs text-rose-200 font-mono-arcade">
                      Reset all local high scores, unlocked achievements, levels and competitive rankings?
                    </span>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleResetAll}
                        className="flex-1 py-2 rounded-xl bg-[#F43F5E] hover:bg-[#E11D48] text-white font-mono-arcade text-xs font-black transition-colors cursor-pointer shadow-md"
                      >
                        CONFIRM DATA RESET
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="px-4 py-2 rounded-xl bg-[#27272A] hover:bg-[#3F3F46] text-white font-mono-arcade text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="text-xs text-[#71717A] hover:text-rose-400 font-mono-arcade transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Local High Scores & Achievements
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* POPUP MODAL: BADGE INSPECTOR DETAIL DIALOG                                */}
        {/* ========================================================================= */}
        {selectedBadge && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedBadge(null);
            }}
          >
            <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-[#27272A] p-6 shadow-2xl flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-200 text-slate-100">
              <button
                type="button"
                onClick={() => setSelectedBadge(null)}
                className="absolute top-4 right-4 p-2 rounded-xl text-[#71717A] hover:text-white bg-[#1C1C21] hover:bg-[#27272A] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center gap-3 pt-2">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border shadow-xl relative"
                  style={{
                    backgroundColor: selectedBadge.isUnlocked(stats)
                      ? `${selectedBadge.accentColor}25`
                      : '#1C1C21',
                    borderColor: selectedBadge.isUnlocked(stats)
                      ? `${selectedBadge.accentColor}70`
                      : '#27272A',
                    color: selectedBadge.isUnlocked(stats)
                      ? selectedBadge.accentColor
                      : '#71717A',
                  }}
                >
                  {renderBadgeIcon(selectedBadge.icon, 'w-8 h-8')}
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span
                    className={`text-[10px] font-mono-arcade font-black uppercase px-2.5 py-0.5 rounded border ${getTierBadgeStyle(
                      selectedBadge.tier
                    )}`}
                  >
                    {selectedBadge.tier} TIER • {selectedBadge.category.toUpperCase()}
                  </span>
                  <h3 className="text-lg font-black text-white mt-1 font-display">
                    {selectedBadge.title}
                  </h3>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed max-w-xs mt-0.5">
                    {selectedBadge.description}
                  </p>
                </div>
              </div>

              {/* Progress & Criteria Box */}
              <div className="p-4 rounded-xl bg-[#0A0A0C] border border-[#27272A] flex flex-col gap-2.5 font-mono-arcade text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Current Status:</span>
                  <span
                    className={
                      selectedBadge.isUnlocked(stats)
                        ? 'text-emerald-400 font-black flex items-center gap-1.5'
                        : 'text-amber-400 font-bold flex items-center gap-1.5'
                    }
                  >
                    {selectedBadge.isUnlocked(stats) ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Unlocked & Claimed
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-amber-400" /> In Progress
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA]">XP Reward:</span>
                  <span className="text-amber-400 font-black flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> +{selectedBadge.xpReward} XP
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Progress Count:</span>
                  <span className="text-white font-bold">
                    {selectedBadge.getProgressText(stats)}
                  </span>
                </div>

                {!selectedBadge.isUnlocked(stats) && (
                  <div className="w-full h-2 rounded-full bg-[#18181C] border border-[#27272A] overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full bg-[#38BDF8]"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (selectedBadge.getCurrentProgress(stats) / selectedBadge.targetGoal) * 100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setSelectedBadge(null);
                }}
                className="w-full py-2.5 rounded-xl bg-[#27272A] hover:bg-[#3F3F46] text-white font-mono-arcade text-xs font-black transition-colors cursor-pointer"
              >
                Close Showcase
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* POPUP MODAL: RANK TIER INSPECTOR DIALOG                                   */}
        {/* ========================================================================= */}
        {selectedRankTierInfo && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedRankTierInfo(null);
            }}
          >
            <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-[#27272A] p-6 shadow-2xl flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-200 text-slate-100">
              <button
                type="button"
                onClick={() => setSelectedRankTierInfo(null)}
                className="absolute top-4 right-4 p-2 rounded-xl text-[#71717A] hover:text-white bg-[#1C1C21] hover:bg-[#27272A] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center gap-3 pt-2">
                <div
                  className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black border shadow-xl"
                  style={{
                    backgroundColor: `${selectedRankTierInfo.color}25`,
                    borderColor: `${selectedRankTierInfo.color}70`,
                    color: selectedRankTierInfo.color,
                  }}
                >
                  <span className="text-[10px] font-mono-arcade text-[#A1A1AA]">TIER</span>
                  <span className="text-2xl font-mono-arcade">{selectedRankTierInfo.level}</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span
                    className="text-xs font-mono-arcade font-black uppercase tracking-wider"
                    style={{ color: selectedRankTierInfo.color }}
                  >
                    DIVISION {selectedRankTierInfo.level} • {selectedRankTierInfo.name}
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5 font-display">
                    {selectedRankTierInfo.title}
                  </h3>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed max-w-xs mt-0.5 font-mono-arcade">
                    Requirement: Unlock {selectedRankTierInfo.minBadges}+ arcade achievement badges
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0A0A0C] border border-[#27272A] flex flex-col gap-2 font-mono-arcade text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Your Status:</span>
                  <span
                    className={
                      unlockedBadgesCount >= selectedRankTierInfo.minBadges
                        ? 'text-emerald-400 font-black'
                        : 'text-amber-400 font-bold'
                    }
                  >
                    {unlockedBadgesCount >= selectedRankTierInfo.minBadges
                      ? '✓ Rank Requirement Achieved'
                      : `${selectedRankTierInfo.minBadges - unlockedBadgesCount} more badges needed`}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Badges Count:</span>
                  <span className="text-white font-bold">
                    {unlockedBadgesCount} / {selectedRankTierInfo.minBadges} Badges
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setSelectedRankTierInfo(null);
                }}
                className="w-full py-2.5 rounded-xl bg-[#27272A] hover:bg-[#3F3F46] text-white font-mono-arcade text-xs font-black transition-colors cursor-pointer"
              >
                Close Tier Details
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
