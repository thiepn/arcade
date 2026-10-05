import { strict as assert } from 'node:assert';
import { assessRunPopulation, assessCheckpoints, determineState, epochId } from './p35-effectiveness-core.mjs';

const start='2026-01-01T00:00:00.000Z';
const end='2026-01-31T00:00:00.000Z';
const sixHourly=[];
for(let i=1;i<=120;i++){
  const created=new Date(new Date(start).getTime()+i*6*60*60*1000).toISOString();
  sixHourly.push({id:i,created_at:created,updated_at:created,conclusion:'success',head_sha:String(i)});
}
const recurring=assessRunPopulation({
  runs:sixHourly,
  start,
  end,
  policy:{id:'x',workflow:'x.yml',controls:[],kind:'recurring',minimumSuccesses:108,allowEmpty:false,forbidFailures:true,maxGapHours:10},
  failureConclusions:['failure','timed_out'],
});
assert.equal(recurring.pass,true);
assert.equal(recurring.successCount,120);
assert.equal(recurring.samples.length,3);

const failed=assessRunPopulation({
  runs:[...sixHourly,{id:999,created_at:'2026-01-15T01:00:00.000Z',updated_at:'2026-01-15T01:01:00.000Z',conclusion:'failure'}],
  start,end,
  policy:{id:'x',workflow:'x.yml',controls:[],kind:'recurring',minimumSuccesses:108,allowEmpty:false,forbidFailures:true,maxGapHours:10},
  failureConclusions:['failure','timed_out'],
});
assert.equal(failed.pass,false);
assert.equal(failed.failureCount,1);

const change=assessRunPopulation({
  runs:[],start,end,
  policy:{id:'c',workflow:'ci.yml',controls:[],kind:'change',minimumSuccesses:0,allowEmpty:true,forbidFailures:true,maxGapHours:null},
  failureConclusions:['failure'],
});
assert.equal(change.pass,true);

const checkpoints=[];
for(let i=0;i<30;i++){
  const createdAt=new Date(new Date(start).getTime()+i*24*60*60*1000+7*60*60*1000).toISOString();
  checkpoints.push({day:createdAt.slice(0,10),createdAt});
}
const cp=assessCheckpoints({checkpoints,start,end,minimum:28,maxGapHours:50});
assert.equal(cp.pass,true);

assert.equal(determineState({live:true,baselineReady:false,epochActive:false,elapsedDays:0,observationDays:30,populationsPass:false,checkpointsPass:false}),'REMEDIATION_REQUIRED');
assert.equal(determineState({live:true,baselineReady:true,epochActive:true,elapsedDays:12,observationDays:30,populationsPass:false,checkpointsPass:false}),'OBSERVATION_WARMING');
assert.equal(determineState({live:true,baselineReady:true,epochActive:true,elapsedDays:30,observationDays:30,populationsPass:true,checkpointsPass:true}),'INTERNAL_DRY_RUN_PASS');
assert.notEqual(epochId(start,'a'),epochId(start,'b'));

console.log('P35 OPERATING-EFFECTIVENESS CORE TEST — PASS');
