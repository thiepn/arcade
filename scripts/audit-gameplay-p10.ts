import { readFileSync } from 'node:fs';
import {
  DODGE_PHASE_CUT_BASE_SCORE,
  DODGE_PHASE_CUT_MAX_CHAIN,
  DODGE_PHASE_CUT_PADDING_PX,
  DODGE_PHASE_CUT_RECHARGE_MS,
  getDodgePhaseCutRechargeMs,
  getDodgePhaseCutReward,
  isDodgePhaseCut,
} from '../src/lib/dodgeMastery';
import {
  AERO_FLOW_DURATION_SEC,
  AERO_FLOW_EARN_GRAZES,
  AERO_FLOW_MAX_CHARGES,
  AERO_FLOW_SCORE_MULTIPLIER,
  AERO_FLOW_SPEED_MULTIPLIER,
  AERO_FLOW_START_CHARGES,
  canTriggerAeroFlow,
  getAeroFlowScore,
  shouldEarnAeroFlow,
} from '../src/lib/aeroMastery';
import {
  ORB_BURST_EARN_COMBO,
  ORB_BURST_EARN_DROP_COUNT,
  ORB_BURST_MAX_CHARGES,
  ORB_BURST_START_CHARGES,
  canArmOrbBurst,
  canSwapOrbChamber,
  shouldEarnOrbBurst,
} from '../src/lib/orbCannonMastery';

const read = (path: string) => readFileSync(path, 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

// Dodge — dashes remain brief defensive tools, but intentional contact now creates a mastery route.
assert(DODGE_PHASE_CUT_PADDING_PX >= 8 && DODGE_PHASE_CUT_PADDING_PX <= 16, 'Dodge Phase Cut padding escaped a tight contact window');
assert(DODGE_PHASE_CUT_BASE_SCORE >= 150 && DODGE_PHASE_CUT_BASE_SCORE <= 300, 'Dodge Phase Cut base reward is outside bounded range');
assert(DODGE_PHASE_CUT_MAX_CHAIN === 6, 'Dodge Phase Cut chain cap changed');
assert(DODGE_PHASE_CUT_RECHARGE_MS >= 500 && DODGE_PHASE_CUT_RECHARGE_MS <= 800, 'Dodge Phase Cut recharge reward changed');
assert(isDodgePhaseCut(true, 30, 18), 'Dodge cannot cut a close hazard during dash');
assert(!isDodgePhaseCut(false, 20, 18), 'Dodge can Phase Cut while not dashing');
assert(!isDodgePhaseCut(true, 40, 18), 'Dodge Phase Cut contact window is too generous');
assert(getDodgePhaseCutReward(5) > getDodgePhaseCutReward(1), 'Dodge Phase Cut chain does not increase score');
assert(getDodgePhaseCutRechargeMs(5) > getDodgePhaseCutRechargeMs(1), 'Dodge Phase Cut chain does not accelerate recharge');

// Aero — Flow is earned through consecutive grazes and only changes speed/reward, not flap or collision geometry.
assert(AERO_FLOW_MAX_CHARGES === 2, 'Aero Flow charge cap changed');
assert(AERO_FLOW_START_CHARGES === 1, 'Aero should begin with one teachable Flow charge');
assert(AERO_FLOW_EARN_GRAZES === 3, 'Aero Flow earning cadence changed');
assert(AERO_FLOW_DURATION_SEC === 4, 'Aero Flow duration changed');
assert(AERO_FLOW_SPEED_MULTIPLIER > 1 && AERO_FLOW_SPEED_MULTIPLIER <= 1.2, 'Aero Flow speed risk is outside bounded range');
assert(AERO_FLOW_SCORE_MULTIPLIER === 2, 'Aero Flow reward multiplier changed');
assert(canTriggerAeroFlow(1, 0, true), 'Aero cannot trigger an available Flow charge');
assert(!canTriggerAeroFlow(0, 0, true) && !canTriggerAeroFlow(1, 1, true), 'Aero Flow triggers in an invalid state');
assert(shouldEarnAeroFlow(3) && shouldEarnAeroFlow(6) && !shouldEarnAeroFlow(4), 'Aero Flow graze cadence is incorrect');
assert(getAeroFlowScore(100, true) === 200 && getAeroFlowScore(100, false) === 100, 'Aero Flow reward multiplier is incorrect');

// Orb Cannon — random bomb delivery is replaced by earned Burst agency and one tactical chamber swap per shot.
assert(ORB_BURST_MAX_CHARGES === 2, 'Orb Cannon Burst charge cap changed');
assert(ORB_BURST_START_CHARGES === 1, 'Orb Cannon should start with one teachable Burst charge');
assert(ORB_BURST_EARN_COMBO === 4, 'Orb Cannon Burst combo cadence changed');
assert(ORB_BURST_EARN_DROP_COUNT === 4, 'Orb Cannon Burst cascade threshold changed');
assert(canArmOrbBurst(1, false, false), 'Orb Cannon cannot arm an available Burst');
assert(!canArmOrbBurst(0, false, false) && !canArmOrbBurst(1, true, false) && !canArmOrbBurst(1, false, true), 'Orb Cannon Burst arms in an invalid state');
assert(canSwapOrbChamber(false, false), 'Orb Cannon cannot swap a ready chamber');
assert(!canSwapOrbChamber(true, false) && !canSwapOrbChamber(false, true), 'Orb Cannon chamber swap ignores one-swap/flight constraints');
assert(shouldEarnOrbBurst(4, 0) && shouldEarnOrbBurst(1, 4) && !shouldEarnOrbBurst(3, 3), 'Orb Cannon Burst earning rules are incorrect');

const dodge = read('src/games/DodgeGame.tsx');
const aero = read('src/games/FlappyAeroGame.tsx');
const orb = read('src/games/BubbleBusterGame.tsx');
const registry = read('src/data/games.ts');

for (const token of ['isDodgePhaseCut', 'phaseCutChain', 'dashCutCount', 'PHASE CUT', 'getDodgePhaseCutRechargeMs']) {
  assert(dodge.includes(token), `Dodge P10 integration missing ${token}`);
}
assert(dodge.includes('state.dashTimer = 260'), 'Dodge P10 changed the certified 260ms dash duration');
assert(dodge.includes('state.phaseCutChain = 0'), 'Dodge Phase Cut chain has no reset path');

for (const token of ['canTriggerAeroFlow', 'flowCharges', 'flowTimer', 'FLOW BOOST', 'getAeroFlowScore', "e.code === 'KeyF'"]) {
  assert(aero.includes(token), `Aero P10 integration missing ${token}`);
}
assert(aero.includes('const gravity = 820') && aero.includes('state.vy = -320'), 'Aero Flow changed certified flap physics');
assert(aero.includes('state.grazeCombo = 0'), 'Aero graze chain no longer requires consecutive grazes');

for (const token of ['canArmOrbBurst', 'burstCharges', 'burstArmed', 'hasSwappedThisTurn', 'swapChamber', 'BURST ARMED', 'SWAP']) {
  assert(orb.includes(token), `Orb Cannon P10 integration missing ${token}`);
}
assert(!orb.includes('Math.random() < 0.08'), 'Orb Cannon still grants random bomb shots');
assert(orb.includes('isBomb: state.burstArmed'), 'Orb Cannon Burst does not deterministically control bomb shots');
assert(orb.includes('shouldEarnOrbBurst(state.combo, dropCount)'), 'Orb Cannon Burst is not earned from authored combo/cascade rules');

for (const phrase of ['Phase Cut', 'Flow Boost', 'Burst charges']) {
  assert(registry.includes(phrase), `registry is missing P10 teaching phrase: ${phrase}`);
}

if (errors.length) {
  console.error('P10 CURRENT BOTTOM-THREE ELEVATION AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P10 CURRENT BOTTOM-THREE ELEVATION AUDIT — PASS');
console.log('Dodge Phase Cuts, Aero Flow Boost, and Orb Cannon earned Burst/swap agency are certified.');
