import { readFileSync } from 'node:fs';

const errors = [];
const read = (path) => readFileSync(path, 'utf8');
const need = (path, text, marker) => { if (!text.includes(marker)) errors.push(path + ': missing ' + JSON.stringify(marker)); };
const forbid = (path, text, marker) => { if (text.includes(marker)) errors.push(path + ': forbidden ' + JSON.stringify(marker)); };

const pkg = JSON.parse(read('package.json'));
const expectedStatic = 'bun scripts/audit-operations-p30.mjs && bun scripts/test-disaster-recovery-p30.mjs';
for (const name of ['quality:gameplay-p30', 'quality:operations-p30']) {
  if (pkg.scripts?.[name] !== expectedStatic) errors.push('package.json: ' + name + ' must run the P30 static contract plus deterministic recovery tests');
}
if (pkg.scripts?.['quality:production-p30'] !== 'bun scripts/audit-continuity-p30.mjs') {
  errors.push('package.json: quality:production-p30 must execute scripts/audit-continuity-p30.mjs');
}

const corePath = 'scripts/p30-recovery-core.mjs';
const core = read(corePath);
for (const marker of [
  'PRODUCTION_WORKFLOWS',
  "'pages.yml'",
  "'p30-guarded-rollback.yml'",
  'deployedSha',
  'selectRollbackCandidate',
  'validateRollbackAuthorization',
  'confirmSha',
  'hasSuccessfulCi',
  'assessContinuity',
  'deploymentWasPublished',
]) need(corePath, core, marker);

const resolverPath = 'scripts/p30-github-deployments.mjs';
const resolver = read(resolverPath);
for (const marker of [
  'resolveProductionDeploymentRuns',
  "job.name === 'deploy'",
  'deploymentWasPublished',
]) need(resolverPath, resolver, marker);

const selector = read('scripts/select-rollback-candidate-p30.mjs');
for (const marker of [
  'previous distinct successful production deployment',
  'hasSuccessfulCi',
  'candidate_sha=',
]) need('scripts/select-rollback-candidate-p30.mjs', selector, marker);

const authorizer = read('scripts/authorize-rollback-p30.mjs');
for (const marker of [
  'P30_TARGET_SHA',
  'P30_CONFIRM_SHA',
  'validateRollbackAuthorization',
  'GUARDED ROLLBACK AUTHORIZATION',
]) need('scripts/authorize-rollback-p30.mjs', authorizer, marker);

const continuityPath = '.github/workflows/p30-continuity-drill.yml';
const continuity = read(continuityPath);
for (const marker of [
  'name: P30 Continuity Drill',
  'workflows: ["Deploy Production", "P30 Guarded Rollback"]',
  "cron: '41 3 * * 3'",
  'contents: read',
  'actions: read',
  'issues: write',
  'Select previous known-good production deployment',
  'Checkout rollback candidate without changing production',
  'Rebuild and certify rollback candidate',
  "P27_SAMPLES: '3'",
  'bun run quality:production-p30',
  'retention-days: 90',
]) need(continuityPath, continuity, marker);
for (const marker of ['pages: write', 'id-token: write', 'actions/deploy-pages']) forbid(continuityPath, continuity, marker);

const rollbackPath = '.github/workflows/p30-guarded-rollback.yml';
const rollback = read(rollbackPath);
for (const marker of [
  'name: P30 Guarded Rollback',
  'run-name: P30 Rollback → ${{ inputs.target_sha }}',
  'workflow_dispatch:',
  'target_sha:',
  'confirm_sha:',
  'pages: write',
  'id-token: write',
  'cancel-in-progress: false',
  'Authorize exact known-good rollback target',
  'Re-certify historical production source',
  'bun run quality:scoring',
  'bun run quality:leaderboard',
  'bun run quality:production-p26',
  'bun run quality:ma3',
  'bun run quality:ma4',
  'Deploy certified rollback artifact',
  'Certify rolled-back production independently',
  "P27_SAMPLES: '3'",
  'bun run quality:production-p27',
]) need(rollbackPath, rollback, marker);

const onBlock = rollback.slice(rollback.indexOf('on:'), rollback.indexOf('permissions:'));
for (const marker of ['schedule:', 'workflow_run:', 'push:', 'pull_request:']) forbid(rollbackPath + ' trigger block', onBlock, marker);

const p28 = read('scripts/audit-reliability-p28.mjs');
need('scripts/audit-reliability-p28.mjs', p28, 'resolveProductionDeploymentRuns');
need('scripts/audit-reliability-p28.mjs', p28, 'deployedSha(latestDeployment)');

const p29 = read('scripts/audit-incident-p29.mjs');
need('scripts/audit-incident-p29.mjs', p29, 'resolveProductionDeploymentRuns');
need('scripts/audit-incident-p29.mjs', p29, 'deployedSha(run)');

const p29Workflow = read('.github/workflows/p29-operational-readiness.yml');
need('.github/workflows/p29-operational-readiness.yml', p29Workflow, '"P30 Guarded Rollback"');

const docsPath = 'docs/P30_DISASTER_RECOVERY.md';
const docs = read(docsPath).toLowerCase();
for (const marker of [
  'manual-only',
  'previous known-good',
  'no player/session telemetry',
  'does not restore supabase',
  'double-confirmed',
  'not a guaranteed rto',
  'forward recovery',
  'actual deployed sha',
  'no real production rollback is required',
]) need(docsPath, docs, marker);

for (const path of [
  'scripts/select-rollback-candidate-p30.mjs',
  'scripts/authorize-rollback-p30.mjs',
  'scripts/audit-continuity-p30.mjs',
]) {
  const text = read(path);
  for (const marker of ['supabase.from(', 'INSERT INTO', 'DELETE FROM', 'localStorage', 'sessionStorage', 'document.cookie', 'sendBeacon']) {
    forbid(path, text, marker);
  }
}

const ci = read('.github/workflows/ci.yml');
need('.github/workflows/ci.yml', ci, 'bun run quality:gameplay-p30');

if (errors.length) {
  console.error('P30 DISASTER RECOVERY / ROLLBACK CONTRACT — FAIL');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}

console.log('P30 DISASTER RECOVERY / ROLLBACK CONTRACT — PASS');
console.log('Non-destructive continuity drills, known-good rollback provenance, exact double confirmation, current-generation re-certification and P28/P29 rollback correlation are permanent.');
