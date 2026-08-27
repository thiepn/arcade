import { UserStats, AppTheme } from '../types';

const STORAGE_KEY = 'micro_arcade_stats_v1';

const defaultStats: UserStats = {
  highScores: {},
  playCounts: {},
  totalPlayTimeSeconds: {},
  favorites: [],
  recentlyPlayed: [],
  soundEnabled: true,
  hapticsEnabled: true,
  volume: 0.8,
  theme: 'default',
};

export function getStoredStats(): UserStats {
  if (typeof window === 'undefined') return defaultStats;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStats;
    const parsed = JSON.parse(raw);
    return {
      ...defaultStats,
      ...parsed,
      highScores: parsed.highScores || {},
      playCounts: parsed.playCounts || {},
      totalPlayTimeSeconds: parsed.totalPlayTimeSeconds || {},
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      recentlyPlayed: Array.isArray(parsed.recentlyPlayed) ? parsed.recentlyPlayed : [],
      hapticsEnabled: parsed.hapticsEnabled !== undefined ? Boolean(parsed.hapticsEnabled) : true,
      theme: [
        'default',
        'retro-monochrome',
        'cyberpunk',
        'matrix-emerald',
        'sunset-amber',
      ].includes(parsed.theme)
        ? (parsed.theme as AppTheme)
        : 'default',
    };
  } catch (e) {
    console.warn('Failed to load stats from localStorage:', e);
    return defaultStats;
  }
}

export function saveStats(stats: UserStats): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn('Failed to save stats to localStorage:', e);
  }
}

export function recordGamePlay(gameId: string): UserStats {
  const current = getStoredStats();
  const playCounts = { ...current.playCounts, [gameId]: (current.playCounts[gameId] || 0) + 1 };
  
  // Maintain up to 5 unique recently played games
  const filteredRecent = current.recentlyPlayed.filter(id => id !== gameId);
  const recentlyPlayed = [gameId, ...filteredRecent].slice(0, 5);

  const updated: UserStats = {
    ...current,
    playCounts,
    recentlyPlayed,
  };
  saveStats(updated);
  return updated;
}

export function recordScore(gameId: string, score: number): { isNewHighScore: boolean; stats: UserStats } {
  const current = getStoredStats();
  const prevBest = current.highScores[gameId] || 0;
  const isNewHighScore = score > prevBest;
  
  const highScores = {
    ...current.highScores,
    [gameId]: Math.max(prevBest, score),
  };

  const updated: UserStats = {
    ...current,
    highScores,
  };
  saveStats(updated);
  return { isNewHighScore, stats: updated };
}

export function toggleFavoriteGame(gameId: string): UserStats {
  const current = getStoredStats();
  const isFav = current.favorites.includes(gameId);
  const favorites = isFav
    ? current.favorites.filter(id => id !== gameId)
    : [...current.favorites, gameId];

  const updated: UserStats = {
    ...current,
    favorites,
  };
  saveStats(updated);
  return updated;
}

export function updateSoundPreference(soundEnabled: boolean, volume?: number): UserStats {
  const current = getStoredStats();
  const updated: UserStats = {
    ...current,
    soundEnabled,
    volume: volume !== undefined ? volume : current.volume,
  };
  saveStats(updated);
  return updated;
}

export function updateHapticsPreference(hapticsEnabled: boolean): UserStats {
  const current = getStoredStats();
  const updated: UserStats = {
    ...current,
    hapticsEnabled,
  };
  saveStats(updated);
  return updated;
}

export function updateThemePreference(theme: AppTheme): UserStats {
  const current = getStoredStats();
  const updated: UserStats = {
    ...current,
    theme,
  };
  saveStats(updated);
  return updated;
}

export function clearAllStats(): UserStats {
  saveStats(defaultStats);
  return defaultStats;
}
