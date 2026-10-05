import type { DailyChallengeState } from '../types';

const DAY_MS = 86_400_000;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DAILY_CHALLENGE_STRONG_AP = 3_000;

export interface DailyChallengeView {
  dayKey: string;
  gameId: string;
  bestAP: number;
  completed: boolean;
  strongGoalReached: boolean;
  currentStreak: number;
  bestStreak: number;
  totalCompleted: number;
}

export interface DailyChallengeRunResult {
  wasDailyChallenge: boolean;
  justCompleted: boolean;
  justReachedStrongGoal: boolean;
  state: DailyChallengeState;
  view: DailyChallengeView;
}

const safeInteger = (value: unknown, max = Number.MAX_SAFE_INTEGER): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, max)
    : 0;

export function utcDayKey(now: number | Date = Date.now()): string {
  const value = now instanceof Date ? now.getTime() : now;
  const date = new Date(Number.isFinite(value) ? value : Date.now());
  return date.toISOString().slice(0, 10);
}

function dayKeyTime(dayKey: string): number | null {
  if (!DAY_KEY_RE.test(dayKey)) return null;
  const value = Date.parse(dayKey + 'T00:00:00.000Z');
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== dayKey) return null;
  return value;
}

export function previousUtcDayKey(dayKey: string): string {
  const value = dayKeyTime(dayKey);
  if (value === null) return utcDayKey(Date.now() - DAY_MS);
  return utcDayKey(value - DAY_MS);
}

export function millisecondsUntilNextUtcDay(now = Date.now()): number {
  const date = new Date(now);
  const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return Math.max(1_000, next - now + 50);
}

export function normalizeDailyChallengeState(value: unknown): DailyChallengeState {
  const parsed = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const dayKey = typeof parsed.dayKey === 'string' && dayKeyTime(parsed.dayKey) !== null ? parsed.dayKey : undefined;
  const lastCompletedDay =
    typeof parsed.lastCompletedDay === 'string' && dayKeyTime(parsed.lastCompletedDay) !== null
      ? parsed.lastCompletedDay
      : undefined;
  const bestAP = safeInteger(parsed.bestAP);
  return {
    dayKey,
    bestAP,
    completed: parsed.completed === true && bestAP > 0,
    lastCompletedDay,
    currentStreak: safeInteger(parsed.currentStreak, 100_000),
    bestStreak: safeInteger(parsed.bestStreak, 100_000),
    totalCompleted: safeInteger(parsed.totalCompleted, 1_000_000),
  };
}

export function dailyChallengeGameId(dayKey: string, gameIds: readonly string[]): string {
  const unique = [...new Set(gameIds.filter((id) => /^[a-z0-9-]{1,64}$/.test(id)))].sort();
  if (!unique.length) throw new Error('Daily challenge requires at least one valid game id.');
  const value = dayKeyTime(dayKey);
  if (value === null) throw new Error('Daily challenge requires a valid UTC day key.');
  const epochDay = Math.floor(value / DAY_MS);
  return unique[(epochDay + 11) % unique.length];
}

export function getDailyChallengeView(
  value: DailyChallengeState | undefined,
  gameIds: readonly string[],
  now: number | Date = Date.now(),
): DailyChallengeView {
  const state = normalizeDailyChallengeState(value);
  const dayKey = utcDayKey(now);
  const isToday = state.dayKey === dayKey;
  const streakStillAlive =
    state.lastCompletedDay === dayKey || state.lastCompletedDay === previousUtcDayKey(dayKey);
  const bestAP = isToday ? state.bestAP : 0;
  return {
    dayKey,
    gameId: dailyChallengeGameId(dayKey, gameIds),
    bestAP,
    completed: isToday && state.completed,
    strongGoalReached: bestAP >= DAILY_CHALLENGE_STRONG_AP,
    currentStreak: streakStillAlive ? state.currentStreak : 0,
    bestStreak: state.bestStreak,
    totalCompleted: state.totalCompleted,
  };
}

export function applyDailyChallengeRun(
  value: DailyChallengeState | undefined,
  gameIds: readonly string[],
  gameId: string,
  arcadePoints: number,
  now: number | Date = Date.now(),
): DailyChallengeRunResult {
  const state = normalizeDailyChallengeState(value);
  const viewBefore = getDailyChallengeView(state, gameIds, now);
  if (gameId !== viewBefore.gameId) {
    return {
      wasDailyChallenge: false,
      justCompleted: false,
      justReachedStrongGoal: false,
      state,
      view: viewBefore,
    };
  }

  const runAP = Number.isFinite(arcadePoints) ? Math.max(0, Math.floor(arcadePoints)) : 0;
  const sameDay = state.dayKey === viewBefore.dayKey;
  const previousBest = sameDay ? state.bestAP : 0;
  const bestAP = Math.max(previousBest, runAP);
  const wasCompleted = sameDay && state.completed;
  const completed = wasCompleted || runAP > 0;
  const justCompleted = completed && !wasCompleted;

  let currentStreak = state.currentStreak;
  let bestStreak = state.bestStreak;
  let totalCompleted = state.totalCompleted;
  let lastCompletedDay = state.lastCompletedDay;

  if (justCompleted) {
    currentStreak =
      state.lastCompletedDay === previousUtcDayKey(viewBefore.dayKey)
        ? Math.max(1, state.currentStreak + 1)
        : state.lastCompletedDay === viewBefore.dayKey
          ? Math.max(1, state.currentStreak)
          : 1;
    bestStreak = Math.max(bestStreak, currentStreak);
    totalCompleted += 1;
    lastCompletedDay = viewBefore.dayKey;
  }

  const next: DailyChallengeState = {
    dayKey: viewBefore.dayKey,
    bestAP,
    completed,
    lastCompletedDay,
    currentStreak,
    bestStreak,
    totalCompleted,
  };

  const view = getDailyChallengeView(next, gameIds, now);
  return {
    wasDailyChallenge: true,
    justCompleted,
    justReachedStrongGoal:
      previousBest < DAILY_CHALLENGE_STRONG_AP && bestAP >= DAILY_CHALLENGE_STRONG_AP,
    state: next,
    view,
  };
}
