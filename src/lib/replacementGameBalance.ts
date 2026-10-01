/** P26 production balance contracts for the two replacement engines.
 *
 * The public game names changed, but the compatibility-slot ids and AP anchors
 * intentionally remain gravity / astroblaster. These helpers keep the native
 * reward envelope explicit and independently testable against that live policy.
 */

export const VECTOR_HOLE_PARS = [3, 4, 4, 5, 5, 5] as const;
export const VECTOR_MAX_ROUTE_STARS = 3;
export const VECTOR_MAX_BANK_REWARD_EVENTS = 3;
export const VECTOR_STROKE_LIMIT_OVER_PAR = 5;

export const getVectorHoleScore = (
  par: number,
  strokes: number,
  elapsedSeconds: number,
  stars: number,
  bankContacts: number,
): number => {
  const safePar = Math.max(1, Math.floor(par));
  const safeStrokes = Math.max(1, Math.floor(strokes));
  const safeElapsed = Math.max(0, elapsedSeconds);
  const safeStars = Math.min(VECTOR_MAX_ROUTE_STARS, Math.max(0, Math.floor(stars)));
  const safeBanks = Math.min(VECTOR_MAX_BANK_REWARD_EVENTS, Math.max(0, Math.floor(bankContacts)));
  const underPar = Math.max(-2, safePar - safeStrokes);
  const core = Math.max(
    350,
    2500 +
      underPar * 450 -
      Math.max(0, safeStrokes - safePar) * 280 -
      Math.floor(safeElapsed * 4),
  );
  return core + safeStars * 400 + safeBanks * 90;
};

export const getVectorTheoreticalMaxScore = (): number =>
  VECTOR_HOLE_PARS.reduce(
    (total, par) =>
      total +
      getVectorHoleScore(
        par,
        1,
        0,
        VECTOR_MAX_ROUTE_STARS,
        VECTOR_MAX_BANK_REWARD_EVENTS,
      ),
    0,
  );

export const HEX_GOAL_PERCENT = 72;
export const HEX_STEP_MS = 82;
export const HEX_START_LIVES = 3;
export const HEX_SECOND_HUNTER_PERCENT = 34;
export const HEX_MAX_CHAIN_BONUS = 6;

export const getHexClosureBonus = (claimedCells: number, chain: number): number => {
  const claimed = Math.max(0, Math.floor(claimedCells));
  const safeChain = Math.min(HEX_MAX_CHAIN_BONUS, Math.max(0, Math.floor(chain)));
  return claimed * 90 + Math.floor(Math.sqrt(claimed) * 140) + safeChain * 420;
};

export const getHexWinBonus = (lives: number): number =>
  8000 + Math.max(0, Math.floor(lives)) * 1200;
