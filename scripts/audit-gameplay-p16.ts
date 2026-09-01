import { readFileSync } from 'node:fs';
import {
  LASER_ROPE_MODE_MIN_WARNING_SEC,
  canApplyLaserRopeModeChange,
  getLaserRopeModeWarningSec,
} from '../src/lib/laserRopeBalance';
import { LASER_ROPE_REDLINE_SPEED_MULTIPLIER } from '../src/lib/laserRopeRedline';
import { AERO_FLOW_SPEED_MULTIPLIER } from '../src/lib/aeroMastery';
import { REACTION_ROUNDS } from '../src/lib/reactionGameplay';
import { REACTION_OVERTIME_ROUNDS } from '../src/lib/reactionOvertime';
import { TYPE_RUSH_WAVES } from '../src/lib/typeRushProgression';

const read = (path: string) => readFileSync(path, 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const report = read('docs/P16_BALANCE_CERTIFICATION.md');
const registry = read('src/data/games.ts');
const reaction = read('src/games/ReactionGame.tsx');
const rope = read('src/games/LaserRopeGame.tsx');
const stack = read('src/games/StackGame.tsx');
const aero = read('src/games/FlappyAeroGame.tsx');
const pulse = read('src/games/PulseGame.tsx');
const drift = read('src/games/DriftGame.tsx');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
const ci = read('.github/workflows/ci.yml');
const release = read('scripts/audit-release-32.ts');

const registryEntries = [...registry.matchAll(
  /^\s{4}id:\s*'([a-z0-9-]+)',\s*\n\s{4}title:\s*'([^']+)'/gm,
)].map((match) => ({ id: match[1], title: match[2] }));
assert(registryEntries.length === 32, `P16 expected 32 registry games, found ${registryEntries.length}`);

const balanceRows = [...report.matchAll(
  /^\|\s*([a-z0-9-]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(Low|Med|High)\s*\|\s*(Low|Med|High)\s*\|\s*(Low|Med|High)\s*\|\s*([^|]+?)\s*\|\s*PASS\s*\|$/gm,
)].map((match) => ({ id: match[1], title: match[2].trim() }));
assert(balanceRows.length === 32, `P16 balance matrix must contain exactly 32 PASS rows, found ${balanceRows.length}`);
assert(new Set(balanceRows.map((row) => row.id)).size === 32, 'P16 balance matrix contains duplicate IDs');
for (const entry of registryEntries) {
  const row = balanceRows.find((candidate) => candidate.id === entry.id);
  assert(Boolean(row), `P16 balance matrix is missing ${entry.id}`);
  if (row) assert(row.title === entry.title, `P16 title mismatch for ${entry.id}: ${row.title} vs ${entry.title}`);
}

for (const heading of [
  '## Quantitative priority probes',
  '### Stack',
  '### Aero Pulse',
  '### Laser Rope Reflex',
  '### Pulse',
  '### Reaction',
  '### Type Rush',
  '### Cyber Drift',
  '### Dodge / Gravity Tower / Cyber Crosser / Orb Cannon',
  '## Exit decision',
]) {
  assert(report.includes(heading), `P16 report is missing required section ${heading}`);
}

// Stack: physical progression only, capped and independent from mastery score.
assert(stack.includes('Math.min(4.5, Math.max(0, state.blocks.length - 1) * 0.08)'), 'Stack physical speed ramp marker changed');
assert(!stack.includes('state.score * 0.08'), 'Stack speed regressed to score-driven progression');

// Aero: bounded base pressure. Optional Flow may intentionally exceed the base envelope.
assert(aero.includes('Math.min(280, 175 + state.gatesCleared * 3.0)'), 'Aero base speed cap changed');
assert(aero.includes('Math.max(90, 130 - state.gatesCleared * 0.8)'), 'Aero minimum gate gap changed');
assert(aero.includes('Math.random() * 40 + 200'), 'Aero gate-spacing floor changed');
assert(200 / 280 >= 0.7, 'Aero base generated-anchor interval fell below 0.7 s');
assert(AERO_FLOW_SPEED_MULTIPLIER > 1 && AERO_FLOW_SPEED_MULTIPLIER <= 1.2, 'Aero Flow risk multiplier escaped the certified bound');

// Laser Rope: retain late speed, but mode vocabulary may not change immediately before a crossing.
assert(LASER_ROPE_MODE_MIN_WARNING_SEC === 0.38, 'Laser Rope mode warning floor changed');
assert(LASER_ROPE_REDLINE_SPEED_MULTIPLIER === 1.22, 'Laser Rope Redline speed multiplier changed');
const ropeMaxRiskSpeed = 5.4 * LASER_ROPE_REDLINE_SPEED_MULTIPLIER;
const safeAngle = Math.PI / 2 + 0.1;
const unsafeAngle = Math.PI / 2 - 0.1;
assert(getLaserRopeModeWarningSec(safeAngle, 1, ropeMaxRiskSpeed, 2) >= LASER_ROPE_MODE_MIN_WARNING_SEC, 'Laser Rope dual-mode safe transition window is unreachable at max Redline speed');
assert(canApplyLaserRopeModeChange(safeAngle, 1, ropeMaxRiskSpeed, 2), 'Laser Rope safe dual transition is rejected');
assert(!canApplyLaserRopeModeChange(unsafeAngle, 1, ropeMaxRiskSpeed, 1), 'Laser Rope near-crossing mode transition is not blocked');
assert(rope.includes('canApplyLaserRopeModeChange('), 'Laser Rope source does not guard mode transitions by beam phase');
assert(rope.includes('state.modeChangeTimer = 0.08;'), 'Laser Rope source does not retry deferred unsafe mode changes');
assert(rope.includes('Math.min(5.4, 2.2 + state.jumpStreak * 0.1)'), 'Laser Rope late sweep-speed cap changed');

// Reaction: all 11 rounds must use the same scheduling lookup.
const reactionRounds = [...REACTION_ROUNDS, ...REACTION_OVERTIME_ROUNDS];
assert(reactionRounds.length === 11, `Reaction expected 11 total rounds, found ${reactionRounds.length}`);
assert(Math.min(...reactionRounds.map((round) => round.waitMinMs)) >= 260, 'Reaction launch-delay floor dropped below 260 ms');
const decoys = reactionRounds.filter((round) => round.decoyMs > 0).map((round) => round.decoyMs);
assert(Math.min(...decoys) >= 320, 'Reaction inhibition decoy floor dropped below 320 ms');
assert(reaction.includes('const config = getSessionRound(index);'), 'Reaction scheduler is not using the combined core/overtime round lookup');
assert(!reaction.includes('const config = REACTION_ROUNDS[index];'), 'Reaction overtime scheduler regressed to the 8-round core array');

// Pulse: pattern variety is preserved while the dynamic ceiling stays bounded.
assert(pulse.includes("baseBpm: 78"), 'Pulse low-tempo pattern marker changed');
assert(pulse.includes("baseBpm: 126"), 'Pulse high-tempo pattern marker changed');
assert(pulse.includes('Math.min(155, selectedPattern.baseBpm + comboBoost)'), 'Pulse dynamic BPM cap changed');
assert(pulse.includes('if (absDiff <= 8)') && pulse.includes('else if (absDiff <= 18)') && pulse.includes('else if (absDiff <= 28)'), 'Pulse base judgement windows changed');

// Type Rush: the authored four-wave pressure curve must stay monotonic.
assert(TYPE_RUSH_WAVES.length === 4, `Type Rush expected 4 waves, found ${TYPE_RUSH_WAVES.length}`);
for (let i = 1; i < TYPE_RUSH_WAVES.length; i++) {
  const previous = TYPE_RUSH_WAVES[i - 1];
  const current = TYPE_RUSH_WAVES[i];
  assert(current.startsAtSeconds > previous.startsAtSeconds, `Type Rush wave ${current.label} no longer starts after ${previous.label}`);
  assert(current.spawnIntervalMs < previous.spawnIntervalMs, `Type Rush spawn interval does not tighten at ${current.label}`);
  assert(current.speedMultiplier >= previous.speedMultiplier, `Type Rush speed regresses at ${current.label}`);
  assert(current.maxWords >= previous.maxWords, `Type Rush simultaneous-word ceiling regresses at ${current.label}`);
}

// Drift: speed and spawn cadence remain independently bounded on the 60 Hz clock.
assert(drift.includes('speed: 6.8'), 'Drift base speed changed');
assert(drift.includes('maxSpeed: 9.2'), 'Drift max speed changed');
assert(drift.includes('st.maxSpeed * 1.55'), 'Drift Nitro speed multiplier changed');
assert(drift.includes('state.boostTimer = 1.8') || drift.includes('st.boostTimer = 1.8'), 'Drift Nitro duration marker changed');
assert(drift.includes('if (st.spawnTimer > 48)'), 'Drift event spawn cadence changed');

assert(pkg.scripts?.['quality:gameplay-p16'] === 'bun scripts/audit-gameplay-p16.ts', 'package.json is missing the permanent P16 command');
assert(ci.includes('bun run quality:gameplay-p15\n      - run: bun run quality:gameplay-p16'), 'CI must run P16 immediately after P15');
assert(release.includes("'quality:gameplay-p16'"), 'release32 required gate list is missing P16');
assert(release.includes("'scripts/audit-gameplay-p16.ts'"), 'release32 required audit file list is missing P16');

if (errors.length) {
  console.error('P16 DIFFICULTY / BALANCE CERTIFICATION — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P16 DIFFICULTY / BALANCE CERTIFICATION — PASS');
console.log('32/32 roster pacing profiles are present; priority quantitative envelopes and the Reaction/Laser Rope corrections are certified.');
console.log('P16 preserves game-specific session identities rather than normalizing all games to one difficulty or duration.');
