/** P32 cold restore integration. Uses only local disposable Postgres databases. */
import { SQL } from 'bun';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const sourceUrl=process.env.LB_TEST_DATABASE_URL||'';
const parsed=new URL(sourceUrl);
if(!['127.0.0.1','localhost'].includes(parsed.hostname)||!parsed.pathname.endsWith('_test')||process.env.LB_TEST_RESET!=='1'){
  throw new Error('P32 integration requires explicit local *_test database and LB_TEST_RESET=1');
}
const sourceDb=new SQL(sourceUrl,{max:2,idleTimeout:5});
const adminUrl=new URL(sourceUrl);adminUrl.pathname='/postgres';
const coldUrl=new URL(sourceUrl);coldUrl.pathname='/arcade_p32_test';
const adminDb=new SQL(adminUrl.toString(),{max:1,idleTimeout:5});
const coldDb=new SQL(coldUrl.toString(),{max:2,idleTimeout:5});
const sourcePath='/tmp/arcade-p32-source.json';
const reportDir='/tmp/arcade-p32-report';

try{
  const exportedText=(await sourceDb`SELECT public.micro_arcade_p31_offsite_export()::text AS result`)[0].result;
  const exported=JSON.parse(exportedText);
  assert.equal(exported.format,'arcade-p31-offsite-v1');
  assert.equal(exported.snapshot.verified,true);
  assert.equal(exported.restore_drill.ok,true);
  await writeFile(sourcePath,exportedText);

  await adminDb.unsafe('DROP DATABASE IF EXISTS arcade_p32_test WITH (FORCE)').simple();
  await adminDb.unsafe('CREATE DATABASE arcade_p32_test').simple();
  await mkdir(reportDir,{recursive:true});

  const proc=Bun.spawn(['bun','scripts/p32-cold-restore.mjs'],{
    env:{...process.env,P32_DATABASE_URL:coldUrl.toString(),P32_SOURCE:sourcePath,P32_REPORT_DIR:reportDir},
    stdout:'pipe',stderr:'pipe',
  });
  const [stdout,stderr,exitCode]=await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if(exitCode!==0)throw new Error('P32 cold restore failed: '+stderr.slice(0,1000));
  assert.match(stdout,/P32 COLD DATA RESTORE — PASS/);

  const report=JSON.parse(await readFile(reportDir+'/restore.json','utf8'));
  assert.equal(report.coldTarget,true);
  assert.equal(report.productionMutated,false);
  assert.equal(report.sourcePayloadSha256,exported.snapshot.payload_sha256);
  assert.equal(report.restoredPayloadSha256,exported.snapshot.payload_sha256);
  assert.equal(report.sourceSchemaSha256,exported.snapshot.schema_sha256);
  assert.equal(report.restoredSchemaSha256,exported.snapshot.schema_sha256);
  assert.deepEqual(report.rowCounts,exported.snapshot.row_counts);
  assert.equal(report.relationshipsOk,true);
  assert.equal(report.transientRateLimits,0);

  const overall=(await coldDb`SELECT public.micro_arcade_lb_board('overall','', 'all',NULL,20,0,NULL) AS result`)[0].result;
  const weekly=(await coldDb`SELECT public.micro_arcade_lb_board('weekly','', 'all',NULL,20,0,NULL) AS result`)[0].result;
  assert.equal(overall.ok,true);
  assert.equal(weekly.ok,true);
  assert.equal(overall.policyId,exported.snapshot.payload.micro_arcade_lb_policy[0].payload.policyId);
  assert.equal(weekly.policyId,overall.policyId);

  console.log(JSON.stringify({
    status:'PASS',phase:'P32',coldTarget:'postgres17',sourceRows:Object.values(report.rowCounts).reduce((a,b)=>a+Number(b),0),
    checks:['fresh database','all migrations','exact schema hash','exact payload hash','exact row counts','transient exclusion','overall board','weekly board'],
  },null,2));
}finally{
  await sourceDb.close().catch(()=>{});
  await coldDb.close().catch(()=>{});
  await adminDb.unsafe('DROP DATABASE IF EXISTS arcade_p32_test WITH (FORCE)').simple().catch(()=>{});
  await adminDb.close().catch(()=>{});
  await rm(sourcePath,{force:true}).catch(()=>{});
  await rm(reportDir,{recursive:true,force:true}).catch(()=>{});
}
