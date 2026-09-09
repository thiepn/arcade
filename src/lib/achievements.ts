import { arcadeRating, arcadeTotal } from '../../shared/scoring';
import { UserStats, GameCategory } from '../types';
import { GAMES_REGISTRY } from '../data/games';
import { getGlobalLeaderboardForGame } from './leaderboards';

export type AchievementCategory = 'milestones' | 'scores' | 'variety' | 'skill' | 'competitive';
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'master';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string;
  accentColor: string;
  targetGoal: number;
  xpReward: number;
  getCurrentProgress: (stats: UserStats) => number;
  isUnlocked: (stats: UserStats) => boolean;
  getProgressText: (stats: UserStats) => string;
}

// --- HELPER STAT CALCULATORS ---

export function getTotalPlayCount(stats: UserStats): number {
  return (Object.values(stats.playCounts) as number[]).reduce((a, b) => a + (b || 0), 0);
}

export function getTotalHighScore(stats: UserStats): number {
  return arcadeTotal(stats.highScores);
}

export function getUniqueGamesCount(stats: UserStats): number {
  return Object.keys(stats.playCounts).filter((k) => (stats.playCounts[k] || 0) > 0).length;
}

export function getMaxSessionsInSingleGame(stats: UserStats): number {
  return Math.max(0, ...(Object.values(stats.playCounts) as number[]));
}

export function getGamesWithMinPlaysCount(stats: UserStats, minPlays: number): number {
  return Object.values(stats.playCounts).filter((count) => (count || 0) >= minPlays).length;
}

export function getGamesWithMinScoreCount(stats: UserStats, minScore: number): number {
  return GAMES_REGISTRY.filter((g) => (stats.highScores[g.id] || 0) >= minScore).length;
}

export function getCategoryHighScore(stats: UserStats, category: GameCategory): number {
  const games = GAMES_REGISTRY.filter((g) => g.category === category);
  return Math.max(0, ...games.map((g) => stats.highScores[g.id] || 0));
}

export function getCategoryTotalScore(stats: UserStats, category: GameCategory): number {
  const games = GAMES_REGISTRY.filter((g) => g.category === category);
  return games.reduce((sum, g) => sum + (stats.highScores[g.id] || 0), 0);
}

export function getBestGlobalRank(stats: UserStats): number | null {
  let best: number | null = null;
  for (const game of GAMES_REGISTRY) {
    const userScore = stats.highScores[game.id] || 0;
    if (userScore > 0) {
      const data = getGlobalLeaderboardForGame(game.id, userScore);
      if (data.userRank !== null) {
        if (best === null || data.userRank < best) {
          best = data.userRank;
        }
      }
    }
  }
  return best;
}

export function getTop10Count(stats: UserStats): number {
  let count = 0;
  for (const game of GAMES_REGISTRY) {
    const userScore = stats.highScores[game.id] || 0;
    if (userScore > 0) {
      const data = getGlobalLeaderboardForGame(game.id, userScore);
      if (data.userRank !== null && data.userRank <= 10) {
        count++;
      }
    }
  }
  return count;
}

export function getTop3Count(stats: UserStats): number {
  let count = 0;
  for (const game of GAMES_REGISTRY) {
    const userScore = stats.highScores[game.id] || 0;
    if (userScore > 0) {
      const data = getGlobalLeaderboardForGame(game.id, userScore);
      if (data.userRank !== null && data.userRank <= 3) {
        count++;
      }
    }
  }
  return count;
}

export function getRank1Count(stats: UserStats): number {
  let count = 0;
  for (const game of GAMES_REGISTRY) {
    const userScore = stats.highScores[game.id] || 0;
    if (userScore > 0) {
      const data = getGlobalLeaderboardForGame(game.id, userScore);
      if (data.userRank === 1) {
        count++;
      }
    }
  }
  return count;
}

// --- 48 BALANCED, HIGH-DIFFICULTY ACHIEVEMENTS REGISTRY ---

export const ACHIEVEMENTS_REGISTRY: Achievement[] = [
  // =========================================================================
  // 1. MILESTONES (Dedication, Sessions & Endurance Grinds)
  // =========================================================================
  {
    id: 'milestone_initiate',
    title: 'Arcade Initiate',
    description: 'Complete 15 total game sessions across the arcade catalog.',
    category: 'milestones',
    tier: 'bronze',
    icon: 'Play',
    accentColor: '#34D399',
    targetGoal: 15,
    xpReward: 100,
    getCurrentProgress: (stats) => Math.min(15, getTotalPlayCount(stats)),
    isUnlocked: (stats) => getTotalPlayCount(stats) >= 15,
    getProgressText: (stats) => `${Math.min(15, getTotalPlayCount(stats))} / 15 Sessions`,
  },
  {
    id: 'milestone_regular',
    title: 'Arcade Regular',
    description: 'Complete 50 total gaming sessions across any games in the arcade.',
    category: 'milestones',
    tier: 'silver',
    icon: 'Gamepad2',
    accentColor: '#38BDF8',
    targetGoal: 50,
    xpReward: 250,
    getCurrentProgress: (stats) => Math.min(50, getTotalPlayCount(stats)),
    isUnlocked: (stats) => getTotalPlayCount(stats) >= 50,
    getProgressText: (stats) => `${Math.min(50, getTotalPlayCount(stats))} / 50 Sessions`,
  },
  {
    id: 'milestone_veteran',
    title: 'Cabinet Veteran',
    description: 'Log 120 total gaming sessions like a true arcade enthusiast.',
    category: 'milestones',
    tier: 'silver',
    icon: 'Flame',
    accentColor: '#FB923C',
    targetGoal: 120,
    xpReward: 400,
    getCurrentProgress: (stats) => Math.min(120, getTotalPlayCount(stats)),
    isUnlocked: (stats) => getTotalPlayCount(stats) >= 120,
    getProgressText: (stats) => `${Math.min(120, getTotalPlayCount(stats))} / 120 Sessions`,
  },
  {
    id: 'milestone_marathon',
    title: 'Endurance Marathoner',
    description: 'Log 250 total gaming sessions through unwavering persistence.',
    category: 'milestones',
    tier: 'gold',
    icon: 'Trophy',
    accentColor: '#FACC15',
    targetGoal: 250,
    xpReward: 700,
    getCurrentProgress: (stats) => Math.min(250, getTotalPlayCount(stats)),
    isUnlocked: (stats) => getTotalPlayCount(stats) >= 250,
    getProgressText: (stats) => `${Math.min(250, getTotalPlayCount(stats))} / 250 Sessions`,
  },
  {
    id: 'milestone_century',
    title: 'Century Master',
    description: 'Surpass 500 total game sessions across the entire cabinet.',
    category: 'milestones',
    tier: 'diamond',
    icon: 'Crown',
    accentColor: '#A855F7',
    targetGoal: 500,
    xpReward: 1200,
    getCurrentProgress: (stats) => Math.min(500, getTotalPlayCount(stats)),
    isUnlocked: (stats) => getTotalPlayCount(stats) >= 500,
    getProgressText: (stats) => `${Math.min(500, getTotalPlayCount(stats))} / 500 Sessions`,
  },
  {
    id: 'milestone_immortal',
    title: 'Immortal Cabinet Nomad',
    description: 'Reach a legendary 1,000 total sessions logged in the world circuit.',
    category: 'milestones',
    tier: 'master',
    icon: 'Sparkles',
    accentColor: '#F43F5E',
    targetGoal: 1000,
    xpReward: 2500,
    getCurrentProgress: (stats) => Math.min(1000, getTotalPlayCount(stats)),
    isUnlocked: (stats) => getTotalPlayCount(stats) >= 1000,
    getProgressText: (stats) => `${Math.min(1000, getTotalPlayCount(stats))} / 1,000 Sessions`,
  },
  {
    id: 'milestone_specialist',
    title: 'Dedicated Specialist',
    description: 'Log at least 35 sessions in a single individual mini-game.',
    category: 'milestones',
    tier: 'silver',
    icon: 'Target',
    accentColor: '#06B6D4',
    targetGoal: 35,
    xpReward: 350,
    getCurrentProgress: (stats) => Math.min(35, getMaxSessionsInSingleGame(stats)),
    isUnlocked: (stats) => getMaxSessionsInSingleGame(stats) >= 35,
    getProgressText: (stats) => `${Math.min(35, getMaxSessionsInSingleGame(stats))} / 35 in One Game`,
  },
  {
    id: 'milestone_balanced',
    title: 'Balanced Rotation',
    description: 'Log at least 15 sessions on 10 different games each.',
    category: 'milestones',
    tier: 'gold',
    icon: 'Layers',
    accentColor: '#6366F1',
    targetGoal: 10,
    xpReward: 800,
    getCurrentProgress: (stats) => Math.min(10, getGamesWithMinPlaysCount(stats, 15)),
    isUnlocked: (stats) => getGamesWithMinPlaysCount(stats, 15) >= 10,
    getProgressText: (stats) => `${Math.min(10, getGamesWithMinPlaysCount(stats, 15))} / 10 Games (15+ Plays)`,
  },

  // =========================================================================
  // 2. SCORE TARGETS (Cumulative High Score across all games)
  // =========================================================================
  {
    id: 'score_10k',
    title: 'Five Figures',
    description: 'Accumulate at least 10,000 combined Arcade Points across all your best records.',
    category: 'scores',
    tier: 'bronze',
    icon: 'Zap',
    accentColor: '#34D399',
    targetGoal: 10000,
    xpReward: 150,
    getCurrentProgress: (stats) => Math.min(10000, getTotalHighScore(stats)),
    isUnlocked: (stats) => getTotalHighScore(stats) >= 10000,
    getProgressText: (stats) => `${Math.min(10000, getTotalHighScore(stats)).toLocaleString()} / 10,000 AP`,
  },
  {
    id: 'score_30k',
    title: 'Score Gladiator',
    description: 'Reach 30,000 combined Arcade Points across all high score records.',
    category: 'scores',
    tier: 'silver',
    icon: 'Award',
    accentColor: '#38BDF8',
    targetGoal: 30000,
    xpReward: 350,
    getCurrentProgress: (stats) => Math.min(30000, getTotalHighScore(stats)),
    isUnlocked: (stats) => getTotalHighScore(stats) >= 30000,
    getProgressText: (stats) => `${Math.min(30000, getTotalHighScore(stats)).toLocaleString()} / 30,000 AP`,
  },
  {
    id: 'score_75k',
    title: 'Point Titan',
    description: 'Surpass 60,000 total combined Arcade Points across the arcade catalogue.',
    category: 'scores',
    tier: 'gold',
    icon: 'Medal',
    accentColor: '#F59E0B',
    targetGoal: 60000,
    xpReward: 700,
    getCurrentProgress: (stats) => Math.min(60000, getTotalHighScore(stats)),
    isUnlocked: (stats) => getTotalHighScore(stats) >= 60000,
    getProgressText: (stats) => `${Math.min(60000, getTotalHighScore(stats)).toLocaleString()} / 60,000 AP`,
  },
  {
    id: 'score_150k',
    title: 'Centurion Scorer',
    description: 'Break through the 100,000 total combined Arcade Points milestone.',
    category: 'scores',
    tier: 'gold',
    icon: 'Star',
    accentColor: '#EC4899',
    targetGoal: 100000,
    xpReward: 1000,
    getCurrentProgress: (stats) => Math.min(100000, getTotalHighScore(stats)),
    isUnlocked: (stats) => getTotalHighScore(stats) >= 100000,
    getProgressText: (stats) => `${Math.min(100000, getTotalHighScore(stats)).toLocaleString()} / 100,000 AP`,
  },
  {
    id: 'score_300k',
    title: 'Arcade Vanguard',
    description: 'Accumulate 150,000 total combined Arcade Points across all 32 games.',
    category: 'scores',
    tier: 'diamond',
    icon: 'Gem',
    accentColor: '#8B5CF6',
    targetGoal: 150000,
    xpReward: 1600,
    getCurrentProgress: (stats) => Math.min(150000, getTotalHighScore(stats)),
    isUnlocked: (stats) => getTotalHighScore(stats) >= 150000,
    getProgressText: (stats) => `${Math.min(150000, getTotalHighScore(stats)).toLocaleString()} / 150,000 AP`,
  },
  {
    id: 'score_600k',
    title: 'Circuit Titan',
    description: 'Cross the monumental 200,000 total cumulative high score boundary.',
    category: 'scores',
    tier: 'diamond',
    icon: 'Crown',
    accentColor: '#F43F5E',
    targetGoal: 200000,
    xpReward: 2400,
    getCurrentProgress: (stats) => Math.min(200000, getTotalHighScore(stats)),
    isUnlocked: (stats) => getTotalHighScore(stats) >= 200000,
    getProgressText: (stats) => `${Math.min(200000, getTotalHighScore(stats)).toLocaleString()} / 200,000 AP`,
  },
  {
    id: 'score_1m',
    title: 'Quarter-Million Apex',
    description: 'Build an arcade-wide portfolio with 250,000+ total combined Arcade Points.',
    category: 'scores',
    tier: 'master',
    icon: 'Sparkles',
    accentColor: '#FACC15',
    targetGoal: 250000,
    xpReward: 4000,
    getCurrentProgress: (stats) => Math.min(250000, getTotalHighScore(stats)),
    isUnlocked: (stats) => getTotalHighScore(stats) >= 250000,
    getProgressText: (stats) => `${Math.min(250000, getTotalHighScore(stats)).toLocaleString()} / 250,000 AP`,
  },

  // =========================================================================
  // 3. VARIETY & CATALOG EXPLORATION
  // =========================================================================
  {
    id: 'variety_scout_10',
    title: 'Catalog Scout',
    description: 'Play at least 10 different games in the Micro Arcade collection.',
    category: 'variety',
    tier: 'bronze',
    icon: 'Compass',
    accentColor: '#14B8A6',
    targetGoal: 10,
    xpReward: 150,
    getCurrentProgress: (stats) => Math.min(10, getUniqueGamesCount(stats)),
    isUnlocked: (stats) => getUniqueGamesCount(stats) >= 10,
    getProgressText: (stats) => `${Math.min(10, getUniqueGamesCount(stats))} / 10 Games`,
  },
  {
    id: 'variety_grand_tour',
    title: 'Grand Tour',
    description: 'Play every single mini-game in the entire arcade (all 32 games).',
    category: 'variety',
    tier: 'silver',
    icon: 'Globe',
    accentColor: '#6366F1',
    targetGoal: GAMES_REGISTRY.length,
    xpReward: 450,
    getCurrentProgress: (stats) => Math.min(GAMES_REGISTRY.length, getUniqueGamesCount(stats)),
    isUnlocked: (stats) => getUniqueGamesCount(stats) >= GAMES_REGISTRY.length,
    getProgressText: (stats) => `${Math.min(GAMES_REGISTRY.length, getUniqueGamesCount(stats))} / ${GAMES_REGISTRY.length} Games`,
  },
  {
    id: 'variety_curator_8',
    title: 'Master Curator',
    description: 'Save at least 8 favorite mini-games to your quick favorites shelf.',
    category: 'variety',
    tier: 'bronze',
    icon: 'Heart',
    accentColor: '#F43F5E',
    targetGoal: 8,
    xpReward: 150,
    getCurrentProgress: (stats) => Math.min(8, stats.favorites.length),
    isUnlocked: (stats) => stats.favorites.length >= 8,
    getProgressText: (stats) => `${Math.min(8, stats.favorites.length)} / 8 Favorites`,
  },
  {
    id: 'variety_omni_player',
    title: 'Omni-Player',
    description: 'Score at least 2,500+ points in every single one of the 32 mini-games.',
    category: 'variety',
    tier: 'gold',
    icon: 'Layers',
    accentColor: '#F59E0B',
    targetGoal: GAMES_REGISTRY.length,
    xpReward: 1200,
    getCurrentProgress: (stats) => Math.min(GAMES_REGISTRY.length, getGamesWithMinScoreCount(stats, 2500)),
    isUnlocked: (stats) => getGamesWithMinScoreCount(stats, 2500) >= GAMES_REGISTRY.length,
    getProgressText: (stats) => `${Math.min(GAMES_REGISTRY.length, getGamesWithMinScoreCount(stats, 2500))} / ${GAMES_REGISTRY.length} Games (2,500+ AP)`,
  },
  {
    id: 'variety_elite_mastery',
    title: 'Master of All Trades',
    description: 'Score at least 6,000+ points across at least 15 different mini-games.',
    category: 'variety',
    tier: 'diamond',
    icon: 'Gem',
    accentColor: '#A855F7',
    targetGoal: 15,
    xpReward: 1800,
    getCurrentProgress: (stats) => Math.min(15, getGamesWithMinScoreCount(stats, 6000)),
    isUnlocked: (stats) => getGamesWithMinScoreCount(stats, 6000) >= 15,
    getProgressText: (stats) => `${Math.min(15, getGamesWithMinScoreCount(stats, 6000))} / 15 Games (6,000+ AP)`,
  },
  {
    id: 'variety_genre_maestro',
    title: 'Polymath Champion',
    description: 'Accumulate 20,000+ points combined in both Reflex and Physics categories.',
    category: 'variety',
    tier: 'gold',
    icon: 'Award',
    accentColor: '#EC4899',
    targetGoal: 40000,
    xpReward: 950,
    getCurrentProgress: (stats) => {
      const reflex = getCategoryTotalScore(stats, 'Reflex');
      const physics = getCategoryTotalScore(stats, 'Physics');
      return Math.min(40000, reflex + physics);
    },
    isUnlocked: (stats) => {
      return getCategoryTotalScore(stats, 'Reflex') >= 20000 && getCategoryTotalScore(stats, 'Physics') >= 20000;
    },
    getProgressText: (stats) => {
      const reflex = getCategoryTotalScore(stats, 'Reflex');
      const physics = getCategoryTotalScore(stats, 'Physics');
      return `Reflex: ${reflex.toLocaleString()} / 20k • Physics: ${physics.toLocaleString()} / 20k`;
    },
  },

  // =========================================================================
  // 4. SKILL & CATEGORY MASTERY (Strict high score targets)
  // =========================================================================
  {
    id: 'skill_reflex_lightning',
    title: 'Lightning Synapses',
    description: 'Score 5,000+ points in any Reflex game (Orbit, Dodge, Chrono, Reaction, Blade, Serpent, Vanguard).',
    category: 'skill',
    tier: 'silver',
    icon: 'Zap',
    accentColor: '#06B6D4',
    targetGoal: 5000,
    xpReward: 400,
    getCurrentProgress: (stats) => Math.min(5000, getCategoryHighScore(stats, 'Reflex')),
    isUnlocked: (stats) => getCategoryHighScore(stats, 'Reflex') >= 5000,
    getProgressText: (stats) => `${Math.min(5000, getCategoryHighScore(stats, 'Reflex')).toLocaleString()} / 5,000 AP`,
  },
  {
    id: 'skill_reflex_olympian',
    title: 'Reflex Olympian',
    description: 'Score an astonishing 7,500+ points in any Reflex mini-game.',
    category: 'skill',
    tier: 'gold',
    icon: 'Zap',
    accentColor: '#38BDF8',
    targetGoal: 7500,
    xpReward: 900,
    getCurrentProgress: (stats) => Math.min(7500, getCategoryHighScore(stats, 'Reflex')),
    isUnlocked: (stats) => getCategoryHighScore(stats, 'Reflex') >= 7500,
    getProgressText: (stats) => `${Math.min(7500, getCategoryHighScore(stats, 'Reflex')).toLocaleString()} / 7,500 AP`,
  },
  {
    id: 'skill_physics_quantum',
    title: 'Quantum Trajectory',
    description: 'Score 6,000+ points in any Physics game (Pinball, Gravity, Drift, One Line, Slingshot).',
    category: 'skill',
    tier: 'silver',
    icon: 'Orbit',
    accentColor: '#8B5CF6',
    targetGoal: 6000,
    xpReward: 400,
    getCurrentProgress: (stats) => Math.min(6000, getCategoryHighScore(stats, 'Physics')),
    isUnlocked: (stats) => getCategoryHighScore(stats, 'Physics') >= 6000,
    getProgressText: (stats) => `${Math.min(6000, getCategoryHighScore(stats, 'Physics')).toLocaleString()} / 6,000 AP`,
  },
  {
    id: 'skill_physics_demigod',
    title: 'Physics Demigod',
    description: 'Score a massive 8,000+ points in any Physics mini-game.',
    category: 'skill',
    tier: 'gold',
    icon: 'Orbit',
    accentColor: '#A855F7',
    targetGoal: 8000,
    xpReward: 900,
    getCurrentProgress: (stats) => Math.min(8000, getCategoryHighScore(stats, 'Physics')),
    isUnlocked: (stats) => getCategoryHighScore(stats, 'Physics') >= 8000,
    getProgressText: (stats) => `${Math.min(8000, getCategoryHighScore(stats, 'Physics')).toLocaleString()} / 8,000 AP`,
  },
  {
    id: 'skill_puzzle_grandmaster',
    title: 'Grand Tactician',
    description: 'Score 8,000+ points in any Puzzle or Strategy game (Merge, Matrix, Chain).',
    category: 'skill',
    tier: 'silver',
    icon: 'Gem',
    accentColor: '#10B981',
    targetGoal: 8000,
    xpReward: 400,
    getCurrentProgress: (stats) => {
      const puzzle = getCategoryHighScore(stats, 'Puzzle');
      const strategy = getCategoryHighScore(stats, 'Strategy');
      return Math.min(8000, Math.max(puzzle, strategy));
    },
    isUnlocked: (stats) => {
      return getCategoryHighScore(stats, 'Puzzle') >= 8000 || getCategoryHighScore(stats, 'Strategy') >= 8000;
    },
    getProgressText: (stats) => {
      const top = Math.max(getCategoryHighScore(stats, 'Puzzle'), getCategoryHighScore(stats, 'Strategy'));
      return `${Math.min(8000, top).toLocaleString()} / 8,000 AP`;
    },
  },
  {
    id: 'skill_puzzle_singularity',
    title: 'Cognitive Singularity',
    description: 'Score 10,000+ points in any Puzzle or Strategy mini-game.',
    category: 'skill',
    tier: 'gold',
    icon: 'Gem',
    accentColor: '#34D399',
    targetGoal: 10000,
    xpReward: 900,
    getCurrentProgress: (stats) => {
      const puzzle = getCategoryHighScore(stats, 'Puzzle');
      const strategy = getCategoryHighScore(stats, 'Strategy');
      return Math.min(10000, Math.max(puzzle, strategy));
    },
    isUnlocked: (stats) => {
      return getCategoryHighScore(stats, 'Puzzle') >= 10000 || getCategoryHighScore(stats, 'Strategy') >= 10000;
    },
    getProgressText: (stats) => {
      const top = Math.max(getCategoryHighScore(stats, 'Puzzle'), getCategoryHighScore(stats, 'Strategy'));
      return `${Math.min(10000, top).toLocaleString()} / 10,000 AP`;
    },
  },
  {
    id: 'skill_timing_virtuoso',
    title: 'Chrono Metronome',
    description: 'Score 6,000+ points in any Timing game (Stack, Pulse, Perfect Stop).',
    category: 'skill',
    tier: 'silver',
    icon: 'Target',
    accentColor: '#EC4899',
    targetGoal: 6000,
    xpReward: 400,
    getCurrentProgress: (stats) => Math.min(6000, getCategoryHighScore(stats, 'Timing')),
    isUnlocked: (stats) => getCategoryHighScore(stats, 'Timing') >= 6000,
    getProgressText: (stats) => `${Math.min(6000, getCategoryHighScore(stats, 'Timing')).toLocaleString()} / 6,000 AP`,
  },
  {
    id: 'skill_type_speedster',
    title: 'Hypersonic Keymaster',
    description: 'Score 6,000+ points in Type Rush with flawless speed and accuracy.',
    category: 'skill',
    tier: 'silver',
    icon: 'Sparkles',
    accentColor: '#F59E0B',
    targetGoal: 6000,
    xpReward: 400,
    getCurrentProgress: (stats) => Math.min(6000, stats.highScores['typerush'] || 0),
    isUnlocked: (stats) => (stats.highScores['typerush'] || 0) >= 6000,
    getProgressText: (stats) => `${Math.min(6000, stats.highScores['typerush'] || 0).toLocaleString()} / 6,000 AP`,
  },

  // =========================================================================
  // 5. GAME-SPECIFIC PINNACLE FEATS
  // =========================================================================
  {
    id: 'feat_pinball_wizard',
    title: 'Pinball Wizard',
    description: 'Score 8,000+ points on the Neon Pinball machine.',
    category: 'skill',
    tier: 'gold',
    icon: 'Orbit',
    accentColor: '#8B5CF6',
    targetGoal: 8000,
    xpReward: 700,
    getCurrentProgress: (stats) => Math.min(8000, stats.highScores['pinball'] || 0),
    isUnlocked: (stats) => (stats.highScores['pinball'] || 0) >= 8000,
    getProgressText: (stats) => `${Math.min(8000, stats.highScores['pinball'] || 0).toLocaleString()} / 8,000 AP`,
  },
  {
    id: 'feat_blade_master',
    title: 'Laser Katana Grandmaster',
    description: 'Score 10,000+ points in Laser Blade slicing combos.',
    category: 'skill',
    tier: 'gold',
    icon: 'Flame',
    accentColor: '#EF4444',
    targetGoal: 10000,
    xpReward: 700,
    getCurrentProgress: (stats) => Math.min(10000, stats.highScores['blade'] || 0),
    isUnlocked: (stats) => (stats.highScores['blade'] || 0) >= 10000,
    getProgressText: (stats) => `${Math.min(10000, stats.highScores['blade'] || 0).toLocaleString()} / 10,000 AP`,
  },
  {
    id: 'feat_chrono_survivor',
    title: 'Chronosphere Survivor',
    description: 'Score 8,000+ points dodging relativistic obstacles in Chrono Wave.',
    category: 'skill',
    tier: 'gold',
    icon: 'Compass',
    accentColor: '#38BDF8',
    targetGoal: 8000,
    xpReward: 700,
    getCurrentProgress: (stats) => Math.min(8000, stats.highScores['chrono'] || 0),
    isUnlocked: (stats) => (stats.highScores['chrono'] || 0) >= 8000,
    getProgressText: (stats) => `${Math.min(8000, stats.highScores['chrono'] || 0).toLocaleString()} / 8,000 AP`,
  },
  {
    id: 'feat_serpent_ouroboros',
    title: 'Cyber Ouroboros',
    description: 'Score 10,000+ points weaving the grid in Cyber Serpent.',
    category: 'skill',
    tier: 'gold',
    icon: 'Zap',
    accentColor: '#34D399',
    targetGoal: 10000,
    xpReward: 700,
    getCurrentProgress: (stats) => Math.min(10000, stats.highScores['snake'] || 0),
    isUnlocked: (stats) => (stats.highScores['snake'] || 0) >= 10000,
    getProgressText: (stats) => `${Math.min(10000, stats.highScores['snake'] || 0).toLocaleString()} / 10,000 AP`,
  },
  {
    id: 'feat_stack_skyscraper',
    title: 'Skyscraper Architect',
    description: 'Reach 7,500+ points stacking flawless razor-sliced blocks.',
    category: 'skill',
    tier: 'gold',
    icon: 'Layers',
    accentColor: '#EC4899',
    targetGoal: 7500,
    xpReward: 700,
    getCurrentProgress: (stats) => Math.min(7500, stats.highScores['stack'] || 0),
    isUnlocked: (stats) => (stats.highScores['stack'] || 0) >= 7500,
    getProgressText: (stats) => `${Math.min(7500, stats.highScores['stack'] || 0).toLocaleString()} / 7,500 AP`,
  },
  {
    id: 'feat_orbit_apex',
    title: 'Orbital Zenith',
    description: 'Reach 8,000+ points dodging cosmic debris in Orbit Striker.',
    category: 'skill',
    tier: 'gold',
    icon: 'Orbit',
    accentColor: '#38BDF8',
    targetGoal: 8000,
    xpReward: 700,
    getCurrentProgress: (stats) => Math.min(8000, stats.highScores['orbit'] || 0),
    isUnlocked: (stats) => (stats.highScores['orbit'] || 0) >= 8000,
    getProgressText: (stats) => `${Math.min(8000, stats.highScores['orbit'] || 0).toLocaleString()} / 8,000 AP`,
  },
  {
    id: 'feat_merge_fusion',
    title: 'Neon Fusion Core',
    description: 'Score 8,000+ points combining numbered energy tiles in Neon Merge.',
    category: 'skill',
    tier: 'gold',
    icon: 'Gem',
    accentColor: '#10B981',
    targetGoal: 8000,
    xpReward: 700,
    getCurrentProgress: (stats) => Math.min(8000, stats.highScores['merge'] || 0),
    isUnlocked: (stats) => (stats.highScores['merge'] || 0) >= 8000,
    getProgressText: (stats) => `${Math.min(8000, stats.highScores['merge'] || 0).toLocaleString()} / 8,000 AP`,
  },
  {
    id: 'feat_vanguard_ace',
    title: 'Void Dreadnought Ace',
    description: 'Score 10,000+ points repelling alien waves in Space Vanguard.',
    category: 'skill',
    tier: 'gold',
    icon: 'Trophy',
    accentColor: '#F43F5E',
    targetGoal: 10000,
    xpReward: 700,
    getCurrentProgress: (stats) => Math.min(10000, stats.highScores['vanguard'] || 0),
    isUnlocked: (stats) => (stats.highScores['vanguard'] || 0) >= 10000,
    getProgressText: (stats) => `${Math.min(10000, stats.highScores['vanguard'] || 0).toLocaleString()} / 10,000 AP`,
  },
  {
    id: 'feat_rhythm_virtuoso',
    title: 'Synth Highway Maestro',
    description: 'Score 6,000+ points hitting flawless beat streaks in Neon Rhythm Tapper.',
    category: 'skill',
    tier: 'gold',
    icon: 'Radio',
    accentColor: '#EC4899',
    targetGoal: 6000,
    xpReward: 750,
    getCurrentProgress: (stats) => Math.min(6000, stats.highScores['rhythm'] || 0),
    isUnlocked: (stats) => (stats.highScores['rhythm'] || 0) >= 6000,
    getProgressText: (stats) => `${Math.min(6000, stats.highScores['rhythm'] || 0).toLocaleString()} / 6,000 AP`,
  },
  {
    id: 'feat_tower_ascendant',
    title: 'Gravity Spire Titan',
    description: 'Reach 8,000+ points ascending the cyber platforms in Gravity Tower Jumper.',
    category: 'skill',
    tier: 'gold',
    icon: 'Boxes',
    accentColor: '#38BDF8',
    targetGoal: 8000,
    xpReward: 750,
    getCurrentProgress: (stats) => Math.min(8000, stats.highScores['tower'] || 0),
    isUnlocked: (stats) => (stats.highScores['tower'] || 0) >= 8000,
    getProgressText: (stats) => `${Math.min(8000, stats.highScores['tower'] || 0).toLocaleString()} / 8,000 AP`,
  },

  // =========================================================================
  // 6. COMPETITIVE & WORLD LEADERBOARDS (Pinnacle Prestige)
  // =========================================================================
  {
    id: 'comp_top10_single',
    title: 'Top 10 Contender',
    description: 'Break into the Top 10 on any game’s global world leaderboard.',
    category: 'competitive',
    tier: 'bronze',
    icon: 'Medal',
    accentColor: '#38BDF8',
    targetGoal: 1,
    xpReward: 250,
    getCurrentProgress: (stats) => (getTop10Count(stats) >= 1 ? 1 : 0),
    isUnlocked: (stats) => getTop10Count(stats) >= 1,
    getProgressText: (stats) => {
      const best = getBestGlobalRank(stats);
      if (best === null) return 'Unranked / Top 10 Target';
      return best <= 10 ? `Rank #${best} Recorded!` : `Current Best: Rank #${best}`;
    },
  },
  {
    id: 'comp_podium_single',
    title: 'Podium Medalist',
    description: 'Claim a Top 3 podium medal (Rank #1, #2, or #3) on any global leaderboard.',
    category: 'competitive',
    tier: 'silver',
    icon: 'Trophy',
    accentColor: '#FACC15',
    targetGoal: 1,
    xpReward: 600,
    getCurrentProgress: (stats) => (getTop3Count(stats) >= 1 ? 1 : 0),
    isUnlocked: (stats) => getTop3Count(stats) >= 1,
    getProgressText: (stats) => {
      const best = getBestGlobalRank(stats);
      if (best === null) return 'Unranked / Podium Target';
      return best <= 3 ? `Rank #${best} Podium!` : `Current Best: Rank #${best}`;
    },
  },
  {
    id: 'comp_top10_multi_5',
    title: 'Multi-Track Challenger',
    description: 'Secure Top 10 rankings across at least 5 different games.',
    category: 'competitive',
    tier: 'silver',
    icon: 'Layers',
    accentColor: '#06B6D4',
    targetGoal: 5,
    xpReward: 750,
    getCurrentProgress: (stats) => Math.min(5, getTop10Count(stats)),
    isUnlocked: (stats) => getTop10Count(stats) >= 5,
    getProgressText: (stats) => `${Math.min(5, getTop10Count(stats))} / 5 Games in Top 10`,
  },
  {
    id: 'comp_top10_multi_10',
    title: 'Leaderboard Dominator',
    description: 'Secure Top 10 rankings across at least 10 different games.',
    category: 'competitive',
    tier: 'gold',
    icon: 'Award',
    accentColor: '#6366F1',
    targetGoal: 10,
    xpReward: 1200,
    getCurrentProgress: (stats) => Math.min(10, getTop10Count(stats)),
    isUnlocked: (stats) => getTop10Count(stats) >= 10,
    getProgressText: (stats) => `${Math.min(10, getTop10Count(stats))} / 10 Games in Top 10`,
  },
  {
    id: 'comp_podium_multi_5',
    title: 'Triple Crown Pentathlete',
    description: 'Claim Top 3 Podiums across at least 5 different games.',
    category: 'competitive',
    tier: 'gold',
    icon: 'Trophy',
    accentColor: '#F59E0B',
    targetGoal: 5,
    xpReward: 1500,
    getCurrentProgress: (stats) => Math.min(5, getTop3Count(stats)),
    isUnlocked: (stats) => getTop3Count(stats) >= 5,
    getProgressText: (stats) => `${Math.min(5, getTop3Count(stats))} / 5 Games on Podium`,
  },
  {
    id: 'comp_world_record_single',
    title: 'World Record Holder',
    description: 'Claim the #1 World Record on any simulated global leaderboard.',
    category: 'competitive',
    tier: 'diamond',
    icon: 'Crown',
    accentColor: '#F43F5E',
    targetGoal: 1,
    xpReward: 2000,
    getCurrentProgress: (stats) => (getRank1Count(stats) >= 1 ? 1 : 0),
    isUnlocked: (stats) => getRank1Count(stats) >= 1,
    getProgressText: (stats) => (getRank1Count(stats) >= 1 ? '👑 World Record #1 Claimed!' : 'Target: Rank #1 World Record'),
  },
  {
    id: 'comp_world_record_3',
    title: 'Dynasty Monarch',
    description: 'Hold the #1 World Record on at least 3 DIFFERENT games simultaneously.',
    category: 'competitive',
    tier: 'master',
    icon: 'Crown',
    accentColor: '#EC4899',
    targetGoal: 3,
    xpReward: 3500,
    getCurrentProgress: (stats) => Math.min(3, getRank1Count(stats)),
    isUnlocked: (stats) => getRank1Count(stats) >= 3,
    getProgressText: (stats) => `${Math.min(3, getRank1Count(stats))} / 3 Games with Rank #1`,
  },
  {
    id: 'comp_world_record_5',
    title: 'Arcade Overlord',
    description: 'Hold the #1 World Record on at least 5 DIFFERENT games simultaneously.',
    category: 'competitive',
    tier: 'master',
    icon: 'Sparkles',
    accentColor: '#FACC15',
    targetGoal: 5,
    xpReward: 5000,
    getCurrentProgress: (stats) => Math.min(5, getRank1Count(stats)),
    isUnlocked: (stats) => getRank1Count(stats) >= 5,
    getProgressText: (stats) => `${Math.min(5, getRank1Count(stats))} / 5 Games with Rank #1`,
  },
  {
    id: 'milestone_centurion',
    title: 'Neon Centurion',
    description: 'Log 200 total gaming sessions across the arcade catalog.',
    category: 'milestones',
    tier: 'master',
    icon: 'Flame',
    accentColor: '#F43F5E',
    targetGoal: 200,
    xpReward: 3000,
    getCurrentProgress: (stats) => Math.min(200, getTotalPlayCount(stats)),
    isUnlocked: (stats) => getTotalPlayCount(stats) >= 200,
    getProgressText: (stats) => `${Math.min(200, getTotalPlayCount(stats))} / 200 Sessions`,
  },
  {
    id: 'score_millionaire',
    title: 'Arcade Apex',
    description: 'Amass a monumental 300,000 combined Arcade Points across all arcade cabinets.',
    category: 'scores',
    tier: 'master',
    icon: 'Sparkles',
    accentColor: '#FACC15',
    targetGoal: 300000,
    xpReward: 4000,
    getCurrentProgress: (stats) => Math.min(300000, getTotalHighScore(stats)),
    isUnlocked: (stats) => getTotalHighScore(stats) >= 300000,
    getProgressText: (stats) => `${getTotalHighScore(stats).toLocaleString()} / 300,000 AP`,
  },
  {
    id: 'variety_grand_tour_25',
    title: 'Grand Tour Master',
    description: 'Play at least 1 session across 25 different micro-arcade games in the catalog.',
    category: 'variety',
    tier: 'diamond',
    icon: 'Gamepad2',
    accentColor: '#A855F7',
    targetGoal: 25,
    xpReward: 2500,
    getCurrentProgress: (stats) => Math.min(25, getUniqueGamesCount(stats)),
    isUnlocked: (stats) => getUniqueGamesCount(stats) >= 25,
    getProgressText: (stats) => `${Math.min(25, getUniqueGamesCount(stats))} / 25 Games Played`,
  },
  {
    id: 'variety_mastery_all_10',
    title: 'Comprehensive Dedication',
    description: 'Log at least 10 gameplay sessions across 15 different games.',
    category: 'variety',
    tier: 'master',
    icon: 'Trophy',
    accentColor: '#FB923C',
    targetGoal: 15,
    xpReward: 3500,
    getCurrentProgress: (stats) => Math.min(15, getGamesWithMinPlaysCount(stats, 10)),
    isUnlocked: (stats) => getGamesWithMinPlaysCount(stats, 10) >= 15,
    getProgressText: (stats) => `${Math.min(15, getGamesWithMinPlaysCount(stats, 10))} / 15 Games with 10+ Plays`,
  },
  {
    id: 'skill_score_10k_multi_10',
    title: 'High Roller Syndicate',
    description: 'Score 10,000+ points across at least 10 different games.',
    category: 'skill',
    tier: 'diamond',
    icon: 'Zap',
    accentColor: '#38BDF8',
    targetGoal: 10,
    xpReward: 3000,
    getCurrentProgress: (stats) => Math.min(10, getGamesWithMinScoreCount(stats, 10000)),
    isUnlocked: (stats) => getGamesWithMinScoreCount(stats, 10000) >= 10,
    getProgressText: (stats) => `${Math.min(10, getGamesWithMinScoreCount(stats, 10000))} / 10 Games with 10k+ AP`,
  },
  {
    id: 'skill_score_25k_multi_6',
    title: 'Prodigious Range',
    description: 'Score 25,000+ points across at least 6 different games.',
    category: 'skill',
    tier: 'master',
    icon: 'Flame',
    accentColor: '#EC4899',
    targetGoal: 6,
    xpReward: 4000,
    getCurrentProgress: (stats) => Math.min(6, getGamesWithMinScoreCount(stats, 25000)),
    isUnlocked: (stats) => getGamesWithMinScoreCount(stats, 25000) >= 6,
    getProgressText: (stats) => `${Math.min(6, getGamesWithMinScoreCount(stats, 25000))} / 6 Games with 25k+ AP`,
  },
  {
    id: 'comp_top10_multi_12',
    title: 'Global Contender Elite',
    description: 'Achieve a Top 10 World Rank on at least 12 different game leaderboards.',
    category: 'competitive',
    tier: 'master',
    icon: 'Crown',
    accentColor: '#D946EF',
    targetGoal: 12,
    xpReward: 3500,
    getCurrentProgress: (stats) => Math.min(12, getTop10Count(stats)),
    isUnlocked: (stats) => getTop10Count(stats) >= 12,
    getProgressText: (stats) => `${Math.min(12, getTop10Count(stats))} / 12 Games in Top 10`,
  },
  {
    id: 'comp_podium_multi_8',
    title: 'Immortal Podium Dominator',
    description: 'Claim Top 3 Podiums across at least 8 different game leaderboards.',
    category: 'competitive',
    tier: 'master',
    icon: 'Sparkles',
    accentColor: '#FACC15',
    targetGoal: 8,
    xpReward: 5000,
    getCurrentProgress: (stats) => Math.min(8, getTop3Count(stats)),
    isUnlocked: (stats) => getTop3Count(stats) >= 8,
    getProgressText: (stats) => `${Math.min(8, getTop3Count(stats))} / 8 Games on Podium`,
  },
];

// --- 10-TIER COMPETITIVE RANK PROGRESSION SYSTEM ---

export interface PlayerRankTier {
  level: number;
  name: 'Rookie' | 'Challenger' | 'Veteran' | 'Specialist' | 'Virtuoso' | 'Master' | 'Grandmaster' | 'Apex' | 'Immortal' | 'Ascended';
  title: string;
  minBadges: number;
  color: string;
  glowColor: string;
}

export const RANK_TIERS: PlayerRankTier[] = [
  { level: 1, name: 'Rookie', title: 'Rookie Contender', minBadges: 0, color: '#34D399', glowColor: 'rgba(52, 211, 153, 0.35)' },
  { level: 2, name: 'Challenger', title: 'Active Challenger', minBadges: 4, color: '#06B6D4', glowColor: 'rgba(6, 182, 212, 0.35)' },
  { level: 3, name: 'Veteran', title: 'Arcade Veteran', minBadges: 10, color: '#38BDF8', glowColor: 'rgba(56, 189, 248, 0.4)' },
  { level: 4, name: 'Specialist', title: 'Cabinet Specialist', minBadges: 16, color: '#6366F1', glowColor: 'rgba(99, 102, 241, 0.4)' },
  { level: 5, name: 'Virtuoso', title: 'Score Virtuoso', minBadges: 23, color: '#8B5CF6', glowColor: 'rgba(139, 92, 246, 0.45)' },
  { level: 6, name: 'Master', title: 'Elite Master', minBadges: 30, color: '#EC4899', glowColor: 'rgba(236, 72, 153, 0.5)' },
  { level: 7, name: 'Grandmaster', title: 'Grandmaster Legend', minBadges: 36, color: '#F59E0B', glowColor: 'rgba(245, 158, 11, 0.55)' },
  { level: 8, name: 'Apex', title: 'Apex Champion', minBadges: 41, color: '#F97316', glowColor: 'rgba(249, 115, 22, 0.6)' },
  { level: 9, name: 'Immortal', title: 'Cosmic Immortal', minBadges: 46, color: '#EF4444', glowColor: 'rgba(239, 68, 68, 0.65)' },
  { level: 10, name: 'Ascended', title: 'Ascended Arcade Deity', minBadges: 50, color: '#FACC15', glowColor: 'rgba(250, 204, 21, 0.75)' },
];

export interface PlayerRankProfile {
  title: string;
  rankLevel: number;
  badgeCount: number;
  totalBadges: number;
  completionPercent: number;
  color: string;
  glowColor: string;
  nextThreshold: number | null;
  minBadgesForCurrent: number;
  ratingScore: number;
  rankTierName: string;
}

export function getPlayerRankProfile(stats: UserStats): PlayerRankProfile {
  const unlockedCount = ACHIEVEMENTS_REGISTRY.filter((a) => a.isUnlocked(stats)).length;
  const totalBadges = ACHIEVEMENTS_REGISTRY.length;
  const completionPercent = Math.round((unlockedCount / totalBadges) * 100);

  // Rating is performance-only and identical to the overall leaderboard.
  const ratingScore = arcadeRating(stats.highScores);

  // Find active tier by highest met threshold
  const currentTier =
    RANK_TIERS.slice()
      .reverse()
      .find((t) => unlockedCount >= t.minBadges) || RANK_TIERS[0];

  const nextTier = RANK_TIERS.find((t) => t.level === currentTier.level + 1);

  return {
    title: currentTier.title,
    rankLevel: currentTier.level,
    badgeCount: unlockedCount,
    totalBadges,
    completionPercent,
    color: currentTier.color,
    glowColor: currentTier.glowColor,
    nextThreshold: nextTier ? nextTier.minBadges : null,
    minBadgesForCurrent: currentTier.minBadges,
    ratingScore,
    rankTierName: currentTier.name,
  };
}

// --- 15-LEVEL PLAYER XP & PROGRESSION SYSTEM ---

export interface PlayerLevelThreshold {
  level: number;
  title: string;
  minXP: number;
  accentColor: string;
  glowColor: string;
  badgeTier: AchievementTier;
}

export const LEVEL_THRESHOLDS: PlayerLevelThreshold[] = [
  { level: 1, title: 'Novice Contender', minXP: 0, accentColor: '#10B981', glowColor: 'rgba(16,185,129,0.35)', badgeTier: 'bronze' },
  { level: 2, title: 'Arcade Rookie', minXP: 300, accentColor: '#06B6D4', glowColor: 'rgba(6,182,212,0.35)', badgeTier: 'bronze' },
  { level: 3, title: 'Skill Challenger', minXP: 800, accentColor: '#38BDF8', glowColor: 'rgba(56,189,248,0.4)', badgeTier: 'silver' },
  { level: 4, title: 'Score Chaser', minXP: 1600, accentColor: '#6366F1', glowColor: 'rgba(99,102,241,0.4)', badgeTier: 'silver' },
  { level: 5, title: 'Arcade Regular', minXP: 2800, accentColor: '#8B5CF6', glowColor: 'rgba(139,92,246,0.45)', badgeTier: 'silver' },
  { level: 6, title: 'Pixel Veteran', minXP: 4500, accentColor: '#EC4899', glowColor: 'rgba(236,72,153,0.45)', badgeTier: 'gold' },
  { level: 7, title: 'Cabinet Master', minXP: 6800, accentColor: '#F59E0B', glowColor: 'rgba(245,158,11,0.5)', badgeTier: 'gold' },
  { level: 8, title: 'Retro Champion', minXP: 9800, accentColor: '#F97316', glowColor: 'rgba(249,115,22,0.5)', badgeTier: 'gold' },
  { level: 9, title: 'Precision Tactician', minXP: 13500, accentColor: '#EF4444', glowColor: 'rgba(239,68,68,0.55)', badgeTier: 'diamond' },
  { level: 10, title: 'High-Roller Icon', minXP: 18000, accentColor: '#D946EF', glowColor: 'rgba(217,70,239,0.55)', badgeTier: 'diamond' },
  { level: 11, title: 'Grandmaster', minXP: 23000, accentColor: '#A855F7', glowColor: 'rgba(168,85,247,0.6)', badgeTier: 'diamond' },
  { level: 12, title: 'Apex Vanguard', minXP: 29000, accentColor: '#38BDF8', glowColor: 'rgba(56,189,248,0.6)', badgeTier: 'master' },
  { level: 13, title: 'Cosmic Immortal', minXP: 36000, accentColor: '#FB923C', glowColor: 'rgba(251,146,60,0.65)', badgeTier: 'master' },
  { level: 14, title: 'Arcade Sovereign', minXP: 44000, accentColor: '#F43F5E', glowColor: 'rgba(244,63,94,0.7)', badgeTier: 'master' },
  { level: 15, title: 'Ascended Legend', minXP: 52000, accentColor: '#FACC15', glowColor: 'rgba(250,204,21,0.8)', badgeTier: 'master' },
];

export interface PlayerLevelInfo {
  level: number;
  title: string;
  totalXP: number;
  maxPossibleXP: number;
  currentLevelMinXP: number;
  nextLevelXP: number | null;
  xpInCurrentLevel: number;
  xpNeededForCurrentLevel: number;
  progressPercent: number;
  isMaxLevel: boolean;
  accentColor: string;
  glowColor: string;
  badgeTier: AchievementTier;
}

export function getPlayerLevelInfo(stats: UserStats): PlayerLevelInfo {
  const maxPossibleXP = ACHIEVEMENTS_REGISTRY.reduce((sum, a) => sum + a.xpReward, 0);
  const totalXP = ACHIEVEMENTS_REGISTRY
    .filter((a) => a.isUnlocked(stats))
    .reduce((sum, a) => sum + a.xpReward, 0);

  const currentThreshold =
    LEVEL_THRESHOLDS.slice()
      .reverse()
      .find((t) => totalXP >= t.minXP) || LEVEL_THRESHOLDS[0];

  const nextThreshold = LEVEL_THRESHOLDS.find((t) => t.level === currentThreshold.level + 1);

  if (nextThreshold) {
    const xpInCurrentLevel = totalXP - currentThreshold.minXP;
    const xpNeededForCurrentLevel = nextThreshold.minXP - currentThreshold.minXP;
    const progressPercent = Math.min(
      100,
      Math.max(0, Math.round((xpInCurrentLevel / xpNeededForCurrentLevel) * 100))
    );

    return {
      level: currentThreshold.level,
      title: currentThreshold.title,
      totalXP,
      maxPossibleXP,
      currentLevelMinXP: currentThreshold.minXP,
      nextLevelXP: nextThreshold.minXP,
      xpInCurrentLevel,
      xpNeededForCurrentLevel,
      progressPercent,
      isMaxLevel: false,
      accentColor: currentThreshold.accentColor,
      glowColor: currentThreshold.glowColor,
      badgeTier: currentThreshold.badgeTier,
    };
  }

  // Max level reached
  return {
    level: currentThreshold.level,
    title: currentThreshold.title,
    totalXP,
    maxPossibleXP,
    currentLevelMinXP: currentThreshold.minXP,
    nextLevelXP: null,
    xpInCurrentLevel: totalXP - currentThreshold.minXP,
    xpNeededForCurrentLevel: 0,
    progressPercent: 100,
    isMaxLevel: true,
    accentColor: currentThreshold.accentColor,
    glowColor: currentThreshold.glowColor,
    badgeTier: currentThreshold.badgeTier,
  };
}

// Original score badges remain earned; they do not contribute to the performance rating.
// These frozen v1 predicates only read the immutable legacyHighScores archive.
const LEGACY_SCORE_PREDICATES: Record<string, (stats: UserStats) => boolean> = {
  'score_10k': (stats) => getTotalHighScore(stats) >= 10000,
  'score_30k': (stats) => getTotalHighScore(stats) >= 30000,
  'score_75k': (stats) => getTotalHighScore(stats) >= 75000,
  'score_150k': (stats) => getTotalHighScore(stats) >= 150000,
  'score_300k': (stats) => getTotalHighScore(stats) >= 300000,
  'score_600k': (stats) => getTotalHighScore(stats) >= 600000,
  'score_1m': (stats) => getTotalHighScore(stats) >= 1000000,
  'variety_omni_player': (stats) => getGamesWithMinScoreCount(stats, 2500) >= GAMES_REGISTRY.length,
  'variety_elite_mastery': (stats) => getGamesWithMinScoreCount(stats, 6000) >= 15,
  'variety_genre_maestro': (stats) => {
      return getCategoryTotalScore(stats, 'Reflex') >= 20000 && getCategoryTotalScore(stats, 'Physics') >= 20000;
    },
  'skill_reflex_lightning': (stats) => getCategoryHighScore(stats, 'Reflex') >= 5000,
  'skill_reflex_olympian': (stats) => getCategoryHighScore(stats, 'Reflex') >= 15000,
  'skill_physics_quantum': (stats) => getCategoryHighScore(stats, 'Physics') >= 6000,
  'skill_physics_demigod': (stats) => getCategoryHighScore(stats, 'Physics') >= 18000,
  'skill_puzzle_grandmaster': (stats) => {
      return getCategoryHighScore(stats, 'Puzzle') >= 8000 || getCategoryHighScore(stats, 'Strategy') >= 8000;
    },
  'skill_puzzle_singularity': (stats) => {
      return getCategoryHighScore(stats, 'Puzzle') >= 20000 || getCategoryHighScore(stats, 'Strategy') >= 20000;
    },
  'skill_timing_virtuoso': (stats) => getCategoryHighScore(stats, 'Timing') >= 6000,
  'skill_type_speedster': (stats) => (stats.highScores['typerush'] || 0) >= 6000,
  'feat_pinball_wizard': (stats) => (stats.highScores['pinball'] || 0) >= 12000,
  'feat_blade_master': (stats) => (stats.highScores['blade'] || 0) >= 10000,
  'feat_chrono_survivor': (stats) => (stats.highScores['chrono'] || 0) >= 8000,
  'feat_serpent_ouroboros': (stats) => (stats.highScores['snake'] || 0) >= 10000,
  'feat_stack_skyscraper': (stats) => (stats.highScores['stack'] || 0) >= 7500,
  'feat_orbit_apex': (stats) => (stats.highScores['orbit'] || 0) >= 8000,
  'feat_merge_fusion': (stats) => (stats.highScores['merge'] || 0) >= 12000,
  'feat_vanguard_ace': (stats) => (stats.highScores['vanguard'] || 0) >= 10000,
  'feat_rhythm_virtuoso': (stats) => (stats.highScores['rhythm'] || 0) >= 15000,
  'feat_tower_ascendant': (stats) => (stats.highScores['tower'] || 0) >= 12000,
  'score_millionaire': (stats) => getTotalHighScore(stats) >= 1000000,
  'skill_score_10k_multi_10': (stats) => getGamesWithMinScoreCount(stats, 10000) >= 10,
  'skill_score_25k_multi_6': (stats) => getGamesWithMinScoreCount(stats, 25000) >= 6,
};
for (const achievement of ACHIEVEMENTS_REGISTRY) {
  const predicate = LEGACY_SCORE_PREDICATES[achievement.id];
  if (!predicate) continue;
  const earnedLegacy = (stats: UserStats) => Boolean(stats.legacyHighScores && Object.keys(stats.legacyHighScores).length && predicate({ ...stats, highScores: stats.legacyHighScores }));
  const current = achievement.isUnlocked, progress = achievement.getCurrentProgress, text = achievement.getProgressText;
  achievement.isUnlocked = (stats) => current(stats) || earnedLegacy(stats);
  achievement.getCurrentProgress = (stats) => earnedLegacy(stats) ? achievement.targetGoal : progress(stats);
  achievement.getProgressText = (stats) => earnedLegacy(stats) ? 'Earned under original scoring rules' : text(stats);
}
