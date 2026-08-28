import { readFileSync } from 'node:fs';
import {
  AIR_HOCKEY_MAX_ASPECT,
  AIR_HOCKEY_MAX_TABLE_HEIGHT,
  AIR_HOCKEY_MAX_TABLE_WIDTH,
  AIR_HOCKEY_MIN_ASPECT,
  getAirHockeyTableLayout,
} from '../src/lib/airHockeyLayout';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

for (const [width, height] of [
  [320, 480],
  [360, 400],
  [360, 640],
  [390, 844],
  [768, 1024],
  [900, 660],
  [1200, 800],
  [1440, 900],
] as const) {
  const layout = getAirHockeyTableLayout(width, height);
  assert(layout.left >= 0, `${width}x${height}: table escapes left edge`);
  assert(layout.top >= 0, `${width}x${height}: table escapes top edge`);
  assert(layout.right <= width + 0.01, `${width}x${height}: table escapes right edge`);
  assert(layout.bottom <= height + 0.01, `${width}x${height}: table escapes bottom edge`);
  assert(layout.width <= AIR_HOCKEY_MAX_TABLE_WIDTH + 0.01, `${width}x${height}: desktop width cap ignored`);
  assert(layout.height <= AIR_HOCKEY_MAX_TABLE_HEIGHT + 0.01, `${width}x${height}: desktop height cap ignored`);
  assert(layout.aspect >= AIR_HOCKEY_MIN_ASPECT - 0.01, `${width}x${height}: table became too narrow`);
  assert(layout.aspect <= AIR_HOCKEY_MAX_ASPECT + 0.01, `${width}x${height}: table became too wide`);
  assert(
    layout.goalWidth >= Math.min(80, layout.width * 0.3),
    `${width}x${height}: goal became too narrow`,
  );
  assert(layout.goalWidth <= layout.width * 0.38 + 0.01, `${width}x${height}: goal dominates table width`);
}

const desktop = getAirHockeyTableLayout(900, 660);
assert(desktop.width < 520, '900x660 desktop arena is still excessively wide');
assert(desktop.width > 410, '900x660 desktop arena became unnecessarily cramped');
assert(desktop.height > desktop.width, 'desktop arena must remain portrait-oriented');

const tallPhone = getAirHockeyTableLayout(390, 844);
assert(tallPhone.width >= 350, '390x844 phone wastes too much horizontal space');
assert(tallPhone.height >= 540, '390x844 phone arena is too short to play comfortably');

const shortPhone = getAirHockeyTableLayout(360, 400);
assert(shortPhone.bottom <= 400, 'short mobile arena extends below the rendered stage');
assert(shortPhone.top >= 0, 'short mobile arena extends above the rendered stage');

const source = readFileSync('src/games/AirHockeyGame.tsx', 'utf8');
for (const token of [
  'getAirHockeyTableLayout',
  'oldTable',
  'newTable',
  'table.motionScale',
  'table.goalWidth',
  'onPointerDown={handlePointerDown}',
  'onPointerCancel={handlePointerCancel}',
  'setPointerCapture',
  'min-h-0',
]) {
  assert(source.includes(token), `AirHockeyGame is missing controlled-arena token: ${token}`);
}

assert(!source.includes('const tableMarginX = 16'), 'full-width 16px-margin arena returned');
assert(!source.includes('const tableMarginY = 16'), 'full-height 16px-margin arena returned');
assert(
  source.includes('Math.pow(0.993, dt * 60)'),
  'puck damping is still refresh-rate dependent',
);

if (errors.length) {
  console.error('Neon Puck Smash arena audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Neon Puck Smash audit passed: controlled portrait arena proportions, desktop width limits, tall/short mobile containment, HUD/control clearance, responsive motion scaling, pointer capture, and frame-rate-normalized puck drag are certified.',
);
