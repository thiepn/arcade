import { readFileSync } from 'node:fs';
import {
  LASER_ROPE_PHASE_A_VERSION,
  getLaserRopeArenaMetrics,
  getLaserRopeBeamColor,
} from '../src/lib/laserRopePresentation';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

assert(LASER_ROPE_PHASE_A_VERSION === 'phase-a-1', 'unexpected Laser Rope presentation version');
assert(getLaserRopeBeamColor('LOW', false) === '#EF4444', 'low beam color changed');
assert(getLaserRopeBeamColor('HIGH', false) === '#A855F7', 'high beam color changed');
assert(getLaserRopeBeamColor('DUAL', false) === '#F43F5E', 'dual beam color changed');
assert(getLaserRopeBeamColor('LOW', true) === '#FACC15', 'fever beam color changed');

for (const [width, height] of [
  [320, 480],
  [360, 640],
  [390, 844],
  [430, 932],
  [768, 1024],
  [900, 660],
  [1440, 900],
] as const) {
  const arena = getLaserRopeArenaMetrics(width, height);
  assert(arena.radiusX >= 100, `${width}x${height}: arena became too small`);
  assert(arena.radiusY >= 40, `${width}x${height}: arena became too flat`);
  assert(
    arena.frameHalfWidth <= width / 2,
    `${width}x${height}: arena frame overflows horizontally`,
  );
  assert(
    arena.centerX - arena.frameHalfWidth >= 0 &&
      arena.centerX + arena.frameHalfWidth <= width,
    `${width}x${height}: arena frame is not centered inside the viewport`,
  );
  assert(
    arena.groundY + arena.frameBottom <= height,
    `${width}x${height}: arena frame overflows below the viewport`,
  );
  assert(
    arena.groundY + arena.frameTop >= 0,
    `${width}x${height}: arena frame overflows above the viewport`,
  );
  assert(
    arena.beamRadius <= arena.radiusX,
    `${width}x${height}: beam emitters escape the arena`,
  );
}

const source = readFileSync('src/games/LaserRopeGame.tsx', 'utf8');
const hud = readFileSync('src/components/LaserRopeHud.tsx', 'utf8');

for (const token of [
  'getLaserRopeArenaMetrics',
  'drawLaserRopeBackground',
  'drawLaserRopeArenaFrame',
  'drawLaserRopeBeam',
  'drawLaserRopeHub',
  'drawLaserRopePlayerNode',
  'drawLaserRopeOrb',
  'getLaserRopeBeamColor',
  'LaserRopeHud',
  '<LaserRopeHud state={hudState} />',
]) {
  assert(source.includes(token), `LaserRopeGame is missing Phase A presentation token: ${token}`);
}

for (const token of [
  'LASER MODE',
  'FEVER',
  'state.score',
  'state.jumpStreak',
  'state.rpm',
  'state.laserMode',
  'state.isFeverActive',
]) {
  assert(hud.includes(token), `LaserRopeHud is missing Phase A HUD token: ${token}`);
}

assert(!source.includes('const beamRadius = 155'), 'fixed prototype beam radius returned');
assert(
  !source.includes('ctx.ellipse(0, 0, 165, 58'),
  'fixed prototype arena oval returned',
);
assert(
  !source.includes('ctx.fillRect(-10, -16, 20, 24)'),
  'prototype rectangular standing avatar returned',
);
assert(
  !source.includes('ctx.fillRect(-18, -6, 36, 12)'),
  'prototype rectangular sliding avatar returned',
);
assert(
  source.includes('min-h-0') && source.includes('touch-none'),
  'Laser Rope mobile-safe layout was not preserved',
);

if (errors.length) {
  console.error('Laser Rope Reflex Phase A audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Laser Rope Reflex Phase A audit passed: responsive arena framing, layered background, multi-layer laser beams, energy-node player rendering, collectible glow, and upgraded HUD are certified.',
);
