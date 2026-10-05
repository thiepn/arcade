import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assessRunPopulation, assessCheckpoints, determineState, elapsedDays, epochId, MS_PER_DAY } from './p35-effectiveness-core.mjs';
import { buildControlPlaneManifest, diffControlPlaneManifests } from './p36-control-plane-core.mjs';

const root=resolve(process.cwd());
const policy=JSON.parse(readFileSync(join(root,'ops/p35-operating-effectiveness-policy.json'),'utf8'));
const p36Policy=JSON.parse(readFileSync(join(root,'ops/p36-observation-integrity-policy.json'),'utf8'));
const currentControlPlane=buildControlPlaneManifest(root,p36Policy.controlPlanePaths);
const reportDir=resolve(root,process.env.P35_REPORT_DIR||'p35-report');
const live=process.env.P35_LIVE!=='0'&&Boolean(process.env.GITHUB_TOKEN&&process.env.GITHUB_REPOSITORY);
const mutate=live&&process.env.P35_MUTATE_ISSUES!=='0';
const repo=process.env.GITHUB_REPOSITORY||'';
const token=process.env.GITHUB_TOKEN||'';
const now=new Date();
const nowIso=now.toISOString();

const ledgerMarker='<!-- p35-operating-effectiveness-ledger -->';
const readinessMarker='<!-- p35-audit-dry-run-readiness -->';
const p34DeficiencyMarker='<!-- p34-security-assurance-deficiency -->';
const p33AssuranceMarker='<!-- p33-long-term-dr-assurance -->';
const mainProtectionMarker='<!-- p34-main-protection-deficiency -->';
const ledgerStatePattern=/<!-- p35-ledger-state-b64:([A-Za-z0-9+/=]+) -->/;

mkdirSync(reportDir,{recursive:true});
const writeJson=(name,value)=>writeFileSync(join(reportDir,name),JSON.stringify(value,null,2)+'\n');

async function github(path,options={}){
  const response=await fetch('https://api.github.com'+path,{
    ...options,
    headers:{
      Accept:'application/vnd.github+json',
      Authorization:'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'thiepn-arcade-p35-effectiveness',
      ...(options.headers||{}),
    },
  });
  const text=await response.text();
  if(!response.ok)throw new Error('GitHub API '+response.status+' '+path+': '+text.slice(0,500));
  return text?JSON.parse(text):null;
}

function ageHours(value){
  if(!value)return null;
  return Number(((now.getTime()-new Date(value).getTime())/(60*60*1000)).toFixed(2));
}

function findOpenIssue(issues,marker){
  return (issues||[]).find(issue=>issue.state==='open'&&!issue.pull_request&&typeof issue.body==='string'&&issue.body.includes(marker))||null;
}
function findAnyIssue(issues,marker){
  return (issues||[]).find(issue=>!issue.pull_request&&typeof issue.body==='string'&&issue.body.includes(marker))||null;
}

function parseLedger(body=''){
  const match=String(body).match(ledgerStatePattern);
  if(!match)return {current:null,history:[]};
  try{
    const parsed=JSON.parse(Buffer.from(match[1],'base64').toString('utf8'));
    return {
      current:parsed.current||null,
      history:Array.isArray(parsed.history)?parsed.history:[],
    };
  }catch{
    return {current:null,history:[]};
  }
}

function renderLedgerBody(state,status){
  const encoded=Buffer.from(JSON.stringify(state),'utf8').toString('base64');
  const current=state.current;
  return [
    ledgerMarker,
    '<!-- p35-ledger-state-b64:'+encoded+' -->',
    '# P35 Operating-Effectiveness Ledger',
    '',
    '- Current P35 state: **'+status+'**',
    '- Current epoch: **'+(current?.id||'none')+'**',
    '- Epoch start: **'+(current?.start||'not started')+'**',
    '- Epoch status: **'+(current?.status||'none')+'**',
    '- Prior epochs retained: **'+state.history.length+'**',
    '',
    'The ledger stores only control/evidence metadata. It contains no player rows, backup plaintext, credentials or recovery private keys.',
  ].join('\n');
}

async function latestSuccessfulWorkflow(filename){
  const response=await github('/repos/'+repo+'/actions/workflows/'+encodeURIComponent(filename)+'/runs?branch=main&status=success&per_page=1');
  return Array.isArray(response.workflow_runs)?response.workflow_runs[0]||null:null;
}

async function workflowPopulation(filename,start,end){
  const all=[];
  for(let page=1;page<=5;page++){
    const response=await github('/repos/'+repo+'/actions/workflows/'+encodeURIComponent(filename)+'/runs?branch=main&per_page=100&page='+page);
    const runs=Array.isArray(response.workflow_runs)?response.workflow_runs:[];
    all.push(...runs);
    if(runs.length<100)break;
    const oldest=runs[runs.length-1];
    if(oldest&&new Date(oldest.created_at).getTime()<new Date(start).getTime())break;
  }
  const startMs=new Date(start).getTime();
  const endMs=new Date(end).getTime();
  return all.filter(run=>{
    const t=new Date(run.created_at||run.updated_at||0).getTime();
    return Number.isFinite(t)&&t>=startMs&&t<=endMs;
  });
}

function checkpointFromComment(comment){
  const body=typeof comment.body==='string'?comment.body:'';
  const match=body.match(/<!-- p35-checkpoint:([a-f0-9]{16}):(\d{4}-\d{2}-\d{2}) -->/);
  if(!match)return null;
  return {epochId:match[1],day:match[2],createdAt:comment.created_at||comment.updated_at,commentId:comment.id,url:comment.html_url||null};
}

async function maintainReadinessIssue(issues,status,remediation,period,populations,checkpointAssessment){
  if(!mutate)return {action:'disabled'};
  let existing=findAnyIssue(issues,readinessMarker);
  const body=[
    readinessMarker,
    '# P35 operating-effectiveness / audit dry-run readiness',
    '',
    '- State: **'+status+'**',
    '- Observation epoch: **'+(period.epochId||'not started')+'**',
    '- Epoch start: **'+(period.start||'not started')+'**',
    '- Elapsed days: **'+(period.elapsedDays??0)+' / '+policy.observation.consecutiveDays+'**',
    '',
    '## Remediation',
    ...remediation.map(item=>'- '+item.id+' / '+item.controlId+': **'+(item.resolved?'RESOLVED':'OPEN')+'** — '+item.title),
    '',
    '## Evidence period',
    '- Workflow populations passing: **'+populations.filter(item=>item.pass).length+' / '+populations.length+'**',
    '- Clean checkpoint days: **'+(checkpointAssessment?.uniqueDayCount??0)+' / '+policy.observation.minimumCleanDailyCheckpoints+'**',
    '',
    'This is an internal readiness signal. It is not an external audit opinion or certification.',
  ].join('\n');

  if(status==='INTERNAL_DRY_RUN_PASS'){
    if(existing){
      await github('/repos/'+repo+'/issues/'+existing.number+'/comments',{method:'POST',body:JSON.stringify({body:'P35 internal audit dry-run criteria passed for epoch '+period.epochId+'. Closing the readiness issue; this is not an external assurance opinion.'})});
      await github('/repos/'+repo+'/issues/'+existing.number,{method:'PATCH',body:JSON.stringify({state:'closed',state_reason:'completed'})});
      return {action:'closed',number:existing.number,url:existing.html_url};
    }
    return {action:'none'};
  }
  if(existing){
    const updated=await github('/repos/'+repo+'/issues/'+existing.number,{method:'PATCH',body:JSON.stringify({title:'P35 Operating-Effectiveness / Audit Dry-Run Readiness',body,state:'open'})});
    return {action:'updated',number:updated.number,url:updated.html_url};
  }
  const created=await github('/repos/'+repo+'/issues',{method:'POST',body:JSON.stringify({title:'P35 Operating-Effectiveness / Audit Dry-Run Readiness',body})});
  return {action:'opened',number:created.number,url:created.html_url};
}

function writePackage({status,remediation,period,populations,checkpointAssessment,baseline,p34Run,p33Run,exceptions,issueAction}){
  const samples=populations.map(item=>({id:item.id,workflow:item.workflow,controls:item.controls,samples:item.samples}));
  const report={
    phase:'P35',
    generatedAt:nowIso,
    mode:live?'live':'static',
    status,
    baseline,
    period,
    remediation,
    checkpointAssessment,
    workflowPopulations:populations,
    assuranceBoundary:policy.assuranceBoundary,
    sourceRuns:{p34:p34Run?{id:p34Run.id,updatedAt:p34Run.updated_at,url:p34Run.html_url}:null,p33:p33Run?{id:p33Run.id,updatedAt:p33Run.updated_at,url:p33Run.html_url}:null},
    readinessIssue:issueAction||null,
  };
  writeJson('operating-effectiveness.json',report);
  writeJson('remediation.json',{generatedAt:nowIso,status,items:remediation});
  writeJson('sample-register.json',{generatedAt:nowIso,epochId:period.epochId||null,samples});
  writeJson('exceptions.json',{generatedAt:nowIso,status,exceptions});

  const issued=status==='INTERNAL_DRY_RUN_PASS';
  writeJson('internal-dry-run-certification.json',{
    kind:'internal-audit-dry-run',
    externalAssurance:false,
    status:issued?'INTERNAL_DRY_RUN_PASS':'NOT_ISSUED',
    generatedAt:nowIso,
    epochId:issued?period.epochId:null,
    periodStart:issued?period.start:null,
    periodEnd:issued?period.end:null,
    statement:issued
      ?'Arcade satisfied its internally defined P35 dry-run criteria for the stated epoch. This is not an independent audit opinion.'
      :'P35 internal dry-run certification is not issued because remediation and/or operating-effectiveness criteria are incomplete.',
  });

  const dryRun=[
    '# Arcade P35 Internal Audit Dry-Run',
    '',
    '- Generated: '+nowIso,
    '- State: **'+status+'**',
    '- Epoch: '+(period.epochId||'not started'),
    '- Period: '+(period.start||'not started')+' → '+(period.end||'not complete'),
    '- Exceptions: '+exceptions.length,
    '',
    '> '+policy.assuranceBoundary,
    '',
    '## Remediation status',
    ...remediation.map(item=>'- '+item.id+' / '+item.controlId+': '+(item.resolved?'RESOLVED':'OPEN')+' — '+item.verification),
    '',
    '## Operating populations',
    ...(populations.length?populations.map(item=>'- '+item.id+' ('+item.workflow+'): '+(item.pass?'PASS':'NOT YET PASSING')+'; successes '+item.successCount+', failures '+item.failureCount+(item.maxGapHours===null?'':', max gap '+item.maxGapHours+'h')):['- Observation population testing has not started.']),
    '',
    '## Result',
    issued
      ?'INTERNAL_DRY_RUN_PASS. The internal criteria are satisfied for the stated epoch.'
      :'No internal dry-run pass is issued at this time.',
    '',
    'An external assessor may choose a different scope, materiality threshold, observation period, sampling method or evidence requirement.',
    '',
  ].join('\n');
  writeFileSync(join(reportDir,'audit-dry-run.md'),dryRun);

  const requestList=[
    '# P35 Simulated Audit Evidence Request List',
    '',
    'This checklist models the evidence a reviewer would request; it is not a request from an external auditor.',
    '',
    '1. Current P34 control catalog and P35 operating-effectiveness policy.',
    '2. Evidence that main branch protection/ruleset is enabled.',
    '3. CI and production deployment population for the observation epoch.',
    '4. P27/P28/P29 monitoring, SLO and incident-response run populations.',
    '5. P30 continuity/rollback drill evidence.',
    '6. P31 encrypted-backup evidence and P32 cold-recovery evidence.',
    '7. P33 signed offline-key ceremony evidence and recurring assurance history.',
    '8. P34 continuous-assurance history and deficiency lifecycle.',
    '9. P35 daily clean-checkpoint ledger and invalidated-epoch history.',
    '10. Exception register and remediation evidence for every exception.',
    '',
  ].join('\n');
  writeFileSync(join(reportDir,'request-list.md'),requestList);
}

if(!live){
  const remediation=policy.remediation.map(item=>({...item,resolved:false,status:'NOT_EVALUATED'}));
  const period={epochId:null,start:null,end:null,elapsedDays:0,observationDays:policy.observation.consecutiveDays};
  const status=determineState({live:false,baselineReady:false,epochActive:false,elapsedDays:0,observationDays:policy.observation.consecutiveDays,populationsPass:false,checkpointsPass:false});
  writePackage({status,remediation,period,populations:[],checkpointAssessment:null,baseline:{evaluated:false},p34Run:null,p33Run:null,exceptions:[],issueAction:{action:'disabled'}});
  console.log('P35 OPERATING EFFECTIVENESS — '+status);
  process.exit(0);
}

let issues=await github('/repos/'+repo+'/issues?state=all&per_page=100');
issues=(Array.isArray(issues)?issues:[]).filter(issue=>!issue.pull_request);
const [mainBranch,p33Run,p34Run,ciRun]=await Promise.all([
  github('/repos/'+repo+'/branches/main'),
  latestSuccessfulWorkflow('p33-long-term-assurance.yml'),
  latestSuccessfulWorkflow('p34-continuous-assurance.yml'),
  latestSuccessfulWorkflow('ci.yml'),
]);

const mainProtectionIssue=findOpenIssue(issues,mainProtectionMarker);
const p33Issue=findOpenIssue(issues,p33AssuranceMarker);
const p34Issue=findOpenIssue(issues,p34DeficiencyMarker);
const mainProtected=Boolean(mainBranch?.protected);
const p33Recent=Boolean(p33Run?.updated_at)&&ageHours(p33Run.updated_at)<=30;
const p34Recent=Boolean(p34Run?.updated_at)&&ageHours(p34Run.updated_at)<=30;
const mainHeadSha=mainBranch?.commit?.sha||null;
const currentHeadCiReady=Boolean(ciRun?.head_sha)&&ciRun.head_sha===mainHeadSha;

if(mainProtected&&mainProtectionIssue&&mutate){
  await github('/repos/'+repo+'/issues/'+mainProtectionIssue.number+'/comments',{method:'POST',body:JSON.stringify({body:'P35 direct verification now reports main.protected=true. The SC-01 remediation condition is satisfied, so this historical tracking issue is being closed.'})});
  await github('/repos/'+repo+'/issues/'+mainProtectionIssue.number,{method:'PATCH',body:JSON.stringify({state:'closed',state_reason:'completed'})});
}

const remediation=[
  {
    ...policy.remediation.find(item=>item.id==='R-01'),
    resolved:mainProtected,
    status:mainProtected?'RESOLVED':'OPEN',
    evidence:{mainProtected,trackingIssueNumber:mainProtectionIssue?.number||null},
  },
  {
    ...policy.remediation.find(item=>item.id==='R-02'),
    resolved:p33Recent&&!p33Issue,
    status:p33Recent&&!p33Issue?'RESOLVED':'OPEN',
    evidence:{successfulP33RunId:p33Run?.id||null,p33RunAgeHours:p33Run?.updated_at?ageHours(p33Run.updated_at):null,assuranceIssueNumber:p33Issue?.number||null},
  },
];

const baselineHealthReady=mainProtected&&p33Recent&&!p33Issue&&p34Recent&&!p34Issue;
const baseline={
  evaluated:true,
  mainProtected,
  mainHeadSha,
  currentHeadCiReady,
  qualifyingCiRunId:currentHeadCiReady?ciRun?.id||null:null,
  p33Recent,
  p33IssueOpen:Boolean(p33Issue),
  p34Recent,
  p34DeficiencyIssueOpen:Boolean(p34Issue),
  controlPlaneFingerprint:currentControlPlane.fingerprint,
  controlPlaneMissing:currentControlPlane.missing,
  ready:baselineHealthReady,
  startReady:baselineHealthReady&&currentHeadCiReady&&currentControlPlane.missing.length===0,
  blockers:[
    ...(!mainProtected?['SC-01 main is not protected']:[]),
    ...(!p33Recent?['SC-13 no recent successful P33 assurance']:[]),
    ...(p33Issue?['SC-13 P33 assurance issue #'+p33Issue.number+' remains open']:[]),
    ...(!p34Recent?['P34 continuous-assurance evidence is stale or missing']:[]),
    ...(p34Issue?['P34 deficiency issue #'+p34Issue.number+' remains open']:[]),
    ...(currentControlPlane.missing.length?['P36 control-plane manifest has missing files: '+currentControlPlane.missing.join(', ')]:[]),
  ],
  epochStartBlockers:[
    ...(!currentHeadCiReady?['P36 epoch start requires a successful CI run for current main head '+(mainHeadSha||'unknown')]:[]),
  ],
};

let ledgerIssue=findAnyIssue(issues,ledgerMarker);
let ledgerState=parseLedger(ledgerIssue?.body||'');

async function persistLedger(state,status){
  const body=renderLedgerBody(state,status);
  if(ledgerIssue){
    const updated=await github('/repos/'+repo+'/issues/'+ledgerIssue.number,{method:'PATCH',body:JSON.stringify({title:'P35 Operating-Effectiveness Ledger',body,state:'open'})});
    ledgerIssue={...ledgerIssue,...updated,state:'open',body};
  }else{
    const created=await github('/repos/'+repo+'/issues',{method:'POST',body:JSON.stringify({title:'P35 Operating-Effectiveness Ledger',body})});
    ledgerIssue=created;
  }
}

let controlPlaneChangedThisRun=false;
if(ledgerState.current){
  const expectedFingerprint=ledgerState.current.controlPlaneFingerprint||null;
  const fingerprintChanged=!expectedFingerprint||expectedFingerprint!==currentControlPlane.fingerprint;
  if(fingerprintChanged){
    const current=ledgerState.current;
    const changes=diffControlPlaneManifests(current.controlPlaneManifest||{files:[]},currentControlPlane);
    ledgerState.history.push({
      ...current,
      status:current.status==='CERTIFIED'?'CERTIFIED':'INVALIDATED',
      endedAt:nowIso,
      reason:'P36 control-plane fingerprint changed during observation',
      replacementFingerprint:currentControlPlane.fingerprint,
      changedPaths:changes.map(change=>change.path),
    });
    ledgerState.current=null;
    controlPlaneChangedThisRun=true;
    if(mutate){
      await persistLedger(ledgerState,'OBSERVATION_STARTING');
      await github('/repos/'+repo+'/issues/'+ledgerIssue.number+'/comments',{method:'POST',body:JSON.stringify({body:[
        'P35 epoch **'+current.id+'** was invalidated at '+nowIso+' because the P36 control-plane fingerprint changed.',
        '',
        '- Previous fingerprint: '+(expectedFingerprint||'missing'),
        '- Current fingerprint: '+currentControlPlane.fingerprint,
        '- Changed paths: '+(changes.length?changes.map(change=>change.path).join(', '):'manifest baseline unavailable'),
        '',
        'A replacement epoch cannot start in this same run. The new baseline must first be represented by a successful CI run.',
      ].join('\n')})});
    }
  }
}

if(!baseline.ready&&ledgerState.current){
  const current=ledgerState.current;
  ledgerState.history.push({
    ...current,
    status:current.status==='CERTIFIED'?'CERTIFIED':'INVALIDATED',
    endedAt:nowIso,
    reason:current.status==='CERTIFIED'?'later baseline deficiency after certified period':'blocking P34/P33/repository deficiency',
  });
  ledgerState.current=null;
  if(mutate){
    await persistLedger(ledgerState,'REMEDIATION_REQUIRED');
    await github('/repos/'+repo+'/issues/'+ledgerIssue.number+'/comments',{method:'POST',body:JSON.stringify({body:'P35 epoch '+current.id+' ended at '+nowIso+' because the baseline became deficient. A replacement epoch cannot start until remediation is verified.'})});
  }
}

if(baseline.startReady&&!ledgerState.current&&!controlPlaneChangedThisRun){
  ledgerState.current={
    id:epochId(nowIso,process.env.GITHUB_RUN_ID||'p35'),
    start:nowIso,
    status:'ACTIVE',
    certifiedAt:null,
    startMainSha:mainHeadSha,
    startCiRunId:ciRun?.id||null,
    controlPlaneFingerprint:currentControlPlane.fingerprint,
    controlPlaneManifest:currentControlPlane,
  };
  if(mutate)await persistLedger(ledgerState,'OBSERVATION_STARTING');
}

const currentEpoch=ledgerState.current;
let checkpoints=[];
if(currentEpoch&&ledgerIssue){
  const comments=await github('/repos/'+repo+'/issues/'+ledgerIssue.number+'/comments?per_page=100');
  checkpoints=(Array.isArray(comments)?comments:[]).map(checkpointFromComment).filter(Boolean).filter(item=>item.epochId===currentEpoch.id);
}

if(baseline.ready&&currentEpoch&&currentEpoch.status==='ACTIVE'){
  const day=nowIso.slice(0,10);
  const exists=checkpoints.some(item=>item.day===day);
  if(!exists){
    const marker='<!-- p35-checkpoint:'+currentEpoch.id+':'+day+' -->';
    const body=[
      marker,
      'P35 clean checkpoint for epoch **'+currentEpoch.id+'**.',
      '',
      '- Timestamp: '+nowIso,
      '- main protected: '+mainProtected,
      '- P33 assurance run: '+(p33Run?.id||'none'),
      '- P34 assurance run: '+(p34Run?.id||'none'),
      '- Control-plane fingerprint: '+currentEpoch.controlPlaneFingerprint,
      '- open P34 deficiency: '+Boolean(p34Issue),
    ].join('\n');
    if(mutate){
      const created=await github('/repos/'+repo+'/issues/'+ledgerIssue.number+'/comments',{method:'POST',body:JSON.stringify({body})});
      checkpoints.push({epochId:currentEpoch.id,day,createdAt:created.created_at||nowIso,commentId:created.id,url:created.html_url||null,controlPlaneFingerprint:currentEpoch.controlPlaneFingerprint,p33RunId:p33Run?.id||null,p34RunId:p34Run?.id||null});
    }else{
      checkpoints.push({epochId:currentEpoch.id,day,createdAt:nowIso,commentId:null,url:null,controlPlaneFingerprint:currentEpoch.controlPlaneFingerprint,p33RunId:p33Run?.id||null,p34RunId:p34Run?.id||null});
    }
  }
}

let populations=[];
let checkpointAssessment=null;
let period={epochId:currentEpoch?.id||null,start:currentEpoch?.start||null,end:null,elapsedDays:0,observationDays:policy.observation.consecutiveDays};
let populationsPass=false;
let checkpointsPass=false;

if(currentEpoch){
  const elapsed=elapsedDays(currentEpoch.start,nowIso);
  period.elapsedDays=elapsed;
  const formalEnd=new Date(new Date(currentEpoch.start).getTime()+policy.observation.consecutiveDays*MS_PER_DAY).toISOString();
  const assessmentEnd=new Date(nowIso).getTime()>=new Date(formalEnd).getTime()?formalEnd:nowIso;
  period.end=elapsed>=policy.observation.consecutiveDays?formalEnd:null;

  for(const populationPolicy of policy.workflowPopulations){
    const runs=await workflowPopulation(populationPolicy.workflow,currentEpoch.start,assessmentEnd);
    populations.push(assessRunPopulation({
      runs,
      start:currentEpoch.start,
      end:assessmentEnd,
      policy:populationPolicy,
      failureConclusions:policy.terminalFailureConclusions,
    }));
  }
  checkpointAssessment=assessCheckpoints({
    checkpoints,
    start:currentEpoch.start,
    end:assessmentEnd,
    minimum:policy.observation.minimumCleanDailyCheckpoints,
    maxGapHours:policy.observation.maximumCheckpointGapHours,
  });
  populationsPass=populations.every(item=>item.pass);
  checkpointsPass=checkpointAssessment.pass;
}

let status=determineState({
  live:true,
  baselineReady:baseline.ready,
  epochActive:Boolean(currentEpoch),
  elapsedDays:period.elapsedDays,
  observationDays:policy.observation.consecutiveDays,
  populationsPass,
  checkpointsPass,
});

const exceptions=[
  ...baseline.blockers.map(item=>({type:'BASELINE_BLOCKER',detail:item})),
  ...(!ledgerState.current&&!baseline.startReady&&baseline.ready?baseline.epochStartBlockers.map(item=>({type:'EPOCH_START_BLOCKER',detail:item})):[]),
  ...(controlPlaneChangedThisRun?[{type:'CONTROL_PLANE_DRIFT',detail:'P36 control-plane fingerprint changed; prior epoch invalidated'}]:[]),
  ...populations.flatMap(item=>item.failures.map(failure=>({type:'WORKFLOW_FAILURE',population:item.id,workflow:item.workflow,...failure}))),
  ...populations.filter(item=>currentEpoch&&period.elapsedDays>=policy.observation.consecutiveDays&&!item.pass).map(item=>({type:'POPULATION_TEST_FAILURE',population:item.id,workflow:item.workflow,successCount:item.successCount,failureCount:item.failureCount,maxGapHours:item.maxGapHours})),
];

if(status==='OBSERVATION_INSUFFICIENT'&&currentEpoch&&currentEpoch.status==='ACTIVE'){
  ledgerState.history.push({...currentEpoch,status:'INSUFFICIENT',endedAt:period.end||nowIso,reason:'30-day epoch failed internal evidence thresholds'});
  ledgerState.current=null;
  if(mutate){
    await persistLedger(ledgerState,status);
    await github('/repos/'+repo+'/issues/'+ledgerIssue.number+'/comments',{method:'POST',body:JSON.stringify({body:'P35 epoch '+currentEpoch.id+' completed its 30-day window but did not satisfy all internal evidence thresholds. The epoch is closed as insufficient; a new epoch will begin on the next clean P35 run.'})});
  }
}

if(status==='INTERNAL_DRY_RUN_PASS'&&currentEpoch&&currentEpoch.status!=='CERTIFIED'){
  currentEpoch.status='CERTIFIED';
  currentEpoch.certifiedAt=nowIso;
  ledgerState.current=currentEpoch;
  if(mutate){
    await persistLedger(ledgerState,status);
    await github('/repos/'+repo+'/issues/'+ledgerIssue.number+'/comments',{method:'POST',body:JSON.stringify({body:'P35 epoch '+currentEpoch.id+' achieved INTERNAL_DRY_RUN_PASS at '+nowIso+'. This records internal dry-run completion only; it is not an external audit opinion.'})});
  }
}

const issueAction=await maintainReadinessIssue(issues,status,remediation,period,populations,checkpointAssessment);
writePackage({status,remediation,period,populations,checkpointAssessment,baseline,p34Run,p33Run,exceptions,issueAction});

console.log('P35 OPERATING EFFECTIVENESS — '+status);
console.log('Baseline ready: '+baseline.ready+'; epoch: '+(period.epochId||'none')+'; elapsed days: '+period.elapsedDays);
console.log('Remediations resolved: '+remediation.filter(item=>item.resolved).length+'/'+remediation.length);
if(exceptions.length)for(const exception of exceptions)console.log('- '+exception.type+': '+(exception.detail||exception.workflow||exception.population||'exception'));
