import { readFileSync } from 'node:fs';
import {
  BREAKOUT_CONTRACTS,
  advanceBreakoutContractProgress,
  getBreakoutContract,
  getBreakoutContractReward,
  isBreakoutContractComplete,
} from '../src/lib/breakoutMastery';
import {
  SLINGSHOT_MISSIONS,
  advanceSlingshotMissionProgress,
  getSlingshotMission,
  getSlingshotMissionReward,
  isSlingshotMissionComplete,
} from '../src/lib/slingshotMastery';
import {
  ONE_LINE_MASTERY_GOALS,
  getOneLineInkRemainingPercent,
  getOneLineMasteryGoal,
  getOneLineMasteryReward,
  isOneLineMasteryClear,
} from '../src/lib/oneLineMastery';

const read = (path: string) => readFileSync(path, 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

// Breakout — four rotating contracts must represent distinct existing play skills.
assert(BREAKOUT_CONTRACTS.length === 4, 'Breakout must expose four rotating contracts');
assert(new Set(BREAKOUT_CONTRACTS.map((contract) => contract.kind)).size === 4, 'Breakout contract kinds are not unique');
assert(BREAKOUT_CONTRACTS.every((contract) => contract.target >= 2 && contract.target <= 6), 'Breakout contract target escaped arcade-readable bounds');
assert(getBreakoutContract(1).kind === 'COMBO_DRIVE', 'Breakout opening contract should teach combo control');
assert(getBreakoutContract(5).kind === 'COMBO_DRIVE', 'Breakout contract cycle no longer repeats every four rounds');
const comboContract = getBreakoutContract(1);
assert(advanceBreakoutContractProgress(comboContract, 0, 'COMBO', 5) === 5, 'Breakout combo contract does not track peak combo');
assert(advanceBreakoutContractProgress(comboContract, 5, 'COMBO', 3) === 5, 'Breakout combo contract regresses when combo falls');
assert(isBreakoutContractComplete(comboContract, 6), 'Breakout combo target cannot complete');
assert(getBreakoutContractReward(4, 3) > getBreakoutContractReward(1, 1), 'Breakout contract rewards do not scale with round/streak mastery');

// Slingshot — each mission must map to a guaranteed skill opportunity in every sector.
assert(SLINGSHOT_MISSIONS.length === 4, 'Slingshot must expose four navigation missions');
assert(new Set(SLINGSHOT_MISSIONS.map((mission) => mission.kind)).size === 4, 'Slingshot mission kinds are not unique');
assert(SLINGSHOT_MISSIONS.every((mission) => mission.target >= 3 && mission.target <= 6), 'Slingshot mission target escaped bounded range');
assert(getSlingshotMission(1).kind === 'LOCK_CHAIN', 'Slingshot opening mission should teach lock-on timing');
assert(getSlingshotMission(5).kind === 'LOCK_CHAIN', 'Slingshot mission cycle no longer repeats every four sectors');
const lockMission = getSlingshotMission(1);
let lockProgress = 0;
for (let i = 0; i < 3; i++) lockProgress = advanceSlingshotMissionProgress(lockMission, lockProgress, 'LOCKED_LAUNCH');
assert(isSlingshotMissionComplete(lockMission, lockProgress), 'Slingshot lock mission cannot complete');
assert(advanceSlingshotMissionProgress(lockMission, 1, 'STARDUST') === 1, 'Slingshot unrelated events advance the wrong mission');
assert(getSlingshotMissionReward(5, 3) > getSlingshotMissionReward(1, 1), 'Slingshot mission rewards do not scale with sector/streak mastery');

// One Line — mastery is optional optimization on top of ordinary goal completion.
assert(ONE_LINE_MASTERY_GOALS.length === 3, 'One Line must expose three rotating Master Route goals');
assert(ONE_LINE_MASTERY_GOALS.every((goal) => goal.minStars >= 1 && goal.minStars <= 3), 'One Line mastery star target escaped available 3-star range');
assert(ONE_LINE_MASTERY_GOALS.every((goal) => goal.minInkRemainingPercent >= 15 && goal.minInkRemainingPercent <= 40), 'One Line mastery ink target escaped fair range');
assert(getOneLineMasteryGoal(1).label === 'STAR ROUTE', 'One Line opening mastery goal changed');
assert(getOneLineMasteryGoal(4).label === 'STAR ROUTE', 'One Line mastery cycle no longer repeats every three levels');
assert(getOneLineInkRemainingPercent(550, 1100) === 50, 'One Line ink efficiency calculation is incorrect');
assert(getOneLineInkRemainingPercent(1400, 1100) === 0, 'One Line ink efficiency does not clamp at zero');
assert(isOneLineMasteryClear(getOneLineMasteryGoal(1), 2, 20), 'One Line exact mastery threshold does not pass');
assert(!isOneLineMasteryClear(getOneLineMasteryGoal(1), 1, 80), 'One Line mastery ignores star requirement');
assert(getOneLineMasteryReward(6, 3) > getOneLineMasteryReward(1, 1), 'One Line mastery rewards do not scale with level/streak');

const breakout = read('src/games/BreakoutGame.tsx');
const slingshot = read('src/games/SlingshotGame.tsx');
const oneLine = read('src/games/OneLineGame.tsx');
const registry = read('src/data/games.ts');

for (const token of ['getBreakoutContract', 'advanceBreakoutContractProgress', 'contractProgress', 'contractStreak', 'CONTRACT']) {
  assert(breakout.includes(token), `Breakout P8 integration missing ${token}`);
}
assert(breakout.includes("registerContractEvent('POWER')"), 'Breakout power catches do not advance contracts');
assert(breakout.includes("registerContractEvent('COMBO', state.combo)"), 'Breakout combo hits do not advance contracts');

for (const token of ['getSlingshotMission', 'advanceSlingshotMissionProgress', 'missionProgress', 'missionStreak', 'NAV MISSION']) {
  assert(slingshot.includes(token), `Slingshot P8 integration missing ${token}`);
}
assert(slingshot.includes("registerMissionEvent('LOCKED_LAUNCH')"), 'Slingshot locked launches do not advance missions');
assert(slingshot.includes("registerMissionEvent('GOLD_DUST')"), 'Slingshot gold stardust does not advance missions');

for (const token of ['getOneLineMasteryGoal', 'isOneLineMasteryClear', 'masteryStreak', 'MASTER ROUTE']) {
  assert(oneLine.includes(token), `One Line P8 integration missing ${token}`);
}
assert(oneLine.includes('state.masteryStreak = 0;') && oneLine.includes('handleRandomNewLevel'), 'One Line Random rerolls do not break mastery streaks');

for (const phrase of ['rotating round contracts', 'sector navigation missions', 'Master Route goals']) {
  assert(registry.includes(phrase), `registry is missing P8 teaching phrase: ${phrase}`);
}

if (errors.length) {
  console.error('P8 REBALANCED BOTTOM-THREE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P8 REBALANCED BOTTOM-THREE AUDIT — PASS');
console.log('Breakout contracts, Slingshot navigation missions, and One Line Master Routes are certified.');
