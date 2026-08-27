import { GAMES_REGISTRY } from '../data/games';
import { UserStats } from '../types';

export type LeaderboardDivision = 'diamond' | 'platinum' | 'gold' | 'silver' | 'bronze';
export type LeaderboardScope = 'game' | 'global';

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  score: number;
  country: string;
  countryCode: string;
  badge?: string;
  timestamp: string;
  isUser?: boolean;
  avatarSeed?: number;
  division?: LeaderboardDivision;
  trend?: 'up' | 'down' | 'same';
  level?: number;
}

export interface GlobalOverallEntry {
  id: string;
  rank: number;
  name: string;
  ratingScore: number;
  totalScore: number;
  badgesUnlocked: number;
  country: string;
  countryCode: string;
  badgeTitle: string;
  division: LeaderboardDivision;
  level: number;
  isUser?: boolean;
  timestamp: string;
}

interface StoredLeaderboardData {
  [gameId: string]: LeaderboardEntry[];
}

const STORAGE_KEY = 'micro_arcade_global_leaderboards_v2';

const BOT_NAMES = [
  'PixelDrifter99',
  'NeonSamurai',
  'GlitchQueen',
  'QuantumPulse',
  'RetroViper',
  'HyperSonic_X',
  'StarVoyager',
  'AstroMiner',
  'VoidWalker',
  'BlazeRunner',
  'AeroAce',
  'LaserKnight',
  'TurboGamer',
  'ZeroGravity',
  'EchoStrike',
  'SynthWave84',
  'ChromaGhost',
  'BulletTime',
  'OrbitMaster',
  'ApexPilot',
  'PulseRider',
  'NovaCaptain',
  'ShadowByte',
  'FluxCapacitor',
  'NeonFalcon',
  'TitanStrike',
  'SparkyCat',
  'MegaByte',
  'CosmosKid',
  'CyberValkyrie',
  'PhantomRogue',
  'VaporBlade',
  'OmegaZenith',
  'SolarFlare',
  'MatrixHacker',
  'DriftKing_JP',
  'VanguardHero',
  'GravityWarp',
];

const COUNTRIES = [
  { flag: '🇯🇵', code: 'JP' },
  { flag: '🇺🇸', code: 'US' },
  { flag: '🇰🇷', code: 'KR' },
  { flag: '🇩🇪', code: 'DE' },
  { flag: '🇬🇧', code: 'GB' },
  { flag: '🇨🇦', code: 'CA' },
  { flag: '🇫🇷', code: 'FR' },
  { flag: '🇧🇷', code: 'BR' },
  { flag: '🇦🇺', code: 'AU' },
  { flag: '🇸🇬', code: 'SG' },
  { flag: '🇸🇪', code: 'SE' },
  { flag: '🇳🇱', code: 'NL' },
  { flag: '🇪🇸', code: 'ES' },
  { flag: '🇮🇹', code: 'IT' },
  { flag: '🇲🇽', code: 'MX' },
  { flag: '🇫🇮', code: 'FI' },
];

const BADGES = ['PRO', 'LEGEND', 'ACE', 'CHAMP', 'ELITE', 'VETERAN', 'VIP', 'SPEED', 'MASTER'];

const TIMESTAMPS = [
  'Just now',
  '5m ago',
  '18m ago',
  '45m ago',
  '2h ago',
  '4h ago',
  '7h ago',
  '1d ago',
  '2d ago',
  '3d ago',
  '5d ago',
];

export function getDivisionForRank(rank: number): LeaderboardDivision {
  if (rank === 1) return 'diamond';
  if (rank <= 3) return 'platinum';
  if (rank <= 6) return 'gold';
  if (rank <= 10) return 'silver';
  return 'bronze';
}

export function getDivisionColor(division: LeaderboardDivision): string {
  switch (division) {
    case 'diamond':
      return '#38BDF8';
    case 'platinum':
      return '#A855F7';
    case 'gold':
      return '#FACC15';
    case 'silver':
      return '#E2E8F0';
    case 'bronze':
      return '#FB923C';
  }
}

// Baseline score ranges calibrated per game type
function getGameBaseScoreConfig(gameId: string): { topBase: number; step: number; variance: number } {
  switch (gameId) {
    case 'drift':
      return { topBase: 24500, step: 1800, variance: 900 };
    case 'vanguard':
      return { topBase: 28800, step: 2200, variance: 1100 };
    case 'slingshot':
      return { topBase: 16400, step: 1200, variance: 600 };
    case 'miner':
      return { topBase: 19500, step: 1500, variance: 750 };
    case 'stack':
      return { topBase: 84, step: 6, variance: 3 };
    case 'reaction':
      return { topBase: 145, step: 8, variance: 4 };
    case 'orbit':
      return { topBase: 36, step: 3, variance: 1 };
    case 'dodge':
      return { topBase: 48, step: 4, variance: 2 };
    case 'pulse':
      return { topBase: 52, step: 4, variance: 2 };
    case 'merge':
      return { topBase: 8192, step: 600, variance: 250 };
    case 'typerush':
      return { topBase: 142, step: 9, variance: 4 };
    case 'oneline':
      return { topBase: 24, step: 2, variance: 1 };
    case 'breakout':
      return { topBase: 4800, step: 350, variance: 150 };
    case 'perfectstop':
      return { topBase: 998, step: 40, variance: 15 };
    case 'chain':
      return { topBase: 65, step: 5, variance: 2 };
    case 'gravity':
      return { topBase: 58, step: 4, variance: 2 };
    case 'blade':
      return { topBase: 86, step: 6, variance: 3 };
    case 'pinball':
      return { topBase: 15600, step: 1200, variance: 500 };
    case 'chrono':
      return { topBase: 42, step: 3, variance: 1 };
    case 'matrix':
      return { topBase: 38, step: 3, variance: 1 };
    case 'rhythm':
      return { topBase: 38500, step: 2800, variance: 1200 };
    case 'tower':
      return { topBase: 22000, step: 1800, variance: 800 };
    case 'snake':
      return { topBase: 12400, step: 950, variance: 400 };
    default:
      return { topBase: 5000, step: 400, variance: 200 };
  }
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function stringToHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateInitialLeaderboard(gameId: string): LeaderboardEntry[] {
  const config = getGameBaseScoreConfig(gameId);
  const rng = seededRandom(stringToHash(gameId) + 42);

  const numEntries = 15;
  const entries: LeaderboardEntry[] = [];
  const usedNames = new Set<string>();

  let currentScore = config.topBase;

  for (let i = 0; i < numEntries; i++) {
    let nameIdx = Math.floor(rng() * BOT_NAMES.length);
    while (usedNames.has(BOT_NAMES[nameIdx])) {
      nameIdx = (nameIdx + 1) % BOT_NAMES.length;
    }
    const name = BOT_NAMES[nameIdx];
    usedNames.add(name);

    const countryObj = COUNTRIES[Math.floor(rng() * COUNTRIES.length)];
    const hasBadge = rng() > 0.35;
    const badge = hasBadge ? BADGES[Math.floor(rng() * BADGES.length)] : undefined;
    const timestamp = TIMESTAMPS[Math.min(i, TIMESTAMPS.length - 1)];
    const level = Math.max(2, Math.min(10, Math.floor(10 - i * 0.5 + (rng() * 2 - 1))));

    const entryScore = Math.max(1, Math.round(currentScore + (rng() * 2 - 1) * config.variance));
    currentScore = Math.max(1, currentScore - config.step);

    const trends: ('up' | 'down' | 'same')[] = ['up', 'down', 'same', 'same', 'up'];
    const trend = trends[Math.floor(rng() * trends.length)];

    entries.push({
      id: `bot-${gameId}-${i}`,
      rank: i + 1,
      name,
      score: entryScore,
      country: countryObj.flag,
      countryCode: countryObj.code,
      badge,
      timestamp,
      isUser: false,
      avatarSeed: stringToHash(name) % 100,
      division: getDivisionForRank(i + 1),
      trend,
      level,
    });
  }

  entries.sort((a, b) => b.score - a.score);
  entries.forEach((e, idx) => {
    e.rank = idx + 1;
    e.division = getDivisionForRank(idx + 1);
  });

  return entries;
}

export function getStoredLeaderboards(): StoredLeaderboardData {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load global leaderboards from localStorage:', e);
    return {};
  }
}

export function saveStoredLeaderboards(data: StoredLeaderboardData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save global leaderboards to localStorage:', e);
  }
}

export function getGlobalLeaderboardForGame(
  gameId: string,
  userHighScore: number
): {
  topEntries: LeaderboardEntry[];
  userRank: number | null;
  userEntry: LeaderboardEntry | null;
  totalCompetitors: number;
} {
  const allStored = getStoredLeaderboards();
  let baseEntries = allStored[gameId];

  if (!baseEntries || baseEntries.length === 0) {
    baseEntries = generateInitialLeaderboard(gameId);
    allStored[gameId] = baseEntries;
    saveStoredLeaderboards(allStored);
  }

  const botsOnly = baseEntries.filter((e) => !e.isUser);

  let combined: LeaderboardEntry[] = [...botsOnly];
  let userEntry: LeaderboardEntry | null = null;

  if (userHighScore > 0) {
    userEntry = {
      id: `user-${gameId}`,
      rank: 0,
      name: 'YOU (Local Legend)',
      score: userHighScore,
      country: '🌟',
      countryCode: 'YOU',
      badge: 'PLAYER',
      timestamp: 'Active Session',
      isUser: true,
      division: 'bronze',
      trend: 'up',
      level: 1,
    };
    combined.push(userEntry);
  }

  combined.sort((a, b) => b.score - a.score);

  let userRank: number | null = null;
  combined.forEach((entry, idx) => {
    entry.rank = idx + 1;
    entry.division = getDivisionForRank(idx + 1);
    if (entry.isUser) {
      userRank = entry.rank;
    }
  });

  const topEntries = combined.slice(0, 10);

  return {
    topEntries,
    userRank,
    userEntry,
    totalCompetitors: combined.length + 95,
  };
}

/**
 * Calculates simulated World Overall Arcade Championship Hall of Fame
 */
export function getOverallArcadeLeaderboard(stats: UserStats): {
  topEntries: GlobalOverallEntry[];
  userRank: number | null;
  userEntry: GlobalOverallEntry;
  totalWorldCompetitors: number;
} {
  const totalScore = (Object.values(stats.highScores) as number[]).reduce((a, b) => a + (b || 0), 0);
  const totalPlays = (Object.values(stats.playCounts) as number[]).reduce((a, b) => a + (b || 0), 0);
  
  // Calculate user rating score
  const userRating = Math.round((totalScore * 0.1) + (stats.favorites.length * 20) + (totalPlays * 10));

  const bots: GlobalOverallEntry[] = [
    {
      id: 'overall-bot-1',
      rank: 1,
      name: 'Vanguard_Apex',
      ratingScore: 9850,
      totalScore: 42300,
      badgesUnlocked: 20,
      country: '🇯🇵',
      countryCode: 'JP',
      badgeTitle: 'Apex Hall of Fame',
      division: 'diamond',
      level: 10,
      timestamp: '2h ago',
    },
    {
      id: 'overall-bot-2',
      rank: 2,
      name: 'QuantumGlitch',
      ratingScore: 7420,
      totalScore: 34100,
      badgesUnlocked: 18,
      country: '🇺🇸',
      countryCode: 'US',
      badgeTitle: 'Grandmaster Legend',
      division: 'platinum',
      level: 9,
      timestamp: '5m ago',
    },
    {
      id: 'overall-bot-3',
      rank: 3,
      name: 'NeonCyberKing',
      ratingScore: 5980,
      totalScore: 28900,
      badgesUnlocked: 16,
      country: '🇰🇷',
      countryCode: 'KR',
      badgeTitle: 'Grandmaster Legend',
      division: 'platinum',
      level: 8,
      timestamp: '18m ago',
    },
    {
      id: 'overall-bot-4',
      rank: 4,
      name: 'DriftPhantom',
      ratingScore: 4860,
      totalScore: 24200,
      badgesUnlocked: 14,
      country: '🇩🇪',
      countryCode: 'DE',
      badgeTitle: 'Arcade Master',
      division: 'gold',
      level: 7,
      timestamp: '1h ago',
    },
    {
      id: 'overall-bot-5',
      rank: 5,
      name: 'PixelKnight88',
      ratingScore: 3950,
      totalScore: 19800,
      badgesUnlocked: 12,
      country: '🇬🇧',
      countryCode: 'GB',
      badgeTitle: 'Arcade Master',
      division: 'gold',
      level: 6,
      timestamp: '4h ago',
    },
    {
      id: 'overall-bot-6',
      rank: 6,
      name: 'SolarFlare_X',
      ratingScore: 3200,
      totalScore: 15400,
      badgesUnlocked: 10,
      country: '🇫🇷',
      countryCode: 'FR',
      badgeTitle: 'Arcade Veteran',
      division: 'gold',
      level: 5,
      timestamp: '1d ago',
    },
    {
      id: 'overall-bot-7',
      rank: 7,
      name: 'VaporEcho',
      ratingScore: 2540,
      totalScore: 12100,
      badgesUnlocked: 8,
      country: '🇨🇦',
      countryCode: 'CA',
      badgeTitle: 'Arcade Veteran',
      division: 'silver',
      level: 4,
      timestamp: '2d ago',
    },
    {
      id: 'overall-bot-8',
      rank: 8,
      name: 'OrbitAstro',
      ratingScore: 1920,
      totalScore: 9200,
      badgesUnlocked: 6,
      country: '🇸🇬',
      countryCode: 'SG',
      badgeTitle: 'Active Challenger',
      division: 'silver',
      level: 3,
      timestamp: '3d ago',
    },
    {
      id: 'overall-bot-9',
      rank: 9,
      name: 'MatrixRogue',
      ratingScore: 1410,
      totalScore: 6800,
      badgesUnlocked: 4,
      country: '🇦🇺',
      countryCode: 'AU',
      badgeTitle: 'Active Challenger',
      division: 'silver',
      level: 2,
      timestamp: '4d ago',
    },
    {
      id: 'overall-bot-10',
      rank: 10,
      name: 'BlazeCat',
      ratingScore: 950,
      totalScore: 4100,
      badgesUnlocked: 2,
      country: '🇧🇷',
      countryCode: 'BR',
      badgeTitle: 'Rookie Contender',
      division: 'silver',
      level: 2,
      timestamp: '5d ago',
    },
  ];

  const userEntry: GlobalOverallEntry = {
    id: 'overall-user',
    rank: 0,
    name: 'YOU (Arcade Challenger)',
    ratingScore: userRating,
    totalScore,
    badgesUnlocked: 0,
    country: '🌟',
    countryCode: 'YOU',
    badgeTitle: 'Player Standing',
    division: 'bronze',
    level: 1,
    isUser: true,
    timestamp: 'Live Active',
  };

  const combined = [...bots, userEntry];
  combined.sort((a, b) => b.ratingScore - a.ratingScore);

  let userRank: number | null = null;
  combined.forEach((entry, idx) => {
    entry.rank = idx + 1;
    entry.division = getDivisionForRank(idx + 1);
    if (entry.isUser) {
      userRank = entry.rank;
    }
  });

  const topEntries = combined.slice(0, 10);

  return {
    topEntries,
    userRank,
    userEntry,
    totalWorldCompetitors: 340,
  };
}

export function simulateLiveCompetition(gameId: string): void {
  const allStored = getStoredLeaderboards();
  const baseEntries = allStored[gameId] || generateInitialLeaderboard(gameId);
  const config = getGameBaseScoreConfig(gameId);

  const updated = baseEntries.map((e) => {
    if (e.isUser) return e;
    if (Math.random() < 0.35) {
      const shift = Math.round((Math.random() * 2 - 1) * (config.variance * 0.4));
      return {
        ...e,
        score: Math.max(10, e.score + shift),
        timestamp: 'Just now',
        trend: shift > 0 ? ('up' as const) : shift < 0 ? ('down' as const) : ('same' as const),
      };
    }
    return e;
  });

  updated.sort((a, b) => b.score - a.score);
  updated.forEach((e, idx) => {
    e.rank = idx + 1;
    e.division = getDivisionForRank(idx + 1);
  });

  allStored[gameId] = updated;
  saveStoredLeaderboards(allStored);
}

export function resetAllLeaderboards(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

