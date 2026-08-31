import { readFileSync } from 'node:fs';
import { REACTION_ROUNDS } from '../src/lib/reactionGameplay';
import {
  REACTION_OVERTIME_ROUNDS,
  isReactionOvertimeUnlocked,
} from '../src/lib/reactionOvertime';
import { PERFECT_STOP_ROUNDS, getPerfectStopMarkerSpeed, getPerfectStopTargetPosition } from '../src/lib/perfectStopGameplay';
import {
  PERFECT_STOP_ENCORE_ROUNDS,
  isPerfectStopEncoreUnlocked,
} from '../src/lib/perfectStopEncore';
import {
  ROAD_CROSS_DISTRICTS,
  ROAD_CROSS_DISTRICT_LENGTH,
  getRoadCrossCheckpointBonus,
  getRoadCrossDistrict,
  getRoadCrossDistrictLevel,
  getRoadCrossLaneType,
} from '../src/lib/roadCrossMastery';

const read = (path: string) => readFileSync(path, 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

// Reaction — preserve the P1 core and make mastery unlock a harder overtime.
assert(REACTION_ROUNDS.length === 8, 'Reaction P1 core must remain eight rounds');
assert(REACTION_OVERTIME_ROUNDS.length === 3, 'Reaction must expose three overtime rounds');
assert(REACTION_OVERTIME_ROUNDS[0].kind === 'choice', 'Reaction overtime must open with choice pressure');
assert(REACTION_OVERTIME_ROUNDS[1].kind === 'inhibit', 'Reaction overtime must include inhibition pressure');
assert(REACTION_OVERTIME_ROUNDS[2].kind === 'mixed', 'Reaction overtime must end with mixed pressure');
assert(REACTION_OVERTIME_ROUNDS.every((round) => round.waitMinMs >= 250), 'Reaction overtime encourages unsafe anticipation');
assert(REACTION_OVERTIME_ROUNDS[2].scoreMultiplier > REACTION_ROUNDS[7].scoreMultiplier, 'Reaction overtime does not reward extra difficulty');
assert(isReactionOvertimeUnlocked(6, 2), 'Reaction qualifying run does not unlock overtime');
assert(!isReactionOvertimeUnlocked(5, 0), 'Reaction overtime unlocks without enough correct attempts');
assert(!isReactionOvertimeUnlocked(8, 3), 'Reaction overtime ignores the mistake limit');

// Perfect Stop — preserve seven core sectors, then offer three mastery-only sectors.
assert(PERFECT_STOP_ROUNDS.length === 7, 'Perfect Stop P1 core must remain seven sectors');
assert(PERFECT_STOP_ENCORE_ROUNDS.length === 3, 'Perfect Stop must expose three Master Encore sectors');
assert(new Set(PERFECT_STOP_ENCORE_ROUNDS.map((round) => round.id)).size === 3, 'Perfect Stop encore IDs are not unique');
assert(PERFECT_STOP_ENCORE_ROUNDS[2].markerSpeedPerSecond > PERFECT_STOP_ROUNDS[6].markerSpeedPerSecond, 'Perfect Stop encore does not escalate sweep speed');
assert(PERFECT_STOP_ENCORE_ROUNDS[2].goodWindow < PERFECT_STOP_ROUNDS[6].goodWindow, 'Perfect Stop encore does not tighten precision');
assert(isPerfectStopEncoreUnlocked(4), 'Perfect Stop four mastery hits should unlock encore');
assert(!isPerfectStopEncoreUnlocked(3), 'Perfect Stop encore unlock threshold became too lenient');
for (const round of PERFECT_STOP_ENCORE_ROUNDS) {
  for (let elapsed = 0; elapsed <= 10000; elapsed += 173) {
    const target = getPerfectStopTargetPosition(round, elapsed);
    const speed = getPerfectStopMarkerSpeed(round, elapsed);
    assert(target >= 8 && target <= 92, `${round.id}: encore target escaped safe bounds`);
    assert(speed > 20 && speed < 400, `${round.id}: encore speed escaped playable bounds`);
  }
}

// Cyber Crosser — authored districts must be recognizable without creating walls of danger.
assert(ROAD_CROSS_DISTRICTS.length === 4, 'Cyber Crosser must expose four district identities');
assert(new Set(ROAD_CROSS_DISTRICTS.map((district) => district.name)).size === 4, 'Cyber Crosser district names are not unique');
for (const district of ROAD_CROSS_DISTRICTS) {
  assert(district.pattern.length === ROAD_CROSS_DISTRICT_LENGTH, `${district.name}: district length changed`);
  assert(district.pattern.filter((lane) => lane === 'grass').length >= 3, `${district.name}: district lacks safe rest lanes`);
  let dangerRun = 0;
  let maxDangerRun = 0;
  for (const lane of district.pattern) {
    dangerRun = lane === 'grass' ? 0 : dangerRun + 1;
    maxDangerRun = Math.max(maxDangerRun, dangerRun);
  }
  assert(maxDangerRun <= 3, `${district.name}: district creates an excessive uninterrupted danger run`);
}
assert(getRoadCrossLaneType(1) === 'grass' && getRoadCrossLaneType(3) === 'grass', 'Cyber Crosser opening safety buffer changed');
for (let row = 4; row < 36; row++) {
  const district = getRoadCrossDistrict(row);
  const level = getRoadCrossDistrictLevel(row);
  const offset = (row - 4) % ROAD_CROSS_DISTRICT_LENGTH;
  assert(getRoadCrossLaneType(row) === district.pattern[offset], `Cyber Crosser row ${row} does not follow its authored district`);
  assert(level >= 0, `Cyber Crosser row ${row} has invalid district level`);
}
assert(getRoadCrossCheckpointBonus(2) > getRoadCrossCheckpointBonus(1), 'Cyber Crosser checkpoint rewards do not escalate');

const reactionSource = read('src/games/ReactionGame.tsx');
const perfectSource = read('src/games/PerfectStopGame.tsx');
const roadSource = read('src/games/RoadCrossGame.tsx');
const registry = read('src/data/games.ts');
for (const token of ['REACTION_OVERTIME_ROUNDS', 'isReactionOvertimeUnlocked', 'OVERTIME UNLOCKED']) {
  assert(reactionSource.includes(token), `Reaction P6 integration missing ${token}`);
}
for (const token of ['PERFECT_STOP_ENCORE_ROUNDS', 'isPerfectStopEncoreUnlocked', 'MASTER ENCORE']) {
  assert(perfectSource.includes(token), `Perfect Stop P6 integration missing ${token}`);
}
for (const token of ['getRoadCrossLaneType', 'getRoadCrossDistrict', 'getRoadCrossCheckpointBonus', 'districtName']) {
  assert(roadSource.includes(token), `Cyber Crosser P6 integration missing ${token}`);
}
for (const phrase of ['three-round adaptive overtime', 'three-sector Master Encore', 'authored eight-row districts']) {
  assert(registry.includes(phrase), `registry is missing P6 teaching phrase: ${phrase}`);
}

if (errors.length) {
  console.error('P6 NEW BOTTOM-THREE ELEVATION AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P6 NEW BOTTOM-THREE ELEVATION AUDIT — PASS');
console.log('Reaction overtime, Perfect Stop Master Encore, and Cyber Crosser district mastery are certified.');
