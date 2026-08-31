export const AERO_FLOW_MAX_CHARGES = 2;
export const AERO_FLOW_START_CHARGES = 1;
export const AERO_FLOW_EARN_GRAZES = 3;
export const AERO_FLOW_DURATION_SEC = 4;
export const AERO_FLOW_SPEED_MULTIPLIER = 1.18;
export const AERO_FLOW_SCORE_MULTIPLIER = 2;

export function canTriggerAeroFlow(charges: number, activeTimer: number, isAlive: boolean): boolean {
  return charges > 0 && activeTimer <= 0 && isAlive;
}

export function shouldEarnAeroFlow(grazeCombo: number): boolean {
  return grazeCombo > 0 && grazeCombo % AERO_FLOW_EARN_GRAZES === 0;
}

export function getAeroFlowScore(baseScore: number, active: boolean): number {
  return baseScore * (active ? AERO_FLOW_SCORE_MULTIPLIER : 1);
}
