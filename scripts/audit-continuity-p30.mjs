import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { assessContinuity } from './p30-recovery-core.mjs';

const repo = process.env.GITHUB_REPOSITORY || 'thiepn/arcade';
const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';
const token = process.env.GITHUB_TOKEN || '';
const selectionPath = process.env.P30_SELECTION || 'p30-report/selection.json';
const livePath = process.env.P30_LIVE_REPORT || 'p30-live/production-telemetry.json';
const outputDir = process.env.P30_OUTPUT_DIR || 'p30-report';
const candidateBuildOutcome = process.env.P30_CANDIDATE_BUILD_OUTCOME || 'unknown';
const mutateIssues = process.env.P30_MUTATE_ISSUES !== '0';
const issueMarker = '<!-- p30-disaster-recovery-readiness -->';
const issueTitle = 'P30 Disaster Recovery Readiness';

async function github(path, init = {}) {
  if (!token) throw new Error('P30 continuity reporting requires GITHUB_TOKEN');
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

async function latestP29() {
  const body = await github('/repos/' + repo + '/actions/workflows/p29-operational-readiness.yml/runs?status=completed&per_page=20');
  const runs = Array.isArray(body?.workflow_runs) ? body.workflow_runs : [];
  return runs.sort((a, b) => Date.parse(b.completed_at || b.updated_at || b.created_at) - Date.parse(a.completed_at || a.updated_at || a.created_at))[0] || null;
}

async function findReadinessIssue() {
  const body = await github('/repos/' + repo + '/issues?state=open&per_page=100');
  return (Array.isArray(body) ? body : []).find((issue) => !issue.pull_request && typeof issue.body === 'string' && issue.body.includes(issueMarker)) || null;
}

function issueBody(report) {
  return [
    issueMarker,
    '# Disaster recovery readiness failure',
    '',
    'P30 detected that the non-destructive rollback/continuity drill is not currently certifiable.',
    '',
    '- Current production SHA: `' + report.currentSha + '`',
    '- Previous known-good candidate: `' + report.candidateSha + '`',
    '- Candidate build/certification: **' + report.checks.candidateBuildOutcome + '**',
    '- Current live three-sample production probe: **' + report.checks.liveStatus + '**',
    '- Latest P29 operational readiness: **' + report.checks.latestP29Conclusion + '**',
    '',
    'This is a recovery-readiness issue, not by itself proof of a production outage. The drill never deployed the candidate or modified backend/player data.',
    '',
    'Runbook: `docs/P30_DISASTER_RECOVERY.md`',
  ].join('\n');
}

async function maintainIssue(report) {
  if (!mutateIssues) return { action: 'disabled', number: null, url: null };
  const existing = await findReadinessIssue();

  if (!report.ready) {
    const body = issueBody(report);
    if (existing) {
      const updated = await github('/repos/' + repo + '/issues/' + existing.number, {
        method: 'PATCH',
        body: JSON.stringify({ title: issueTitle, body }),
      });
      return { action: 'updated', number: updated.number, url: updated.html_url };
    }
    const created = await github('/repos/' + repo + '/issues', {
      method: 'POST',
      body: JSON.stringify({ title: issueTitle, body }),
    });
    return { action: 'opened', number: created.number, url: created.html_url };
  }

  if (existing) {
    await github('/repos/' + repo + '/issues/' + existing.number + '/comments', {
      method: 'POST',
      body: JSON.stringify({ body: 'P30 continuity drill recovered: previous known-good artifact certification, live three-sample production verification, and P29 operational readiness are green. Closing the readiness issue.' }),
    });
    const closed = await github('/repos/' + repo + '/issues/' + existing.number, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    });
    return { action: 'closed', number: closed.number, url: closed.html_url };
  }

  return { action: 'none', number: null, url: null };
}

const selection = JSON.parse(await readFile(selectionPath, 'utf8'));
const liveProbe = JSON.parse(await readFile(livePath, 'utf8'));
const p29 = await latestP29();

const normalizedSelection = {
  current: { deployed_sha: selection.current?.sha || null },
  candidate: { deployed_sha: selection.candidate?.sha || null },
};

const assessment = assessContinuity({
  selection: normalizedSelection,
  candidateBuildOutcome,
  liveProbe,
  latestP29: p29,
});

const report = {
  schemaVersion: 1,
  phase: 'P30',
  generatedAt: new Date().toISOString(),
  syntheticOnly: true,
  drillOnly: true,
  ready: assessment.ready,
  currentSha: selection.current?.sha || null,
  candidateSha: selection.candidate?.sha || null,
  checks: {
    candidateSelected: assessment.candidateSelected,
    candidateDistinct: assessment.candidateDistinct,
    candidateBuildOutcome,
    liveStatus: liveProbe.status || 'unknown',
    liveSampleCount: liveProbe.sampleCount || 0,
    liveWarnings: liveProbe.warnings || [],
    liveFailures: liveProbe.failures || [],
    latestP29Conclusion: p29?.conclusion || null,
    latestP29RunId: p29?.id || null,
  },
};

report.issueAutomation = await maintainIssue(report);

await mkdir(outputDir, { recursive: true });
await writeFile(outputDir + '/continuity.json', JSON.stringify(report, null, 2) + '\n');
const summary = [
  '# P30 disaster recovery continuity drill',
  '',
  '- State: **' + (report.ready ? 'READY' : 'NOT READY') + '**',
  '- Drill only / no deployment: yes',
  '- Current production SHA: `' + report.currentSha + '`',
  '- Previous known-good candidate: `' + report.candidateSha + '`',
  '- Candidate rebuild/certification: **' + report.checks.candidateBuildOutcome + '**',
  '- Current live P27 verification: **' + report.checks.liveStatus + '** across ' + report.checks.liveSampleCount + ' sample(s)',
  '- Latest P29 operational readiness: **' + (report.checks.latestP29Conclusion || 'unknown') + '**',
  '- Readiness issue action: ' + report.issueAutomation.action,
  '',
  'The drill does not alter GitHub Pages, Supabase, leaderboard data, scoring policy, or player state.',
].join('\n') + '\n';
await writeFile(outputDir + '/summary.md', summary);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, '\n' + summary, { flag: 'a' });

console.log('P30 DISASTER RECOVERY CONTINUITY DRILL — ' + (report.ready ? 'READY' : 'NOT READY'));
console.log('Rollback candidate: ' + report.candidateSha + '; current production: ' + report.currentSha + '.');
if (!report.ready) process.exit(1);
