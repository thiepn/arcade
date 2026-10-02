import { readFileSync } from 'node:fs';

const errors = [];
const requireText = (path) => readFileSync(path, 'utf8');
const mustContain = (path, text, needle) => {
  if (!text.includes(needle)) errors.push(`${path}: missing ${JSON.stringify(needle)}`);
};
const mustNotContain = (path, text, needle) => {
  if (text.includes(needle)) errors.push(`${path}: forbidden ${JSON.stringify(needle)}`);
};

const packageJson = JSON.parse(requireText('package.json'));
if (packageJson.scripts?.['quality:production-p27'] !== 'bun scripts/audit-production-p27.mjs') {
  errors.push('package.json: quality:production-p27 must execute scripts/audit-production-p27.mjs');
}
for (const scriptName of ['quality:operations-p27', 'quality:gameplay-p27']) {
  if (packageJson.scripts?.[scriptName] !== 'bun scripts/audit-operations-p27.mjs') {
    errors.push(`package.json: ${scriptName} must execute scripts/audit-operations-p27.mjs`);
  }
}

const probePath = 'scripts/audit-production-p27.mjs';
const probe = requireText(probePath);
for (const marker of [
  'syntheticOnly: true',
  "name: 'site-root'",
  "name: 'asset-manifest'",
  "name: 'service-worker'",
  "name: 'api-cors'",
  "name: 'api-health'",
  "name: 'api-overall'",
  "name: 'api-weekly'",
  'expected 32 game chunks',
  'deployed scoring policy hash drifted',
]) mustContain(probePath, probe, marker);
for (const forbidden of ['navigator.', 'document.cookie', 'localStorage', 'sessionStorage', 'sendBeacon', 'fingerprint']) {
  mustNotContain(probePath, probe, forbidden);
}

const workflowPath = '.github/workflows/p27-production-burnin.yml';
const workflow = requireText(workflowPath);
for (const marker of [
  'name: P27 Production Burn-In',
  "cron: '17 */6 * * *'",
  'workflow_dispatch:',
  'contents: read',
  "P27_SAMPLES: '3'",
  'bun run quality:production-p27',
  'retention-days: 30',
]) mustContain(workflowPath, workflow, marker);
for (const forbidden of ['contents: write', 'issues: write', 'pull-requests: write']) {
  mustNotContain(workflowPath, workflow, forbidden);
}

const pagesPath = '.github/workflows/pages.yml';
const pages = requireText(pagesPath);
mustContain(pagesPath, pages, 'P27_SITE_URL: ${{ needs.deploy.outputs.page_url }}');
mustContain(pagesPath, pages, 'bun run quality:production-p27');

const docsPath = 'docs/P27_POST_RELEASE_BURN_IN.md';
const docs = requireText(docsPath).toLowerCase();
for (const marker of ['synthetic', '72-hour', 'no player telemetry', 'every six hours', 'p26']) {
  mustContain(docsPath, docs, marker);
}

if (errors.length) {
  console.error('P27 OPERATIONAL RELIABILITY CONTRACT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('P27 OPERATIONAL RELIABILITY CONTRACT — PASS');
console.log('Synthetic-only production probes, scheduled burn-in, read-only permissions, deployed certification, and P26 continuity are wired permanently.');
