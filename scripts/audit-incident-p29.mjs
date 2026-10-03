import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  RUNBOOKS,
  assessControlPlaneFreshness,
  assessRecovery,
  classifyFailures,
  computeSlo,
  deploymentCorrelation,
  latestRun,
  runTimestamp,
} from './p29-incident-core.mjs';

const repo = process.env.GITHUB_REPOSITORY || 'thiepn/arcade';
const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';
const token = process.env.GITHUB_TOKEN || '';
const inputPath = process.env.P29_P27_REPORT || 'p29-input/production-telemetry.json';
const outputDir = process.env.P29_REPORT_DIR || 'p29-report';
const windowDays = integerEnv('P29_WINDOW_DAYS', 7, 90, 30);
const targetPct = numberEnv('P29_SLO_TARGET', 90, 100, 99);
const minCheckpoints = integerEnv('P29_MIN_CHECKPOINTS', 1, 100, 12);
const recoveryStreakRequired = integerEnv('P29_RECOVERY_STREAK', 1, 10, 2);
const maxEvidenceAgeHours = integerEnv('P29_MAX_EVIDENCE_AGE_HOURS', 6, 24, 8);
const mutateIssues = process.env.P29_MUTATE_ISSUES !== '0';
const incidentMarker = '<!-- p28-production-slo-incident -->';
const diagnosticPrefix = '<!-- p29-diagnostic:';
const recoveryMarker = '<!-- p29-recovery-verification -->';
const backstopMarker = '<!-- p29-incident-backstop -->';

function integerEnv(name, min, max, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function numberEnv(name, min, max, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

async function github(path, init = {}) {
  if (!token) throw new Error('P29 requires GITHUB_TOKEN for Actions history and incident lifecycle');
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
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error('GitHub API returned non-JSON for ' + path + ': ' + text.slice(0, 500));
    }
  }
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

async function listOpenIssues() {
  const body = await github('/repos/' + repo + '/issues?state=open&per_page=100');
  return Array.isArray(body) ? body.filter((issue) => !issue.pull_request) : [];
}

async function findIncident() {
  const issues = await listOpenIssues();
  return issues.find((issue) => typeof issue.body === 'string' && issue.body.includes(incidentMarker)) || null;
}

async function issueComments(number) {
  const body = await github('/repos/' + repo + '/issues/' + number + '/comments?per_page=100');
  return Array.isArray(body) ? body : [];
}

function shortSha(sha) {
  return typeof sha === 'string' && sha ? sha.slice(0, 12) : 'unknown';
}

function runView(run) {
  if (!run) return null;
  return {
    id: run.id || null,
    name: run.name || null,
    event: run.event || null,
    conclusion: run.conclusion || null,
    headSha: run.head_sha || null,
    completedAt: run.completed_at || run.updated_at || run.created_at || null,
    url: run.html_url || null,
  };
}

function fingerprintPayload(report) {
  return JSON.stringify({
    incidentReason: report.incident.reason,
    classes: report.diagnostics.failureClasses,
    probeStatus: report.independentProbe.status,
    failures: report.independentProbe.failures,
    warnings: report.independentProbe.warnings,
    p27Latest: report.controlPlane.latestP27?.conclusion || null,
    p28Latest: report.controlPlane.latestP28?.conclusion || null,
    deployment: report.deployment.latest?.headSha || null,
    sloPct: report.slo.successPct,
    sloFailures: report.slo.failedCheckpoints,
  });
}

function diagnosticCommentRunbooks(_prefix, runbooks, _self) {
  return runbooks.flatMap((item) => [
    '- **' + item.classification + '** → `' + item.path + '` (' + item.owner + ')',
    ...item.firstActions.map((action) => '  - ' + action),
  ]);
}

function buildDiagnosticComment(report, fingerprint) {
  const runbookLines = diagnosticCommentRunbooks('', report.diagnostics.runbooks, null);
  const recentP27 = report.timeline.p27Scheduled.slice(0, 6).map((run) =>
    '- ' + (run.completedAt || 'unknown') + ' — **' + (run.conclusion || 'unknown') + '** — `' + shortSha(run.headSha) + '`'
  );
  return [
    diagnosticPrefix + fingerprint + ' -->',
    '## P29 automated diagnostics',
    '',
    'This diagnostic is synthetic and read-only. It does not redeploy, rotate credentials, change scoring, or mutate production data.',
    '',
    '- Independent P27 verification: **' + report.independentProbe.status.toUpperCase() + '** across ' + report.independentProbe.sampleCount + ' sample(s)',
    '- Incident reason: **' + report.incident.reason + '**',
    '- Failure classes: ' + (report.diagnostics.failureClasses.join(', ') || 'none'),
    '- 30-day checkpoint SLO: ' + (report.slo.successPct === null ? 'n/a' : report.slo.successPct + '%') + ' / ' + report.slo.targetPct + '%',
    '- P27 scheduled evidence fresh: ' + (report.controlPlane.p27Fresh ? 'yes' : 'no'),
    '- P28 control evidence fresh: ' + (report.controlPlane.p28Fresh ? 'yes' : 'no'),
    '- Latest production deployment SHA: `' + shortSha(report.deployment.latest?.headSha) + '`',
    '- Deployment-adjacent correlation: ' + (report.deployment.deploymentAdjacent ? 'yes — correlation only, not proof of cause' : 'no'),
    '',
    '### Runbook routing',
    '',
    ...(runbookLines.length ? runbookLines : ['- No hard failure class is active. Use the P29 index runbook for control-plane/readiness investigation.']),
    '',
    '### Recent scheduled P27 checkpoints',
    '',
    ...(recentP27.length ? recentP27 : ['- No scheduled checkpoint history available.']),
  ].join('\n');
}

function recoveryComment(report) {
  return [
    recoveryMarker,
    '## P29 recovery verification — PASS',
    '',
    'Recovery was independently verified before incident closure:',
    '',
    '- three-sample P27 production verification: **healthy**, with zero warnings/failures;',
    '- required scheduled P27 recovery streak: **' + report.slo.recoveryStreakRequired + '/' + report.slo.recoveryStreakRequired + '** green;',
    '- rolling synthetic SLO breach: **no**;',
    '- latest P28 control run: **success**;',
    '- latest production deployment: **success**;',
    '- P27/P28 control-plane freshness: **' + (report.controlPlane.p27Fresh && report.controlPlane.p28Fresh ? 'current' : 'stale') + '**.',
    '',
    'P29 closes the incident only after these independent checks. No production mutation or redeployment was performed by the verifier.',
  ].join('\n');
}

function backstopBody(report) {
  return [
    incidentMarker,
    backstopMarker,
    '# Production reliability incident',
    '',
    'P29 opened this incident as a diagnostic backstop because independent production verification found a hard reliability condition while no open P28 incident issue was present.',
    '',
    '- Reason: **' + report.incident.reason + '**',
    '- Independent probe: **' + report.independentProbe.status + '**',
    '- Failure classes: ' + (report.diagnostics.failureClasses.join(', ') || 'unknown-production-contract'),
    '- Latest production SHA: `' + shortSha(report.deployment.latest?.headSha) + '`',
    '',
    'Runbook index: `docs/P29_INCIDENT_RUNBOOKS.md`',
    '',
    'This automation does not remediate production. It only preserves evidence and creates the incident control surface.',
  ].join('\n');
}

async function maintainIncident(report) {
  if (!mutateIssues) return { action: 'disabled', issueNumber: null, issueUrl: null };

  let incident = await findIncident();
  if (report.incident.active && !incident) {
    incident = await github('/repos/' + repo + '/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: 'P28 Production Reliability Incident',
        body: backstopBody(report),
      }),
    });
  }

  if (!incident) return { action: 'none', issueNumber: null, issueUrl: null };

  const recovery = assessRecovery({
    openIncident: incident,
    independentProbe: report.independentProbe.raw,
    slo: report.slo.raw,
    latestP28: report.controlPlane.latestP28Raw,
    latestDeployment: report.deployment.latestRaw,
    controlPlaneFresh: report.controlPlane.p27Fresh && report.controlPlane.p28Fresh,
  });

  if (recovery.verified) {
    const comments = await issueComments(incident.number);
    if (!comments.some((comment) => typeof comment.body === 'string' && comment.body.includes(recoveryMarker))) {
      await github('/repos/' + repo + '/issues/' + incident.number + '/comments', {
        method: 'POST',
        body: JSON.stringify({ body: recoveryComment(report) }),
      });
    }
    const closed = await github('/repos/' + repo + '/issues/' + incident.number, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    });
    return { action: 'recovery-verified-and-closed', issueNumber: closed.number, issueUrl: closed.html_url, recovery };
  }

  const fingerprint = createHash('sha256').update(fingerprintPayload(report)).digest('hex').slice(0, 16);
  const marker = diagnosticPrefix + fingerprint + ' -->';
  const comments = await issueComments(incident.number);
  if (!comments.some((comment) => typeof comment.body === 'string' && comment.body.includes(marker))) {
    await github('/repos/' + repo + '/issues/' + incident.number + '/comments', {
      method: 'POST',
      body: JSON.stringify({ body: buildDiagnosticComment(report, fingerprint) }),
    });
    return { action: report.incident.active ? 'diagnostic-commented' : 'recovery-pending-commented', issueNumber: incident.number, issueUrl: incident.html_url, recovery, fingerprint };
  }

  return { action: report.incident.active ? 'diagnostic-unchanged' : 'recovery-pending', issueNumber: incident.number, issueUrl: incident.html_url, recovery, fingerprint };
}

function markdown(report) {
  const runbookRows = report.diagnostics.runbooks.map((item) => '| ' + item.classification + ' | ' + item.owner + ' | `' + item.path + '` |').join('\n');
  return [
    '# P29 incident diagnostics / recovery verification',
    '',
    '- State: **' + report.status.toUpperCase() + '**',
    '- Synthetic-only: yes; no player/session telemetry',
    '- Independent P27 probe: **' + report.independentProbe.status.toUpperCase() + '** / ' + report.independentProbe.sampleCount + ' sample(s)',
    '- Rolling checkpoint SLO: ' + (report.slo.successPct === null ? 'n/a' : report.slo.successPct + '%') + ' / ' + report.slo.targetPct + '%',
    '- Control-plane freshness: P27 ' + (report.controlPlane.p27Fresh ? 'fresh' : 'stale') + ', P28 ' + (report.controlPlane.p28Fresh ? 'fresh' : 'stale'),
    '- Latest production SHA: `' + shortSha(report.deployment.latest?.headSha) + '`',
    '- Deployment-adjacent: ' + (report.deployment.deploymentAdjacent ? 'yes (correlation only)' : 'no'),
    '- Incident action: ' + report.incidentAutomation.action,
    '',
    '| Classification | First owner | Runbook |',
    '| --- | --- | --- |',
    runbookRows || '| none | n/a | `docs/P29_INCIDENT_RUNBOOKS.md` |',
    '',
    'P29 never performs autonomous production remediation.',
  ].join('\n') + '\n';
}

const independentProbeRaw = JSON.parse(await readFile(inputPath, 'utf8'));
if (independentProbeRaw.phase !== 'P27' || independentProbeRaw.syntheticOnly !== true) {
  throw new Error('P29 input must be a synthetic P27 production report');
}

const nowMs = Date.now();
const [p27Runs, p28Runs, deploymentRuns, ciRuns] = await Promise.all([
  listWorkflowRuns('p27-production-burnin.yml'),
  listWorkflowRuns('p28-reliability-control.yml'),
  listWorkflowRuns('pages.yml'),
  listWorkflowRuns('ci.yml'),
]);

const sloRaw = computeSlo(p27Runs, nowMs, {
  windowDays,
  targetPct,
  minCheckpoints,
  recoveryStreakRequired,
});
const freshnessRaw = assessControlPlaneFreshness({
  nowMs,
  p27Runs,
  p28Runs,
  maxAgeMs: maxEvidenceAgeHours * 60 * 60 * 1000,
});
const latestP28Raw = latestRun(p28Runs);
const latestDeploymentRaw = latestRun(deploymentRuns, (run) => run.head_branch === 'main');
const deploymentCorrelationRaw = deploymentCorrelation(independentProbeRaw.generatedAt, deploymentRuns.filter((run) => run.head_branch === 'main'));
const failureClasses = classifyFailures(independentProbeRaw.failures || []);
const independentHardFailure = independentProbeRaw.status === 'unhealthy' || (independentProbeRaw.failures || []).length > 0;
const controlPlaneStale = !freshnessRaw.p27Fresh || !freshnessRaw.p28Fresh;
const activeReason = independentHardFailure
  ? 'independent-production-contract-failure'
  : sloRaw.breach
    ? 'rolling-synthetic-slo-breach'
    : controlPlaneStale
      ? 'operational-control-plane-stale'
      : 'none';
const incidentActive = independentHardFailure || sloRaw.breach || controlPlaneStale;

const diagnosticClasses = failureClasses.length
  ? failureClasses
  : activeReason === 'operational-control-plane-stale'
    ? ['control-plane-stale']
    : incidentActive
      ? ['unknown-production-contract']
      : [];

const report = {
  schemaVersion: 1,
  phase: 'P29',
  generatedAt: new Date().toISOString(),
  syntheticOnly: true,
  status: incidentActive ? 'incident' : independentProbeRaw.status === 'degraded' ? 'degraded' : sloRaw.established ? 'ready' : 'warming',
  independentProbe: {
    status: independentProbeRaw.status,
    generatedAt: independentProbeRaw.generatedAt,
    sampleCount: independentProbeRaw.sampleCount,
    failures: independentProbeRaw.failures || [],
    warnings: independentProbeRaw.warnings || [],
    raw: independentProbeRaw,
  },
  slo: {
    windowDays: sloRaw.windowDays,
    targetPct: sloRaw.targetPct,
    minCheckpoints: sloRaw.minCheckpoints,
    recoveryStreakRequired: sloRaw.recoveryStreakRequired,
    totalCheckpoints: sloRaw.totalCheckpoints,
    successfulCheckpoints: sloRaw.successfulCheckpoints,
    failedCheckpoints: sloRaw.failedCheckpoints,
    successPct: sloRaw.successPct,
    established: sloRaw.established,
    breach: sloRaw.breach,
    errorBudgetAllowed: sloRaw.errorBudgetAllowed,
    errorBudgetRemaining: sloRaw.errorBudgetRemaining,
    scheduledRecovery: sloRaw.scheduledRecovery,
    recoveryConclusions: sloRaw.recoveryConclusions,
    raw: sloRaw,
  },
  controlPlane: {
    maxEvidenceAgeHours,
    p27Fresh: freshnessRaw.p27Fresh,
    p28Fresh: freshnessRaw.p28Fresh,
    p27AgeMs: freshnessRaw.p27AgeMs,
    p28AgeMs: freshnessRaw.p28AgeMs,
    latestP27: runView(freshnessRaw.latestP27),
    latestP28: runView(freshnessRaw.latestP28),
    latestP28Raw,
  },
  deployment: {
    latest: runView(latestDeploymentRaw),
    latestRaw: latestDeploymentRaw,
    ageMs: deploymentCorrelationRaw.ageMs,
    deploymentAdjacent: deploymentCorrelationRaw.deploymentAdjacent,
    thresholdMs: deploymentCorrelationRaw.thresholdMs,
  },
  incident: {
    active: incidentActive,
    reason: activeReason,
  },
  diagnostics: {
    failureClasses: diagnosticClasses,
    runbooks: diagnosticClasses.map((classification) => ({
      classification,
      ...(RUNBOOKS[classification] || RUNBOOKS['unknown-production-contract']),
    })),
  },
  timeline: {
    p27Scheduled: sloRaw.scheduled.slice(0, 12).map(runView),
    p28: [...p28Runs].sort((a, b) => runTimestamp(b) - runTimestamp(a)).slice(0, 8).map(runView),
    deployments: [...deploymentRuns].sort((a, b) => runTimestamp(b) - runTimestamp(a)).slice(0, 8).map(runView),
    ci: [...ciRuns].sort((a, b) => runTimestamp(b) - runTimestamp(a)).slice(0, 8).map(runView),
  },
};

report.incidentAutomation = await maintainIncident(report);

delete report.independentProbe.raw;
delete report.slo.raw;
delete report.controlPlane.latestP28Raw;
delete report.deployment.latestRaw;

await mkdir(outputDir, { recursive: true });
await writeFile(outputDir + '/diagnostics.json', JSON.stringify(report, null, 2) + '\n');
const summary = markdown(report);
await writeFile(outputDir + '/summary.md', summary);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, '\n' + summary, { flag: 'a' });

console.log('P29 INCIDENT / RECOVERY VERIFICATION — ' + report.status.toUpperCase());
console.log('Independent P27 probe: ' + report.independentProbe.status + ' across ' + report.independentProbe.sampleCount + ' sample(s).');
console.log('Incident action: ' + report.incidentAutomation.action + '.');

if (incidentActive) process.exit(1);
if (report.incidentAutomation.action === 'recovery-pending' || report.incidentAutomation.action === 'recovery-pending-commented') process.exit(1);
