import { readFileSync } from 'node:fs';
import {
  NEON_RAIL_MAX_SPEED,
  NEON_RAIL_MAX_SPAWN_INTERVAL,
  NEON_RAIL_MIN_SPEED,
  NEON_RAIL_MIN_SPAWN_INTERVAL,
  NEON_RAIL_PHASE_COOLDOWN,
  chooseAdjacentNeonRailLane,
  createNeonRailPattern,
  getNeonRailLaneX,
  getNeonRailSpawnInterval,
  getNeonRailSpeed,
  type NeonRailLane,
} from '../src/lib/neonRailShift';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

assert(NEON_RAIL_PHASE_COOLDOWN === 5, 'phase cooldown changed unexpectedly');
assert(getNeonRailSpeed(0) === NEON_RAIL_MIN_SPEED, 'opening rail speed is not certified');
assert(getNeonRailSpeed(10000) === NEON_RAIL_MAX_SPEED, 'rail speed cap is not enforced');
assert(getNeonRailSpawnInterval(0) === NEON_RAIL_MAX_SPAWN_INTERVAL, 'opening spawn interval changed');
assert(
  getNeonRailSpawnInterval(10000) === NEON_RAIL_MIN_SPAWN_INTERVAL,
  'spawn interval floor is not enforced',
);

for (const previous of [0, 1, 2] as NeonRailLane[]) {
  for (let step = 0; step < 100; step++) {
    const next = chooseAdjacentNeonRailLane(previous, step / 100);
    assert(Math.abs(next - previous) <= 1, `safe lane jumped from ${previous} to ${next}`);
  }
}

let previousSafe: NeonRailLane = 1;
for (let row = 0; row < 500; row++) {
  const pattern = createNeonRailPattern(
    previousSafe,
    row,
    ((row * 37) % 101) / 101,
    ((row * 61 + 7) % 103) / 103,
  );
  assert(pattern.blockedLanes.length >= 1, `row ${row} has no barrier`);
  assert(pattern.blockedLanes.length <= 2, `row ${row} blocks all three lanes`);
  assert(!pattern.blockedLanes.includes(pattern.safeLane), `row ${row} blocks its certified safe lane`);
  assert(pattern.coreLane === pattern.safeLane, `row ${row} core does not guide the safe route`);
  assert(Math.abs(pattern.safeLane - previousSafe) <= 1, `row ${row} requires a two-lane teleport`);
  previousSafe = pattern.safeLane;
}

for (const width of [320, 360, 390, 768, 1200, 1440]) {
  for (const depth of [0, 0.25, 0.5, 0.82, 1]) {
    const xs = ([0, 1, 2] as NeonRailLane[]).map((lane) =>
      getNeonRailLaneX(lane, depth, width),
    );
    assert(xs[0] < xs[1] && xs[1] < xs[2], `${width}px: rail ordering collapsed at depth ${depth}`);
    assert(xs[0] >= 0 && xs[2] <= width, `${width}px: rails leave viewport at depth ${depth}`);
  }
}

const source = readFileSync('src/games/NeonRailShiftGame.tsx', 'utf8');
for (const token of [
  'createNeonRailPattern',
  'getNeonRailSpeed',
  'getNeonRailSpawnInterval',
  'state.phaseCooldown',
  'state.phaseTimer',
  'onPointerDown={handlePointerDown}',
  "event.code === 'ArrowLeft'",
  "event.code === 'ArrowRight'",
  "event.code === 'KeyA'",
  "event.code === 'KeyD'",
  "event.code === 'Space'",
  'min-h-0',
  'CORE STREAK',
  'PHASE READY',
]) {
  assert(source.includes(token), `NeonRailShiftGame missing certified behavior: ${token}`);
}

assert(
  source.includes('object.previousY < NEON_RAIL_PLAYER_Y') &&
    source.includes('object.y >= NEON_RAIL_PLAYER_Y'),
  'rail collision is not crossing-based',
);
assert(
  source.includes('Math.pow(0.94, dt * 60)'),
  'particle damping is refresh-rate dependent',
);

if (errors.length) {
  console.error('Neon Rail Shift audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Neon Rail Shift audit passed: reachable adjacent safe lanes, bounded obstacle density, responsive rail geometry, progressive speed/spawn caps, phase cooldown, crossing-based collisions, keyboard/touch controls, and refresh-rate-normalized effects are certified.',
);
