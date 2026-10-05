import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildControlPlaneManifest, diffControlPlaneManifests, checkpointChain } from './p36-control-plane-core.mjs';

const root=resolve(process.cwd());
const policy=JSON.parse(readFileSync(join(root,'ops/p36-observation-integrity-policy.json'),'utf8'));
const reportDir=resolve(root,process.env.P36_REPORT_DIR||'p36-report');
const live=process.env.P36_LIVE!=='0'&&Boolean(process.env.GITHUB_TOKEN&&process.env.GITHUB_REPOSITORY);
const mutate=live&&process.env.P36_MUTATE_ISSUES!=='0';
const repo=process.env.GITHUB_REPOSITORY||'';
const token=process.env.GITHUB_TOKEN||'';
const nowIso=new Date().toISOString();

const p35LedgerMarker='<!-- p35-operating-effectiveness-ledger -->';
const p35LedgerStatePattern=/<!-- p35-ledger-state-b64:([A-Za-z0-9+/=]+) -->/;
const p36ReadinessMarker='<!-- p36-observation-integrity-readiness -->';

mkdirSync(reportDir,{recursive:true});
const writeJson=(name,value)=>writeFileSync(join(reportDir,name),JSON.stringify(value,null,2)+'\n');

async function github(path,options={}){
  const response=await fetch('https://api.github.com'+path,{
    ...options,
    headers:{
      Accept:'application/vnd.github+json',
      Authorization:'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'thiepn-arcade-p36-integrity',
      ...(options.headers||{}),
    },
  });
  const text=await response.text();
  if(!response.ok)throw new Error('GitHub API '+response.status+' '+path+': '+text.slice(0,500));
  return text?JSON.parse(text):null;
}

function parseLedger(body=''){
  const match=String(body).match(p35LedgerStatePattern);
  if(!match)return {current:null,history:[]};
  try{
    const parsed=JSON.parse(Buffer.from(match[1],'base64').toString('utf8'));
    return {current:parsed.current||null,history:Array.isArray(parsed.history)?parsed.history:[]};
  }catch{
    return {current:null,history:[]};
  }
}

function parseCheckpoint(comment){
  const body=typeof comment.body==='string'?comment.body:'';
  const marker=body.match(/<!-- p35-checkpoint:([a-f0-9]{16}):(\d{4}-\d{2}-\d{2}) -->/);
  if(!marker)return null;
  const fingerprint=body.match(/- Control-plane fingerprint: ([a-f0-9]{64})/);
  const p33=body.match(/- P33 assurance run: (\d+|none)/);
  const p34=body.match(/- P34 assurance run: (\d+|none)/);
  return {
    epochId:marker[1],
    day:marker[2],
    createdAt:comment.created_at||comment.updated_at||null,
    controlPlaneFingerprint:fingerprint?.[1]||null,
    p33RunId:p33?.[1]&&p33[1]!=='none'?Number(p33[1]):null,
    p34RunId:p34?.[1]&&p34[1]!=='none'?Number(p34[1]):null,
    commentId:comment.id||null,
    url:comment.html_url||null,
  };
}

function determineState({epoch,currentManifest,chain}){
  if(!live)return 'DESIGN_READY';
  if(!epoch)return 'WAITING_FOR_EPOCH';
  if(!epoch.controlPlaneFingerprint||!epoch.controlPlaneManifest)return 'EVIDENCE_INTEGRITY_DEFICIENT';
  if(epoch.controlPlaneFingerprint!==currentManifest.fingerprint)return 'DRIFT_DETECTED';
  if(!chain.valid)return 'EVIDENCE_INTEGRITY_DEFICIENT';
  if(epoch.status==='CERTIFIED')return 'EPOCH_CERTIFIED_STABLE';
  return 'OBSERVING_STABLE_BASELINE';
}

async function maintainIssue(existing,state,epoch,diff,chain){
  if(!mutate)return {action:'disabled'};
  const body=[
    p36ReadinessMarker,
    '# P36 observation integrity readiness',
    '',
    '- State: **'+state+'**',
    '- P35 epoch: **'+(epoch?.id||'none')+'**',
    '- Frozen fingerprint: **'+(epoch?.controlPlaneFingerprint||'none')+'**',
    '- Current fingerprint: **'+currentManifest.fingerprint+'**',
    '- Checkpoint-chain entries: **'+chain.count+'**',
    '- Checkpoint-chain head: **'+chain.head+'**',
    '',
    '## Control-plane drift',
    ...(diff.length?diff.map(change=>'- '+change.path):['- None detected.']),
    '',
    'This is internal observation-integrity evidence. It is not an external audit opinion or certification.',
  ].join('\n');

  if(state==='EPOCH_CERTIFIED_STABLE'){
    if(existing?.state==='open'){
      await github('/repos/'+repo+'/issues/'+existing.number+'/comments',{method:'POST',body:JSON.stringify({body:'P36 verified the certified P35 epoch against its frozen control-plane baseline and checkpoint chain. Closing the readiness issue; this is internal evidence only.'})});
      await github('/repos/'+repo+'/issues/'+existing.number,{method:'PATCH',body:JSON.stringify({state:'closed',state_reason:'completed'})});
      return {action:'closed',number:existing.number,url:existing.html_url};
    }
    return {action:'none'};
  }

  if(existing){
    const updated=await github('/repos/'+repo+'/issues/'+existing.number,{method:'PATCH',body:JSON.stringify({title:'P36 Observation Integrity Readiness',body,state:'open'})});
    return {action:existing.state==='open'?'updated':'reopened',number:updated.number,url:updated.html_url};
  }
  const created=await github('/repos/'+repo+'/issues',{method:'POST',body:JSON.stringify({title:'P36 Observation Integrity Readiness',body})});
  return {action:'opened',number:created.number,url:created.html_url};
}

const currentManifest=buildControlPlaneManifest(root,policy.controlPlanePaths);

if(!live){
  const state='DESIGN_READY';
  const chain=checkpointChain([],currentManifest.fingerprint);
  writeJson('control-plane-manifest.json',currentManifest);
  writeJson('checkpoint-chain.json',chain);
  writeJson('observation-integrity.json',{
    phase:'P36',generatedAt:nowIso,mode:'static',state,
    currentFingerprint:currentManifest.fingerprint,
    missing:currentManifest.missing,
    assuranceBoundary:policy.assuranceBoundary,
  });
  writeFileSync(join(reportDir,'change-control-report.md'),[
    '# Arcade P36 Change-Control Report','',
    '- Generated: '+nowIso,
    '- State: **'+state+'**',
    '- Current control-plane fingerprint: '+currentManifest.fingerprint,
    '- Missing control-plane files: '+currentManifest.missing.length,
    '',
    '> '+policy.assuranceBoundary,'',
  ].join('\n'));
  console.log('P36 OBSERVATION INTEGRITY — '+state);
  process.exit(currentManifest.missing.length?1:0);
}

let issues=await github('/repos/'+repo+'/issues?state=all&per_page=100');
issues=(Array.isArray(issues)?issues:[]).filter(issue=>!issue.pull_request);
const ledgerIssue=issues.find(issue=>typeof issue.body==='string'&&issue.body.includes(p35LedgerMarker))||null;
const readinessIssue=issues.find(issue=>typeof issue.body==='string'&&issue.body.includes(p36ReadinessMarker))||null;
const ledger=parseLedger(ledgerIssue?.body||'');
const epoch=ledger.current;

let checkpoints=[];
if(epoch&&ledgerIssue){
  const comments=await github('/repos/'+repo+'/issues/'+ledgerIssue.number+'/comments?per_page=100');
  checkpoints=(Array.isArray(comments)?comments:[])
    .map(parseCheckpoint)
    .filter(Boolean)
    .filter(item=>item.epochId===epoch.id);
}

const expectedManifest=epoch?.controlPlaneManifest||null;
const diff=expectedManifest?diffControlPlaneManifests(expectedManifest,currentManifest):[];
const chain=checkpointChain(checkpoints,epoch?.controlPlaneFingerprint||currentManifest.fingerprint);
const state=determineState({epoch,currentManifest,chain});

const exceptions=[
  ...(currentManifest.missing.length?[{type:'CONTROL_PLANE_FILE_MISSING',paths:currentManifest.missing}]:[]),
  ...(state==='DRIFT_DETECTED'?[{type:'CONTROL_PLANE_DRIFT',changedPaths:diff.map(change=>change.path)}]:[]),
  ...(!chain.valid?[{type:'CHECKPOINT_FINGERPRINT_MISMATCH',days:chain.links.filter(link=>!link.fingerprintMatches).map(link=>link.day)}]:[]),
  ...(epoch&&!epoch.controlPlaneFingerprint?[{type:'EPOCH_BASELINE_FINGERPRINT_MISSING'}]:[]),
  ...(epoch&&!epoch.controlPlaneManifest?[{type:'EPOCH_BASELINE_MANIFEST_MISSING'}]:[]),
];

const issueAction=await maintainIssue(readinessIssue,state,epoch,diff,chain);

writeJson('control-plane-manifest.json',currentManifest);
writeJson('checkpoint-chain.json',chain);
writeJson('observation-integrity.json',{
  phase:'P36',
  generatedAt:nowIso,
  mode:'live',
  state,
  epoch:epoch?{
    id:epoch.id,
    status:epoch.status,
    start:epoch.start,
    startMainSha:epoch.startMainSha||null,
    startCiRunId:epoch.startCiRunId||null,
    frozenFingerprint:epoch.controlPlaneFingerprint||null,
  }:null,
  currentFingerprint:currentManifest.fingerprint,
  changedPaths:diff.map(change=>change.path),
  missing:currentManifest.missing,
  checkpointChain:{count:chain.count,head:chain.head,valid:chain.valid},
  exceptions,
  issueAction,
  assuranceBoundary:policy.assuranceBoundary,
});

writeFileSync(join(reportDir,'change-control-report.md'),[
  '# Arcade P36 Change-Control Report','',
  '- Generated: '+nowIso,
  '- State: **'+state+'**',
  '- P35 epoch: '+(epoch?.id||'none'),
  '- Frozen fingerprint: '+(epoch?.controlPlaneFingerprint||'none'),
  '- Current fingerprint: '+currentManifest.fingerprint,
  '- Checkpoint-chain entries: '+chain.count,
  '- Checkpoint-chain head: '+chain.head,
  '',
  '## Changed control-plane paths',
  ...(diff.length?diff.map(change=>'- '+change.path):['- None.']),
  '',
  '## Exceptions',
  ...(exceptions.length?exceptions.map(item=>'- '+item.type):['- None.']),
  '',
  '> '+policy.assuranceBoundary,'',
].join('\n'));

console.log('P36 OBSERVATION INTEGRITY — '+state);
console.log('Epoch: '+(epoch?.id||'none')+'; current fingerprint: '+currentManifest.fingerprint);
if(diff.length)console.log('Changed control-plane paths: '+diff.map(change=>change.path).join(', '));
if(!chain.valid)console.log('Checkpoint chain contains baseline fingerprint mismatches.');
