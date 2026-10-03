import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deployedSha, runTimestamp } from './p30-recovery-core.mjs';
import { resolveProductionDeploymentRuns } from './p30-github-deployments.mjs';

const repo = process.env.GITHUB_REPOSITORY || 'thiepn/arcade';
const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';
const token = process.env.GITHUB_TOKEN || '';
const windowDays = clampInteger(process.env.P28_WINDOW_DAYS, 7, 90, 30);
const targetPct = clampNumber(process.env.P28_SLO_TARGET, 90, 100, 99);
const minCheckpoints = clampInteger(process.env.P28_MIN_CHECKPOINTS, 1, 100, 12);
const recoveryStreakRequired = clampInteger(process.env.P28_RECOVERY_STREAK, 1, 10, 2);
const inputPath = process.env.P28_P27_REPORT || 'p28-input/production-telemetry.json';
const outputDir = process.env.P28_REPORT_DIR || 'p28-report';
const mutateIssues = process.env.P28_MUTATE_ISSUES !== '0';
const incidentMarker = '<!-- p28-production-slo-incident -->';
const incidentTitle = 'P28 Production Reliability Incident';

function clampInteger(raw, min, max, fallback) {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function clampNumber(raw, min, max, fallback) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

async function github(path, init = {}) {
  if (!token) throw new Error('P28 requires GITHUB_TOKEN for Actions history and incident automation');
  const response = await fetch(apiBase + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error('GitHub API ' + response.status + ' for ' + path + ': ' + text.slice(0, 500));
  return body;
}

async function listWorkflowRuns(workflowFile) {
  const runs = [];
  for (let page = 1; page <= 5; page += 1) {
    const body = await github('/repos/' + repo + '/actions/workflows/' + encodeURIComponent(workflowFile) + '/runs?status=completed&per_page=100&page=' + page);
    const batch = Array.isArray(body?.workflow_runs) ? body.workflow_runs : [];
    runs.push(...batch);
    if (batch.length < 100) break;
  }
  return runs;
}

function pct(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function classifyFailures(failures) {
  const categories = new Set();
  for (const failure of failures || []) {
    if (/site-root|asset-manifest|service-worker|webmanifest/.test(failure)) categories.add('pages-artifact');
    if (/api-cors/.test(failure)) categories.add('cors');
    if (/api-health/.test(failure)) categories.add('backend-health');
    if (/api-overall|api-weekly/.test(failure)) categories.add('leaderboard-read-path');
  }
  if (!categories.size && failures?.length) categories.add('unknown-production-contract');
  return [...categories];
}

function issueBody(report) {
  const deployment = report.deployment;
  const current = report.currentProbe;
  const rolling = report.rollingSlo;
  return [
    incidentMarker,
    '# Production reliability incident',
    '',
    'This issue is maintained automatically by P28. It is based only on synthetic production probes and GitHub Actions history; no player/session telemetry is collected.',
    '',
    '## Current state',
    '',
    '- Incident reason: **' + report.incident.reason + '**',
    '- Current synthetic probe: **' + current.status + '**',
    '- Failure classes: ' + (report.incident.failureClasses.join(', ') || 'none'),
    '- Rolling window: ' + rolling.windowDays + ' days',
    '- Scheduled checkpoints observed: ' + rolling.totalCheckpoints,
    '- Successful checkpoints: ' + rolling.successfulCheckpoints,
    '- Failed checkpoints: ' + rolling.failedCheckpoints,
    '- Synthetic checkpoint success: ' + (rolling.successPct === null ? 'n/a' : rolling.successPct + '%'),
    '- SLO target: ' + rolling.targetPct + '%',
    '- Error budget remaining: ' + rolling.errorBudgetRemaining + ' checkpoint(s)',
    '- Evidence state: ' + (rolling.established ? 'established' : 'warming until ' + rolling.minCheckpoints + ' checkpoints'),
    '',
    '## Deployment correlation',
    '',
    '- Latest successful production workflow SHA: `' + (deployment.sha || 'unknown') + '`',
    '- Production workflow: ' + (deployment.url || 'unavailable'),
    '- Completed: ' + (deployment.completedAt || 'unknown'),
    '',
    '## Current probe findings',
    '',
    ...(current.failures.length ? current.failures.map((item) => '- FAIL: ' + item) : ['- No hard production-contract failure in the fresh probe.']),
    ...(current.warnings.length ? current.warnings.map((item) => '- WARN: ' + item) : []),
    '',
    'P28 does not autonomously redeploy, rotate credentials, alter scoring, or mutate production data. Recovery requires the production checks to return healthy and the configured recovery streak to be satisfied.',
  ].join('\n');
}

async function findOpenIncident() {
  const body = await github('/repos/' + repo + '/issues?state=open&per_page=100');
  return (Array.isArray(body) ? body : []).find((issue) => !issue.pull_request && typeof issue.body === 'string' && issue.body.includes(incidentMarker)) || null;
}

async function maintainIncident(report) {
  if (!mutateIssues) return { action: 'disabled', issueNumber: null, issueUrl: null };
  const existing = await findOpenIncident();
  if (report.incident.active) {
    const body = issueBody(report);
    if (existing) {
      const updated = await github('/repos/' + repo + '/issues/' + existing.number, { method: 'PATCH', body: JSON.stringify({ title: incidentTitle, body }) });
      return { action: 'updated', issueNumber: updated.number, issueUrl: updated.html_url };
    }
    const created = await github('/repos/' + repo + '/issues', { method: 'POST', body: JSON.stringify({ title: incidentTitle, body }) });
    return { action: 'opened', issueNumber: created.number, issueUrl: created.html_url };
  }
  if (existing && report.incident.recoveryReady) {
    return {
      action: 'ready-for-p29-verification',
      issueNumber: existing.number,
      issueUrl: existing.html_url,
    };
  }
  if (existing) return { action: 'recovering', issueNumber: existing.number, issueUrl: existing.html_url };
  return { action: 'none', issueNumber: null, issueUrl: null };
}

function markdown(report) {
  const r = report.rollingSlo;
  const d = report.deployment;
  const i = report.incident;
  return [
    '# P28 production reliability control',
    '',
    '- State: **' + report.status.toUpperCase() + '**',
    '- Synthetic-only: yes; no player/session telemetry',
    '- Fresh P27 probe: **' + report.currentProbe.status.toUpperCase() + '**',
    '- Rolling synthetic checkpoint SLO: ' + (r.successPct === null ? 'n/a' : r.successPct + '%') + ' / target ' + r.targetPct + '%',
    '- Window: ' + r.windowDays + ' days; ' + r.totalCheckpoints + ' scheduled checkpoints',
    '- Error budget: ' + r.errorBudgetRemaining + ' remaining of ' + r.errorBudgetAllowed + ' allowed failed checkpoint(s)',
    '- SLO evidence: ' + (r.established ? 'established' : 'warming (' + r.totalCheckpoints + '/' + r.minCheckpoints + ')'),
    '- Incident: ' + (i.active ? i.reason : 'none') + '; automation action: ' + report.incidentAutomation.action,
    '- Latest successful production SHA: `' + (d.sha || 'unknown') + '`',
    '- Production workflow: ' + (d.url || 'unavailable'),
    '',
    'Latency remains diagnostic/observational because GitHub-hosted runner geography is not end-user latency.',
  ].join('\n') + '\n';
}

const currentProbe = JSON.parse(await readFile(inputPath, 'utf8'));
if (currentProbe.phase !== 'P27' || currentProbe.syntheticOnly !== true) throw new Error('P28 input must be a synthetic P27 production report');

const now = Date.now();
const cutoff = now - windowDays * 86_400_000;
const p27Runs = await listWorkflowRuns('p27-production-burnin.yml');
const scheduled = p27Runs
  .filter((run) => run.event === 'schedule' && Date.parse(run.completed_at || run.updated_at || run.created_at) >= cutoff)
  .sort((a, b) => Date.parse(b.completed_at || b.updated_at || b.created_at) - Date.parse(a.completed_at || a.updated_at || a.created_at));
const successes = scheduled.filter((run) => run.conclusion === 'success').length;
const failures = scheduled.length - successes;
const successPct = pct(successes, scheduled.length);
const established = scheduled.length >= minCheckpoints;
const sloBreach = established && successPct !== null && successPct < targetPct;
const allowedFailureFraction = 1 - targetPct / 100;
const errorBudgetAllowed = Math.max(0, Math.floor(scheduled.length * allowedFailureFraction + 1e-9));
const errorBudgetRemaining = Math.max(0, errorBudgetAllowed - failures);
const recoverySlice = scheduled.slice(0, recoveryStreakRequired);
const scheduledRecovery = recoverySlice.length >= recoveryStreakRequired && recoverySlice.every((run) => run.conclusion === 'success');

const productionDeploymentRuns = await resolveProductionDeploymentRuns({ repo, github, workflowRuns: listWorkflowRuns });
const latestDeployment = productionDeploymentRuns
  .filter((run) => run.head_branch === 'main' && deployedSha(run))
  .sort((a, b) => runTimestamp(b) - runTimestamp(a))[0];

const currentUnhealthy = currentProbe.status === 'unhealthy' || currentProbe.failures?.length > 0;
const failureClasses = classifyFailures(currentProbe.failures || []);
const incidentActive = currentUnhealthy || sloBreach;
const recoveryReady = !incidentActive && currentProbe.status === 'healthy' && scheduledRecovery;
const reason = currentUnhealthy ? 'fresh-production-contract-failure' : sloBreach ? 'rolling-synthetic-slo-breach' : 'none';

const report = {
  schemaVersion: 1,
  phase: 'P28',
  generatedAt: new Date().toISOString(),
  syntheticOnly: true,
  status: incidentActive ? 'breach' : currentProbe.status === 'degraded' ? 'degraded' : established ? 'healthy' : 'warming',
  currentProbe: {
    status: currentProbe.status,
    generatedAt: currentProbe.generatedAt,
    failures: currentProbe.failures || [],
    warnings: currentProbe.warnings || [],
  },
  rollingSlo: {
    windowDays,
    targetPct,
    minCheckpoints,
    established,
    totalCheckpoints: scheduled.length,
    successfulCheckpoints: successes,
    failedCheckpoints: failures,
    successPct,
    errorBudgetAllowed,
    errorBudgetRemaining,
  },
  recovery: {
    requiredSuccessfulScheduledCheckpoints: recoveryStreakRequired,
    observedLatestConclusions: recoverySlice.map((run) => run.conclusion),
    scheduledRecovery,
  },
  deployment: {
    sha: deployedSha(latestDeployment) || null,
    url: latestDeployment?.html_url || null,
    completedAt: latestDeployment?.completed_at || null,
    runId: latestDeployment?.id || null,
  },
  incident: { active: incidentActive, reason, failureClasses, recoveryReady },
};

report.incidentAutomation = await maintainIncident(report);

await mkdir(outputDir, { recursive: true });
await writeFile(outputDir + '/reliability.json', JSON.stringify(report, null, 2) + '\n');
const summary = markdown(report);
await writeFile(outputDir + '/summary.md', summary);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, '\n' + summary, { flag: 'a' });

console.log('P28 PRODUCTION RELIABILITY CONTROL — ' + report.status.toUpperCase());
console.log('Synthetic checkpoint SLO: ' + (successPct === null ? 'n/a' : successPct + '%') + '; target ' + targetPct + '%; checkpoints ' + scheduled.length + '.');
console.log('Incident automation: ' + report.incidentAutomation.action + '.');

if (incidentActive) process.exit(1);
