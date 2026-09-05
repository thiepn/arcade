import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { P22_PROMOTIONS, P22_S_THRESHOLD, p22Total, type P22Category } from './p22-promotion-scorecards';
import { P22_SNAKE_CHAPTERS, P22_ORB_SALVO_PLANS, P22_ROAD_DISTRICT_ROUTES, P22_TEACHING } from '../src/lib/p22PromotionStructures';
import { P22_CLARITY_EXTENSIONS, getP22ExtendedClarityProfile } from '../src/lib/p22ClarityProfileExtensions';
import { P22_ORBIT_CONSTELLATIONS } from '../src/lib/orbitConstellationMastery';
import { ORBIT_FORMATION_WARNING_SEC, ORBIT_FORMATION_COOLDOWN_SEC, ORBIT_FORMATION_RESOLVE_SEC, ORBIT_FORMATION_GRACE_SEC, ORBIT_THREAT_FORMATIONS } from '../src/lib/orbitThreatMastery';
import { ORBIT_ROUTES } from '../src/lib/orbitMastery';
import { P22_NEON_RAIL_SEQUENCES, createNeonRailPhrase, createNeonRailSequence } from '../src/lib/neonRailDepth';
import { NEON_RAIL_MASTERY_STREAK, NEON_RAIL_MAX_SURGE_CHARGES, NEON_RAIL_SURGE_DURATION, NEON_RAIL_SURGE_SCORE_MULTIPLIER, NEON_RAIL_SURGE_SPEED_MULTIPLIER } from '../src/lib/neonRailMastery';
import { P22_SLINGSHOT_MISSION_ARCS, SLINGSHOT_MISSIONS, getSlingshotMission } from '../src/lib/slingshotMastery';
import { ORB_BURST_EARN_COMBO, ORB_BURST_EARN_DROP_COUNT, ORB_BURST_MAX_CHARGES, ORB_BURST_START_CHARGES, canArmOrbBurst, canSwapOrbChamber } from '../src/lib/orbCannonMastery';
import { MATRIX_OVERCLOCK } from '../src/lib/matrixMastery';
import { MATRIX_PROTOCOLS, P22_MATRIX_PROTOCOL_SUITES, getMatrixProtocolForRound } from '../src/lib/matrixProtocols';
import { P22_KNIFE_RAZOR_ROUTES, getKnifeRazorRouteSide } from '../src/lib/knifeRazorRoutes';
import { getKnifeRazorTolerance } from '../src/lib/knifeMastery';
import { getKnifeStageConfig } from '../src/lib/knifeStageProgression';
import { ROAD_CROSS_DISTRICT_LENGTH, ROAD_CROSS_DISTRICTS, getRoadCrossDistrictStartRow } from '../src/lib/roadCrossMastery';
import { canAcceptRoadCrossMove } from '../src/lib/roadCrossSupport';
import { SNAKE_PHASE_THREAD_EXTENSION_EVERY, SNAKE_PHASE_THREAD_EXTENSION_TICKS, SNAKE_PHASE_THREAD_MAX_GHOST_TICKS } from '../src/lib/snakePhaseMastery';
import { createP22RunState, processP22GameplayEvent } from '../src/lib/p22PromotionState';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };

const categories: readonly P22Category[] = ['core', 'agency', 'progression', 'replay', 'feel', 'fairnessUx'];
const expectedIds = ['snake', 'orbit', 'neonrail', 'slingshot', 'bubblebuster', 'matrix', 'knifetarget', 'roadcross'] as const;
const expectedHistorical: Record<(typeof expectedIds)[number], readonly number[]> = {
  snake: [8, 9, 9, 9, 7, 8], orbit: [8, 9, 9, 8, 8, 8], neonrail: [8, 9, 9, 8, 8, 8], slingshot: [8, 8, 9, 9, 8, 8],
  bubblebuster: [8, 9, 8, 8, 8, 8], matrix: [8, 9, 9, 8, 7, 8], knifetarget: [8, 8, 9, 8, 8, 8], roadcross: [8, 8, 9, 8, 8, 8],
};

assert(P22_S_THRESHOLD === 55, 'P22 S threshold must remain 55');
assert(P22_PROMOTIONS.length === 8 && new Set(P22_PROMOTIONS.map((record) => record.id)).size === 8, 'P22 must contain exactly eight unique promotion records');
assert(expectedIds.every((id) => P22_PROMOTIONS.some((record) => record.id === id)), 'P22 cohort does not match the eight remaining A-rank IDs');
assert(Object.keys(P22_TEACHING).length === 8, 'P22 teaching map must cover exactly eight candidates');
assert(P22_CLARITY_EXTENSIONS.length === 8, 'P22 must extend exactly eight P18 clarity profiles');

for (const record of P22_PROMOTIONS) {
  const historical = expectedHistorical[record.id];
  categories.forEach((category, index) => assert(record.historical[category] === historical[index], `${record.title} ${category} does not match immutable P15`));
  assert(p22Total(record.final) === 55 && p22Total(record.final) >= P22_S_THRESHOLD, `${record.title} final score must be exactly 55/60 S`);
  for (const category of categories) {
    const h = record.historical[category]; const pre = record.preP22[category]; const final = record.final[category];
    assert(pre >= h && pre <= h + 1, `${record.title} ${category} pre-P22 exceeds conservative +1 discipline`);
    assert(final >= pre && final <= h + 1, `${record.title} ${category} final exceeds immutable-P15 +1 discipline`);
    if (final > h) assert(Boolean(record.evidence[category]?.length && record.evidence[category]!.length >= 2), `${record.title} ${category} increase lacks evidence`);
  }
  assert(record.adversarialReview.length >= 2, `${record.title} lacks adversarial review`);
  const extended = getP22ExtendedClarityProfile(record.id);
  const extension = P22_CLARITY_EXTENSIONS.find((entry) => entry.id === record.id)!;
  assert(extended.masteryName === extension.masteryName && extended.mastery === extension.mastery, `${record.title} P18 mastery extension not applied`);
  assert(extended.sourceControls.length > 0, `${record.title} P22 clarity extension lost inherited sourceControls`);
}

const p15 = read('docs/P15_ROSTER_AUDIT.md');
for (const token of [
  '| 18 | Cyber Serpent | A | 8 | 9 | 9 | 9 | 7 | 8 | 50 |','| 19 | Orbit | A | 8 | 9 | 9 | 8 | 8 | 8 | 50 |','| 20 | Neon Rail Shift | A | 8 | 9 | 9 | 8 | 8 | 8 | 50 |','| 21 | Orbital Slingshot | A | 8 | 8 | 9 | 9 | 8 | 8 | 50 |',
  '| 22 | Orb Cannon | A | 8 | 9 | 8 | 8 | 8 | 8 | 49 |','| 23 | Memory Matrix | A | 8 | 9 | 9 | 8 | 7 | 8 | 49 |','| 24 | Knife Target | A | 8 | 8 | 9 | 8 | 8 | 8 | 49 |','| 25 | Cyber Crosser | A | 8 | 8 | 9 | 8 | 8 | 8 | 49 |','- **S:** 5','- **A:** 20','- **B:** 7',
]) assert(p15.includes(token), `immutable P15 token changed: ${token}`);

assert(P22_SNAKE_CHAPTERS.length === 5 && new Set(P22_SNAKE_CHAPTERS.map((chapter) => chapter.name)).size === 5, 'Serpent chapter roster invalid');
assert(P22_SNAKE_CHAPTERS.every((chapter) => chapter.threadTarget >= 2 && chapter.threadTarget <= 6), 'Serpent chapter target escaped bounded range');
assert(SNAKE_PHASE_THREAD_EXTENSION_EVERY === 3 && SNAKE_PHASE_THREAD_EXTENSION_TICKS === 6 && SNAKE_PHASE_THREAD_MAX_GHOST_TICKS === 90, 'Serpent Phase Thread timing/cap contract changed');
const snakeState = createP22RunState('snake');
assert(processP22GameplayEvent(snakeState, { gameId: 'snake', kind: 'phase-thread', value: 2 }, { firewallStage: 1 }) === 450, 'Serpent opening chapter cannot resolve from real Phase Thread state');

const routeNames = new Set(ORBIT_ROUTES.map((route) => route.name));
const formationNames = new Set(ORBIT_THREAT_FORMATIONS.map((formation) => formation.name));
assert(P22_ORBIT_CONSTELLATIONS.length === 6 && P22_ORBIT_CONSTELLATIONS.every((entry) => routeNames.has(entry.route) && formationNames.has(entry.formation)), 'Orbit Constellation roster invalid');
assert(ORBIT_FORMATION_WARNING_SEC === 1.2 && ORBIT_FORMATION_COOLDOWN_SEC === 7.2 && ORBIT_FORMATION_RESOLVE_SEC === 1.7 && ORBIT_FORMATION_GRACE_SEC === 2.0, 'Orbit certified threat timing changed');
assert(ORBIT_THREAT_FORMATIONS.every((formation) => !formation.targets.some((target) => target.lane === formation.safeLane)), 'Orbit safe-lane contract changed');

const railNames = new Set(['SWITCHBACK', 'SLALOM', 'HOLD_BREAK', 'CENTER_CUT']);
assert(P22_NEON_RAIL_SEQUENCES.length === 6 && P22_NEON_RAIL_SEQUENCES.every((sequence) => sequence.phrases.length === 3 && sequence.phrases.every((phrase) => railNames.has(phrase))), 'Rail Sequence roster invalid');
for (const value of [0.05, 0.3, 0.55, 0.85]) {
  const historicalPhrase = createNeonRailPhrase(1, value);
  assert(historicalPhrase.lanes.length === NEON_RAIL_MASTERY_STREAK, 'P22 changed certified six-row phrase contract');
  const sequence = createNeonRailSequence(1, value);
  assert(sequence.phrases.length === 3 && sequence.lanes.length === 18 && sequence.phrases.every((phrase) => phrase.lanes.length === 6), 'P22 Rail Sequence does not compose three normal phrases');
  assert(sequence.lanes.every((lane, index) => index === 0 || Math.abs(lane - sequence.lanes[index - 1]) <= 1), 'P22 Rail Sequence contains unreachable lane jump');
}
assert(NEON_RAIL_MAX_SURGE_CHARGES === 2 && NEON_RAIL_SURGE_DURATION === 5 && NEON_RAIL_SURGE_SPEED_MULTIPLIER === 1.18 && NEON_RAIL_SURGE_SCORE_MULTIPLIER === 2, 'Rail Surge contract changed');

assert(SLINGSHOT_MISSIONS.length === 4 && P22_SLINGSHOT_MISSION_ARCS.length === 4, 'Slingshot mission/arc roster changed');
assert(SLINGSHOT_MISSIONS.map((mission) => mission.target).join(',') === '3,6,3,3', 'Slingshot mission targets changed');
assert(getSlingshotMission(1).kind === 'LOCK_CHAIN' && getSlingshotMission(5).kind === 'LOCK_CHAIN', 'Slingshot four-sector mission cycle changed');
const slingshotKinds = new Set(SLINGSHOT_MISSIONS.map((mission) => mission.kind));
assert(P22_SLINGSHOT_MISSION_ARCS.every((arc) => slingshotKinds.has(arc.first) && slingshotKinds.has(arc.second)), 'Slingshot Arc uses unsupported mission kind');

assert(P22_ORB_SALVO_PLANS.length === 6, 'Orb Cannon must expose six Salvo Plans');
assert(ORB_BURST_MAX_CHARGES === 2 && ORB_BURST_START_CHARGES === 1 && ORB_BURST_EARN_COMBO === 4 && ORB_BURST_EARN_DROP_COUNT === 4, 'Orb Cannon Burst economy changed');
assert(canArmOrbBurst(1, false, false) && !canArmOrbBurst(0, false, false) && !canArmOrbBurst(1, true, false) && !canArmOrbBurst(1, false, true), 'Orb Cannon Burst guard changed');
assert(canSwapOrbChamber(false, false) && !canSwapOrbChamber(true, false) && !canSwapOrbChamber(false, true), 'Orb Cannon swap guard changed');
const orbState = createP22RunState('bubblebuster');
processP22GameplayEvent(orbState, { gameId: 'bubblebuster', kind: 'orb-swap' });
assert(processP22GameplayEvent(orbState, { gameId: 'bubblebuster', kind: 'orb-resolve', value: 1, aux: 0 }) === 500, 'Orb CHAMBER READ cannot resolve from swap→match events');

assert(MATRIX_PROTOCOLS.join(',') === 'FORWARD,REVERSE,MIRROR,REVERSE_MIRROR', 'Matrix protocol vocabulary changed');
assert(P22_MATRIX_PROTOCOL_SUITES.length === 6 && P22_MATRIX_PROTOCOL_SUITES.every((suite) => suite.protocols.length === 4 && suite.protocols.every((protocol) => MATRIX_PROTOCOLS.includes(protocol))), 'Matrix Protocol Suite roster invalid');
assert([1,2,3,4,5,6,7,8].map(getMatrixProtocolForRound).join(',') === 'FORWARD,FORWARD,REVERSE,REVERSE,MIRROR,MIRROR,REVERSE_MIRROR,REVERSE_MIRROR', 'Matrix rounds 1–8 changed');
assert(MATRIX_OVERCLOCK.sequenceBonus === 2 && MATRIX_OVERCLOCK.playbackScale === 0.78 && MATRIX_OVERCLOCK.stepScoreMultiplier === 1.5 && MATRIX_OVERCLOCK.clearScoreMultiplier === 1.8 && MATRIX_OVERCLOCK.disablesManualReplay, 'Matrix Overclock contract changed');

assert(P22_KNIFE_RAZOR_ROUTES.length === 2 && P22_KNIFE_RAZOR_ROUTES.every((route) => route.stageSteps[0] === 1 && route.stageSteps[2] === 6), 'Knife Razor Route cycle invalid');
assert(getKnifeRazorRouteSide(-0.02, 0, 0.1) === 'PRECISION TRACE' && getKnifeRazorRouteSide(0.02, 0, 0.1) === 'TEMPO TRACE', 'Knife route notches do not split the existing safe Razor tolerance');
assert(getKnifeRazorTolerance(999) === 0.09, 'Knife Razor tolerance floor changed');
const lateKnife = getKnifeStageConfig(999);
assert(lateKnife.baseSpeed <= 5.2 && lateKnife.knifeCount <= 14 && lateKnife.preBladeCount <= 5, 'Knife stage caps changed');

assert(ROAD_CROSS_DISTRICT_LENGTH === 8 && ROAD_CROSS_DISTRICTS.map((district) => district.name).join(',') === 'NEON SUBURB,RUSH CIRCUIT,FLOOD CHANNEL,RAILWORKS', 'Crosser district structure changed');
assert(getRoadCrossDistrictStartRow(0) === 0 && getRoadCrossDistrictStartRow(1) === 12 && getRoadCrossDistrictStartRow(2) === 20, 'Crosser P22 route origins do not align to district boundaries');
for (const district of ROAD_CROSS_DISTRICTS) { const routes = P22_ROAD_DISTRICT_ROUTES[district.name]; assert(Boolean(routes?.length === 2 && routes.every((route) => route.waypoints.length === 3)), `${district.name} District Routes invalid`); }
assert(canAcceptRoadCrossMove(1) && !canAcceptRoadCrossMove(0.9), 'Crosser accepted-move gate changed');

const main = read('src/main.tsx'); const runtime = read('src/lib/p22PromotionRuntime.ts'); const css = read('src/p22-mid-a-promotion.css'); const bubbleGame = read('src/games/BubbleBusterGame.tsx');
assert(main.includes('installP22PromotionRuntime') && main.includes("import './p22-mid-a-promotion.css'"), 'P22 runtime/style install missing');
for (const token of ['p22-promotion-hud','p22-pause-extension','emitP17GameFeel']) assert(runtime.includes(token) || css.includes(token), `P22 presentation missing ${token}`);
assert(bubbleGame.includes('getOrbSalvoResolutionBonus') && bubbleGame.includes('SALVO PLAN'), 'Orb Salvo bonus not integrated into authoritative score feedback');

for (const [path, token] of [['src/lib/gameFeelRuntime.ts','P17_FEEDBACK_EVENT'],['src/lib/gameClarityProfiles.ts','P18_GAME_CLARITY_BY_ID'],['src/lib/arcadeCohesionRuntime.ts','p19'],['scripts/p20-promotion-scorecards.ts','P20_PROMOTIONS'],['scripts/p21-promotion-scorecards.ts','P21_PROMOTIONS']] as const) assert(read(path).includes(token), `P22 continuity missing ${token} in ${path}`);

const p22AppFiles = ['src/lib/p22GameplayEvents.ts','src/lib/p22PromotionStructures.ts','src/lib/p22PromotionState.ts','src/lib/p22PromotionRuntime.ts','src/lib/p22ClarityProfileExtensions.ts','src/lib/orbitConstellationMastery.ts','src/lib/knifeRazorRoutes.ts','src/p22-mid-a-promotion.css'];
const forbidden = ['ReplayRecorder','ReplayPlayer','GhostRun','RunRecording','InputRecording','PlaybackTimeline','ReplayExport','RunHistory','DailyChallenge','WeeklyChallenge','BattlePass','PlayerXP','ArcadeCurrency','UnlockTree'];
for (const path of p22AppFiles) for (const token of forbidden) assert(!read(path).includes(token), `${path} introduces forbidden P22 concept ${token}`);

const pkg = read('package.json'); const ci = read('.github/workflows/ci.yml'); const release = read('scripts/audit-release-32.ts');
assert(pkg.includes('"quality:gameplay-p22"') && pkg.includes('"quality:browser-p22"'), 'package.json missing P22 quality scripts');
assert(ci.includes('quality:gameplay-p22') && ci.includes('quality:browser-p22'), 'CI missing P22 gates');
assert(release.includes('P22') || release.includes('p22'), 'release32 not extended through P22');

if (errors.length) { console.error('P22 MID-A PROMOTION CERTIFICATION — FAIL'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('P22 MID-A PROMOTION CERTIFICATION — PASS');
for (const record of P22_PROMOTIONS) console.log(`${record.title}: ${p22Total(record.final)}/60 — S`);
console.log('8/8 promotion records certified. Every changed category is evidence-backed and no category exceeds immutable P15 by more than +1.');
console.log('Historical P15: 5 S / 20 A / 7 B');
console.log('P21: 17 S / 8 A / 7 B');
console.log('Current P22: 25 S / 0 A / 7 B');
console.log('Automation certifies objective source/runtime contracts, not subjective fun or taste.');
