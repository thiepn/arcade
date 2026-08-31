import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LASER_ROPE_REDLINE_DURATION_SEC,
  LASER_ROPE_REDLINE_EARN_EVERY,
  LASER_ROPE_REDLINE_MAX_CHARGES,
  LASER_ROPE_REDLINE_SCORE_MULTIPLIER,
  LASER_ROPE_REDLINE_SPEED_MULTIPLIER,
  canActivateLaserRopeRedline,
  getLaserRopeRedlineCharges,
  getLaserRopeRedlineReward,
  getLaserRopeRedlineSpeed,
} from '../src/lib/laserRopeRedline';
import {
  TOWER_APEX_BOUNCE_MULTIPLIER,
  TOWER_APEX_DURATION_SEC,
  TOWER_APEX_EARN_EVERY,
  TOWER_APEX_MAX_CHARGES,
  TOWER_APEX_SCORE_MULTIPLIER,
  canActivateTowerApexDrive,
  getTowerApexBounceVelocity,
  getTowerApexCharges,
  getTowerApexReward,
  getTowerPrecisionBonus,
  isTowerPrecisionLanding,
} from '../src/lib/towerApexMastery';
import {
  CHAIN_RESONANCE_ORDERS,
  advanceChainResonance,
  getChainResonanceBonus,
  getChainResonanceOrder,
  isChainResonanceComplete,
} from '../src/lib/chainResonanceMastery';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const rope = read('src/games/LaserRopeGame.tsx');
const tower = read('src/games/TowerGame.tsx');
const chain = read('src/games/ChainGame.tsx');
const registry = read('src/data/games.ts');

// Laser Rope: earned voluntary speed wager without replacing certified evasion geometry.
assert(LASER_ROPE_REDLINE_EARN_EVERY === 5, 'Laser Rope Redline earn cadence changed');
assert(LASER_ROPE_REDLINE_MAX_CHARGES === 2, 'Laser Rope Redline charge cap changed');
assert(LASER_ROPE_REDLINE_DURATION_SEC === 4, 'Laser Rope Redline duration changed');
assert(LASER_ROPE_REDLINE_SPEED_MULTIPLIER === 1.22, 'Laser Rope Redline speed multiplier changed');
assert(LASER_ROPE_REDLINE_SCORE_MULTIPLIER === 2, 'Laser Rope Redline score multiplier changed');
assert(canActivateLaserRopeRedline(1, false, true), 'Laser Rope should allow an earned Redline activation');
assert(!canActivateLaserRopeRedline(0, false, true) && !canActivateLaserRopeRedline(1, true, true), 'Laser Rope Redline activation guard is too permissive');
assert(getLaserRopeRedlineCharges(5, 0) === 1 && getLaserRopeRedlineCharges(10, 2) === 2, 'Laser Rope Redline charge earning/cap is wrong');
assert(Math.abs(getLaserRopeRedlineSpeed(4, true) - 4.88) < 1e-9, 'Laser Rope Redline speed scaling is wrong');
assert(getLaserRopeRedlineReward(150, 2, 2, true) === 1200, 'Laser Rope Redline reward scaling is wrong');
assert(rope.includes("e.code === 'KeyF'"), 'Laser Rope Redline keyboard activation is missing');
assert(rope.includes('getLaserRopeRedlineCharges(state.jumpStreak, state.redlineCharges)'), 'Laser Rope does not earn Redline from sustained clean evasions');
assert(rope.includes('getLaserRopeRedlineSpeed(effectiveSpeed, true) - effectiveSpeed'), 'Laser Rope does not increase sweep speed during Redline');
assert(rope.includes('getLaserRopeRedlineReward'), 'Laser Rope does not apply Redline reward scaling');
assert(rope.includes('state.sweepAngle += effectiveSpeed * state.direction * dt;'), 'Laser Rope certified baseline sweep update was replaced');
assert(rope.includes('Activate Redline'), 'Laser Rope lacks a touch-accessible Redline control');

// Gravity Tower: precision-center mastery earns an optional higher-bounce ascent window.
assert(TOWER_APEX_EARN_EVERY === 3, 'Tower Apex charge cadence changed');
assert(TOWER_APEX_MAX_CHARGES === 2, 'Tower Apex charge cap changed');
assert(TOWER_APEX_DURATION_SEC === 4.5, 'Tower Apex duration changed');
assert(TOWER_APEX_BOUNCE_MULTIPLIER === 1.18, 'Tower Apex bounce multiplier changed');
assert(TOWER_APEX_SCORE_MULTIPLIER === 2, 'Tower Apex score multiplier changed');
assert(isTowerPrecisionLanding(50, 0, 100), 'Tower should accept a platform-center landing');
assert(!isTowerPrecisionLanding(5, 0, 100), 'Tower precision landing window is too wide');
assert(getTowerApexCharges(3, 0) === 1 && getTowerApexCharges(6, 2) === 2, 'Tower Apex charge earning/cap is wrong');
assert(canActivateTowerApexDrive(1, false, true), 'Tower should allow an earned Apex activation');
assert(!canActivateTowerApexDrive(0, false, true) && !canActivateTowerApexDrive(1, true, true), 'Tower Apex activation guard is too permissive');
assert(Math.abs(getTowerApexBounceVelocity(10, true) - 11.8) < 1e-9, 'Tower Apex bounce scaling is wrong');
assert(getTowerApexReward(200, true) === 400, 'Tower Apex reward scaling is wrong');
assert(getTowerPrecisionBonus(1) === 150 && getTowerPrecisionBonus(99) === 750, 'Tower precision bonus cap changed');
assert(tower.includes('isTowerPrecisionLanding(state.px, plat.x, plat.w)'), 'Tower does not evaluate precision center landings');
assert(tower.includes('getTowerApexCharges(state.apexPrecisionStreak, state.apexCharges)'), 'Tower precision streak does not earn Apex charges');
assert(tower.includes('getTowerApexBounceVelocity(23, state.apexActive)'), 'Tower spring bounce does not respect Apex Drive');
assert(tower.includes('getTowerApexReward(deltaAlt * 2, state.apexActive)'), 'Tower ascent score does not respect Apex Drive');
assert(tower.includes("e.code === 'KeyF'"), 'Tower Apex keyboard activation is missing');
assert(tower.includes('Activate Apex Drive'), 'Tower lacks a touch-accessible Apex control');
assert(tower.includes('const dt = TOWER_FIXED_STEP_SEC'), 'Tower P12 broke the fixed-step simulation contract');

// Chain: optional ordered use of all three existing tools, with the base three-charge economy preserved.
assert(CHAIN_RESONANCE_ORDERS.length === 3, 'Chain must expose three rotating Resonance Orders');
for (const order of CHAIN_RESONANCE_ORDERS) {
  assert(order.order.length === 3, `${order.name} must contain three tools`);
  assert(new Set(order.order).size === 3, `${order.name} must use Plasma, Tesla and Cryo exactly once`);
}
assert(getChainResonanceOrder(1).name === 'BREACH ARC' && getChainResonanceOrder(4).name === 'BREACH ARC', 'Chain Resonance rotation is not deterministic');
let progress = { step: 0, failed: false };
for (const tool of getChainResonanceOrder(1).order) progress = advanceChainResonance(1, progress, tool);
assert(isChainResonanceComplete(progress), 'Chain correct Resonance order does not complete');
const failed = advanceChainResonance(1, { step: 0, failed: false }, 'plasma');
assert(failed.failed && !isChainResonanceComplete(failed), 'Chain wrong first tool should break the optional Resonance order');
assert(getChainResonanceBonus(1) === 900 && getChainResonanceBonus(5) === 4500 && getChainResonanceBonus(99) === 4500, 'Chain Resonance bonus/cap changed');
assert(chain.includes('advanceChainResonance'), 'Chain does not track Resonance tool order');
assert(chain.includes('isChainResonanceComplete'), 'Chain does not validate Resonance completion at wave clear');
assert(chain.includes('state.chargesLeft = 3;'), 'Chain P12 changed the base three-charge wave economy');
assert(chain.includes('RESONANCE {resonanceOrder.name}'), 'Chain does not surface the current Resonance Order');
assert(chain.includes('PLASMA — BREAK SHIELDS / NULLIFIERS'), 'Chain P12 lost Plasma purpose teaching');
assert(chain.includes('TESLA — BRIDGE DISTANT ORBS'), 'Chain P12 lost Tesla purpose teaching');
assert(chain.includes('CRYO — PULL ORBS INTO A CLUSTER'), 'Chain P12 lost Cryo purpose teaching');

assert(registry.includes('Redline charges'), 'Laser Rope registry copy does not teach Redline mastery');
assert(registry.includes('Apex Drive charges'), 'Tower registry copy does not teach Apex Drive mastery');
assert(registry.includes('rotating Resonance Orders'), 'Chain registry copy does not teach Resonance mastery');
assert(registry.includes('spend three charges'), 'Chain registry copy no longer preserves the three-charge tactical loop');

if (errors.length) {
  console.error('P12 NEXT MASTERY TRIO AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P12 NEXT MASTERY TRIO AUDIT — PASS');
console.log('Laser Rope Redline, Gravity Tower Apex Drive, and Chain Resonance Orders are bounded, optional, player-readable, and preserve prior gameplay contracts.');
