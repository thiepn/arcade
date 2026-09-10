import { spawnSync } from 'node:child_process';

const BASE_URL = process.env.P24_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.P24_CHROME_PATH || undefined;

// P19 is the canonical whole-product browser contract for the current 30-game
// public roster across desktop, reduced-motion mobile and small-mobile. Gravity
// and Astro Blaster remain registered in the unchanged 32-slot scoring/AP system
// until their replacements are introduced. P24 reruns the public browser contract
// instead of conflating visible library size with registered scoring coverage.
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

console.log('P24 PUBLIC-ROSTER BROWSER CERTIFICATION');
console.log('Rerunning the canonical 30-game public P19 browser contract as an independent P24 gate.');
runGate('scripts/audit-browser-gameplay-p19.mjs', 'P24 canonical P19 contract');

console.log('Running shared keyboard-ownership regression checks.');
runGate('scripts/audit-browser-keyboard-controls.mjs', 'P24 keyboard ownership contract');

console.log('P24 PUBLIC-ROSTER BROWSER CERTIFICATION — PASS');
console.log('30 public games × 3 canonical profiles = 90 game/profile sessions, plus home, settings-persistence and navigation-stress checks.');
console.log('The separate static scoring/release gates continue to certify all 32 registered AP slots.');
console.log('Shared Space-key ownership is additionally certified after restart, pause/resume and toolbar interactions.');
console.log('P20-P23 candidate-specific browser gates remain separate permanent prerequisites in CI.');