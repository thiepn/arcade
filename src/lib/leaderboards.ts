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

export interface LeaderboardPlaySession {
  id: string;
  gameId: string;
  clientStartedAt: number;
  expiresAt: number;
}

interface GameLeaderboardData {
  topEntries: LeaderboardEntry[];
  userRank: number | null;
  userEntry: LeaderboardEntry | null;
  totalCompetitors: number;
}

interface OverallLeaderboardData {
  topEntries: GlobalOverallEntry[];
  userRank: number | null;
  userEntry: GlobalOverallEntry;
  totalWorldCompetitors: number;
}

interface LeaderboardCache {
  games: Record<string, GameLeaderboardData>;
  overall?: OverallLeaderboardData;
  updatedAt: number;
}

interface ServerGameRow {
  id: string;
  name: string;
  country_code: string;
  score: number;
  achieved_at: number;
  rank: number;
  isUser?: boolean;
}

interface ServerOverallRow {
  id: string;
  name: string;
  country_code: string;
  total_score: number;
  games_played: number;
  rating_score: number;
  last_achieved_at: number;
  rank: number;
  isUser?: boolean;
}

const GUEST_KEY = 'micro_arcade_guest_credential_v1';
const CACHE_KEY = 'micro_arcade_live_leaderboards_v1';
const LEGACY_FAKE_KEY = 'micro_arcade_global_leaderboards_v2';
export const LEADERBOARD_UPDATED_EVENT = 'micro-arcade-leaderboards-updated';
let guestCreationPromise: Promise<string | null> | null = null;

function apiBase(): string {
  return (import.meta.env.VITE_LEADERBOARD_API_URL || '').trim().replace(/\/$/, '');
}

export function isLiveLeaderboardConfigured(): boolean {
  return Boolean(apiBase());
}

function countryFlag(code: string): string {
  const normalized = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized) || normalized === 'XX') return '🌐';
  return String.fromCodePoint(...[...normalized].map((char) => 127397 + char.charCodeAt(0)));
}

function relativeTime(timestamp: number): string {
  if (!timestamp) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function avatarSeed(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 100;
}

export function getDivisionForRank(rank: number): LeaderboardDivision {
  if (rank === 1) return 'diamond';
  if (rank <= 3) return 'platinum';
  if (rank <= 6) return 'gold';
  if (rank <= 10) return 'silver';
  return 'bronze';
}

export function getDivisionColor(division: LeaderboardDivision): string {
  switch (division) {
    case 'diamond': return '#38BDF8';
    case 'platinum': return '#A855F7';
    case 'gold': return '#FACC15';
    case 'silver': return '#E2E8F0';
    case 'bronze': return '#FB923C';
  }
}

function loadCache(): LeaderboardCache {
  if (typeof window === 'undefined') return { games: {}, updatedAt: 0 };
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : { games: {}, updatedAt: 0 };
  } catch {
    return { games: {}, updatedAt: 0 };
  }
}

function saveCache(cache: LeaderboardCache): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    window.dispatchEvent(new CustomEvent(LEADERBOARD_UPDATED_EVENT));
  } catch {}
}

function getCredential(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(GUEST_KEY);
}

async function ensureGuestCredential(): Promise<string | null> {
  const existing = getCredential();
  if (existing) return existing;
  const base = apiBase();
  if (!base || typeof window === 'undefined') return null;
  if (!guestCreationPromise) {
    guestCreationPromise = (async () => {
      const response = await fetch(`${base}/v1/guest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error(`Guest creation failed (${response.status})`);
      const data = await response.json() as { credential: string };
      localStorage.setItem(GUEST_KEY, data.credential);
      return data.credential;
    })();
  }
  try {
    return await guestCreationPromise;
  } finally {
    guestCreationPromise = null;
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}, retryAuth = true): Promise<T> {
  const base = apiBase();
  if (!base) throw new Error('Live leaderboard API is not configured');
  const credential = await ensureGuestCredential();
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  if (credential) headers.set('authorization', `Bearer ${credential}`);
  const response = await fetch(`${base}${path}`, { ...init, headers });
  if (response.status === 401 && retryAuth && typeof window !== 'undefined') {
    localStorage.removeItem(GUEST_KEY);
    return apiRequest<T>(path, init, false);
  }
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Leaderboard API ${response.status}${message ? `: ${message}` : ''}`);
  }
  return response.json() as Promise<T>;
}

function normalizeGameRow(row: ServerGameRow): LeaderboardEntry {
  return {
    id: row.id,
    rank: row.rank,
    name: row.isUser ? `${row.name} (YOU)` : row.name,
    score: row.score,
    country: countryFlag(row.country_code),
    countryCode: row.country_code,
    badge: row.isUser ? 'PLAYER' : undefined,
    timestamp: relativeTime(row.achieved_at),
    isUser: Boolean(row.isUser),
    avatarSeed: avatarSeed(row.id),
    division: getDivisionForRank(row.rank),
    trend: 'same',
    level: Math.max(1, Math.min(10, 11 - Math.ceil(row.rank / 2))),
  };
}

function normalizeOverallRow(row: ServerOverallRow): GlobalOverallEntry {
  const level = Math.max(1, Math.min(10, 1 + Math.floor(row.games_played / 3)));
  return {
    id: row.id,
    rank: row.rank,
    name: row.isUser ? `${row.name} (YOU)` : row.name,
    ratingScore: row.rating_score,
    totalScore: row.total_score,
    badgesUnlocked: 0,
    country: countryFlag(row.country_code),
    countryCode: row.country_code,
    badgeTitle: row.games_played >= 20 ? 'Arcade Master' : row.games_played >= 10 ? 'Circuit Veteran' : 'Arcade Challenger',
    division: getDivisionForRank(row.rank),
    level,
    isUser: Boolean(row.isUser),
    timestamp: relativeTime(row.last_achieved_at),
  };
}

export async function refreshGameLeaderboard(gameId: string): Promise<GameLeaderboardData> {
  const data = await apiRequest<{
    entries: ServerGameRow[];
    userEntry: ServerGameRow | null;
    totalCompetitors: number;
  }>(`/v1/leaderboards/${encodeURIComponent(gameId)}?limit=10`);
  const normalized: GameLeaderboardData = {
    topEntries: data.entries.map(normalizeGameRow),
    userRank: data.userEntry?.rank ?? null,
    userEntry: data.userEntry ? normalizeGameRow({ ...data.userEntry, isUser: true }) : null,
    totalCompetitors: data.totalCompetitors,
  };
  const cache = loadCache();
  cache.games[gameId] = normalized;
  cache.updatedAt = Date.now();
  saveCache(cache);
  return normalized;
}

export async function refreshOverallLeaderboard(): Promise<OverallLeaderboardData> {
  const data = await apiRequest<{
    entries: ServerOverallRow[];
    userEntry: ServerOverallRow | null;
    totalCompetitors: number;
  }>('/v1/leaderboards/overall?limit=10');
  const userEntry = data.userEntry ? normalizeOverallRow({ ...data.userEntry, isUser: true }) : {
    id: 'local-user', rank: 0, name: 'YOU', ratingScore: 0, totalScore: 0, badgesUnlocked: 0,
    country: '🌐', countryCode: 'XX', badgeTitle: 'Arcade Challenger', division: 'bronze' as const,
    level: 1, isUser: true, timestamp: 'Not ranked yet',
  };
  const normalized: OverallLeaderboardData = {
    topEntries: data.entries.map(normalizeOverallRow),
    userRank: data.userEntry?.rank ?? null,
    userEntry,
    totalWorldCompetitors: data.totalCompetitors,
  };
  const cache = loadCache();
  cache.overall = normalized;
  cache.updatedAt = Date.now();
  saveCache(cache);
  return normalized;
}

export function getGlobalLeaderboardForGame(gameId: string, userHighScore: number): GameLeaderboardData {
  const cached = loadCache().games[gameId];
  if (cached) return cached;
  const pendingUser: LeaderboardEntry | null = userHighScore > 0 ? {
    id: 'local-user', rank: 0, name: 'YOU (pending sync)', score: userHighScore,
    country: '🌐', countryCode: 'XX', badge: 'PLAYER', timestamp: 'Local score', isUser: true,
    division: 'bronze', trend: 'same', level: 1,
  } : null;
  return { topEntries: [], userRank: null, userEntry: pendingUser, totalCompetitors: 0 };
}

export function getOverallArcadeLeaderboard(stats: UserStats): OverallLeaderboardData {
  const cached = loadCache().overall;
  if (cached) return cached;
  const totalScore = (Object.values(stats.highScores) as number[]).reduce((sum, value) => sum + (value || 0), 0);
  const gamesPlayed = Object.values(stats.playCounts).filter((count) => (count || 0) > 0).length;
  return {
    topEntries: [],
    userRank: null,
    totalWorldCompetitors: 0,
    userEntry: {
      id: 'local-user', rank: 0, name: 'YOU (pending sync)', ratingScore: gamesPlayed * 1000,
      totalScore, badgesUnlocked: 0, country: '🌐', countryCode: 'XX', badgeTitle: 'Arcade Challenger',
      division: 'bronze', level: Math.max(1, Math.min(10, 1 + Math.floor(gamesPlayed / 3))),
      isUser: true, timestamp: 'Local profile',
    },
  };
}

export async function simulateLiveCompetition(gameId: string): Promise<void> {
  if (!isLiveLeaderboardConfigured()) return;
  await Promise.allSettled([refreshGameLeaderboard(gameId), refreshOverallLeaderboard()]);
}

export function resetAllLeaderboards(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(LEGACY_FAKE_KEY);
  window.dispatchEvent(new CustomEvent(LEADERBOARD_UPDATED_EVENT));
}

export async function beginLeaderboardSession(gameId: string): Promise<LeaderboardPlaySession | null> {
  if (!isLiveLeaderboardConfigured()) return null;
  const clientStartedAt = Date.now();
  const data = await apiRequest<{ session: { id: string; gameId: string; expiresAt: number } }>('/v1/sessions', {
    method: 'POST',
    body: JSON.stringify({ gameId }),
  });
  return { id: data.session.id, gameId: data.session.gameId, expiresAt: data.session.expiresAt, clientStartedAt };
}

export async function submitLeaderboardScore(session: LeaderboardPlaySession, score: number): Promise<boolean> {
  if (!isLiveLeaderboardConfigured() || !Number.isFinite(score)) return false;
  try {
    await apiRequest('/v1/scores', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: session.id,
        score: Math.max(0, Math.round(score)),
        durationMs: Math.max(0, Date.now() - session.clientStartedAt),
      }),
    });
    await Promise.allSettled([refreshGameLeaderboard(session.gameId), refreshOverallLeaderboard()]);
    return true;
  } catch (error) {
    console.warn('Live leaderboard score submission failed:', error);
    return false;
  }
}

export async function updateGuestDisplayName(name: string): Promise<void> {
  await apiRequest('/v1/me', { method: 'PATCH', body: JSON.stringify({ name }) });
  const cache = loadCache();
  cache.games = {};
  delete cache.overall;
  saveCache(cache);
}
