import { readFileSync } from 'node:fs';
import {
  applyMatrixProtocol,
  getMatrixProtocolForRound,
  mirrorMatrixNode,
} from '../src/lib/matrixProtocols';
import {
  TYPE_RUSH_WAVES,
  chooseTypeRushWord,
  getTypeRushWave,
} from '../src/lib/typeRushProgression';
import {
  createNeonRailChallengePattern,
  createNeonRailPhrase,
  mirrorNeonRailPhrase,
} from '../src/lib/neonRailDepth';
import type { NeonRailLane } from '../src/lib/neonRailShift';
import {
  getKnifeStageConfig,
  getKnifeStageRotationSpeed,
} from '../src/lib/knifeStageProgression';
import {
  getPacFrightenedDuration,
  getPacGhostMode,
  getPacGhostSpeed,
  getPacGhostTarget,
} from '../src/lib/pacGhostAi';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

// ---------------------------------------------------------------------------
// Memory Matrix — transformed recall protocols must add mastery, not randomness.
// ---------------------------------------------------------------------------
const expectedProtocols = [
  'FORWARD', 'FORWARD',
  'REVERSE', 'REVERSE',
  'MIRROR', 'MIRROR',
  'REVERSE_MIRROR', 'REVERSE_MIRROR',
];
expectedProtocols.forEach((protocol, index) => {
  assert(getMatrixProtocolForRound(index + 1) === protocol, `Matrix round ${index + 1} protocol drifted`);
});
for (let node = 0; node < 9; node++) {
  assert(mirrorMatrixNode(mirrorMatrixNode(node)) === node, `Matrix mirror is not an involution for node ${node}`);
}
const matrixSample = [0, 1, 5];
assert(JSON.stringify(applyMatrixProtocol(matrixSample, 'FORWARD')) === '[0,1,5]', 'Matrix forward transform failed');
assert(JSON.stringify(applyMatrixProtocol(matrixSample, 'REVERSE')) === '[5,1,0]', 'Matrix reverse transform failed');
assert(JSON.stringify(applyMatrixProtocol(matrixSample, 'MIRROR')) === '[2,1,3]', 'Matrix mirror transform failed');
assert(JSON.stringify(applyMatrixProtocol(matrixSample, 'REVERSE_MIRROR')) === '[3,1,2]', 'Matrix reverse+mirror transform failed');

// ---------------------------------------------------------------------------
// Type Rush — waves must become denser, faster, longer, and more valuable.
// ---------------------------------------------------------------------------
assert(TYPE_RUSH_WAVES.length === 4, 'Type Rush must expose four progression waves');
for (let index = 1; index < TYPE_RUSH_WAVES.length; index++) {
  const previous = TYPE_RUSH_WAVES[index - 1];
  const current = TYPE_RUSH_WAVES[index];
  assert(current.startsAtSeconds > previous.startsAtSeconds, `Type Rush wave ${current.label} start time is not increasing`);
  assert(current.maxWords >= previous.maxWords, `Type Rush wave ${current.label} reduces active-word pressure`);
  assert(current.spawnIntervalMs < previous.spawnIntervalMs, `Type Rush wave ${current.label} does not spawn faster`);
  assert(current.speedMultiplier >= previous.speedMultiplier, `Type Rush wave ${current.label} slows falling words`);
  assert(current.scoreMultiplier > previous.scoreMultiplier, `Type Rush wave ${current.label} does not reward added difficulty`);
}
const averageLength = (words: readonly string[]) => words.reduce((sum, word) => sum + word.length, 0) / words.length;
assert(averageLength(TYPE_RUSH_WAVES[2].words) > averageLength(TYPE_RUSH_WAVES[0].words) + 2, 'Type Rush later waves do not meaningfully increase word length');
assert(getTypeRushWave(0).label === 'BOOT', 'Type Rush opening wave changed');
assert(getTypeRushWave(90).label === 'REDLINE', 'Type Rush endgame wave changed');
const chosenWithoutDuplicate = chooseTypeRushWord(TYPE_RUSH_WAVES[0], [TYPE_RUSH_WAVES[0].words[0]], 0);
assert(chosenWithoutDuplicate !== TYPE_RUSH_WAVES[0].words[0], 'Type Rush word chooser ignores active duplicates');

// ---------------------------------------------------------------------------
// Neon Rail Shift — authored phrases stay reachable; Phase routes are optional.
// ---------------------------------------------------------------------------
const phraseNames = new Set<string>();
for (const start of [0, 1, 2] as NeonRailLane[]) {
  for (const randomValue of [0.05, 0.3, 0.55, 0.85]) {
    const phrase = createNeonRailPhrase(start, randomValue);
    phraseNames.add(phrase.name);
    assert(phrase.lanes[0] === start, `${phrase.name} does not begin on the current safe lane`);
    for (let index = 1; index < phrase.lanes.length; index++) {
      assert(
        Math.abs(phrase.lanes[index] - phrase.lanes[index - 1]) <= 1,
        `${phrase.name} contains an unreachable two-lane jump`,
      );
    }
    const mirrored = mirrorNeonRailPhrase(phrase);
    assert(mirrored.lanes.length === phrase.lanes.length, `${phrase.name} mirror changed phrase length`);
  }
}
assert(phraseNames.size === 4, `expected four Neon Rail phrase identities, found ${phraseNames.size}`);
let phaseOpportunities = 0;
for (let row = 0; row < 100; row++) {
  const safeLane = (row % 3) as NeonRailLane;
  const pattern = createNeonRailChallengePattern(safeLane, row, ((row * 37) % 101) / 101);
  assert(!pattern.blockedLanes.includes(pattern.safeLane), `Neon Rail row ${row} blocks its safe lane`);
  assert(pattern.blockedLanes.length >= 1 && pattern.blockedLanes.length <= 2, `Neon Rail row ${row} has invalid obstacle density`);
  if (pattern.phaseOpportunity) {
    phaseOpportunities++;
    assert(pattern.blockedLanes.includes(pattern.coreLane), `Neon Rail phase route ${row} is not actually blocked`);
  } else {
    assert(pattern.coreLane === pattern.safeLane, `Neon Rail normal route ${row} stops guiding the safe lane`);
  }
}
assert(phaseOpportunities >= 15, 'Neon Rail does not offer Phase scoring routes often enough');

// ---------------------------------------------------------------------------
// Knife Target — six authored stage identities must remain mechanically distinct.
// ---------------------------------------------------------------------------
const knifeModes = Array.from({ length: 6 }, (_, index) => getKnifeStageConfig(index + 1).mode);
assert(new Set(knifeModes).size === 6, 'Knife Target first six stages are not six distinct identities');
const backspin = getKnifeStageConfig(2);
const pulse = getKnifeStageConfig(3);
const shield = getKnifeStageConfig(4);
const precision = getKnifeStageConfig(5);
const boss = getKnifeStageConfig(6);
assert(backspin.reverseInterval > 0, 'Knife Backspin stage no longer reverses');
assert(pulse.pulseAmplitude > 0, 'Knife Pulse stage no longer varies speed');
assert(shield.shieldCount > 0, 'Knife Shield stage has no shield arc');
assert(precision.preBladeCount >= 3, 'Knife Precision stage lacks obstacle density');
assert(boss.reverseInterval > 0 && boss.pulseAmplitude > 0 && boss.shieldCount >= 2, 'Knife Boss stage lost its combined challenge');
assert(getKnifeStageConfig(7).baseSpeed > getKnifeStageConfig(1).baseSpeed, 'Knife difficulty does not scale across stage cycles');
assert(
  Math.abs(getKnifeStageRotationSpeed(pulse, 0, 1) - getKnifeStageRotationSpeed(pulse, 0.5, 1)) > 0.1,
  'Knife Pulse stage rotation does not actually pulse',
);

// ---------------------------------------------------------------------------
// Pac-Runner — personalities + chase/scatter + level scaling must be explicit.
// ---------------------------------------------------------------------------
assert(getPacGhostMode(0, 1) === 'SCATTER', 'Pac level should open in scatter mode');
assert(getPacGhostMode(6, 1) === 'CHASE', 'Pac level never transitions into chase mode');
const ghosts = [
  { id: 0, x: 4, y: 5, scatterX: 18, scatterY: 0 },
  { id: 1, x: 8, y: 8, scatterX: 0, scatterY: 0 },
  { id: 2, x: 10, y: 8, scatterX: 18, scatterY: 21 },
  { id: 3, x: 8, y: 10, scatterX: 0, scatterY: 21 },
];
const player = { px: 9, py: 10, dirX: 1, dirY: 0 };
const chaseTargets = ghosts.map((ghost) => getPacGhostTarget(ghost, ghosts, player, 'CHASE'));
assert(JSON.stringify(chaseTargets[0]) === '{"x":9,"y":10}', 'Blinky no longer directly chases the player');
assert(JSON.stringify(chaseTargets[1]) === '{"x":13,"y":10}', 'Pinky no longer ambushes ahead of the player');
assert(chaseTargets[2].x !== chaseTargets[0].x || chaseTargets[2].y !== chaseTargets[0].y, 'Inky collapsed into Blinky targeting');
assert(JSON.stringify(chaseTargets[3]) === '{"x":0,"y":21}', 'Clyde no longer retreats when close');
assert(getPacGhostSpeed(6, false) > getPacGhostSpeed(1, false), 'Pac ghost speed does not scale with level');
assert(getPacGhostSpeed(1, true) < getPacGhostSpeed(1, false), 'Frightened ghosts are not slower');
assert(getPacFrightenedDuration(8) < getPacFrightenedDuration(1), 'Pac power duration does not tighten at higher levels');
assert(getPacFrightenedDuration(100) >= 4.5, 'Pac frightened duration falls below fairness floor');

// ---------------------------------------------------------------------------
// Integration checks — gameplay helpers must actually drive the game sources.
// ---------------------------------------------------------------------------
const matrixSource = readFileSync('src/games/MatrixGame.tsx', 'utf8');
const typeRushSource = readFileSync('src/games/TypeRushGame.tsx', 'utf8');
const railSource = readFileSync('src/games/NeonRailShiftGame.tsx', 'utf8');
const knifeSource = readFileSync('src/games/KnifeTargetGame.tsx', 'utf8');
const pacSource = readFileSync('src/games/PacMazeGame.tsx', 'utf8');
const registrySource = readFileSync('src/data/games.ts', 'utf8');

for (const token of ['getMatrixProtocolForRound', 'applyMatrixProtocol', 'expectedSequence', 'PROTOCOL']) {
  assert(matrixSource.includes(token), `Matrix P2 integration missing ${token}`);
}
for (const token of ['getTypeRushWave', 'chooseTypeRushWord', 'waveLabel', 'wave.scoreMultiplier']) {
  assert(typeRushSource.includes(token), `Type Rush P2 integration missing ${token}`);
}
assert(!typeRushSource.includes('const WORD_BANK = ['), 'Type Rush reverted to one flat word bank');
for (const token of ['createNeonRailPhrase', 'createNeonRailChallengePattern', 'phraseName', 'phaseCore']) {
  assert(railSource.includes(token), `Neon Rail P2 integration missing ${token}`);
}
for (const token of ['getKnifeStageConfig', 'getKnifeStageRotationSpeed', 'stageLabel', 'reverseTimer']) {
  assert(knifeSource.includes(token), `Knife Target P2 integration missing ${token}`);
}
for (const token of ['getPacGhostMode', 'getPacGhostTarget', 'getPacGhostSpeed', 'state.level++', 'ghostMode']) {
  assert(pacSource.includes(token), `Pac-Runner P2 integration missing ${token}`);
}
for (const phrase of [
  'transforming memory protocols',
  'four escalating typing waves',
  'authored rail phrases',
  'six rotating stage identities',
  'chase/scatter cycles',
]) {
  assert(registrySource.includes(phrase), `game registry is missing P2 description phrase: ${phrase}`);
}

if (errors.length) {
  console.error('P2 GAMEPLAY / REPLAY-DEPTH AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P2 GAMEPLAY / REPLAY-DEPTH AUDIT — PASS');
console.log('Matrix protocols, Type Rush waves, Rail phrases/Phase routes, Knife stage identities, and Pac chase/scatter level mastery are certified.');
