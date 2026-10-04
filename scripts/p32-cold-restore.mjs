import { SQL } from 'bun';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { P32_PROTECTED_TABLES, P32_TRANSIENT_EXCLUSIONS } from './p32-recovery-core.mjs';

const dbUrl=process.env.P32_DATABASE_URL || '';
const sourcePath=process.env.P32_SOURCE || 'p32-source.json';
const outputDir=process.env.P32_REPORT_DIR || 'p32-report';
const parsed=new URL(dbUrl);
if(!['127.0.0.1','localhost'].includes(parsed.hostname) || !/p32|recovery/i.test(parsed.pathname)) {
  throw new Error('P32 cold restore refuses any non-local/non-recovery database target');
}
const sourceText=await readFile(sourcePath,'utf8');
const source=JSON.parse(sourceText);
if(source?.format!=='arcade-p31-offsite-v1'||source?.snapshot?.verified!==true||source?.restore_drill?.ok!==true) {
  throw new Error('P32 source must be a verified P31 export with a successful restore drill');
}
if(JSON.stringify(source.excluded_transient)!==JSON.stringify(P32_TRANSIENT_EXCLUSIONS)) {
  throw new Error('P32 source transient-exclusion contract mismatch');
}

const db=new SQL(dbUrl,{max:4,idleTimeout:5});
const startedAt=new Date().toISOString();
const counts={};
try {
  await db.unsafe("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;").simple();

  const migrationDir='supabase/migrations';
  const migrations=(await readdir(migrationDir)).filter(x=>x.endsWith('.sql')).sort();
  for(const file of migrations){
    await db.unsafe(await readFile(migrationDir+'/'+file,'utf8')).simple();
  }

  const localSchema=(await db`SELECT private.micro_arcade_p31_schema_sha256() AS hash`)[0].hash;
  if(localSchema!==source.snapshot.schema_sha256) {
    throw new Error('cold target schema fingerprint differs from backup source');
  }

  await db.unsafe(`TRUNCATE
    public.micro_arcade_lb_reviews,
    public.micro_arcade_lb_runs,
    public.micro_arcade_lb_sessions,
    public.micro_arcade_best_scores,
    public.micro_arcade_score_submissions,
    public.micro_arcade_play_sessions,
    public.micro_arcade_rate_limits,
    public.micro_arcade_players,
    public.micro_arcade_scoring_profiles,
    public.micro_arcade_lb_policy
    RESTART IDENTITY CASCADE`).simple();

  const payload=source.snapshot.payload;
  const exactKeys=Object.keys(payload).sort();
  if(JSON.stringify(exactKeys)!==JSON.stringify([...P32_PROTECTED_TABLES].sort())) throw new Error('unexpected protected-table set in source');
  for(const table of P32_PROTECTED_TABLES){
    if(!Array.isArray(payload[table]))throw new Error('protected payload '+table+' must be a JSON array');
  }

  const sourceJson=sourceText;
  await db`INSERT INTO public.micro_arcade_players SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_players,(${sourceJson}::text::jsonb #> '{snapshot,payload,micro_arcade_players}'))`;
  await db`INSERT INTO public.micro_arcade_play_sessions SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_play_sessions,(${sourceJson}::text::jsonb #> '{snapshot,payload,micro_arcade_play_sessions}'))`;
  await db`INSERT INTO public.micro_arcade_score_submissions SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_score_submissions,(${sourceJson}::text::jsonb #> '{snapshot,payload,micro_arcade_score_submissions}'))`;
  await db`INSERT INTO public.micro_arcade_best_scores SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_best_scores,(${sourceJson}::text::jsonb #> '{snapshot,payload,micro_arcade_best_scores}'))`;
  await db`INSERT INTO public.micro_arcade_scoring_profiles SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_scoring_profiles,(${sourceJson}::text::jsonb #> '{snapshot,payload,micro_arcade_scoring_profiles}'))`;
  await db`INSERT INTO public.micro_arcade_lb_policy SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_lb_policy,(${sourceJson}::text::jsonb #> '{snapshot,payload,micro_arcade_lb_policy}'))`;
  await db`INSERT INTO public.micro_arcade_lb_sessions SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_lb_sessions,(${sourceJson}::text::jsonb #> '{snapshot,payload,micro_arcade_lb_sessions}'))`;
  await db`INSERT INTO public.micro_arcade_lb_runs SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_lb_runs,(${sourceJson}::text::jsonb #> '{snapshot,payload,micro_arcade_lb_runs}'))`;
  await db`INSERT INTO public.micro_arcade_lb_reviews OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_recordset(NULL::public.micro_arcade_lb_reviews,(${sourceJson}::text::jsonb #> '{snapshot,payload,micro_arcade_lb_reviews}'))`;

  await db.unsafe(`SELECT setval(
    pg_get_serial_sequence('public.micro_arcade_lb_reviews','id'),
    greatest(1,coalesce((SELECT max(id) FROM public.micro_arcade_lb_reviews),1)),
    EXISTS(SELECT 1 FROM public.micro_arcade_lb_reviews)
  )`).simple();

  for(const table of P32_PROTECTED_TABLES){
    const row=(await db.unsafe('SELECT count(*)::bigint AS n FROM public.'+table))[0];
    counts[table]=Number(row.n);
    if(counts[table]!==Number(source.snapshot.row_counts[table])) throw new Error('row-count mismatch for '+table);
  }
  const transientRateLimits=Number((await db`SELECT count(*)::bigint AS n FROM public.micro_arcade_rate_limits`)[0].n);
  if(transientRateLimits!==0) throw new Error('rate-limit state must start empty on cold target');

  const coldCapture=(await db`SELECT public.micro_arcade_p31_capture_snapshot('restore_drill') AS result`)[0].result;
  if(!coldCapture?.ok)throw new Error('cold target post-restore snapshot failed');
  const coldSnap=(await db`SELECT payload_sha256,schema_sha256,row_counts,verification FROM private.micro_arcade_recovery_snapshots WHERE id=${coldCapture.snapshotId}::uuid`)[0];
  if(coldSnap.payload_sha256!==source.snapshot.payload_sha256)throw new Error('restored payload fingerprint differs from source');
  if(coldSnap.schema_sha256!==source.snapshot.schema_sha256)throw new Error('restored schema fingerprint differs from source');

  const relationshipChecks=Boolean(coldSnap.verification?.relationshipsOk && coldSnap.verification?.sessionScopeOk && coldSnap.verification?.countsOk);
  if(!relationshipChecks)throw new Error('cold target relationship verification failed');

  const report={
    schemaVersion:1,
    phase:'P32',
    coldTarget:true,
    productionMutated:false,
    startedAt,
    completedAt:new Date().toISOString(),
    migrationsApplied:migrations,
    sourceSnapshotId:source.snapshot.id,
    sourceCapturedAt:source.snapshot.captured_at,
    sourceSchemaSha256:source.snapshot.schema_sha256,
    restoredSchemaSha256:coldSnap.schema_sha256,
    sourcePayloadSha256:source.snapshot.payload_sha256,
    restoredPayloadSha256:coldSnap.payload_sha256,
    rowCounts:counts,
    countsMatch:true,
    relationshipsOk:relationshipChecks,
    transientRateLimits,
    excludedTransient:P32_TRANSIENT_EXCLUSIONS,
  };
  await mkdir(outputDir,{recursive:true});
  await writeFile(outputDir+'/restore.json',JSON.stringify(report,null,2)+'\n');
  console.log('P32 COLD DATA RESTORE — PASS');
  console.log('Restored '+Object.values(counts).reduce((a,b)=>a+b,0)+' protected rows; source payload SHA-256 '+report.sourcePayloadSha256+'.');
} finally {
  await db.close();
}
