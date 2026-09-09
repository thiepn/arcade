/** Scoring v2. This module is shared by the browser, D1 Worker and Supabase Edge.
 * Engine counters remain native so score-driven stage progression is not retuned
 * accidentally. Only these calibrated Arcade Points are saved/ranked/displayed.
 * Anchors are initial design benchmarks, NOT measured human percentiles.
 */
import profilesJson from './scoringProfiles.json' with { type: 'json' };
export const SCORE_VERSION = 2;
export const RATING_GAME_CAP = 10_000;
export type ScoringProfile = {
  title: string; anchors: number[]; legacyAnchors: number[];
  kind: string; basis: string;
  modes?: Record<string, { anchors: number[]; reward: number }>;
};
export const SCORING_PROFILES: Readonly<Record<string, ScoringProfile>> = profilesJson;
export const RHYTHM_MODES = SCORING_PROFILES.rhythm.modes!;
export function defaultScoreMode(gameId: string): string {
  return gameId === 'airhockey' ? 'MEDIUM' : gameId === 'rhythm' ? 'cyber_odyssey' : 'standard';
}
export function isScoreMode(gameId: string, mode: string): boolean {
  if (!Object.hasOwn(SCORING_PROFILES, gameId)) return false;
  if (gameId === 'airhockey') return ['EASY','MEDIUM','HARD'].includes(mode);
  if (gameId === 'rhythm') return Object.hasOwn(RHYTHM_MODES, mode);
  return mode === 'standard';
}
export function scoreCurve(raw: number, anchors: readonly number[]): number {
  const [a,b,c] = anchors;
  if (raw <= a) return 1000 * raw / a;
  if (raw <= b) return 1000 + 2000 * (raw-a)/(b-a);
  if (raw <= c) return 3000 + 3000 * (raw-b)/(c-b);
  // No endless-run hard cap. Doubling beyond mastery earns another 2,000 AP.
  return 6000 + 2000 * Math.log2(raw/c);
}
export function toArcadePoints(gameId: string, raw: number, modeId = defaultScoreMode(gameId), sourceVersion = SCORE_VERSION): number {
  if (!Number.isFinite(raw) || raw <= 0 || raw > Number.MAX_SAFE_INTEGER || !Object.hasOwn(SCORING_PROFILES, gameId)) return 0;
  const profile = SCORING_PROFILES[gameId];
  if (sourceVersion !== 1 && sourceVersion !== SCORE_VERSION) return 0;
  if (sourceVersion === 1) return Math.floor(scoreCurve(raw, profile.legacyAnchors) + 1e-7);
  if (!isScoreMode(gameId, modeId)) return 0;
  const mode = gameId === 'rhythm' ? RHYTHM_MODES[modeId] : undefined;
  return Math.floor(scoreCurve(raw, mode?.anchors ?? profile.anchors) * (mode?.reward ?? 1) + 1e-7);
}
/** Native game score stays native in the game UI. AP conversion belongs only at the arcade/leaderboard boundary. */
export function arcadeRating(scores: Record<string, number>): number {
  return Object.keys(SCORING_PROFILES).reduce((sum,id) => {
    const score = scores[id];
    return sum + (Number.isFinite(score) ? Math.min(RATING_GAME_CAP,Math.max(0,Math.floor(score))) : 0);
  },0);
}
export function arcadeTotal(scores: Record<string, number>): number {
  return Object.keys(SCORING_PROFILES).reduce((sum,id) => {
    const score = scores[id];
    return sum + (Number.isSafeInteger(score) ? Math.max(0,score) : 0);
  },0);
}
