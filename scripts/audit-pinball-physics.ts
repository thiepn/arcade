import { readFileSync } from 'node:fs';
import {
  PINBALL_FIXED_STEP,
  PINBALL_MAX_BALL_SPEED,
  PINBALL_MAX_SUBSTEPS,
  capPinballSpeed,
  consumePinballKickback,
  getPinballGravity,
  getPinballLayout,
  resolveCircleAabb,
  resolveCircleCircle,
  resolveCircleSegment,
  resolvePinballDrain,
} from '../src/lib/pinballPhysics';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

assert(Math.abs(PINBALL_FIXED_STEP - 1 / 120) < 1e-12, 'physics must run at 120 Hz');
assert(PINBALL_MAX_SUBSTEPS >= 4 && PINBALL_MAX_SUBSTEPS <= 8, 'substep cap must remain bounded');

for (const [width, height] of [
  [360, 640],
  [900, 700],
  [1440, 900],
] as const) {
  const layout = getPinballLayout(width, height);
  const ballRadius = Math.min(11, Math.max(8.5, Math.min(width, height) * 0.016));
  const clearCenterOpening = layout.centerGapHalf * 2 - layout.flipperRadius * 2;

  assert(
    clearCenterOpening > ballRadius * 2 + 4,
    `${width}x${height}: center drain is too narrow to lose a ball`,
  );
  assert(
    layout.drainY > layout.flipperY + ballRadius * 4,
    `${width}x${height}: drain line is too close to the flippers`,
  );
  assert(layout.kickbackHeight > 0, `${width}x${height}: kickback lane has invalid height`);

  let y = layout.flipperY + ballRadius * 2;
  let vy = 0;
  let drained = false;
  for (let step = 0; step < 240; step++) {
    vy += getPinballGravity(height) * PINBALL_FIXED_STEP;
    y += vy * PINBALL_FIXED_STEP;
    if (y - ballRadius > layout.drainY) {
      drained = true;
      break;
    }
  }
  assert(drained, `${width}x${height}: an unobstructed center ball never reaches the drain`);
}

const firstKickback = consumePinballKickback(true);
const repeatedKickback = consumePinballKickback(firstKickback.active);
assert(firstKickback.triggered && !firstKickback.active, 'first kickback must consume its charge');
assert(!repeatedKickback.triggered, 'consumed kickback must not trigger repeatedly');

const multiballDrain = resolvePinballDrain({
  ballsRemaining: 1,
  lives: 3,
  ballSaverSeconds: 0,
  ballSaverAvailable: false,
});
assert(multiballDrain.action === 'continue', 'losing one multiball must not cost a life');

const savedDrain = resolvePinballDrain({
  ballsRemaining: 0,
  lives: 3,
  ballSaverSeconds: 3,
  ballSaverAvailable: true,
});
assert(savedDrain.action === 'ball-save', 'active timed saver must return the last ball');
assert(savedDrain.lives === 3, 'ball saver must not reduce lives');
assert(!savedDrain.ballSaverAvailable, 'ball saver must be consumed after one use');

const ordinaryDrain = resolvePinballDrain({
  ballsRemaining: 0,
  lives: 3,
  ballSaverSeconds: 0,
  ballSaverAvailable: false,
});
assert(ordinaryDrain.action === 'new-life', 'ordinary final-ball drain must queue the next life');
assert(ordinaryDrain.lives === 2, 'ordinary drain must remove exactly one life');

const finalDrain = resolvePinballDrain({
  ballsRemaining: 0,
  lives: 1,
  ballSaverSeconds: 0,
  ballSaverAvailable: false,
});
assert(finalDrain.action === 'game-over', 'third lost ball must end the game');
assert(finalDrain.lives === 0, 'game over must leave zero lives');

const circleBody = { x: 4, y: 0, vx: -500, vy: 0, radius: 6 };
const circleHit = resolveCircleCircle(circleBody, 0, 0, 8, 0.85);
assert(Boolean(circleHit), 'overlapping bumper collision was not detected');
assert(
  Math.hypot(circleBody.x, circleBody.y) >= 14,
  'bumper collision did not separate the ball from the bumper',
);

const segmentBody = { x: 10, y: 2, vx: 0, vy: 300, radius: 5 };
const segmentHit = resolveCircleSegment(segmentBody, 0, 0, 20, 0, 3, 0.85);
assert(Boolean(segmentHit), 'flipper/rail capsule collision was not detected');
assert(Math.abs(segmentBody.y) >= 8, 'segment collision did not move the ball outside the capsule');

const targetBody = { x: 0, y: 0, vx: 0, vy: 220, radius: 5 };
const targetHit = resolveCircleAabb(targetBody, -10, -4, 20, 8, 0.8);
assert(Boolean(targetHit), 'ball inside a drop target was not resolved');
assert(targetBody.y <= -9 || targetBody.y >= 9, 'AABB collision left the ball inside the target');

const fastBody = { vx: 5000, vy: -5000 };
capPinballSpeed(fastBody);
assert(
  Math.hypot(fastBody.vx, fastBody.vy) <= PINBALL_MAX_BALL_SPEED + 0.001,
  'speed cap failed',
);

const source = readFileSync('src/games/PinballGame.tsx', 'utf8');
for (const required of [
  'PINBALL_FIXED_STEP',
  'physicsAccumulator',
  'cooldowns: Record<string, number>',
  'consumePinballKickback',
  'resolvePinballDrain',
  'ballSaverAvailable',
  'gameOverReported',
  "state.phase = 'game-over'",
  'return !state.gameOverReported',
]) {
  assert(source.includes(required), `PinballGame is missing required lifecycle token: ${required}`);
}
assert(!source.includes('centerPeg'), 'permanent center save peg must not return');
assert(!source.includes('setSafeTimeout'), 'life and game-over flow must not depend on uncancelled timeouts');
assert(
  source.includes("state.kickbackLeftActive = result.active") &&
    source.includes("state.kickbackRightActive = result.active"),
  'outlane kickbacks are not explicitly consumed',
);

if (errors.length) {
  console.error('Neon Pinball audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Neon Pinball audit passed: fixed-step collisions, open drains, finite kickbacks, one-shot ball saver, three lives, multiball drains, and one-shot game over are certified.',
);
