export const ORB_BURST_MAX_CHARGES = 2;
export const ORB_BURST_START_CHARGES = 1;
export const ORB_BURST_EARN_COMBO = 4;
export const ORB_BURST_EARN_DROP_COUNT = 4;

export function canArmOrbBurst(charges: number, armed: boolean, hasFlyingBubble: boolean): boolean {
  return charges > 0 && !armed && !hasFlyingBubble;
}

export function canSwapOrbChamber(hasSwappedThisTurn: boolean, hasFlyingBubble: boolean): boolean {
  return !hasSwappedThisTurn && !hasFlyingBubble;
}

export function shouldEarnOrbBurst(combo: number, dropCount: number): boolean {
  return dropCount >= ORB_BURST_EARN_DROP_COUNT || (combo > 0 && combo % ORB_BURST_EARN_COMBO === 0);
}
