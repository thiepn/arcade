import { readFileSync } from 'node:fs';

const errors = [];
const read = (path) => readFileSync(path, 'utf8');
const need = (path, text, marker) => { if (!text.includes(marker)) errors.push(path + ': missing ' + JSON.stringify(marker)); };
const forbid = (path, text, marker) => { if (text.includes(marker)) errors.push(path + ': forbidden ' + JSON.stringify(marker)); };

const pkg = JSON.parse(read('package.json'));
const expectedStatic = 'bun scripts/audit-operations-p29.mjs && bun scripts/test-incident-diagnostics-p29.mjs';
for (const name of ['quality:gameplay-p29', 'quality:operations-p29']) {
  if (pkg.scripts?.[name] !== expectedStatic) errors.push('package.json: ' + name + ' must execute the P29 static contract and deterministic core tests');
}
if (pkg.scripts?.['quality:production-p29'] !== 'bun scripts/audit-incident-p29.mjs') {
  errors.push('package.json: quality:production-p29 must execute scripts/audit-incident-p29.mjs');
}

const corePath = 'scripts/p29-incident-core.mjs';
const core = read(corePath);
for (const marker of [
  "'pages-artifact'",
  "'control-plane-stale'",
  'computeSlo',
  'deploymentCorrelation',
  'assessControlPlaneFreshness',
  'assessRecovery',
  'controlPlaneFresh',
]) need(corePath, core, marker);

const diagnosticsPath = 'scripts/audit-incident-p29.mjs';
const diagnostics = read(diagnosticsPath);
for (const marker of [
  "phase: 'P29'",
  'syntheticOnly: true',
  "listWorkflowRuns('p27-production-burnin.yml')",
  "listWorkflowRuns('p28-reliability-control.yml')",
  "listWorkflowRuns('pages.yml')",
  "listWorkflowRuns('ci.yml')",
  "const diagnosticPrefix = '<!-- p29-diagnostic:'",
  "const recoveryMarker = '<!-- p29-recovery-verification -->'",
  "'recovery-verified-and-closed'",
  'deploymentAdjacent',
  'operational-control-plane-stale',
]) need(diagnosticsPath, diagnostics, marker);
for (const marker of [
  'localStorage',
  'sessionStorage',
  'document.cookie',
  'sendBeacon',
  'fingerprint',
  'supabase.from(',
  'INSERT INTO',
  'DELETE FROM',
  'deployments: write',
  'contents: write',
]) forbid(diagnosticsPath, diagnostics, marker);

const workflowPath = '.github/workflows/p29-operational-readiness.yml';
const workflow = read(workflowPath);
for (const marker of [
  'name: P29 Operational Readiness',
  'workflow_run:',
  'workflows: ["P28 Reliability Control", "Deploy Production"]',
  "cron: '23 4 * * 1'",
  'contents: read',
  'actions: read',
  'issues: write',
  "P29_WINDOW_DAYS: '30'",
  "P29_SLO_TARGET: '99'",
  "P29_MIN_CHECKPOINTS: '12'",
  "P29_RECOVERY_STREAK: '2'",
  "P29_MAX_EVIDENCE_AGE_HOURS: '8'",
  "P27_SAMPLES: '3'",
  'bun run quality:production-p29',
  'retention-days: 90',
]) need(workflowPath, workflow, marker);
for (const marker of ['pages: write', 'deployments: write', 'contents: write']) forbid(workflowPath, workflow, marker);

const p28ControllerPath = 'scripts/audit-reliability-p28.mjs';
const p28Controller = read(p28ControllerPath);
need(p28ControllerPath, p28Controller, "action: 'ready-for-p29-verification'");
forbid(p28ControllerPath, p28Controller, "action: 'closed'");

const docs = read('docs/P29_INCIDENT_RUNBOOKS.md').toLowerCase();
for (const marker of [
  'independent three-sample',
  'no player telemetry',
  'deployment-adjacent',
  '8-hour',
  'does not',
  'p28 no longer closes',
]) need('docs/P29_INCIDENT_RUNBOOKS.md', docs, marker);

for (const path of [
  'docs/runbooks/P29_PAGES_ARTIFACT.md',
  'docs/runbooks/P29_CORS.md',
  'docs/runbooks/P29_BACKEND_HEALTH.md',
  'docs/runbooks/P29_LEADERBOARD_READ_PATH.md',
  'docs/runbooks/P29_CONTROL_PLANE.md',
  'docs/runbooks/P29_UNKNOWN_CONTRACT.md',
]) {
  const text = read(path).toLowerCase();
  need(path, text, 'recovery');
  need(path, text, 'do not');
}

const ci = read('.github/workflows/ci.yml');
need('.github/workflows/ci.yml', ci, 'bun run quality:gameplay-p29');

if (errors.length) {
  console.error('P29 INCIDENT / OPERATIONAL READINESS CONTRACT — FAIL');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}

console.log('P29 INCIDENT / OPERATIONAL READINESS CONTRACT — PASS');
console.log('Runbook routing, deterministic diagnostics, control-plane freshness, independent recovery verification and non-destructive incident lifecycle are wired permanently.');
