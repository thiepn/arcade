import { requestP22GameplayEvent } from './p22GameplayEvents';

export const ORB_BURST_MAX_CHARGES = 2;
export const ORB_BURST_START_CHARGES = 1;
export const ORB_BURST_EARN_COMBO = 4;
export const ORB_BURST_EARN_DROP_COUNT = 4;

export function canArmOrbBurst(charges: number, armed: boolean, hasFlyingBubble: boolean): boolean {
  const allowed = charges > 0 && !armed && !hasFlyingBubble;
  if (allowed) requestP22GameplayEvent({ gameId: 'bubblebuster', kind: 'orb-burst-arm' });
  return allowed;
}

export function canSwapOrbChamber(hasSwappedThisTurn: boolean, hasFlyingBubble: boolean): boolean {
  const allowed = !hasSwappedThisTurn && !hasFlyingBubble;
  if (allowed) requestP22GameplayEvent({ gameId: 'bubblebuster', kind: 'orb-swap' });
  return allowed;
}

export function shouldEarnOrbBurst(combo: number, dropCount: number): boolean {
  return dropCount >= ORB_BURST_EARN_DROP_COUNT || (combo > 0 && combo % ORB_BURST_EARN_COMBO === 0);
}

export function getOrbSalvoResolutionBonus(combo: number, dropCount: number): number {
  return requestP22GameplayEvent({
    gameId: 'bubblebuster',
    kind: 'orb-resolve',
    value: Math.max(0, Math.floor(combo)),
    aux: Math.max(0, Math.floor(dropCount)),
  });
}
