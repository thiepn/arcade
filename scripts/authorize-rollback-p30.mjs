import { mkdir, writeFile } from 'node:fs/promises';
import { PRODUCTION_WORKFLOWS, validateRollbackAuthorization } from './p30-recovery-core.mjs';

const repo = process.env.GITHUB_REPOSITORY || 'thiepn/arcade';
const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';
const token = process.env.GITHUB_TOKEN || '';
const targetSha = process.env.P30_TARGET_SHA || '';
const confirmSha = process.env.P30_CONFIRM_SHA || '';
const outputDir = process.env.P30_REPORT_DIR || 'p30-authorization';

async function github(path) {
  if (!token) throw new Error('P30 rollback authorization requires GITHUB_TOKEN');
  const response = await fetch(apiBase + path, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error('GitHub API ' + response.status + ' for ' + path + ': ' + text.slice(0, 500));
  return body;
}

async function workflowRuns(file) {
  const runs = [];
  for (let page = 1; page <= 5; page += 1) {
    const body = await github('/repos/' + repo + '/actions/workflows/' + encodeURIComponent(file) + '/runs?status=completed&per_page=100&page=' + page);
    const batch = Array.isArray(body?.workflow_runs) ? body.workflow_runs : [];
    runs.push(...batch);
    if (batch.length < 100) break;
  }
  return runs;
}

const [ciRuns, ...deploymentSets] = await Promise.all([
  workflowRuns('ci.yml'),
  ...PRODUCTION_WORKFLOWS.map(workflowRuns),
]);

const result = validateRollbackAuthorization({
  targetSha,
  confirmSha,
  deploymentRuns: deploymentSets.flat(),
  ciRuns,
});

const report = {
  schemaVersion: 1,
  phase: 'P30',
  generatedAt: new Date().toISOString(),
  authorized: result.authorized,
  targetSha: result.targetSha,
  currentSha: result.currentSha,
  errors: result.errors,
  targetEvidence: result.targetRun ? {
    workflow: result.targetRun.name,
    runId: result.targetRun.id || null,
    url: result.targetRun.html_url || null,
    completedAt: result.targetRun.completed_at || null,
  } : null,
};

await mkdir(outputDir, { recursive: true });
await writeFile(outputDir + '/authorization.json', JSON.stringify(report, null, 2) + '\n');

if (process.env.GITHUB_OUTPUT && report.targetSha) {
  await writeFile(process.env.GITHUB_OUTPUT, 'target_sha=' + report.targetSha + '\ncurrent_sha=' + (report.currentSha || '') + '\n', { flag: 'a' });
}

if (!result.authorized) {
  console.error('P30 GUARDED ROLLBACK AUTHORIZATION — REJECTED');
  for (const error of result.errors) console.error('- ' + error);
  process.exit(1);
}

console.log('P30 GUARDED ROLLBACK AUTHORIZATION — PASS');
console.log('Certified historical production target: ' + result.targetSha);
console.log('Currently deployed production SHA: ' + result.currentSha);
