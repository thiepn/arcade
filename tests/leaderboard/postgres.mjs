/** Destructive only in an explicitly opted-in LOCAL *_test database. Never run against Supabase. */
import {SQL} from 'bun';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLeaderboardHandler} from '../../server/leaderboard/http.ts';
import {POLICY,POLICY_ID,apMicros,contributionMicros,screenRun,AP_SCALE,weekBounds} from '../../shared/leaderboard/domain.ts';
const url=process.env.LB_TEST_DATABASE_URL;
if(!url||!['127.0.0.1','localhost'].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith('_test')||process.env.LB_TEST_RESET!=='1')throw Error('Explicit local *_test database and LB_TEST_RESET=1 required.');
const db=new SQL(url,{max:12,idleTimeout:5});let assertions=0;
const eq=(a,b,m)=>{assertions++;assert.deepEqual(a,b,m)};const ok=(v,m)=>{assertions++;assert.ok(v,m)};
try{
 await db.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO PUBLIC;').simple();
 await db.unsafe("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;").simple();
 for(const file of ['20260908_micro_arcade_base.sql','20260909_scoring_v2.sql'])await db.unsafe(readFileSync('supabase/migrations/'+file,'utf8')).simple();
 const oldPlayer=crypto.randomUUID(),oldSession=crypto.randomUUID(),v2Session=crypto.randomUUID(),oldAt=Date.now()-600000;
 const secret='b'.repeat(43);const hash=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
 await db`INSERT INTO micro_arcade_players VALUES(${oldPlayer},${await hash('test-pepper:'+secret)},'Archived Player','XX',${oldAt},${oldAt})`;
 for(const [sid,source,mode,raw] of [[oldSession,1,'legacy',18],[v2Session,2,'standard',45]]){
  await db`INSERT INTO micro_arcade_play_sessions VALUES(${sid},${oldPlayer},'stack',${oldAt-10000},${oldAt+21600000},${oldAt},${source},${mode})`;
  await db`INSERT INTO micro_arcade_score_submissions VALUES(${crypto.randomUUID()},${sid},${oldPlayer},'stack',${source===1?1363:3000},10000,${oldAt},${raw},${source},${mode})`;
 }
 const original=await db`SELECT md5(string_agg(row_to_json(x)::text,',' ORDER BY id)) digest FROM micro_arcade_score_submissions x`;
 const migration=readFileSync('supabase/migrations/20260910_leaderboard_v3.sql','utf8');await db.unsafe(migration).simple();
 eq(Number((await db`SELECT count(*) n FROM micro_arcade_lb_runs`)[0].n),1,'only compatible v2 evidence backfilled');
 await db.unsafe(migration).simple();eq(Number((await db`SELECT count(*) n FROM micro_arcade_lb_runs`)[0].n),1,'additive migration idempotent');
 eq((await db`SELECT md5(string_agg(row_to_json(x)::text,',' ORDER BY id)) digest FROM micro_arcade_score_submissions x`)[0].digest,original[0].digest,'native historical evidence unchanged');
 const store={async rpc(name,args){if(!/^micro_arcade_(lb_[a-z_]+|rate_limit)$/.test(name))throw Error('invalid rpc');return db.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE service_role');const fields=Object.keys(args);const rows=await tx.unsafe(`SELECT public.${name}(${fields.map((k,i)=>k+' => $'+(i+1)+(['p_raw','p_duration','p_active','p_asof','p_now'].includes(k)?'::bigint':['p_limit','p_offset','p_source'].includes(k)?'::integer':'')).join(',')}) AS result`,Object.values(args));return rows[0].result;});}};
 let reqId=0;const handler=createLeaderboardHandler({store,legacyPepper:'test-pepper',allowedOrigins:['http://127.0.0.1:4174']});
 async function request(path,body,credential,method=body===undefined?'GET':'POST'){
  const headers={'x-forwarded-for':`127.1.${Math.floor(reqId/250)}.${++reqId%250}`};if(body!==undefined)headers['content-type']='application/json';if(credential)headers.authorization='Bearer '+credential;
  const response=await handler(new Request('http://api.test'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}));return {status:response.status,body:await response.json(),headers:response.headers};
 }
 const guest=await request('/v3/guest',{});eq(guest.status,201);const token=guest.body.credential,player=guest.body.player.id;
 eq((await request('/v1/sessions',{gameId:'stack'},token)).status,426,'new legacy sessions disabled');
 eq((await request('/v3/me',undefined,'invalid')).status,401,'bad identity never silently downgraded');
 eq((await request('/v3/me',undefined,oldPlayer+'.'+secret)).body.player.id,oldPlayer,'legacy guest identity preserved');
 eq((await db`SELECT credential_version FROM micro_arcade_players WHERE id=${oldPlayer}`)[0].credential_version,2,'credential upgraded without service-key coupling');
 eq((await request('/v3/me',{name:'김민수'},token,'PATCH')).status,200,'Unicode rename');
 eq((await request('/v3/me',{name:'<script>'},token,'PATCH')).status,400,'invalid rename');
 const all=await request('/v3/leaderboards/overall');eq(all.status,200,'public board works without creating a guest');
 async function start(game='stack',mode='standard',owner=token,requestId=crypto.randomUUID()){
  return request('/v3/sessions',{requestId,gameId:game,modeId:mode,protocolVersion:3,scoreVersion:2,policyId:POLICY_ID},owner);
 }
 async function rewind(session,milliseconds){await db`UPDATE micro_arcade_lb_sessions SET issued_at=issued_at-${milliseconds},expires_at=expires_at-${milliseconds} WHERE id=${session}`;}
 function payload(s,raw=45,duration=10000,active=9000){return {sessionId:s.id,modeId:s.modeId,rawScore:raw,durationMs:duration,activeMs:active,scoreVersion:2,protocolVersion:3,policyId:POLICY_ID};}
 const stable=crypto.randomUUID(),s1=(await start('stack','standard',token,stable)).body.session,s2=(await start('stack','standard',token,stable)).body.session;eq(s1.id,s2.id,'start idempotency');
 eq((await start('reaction','standard',token,stable)).status,422,'same start ID cannot change game');await rewind(s1.id,10000);
 const first=await request('/v3/scores',payload(s1),token);eq(first.body.status,'ranked');eq(first.body.rawScore,45);eq(first.body.apMicros,3000*AP_SCALE);eq(first.body.contributionMicros,3000*AP_SCALE);
 const duplicate=await request('/v3/scores',payload(s1),token);eq(duplicate.body,first.body,'retry returns original receipt');
 eq((await request('/v3/scores',payload(s1,46),token)).status,409,'conflicting payload rejected');
 eq((await request('/v3/scores',{...payload(s1),apMicros:9000000000},token)).status,422,'client supplied AP rejected');
 eq((await request('/v3/scores',payload(s1),oldPlayer+'.'+secret)).status,404,'token bound to original player');
 const cs=(await start()).body.session;await rewind(cs.id,10000);
 const [c1,c2]=await Promise.all([request('/v3/scores',payload(cs),token),request('/v3/scores',payload(cs),token)]);eq(c1.body,c2.body,'concurrent identical submissions converge');eq(Number((await db`SELECT count(*) n FROM micro_arcade_lb_runs WHERE session_id=${cs.id}`)[0].n),1,'exactly one row under concurrency');
 const ms=(await start('rhythm','hypernova')).body.session;await rewind(ms.id,10000);eq((await request('/v3/scores',{...payload(ms),modeId:'neon_midnight'},token)).status,422,'mode bound');
 const bad=(await start('reaction')).body.session;await rewind(bad.id,10000);eq((await request('/v3/scores',payload(bad,31707),token)).body.status,'rejected','finite impossible maximum rejected');
 const suspicious=(await start()).body.session;await rewind(suspicious.id,1000);eq((await request('/v3/scores',payload(suspicious,1000000,1000,1000),token)).body.status,'review','implausible endless quarantined');
 eq((await request('/v3/leaderboards/stack',undefined,token)).body.userEntry.raw_score,45,'quarantine not on leaderboard');
 // Every policy: real SQL/JS parity at all anchors, boundaries and long-run ranges.
 let vectors=0,maxError=0;
 for(const p of Object.values(POLICY.policies)){
  for(const raw of [0,1,...p.anchors.flatMap(n=>[n-1,n,n+1]),p.anchors[2]*2,p.anchors[2]*4,1000000,Number.MAX_SAFE_INTEGER]){
   const v=await store.rpc('micro_arcade_lb_values',{p_game:p.gameId,p_mode:p.modeId,p_raw:raw});const js=apMicros(p.gameId,raw,p.modeId);maxError=Math.max(maxError,Math.abs(js-v.apMicros));ok(Math.abs(js-v.apMicros)<=1,`SQL/JS micro-AP ${p.gameId}/${p.modeId}/${raw}`);ok(Math.abs(v.contributionMicros-contributionMicros(p.gameId,v.apMicros,p.modeId))<=1,'contribution parity');vectors++;
  }
  const s=(await start(p.gameId,p.modeId)).body.session;ok(s?.id,'mode session exists');await rewind(s.id,60000);
  const r=await request('/v3/scores',payload(s,p.anchors[0],60000,60000),token);eq(r.body.status,screenRun(p.gameId,p.modeId,p.anchors[0],60000).status,'SQL screening matches JS');
 }
 // Bounded ties use ONLY contribution, not uncapped AP; paging has stable snapshot and ranks.
 for(let i=0;i<25;i++){
  const id=crypto.randomUUID();await store.rpc('micro_arcade_lb_guest',{p_id:id,p_hash:'c'.repeat(64),p_country:'XX'});
  const s=await store.rpc('micro_arcade_lb_start',{p_player:id,p_request:crypto.randomUUID(),p_game:'stack',p_mode:'standard',p_policy:POLICY_ID});await rewind(s.session.id,60000);
  await store.rpc('micro_arcade_lb_finish',{p_player:id,p_session:s.session.id,p_raw:i%2?480:600,p_duration:60000,p_active:60000,p_mode:'standard',p_policy:POLICY_ID,p_source:2});
 }
 let page=await store.rpc('micro_arcade_lb_board',{p_scope:'overall',p_game:'',p_mode:'all',p_player:player,p_limit:10,p_offset:0,p_asof:null});const snapshot=page.asOf;const rows=[...page.entries];
 while(page.nextOffset!==null){page=await store.rpc('micro_arcade_lb_board',{p_scope:'overall',p_game:'',p_mode:'all',p_player:player,p_limit:10,p_offset:page.nextOffset,p_asof:snapshot});rows.push(...page.entries)}
 eq(new Set(rows.map(r=>r.id)).size,27,'paging includes every ranked player exactly once');const tied=rows.filter(r=>Number(r.rating_score)===10000);eq(new Set(tied.map(r=>r.rank)).size,1,'uncapped AP cannot break bounded rating ties');eq(tied.length,25,'all cap ties counted');
 const own=(await request('/v3/leaderboards/overall',undefined,token)).body;eq(own.userEntry.games_played,32,'36 modes contribute once per game, not once per mode');eq(own.contributions.length,32,'explainable contribution breakdown');
 const detail=await request(`/v3/players/${player}/contributions`);ok(detail.body.contributions.length===32,'public contribution breakdown');
 eq((await request('/v3/leaderboards/overall?asOf=1')).body.code,'snapshot_expired','stale pages rejected, not silently mixed');
 const history=await request('/v3/me/runs',undefined,oldPlayer+'.'+secret);ok(history.body.entries.some(r=>r.status==='legacy'&&r.raw_score===18),'v1 raw record visible in archive');
 const reviewRow=(await db`SELECT id FROM micro_arcade_lb_runs WHERE session_id=${suspicious.id}`)[0];await store.rpc('micro_arcade_lb_review',{p_run:reviewRow.id,p_status:'ranked',p_reason:'Integration test only'});
 eq((await request(`/v3/sessions/${suspicious.id}/result`,undefined,token)).body.status,'ranked','review receipt reconciliation');
 eq(Number((await db`SELECT count(*) n FROM micro_arcade_lb_reviews`)[0].n),1,'moderation trail');
 await assert.rejects(()=>db`UPDATE micro_arcade_lb_runs SET raw_score=999 WHERE id=${reviewRow.id}`);assertions++;
 // Permissions are checked as real database roles, not assumed from migration strings.
 for(const role of ['anon','authenticated']){
  await assert.rejects(()=>db.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE '+role);await tx`SELECT * FROM micro_arcade_lb_runs`}));assertions++;
  await assert.rejects(()=>db.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE '+role);await tx`SELECT micro_arcade_lb_values('stack','standard',45)`}));assertions++;
 }
 const expired=(await start()).body.session;await rewind(expired.id,21600000+604800000+1000);eq((await request('/v3/scores',payload(expired),token)).status,410,'upload deadline enforced');
 await store.rpc('micro_arcade_lb_cleanup',{});eq(Number((await db`SELECT count(*) n FROM micro_arcade_lb_sessions WHERE id=${expired.id}`)[0].n),0,'expired unused session cleaned');eq(Number((await db`SELECT count(*) n FROM micro_arcade_lb_runs WHERE session_id=${s1.id}`)[0].n),1,'cleanup never deletes submitted evidence');
 // Exact completed-at UTC week selection, including late-arriving uploads.
 const bounds=weekBounds(Date.now()),lateId=crypto.randomUUID();await store.rpc('micro_arcade_lb_guest',{p_id:lateId,p_hash:'d'.repeat(64),p_country:'XX'});
 for(const [at,raw] of [[bounds.start-1,100],[bounds.start,45]]){
  const s=await store.rpc('micro_arcade_lb_start',{p_player:lateId,p_request:crypto.randomUUID(),p_game:'stack',p_mode:'standard',p_policy:POLICY_ID});
  await db`UPDATE micro_arcade_lb_sessions SET issued_at=${at-10000},expires_at=${at-10000+21600000} WHERE id=${s.session.id}`;
  eq((await store.rpc('micro_arcade_lb_finish',{p_player:lateId,p_session:s.session.id,p_raw:raw,p_duration:10000,p_active:10000,p_mode:'standard',p_policy:POLICY_ID,p_source:2})).status,'ranked','late result received');
 }
 const week=await store.rpc('micro_arcade_lb_board',{p_scope:'weekly',p_game:'',p_mode:'all',p_player:lateId,p_limit:20,p_offset:0,p_asof:null});eq(week.contributions[0].rawScore,45,'late previous-week record does not contaminate current week');eq(week.weekStart,bounds.start,'Monday UTC start');
 console.log(JSON.stringify({status:'PASS',postgres:'17',assertions,parityVectors:vectors,maxMicroAPError:maxError,coverage:['fresh installation','v2 backfill','idempotent migration','original raw preservation','legacy auth upgrade','36 modes','atomic duplicates','payload conflict','wrong owner','precise AP','finite bounds','review isolation','shared ranks','stable pagination','32-game aggregation','public explanation','legacy archive','moderation','RLS and RPC privileges','unused cleanup','late upload week boundary']},null,2));
}finally{await db.close();}
