import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };

for (const path of [
  'docs/P31_FINAL_UX_DEVICE_PASS.md',
  'scripts/audit-gameplay-p31.ts',
  'scripts/audit-browser-p31.mjs',
]) assert(existsSync(join(root, path)), `missing P31 file ${path}`);

const app = read('src/App.tsx');
const daily = read('src/components/DailyChallengeCard.tsx');
const card = read('src/components/GameCard.tsx');
const progression = read('src/components/ProgressionHomeSection.tsx');
const result = read('src/components/ResultMetaSummary.tsx');
const errorBoundary = read('src/components/ErrorBoundary.tsx');
const sound = read('src/lib/sound.ts');
const haptics = read('src/lib/haptics.ts');
const css = read('src/index.css');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string,string> };
const ci = read('.github/workflows/ci.yml');
const release = read('scripts/audit-release-32.ts');

assert(app.includes('useReducedMotion'), 'App must consume runtime reduced-motion preference');
assert(app.includes("scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })"), 'Browse All must not force smooth scrolling under reduced motion');
assert(app.includes("data-p31-motion={reduceMotion ? 'reduced' : 'full'}"), 'App must expose deterministic P31 motion state');
assert(app.includes('layout={!reduceMotion}'), 'library layout choreography must disable under reduced motion');
assert(daily.includes('useReducedMotion') && daily.includes("data-p31-motion={reduceMotion ? 'reduced' : 'full'}"), 'daily challenge motion contract missing');
assert(card.includes('useReducedMotion') && card.includes('whileHover={reduceMotion ? undefined'), 'game cards must disable JS hover choreography for reduced motion');
assert(progression.includes('useReducedMotion') && progression.includes('duration: reduceMotion ? 0'), 'progression motion must collapse for reduced motion');

assert(daily.includes('sounds.playSuccess()'), 'daily challenge launch feedback missing');
assert(progression.includes('sounds.playClick()') && progression.includes('sounds.playPop()'), 'progression action audio feedback incomplete');
assert(result.includes('sounds.playClick()'), 'result recommendation audio feedback missing');
assert(progression.includes('min-h-11') && progression.includes('min-h-14'), 'P29/P30 touch target hardening missing');

assert(sound.includes("this.ctx?.state === 'closed'"), 'Web Audio must recover from a closed context');
assert(sound.includes("this.ctx.state !== 'running'"), 'Web Audio resume lifecycle guard missing');
assert(sound.includes('void this.ctx.resume().catch'), 'Web Audio resume rejection must be contained');
assert(haptics.includes('navigator.vibrate(0)'), 'disabling haptics must cancel an active vibration');

assert(errorBoundary.includes('recoveryHeadingRef') && errorBoundary.includes('requestAnimationFrame'), 'error recovery focus handoff missing');
assert(errorBoundary.includes('aria-labelledby="arcade-recovery-title"') && errorBoundary.includes('aria-describedby="arcade-recovery-description"'), 'error recovery semantics incomplete');

assert(css.includes('.arcade-home-shell') && css.includes('safe-area-inset-left') && css.includes('safe-area-inset-right'), 'home shell safe-area handling missing');
assert(css.includes('.p19-home-header') && css.includes('safe-area-inset-top'), 'home header top safe area missing');
assert(css.includes('.pwa-status-safe') && css.includes('safe-area-inset-bottom'), 'PWA status safe-area handling missing');

assert(pkg.scripts?.['quality:gameplay-p31']?.includes('audit-gameplay-p31.ts') === true, 'package missing P31 structural gate');
assert(pkg.scripts?.['quality:browser-p31']?.includes('audit-browser-p31.mjs') === true, 'package missing P31 browser gate');
assert(ci.includes('bun run quality:gameplay-p31'), 'CI must enforce P31 structural gate');
assert(ci.includes('bun run quality:browser-p31'), 'CI must enforce P31 device-class browser gate');
assert(release.includes("'quality:gameplay-p31'") && release.includes("'quality:browser-p31'"), 'release32 must own P31 gates');

if (errors.length) {
  console.error('P31 FINAL UX / MOTION / AUDIO / DEVICE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P31 FINAL UX / MOTION / AUDIO / DEVICE AUDIT — PASS');
console.log('Reduced motion, P28–P30 feedback, mobile audio/haptics, safe areas, recovery semantics and permanent browser qualification are structurally owned.');
