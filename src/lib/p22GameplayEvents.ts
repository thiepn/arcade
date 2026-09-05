export type P22GameId =
  | 'snake'
  | 'orbit'
  | 'neonrail'
  | 'slingshot'
  | 'bubblebuster'
  | 'matrix'
  | 'knifetarget'
  | 'roadcross';

export const P22_GAMEPLAY_EVENT = 'arcade:p22-gameplay';

export interface P22GameplayDetail {
  gameId: P22GameId;
  kind: string;
  label?: string;
  secondaryLabel?: string;
  value?: number;
  aux?: number;
  index?: number;
  flag?: boolean;
  meta?: Record<string, string | number | boolean>;
  /**
   * Mutable response channel used by the P22 runtime for score-only run bonuses.
   * Game helpers remain authoritative for their own base score and simply add the
   * returned bonus to the same score path they already use.
   */
  bonus?: number;
}

export const requestP22GameplayEvent = (
  detail: Omit<P22GameplayDetail, 'bonus'>,
): number => {
  if (typeof window === 'undefined') return 0;
  const payload: P22GameplayDetail = { ...detail, bonus: 0 };
  window.dispatchEvent(new CustomEvent<P22GameplayDetail>(P22_GAMEPLAY_EVENT, { detail: payload }));
  const bonus = Number(payload.bonus ?? 0);
  return Number.isFinite(bonus) ? Math.max(0, Math.floor(bonus)) : 0;
};
