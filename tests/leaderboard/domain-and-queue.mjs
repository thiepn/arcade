import assert from 'node:assert/strict';
import {POLICY, POLICY_ID, AP_SCALE, apMicros, contributionMicros, screenRun, canonicalPayload, weekBounds, validDisplayName} from '../../shared/leaderboard/domain.ts';
import {toArcadePoints} from '../../shared/scoring.ts';
import {UploadQueue,BrowserOutboxStore} from '../../src/lib/leaderboardOutbox.ts';
import {LeaderboardError} from '../../src/lib/leaderboardRequest.ts';
import {RunClock} from '../../src/lib/runClock.ts';
let checks=0;const check=(v,label)=>{checks++;assert.ok(v,label)};
for(const p of Object.values(POLICY.policies)){
 const [a,b,c]=p.anchors;
 let previous=-1;
 for(const raw of [0,1,a-1,a,a+1,b-1,b,b+1,c-1,c,c+1,c*2,c*4,100*c,Number.MAX_SAFE_INTEGER].sort((x,y)=>x-y)){
  const units=apMicros(p.gameId,raw,p.modeId);check(Number.isSafeInteger(units)&&units>=previous,`${p.gameId}/${p.modeId} increasing precise AP`);previous=units;
  // v2 display is preserved, apart from extremely rare sub-micro boundary tolerance.
  check(Math.abs(Math.floor(units/AP_SCALE)-toArcadePoints(p.gameId,raw,p.modeId))<=1,'frozen native scoring economy');
  check(contributionMicros(p.gameId,units,p.modeId)<=10000*AP_SCALE,'bounded championship contribution');
 }
 check(apMicros(p.gameId,a,p.modeId)===Math.round(1000*p.reward*AP_SCALE),'first anchor');
 check(screenRun(p.gameId,p.modeId,0,0).status!=='ranked','immediate run screened');
 check(screenRun(p.gameId,p.modeId,100,60000).status==='ranked','ordinary full-minute run accepted');
 if(p.kind==='finite'||p.gameId==='airhockey')check(screenRun(p.gameId,p.modeId,p.hardMax+1,60000).status==='rejected','authored raw ceiling enforced');
}
check(Object.keys(POLICY.policies).length===36,'complete modes');
for(const raw of [NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1])check(apMicros('stack',raw,'standard')===0,'invalid values closed');
check(contributionMicros('reaction',6500*AP_SCALE,'standard')===10000*AP_SCALE,'finite elite can fully contribute');
check(contributionMicros('perfectstop',6500*AP_SCALE,'standard')===10000*AP_SCALE,'finite precision elite can fully contribute');
check(contributionMicros('stack',20000*AP_SCALE,'standard')===10000*AP_SCALE,'endless cannot dominate');
check(screenRun('airhockey','HARD',5000,500).status==='review','abbreviated hockey match not published');
check(screenRun('stack','standard',1000000,1000).status==='review','improbable endless run quarantined');
check(weekBounds(Date.parse('2026-09-13T23:59:59Z')).start===Date.parse('2026-09-07T00:00:00Z'),'week before Monday');
check(weekBounds(Date.parse('2026-09-14T00:00:00Z')).start===Date.parse('2026-09-14T00:00:00Z'),'week boundary exact');
for(const name of ['Jonathan','김민수','Élodie'])check(validDisplayName(name),'Unicode name accepted');
for(const name of ['a',' '.repeat(4),'bad<script>', 'A'.repeat(21),'A\u202EB'])check(!validDisplayName(name),'unsafe or invalid name rejected');
let t=0;const clock=new RunClock(()=>t);t=100;clock.setActive(true);t=1500;clock.setActive(false);t=6500;clock.setActive(true);t=7600;const timing=clock.finish();
assert.deepEqual(timing,{durationMs:7600,activeMs:2500});t=999999;assert.deepEqual(clock.finish(),timing);check(true,'completion frozen before upload; menu and pause excluded');
const player=crypto.randomUUID(),id=crypto.randomUUID();
const payload={sessionId:id,rawScore:45,modeId:'standard',scoreVersion:2,protocolVersion:3,policyId:POLICY_ID,durationMs:5000,activeMs:4000};
check(!!canonicalPayload(payload),'canonical envelope');
for(const v of [{...payload,apMicros:99999},{...payload,rawScore:'45'},{...payload,activeMs:6000},{...payload,protocolVersion:2},{...payload,policyId:'bad'}])check(!canonicalPayload(v),'client cannot supply AP or wrong context');
class Store{durable=true;rows=new Map();async all(){return [...this.rows.values()]}async update(id,fn){const r=fn(this.rows.get(id));if(r)this.rows.set(id,r);else this.rows.delete(id);return r}}
const receipt={protocolVersion:3,policyId:POLICY_ID,sessionId:id,gameId:'stack',modeId:'standard',rawScore:45,arcadePoints:3000,apMicros:3000*AP_SCALE,contributionMicros:3000*AP_SCALE,completedAt:5000,status:'ranked',accepted:true,code:'ok'};
let attempts=0,now=100000,who=player,mode='timeout';const store=new Store();const q=new UploadQueue(store,async()=>{attempts++;if(mode==='timeout')throw new LeaderboardError('timeout','timeout');if(mode==='rate')throw new LeaderboardError('rate_limited','rate',429,60000);if(mode==='auth')throw new LeaderboardError('unauthorized','auth',401);if(mode==='wrong')return {...receipt,rawScore:999};return receipt;},()=>who,()=>{},()=>now);
await q.enqueue({id,playerId:player,gameId:'stack',payload,createdAt:now});await q.flush();check(store.rows.get(id).status==='pending','network failure retained');check(store.rows.get(id).payload.durationMs===5000,'retry never lengthens run');
const first=attempts;await q.flush();check(attempts===first,'backoff honored');mode='rate';now+=100000;await q.flush();check(store.rows.get(id).retryAt>=now+60000,'Retry-After honored');
await assert.rejects(()=>q.enqueue({id,playerId:player,gameId:'stack',payload:{...payload,rawScore:46},createdAt:now}),/immutable/);check(true,'immutable journal');
mode='auth';await q.flush(true);check(store.rows.get(id).status==='auth-required','invalid auth is retained, not reassigned');mode='ok';who=crypto.randomUUID();await q.flush(true);check(store.rows.get(id).status==='auth-required','another player cannot inherit queued result');who=player;mode='wrong';await q.flush(true);check(store.rows.get(id).status==='pending','wrong server receipt not accepted');mode='ok';await Promise.all([q.flush(true),q.flush(true)]);check(store.rows.get(id).status==='accepted','duplicate flush converges');
const calls=attempts;await q.flush(true);check(attempts===calls,'accepted receipt never resubmitted');
// Browser journal fallback is durable when IndexedDB is disabled; tampered replacement throws.
const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i],get length(){return values.size}};
const disk=new BrowserOutboxStore();await disk.update(id,()=>store.rows.get(id));const reload=new BrowserOutboxStore();check((await reload.all())[0].status==='accepted','reload persistent fallback');await assert.rejects(()=>reload.update(id,()=>{throw Error('mutation')}),/mutation/);
globalThis.localStorage.setItem=()=>{throw Error('quota')};await disk.update(crypto.randomUUID(),()=>({...store.rows.get(id),id:crypto.randomUUID()}));check(!disk.durable,'quota failure cannot be called durable');
console.log(`Leaderboard domain/queue PASS: ${checks} assertions (36 modes, precision, envelopes, clock, immutability, network/retry/auth/storage faults).`);
