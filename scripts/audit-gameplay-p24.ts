import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { P20_PROMOTIONS, P20_S_THRESHOLD } from './p20-promotion-scorecards';
import { P21_PROMOTIONS, P21_S_THRESHOLD } from './p21-promotion-scorecards';
import { P22_PROMOTIONS, P22_S_THRESHOLD } from './p22-promotion-scorecards';
import { P23_PROMOTIONS, P23_S_THRESHOLD } from './p23-promotion-scorecards';
import {
  P24_CURRENT_SCORECARDS,
  P24_EXPECTED_GAME_IDS,
  P24_P15_S_BASELINE,
  P24_S_THRESHOLD,
  p24Total,
  type P24Category,
  type P24Scorecard,
} from './p24-definitive-scorecards';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
const categories: readonly P24Category[] = ['core', 'agency', 'progression', 'replay', 'feel', 'fairnessUx'];

const scoreEquals = (a: P24Scorecard, b: P24Scorecard) => categories.every((category) => a[category] === b[category]);

assert(P24_S_THRESHOLD === 55, 'P24 S threshold must remain 55');
assert(P20_S_THRESHOLD === 55 && P21_S_THRESHOLD === 55 && P22_S_THRESHOLD === 55 && P23_S_THRESHOLD === 55, 'P20-P23 S thresholds must remain 55');
assert(P24_CURRENT_SCORECARDS.length === 32, `P24 must certify exactly 32 scorecards, found ${P24_CURRENT_SCORECARDS.length}`);
assert(new Set(P24_CURRENT_SCORECARDS.map((record) => record.id)).size === 32, 'P24 scorecard ledger contains duplicate IDs');
assert(P24_EXPECTED_GAME_IDS.length === 32 && new Set(P24_EXPECTED_GAME_IDS).size === 32, 'P24 canonical game ID roster must contain 32 unique IDs');
assert(P24_EXPECTED_GAME_IDS.every((id) => P24_CURRENT_SCORECARDS.some((record) => record.id === id)), 'P24 ledger does not exactly cover the canonical 32-game roster');
assert(P24_CURRENT_SCORECARDS.every((record) => P24_EXPECTED_GAME_IDS.includes(record.id as (typeof P24_EXPECTED_GAME_IDS)[number])), 'P24 ledger contains a non-canonical game ID');

const provenanceCounts = Object.fromEntries(['P15','P20','P21','P22','P23'].map((phase) => [phase, P24_CURRENT_SCORECARDS.filter((record) => record.provenance === phase).length]));
assert(provenanceCounts.P15 === 5 && provenanceCounts.P20 === 6 && provenanceCounts.P21 === 6 && provenanceCounts.P22 === 8 && provenanceCounts.P23 === 7, `P24 provenance partition is wrong: ${JSON.stringify(provenanceCounts)}`);

for (const record of P24_CURRENT_SCORECARDS) {
  for (const category of categories) {
    const value = record.score[category];
    assert(Number.isInteger(value) && value >= 1 && value <= 10, `${record.title} ${category} must remain an integer 1-10 score`);
  }
  const total = p24Total(record.score);
  assert(total >= P24_S_THRESHOLD && total <= 60, `${record.title} is not an S-rank scorecard: ${total}/60`);
}
assert(P24_CURRENT_SCORECARDS.filter((record) => p24Total(record.score) >= P24_S_THRESHOLD).length === 32, 'P24 current distribution must be 32 S / 0 A / 0 B');

const expectedP15S: Record<string, P24Scorecard> = {
  pinball: { core: 10, agency: 10, progression: 9, replay: 10, feel: 10, fairnessUx: 9 },
  vanguard: { core: 10, agency: 9, progression: 10, replay: 9, feel: 10, fairnessUx: 9 },
  astroblaster: { core: 10, agency: 10, progression: 9, replay: 9, feel: 10, fairnessUx: 9 },
  blockdrop: { core: 10, agency: 10, progression: 9, replay: 10, feel: 8, fairnessUx: 9 },
  rhythm: { core: 9, agency: 9, progression: 9, replay: 10, feel: 9, fairnessUx: 9 },
};
assert(P24_P15_S_BASELINE.length === 5, 'P24 must retain exactly the five original P15 S games without rescoring them');
for (const record of P24_P15_S_BASELINE) {
  const expected = expectedP15S[record.id];
  assert(Boolean(expected) && scoreEquals(record.score, expected), `${record.title} P15 S score differs from immutable history`);
}

const phaseSources = [
  ['P20', P20_PROMOTIONS],
  ['P21', P21_PROMOTIONS],
  ['P22', P22_PROMOTIONS],
  ['P23', P23_PROMOTIONS],
] as const;
for (const [phase, promotions] of phaseSources) {
  for (const promotion of promotions) {
    const record = P24_CURRENT_SCORECARDS.find((candidate) => candidate.id === promotion.id);
    assert(Boolean(record), `${phase} promotion ${promotion.id} is missing from P24`);
    if (!record) continue;
    assert(record.provenance === phase, `${promotion.title} P24 provenance must be ${phase}`);
    assert(scoreEquals(record.score, promotion.final), `${promotion.title} P24 score must equal the ${phase} final scorecard exactly`);
  }
}

const p15 = read('docs/P15_ROSTER_AUDIT.md');
for (const token of [
  '| 1 | Neon Pinball | S | 10 | 10 | 9 | 10 | 10 | 9 | 58 |',
  '| 2 | Galaxy Vanguard | S | 10 | 9 | 10 | 9 | 10 | 9 | 57 |',
  '| 3 | Astro Blaster 360 | S | 10 | 10 | 9 | 9 | 10 | 9 | 57 |',
  '| 4 | Cyber Block Drop | S | 10 | 10 | 9 | 10 | 8 | 9 | 56 |',
  '| 5 | Neon Rhythm Tapper | S | 9 | 9 | 9 | 10 | 9 | 9 | 55 |',
  '- **S:** 5', '- **A:** 20', '- **B:** 7',
]) assert(p15.includes(token), `immutable P15 token changed: ${token}`);
const p15Rows = [...p15.matchAll(/^\|\s*\d+\s*\|\s*[^|]+\|\s*[SABCDF]\s*\|/gm)];
assert(p15Rows.length === 32, `immutable P15 ranking must still contain 32 rows, found ${p15Rows.length}`);

const registry = read('src/data/games.ts');
const registryIds = [...registry.matchAll(/^\s{4}id:\s*'([a-z0-9-]+)',/gm)].map((match) => match[1]);
assert(registryIds.length === 32 && new Set(registryIds).size === 32, `game registry must still contain 32 unique entries, found ${registryIds.length}`);
assert(registryIds.every((id) => P24_CURRENT_SCORECARDS.some((record) => record.id === id)), 'game registry and P24 scorecard ledger are not in exact parity');

const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
assert(pkg.scripts?.['quality:gameplay-p24'] === 'bun scripts/audit-gameplay-p24.ts', 'package.json is missing the permanent P24 static gate');
assert(pkg.scripts?.['quality:browser-p24'] === 'bun scripts/audit-browser-gameplay-p24.mjs', 'package.json is missing the permanent P24 browser gate');

const ci = read('.github/workflows/ci.yml');
assert(ci.includes('bun run quality:gameplay-p24'), 'CI does not run quality:gameplay-p24');
assert(ci.includes('P24_CHROME_PATH="$chrome" bun run quality:browser-p24'), 'CI does not run the P24 browser gate with the certified Chrome binary');
assert(ci.includes('Browser gameplay certification — P3 / P17 / P18 / P19 / P20 / P21 / P22 / P23 / P24'), 'CI browser chain is not extended through P24');

for (const path of [
  'docs/P20_NEAR_S_PROMOTION_CERTIFICATION.md',
  'docs/P21_STRONG_A_PROMOTION_CERTIFICATION.md',
  'docs/P22_MID_A_PROMOTION_CERTIFICATION.md',
  'docs/P23_B_RANK_TRANSFORMATION_CERTIFICATION.md',
  'docs/P24_DEFINITIVE_32_S_CERTIFICATION.md',
  'scripts/p24-definitive-scorecards.ts',
  'scripts/audit-browser-gameplay-p24.mjs',
]) assert(existsSync(join(root, path)), `P24 dependency is missing: ${path}`);

const p24Doc = read('docs/P24_DEFINITIVE_32_S_CERTIFICATION.md');
for (const token of [
  'Baseline: `994bcab64950c452bd887ed42fcef5486fe0665b`',
  '**32 S / 0 A / 0 B**',
  'certification-only',
  '96 game/profile sessions',
  'Automation cannot prove',
]) assert(p24Doc.includes(token), `P24 certification document is missing required boundary text: ${token}`);

const p24Browser = read('scripts/audit-browser-gameplay-p24.mjs');
assert(p24Browser.includes('audit-browser-gameplay-p19.mjs'), 'P24 browser gate must rerun the canonical all-32 P19 browser contract');
assert(p24Browser.includes('P24_CHROME_PATH') && p24Browser.includes('P24_BASE_URL'), 'P24 browser gate does not expose P24 environment controls');

if (errors.length) {
  console.error('P24 DEFINITIVE 32/32 S-RANK CERTIFICATION — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P24 DEFINITIVE 32/32 S-RANK CERTIFICATION — PASS');
console.log('Historical P15 remains 5 S / 20 A / 7 B; the composed current ledger is 32 S / 0 A / 0 B at the unchanged 55/60 threshold.');
console.log('P24 introduces no new game scoring: 5 records come from immutable P15 and 27 exactly match P20-P23 final promotion scorecards.');
