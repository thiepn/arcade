import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { P22_PROMOTIONS, P22_S_THRESHOLD, p22Total, type P22Category } from './p22-promotion-scorecards';
import { P22_SNAKE_CHAPTERS, P22_ORB_SALVO_PLANS, P22_ROAD_DISTRICT_ROUTES, P22_TEACHING } from '../src/lib/p22PromotionStructures';
import { P22_ORBIT_CONSTELLATIONS } from '../src/lib/orbitConstellationMastery';
import { ORBIT_FORMATION_WARNING_SEC, ORBIT_FORMATION_COOLDOWN_SEC, ORBIT_FORMATION_RESOLVE_SEC, ORBIT_FORMATION_GRACE_SEC, ORBIT_THREAT_FORMATIONS } from '../src/lib/orbitThreatMastery';
import { ORBIT_ROUTES } from '../src/lib/orbitMastery';
import { P22_NEON_RAIL_SEQUENCES, createNeonRailPhrase } from '../src/lib/neonRailDepth';
import { NEON_RAIL_MAX_SURGE_CHARGES, NEON_RAIL_SURGE_DURATION, NEON_RAIL_SURGE_SCORE_MULTIPLIER, NEON_RAIL_SURGE_SPEED_MULTIPLIER } from '../src/lib/neonRailMastery';
import { P22_SLINGSHOT_MISSION_ARCS, SLINGSHOT_MISSIONS, getSlingshotMission } from '../src/lib/slingshotMastery';
import { ORB_BURST_EARN_COMBO, ORB_BURST_EARN_DROP_COUNT, ORB_BURST_MAX_CHARGES, ORB_BURST_START_CHARGES, canArmOrbBurst, canSwapOrbChamber } from '../src/lib/orbCannonMastery';
import { MATRIX_OVERCLOCK } from '../src/lib/matrixMastery';
import { MATRIX_PROTOCOLS, P22_MATRIX_PROTOCOL_SUITES, getMatrixProtocolForRound } from '../src/lib/matrixProtocols';
import { P22_KNIFE_RAZOR_ROUTES, getKnifeRazorRouteSide } from '../src/lib/knifeRazorRoutes';
import { getKnifeRazorTolerance } from '../src/lib/knifeMastery';
import { getKnifeStageConfig } from '../src/lib/knifeStageProgression';
import { ROAD_CROSS_DISTRICT_LENGTH, ROAD_CROSS_DISTRICTS } from '../src/lib/roadCrossMastery';
import { canAcceptRoadCrossMove } from '../src/lib/roadCrossSupport';
import { SNAKE_PHASE_THREAD_EXTENSION_EVERY, SNAKE_PHASE_THREAD_EXTENSION_TICKS, SNAKE_PHASE_THREAD_MAX_GHOST_TICKS } from '../src/lib/snakePhaseMastery';
import { createP22RunState, processP22GameplayEvent } from '../src/lib/p22PromotionState';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const categories: readonly P22Category[] = ['core', 'agency', 'progression', 'replay', 'feel', 'fairnessUx'];
const expectedIds = ['snake', 'orbit', 'neonrail', 'slingshot', 'bubblebuster', 'matrix', 'knifetarget', 'roadcross'];
const expectedHistorical = new Map([
  ['snake', [8, 9, 9, 9, 7, 8]],
  ['orbit', [8, 9, 9, 8, 8, 8]],
  ['neonrail', [8, 9, 9, 8, 8, 8]],
  ['slingshot', [8, 8, 9, 9, 8, 8]],
  ['bubblebuster', [8, 9, 8, 8, 8, 8]],
  ['matrix', [8, 9, 9, 8, 7, 8]],
  ['knifetarget', [8, 8, 9, 8, 8, 8]],
  ['roadcross', [8, 8, 9, 8, 8, 8]],
] as const);

assert(P22_S_THRESHOLD === 55, 'P22 S threshold must remain 55');
assert(P22_PROMOTIONS.length === 8, 'P22 must contain exactly eight promotion records');
assert(new Set(P22_PROMOTIONS.map((record) => record.id)).size === 8, 'P22 promotion IDs are not unique');
assert(expectedIds.every((id) => P22_PROMOTIONS.some((record) => record.id === id)), 'P22 cohort does not match the eight remaining A-rank game IDs');
assert(Object.keys(P22_TEACHING).length === 8, 'P22 teaching map must cover exactly eight candidates');

for (const record of P22_PROMOTIONS) {
  const historical = expectedHistorical.get(record.id);
  assert(Boolean(historical), `${record.title} missing immutable P15 baseline`);
  if (historical) {
    categories.forEach((category, index) => {
      assert(record.historical[category] === historical[index], `${record.title} ${category} does not match immutable P15`);
    });
  }
  assert(p22Total(record.final) === 55, `${record.title} final score must remain exactly 55/60`);
  assert(p22Total(record.final) >= P22_S_THRESHOLD, `${record.title} does not reach the unchanged S threshold`);
  for (const category of categories) {
    const historicalValue = record.historical[category];
    const pre = record.preP22[category];
    const final = record.final[category];
    assert(pre >= historicalValue && pre <= historicalValue + 1, `${record.title} ${category} pre-P22 change exceeds conservative +1 discipline`);
    assert(final >= pre && final <= historicalValue + 1, `${record.title} ${category} final change exceeds immutable-P15 +1 discipline`);
    if (final > historicalValue) {
      const evidence = record.evidence[category];
      assert(Boolean(evidence && evidence.length >= 2), `${record.title} ${category} increase lacks concrete evidence`);
    }
  }
  assert(record.adversarialReview.length >= 2, `${record.title} lacks an adversarial promotion review`);
}

// Immutable P15 remains historical authority.
const p15 = read('docs/P15_ROSTER_AUDIT.md');
for (const token of [
  '| 18 | Cyber Serpent | A | 8 | 9 | 9 | 9 | 7 | 8 | 50 |',
  '| 19 | Orbit | A | 8 | 9 | 9 | 8 | 8 | 8 | 50 |',
  '| 20 | Neon Rail Shift | A | 8 | 9 | 9 | 8 | 8 | 8 | 50 |',
  '| 21 | Orbital Slingshot | A | 8 | 8 | 9 | 9 | 8 | 8 | 50 |',
  '| 22 | Orb Cannon | A | 8 | 9 | 8 | 8 | 8 | 8 | 49 |',
  '| 23 | Memory Matrix | A | 8 | 9 | 9 | 8 | 7 | 8 | 49 |',
  '| 24 | Knife Target | A | 8 | 8 | 9 | 8 | 8 | 8 | 49 |',
  '| 25 | Cyber Crosser | A | 8 | 8 | 9 | 8 | 8 | 8 | 49 |',
  '- **S:** 5',
  '- **A:** 20',
  '- **B:** 7',
]) assert(p15.includes(token), `immutable P15 historical token changed: ${token}`);

// Serpent: authored chapters layered over the original bounded Phase Thread.
assert(P22_SNAKE_CHAPTERS.length === 5, 'Serpent must expose five P22 Phase Thread Chapters');
assert(new Set(P22_SNAKE_CHAPTERS.map((chapter) => chapter.name)).size === 5, 'Serpent chapter identities are not unique');
assert(P22_SNAKE_CHAPTERS.every((chapter) => chapter.threadTarget >= 2 && chapter.threadTarget <= 6), 'Serpent chapter thread targets escaped bounded range');
assert(SNAKE_PHASE_THREAD_EXTENSION_EVERY === 3, 'Serpent Phase Thread extension cadence changed');
assert(SNAKE_PHASE_THREAD_EXTENSION_TICKS === 6, 'Serpent Phase Thread extension ticks changed');
assert(SNAKE_PHASE_THREAD_MAX_GHOST_TICKS === 90, 'Serpent Ghost Phase hard cap changed');
const snakeState = createP22RunState('snake');
assert(processP22GameplayEvent(snakeState, { gameId: 'snake', kind: 'phase-thread', value: 2 }, { firewallStage: 1 }) === 450, 'Serpent opening chapter cannot complete from a genuine two-cell Phase Thread');

// Orbit: constellations compose existing legal routes/formations only.
assert(P22_ORBIT_CONSTELLATIONS.length === 6, 'Orbit must expose six P22 Constellations');
const routeNames = new Set(ORBIT_ROUTES.map((route) => route.name));
const formationNames = new Set(ORBIT_THREAT_FORMATIONS.map((formation) => formation.name));
assert(P22_ORBIT_CONSTELLATIONS.every((entry) => routeNames.has(entry.route)), 'Orbit constellation references a non-existent route');
assert(P22_ORBIT_CONSTELLATIONS.every((entry) => formationNames.has(entry.formation)), 'Orbit constellation references a non-existent threat formation');
assert(ORBIT_FORMATION_WARNING_SEC === 1.2, 'Orbit formation warning changed');
assert(ORBIT_FORMATION_COOLDOWN_SEC === 7.2, 'Orbit formation cooldown changed');
assert(ORBIT_FORMATION_RESOLVE_SEC === 1.7, 'Orbit formation resolve duration changed');
assert(ORBIT_FORMATION_GRACE_SEC === 2.0, 'Orbit formation grace changed');
assert(ORBIT_THREAT_FORMATIONS.every((formation) => !formation.targets.some((target) => target.lane === formation.safeLane)), 'Orbit P22 composition can threaten a certified safe lane');

// Neon Rail: six three-phrase authored sequences, all made from the certified four-phrase vocabulary.
assert(P22_NEON_RAIL_SEQUENCES.length === 6, 'Neon Rail must expose six P22 Rail Sequences');
const railNames = new Set(['SWITCHBACK', 'SLALOM', 'HOLD_BREAK', 'CENTER_CUT']);
assert(P22_NEON_RAIL_SEQUENCES.every((sequence) => sequence.phrases.length === 3), 'Rail Sequence must contain exactly three phrase units');
assert(P22_NEON_RAIL_SEQUENCES.every((sequence) => sequence.phrases.every((phrase) => railNames.has(phrase))), 'Rail Sequence introduces a non-certified phrase type');
for (const value of [0.05, 0.3, 0.55, 0.85]) {
  const phrase = createNeonRailPhrase(1, value);
  assert(phrase.lanes.length === 18, 'P22 Rail Sequence must compose exactly eighteen legal lane rows');
  assert(phrase.lanes[0] === 1, 'P22 Rail Sequence no longer begins from the supplied safe lane');
  assert(phrase.lanes.every((lane, index) => index === 0 || Math.abs(lane - phrase.lanes[index - 1]) <= 1), 'P22 Rail Sequence contains an unreachable multi-lane jump');
}
assert(NEON_RAIL_MAX_SURGE_CHARGES === 2, 'Rail Surge charge cap changed');
assert(NEON_RAIL_SURGE_DURATION === 5, 'Rail Surge duration changed');
assert(NEON_RAIL_SURGE_SPEED_MULTIPLIER === 1.18, 'Rail Surge speed changed');
assert(NEON_RAIL_SURGE_SCORE_MULTIPLIER === 2, 'Rail Surge score multiplier changed');

// Slingshot: arcs group the exact original mission vocabulary and target cycle.
assert(SLINGSHOT_MISSIONS.length === 4 && P22_SLINGSHOT_MISSION_ARCS.length === 4, 'Slingshot mission/arc counts changed unexpectedly');
assert(SLINGSHOT_MISSIONS.map((mission) => mission.target).join(',') === '3,6,3,3', 'Slingshot mission targets changed');
assert(getSlingshotMission(1).kind === 'LOCK_CHAIN' && getSlingshotMission(5).kind === 'LOCK_CHAIN', 'Slingshot four-sector historical mission cycle changed');
const slingshotKinds = new Set(SLINGSHOT_MISSIONS.map((mission) => mission.kind));
assert(P22_SLINGSHOT_MISSION_ARCS.every((arc) => slingshotKinds.has(arc.first) && slingshotKinds.has(arc.second)), 'Slingshot Mission Arc introduces an unsupported mission type');

// Orb Cannon: six plans, same Burst economy and one-swap/no-flight guards.
assert(P22_ORB_SALVO_PLANS.length === 6, 'Orb Cannon must expose six Salvo Plans');
assert(ORB_BURST_MAX_CHARGES === 2 && ORB_BURST_START_CHARGES === 1, 'Orb Cannon Burst charge economy changed');
assert(ORB_BURST_EARN_COMBO === 4 && ORB_BURST_EARN_DROP_COUNT === 4, 'Orb Cannon Burst earning cadence changed');
assert(canArmOrbBurst(1, false, false) && !canArmOrbBurst(0, false, false) && !canArmOrbBurst(1, true, false) && !canArmOrbBurst(1, false, true), 'Orb Cannon Burst arming guard changed');
assert(canSwapOrbChamber(false, false) && !canSwapOrbChamber(true, false) && !canSwapOrbChamber(false, true), 'Orb Cannon one-swap/no-flight guard changed');
const orbState = createP22RunState('bubblebuster');
processP22GameplayEvent(orbState, { gameId: 'bubblebuster', kind: 'orb-swap' });
assert(processP22GameplayEvent(orbState, { gameId: 'bubblebuster', kind: 'orb-resolve', value: 1, aux: 0 }) === 500, 'Orb Cannon CHAMBER READ plan cannot resolve through real swap→match events');

// Matrix: foundation rounds remain historical; later suites use only the four certified transforms.
assert(MATRIX_PROTOCOLS.join(',') === 'FORWARD,REVERSE,MIRROR,REVERSE_MIRROR', 'Matrix protocol vocabulary changed');
assert(P22_MATRIX_PROTOCOL_SUITES.length === 6, 'Memory Matrix must expose six Protocol Suites');
assert(P22_MATRIX_PROTOCOL_SUITES.every((suite) => suite.protocols.length === 4 && suite.protocols.every((protocol) => MATRIX_PROTOCOLS.includes(protocol))), 'Matrix suite contains a non-certified protocol');
assert([1,2,3,4,5,6,7,8].map(getMatrixProtocolForRound).join(',') === 'FORWARD,FORWARD,REVERSE,REVERSE,MIRROR,MIRROR,REVERSE_MIRROR,REVERSE_MIRROR', 'Matrix rounds 1–8 historical foundation changed');
assert(MATRIX_OVERCLOCK.sequenceBonus === 2 && MATRIX_OVERCLOCK.playbackScale === 0.78, 'Matrix Overclock load/speed contract changed');
assert(MATRIX_OVERCLOCK.stepScoreMultiplier === 1.5 && MATRIX_OVERCLOCK.clearScoreMultiplier === 1.8 && MATRIX_OVERCLOCK.disablesManualReplay, 'Matrix Overclock scoring/manual-repeat contract changed');

// Knife: two route traces inside original safe Razor geometry and stage caps.
assert(P22_KNIFE_RAZOR_ROUTES.length === 2, 'Knife Target must expose two Razor Route variants');
assert(P22_KNIFE_RAZOR_ROUTES.every((route) => route.stageSteps[0] === 1 && route.stageSteps[2] === 6), 'Knife Razor Route must open at stage 1 and culminate at Boss stage 6');
assert(getKnifeRazorRouteSide(-0.02, 0, 0.1) === 'PRECISION TRACE' && getKnifeRazorRouteSide(0.02, 0, 0.1) === 'TEMPO TRACE', 'Knife route commitment does not split the existing safe Razor tolerance');
assert(getKnifeRazorTolerance(999) === 0.09, 'Knife Razor tolerance floor changed');
const lateKnife = getKnifeStageConfig(999);
assert(lateKnife.baseSpeed <= 5.2 && lateKnife.knifeCount <= 14 && lateKnife.preBladeCount <= 5, 'Knife P22 escaped certified stage caps');

// Crosser: four districts preserved; optional routes are two mirrored three-waypoint choices each.
assert(ROAD_CROSS_DISTRICT_LENGTH === 8, 'Cyber Crosser district length changed');
assert(ROAD_CROSS_DISTRICTS.map((district) => district.name).join(',') === 'NEON SUBURB,RUSH CIRCUIT,FLOOD CHANNEL,RAILWORKS', 'Cyber Crosser district roster changed');
assert(Object.keys(P22_ROAD_DISTRICT_ROUTES).length === 4, 'Cyber Crosser must provide route profiles for all four districts');
for (const district of ROAD_CROSS_DISTRICTS) {
  const routes = P22_ROAD_DISTRICT_ROUTES[district.name];
  assert(Boolean(routes && routes.length === 2), `${district.name} must expose two optional District Routes`);
  assert(Boolean(routes?.every((route) => route.waypoints.length === 3)), `${district.name} routes must contain exactly three waypoint columns`);
}
assert(canAcceptRoadCrossMove(1) && !canAcceptRoadCrossMove(0.9), 'Cyber Crosser accepted-move gate changed');

// Runtime/presentation and score integration must exist without a second shell or feedback framework.
const main = read('src/main.tsx');
const runtime = read('src/lib/p22PromotionRuntime.ts');
const css = read('src/p22-mid-a-promotion.css');
const bubbleGame = read('src/games/BubbleBusterGame.tsx');
for (const token of ['installP22PromotionRuntime', "import './p22-mid-a-promotion.css'"]) assert(main.includes(token), `P22 main integration missing ${token}`);
for (const token of ['data-p22-promotion', 'p22-promotion-hud', 'p22-pause-extension', 'emitP17GameFeel']) assert(runtime.includes(token) || css.includes(token), `P22 runtime/presentation missing ${token}`);
assert(bubbleGame.includes('getOrbSalvoResolutionBonus') && bubbleGame.includes('SALVO PLAN'), 'Orb Cannon Salvo Plan bonus is not integrated into authoritative score feedback');

// P17–P21 continuity markers.
for (const [path, token] of [
  ['src/lib/gameFeelRuntime.ts', 'P17_FEEDBACK_EVENT'],
  ['src/lib/gameClarityProfiles.ts', 'P18_GAME_CLARITY_BY_ID'],
  ['src/lib/arcadeCohesionRuntime.ts', 'p19'],
  ['scripts/p20-promotion-scorecards.ts', 'P20_PROMOTIONS'],
  ['scripts/p21-promotion-scorecards.ts', 'P21_PROMOTIONS'],
] as const) assert(read(path).includes(token), `P22 continuity check missing ${token} in ${path}`);

// No P22 app-code metagame/replay implementation. Do not scan documentation/audits themselves.
const p22AppFiles = [
  'src/lib/p22GameplayEvents.ts',
  'src/lib/p22PromotionStructures.ts',
  'src/lib/p22PromotionState.ts',
  'src/lib/p22PromotionRuntime.ts',
  'src/lib/orbitConstellationMastery.ts',
  'src/lib/knifeRazorRoutes.ts',
  'src/p22-mid-a-promotion.css',
];
const forbidden = ['ReplayRecorder', 'ReplayPlayer', 'GhostRun', 'RunRecording', 'InputRecording', 'PlaybackTimeline', 'ReplayExport', 'RunHistory', 'DailyChallenge', 'WeeklyChallenge', 'BattlePass', 'PlayerXP', 'ArcadeCurrency', 'UnlockTree'];
for (const path of p22AppFiles) {
  const source = read(path);
  for (const token of forbidden) assert(!source.includes(token), `${path} introduces forbidden P22 platform concept ${token}`);
}

// CI/release package wiring is permanent once P22 lands.
const pkg = read('package.json');
const ci = read('.github/workflows/ci.yml');
const release = read('scripts/audit-release-32.ts');
assert(pkg.includes('"quality:gameplay-p22"') && pkg.includes('"quality:browser-p22"'), 'package.json is missing P22 quality scripts');
assert(ci.includes('quality:gameplay-p22') && ci.includes('quality:browser-p22'), 'CI is missing P22 static/browser gates');
assert(release.includes('P22') || release.includes('p22'), 'release32 is not extended through P22');

if (errors.length) {
  console.error('P22 MID-A PROMOTION CERTIFICATION — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P22 MID-A PROMOTION CERTIFICATION — PASS');
for (const record of P22_PROMOTIONS) console.log(`${record.title}: ${p22Total(record.final)}/60 — S`);
console.log('8/8 promotion records certified. Every changed category is evidence-backed and no category exceeds immutable P15 by more than +1.');
console.log('Historical P15: 5 S / 20 A / 7 B');
console.log('P21: 17 S / 8 A / 7 B');
console.log('Current P22: 25 S / 0 A / 7 B');
console.log('Automation certifies objective source/runtime contracts, not subjective fun or taste.');
