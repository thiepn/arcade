import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const report = read('docs/P15_ROSTER_AUDIT.md');
const registry = read('src/data/games.ts');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
const ci = read('.github/workflows/ci.yml');
const release = read('scripts/audit-release-32.ts');

const P15_HISTORICAL_BASELINE_SHA = '1f427cdabf977e4ad16ef29611244c109d54d26a';
const P15_HISTORICAL_SCORE_SIGNATURE = '1:Neon Pinball:S:10,10,9,10,10,9:58|2:Galaxy Vanguard:S:10,9,10,9,10,9:57|3:Astro Blaster 360:S:10,10,9,9,10,9:57|4:Cyber Block Drop:S:10,10,9,10,8,9:56|5:Neon Rhythm Tapper:S:9,9,9,10,9,9:55|6:Gravity:A:9,10,10,9,8,8:54|7:Chain:A:9,10,9,9,8,9:54|8:Merge:A:9,10,9,9,8,9:54|9:Cyber Drift:A:9,9,9,9,9,8:53|10:Dodge:A:9,9,9,9,9,8:53|11:Laser Blade:A:9,9,8,9,10,8:53|12:Breakout Mini:A:9,9,9,9,8,8:52|13:Neon Puck Smash:A:9,9,8,9,9,8:52|14:Gravity Tower Jumper:A:9,9,9,8,9,8:52|15:Cyber Pac-Runner:A:9,9,9,8,8,8:51|16:One Line:A:9,10,9,8,7,8:51|17:Chrono Wave:A:9,9,9,8,8,8:51|18:Cyber Serpent:A:8,9,9,9,7,8:50|19:Orbit:A:8,9,9,8,8,8:50|20:Neon Rail Shift:A:8,9,9,8,8,8:50|21:Orbital Slingshot:A:8,8,9,9,8,8:50|22:Orb Cannon:A:8,9,8,8,8,8:49|23:Memory Matrix:A:8,9,9,8,7,8:49|24:Knife Target:A:8,8,9,8,8,8:49|25:Cyber Crosser:A:8,8,9,8,8,8:49|26:Type Rush:B:8,8,9,8,7,8:48|27:Perfect Stop:B:8,7,9,8,8,8:48|28:Reaction:B:8,8,9,7,7,8:47|29:Pulse:B:8,7,8,7,9,8:47|30:Laser Rope Reflex:B:8,7,8,7,8,8:46|31:Aero Pulse:B:8,7,8,7,8,8:46|32:Stack:B:8,7,7,7,8,8:45';
const P15_TOP_FIVE = [
  'Neon Pinball',
  'Galaxy Vanguard',
  'Astro Blaster 360',
  'Cyber Block Drop',
  'Neon Rhythm Tapper',
] as const;
const P15_BOTTOM_FIVE = [
  'Stack',
  'Aero Pulse',
  'Laser Rope Reflex',
  'Pulse',
  'Reaction',
] as const;

const registryEntries = [...registry.matchAll(
  /^\s{4}id:\s*'([a-z0-9-]+)',\s*\n\s{4}title:\s*'([^']+)'/gm,
)].map((match) => ({ id: match[1], title: match[2] }));

assert(registryEntries.length === 32, `P15 expected 32 registry games, found ${registryEntries.length}`);
assert(new Set(registryEntries.map((entry) => entry.id)).size === 32, 'P15 registry contains duplicate IDs');
assert((registry.match(/description:\s*'[^']+'/g) ?? []).length === 32, 'P15 requires a description for every game');
assert((registry.match(/instructions:\s*'[^']+'/g) ?? []).length === 32, 'P15 requires instructions for every game');
assert((registry.match(/controlsHint:\s*'[^']+'/g) ?? []).length === 32, 'P15 requires a controls hint for every game');

const rowPattern = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([SABCDF])\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/gm;
const rows = [...report.matchAll(rowPattern)].map((match) => ({
  rank: Number(match[1]),
  title: match[2].trim(),
  grade: match[3],
  scores: [4, 5, 6, 7, 8, 9].map((index) => Number(match[index])),
  total: Number(match[10]),
}));

assert(rows.length === 32, `P15 report must contain exactly 32 scored rows, found ${rows.length}`);
assert(
  report.includes(`Baseline: \`${P15_HISTORICAL_BASELINE_SHA}\` (post-P14 production)`),
  'P15 historical baseline SHA changed',
);
assert(new Set(rows.map((row) => row.rank)).size === 32, 'P15 ranking contains duplicate ranks');
assert(new Set(rows.map((row) => row.title)).size === 32, 'P15 ranking contains duplicate game titles');
for (let rank = 1; rank <= 32; rank++) {
  assert(rows.some((row) => row.rank === rank), `P15 ranking is missing rank ${rank}`);
}

const gradeForTotal = (total: number) => {
  if (total >= 55) return 'S';
  if (total >= 49) return 'A';
  if (total >= 42) return 'B';
  if (total >= 34) return 'C';
  if (total >= 25) return 'D';
  return 'F';
};

for (const row of rows) {
  assert(row.scores.every((score) => score >= 1 && score <= 10), `${row.title}: component scores must stay in the 1–10 rubric`);
  const computedTotal = row.scores.reduce((sum, score) => sum + score, 0);
  assert(computedTotal === row.total, `${row.title}: reported total ${row.total} does not equal component sum ${computedTotal}`);
  assert(row.grade === gradeForTotal(row.total), `${row.title}: grade ${row.grade} does not match documented total ${row.total}`);
}

const historicalScoreSignature = rows
  .map((row) => `${row.rank}:${row.title}:${row.grade}:${row.scores.join(',')}:${row.total}`)
  .join('|');
assert(
  historicalScoreSignature === P15_HISTORICAL_SCORE_SIGNATURE,
  'P15 historical scorecards changed; P15 is immutable evidence and later promotions must not rewrite it',
);
for (let index = 1; index < rows.length; index++) {
  assert(
    rows[index - 1].total >= rows[index].total,
    `P15 rank order is not non-increasing at ranks ${rows[index - 1].rank}/${rows[index].rank}`,
  );
}

for (const { title } of registryEntries) {
  assert(rows.some((row) => row.title === title), `P15 report is missing registered game ${title}`);
}
for (const row of rows) {
  assert(registryEntries.some((entry) => entry.title === row.title), `P15 report contains unregistered game ${row.title}`);
}

const gradeCounts = rows.reduce<Record<string, number>>((counts, row) => {
  counts[row.grade] = (counts[row.grade] ?? 0) + 1;
  return counts;
}, {});
for (const grade of ['S', 'A', 'B', 'C', 'D', 'F']) {
  const expected = gradeCounts[grade] ?? 0;
  assert(report.includes(`- **${grade}:** ${expected}`), `P15 grade distribution does not match computed ${grade} count ${expected}`);
}
assert(
  (gradeCounts.S ?? 0) === 5 &&
    (gradeCounts.A ?? 0) === 20 &&
    (gradeCounts.B ?? 0) === 7 &&
    (gradeCounts.C ?? 0) === 0 &&
    (gradeCounts.D ?? 0) === 0 &&
    (gradeCounts.F ?? 0) === 0,
  'P15 historical distribution must remain exactly 5 S / 20 A / 7 B / 0 C / 0 D / 0 F',
);

for (const heading of [
  '## Top five',
  '## Bottom five remaining games',
  '## Roster-wide recurring findings',
  '## P16–P19 handoff',
  '## P15 exit decision',
]) {
  assert(report.includes(heading), `P15 report is missing required section ${heading}`);
}

const topFiveSection = report.slice(
  report.indexOf('## Top five'),
  report.indexOf('## Bottom five remaining games'),
);
for (const [index, title] of P15_TOP_FIVE.entries()) {
  assert(
    topFiveSection.includes(`${index + 1}. **${title}**`),
    `P15 top-five summary drifted at position ${index + 1}: expected ${title}`,
  );
}

const bottomFiveSection = report.slice(
  report.indexOf('## Bottom five remaining games'),
  report.indexOf('## Roster-wide recurring findings'),
);
for (const [index, title] of P15_BOTTOM_FIVE.entries()) {
  assert(
    bottomFiveSection.includes(`${index + 1}. **${title}**`),
    `P15 bottom-five summary drifted at position ${index + 1}: expected ${title}`,
  );
}
assert(report.includes('not a claim that CI can measure subjective human fun'), 'P15 report must state the limitation of automated/source grading');
assert(report.includes('P15 does **not** recommend adding more subsystems'), 'P15 report must preserve the no-feature-inflation conclusion');
assert(
  report.includes('P16 should proceed as the first whole-roster balance phase.'),
  'P15 handoff no longer points to P16 balance certification',
);
assert(
  report.includes('The current roster quality floor is B, with no C/D/F titles.'),
  'P15 exit decision no longer matches the immutable historical distribution',
);

assert(pkg.scripts?.['quality:gameplay-p15'] === 'bun scripts/audit-gameplay-p15.ts', 'package.json is missing the permanent P15 command');
assert(ci.includes('bun run quality:gameplay-p14\n      - run: bun run quality:gameplay-p15'), 'CI must run P15 immediately after P14');
assert(release.includes("'quality:gameplay-p15'"), 'release32 required gate list is missing P15');
assert(release.includes("'scripts/audit-gameplay-p15.ts'"), 'release32 required audit file list is missing P15');

if (errors.length) {
  console.error('P15 DEFINITIVE 32-GAME ROSTER AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P15 DEFINITIVE 32-GAME ROSTER AUDIT — PASS');
console.log(`32/32 scorecards are structurally complete; grade distribution: S ${gradeCounts.S ?? 0}, A ${gradeCounts.A ?? 0}, B ${gradeCounts.B ?? 0}, C ${gradeCounts.C ?? 0}, D ${gradeCounts.D ?? 0}, F ${gradeCounts.F ?? 0}.`);
console.log('P15 certifies audit integrity, roster teaching coverage, and permanent CI/release wiring — not subjective human fun.');
