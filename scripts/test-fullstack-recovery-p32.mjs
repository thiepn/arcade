import assert from 'node:assert/strict';
import { assessColdRestore, durationMs, offsiteArtifactAgeMs, orderedTimings } from './p32-recovery-core.mjs';

const stages=['production-precheck','offsite-reference','source-export','cold-restore','cold-api','frontend-build','browser-certification','production-postcheck'];
const base=Date.parse('2026-10-04T10:00:00Z');
const timings={startedAt:new Date(base).toISOString(),completedAt:new Date(base+8000).toISOString(),stages:{}};
stages.forEach((stage,index)=>{
  timings.stages[stage]={
    startedAt:new Date(base+index*1000).toISOString(),
    completedAt:new Date(base+index*1000+500).toISOString(),
    durationMs:500,
  };
});
assert.equal(orderedTimings(timings,stages),true);
assert.equal(durationMs('2026-10-04T10:00:00Z','2026-10-04T10:00:01Z'),1000);
assert.equal(offsiteArtifactAgeMs({captured_at:'2026-10-04T09:00:00Z'},base),3600000);

const source={format:'arcade-p31-offsite-v1',snapshot:{verified:true},restore_drill:{ok:true}};
const restore={phase:'P32',coldTarget:true,sourcePayloadSha256:'a',restoredPayloadSha256:'a',sourceSchemaSha256:'b',restoredSchemaSha256:'b',countsMatch:true,relationshipsOk:true,transientRateLimits:0};
const browser={frontend:{shell:true,leaderboardRequestObserved:true},api:{health:true,overall:true,weekly:true}};
const p27={phase:'P27',status:'healthy',failures:[]};
const offsite={format:'arcade-p32-offsite-reference-v1',ciphertextHashMatches:true,ageMs:1000};

assert.equal(assessColdRestore({source,restore,browser,productionBefore:p27,productionAfter:p27,timings,offsite}).certified,true);
assert.equal(assessColdRestore({source,restore:{...restore,restoredPayloadSha256:'x'},browser,productionBefore:p27,productionAfter:p27,timings,offsite}).certified,false);
assert.equal(assessColdRestore({source,restore,browser,productionBefore:p27,productionAfter:{...p27,status:'unhealthy'},timings,offsite}).certified,false);
assert.equal(assessColdRestore({source,restore,browser,productionBefore:p27,productionAfter:p27,timings,offsite:{...offsite,ciphertextHashMatches:false}}).certified,false);

const overlapped=structuredClone(timings);
overlapped.stages['source-export'].startedAt=new Date(base+100).toISOString();
assert.equal(orderedTimings(overlapped,stages),false);

console.log('P32 FULL-STACK RECOVERY CORE TEST — PASS');
