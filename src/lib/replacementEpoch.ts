import { AP_SCALE, apMicros } from '../../shared/leaderboard/domain';

/** Production Pages deployment that first exposed Vector Golf / Hex Capture. */
export const REPLACEMENT_CUTOVER_MS = 1789128215000;

const STORAGE_KEYS = [
  'micro_arcade_stats_v3',
  'micro_arcade_stats_v3_session_fallback',
  'micro_arcade_stats_v2',
  'micro_arcade_stats_v1',
] as const;

const REPLACEMENT_SLOTS = ['gravity', 'astroblaster'] as const;

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;

const mapRecord = (root: JsonRecord, key: string): JsonRecord => {
  const existing = asRecord(root[key]);
  if (existing) return existing;
  const created: JsonRecord = {};
  root[key] = created;
  return created;
};

const deleteScoreSlot = (root: JsonRecord, id: string) => {
  for (const key of ['highScores', 'rawHighScores', 'legacyHighScores', 'bestScoreDetails']) {
    const map = asRecord(root[key]);
    if (map) delete map[id];
  }
  const modeBests = asRecord(root.modeBests);
  if (modeBests) {
    for (const key of Object.keys(modeBests)) if (key === id || key.startsWith(`${id}:`)) delete modeBests[key];
  }
};

const preservePostCutoverBest = (root: JsonRecord, id: string, best: JsonRecord | null) => {
  if (!best) return;
  const rawScore = best.rawScore;
  const modeId = best.modeId;
  const scoreVersion = best.scoreVersion;
  const achievedAt = best.achievedAt;
  if (
    typeof rawScore !== 'number' || !Number.isSafeInteger(rawScore) || rawScore < 0 ||
    typeof modeId !== 'string' || scoreVersion !== 2 ||
    typeof achievedAt !== 'number' || !Number.isSafeInteger(achievedAt) || achievedAt < REPLACEMENT_CUTOVER_MS
  ) return;

  const micros = apMicros(id, rawScore, modeId);
  if (!Number.isSafeInteger(micros) || micros < 0) return;

  mapRecord(root, 'modeBests')[`${id}:${modeId}`] = {
    rawScore,
    modeId,
    scoreVersion: 2,
    apMicros: micros,
    achievedAt,
  };
  mapRecord(root, 'bestScoreDetails')[id] = { rawScore, modeId, scoreVersion: 2 };
  mapRecord(root, 'rawHighScores')[id] = rawScore;
  mapRecord(root, 'highScores')[id] = Math.floor(micros / AP_SCALE);
};

export const sanitizeReplacementStatsValue = (value: unknown): { value: unknown; changed: boolean } => {
  const root = asRecord(value);
  if (!root) return { value, changed: false };

  const before = JSON.stringify(root);
  for (const id of REPLACEMENT_SLOTS) {
    const modeBests = asRecord(root.modeBests);
    const candidate = asRecord(modeBests?.[`${id}:standard`]);
    deleteScoreSlot(root, id);
    preservePostCutoverBest(root, id, candidate);
  }
  return { value: root, changed: JSON.stringify(root) !== before };
};

const sanitizeStorage = (storage: Storage | undefined) => {
  if (!storage) return;
  for (const key of STORAGE_KEYS) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const result = sanitizeReplacementStatsValue(parsed);
      if (result.changed) storage.setItem(key, JSON.stringify(result.value));
    } catch {
      // Storage recovery owns availability warnings. This migration is best-effort
      // and will run again on the next startup if the store is temporarily blocked.
    }
  }
};

/**
 * Retired Gravity/Astro native scores must never become Vector Golf/Hex Capture
 * PBs. Run before React reads stats. Post-cutover replacement bests carry a real
 * achievedAt timestamp and are reconstructed exactly, so this is safe to repeat.
 */
export function sanitizeReplacementLocalScores(): void {
  if (typeof window === 'undefined') return;
  sanitizeStorage(window.localStorage);
  sanitizeStorage(window.sessionStorage);
}
