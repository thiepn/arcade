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

const freshStats = (): UserStats => ({ ...defaultStats, highScores: {}, playCounts: {}, totalPlayTimeSeconds: {}, favorites: [], recentlyPlayed: [] });
let memoryStats = freshStats();
let pendingWrite = false;
export const STORAGE_STATUS_EVENT = 'micro-arcade-storage-status';

export function isProgressSaved(): boolean { return !pendingWrite; }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,64}$/.test(value);
const numberMap = (value: unknown): Record<string, number> => Object.fromEntries(
  Object.entries(isRecord(value) ? value : {}).filter((item): item is [string, number] => validId(item[0]) && typeof item[1] === 'number' && Number.isFinite(item[1]) && item[1] >= 0 && item[1] <= Number.MAX_SAFE_INTEGER),
);
const idList = (value: unknown, limit = 100) => Array.isArray(value) ? [...new Set(value.filter(validId))].slice(0, limit) : [];

function normalizeStats(value: unknown): UserStats {
  const parsed = isRecord(value) ? value : {};
  const themes: AppTheme[] = ['default', 'retro-monochrome', 'cyberpunk', 'matrix-emerald', 'sunset-amber'];
  return {
    highScores: numberMap(parsed.highScores),
    playCounts: numberMap(parsed.playCounts),
    totalPlayTimeSeconds: numberMap(parsed.totalPlayTimeSeconds),
    favorites: idList(parsed.favorites),
    recentlyPlayed: idList(parsed.recentlyPlayed, 5),
    soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
    hapticsEnabled: typeof parsed.hapticsEnabled === 'boolean' ? parsed.hapticsEnabled : true,
    volume: typeof parsed.volume === 'number' && Number.isFinite(parsed.volume) ? Math.max(0, Math.min(1, parsed.volume)) : 0.8,
    theme: themes.includes(parsed.theme as AppTheme) ? parsed.theme as AppTheme : 'default',
  };
}

export function getStoredStats(): UserStats {
  if (typeof window === 'undefined') return freshStats();
  // A denied/quota-limited write must not erase this session's progress on the next action.
  if (pendingWrite) return normalizeStats(memoryStats);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    memoryStats = raw ? normalizeStats(JSON.parse(raw)) : freshStats();
    return normalizeStats(memoryStats);
  } catch {
    return normalizeStats(memoryStats);
  }
}

export function saveStats(stats: UserStats): void {
  if (typeof window === 'undefined') return;
  memoryStats = normalizeStats(stats);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStats));
    pendingWrite = false;
  } catch {
    pendingWrite = true;
  }
  window.dispatchEvent(new Event(STORAGE_STATUS_EVENT));
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
  if (!validId(gameId) || !Number.isFinite(score) || score < 0 || score > Number.MAX_SAFE_INTEGER) {
    return { isNewHighScore: false, stats: current };
  }
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
  const fresh = freshStats();
  saveStats(fresh);
  return fresh;
}
