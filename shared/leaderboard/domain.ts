/** Immutable leaderboard protocol. Raw Score, AP and bounded Rating are different domains. */
import policyJson from './policy.json' with { type: 'json' };
export const POLICY = policyJson;
export const PROTOCOL_VERSION = 3;
export const AP_SCALE = 1_000_000;
export const POLICY_ID = POLICY.policyId;
export const SESSION_MS = POLICY.sessionMs;
export const DELIVERY_GRACE_MS = POLICY.deliveryGraceMs;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const CREDENTIAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{32,128}$/i;
export type Policy = (typeof POLICY.policies)[keyof typeof POLICY.policies];
export type RunStatus = 'ranked' | 'review' | 'rejected' | 'legacy';
export type SubmissionStatus = 'pending' | 'accepted' | 'review' | 'rejected' | 'expired' | 'auth-required';
export interface RunPayload {
  sessionId: string;
  rawScore: number;
  modeId: string;
  scoreVersion: 2;
  protocolVersion: 3;
  policyId: string;
  durationMs: number;
  activeMs: number;
}
export interface RunReceipt {
  protocolVersion: 3;
  policyId: string;
  accepted: boolean;
  status: RunStatus;
  sessionId: string;
  gameId: string;
  modeId: string;
  rawScore: number;
  arcadePoints: number;
  apMicros: number;
  contributionMicros: number;
  completedAt: number;
  code?: string;
}
export function getPolicy(gameId: string, modeId: string): Policy | null {
  const key = `${gameId}:${modeId}`;
  return Object.hasOwn(POLICY.policies, key) ? POLICY.policies[key as keyof typeof POLICY.policies] : null;
}
export function modesFor(gameId: string): Policy[] {
  return Object.values(POLICY.policies).filter(p => p.gameId === gameId);
}
export function modeLabel(gameId: string, modeId?: string): string {
  return modeId === 'legacy' ? 'Legacy rules (archived)' : getPolicy(gameId, modeId ?? 'standard')?.modeLabel ?? 'Unknown mode';
}
export function safeInteger(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
export function apMicros(gameId: string, raw: number, modeId: string): number {
  const p = getPolicy(gameId, modeId);
  if (!p || !safeInteger(raw)) return 0;
  const [a,b,c] = p.anchors;
  const points = raw <= a ? 1000 * raw / a : raw <= b ? 1000 + 2000 * (raw-a)/(b-a)
    : raw <= c ? 3000 + 3000 * (raw-b)/(c-b) : 6000 + 2000 * Math.log2(raw/c);
  // A micro-AP is the canonical ranking unit. Display rounding never affects ordering.
  return Math.floor(points * p.reward * AP_SCALE + 1e-5);
}
export function contributionMicros(gameId: string, micros: number, modeId: string): number {
  const p = getPolicy(gameId, modeId);
  if (!p || !safeInteger(micros)) return 0;
  return Math.min(POLICY.gameContributionCap * AP_SCALE, Math.floor(micros * POLICY.gameContributionCap / p.contributionTarget));
}
export function displayPoints(micros: number): number { return Math.floor(micros / AP_SCALE); }
export function formatPoints(points: number): string {
  return Math.max(0, Number.isFinite(points) ? points : 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}
export function weekBounds(now: number): { start: number; end: number } {
  const d = new Date(now);
  const start = Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(d.getUTCDay()+6)%7);
  return { start, end: start + 604800000 };
}
/** Conservative plausibility screening, NOT replay verification or proof of human play. */
export function screenRun(gameId: string, modeId: string, rawScore: number, activeMs: number): { status: RunStatus; code: string } {
  const p = getPolicy(gameId,modeId);
  if (!p || !safeInteger(rawScore) || !safeInteger(activeMs,0,SESSION_MS)) return { status:'rejected',code:'invalid_run' };
  if (rawScore > p.hardMax) return { status:'rejected',code:'impossible_score' };
  const seconds=activeMs/1000;
  const ceiling=p.openingAllowance + p.perSecond*seconds + p.perSecondSquared*seconds*seconds;
  if (activeMs < p.minActiveMs || activeMs > p.maxActiveMs || rawScore > ceiling) return { status:'review',code:'plausibility_review' };
  return {status:'ranked',code:'ok'};
}
export function canonicalPayload(value: unknown): RunPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string,unknown>;
  const keys=['sessionId','rawScore','modeId','scoreVersion','protocolVersion','policyId','durationMs','activeMs'];
  if (Object.keys(p).some(k=>!keys.includes(k)) || !keys.every(k=>Object.hasOwn(p,k))) return null;
  if (typeof p.sessionId!=='string' || !UUID.test(p.sessionId) || typeof p.modeId!=='string' || p.modeId.length>40 ||
    p.scoreVersion!==2 || p.protocolVersion!==3 || p.policyId!==POLICY_ID || !safeInteger(p.rawScore) ||
    !safeInteger(p.durationMs,0,SESSION_MS) || !safeInteger(p.activeMs,0,p.durationMs)) return null;
  return p as unknown as RunPayload;
}
export function validDisplayName(value: unknown): value is string {
  return typeof value==='string' && value===value.normalize('NFKC').trim() && [...value].length>=3 && [...value].length<=20 && /^[\p{L}\p{M}\p{N} _.-]+$/u.test(value);
}
export const SUBMISSION_MESSAGES: Record<string,string> = {
  impossible_score:'This result exceeds the game’s rules and was not ranked. Your local record is kept.',
  plausibility_review:'Saved for review: this run is outside the conservative scoring/time range. It is not on the public board yet.',
  session_expired:'The upload window expired. Your local record is kept.',
  session_mismatch:'The game, mode or scoring rules did not match the reserved session.',
  payload_conflict:'This session already has a different result. Its original result was preserved.',
  unauthorized:'This device could not authenticate the original player. Restore that player’s recovery code to upload.',
  upgrade_required:'Update Micro Arcade before starting a ranked run.',
};
