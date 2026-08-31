import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ORBIT_FORMATION_COOLDOWN_SEC,
  ORBIT_FORMATION_GRACE_SEC,
  ORBIT_FORMATION_RESOLVE_SEC,
  ORBIT_FORMATION_WARNING_SEC,
  ORBIT_THREAT_FORMATIONS,
  getOrbitFormationBonus,
} from '../src/lib/orbitThreatMastery';
import {
  PAC_HUNT_GHOST_SPEED_MULTIPLIER,
  PAC_HUNT_SCORE_MULTIPLIER,
  PAC_HUNT_TIMER_FACTOR,
  canActivatePacHunt,
  getPacHuntCapturePoints,
  getPacHuntGhostSpeed,
} from '../src/lib/pacHuntMastery';
import { getPacGhostSpeed } from '../src/lib/pacGhostAi';
import {
  SNAKE_PHASE_THREAD_EXTENSION_EVERY,
  SNAKE_PHASE_THREAD_EXTENSION_TICKS,
  SNAKE_PHASE_THREAD_MAX_GHOST_TICKS,
  extendSnakeGhostTimerForThread,
  getSnakePhaseThreadReward,
  shouldExtendSnakePhaseThread,
} from '../src/lib/snakePhaseMastery';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const orbit = read('src/games/OrbitGame.tsx');
const pac = read('src/games/PacMazeGame.tsx');
const snake = read('src/games/SnakeGame.tsx');
const registry = read('src/data/games.ts');

assert(ORBIT_THREAT_FORMATIONS.length === 4, 'Orbit must expose four authored threat formations');
const safeLanes = new Set<number>();
for (const formation of ORBIT_THREAT_FORMATIONS) {
  safeLanes.add(formation.safeLane);
  assert(formation.targets.length === 2, `${formation.name} must threaten exactly two lanes`);
  const threatened = new Set(formation.targets.map((target) => target.lane));
  assert(!threatened.has(formation.safeLane), `${formation.name} threatens its advertised safe lane`);
  assert(threatened.size === 2, `${formation.name} must threaten two distinct lanes`);
  assert(
    ([0, 1, 2] as const).filter((lane) => lane !== formation.safeLane).every((lane) => threatened.has(lane)),
    `${formation.name} must leave exactly one readable safe lane`,
  );
}
assert(safeLanes.size === 3, 'Orbit formations must rotate safe lanes across inner/mid/outer');
assert(ORBIT_FORMATION_WARNING_SEC >= 1 && ORBIT_FORMATION_WARNING_SEC <= 1.5, 'Orbit warning must remain readable');
assert(ORBIT_FORMATION_COOLDOWN_SEC >= 6, 'Orbit formations must not spam the player');
assert(ORBIT_FORMATION_GRACE_SEC >= ORBIT_FORMATION_RESOLVE_SEC, 'Orbit random-hazard grace must cover formation resolution');
assert(getOrbitFormationBonus(1) === 250, 'Orbit formation chain must start at +250');
assert(getOrbitFormationBonus(5) === 1250 && getOrbitFormationBonus(99) === 1250, 'Orbit formation bonus must cap at 5x');
assert(orbit.includes('pendingFormation'), 'Orbit source is missing telegraphed pending formations');
assert(orbit.includes('formationWarningTimer'), 'Orbit source is missing formation warning timing');
assert(orbit.includes('formationResolveTimer'), 'Orbit source is missing formation clear resolution');
assert(orbit.includes('spawnFormationHazard'), 'Orbit source is missing authored formation hazard spawning');
assert(orbit.includes('formationGraceTimer <= 0'), 'Orbit random hazards are not paused around formations');
assert(orbit.includes('FORMATION x'), 'Orbit HUD/feedback is missing formation mastery chain');

assert(PAC_HUNT_TIMER_FACTOR > 0.5 && PAC_HUNT_TIMER_FACTOR < 0.75, 'Pac Hunt must meaningfully shorten frightened time without deleting it');
assert(PAC_HUNT_GHOST_SPEED_MULTIPLIER > 1.2 && PAC_HUNT_GHOST_SPEED_MULTIPLIER < 1.5, 'Pac Hunt ghost speed multiplier is outside the intended risk band');
assert(PAC_HUNT_SCORE_MULTIPLIER === 2, 'Pac Hunt capture reward must stay at 2x');
assert(canActivatePacHunt(true, 1, true), 'Pac Hunt should activate during a live frightened window');
assert(!canActivatePacHunt(false, 1, true) && !canActivatePacHunt(true, 0, true), 'Pac Hunt activation guard is too permissive');
assert(getPacHuntCapturePoints(400, true) === 800, 'Pac Hunt capture scoring is incorrect');
assert(
  getPacHuntGhostSpeed(getPacGhostSpeed(1, true), true) < getPacGhostSpeed(1, false),
  'Pac Hunt must remain slower than normal level-1 chase speed',
);
assert(pac.includes('state.frightenedTimer *= PAC_HUNT_TIMER_FACTOR'), 'Pac source does not trade frightened duration for Hunt Rush');
assert(pac.includes('getPacHuntGhostSpeed'), 'Pac source does not apply Hunt ghost pressure');
assert(pac.includes('getPacHuntCapturePoints'), 'Pac source does not apply Hunt capture rewards');
assert(pac.includes('HUNT RUSH'), 'Pac source does not expose Hunt Rush feedback');
assert(pac.includes("event.code === 'KeyF'"), 'Pac Hunt keyboard activation is missing');

assert(SNAKE_PHASE_THREAD_EXTENSION_EVERY === 3, 'Snake Phase Thread extension cadence must stay every three unique cells');
assert(SNAKE_PHASE_THREAD_EXTENSION_TICKS === 6, 'Snake Phase Thread extension must stay bounded to six ticks');
assert(SNAKE_PHASE_THREAD_MAX_GHOST_TICKS === 90, 'Snake Ghost timer cap changed unexpectedly');
assert(getSnakePhaseThreadReward(1) === 150, 'Snake Phase Thread reward must start at +150');
assert(getSnakePhaseThreadReward(8) === 1200 && getSnakePhaseThreadReward(99) === 1200, 'Snake Phase Thread reward must cap at chain 8');
assert(shouldExtendSnakePhaseThread(3) && shouldExtendSnakePhaseThread(6) && !shouldExtendSnakePhaseThread(4), 'Snake Phase Thread extension cadence is incorrect');
assert(extendSnakeGhostTimerForThread(65, 3) === 71, 'Snake Phase Thread should extend a milestone Ghost timer');
assert(extendSnakeGhostTimerForThread(88, 3) === 90, 'Snake Phase Thread extension must respect its hard cap');
assert(snake.includes('phaseThreadCells: new Set<string>()'), 'Snake source is missing unique firewall traversal tracking');
assert(snake.includes('firewallCollision && isGhost'), 'Snake source does not reward deliberate Ghost firewall traversal');
assert(snake.includes('phaseThreadCells.has(cellKey)'), 'Snake source can farm the same firewall cell repeatedly');
assert(snake.includes('getSnakePhaseThreadReward'), 'Snake source is missing Phase Thread scoring');
assert(snake.includes('extendSnakeGhostTimerForThread'), 'Snake source is missing bounded Phase Thread timer extension');
assert(snake.includes('PHASE THREAD'), 'Snake source is missing Phase Thread feedback');

assert(registry.includes('telegraphed threat formations'), 'Orbit registry copy does not teach formations');
assert(registry.includes('Hunt Rush'), 'Pac registry copy does not teach Hunt Rush');
assert(registry.includes('Phase Thread'), 'Snake registry copy does not teach Phase Thread');

if (errors.length) {
  console.error('P11 CLASSIC-LOOP MASTERY AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P11 CLASSIC-LOOP MASTERY AUDIT — PASS');
console.log('Orbit formations, Pac Hunt Rush, and Snake Phase Thread are bounded, player-readable, and permanently regression-audited.');
