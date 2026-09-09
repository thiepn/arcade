import { SCORE_VERSION, SCORING_PROFILES, defaultScoreMode, isScoreMode } from './scoring.ts';

/** Operational session lifetime, not a time bonus. Paused/idle time awards no AP. */
export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
export type ScoreContext = { scoreVersion: number; modeId: string };
export function scoreContext(gameId: string, version: unknown, mode: unknown): ScoreContext | null {
  if (!Object.hasOwn(SCORING_PROFILES, gameId)) return null;
  const scoreVersion = version === undefined ? 1 : version;
  if (scoreVersion === 1) return mode === undefined || mode === 'legacy' ? { scoreVersion: 1, modeId: 'legacy' } : null;
  const modeId = mode === undefined ? defaultScoreMode(gameId) : mode;
  return scoreVersion === SCORE_VERSION && typeof modeId === 'string' && isScoreMode(gameId, modeId)
    ? { scoreVersion, modeId } : null;
}
export const GAME_RULES: Record<string, { maxScore: number; minDurationMs: number; maxDurationMs: number }> = Object.fromEntries(
  Object.entries(SCORING_PROFILES).map(([id, profile]) => [id, {
    // Coarse input sanity ceilings. Server normalization is mandatory; this is not replay verification.
    maxScore: profile.kind === 'finite' ? 100_000 : id === 'airhockey' ? 1_000_000 : 1_000_000_000_000,
    minDurationMs: id === 'reaction' ? 750 : 250,
    maxDurationMs: SESSION_TTL_MS,
  }]),
);
