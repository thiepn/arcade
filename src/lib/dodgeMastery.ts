export const DODGE_PHASE_CUT_PADDING_PX = 12;
export const DODGE_PHASE_CUT_BASE_SCORE = 220;
export const DODGE_PHASE_CUT_MAX_CHAIN = 6;
export const DODGE_PHASE_CUT_RECHARGE_MS = 650;

export function isDodgePhaseCut(
  isDashing: boolean,
  distance: number,
  collisionRadius: number,
): boolean {
  return isDashing && distance <= collisionRadius + DODGE_PHASE_CUT_PADDING_PX;
}

export function getDodgePhaseCutReward(chain: number): number {
  const boundedChain = Math.max(1, Math.min(DODGE_PHASE_CUT_MAX_CHAIN, Math.floor(chain)));
  return DODGE_PHASE_CUT_BASE_SCORE * boundedChain;
}

export function getDodgePhaseCutRechargeMs(chain: number): number {
  const boundedChain = Math.max(1, Math.min(DODGE_PHASE_CUT_MAX_CHAIN, Math.floor(chain)));
  return DODGE_PHASE_CUT_RECHARGE_MS + (boundedChain - 1) * 90;
}
