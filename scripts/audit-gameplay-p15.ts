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

for (const heading of [
  '## Top five',
  '## Bottom five remaining games',
  '## Roster-wide recurring findings',
  '## P16–P19 handoff',
  '## P15 exit decision',
]) {
  assert(report.includes(heading), `P15 report is missing required section ${heading}`);
}
assert(report.includes('not a claim that CI can measure subjective human fun'), 'P15 report must state the limitation of automated/source grading');
assert(report.includes('P15 does **not** recommend adding more subsystems'), 'P15 report must preserve the no-feature-inflation conclusion');

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
