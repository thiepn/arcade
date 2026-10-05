import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };

for (const path of [
  'src/lib/homeProgression.ts',
  'src/components/ProgressionHomeSection.tsx',
  'scripts/test-progression-home-p29.mjs',
  'docs/P29_PROGRESSION_HOME.md',
]) assert(existsSync(join(root, path)), `missing P29 product file ${path}`);

const core = read('src/lib/homeProgression.ts');
const component = read('src/components/ProgressionHomeSection.tsx');
const app = read('src/App.tsx');
const achievements = read('src/lib/achievements.ts');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string,string> };
const ci = read('.github/workflows/ci.yml');
const release = read('scripts/audit-release-32.ts');

assert(core.includes('getNearAchievementGoals'), 'P29 must compute near-complete goals');
assert(core.includes('getPlayNextRecommendations'), 'P29 must compute Play next recommendations');
assert(core.includes("achievement.category !== 'competitive'"), 'P29 near-goal ranking must remain locally available');
assert(core.includes("reason: 'achievement'"), 'P29 recommendations must explain achievement-driven choices');
assert(core.includes("reason: 'explore'"), 'P29 recommendations must explain exploration choices');
assert(core.includes("reason: 'favorite'"), 'P29 recommendations must support favorite-based choices');
assert(core.includes("reason: 'continue'"), 'P29 recommendations must support recent-play choices');
assert(!/fetch\(|XMLHttpRequest|WebSocket|EventSource/.test(core), 'P29 recommendation core must not introduce network/AI dependencies');
assert(component.includes('aria-label="Arcade progression"'), 'P29 progression home surface needs a named landmark');
assert(component.includes('aria-label="Player level progress"'), 'P29 level progress must be semantic');
assert(component.includes('Closest goals') && component.includes('Play next'), 'P29 must surface both goals and recommendations');
assert(component.includes('ACHIEVEMENTS_REGISTRY.length'), 'P29 badge count must derive from the live registry');
assert(app.includes('<ProgressionHomeSection'), 'P29 progression must be present on the home page');
assert(app.includes('excludedGameId={dailyChallenge.definition.gameId}'), 'P29 must avoid duplicating the daily cabinet in Play next');
assert(achievements.includes('export function getPlayerLevelInfo'), 'P29 must reuse the existing level model');
assert(pkg.scripts?.['quality:gameplay-p29']?.includes('test-progression-home-p29.mjs') === true, 'package missing P29 deterministic test');
assert(pkg.scripts?.['quality:gameplay-p29']?.includes('audit-gameplay-p29.ts') === true, 'package missing P29 product audit');
assert(ci.includes('bun run quality:gameplay-p29'), 'CI must enforce P29');
assert(release.includes('quality:gameplay-p29'), 'release32 must enforce P29');

if (errors.length) {
  console.error('P29 PROGRESSION / GOAL-AWARE HOME AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('P29 PROGRESSION / GOAL-AWARE HOME AUDIT — PASS');
console.log('Existing XP/levels/achievements are visible on home with local, deterministic and explainable Play next guidance.');
