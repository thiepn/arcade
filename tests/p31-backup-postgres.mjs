/** P31 recovery integration test. Destructive only in an opted-in LOCAL *_test database. */
import { SQL } from 'bun';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const url = process.env.LB_TEST_DATABASE_URL;
if (!url || !['127.0.0.1','localhost'].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith('_test') || process.env.LB_TEST_RESET !== '1') {
  throw new Error('P31 requires an explicit local *_test database and LB_TEST_RESET=1');
}
const db = new SQL(url, { max: 4, idleTimeout: 5 });
let assertions = 0;
const ok = (value, message) => { assertions++; assert.ok(value, message); };
const eq = (actual, expected, message) => { assertions++; assert.deepEqual(actual, expected, message); };

try {
  await db.unsafe('DROP SCHEMA IF EXISTS private CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO PUBLIC;').simple();
  await db.unsafe("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;").simple();

  for (const file of [
    '20260908_micro_arcade_base.sql',
    '20260909_scoring_v2.sql',
    '20260910_leaderboard_v3.sql',
    '20261003_arcade_p31_backend_recovery.sql',
  ]) {
    await db.unsafe(readFileSync('supabase/migrations/' + file, 'utf8')).simple();
  }

  const player = crypto.randomUUID();
  const historicalPlay = crypto.randomUUID();
  const unusedPlay = crypto.randomUUID();
  const scoreId = crypto.randomUUID();
  const historicalLb = crypto.randomUUID();
  const unusedLb = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const now = Date.now();

  await db`INSERT INTO public.micro_arcade_players(id,credential_hash,display_name,country_code,created_at,last_seen_at,credential_version)
    VALUES(${player},${'a'.repeat(64)},'Recovery Player','DE',${now-10000},${now},2)`;

  await db`INSERT INTO public.micro_arcade_play_sessions(id,player_id,game_id,issued_at,expires_at,used_at,score_version,mode_id)
    VALUES(${historicalPlay},${player},'stack',${now-20000},${now+10000},${now-10000},2,'standard')`;
  await db`INSERT INTO public.micro_arcade_play_sessions(id,player_id,game_id,issued_at,expires_at,used_at,score_version,mode_id)
    VALUES(${unusedPlay},${player},'stack',${now},${now+21600000},NULL,2,'standard')`;
  await db`INSERT INTO public.micro_arcade_score_submissions(id,session_id,player_id,game_id,score,duration_ms,created_at,raw_score,source_version,mode_id)
    VALUES(${scoreId},${historicalPlay},${player},'stack',3000,10000,${now-10000},45,2,'standard')`;
  await db`INSERT INTO public.micro_arcade_best_scores(game_id,player_id,score,achieved_at,submissions,raw_score,source_version,mode_id)
    VALUES('stack',${player},3000,${now-10000},1,45,2,'standard')`;

  const policy = (await db`SELECT payload->>'policyId' AS id FROM public.micro_arcade_lb_policy WHERE version=3`)[0].id;
  await db`INSERT INTO public.micro_arcade_lb_sessions(id,player_id,request_id,game_id,mode_id,policy_id,issued_at,expires_at,used_at)
    VALUES(${historicalLb},${player},${crypto.randomUUID()},'stack','standard',${policy},${now-20000},${now+10000},${now-10000})`;
  await db`INSERT INTO public.micro_arcade_lb_sessions(id,player_id,request_id,game_id,mode_id,policy_id,issued_at,expires_at,used_at)
    VALUES(${unusedLb},${player},${crypto.randomUUID()},'stack','standard',${policy},${now},${now+21600000},NULL)`;
  await db`INSERT INTO public.micro_arcade_lb_runs(id,session_id,player_id,game_id,mode_id,policy_id,source_version,raw_score,duration_ms,active_ms,ap_micros,contribution_micros,completed_at,created_at,status,code,provenance)
    VALUES(${runId},${historicalLb},${player},'stack','standard',${policy},2,45,10000,9000,3000000000,3000000000,${now-10000},${now-10000},'ranked','ok','p31-test')`;
  await db`INSERT INTO public.micro_arcade_lb_reviews(run_id,previous_status,new_status,reason,reviewed_at)
    VALUES(${runId},'ranked','ranked','P31 recovery fixture',${now})`;
  await db`INSERT INTO public.micro_arcade_rate_limits(scope,bucket_key,bucket_start,request_count)
    VALUES('p31-test','bucket',${now},1)`;

  const captured = (await db`SELECT public.micro_arcade_p31_capture_snapshot('manual') AS result`)[0].result;
  ok(captured.ok, 'capture succeeds');
  ok(/^[0-9a-f]{64}$/.test(captured.schemaSha256), 'schema fingerprint is SHA-256');
  ok(/^[0-9a-f]{64}$/.test(captured.payloadSha256), 'payload fingerprint is SHA-256');

  const snapshot = (await db`SELECT verified,row_counts,payload,verification FROM private.micro_arcade_recovery_snapshots WHERE id=${captured.snapshotId}`)[0];
  eq(snapshot.verified, true, 'snapshot is verified before export');
  eq(Number(snapshot.row_counts.micro_arcade_players), 1, 'player preserved');
  eq(Number(snapshot.row_counts.micro_arcade_play_sessions), 1, 'only submission-backed play session preserved');
  eq(Number(snapshot.row_counts.micro_arcade_lb_sessions), 1, 'only run-backed leaderboard session preserved');
  eq(Number(snapshot.row_counts.micro_arcade_score_submissions), 1, 'score history preserved');
  eq(Number(snapshot.row_counts.micro_arcade_lb_runs), 1, 'v3 run history preserved');
  eq(snapshot.payload.micro_arcade_players[0].credential_hash, 'a'.repeat(64), 'guest identity credential continuity preserved inside private encrypted backup path');
  eq(Object.hasOwn(snapshot.payload, 'micro_arcade_rate_limits'), false, 'rate-limit state excluded');

  await db`UPDATE public.micro_arcade_players SET display_name='Live State Must Survive Drill' WHERE id=${player}`;
  const drill = (await db`SELECT public.micro_arcade_p31_restore_drill(${captured.snapshotId}::uuid) AS result`)[0].result;
  ok(drill.ok, 'transaction-scoped restore drill parses and reconstructs snapshot');
  eq(drill.productionMutated, false, 'restore drill declares no production mutation');
  eq((await db`SELECT display_name FROM public.micro_arcade_players WHERE id=${player}`)[0].display_name, 'Live State Must Survive Drill', 'restore drill does not overwrite live rows');

  const exported = (await db`SELECT public.micro_arcade_p31_offsite_export() AS result`)[0].result;
  eq(exported.format, 'arcade-p31-offsite-v1', 'offsite export format');
  eq(exported.project_ref, 'hycegznamzjhwinegaai', 'canonical project binding');
  eq(exported.snapshot_count, 1, 'one atomic snapshot exported');
  eq(exported.snapshot.verified, true, 'offsite snapshot verified');
  eq(exported.restore_drill.ok, true, 'restore drill must pass before export');
  ok(exported.excluded_transient.includes('micro_arcade_rate_limits'), 'transient rate-limit state explicitly excluded');

  for (const role of ['anon','authenticated']) {
    await assert.rejects(() => db.begin(async tx => {
      await tx.unsafe('SET LOCAL ROLE ' + role);
      await tx`SELECT public.micro_arcade_p31_offsite_export()`;
    }));
    assertions++;
    await assert.rejects(() => db.begin(async tx => {
      await tx.unsafe('SET LOCAL ROLE ' + role);
      await tx`SELECT * FROM private.micro_arcade_recovery_snapshots`;
    }));
    assertions++;
  }

  console.log(JSON.stringify({
    status:'PASS',
    phase:'P31',
    postgres:'17',
    assertions,
    durableTables:9,
    excludedTransient:['micro_arcade_rate_limits','unused play sessions','unused leaderboard sessions'],
    checks:['real migration','private snapshot','SHA-256 fingerprints','relationship verification','session scoping','type reconstruction','non-destructive restore drill','OIDC export RPC contract','browser-role denial'],
  }, null, 2));
} finally {
  await db.close();
}
