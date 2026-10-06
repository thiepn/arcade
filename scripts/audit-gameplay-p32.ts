import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };

for (const path of [
  'docs/P32_RELEASE_CLOSURE.md',
  'scripts/audit-gameplay-p32.ts',
]) assert(existsSync(join(root, path)), `missing P32 closure file ${path}`);

const pkg = JSON.parse(read('package.json')) as { version?: string; scripts?: Record<string,string> };
const readme = read('README.md');
const changelog = read('CHANGELOG.md');
const roadmap = read('docs/P27_PRODUCT_COMPLETION_REBASELINE.md');
const ci = read('.github/workflows/ci.yml');
const pages = read('.github/workflows/pages.yml');
const release = read('scripts/audit-release-32.ts');
const ma4 = read('scripts/audit-ma4.mjs');

assert(pkg.version === '1.2.0', `expected release version 1.2.0, found ${pkg.version ?? 'missing'}`);
assert(pkg.scripts?.['quality:gameplay-p32']?.includes('audit-gameplay-p32.ts') === true, 'package missing P32 closure gate');
assert(ci.includes('bun run quality:gameplay-p32'), 'CI does not enforce P32 closure gate');
assert(release.includes("'quality:gameplay-p32'"), 'release32 does not own P32 closure gate');
assert(release.includes('docs/P32_RELEASE_CLOSURE.md'), 'release32 does not own P32 closure documentation');
assert(ma4.includes("pkg.version !== '1.2.0'"), 'MA4 does not certify the 1.2.0 release identity');

assert(readme.includes('## Version 1.2.0 release status'), 'README does not advertise the final 1.2.0 release');
assert(readme.includes('Production leaderboard v3 runs on Supabase Edge Functions + PostgreSQL.'), 'README production leaderboard architecture is not explicit');
assert(readme.includes('Legacy Cloudflare/D1 reference'), 'README does not clearly classify the retained legacy backend');
assert(!readme.includes('Live leaderboard submissions/ranks require the configured Cloudflare Worker'), 'README still claims the legacy Worker is required for live leaderboards');
assert(!readme.includes('Pages builds use the deployed Worker by default'), 'README still claims Pages defaults to the legacy Worker');
assert(readme.includes('## Maintenance mode'), 'README maintenance-mode policy missing');

assert(changelog.includes('## Leaderboard v3 — production — 2026-10-06'), 'changelog still treats production leaderboard v3 as a release candidate');
assert(!changelog.includes('## Leaderboard v3 — release candidate'), 'stale leaderboard v3 release-candidate heading remains');
assert(changelog.includes('## 1.2.0 — 2026-10-06'), 'changelog does not close the 1.2.0 release');
assert(changelog.includes('### P32 final release closure / maintenance mode'), 'changelog missing P32 closure entry');
assert(roadmap.includes('**Completed in P32. Roadmap closed.**'), 'P27 roadmap does not mark P32 complete');
assert(roadmap.includes('No P33 is scheduled.'), 'roadmap does not explicitly stop automatic phase continuation');

assert(pages.includes('P31_BASE_URL: ${{ needs.deploy.outputs.page_url }}'), 'production workflow does not bind P31 browser acceptance to deployed Pages URL');
assert(pages.includes('P31_CHROME_PATH="$chrome" bun run quality:browser-p31'), 'production workflow does not run live P31 device qualification');

if (errors.length) {
  console.error('P32 FINAL RELEASE CLOSURE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P32 FINAL RELEASE CLOSURE AUDIT — PASS');
console.log('Micro Arcade 1.2.0 release identity, production-backend truth, live P31 certification and maintenance-mode closure are permanently enforced.');
