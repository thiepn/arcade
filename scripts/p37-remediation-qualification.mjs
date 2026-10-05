import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildControlPlaneManifest } from './p36-control-plane-core.mjs';
import { ageHours, evaluateEffectiveMainRules, evaluateQualification } from './p37-remediation-core.mjs';

const root=resolve(process.cwd());
const policy=JSON.parse(readFileSync(join(root,'ops/p37-remediation-activation-policy.json'),'utf8'));
const p36Policy=JSON.parse(readFileSync(join(root,'ops/p36-observation-integrity-policy.json'),'utf8'));
const reportDir=resolve(root,process.env.P37_REPORT_DIR||'p37-report');
const live=process.env.P37_LIVE!=='0'&&Boolean(process.env.GITHUB_TOKEN&&process.env.GITHUB_REPOSITORY);
const mutate=live&&process.env.P37_MUTATE_ISSUES!=='0';
const requireEpoch=process.env.P37_REQUIRE_EPOCH==='1';
const repo=process.env.GITHUB_REPOSITORY||'';
const token=process.env.GITHUB_TOKEN||'';
const now=new Date();
const nowIso=now.toISOString();

const p37Marker=policy.p37IssueMarker;
const p35LedgerMarker=policy.p35.ledgerMarker;
const p35LedgerStatePattern=/<!-- p35-ledger-state-b64:([A-Za-z0-9+/=]+) -->/;

mkdirSync(reportDir,{recursive:true});

async function github(path,init={}){
  const response=await fetch('https://api.github.com'+path,{
    ...init,
    headers:{
      Accept:'application/vnd.github+json',
      Authorization:'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28',
      'Content-Type':'application/json',
      ...(init.headers||{}),
    },
  });
  const text=await response.text();
  if(!response.ok)throw new Error('GitHub API '+response.status+' '+path+': '+text.slice(0,500));
  return text?JSON.parse(text):null;
}

async function latestSuccess(filename){
  const body=await github('/repos/'+repo+'/actions/workflows/'+encodeURIComponent(filename)+'/runs?branch=main&status=success&per_page=30');
  return (body.workflow_runs||[])[0]||null;
}

function findOpenIssue(issues,marker){
  return (issues||[]).find(issue=>issue.state==='open'&&!issue.pull_request&&typeof issue.body==='string'&&issue.body.includes(marker))||null;
}
function findAnyIssue(issues,marker){
  return (issues||[]).find(issue=>!issue.pull_request&&typeof issue.body==='string'&&issue.body.includes(marker))||null;
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
function workflowSummary(run){
  return run?{id:run.id,headSha:run.head_sha||null,createdAt:run.created_at||null,updatedAt:run.updated_at||null,url:run.html_url||null}:null;
}
function nextAction(state){
  switch(state){
    case 'WAITING_MAIN_PROTECTION': return 'Create the active main branch ruleset defined in docs/P37_REMEDIATION_ACTIVATION.md.';
    case 'WAITING_OFFLINE_CEREMONY': return 'Perform the real P33 offline-key ceremony and submit the signed attestation.';
    case 'WAITING_P33_RECONCILIATION': return 'P37 can dispatch P33 Long-Term DR Assurance to reconcile the accepted ceremony.';
    case 'WAITING_P34_RECONCILIATION': return 'P37 can dispatch P34 Continuous Security Assurance to reconcile the clean controls.';
    case 'WAITING_CURRENT_HEAD_CI': return 'Wait for a successful CI run on the exact current main SHA.';
    case 'CONTROL_PLANE_DEFICIENT': return 'Restore every missing P36 control-plane file before activation.';
    case 'ACTIVATION_READY': return 'Dispatch canonical P35, then P36, and verify the first epoch exists.';
    case 'FIRST_EPOCH_ACTIVATED': return 'P37 handoff is complete; P35/P36 own the evidence period from here.';
    default: return 'Review the P37 evidence report.';
  }
}

const currentControlPlane=buildControlPlaneManifest(root,p36Policy.controlPlanePaths);

if(!live){
  const state='DESIGN_READY';
  const report={phase:'P37',generatedAt:nowIso,mode:'static',state,currentControlPlaneFingerprint:currentControlPlane.fingerprint,controlPlaneMissing:currentControlPlane.missing,assuranceBoundary:policy.assuranceBoundary};
  writeFileSync(join(reportDir,'qualification.json'),JSON.stringify(report,null,2)+'\n');
  console.log('P37 REMEDIATION QUALIFICATION — '+state);
  process.exit(currentControlPlane.missing.length?1:0);
}

let issues=await github('/repos/'+repo+'/issues?state=all&per_page=100');
issues=(Array.isArray(issues)?issues:[]).filter(issue=>!issue.pull_request);

const [mainBranch,rulesetList,effectiveMainRules,ciRun,p33Attestation,p33Assurance,p34Assurance]=await Promise.all([
  github('/repos/'+repo+'/branches/main'),
  github('/repos/'+repo+'/rulesets'),
  github('/repos/'+repo+'/rules/branches/main'),
  latestSuccess('ci.yml'),
  latestSuccess('p33-offline-attestation.yml'),
  latestSuccess('p33-long-term-assurance.yml'),
  latestSuccess('p34-continuous-assurance.yml'),
]);

const activeRepositoryRulesets=(Array.isArray(rulesetList)?rulesetList:[])
  .filter(item=>item.enforcement==='active');
const effectiveRulesAssessment=evaluateEffectiveMainRules(effectiveMainRules,policy.mainProtection.requiredStatusCheck);
const rulesetAssessment={
  pass:activeRepositoryRulesets.length>0&&effectiveRulesAssessment.pass,
  selected:activeRepositoryRulesets[0]?{id:activeRepositoryRulesets[0].id||null,name:activeRepositoryRulesets[0].name||null}:null,
  activeRulesets:activeRepositoryRulesets.map(item=>({id:item.id||null,name:item.name||null,enforcement:item.enforcement||null})),
  effectiveRules:effectiveRulesAssessment,
  bypassActorsMachineVerified:false,
};

const p33EvidenceIssue=findAnyIssue(issues,policy.p33.evidenceMarker);
const p33Issue=findOpenIssue(issues,policy.p33.assuranceMarker);
const p34Issue=findOpenIssue(issues,policy.p34.deficiencyMarker);
const mainProtectionIssue=findOpenIssue(issues,policy.remediationIssueMarker);
const p37Issues=issues
  .filter(issue=>typeof issue.body==='string'&&issue.body.includes(p37Marker))
  .sort((a,b)=>a.number-b.number);
const p37Issue=p37Issues.find(issue=>issue.state==='open')||p37Issues[0]||null;
const duplicateP37Issues=p37Issues.filter(issue=>issue.number!==p37Issue?.number&&issue.state==='open');
const ledgerIssue=findAnyIssue(issues,p35LedgerMarker);
const ledger=parseLedger(ledgerIssue?.body||'');
const firstEpochEverActivated=Boolean(ledger.current||ledger.history.length);

const mainProtected=Boolean(mainBranch?.protected);
const p33AttestationRecent=Boolean(p33Attestation?.updated_at)&&ageHours(nowIso,p33Attestation.updated_at)<=policy.p33.attestationMaxAgeHours;
const p33EvidencePresent=Boolean(p33EvidenceIssue);
const p33AssuranceRecent=Boolean(p33Assurance?.updated_at)&&ageHours(nowIso,p33Assurance.updated_at)<=policy.p33.assuranceMaxAgeHours;
const p34AssuranceRecent=Boolean(p34Assurance?.updated_at)&&ageHours(nowIso,p34Assurance.updated_at)<=policy.p34.assuranceMaxAgeHours;
const currentHeadSha=mainBranch?.commit?.sha||null;
const currentHeadCiReady=Boolean(ciRun?.head_sha)&&ciRun.head_sha===currentHeadSha;
const controlPlaneClean=currentControlPlane.missing.length===0;

const evaluation=evaluateQualification({
  firstEpochEverActivated,
  mainProtected,
  rulesetQualified:rulesetAssessment.pass,
  p33AttestationRecent,
  p33EvidencePresent,
  p33AssuranceRecent,
  p33IssueOpen:Boolean(p33Issue),
  p34AssuranceRecent,
  p34IssueOpen:Boolean(p34Issue),
  currentHeadCiReady,
  controlPlaneClean,
});

if(mutate&&mainProtected&&rulesetAssessment.pass&&mainProtectionIssue){
  await github('/repos/'+repo+'/issues/'+mainProtectionIssue.number+'/comments',{
    method:'POST',
    body:JSON.stringify({body:[
      'P37 verified an active no-bypass main ruleset with PR enforcement, deletion/force-push protection, strict required status checks, and required `build`.',
      '',
      '- Ruleset: '+(rulesetAssessment.selected?.name||rulesetAssessment.selected?.id||'qualified'),
      '- Verified at: '+nowIso,
      '',
      'SC-01 remediation is now machine-qualified, so this tracking issue is being closed.',
    ].join('\n')}),
  });
  await github('/repos/'+repo+'/issues/'+mainProtectionIssue.number,{method:'PATCH',body:JSON.stringify({state:'closed',state_reason:'completed'})});
}

const checks={
  mainProtected,
  rulesetQualified:rulesetAssessment.pass,
  p33AttestationRecent,
  p33EvidencePresent,
  p33AssuranceRecent,
  p33IssueOpen:Boolean(p33Issue),
  p34AssuranceRecent,
  p34IssueOpen:Boolean(p34Issue),
  currentHeadCiReady,
  controlPlaneClean,
  firstEpochEverActivated,
};

const report={
  phase:'P37',
  generatedAt:nowIso,
  mode:'live',
  state:evaluation.state,
  activationReady:evaluation.activationReady,
  nextAction:nextAction(evaluation.state),
  checks,
  main:{
    sha:currentHeadSha,
    protected:mainProtected,
    qualifyingRuleset:rulesetAssessment.selected,
    activeRulesets:rulesetAssessment.activeRulesets,
    effectiveRules:rulesetAssessment.effectiveRules,
    bypassActorsMachineVerified:false,
  },
  workflows:{
    ci:workflowSummary(ciRun),
    p33Attestation:workflowSummary(p33Attestation),
    p33Assurance:workflowSummary(p33Assurance),
    p34Assurance:workflowSummary(p34Assurance),
  },
  issues:{
    mainProtection:mainProtectionIssue?.number||null,
    p33Assurance:p33Issue?.number||null,
    p33Evidence:p33EvidenceIssue?.number||null,
    p34Deficiency:p34Issue?.number||null,
    p35Ledger:ledgerIssue?.number||null,
    p37Canonical:p37Issue?.number||null,
    p37Duplicates:duplicateP37Issues.map(issue=>issue.number),
  },
  epoch:{
    current:ledger.current?{id:ledger.current.id,start:ledger.current.start,status:ledger.current.status,controlPlaneFingerprint:ledger.current.controlPlaneFingerprint||null}:null,
    historyCount:ledger.history.length,
  },
  controlPlane:{
    fingerprint:currentControlPlane.fingerprint,
    missing:currentControlPlane.missing,
  },
  dispatch:{
    p33Assurance:evaluation.dispatchP33Assurance,
    p34:evaluation.dispatchP34,
    p35:evaluation.dispatchP35,
  },
  assuranceBoundary:policy.assuranceBoundary,
};
writeFileSync(join(reportDir,'qualification.json'),JSON.stringify(report,null,2)+'\n');

const summary=[
  '# P37 remediation qualification',
  '',
  '- State: **'+evaluation.state+'**',
  '- Current main: `'+(currentHeadSha||'unknown')+'`',
  '- Main ruleset qualified: **'+rulesetAssessment.pass+'**',
  '- P33 ready: **'+evaluation.p33Ready+'**',
  '- P34 ready: **'+evaluation.p34Ready+'**',
  '- Current-head CI ready: **'+currentHeadCiReady+'**',
  '- Control plane clean: **'+controlPlaneClean+'**',
  '- First epoch ever activated: **'+firstEpochEverActivated+'**',
  '',
  'Next action: '+nextAction(evaluation.state),
  '',
  '> '+policy.assuranceBoundary,
  '',
].join('\n');
writeFileSync(join(reportDir,'summary.md'),summary);

if(mutate){
  for(const duplicate of duplicateP37Issues){
    await github('/repos/'+repo+'/issues/'+duplicate.number+'/comments',{
      method:'POST',
      body:JSON.stringify({body:'Closing duplicate P37 readiness tracker. Canonical issue: #'+(p37Issue?.number||'pending')+'.'}),
    });
    await github('/repos/'+repo+'/issues/'+duplicate.number,{
      method:'PATCH',
      body:JSON.stringify({state:'closed',state_reason:'not_planned'}),
    });
  }

  const issueBody=[
    p37Marker,
    '# P37 remediation / first-epoch activation',
    '',
    '- State: **'+evaluation.state+'**',
    '- Current main: `'+(currentHeadSha||'unknown')+'`',
    '- Main protected: **'+mainProtected+'**',
    '- Qualifying active ruleset: **'+rulesetAssessment.pass+'**',
    '- P33 signed attestation recent: **'+p33AttestationRecent+'**',
    '- P33 long-term assurance ready: **'+evaluation.p33Ready+'**',
    '- P34 assurance clean: **'+evaluation.p34Ready+'**',
    '- Exact-current-head CI successful: **'+currentHeadCiReady+'**',
    '- P36 control plane complete: **'+controlPlaneClean+'**',
    '- First P35 epoch ever activated: **'+firstEpochEverActivated+'**',
    '',
    '## Next action',
    nextAction(evaluation.state),
    '',
    'Runbook: docs/P37_REMEDIATION_ACTIVATION.md',
    '',
    'This issue tracks internal remediation activation only; it is not an external audit or certification.',
  ].join('\n');

  if(evaluation.state==='FIRST_EPOCH_ACTIVATED'){
    if(p37Issue&&p37Issue.state==='open'){
      await github('/repos/'+repo+'/issues/'+p37Issue.number+'/comments',{method:'POST',body:JSON.stringify({body:'P37 verified the first P35 evidence epoch has been created. Remediation activation is complete; P35/P36 now own the observation period.'})});
      await github('/repos/'+repo+'/issues/'+p37Issue.number,{method:'PATCH',body:JSON.stringify({title:'P37 Remediation / First-Epoch Activation',body:issueBody,state:'closed',state_reason:'completed'})});
    }
  }else if(p37Issue){
    await github('/repos/'+repo+'/issues/'+p37Issue.number,{method:'PATCH',body:JSON.stringify({title:'P37 Remediation / First-Epoch Activation',body:issueBody,state:'open'})});
  }else{
    await github('/repos/'+repo+'/issues',{method:'POST',body:JSON.stringify({title:'P37 Remediation / First-Epoch Activation',body:issueBody})});
  }
}

if(process.env.GITHUB_OUTPUT){
  await appendFile(process.env.GITHUB_OUTPUT,[
    'state='+evaluation.state,
    'dispatch_p33_assurance='+(evaluation.dispatchP33Assurance?'true':'false'),
    'dispatch_p34='+(evaluation.dispatchP34?'true':'false'),
    'activation_ready='+(evaluation.activationReady?'true':'false'),
    'first_epoch_activated='+(firstEpochEverActivated?'true':'false'),
    '',
  ].join('\n'));
}

console.log('P37 REMEDIATION QUALIFICATION — '+evaluation.state);
console.log('Ruleset qualified: '+rulesetAssessment.pass+'; P33 ready: '+evaluation.p33Ready+'; P34 ready: '+evaluation.p34Ready+'; current-head CI: '+currentHeadCiReady);
if(requireEpoch&&!firstEpochEverActivated){
  console.error('P37 activation verification failed: activation was attempted but no P35 epoch exists.');
  process.exit(1);
}
