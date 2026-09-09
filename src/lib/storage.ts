import { currentGameBests } from './localCompetition';
import { AP_SCALE, apMicros, getPolicy } from '../../shared/leaderboard/domain';
import { SCORE_VERSION, toArcadePoints, isScoreMode } from '../../shared/scoring';
import { UserStats, AppTheme, ScoreDetails } from '../types';

const STORAGE_KEY = 'micro_arcade_stats_v3';
const PREVIOUS_STORAGE_KEY = 'micro_arcade_stats_v2';
const LEGACY_STORAGE_KEY = 'micro_arcade_stats_v1';

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
  // Max-merge raw evidence, including v1 records already migrated by an older v2 client.
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

export function getStoredStats(): UserStats {
  if (typeof window === 'undefined') return freshStats();
  // A denied/quota-limited write must not erase this session's progress on the next action.
  if (pendingWrite) return normalizeStats(memoryStats);
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const raw = current ?? localStorage.getItem(PREVIOUS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    memoryStats = raw ? normalizeStats(JSON.parse(raw)) : freshStats();
    // A separate key keeps cached v1 clients from overwriting the new point units.
    if (current === null && raw !== null) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStats)); }
      catch { pendingWrite = true; }
    }
    return normalizeStats(memoryStats);
  } catch {
    return normalizeStats(memoryStats);
  }
}

export function saveStats(stats: UserStats, replaceRecords=false): void {
  if (typeof window === 'undefined') return;
  memoryStats = normalizeStats(stats);
  if(!replaceRecords){
    try{
      const saved=localStorage.getItem(STORAGE_KEY);
      if(saved){const previous=normalizeStats(JSON.parse(saved));
        for(const [id,n] of Object.entries(previous.highScores))if(n>(memoryStats.highScores[id]??0)){if(previous.bestScoreDetails?.[id])memoryStats.bestScoreDetails![id]=previous.bestScoreDetails[id];else delete memoryStats.bestScoreDetails![id];}
        for(const [key,best] of Object.entries(previous.modeBests??{}))if(!memoryStats.modeBests![key]||best.rawScore>memoryStats.modeBests![key].rawScore)memoryStats.modeBests![key]=best;
        for(const key of ['highScores','rawHighScores','legacyHighScores'] as const){
          const target=memoryStats[key]??{};for(const [id,n] of Object.entries(previous[key]??{}))target[id]=Math.max(target[id]??0,n);memoryStats[key]=target;
        }
      }
    }catch{}
  }
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
  return getStoredStats();
}

export function recordScore(gameId: string, score: number, details?: ScoreDetails): { isNewHighScore: boolean; stats: UserStats } {
  const current = getStoredStats();
  if (!validId(gameId) || !Number.isFinite(score) || score < 0 || score > Number.MAX_SAFE_INTEGER) {
    return { isNewHighScore: false, stats: current };
  }
  // Only the native result determines AP. Callers cannot choose an inconsistent AP value.
  if(details){
    if(details.scoreVersion!==2||!getPolicy(gameId,details.modeId)||!Number.isSafeInteger(details.rawScore)||details.rawScore<0)return {isNewHighScore:false,stats:current};
    score=Math.floor(apMicros(gameId,details.rawScore,details.modeId)/AP_SCALE);
  }
  const prevBest = current.highScores[gameId] || 0;
  const isNewHighScore = details ? apMicros(gameId,details.rawScore,details.modeId) > (currentGameBests(current)[gameId]?.apMicros??0) : score > prevBest;
  
  const highScores = {
    ...current.highScores,
    [gameId]: Math.max(prevBest, score),
  };

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
  const favorites = isFav
    ? current.favorites.filter(id => id !== gameId)
    : [...current.favorites, gameId];

  const updated: UserStats = {
    ...current,
    favorites,
  };
  saveStats(updated);
  return getStoredStats();
}

export function updateSoundPreference(soundEnabled: boolean, volume?: number): UserStats {
  const current = getStoredStats();
  const updated: UserStats = {
    ...current,
    soundEnabled,
    volume: volume !== undefined ? volume : current.volume,
  };
  saveStats(updated);
  return getStoredStats();
}

export function updateHapticsPreference(hapticsEnabled: boolean): UserStats {
  const current = getStoredStats();
  const updated: UserStats = {
    ...current,
    hapticsEnabled,
  };
  saveStats(updated);
  return getStoredStats();
}

export function updateThemePreference(theme: AppTheme): UserStats {
  const current = getStoredStats();
  const updated: UserStats = {
    ...current,
    theme,
  };
  saveStats(updated);
  return getStoredStats();
}

export function clearAllStats(): UserStats {
  try { if (typeof window !== 'undefined') { localStorage.removeItem(LEGACY_STORAGE_KEY); localStorage.removeItem(PREVIOUS_STORAGE_KEY); } } catch {}
  const fresh = freshStats();
  saveStats(fresh,true);
  return fresh;
}
