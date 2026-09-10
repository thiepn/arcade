import { currentGameBests } from './localCompetition';
import { AP_SCALE, apMicros, getPolicy } from '../../shared/leaderboard/domain';
import { SCORE_VERSION, toArcadePoints, isScoreMode } from '../../shared/scoring';
import { UserStats, AppTheme, ScoreDetails } from '../types';

const STORAGE_KEY = 'micro_arcade_stats_v3';
const SESSION_STORAGE_KEY = 'micro_arcade_stats_v3_session_fallback';
const PREVIOUS_STORAGE_KEY = 'micro_arcade_stats_v2';
const LEGACY_STORAGE_KEY = 'micro_arcade_stats_v1';
const STORAGE_WARNING_FAILURE_THRESHOLD = 2;

export type StoragePersistenceMode = 'persistent' | 'session' | 'memory';
export type StorageFailureKind = 'quota' | 'denied' | 'unknown' | null;
export interface ArcadeStorageStatus {
  mode: StoragePersistenceMode;
  consecutivePersistentFailures: number;
  lastFailure: StorageFailureKind;
  warning: boolean;
}

const defaultStats: UserStats = {
  recordSchemaVersion: 3,
  modeBests: {},
  scoreVersion: SCORE_VERSION,
  legacyHighScores: {},
  bestScoreDetails: {},
  rawHighScores: {},
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

const freshStats = (): UserStats => ({ ...defaultStats, modeBests: {}, legacyHighScores: {}, bestScoreDetails: {}, rawHighScores: {}, highScores: {}, playCounts: {}, totalPlayTimeSeconds: {}, favorites: [], recentlyPlayed: [] });
let memoryStats = freshStats();
let storageState: ArcadeStorageStatus = {
  mode: 'persistent',
  consecutivePersistentFailures: 0,
  lastFailure: null,
  warning: false,
};
export const STORAGE_STATUS_EVENT = 'micro-arcade-storage-status';

export function getStorageStatus(): ArcadeStorageStatus { return { ...storageState }; }
export function isProgressSaved(): boolean { return storageState.mode !== 'memory'; }

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
  const nativeScores = numberMap(parsed.highScores);
  const migrating = parsed.scoreVersion === undefined || parsed.scoreVersion === 1;
  const highScores = migrating
    ? Object.fromEntries(Object.entries(nativeScores).map(([id,raw]) => [id,toArcadePoints(id,raw,undefined,1)] as [string,number]).filter(([,score]) => score > 0))
    : nativeScores;
  const bestScoreDetails = Object.fromEntries(Object.entries(isRecord(parsed.bestScoreDetails) ? parsed.bestScoreDetails : {}).filter(([id,v]) =>
    validId(id) && isRecord(v) && typeof v.rawScore === 'number' && Number.isSafeInteger(v.rawScore) && v.rawScore >= 0 &&
    typeof v.modeId === 'string' && isScoreMode(id,v.modeId) && v.scoreVersion === SCORE_VERSION));
  const storedRawHighScores = numberMap(parsed.rawHighScores);
  const detailRawHighScores = Object.fromEntries(Object.entries(bestScoreDetails).map(([id,v]) => [id,(v as ScoreDetails).rawScore]));
  const rawHighScores: Record<string,number> = {};
  for (const map of [numberMap(parsed.legacyHighScores), detailRawHighScores, storedRawHighScores, migrating ? nativeScores : {}]) {
    for (const [id,value] of Object.entries(map)) rawHighScores[id]=Math.max(rawHighScores[id]||0,value);
  }
  const modeBests: NonNullable<UserStats['modeBests']> = {};
  const addBest = (id:string, value:unknown) => {
    if(!isRecord(value)||!Number.isSafeInteger(value.rawScore)||(value.rawScore as number)<0||value.scoreVersion!==2||typeof value.modeId!=='string'||!getPolicy(id,value.modeId))return;
    const rawScore=value.rawScore as number, modeId=value.modeId, key=id+':'+modeId;
    const next={rawScore,modeId,scoreVersion:2,apMicros:apMicros(id,rawScore,modeId),achievedAt:typeof value.achievedAt==='number'&&Number.isSafeInteger(value.achievedAt)?value.achievedAt:0};
    if(!modeBests[key]||next.rawScore>modeBests[key].rawScore)modeBests[key]=next;
  };
  for(const [id,value] of Object.entries(bestScoreDetails))addBest(id,value);
  for(const [key,value] of Object.entries(isRecord(parsed.modeBests)?parsed.modeBests:{}))addBest(key.split(':')[0],value);
  return {
    recordSchemaVersion: 3,
    modeBests,
    scoreVersion: SCORE_VERSION,
    legacyHighScores: migrating ? { ...numberMap(parsed.legacyHighScores), ...nativeScores } : numberMap(parsed.legacyHighScores),
    bestScoreDetails: bestScoreDetails as Record<string,ScoreDetails>,
    rawHighScores,
    highScores,
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

function getWebStorage(kind: 'local' | 'session'): Storage | null {
  try {
    const candidate = kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
    return candidate ?? null;
  } catch {
    return null;
  }
}

function classifyStorageFailure(error: unknown): Exclude<StorageFailureKind, null> {
  const name = error instanceof DOMException ? error.name : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (name === 'QuotaExceededError' || /quota|exceed|full/i.test(message)) return 'quota';
  if (name === 'SecurityError' || /denied|blocked|security|permission/i.test(message)) return 'denied';
  return 'unknown';
}

function dispatchStorageStatus(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STORAGE_STATUS_EVENT));
}

function setStorageState(mode: StoragePersistenceMode, failure: StorageFailureKind = null, incrementFailure = false): void {
  const failures = mode === 'persistent'
    ? 0
    : incrementFailure
      ? storageState.consecutivePersistentFailures + 1
      : storageState.consecutivePersistentFailures;
  const next: ArcadeStorageStatus = {
    mode,
    consecutivePersistentFailures: failures,
    lastFailure: mode === 'persistent' ? null : (failure ?? storageState.lastFailure),
    warning: mode === 'memory' && failures >= STORAGE_WARNING_FAILURE_THRESHOLD,
  };
  const changed = next.mode !== storageState.mode ||
    next.consecutivePersistentFailures !== storageState.consecutivePersistentFailures ||
    next.lastFailure !== storageState.lastFailure ||
    next.warning !== storageState.warning;
  storageState = next;
  if (changed) dispatchStorageStatus();
}

function safeGet(storage: Storage | null, key: string): { ok: true; value: string | null } | { ok: false; error: unknown } {
  if (!storage) return { ok: false, error: new Error('Storage unavailable') };
  try { return { ok: true, value: storage.getItem(key) }; }
  catch (error) { return { ok: false, error }; }
}

function safeSet(storage: Storage | null, key: string, value: string): { ok: true } | { ok: false; error: unknown } {
  if (!storage) return { ok: false, error: new Error('Storage unavailable') };
  try { storage.setItem(key, value); return { ok: true }; }
  catch (error) { return { ok: false, error }; }
}

function safeRemove(storage: Storage | null, key: string): void {
  try { storage?.removeItem(key); } catch {}
}

function mergeStoredRecords(target: UserStats, previous: UserStats): UserStats {
  const merged = normalizeStats(target);
  for(const [id,n] of Object.entries(previous.highScores))if(n>(merged.highScores[id]??0)){
    merged.highScores[id]=n;
    if(previous.bestScoreDetails?.[id])merged.bestScoreDetails![id]=previous.bestScoreDetails[id];
    else delete merged.bestScoreDetails![id];
  }
  for(const [key,best] of Object.entries(previous.modeBests??{}))if(!merged.modeBests![key]||best.rawScore>merged.modeBests![key].rawScore)merged.modeBests![key]=best;
  for(const key of ['highScores','rawHighScores','legacyHighScores'] as const){
    const map=merged[key]??{};
    for(const [id,n] of Object.entries(previous[key]??{}))map[id]=Math.max(map[id]??0,n);
    merged[key]=map;
  }
  return normalizeStats(merged);
}

function persistSnapshot(snapshot: UserStats): boolean {
  memoryStats = normalizeStats(snapshot);
  const serialized = JSON.stringify(memoryStats);
  const local = getWebStorage('local');

  let persistentResult = safeSet(local, STORAGE_KEY, serialized);
  if (!persistentResult.ok) {
    // Old schema copies are safe to discard after normalization and can recover
    // quota-constrained origins without touching unrelated site data.
    safeRemove(local, PREVIOUS_STORAGE_KEY);
    safeRemove(local, LEGACY_STORAGE_KEY);
    persistentResult = safeSet(local, STORAGE_KEY, serialized);
  }

  if (persistentResult.ok) {
    safeRemove(getWebStorage('session'), SESSION_STORAGE_KEY);
    setStorageState('persistent');
    return true;
  }

  const failure = classifyStorageFailure(persistentResult.error);
  const session = getWebStorage('session');
  const sessionResult = safeSet(session, SESSION_STORAGE_KEY, serialized);
  if (sessionResult.ok) {
    setStorageState('session', failure, true);
    return true;
  }

  setStorageState('memory', failure, true);
  return false;
}

export function retryStoragePersistence(): boolean {
  if (typeof window === 'undefined') return false;
  if (storageState.mode === 'persistent') return true;
  return persistSnapshot(memoryStats);
}

export function getStoredStats(): UserStats {
  if (typeof window === 'undefined') return freshStats();
  const local = getWebStorage('local');
  const session = getWebStorage('session');
  const current = safeGet(local, STORAGE_KEY);
  const sessionFallback = safeGet(session, SESSION_STORAGE_KEY);

  if (!current.ok) {
    const failure = classifyStorageFailure(current.error);
    if (sessionFallback.ok && sessionFallback.value) {
      try { memoryStats = normalizeStats(JSON.parse(sessionFallback.value)); } catch {}
      setStorageState('session', failure, true);
      return normalizeStats(memoryStats);
    }
    setStorageState('memory', failure, true);
    return normalizeStats(memoryStats);
  }

  // A temporary fallback from this tab is newer than the persistent snapshot.
  // Merge any durable record maxima, then immediately attempt to heal localStorage.
  if (sessionFallback.ok && sessionFallback.value) {
    try {
      memoryStats = normalizeStats(JSON.parse(sessionFallback.value));
      if (current.value) memoryStats = mergeStoredRecords(memoryStats, normalizeStats(JSON.parse(current.value)));
      persistSnapshot(memoryStats);
      return normalizeStats(memoryStats);
    } catch {
      safeRemove(session, SESSION_STORAGE_KEY);
    }
  }

  const previous = safeGet(local, PREVIOUS_STORAGE_KEY);
  const legacy = safeGet(local, LEGACY_STORAGE_KEY);
  const raw = current.value ?? (previous.ok ? previous.value : null) ?? (legacy.ok ? legacy.value : null);
  try { memoryStats = raw ? normalizeStats(JSON.parse(raw)) : freshStats(); }
  catch { memoryStats = freshStats(); }

  // Migrate old schemas through the same self-healing write path.
  if (current.value === null && raw !== null) persistSnapshot(memoryStats);
  return normalizeStats(memoryStats);
}

export function saveStats(stats: UserStats, replaceRecords=false): void {
  if (typeof window === 'undefined') return;
  memoryStats = normalizeStats(stats);
  if(!replaceRecords){
    const saved = safeGet(getWebStorage('local'), STORAGE_KEY);
    if(saved.ok && saved.value){
      try { memoryStats = mergeStoredRecords(memoryStats, normalizeStats(JSON.parse(saved.value))); }
      catch {}
    }
  }
  persistSnapshot(memoryStats);
}

export function recordGamePlay(gameId: string): UserStats {
  const current = getStoredStats();
  const playCounts = { ...current.playCounts, [gameId]: (current.playCounts[gameId] || 0) + 1 };
  const filteredRecent = current.recentlyPlayed.filter(id => id !== gameId);
  const recentlyPlayed = [gameId, ...filteredRecent].slice(0, 5);
  const updated: UserStats = { ...current, playCounts, recentlyPlayed };
  saveStats(updated);
  return getStoredStats();
}

export function recordScore(gameId: string, score: number, details?: ScoreDetails): { isNewHighScore: boolean; stats: UserStats } {
  const current = getStoredStats();
  if (!validId(gameId) || !Number.isFinite(score) || score < 0 || score > Number.MAX_SAFE_INTEGER) {
    return { isNewHighScore: false, stats: current };
  }
  if(details){
    if(details.scoreVersion!==2||!getPolicy(gameId,details.modeId)||!Number.isSafeInteger(details.rawScore)||details.rawScore<0)return {isNewHighScore:false,stats:current};
    score=Math.floor(apMicros(gameId,details.rawScore,details.modeId)/AP_SCALE);
  }
  const prevBest = current.highScores[gameId] || 0;
  const isNewHighScore = details ? apMicros(gameId,details.rawScore,details.modeId) > (currentGameBests(current)[gameId]?.apMicros??0) : score > prevBest;
  const highScores = { ...current.highScores, [gameId]: Math.max(prevBest, score) };
  const bestScoreDetails = { ...current.bestScoreDetails };
  if (score > prevBest) {
    if (details) bestScoreDetails[gameId] = details;
    else delete bestScoreDetails[gameId];
  }
  const rawHighScores = { ...current.rawHighScores };
  if (details && Number.isSafeInteger(details.rawScore) && details.rawScore >= 0) {
    rawHighScores[gameId] = Math.max(rawHighScores[gameId] || 0, details.rawScore);
  }
  const modeBests={...current.modeBests};
  if(details){const key=gameId+':'+details.modeId;const old=modeBests[key];
    if(!old||details.rawScore>old.rawScore)modeBests[key]={...details,apMicros:apMicros(gameId,details.rawScore,details.modeId),achievedAt:Date.now()};
  }
  const updated: UserStats = { ...current, highScores, rawHighScores, bestScoreDetails,modeBests };
  saveStats(updated);
  return { isNewHighScore, stats: getStoredStats() };
}

export function toggleFavoriteGame(gameId: string): UserStats {
  const current = getStoredStats();
  const isFav = current.favorites.includes(gameId);
  const favorites = isFav ? current.favorites.filter(id => id !== gameId) : [...current.favorites, gameId];
  const updated: UserStats = { ...current, favorites };
  saveStats(updated);
  return getStoredStats();
}

export function updateSoundPreference(soundEnabled: boolean, volume?: number): UserStats {
  const current = getStoredStats();
  const updated: UserStats = { ...current, soundEnabled, volume: volume !== undefined ? volume : current.volume };
  saveStats(updated);
  return getStoredStats();
}

export function updateHapticsPreference(hapticsEnabled: boolean): UserStats {
  const current = getStoredStats();
  const updated: UserStats = { ...current, hapticsEnabled };
  saveStats(updated);
  return getStoredStats();
}

export function updateThemePreference(theme: AppTheme): UserStats {
  const current = getStoredStats();
  const updated: UserStats = { ...current, theme };
  saveStats(updated);
  return getStoredStats();
}

export function clearAllStats(): UserStats {
  if (typeof window !== 'undefined') {
    const local = getWebStorage('local');
    const session = getWebStorage('session');
    safeRemove(local, LEGACY_STORAGE_KEY);
    safeRemove(local, PREVIOUS_STORAGE_KEY);
    safeRemove(session, SESSION_STORAGE_KEY);
  }
  const fresh = freshStats();
  saveStats(fresh,true);
  return fresh;
}
