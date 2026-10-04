/** P33 offline-key ceremony integration. Uses an ephemeral CI-only key and local PostgreSQL. */
import { SQL } from 'bun';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const sourceUrl=process.env.LB_TEST_DATABASE_URL||'';
const parsed=new URL(sourceUrl);
if(!['127.0.0.1','localhost'].includes(parsed.hostname)||!parsed.pathname.endsWith('_test')||process.env.LB_TEST_RESET!=='1'){
  throw new Error('P33 integration requires explicit local *_test database and LB_TEST_RESET=1');
}
const sourceDb=new SQL(sourceUrl,{max:2,idleTimeout:5});
const adminUrl=new URL(sourceUrl);adminUrl.pathname='/postgres';
const coldUrl=new URL(sourceUrl);coldUrl.pathname='/arcade_p33_recovery_test';
const adminDb=new SQL(adminUrl.toString(),{max:1,idleTimeout:5});
const base='/tmp/arcade-p33';
const plain=base+'/source.json';
const cms=base+'/source.cms';
const manifestPath=base+'/manifest.json';
const key=base+'/key.pem';
const cert=base+'/cert.pem';
const evidence=base+'/evidence';

try{
  await rm(base,{recursive:true,force:true});
  await mkdir(base,{recursive:true});
  const exportedText=(await sourceDb`SELECT public.micro_arcade_p31_offsite_export()::text AS result`)[0].result;
  const exported=JSON.parse(exportedText);
  await writeFile(plain,exportedText);

  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-subj','/CN=P33 Offline Ceremony CI','-days','3650'],{stdio:'ignore'});
  execFileSync('openssl',['cms','-encrypt','-binary','-aes-256-gcm','-in',plain,'-outform','DER','-out',cms,cert],{stdio:'ignore'});
  const ciphertextSha256=createHash('sha256').update(await readFile(cms)).digest('hex');
  const totalRows=Object.values(exported.snapshot.row_counts).reduce((a,b)=>a+Number(b),0);
  const manifest={
    format:'arcade-p31-offsite-evidence-v1',
    created_at:new Date().toISOString(),
    run_id:'123456789',
    run_attempt:'1',
    commit:'f'.repeat(40),
    backup_file:'source.cms',
    plaintext_sha256:createHash('sha256').update(Buffer.from(exportedText)).digest('hex'),
    ciphertext_sha256:ciphertextSha256,
    certificate_sha256_fingerprint:'CI-ONLY',
    snapshot_id:exported.snapshot.id,
    captured_at:exported.snapshot.captured_at,
    schema_sha256:exported.snapshot.schema_sha256,
    payload_sha256:exported.snapshot.payload_sha256,
    payload_bytes:exported.snapshot.payload_bytes,
    transport_bytes:Buffer.byteLength(exportedText),
    total_rows:totalRows,
    row_counts:exported.snapshot.row_counts,
    excluded_transient:exported.excluded_transient,
    verification_ok:true,
  };
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');

  await adminDb.unsafe('DROP DATABASE IF EXISTS arcade_p33_recovery_test WITH (FORCE)').simple();
  await adminDb.unsafe('CREATE DATABASE arcade_p33_recovery_test').simple();

  const proc=Bun.spawn([
    'bash','scripts/p33-offline-ceremony.sh',cms,manifestPath,key,coldUrl.toString(),evidence
  ],{
    env:{...process.env,P33_RECOVERY_CERT:cert},
    stdout:'pipe',stderr:'pipe',
  });
  const [stdout,stderr,exitCode]=await Promise.all([
    new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited
  ]);
  if(exitCode!==0)throw new Error('P33 offline ceremony failed: '+stderr.slice(0,2000)+'\n'+stdout.slice(0,1000));
  assert.match(stdout,/P33 OFFLINE-KEY RECOVERY CEREMONY — PASS/);

  const attestation=JSON.parse(await readFile(evidence+'/attestation.json','utf8'));
  assert.equal(attestation.phase,'P33');
  assert.equal(attestation.sourceRunId,123456789);
  assert.equal(attestation.sourcePayloadSha256,exported.snapshot.payload_sha256);
  assert.equal(attestation.restoredPayloadSha256,exported.snapshot.payload_sha256);
  assert.equal(attestation.sourceSchemaSha256,exported.snapshot.schema_sha256);
  assert.equal(attestation.restoredSchemaSha256,exported.snapshot.schema_sha256);
  assert.equal(attestation.sourceTotalRows,totalRows);
  assert.equal(attestation.restoredTotalRows,totalRows);
  assert.equal(attestation.offlinePrivateKeyUsed,true);
  assert.equal(attestation.productionMutated,false);
  assert.equal(attestation.transientRateLimits,0);

  const verify=Bun.spawn(['bun','scripts/p33-verify-attestation.mjs',evidence+'/attestation.json',evidence+'/attestation.sig.b64',cert],{
    env:{...process.env,P33_RECOVERY_CERT:cert},stdout:'pipe',stderr:'pipe'
  });
  const [verifyOut,verifyErr,verifyCode]=await Promise.all([new Response(verify.stdout).text(),new Response(verify.stderr).text(),verify.exited]);
  if(verifyCode!==0)throw new Error('P33 signature verifier failed: '+verifyErr);
  assert.match(verifyOut,/P33 OFFLINE-KEY ATTESTATION — VERIFIED/);

  const sourceDir=base+'/retained';
  await mkdir(sourceDir,{recursive:true});
  await writeFile(sourceDir+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
  await writeFile(sourceDir+'/source.cms',await readFile(cms));
  const retained=Bun.spawn(['bun','scripts/p33-verify-retained-artifact.mjs'],{
    env:{...process.env,P33_ATTESTATION:evidence+'/attestation.json',P33_SOURCE_DIR:sourceDir,P33_REPORT_DIR:base+'/retained-report',GITHUB_TOKEN:''},
    stdout:'pipe',stderr:'pipe'
  });
  const [retOut,retErr,retCode]=await Promise.all([new Response(retained.stdout).text(),new Response(retained.stderr).text(),retained.exited]);
  if(retCode!==0)throw new Error('P33 retained-artifact verifier failed: '+retErr);
  assert.match(retOut,/P33 RETAINED ENCRYPTED ARTIFACT — VERIFIED/);

  const command=await readFile(evidence+'/submit-command.txt','utf8');
  assert.match(command,/p33-offline-attestation\.yml/);
  const evidenceFiles=['attestation.json','attestation.sig.b64','submit-command.txt'];
  for(const file of evidenceFiles)assert.ok((await readFile(evidence+'/'+file)).length>0);

  console.log(JSON.stringify({
    status:'PASS',phase:'P33',key:'ephemeral-ci-only',rows:totalRows,
    checks:['CMS decrypt','private-key/certificate match','P31 plaintext verification','fresh PostgreSQL restore','exact schema hash','exact payload hash','offline RSA signature','retained ciphertext binding','no production mutation'],
  },null,2));
}finally{
  await sourceDb.close().catch(()=>{});
  await adminDb.unsafe('DROP DATABASE IF EXISTS arcade_p33_recovery_test WITH (FORCE)').simple().catch(()=>{});
  await adminDb.close().catch(()=>{});
  await rm(base,{recursive:true,force:true}).catch(()=>{});
}
