import { spawnSync } from 'node:child_process';

const BASE_URL = process.env.P24_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.P24_CHROME_PATH || undefined;

// P19 is the canonical whole-product browser contract: all 32 games across desktop,
// reduced-motion mobile and reduced-motion small-mobile, including home/library,
// shell controls, pause/focus, restart, exit, settings persistence, navigation stress,
// responsive containment and console cleanliness. P24 deliberately reruns that same
// mature contract instead of forking a second roster-wide browser framework.
const env = {
  ...process.env,
  P19_BASE_URL: BASE_URL,
};
if (CHROME_PATH) env.P19_CHROME_PATH = CHROME_PATH;
else delete env.P19_CHROME_PATH;

console.log('P24 DEFINITIVE 32/32 BROWSER CERTIFICATION');
console.log('Rerunning the canonical all-32 P19 browser contract as an independent P24 gate.');

const result = spawnSync(process.execPath, ['scripts/audit-browser-gameplay-p19.mjs'], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`P24 browser certification could not launch: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`P24 DEFINITIVE 32/32 BROWSER CERTIFICATION — FAIL (exit ${result.status ?? 'signal'})`);
  process.exit(result.status ?? 1);
}

console.log('P24 DEFINITIVE 32/32 BROWSER CERTIFICATION — PASS');
console.log('32 games × 3 canonical profiles = 96 game/profile sessions, plus home, settings-persistence and navigation-stress checks.');
console.log('P20-P23 candidate-specific browser gates remain separate permanent prerequisites in CI.');
