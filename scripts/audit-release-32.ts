import { GAME_RULES } from '../shared/scoringProtocol';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };

const gamesDir = join(root, 'src', 'games');
const gameFiles = readdirSync(gamesDir).filter((name) => name.endsWith('Game.tsx')).sort();
const registry = read('src/data/games.ts');
const worker = read('worker/src/index.ts');
const pkg = JSON.parse(read('package.json')) as { description?: string; scripts?: Record<string, string> };
const readme = read('README.md');
const ci = read('.github/workflows/ci.yml');
const ma4 = read('scripts/audit-ma4.mjs');
const mobile = read('scripts/audit-mobile-runtime.ts');

const registryEntries = [...registry.matchAll(/^\s{4}id:\s*'([a-z0-9-]+)',[\s\S]*?component:\s*lazyGame\(\(\) => import\('\.\.\/games\/(\w+Game)'\)/gm)]
  .map((match) => ({ id: match[1], file: `${match[2]}.tsx` }));
const registryIds = registryEntries.map((entry) => entry.id);
const registryFiles = registryEntries.map((entry) => entry.file);
const workerIds = Object.keys(GAME_RULES);

assert(gameFiles.length === 32, `expected exactly 32 game source modules, found ${gameFiles.length}`);
assert(registryEntries.length === 32, `expected exactly 32 lazy registry entries, found ${registryEntries.length}`);
assert(new Set(registryIds).size === 32, 'registry contains duplicate game IDs');
assert(new Set(registryFiles).size === 32, 'registry contains duplicate game component files');
assert(workerIds.length === 32, `expected exactly 32 Worker accepted-game rules, found ${workerIds.length}`);
assert(new Set(workerIds).size === 32, 'Worker accepted-game list contains duplicate IDs');
assert((registry.match(/component:\s*lazyGame\(/g) ?? []).length === 32, 'registry is not fully lazy-loaded');
assert(!/from ['"]\.\.\/games\//.test(registry), 'registry contains an eager/static game import');

for (const file of gameFiles) {
  assert(registryFiles.includes(file), `${file} exists but is not registered`);
  const source = read(`src/games/${file}`);
  assert(/\bisPaused\b/.test(source), `${file} does not consume isPaused`);
  assert(/\bonGameOver\b/.test(source), `${file} does not use onGameOver`);
  assert(/\bonScoreUpdate\b/.test(source), `${file} does not use onScoreUpdate`);
  assert(!source.includes('transferControlToOffscreen'), `${file} requires OffscreenCanvas`);
  assert(!source.includes('new OffscreenCanvas'), `${file} constructs OffscreenCanvas directly`);
}
for (const { id, file } of registryEntries) {
  assert(gameFiles.includes(file), `${id} registers missing module ${file}`);
  assert(workerIds.includes(id), `${id} is missing from Worker GAME_RULES`);
}
for (const id of workerIds) assert(registryIds.includes(id), `Worker accepts unregistered game ${id}`);

const expectedIds = [
  'orbit','stack','reaction','dodge','pulse','merge','typerush','oneline','breakout','perfectstop',
  'chain','gravity','blade','pinball','chrono','matrix','drift','vanguard','slingshot','snake',
  'rhythm','tower','pacmaze','flappyaero','roadcross','bubblebuster','astroblaster','laserrope',
  'blockdrop','knifetarget','airhockey','neonrail',
];
for (const id of expectedIds) assert(registryIds.includes(id), `completed-roster game ${id} is missing from registry`);

const requiredQualityGates = [
  'quality:games','quality:desktop','quality:blade','quality:pinball','quality:chrono','quality:shortcuts',
  'quality:pac','quality:roadcross','quality:typerush','quality:oneline','quality:gravity','quality:slingshot',
  'quality:tower','quality:astro','quality:drift','quality:vanguard','quality:frame-rate','quality:hud-render',
  'quality:gameplay-p0','quality:gameplay-p1','quality:gameplay-p2','quality:gameplay-p4','quality:gameplay-p5',
  'quality:gameplay-p6','quality:gameplay-p7','quality:gameplay-p8','quality:gameplay-p9','quality:gameplay-p10',
  'quality:gameplay-p11','quality:gameplay-p12','quality:gameplay-p13','quality:gameplay-p14','quality:gameplay-p15',
  'quality:gameplay-p16','quality:gameplay-p17','quality:gameplay-p18','quality:gameplay-p19','quality:gameplay-p20',
  'quality:gameplay-p21','quality:gameplay-p22','quality:gameplay-p23','quality:gameplay-p24','quality:gameplay-p25','quality:gameplay-p26','quality:gameplay-p27','quality:gameplay-p28','quality:gameplay-p29','quality:gameplay-p30','quality:gameplay-p31','quality:backend-p31','quality:gameplay-p32','quality:backend-p32','quality:gameplay-p33','quality:backend-p33',
  'quality:browser-p3','quality:browser-p17','quality:browser-p18','quality:browser-p19','quality:browser-p20','quality:browser-p21','quality:browser-p22','quality:browser-p23','quality:browser-p24','quality:browser-p26','quality:production-p26',
  'quality:lifecycle','quality:mobile','quality:rope','quality:rope-feedback','quality:rope-phase-c','quality:blockdrop','quality:knife','quality:puck','quality:rail',
  'quality:release32','quality:hardening',
] as const;
for (const gate of requiredQualityGates) {
  assert(Boolean(pkg.scripts?.[gate]), `package.json is missing ${gate}`);
  assert(ci.includes(`bun run ${gate}`), `CI does not enforce ${gate}`);
}

const requiredAuditFiles = [
  'scripts/audit-desktop-coordinates.mjs','scripts/audit-blade-trajectories.ts','scripts/audit-pinball-physics.ts',
  'scripts/audit-chrono-reachability.ts','scripts/audit-rhythm-shortcuts.ts','scripts/audit-pac-controls.ts',
  'scripts/audit-road-cross.ts','scripts/audit-type-rush.ts','scripts/audit-one-line.ts','scripts/audit-gravity.ts',
  'scripts/audit-slingshot.ts','scripts/audit-tower.ts','scripts/audit-astro.ts','scripts/audit-drift.ts','scripts/audit-vanguard.ts',
  'scripts/audit-frame-rate-global.ts','scripts/audit-hud-render-performance.ts','scripts/audit-game-lifecycle.ts','scripts/audit-mobile-runtime.ts',
  'scripts/audit-laser-rope-presentation.ts','scripts/audit-laser-rope-feedback.ts','scripts/audit-laser-rope-phase-c.ts',
  'scripts/audit-block-drop-hold.ts','scripts/audit-knife-target-aim.ts','scripts/audit-air-hockey-layout.ts','scripts/audit-neon-rail-shift.ts','scripts/audit-repository-hardening.ts',
  'scripts/audit-gameplay-p0.ts','scripts/audit-gameplay-p1.ts','scripts/audit-gameplay-p2.ts',
  'scripts/audit-gameplay-p4.ts','scripts/audit-gameplay-p5.ts','scripts/audit-gameplay-p6.ts','scripts/audit-gameplay-p7.ts','scripts/audit-gameplay-p8.ts','scripts/audit-gameplay-p9.ts',
  'scripts/audit-gameplay-p10.ts','scripts/audit-gameplay-p11.ts','scripts/audit-gameplay-p12.ts','scripts/audit-gameplay-p13.ts','scripts/audit-gameplay-p14.ts','scripts/audit-gameplay-p15.ts',
  'scripts/audit-gameplay-p16.ts','scripts/audit-gameplay-p17.ts','scripts/audit-gameplay-p18.ts','scripts/audit-gameplay-p19.ts','scripts/audit-gameplay-p20.ts','scripts/audit-gameplay-p21.ts','scripts/audit-gameplay-p22.ts','scripts/audit-gameplay-p23.ts','scripts/audit-gameplay-p24.ts','scripts/audit-gameplay-p25.ts','scripts/audit-gameplay-p26.ts',
  'scripts/audit-browser-gameplay-p3.mjs','scripts/audit-browser-gameplay-p17.mjs','scripts/audit-browser-gameplay-p18.mjs','scripts/audit-browser-gameplay-p19.mjs','scripts/audit-browser-gameplay-p20.mjs','scripts/audit-browser-gameplay-p21.mjs','scripts/audit-browser-gameplay-p22.mjs','scripts/audit-browser-gameplay-p23.mjs','scripts/audit-browser-gameplay-p24.mjs','scripts/audit-browser-p24-incumbents.mjs','scripts/audit-browser-gameplay-p26.mjs','scripts/audit-production-p26.mjs','scripts/audit-operations-p27.mjs','scripts/audit-production-p27.mjs','scripts/audit-operations-p28.mjs','scripts/audit-reliability-p28.mjs','scripts/audit-operations-p29.mjs','scripts/audit-incident-p29.mjs','scripts/p29-incident-core.mjs','scripts/test-incident-diagnostics-p29.mjs','scripts/audit-operations-p30.mjs','scripts/p30-recovery-core.mjs','scripts/p30-github-deployments.mjs','scripts/test-disaster-recovery-p30.mjs','scripts/select-rollback-candidate-p30.mjs','scripts/authorize-rollback-p30.mjs','scripts/audit-continuity-p30.mjs','scripts/audit-operations-p31.mjs','scripts/p31-backup-readiness.mjs','scripts/p31-verify-offsite.py','scripts/p31-decrypt-backup.sh','scripts/audit-operations-p32.mjs','scripts/p32-recovery-core.mjs','scripts/p32-timing.mjs','scripts/p32-cold-restore.mjs','scripts/p32-cold-api.mjs','scripts/p32-browser-certify.mjs','scripts/p32-offsite-reference.mjs','scripts/p32-finalize.mjs','scripts/p32-readiness.mjs','scripts/test-fullstack-recovery-p32.mjs','scripts/audit-operations-p33.mjs','scripts/p33-recovery-core.mjs','scripts/p33-build-attestation.mjs','scripts/p33-verify-attestation.mjs','scripts/p33-verify-retained-artifact.mjs','scripts/p33-persist-evidence.mjs','scripts/p33-long-term-assurance.mjs','scripts/test-offline-recovery-p33.mjs','scripts/p33-offline-ceremony.sh','scripts/p33-prepare-ceremony.sh',
];
for (const path of requiredAuditFiles) assert(existsSync(join(root, path)), `missing permanent regression audit ${path}`);

const workflowFiles = readdirSync(join(root, '.github', 'workflows')).sort();
assert(workflowFiles.length === 11 && workflowFiles[0] === 'ci.yml' && workflowFiles[1] === 'p27-production-burnin.yml' && workflowFiles[2] === 'p28-reliability-control.yml' && workflowFiles[3] === 'p29-operational-readiness.yml' && workflowFiles[4] === 'p30-continuity-drill.yml' && workflowFiles[5] === 'p30-guarded-rollback.yml' && workflowFiles[6] === 'p31-offsite-backup.yml' && workflowFiles[7] === 'p32-cold-recovery.yml' && workflowFiles[8] === 'p33-long-term-assurance.yml' && workflowFiles[9] === 'p33-offline-attestation.yml' && workflowFiles[10] === 'pages.yml', `temporary/unexpected workflows remain: ${workflowFiles.join(', ')}`);
const temporaryScripts = readdirSync(join(root, 'scripts')).filter((name) => /^(migrate|patch)-/i.test(name));
assert(temporaryScripts.length === 0, `temporary migration/patch scripts remain: ${temporaryScripts.join(', ')}`);

assert(pkg.description?.includes('32 instant-play browser arcade games') === true, 'package metadata does not advertise 32 games');
assert(readme.includes('collection of 32 instant-play mini-games'), 'README does not advertise the completed 32-game roster');
assert(ma4.includes('lazyGameCount !== 32'), 'MA4 lazy-game certification is not set to 32');
assert(ma4.includes('gameEntries.length !== 32'), 'MA4 built-game certification is not set to 32');
assert(mobile.includes('gameFiles.length === 32'), 'mobile runtime audit is not set to 32 games');
assert(registry.includes("id: 'neonrail'"), 'Neon Rail Shift registration is missing');
assert(Object.hasOwn(GAME_RULES, 'neonrail') && worker.includes('shared/scoringProtocol.ts'), 'Neon Rail Shift Worker rule is missing');

const phaseFiles = [
  ['docs/P17_GAME_FEEL_CERTIFICATION.md','P17 certification document'],['src/lib/gameFeelRuntime.ts','P17 shared feel runtime'],['src/lib/gameFeelProfiles.ts','P17 game feel profile registry'],['src/p17-game-feel.css','P17 bounded feedback stylesheet'],
  ['docs/P18_CLARITY_ACCESSIBILITY_CERTIFICATION.md','P18 certification document'],['docs/P18_TERMINOLOGY_REGISTRY.md','P18 terminology registry'],['src/lib/gameClarityRuntime.ts','P18 shared clarity runtime'],['src/lib/gameClarityProfiles.ts','P18 clarity profile registry'],['src/p18-clarity-accessibility.css','P18 clarity/accessibility stylesheet'],
  ['docs/P19_ARCADE_COHESION_CERTIFICATION.md','P19 certification document'],['src/lib/arcadeCohesionRuntime.ts','P19 shared cohesion runtime'],['src/p19-arcade-cohesion.css','P19 cohesion stylesheet'],
  ['docs/P20_NEAR_S_PROMOTION_CERTIFICATION.md','P20 certification document'],['scripts/p20-promotion-scorecards.ts','P20 promotion scorecard ledger'],['src/lib/bladeWavePhrases.ts','P20 Laser Blade phrase model'],
  ['docs/P21_STRONG_A_PROMOTION_CERTIFICATION.md','P21 certification document'],['scripts/p21-promotion-scorecards.ts','P21 promotion scorecard ledger'],
  ['docs/P22_MID_A_PROMOTION_CERTIFICATION.md','P22 certification document'],['scripts/p22-promotion-scorecards.ts','P22 promotion scorecard ledger'],['src/lib/p22PromotionRuntime.ts','P22 promotion runtime'],['src/lib/p22PromotionState.ts','P22 promotion run-state processor'],['src/p22-mid-a-promotion.css','P22 promotion stylesheet'],
  ['docs/P23_B_RANK_TRANSFORMATION_CERTIFICATION.md','P23 certification document'],['scripts/p23-promotion-scorecards.ts','P23 transformation scorecard ledger'],['src/lib/p23TransformationRuntime.ts','P23 teaching/control extension runtime'],['src/lib/p23ClarityProfileExtensions.ts','P23 clarity profile extensions'],['src/p23-b-rank-transformation.css','P23 transformation stylesheet'],
  ['docs/P24_DEFINITIVE_32_S_CERTIFICATION.md','P24 definitive certification document'],['scripts/p24-definitive-scorecards.ts','P24 definitive scorecard ledger'],
  ['docs/P25_DEEP_GAME_POLISH.md','P25 deep gameplay polish certification'],['src/lib/gamePolishBalance.ts','P25 shared balance envelope module'],
  ['docs/P26_PRODUCTION_CERTIFICATION.md','P26 production certification'],['src/lib/replacementGameBalance.ts','P26 replacement balance contract'],
  ['docs/P27_POST_RELEASE_BURN_IN.md','P27 post-release operational certification'],
  ['docs/P28_PRODUCTION_SLOS_INCIDENT_AUTOMATION.md','P28 production SLO and incident automation certification'],
  ['docs/P29_INCIDENT_RUNBOOKS.md','P29 incident runbooks and operational readiness certification'],
  ['docs/P30_DISASTER_RECOVERY.md','P30 disaster recovery and rollback certification'],
  ['docs/P31_BACKEND_DATA_RESILIENCE.md','P31 backend data resilience certification'],
  ['supabase/migrations/20261003_arcade_p31_backend_recovery.sql','P31 backend recovery migration'],
  ['supabase/functions/micro-arcade-p31-backup-export/index.ts','P31 OIDC backup export function'],
  ['ops/p31-backup-recovery-cert.pem','P31 public recovery certificate'],
  ['tests/p31-backup-postgres.mjs','P31 real PostgreSQL restore-readiness test'],
  ['docs/P32_FULL_STACK_DISASTER_RECOVERY.md','P32 full-stack cold recovery certification'],
  ['tests/p32-cold-restore-postgres.mjs','P32 brand-new PostgreSQL cold restore test'],
  ['.github/workflows/p32-cold-recovery.yml','P32 isolated full-stack recovery workflow'],
  ['docs/P33_OFFLINE_KEY_RECOVERY.md','P33 offline-key recovery and long-term assurance'],
  ['tests/p33-offline-ceremony-postgres.mjs','P33 real crypto/cold-restore integration test'],
  ['.github/workflows/p33-offline-attestation.yml','P33 signed offline ceremony acceptance workflow'],
  ['.github/workflows/p33-long-term-assurance.yml','P33 recurring long-term DR assurance workflow'],
] as const;
for (const [path, label] of phaseFiles) assert(existsSync(join(root, path)), `${label} is missing`);

assert(
  ci.includes('legacy-browser-regression:') &&
  ci.includes('phase: [p3, p17, p18, p19, p20, p21, p22, p23, p24]') &&
  ci.includes('Browser gameplay certification — ${{ matrix.phase }}') &&
  ci.includes('p24) P24_CHROME_PATH="$chrome" bun run quality:browser-p24 ;;'),
  'legacy browser regression phases are not independently enforced through P24',
);
assert(ci.includes('p26-production-browser:') && ci.includes('P26 high-DPR production gameplay matrix') && ci.includes('P26_CHROME_PATH="$chrome" bun run quality:browser-p26'), 'P26 browser certification is not isolated into its production job');

if (errors.length) {
  console.error('FINAL 32-GAME RELEASE / REGRESSION AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('FINAL 32-GAME RELEASE / REGRESSION AUDIT — PASS');
console.log('32 source modules / 32 lazy registry entries / 32 Worker rules are in exact parity.');
console.log('All game contracts, permanent regression gates through P33, production-resolved replacement evidence, burn-in/SLO/frontend-DR/backend-data-recovery/full-stack-cold-failover/offline-key-assurance wiring, repository hardening, roster metadata, mobile/MA4 counts, and cleanup constraints are certified.');
