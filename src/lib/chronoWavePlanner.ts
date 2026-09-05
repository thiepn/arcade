import { clamp } from './gameCoordinates';

export const CHRONO_SIDES = 6;
export const CHRONO_OPEN_SPAN = 2;
export const CHRONO_MAX_GAP_SHIFT_SECTORS = 1;
export const CHRONO_REACTION_FRAMES = 7;
export const CHRONO_MIN_IMPACT_GAP_FRAMES = 24;
export const CHRONO_TRANSITION_GRACE_FRAMES = 90;
export const CHRONO_MAX_ACTIVE_WALLS = 4;

const TAU = Math.PI * 2;

export interface ChronoGapPhrase {
  id: string;
  label: string;
  offsets: readonly (-1 | 0 | 1)[];
}

// P21 composes the already-certified one-sector transitions into short readable
// phrases. Every offset stays inside the old ±1 reachability envelope, and the
// planner still owns impact spacing and forced safe openings.
export const CHRONO_GAP_PHRASES: readonly ChronoGapPhrase[] = [
  { id: 'orientation', label: 'ORIENTATION', offsets: [0, 1, 0, -1] },
  { id: 'weave', label: 'WEAVE', offsets: [1, 0, -1, 0] },
  { id: 'reversal', label: 'REVERSAL', offsets: [1, -1, 1, -1] },
  { id: 'compression', label: 'COMPRESSION', offsets: [1, 1, 0, -1, -1, 0] },
] as const;

export const getChronoGapPhrase = (currentFrame: number): ChronoGapPhrase => {
  const sequenceIndex = Math.max(0, Math.floor(currentFrame / CHRONO_MIN_IMPACT_GAP_FRAMES));
  const phraseIndex = Math.floor(sequenceIndex / 6) % CHRONO_GAP_PHRASES.length;
  return CHRONO_GAP_PHRASES[phraseIndex];
};

export interface ChronoWallPlanInput {
  currentFrame: number;
  spawnRadius: number;
  playerRadius: number;
  desiredSpeed: number;
  rotationSpeed: number;
  lastImpactFrame: number;
  lastOpenSide: number;
  consecutiveSameGap: number;
  forcedOpenSide?: number | null;
  sides?: number;
  openSpan?: number;
  random?: () => number;
}

export interface ChronoWallPlan {
  openSide: number;
  openSpan: number;
  speed: number;
  impactFrame: number;
  impactGapFrames: number;
  gapShiftSectors: number;
  consecutiveSameGap: number;
}

export interface ChronoWallLike {
  radius: number;
  cleared: boolean;
}

export const normalizeChronoSector = (sector: number, sides = CHRONO_SIDES): number =>
  ((Math.round(sector) % sides) + sides) % sides;

export const normalizeChronoAngle = (angle: number): number => {
  const normalized = angle % TAU;
  return normalized < 0 ? normalized + TAU : normalized;
};

export const shortestChronoAngleDistance = (from: number, to: number): number => {
  let difference = normalizeChronoAngle(to) - normalizeChronoAngle(from);
  if (difference > Math.PI) difference -= TAU;
  if (difference < -Math.PI) difference += TAU;
  return difference;
};

export const getChronoGapCenterAngle = (
  openSide: number,
  openSpan = CHRONO_OPEN_SPAN,
  sides = CHRONO_SIDES,
): number =>
  normalizeChronoAngle((openSide + openSpan / 2) * (TAU / sides));

export const getChronoOpenSideForAngle = (
  angle: number,
  openSpan = CHRONO_OPEN_SPAN,
  sides = CHRONO_SIDES,
): number => {
  const sectorPosition = normalizeChronoAngle(angle) / (TAU / sides);
  return normalizeChronoSector(Math.round(sectorPosition - openSpan / 2), sides);
};

export const isAngleInChronoGap = (
  angle: number,
  openSide: number,
  openSpan = CHRONO_OPEN_SPAN,
  sides = CHRONO_SIDES,
  safetyMarginRadians = 0.12,
): boolean => {
  const sectorAngle = TAU / sides;
  const halfGap = Math.max(0, (openSpan * sectorAngle) / 2 - safetyMarginRadians);
  const difference = Math.abs(
    shortestChronoAngleDistance(angle, getChronoGapCenterAngle(openSide, openSpan, sides)),
  );
  return difference <= halfGap;
};

export const circularChronoSectorDistance = (
  from: number,
  to: number,
  sides = CHRONO_SIDES,
): number => {
  const direct = Math.abs(normalizeChronoSector(to, sides) - normalizeChronoSector(from, sides));
  return Math.min(direct, sides - direct);
};

export const getChronoStageForScore = (score: number): number => {
  if (score > 12000) return 4;
  if (score > 6000) return 3;
  if (score > 2500) return 2;
  return 1;
};

export const getChronoSpawnInterval = (stage: number): number => {
  if (stage >= 4) return 66;
  if (stage === 3) return 72;
  if (stage === 2) return 80;
  return 88;
};

export const getChronoWallColor = (stage: number): string => {
  const colors = ['#A855F7', '#38BDF8', '#FACC15', '#F43F5E'];
  return colors[clamp(Math.floor(stage) - 1, 0, colors.length - 1)];
};

export const getChronoDesiredWallSpeed = (
  stage: number,
  speedMultiplier: number,
): number =>
  (1.35 + (Math.max(1, stage) - 1) * 0.24) * clamp(speedMultiplier, 0.9, 2.35);

export const getChronoRequiredImpactGapFrames = (
  rotationSpeed: number,
  sides = CHRONO_SIDES,
): number => {
  const sectorAngle = TAU / sides;
  const turnFrames = Math.ceil((sectorAngle * 1.15) / Math.max(0.05, rotationSpeed));
  return Math.max(CHRONO_MIN_IMPACT_GAP_FRAMES, turnFrames + CHRONO_REACTION_FRAMES);
};

export const isChronoGapTransitionReachable = (
  previousOpenSide: number,
  nextOpenSide: number,
  availableFrames: number,
  rotationSpeed: number,
  openSpan = CHRONO_OPEN_SPAN,
  sides = CHRONO_SIDES,
): boolean => {
  const previousCenter = getChronoGapCenterAngle(previousOpenSide, openSpan, sides);
  const nextCenter = getChronoGapCenterAngle(nextOpenSide, openSpan, sides);
  const requiredRotation = Math.abs(shortestChronoAngleDistance(previousCenter, nextCenter));
  const availableRotation =
    Math.max(0, availableFrames - CHRONO_REACTION_FRAMES) * Math.max(0, rotationSpeed);
  return requiredRotation <= availableRotation + 1e-9;
};

export const planChronoWall = ({
  currentFrame,
  spawnRadius,
  playerRadius,
  desiredSpeed,
  rotationSpeed,
  lastImpactFrame,
  lastOpenSide,
  consecutiveSameGap,
  forcedOpenSide = null,
  sides = CHRONO_SIDES,
  openSpan = CHRONO_OPEN_SPAN,
  random = Math.random,
}: ChronoWallPlanInput): ChronoWallPlan => {
  const travelDistance = Math.max(1, spawnRadius - playerRadius);
  const naturalTravelFrames = travelDistance / Math.max(0.1, desiredSpeed);
  const minimumImpactGap = getChronoRequiredImpactGapFrames(rotationSpeed, sides);
  const previousImpactFrame = Math.max(currentFrame, lastImpactFrame);
  const impactFrame = Math.max(
    currentFrame + naturalTravelFrames,
    previousImpactFrame + minimumImpactGap,
  );
  const impactGapFrames = lastImpactFrame > currentFrame
    ? impactFrame - lastImpactFrame
    : impactFrame - currentFrame;

  const sectorAngle = TAU / sides;
  const maximumShiftFromTime = Math.floor(
    (Math.max(0, impactGapFrames - CHRONO_REACTION_FRAMES) * Math.max(0, rotationSpeed)) /
      sectorAngle,
  );
  const maximumShift = clamp(
    maximumShiftFromTime,
    0,
    CHRONO_MAX_GAP_SHIFT_SECTORS,
  );

  let openSide: number;
  if (forcedOpenSide !== null && forcedOpenSide !== undefined) {
    openSide = normalizeChronoSector(forcedOpenSide, sides);
  } else {
    const phrase = getChronoGapPhrase(currentFrame);
    const sequenceIndex = Math.max(0, Math.floor(currentFrame / CHRONO_MIN_IMPACT_GAP_FRAMES));
    let offset = phrase.offsets[sequenceIndex % phrase.offsets.length];

    // Bounded variation mirrors some directional beats, but never changes the
    // certified ±1 transition vocabulary or lets one gap repeat three times.
    if (offset !== 0 && random() < 0.18) offset = (offset * -1) as -1 | 1;
    if (offset === 0 && consecutiveSameGap >= 2 && maximumShift >= 1) {
      offset = random() < 0.5 ? -1 : 1;
    }
    if (Math.abs(offset) > maximumShift) offset = 0;
    openSide = normalizeChronoSector(lastOpenSide + offset, sides);
  }

  const sameGap = openSide === normalizeChronoSector(lastOpenSide, sides);
  const nextConsecutiveSameGap = sameGap ? consecutiveSameGap + 1 : 1;
  const speed = travelDistance / Math.max(1, impactFrame - currentFrame);

  return {
    openSide,
    openSpan,
    speed,
    impactFrame,
    impactGapFrames,
    gapShiftSectors: circularChronoSectorDistance(lastOpenSide, openSide, sides),
    consecutiveSameGap: nextConsecutiveSameGap,
  };
};

export const selectNextChronoWall = <T extends ChronoWallLike>(
  walls: T[],
  playerRadius: number,
): T | null => {
  let closest: T | null = null;
  for (const wall of walls) {
    if (wall.cleared || wall.radius <= playerRadius) continue;
    if (!closest || wall.radius < closest.radius) closest = wall;
  }
  return closest;
};
