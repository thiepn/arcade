import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };

const required = [
  'src/lib/dailyChallenge.ts',
  'src/components/DailyChallengeCard.tsx',
  'scripts/test-daily-challenge-p28.mjs',
  'docs/P28_DAILY_CHALLENGE_RETURN_LOOP.md',
];
for (const path of required) assert(existsSync(join(root, path)), `missing P28 product file ${path}`);

const types = read('src/types.ts');
const storage = read('src/lib/storage.ts');
const daily = read('src/lib/dailyChallenge.ts');
const card = read('src/components/DailyChallengeCard.tsx');
const app = read('src/App.tsx');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
const ci = read('.github/workflows/ci.yml');
const release = read('scripts/audit-release-32.ts');

assert(types.includes('dailyChallenge?: DailyChallengeProgress'), 'UserStats must persist optional daily challenge progress');
assert(storage.includes('recordDailyChallengeScore'), 'score persistence must feed the daily challenge');
assert(storage.includes('mergeDailyChallengeProgress'), 'storage recovery must merge daily challenge history');
assert(daily.includes('const TARGETS = [2000, 2500, 3000]'), 'P28 must use the calibrated daily AP targets');
assert(daily.includes('const HISTORY_LIMIT = 400'), 'P28 daily history must remain bounded');
assert(!/fetch\(|XMLHttpRequest|WebSocket|EventSource/.test(daily), 'daily challenge core must remain offline-first and network-independent');
assert(card.includes('aria-label="Daily challenge"'), 'daily challenge home surface needs an accessible landmark');
assert(card.includes('role="progressbar"'), 'daily challenge progress must expose semantic progress');
assert(card.includes('Resets 00:00 UTC • Works offline'), 'daily challenge must explain reset/offline behavior');
assert(app.includes('<DailyChallengeCard'), 'P28 daily challenge must be surfaced on the home screen');
assert(app.includes('getUtcDayKey'), 'P28 app must track the UTC challenge day');
assert(app.includes('setInterval'), 'P28 app must refresh the challenge across an open-tab UTC rollover');
assert(pkg.scripts?.['quality:gameplay-p28']?.includes('test-daily-challenge-p28.mjs') === true, 'package must expose P28 deterministic tests');
assert(pkg.scripts?.['quality:gameplay-p28']?.includes('audit-gameplay-p28.ts') === true, 'package must expose P28 wiring audit');
assert(ci.includes('bun run quality:gameplay-p28'), 'CI must enforce P28');
assert(release.includes('quality:gameplay-p28'), 'release32 must enforce P28');

if (errors.length) {
  console.error('P28 DAILY CHALLENGE / RETURN LOOP AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P28 DAILY CHALLENGE / RETURN LOOP AUDIT — PASS');
console.log('Daily rotation, local persistence, streak semantics, home UI and release wiring are present.');
