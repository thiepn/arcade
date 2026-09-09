/** Bounded native reward economies. AP calibration is in shared/scoring.ts. */
export function chainOrbReward(chain: number, special = false): number {
  return Math.round(140 * (1 + Math.min(12,Math.max(0,chain-1)) * 0.15) * (special ? 2 : 1));
}
export function matrixStepBase(combo: number): number {
  return 100 + Math.min(20,Math.max(0,combo)) * 25;
}
export function driftTickReward(multiplier: number, boosting: boolean): number {
  return Math.max(1,Math.min(6,Math.floor(multiplier))) * (boosting ? 2 : 1);
}
export const DRIFT_TIER_TICKS = 180; // Three seconds of active drift per tier, not half a second.
export function pulsePerfectReward(combo: number): number {
  const streak = 1 + Math.min(10,Math.max(0,combo-1)) * 0.1;
  return Math.round(250 * streak * (combo >= 5 ? 1.5 : 1));
}
export function rhythmComboMultiplier(combo: number, overdrive: boolean): number {
  const base = combo >= 50 ? 2 : combo >= 25 ? 1.75 : combo >= 12 ? 1.5 : combo >= 5 ? 1.25 : 1;
  return base * (overdrive ? 1.5 : 1);
}
