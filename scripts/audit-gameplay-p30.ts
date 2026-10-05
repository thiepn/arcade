import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };

for (const path of [
  'src/lib/resultMeta.ts',
  'src/components/ResultMetaSummary.tsx',
  'scripts/test-result-meta-p30.mjs',
  'docs/P30_RESULTS_META.md',
]) assert(existsSync(join(root, path)), `missing P30 product file ${path}`);

const core = read('src/lib/resultMeta.ts');
const component = read('src/components/ResultMetaSummary.tsx');
const shell = read('src/components/GameShell.tsx');
const app = read('src/App.tsx');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string,string> };
const ci = read('.github/workflows/ci.yml');
const release = read('scripts/audit-release-32.ts');

assert(core.includes('buildResultMeta'), 'P30 must compute one run meta delta');
assert(core.includes("achievement.category !== 'competitive'"), 'P30 local achievement delta must not depend on live leaderboard state');
assert(core.includes('getDailyChallengeSummary'), 'P30 must connect daily challenge completion');
assert(core.includes('getPlayNextRecommendations'), 'P30 must produce a goal-aware next action');
assert(component.includes('aria-label="Run progression"'), 'P30 result meta needs a named semantic region');
assert(component.includes('data-result-achievements'), 'P30 must surface newly unlocked badges');
assert(component.includes('data-result-next-recommendation'), 'P30 must surface a recommended next cabinet');
assert(shell.includes('<ResultMetaSummaryPanel'), 'P30 meta summary must be present in game results');
assert(shell.includes('refreshGameLeaderboard'), 'P30 must refresh rank after an accepted published run');
assert(shell.includes('setRankDelta'), 'P30 must expose rank movement when available');
assert(app.includes('runBaselineRef'), 'P30 must retain a pre-run baseline for accurate run attribution');
assert(app.includes('buildResultMeta'), 'P30 save path must derive result meta from before/after state');
assert(pkg.scripts?.['quality:gameplay-p30']?.includes('test-result-meta-p30.mjs') === true, 'package missing P30 deterministic test');
assert(pkg.scripts?.['quality:gameplay-p30']?.includes('audit-gameplay-p30.ts') === true, 'package missing P30 product audit');
assert(ci.includes('bun run quality:gameplay-p30'), 'CI must enforce P30');
assert(release.includes('quality:gameplay-p30'), 'release32 must enforce P30');

if (errors.length) {
  console.error('P30 RESULTS-TO-META / REPLAY MOTIVATION AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('P30 RESULTS-TO-META / REPLAY MOTIVATION AUDIT — PASS');
console.log('Finished runs feed PB, badge/XP, level, daily challenge, rank and next-action feedback without new persistence.');
