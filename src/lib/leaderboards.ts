import { UserStats } from '../types';
import { LeaderboardError, requestLeaderboardJson } from './leaderboardRequest';

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

export interface GameLeaderboardData {
  topEntries: LeaderboardEntry[];
  userRank: number | null;
  userEntry: LeaderboardEntry | null;
  totalCompetitors: number;
}

export interface OverallLeaderboardData {
  topEntries: GlobalOverallEntry[];
  userRank: number | null;
  userEntry: GlobalOverallEntry;
  totalWorldCompetitors: number;
  weekStart?: number;
  weekEnd?: number;
}

export interface GuestProfileData {
  id: string;
  name: string;
  countryCode: string;
  createdAt: number;
  submissions: number;
  rankedGames: number;
}

interface LeaderboardCache {
  games: Record<string, GameLeaderboardData>;
  overall?: OverallLeaderboardData;
  weeklyOverall?: OverallLeaderboardData;
  profile?: GuestProfileData;
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
let memoryCredential: string | null = null;
const rejectedCredentials = new Set<string>();
let memoryCache: LeaderboardCache = { games: {}, updatedAt: 0 };
let cacheWritePending = false;

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
    const raw = cacheWritePending ? null : localStorage.getItem(CACHE_KEY);
    const data = raw ? JSON.parse(raw) : memoryCache;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { games: {}, updatedAt: 0 };
    const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
    const positive = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
    const validEntry = (entry: unknown) => record(entry) && typeof entry.id === 'string' && typeof entry.name === 'string' &&
      positive(entry.rank) && typeof entry.country === 'string' && typeof entry.countryCode === 'string' && typeof entry.timestamp === 'string' &&
      typeof entry.division === 'string' && ['diamond', 'platinum', 'gold', 'silver', 'bronze'].includes(entry.division) &&
      (positive(entry.score) || (positive(entry.ratingScore) && positive(entry.totalScore) && positive(entry.badgesUnlocked) && positive(entry.level) && typeof entry.badgeTitle === 'string'));
    const validBoard = (board: unknown) => record(board) && Array.isArray(board.topEntries) && board.topEntries.every(validEntry) &&
      (board.userRank === null || positive(board.userRank)) && (board.userEntry === null || validEntry(board.userEntry)) &&
      positive(board.totalCompetitors ?? board.totalWorldCompetitors);
    const games = Object.fromEntries(Object.entries(data.games ?? {}).filter(([id, board]) => /^[a-z0-9-]+$/.test(id) && validBoard(board)));
    return {
      games: games as Record<string, GameLeaderboardData>,
      overall: validBoard(data.overall) && data.overall.userEntry ? data.overall : undefined,
      weeklyOverall: validBoard(data.weeklyOverall) && data.weeklyOverall.userEntry && data.weeklyOverall.weekEnd > Date.now() ? data.weeklyOverall : undefined,
      profile: data.profile && typeof data.profile.name === 'string' && typeof data.profile.id === 'string' && typeof data.profile.countryCode === 'string' && positive(data.profile.createdAt) && positive(data.profile.submissions) && positive(data.profile.rankedGames) ? data.profile : undefined,
      updatedAt: Number.isFinite(data.updatedAt) ? data.updatedAt : 0,
    };
  } catch {
    return memoryCache;
  }
}

function saveCache(cache: LeaderboardCache): void {
  if (typeof window === 'undefined') return;
  memoryCache = cache;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    cacheWritePending = false;
  } catch { cacheWritePending = true; }
  window.dispatchEvent(new CustomEvent(LEADERBOARD_UPDATED_EVENT));
}

function getCredential(): string | null {
  if (typeof window === 'undefined') return null;
  if (memoryCredential) return memoryCredential;
  try {
    const saved = localStorage.getItem(GUEST_KEY);
    return saved && !rejectedCredentials.has(saved) ? saved : null;
  } catch { return null; }
}

async function ensureGuestCredential(): Promise<string | null> {
  const existing = getCredential();
  if (existing) return existing;
  const base = apiBase();
  if (!base || typeof window === 'undefined') return null;
  if (!guestCreationPromise) {
    guestCreationPromise = (async () => {
      const data = await requestLeaderboardJson<{ credential: string }>(`${base}/v1/guest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (typeof data.credential !== 'string' || !/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{20,}$/i.test(data.credential)) throw new LeaderboardError('unavailable', 'Invalid guest response');
      memoryCredential = data.credential;
      try { localStorage.setItem(GUEST_KEY, data.credential); } catch {}
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
  try {
    return await requestLeaderboardJson<T>(`${base}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof LeaderboardError && error.status === 401 && retryAuth && typeof window !== 'undefined') {
      if (credential) rejectedCredentials.add(credential);
      memoryCredential = null;
      try { localStorage.removeItem(GUEST_KEY); } catch {}
      saveCache({ games: {}, updatedAt: 0 });
      return apiRequest<T>(path, init, false);
    }
    throw error;
  }
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

function emptyOverall(stats?: UserStats, weekly = false): OverallLeaderboardData {
  const totalScore = weekly || !stats
    ? 0
    : (Object.values(stats.highScores) as number[]).reduce((sum, value) => sum + (value || 0), 0);
  const gamesPlayed = weekly || !stats
    ? 0
    : Object.values(stats.playCounts).filter((count) => (count || 0) > 0).length;
  return {
    topEntries: [],
    userRank: null,
    totalWorldCompetitors: 0,
    userEntry: {
      id: 'local-user',
      rank: 0,
      name: weekly ? 'YOU (not ranked this week)' : 'YOU (local only)',
      ratingScore: gamesPlayed * 1000,
      totalScore,
      badgesUnlocked: 0,
      country: '🌐',
      countryCode: 'XX',
      badgeTitle: 'Arcade Challenger',
      division: 'bronze',
      level: Math.max(1, Math.min(10, 1 + Math.floor(gamesPlayed / 3))),
      isUser: true,
      timestamp: weekly ? 'No weekly score yet' : 'Local profile',
    },
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
  }>('/v1/leaderboards/overall?limit=20');
  const fallback = emptyOverall();
  const normalized: OverallLeaderboardData = {
    topEntries: data.entries.map(normalizeOverallRow),
    userRank: data.userEntry?.rank ?? null,
    userEntry: data.userEntry ? normalizeOverallRow({ ...data.userEntry, isUser: true }) : fallback.userEntry,
    totalWorldCompetitors: data.totalCompetitors,
  };
  const cache = loadCache();
  cache.overall = normalized;
  cache.updatedAt = Date.now();
  saveCache(cache);
  return normalized;
}

export async function refreshWeeklyOverallLeaderboard(): Promise<OverallLeaderboardData> {
  const data = await apiRequest<{
    entries: ServerOverallRow[];
    userEntry: ServerOverallRow | null;
    totalCompetitors: number;
    weekStart: number;
    weekEnd: number;
  }>('/v1/leaderboards/weekly?limit=20');
  const fallback = emptyOverall(undefined, true);
  const normalized: OverallLeaderboardData = {
    topEntries: data.entries.map(normalizeOverallRow),
    userRank: data.userEntry?.rank ?? null,
    userEntry: data.userEntry ? normalizeOverallRow({ ...data.userEntry, isUser: true }) : fallback.userEntry,
    totalWorldCompetitors: data.totalCompetitors,
    weekStart: data.weekStart,
    weekEnd: data.weekEnd,
  };
  const cache = loadCache();
  cache.weeklyOverall = normalized;
  cache.updatedAt = Date.now();
  saveCache(cache);
  return normalized;
}

export async function getGuestProfile(): Promise<GuestProfileData> {
  const data = await apiRequest<{
    player: { id: string; name: string; countryCode: string; createdAt: number };
    activity: { submissions: number; rankedGames: number };
  }>('/v1/me');
  const profile: GuestProfileData = {
    id: data.player.id,
    name: data.player.name,
    countryCode: data.player.countryCode,
    createdAt: data.player.createdAt,
    submissions: data.activity.submissions,
    rankedGames: data.activity.rankedGames,
  };
  const cache = loadCache();
  cache.profile = profile;
  cache.updatedAt = Date.now();
  saveCache(cache);
  return profile;
}

export function getCachedGuestProfile(): GuestProfileData | null {
  return loadCache().profile ?? null;
}

export function getGlobalLeaderboardForGame(gameId: string, userHighScore: number): GameLeaderboardData {
  const cached = loadCache().games[gameId];
  if (cached) return cached;
  const pendingUser: LeaderboardEntry | null = userHighScore > 0 ? {
    id: 'local-user', rank: 0, name: 'YOU (local only)', score: userHighScore,
    country: '🌐', countryCode: 'XX', badge: 'PLAYER', timestamp: 'Local score', isUser: true,
    division: 'bronze', trend: 'same', level: 1,
  } : null;
  return { topEntries: [], userRank: null, userEntry: pendingUser, totalCompetitors: 0 };
}

export function getOverallArcadeLeaderboard(stats: UserStats): OverallLeaderboardData {
  return loadCache().overall ?? emptyOverall(stats);
}

export function getWeeklyOverallLeaderboard(stats?: UserStats): OverallLeaderboardData {
  return loadCache().weeklyOverall ?? emptyOverall(stats, true);
}

export async function simulateLiveCompetition(gameId: string): Promise<void> {
  if (!isLiveLeaderboardConfigured()) return;
  await Promise.allSettled([
    refreshGameLeaderboard(gameId),
    refreshOverallLeaderboard(),
    refreshWeeklyOverallLeaderboard(),
  ]);
}

export function resetAllLeaderboards(): void {
  if (typeof window === 'undefined') return;
  memoryCache = { games: {}, updatedAt: 0 };
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(LEGACY_FAKE_KEY);
    cacheWritePending = false;
  } catch { cacheWritePending = true; }
  window.dispatchEvent(new CustomEvent(LEADERBOARD_UPDATED_EVENT));
}

export async function beginLeaderboardSession(gameId: string): Promise<LeaderboardPlaySession | null> {
  if (!isLiveLeaderboardConfigured() || navigator.onLine === false) return null;
  const clientStartedAt = performance.now();
  const data = await apiRequest<{ session: { id: string; gameId: string; expiresAt: number } }>('/v1/sessions', {
    method: 'POST',
    body: JSON.stringify({ gameId }),
  });
  return { id: data.session.id, gameId: data.session.gameId, expiresAt: data.session.expiresAt, clientStartedAt };
}

export async function submitLeaderboardScore(session: LeaderboardPlaySession, score: number): Promise<boolean> {
  if (!isLiveLeaderboardConfigured() || !Number.isFinite(score)) return false;
  try {
    const result = await apiRequest<{ accepted: boolean }>('/v1/scores', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: session.id,
        score: Math.max(0, Math.round(score)),
        durationMs: Math.max(0, performance.now() - session.clientStartedAt),
      }),
    });
    if (result.accepted !== true) return false;
    void Promise.allSettled([
      refreshGameLeaderboard(session.gameId),
      refreshOverallLeaderboard(),
      refreshWeeklyOverallLeaderboard(),
      getGuestProfile(),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function updateGuestDisplayName(name: string): Promise<void> {
  await apiRequest('/v1/me', { method: 'PATCH', body: JSON.stringify({ name }) });
  const cache = loadCache();
  cache.games = {};
  delete cache.overall;
  delete cache.weeklyOverall;
  delete cache.profile;
  saveCache(cache);
}
