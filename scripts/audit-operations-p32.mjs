import { readFileSync } from 'node:fs';

const errors=[];
const read=(path)=>readFileSync(path,'utf8');
const need=(path,text,marker)=>{if(!text.includes(marker))errors.push(path+': missing '+JSON.stringify(marker));};
const forbid=(path,text,marker)=>{if(text.includes(marker))errors.push(path+': forbidden '+JSON.stringify(marker));};

const pkg=JSON.parse(read('package.json'));
const staticCmd='bun scripts/audit-operations-p32.mjs && bun scripts/test-fullstack-recovery-p32.mjs';
if(pkg.scripts?.['quality:gameplay-p32']!==staticCmd)errors.push('package.json: quality:gameplay-p32 mismatch');
if(pkg.scripts?.['quality:operations-p32']!==staticCmd)errors.push('package.json: quality:operations-p32 mismatch');
if(pkg.scripts?.['quality:backend-p32']!=='bun tests/p32-cold-restore-postgres.mjs')errors.push('package.json: quality:backend-p32 mismatch');
if(pkg.scripts?.['quality:production-p32']!=='bun scripts/p32-finalize.mjs')errors.push('package.json: quality:production-p32 mismatch');

const corePath='scripts/p32-recovery-core.mjs';
const core=read(corePath);
for(const marker of [
  'P32_PROTECTED_TABLES','P32_TRANSIENT_EXCLUSIONS','assessColdRestore','offsiteArtifactAgeMs',
  'productionHealthyBefore','productionHealthyAfter','artifactVerified','timingValid'
])need(corePath,core,marker);

const restorePath='scripts/p32-cold-restore.mjs';
const restore=read(restorePath);
for(const marker of [
  "['127.0.0.1','localhost']",
  "/p32|recovery/i.test(parsed.pathname)",
  'supabase/migrations',
  'private.micro_arcade_p31_schema_sha256',
  'TRUNCATE',
  'OVERRIDING SYSTEM VALUE',
  "micro_arcade_p31_capture_snapshot('restore_drill')",
  'restoredPayloadSha256',
  'transientRateLimits',
])need(restorePath,restore,marker);
for(const marker of [
  'hycegznamzjhwinegaai.supabase.co',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_PASSWORD',
])forbid(restorePath,restore,marker);

const apiPath='scripts/p32-cold-api.mjs';
const api=read(apiPath);
for(const marker of [
  "createLeaderboardHandler",
  "readOnly:true",
  "micro_arcade_rate_limit",
  "micro_arcade_lb_board",
  "127.0.0.1",
])need(apiPath,api,marker);
for(const marker of ['createSupabaseStore','SUPABASE_SERVICE_ROLE_KEY','hycegznamzjhwinegaai'])forbid(apiPath,api,marker);

const browserPath='scripts/p32-browser-certify.mjs';
const browser=read(browserPath);
for(const marker of [
  '#brand-logo-btn',
  '#header-leaderboards-pill-btn',
  '/v3/leaderboards/overall',
  '/v3/leaderboards/weekly',
  '/v3/health',
  '#play-btn-orbit',
  '.game-shell',
  'readOnlyFailoverMode:true',
])need(browserPath,browser,marker);

const offsitePath='scripts/p32-offsite-reference.mjs';
const offsite=read(offsitePath);
for(const marker of [
  'arcade-p31-offsite-evidence-v1',
  'ciphertext_sha256',
  'createHash',
  'decryptedInAutomation:false',
  'offlineKeyBoundaryPreserved:true',
])need(offsitePath,offsite,marker);

const edgePath='supabase/functions/micro-arcade-p31-backup-export/index.ts';
const edge=read(edgePath);
for(const marker of [
  'WORKFLOW_POLICIES',
  'P31 Encrypted Offsite Backup',
  'arcade-p31-backup',
  'p31-offsite-backup.yml@refs/heads/main',
  'P32 Cold Recovery Exercise',
  'arcade-p32-recovery',
  'p32-cold-recovery.yml@refs/heads/main',
])need(edgePath,edge,marker);

const workflowPath='.github/workflows/p32-cold-recovery.yml';
const workflow=read(workflowPath);
for(const marker of [
  'name: P32 Cold Recovery Exercise',
  "cron: '19 6 * * 0'",
  'contents: read',
  'actions: read',
  'id-token: write',
  'issues: write',
  'image: postgres:17',
  'POSTGRES_DB: arcade_p32',
  'Production pre-exercise verification',
  'gh run download',
  'audience=arcade-p32-recovery',
  'Cold restore protected Arcade data',
  'Start exact-handler cold leaderboard API',
  'Build and start real frontend against cold API',
  'Browser certify recovered full stack',
  'Production post-exercise verification',
  'bun run quality:production-p32',
  'shred -u p32-source.json',
  'retention-days: 90',
])need(workflowPath,workflow,marker);
for(const marker of [
  'pages: write',
  'contents: write',
  'deployments: write',
  'SUPABASE_SERVICE_ROLE_KEY:',
  'SUPABASE_DB_PASSWORD:',
  'path: p32-source.json',
  'p32-latest-offsite/*.cms',
])forbid(workflowPath,workflow,marker);

const finalPath='scripts/p32-finalize.mjs';
const finalizer=read(finalPath);
for(const marker of [
  'failoverCandidateCertified',
  'productionTrafficSwitched:false',
  'productionDurableDataMutated:false',
  'encryptedArtifactDecryptedInAutomation:false',
  'coldRestoreToApiReadyMs',
  'coldRestoreToBrowserCertifiedMs',
  'fullExerciseMs',
])need(finalPath,finalizer,marker);

const readiness=read('scripts/p32-readiness.mjs');
need('scripts/p32-readiness.mjs',readiness,'<!-- p32-fullstack-recovery-readiness -->');

const dbTest=read('tests/p32-cold-restore-postgres.mjs');
for(const marker of [
  'arcade_p32_test',
  'micro_arcade_p31_offsite_export',
  'scripts/p32-cold-restore.mjs',
  'restoredPayloadSha256',
  'micro_arcade_lb_board',
])need('tests/p32-cold-restore-postgres.mjs',dbTest,marker);

const docsPath='docs/P32_FULL_STACK_DISASTER_RECOVERY.md';
const docs=read(docsPath).toLowerCase();
for(const marker of [
  'free plan',
  'offline private-key boundary',
  'does **not** upload that private key',
  'productiontrafficswitched=false',
  'not a contractual rto or rpo guarantee',
  'real frontend',
  'read-only',
  'weekly on sunday',
])need(docsPath,docs,marker);

const ci=read('.github/workflows/ci.yml');
need('.github/workflows/ci.yml',ci,'bun run quality:gameplay-p32');
need('.github/workflows/ci.yml',ci,'bun run quality:backend-p32');

if(errors.length){
  console.error('P32 FULL-STACK DISASTER RECOVERY CONTRACT — FAIL');
  for(const error of errors)console.error('- '+error);
  process.exit(1);
}
console.log('P32 FULL-STACK DISASTER RECOVERY CONTRACT — PASS');
console.log('Cold restore isolation, exact data fingerprints, exact-handler read-only API, real frontend browser certification, measured recovery timing, OIDC scoping and offline-key boundaries are permanent.');
