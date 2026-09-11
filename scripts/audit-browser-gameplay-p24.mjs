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
  CONTROLS_BASE_URL: BASE_URL,
};
if (CHROME_PATH) {
  env.P19_CHROME_PATH = CHROME_PATH;
  env.CONTROLS_CHROME_PATH = CHROME_PATH;
} else {
  delete env.P19_CHROME_PATH;
  delete env.CONTROLS_CHROME_PATH;
}

const runGate = (script, label) => {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`${label} could not launch: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${label} — FAIL (exit ${result.status ?? 'signal'})`);
    process.exit(result.status ?? 1);
  }
};

console.log('P24 DEFINITIVE 32/32 BROWSER CERTIFICATION');
console.log('Rerunning the canonical all-32 P19 browser contract as an independent P24 gate.');
runGate('scripts/audit-browser-gameplay-p19.mjs', 'P24 canonical P19 contract');

console.log('Running shared keyboard-ownership regression checks.');
runGate('scripts/audit-browser-keyboard-controls.mjs', 'P24 keyboard ownership contract');

console.log('Running replacement-game keyboard ownership regression checks.');
runGate('scripts/audit-browser-replacement-controls.mjs', 'P24 replacement keyboard ownership contract');

console.log('P24 DEFINITIVE 32/32 BROWSER CERTIFICATION — PASS');
console.log('32 games × 3 canonical profiles = 96 game/profile sessions, plus home, settings-persistence and navigation-stress checks.');
console.log('Shared Space-key ownership is certified after restart, pause/resume, toolbar interactions and while Hex Capture remains mounted beneath a result dialog.');
console.log('P20-P23 candidate-specific browser gates remain separate permanent prerequisites in CI.');
