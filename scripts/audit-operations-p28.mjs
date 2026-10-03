import { readFileSync } from 'node:fs';

const errors = [];
const read = (path) => readFileSync(path, 'utf8');
const need = (path, text, marker) => { if (!text.includes(marker)) errors.push(path + ': missing ' + JSON.stringify(marker)); };
const forbid = (path, text, marker) => { if (text.includes(marker)) errors.push(path + ': forbidden ' + JSON.stringify(marker)); };

const pkg = JSON.parse(read('package.json'));
for (const name of ['quality:gameplay-p28', 'quality:operations-p28']) {
  if (pkg.scripts?.[name] !== 'bun scripts/audit-operations-p28.mjs') errors.push('package.json: ' + name + ' must execute scripts/audit-operations-p28.mjs');
}
if (pkg.scripts?.['quality:production-p28'] !== 'bun scripts/audit-reliability-p28.mjs') errors.push('package.json: quality:production-p28 must execute scripts/audit-reliability-p28.mjs');

const controllerPath = 'scripts/audit-reliability-p28.mjs';
const controller = read(controllerPath);
for (const marker of [
  "phase: 'P28'",
  'syntheticOnly: true',
  "listWorkflowRuns('p27-production-burnin.yml')",
  'resolveProductionDeploymentRuns',
  'deployedSha(latestDeployment)',
  "run.event === 'schedule'",
  "incidentMarker = '<!-- p28-production-slo-incident -->'",
  "action: 'ready-for-p29-verification'",
  'errorBudgetRemaining',
  'scheduledRecovery',
]) need(controllerPath, controller, marker);
for (const marker of ['localStorage', 'sessionStorage', 'document.cookie', 'sendBeacon', 'fingerprint', 'supabase.from(', 'INSERT INTO', 'DELETE FROM']) forbid(controllerPath, controller, marker);

const workflowPath = '.github/workflows/p28-reliability-control.yml';
const workflow = read(workflowPath);
for (const marker of [
  'name: P28 Reliability Control',
  'workflow_run:',
  'workflows: ["P27 Production Burn-In"]',
  "cron: '47 5 * * *'",
  'contents: read',
  'actions: read',
  'issues: write',
  "P28_WINDOW_DAYS: '30'",
  "P28_SLO_TARGET: '99'",
  "P28_MIN_CHECKPOINTS: '12'",
  "P28_RECOVERY_STREAK: '2'",
  'bun run quality:production-p27',
  'bun run quality:production-p28',
  'retention-days: 90',
]) need(workflowPath, workflow, marker);
for (const marker of ['pages: write', 'deployments: write', 'contents: write']) forbid(workflowPath, workflow, marker);

const p27Workflow = read('.github/workflows/p27-production-burnin.yml');
need('.github/workflows/p27-production-burnin.yml', p27Workflow, 'contents: read');
forbid('.github/workflows/p27-production-burnin.yml', p27Workflow, 'issues: write');

const ci = read('.github/workflows/ci.yml');
need('.github/workflows/ci.yml', ci, 'bun run quality:gameplay-p28');

const docsPath = 'docs/P28_PRODUCTION_SLOS_INCIDENT_AUTOMATION.md';
const docs = read(docsPath).toLowerCase();
for (const marker of ['30-day', '99%', '12 checkpoints', 'two successful', 'synthetic', 'no player', 'error budget', 'github issue', 'does not redeploy', 'p27', 'p29']) need(docsPath, docs, marker);

if (errors.length) {
  console.error('P28 SLO / INCIDENT AUTOMATION CONTRACT — FAIL');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}

console.log('P28 SLO / INCIDENT AUTOMATION CONTRACT — PASS');
console.log('Rolling synthetic SLOs, deployment correlation, deduplicated incident lifecycle, P29-delegated recovery gating and no-player-telemetry boundaries are wired permanently.');
