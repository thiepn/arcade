import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(process.cwd());
const catalog=JSON.parse(readFileSync(join(root,'ops/p34-security-controls.json'),'utf8'));
const reportDir=resolve(root,process.env.P34_REPORT_DIR||'p34-report');
const live=process.env.P34_LIVE!=='0' && Boolean(process.env.GITHUB_TOKEN&&process.env.GITHUB_REPOSITORY);
const mutate=live && process.env.P34_MUTATE_ISSUES!=='0';
const failOnDeficiency=process.env.P34_FAIL_ON_DEFICIENCY==='1';
const repo=process.env.GITHUB_REPOSITORY||'';
const token=process.env.GITHUB_TOKEN||'';
const now=new Date();
const deficiencyMarker='<!-- p34-security-assurance-deficiency -->';

mkdirSync(reportDir,{recursive:true});

async function github(path,options={}){
  const response=await fetch('https://api.github.com'+path,{
    ...options,
    headers:{
      Accept:'application/vnd.github+json',
      Authorization:'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'thiepn-arcade-p34-assurance',
      ...(options.headers||{}),
    },
  });
  const text=await response.text();
  if(!response.ok) throw new Error('GitHub API '+response.status+' '+path+': '+text.slice(0,500));
  return text?JSON.parse(text):null;
}

function ageHours(value){
  const ms=now.getTime()-new Date(value).getTime();
  return Number((ms/36e5).toFixed(2));
}

let openIssues=[];
if(live){
  const response=await github('/repos/'+repo+'/issues?state=open&per_page=100');
  openIssues=(Array.isArray(response)?response:[]).filter(issue=>!issue.pull_request);
}

const controls=[];
for(const control of catalog.controls){
  const evidence=control.evidence.map(path=>({path,exists:existsSync(join(root,path))}));
  const missing=evidence.filter(item=>!item.exists).map(item=>item.path);
  const workflowChecks=[];
  if(live){
    for(const requirement of control.workflowEvidence||[]){
      const response=await github('/repos/'+repo+'/actions/workflows/'+encodeURIComponent(requirement.workflow)+'/runs?branch=main&status=success&per_page=1');
      const run=Array.isArray(response.workflow_runs)?response.workflow_runs[0]:null;
      workflowChecks.push({
        workflow:requirement.workflow,
        maxAgeHours:requirement.maxAgeHours,
        runId:run?.id||null,
        headSha:run?.head_sha||null,
        completedAt:run?.updated_at||null,
        ageHours:run?.updated_at?ageHours(run.updated_at):null,
        fresh:Boolean(run?.updated_at)&&ageHours(run.updated_at)<=requirement.maxAgeHours,
        url:run?.html_url||null,
      });
    }
  }
  const blockingIssues=openIssues.filter(issue=>(control.issueMarkers||[]).some(marker=>typeof issue.body==='string'&&issue.body.includes(marker))).map(issue=>({number:issue.number,title:issue.title,url:issue.html_url}));
  const stale=workflowChecks.filter(check=>!check.fresh);
  let status='DESIGNED';
  if(missing.length||blockingIssues.length||stale.length) status='DEFICIENT';
  else if(live) status='OPERATING';
  controls.push({
    id:control.id,
    title:control.title,
    mode:control.mode,
    status,
    evidence,
    workflowChecks,
    blockingIssues,
    deficiencies:[
      ...missing.map(path=>'Missing repository evidence: '+path),
      ...stale.map(check=>'Workflow evidence stale/missing: '+check.workflow+' (max '+check.maxAgeHours+'h)'),
      ...blockingIssues.map(issue=>'Open control-specific issue #'+issue.number+': '+issue.title),
    ],
    nist:control.nist,
    soc2:control.soc2,
  });
}

const deficient=controls.filter(control=>control.status==='DEFICIENT');
const summary={
  phase:'P34',
  generatedAt:now.toISOString(),
  mode:live?'live':'static',
  status:deficient.length?'DEFICIENT':(live?'READY':'DESIGN_READY'),
  controlCount:controls.length,
  operatingCount:controls.filter(c=>c.status==='OPERATING').length,
  designedCount:controls.filter(c=>c.status==='DESIGNED').length,
  deficientCount:deficient.length,
  assuranceBoundary:catalog.assuranceBoundary,
};

const snapshot={summary,controls};
writeFileSync(join(reportDir,'snapshot.json'),JSON.stringify(snapshot,null,2)+'\n');
writeFileSync(join(reportDir,'deficiencies.json'),JSON.stringify({
  generatedAt:summary.generatedAt,
  status:summary.status,
  deficiencies:deficient.map(control=>({id:control.id,title:control.title,items:control.deficiencies})),
},null,2)+'\n');

const markdown=[
  '# Arcade P34 Security Assurance Evidence Pack',
  '',
  '- Generated: '+summary.generatedAt,
  '- Mode: '+summary.mode,
  '- Status: '+summary.status,
  '- Controls: '+summary.controlCount,
  '- Deficient controls: '+summary.deficientCount,
  '',
  '> '+catalog.assuranceBoundary,
  '',
  '| Control | Status | NIST CSF 2.0 readiness | SOC 2 readiness |',
  '| --- | --- | --- | --- |',
  ...controls.map(control=>'| '+control.id+' — '+control.title+' | '+control.status+' | '+control.nist.join(', ')+' | '+control.soc2.join(', ')+' |'),
  '',
  '## Deficiencies',
  ...(deficient.length?deficient.flatMap(control=>['','### '+control.id+' — '+control.title,...control.deficiencies.map(item=>'- '+item)]):['','None detected by this automated assessment.']),
  '',
  '## Interpretation',
  '',
  'This package is internal assurance evidence. It does not constitute a SOC 2 report, NIST certification, legal compliance opinion, penetration test, or independent external audit.',
  '',
].join('\n');
writeFileSync(join(reportDir,'evidence-pack.md'),markdown);

async function maintainDeficiencyIssue(){
  if(!mutate) return {action:'disabled'};
  const existing=openIssues.find(issue=>typeof issue.body==='string'&&issue.body.includes(deficiencyMarker))||null;
  if(deficient.length){
    const body=[
      deficiencyMarker,
      '# P34 continuous-assurance deficiency',
      '',
      'Automated control assurance found '+deficient.length+' deficient control(s). This is an internal readiness signal, not a claim of external non-compliance.',
      '',
      ...deficient.flatMap(control=>['## '+control.id+' — '+control.title,...control.deficiencies.map(item=>'- '+item),'']),
      'Evidence pack: GitHub Actions run '+(process.env.GITHUB_RUN_ID||'unknown')+'.',
    ].join('\n');
    if(existing){
      await github('/repos/'+repo+'/issues/'+existing.number,{method:'PATCH',body:JSON.stringify({title:'P34 Security Assurance Deficiency',body,state:'open'})});
      return {action:'updated',number:existing.number,url:existing.html_url};
    }
    const created=await github('/repos/'+repo+'/issues',{method:'POST',body:JSON.stringify({title:'P34 Security Assurance Deficiency',body})});
    return {action:'opened',number:created.number,url:created.html_url};
  }
  if(existing){
    await github('/repos/'+repo+'/issues/'+existing.number+'/comments',{method:'POST',body:JSON.stringify({body:'P34 continuous assurance recovered: all automated control evidence is current and no mapped blocking readiness issue remains open.'})});
    await github('/repos/'+repo+'/issues/'+existing.number,{method:'PATCH',body:JSON.stringify({state:'closed',state_reason:'completed'})});
    return {action:'closed',number:existing.number,url:existing.html_url};
  }
  return {action:'none'};
}

const issueAction=await maintainDeficiencyIssue();
writeFileSync(join(reportDir,'issue-action.json'),JSON.stringify(issueAction,null,2)+'\n');

console.log('P34 SECURITY CONTROL ASSURANCE — '+summary.status);
console.log('Controls: '+summary.controlCount+'; deficient: '+summary.deficientCount+'; mode: '+summary.mode);
if(deficient.length) for(const control of deficient) console.log('- '+control.id+': '+control.deficiencies.join('; '));
if(failOnDeficiency&&deficient.length) process.exit(1);
