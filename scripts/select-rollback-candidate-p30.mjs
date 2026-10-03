import { mkdir, writeFile } from 'node:fs/promises';
import { hasSuccessfulCi, selectRollbackCandidate } from './p30-recovery-core.mjs';
import { resolveProductionDeploymentRuns } from './p30-github-deployments.mjs';

const repo = process.env.GITHUB_REPOSITORY || 'thiepn/arcade';
const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';
const token = process.env.GITHUB_TOKEN || '';
const outputDir = process.env.P30_REPORT_DIR || 'p30-report';

async function github(path) {
  if (!token) throw new Error('P30 rollback selection requires GITHUB_TOKEN');
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
  for (let page = 1; page <= 4; page += 1) {
    const body = await github('/repos/' + repo + '/actions/workflows/' + encodeURIComponent(file) + '/runs?status=completed&per_page=100&page=' + page);
    const batch = Array.isArray(body?.workflow_runs) ? body.workflow_runs : [];
    runs.push(...batch);
    if (batch.length < 100) break;
  }
  return runs;
}

const [deploymentRuns, ciRuns] = await Promise.all([
  resolveProductionDeploymentRuns({ repo, github, workflowRuns }),
  workflowRuns('ci.yml'),
]);
const selection = selectRollbackCandidate(deploymentRuns);

if (!selection.current) throw new Error('P30 could not identify a successful current production deployment');
if (!selection.candidate) throw new Error('P30 could not identify a previous distinct successful production deployment');
if (!hasSuccessfulCi(ciRuns, selection.candidate.deployed_sha)) {
  throw new Error('P30 rollback candidate lacks successful main push CI evidence: ' + selection.candidate.deployed_sha);
}

const report = {
  schemaVersion: 1,
  phase: 'P30',
  generatedAt: new Date().toISOString(),
  current: {
    sha: selection.current.deployed_sha,
    workflow: selection.current.name,
    runId: selection.current.id || null,
    url: selection.current.html_url || null,
    completedAt: selection.current.completed_at || null,
  },
  candidate: {
    sha: selection.candidate.deployed_sha,
    workflow: selection.candidate.name,
    runId: selection.candidate.id || null,
    url: selection.candidate.html_url || null,
    completedAt: selection.candidate.completed_at || null,
    successfulCi: true,
  },
  uniqueSuccessfulDeploymentsObserved: selection.history.length,
};

await mkdir(outputDir, { recursive: true });
await writeFile(outputDir + '/selection.json', JSON.stringify(report, null, 2) + '\n');

if (process.env.GITHUB_OUTPUT) {
  await writeFile(process.env.GITHUB_OUTPUT, [
    'current_sha=' + report.current.sha,
    'candidate_sha=' + report.candidate.sha,
    'candidate_run_id=' + (report.candidate.runId || ''),
  ].join('\n') + '\n', { flag: 'a' });
}

console.log('P30 ROLLBACK CANDIDATE — SELECTED');
console.log('Current production: ' + report.current.sha);
console.log('Previous known-good candidate: ' + report.candidate.sha);
