import { existsSync, readFileSync } from 'node:fs';

const errors = [];
const read = (path) => readFileSync(path, 'utf8');
const need = (path, text, marker) => { if (!text.includes(marker)) errors.push(path + ': missing ' + JSON.stringify(marker)); };
const forbid = (path, text, marker) => { if (text.includes(marker)) errors.push(path + ': forbidden ' + JSON.stringify(marker)); };

const pkg = JSON.parse(read('package.json'));
if (pkg.scripts?.['quality:gameplay-p31'] !== 'bun scripts/audit-operations-p31.mjs') errors.push('package.json: quality:gameplay-p31 mismatch');
if (pkg.scripts?.['quality:operations-p31'] !== 'bun scripts/audit-operations-p31.mjs') errors.push('package.json: quality:operations-p31 mismatch');
if (pkg.scripts?.['quality:backend-p31'] !== 'bun tests/p31-backup-postgres.mjs') errors.push('package.json: quality:backend-p31 mismatch');

const migrationPath = 'supabase/migrations/20261003_arcade_p31_backend_recovery.sql';
const migration = read(migrationPath);
for (const marker of [
  'private.micro_arcade_recovery_snapshots',
  'micro_arcade_p31_schema_sha256',
  'micro_arcade_p31_build_payload',
  'micro_arcade_p31_verify_snapshot',
  'micro_arcade_p31_capture_snapshot',
  'micro_arcade_p31_restore_drill',
  'micro_arcade_p31_offsite_export',
  "'micro_arcade_rate_limits'",
  "source='daily'",
  "source='monthly'",
  "source='offsite'",
  'productionMutated',
  "jobname='micro-arcade-p31-daily'",
  "jobname='micro-arcade-p31-monthly'",
]) need(migrationPath, migration, marker);
for (const marker of [
  'TRUNCATE public.micro_arcade',
  'DROP TABLE public.micro_arcade',
  'DELETE FROM public.micro_arcade_players',
  'DELETE FROM public.micro_arcade_score_submissions',
  'GRANT SELECT ON private.micro_arcade_recovery_snapshots TO anon',
  'GRANT SELECT ON private.micro_arcade_recovery_snapshots TO authenticated',
]) forbid(migrationPath, migration, marker);

const edgePath = 'supabase/functions/micro-arcade-p31-backup-export/index.ts';
const edge = read(edgePath);
for (const marker of [
  'arcade-p31-backup',
  'thiepn/arcade',
  '1347223890',
  '229373572',
  'refs/heads/main',
  'p31-offsite-backup.yml@refs/heads/main',
  'P31 Encrypted Offsite Backup',
  'repository_visibility !== "public"',
  'runner_environment !== "github-hosted"',
  'micro_arcade_p31_offsite_export',
  'SUPABASE_SERVICE_ROLE_KEY',
]) need(edgePath, edge, marker);
for (const marker of ['Access-Control-Allow-Origin', 'serviceRoleKey:', 'console.log(payload)', 'console.log(JSON.stringify(payload))']) forbid(edgePath, edge, marker);

const workflowPath = '.github/workflows/p31-offsite-backup.yml';
const workflow = read(workflowPath);
for (const marker of [
  'name: P31 Encrypted Offsite Backup',
  "cron: '37 4 * * *'",
  'contents: read',
  'id-token: write',
  'issues: write',
  'audience=arcade-p31-backup',
  'micro-arcade-p31-backup-export',
  'python scripts/p31-verify-offsite.py p31-backup.json',
  'openssl cms -encrypt -binary -aes-256-gcm',
  'ops/p31-backup-recovery-cert.pem',
  'shred -u p31-backup.json',
  'bun scripts/p31-backup-readiness.mjs',
  'retention-days: 90',
]) need(workflowPath, workflow, marker);
for (const marker of [
  'pages: write',
  'contents: write',
  'deployments: write',
  'SUPABASE_SERVICE_ROLE_KEY:',
  'SUPABASE_DB_URL:',
  'path: p31-backup.json',
]) forbid(workflowPath, workflow, marker);

const certPath = 'ops/p31-backup-recovery-cert.pem';
const cert = read(certPath);
need(certPath, cert, 'BEGIN CERTIFICATE');
forbid(certPath, cert, 'PRIVATE KEY');

const verifier = read('scripts/p31-verify-offsite.py');
for (const marker of [
  'arcade-p31-offsite-v1',
  'micro_arcade_rate_limits',
  'play_sessions != score_sessions',
  'lb_sessions != run_sessions',
  'MAX_BYTES',
  'restore_drill_ok',
]) need('scripts/p31-verify-offsite.py', verifier, marker);

const readiness = read('scripts/p31-backup-readiness.mjs');
need('scripts/p31-backup-readiness.mjs', readiness, '<!-- p31-backend-backup-readiness -->');
need('scripts/p31-backup-readiness.mjs', readiness, 'ciphertext_sha256');

const testPath = 'tests/p31-backup-postgres.mjs';
const test = read(testPath);
for (const marker of [
  '20261003_arcade_p31_backend_recovery.sql',
  "micro_arcade_p31_capture_snapshot('manual')",
  'micro_arcade_p31_restore_drill',
  'micro_arcade_p31_offsite_export',
  'Live State Must Survive Drill',
  'rate-limit state excluded',
  "SET LOCAL ROLE",
]) need(testPath, test, marker);

const docsPath = 'docs/P31_BACKEND_DATA_RESILIENCE.md';
const docs = read(docsPath).toLowerCase();
for (const marker of [
  'supabase free plan',
  'encrypted github actions artifacts',
  'unused one-time',
  'transaction-scoped temporary tables',
  'no supabase database password',
  'private key remains outside github and supabase',
  'no automated destructive production-restore endpoint',
  'not guarantees from the free supabase plan',
]) need(docsPath, docs, marker);

const ci = read('.github/workflows/ci.yml');
need('.github/workflows/ci.yml', ci, 'bun run quality:gameplay-p31');
need('.github/workflows/ci.yml', ci, 'bun run quality:backend-p31');

if (errors.length) {
  console.error('P31 BACKEND DATA RESILIENCE / BACKUP CONTRACT — FAIL');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}
console.log('P31 BACKEND DATA RESILIENCE / BACKUP CONTRACT — PASS');
console.log('Private verified snapshots, OIDC-only export, encrypted off-site retention, non-destructive restore rehearsal, transient-session exclusion and readiness alerting are permanent.');
