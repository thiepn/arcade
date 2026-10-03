import { existsSync, readFileSync } from 'node:fs';

const repo = process.env.GITHUB_REPOSITORY || 'thiepn/arcade';
const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';
const token = process.env.GITHUB_TOKEN || '';
const exportOutcome = process.env.P31_EXPORT_OUTCOME || 'unknown';
const encryptOutcome = process.env.P31_ENCRYPT_OUTCOME || 'unknown';
const manifestPath = process.env.P31_MANIFEST || 'p31-offsite/manifest.json';
const marker = '<!-- p31-backend-backup-readiness -->';
const title = 'P31 Backend Backup Readiness';

async function github(path, init = {}) {
  if (!token) throw new Error('P31 readiness requires GITHUB_TOKEN');
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
  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : null;
  if (!response.ok) throw new Error('GitHub API ' + response.status + ': ' + bodyText.slice(0, 500));
  return body;
}

async function findIssue() {
  const issues = await github('/repos/' + repo + '/issues?state=open&per_page=100');
  return (Array.isArray(issues) ? issues : []).find(
    (issue) => !issue.pull_request && typeof issue.body === 'string' && issue.body.includes(marker),
  ) || null;
}

let manifest = null;
if (existsSync(manifestPath)) {
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch {}
}

const healthy =
  exportOutcome === 'success' &&
  encryptOutcome === 'success' &&
  manifest?.format === 'arcade-p31-offsite-evidence-v1' &&
  manifest?.verification_ok === true &&
  /^[0-9a-f]{64}$/.test(String(manifest?.ciphertext_sha256 || ''));

const existing = await findIssue();

if (!healthy) {
  const body = [
    marker,
    '# Backend backup readiness failure',
    '',
    'The P31 encrypted off-site backup pipeline did not complete its full export → verification → encryption contract.',
    '',
    '- Export outcome: **' + exportOutcome + '**',
    '- Encryption outcome: **' + encryptOutcome + '**',
    '- Valid evidence manifest: **' + (manifest ? 'present' : 'missing') + '**',
    '- Production data was not restored or mutated by this workflow.',
    '',
    'Runbook: docs/P31_BACKEND_DATA_RESILIENCE.md',
  ].join('\n');
  if (existing) {
    await github('/repos/' + repo + '/issues/' + existing.number, {
      method: 'PATCH', body: JSON.stringify({ title, body }),
    });
    console.error('P31 BACKUP READINESS — NOT READY (issue updated #' + existing.number + ')');
  } else {
    const created = await github('/repos/' + repo + '/issues', {
      method: 'POST', body: JSON.stringify({ title, body }),
    });
    console.error('P31 BACKUP READINESS — NOT READY (issue opened #' + created.number + ')');
  }
  process.exit(1);
}

if (existing) {
  await github('/repos/' + repo + '/issues/' + existing.number + '/comments', {
    method: 'POST',
    body: JSON.stringify({ body: 'P31 backup readiness recovered: a fresh verified snapshot passed the transaction-scoped restore drill and was encrypted successfully for off-site retention. Closing this readiness issue.' }),
  });
  await github('/repos/' + repo + '/issues/' + existing.number, {
    method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
  });
  console.log('P31 BACKUP READINESS — READY (recovered issue #' + existing.number + ')');
} else {
  console.log('P31 BACKUP READINESS — READY');
}
console.log('Snapshot: ' + manifest.snapshot_id + '; rows: ' + manifest.total_rows + '; encrypted artifact SHA-256: ' + manifest.ciphertext_sha256);
