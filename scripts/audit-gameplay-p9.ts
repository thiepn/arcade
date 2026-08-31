import { readFileSync } from 'node:fs';
import {
  STACK_FOCUS_EARN_STREAK,
  STACK_FOCUS_MAX_CHARGES,
  STACK_FOCUS_PERFECT_WINDOW_PX,
  STACK_FOCUS_START_CHARGES,
  STACK_STANDARD_PERFECT_WINDOW_PX,
  canArmStackFocus,
  getStackFocusReward,
  getStackPerfectWindow,
  shouldEarnStackFocus,
} from '../src/lib/stackMastery';
import {
  PULSE_WAGER_EARN_COMBO,
  PULSE_WAGER_MAX_CHARGES,
  PULSE_WAGER_START_CHARGES,
  PULSE_WAGER_WINDOW_PX,
  canArmPulseWager,
  getPulseWagerReward,
  isPulseWagerHit,
  shouldEarnPulseWager,
} from '../src/lib/pulseMastery';
import {
  AIR_HOCKEY_POWER_DEFENSE_GAIN,
  AIR_HOCKEY_POWER_DURATION_SEC,
  AIR_HOCKEY_POWER_GOAL_GAIN,
  AIR_HOCKEY_POWER_IMPULSE_MULTIPLIER,
  AIR_HOCKEY_POWER_MALLET_TRANSFER_MULTIPLIER,
  AIR_HOCKEY_POWER_MAX,
  canTriggerAirHockeyPower,
  getAirHockeyPowerGoalBonus,
  getAirHockeyPowerMeter,
} from '../src/lib/airHockeyMastery';

const read = (path: string) => readFileSync(path, 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

// Stack — Focus must be scarce, optional, and materially tighter without changing overlap survival.
assert(STACK_FOCUS_MAX_CHARGES === 2, 'Stack Focus charge cap changed');
assert(STACK_FOCUS_START_CHARGES === 1, 'Stack should open with one teachable Focus charge');
assert(STACK_FOCUS_EARN_STREAK === 3, 'Stack Focus earning cadence changed');
assert(STACK_STANDARD_PERFECT_WINDOW_PX === 4, 'Stack standard perfect window changed');
assert(STACK_FOCUS_PERFECT_WINDOW_PX === 2, 'Stack Focus window must be a 2px precision wager');
assert(getStackPerfectWindow(false) === 4 && getStackPerfectWindow(true) === 2, 'Stack Focus window selector is incorrect');
assert(canArmStackFocus(1, false, true), 'Stack cannot arm an available Focus charge');
assert(!canArmStackFocus(0, false, true) && !canArmStackFocus(1, true, true), 'Stack Focus can arm in an invalid state');
assert(shouldEarnStackFocus(3) && shouldEarnStackFocus(6) && !shouldEarnStackFocus(4), 'Stack Focus earn cadence is incorrect');
assert(getStackFocusReward(30, 4) > getStackFocusReward(2, 1), 'Stack Focus reward does not scale with altitude/mastery chain');

// Pulse — Sync Wager is a bonus window layered over unchanged base judgement.
assert(PULSE_WAGER_MAX_CHARGES === 2, 'Pulse Sync Wager charge cap changed');
assert(PULSE_WAGER_START_CHARGES === 1, 'Pulse should open with one teachable Sync Wager');
assert(PULSE_WAGER_EARN_COMBO === 4, 'Pulse Sync Wager earn cadence changed');
assert(PULSE_WAGER_WINDOW_PX === 10, 'Pulse Sync Wager bonus window changed');
assert(canArmPulseWager(1, false, true), 'Pulse cannot arm an available Sync Wager');
assert(!canArmPulseWager(0, false, true) && !canArmPulseWager(1, true, true), 'Pulse Wager can arm in an invalid state');
assert(shouldEarnPulseWager(4) && shouldEarnPulseWager(8) && !shouldEarnPulseWager(6), 'Pulse Wager earn cadence is incorrect');
assert(isPulseWagerHit(10) && isPulseWagerHit(-10) && !isPulseWagerHit(10.01), 'Pulse Wager boundary is incorrect');
assert(getPulseWagerReward(12, 4) > getPulseWagerReward(2, 1), 'Pulse Wager reward does not scale with combo/streak');

// Air Hockey — earned power must preserve the P0 velocity ceiling and remain a short tactical window.
assert(AIR_HOCKEY_POWER_MAX === 100, 'Air Hockey Power meter maximum changed');
assert(AIR_HOCKEY_POWER_DEFENSE_GAIN === 34, 'Air Hockey defensive Power gain changed');
assert(AIR_HOCKEY_POWER_GOAL_GAIN === 12, 'Air Hockey goal Power gain changed');
assert(AIR_HOCKEY_POWER_DURATION_SEC >= 3 && AIR_HOCKEY_POWER_DURATION_SEC <= 5, 'Air Hockey Power Play duration escaped a short arcade window');
assert(AIR_HOCKEY_POWER_IMPULSE_MULTIPLIER > 1 && AIR_HOCKEY_POWER_IMPULSE_MULTIPLIER <= 1.3, 'Air Hockey Power impulse multiplier is outside bounded range');
assert(AIR_HOCKEY_POWER_MALLET_TRANSFER_MULTIPLIER > 1 && AIR_HOCKEY_POWER_MALLET_TRANSFER_MULTIPLIER <= 1.5, 'Air Hockey Power mallet transfer is outside bounded range');
assert(getAirHockeyPowerMeter(0, 'DEFENSE') === 34, 'Air Hockey defensive contact meter gain failed');
assert(getAirHockeyPowerMeter(90, 'GOAL') === 100, 'Air Hockey Power meter does not clamp at 100');
assert(canTriggerAirHockeyPower(100, 0, true), 'Air Hockey cannot trigger a ready Power Play');
assert(!canTriggerAirHockeyPower(99, 0, true) && !canTriggerAirHockeyPower(100, 2, true), 'Air Hockey Power Play triggers before ready or while active');
assert(getAirHockeyPowerGoalBonus(500, 4) > getAirHockeyPowerGoalBonus(500, 1), 'Air Hockey power-goal streak does not increase reward');

const stack = read('src/games/StackGame.tsx');
const pulse = read('src/games/PulseGame.tsx');
const puck = read('src/games/AirHockeyGame.tsx');
const registry = read('src/data/games.ts');

for (const token of ['getStackPerfectWindow', 'focusCharges', 'focusArmed', 'focusChain', 'FOCUS ARMED', "e.code === 'KeyF'"]) {
  assert(stack.includes(token), `Stack P9 integration missing ${token}`);
}
assert(stack.includes('FOCUS MISSED — STACK CONTINUES'), 'Stack Focus miss no longer preserves ordinary overlapping placement');
assert(stack.includes('Math.max(0, state.blocks.length - 1) * 10'), 'Stack altitude display still conflates mastery bonus score with physical tower height');

for (const token of ['isPulseWagerHit', 'syncWagerCharges', 'syncWagerArmed', 'syncWagerStreak', 'SYNC WAGER ARMED', "e.code === 'KeyF'"]) {
  assert(pulse.includes(token), `Pulse P9 integration missing ${token}`);
}
assert(pulse.includes('if (absDiff <= 8)') && pulse.includes('else if (absDiff <= 18)') && pulse.includes('else if (absDiff <= 28)'), 'Pulse base PERFECT/GREAT/GOOD judgement windows changed');

for (const token of ['getAirHockeyPowerMeter', 'powerMeter', 'powerPlayTimer', 'powerStreak', 'POWER PLAY ACTIVE', "e.code === 'Space'"]) {
  assert(puck.includes(token), `Air Hockey P9 integration missing ${token}`);
}
assert(puck.includes('incomingDefense = isPlayer && puck.y > centerY && puck.vy > 20'), 'Air Hockey charges Power from non-defensive touches');
assert(puck.includes('capAirHockeyVelocity(puck.vx, puck.vy, maxSpeed)'), 'Air Hockey P0 puck-speed cap is no longer applied after Power Play contacts');

for (const phrase of ['Focus charges', 'Sync Wagers', 'Power Play meter']) {
  assert(registry.includes(phrase), `registry is missing P9 teaching phrase: ${phrase}`);
}

if (errors.length) {
  console.error('P9 NEXT BOTTOM-THREE ELEVATION AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P9 NEXT BOTTOM-THREE ELEVATION AUDIT — PASS');
console.log('Stack Focus wagers, Pulse Sync Wagers, and Air Hockey earned Power Plays are certified.');
