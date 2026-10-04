import { readFileSync } from 'node:fs';

const errors=[];
const read=p=>readFileSync(p,'utf8');
const need=(p,t,m)=>{if(!t.includes(m))errors.push(p+': missing '+JSON.stringify(m));};
const forbid=(p,t,m)=>{if(t.includes(m))errors.push(p+': forbidden '+JSON.stringify(m));};

const pkg=JSON.parse(read('package.json'));
const staticCmd='bun scripts/audit-operations-p33.mjs && bun scripts/test-offline-recovery-p33.mjs';
if(pkg.scripts?.['quality:gameplay-p33']!==staticCmd)errors.push('package.json: quality:gameplay-p33 mismatch');
if(pkg.scripts?.['quality:operations-p33']!==staticCmd)errors.push('package.json: quality:operations-p33 mismatch');
if(pkg.scripts?.['quality:backend-p33']!=='bun tests/p33-offline-ceremony-postgres.mjs')errors.push('package.json: quality:backend-p33 mismatch');
if(pkg.scripts?.['quality:assurance-p33']!=='bun scripts/p33-long-term-assurance.mjs')errors.push('package.json: quality:assurance-p33 mismatch');

const core=read('scripts/p33-recovery-core.mjs');
for(const marker of ['P33_ASSURANCE_MAX_CEREMONY_AGE_MS','90 * 24 * 60 * 60 * 1000','P33_MAX_BACKUP_AGE_MS','30 * 60 * 60 * 1000','P33_MAX_P32_AGE_MS','8 * 24 * 60 * 60 * 1000','verifyAttestationSignature','certificatePublicKeySha256','private-key public SHA-256 mismatch','PENDING_OFFLINE_CEREMONY'])need('scripts/p33-recovery-core.mjs',core,marker);

const ceremony=read('scripts/p33-offline-ceremony.sh');
for(const marker of ['P33_KEY_PASS_FILE','openssl cms -decrypt','cmp -s "$tmp/cert-public.der" "$tmp/key-public.der"','scripts/p31-verify-offsite.py','scripts/p32-cold-restore.mjs','openssl dgst -sha256 -sign','scripts/p33-verify-attestation.mjs','submit-command.txt'])need('scripts/p33-offline-ceremony.sh',ceremony,marker);
for(const marker of ['gh secret','actions/upload-artifact','SUPABASE_SERVICE_ROLE_KEY'])forbid('scripts/p33-offline-ceremony.sh',ceremony,marker);

const prepare=read('scripts/p33-prepare-ceremony.sh');
for(const marker of ['p31-offsite-backup.yml','gh run download','ciphertext_sha256','shared-recovery-private-key.pem'])need('scripts/p33-prepare-ceremony.sh',prepare,marker);

const attestationWorkflow=read('.github/workflows/p33-offline-attestation.yml');
for(const marker of ['name: P33 Offline Ceremony Attestation','workflow_dispatch:','contents: read','actions: read','issues: write','p33-verify-attestation.mjs','actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0','p33-verify-retained-artifact.mjs','p33-persist-evidence.mjs','retention-days: 90'])need('.github/workflows/p33-offline-attestation.yml',attestationWorkflow,marker);
const triggerBlock=attestationWorkflow.slice(attestationWorkflow.indexOf('on:'),attestationWorkflow.indexOf('permissions:'));
for(const marker of ['schedule:','push:','workflow_run:'])forbid('.github/workflows/p33-offline-attestation.yml trigger',triggerBlock,marker);
for(const marker of ['id-token: write','pages: write','contents: write','PRIVATE KEY','SUPABASE_SERVICE_ROLE_KEY'])forbid('.github/workflows/p33-offline-attestation.yml',attestationWorkflow,marker);

const assuranceWorkflow=read('.github/workflows/p33-long-term-assurance.yml');
for(const marker of ['name: P33 Long-Term DR Assurance',"cron: '11 6 * * *'",'contents: read','actions: read','issues: write','p33-long-term-assurance.mjs','retention-days: 90'])need('.github/workflows/p33-long-term-assurance.yml',assuranceWorkflow,marker);
for(const marker of ['pages: write','contents: write','id-token: write'])forbid('.github/workflows/p33-long-term-assurance.yml',assuranceWorkflow,marker);

const persisted=read('scripts/p33-persist-evidence.mjs');
for(const marker of ['<!-- p33-offline-ceremony-ledger -->','p33-attestation-b64:','p33-signature-b64:','state_reason'])need('scripts/p33-persist-evidence.mjs',persisted,marker);

const assurance=read('scripts/p33-long-term-assurance.mjs');
for(const marker of ['p31-offsite-backup.yml','p32-cold-recovery.yml','p33-offline-attestation.yml','<!-- p33-long-term-dr-assurance -->','verifyAttestationSignature','PENDING_OFFLINE_CEREMONY'])need('scripts/p33-long-term-assurance.mjs',assurance,marker);

const integration=read('tests/p33-offline-ceremony-postgres.mjs');
for(const marker of ['ephemeral CI-only key','openssl','-aes-256-gcm','p33-offline-ceremony.sh','arcade_p33_recovery_test','sourcePayloadSha256','restoredPayloadSha256','P33 OFFLINE-KEY ATTESTATION — VERIFIED'])need('tests/p33-offline-ceremony-postgres.mjs',integration,marker);

const docs=read('docs/P33_OFFLINE_KEY_RECOVERY.md').toLowerCase();
for(const marker of ['private key remains outside','pending_offline_ceremony','60–75 days','ephemeral ci-only rsa key','real production-key certification is not complete','does not add a github secret'])need('docs/P33_OFFLINE_KEY_RECOVERY.md',docs,marker);

const cert=read('ops/p31-backup-recovery-cert.pem');
need('ops/p31-backup-recovery-cert.pem',cert,'BEGIN CERTIFICATE');
forbid('ops/p31-backup-recovery-cert.pem',cert,'PRIVATE KEY');

for(const path of ['scripts/p33-recovery-core.mjs','scripts/p33-build-attestation.mjs','scripts/p33-verify-attestation.mjs','scripts/p33-verify-retained-artifact.mjs','scripts/p33-persist-evidence.mjs','scripts/p33-long-term-assurance.mjs']){
  const t=read(path);
  for(const marker of ['supabase.from(','INSERT INTO public.micro_arcade','DELETE FROM public.micro_arcade','TRUNCATE public.micro_arcade'])forbid(path,t,marker);
}

const ci=read('.github/workflows/ci.yml');
need('.github/workflows/ci.yml',ci,'bun run quality:gameplay-p33');
need('.github/workflows/ci.yml',ci,'bun run quality:backend-p33');

if(errors.length){
  console.error('P33 OFFLINE-KEY / LONG-TERM DR CONTRACT — FAIL');
  for(const e of errors)console.error('- '+e);
  process.exit(1);
}
console.log('P33 OFFLINE-KEY / LONG-TERM DR CONTRACT — PASS');
console.log('Offline private-key isolation, real ciphertext binding, signed evidence, 90-day ceremony freshness and recurring P31/P32/P33 assurance are permanent.');
