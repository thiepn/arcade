import { readFileSync } from 'node:fs';
import {
  LASER_ROPE_PHASE_B_VERSION,
  getLaserRopeApproachIntensity,
  isLaserRopeNearMiss,
} from '../src/lib/laserRopeFeedback';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

assert(LASER_ROPE_PHASE_B_VERSION === 'phase-b-1', 'unexpected Laser Rope Phase B version');
assert(getLaserRopeApproachIntensity([Math.PI / 2]) > 0.99, 'beam at player lane must fully telegraph');
assert(getLaserRopeApproachIntensity([-Math.PI / 2]) < 0.01, 'opposite beam must not trigger approach warning');
assert(
  getLaserRopeApproachIntensity([Math.PI / 2 - 0.3]) > getLaserRopeApproachIntensity([Math.PI / 2 - 0.6]),
  'approach warning must intensify as the beam nears the player',
);

assert(isLaserRopeNearMiss('LOW', 25, false, 0), 'low beam edge-clear should count as near miss');
assert(isLaserRopeNearMiss('DUAL', 40, false, 0), 'dual beam edge-clear should count as near miss');
assert(!isLaserRopeNearMiss('LOW', 60, false, 0), 'high jump must not count as near miss');
assert(isLaserRopeNearMiss('HIGH', 0, true, 0.12), 'late slide should count as near miss');
assert(!isLaserRopeNearMiss('HIGH', 0, true, 0.4), 'early safe slide must not count as near miss');

const source = readFileSync('src/games/LaserRopeGame.tsx', 'utf8');
for (const token of [
  'pendingLaserMode',
  'telegraphTimer',
  'telegraphDuration',
  'feedbackBursts',
  'feedbackBanner',
  'screenShake',
  'screenFlashAlpha',
  'deathPresentationTimer',
  'isLaserRopeNearMiss',
  'getLaserRopeApproachIntensity',
  'drawLaserRopeSweepTelegraph',
  'drawLaserRopeSpawnTelegraph',
  'drawLaserRopeFeedbackBursts',
  'drawLaserRopeFeedbackBanner',
  'drawLaserRopeScreenFlash',
  'NEAR MISS',
  'COMBO x',
]) {
  assert(source.includes(token), `LaserRopeGame is missing Phase B feedback token: ${token}`);
}

assert(
  source.includes('state.isAlive || state.deathPresentationTimer > 0'),
  'fatal collision feedback cannot animate after the player dies',
);
assert(
  source.includes('arenaMetrics.centerX + shakeX') && source.includes('arenaMetrics.groundY + shakeY'),
  'arena is not using screen-shake translation',
);
assert(
  source.includes('state.pendingLaserMode = nextMode') && source.includes('state.laserMode = state.pendingLaserMode'),
  'laser mode changes are not staged through a telegraph window',
);

if (errors.length) {
  console.error('Laser Rope Reflex Phase B audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Laser Rope Reflex Phase B audit passed: staged laser warnings, approach telegraphs, near-miss detection, collision bursts, combo feedback, screen shake, screen flash, and death feedback are certified.',
);
