import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { P23_PROMOTIONS, P23_S_THRESHOLD, p23Total, type P23Category } from './p23-promotion-scorecards';
import { TYPE_RUSH_WAVES } from '../src/lib/typeRushProgression';
import { createTypeRushRelayState, advanceTypeRushRelay } from '../src/lib/typeRushRelays';
import { PERFECT_STOP_ROUNDS } from '../src/lib/perfectStopGameplay';
import { PERFECT_STOP_ENCORE_HITS_REQUIRED, PERFECT_STOP_ENCORE_ROUNDS } from '../src/lib/perfectStopEncore';
import { createPerfectStopRouteState, getPerfectStopPrecisionTarget, advancePerfectStopRoute } from '../src/lib/perfectStopBeaconRoutes';
import { REACTION_ROUNDS } from '../src/lib/reactionGameplay';
import { REACTION_OVERTIME_MAX_MISTAKES, REACTION_OVERTIME_ROUNDS } from '../src/lib/reactionOvertime';
import { createReactionCircuitState, chooseReactionCircuit, getReactionCoreOrder } from '../src/lib/reactionCircuits';
import { PULSE_WAGER_MAX_CHARGES, PULSE_WAGER_START_CHARGES, PULSE_WAGER_EARN_COMBO, PULSE_WAGER_WINDOW_PX } from '../src/lib/pulseMastery';
import { PULSE_GROOVE_PATHS, createPulseGroovePathState, queuePulseGroovePathChoice, advancePulseGroovePath } from '../src/lib/pulseGroovePaths';
import { LASER_ROPE_MODE_MIN_WARNING_SEC } from '../src/lib/laserRopeBalance';
import { LASER_ROPE_REDLINE_DURATION_SEC, LASER_ROPE_REDLINE_EARN_EVERY, LASER_ROPE_REDLINE_MAX_CHARGES, LASER_ROPE_REDLINE_SCORE_MULTIPLIER, LASER_ROPE_REDLINE_SPEED_MULTIPLIER } from '../src/lib/laserRopeRedline';
import { LASER_ROPE_CHOREOGRAPHIES } from '../src/lib/laserRopeChoreographies';
import { AERO_FLOW_DURATION_SEC, AERO_FLOW_EARN_GRAZES, AERO_FLOW_MAX_CHARGES, AERO_FLOW_SCORE_MULTIPLIER, AERO_FLOW_SPEED_MULTIPLIER, AERO_FLOW_START_CHARGES } from '../src/lib/aeroMastery';
import { AERO_FLIGHT_LINES, getAeroFlightLineGatePlan, isAeroFlightLineReachableEnvelope } from '../src/lib/aeroFlightLines';
import { STACK_FOCUS_MAX_CHARGES, STACK_FOCUS_START_CHARGES, STACK_FOCUS_EARN_STREAK, STACK_FOCUS_PERFECT_WINDOW_PX, STACK_STANDARD_PERFECT_WINDOW_PX } from '../src/lib/stackMastery';
import { STACK_BLUEPRINTS, createStackBlueprintState, advanceStackBlueprint } from '../src/lib/stackBlueprints';
import { P23_CLARITY_EXTENSIONS, getP23ExtendedClarityProfile } from '../src/lib/p23ClarityProfileExtensions';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
const categories: readonly P23Category[] = ['core', 'agency', 'progression', 'replay', 'feel', 'fairnessUx'];
const expectedIds = ['typerush', 'perfectstop', 'reaction', 'pulse', 'laserrope', 'flappyaero', 'stack'] as const;
const expectedHistorical: Record<(typeof expectedIds)[number], readonly number[]> = {
  typerush: [8, 8, 9, 8, 7, 8],
  perfectstop: [8, 7, 9, 8, 8, 8],
  reaction: [8, 8, 9, 7, 7, 8],
  pulse: [8, 7, 8, 7, 9, 8],
  laserrope: [8, 7, 8, 7, 8, 8],
  flappyaero: [8, 7, 8, 7, 8, 8],
  stack: [8, 7, 7, 7, 8, 8],
};

assert(P23_S_THRESHOLD === 55, 'P23 S threshold must remain 55');
assert(P23_PROMOTIONS.length === 7 && new Set(P23_PROMOTIONS.map((record) => record.id)).size === 7, 'P23 must contain exactly seven unique B-rank records');
assert(expectedIds.every((id) => P23_PROMOTIONS.some((record) => record.id === id)), 'P23 cohort does not match the seven historical B-rank IDs');
assert(P23_CLARITY_EXTENSIONS.length === 7, 'P23 must extend exactly seven P18 clarity profiles');

for (const record of P23_PROMOTIONS) {
  const historical = expectedHistorical[record.id];
  categories.forEach((category, index) => assert(record.historical[category] === historical[index], `${record.title} ${category} historical score differs from immutable P15`));
  assert(p23Total(record.final) === 55 && p23Total(record.final) >= P23_S_THRESHOLD, `${record.title} final score must be exactly 55/60 S`);
  for (const category of categories) {
    const historicalScore = record.historical[category];
    const pre = record.preP23[category];
    const final = record.final[category];
    assert(pre >= historicalScore && pre <= historicalScore + 1, `${record.title} ${category} pre-P23 must come only from prior +1 evidence`);
    assert(final >= pre && final <= historicalScore + 2, `${record.title} ${category} exceeds P15 +2 transformation ceiling`);
    const delta = final - historicalScore;
    if (delta > 0) {
      const evidence = [...(record.priorEvidence[category] ?? []), ...(record.p23Evidence[category] ?? [])];
      assert(evidence.length >= delta, `${record.title} ${category} delta +${delta} lacks independent evidence`);
      if (delta === 2) assert(evidence.length >= 2, `${record.title} ${category} +2 lacks two evidence records`);
    }
    if (final > pre) assert((record.p23Evidence[category]?.length ?? 0) > 0, `${record.title} ${category} P23 increase lacks P23-specific evidence`);
  }
  assert(record.adversarialReview.length >= 3, `${record.title} lacks adversarial review`);
  const extended = getP23ExtendedClarityProfile(record.id);
  assert(extended.masteryName === P23_CLARITY_EXTENSIONS.find((entry) => entry.id === record.id)?.masteryName, `${record.title} P23 clarity extension not applied`);
  assert(extended.sourceControls.length > 0, `${record.title} sourceControls missing after P23 clarity extension`);
}
assert(getP23ExtendedClarityProfile('pulse').sourceControls.includes('A/D') && getP23ExtendedClarityProfile('pulse').sourceControls.includes('Sync Wager'), 'Pulse P23 sourceControls must teach path choice and Sync Wager');

const p15 = read('docs/P15_ROSTER_AUDIT.md');
for (const token of [
  '| 26 | Type Rush | B | 8 | 8 | 9 | 8 | 7 | 8 | 48 |',
  '| 27 | Perfect Stop | B | 8 | 7 | 9 | 8 | 8 | 8 | 48 |',
  '| 28 | Reaction | B | 8 | 8 | 9 | 7 | 7 | 8 | 47 |',
  '| 29 | Pulse | B | 8 | 7 | 8 | 7 | 9 | 8 | 47 |',
  '| 30 | Laser Rope Reflex | B | 8 | 7 | 8 | 7 | 8 | 8 | 46 |',
  '| 31 | Aero Pulse | B | 8 | 7 | 8 | 7 | 8 | 8 | 46 |',
  '| 32 | Stack | B | 8 | 7 | 7 | 7 | 8 | 8 | 45 |',
  '- **S:** 5', '- **A:** 20', '- **B:** 7',
]) assert(p15.includes(token), `immutable P15 token changed: ${token}`);

assert(TYPE_RUSH_WAVES.map((wave) => wave.spawnIntervalMs).join(',') === '2300,1900,1550,1250', 'Type Rush spawn cadence changed');
assert(TYPE_RUSH_WAVES.map((wave) => wave.maxWords).join(',') === '3,4,4,5', 'Type Rush word ceiling changed');
assert(TYPE_RUSH_WAVES.map((wave) => wave.speedMultiplier).join(',') === '0.9,1,1.08,1.16', 'Type Rush speed envelope changed');
let relay = createTypeRushRelayState(0);
for (const event of [{ yPercent: 20, type: 'standard' as const }, { yPercent: 65, type: 'standard' as const }, { yPercent: 40, type: 'bomb' as const }]) relay = advanceTypeRushRelay(relay, event).state;
assert(relay.completions === 1, 'Type Rush CONTROL Directive Relay cannot complete from real standard/urgent/special events');

assert(PERFECT_STOP_ROUNDS.length === 7 && PERFECT_STOP_ENCORE_ROUNDS.length === 3 && PERFECT_STOP_ENCORE_HITS_REQUIRED === 4, 'Perfect Stop core/Encore contract changed');
const precisionTarget = getPerfectStopPrecisionTarget(50, PERFECT_STOP_ROUNDS[0], 0);
assert(precisionTarget !== null && Math.abs(precisionTarget - 50) > PERFECT_STOP_ROUNDS[0].goodWindow * 2, 'Perfect Stop precision beacon overlaps normal beacon');
const routeStart = createPerfectStopRouteState();
const route1 = advancePerfectStopRoute(routeStart, 'PRECISION', 'GREAT', 0);
const route2 = advancePerfectStopRoute(route1.state, 'PRECISION', 'GREAT', 1);
assert(route1.masterCreditBonus === 1 && route2.completed && route2.bonus > 0, 'Perfect Stop Edge route does not resolve through real precision hits');

assert(REACTION_ROUNDS.length === 8 && REACTION_OVERTIME_ROUNDS.length === 3, 'Reaction core/overtime roster changed');
assert(Math.min(...REACTION_ROUNDS.map((round) => round.waitMinMs), ...REACTION_OVERTIME_ROUNDS.map((round) => round.waitMinMs)) >= 260, 'Reaction launch wait fell below P16 floor');
assert(Math.min(...[...REACTION_ROUNDS, ...REACTION_OVERTIME_ROUNDS].filter((round) => round.decoyMs > 0).map((round) => round.decoyMs)) >= 320, 'Reaction inhibition decoy fell below P16 floor');
assert(REACTION_OVERTIME_MAX_MISTAKES === 2, 'Reaction overtime mistake qualification changed');
const speedOrder = getReactionCoreOrder(chooseReactionCircuit(createReactionCircuitState(), 0, 'SPEED'));
const controlOrder = getReactionCoreOrder(chooseReactionCircuit(createReactionCircuitState(), 0, 'CONTROL'));
assert(speedOrder.length === 8 && controlOrder.length === 8 && new Set(speedOrder).size === 8 && speedOrder.join(',') !== controlOrder.join(','), 'Reaction Circuits do not create bounded authored route variation');

assert(PULSE_WAGER_MAX_CHARGES === 2 && PULSE_WAGER_START_CHARGES === 1 && PULSE_WAGER_EARN_COMBO === 4 && PULSE_WAGER_WINDOW_PX === 10, 'Pulse Sync Wager contract changed');
assert(PULSE_GROOVE_PATHS.length === 4 && PULSE_GROOVE_PATHS.every((path) => path.patternIndices.length === 4 && path.patternIndices.every((index) => index >= 0 && index < 6)), 'Pulse Groove Path roster invalid');
let pulsePath = queuePulseGroovePathChoice(createPulseGroovePathState(), 'RIGHT');
for (let step = 0; step < 4; step++) pulsePath = advancePulseGroovePath(pulsePath, 5, false, true).state;
assert(pulsePath.pathIndex === 2 && pulsePath.completions === 1, 'Pulse right branch does not alter the next authored Groove Path');
const pulseGame = read('src/games/PulseGame.tsx');
for (const token of ['Math.min(155', 'absDiff <= 8', 'absDiff <= 18', 'absDiff <= 28', 'GROOVE PATH']) assert(pulseGame.includes(token), `Pulse lost certified/P23 marker: ${token}`);

assert(LASER_ROPE_MODE_MIN_WARNING_SEC === 0.38, 'Laser Rope 0.38s warning floor changed');
assert(LASER_ROPE_REDLINE_EARN_EVERY === 5 && LASER_ROPE_REDLINE_MAX_CHARGES === 2 && LASER_ROPE_REDLINE_DURATION_SEC === 4 && LASER_ROPE_REDLINE_SPEED_MULTIPLIER === 1.22 && LASER_ROPE_REDLINE_SCORE_MULTIPLIER === 2, 'Laser Rope Redline contract changed');
assert(LASER_ROPE_CHOREOGRAPHIES.length === 4 && LASER_ROPE_CHOREOGRAPHIES.every((choreography) => choreography.modes.length === 4 && choreography.modes.every((mode) => ['LOW','HIGH','DUAL'].includes(mode))), 'Laser Rope Choreography roster invalid');
const laserGame = read('src/games/LaserRopeGame.tsx');
assert(laserGame.includes('canApplyLaserRopeModeChange') && laserGame.includes('isChoreographyModeEligible') && laserGame.includes('CHOREOGRAPHY'), 'Laser Rope Choreography is not integrated through certified mode guard');

assert(AERO_FLOW_MAX_CHARGES === 2 && AERO_FLOW_START_CHARGES === 1 && AERO_FLOW_EARN_GRAZES === 3 && AERO_FLOW_DURATION_SEC === 4 && AERO_FLOW_SPEED_MULTIPLIER === 1.18 && AERO_FLOW_SCORE_MULTIPLIER === 2, 'Aero Flow contract changed');
assert(AERO_FLIGHT_LINES.length === 4 && AERO_FLIGHT_LINES.every((line) => line.centerOffsets.length === 3), 'Aero Flight Line roster invalid');
assert(isAeroFlightLineReachableEnvelope(568, 90) && isAeroFlightLineReachableEnvelope(844, 90), 'Aero authored Flight Line center deltas escape bounded reachability envelope');
for (let lineIndex = 0; lineIndex < 8; lineIndex++) for (let step = 0; step < 3; step++) {
  const plan = getAeroFlightLineGatePlan(lineIndex, step, 568, 90);
  assert(plan.gapY >= 60 && plan.gapY + 90 <= 508, 'Aero Flight Line leaves certified vertical margins');
}
const aeroGame = read('src/games/FlappyAeroGame.tsx');
for (const token of ['Math.random() * 40 + 200', 'Math.max(90, 130 - state.gatesCleared * 0.8)', 'Math.min(280, 175 + state.gatesCleared * 3.0)', 'FLIGHT LINE']) assert(aeroGame.includes(token), `Aero lost certified/P23 marker: ${token}`);

assert(STACK_FOCUS_MAX_CHARGES === 2 && STACK_FOCUS_START_CHARGES === 1 && STACK_FOCUS_EARN_STREAK === 3 && STACK_STANDARD_PERFECT_WINDOW_PX === 4 && STACK_FOCUS_PERFECT_WINDOW_PX === 2, 'Stack Focus contract changed');
assert(STACK_BLUEPRINTS.length === 5 && STACK_BLUEPRINTS.every((blueprint) => blueprint.steps.length === 3), 'Stack Tower Blueprint roster invalid');
let stackBlueprint = createStackBlueprintState();
for (const placement of ['CENTERED','PERFECT','CENTERED'] as const) stackBlueprint = advanceStackBlueprint(stackBlueprint, placement, 6).state;
assert(stackBlueprint.completions === 1 && stackBlueprint.blueprintIndex === 1, 'Stack CENTERLINE blueprint cannot resolve from real placement classes');
const stackGame = read('src/games/StackGame.tsx');
for (const token of ['3.5 * clamp', 'Math.min(4.5', 'TOWER BLUEPRINT', 'classifyStackPlacement']) assert(stackGame.includes(token), `Stack lost certified/P23 marker: ${token}`);

const main = read('src/main.tsx');
const p23Runtime = read('src/lib/p23TransformationRuntime.ts');
assert(main.includes('installP23TransformationRuntime') && main.includes("import './p23-b-rank-transformation.css'"), 'P23 runtime/style install missing');
assert(p23Runtime.includes('GAMES_REGISTRY') && p23Runtime.includes('Next Groove Path') && p23Runtime.includes('data.p23Teaching') === false, 'P23 runtime registry/teaching wiring malformed');
assert(p23Runtime.includes('p23Teaching') && p23Runtime.includes('p23-pause-extension'), 'P23 pause teaching extension missing');

for (const [path, marker] of [
  ['src/games/TypeRushGame.tsx', 'DIRECTIVE RELAY'],
  ['src/games/PerfectStopGame.tsx', 'BEACON ROUTE'],
  ['src/games/ReactionGame.tsx', 'REACTION CIRCUIT'],
  ['src/games/PulseGame.tsx', 'GROOVE PATH'],
  ['src/games/LaserRopeGame.tsx', 'CHOREOGRAPHY'],
  ['src/games/FlappyAeroGame.tsx', 'FLIGHT LINE'],
  ['src/games/StackGame.tsx', 'TOWER BLUEPRINT'],
] as const) assert(read(path).includes(`data-p23-transform="${marker}"`), `${marker} runtime landmark missing from ${path}`);

const applicationDelta = [
  'src/games/TypeRushGame.tsx','src/games/PerfectStopGame.tsx','src/games/ReactionGame.tsx','src/games/PulseGame.tsx','src/games/LaserRopeGame.tsx','src/games/FlappyAeroGame.tsx','src/games/StackGame.tsx',
  'src/lib/typeRushRelays.ts','src/lib/perfectStopBeaconRoutes.ts','src/lib/reactionCircuits.ts','src/lib/pulseGroovePaths.ts','src/lib/laserRopeChoreographies.ts','src/lib/aeroFlightLines.ts','src/lib/stackBlueprints.ts','src/lib/p23TransformationRuntime.ts',
].map(read).join('\n');
for (const forbidden of ['ReplayRecorder','ReplayPlayer','GhostRun','RunRecording','InputRecording','RunHistory','PlaybackTimeline','PlayerXP','ArcadeCurrency','UnlockTree','BattlePass','DailyChallenge','WeeklyChallenge','PermanentUpgrade']) {
  assert(!applicationDelta.includes(forbidden), `P23 application delta contains prohibited system identifier ${forbidden}`);
}

const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string,string> };
assert(packageJson.scripts?.['quality:gameplay-p23'] === 'bun scripts/audit-gameplay-p23.ts', 'package missing quality:gameplay-p23');
assert(packageJson.scripts?.['quality:browser-p23'] === 'bun scripts/audit-browser-gameplay-p23.mjs', 'package missing quality:browser-p23');
const ci = read('.github/workflows/ci.yml');
assert(ci.includes('quality:gameplay-p23') && ci.includes('quality:browser-p23') && ci.includes('P23_CHROME_PATH'), 'CI missing permanent P23 source/browser gates');
const release = read('scripts/audit-release-32.ts');
assert(release.includes('quality:gameplay-p23') && release.includes('quality:browser-p23') && release.includes('P23'), 'release32 does not extend through P23');
assert(read('docs/P23_B_RANK_TRANSFORMATION_CERTIFICATION.md').includes('P24 boundary'), 'P23 certification doc missing explicit P24 boundary');

if (errors.length) {
  console.error('P23 B-RANK TRANSFORMATION CERTIFICATION — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P23 B-RANK TRANSFORMATION CERTIFICATION — PASS');
for (const record of P23_PROMOTIONS) console.log(`${record.title}: ${p23Total(record.final)}/60 — S`);
console.log('7/7 transformation records certified; every historical +2 is separately evidenced and no category exceeds P15 +2.');
console.log('Historical P15: 5 S / 20 A / 7 B');
console.log('Current post-P23 score state: 32 S / 0 A / 0 B');
console.log('Automation certifies objective source/runtime contracts, not subjective fun or P24 definitive 32/32 certification.');
