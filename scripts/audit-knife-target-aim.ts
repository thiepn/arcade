import { readFileSync } from 'node:fs';
import {
  getKnifeFlightPoint,
  getKnifeLocalImpactAngle,
  getKnifePointerAimAngle,
  getKnifePolarPoint,
  getKnifeWorldAngle,
  isKnifeAngleWithinArc,
  normalizeKnifeAngle,
  shortestKnifeAngleDistance,
  type KnifePoint,
} from '../src/lib/knifeTargetAim';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};
const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

const coreX = 200;
const coreY = 180;
const fallback = Math.PI / 2;

assert(approx(getKnifePointerAimAngle(300, 180, coreX, coreY), 0), 'right-side pointer aim should be angle 0');
assert(approx(getKnifePointerAimAngle(200, 280, coreX, coreY), Math.PI / 2), 'bottom pointer aim should be pi/2');
assert(approx(getKnifePointerAimAngle(100, 180, coreX, coreY), Math.PI), 'left-side pointer aim should be pi');
assert(approx(getKnifePointerAimAngle(200, 80, coreX, coreY), Math.PI * 1.5), 'top pointer aim should normalize to 3pi/2');
assert(approx(getKnifePointerAimAngle(200, 180, coreX, coreY, fallback), fallback), 'near-center pointer aim should preserve fallback');

for (const world of [0, 0.4, Math.PI / 2, Math.PI, Math.PI * 1.8]) {
  for (const core of [-2.2, -0.5, 0, 0.7, 2.9]) {
    const local = getKnifeLocalImpactAngle(world, core);
    const roundTrip = getKnifeWorldAngle(local, core);
    assert(shortestKnifeAngleDistance(roundTrip, normalizeKnifeAngle(world)) < 1e-9, `world/local angle round-trip failed for ${world}/${core}`);
  }
}

const point = getKnifePolarPoint(100, 100, 50, Math.PI / 2);
assert(approx(point.x, 100) && approx(point.y, 150), 'polar impact point is not where the player aimed');

const start: KnifePoint = { x: 100, y: 500 };
const end: KnifePoint = { x: 150, y: 200 };
const halfway = getKnifeFlightPoint(start, end, 0.5);
assert(approx(halfway.x, 125) && approx(halfway.y, 350), 'flight interpolation does not follow the captured aim line');
assert(getKnifeFlightPoint(start, end, -1).y === start.y, 'flight progress should clamp at start');
assert(getKnifeFlightPoint(start, end, 2).y === end.y, 'flight progress should clamp at impact');

assert(isKnifeAngleWithinArc(0.2, 0, 0.8), 'shield arc should include an angle inside its span');
assert(!isKnifeAngleWithinArc(1.1, 0, 0.8), 'shield arc should reject an angle outside its span');
assert(isKnifeAngleWithinArc(0.1, Math.PI * 1.9, 0.8), 'shield arc wraparound should be handled');

const source = readFileSync('src/games/KnifeTargetGame.tsx', 'utf8');
for (const token of [
  'aimWorldAngle',
  'flyingAimWorldAngle',
  'flyingBladeProgress',
  'updateAimFromPointer',
  'handlePointerMove',
  'handlePointerDown',
  'getKnifePointerAimAngle',
  'getKnifeLocalImpactAngle',
  'getKnifeFlightPoint',
  'shortestKnifeAngleDistance',
  'isKnifeAngleWithinArc',
  'cursor-crosshair',
  'Aim around the core',
  'ctx.rotate(blade.angle - Math.PI / 2)',
  'ctx.rotate(apple.angle - Math.PI / 2)',
]) {
  assert(source.includes(token), `KnifeTargetGame is missing deterministic-aim token: ${token}`);
}

assert(!source.includes('const hitAngle = Math.PI / 2 - state.coreAngle'), 'old fixed bottom/random-feeling impact formula returned');
assert(!source.includes('flyingBladeY'), 'old vertical-only projectile state returned');
assert(source.includes('state.flyingAimWorldAngle = normalizeKnifeAngle'), 'throw does not capture aim at release');
assert(source.includes('state.embeddedBlades.push({ angle: hitAngle })'), 'successful knife does not embed at calculated impact angle');

if (errors.length) {
  console.error('Knife Target aiming audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Knife Target aiming audit passed: pointer/world aiming, captured straight-line flight, rotating-core local conversion, shield/blade collision angles, and embedded rendering all share one deterministic coordinate system.');
