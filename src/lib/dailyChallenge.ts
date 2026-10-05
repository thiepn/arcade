import { SCORING_PROFILES } from '../../shared/scoring';
import type { DailyChallengeProgress, DailyChallengeRecord, UserStats } from '../types';

const DAY_MS = 86_400_000;
const HISTORY_LIMIT = 400;
const TARGETS = [2000, 2500, 3000] as const;
const GAME_IDS = Object.keys(SCORING_PROFILES).sort();

export interface DailyChallengeDefinition {
  dateKey: string;
  gameId: string;
  targetAP: number;
}

export interface DailyChallengeSummary {
  definition: DailyChallengeDefinition;
  bestAP: number;
  completed: boolean;
  completedAt: number | null;
  progressPercent: number;
  currentStreak: number;
  bestStreak: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const mod = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

const ROTATION_STEP = (() => {
  if (GAME_IDS.length <= 1) return 1;
  for (const candidate of [13, 11, 9, 7, 5, 3, 1]) {
    if (gcd(candidate, GAME_IDS.length) === 1) return candidate;
  }
  return 1;
})();

function daySerial(dayKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  const timestamp = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10) === dayKey
    ? Math.floor(timestamp / DAY_MS)
    : null;
}

export function getUtcDayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function shiftUtcDayKey(dayKey: string, offsetDays: number): string {
  const serial = daySerial(dayKey);
  if (serial === null) return getUtcDayKey();
  return new Date((serial + offsetDays) * DAY_MS).toISOString().slice(0, 10);
}

export function getDailyChallengeDefinition(dayKey = getUtcDayKey()): DailyChallengeDefinition {
  const serial = daySerial(dayKey);
  const safeSerial = serial ?? Math.floor(Date.now() / DAY_MS);
  const safeKey = serial === null ? getUtcDayKey() : dayKey;
  const gameIndex = GAME_IDS.length
    ? mod(safeSerial * ROTATION_STEP + 7, GAME_IDS.length)
    : 0;
  const targetIndex = mod(safeSerial * 5 + 1, TARGETS.length);
  return {
    dateKey: safeKey,
    gameId: GAME_IDS[gameIndex] ?? 'orbit',
    targetAP: TARGETS[targetIndex],
  };
}

export function normalizeDailyChallengeProgress(value: unknown): DailyChallengeProgress {
  const source = isRecord(value) && isRecord(value.days) ? value.days : {};
  const validEntries: Array<[string, DailyChallengeRecord]> = [];

  for (const [dateKey, raw] of Object.entries(source)) {
    if (daySerial(dateKey) === null || !isRecord(raw)) continue;
    if (typeof raw.gameId !== 'string' || !Object.hasOwn(SCORING_PROFILES, raw.gameId)) continue;
    if (!Number.isSafeInteger(raw.targetAP) || (raw.targetAP as number) < 1000 || (raw.targetAP as number) > 10_000) continue;
    if (!Number.isSafeInteger(raw.bestAP) || (raw.bestAP as number) < 0 || (raw.bestAP as number) > 100_000) continue;

    const record: DailyChallengeRecord = {
      gameId: raw.gameId,
      targetAP: raw.targetAP as number,
      bestAP: raw.bestAP as number,
    };
    if (Number.isSafeInteger(raw.completedAt) && (raw.completedAt as number) > 0) {
      record.completedAt = raw.completedAt as number;
    }
    validEntries.push([dateKey, record]);
  }

  validEntries.sort(([a], [b]) => b.localeCompare(a));
  return { days: Object.fromEntries(validEntries.slice(0, HISTORY_LIMIT)) };
}

export function mergeDailyChallengeProgress(
  primary: DailyChallengeProgress | undefined,
  secondary: DailyChallengeProgress | undefined,
): DailyChallengeProgress {
  const left = normalizeDailyChallengeProgress(primary);
  const right = normalizeDailyChallengeProgress(secondary);
  const keys = new Set([...Object.keys(left.days), ...Object.keys(right.days)]);
  const merged: Record<string, DailyChallengeRecord> = {};

  for (const key of keys) {
    const a = left.days[key];
    const b = right.days[key];
    if (!a) { merged[key] = b; continue; }
    if (!b) { merged[key] = a; continue; }

    const preferred = b.bestAP > a.bestAP ? b : a;
    const completionTimes = [a.completedAt, b.completedAt].filter((v): v is number => typeof v === 'number');
    merged[key] = {
      gameId: preferred.gameId,
      targetAP: preferred.targetAP,
      bestAP: Math.max(a.bestAP, b.bestAP),
      ...(completionTimes.length ? { completedAt: Math.min(...completionTimes) } : {}),
    };
  }

  return normalizeDailyChallengeProgress({ days: merged });
}

function completedDaySet(progress: DailyChallengeProgress): Set<string> {
  return new Set(
    Object.entries(progress.days)
      .filter(([, record]) => record.bestAP >= record.targetAP && typeof record.completedAt === 'number')
      .map(([dateKey]) => dateKey),
  );
}

export function getDailyChallengeStreaks(
  progressInput: DailyChallengeProgress | undefined,
  todayKey = getUtcDayKey(),
): { currentStreak: number; bestStreak: number } {
  const progress = normalizeDailyChallengeProgress(progressInput);
  const completed = completedDaySet(progress);

  let anchor = completed.has(todayKey) ? todayKey : shiftUtcDayKey(todayKey, -1);
  let currentStreak = 0;
  while (completed.has(anchor)) {
    currentStreak += 1;
    anchor = shiftUtcDayKey(anchor, -1);
    if (currentStreak > HISTORY_LIMIT) break;
  }

  const serials = [...completed]
    .map((key) => daySerial(key))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  let bestStreak = 0;
  let run = 0;
  let previous: number | null = null;
  for (const serial of serials) {
    run = previous !== null && serial === previous + 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = serial;
  }

  return { currentStreak, bestStreak };
}

export function getDailyChallengeSummary(
  stats: Pick<UserStats, 'dailyChallenge'>,
  dayKey = getUtcDayKey(),
): DailyChallengeSummary {
  const definition = getDailyChallengeDefinition(dayKey);
  const progress = normalizeDailyChallengeProgress(stats.dailyChallenge);
  const record = progress.days[definition.dateKey];
  const compatible = record?.gameId === definition.gameId ? record : undefined;
  const bestAP = compatible?.bestAP ?? 0;
  const targetAP = compatible?.targetAP ?? definition.targetAP;
  const completed = bestAP >= targetAP && typeof compatible?.completedAt === 'number';
  const streaks = getDailyChallengeStreaks(progress, definition.dateKey);

  return {
    definition: { ...definition, targetAP },
    bestAP,
    completed,
    completedAt: compatible?.completedAt ?? null,
    progressPercent: Math.min(100, Math.round((bestAP / targetAP) * 100)),
    ...streaks,
  };
}

export function recordDailyChallengeScore(
  stats: UserStats,
  gameId: string,
  ap: number,
  now = Date.now(),
): { stats: UserStats; justCompleted: boolean; definition: DailyChallengeDefinition } {
  const definition = getDailyChallengeDefinition(getUtcDayKey(now));
  const progress = normalizeDailyChallengeProgress(stats.dailyChallenge);
  if (gameId !== definition.gameId || !Number.isFinite(ap) || ap < 0) {
    return { stats: { ...stats, dailyChallenge: progress }, justCompleted: false, definition };
  }

  const prior = progress.days[definition.dateKey];
  const priorCompatible = prior?.gameId === definition.gameId ? prior : undefined;
  const targetAP = priorCompatible?.targetAP ?? definition.targetAP;
  const bestAP = Math.max(priorCompatible?.bestAP ?? 0, Math.floor(ap));
  const wasCompleted = Boolean(
    priorCompatible &&
    priorCompatible.bestAP >= targetAP &&
    typeof priorCompatible.completedAt === 'number'
  );
  const isCompleted = bestAP >= targetAP;

  const nextRecord: DailyChallengeRecord = {
    gameId: definition.gameId,
    targetAP,
    bestAP,
    ...(wasCompleted
      ? { completedAt: priorCompatible!.completedAt }
      : isCompleted
        ? { completedAt: now }
        : {}),
  };

  const nextProgress = normalizeDailyChallengeProgress({
    days: { ...progress.days, [definition.dateKey]: nextRecord },
  });

  return {
    stats: { ...stats, dailyChallenge: nextProgress },
    justCompleted: !wasCompleted && isCompleted,
    definition: { ...definition, targetAP },
  };
}
