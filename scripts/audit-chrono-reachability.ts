import { readFileSync } from 'node:fs';
import {
  CHRONO_MAX_ACTIVE_WALLS,
  CHRONO_MAX_GAP_SHIFT_SECTORS,
  CHRONO_OPEN_SPAN,
  CHRONO_SIDES,
  CHRONO_TRANSITION_GRACE_FRAMES,
  circularChronoSectorDistance,
  getChronoDesiredWallSpeed,
  getChronoGapCenterAngle,
  getChronoOpenSideForAngle,
  getChronoSpawnInterval,
  getChronoStageForScore,
  isAngleInChronoGap,
  isChronoGapTransitionReachable,
  planChronoWall,
} from '../src/lib/chronoWavePlanner';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

assert(CHRONO_OPEN_SPAN >= 2, 'Chrono gaps must remain at least two sectors wide');
assert(CHRONO_MAX_GAP_SHIFT_SECTORS === 1, 'consecutive gaps must move by at most one sector');
assert(CHRONO_TRANSITION_GRACE_FRAMES >= 60, 'stage transition grace must last at least one second');
assert(CHRONO_MAX_ACTIVE_WALLS <= 5, 'active-wall cap is too high for reliable telegraphing');

assert(getChronoStageForScore(2500) === 1, 'stage 1 score boundary changed');
assert(getChronoStageForScore(2501) === 2, 'stage 2 score boundary changed');
assert(getChronoStageForScore(6001) === 3, 'stage 3 score boundary changed');
assert(getChronoStageForScore(12001) === 4, 'stage 4 score boundary changed');
assert(
  getChronoSpawnInterval(1) > getChronoSpawnInterval(4),
  'later stages must still spawn faster than stage 1',
);

let seed = 0x51f15e;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

for (const stage of [1, 2, 3, 4]) {
  for (const speedMultiplier of [1, 1.35, 1.75, 2.2]) {
    const rotationSpeed = 0.17 + (speedMultiplier - 1) * 0.035;
    const spawnRadius = 520;
    const playerRadius = 58;
    let currentFrame = 0;
    let lastImpactFrame = 0;
    let lastOpenSide = 0;
    let consecutiveSameGap = 0;
    const planned: Array<{
      spawnFrame: number;
      speed: number;
      impactFrame: number;
      openSide: number;
    }> = [];

    for (let index = 0; index < 300; index++) {
      currentFrame += getChronoSpawnInterval(stage) / speedMultiplier;
      const previousOpenSide = lastOpenSide;
      const previousImpactFrame = lastImpactFrame;
      const plan = planChronoWall({
        currentFrame,
        spawnRadius,
        playerRadius,
        desiredSpeed: getChronoDesiredWallSpeed(stage, speedMultiplier),
        rotationSpeed,
        lastImpactFrame,
        lastOpenSide,
        consecutiveSameGap,
        random,
      });

      assert(plan.openSpan === CHRONO_OPEN_SPAN, `stage ${stage}: unsafe gap width generated`);
      assert(
        plan.impactFrame > previousImpactFrame,
        `stage ${stage}: wall impacts are not strictly ordered`,
      );
      assert(
        circularChronoSectorDistance(previousOpenSide, plan.openSide, CHRONO_SIDES) <=
          CHRONO_MAX_GAP_SHIFT_SECTORS,
        `stage ${stage}: gap jumped more than one sector`,
      );
      assert(
        isChronoGapTransitionReachable(
          previousOpenSide,
          plan.openSide,
          plan.impactGapFrames,
          rotationSpeed,
          plan.openSpan,
          CHRONO_SIDES,
        ),
        `stage ${stage}: planned gap is not reachable before impact`,
      );
      assert(
        plan.consecutiveSameGap <= 2,
        `stage ${stage}: planner repeated one gap more than twice`,
      );
      assert(plan.speed > 0, `stage ${stage}: generated non-positive wall speed`);

      for (const prior of planned) {
        if (prior.impactFrame >= plan.impactFrame) continue;
        const newRadiusAtPriorImpact =
          spawnRadius - plan.speed * Math.max(0, prior.impactFrame - currentFrame);
        assert(
          newRadiusAtPriorImpact > playerRadius - 0.001,
          `stage ${stage}: a newer wall overtakes an earlier wall before the player ring`,
        );
      }

      planned.push({
        spawnFrame: currentFrame,
        speed: plan.speed,
        impactFrame: plan.impactFrame,
        openSide: plan.openSide,
      });
      lastImpactFrame = plan.impactFrame;
      lastOpenSide = plan.openSide;
      consecutiveSameGap = plan.consecutiveSameGap;
    }
  }
}

for (const playerAngle of [0, 0.2, 1.4, 3.1, 5.95]) {
  const forcedOpenSide = getChronoOpenSideForAngle(playerAngle);
  const plan = planChronoWall({
    currentFrame: 100,
    spawnRadius: 500,
    playerRadius: 58,
    desiredSpeed: 3,
    rotationSpeed: 0.17,
    lastImpactFrame: 100,
    lastOpenSide: 4,
    consecutiveSameGap: 2,
    forcedOpenSide,
    random,
  });

  assert(
    isAngleInChronoGap(playerAngle, plan.openSide, plan.openSpan),
    `transition at angle ${playerAngle.toFixed(2)} did not force a safe first gap`,
  );
  const gapCenter = getChronoGapCenterAngle(plan.openSide, plan.openSpan);
  assert(Number.isFinite(gapCenter), 'forced transition gap center is not finite');
}

const source = readFileSync('src/games/ChronoGame.tsx', 'utf8');
for (const token of [
  'planChronoWall',
  'isAngleInChronoGap',
  'selectNextChronoWall',
  'transitionGraceFrames',
  'forcedNextOpenSide',
  'lastPlannedImpactFrame',
  'previousRadius >= pR && wall.radius < pR',
  'state.walls = []',
  'state.shards = []',
  'CHRONO_MAX_ACTIVE_WALLS',
  'getChronoStageForScore',
]) {
  assert(source.includes(token), `ChronoGame is missing required reachability token: ${token}`);
}
assert(!source.includes('const openSpan = 1'), 'single-sector Chrono gaps must not return');
assert(
  !source.includes('offsetChoices = [-2, -1, 0, 1, 2]'),
  'two-sector random gap jumps must not return',
);
assert(
  source.includes('frameScale = Math.min(dt * 60, 2)'),
  'Chrono simulation is not frame-rate normalized',
);

if (errors.length) {
  console.error('Chrono Wave reachability audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Chrono Wave audit passed: two-sector gaps, one-sector transitions, ordered wall impacts, safe color changes, frame-rate normalization, and forced transition openings are certified.',
);
