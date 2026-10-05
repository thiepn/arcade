import { createHash } from 'node:crypto';

export const MS_PER_HOUR=60*60*1000;
export const MS_PER_DAY=24*MS_PER_HOUR;

export function epochId(start,seed=''){
  return createHash('sha256').update(String(start)+'|'+String(seed)).digest('hex').slice(0,16);
}

export function deterministicSamples(runs){
  const ordered=[...runs].sort((a,b)=>new Date(a.updated_at||a.created_at)-new Date(b.updated_at||b.created_at));
  if(!ordered.length)return [];
  const picks=[0,Math.floor((ordered.length-1)/2),ordered.length-1];
  return [...new Set(picks)].map(index=>ordered[index]).map(run=>({
    id:run.id,
    createdAt:run.created_at||null,
    completedAt:run.updated_at||null,
    conclusion:run.conclusion||null,
    headSha:run.head_sha||null,
    url:run.html_url||null,
  }));
}

export function assessRunPopulation({runs,start,end,policy,failureConclusions=[]}){
  const startMs=new Date(start).getTime();
  const endMs=new Date(end).getTime();
  const relevant=(runs||[]).filter(run=>{
    const t=new Date(run.created_at||run.updated_at||0).getTime();
    return Number.isFinite(t)&&t>=startMs&&t<=endMs;
  });
  const failures=relevant.filter(run=>failureConclusions.includes(run.conclusion));
  const successes=relevant.filter(run=>run.conclusion==='success')
    .sort((a,b)=>new Date(a.updated_at||a.created_at)-new Date(b.updated_at||b.created_at));
  const empty=relevant.length===0;
  const countPass=policy.allowEmpty&&empty?true:successes.length>=policy.minimumSuccesses;
  const failurePass=!policy.forbidFailures||failures.length===0;
  let maxGapHours=null;
  let gapPass=true;
  if(policy.maxGapHours!==null&&policy.maxGapHours!==undefined){
    const points=[startMs,...successes.map(run=>new Date(run.updated_at||run.created_at).getTime()),endMs]
      .filter(Number.isFinite)
      .sort((a,b)=>a-b);
    let maxGap=0;
    for(let i=1;i<points.length;i++)maxGap=Math.max(maxGap,points[i]-points[i-1]);
    maxGapHours=Number((maxGap/MS_PER_HOUR).toFixed(2));
    gapPass=maxGapHours<=policy.maxGapHours;
  }
  return {
    id:policy.id,
    workflow:policy.workflow,
    controls:policy.controls,
    kind:policy.kind,
    populationCount:relevant.length,
    successCount:successes.length,
    failureCount:failures.length,
    countPass,
    failurePass,
    maxGapHours,
    gapPass,
    pass:countPass&&failurePass&&gapPass,
    samples:deterministicSamples(successes),
    failures:failures.map(run=>({id:run.id,conclusion:run.conclusion,url:run.html_url||null,createdAt:run.created_at||null})),
  };
}

export function assessCheckpoints({checkpoints,start,end,minimum,maxGapHours}){
  const startMs=new Date(start).getTime();
  const endMs=new Date(end).getTime();
  const relevant=(checkpoints||[]).filter(item=>{
    const t=new Date(item.createdAt).getTime();
    return Number.isFinite(t)&&t>=startMs&&t<=endMs;
  }).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  const uniqueDays=new Set(relevant.map(item=>item.day));
  const points=[startMs,...relevant.map(item=>new Date(item.createdAt).getTime()),endMs].sort((a,b)=>a-b);
  let maxGap=0;
  for(let i=1;i<points.length;i++)maxGap=Math.max(maxGap,points[i]-points[i-1]);
  const observedMaxGapHours=Number((maxGap/MS_PER_HOUR).toFixed(2));
  return {
    checkpointCount:relevant.length,
    uniqueDayCount:uniqueDays.size,
    minimum,
    maxGapHours:observedMaxGapHours,
    maximumAllowedGapHours:maxGapHours,
    pass:uniqueDays.size>=minimum&&observedMaxGapHours<=maxGapHours,
  };
}

export function determineState({live,baselineReady,epochActive,elapsedDays,observationDays,populationsPass,checkpointsPass}){
  if(!live)return 'DESIGN_READY';
  if(!baselineReady)return 'REMEDIATION_REQUIRED';
  if(!epochActive)return 'OBSERVATION_STARTING';
  if(elapsedDays<observationDays)return 'OBSERVATION_WARMING';
  if(!populationsPass||!checkpointsPass)return 'OBSERVATION_INSUFFICIENT';
  return 'INTERNAL_DRY_RUN_PASS';
}

export function elapsedDays(start,end){
  return Number(((new Date(end).getTime()-new Date(start).getTime())/MS_PER_DAY).toFixed(3));
}
